/**
 * سرویس بکاپ خودکار - AutoBackupService
 *
 * این سرویس وظیفه هماهنگی بکاپ‌ها را دارد:
 * - delegating به hostBackupService برای بکاپ هاست (اولویت اول)
 * - نگهداری بکاپ لوکال در IndexedDB (fallback)
 * - رابط عمومی یکسان برای بقیه اجزای سیستم
 */

import { hostBackupService, BackupResult, HostBackupEntry } from './hostBackupService';
import { idbService } from './indexedDBService';
import { useFinancialStore } from '../store-financial';
import { checksumLocalBackupData, verifyLocalBackupRecord, LocalBackupIntegrityRecord } from './localBackupIntegrity';
import { hasNativeBackupStorage, getNativeBackupValue, setNativeBackupValue, removeNativeBackupValue } from './nativeBackupStorage';

const LOCAL_IDB_KEY = 'auto_backups';
const MAX_LOCAL_BACKUPS = 10;
const NATIVE_BACKUP_INDEX_KEY = 'auto-backups:index';
const nativeBackupRecordKey = (id: string) => `auto-backups:record:${id}`;

interface LocalBackup extends LocalBackupIntegrityRecord {}

class AutoBackupService {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private getStateFn: (() => any) | null = null;

    /**
     * شروع بکاپ خودکار - به hostBackupService واگذار می‌کند
     */
    start(getState: () => any): void {
        this.getStateFn = getState;
        this.stop();

        // hostBackupService بکاپ روزانه را مدیریت می‌کند
        hostBackupService.start(getState);

        // بکاپ لوکال هر ۶ ساعت (برای offline scenarios)
        this.intervalId = setInterval(() => {
            this.createLocalBackup(getState());
        }, 6 * 60 * 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        hostBackupService.stop();
    }

    /**
     * اجرای خودکار فول بک‌آپ پس از ثبت هر فاکتور، سند، دریافت و پرداخت، چک و...
     */
    triggerFullAutoBackup(state: any, reason: string = 'ثبت اطلاعات مالی'): void {
        try {
            hostBackupService.triggerAutoBackup(state, reason);
        } catch (e) {
            console.warn('triggerFullAutoBackup error:', e);
        }
    }

    /**
     * ایجاد بکاپ دستی - ارسال به هاست + ذخیره لوکال
     */
    async createBackup(getState: () => any): Promise<BackupResult> {
        const state = getState();
        // هم لوکال هم هاست
        await this.createLocalBackup(state);
        return hostBackupService.createBackup(state, 'manual');
    }

    /**
     * بکاپ لوکال در IndexedDB (برای حالت آفلاین)
     */
    async createLocalBackup(state: any): Promise<void> {
        const timestamp = Date.now();
        const id = timestamp.toString();
        const data = JSON.stringify({ ...state, financialData: useFinancialStore.getState() });
        const nativeEncrypted = hasNativeBackupStorage();
        const backup: LocalBackup = {
            id,
            timestamp,
            data,
            size: new Blob([data]).size,
            label: `${nativeEncrypted ? 'بکاپ محلی رمزگذاری‌شدهٔ بومی' : 'بکاپ محلی مرورگر؛ بدون رمزگذاری در حالت سکون'} - ${new Intl.DateTimeFormat('fa-IR').format(new Date(timestamp))}`,
            checksumAlgorithm: 'sha256',
            checksum: checksumLocalBackupData(data)
        };

        try {
            const stored = await this.getLocalBackups();
            stored.push(backup);
            stored.sort((a, b) => b.timestamp - a.timestamp);
            const retained = stored.slice(0, MAX_LOCAL_BACKUPS);
            const retainedIds = new Set(retained.map(item => item.id));

            if (hasNativeBackupStorage()) {
                // Store each full backup under OS-encrypted storage; only IDs live in the index.
                await setNativeBackupValue(nativeBackupRecordKey(id), JSON.stringify(backup));
                await setNativeBackupValue(NATIVE_BACKUP_INDEX_KEY, JSON.stringify(retained.map(item => item.id)));
                for (const old of stored) {
                    if (!retainedIds.has(old.id)) {
                        await removeNativeBackupValue(nativeBackupRecordKey(old.id)).catch(() => {});
                    }
                }
                await this.removeLegacyLocalBackupCopies();
            } else {
                // Browser/PWA IndexedDB fallback: this is browser-local storage, not
                // hardware-backed encrypted storage, and is labelled that way in the UI.
                await idbService.save('backups', { id: LOCAL_IDB_KEY, backups: retained });
            }
        } catch (error) {
            // Native encryption/storage failures are not silently downgraded to plaintext IDB.
            console.warn('خطا در بکاپ محلی:', error);
            throw error;
        }
    }

    /**
     * دریافت لیست بکاپ‌های لوکال
     */
    async getBackups(): Promise<LocalBackup[]> {
        return this.getLocalBackups();
    }

    private async readLegacyLocalBackups(): Promise<LocalBackup[]> {
        for (const storeName of ['backups', LOCAL_IDB_KEY]) {
            try {
                const result = await idbService.get(storeName, LOCAL_IDB_KEY);
                if (Array.isArray(result?.backups)) return result.backups;
            } catch {}
        }
        return [];
    }

    private async getLocalBackups(): Promise<LocalBackup[]> {
        if (hasNativeBackupStorage()) {
            const indexText = await getNativeBackupValue(NATIVE_BACKUP_INDEX_KEY);
            if (indexText !== null) {
                let ids: unknown;
                try { ids = JSON.parse(indexText); } catch {
                    throw new Error('فهرست بکاپ رمزگذاری‌شده معتبر نیست.');
                }
                if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[0-9]{1,32}$/.test(id))) {
                    throw new Error('شناسه‌های بکاپ محلی معتبر نیستند.');
                }
                const items: LocalBackup[] = [];
                for (const id of ids) {
                    const raw = await getNativeBackupValue(nativeBackupRecordKey(id));
                    if (raw === null) continue;
                    const item = JSON.parse(raw);
                    if (item?.id === id && typeof item.data === 'string' && Number.isFinite(item.timestamp)) items.push(item as LocalBackup);
                }
                return items.sort((a, b) => b.timestamp - a.timestamp);
            }

            // One-time migration: encrypt older IDB snapshots before removing their plaintext copies.
            const legacy = await this.readLegacyLocalBackups();
            if (legacy.length === 0) {
                await setNativeBackupValue(NATIVE_BACKUP_INDEX_KEY, '[]');
                return [];
            }
            const valid = legacy.filter(item => item && /^[0-9]{1,32}$/.test(String(item.id)) && typeof item.data === 'string')
                .sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL_BACKUPS);
            for (const item of valid) {
                await setNativeBackupValue(nativeBackupRecordKey(item.id), JSON.stringify(item));
            }
            await setNativeBackupValue(NATIVE_BACKUP_INDEX_KEY, JSON.stringify(valid.map(item => item.id)));
            await this.removeLegacyLocalBackupCopies();
            return valid;
        }

        return (await this.readLegacyLocalBackups()).map(item => {
            const originalLabel = typeof item.label === 'string' ? item.label : 'بکاپ محلی قدیمی';
            return {
                ...item,
                label: item.checksumAlgorithm === 'sha256' && typeof item.checksum === 'string'
                    ? originalLabel
                    : originalLabel.replace('بکاپ محلی رمزگذاری‌شده', 'بکاپ قدیمی مرورگر؛ رمزگذاری در حالت سکون تأیید نشده')
            };
        });
    }

    private async removeLegacyLocalBackupCopies(): Promise<void> {
        for (const storeName of ['backups', LOCAL_IDB_KEY]) {
            try { await idbService.delete(storeName, LOCAL_IDB_KEY); } catch {}
        }
    }

    /**
     * بازیابی بکاپ لوکال
     */
    async verifyBackupIntegrity(backupId: string): Promise<boolean> {
        const backup = (await this.getLocalBackups()).find(item => item.id === backupId);
        if (!backup) throw new Error('بکاپ محلی پیدا نشد.');
        return verifyLocalBackupRecord(backup).integrityVerified;
    }

    async restoreBackup(backupId: string): Promise<any> {
        const backup = (await this.getLocalBackups()).find(item => item.id === backupId);
        if (!backup) throw new Error('بکاپ محلی پیدا نشد.');
        // This repeats integrity checks in the restore service so callers cannot bypass
        // the UI warning, and no caller mutates the live store on failure.
        return verifyLocalBackupRecord(backup).data;
    }

    /**
     * دریافت لیست بکاپ‌های هاست
     */
    async listHostBackups(): Promise<HostBackupEntry[]> {
        return hostBackupService.listHostBackups();
    }

    /**
     * بازیابی از هاست
     */
    async restoreFromHost(backupId: string) {
        return hostBackupService.restoreFromHost(backupId);
    }

    /**
     * وضعیت بکاپ
     */
    getStatus() {
        return hostBackupService.getStatus();
    }

    async deleteBackup(backupId: string): Promise<void> {
        const backups = await this.getLocalBackups();
        const filtered = backups.filter(item => item.id !== backupId);
        if (hasNativeBackupStorage()) {
            await removeNativeBackupValue(nativeBackupRecordKey(backupId)).catch(() => {});
            await setNativeBackupValue(NATIVE_BACKUP_INDEX_KEY, JSON.stringify(filtered.map(item => item.id)));
            return;
        }
        await idbService.save('backups', { id: LOCAL_IDB_KEY, backups: filtered });
    }

    async clearAllBackups(): Promise<void> {
        if (hasNativeBackupStorage()) {
            const items = await this.getLocalBackups();
            for (const item of items) await removeNativeBackupValue(nativeBackupRecordKey(item.id)).catch(() => {});
            await setNativeBackupValue(NATIVE_BACKUP_INDEX_KEY, '[]');
            await this.removeLegacyLocalBackupCopies();
            return;
        }
        await idbService.delete('backups', LOCAL_IDB_KEY);
        await idbService.delete(LOCAL_IDB_KEY, LOCAL_IDB_KEY).catch(() => {});
    }
}

export const autoBackupService = new AutoBackupService();
