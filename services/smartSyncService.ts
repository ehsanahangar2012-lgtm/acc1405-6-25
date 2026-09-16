// سرویس سینک هوشمند - مدیریت تضادها و سینک چند دستگاهی

import { deletionRegistry, DeletionRecord } from './deletionRegistryService';
import { idbService } from './indexedDBService';

interface SyncConflict {
  id: string;
  entityType: string;
  localData: any;
  remoteData: any;
  localTimestamp: number;
  remoteTimestamp: number;
  conflictType: 'edit-edit' | 'edit-delete' | 'create-delete';
  resolution?: 'local' | 'remote' | 'merge' | 'manual';
}

interface SyncResult {
  success: boolean;
  conflicts: SyncConflict[];
  applied: number;
  rejected: number;
  needsApproval: boolean;
}

class SmartSyncService {
  private conflictQueue: SyncConflict[] = [];

  // سینک هوشمند با مدیریت تضاد
  async smartSync(
    localData: Map<string, any>,
    remoteData: Map<string, any>,
    entityType: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      conflicts: [],
      applied: 0,
      rejected: 0,
      needsApproval: false
    };

    // دریافت حذفیات از رجیستری
    const deletions = await deletionRegistry.getDeletionsByType(entityType);
    const deletedIds = new Set(deletions.map(d => d.id));

    // پردازش دادههای remote
    for (const [id, remoteItem] of remoteData.entries()) {
      // بررسی حذف شدن
      if (deletedIds.has(id)) {
        result.rejected++;
        continue;
      }

      const localItem = localData.get(id);

      if (!localItem) {
        // داده جدید از remote
        localData.set(id, remoteItem);
        result.applied++;
      } else {
        // بررسی تضاد
        const conflict = await this.detectConflict(id, entityType, localItem, remoteItem);
        
        if (conflict) {
          result.conflicts.push(conflict);
          result.needsApproval = true;
          this.conflictQueue.push(conflict);
        } else {
          // بدون تضاد - اعمال داده جدیدتر
          if (remoteItem.updatedAt > localItem.updatedAt) {
            localData.set(id, remoteItem);
            result.applied++;
          }
        }
      }
    }

    // پردازش حذفیات
    for (const deletion of deletions) {
      if (localData.has(deletion.id)) {
        const localItem = localData.get(deletion.id);
        
        // بررسی تضاد edit-delete
        if (localItem.updatedAt > deletion.deletedAt) {
          const conflict: SyncConflict = {
            id: deletion.id,
            entityType,
            localData: localItem,
            remoteData: null,
            localTimestamp: localItem.updatedAt,
            remoteTimestamp: deletion.deletedAt,
            conflictType: 'edit-delete'
          };
          
          result.conflicts.push(conflict);
          result.needsApproval = true;
          this.conflictQueue.push(conflict);
        } else {
          // حذف اولویت دارد
          localData.delete(deletion.id);
          result.applied++;
        }
      }
    }

    // پاکسازی کش از دادههای حذف شده
    await this.cleanupCache(deletedIds);

    return result;
  }

  // تشخیص تضاد
  private async detectConflict(
    id: string,
    entityType: string,
    localItem: any,
    remoteItem: any
  ): Promise<SyncConflict | null> {
    const localTimestamp = localItem.updatedAt || localItem.createdAt || 0;
    const remoteTimestamp = remoteItem.updatedAt || remoteItem.createdAt || 0;

    // بررسی تغییرات همزمان
    const timeDiff = Math.abs(localTimestamp - remoteTimestamp);
    const hasConflict = timeDiff < 5000 && // تغییرات در 5 ثانیه
                        JSON.stringify(localItem) !== JSON.stringify(remoteItem);

    if (hasConflict) {
      return {
        id,
        entityType,
        localData: localItem,
        remoteData: remoteItem,
        localTimestamp,
        remoteTimestamp,
        conflictType: 'edit-edit'
      };
    }

    return null;
  }

  // حل تضاد خودکار
  async autoResolveConflict(conflict: SyncConflict): Promise<'local' | 'remote' | 'manual'> {
    switch (conflict.conflictType) {
      case 'edit-delete':
        // حذف همیشه اولویت دارد
        return 'remote';
      
      case 'edit-edit':
        // جدیدترین timestamp برنده است
        return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
      
      case 'create-delete':
        // نیاز به تایید دستی
        return 'manual';
      
      default:
        return 'manual';
    }
  }

  // اعمال حل تضاد
  async applyConflictResolution(
    conflict: SyncConflict,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: any
  ): Promise<void> {
    const storeName = this.getStoreName(conflict.entityType);
    
    switch (resolution) {
      case 'local':
        // نگه داشتن داده محلی
        await this.saveToStorage(storeName, conflict.id, conflict.localData);
        break;
      
      case 'remote':
        // اعمال داده remote یا حذف
        if (conflict.remoteData === null) {
          await this.deleteFromStorage(storeName, conflict.id);
          await deletionRegistry.registerDeletion(
            conflict.id,
            conflict.entityType,
            'system',
            'Conflict resolution: remote delete'
          );
        } else {
          await this.saveToStorage(storeName, conflict.id, conflict.remoteData);
        }
        break;
      
      case 'merge':
        // اعمال داده ادغام شده
        if (mergedData) {
          await this.saveToStorage(storeName, conflict.id, mergedData);
        }
        break;
    }

    // حذف از صف تضادها
    this.conflictQueue = this.conflictQueue.filter(c => c.id !== conflict.id);
  }

  // دریافت صف تضادها
  getConflictQueue(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  // پاکسازی کش از دادههای حذف شده
  private async cleanupCache(deletedIds: Set<string>): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const url = new URL(request.url);
          const pathParts = url.pathname.split('/');
          const possibleId = pathParts[pathParts.length - 1];
          
          if (deletedIds.has(possibleId)) {
            await cache.delete(request);
          }
        }
      }
    }
  }

  // پاکسازی IndexedDB از دادههای حذف شده
  async cleanupIndexedDB(entityType: string): Promise<number> {
    const deletions = await deletionRegistry.getDeletionsByType(entityType);
    const storeName = this.getStoreName(entityType);
    let cleanedCount = 0;

    for (const deletion of deletions) {
      const exists = await this.existsInStorage(storeName, deletion.id);
      if (exists) {
        await this.deleteFromStorage(storeName, deletion.id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Helper methods
  private getStoreName(entityType: string): string {
    const storeMap: Record<string, string> = {
      'invoice': 'invoices',
      'product': 'products',
      'customer': 'people',
      'person': 'people',
      'voucher': 'vouchers',
      'check': 'checks'
    };
    return storeMap[entityType] || entityType;
  }

  private async saveToStorage(storeName: string, id: string, data: any): Promise<void> {
    await idbService.save(storeName, { id, ...data });
  }

  private async deleteFromStorage(storeName: string, id: string): Promise<void> {
    await idbService.delete(storeName, id);
  }

  private async existsInStorage(storeName: string, id: string): Promise<boolean> {
    const result = await idbService.get(storeName, id);
    return !!result;
  }
}

export const smartSync = new SmartSyncService();
export type { SyncConflict, SyncResult };
