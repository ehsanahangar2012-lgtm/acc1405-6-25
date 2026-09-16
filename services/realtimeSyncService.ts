// سرویس همگام‌سازی بلادرنگ بین دستگاه‌ها - بر پایه مرجعیت هاست و Tombstone
import { useStore } from '../store';
import { hostDB } from './hostDatabaseService';
import { persistentStorage } from './persistentStorage';
import { notificationService } from './notificationService';
import { deletedRecordsRegistry } from './deletedRecordsRegistry';
import { syncQueue } from './syncQueueService';
import { workspaceService } from './workspaceService';

interface SyncState {
    lastPull: number;
    pendingPull: boolean;
}

class RealtimeSyncService {
    private pollInterval: number | null = null;
    private isPolling = false;
    private deviceId: string;
    private state: SyncState = { lastPull: 0, pendingPull: false };
    private readonly MIN_PULL_INTERVAL = 8000; // حداقل ۸ ثانیه بین pull‌ها

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
    }

    private getOrCreateDeviceId(): string {
        let id = localStorage.getItem('ashke-ghalam-device-id') || localStorage.getItem('device_id');
        if (!id) {
            id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('ashke-ghalam-device-id', id);
            localStorage.setItem('device_id', id);
        }
        return id;
    }

    start() {
        if (this.pollInterval) return;
        if (typeof window === 'undefined') return;
        if (workspaceService.isStandaloneOffline()) return;

        // Poll هر ۳۰ ثانیه
        this.pollInterval = window.setInterval(() => {
            if (navigator.onLine) {
                this.requestPull();
            }
        }, 30000);

        // هنگام بازگشت کاربر به تب (visibility change)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine) {
                this.requestPull();
            }
        });

        // اولین pull با تاخیر کوتاه
        setTimeout(() => this.requestPull(), 3000);
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private requestPull(): void {
        const now = Date.now();
        if (now - this.state.lastPull < this.MIN_PULL_INTERVAL) return;
        if (this.isPolling) {
            this.state.pendingPull = true;
            return;
        }
        this.checkForChanges();
    }

    private async checkForChanges(): Promise<void> {
        if (this.isPolling || !navigator.onLine) return;
        this.isPolling = true;
        this.state.pendingPull = false;

        try {
            await deletedRecordsRegistry.syncFromServer();

            const tables = [
                'users', 'roles', 'companies',
                'invoices', 'products', 'people', 'vouchers',
                'checks', 'transactions', 'check_transfers', 'contracts', 'salaries', 'importConfigs'
            ];
            const state = useStore.getState();
            let changeCount = 0;

            for (const table of tables) {
                try {
                    const serverData = await persistentStorage.loadData(table);
                    if (!serverData || !Array.isArray(serverData)) continue;

                    const storeKey = table === 'check_transfers' ? 'checkTransfers' : table;
                    const localData = (state as any)[storeKey] as any[] || [];
                    const merged = this.smartMerge(localData, serverData, table, table === 'users');

                    if (this.hasChanges(localData, merged)) {
                        changeCount++;
                        useStore.setState({ [storeKey]: merged });
                    }
                } catch {
                    // ادامه به جدول بعدی
                }
            }

            if (changeCount > 0) {
                notificationService.info(`🔄 ${changeCount} بخش با سرور همگام‌سازی شد`);
            }

            this.state.lastPull = Date.now();
        } catch (error) {
            console.warn('Realtime sync status (polling offline):', error);
        } finally {
            this.isPolling = false;
            if (this.state.pendingPull) {
                setTimeout(() => this.requestPull(), this.MIN_PULL_INTERVAL);
            }
        }
    }

    private hasChanges(local: any[], merged: any[]): boolean {
        if (local.length !== merged.length) return true;
        const localMap = new Map(local.map(i => [i.id || i.username, i.updatedAt || i.createdAt]));
        return merged.some(i => localMap.get(i.id || i.username) !== (i.updatedAt || i.createdAt));
    }

    /**
     * ادغام ایمن بر اساس مرجعیت سرور، LWW و حفظ اقلام محلی معتبر
     */
    private smartMerge(local: any[], server: any[], table: string, isUsers = false): any[] {
        const queue = syncQueue.getQueue();
        const pendingForTable = queue.filter(q => q.table === table || (table === 'check_transfers' && q.table === 'checkTransfers'));
        const pendingSaveMap = new Map<string, any>();
        const pendingDeleteSet = new Set<string>();

        pendingForTable.forEach(item => {
            if (item.operation === 'save' && item.data?.id) {
                pendingSaveMap.set(item.data.id, item.data);
            } else if (item.operation === 'delete' && (item.data?.id || item.id)) {
                pendingDeleteSet.add(item.data?.id || item.id);
            }
        });

        const resultMap = new Map<string, any>();
        let hasLocalOnlyOrNewer = false;

        // ۱. پردازش سرور (Source of truth)
        for (const rawItem of server) {
            const item = rawItem.data || rawItem;
            if (!item || !item.id) continue;

            if (deletedRecordsRegistry.isDeleted(item.id) || pendingDeleteSet.has(item.id)) {
                continue; // هرگز اقلام حذف‌شده افزوده نشوند
            }

            const key = isUsers ? (item.username?.toLowerCase() || item.id) : item.id;
            resultMap.set(key, item);
        }

        // ۲. پردازش اقلام محلی (بازیابی شده یا ویرایش شده)
        if (Array.isArray(local)) {
            for (const localItem of local) {
                if (!localItem || !localItem.id) continue;
                if (deletedRecordsRegistry.isDeleted(localItem.id) || pendingDeleteSet.has(localItem.id)) {
                    continue;
                }

                const key = isUsers ? (localItem.username?.toLowerCase() || localItem.id) : localItem.id;
                const serverItem = resultMap.get(key);

                if (!serverItem) {
                    resultMap.set(key, localItem);
                    hasLocalOnlyOrNewer = true;
                } else {
                    const localTime = this.parseTime(localItem.updatedAt || localItem.createdAt);
                    const serverTime = this.parseTime(serverItem.updatedAt || serverItem.synced_at);

                    if (localTime > serverTime) {
                        resultMap.set(key, localItem);
                        hasLocalOnlyOrNewer = true;
                    } else if (isUsers) {
                        resultMap.set(key, {
                            ...serverItem,
                            hashedPassword: serverItem.hashedPassword || localItem.hashedPassword,
                            permissions: serverItem.permissions || localItem.permissions
                        });
                    }
                }
            }
        }

        // ۳. فقط آیتم‌های در صف آفلاین که هنوز روی سرور نیستند
        pendingSaveMap.forEach((offlineItem, id) => {
            if (deletedRecordsRegistry.isDeleted(id) || pendingDeleteSet.has(id)) return;
            const key = isUsers ? (offlineItem.username?.toLowerCase() || id) : id;
            resultMap.set(key, offlineItem);
            hasLocalOnlyOrNewer = true;
        });

        if (hasLocalOnlyOrNewer && navigator.onLine) {
            // زمان‌بندی همگام‌سازی به سرور
            setTimeout(() => {
                const autoSync = (window as any).__autoSyncService;
                if (autoSync && typeof autoSync.syncToHost === 'function') {
                    autoSync.syncToHost().catch(() => {});
                }
            }, 1500);
        }

        return Array.from(resultMap.values());
    }

    private parseTime(val: any): number {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const t = new Date(val).getTime();
        return isNaN(t) ? 0 : t;
    }

    async pushChange(table: string, action: 'insert' | 'update' | 'delete', id: string, data?: any): Promise<void> {
        if (!navigator.onLine) return;
        try {
            if (action === 'delete') {
                deletedRecordsRegistry.registerDeletion(id, table as any);
                await hostDB.delete(table, id);
            } else if (data) {
                const stamped = { ...data, updatedAt: new Date().toISOString(), lastModifiedByDevice: this.deviceId };
                await hostDB.save(table, stamped);
            }
        } catch (error) {
            console.warn('Push change error (queued):', error);
        }
    }

    async forceSync(): Promise<void> {
        this.state.lastPull = 0;
        await this.checkForChanges();
    }

    getDeviceId(): string {
        return this.deviceId;
    }
}

export const realtimeSyncService = new RealtimeSyncService();
