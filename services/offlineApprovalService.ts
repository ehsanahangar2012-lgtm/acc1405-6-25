// سرویس تایید دادههای آفلاین - مدیریت دادههایی که نیاز به تایید کاربر ارشد دارند

interface OfflineDataItem {
  id: string;
  entityType: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  deviceId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: number;
  rejectionReason?: string;
  conflictInfo?: {
    hasConflict: boolean;
    conflictType?: string;
    remoteData?: any;
  };
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

class OfflineApprovalService {
  private dbName = 'OfflineApprovalDB';
  private storeName = 'approvalQueue';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('entityType', 'entityType', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  // افزودن داده به صف تایید
  async addToApprovalQueue(
    id: string,
    entityType: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    userId: string,
    conflictInfo?: any
  ): Promise<void> {
    if (!this.db) await this.init();

    const item: OfflineDataItem = {
      id,
      entityType,
      operation,
      data,
      timestamp: Date.now(),
      deviceId: await this.getDeviceId(),
      userId,
      status: 'pending',
      conflictInfo
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت تمام دادههای در انتظار تایید
  async getPendingApprovals(): Promise<OfflineDataItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll('pending');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت دادههای در انتظار بر اساس نوع
  async getPendingByType(entityType: string): Promise<OfflineDataItem[]> {
    const allPending = await this.getPendingApprovals();
    return allPending.filter(item => item.entityType === entityType);
  }

  // تایید یک داده
  async approveItem(id: string, approvedBy: string): Promise<void> {
    if (!this.db) await this.init();

    const item = await this.getItem(id);
    if (!item) throw new Error('Item not found');

    item.status = 'approved';
    item.approvedBy = approvedBy;
    item.approvedAt = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // رد یک داده
  async rejectItem(id: string, rejectedBy: string, reason: string): Promise<void> {
    if (!this.db) await this.init();

    const item = await this.getItem(id);
    if (!item) throw new Error('Item not found');

    item.status = 'rejected';
    item.approvedBy = rejectedBy;
    item.approvedAt = Date.now();
    item.rejectionReason = reason;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // تایید دسته جمعی
  async approveMultiple(ids: string[], approvedBy: string): Promise<number> {
    let approvedCount = 0;
    
    for (const id of ids) {
      try {
        await this.approveItem(id, approvedBy);
        approvedCount++;
      } catch (error) {
        console.error(`Failed to approve item ${id}:`, error);
      }
    }
    
    return approvedCount;
  }

  // رد دسته جمعی
  async rejectMultiple(ids: string[], rejectedBy: string, reason: string): Promise<number> {
    let rejectedCount = 0;
    
    for (const id of ids) {
      try {
        await this.rejectItem(id, rejectedBy, reason);
        rejectedCount++;
      } catch (error) {
        console.error(`Failed to reject item ${id}:`, error);
      }
    }
    
    return rejectedCount;
  }

  // دریافت یک داده
  async getItem(id: string): Promise<OfflineDataItem | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت آمار
  async getStats(): Promise<ApprovalStats> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result;
        const stats: ApprovalStats = {
          pending: items.filter(i => i.status === 'pending').length,
          approved: items.filter(i => i.status === 'approved').length,
          rejected: items.filter(i => i.status === 'rejected').length,
          total: items.length
        };
        resolve(stats);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // پاکسازی دادههای تایید/رد شده قدیمی
  async cleanup(olderThanDays: number = 30): Promise<number> {
    if (!this.db) await this.init();

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const allItems = await this.getAllItems();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      allItems.forEach(item => {
        if (item.status !== 'pending' && item.timestamp < cutoffTime) {
          store.delete(item.id);
          deletedCount++;
        }
      });

      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // دریافت تمام دادهها
  private async getAllItems(): Promise<OfflineDataItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // پردازش دادههای تایید شده
  async processApprovedItems(): Promise<{ success: number; failed: number }> {
    const approvedItems = await this.getApprovedItems();
    let success = 0;
    let failed = 0;

    for (const item of approvedItems) {
      try {
        // اعمال داده به سیستم اصلی
        await this.applyToMainSystem(item);
        
        // حذف از صف
        await this.removeItem(item.id);
        success++;
      } catch (error) {
        console.error(`Failed to process approved item ${item.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // پردازش دادههای رد شده
  async processRejectedItems(): Promise<number> {
    const rejectedItems = await this.getRejectedItems();
    let processedCount = 0;

    for (const item of rejectedItems) {
      try {
        // حذف از کش و صف
        await this.removeFromCache(item.id);
        await this.removeItem(item.id);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process rejected item ${item.id}:`, error);
      }
    }

    return processedCount;
  }

  // دریافت دادههای تایید شده
  private async getApprovedItems(): Promise<OfflineDataItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll('approved');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت دادههای رد شده
  private async getRejectedItems(): Promise<OfflineDataItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll('rejected');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // اعمال داده به سیستم اصلی
  private async applyToMainSystem(item: OfflineDataItem): Promise<void> {
    // این متد باید با سیستم اصلی یکپارچه شود
    // فعلا فقط ساختار را نشان میدهیم
    console.log('Applying to main system:', item);
  }

  // حذف از کش
  private async removeFromCache(id: string): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (const request of requests) {
          if (request.url.includes(id)) {
            await cache.delete(request);
          }
        }
      }
    }
  }

  // حذف از صف
  private async removeItem(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت شناسه دستگاه
  private async getDeviceId(): Promise<string> {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }
}

export const offlineApproval = new OfflineApprovalService();
export type { OfflineDataItem, ApprovalStats };
