// Persistent Host Storage Service - High-Performance, Multi-Tenant & Standalone Offline Ready
import { workspaceService } from './workspaceService';
import { idbService } from './indexedDBService';
import { licenseQuotaService } from './licenseQuotaService';
import {
  hasNativeBackupStorage,
  getNativeBackupValue,
  setNativeBackupValue
} from './nativeBackupStorage';
import {
  createPersistentCacheRecord,
  parsePersistentCacheRecord,
  persistentCacheNativeKey
} from './persistentCacheRecord';

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
    private pendingSaves: Map<string, { value: any; timer: any; resolvers: Array<(success: boolean) => void> }> = new Map();
    private inFlightSaves: Set<string> = new Set();
    private readonly CACHE_TTL_MS = 6000; // ۶ ثانیه اعتبار کش در حافظه رم
    private readonly WRITE_DEBOUNCE_MS = 400; // ۴۰۰ میلی‌ثانیه دی‌بانس برای تجمیع درخواست‌های ذخیره
    private nativeCacheMigrationPromise: Promise<void> | null = null;
    private readonly NATIVE_CACHE_MIGRATION_KEY = 'persistent-storage:migration:v1';

    private async ensureNativeCacheMigration(): Promise<void> {
        if (!hasNativeBackupStorage()) return;
        if (this.nativeCacheMigrationPromise) return this.nativeCacheMigrationPromise;

        this.nativeCacheMigrationPromise = (async () => {
            const marker = await getNativeBackupValue(this.NATIVE_CACHE_MIGRATION_KEY);
            if (marker === 'complete') return;

            // Move every old storage_* mirror to native encrypted storage. Keep each old
            // record until the encrypted value has been read back and verified.
            const legacyRecords = await idbService.getAll('backups');
            for (const legacy of legacyRecords || []) {
                if (!legacy || typeof legacy.id !== 'string' || !legacy.id.startsWith('storage_')) continue;
                const key = legacy.id.slice('storage_'.length);
                if (!key || typeof legacy.data !== 'string') {
                    throw new Error('رکورد قدیمی کش محلی ساختار معتبری ندارد؛ نسخهٔ اصلی حفظ شد.');
                }

                const nativeKey = persistentCacheNativeKey(key);
                const existingText = await getNativeBackupValue(nativeKey);
                let preferredRecord = null as ReturnType<typeof createPersistentCacheRecord> | null;
                if (existingText !== null) {
                    const existing = parsePersistentCacheRecord(existingText, key);
                    const legacyUpdatedAt = Number.isFinite(legacy.updatedAt) ? legacy.updatedAt : 0;
                    preferredRecord = legacyUpdatedAt > existing.record.updatedAt
                        ? createPersistentCacheRecord(key, legacy.data, legacyUpdatedAt || Date.now())
                        : existing.record;
                } else {
                    const legacyUpdatedAt = Number.isFinite(legacy.updatedAt) ? legacy.updatedAt : Date.now();
                    preferredRecord = createPersistentCacheRecord(key, legacy.data, legacyUpdatedAt);
                }

                if (existingText === null || preferredRecord.data !== parsePersistentCacheRecord(existingText, key).record.data) {
                    await setNativeBackupValue(nativeKey, JSON.stringify(preferredRecord));
                }

                const readBack = await getNativeBackupValue(nativeKey);
                if (readBack === null) throw new Error('تأیید خواندن کش محلی رمزگذاری‌شده ناموفق بود.');
                const verified = parsePersistentCacheRecord(readBack, key);
                if (!verified.integrityVerified || verified.record.data !== preferredRecord.data) {
                    throw new Error('تأیید صحت مهاجرت کش محلی ناموفق بود؛ نسخهٔ اصلی حفظ شد.');
                }
                await idbService.delete('backups', legacy.id);
            }

            await setNativeBackupValue(this.NATIVE_CACHE_MIGRATION_KEY, 'complete');
        })().catch(error => {
            // Allow a future retry; never mark migration complete after a partial failure.
            this.nativeCacheMigrationPromise = null;
            throw error;
        });

        return this.nativeCacheMigrationPromise;
    }

    private async writeLocalSnapshot(key: string, value: any): Promise<void> {
        const serializedData = JSON.stringify(value);
        if (typeof serializedData !== 'string') throw new Error('داده برای ذخیرهٔ کش قابل سریال‌سازی نیست.');
        const record = createPersistentCacheRecord(key, serializedData, Date.now());

        if (hasNativeBackupStorage()) {
            await this.ensureNativeCacheMigration();
            await setNativeBackupValue(persistentCacheNativeKey(key), JSON.stringify(record));
            return;
        }

        // Browser/PWA IndexedDB remains plaintext at rest and is labelled as such in the UI.
        await idbService.save('backups', { id: `storage_${key}`, ...record });
    }

    private async readLocalSnapshot(key: string): Promise<any> {
        if (hasNativeBackupStorage()) {
            await this.ensureNativeCacheMigration();
            const raw = await getNativeBackupValue(persistentCacheNativeKey(key));
            if (raw === null) return null;
            const parsed = parsePersistentCacheRecord(raw, key);
            if (!parsed.integrityVerified) {
                throw new Error('کش محلی بومی فاقد کنترل صحت معتبر است؛ از نسخهٔ اصلی استفاده نشد.');
            }
            return parsed.value;
        }

        const legacy = await idbService.get('backups', `storage_${key}`);
        if (!legacy || typeof legacy.data !== 'string') return null;
        return parsePersistentCacheRecord({ ...legacy, key }, key).value;
    }

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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const storageEndpoint = `${baseUrl}/storage.php`;
            const workspaceHeaders = await workspaceService.getSecureHeaders();

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

            if (!response.ok) {
                return { success: false, message: `پاسخ ناموفق سرور (${response.status})` };
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                return { success: false, message: 'سرور پاسخ نامعتبر ارسال کرد' };
            }

            const result = await response.json() as StorageResponse;
            if (!result || result.success !== true) {
                return {
                    success: false,
                    message: result?.message || 'ذخیره‌سازی روی سرور تأیید نشد'
                };
            }
            return result;
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : 'خطا در ارتباط با سرور' };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * ذخیره داده با سرعت فوق‌العاده بالا:
     * ۱. ذخیره فوری در حافظه رم (0ms)
     * ۲. ذخیره غیرمسدودکننده در IndexedDB محلی
     * ۳. ارسال دی‌بانس شده به سرور در پس‌زمینه بدون مسدودسازی نخ اصلی رابط کاربری
     */
    async saveData(key: string, value: any): Promise<boolean> {
        // RAM is a transient cache; the durable mirror must use native encryption on devices.
        this.memoryCache.set(key, { data: value, timestamp: Date.now() });
        let localSnapshotSaved = false;
        try {
            await this.writeLocalSnapshot(key, value);
            localSnapshotSaved = true;
        } catch (error) {
            // Never downgrade a native write to plaintext IndexedDB/localStorage.
            console.warn('[PersistentStorage] Local snapshot could not be saved securely:', error);
        }

        // Offline mode can claim success only when the local durable write actually succeeded.
        if (workspaceService.isStandaloneOffline()) {
            return localSnapshotSaved;
        }

        // All calls for one key share the result of the latest server-bound value.
        // Success is returned only after the server response, not after queuing.
        return new Promise<boolean>((resolve) => {
            const existing = this.pendingSaves.get(key);
            if (existing) {
                clearTimeout(existing.timer);
                existing.value = value;
                existing.resolvers.push(resolve);
                existing.timer = setTimeout(() => {
                    void this.flushPendingSave(key, existing);
                }, this.WRITE_DEBOUNCE_MS);
                return;
            }

            const pending = {
                value,
                timer: undefined as any,
                resolvers: [resolve]
            };
            pending.timer = setTimeout(() => {
                void this.flushPendingSave(key, pending);
            }, this.WRITE_DEBOUNCE_MS);
            this.pendingSaves.set(key, pending);
        });
    }

    private async flushPendingSave(
        key: string,
        pending: { value: any; timer: any; resolvers: Array<(success: boolean) => void> }
    ): Promise<void> {
        if (this.pendingSaves.get(key) !== pending) return;
        // Serialize writes for each key so a slower old request cannot overwrite a newer value.
        if (this.inFlightSaves.has(key)) return;

        this.pendingSaves.delete(key);
        this.inFlightSaves.add(key);

        let success = false;
        try {
            const result = await this.request('save', {
                key,
                value: JSON.stringify(pending.value)
            });
            success = result.success === true;
        } catch {
            success = false;
        } finally {
            this.inFlightSaves.delete(key);
            pending.resolvers.forEach(resolve => resolve(success));

            // If another value arrived while the previous request was in flight,
            // send that newest value next, after the earlier request has completed.
            const nextPending = this.pendingSaves.get(key);
            if (nextPending) {
                clearTimeout(nextPending.timer);
                void this.flushPendingSave(key, nextPending);
            }
        }
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
                const data = await this.readLocalSnapshot(key);
                if (data !== null) this.memoryCache.set(key, { data, timestamp: Date.now() });
                return data;
            } catch (error) {
                console.error('[PersistentStorage] Secure local read failed:', error);
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

                // If the host fails, use only the appropriate platform-local cache.
                // Native apps migrate legacy plaintext mirrors before reading them.
                const fallbackData = await this.readLocalSnapshot(key);
                if (fallbackData !== null) {
                    this.memoryCache.set(key, { data: fallbackData, timestamp: Date.now() });
                }
                return fallbackData;
            } catch (error) {
                console.warn('[PersistentStorage] Remote read and local fallback failed:', error);
                try {
                    return await this.readLocalSnapshot(key);
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
