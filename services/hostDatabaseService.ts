// سرویس دیتابیس هاست - بهینه شده برای همزمانی چند سیستم
import { API_CONFIG } from '../config';
import { syncQueue } from './syncQueueService';
import { persistentStorage } from './persistentStorage';
import { workspaceService } from './workspaceService';

interface SyncMetadata {
    lastSync: number;
    version: number;
}

class HostDatabaseService {
    private syncMetadata: Map<string, SyncMetadata> = new Map();

    constructor() {
        this.loadMetadata();
    }

    private loadMetadata() {
        const stored = localStorage.getItem('host-sync-metadata');
        if (stored) {
            const data = JSON.parse(stored);
            this.syncMetadata = new Map(Object.entries(data));
        }
    }

    private saveMetadata() {
        const data = Object.fromEntries(this.syncMetadata);
        localStorage.setItem('host-sync-metadata', JSON.stringify(data));
    }

    // ذخیره کل جدول به صورت یکپارچه و اتمیک
    async saveTable(table: string, dataArray: any[]): Promise<boolean> {
        if (!workspaceService.isRemoteCloudConfigured()) {
            return true;
        }
        try {
            const ok = await persistentStorage.saveData(table, dataArray);
            if (ok) {
                this.syncMetadata.set(table, {
                    lastSync: Date.now(),
                    version: Date.now()
                });
                this.saveMetadata();
            }
            return ok;
        } catch (e) {
            console.warn(`saveTable failed for ${table}:`, e);
            return false;
        }
    }

    // ذخیره داده با version control به صورت کاملاً ناهمگام و بدون لگ در ویندوز
    async save(table: string, data: any, skipQueue = false) {
        if (!workspaceService.isRemoteCloudConfigured()) {
            return { success: true, localOnly: true, version: Date.now() };
        }
        // ثبت شناسه و تاریخ آخرین تغییر برای سینک اتوماتیک
        const recordToSave = {
            ...data,
            updatedAt: data.updatedAt || new Date().toISOString(),
            synced_at: Date.now()
        };

        this.syncMetadata.set(`${table}:${data.id}`, {
            lastSync: Date.now(),
            version: Date.now()
        });
        this.saveMetadata();

        // ثبت در صف سینک هوشمند به صورت کاملاً غیرمسدودکننده
        if (!skipQueue) {
            syncQueue.enqueue('save', table, recordToSave, 'hostDB');
        }

        return { success: true, version: Date.now() };
    }

    // دریافت داده با incremental sync و timeout
    async get(table: string, id?: string) {
        if (!workspaceService.isRemoteCloudConfigured()) {
            return null;
        }
        // ۱. ابتدا از طریق persistentStorage (هاست بدون نیاز به توکن مسدودکننده)
        try {
            const cloudData = await persistentStorage.loadData(table);
            if (cloudData && Array.isArray(cloudData)) {
                this.syncMetadata.set(table, {
                    lastSync: Date.now(),
                    version: Date.now()
                });
                this.saveMetadata();

                if (id) {
                    const item = cloudData.find((i: any) => (i && i.id === id) || (i.data && i.data.id === id));
                    return item ? (item.data || item) : null;
                }
                return cloudData.map((i: any) => (i && i.data ? i.data : i));
            }
        } catch (cloudErr) {
            console.warn('PersistentStorage load warning:', cloudErr);
        }

        // The authenticated workspace storage API is the only cloud data source.
        // Never fall back to the legacy global API with a token embedded in the client.
        return null;
    }

    // بروزرسانی داده
    async update(table: string, id: string, data: any) {
        return this.save(table, { id, ...data });
    }

    // حذف داده
    async delete(table: string, id: string) {
        let cloudSaveSucceeded = false;
        try {
            const currentList = await persistentStorage.loadData(table);
            if (Array.isArray(currentList)) {
                const filtered = currentList.filter(item => item && item.id !== id && (!item.data || item.data.id !== id));
                cloudSaveSucceeded = await persistentStorage.saveData(table, filtered);
            }
        } catch (e) {
            console.warn('PersistentStorage delete warning:', e);
        }

        this.syncMetadata.delete(`${table}:${id}`);
        this.saveMetadata();
        if (!workspaceService.isRemoteCloudConfigured()) {
            return { success: true, localOnly: true };
        }
        return cloudSaveSucceeded
            ? { success: true }
            : { success: false, message: 'حذف ابری از مسیر احرازشده تأیید نشد.' };
    }

    // پردازش صف - اکنون از syncQueue مرکزی استفاده می‌کند
    async processQueue() {
        return syncQueue.processQueue();
    }

    // همگامسازی کامل از هاست (incremental)
    async syncFromHost(table: string) {
        try {
            const data = await this.get(table);
            return Array.isArray(data) ? data.map(item => item.data || item) : [];
        } catch (error) {
            return [];
        }
    }

    // بررسی وضعیت اتصال
    async checkConnection(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(API_CONFIG.HEALTH_API, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache',
                headers: { 
                    'Cache-Control': 'no-cache'
                }
            });
            
            clearTimeout(timeout);
            return response.ok;
        } catch {
            return false;
        }
    }

    // پاکسازی metadata قدیمی
    cleanupMetadata(daysOld: number = 30) {
        const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        for (const [key, value] of this.syncMetadata.entries()) {
            if (value.lastSync < cutoff) {
                this.syncMetadata.delete(key);
            }
        }
        this.saveMetadata();
    }

    // حذف داده از هاست (برای ادمین)
    async deleteFromHost(table: string, id: string) {
        return this.delete(table, id);
    }
}

export const hostDB = new HostDatabaseService();
