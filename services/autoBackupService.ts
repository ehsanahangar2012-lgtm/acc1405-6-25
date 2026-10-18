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

const LOCAL_IDB_KEY = 'auto_backups';
const MAX_LOCAL_BACKUPS = 10;

interface LocalBackup {
    id: string;
    timestamp: number;
    data: string;       // JSON.stringify(state)
    size: number;
    label: string;
}

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
        try {
            const id = Date.now().toString();
            const data = JSON.stringify({ ...state, financialData: useFinancialStore.getState() });
            const backup: LocalBackup = {
                id,
                timestamp: Date.now(),
                data,
                size: data.length,
                label: `بکاپ لوکال - ${new Intl.DateTimeFormat('fa-IR').format(new Date())}`,
            };

            const stored = await this.getLocalBackups();
            stored.push(backup);

            // نگهداری MAX_LOCAL_BACKUPS بکاپ آخر
            stored.sort((a, b) => b.timestamp - a.timestamp);
            if (stored.length > MAX_LOCAL_BACKUPS) {
                stored.splice(MAX_LOCAL_BACKUPS);
            }

            await idbService.save(LOCAL_IDB_KEY, { id: LOCAL_IDB_KEY, backups: stored });
        } catch (error) {
            console.warn('خطا در بکاپ لوکال:', error);
        }
    }

    /**
     * دریافت لیست بکاپ‌های لوکال
     */
    async getBackups(): Promise<LocalBackup[]> {
        return this.getLocalBackups();
    }

    private async getLocalBackups(): Promise<LocalBackup[]> {
        try {
            const result = await idbService.get('backups', LOCAL_IDB_KEY);
            return Array.isArray(result?.backups) ? result.backups : [];
        } catch {
            return [];
        }
    }

    /**
     * بازیابی بکاپ لوکال
     */
    async restoreBackup(backupId: string): Promise<any> {
        const backups = await this.getLocalBackups();
        const backup = backups.find(b => b.id === backupId);
        if (!backup) throw new Error('بکاپ یافت نشد');
        return JSON.parse(backup.data);
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
        const filtered = backups.filter(b => b.id !== backupId);
        await idbService.save(LOCAL_IDB_KEY, { id: LOCAL_IDB_KEY, backups: filtered });
    }

    async clearAllBackups(): Promise<void> {
        await idbService.delete('backups', LOCAL_IDB_KEY);
    }
}

export const autoBackupService = new AutoBackupService();
