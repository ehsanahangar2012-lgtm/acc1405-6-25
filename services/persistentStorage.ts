// Persistent Host Storage Service - High-Performance, Multi-Tenant & Standalone Offline Ready
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
    // حافظه کش در RAM برای دسترسی فوری بدون معطلی و بدون لگ در ویندوز
    private memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
    private inFlightLoads: Map<string, Promise<any>> = new Map();
    private pendingSaves: Map<string, { value: any; timer: any }> = new Map();
    private readonly CACHE_TTL_MS = 6000; // ۶ ثانیه اعتبار کش در حافظه رم
    private readonly WRITE_DEBOUNCE_MS = 400; // ۴۰۰ میلی‌ثانیه دی‌بانس برای تجمیع درخواست‌های ذخیره

    private async request(action: string, data: any): Promise<StorageResponse> {
        // ۱. اگر حالت آفلاین مستقل فعال باشد، نیازی به ارتباط با هاست نیست
        if (workspaceService.isStandaloneOffline()) {
            return { success: false, message: 'حالت آفلاین مستقل فعال است' };
        }

        // ۲. در حالت نصب خام (اندروید، ویندوز و کلاینت‌ها)، تا زمان ورود اطلاعات سرور و توکن، داده‌ها کاملاً محلی هستند
        if (!workspaceService.isRemoteCloudConfigured()) {
            return { success: false, message: 'سامانه در حالت داده محلی مستقل و خام اجرا می‌شود (عدم دسترسی به هاست).' };
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { success: false, message: 'دستگاه آفلاین است' };
        }

        const baseUrl = workspaceService.getBaseUrl();
        if (!baseUrl) {
            return { success: false, message: 'آدرس سرور هاست پیکربندی نشده است' };
        }

        try {
            const storageEndpoint = `${baseUrl}/storage.php`;
            const workspaceHeaders = workspaceService.getHeaders();

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

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
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                return { success: false, message: 'سرور پاسخ نامعتبر ارسال کرد' };
            }
            
            return await response.json();
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : 'خطا در ارتباط با سرور' };
        }
    }

    /**
     * ذخیره داده با سرعت فوق‌العاده بالا:
     * ۱. ذخیره فوری در حافظه رم (0ms)
     * ۲. ذخیره غیرمسدودکننده در IndexedDB محلی
     * ۳. ارسال دی‌بانس شده به سرور در پس‌زمینه بدون مسدودسازی نخ اصلی رابط کاربری
     */
    async saveData(key: string, value: any): Promise<boolean> {
        // ۱. به‌روزرسانی فوری کش حافظه RAM برای خواندن‌های بلادرنگ بعدی
        this.memoryCache.set(key, { data: value, timestamp: Date.now() });

        // ۲. ذخیره پشتیبان ناهمگام در IndexedDB محلی
        if (typeof window !== 'undefined') {
            try {
                idbService.save('backups', { id: `storage_${key}`, data: JSON.stringify(value), updatedAt: Date.now() }).catch(() => {});
            } catch {}
        }

        if (workspaceService.isStandaloneOffline()) {
            return true;
        }

        // ۳. دی‌بانس کردن ارسال به سرور جهت جلوگیری از قفل شدن نخ اصلی در ویندوز
        return new Promise<boolean>((resolve) => {
            const existing = this.pendingSaves.get(key);
            if (existing && existing.timer) {
                clearTimeout(existing.timer);
            }

            const timer = setTimeout(async () => {
                this.pendingSaves.delete(key);
                try {
                    const result = await this.request('save', { key, value: JSON.stringify(value) });
                    resolve(result.success);
                } catch {
                    resolve(false);
                }
            }, this.WRITE_DEBOUNCE_MS);

            this.pendingSaves.set(key, { value, timer });
            
            // بلافاصله تایید محلی برگردان تا UI گیر نکند
            setTimeout(() => resolve(true), 0);
        });
    }

    /**
     * بارگذاری داده با بهینه‌سازی پیشرفته:
     * ۱. خواندن فوری از کش RAM در صورت معتبر بودن
     * ۲. اشتراک‌گذاری درخواست‌های همزمان (Request Deduplication)
     * ۳. بازگشت سریع به کش IndexedDB در صورت آفلاین بودن یا خطای شبکه
     */
    async loadData(key: string, forceRefresh = false): Promise<any> {
        // ۱. بررسی کش RAM
        if (!forceRefresh) {
            const cached = this.memoryCache.get(key);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
                return cached.data;
            }
        }

        // ۲. بررسی درخواست‌های در حال انجام (In-Flight Sharing)
        if (this.inFlightLoads.has(key)) {
            return await this.inFlightLoads.get(key);
        }

        if (workspaceService.isStandaloneOffline()) {
            try {
                const local = await idbService.get('backups', `storage_${key}`);
                const data = local?.data ? JSON.parse(local.data) : null;
                if (data) this.memoryCache.set(key, { data, timestamp: Date.now() });
                return data;
            } catch {
                return null;
            }
        }

        // ۳. اجرای درخواست از سرور با به اشتراک‌گذاری پرامیس
        const loadPromise = (async () => {
            try {
                const result = await this.request('load', { key });
                if (result.success && result.data) {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(result.data);
                    } catch {
                        parsed = null;
                    }
                    if (parsed !== null) {
                        this.memoryCache.set(key, { data: parsed, timestamp: Date.now() });
                        return parsed;
                    }
                }

                // اگر هاست پاسخ نداد یا آفلاین بود، از کش محلی استفاده شود
                const fallback = await idbService.get('backups', `storage_${key}`);
                let fallbackData = null;
                try {
                    fallbackData = fallback?.data ? JSON.parse(fallback.data) : null;
                } catch {
                    fallbackData = null;
                }
                if (fallbackData) {
                    this.memoryCache.set(key, { data: fallbackData, timestamp: Date.now() });
                }
                return fallbackData;
            } catch {
                try {
                    const fallback = await idbService.get('backups', `storage_${key}`);
                    return fallback?.data ? JSON.parse(fallback.data) : null;
                } catch {
                    return null;
                }
            } finally {
                this.inFlightLoads.delete(key);
            }
        })();

        this.inFlightLoads.set(key, loadPromise);
        return await loadPromise;
    }

    /**
     * پاکسازی کش جدول مشخص
     */
    invalidateCache(key?: string) {
        if (key) {
            this.memoryCache.delete(key);
        } else {
            this.memoryCache.clear();
        }
    }

    async saveImage(folder: 'companies' | 'products' | 'checks', filename: string, base64: string): Promise<string | null> {
        if (workspaceService.isStandaloneOffline()) {
            return base64;
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
