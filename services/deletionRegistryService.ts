// سرویس رجیستری حذفیات - ردیابی دادههای حذف شده در تمام دستگاهها

interface DeletionRecord {
  id: string; // شناسه منحصر به فرد رکورد حذف شده
  entityType: 'invoice' | 'product' | 'customer' | 'voucher' | 'check' | string;
  deletedAt: number; // timestamp حذف
  deletedBy: string; // کاربر حذف کننده
  deviceId: string; // دستگاه حذف کننده
  syncVersion: number; // نسخه سینک
  reason?: string; // دلیل حذف (اختیاری)
}

interface TombstoneRegistry {
  deletions: Map<string, DeletionRecord>;
  lastCleanup: number;
}

class DeletionRegistryService {
  private dbName = 'DeletionRegistry';
  private storeName = 'tombstones';
  private db: IDBDatabase | null = null;
  private TTL = 90 * 24 * 60 * 60 * 1000; // 90 روز

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
          store.createIndex('entityType', 'entityType', { unique: false });
          store.createIndex('deletedAt', 'deletedAt', { unique: false });
          store.createIndex('deviceId', 'deviceId', { unique: false });
        }
      };
    });
  }

  // ثبت حذف یک رکورد
  async registerDeletion(
    id: string,
    entityType: string,
    deletedBy: string,
    reason?: string
  ): Promise<void> {
    if (!this.db) await this.init();

    const record: DeletionRecord = {
      id,
      entityType,
      deletedAt: Date.now(),
      deletedBy,
      deviceId: await this.getDeviceId(),
      syncVersion: await this.getNextSyncVersion(),
      reason
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(record);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // بررسی اینکه آیا رکورد حذف شده است
  async isDeleted(id: string): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت اطلاعات حذف
  async getDeletionRecord(id: string): Promise<DeletionRecord | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت تمام حذفیات بعد از یک زمان مشخص
  async getDeletionsSince(timestamp: number): Promise<DeletionRecord[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('deletedAt');
      const range = IDBKeyRange.lowerBound(timestamp);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // دریافت تمام حذفیات یک نوع خاص
  async getDeletionsByType(entityType: string): Promise<DeletionRecord[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('entityType');
      const request = index.getAll(entityType);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // پاکسازی حذفیات قدیمی (بیشتر از TTL)
  async cleanup(): Promise<number> {
    if (!this.db) await this.init();

    const cutoffTime = Date.now() - this.TTL;
    const oldDeletions = await this.getDeletionsSince(0);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      oldDeletions.forEach(record => {
        if (record.deletedAt < cutoffTime) {
          store.delete(record.id);
          deletedCount++;
        }
      });

      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // حذف رکورد از رجیستری (برای بازگردانی)
  async removeDeletion(id: string): Promise<void> {
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

  // دریافت نسخه بعدی سینک
  private async getNextSyncVersion(): Promise<number> {
    const currentVersion = parseInt(localStorage.getItem('syncVersion') || '0');
    const nextVersion = currentVersion + 1;
    localStorage.setItem('syncVersion', nextVersion.toString());
    return nextVersion;
  }

  // صادرات حذفیات برای سینک
  async exportDeletions(): Promise<DeletionRecord[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // وارد کردن حذفیات از سینک
  async importDeletions(deletions: DeletionRecord[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      deletions.forEach(record => {
        store.put(record);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const deletionRegistry = new DeletionRegistryService();
export type { DeletionRecord };
