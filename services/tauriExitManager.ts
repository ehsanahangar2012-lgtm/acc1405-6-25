/**
 * مدیریت خروج برنامه و بهینه‌سازی ویژه اجرا در Tauri (تاوری) و ویندوز
 *
 * ویژگی‌ها:
 * - تشخیص هوشمند محیط Tauri / Electron / Web
 * - بکاپ‌گیری لحظه‌ای و هنگام خروج (Exit Backup)
 * - تخلیه و ارسال فوری صف سینک هنگام بستن پنجره (Flush Queue on Unload)
 * - ذخیره خودکار فایل پشتیبان دسکتاپ بر روی فایل‌سیستم ویندوز
 * - هماهنگی با رویدادهای beforeunload, pagehide, visibilitychange
 */

import { autoBackupService } from './autoBackupService';
import { syncQueue } from './syncQueueService';
import { idbService } from './indexedDBService';

class TauriExitManager {
    private isInitialized = false;
    private getStateFn: (() => any) | null = null;

    /**
     * آیا برنامه در محیط تاوری (Tauri) اجرا می‌شود؟
     */
    public isTauri(): boolean {
        return typeof window !== 'undefined' && (
            '__TAURI__' in window ||
            '__TAURI_INTERNALS__' in window ||
            Boolean((window as any).__TAURI_IPC__)
        );
    }

    /**
     * آیا در سیستم‌عامل ویندوز یا دسکتاپ قرار داریم؟
     */
    public isDesktop(): boolean {
        if (this.isTauri()) return true;
        if (typeof navigator !== 'undefined') {
            return /Win/i.test(navigator.userAgent || '');
        }
        return false;
    }

    /**
     * مقداردهی اولیه رویدادهای خروج و بکاپ لحظه‌ای
     */
    public init(getState: () => any): void {
        if (this.isInitialized || typeof window === 'undefined') return;
        this.getStateFn = getState;
        this.isInitialized = true;

        console.log(`🖥️ مدیر خروج دسکتاپ فعال شد (حالت Tauri: ${this.isTauri() ? 'بله' : 'خیر'})`);

        // ۱. رویداد beforeunload برای مروگر و دسکتاپ
        window.addEventListener('beforeunload', (e) => {
            this.handleApplicationExit('beforeunload');
        });

        // ۲. رویداد pagehide برای مروگرهای جدید و PWA
        window.addEventListener('pagehide', () => {
            this.handleApplicationExit('pagehide');
        });

        // ۳. تغییر دید پنجره (Visibility change) - بکاپ لحظه‌ای هنگام کمینه کردن
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.performQuickExitSave('visibility_hidden');
            }
        });

        // ۴. ثبت شنونده ویژه پنجره Tauri (در صورت وجود API تاوری)
        if (this.isTauri()) {
            this.setupTauriCloseListener();
        }

        // ۵. ثبت شنونده خروج الکترون (Windows EXE)
        const electronAPI = (window as any).electronDesktopAPI;
        if (electronAPI?.onMessage) {
            electronAPI.onMessage('trigger-backup-and-exit', async () => {
                console.log('🚪 درخواست خروج الکترون تشخیص داده شد - شروع بکاپ...');
                await this.performExitRoutine('electron_close');
                electronAPI.sendMessage('backup-completed-exit', null);
            });
        }
    }

    /**
     * راه‌اندازی شنونده بسته شدن پنجره در Tauri
     */
    private async setupTauriCloseListener(): Promise<void> {
        try {
            const tauriWindow = (window as any).__TAURI__?.window;
            if (tauriWindow?.getCurrent) {
                const appWindow = tauriWindow.getCurrent();
                if (appWindow?.onCloseRequested) {
                    await appWindow.onCloseRequested(async (event: any) => {
                        console.log('🚪 بسته شدن پنجره تاوری تشخیص داده شد - شروع بکاپ خروج...');
                        await this.performExitRoutine('tauri_close');
                    });
                }
            }
        } catch (error) {
            console.warn('عدم موفقیت در اتصال به رویداد بستن تاوری:', error);
        }
    }

    /**
     * اجرای روتین خروج امن
     */
    public async handleApplicationExit(source: string): Promise<void> {
        this.performQuickExitSave(source);
    }

    /**
     * ذخیره سریع هنگام خروج
     */
    private performQuickExitSave(source: string): void {
        if (!this.getStateFn) return;

        try {
            const state = this.getStateFn();

            // الف) ذخیره حالت فعلی در LocalStorage و IndexedDB به عنوان بکاپ اضطراری خروج
            const snapshotData = {
                timestamp: Date.now(),
                source,
                isExitBackup: true,
                state: state
            };

            localStorage.setItem('last_exit_snapshot', JSON.stringify({
                timestamp: snapshotData.timestamp,
                itemCount: (state.invoices?.length || 0) + (state.products?.length || 0) + (state.people?.length || 0)
            }));

            // ب) ذخیره مستقیم در IndexedDB
            idbService.save('exit_backups', {
                id: `exit_${Date.now()}`,
                timestamp: Date.now(),
                data: JSON.stringify(state),
                label: `بکاپ خروج (${new Date().toLocaleTimeString('fa-IR')})`
            }).catch(() => {});

            // ج) ارسال داده‌های صف سینک در صورت وجود اتصال شبکه با keepalive
            syncQueue.processQueue().catch(() => {});

            console.log(`✅ بکاپ اضطراری خروج (${source}) با موفقیت ایجاد شد.`);
        } catch (err) {
            console.error('خطا در ذخیره سریع خروج:', err);
        }
    }

    /**
     * روتین کامل خروج (برای تاوری و بستن برنامه‌ریزی‌شده)
     */
    public async performExitRoutine(reason = 'exit'): Promise<void> {
        if (!this.getStateFn) return;

        console.log(`🔄 شروع فرایند آماده‌سازی خروج (${reason})...`);
        const state = this.getStateFn();

        try {
            // ۱. ایجاد بکاپ لوکال
            await autoBackupService.createLocalBackup(state);

            // ۲. فایل پشتیبان دسکتاپ
            if (this.isTauri()) {
                await this.exportDesktopFileBackup(state);
            } else if (typeof window !== 'undefined' && (window as any).electronDesktopAPI) {
                await this.exportElectronFileBackup(state);
            }

            // ۳. پردازش فوری صف سینک
            await syncQueue.processQueue();

            console.log('🏁 فرایند خروج امن با موفقیت انجام شد.');
        } catch (err) {
            console.warn('هشدار در روتین خروج:', err);
        }
    }

    private async exportElectronFileBackup(state: any): Promise<void> {
        const electronAPI = (window as any).electronDesktopAPI;
        if (!electronAPI || !electronAPI.invoke) return;

        try {
            const userPath = localStorage.getItem('desktop_auto_backup_path');
            if (!userPath) {
                console.log('مسیر ذخیره بک‌آپ ویندوز تنظیم نشده است.');
                return;
            }
            
            const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const fileName = `AshkeGhalam_AutoBackup_${dateStr}.json`;
            const filePath = `${userPath}\\${fileName}`; // در ویندوز با بک‌اسلش یا اسلش ترکیب می‌شود
            
            const result = await electronAPI.invoke('save-backup-file', {
                filePath,
                data: JSON.stringify(state, null, 2)
            });
            
            if (result.success) {
                console.log(`💾 فایل پشتیبان دسکتاپ در مسیر نوشته شد: ${filePath}`);
            } else {
                console.error('خطا در ذخیره فایل پشتیبان دسکتاپ:', result.error);
            }
        } catch (e) {
            console.error('خطا حین خروجی فایل الکترون:', e);
        }
    }

    /**
     * خروجی مستقیم فایل پشتیبان بر روی دسکتاپ ویندوز در حالت تاوری
     */
    private async exportDesktopFileBackup(state: any): Promise<void> {
        try {
            const tauriFs = (window as any).__TAURI__?.fs;
            const tauriPath = (window as any).__TAURI__?.path;

            if (tauriFs && tauriPath) {
                const appDir = await tauriPath.appDataDir?.() || './';
                const backupFileName = `backup_exit_${Date.now()}.json`;
                const fullPath = `${appDir}/${backupFileName}`;

                await tauriFs.writeTextFile(fullPath, JSON.stringify(state));
                console.log(`💾 فایل پشتیبان دسکتاپ در مسیر نوشته شد: ${fullPath}`);
            }
        } catch (e) {
            console.warn('ذخیره فایل تاوری موفق نبود (استفاده از IDB fallback):', e);
        }
    }
}

export const tauriExitManager = new TauriExitManager();
