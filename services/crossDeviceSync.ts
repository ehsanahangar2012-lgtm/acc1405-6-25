// Unified Cross-Device Sync Delegator
import { autoSyncService } from './autoSyncService';
import { persistentStorage } from './persistentStorage';

class CrossDeviceSync {
    async startAutoSync() {
        // تفویض به موتور مرکزی جهت جلوگیری از چرخه‌های تکراری و لگ در ویندوز
        autoSyncService.start();
    }

    async pullFromServer() {
        return await autoSyncService.loadFromHost();
    }

    async pushToServer(key: string, data: any) {
        if (typeof navigator === 'undefined' || !navigator.onLine) return false;
        return await persistentStorage.saveData(key, data);
    }

    stopAutoSync() {
        // مدیریت توسط سرویس مرکزی
    }
}

export const crossDeviceSync = new CrossDeviceSync();
