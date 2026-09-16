// Auto Cross-Device Sync Service با مرجعیت سرور و Last-Write-Wins
import { persistentStorage } from './persistentStorage';
import { syncMetadata } from './syncMetadataService';
import { deletedRecordsRegistry } from './deletedRecordsRegistry';
import { syncApprovalService } from './syncApprovalService';
import { syncQueue } from './syncQueueService';
import { useStore } from '../store';
import { workspaceService } from './workspaceService';

class CrossDeviceSync {
    private syncInterval: number = 30000; // 30 seconds
    private intervalId: any = null;

    async startAutoSync() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (workspaceService.isStandaloneOffline()) return;
        
        // Initial sync on load
        await this.pullFromServer();

        // Auto sync every 30 seconds
        this.intervalId = setInterval(() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                this.pullFromServer();
            }
        }, this.syncInterval);

        // Sync on visibility change (when user returns to app)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && typeof navigator !== 'undefined' && navigator.onLine) {
                this.pullFromServer();
            }
        });

        // Sync on online event
        window.addEventListener('online', () => {
            this.pullFromServer();
        });
    }

    async pullFromServer() {
        if (workspaceService.isStandaloneOffline() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
        try {
            // ۱. دانلود لیست حذفیات از سرور
            try {
                await deletedRecordsRegistry.syncFromServer();
            } catch (err) {
                console.warn('Deleted records sync failed:', err);
            }
            
            const keys = [
                'users', 'roles', 'companies',
                'products', 'people', 'invoices',
                'vouchers', 'checks', 'transactions',
                'check_transfers', 'contracts', 'salaries', 'importConfigs'
            ];
            let synced = 0;
            const queue = syncQueue.getQueue();
            let hasLocalOnlyOrNewer = false;
            
            for (const key of keys) {
                const serverData = await persistentStorage.loadData(key);
                if (!serverData || !Array.isArray(serverData)) continue;

                const storeKey = key === 'check_transfers' ? 'checkTransfers' : key;
                const localArray = (useStore.getState() as any)[storeKey] || [];
                const pendingForTable = queue.filter(q => q.table === key || (key === 'check_transfers' && q.table === 'checkTransfers'));
                const pendingSaveMap = new Map<string, any>();
                const pendingDeleteSet = new Set<string>();

                pendingForTable.forEach(item => {
                    if (item.operation === 'save' && item.data?.id) {
                        pendingSaveMap.set(item.data.id, item.data);
                    } else if (item.operation === 'delete' && (item.data?.id || item.id)) {
                        pendingDeleteSet.add(item.data?.id || item.id);
                    }
                });
                
                const mergedMap = new Map<string, any>();

                // ۱. پردازش رکوردهای سرور (Source of truth)
                for (const serverRecord of serverData) {
                    if (!serverRecord || !serverRecord.id) continue;
                    if (deletedRecordsRegistry.isDeleted(serverRecord.id) || pendingDeleteSet.has(serverRecord.id)) {
                        continue; // رکوردهای حذف شده اضافه نمی‌شوند
                    }

                    mergedMap.set(serverRecord.id, serverRecord);
                    synced++;
                }

                // ۲. پردازش رکوردهای محلی (بازیابی شده از بک‌آپ یا ثبت شده روی دستگاه)
                if (Array.isArray(localArray)) {
                    for (const localItem of localArray) {
                        if (!localItem || !localItem.id) continue;
                        if (deletedRecordsRegistry.isDeleted(localItem.id) || pendingDeleteSet.has(localItem.id)) {
                            continue;
                        }

                        const serverRecord = mergedMap.get(localItem.id);
                        if (!serverRecord) {
                            mergedMap.set(localItem.id, localItem);
                            hasLocalOnlyOrNewer = true;
                        } else {
                            const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                            const serverTime = new Date(serverRecord.updatedAt || serverRecord.synced_at || 0).getTime();

                            if (localTime > serverTime) {
                                mergedMap.set(localItem.id, localItem);
                                hasLocalOnlyOrNewer = true;
                            }
                        }
                    }
                }

                // ۳. رکوردهای آفلاین جدید ایجاد شده روی این دستگاه
                pendingSaveMap.forEach((offlineItem, id) => {
                    if (deletedRecordsRegistry.isDeleted(id) || pendingDeleteSet.has(id)) return;
                    mergedMap.set(id, offlineItem);
                    hasLocalOnlyOrNewer = true;
                });

                const finalArray = Array.from(mergedMap.values());
                useStore.setState({ [storeKey]: finalArray });
            }

            if (hasLocalOnlyOrNewer && navigator.onLine) {
                setTimeout(() => {
                    const autoSync = (window as any).__autoSyncService;
                    if (autoSync && typeof autoSync.syncToHost === 'function') {
                        autoSync.syncToHost().catch(() => {});
                    }
                }, 1500);
            }

            return true;
        } catch (error) {
            console.error('Sync failed:', error);
            return false;
        }
    }

    async pushToServer(key: string, data: any) {
        if (typeof navigator === 'undefined' || !navigator.onLine) return false;
        return await persistentStorage.saveData(key, data);
    }

    stopAutoSync() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

export const crossDeviceSync = new CrossDeviceSync();
