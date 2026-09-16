// Sync Metadata Service - راهکار حرفه‌ای برای جلوگیری از بازگشت دادههای حذف شده
// استفاده از Tombstone Pattern + Vector Clock

export interface SyncMetadata {
  id: string;
  version: number;
  lastModified: number; // timestamp
  deleted: boolean;
  deletedAt?: number;
  deviceId: string;
}

class SyncMetadataService {
  private readonly METADATA_KEY = 'sync_metadata_v1';
  private deviceId: string;

  constructor() {
    this.deviceId = this.getDeviceId();
  }

  private getDeviceId(): string {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', id);
    }
    return id;
  }

  // اضافه کردن metadata به رکورد
  enrichRecord<T extends { id: string }>(record: T, isNew = false): T & SyncMetadata {
    const existing = this.getMetadata(record.id);
    
    return {
      ...record,
      version: isNew ? 1 : (existing?.version || 0) + 1,
      lastModified: Date.now(),
      deleted: false,
      deviceId: this.deviceId,
    };
  }

  // علامت‌گذاری به عنوان حذف شده (Tombstone)
  markAsDeleted(id: string): SyncMetadata {
    const existing = this.getMetadata(id);
    const tombstone: SyncMetadata = {
      id,
      version: (existing?.version || 0) + 1,
      lastModified: Date.now(),
      deleted: true,
      deletedAt: Date.now(),
      deviceId: this.deviceId,
    };
    
    this.saveMetadata(tombstone);
    return tombstone;
  }

  // تشخیص کدام نسخه جدیدتر است (Conflict Resolution)
  resolveConflict(local: SyncMetadata, remote: SyncMetadata): 'local' | 'remote' {
    // اگر یکی deleted است، آن برنده است
    if (local.deleted && !remote.deleted) return 'local';
    if (!local.deleted && remote.deleted) return 'remote';
    
    // اگر هر دو deleted هستند، جدیدترین برنده است
    if (local.deleted && remote.deleted) {
      return (local.deletedAt || 0) > (remote.deletedAt || 0) ? 'local' : 'remote';
    }
    
    // در غیر این صورت، بر اساس lastModified
    if (local.lastModified > remote.lastModified) return 'local';
    if (local.lastModified < remote.lastModified) return 'remote';
    
    // اگر timestamp یکسان است، version بالاتر برنده است
    return local.version >= remote.version ? 'local' : 'remote';
  }

  // ذخیره metadata
  private saveMetadata(metadata: SyncMetadata): void {
    const all = this.getAllMetadata();
    all[metadata.id] = metadata;
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(all));
  }

  // دریافت metadata یک رکورد
  getMetadata(id: string): SyncMetadata | null {
    const all = this.getAllMetadata();
    return all[id] || null;
  }

  // دریافت تمام metadata
  private getAllMetadata(): Record<string, SyncMetadata> {
    const data = localStorage.getItem(this.METADATA_KEY);
    return data ? JSON.parse(data) : {};
  }

  // پاکسازی tombstone های قدیمی (بیش از 30 روز)
  cleanupOldTombstones(): number {
    const all = this.getAllMetadata();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    Object.keys(all).forEach(id => {
      const meta = all[id];
      if (meta.deleted && (meta.deletedAt || 0) < thirtyDaysAgo) {
        delete all[id];
        cleaned++;
      }
    });

    if (cleaned > 0) {
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(all));
    }

    return cleaned;
  }

  // بررسی اینکه آیا رکورد حذف شده است
  isDeleted(id: string): boolean {
    const meta = this.getMetadata(id);
    return meta?.deleted || false;
  }
}

export const syncMetadata = new SyncMetadataService();
