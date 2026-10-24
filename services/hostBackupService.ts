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

import { APP_VERSION, IS_BROWSER_PREVIEW } from '../config';
import { isDesktopApp } from '../utils';
import { workspaceService } from './workspaceService';
import { idbService } from './indexedDBService';
import { useFinancialStore } from '../store-financial';
import CryptoJS from 'crypto-js';
import { hasNativeBackupStorage, getNativeBackupValue, setNativeBackupValue, removeNativeBackupValue } from './nativeBackupStorage';

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
    encryptedAtRest?: boolean;
    encryption?: string;
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
    remoteSaved?: boolean;
    remoteStatus?: 'SYNCED' | 'WAITING' | 'ERROR';
    localFileStatus?: 'SYNCED' | 'WAITING' | 'ERROR';
    localFilePath?: string;
    localFileError?: string;
    localFileSha256?: string;
    localFileSizeBytes?: number;
}

export interface RestoreResult {
    success: boolean;
    data?: any;
    error?: string;
    integrityVerified?: boolean;
}

// ─── ثابت‌ها ─────────────────────────────────────────────────────────────────

const LOCAL_BACKUP_STORE  = 'local_backups';
const LAST_BACKUP_KEY     = 'host_last_backup_time';
const BACKUP_INTERVAL_MS  = 24 * 60 * 60 * 1000; // ۲۴ ساعت
const MAX_HOST_BACKUPS    = 10; // نگهداری حداکثر ۱۰ فایل در هاست
const FETCH_TIMEOUT_MS    = 30_000; // ۳۰ ثانیه - بکاپ داده بزرگ است
const NATIVE_HOST_BACKUP_INDEX_KEY = 'host-backups:index';
const nativeHostBackupRecordKey = (id: string) => `host-backups:record:${id}`;
// Read the release version from the shared application configuration.

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
    private timerHandle: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;
    private remoteEncryptionCapability: { checkedAt: number; supported: boolean } | null = null;

    private get backupUrl(): string {
        const base = workspaceService.getBaseUrl();
        return base ? `${base.replace(/\/+$/, '')}/server-api-backup.php` : '';
    }

    /**
     * Only enable server uploads after the authenticated endpoint confirms that it
     * encrypts backup files at rest. Old host deployments fail closed and never
     * receive a new plaintext backup from this client.
     */
    async supportsEncryptedServerBackups(forceRefresh = false): Promise<boolean> {
        if (IS_BROWSER_PREVIEW || !navigator.onLine || !workspaceService.isRemoteCloudConfigured()) return false;
        if (!forceRefresh && this.remoteEncryptionCapability && Date.now() - this.remoteEncryptionCapability.checkedAt < 60_000) {
            return this.remoteEncryptionCapability.supported;
        }
        let supported = false;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(`${this.backupUrl}?action=capabilities`, {
                headers: await workspaceService.getSecureHeaders(),
                signal: controller.signal,
                cache: 'no-store'
            });
            if (response.ok) {
                const result = await response.json();
                supported = result?.success === true &&
                    result?.encryptedAtRest === true &&
                    result?.backupEncryption === 'AES-256-GCM';
            }
        } catch {
            supported = false;
        } finally {
            clearTimeout(tid);
        }
        this.remoteEncryptionCapability = { checkedAt: Date.now(), supported };
        return supported;
    }

    // ─── عمومی ───────────────────────────────────────────────────────────────

    /**
     * شروع بکاپ خودکار روزانه
     * @param getState تابعی که state کامل zustand را برمی‌گرداند
     */
    start(getState: () => any): void {
        this.stop();
        if (IS_BROWSER_PREVIEW) return;

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
        if (IS_BROWSER_PREVIEW) return;
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
            return {
                success: false,
                remoteSaved: false,
                remoteStatus: 'WAITING',
                localFileStatus: 'WAITING',
                error: 'بکاپ دیگری در حال اجراست'
            };
        }
        this.isRunning = true;

        let localFileStatus: BackupResult['localFileStatus'] = 'WAITING';
        let localFilePath: string | undefined;
        let localFileError: string | undefined;
        let localFileSha256: string | undefined;
        let localFileSizeBytes: number | undefined;
        let remoteStatus: BackupResult['remoteStatus'] = 'WAITING';
        let backupId: string | undefined;

        try {
            const backupData = this.extractBackupData(state);
            const assets = this.extractCompanyAssets(state);
            const now = new Date();
            backupId = 'backup_' +
                now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0') +
                String(now.getSeconds()).padStart(2, '0');

            const payload = {
                id: backupId,
                timestamp: Date.now(),
                label: this.generateLabel(type, now, reason),
                type,
                version: APP_VERSION,
                data: backupData,
                assets,
                checksumAlgorithm: 'sha256',
                checksum: this.checksum({ data: backupData, assets }),
                hasAssets: (assets.companies && assets.companies.some(c => c.logo || c.stamp || c.signature)) ||
                    (assets.checkImages && assets.checkImages.length > 0) ||
                    (assets.signatures && assets.signatures.length > 0),
            };

            // Save an independent file copy only inside the folder chosen in the native dialog.
            if (!IS_BROWSER_PREVIEW && isDesktopApp()) {
                const desktopAPI = typeof window !== 'undefined' ? (window as any).electronDesktopAPI : null;
                if (desktopAPI && typeof desktopAPI.writeLocalBackup === 'function') {
                    const fileName = 'AshkeGhalam-Backup-' + type + '-' + backupId + '-' +
                        Date.now().toString(36) + '.json';
                    const fileResult = await desktopAPI.writeLocalBackup(fileName, JSON.stringify(payload, null, 2));
                    if (fileResult?.success) {
                        localFileStatus = 'SYNCED';
                        localFilePath = typeof fileResult.filePath === 'string' ? fileResult.filePath : undefined;
                        localFileSha256 = typeof fileResult.sha256 === 'string' ? fileResult.sha256 : undefined;
                        localFileSizeBytes = Number.isFinite(fileResult.sizeBytes) ? fileResult.sizeBytes : undefined;
                    } else {
                        localFileError = String(fileResult?.error || 'BACKUP_WRITE_FAILED');
                        localFileStatus = localFileError === 'BACKUP_DIRECTORY_NOT_SELECTED' ? 'WAITING' : 'ERROR';
                    }
                }
            }

            // Browser previews remain local-only and are never treated as a server backup.
            if (IS_BROWSER_PREVIEW) {
                await this.saveLocally(payload);
                return {
                    success: true,
                    backupId,
                    remoteSaved: false,
                    remoteStatus: 'WAITING',
                    localFileStatus: 'WAITING',
                    message: 'نسخه آزمایشی: پشتیبان فقط در حافظه محلی برنامه ذخیره شد.'
                };
            }

            let hostResult: BackupResult;
            if (navigator.onLine && workspaceService.isRemoteCloudConfigured()) {
                hostResult = await this.uploadToHost(payload);
                remoteStatus = hostResult.success
                    ? 'SYNCED'
                    : hostResult.error === 'REMOTE_BACKUP_ENCRYPTION_NOT_CONFIGURED' ? 'WAITING' : 'ERROR';
            } else {
                hostResult = {
                    success: false,
                    error: navigator.onLine ? 'اتصال امن به سرور تنظیم نشده است' : 'دستگاه آفلاین است'
                };
                remoteStatus = 'WAITING';
            }

            // IndexedDB remains a fast fallback, but is not an independent filesystem copy.
            await this.saveLocally(payload);

            if (hostResult.success) {
                localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
                console.log('Backup ' + backupId + ' successfully stored on host.');
                return {
                    success: true,
                    backupId,
                    remoteSaved: true,
                    remoteStatus: 'SYNCED',
                    localFileStatus,
                    localFilePath,
                    localFileError,
                    localFileSha256,
                    localFileSizeBytes
                };
            }

            console.warn('Host backup failed; local fallback was stored: ' + (hostResult.error || 'unknown'));
            return {
                success: false,
                backupId,
                remoteSaved: false,
                remoteStatus,
                localFileStatus,
                localFilePath,
                localFileError,
                localFileSha256,
                localFileSizeBytes,
                error: hostResult.error,
                message: 'نسخه محلی تهیه شد؛ ذخیره روی سرور تأیید نشد.'
            };
        } catch (error: any) {
            console.error('خطا در ایجاد بکاپ:', error);
            return {
                success: false,
                backupId,
                remoteSaved: false,
                remoteStatus: remoteStatus === 'SYNCED' ? 'SYNCED' : 'ERROR',
                localFileStatus,
                localFilePath,
                localFileError,
                localFileSha256,
                localFileSizeBytes,
                error: error?.message || 'خطای ناشناخته'
            };
        } finally {
            this.isRunning = false;
        }
    }

    // ─── لیست بکاپ‌ها ────────────────────────────────────────────────────────

    /**
     * دریافت لیست بکاپ‌های هاست
     */
    async listHostBackups(): Promise<HostBackupEntry[]> {
        if (IS_BROWSER_PREVIEW || !navigator.onLine || !workspaceService.isRemoteCloudConfigured()) return [];
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${this.backupUrl}?action=list`, {
                headers: await workspaceService.getSecureHeaders(),
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
     * Detailed result for cloud UI: empty is distinct from offline/unconfigured/server error.
     */
    async listHostBackupsDetailed(): Promise<{ success: boolean; backups: HostBackupEntry[]; error?: string }> {
        if (IS_BROWSER_PREVIEW) return { success: false, backups: [], error: 'فهرست سرور در پیش‌نمایش مرورگر فعال نیست.' };
        if (!navigator.onLine) return { success: false, backups: [], error: 'دستگاه آفلاین است.' };
        if (!workspaceService.isRemoteCloudConfigured()) return { success: false, backups: [], error: 'اتصال امن فضای کاری تنظیم نشده است.' };

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(`${this.backupUrl}?action=list`, {
                headers: await workspaceService.getSecureHeaders(),
                signal: controller.signal,
                cache: 'no-store'
            });
            if (!response.ok) return { success: false, backups: [], error: `خطای سرور (${response.status})` };
            const result = await response.json();
            if (result?.success !== true || !Array.isArray(result.backups)) {
                return { success: false, backups: [], error: result?.error || 'پاسخ فهرست پشتیبان‌ها معتبر نیست.' };
            }
            return { success: true, backups: result.backups };
        } catch (error: any) {
            return {
                success: false,
                backups: [],
                error: error?.name === 'AbortError' ? 'مهلت ارتباط با سرور تمام شد.' : (error?.message || 'ارتباط با سرور ناموفق بود.')
            };
        } finally {
            clearTimeout(tid);
        }
    }

    /**
     * دریافت لیست بکاپ‌های لوکال از IndexedDB
     */
    async listLocalBackups(): Promise<HostBackupEntry[]> {
        if (hasNativeBackupStorage()) {
            const entries = await this.readNativeHostBackupIndex(true);
            return entries;
        }
        try {
            const stored = await idbService.get(LOCAL_BACKUP_STORE, 'index');
            return Array.isArray(stored?.entries) ? stored.entries : [];
        } catch {
            return [];
        }
    }

    private async readNativeHostBackupIndex(migrateLegacy: boolean): Promise<HostBackupEntry[]> {
        const storedText = await getNativeBackupValue(NATIVE_HOST_BACKUP_INDEX_KEY);
        if (storedText !== null) {
            let entries: unknown;
            try { entries = JSON.parse(storedText); } catch {
                throw new Error('فهرست بکاپ محلی رمزگذاری‌شده معتبر نیست.');
            }
            if (!Array.isArray(entries) || entries.some(entry =>
                !entry || typeof entry.id !== 'string' || !/^backup_[A-Za-z0-9_-]{1,160}$/.test(entry.id)
            )) {
                throw new Error('ساختار فهرست بکاپ محلی معتبر نیست.');
            }
            return entries as HostBackupEntry[];
        }

        if (!migrateLegacy) {
            await setNativeBackupValue(NATIVE_HOST_BACKUP_INDEX_KEY, '[]');
            return [];
        }

        // One-time migration from old IndexedDB snapshots. Keep legacy data until each
        // snapshot and the new encrypted index have been written successfully.
        let legacyEntries: HostBackupEntry[] = [];
        try {
            const index = await idbService.get(LOCAL_BACKUP_STORE, 'index');
            if (Array.isArray(index?.entries)) legacyEntries = index.entries;
        } catch {}
        const migrated: HostBackupEntry[] = [];
        for (const entry of legacyEntries) {
            if (!entry || typeof entry.id !== 'string' || !/^backup_[A-Za-z0-9_-]{1,160}$/.test(entry.id)) continue;
            const record = await idbService.get(LOCAL_BACKUP_STORE, entry.id).catch(() => null);
            if (!record || typeof record !== 'object' || !record.data || typeof record.data !== 'object') continue;
            await setNativeBackupValue(nativeHostBackupRecordKey(entry.id), JSON.stringify(record));
            migrated.push(entry);
        }
        migrated.sort((a, b) => b.timestamp - a.timestamp);
        const retained = migrated.slice(0, MAX_HOST_BACKUPS);
        await setNativeBackupValue(NATIVE_HOST_BACKUP_INDEX_KEY, JSON.stringify(retained));
        for (const old of migrated.slice(MAX_HOST_BACKUPS)) {
            await removeNativeBackupValue(nativeHostBackupRecordKey(old.id)).catch(() => {});
        }
        for (const entry of migrated) {
            await idbService.delete(LOCAL_BACKUP_STORE, entry.id).catch(() => {});
        }
        await idbService.delete(LOCAL_BACKUP_STORE, 'index').catch(() => {});
        return retained;
    }

    // ─── بازیابی ────────────────────────────────────────────────────────────

    /**
     * بازیابی بکاپ از هاست
     */
    async restoreFromHost(backupId: string): Promise<RestoreResult> {
        if (IS_BROWSER_PREVIEW || !workspaceService.isRemoteCloudConfigured()) {
            return { success: false, error: 'اتصال امن بکاپ سرور تنظیم نشده است.' };
        }
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            const response = await fetch(`${this.backupUrl}?action=restore&id=${backupId}`, {
                headers: await workspaceService.getSecureHeaders(),
                signal: controller.signal,
            });
            clearTimeout(tid);
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            const result = await response.json();
            if (!result.success) return { success: false, error: result.message || result.error || 'بازیابی نسخه پشتیبان ناموفق بود' };
            const payload = result.data;
            if (!payload || typeof payload !== 'object') {
                return { success: false, error: 'ساختار نسخه پشتیبان معتبر نیست' };
            }

            // New backups carry a SHA-256 checksum over both accounting data and assets.
            // Legacy backups remain readable, but are not marked as payload-verified.
            let payloadIntegrityVerified = false;
            if (payload.checksumAlgorithm === 'sha256') {
                if (!payload.data || typeof payload.data !== 'object' || typeof payload.checksum !== 'string') {
                    return { success: false, error: 'ساختار کنترل صحت نسخه پشتیبان نامعتبر است' };
                }
                const actualChecksum = this.checksum({ data: payload.data, assets: payload.assets ?? {} });
                if (!/^[a-f0-9]{64}$/i.test(payload.checksum) || actualChecksum !== payload.checksum.toLowerCase()) {
                    return { success: false, error: 'کنترل صحت نسخه پشتیبان ناموفق است؛ بازیابی لغو شد' };
                }
                payloadIntegrityVerified = true;
            }

            return {
                success: true,
                data: payload,
                integrityVerified: Boolean(result.integrity?.verified && payloadIntegrityVerified)
            };
        } catch (error: any) {
            return { success: false, error: error?.message };
        }
    }

    /**
     * بازیابی بکاپ از IndexedDB لوکال
     */
    async restoreFromLocal(backupId: string): Promise<RestoreResult> {
        try {
            if (typeof backupId !== 'string' || !/^backup_[A-Za-z0-9_-]{1,160}$/.test(backupId)) {
                return { success: false, error: 'شناسه نسخه پشتیبان محلی معتبر نیست.' };
            }
            let item: any;
            if (hasNativeBackupStorage()) {
                const raw = await getNativeBackupValue(nativeHostBackupRecordKey(backupId));
                if (raw === null) return { success: false, error: 'بکاپ رمزگذاری‌شده در حافظه محلی پیدا نشد.' };
                item = JSON.parse(raw);
            } else {
                item = await idbService.get(LOCAL_BACKUP_STORE, backupId);
            }
            if (!item || typeof item !== 'object') return { success: false, error: 'بکاپ یافت نشد' };

            let integrityVerified = false;
            if (item.checksumAlgorithm === 'sha256') {
                if (!item.data || typeof item.data !== 'object' || typeof item.checksum !== 'string') {
                    return { success: false, error: 'ساختار کنترل صحت بکاپ محلی معتبر نیست.' };
                }
                const actual = this.checksum({ data: item.data, assets: item.assets ?? {} });
                if (!/^[a-f0-9]{64}$/i.test(item.checksum) || actual !== item.checksum.toLowerCase()) {
                    return { success: false, error: 'کنترل صحت بکاپ محلی ناموفق است؛ بازیابی لغو شد.' };
                }
                integrityVerified = true;
            }
            return { success: true, data: item, integrityVerified };
        } catch (error: any) {
            return { success: false, error: error?.message || 'خواندن بکاپ محلی ناموفق بود.' };
        }
    }

    async deleteLocalBackup(backupId: string): Promise<boolean> {
        if (typeof backupId !== 'string' || !/^backup_[A-Za-z0-9_-]{1,160}$/.test(backupId)) return false;
        try {
            if (hasNativeBackupStorage()) {
                const entries = await this.readNativeHostBackupIndex(false);
                await removeNativeBackupValue(nativeHostBackupRecordKey(backupId));
                await setNativeBackupValue(NATIVE_HOST_BACKUP_INDEX_KEY, JSON.stringify(entries.filter(entry => entry.id !== backupId)));
            } else {
                await idbService.delete(LOCAL_BACKUP_STORE, backupId);
                const stored = await idbService.get(LOCAL_BACKUP_STORE, 'index');
                const entries = Array.isArray(stored?.entries) ? stored.entries.filter((entry: HostBackupEntry) => entry.id !== backupId) : [];
                await idbService.save(LOCAL_BACKUP_STORE, { id: 'index', entries });
            }
            return true;
        } catch {
            return false;
        }
    }

    // ─── حذف ───────────────────────────────────────────────────────────────

    async deleteHostBackup(backupId: string): Promise<boolean> {
        if (IS_BROWSER_PREVIEW || !workspaceService.isRemoteCloudConfigured()) return false;
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(this.backupUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await workspaceService.getSecureHeaders() },
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
        if (!(await this.supportsEncryptedServerBackups())) {
            return {
                success: false,
                remoteSaved: false,
                remoteStatus: 'WAITING',
                error: 'REMOTE_BACKUP_ENCRYPTION_NOT_CONFIGURED'
            };
        }
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(this.backupUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...await workspaceService.getSecureHeaders(),
                },
                body: JSON.stringify({ action: 'create', requireEncryption: true, ...payload }),
                signal: controller.signal,
            });
            clearTimeout(tid);
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            const result = await response.json();
            if (!result.success) return { success: false, error: result.message || result.error || 'خطای سرور' };
            if (result.encryptedAtRest !== true || result.encryption !== 'AES-256-GCM') {
                this.remoteEncryptionCapability = { checkedAt: Date.now(), supported: false };
                return { success: false, error: 'REMOTE_BACKUP_ENCRYPTION_NOT_CONFIRMED' };
            }
            return { success: true, backupId: result.id || payload.id, remoteSaved: true, remoteStatus: 'SYNCED' };
        } catch (error: any) {
            clearTimeout(tid);
            return { success: false, error: error?.message || 'خطای شبکه' };
        }
    }

    private async saveLocally(payload: any): Promise<void> {
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

        try {
            if (hasNativeBackupStorage()) {
                const entries = await this.readNativeHostBackupIndex(true);
                // Full accounting payload remains encrypted at rest on native devices.
                await setNativeBackupValue(nativeHostBackupRecordKey(payload.id), JSON.stringify(payload));
                const next = [indexEntry, ...entries.filter(entry => entry.id !== payload.id)]
                    .sort((a, b) => b.timestamp - a.timestamp);
                const retained = next.slice(0, MAX_HOST_BACKUPS);
                await setNativeBackupValue(NATIVE_HOST_BACKUP_INDEX_KEY, JSON.stringify(retained));
                for (const old of next.slice(MAX_HOST_BACKUPS)) {
                    await removeNativeBackupValue(nativeHostBackupRecordKey(old.id)).catch(() => {});
                }
                // Remove the old IDB shadow only after encrypted records and index are committed.
                for (const entry of next) {
                    if (retained.some(kept => kept.id === entry.id)) continue;
                    await idbService.delete(LOCAL_BACKUP_STORE, entry.id).catch(() => {});
                }
                return;
            }

            // Browser/PWA fallback. IndexedDB is explicitly not represented as OS-encrypted storage.
            await idbService.save(LOCAL_BACKUP_STORE, { id: payload.id, ...payload });
            const existing = await idbService.get(LOCAL_BACKUP_STORE, 'index');
            const entries: HostBackupEntry[] = Array.isArray(existing?.entries) ? existing.entries : [];
            const next = [indexEntry, ...entries.filter(entry => entry.id !== payload.id)]
                .sort((a, b) => b.timestamp - a.timestamp);
            const retained = next.slice(0, MAX_HOST_BACKUPS);
            for (const old of next.slice(MAX_HOST_BACKUPS)) {
                await idbService.delete(LOCAL_BACKUP_STORE, old.id).catch(() => {});
            }
            await idbService.save(LOCAL_BACKUP_STORE, { id: 'index', entries: retained });
        } catch (error) {
            console.warn('خطا در ذخیره بکاپ محلی:', error);
            // Never downgrade failed native encryption to plaintext IndexedDB/localStorage.
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
        return CryptoJS.SHA256(JSON.stringify(data)).toString();
    }
}

export const hostBackupService = new HostBackupService();
