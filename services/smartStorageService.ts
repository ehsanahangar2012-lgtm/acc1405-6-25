import { hostDB } from './hostDatabaseService';
import { STORAGE_PRIORITY } from '../config';
import { syncQueue } from './syncQueueService';

interface StorageOptions {
  forceLocal?: boolean;
  timeout?: number;
  retries?: number;
}

class SmartStorageService {
  private isOnline: boolean = navigator.onLine;
  private storageMode: 'HOST' | 'LOCAL' = 'HOST';

  constructor() {
    this.initOnlineListener();
    this.loadStorageMode();
  }

  private initOnlineListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private loadStorageMode() {
    const saved = localStorage.getItem('storage-mode');
    if (saved === 'LOCAL' || saved === 'HOST') {
      this.storageMode = saved;
    }
  }

  setStorageMode(mode: 'HOST' | 'LOCAL') {
    this.storageMode = mode;
    localStorage.setItem('storage-mode', mode);
  }

  getStorageMode(): 'HOST' | 'LOCAL' {
    return this.storageMode;
  }

  // ذخیره هوشمند: اول هاست، در صورت خطا لوکال
  async save(table: string, data: any, options: StorageOptions = {}): Promise<{ success: boolean; source: 'HOST' | 'LOCAL' }> {
    // اگر فورس لوکال باشد
    if (options.forceLocal || this.storageMode === 'LOCAL') {
      this.saveToLocal(table, data);
      return { success: true, source: 'LOCAL' };
    }

    // تلاش برای ذخیره روی هاست
    if (this.isOnline) {
      try {
        const timeout = options.timeout || STORAGE_PRIORITY.HOST_TIMEOUT;
        const savePromise = hostDB.save(table, data);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );

        await Promise.race([savePromise, timeoutPromise]);
        
        // موفق - حذف از لوکال اگر وجود دارد
        this.removeFromLocal(table, data.id);
        return { success: true, source: 'HOST' };
      } catch (error) {
        console.warn('Host save failed, falling back to local:', error);
      }
    }

    // Fallback: ذخیره موقت در لوکال
    this.saveToLocal(table, data);
    // توجه: hostDB.save خودش enqueue می‌کند وقتی fail می‌شود.
    // اگر افلاین بودیم (isOnline=false)، مستقیماً enqueue می‌کنیم
    if (!this.isOnline) {
      syncQueue.enqueue('save', table, data, 'smartStorage-offline');
    }
    return { success: true, source: 'LOCAL' };
  }

  // دریافت هوشمند: اول هاست، در صورت خطا لوکال
  async get(table: string, id?: string): Promise<any> {
    // اگر مود لوکال باشد
    if (this.storageMode === 'LOCAL') {
      return this.getFromLocal(table, id);
    }

    // تلاش برای دریافت از هاست
    if (this.isOnline) {
      try {
        const data = await Promise.race([
          hostDB.get(table, id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), STORAGE_PRIORITY.HOST_TIMEOUT)
          )
        ]);
        
        if (data) {
          // کش کردن در لوکال برای دسترسی سریعتر
          this.cacheToLocal(table, data);
          return data;
        }
      } catch (error) {
        console.warn('Host get failed, falling back to local:', error);
      }
    }

    // Fallback: دریافت از لوکال
    return this.getFromLocal(table, id);
  }

  // حذف هوشمند
  async delete(table: string, id: string): Promise<{ success: boolean; source: 'HOST' | 'LOCAL' }> {
    if (this.storageMode === 'LOCAL') {
      this.removeFromLocal(table, id);
      return { success: true, source: 'LOCAL' };
    }

    if (this.isOnline) {
      try {
        await Promise.race([
          hostDB.delete(table, id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), STORAGE_PRIORITY.HOST_TIMEOUT)
          )
        ]);
        
        this.removeFromLocal(table, id);
        return { success: true, source: 'HOST' };
      } catch (error) {
        console.warn('Host delete failed, queuing for later:', error);
      }
    }

    this.removeFromLocal(table, id);
    // اگر آفلاین بودیم، مستقیماً enqueue کنیم
    if (!this.isOnline) {
      syncQueue.enqueue('delete', table, { id }, 'smartStorage-offline');
    }
    return { success: true, source: 'LOCAL' };
  }

  // عملیات لوکال
  private saveToLocal(table: string, data: any) {
    const key = `local-${table}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const index = existing.findIndex((item: any) => item.id === data.id);
    
    if (index >= 0) {
      existing[index] = data;
    } else {
      existing.push(data);
    }
    
    localStorage.setItem(key, JSON.stringify(existing));
  }

  private getFromLocal(table: string, id?: string): any {
    const key = `local-${table}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (id) {
      return data.find((item: any) => item.id === id);
    }
    
    return data;
  }

  private removeFromLocal(table: string, id: string) {
    const key = `local-${table}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = data.filter((item: any) => item.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  private cacheToLocal(table: string, data: any) {
    const key = `cache-${table}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // صف آفلاین
  private addToOfflineQueue(operation: string, table: string, data: any) {
    const queue = JSON.parse(localStorage.getItem('offline-queue') || '[]');
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      table,
      data,
      timestamp: Date.now(),
      retries: 0
    });
    localStorage.setItem('offline-queue', JSON.stringify(queue));
  }

  // پردازش صف آفلاین - اکنون به syncQueue مرکزی واگذار می‌شود
  async processOfflineQueue() {
    return syncQueue.processQueue();
  }

  // بررسی وضعیت
  getStatus() {
    const stats = syncQueue.getStats();
    return {
      isOnline: this.isOnline,
      storageMode: this.storageMode,
      pendingSync: stats.total,
      priority: STORAGE_PRIORITY.PRIMARY
    };
  }

  // پاکسازی کش
  clearCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache-') || key.startsWith('local-')) {
        localStorage.removeItem(key);
      }
    });
  }
}

export const smartStorage = new SmartStorageService();
