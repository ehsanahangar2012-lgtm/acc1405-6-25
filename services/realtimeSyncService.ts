// سرویس همگام‌سازی بلادرنگ یکپارچه و بهینه‌سازی شده
import { autoSyncService } from './autoSyncService';
import { hostDB } from './hostDatabaseService';
import { deletedRecordsRegistry } from './deletedRecordsRegistry';
import { workspaceService } from './workspaceService';

interface SyncState {
    lastPull: number;
    pendingPull: boolean;
}

class RealtimeSyncService {
    private deviceId: string;
    private state: SyncState = { lastPull: 0, pendingPull: false };

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
    }

    private getOrCreateDeviceId(): string {
        let id = localStorage.getItem('ashke-ghalam-device-id') || localStorage.getItem('device_id');
        if (!id) {
            id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            localStorage.setItem('ashke-ghalam-device-id', id);
            localStorage.setItem('device_id', id);
        }
        return id;
    }

    start() {
        if (!workspaceService.isRemoteCloudConfigured()) return;
        // مدیریت مرکزی توسط autoSyncService جهت جلوگیری از رقابت و بارگذاری سنگین
        autoSyncService.start();
    }

    stop() {
        // مدیریت مرکزی
    }

    async pushChange(table: string, action: 'insert' | 'update' | 'delete', id: string, data?: any): Promise<void> {
        if (!navigator.onLine || !workspaceService.isRemoteCloudConfigured()) return;
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
        if (!workspaceService.isRemoteCloudConfigured()) return;
        await autoSyncService.loadFromHost(true);
        await autoSyncService.syncToHost(true);
    }

    getDeviceId(): string {
        return this.deviceId;
    }
}

export const realtimeSyncService = new RealtimeSyncService();
