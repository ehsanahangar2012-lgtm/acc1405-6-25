// Persistent Host Storage Service - Multi-Tenant & Standalone Offline Ready
import { API_CONFIG } from '../config';
import { workspaceService } from './workspaceService';
import { idbService } from './indexedDBService';
import { isDesktopApp } from '../utils';
import { licenseQuotaService } from './licenseQuotaService';

interface StorageResponse {
    success: boolean;
    message?: string;
    data?: any;
    workspace?: string;
}

class PersistentStorage {
    private async request(action: string, data: any): Promise<StorageResponse> {
        // اگر حالت آفلاین مستقل فعال باشد، نیازی به ارتباط با هاست نیست
        if (workspaceService.isStandaloneOffline()) {
            return { success: false, message: 'حالت آفلاین مستقل فعال است' };
        }

        // در نسخه دسکتاپ ویندوز تا زمان فعال‌سازی لایسنس یا اتصال رسمی به هاست، ارتباط مسدود و مستقل است
        if (isDesktopApp() && !licenseQuotaService.isFullyLicensedSync() && !workspaceService.getConfig().customServerUrl) {
            return { success: false, message: 'در نسخه دسکتاپ تا فعال‌سازی لایسنس یا مجوز هاست، ارتباط قطع و داده‌ها ایزوله است' };
        }

        try {
            const baseUrl = workspaceService.getBaseUrl();
            const storageEndpoint = `${baseUrl}/storage.php`;
            const workspaceHeaders = workspaceService.getHeaders();

            // اطمینان از عدم استفاده از کش مرورگر برای جلوگیری از رگرسیون داده‌ها بین دستگاه‌ها
            const response = await fetch(storageEndpoint, {
                method: 'POST',
                cache: 'no-store',
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    ...workspaceHeaders
                },
                body: JSON.stringify({
                    action,
                    workspace_id: workspaceService.getWorkspaceId(),
                    ...data
                })
            });
            
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                console.warn('Storage warning: Invalid response type', contentType);
                return { success: false, message: 'سرور پاسخ نامعتبر ارسال کرد' };
            }
            
            return await response.json();
        } catch (error) {
            console.warn('Storage offline fallback active:', error instanceof Error ? error.message : error);
            return { success: false, message: 'خطا در ارتباط با سرور' };
        }
    }

    async saveData(key: string, value: any): Promise<boolean> {
        // ذخیره پشتیبان در IndexedDB محلی
        try {
            await idbService.save('backups', { id: `storage_${key}`, data: JSON.stringify(value), updatedAt: Date.now() });
        } catch {}

        if (workspaceService.isStandaloneOffline()) {
            return true;
        }

        const result = await this.request('save', { key, value: JSON.stringify(value) });
        return result.success;
    }

    async loadData(key: string): Promise<any> {
        if (workspaceService.isStandaloneOffline()) {
            try {
                const local = await idbService.get('backups', `storage_${key}`);
                return local?.data ? JSON.parse(local.data) : null;
            } catch {
                return null;
            }
        }

        const result = await this.request('load', { key });
        if (result.success && result.data) {
            return JSON.parse(result.data || 'null');
        }

        // اگر هاست در دسترس نبود، از کش محلی استفاده شود
        try {
            const fallback = await idbService.get('backups', `storage_${key}`);
            return fallback?.data ? JSON.parse(fallback.data) : null;
        } catch {
            return null;
        }
    }

    async saveImage(folder: 'companies' | 'products' | 'checks', filename: string, base64: string): Promise<string | null> {
        if (workspaceService.isStandaloneOffline()) {
            return base64; // در حالت کاملاً آفلاین، همان base64 محلی ذخیره می‌شود
        }

        const result = await this.request('saveImage', { folder, filename, base64 });
        return result.success ? result.data : null;
    }

    async deleteImage(path: string): Promise<boolean> {
        if (workspaceService.isStandaloneOffline()) {
            return true;
        }

        const result = await this.request('deleteImage', { path });
        return result.success;
    }
}

export const persistentStorage = new PersistentStorage();
