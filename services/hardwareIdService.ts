// Hardware Identifier Service (HWID)
// شناسایی و قفل سخت‌افزاری دستگاه جهت استقلال داده‌های مشتریان، تفکیک لایسنس و اجرای آفلاین
import CryptoJS from 'crypto-js';

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
const MASTER_SIGNING_SALT = 'ASHK_MASTER_HWID_CRYPT_SALT_2026_IR';

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

        // ۲. محاسبه اثرانگشت سخت‌افزاری مرورگر / کلاینت وب (Web HWID Fingerprint)
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
                MASTER_SIGNING_SALT
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
    generateActivationSignature(payload: Omit<ActivationPayload, 'signature'>): string {
        const dataStr = `${payload.licenseKey.trim().toUpperCase()}::${payload.hwid.trim().toUpperCase()}::${payload.workspaceId}::${payload.expireDate}::${payload.isUnlimited ? 'UNLIMITED' : 'LIMITED'}::${MASTER_SIGNING_SALT}`;
        return CryptoJS.HmacSHA256(dataStr, MASTER_SIGNING_SALT).toString().toUpperCase();
    }

    /**
     * بررسی و اعتبارسنجی کد فعال‌سازی آفلاین بدون نیاز به اتصال به اینترنت
     */
    verifyOfflineActivationCode(licenseKey: string, hwid: string, activationCode: string): { valid: boolean; payload?: Partial<ActivationPayload>; error?: string } {
        try {
            if (!activationCode || !licenseKey || !hwid) {
                return { valid: false, error: 'اطلاعات فعال‌سازی ناقص است.' };
            }

            const cleanCode = activationCode.trim();

            // الف) اگر کد فعال‌سازی بصورت JSON رمزگذاری شده با Base64 باشد
            try {
                const decodedStr = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(cleanCode));
                if (decodedStr && decodedStr.includes('signature')) {
                    const parsed: ActivationPayload = JSON.parse(decodedStr);
                    if (parsed.hwid.toUpperCase() !== hwid.toUpperCase()) {
                        return { valid: false, error: 'این لایسنس مختص این رایانه یا دستگاه صادر نشده است (عدم تطابق HWID).' };
                    }
                    if (parsed.licenseKey.toUpperCase() !== licenseKey.toUpperCase()) {
                        return { valid: false, error: 'شماره لایسنس با کد فعال‌سازی تطابق ندارد.' };
                    }
                    
                    const expectedSig = this.generateActivationSignature(parsed);
                    if (parsed.signature !== expectedSig) {
                        return { valid: false, error: 'امضای رمزنگاری شده لایسنس نامعتبر یا دستکاری شده است.' };
                    }

                    // بررسی تاریخ انقضا
                    if (!parsed.isUnlimited && parsed.expireDate) {
                        const today = new Date().toISOString().split('T')[0];
                        if (today > parsed.expireDate) {
                            return { valid: false, error: `مهلت لایسنس در تاریخ ${parsed.expireDate} به پایان رسیده است.` };
                        }
                    }

                    return { valid: true, payload: parsed };
                }
            } catch {}

            // ب) الگوریتم اعتبارسنجی کد فعال‌سازی هش سریع (Fast Hash Code e.g. ACT-XXXX-XXXX-XXXX)
            const cleanKey = licenseKey.trim().toUpperCase();
            const cleanHwid = hwid.trim().toUpperCase();
            
            // تولید امضاهای مجاز برای بازه‌های استاندارد (یک‌ساله، ۵ ساله، نامحدود)
            const checkUnlimited = CryptoJS.HmacSHA256(`${cleanKey}::${cleanHwid}::default::9999-12-30::UNLIMITED::${MASTER_SIGNING_SALT}`, MASTER_SIGNING_SALT).toString().toUpperCase();
            const checkOneYear = CryptoJS.HmacSHA256(`${cleanKey}::${cleanHwid}::default::${new Date().getFullYear() + 1}-12-30::LIMITED::${MASTER_SIGNING_SALT}`, MASTER_SIGNING_SALT).toString().toUpperCase();
            const checkStandard = CryptoJS.SHA256(`${cleanKey}-${cleanHwid}-${MASTER_SIGNING_SALT}`).toString().toUpperCase();

            const codeNorm = cleanCode.replace(/[^A-F0-9]/gi, '').toUpperCase();
            
            if (codeNorm.startsWith(checkUnlimited.substring(0, 16)) || 
                codeNorm.startsWith(checkOneYear.substring(0, 16)) || 
                codeNorm.startsWith(checkStandard.substring(0, 16)) ||
                cleanCode.toUpperCase() === `ACT-${checkStandard.substring(0, 4)}-${checkStandard.substring(4, 8)}-${checkStandard.substring(8, 12)}`) {
                return {
                    valid: true,
                    payload: {
                        licenseKey: cleanKey,
                        hwid: cleanHwid,
                        workspaceId: 'default',
                        companyName: 'کاربر مجاز اشک قلم',
                        expireDate: '1410-12-29',
                        isUnlimited: true,
                        maxUsers: 20,
                        features: ['ALL_MODULES', 'OFFLINE_STORAGE', 'UNLIMITED_INVOICES', 'SCOPED_DB']
                    }
                };
            }

            return { valid: false, error: 'کد فعال‌سازی وارد شده صحیح نمی‌باشد.' };
        } catch (e: any) {
            return { valid: false, error: e.message || 'خطا در بررسی لایسنس' };
        }
    }
}

export const hardwareIdService = new HardwareIdService();
