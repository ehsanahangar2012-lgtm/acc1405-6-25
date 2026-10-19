// Hardware Identifier Service (HWID)
// شناسایی و قفل سخت‌افزاری دستگاه جهت استقلال داده‌های مشتریان، تفکیک لایسنس و اجرای آفلاین
import CryptoJS from 'crypto-js';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AshkDeviceIdentifierPlugin {
    getId(): Promise<{ id: string }>;
}
const ashkDeviceIdentifier = registerPlugin<AshkDeviceIdentifierPlugin>('AshkDeviceIdentifier');

export interface DeviceInfo {
    hwid: string;
    platform: string;
    arch?: string;
    hostname?: string;
    isDesktop: boolean;
    screenResolution?: string;
    generatedAt: string;
}

export interface ActivationPayload {
    licenseKey: string;
    hwid: string;
    workspaceId: string;
    companyName: string;
    expireDate: string; // YYYY-MM-DD
    isUnlimited: boolean;
    maxUsers: number;
    features: string[];
    activatedAt: string;
    signature: string;
}

const HWID_CACHE_KEY = 'ashk_device_hwid_v1';
// Do not embed a signing secret in distributed clients. Commercial licenses are server-verified.

class HardwareIdService {
    private cachedHwid: string | null = null;
    private cachedInfo: DeviceInfo | null = null;

    /**
     * دریافت یا محاسبه شناسه سخت‌افزاری پایدار و یکتای دستگاه
     */
    async getHardwareId(): Promise<string> {
        if (this.cachedHwid) return this.cachedHwid;

        // ۱. بررسی محیط دسکتاپ (Electron)
        if (typeof window !== 'undefined') {
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                try {
                    const result = await desktopApi.invoke('get-hardware-id');
                    if (result && result.hwid) {
                        this.cachedHwid = result.hwid;
                        this.cachedInfo = {
                            hwid: result.hwid,
                            platform: result.platform || 'Desktop',
                            arch: result.arch || 'x64',
                            hostname: result.hostname || 'DESKTOP-NODE',
                            isDesktop: true,
                            generatedAt: new Date().toISOString()
                        };
                        return this.cachedHwid;
                    }
                } catch (e) {
                    console.warn('Electron HWID invocation fallback:', e);
                }
            }
        }

        // Android native builds use ANDROID_ID via a local Capacitor plugin instead of a copyable localStorage fingerprint.
        if (typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            if (!Capacitor.isPluginAvailable('AshkDeviceIdentifier')) {
                throw new Error('افزونه شناسه امن دستگاه اندروید در دسترس نیست؛ فعال‌سازی تجاری متوقف شد.');
            }
            const result = await ashkDeviceIdentifier.getId();
            const nativeHwid = String(result?.id || '').trim().toUpperCase();
            if (!/^ASHK-ANDROID-[A-F0-9]{64}$/.test(nativeHwid)) {
                throw new Error('شناسه امن دستگاه اندروید معتبر نیست؛ فعال‌سازی متوقف شد.');
            }
            this.cachedHwid = nativeHwid;
            this.cachedInfo = {
                hwid: nativeHwid,
                platform: 'Android',
                isDesktop: false,
                generatedAt: new Date().toISOString()
            };
            return nativeHwid;
        }

        // ۲. Web/PWA fallback fingerprint. It is not used by the native Android or Electron clients.
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const storedHwid = localStorage.getItem(HWID_CACHE_KEY);
                if (storedHwid && storedHwid.startsWith('ASHK-HWID-')) {
                    this.cachedHwid = storedHwid;
                    return this.cachedHwid;
                }
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let canvasSignature = 'CANVAS_STUB';
            if (ctx) {
                canvas.width = 200;
                canvas.height = 40;
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#0d9488';
                ctx.fillRect(0, 0, 140, 40);
                ctx.fillStyle = '#ffffff';
                ctx.fillText('ASHK-ERP-FINGERPRINT', 10, 10);
                canvasSignature = canvas.toDataURL().slice(-40);
            }

            const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
            const scr = typeof screen !== 'undefined' ? screen : ({} as any);
            
            const rawComponents = [
                nav.userAgent || 'UNKNOWN_UA',
                nav.hardwareConcurrency || 4,
                (nav as any).deviceMemory || 8,
                scr.width || 1920,
                scr.height || 1080,
                scr.colorDepth || 24,
                Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran',
                canvasSignature,
                'ASHK-HWID-SCHEMA-V2'
            ].join('###');

            const hash = CryptoJS.SHA256(rawComponents).toString().toUpperCase();
            const formatted = `ASHK-HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(HWID_CACHE_KEY, formatted);
            }

            this.cachedHwid = formatted;
            this.cachedInfo = {
                hwid: formatted,
                platform: nav.platform || 'Browser',
                isDesktop: false,
                screenResolution: `${scr.width || 1920}x${scr.height || 1080}`,
                generatedAt: new Date().toISOString()
            };

            return this.cachedHwid;
        } catch {
            const fallback = 'ASHK-HWID-STANDALONE-DEFAULT-2026';
            this.cachedHwid = fallback;
            return fallback;
        }
    }

    /**
     * دریافت مشخصات کامل دستگاه
     */
    async getDeviceInfo(): Promise<DeviceInfo> {
        const hwid = await this.getHardwareId();
        if (this.cachedInfo) return this.cachedInfo;

        return {
            hwid,
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
            isDesktop: typeof window !== 'undefined' && !!(window as any).electronDesktopAPI,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * تولید کد امضای فعال‌سازی آفلاین برای یک دستگاه و لایسنس مشخص
     */
    generateActivationSignature(_payload: Omit<ActivationPayload, 'signature'>): string {
        // Security boundary: a key kept in a web/desktop/mobile client is not a secret.
        // Offline signatures must be produced by the server's private key, never here.
        return '';
    }

    /**
     * بررسی و اعتبارسنجی کد فعال‌سازی آفلاین بدون نیاز به اتصال به اینترنت
     */
    verifyOfflineActivationCode(_licenseKey: string, _hwid: string, _activationCode: string): { valid: boolean; payload?: Partial<ActivationPayload>; error?: string } {
        // Legacy ACT codes used a client-embedded HMAC key and could be forged.
        // Fail closed until a server-issued asymmetric signature flow is deployed.
        return {
            valid: false,
            error: 'فعال‌سازی آفلاین قدیمی از نظر امنیتی معتبر نیست. برای فعال‌سازی تجاری، از اتصال آنلاین به سرور مادر استفاده کنید.'
        };
    }
}

export const hardwareIdService = new HardwareIdService();
