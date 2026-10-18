/**
 * سرویس بکاپ هاست - HostBackupService
 *
 * مسئولیت‌ها:
 * 1. بکاپ روزانه کامل state به هاست (server-api-backup.php)
 * 2. بکاپ فایل‌های باینری: لوگو، امضا، مهر شرکت (به‌صورت base64)
 * 3. لیست بکاپ‌ها از هاست
 * 4. بازیابی بکاپ از هاست
 * 5. نگهداری آخرین ۷ بکاپ روی هاست
 * 6. بکاپ لوکال در IndexedDB به‌عنوان fallback
 */

import { API_CONFIG } from '../config';
import { idbService } from './indexedDBService';
import { useFinancialStore } from '../store-financial';

// ─── انواع ───────────────────────────────────────────────────────────────────

export interface HostBackupEntry {
    id: string;               // مثلاً "backup_20240621_143000"
    timestamp: number;        // unix ms
    label: string;            // "بکاپ روزانه ۱۴۰۳/۰۳/۳۱"
    size: number;             // bytes
    type: 'auto' | 'manual';
    checksum: string;
    version: string;          // نسخه اپ
    hasAssets: boolean;       // آیا لوگو/امضا دارد
}

export interface BackupAssets {
    companies: Array<{
        id: string;
        name: string;
        logo?: string;       // base64 data URL
        stamp?: string;      // base64 data URL
        signature?: string;  // base64 data URL
    }>;
    checkImages?: Array<{
        id: string;
        checkNumber?: string;
        sayadId?: string;
        imageUrl?: string;
        holderName?: string;
    }>;
    signatures?: Array<{
        id: string;
        type: string;
        signature: string;
    }>;
}

export interface BackupResult {
    success: boolean;
    backupId?: string;
    message?: string;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    data?: any;
    error?: string;
}

// ─── ثابت‌ها ─────────────────────────────────────────────────────────────────

const LOCAL_BACKUP_STORE  = 'local_backups';
const LAST_BACKUP_KEY     = 'host_last_backup_time';
const BACKUP_INTERVAL_MS  = 24 * 60 * 60 * 1000; // ۲۴ ساعت
const MAX_HOST_BACKUPS    = 10; // نگهداری حداکثر ۱۰ فایل در هاست
const FETCH_TIMEOUT_MS    = 30_000; // ۳۰ ثانیه - بکاپ داده بزرگ است
const APP_VERSION         = '16.54.0';

// جداول اصلی که باید بکاپ شوند
const BACKUP_TABLES = [
    'users', 'companies', 'products', 'people',
    'invoices', 'vouchers', 'checks', 'transactions',
    'checkTransfers', 'contracts', 'salaries', 'config',
    'roles', 'importConfigs', 'logisticsProfiles',
    'defaultInvoiceFooter', 'savedDescriptions'
] as const;

// ─── سرویس ───────────────────────────────────────────────────────────────────

class HostBackupService {
    private token: string;
    private backupUrl: string;
    private timerHandle: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;

    constructor() {
        this.token    = import.meta.env.VITE_API_TOKEN || 'secure_api_token_change_this';
        this.backupUrl = API_CONFIG.BACKUP_API;
    }

    // ─── عمومی ───────────────────────────────────────────────────────────────

    /**
     * شروع بکاپ خودکار روزانه
     * @param getState تابعی که state کامل zustand را برمی‌گرداند
     */
    start(getState: () => any): void {
        this.stop();

        // بررسی آیا امروز بکاپ گرفته شده
        const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY) || '0');
        const hoursSinceLast = (Date.now() - lastBackup) / (1000 * 60 * 60);

        if (hoursSinceLast >= 24 || lastBackup === 0) {
            // بکاپ اولیه با تاخیر ۱۰ ثانیه بعد از راه‌اندازی
            setTimeout(() => {
                if (navigator.onLine) {
                    this.createBackup(getState(), 'auto');
                }
            }, 10_000);
        } else {
            console.log(`📦 بکاپ امروز انجام شده، بعدی در ${Math.round(24 - hoursSinceLast)} ساعت`);
        }

        // بررسی هر ساعت
        this.timerHandle = setInterval(() => {
            const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || '0');
            if (Date.now() - last >= BACKUP_INTERVAL_MS && navigator.onLine) {
                this.createBackup(getState(), 'auto');
            }
        }, 60 * 60 * 1000); // هر ساعت چک می‌کند
    }

    stop(): void {
        if (this.timerHandle) {
            clearInterval(this.timerHandle);
            this.timerHandle = null;
        }
    }

    private autoBackupDebounceTimer: any = null;

    /**
     * ثبت درخواست بک‌آپ خودکار با دی‌بانس هوشمند برای هربار ثبت فاکتور، سند، چک و...
     */
    triggerAutoBackup(state: any, reason: string = 'ثبت اطلاعات'): void {
        if (this.autoBackupDebounceTimer) {
            clearTimeout(this.autoBackupDebounceTimer);
        }
        this.autoBackupDebounceTimer = setTimeout(() => {
            this.createBackup(state, 'auto', reason).catch(err => {
                console.warn('Auto backup notification error:', err);
            });
        }, 1200);
    }

    // ─── ایجاد بکاپ ──────────────────────────────────────────────────────────

    /**
     * ایجاد بکاپ کامل (داده + فایل‌های باینری و تصاویر چک‌ها و امضاها)
     */
    async createBackup(state: any, type: 'auto' | 'manual' = 'manual', reason?: string): Promise<BackupResult> {
        if (this.isRunning) {
            return { success: false, error: 'بکاپ دیگری در حال اجراست' };
        }
        this.isRunning = true;

        try {
            console.log(`📦 شروع بکاپ فول ${type} (${reason || 'سیستم'})...`);

            // ۱. استخراج داده‌های اصلی
            const backupData = this.extractBackupData(state);

            // ۲. استخراج فایل‌های باینری شرکت (لوگو، امضا، مهر)، تصاویر چک‌ها و امضاها
            const assets = this.extractCompanyAssets(state);

            // ۳. ساخت پکیج بکاپ کامل
            const now = new Date();
            const backupId = `backup_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

            const payload = {
                id: backupId,
                timestamp: Date.now(),
                label: this.generateLabel(type, now, reason),
                type,
                version: APP_VERSION,
                data: backupData,
                assets,
                checksum: this.checksum(backupData),
                hasAssets: (assets.companies && assets.companies.some(c => c.logo || c.stamp || c.signature)) || 
                           (assets.checkImages && assets.checkImages.length > 0) || 
                           (assets.signatures && assets.signatures.length > 0),
            };

            // ۴. ارسال به هاست
            let hostResult: BackupResult;
            if (navigator.onLine) {
                hostResult = await this.uploadToHost(payload);
            } else {
                hostResult = { success: false, error: 'آفلاین' };
            }

            // ۵. ذخیره لوکال به‌عنوان fallback
            await this.saveLocally(payload);

            if (hostResult.success) {
                localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
                console.log(`✅ بکاپ ${backupId} با موفقیت در هاست ذخیره شد`);
                return { success: true, backupId };
            } else {
                console.warn(`⚠️ بکاپ در هاست ناموفق (ذخیره لوکال انجام شد): ${hostResult.error}`);
                return { success: false, backupId, error: hostResult.error, message: 'بکاپ لوکال انجام شد' };
            }
        } catch (error: any) {
            console.error('خطا در ایجاد بکاپ:', error);
            return { success: false, error: error?.message || 'خطای ناشناخته' };
        } finally {
            this.isRunning = false;
        }
    }

    // ─── لیست بکاپ‌ها ────────────────────────────────────────────────────────

    /**
     * دریافت لیست بکاپ‌های هاست
     */
    async listHostBackups(): Promise<HostBackupEntry[]> {
        if (!navigator.onLine) return [];
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${this.backupUrl}?action=list`, {
                headers: { 'Authorization': this.token },
                signal: controller.signal,
            });
            clearTimeout(tid);
            if (!response.ok) return [];
            const result = await response.json();
            return Array.isArray(result.backups) ? result.backups : [];
        } catch {
            return [];
        }
    }

    /**
     * دریافت لیست بکاپ‌های لوکال از IndexedDB
     */
    async listLocalBackups(): Promise<HostBackupEntry[]> {
        try {
            const stored = await idbService.get(LOCAL_BACKUP_STORE, 'index');
            return Array.isArray(stored?.entries) ? stored.entries : [];
        } catch {
            return [];
        }
    }

    // ─── بازیابی ────────────────────────────────────────────────────────────

    /**
     * بازیابی بکاپ از هاست
     */
    async restoreFromHost(backupId: string): Promise<RestoreResult> {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            const response = await fetch(`${this.backupUrl}?action=restore&id=${backupId}`, {
                headers: { 'Authorization': this.token },
                signal: controller.signal,
            });
            clearTimeout(tid);
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            const result = await response.json();
            if (!result.success) return { success: false, error: result.message };
            return { success: true, data: result.data };
        } catch (error: any) {
            return { success: false, error: error?.message };
        }
    }

    /**
     * بازیابی بکاپ از IndexedDB لوکال
     */
    async restoreFromLocal(backupId: string): Promise<RestoreResult> {
        try {
            const item = await idbService.get(LOCAL_BACKUP_STORE, backupId);
            if (!item) return { success: false, error: 'بکاپ یافت نشد' };
            return { success: true, data: item };
        } catch (error: any) {
            return { success: false, error: error?.message };
        }
    }

    // ─── حذف ───────────────────────────────────────────────────────────────

    async deleteHostBackup(backupId: string): Promise<boolean> {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(this.backupUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': this.token },
                body: JSON.stringify({ action: 'delete', id: backupId }),
                signal: controller.signal,
            });
            clearTimeout(tid);
            return response.ok;
        } catch {
            return false;
        }
    }

    // ─── وضعیت ─────────────────────────────────────────────────────────────

    getStatus(): { lastBackupTime: number | null; hoursSince: number; nextBackupIn: number } {
        const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || '0') || null;
        const hoursSince = last ? (Date.now() - last) / (1000 * 60 * 60) : Infinity;
        const nextIn = last ? Math.max(0, 24 - hoursSince) : 0;
        return { lastBackupTime: last, hoursSince, nextBackupIn: nextIn };
    }

    // ─── خصوصی ───────────────────────────────────────────────────────────────

    private extractBackupData(state: any): Record<string, any> {
        const data: Record<string, any> = {};
        for (const table of BACKUP_TABLES) {
            const val = state[table];
            if (val !== undefined) data[table] = val;
        }

        // دفتر مالی در یک Zustand store جداگانه نگهداری می‌شود؛ بک‌آپ ابری هم باید آن را داشته باشد.
        data.financialData = useFinancialStore.getState();
        return data;
    }

    /**
     * استخراج فایل‌های باینری شرکت (لوگو، امضا، مهر)، تصاویر چک‌ها و تمامی امضاها
     * این فیلدها شامل base64 تصاویر چک‌ها، امضاهای فاکتورها، اسناد و رسیدها می‌باشند
     */
    private extractCompanyAssets(state: any): BackupAssets {
        const companies = Array.isArray(state.companies) ? state.companies : [];
        const checks = Array.isArray(state.checks) ? state.checks : [];
        const invoices = Array.isArray(state.invoices) ? state.invoices : [];
        const vouchers = Array.isArray(state.vouchers) ? state.vouchers : [];
        const transactions = Array.isArray(state.transactions) ? state.transactions : [];

        // استخراج تصاویر چک‌ها
        const checkImages = checks
            .filter((c: any) => Boolean(c.imageUrl))
            .map((c: any) => ({
                id: c.id,
                checkNumber: c.checkNumber || '',
                sayadId: c.sayadId || '',
                imageUrl: c.imageUrl,
                holderName: c.holderName || ''
            }));

        // استخراج امضاهای ثبت شده
        const signatures: Array<{ id: string; type: string; signature: string }> = [];
        
        invoices.forEach((inv: any) => {
            if (inv.signature) {
                signatures.push({ id: inv.id, type: 'invoice_main', signature: inv.signature });
            }
            if (inv.workflowSignatures) {
                Object.entries(inv.workflowSignatures).forEach(([role, sig]) => {
                    if (sig) signatures.push({ id: `${inv.id}_${role}`, type: `invoice_${role}`, signature: sig as string });
                });
            }
        });

        vouchers.forEach((v: any) => {
            if (v.signature) signatures.push({ id: `${v.id}_main`, type: 'voucher_main', signature: v.signature });
            if (v.companySignature) signatures.push({ id: `${v.id}_company`, type: 'voucher_company', signature: v.companySignature });
            if (v.supervisorSignature) signatures.push({ id: `${v.id}_supervisor`, type: 'voucher_supervisor', signature: v.supervisorSignature });
        });

        transactions.forEach((t: any) => {
            if (t.signature) signatures.push({ id: `${t.id}_sig`, type: 'transaction_sig', signature: t.signature });
            if (t.receiptImage) signatures.push({ id: `${t.id}_receipt`, type: 'transaction_receipt', signature: t.receiptImage });
        });

        return {
            companies: companies.map((c: any) => ({
                id: c.id,
                name: c.name,
                ...(c.logo      ? { logo: c.logo }           : {}),
                ...(c.stamp     ? { stamp: c.stamp }         : {}),
                ...(c.signature ? { signature: c.signature } : {}),
            })),
            checkImages,
            signatures
        };
    }

    private async uploadToHost(payload: any): Promise<BackupResult> {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(this.backupUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token,
                },
                body: JSON.stringify({ action: 'create', ...payload }),
                signal: controller.signal,
            });
            clearTimeout(tid);
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            const result = await response.json();
            return result.success
                ? { success: true, backupId: result.id || payload.id }
                : { success: false, error: result.message || 'خطای سرور' };
        } catch (error: any) {
            clearTimeout(tid);
            return { success: false, error: error?.message || 'خطای شبکه' };
        }
    }

    private async saveLocally(payload: any): Promise<void> {
        try {
            // ذخیره کل بکاپ با ID
            await idbService.save(LOCAL_BACKUP_STORE, { id: payload.id, ...payload });

            // به‌روزرسانی ایندکس
            const indexEntry: HostBackupEntry = {
                id: payload.id,
                timestamp: payload.timestamp,
                label: payload.label,
                size: JSON.stringify(payload).length,
                type: payload.type,
                checksum: payload.checksum,
                version: payload.version,
                hasAssets: payload.hasAssets,
            };

            const existing = await idbService.get(LOCAL_BACKUP_STORE, 'index');
            const entries: HostBackupEntry[] = Array.isArray(existing?.entries) ? existing.entries : [];
            entries.push(indexEntry);

            // نگهداری آخرین MAX_HOST_BACKUPS بکاپ (۱۰ فایل)
            entries.sort((a, b) => b.timestamp - a.timestamp);
            if (entries.length > MAX_HOST_BACKUPS) {
                const toRemove = entries.splice(MAX_HOST_BACKUPS);
                for (const old of toRemove) {
                    await idbService.delete(LOCAL_BACKUP_STORE, old.id).catch(() => {});
                }
            }

            await idbService.save(LOCAL_BACKUP_STORE, { id: 'index', entries });
        } catch (error) {
            console.warn('خطا در ذخیره لوکال بکاپ:', error);
        }
    }

    private generateLabel(type: 'auto' | 'manual', date: Date, reason?: string): string {
        const jalali = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
        const reasonTag = reason ? ` (${reason})` : '';
        return `${type === 'auto' ? '🔄 خودکار' : '✋ دستی'}${reasonTag} - ${jalali}`;
    }

    private checksum(data: any): string {
        const str = JSON.stringify(data);
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h >>> 0).toString(16);
    }
}

export const hostBackupService = new HostBackupService();
