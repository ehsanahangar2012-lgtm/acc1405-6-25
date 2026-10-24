/**
 * سرویس مرکزی صف سینک - SyncQueueService v2
 *
 * این سرویس تنها نقطه مرکزی برای مدیریت تمام عملیات ناموفق هاست است.
 *
 * ویژگی‌ها:
 * - یک صف واحد (sync_queue_v2) برای تمام سرویس‌ها
 * - Deduplication: از تکرار همان آیتم جلوگیری می‌کند
 * - Exponential backoff: فاصله retry افزایشی
 * - Batch processing: ۲۰ آیتم در هر دور
 * - Migration خودکار از صف‌های قدیمی
 * - جلوگیری از اجرای موازی
 * - آمار دقیق و وضعیت صف
 */

import { API_CONFIG } from '../config';
import { workspaceService } from './workspaceService';
import { appLogService } from './appLogService';

export interface QueueItem {
    id: string;
    operation: 'save' | 'delete';
    table: string;
    data: any;
    timestamp: number;
    retries: number;
    nextRetryAt: number;
    source?: string; // برای debug: کجا enqueue شده
}

export interface QueueStats {
    total: number;
    ready: number;          // آماده پردازش فوری
    retrying: number;       // در انتظار retry
    oldestItemAge: number;  // سن قدیمی‌ترین آیتم (ms)
}

const QUEUE_KEY = 'sync_queue_v2';
const MAX_RETRIES = 5;
const BATCH_SIZE = 20;
const BASE_RETRY_DELAY_MS = 2000; // ۲ ثانیه پایه
const FETCH_TIMEOUT_MS = 10000;   // ۱۰ ثانیه timeout

// کلیدهای صف‌های قدیمی که باید migrate شوند
const LEGACY_QUEUE_KEYS = [
    { key: 'offline-queue',       format: 'smart' as const },
    { key: 'host-db-queue',       format: 'host' as const },
    { key: 'offline_queue',       format: 'storage' as const },
    { key: 'unified-retry-queue', format: 'unified' as const },
];

class SyncQueueService {
    private isProcessing = false;
    private processTimer: ReturnType<typeof setTimeout> | null = null;
    private token: string;
    private baseUrl: string;

    constructor() {
        this.token = import.meta.env.VITE_API_TOKEN || 'secure_api_token_change_this';
        this.baseUrl = API_CONFIG.DATABASE_API;

        // انتقال صف‌های قدیمی
        try { this.migrateOldQueues(); } catch (e) { console.warn('Queue migration error:', e); }

        // listener برای آنلاین شدن
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('🌐 آنلاین شد - شروع پردازش صف سینک');
                this.scheduleProcessing(1000);
            });
        }
    }

    /**
     * افزودن عملیات به صف
     * @param source نام سرویس فراخوان (برای debug)
     */
    enqueue(operation: 'save' | 'delete', table: string, data: any, source = 'unknown'): void {
        if (!table || (!data && operation === 'save')) {
            console.warn(`syncQueue.enqueue: داده نامعتبر - ${table}`, data);
            return;
        }

        const queue = this.loadQueue();

        // Deduplication: همان operation + table + id → به‌روزرسانی
        const dataId = data?.id;
        const existingIndex = dataId != null
            ? queue.findIndex(i => i.operation === operation && i.table === table && i.data?.id === dataId)
            : -1;

        const newItem: QueueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            operation,
            table,
            data,
            timestamp: Date.now(),
            retries: 0,
            nextRetryAt: Date.now(), // فوری
            source,
        };

        if (existingIndex >= 0) {
            // به‌روزرسانی آیتم موجود (id ثابت می‌ماند)
            queue[existingIndex] = { ...newItem, id: queue[existingIndex].id };
            appLogService.logSync('queue_enqueue', `به‌روزرسانی آیتم در صف سینک: [${source}] ${operation} ${table}/${dataId}`, { table, operation, id: dataId });
        } else {
            queue.push(newItem);
            appLogService.logSync('queue_enqueue', `افزودن به صف سینک: [${source}] ${operation} ${table}/${dataId ?? '?'} (طول صف: ${queue.length})`, { table, operation, id: dataId, queueLength: queue.length });
        }

        this.saveQueue(queue);
        this.scheduleProcessing(500); // تلاش سریع
    }

    /**
     * پردازش صف - اصلی‌ترین متد
     */
    async processQueue(): Promise<{ processed: number; failed: number; remaining: number }> {
        if (this.isProcessing) {
            return { processed: 0, failed: 0, remaining: this.loadQueue().length };
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { processed: 0, failed: 0, remaining: this.loadQueue().length };
        }

        if (!workspaceService.isRemoteCloudConfigured()) {
            return { processed: 0, failed: 0, remaining: 0 };
        }

        this.isProcessing = true;
        let processed = 0;
        let failed = 0;

        try {
            const queue = this.loadQueue();
            if (queue.length === 0) return { processed: 0, failed: 0, remaining: 0 };

            const now = Date.now();
            const ready = queue.filter(i => i.nextRetryAt <= now);
            const notReady = queue.filter(i => i.nextRetryAt > now);

            if (ready.length === 0) {
                // زمانبندی برای کوچکترین nextRetryAt
                const minNext = Math.min(...notReady.map(i => i.nextRetryAt));
                this.scheduleProcessing(Math.max(1000, minNext - now));
                return { processed: 0, failed: 0, remaining: queue.length };
            }

            const batch = ready.slice(0, BATCH_SIZE);
            const waitingBatch = ready.slice(BATCH_SIZE); // بیش از ۲۰ آیتم → دور بعد

            const failedItems: QueueItem[] = [];

            for (const item of batch) {
                try {
                    await this.executeItem(item);
                    processed++;
                } catch (error: any) {
                    if (this.isNetworkError(error)) {
                        // در صورت قطعی شبکه یا عدم ارتباط با هاست، تلاش گرانبها را نمی‌سوزانیم
                        // فقط زمان تلاش بعدی را با تأخیر (exponential backoff) تنظیم می‌کنیم تا داده‌ها آسیب نبینند
                        const backoffFactor = Math.pow(2, Math.min(item.retries + 1, 5));
                        item.nextRetryAt = Date.now() + backoffFactor * BASE_RETRY_DELAY_MS;
                        failedItems.push(item);
                        console.warn(`📡 خطای ارتباط با هاست برای ${item.operation} ${item.table} [${item.id}]: تلاش مجدد برنامه‌ریزی شد (بدون سوختن فرصت)`);
                    } else {
                        item.retries++;
                        if (item.retries < MAX_RETRIES) {
                            // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                            item.nextRetryAt = Date.now() + Math.pow(2, item.retries) * BASE_RETRY_DELAY_MS;
                            failedItems.push(item);
                            console.warn(`⚠️ retry ${item.retries}/${MAX_RETRIES} برای ${item.operation} ${item.table}: ${error?.message}`);
                        } else {
                            // برای جلوگیری از گم شدن داده‌های مالی کاربر در لوکال، آیتم را کامل حذف نمی‌کنیم
                            // بلکه تلاش مجدد آن را برای ۴۵ دقیقه بعد برنامه‌ریزی می‌کنیم تا کاربر داده‌های خود را از دست ندهد
                            item.nextRetryAt = Date.now() + 45 * 60 * 1000; // ۴۵ دقیقه بعد
                            item.retries = 0; // ریست شمارنده تلاش‌ها برای دور بعد
                            failedItems.push(item);
                            console.warn(`⏳ آیتم پس از ${MAX_RETRIES} تلاش ناموفق، برای تلاش مجدد در ۴۵ دقیقه آینده تعلیق شد: ${item.table} [${item.id}] (بدون حذف داده)`);
                        }
                    }
                }
            }

            const newQueue = [...notReady, ...waitingBatch, ...failedItems];
            this.saveQueue(newQueue);

            if (processed > 0 || failed > 0) {
                console.log(`🎉 صف: ${processed} موفق | ${failed} حذف‌شده | ${newQueue.length} باقی`);
            }

            // اگر هنوز آیتمی مانده، برنامه‌ریزی پردازش بعدی
            if (newQueue.length > 0) {
                const minNext = Math.min(...newQueue.map(i => i.nextRetryAt));
                const delay = Math.max(1000, minNext - Date.now());
                this.scheduleProcessing(delay);
            }

            return { processed, failed, remaining: newQueue.length };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * اجرای یک آیتم صف با timeout
     */
    private async executeItem(item: QueueItem): Promise<void> {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            let response: Response;
            if (item.operation === 'save') {
                response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.token,
                    },
                    body: JSON.stringify({ action: 'save', table: item.table, data: item.data }),
                    signal: controller.signal,
                });
            } else {
                // delete
                response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.token,
                    },
                    body: JSON.stringify({ action: 'delete', table: item.table, id: item.data?.id }),
                    signal: controller.signal,
                });
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            // برای save بررسی success از body
            if (item.operation === 'save') {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const result = await response.json();
                    if (result && result.success === false) {
                        throw new Error(result.message || 'سرور خطا برگرداند');
                    }
                }
            }
        } finally {
            clearTimeout(tid);
        }
    }

    /**
     * زمانبندی پردازش با debounce
     */
    scheduleProcessing(delayMs = 0): void {
        if (this.processTimer) clearTimeout(this.processTimer);
        this.processTimer = setTimeout(() => {
            this.processTimer = null;
            this.processQueue().catch(e => console.error('خطا در processQueue:', e));
        }, delayMs);
    }

    /** دریافت کپی از تمام اقلام صف */
    getQueue(): QueueItem[] {
        return this.loadQueue();
    }

    /**
     * دریافت آمار صف
     */
    getStats(): QueueStats {
        const queue = this.loadQueue();
        const now = Date.now();
        const ready = queue.filter(i => i.nextRetryAt <= now).length;
        const retrying = queue.filter(i => i.nextRetryAt > now && i.retries > 0).length;
        const oldest = queue.reduce((min, i) => Math.min(min, i.timestamp), Infinity);
        return {
            total: queue.length,
            ready,
            retrying,
            oldestItemAge: queue.length > 0 ? now - oldest : 0,
        };
    }

    /** پاکسازی کل صف (فقط ادمین) */
    clearQueue(): void {
        this.saveQueue([]);
        console.warn('⚠️ صف سینک به‌طور کامل پاک شد');
    }

    /**
     * انتقال صف‌های قدیمی به فرمت جدید
     */
    private migrateOldQueues(): void {
        const existing = this.loadQueue();
        const existingSignatures = new Set(
            existing.map(i => `${i.operation}|${i.table}|${i.data?.id}`)
        );
        let migrated = 0;

        for (const { key, format } of LEGACY_QUEUE_KEYS) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const oldQueue = JSON.parse(raw);
                if (!Array.isArray(oldQueue) || oldQueue.length === 0) {
                    localStorage.removeItem(key);
                    continue;
                }

                for (const old of oldQueue) {
                    const newItem = this.convertLegacyItem(old, format);
                    if (!newItem) continue;
                    const sig = `${newItem.operation}|${newItem.table}|${newItem.data?.id}`;
                    if (existingSignatures.has(sig)) continue; // از تکرار جلوگیری
                    existing.push(newItem);
                    existingSignatures.add(sig);
                    migrated++;
                }

                localStorage.removeItem(key);
                console.log(`♻️ صف قدیمی "${key}" منتقل و پاک شد`);
            } catch (e) {
                console.warn(`خطا در انتقال صف "${key}":`, e);
                localStorage.removeItem(key); // صف خراب را پاک کن
            }
        }

        if (migrated > 0) {
            this.saveQueue(existing);
            console.log(`🔄 ${migrated} آیتم از صف‌های قدیمی به sync_queue_v2 منتقل شد`);
        }
    }

    private convertLegacyItem(
        old: any,
        format: 'smart' | 'host' | 'storage' | 'unified'
    ): QueueItem | null {
        const base = {
            id: `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: old.timestamp ? new Date(old.timestamp).getTime() : Date.now(),
            retries: 0,
            nextRetryAt: Date.now(),
            source: `legacy-${format}`,
        };

        if (format === 'smart' || format === 'host') {
            if (!old.table || !old.data) return null;
            return { ...base, operation: old.operation || 'save', table: old.table, data: old.data };
        }

        if (format === 'storage') {
            // { action: 'save', data: { table, data } }
            if (old.action === 'save' && old.data?.table && old.data?.data) {
                return { ...base, operation: 'save', table: old.data.table, data: old.data.data };
            }
            return null;
        }

        if (format === 'unified') {
            // { target, table, data, retries, maxRetries, nextRetry }
            if (!old.table || !old.data) return null;
            return { ...base, operation: 'save', table: old.table, data: old.data, retries: old.retries || 0 };
        }

        return null;
    }

    private isNetworkError(error: any): boolean {
        if (!error) return false;
        const msg = String(error.message || error).toLowerCase();
        return (
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('network error') ||
            msg.includes('abort') ||
            msg.includes('timeout') ||
            msg.includes('no connection') ||
            msg.includes('connection refused') ||
            msg.includes('connrefused') ||
            msg.includes('unreachable') ||
            msg.includes('offline') ||
            msg.includes('http 502') ||
            msg.includes('http 503') ||
            msg.includes('http 504') ||
            msg.includes('http 500') ||
            msg.includes('http 404')
        );
    }

    private loadQueue(): QueueItem[] {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            if (!raw) return [];
            return JSON.parse(raw) as QueueItem[];
        } catch {
            localStorage.removeItem(QUEUE_KEY); // صف خراب را پاک کن
            return [];
        }
    }

    private saveQueue(queue: QueueItem[]): void {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            // localStorage پر است - قدیمی‌ترین آیتم‌های حل‌شده را حذف کن
            const trimmed = queue.slice(-100); // نگه داشتن ۱۰۰ آیتم آخر
            try { localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
        }
    }
}

export const syncQueue = new SyncQueueService();
