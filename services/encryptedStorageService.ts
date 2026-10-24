// Encrypted Local Storage Utility & App Manifest Manager
// مخزن ذخیره‌سازی محلی رمزنگاری‌شده برای توکن‌های نشست، تنظیمات لایسنس و مانیفست اختصاصی دستگاه
import CryptoJS from 'crypto-js';
import { hardwareIdService } from './hardwareIdService';

export interface AppManifest {
    instanceId: string;
    hardwareId: string;
    licenseKey: string;
    workspaceId: string;
    workspaceToken?: string;
    companyScope: string;
    companyName: string;
    expireDate: string;
    isUnlimited: boolean;
    status: 'ACTIVATED' | 'TRIAL' | 'EXPIRED' | 'UNREGISTERED';
    features: string[];
    activationDate: string;
    lastValidatedAt: string;
    customApiBaseUrl?: string;
    standaloneOfflineMode?: boolean;
    storagePrefix: string;
    signature: string;
}

const MANIFEST_KEY = '__ASHK_ENCRYPTED_MANIFEST__';
const SESSION_PREFIX = '__ASHK_SECURE_VAULT__::';
const FALLBACK_ENC_SECRET = 'ASHK_SECURE_STORAGE_MASTER_KEY_2026';

class EncryptedStorageService {
    private encryptionKey: string | null = null;
    private manifestCache: AppManifest | null = null;

    /**
     * استخراج کلید رمزنگاری دستگاه‌محور (تلفیق شناسه سخت‌افزاری و سالت محرمانه)
     */
    private async getDerivedKey(): Promise<string> {
        if (this.encryptionKey) return this.encryptionKey;
        try {
            const hwid = await hardwareIdService.getHardwareId();
            this.encryptionKey = CryptoJS.SHA256(`VAULT_KEY::${hwid}::${FALLBACK_ENC_SECRET}`).toString();
            return this.encryptionKey;
        } catch {
            this.encryptionKey = FALLBACK_ENC_SECRET;
            return this.encryptionKey;
        }
    }

    /**
     * رمزنگاری رشته داده
     */
    private async encryptData(plaintext: string): Promise<string> {
        const key = await this.getDerivedKey();
        return CryptoJS.AES.encrypt(plaintext, key).toString();
    }

    /**
     * رمزگشایی رشته رمزنگاری شده
     */
    private async decryptData(ciphertext: string): Promise<string | null> {
        try {
            const key = await this.getDerivedKey();
            const bytes = CryptoJS.AES.decrypt(ciphertext, key);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            return decrypted || null;
        } catch {
            return null;
        }
    }

    /**
     * ذخیره امن کلید و مقدار
     */
    async setItem(key: string, value: any): Promise<void> {
        const strVal = typeof value === 'string' ? value : JSON.stringify(value);
        const encrypted = await this.encryptData(strVal);

        // ۱. اگر در محیط دسکتاپ هستیم
        if (typeof window !== 'undefined') {
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                try {
                    await desktopApi.invoke('secure-store-set', {
                        key: `${SESSION_PREFIX}${key}`,
                        value: encrypted
                    });
                } catch (e) {
                    console.warn('Desktop secure storage save error:', e);
                }
            }
        }

        // ۲. ذخیره در حافظه محلی کلاینت با کلید رمزگذاری شده
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem(`${SESSION_PREFIX}${key}`, encrypted);
            } catch (err) {
                console.warn('LocalStorage secure set error:', err);
            }
        }
    }

    /**
     * خواندن امن مقدار ذخیره شده
     */
    async getItem<T = any>(key: string, defaultValue?: T): Promise<T | null> {
        let encryptedValue: string | null = null;

        // ۱. ابتدا تلاش از محیط دسکتاپ
        if (typeof window !== 'undefined') {
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                try {
                    const res = await desktopApi.invoke('secure-store-get', `${SESSION_PREFIX}${key}`);
                    if (res && typeof res === 'string') {
                        encryptedValue = res;
                    }
                } catch {}
            }
        }

        // ۲. بازگشت به LocalStorage
        if (!encryptedValue && typeof window !== 'undefined' && window.localStorage) {
            encryptedValue = localStorage.getItem(`${SESSION_PREFIX}${key}`);
        }

        if (!encryptedValue) {
            return defaultValue !== undefined ? defaultValue : null;
        }

        const decrypted = await this.decryptData(encryptedValue);
        if (!decrypted) return defaultValue !== undefined ? defaultValue : null;

        try {
            return JSON.parse(decrypted) as T;
        } catch {
            return decrypted as unknown as T;
        }
    }

    /**
     * حذف یک کلید از مخزن امن
     */
    async removeItem(key: string): Promise<void> {
        if (typeof window !== 'undefined') {
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                try {
                    await desktopApi.invoke('secure-store-remove', `${SESSION_PREFIX}${key}`);
                } catch {}
            }
            if (window.localStorage) {
                localStorage.removeItem(`${SESSION_PREFIX}${key}`);
            }
        }
    }

    /**
     * ذخیره مانیفست فعال‌سازی برنامه (AppManifest)
     */
    async saveAppManifest(manifest: AppManifest): Promise<void> {
        this.manifestCache = manifest;
        await this.setItem(MANIFEST_KEY, manifest);

        // همچنین در فضای کاری و اسکوپ دیتابیس اعمال شود
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('ashk_active_manifest_scope', manifest.storagePrefix);
                localStorage.setItem('ashk_active_license_key', manifest.licenseKey);
            }
        } catch {}
    }

    /**
     * خواندن مانیفست فعال‌سازی برنامه
     */
    async getAppManifest(): Promise<AppManifest | null> {
        if (this.manifestCache) return this.manifestCache;
        const manifest = await this.getItem<AppManifest>(MANIFEST_KEY);
        if (manifest) {
            this.manifestCache = manifest;
            return manifest;
        }
        return null;
    }

    /**
     * ایجاد یک مانیفست استاندارد
     */
    createManifestObject(params: Partial<AppManifest> & { licenseKey: string; hardwareId: string }): AppManifest {
        const instanceId = `INST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const wsId = params.workspaceId || 'default';
        const scope = params.companyScope || `cmp_${wsId}`;
        const today = new Date().toISOString();

        const signature = CryptoJS.SHA256(`${params.licenseKey}::${params.hardwareId}::${wsId}::${params.expireDate || '9999-12-30'}::${FALLBACK_ENC_SECRET}`).toString();

        return {
            instanceId,
            hardwareId: params.hardwareId,
            licenseKey: params.licenseKey,
            workspaceId: wsId,
            workspaceToken: params.workspaceToken || '',
            companyScope: scope,
            companyName: params.companyName || 'مشتری مجاز سامانه اشک قلم',
            expireDate: params.expireDate || '1410-12-29',
            isUnlimited: params.isUnlimited ?? true,
            status: 'ACTIVATED',
            features: params.features || ['ALL_MODULES', 'SCOPED_DB', 'OFFLINE_STORAGE', 'UNLIMITED_INVOICES'],
            activationDate: today,
            lastValidatedAt: today,
            customApiBaseUrl: params.customApiBaseUrl || '',
            standaloneOfflineMode: params.standaloneOfflineMode || false,
            storagePrefix: `ashk_scope_${wsId}_${params.licenseKey.slice(-6)}`,
            signature
        };
    }
}

export const encryptedStorageService = new EncryptedStorageService();
