// Deleted Records Registry - لیست مرکزی رکوردهای حذف شده (Tombstones)
// این سرویس تضمین می‌کند رکوردهای حذف شده در یک دستگاه، در هیچ دستگاه دیگری بازگردانی نشوند.
import { useStore } from '../store';
import { idbService } from './indexedDBService';
import { API_CONFIG } from '../config';
import { persistentStorage } from './persistentStorage';

export interface DeletedRecord {
  id: string;
  type: 'product' | 'person' | 'invoice' | 'voucher' | 'check' | 'transaction' | 'user' | 'company' | 'contract' | 'salary' | 'checkTransfer';
  deletedAt: number;
  deletedBy: string;
  deviceId: string;
  reason?: string;
  serverReceivedAt?: string;
}

class DeletedRecordsRegistry {
  private readonly REGISTRY_KEY = 'deleted_records_registry';
  private readonly SERVER_SYNC_INTERVAL = 2 * 60 * 1000; // هر 2 دقیقه
  private syncTimer: any = null;

  // ثبت حذف رکورد (Tombstone)
  registerDeletion(id: string, type: DeletedRecord['type'], reason?: string): void {
    if (!id) return;
    const registry = this.getRegistry();
    
    const record: DeletedRecord = {
      id,
      type,
      deletedAt: Date.now(),
      deletedBy: localStorage.getItem('userId') || 'system',
      deviceId: this.getDeviceId(),
      reason: reason || 'حذف توسط کاربر',
    };

    registry[id] = record;
    this.saveRegistry(registry);
    
    // بلافاصله از کش محلی و استور حذف شود
    this.removeFromCache(id, type);

    // Sync فوری به سرور و فایل persistent
    this.syncToServer([record]);
  }

  // بررسی اینکه آیا رکورد حذف شده است
  isDeleted(id: string): boolean {
    if (!id) return false;
    const registry = this.getRegistry();
    return !!registry[id];
  }

  // لغو حذف (Un-tombstone) - استفاده هنگام بازیابی فایل بک‌آپ یا احیای رکوردهای بازیابی شده
  unmarkDeleted(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    const registry = this.getRegistry();
    let changed = false;
    for (const id of ids) {
      if (id && registry[id]) {
        delete registry[id];
        changed = true;
      }
    }
    if (changed) {
      this.saveRegistry(registry);
      const all = this.getAllDeleted();
      persistentStorage.saveData('deleted_records', all).catch(() => {});
    }
  }

  // پاکسازی کامل تمامی Tombstoneها برای بازیابی بک‌آپ کامل
  clearAll(): void {
    localStorage.removeItem(this.REGISTRY_KEY);
    persistentStorage.saveData('deleted_records', []).catch(() => {});
  }

  // دریافت اطلاعات حذف
  getDeletedRecord(id: string): DeletedRecord | null {
    const registry = this.getRegistry();
    return registry[id] || null;
  }

  // دریافت تمام حذفیات
  getAllDeleted(): DeletedRecord[] {
    const registry = this.getRegistry();
    return Object.values(registry);
  }

  // دریافت حذفیات بر اساس نوع
  getDeletedByType(type: DeletedRecord['type']): DeletedRecord[] {
    return this.getAllDeleted().filter(r => r.type === type);
  }

  // Sync با سرور - دانلود لیست حذفیات
  async syncFromServer(): Promise<{ synced: number; cleaned: number }> {
    try {
      let serverDeleted: DeletedRecord[] = [];

      // تلاش اول: از طریق deleted-records-api.php
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/deleted-records-api.php?action=list`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
          const text = await response.text();
          if (!text.trim().startsWith('<?php') && !text.trim().startsWith('<')) {
            serverDeleted = JSON.parse(text);
          }
        }
      } catch (err) {
        // Fallback به persistent storage
      }

      // اگر سرور اول خالی بود یا خطا داد، از persistent storage بخوانیم
      if (!serverDeleted || serverDeleted.length === 0) {
        const fallbackData = await persistentStorage.loadData('deleted_records');
        if (fallbackData) {
          serverDeleted = Array.isArray(fallbackData) ? fallbackData : Object.values(fallbackData);
        }
      }

      const localRegistry = this.getRegistry();
      let synced = 0;
      let cleaned = 0;

      // اضافه کردن حذفیات سرور به local و پاکسازی استور
      if (Array.isArray(serverDeleted)) {
        for (const record of serverDeleted) {
          if (record && record.id) {
            if (!localRegistry[record.id]) {
              localRegistry[record.id] = record;
              synced++;
            }
            // اطمینان از پاک بودن در استور و IndexedDB
            this.removeFromCache(record.id, record.type);
            cleaned++;
          }
        }
      }

      this.saveRegistry(localRegistry);
      return { synced, cleaned };
    } catch (error: any) {
      console.warn('Failed to sync deleted records from server:', error?.message || error);
      return { synced: 0, cleaned: 0 };
    }
  }

  // Sync به سرور - آپلود حذفیات local
  private async syncToServer(records: DeletedRecord[]): Promise<void> {
    try {
      // 1. آپلود به deleted-records-api.php
      try {
        await fetch(`${API_CONFIG.BASE_URL}/deleted-records-api.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            records,
          }),
        });
      } catch {
        // ادامه به روش دوم
      }

      // 2. ذخیره در persistent storage به عنوان پشتیبان کامل
      const all = this.getAllDeleted();
      await persistentStorage.saveData('deleted_records', all);
    } catch (error: any) {
      console.warn('Failed to sync deleted records to server:', error?.message || error);
    }
  }

  // پاک کردن از کش و استور
  private removeFromCache(id: string, type: DeletedRecord['type']): void {
    const typeMap: Record<string, string> = {
      product: 'products',
      person: 'people',
      invoice: 'invoices',
      voucher: 'vouchers',
      check: 'checks',
      transaction: 'transactions',
      user: 'users',
      company: 'companies',
      contract: 'contracts',
      salary: 'salaries',
      checkTransfer: 'checkTransfers',
    };
    
    const key = typeMap[type];
    if (key) {
      try {
        useStore.setState((s: any) => ({
          [key]: (s[key] || []).filter((item: any) => item && item.id !== id)
        }));
      } catch (error) {
        console.error('Failed to remove from cache:', error);
      }
    }

    // پاک کردن از IndexedDB
    this.removeFromIndexedDB(id, type);
  }

  // پاک کردن از IndexedDB
  private async removeFromIndexedDB(id: string, type: DeletedRecord['type']): Promise<void> {
    try {
      const typeMap: Record<string, string> = {
        product: 'products',
        person: 'people',
        invoice: 'invoices',
        voucher: 'vouchers',
        check: 'checks',
        transaction: 'transactions',
        user: 'users',
        company: 'companies',
        contract: 'contracts',
        salary: 'salaries',
        checkTransfer: 'checkTransfers',
      };
      
      const storeName = typeMap[type];
      if (storeName) {
        await idbService.delete(storeName, id);
      }
    } catch (error) {
      console.error('Failed to remove from IndexedDB:', error);
    }
  }

  // شروع Auto Sync
  startAutoSync(): void {
    if (this.syncTimer) return;
    
    // Sync اولیه
    this.syncFromServer();
    
    // Sync دوره‌ای
    this.syncTimer = setInterval(() => {
      this.syncFromServer();
    }, this.SERVER_SYNC_INTERVAL);
  }

  // توقف Auto Sync
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // پاکسازی حذفیات قدیمی (بیش از 180 روز)
  cleanup(): number {
    const registry = this.getRegistry();
    const oneEightyDaysAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    Object.keys(registry).forEach(id => {
      if (registry[id].deletedAt < oneEightyDaysAgo) {
        delete registry[id];
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveRegistry(registry);
      persistentStorage.saveData('deleted_records', Object.values(registry)).catch(() => {});
    }

    return cleaned;
  }

  // دریافت registry
  private getRegistry(): Record<string, DeletedRecord> {
    try {
      const data = localStorage.getItem(this.REGISTRY_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  // ذخیره registry
  private saveRegistry(registry: Record<string, DeletedRecord>): void {
    try {
      localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.warn('LocalStorage save error in deleted records:', e);
    }
  }

  // دریافت Device ID
  private getDeviceId(): string {
    let id = localStorage.getItem('ashke-ghalam-device-id') || localStorage.getItem('device_id');
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ashke-ghalam-device-id', id);
      localStorage.setItem('device_id', id);
    }
    return id;
  }
}

export const deletedRecordsRegistry = new DeletedRecordsRegistry();
