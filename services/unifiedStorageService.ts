import { idbService } from './indexedDBService';
import { hostDB } from './hostDatabaseService';
import { deletionRegistry } from './deletionRegistryService';
import { offlineApproval } from './offlineApprovalService';
import { vpnDetection } from './vpnDetectionService';
import { syncQueue } from './syncQueueService';

class UnifiedStorageService {
    private processing = false;

    async save(table: string, data: any, requiresApproval: boolean = false): Promise<void> {
        // بررسی VPN
        if (vpnDetection.isBlocked()) {
            throw new Error(vpnDetection.getWarningMessage());
        }

        // بررسی حذف شدن قبلی
        if (data.id && await deletionRegistry.isDeleted(data.id)) {
            throw new Error('این رکورد قبلا حذف شده است');
        }

        const operations: Promise<any>[] = [];

        // اگر نیاز به تایید دارد، به صف تایید اضافه کن
        if (requiresApproval && !navigator.onLine) {
            const currentUser = localStorage.getItem('currentUser') || 'unknown';
            await offlineApproval.addToApprovalQueue(
                data.id,
                table,
                data.id ? 'update' : 'create',
                data,
                currentUser
            );
            return;
        }

        // Priority 1: IndexedDB (always succeeds)
        operations.push(idbService.save(table, data));

        if (navigator.onLine) {
            // Priority 2: Host Database
            operations.push(
                hostDB.save(table, data).catch(() => {
                    // hostDB.save خودش enqueue می‌کند - نیازی به enqueue مجدد نیست
                })
            );
        } else {
            // آفلاین: مستقیماً به صف مرکزی اضافه کن
            syncQueue.enqueue('save', table, data, 'unifiedStorage');
        }

        await Promise.allSettled(operations);
    }

    async get(table: string, id?: string): Promise<any> {
        // بررسی حذف شدن
        if (id && await deletionRegistry.isDeleted(id)) {
            return null;
        }

        // Try IndexedDB first
        let data = await idbService.get(table, id);
        
        // فیلتر کردن دادههای حذف شده
        if (data) {
            if (Array.isArray(data)) {
                const filtered = [];
                for (const item of data) {
                    if (item.id && !await deletionRegistry.isDeleted(item.id)) {
                        filtered.push(item);
                    }
                }
                return filtered;
            } else if (data.id && await deletionRegistry.isDeleted(data.id)) {
                return null;
            }
            return data;
        }

        if (!navigator.onLine) return null;

        // Try Host DB
        data = await hostDB.get(table, id);
        if (data) {
            // بررسی حذف شدن قبل از ذخیره
            if (!data.id || !await deletionRegistry.isDeleted(data.id)) {
                await idbService.save(table, data);
                return data;
            }
        }

        return null;
    }

    async delete(table: string, id: string, requiresApproval: boolean = false): Promise<void> {
        // بررسی VPN
        if (vpnDetection.isBlocked()) {
            throw new Error(vpnDetection.getWarningMessage());
        }

        const currentUser = localStorage.getItem('currentUser') || 'unknown';

        // اگر نیاز به تایید دارد
        if (requiresApproval && !navigator.onLine) {
            await offlineApproval.addToApprovalQueue(
                id,
                table,
                'delete',
                { id },
                currentUser
            );
            return;
        }

        // ثبت در رجیستری حذفیات
        await deletionRegistry.registerDeletion(id, table, currentUser);

        // Soft delete: علامتگذاری رکورد به جای حذف
        const operations = [
            this.softDelete(table, id),
            navigator.onLine
                ? hostDB.delete(table, id).catch(() => {
                    syncQueue.enqueue('delete', table, { id }, 'unifiedStorage');
                })
                : Promise.resolve(syncQueue.enqueue('delete', table, { id }, 'unifiedStorage'))
        ];
        
        await Promise.allSettled(operations);
    }

    // Soft delete: علامتگذاری رکورد به جای حذف
    private async softDelete(table: string, id: string): Promise<void> {
        try {
            const data = await idbService.get(table, id);
            if (data) {
                data._deleted = true;
                data._deletedAt = Date.now();
                await idbService.save(table, data);
            }
        } catch (error) {
            console.error('خطا در soft delete:', error);
        }
    }

    // حذف کامل (فقط برای پاکسازی)
    async hardDelete(table: string, id: string): Promise<void> {
        const operations = [
            idbService.delete(table, id),
            hostDB.delete(table, id).catch(() => {})
        ];
        await Promise.allSettled(operations);
    }

    // سینک با بررسی حذفیات
    async syncWithDeletionCheck(table: string): Promise<void> {
        // بررسی VPN
        if (vpnDetection.isBlocked()) return;

        if (!navigator.onLine) return;

        try {
            // دریافت دادههای محلی
            const localData = await idbService.get(table);
            
            // دریافت حذفیات
            const deletions = await deletionRegistry.getDeletionsByType(table);
            const deletedIds = new Set(deletions.map(d => d.id));

            // پاکسازی دادههای حذف شده از کش محلی
            if (Array.isArray(localData)) {
                for (const item of localData) {
                    if (item.id && deletedIds.has(item.id)) {
                        await this.hardDelete(table, item.id);
                    }
                }
            }

            // دریافت دادههای جدید از سرور
            const remoteData = await hostDB.get(table);
            
            if (Array.isArray(remoteData)) {
                for (const item of remoteData) {
                    // فقط دادههایی که حذف نشدهاند را ذخیره کن
                    if (!item.id || !deletedIds.has(item.id)) {
                        await idbService.save(table, item);
                    }
                }
            }
        } catch (error) {
            console.error('خطا در سینک:', error);
        }
    }

    // پاکسازی خودکار دادههای حذف شده قدیمی
    async cleanupDeletedData(table: string, olderThanDays: number = 30): Promise<number> {
        const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        const deletions = await deletionRegistry.getDeletionsByType(table);
        let cleanedCount = 0;

        for (const deletion of deletions) {
            if (deletion.deletedAt < cutoffTime) {
                await this.hardDelete(table, deletion.id);
                await deletionRegistry.removeDeletion(deletion.id);
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    // پردازش صف retry - اکنون از syncQueue مرکزی استفاده می‌کند
    async processRetryQueue(): Promise<void> {
        await syncQueue.processQueue();
    }

    // بارگذاری صف (برای سازگاری با کدهای قدیمی)
    loadQueue(): void {
        // هیچ کاری نمی‌کند - syncQueue status خودش مدیریت می‌کند
    }

    // دریافت آمار
    async getStats(table: string): Promise<{
        total: number;
        deleted: number;
        active: number;
        pendingApproval: number;
    }> {
        const allData = await idbService.get(table);
        const deletions = await deletionRegistry.getDeletionsByType(table);
        const pending = await offlineApproval.getPendingByType(table);

        const total = Array.isArray(allData) ? allData.length : 0;
        const deleted = deletions.length;
        const active = total - deleted;

        return {
            total,
            deleted,
            active,
            pendingApproval: pending.length
        };
    }
}

export const unifiedStorage = new UnifiedStorageService();
