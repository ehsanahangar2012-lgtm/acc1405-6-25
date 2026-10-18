// Persistent Host Storage Service - High-Performance, Multi-Tenant & Standalone Offline Ready
import { workspaceService } from './workspaceService';
import { idbService } from './indexedDBService';
import { isDesktopApp } from '../utils';
import { licenseQuotaService } from './licenseQuotaService';

interface StorageResponse {
    success: boolean;
    message?: string;
    data?: any;
    workspace?: string;
}

class PersistentStorage {
    // حافظه کش در RAM برای دسترسی فوری بدون معطلی و بدون لگ در ویندوز
    private memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
    private inFlightLoads: Map<string, Promise<any>> = new Map();
    private pendingSaves: Map<string, { value: any; timer: any; resolvers: Array<(success: boolean) => void> }> = new Map();
    private readonly CACHE_TTL_MS = 6000; // ۶ ثانیه اعتبار کش در حافظه رم
    private readonly WRITE_DEBOUNCE_MS = 400; // ۴۰۰ میلی‌ثانیه دی‌بانس برای تجمیع درخواست‌های ذخیره

    private async request(action: string, data: any): Promise<StorageResponse> {
        // ۱. اگر حالت آفلاین مستقل فعال باشد، نیازی به ارتباط با هاست نیست
        if (workspaceService.isStandaloneOffline()) {
            return { success: false, message: 'حالت آفلاین مستقل فعال است' };
        }

        // ۲. در حالت نصب خام (اندروید، ویندوز و کلاینت‌ها)، تا زمان ورود اطلاعات سرور و توکن، داده‌ها کاملاً محلی هستند
        if (!workspaceService.isRemoteCloudConfigured()) {
            return { success: false, message: 'سامانه در حالت داده محلی مستقل و خام اجرا می‌شود (عدم دسترسی به هاست).' };
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { success: false, message: 'دستگاه آفلاین است' };
        }

        const baseUrl = workspaceService.getBaseUrl();
        if (!baseUrl) {
            return { success: false, message: 'آدرس سرور هاست پیکربندی نشده است' };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const storageEndpoint = `${baseUrl}/storage.php`;
            const workspaceHeaders = workspaceService.getHeaders();

            const response = await fetch(storageEndpoint, {
                method: 'POST',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    ...workspaceHeaders
                },
                body: JSON.stringify({
                    action,
                    workspace_id: workspaceService.getWorkspaceId(),
                    ...data
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                return { success: false, message: `پاسخ ناموفق سرور (${response.status})` };
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                return { success: false, message: 'سرور پاسخ نامعتبر ارسال کرد' };
            }

            const result = await response.json() as StorageResponse;
            if (!result || result.success !== true) {
                return {
                    success: false,
                    message: result?.message || 'ذخیره‌سازی روی سرور تأیید نشد'
                };
            }
            return result;
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : 'خطا در ارتباط با سرور' };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * ذخیره داده با سرعت فوق‌العاده بالا:
     * ۱. ذخیره فوری در حافظه رم (0ms)
     * ۲. ذخیره غیرمسدودکننده در IndexedDB محلی
     * ۳. ارسال دی‌بانس شده به سرور در پس‌زمینه بدون مسدودسازی نخ اصلی رابط کاربری
     */
    async saveData(key: string, value: any): Promise<boolean> {
        // به‌روزرسانی فوری کش محلی؛ این به‌تنهایی به‌معنای تأیید ذخیره ابری نیست.
        this.memoryCache.set(key, { data: value, timestamp: Date.now() });

        // ذخیره پشتیبان محلی به‌صورت ناهمگام
        if (typeof window !== 'undefined') {
            try {
                idbService.save('backups', {
                    id: `storage_${key}`,
                    data: JSON.stringify(value),
                    updatedAt: Date.now()
                }).catch(() => {});
            } catch {}
        }

        // در حالت آفلاین مستقل، ذخیره محلی کافی است.
        if (workspaceService.isStandaloneOffline()) {
            return true;
        }

        // همه فراخوانی‌های یک کلید، نتیجه همان آخرین مقدارِ ارسال‌شده را دریافت می‌کنند.
        // موفقیت فقط پس از پاسخ موفق سرور اعلام می‌شود؛ نه بلافاصله پس از صف‌بندی.
        return new Promise<boolean>((resolve) => {
            const existing = this.pendingSaves.get(key);
            if (existing) {
                clearTimeout(existing.timer);
                existing.value = value;
                existing.resolvers.push(resolve);
                existing.timer = setTimeout(() => {
                    void this.flushPendingSave(key, existing);
                }, this.WRITE_DEBOUNCE_MS);
                return;
            }

            const pending = {
                value,
                timer: undefined as any,
                resolvers: [resolve]
            };
            pending.timer = setTimeout(() => {
                void this.flushPendingSave(key, pending);
            }, this.WRITE_DEBOUNCE_MS);
            this.pendingSaves.set(key, pending);
        });
    }

    private async flushPendingSave(
        key: string,
        pending: { value: any; timer: any; resolvers: Array<(success: boolean) => void> }
    ): Promise<void> {
        if (this.pendingSaves.get(key) !== pending) return;
        this.pendingSaves.delete(key);

        let success = false;
        try {
            const result = await this.request('save', {
                key,
                value: JSON.stringify(pending.value)
            });
            success = result.success === true;
        } catch {
            success = false;
        } finally {
            pending.resolvers.forEach(resolve => resolve(success));
        }
    }

    /**
     * بارگذاری داده با بهینه‌سازی پیشرفته:
     * ۱. خواندن فوری از کش RAM در صورت معتبر بودن
     * ۲. اشتراک‌گذاری درخواست‌های همزمان (Request Deduplication)
     * ۳. بازگشت سریع به کش IndexedDB در صورت آفلاین بودن یا خطای شبکه
     */
    async loadData(key: string, forceRefresh = false): Promise<any> {
        // ۱. بررسی کش RAM
        if (!forceRefresh) {
            const cached = this.memoryCache.get(key);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
                return cached.data;
            }
        }

        // ۲. بررسی درخواست‌های در حال انجام (In-Flight Sharing)
        if (this.inFlightLoads.has(key)) {
            return await this.inFlightLoads.get(key);
        }

        if (workspaceService.isStandaloneOffline()) {
            try {
                const local = await idbService.get('backups', `storage_${key}`);
                const data = local?.data ? JSON.parse(local.data) : null;
                if (data) this.memoryCache.set(key, { data, timestamp: Date.now() });
                return data;
            } catch {
                return null;
            }
        }

        // ۳. اجرای درخواست از سرور با به اشتراک‌گذاری پرامیس
        const loadPromise = (async () => {
            try {
                const result = await this.request('load', { key });
                if (result.success && result.data) {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(result.data);
                    } catch {
                        parsed = null;
                    }
                    if (parsed !== null) {
                        this.memoryCache.set(key, { data: parsed, timestamp: Date.now() });
                        return parsed;
                    }
                }

                // اگر هاست پاسخ نداد یا آفلاین بود، از کش محلی استفاده شود
                const fallback = await idbService.get('backups', `storage_${key}`);
                let fallbackData = null;
                try {
                    fallbackData = fallback?.data ? JSON.parse(fallback.data) : null;
                } catch {
                    fallbackData = null;
                }
                if (fallbackData) {
                    this.memoryCache.set(key, { data: fallbackData, timestamp: Date.now() });
                }
                return fallbackData;
            } catch {
                try {
                    const fallback = await idbService.get('backups', `storage_${key}`);
                    return fallback?.data ? JSON.parse(fallback.data) : null;
                } catch {
                    return null;
                }
            } finally {
                this.inFlightLoads.delete(key);
            }
        })();

        this.inFlightLoads.set(key, loadPromise);
        return await loadPromise;
    }

    /**
     * پاکسازی کش جدول مشخص
     */
    invalidateCache(key?: string) {
        if (key) {
            this.memoryCache.delete(key);
        } else {
            this.memoryCache.clear();
        }
    }

    async saveImage(folder: 'companies' | 'products' | 'checks', filename: string, base64: string): Promise<string | null> {
        if (workspaceService.isStandaloneOffline()) {
            return base64;
        }

        const result = await this.request('saveImage', { folder, filename, base64 });
        return result.success ? result.data : null;
    }

    async deleteImage(path: string): Promise<boolean> {
        if (workspaceService.isStandaloneOffline()) {
            return true;
        }

        const result = await this.request('deleteImage', { path });
        return result.success;
    }
}

export const persistentStorage = new PersistentStorage();
