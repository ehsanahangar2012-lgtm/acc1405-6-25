// License Generator & Validation Service (سرویس صدور و اعتبارسنجی لایسنس‌های نرم‌افزار)
// سازگار با الگوریتم رمزنگاری HMAC-SHA256 و HWID دستگاه
import CryptoJS from 'crypto-js';
import { hardwareIdService } from './hardwareIdService';
import { encryptedStorageService, AppManifest } from './encryptedStorageService';
import { workspaceService } from './workspaceService';

export type LicensePlan = 'TRIAL' | 'HEMAYAT' | 'BRONZE' | 'SILVER' | 'GOLD' | 'ENTERPRISE';

export interface LicenseRecord {
    id: string;
    licenseKey: string;
    activationCode: string;
    clientName: string;
    clientPhone: string;
    hwid: string;
    plan: LicensePlan;
    maxCustomers: number; // 20 for trial, 100 for hemayat, 50, 200, -1 for unlimited
    maxDocuments: number; // 200 for trial, 600 for hemayat, 500, 2000, -1 for unlimited
    isUnlimited: boolean;
    issueDate: string;
    expireDate: string; // YYYY-MM-DD or 9999-12-31
    pricePaid?: number; // تومان
    notes?: string;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

const MASTER_SIGNING_SALT = 'ASHK_MASTER_HWID_CRYPT_SALT_2026_IR';
const LICENSES_STORAGE_KEY = 'ashk_issued_licenses_registry_v1';

export const PLAN_CONFIGS: Record<LicensePlan, { title: string; maxCustomers: number; maxDocuments: number; isUnlimited: boolean; validityDays: number; defaultPrice: number; badgeColor: string }> = {
    TRIAL: {
        title: 'نسخه پایه مستقل (رایگان آزمایشی)',
        maxCustomers: 30,
        maxDocuments: 100,
        isUnlimited: false,
        validityDays: 3650,
        defaultPrice: 0,
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    },
    HEMAYAT: {
        title: 'نسخه حامی (رایگان دائمی - ویژه کسب‌وکارهای نوپا و خرد)',
        maxCustomers: 70,
        maxDocuments: 450,
        isUnlimited: false,
        validityDays: 3650, // ۱۰ سال / مادام‌العمر بدون استرس انقضا
        defaultPrice: 0,
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    BRONZE: {
        title: 'پلن برنزی (کسب‌وکار نوپا)',
        maxCustomers: 50,
        maxDocuments: 500,
        isUnlimited: false,
        validityDays: 365,
        defaultPrice: 1500000,
        badgeColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    },
    SILVER: {
        title: 'پلن نقره‌ای (کسب‌وکار در حال رشد)',
        maxCustomers: 200,
        maxDocuments: 2000,
        isUnlimited: false,
        validityDays: 365,
        defaultPrice: 3500000,
        badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    },
    GOLD: {
        title: 'پلن طلایی مادام‌العمر (نامحدود کامل)',
        maxCustomers: -1, // نامحدود
        maxDocuments: -1, // نامحدود
        isUnlimited: true,
        validityDays: 3650, // ۱۰ سال / دائمی
        defaultPrice: 6500000,
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    ENTERPRISE: {
        title: 'پلن سازمانی و شبکه (چندکاربره + هاست اختصاصی)',
        maxCustomers: -1,
        maxDocuments: -1,
        isUnlimited: true,
        validityDays: 730,
        defaultPrice: 12000000,
        badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    }
};

class LicenseGeneratorService {
    /**
     * تولید کلید لایسنس رندوم با فرمت استاندارد: ASHK-XXXX-XXXX-XXXX
     */
    generateLicenseKey(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const secureSegment = (length: number) => {
            const bytes = new Uint8Array(length);
            const secureCrypto = globalThis.crypto;
            if (!secureCrypto?.getRandomValues) {
                throw new Error('این مرورگر مولد اعداد تصادفی امن را پشتیبانی نمی‌کند.');
            }
            secureCrypto.getRandomValues(bytes);
            return Array.from(bytes, byte => chars[byte % chars.length]).join('');
        };
        return `ASHK-${secureSegment(4)}-${secureSegment(4)}-${secureSegment(4)}`;
    }

    /**
     * تولید کد فعال‌سازی آفلاین امضاشده بر اساس HWID دستگاه، شماره لایسنس و مشخصات پلن
     */
    generateActivationCode(licenseKey: string, hwid: string, plan: LicensePlan, expireDate: string): string {
        const cleanKey = licenseKey.trim().toUpperCase();
        const cleanHwid = hwid.trim().toUpperCase();
        const planConfig = PLAN_CONFIGS[plan];
        const isUnlimited = planConfig.isUnlimited;

        // ۱. ساخت پی‌لود معتبر
        const payload = {
            licenseKey: cleanKey,
            hwid: cleanHwid,
            workspaceId: 'default',
            companyName: 'کاربر لایسنس‌شده اشک قلم',
            expireDate: expireDate || (isUnlimited ? '1410-12-29' : '1405-12-29'),
            isUnlimited,
            maxUsers: isUnlimited ? 99 : 5,
            maxCustomers: planConfig.maxCustomers,
            maxDocuments: planConfig.maxDocuments,
            features: isUnlimited ? ['ALL_MODULES', 'UNLIMITED_INVOICES', 'SCOPED_DB', 'OFFLINE_STORAGE'] : ['BASIC_MODULES'],
            activatedAt: new Date().toISOString()
        };

        const signature = hardwareIdService.generateActivationSignature(payload);
        const signedPayload = { ...payload, signature };

        // تبدیل به رشته بیس۶۴ رمزشده
        const jsonStr = JSON.stringify(signedPayload);
        const base64Code = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(jsonStr));

        // همچنین کد هش کوتاه عددی-حروفی استاندارد: ACT-XXXX-XXXX-XXXX
        const checkStandard = CryptoJS.SHA256(`${cleanKey}-${cleanHwid}-${MASTER_SIGNING_SALT}`).toString().toUpperCase();
        const fastCode = `ACT-${checkStandard.substring(0, 4)}-${checkStandard.substring(4, 8)}-${checkStandard.substring(8, 12)}`;

        // برگرداندن کد کوتاه که برای کاربر بسیار آسان است، یا بیس۶۴ کامل در صورت نیاز
        return fastCode;
    }

    /**
     * ذخیره لایسنس جدید در دفتر ثبت لایسنس‌های محلی
     */
    saveLicenseRecord(record: LicenseRecord): void {
        const existing = this.getAllLicenses();
        const updated = [record, ...existing.filter(l => l.id !== record.id)];
        if (typeof window !== 'undefined') {
            localStorage.setItem(LICENSES_STORAGE_KEY, JSON.stringify(updated));
        }
    }

    /**
     * دریافت تمام لایسنس‌های صادر شده
     */
    getAllLicenses(): LicenseRecord[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(LICENSES_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    /**
     * حذف یا ابطال یک لایسنس
     */
    revokeLicense(id: string): void {
        const all = this.getAllLicenses();
        const updated = all.map(l => l.id === id ? { ...l, status: 'REVOKED' as const } : l);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LICENSES_STORAGE_KEY, JSON.stringify(updated));
        }
    }

    /**
     * فعال‌سازی و ثبت لایسنس روی دستگاه جاری
     */
    async applyLicenseToCurrentDevice(licenseKey: string, activationCode: string, clientName?: string): Promise<{ success: boolean; message: string; manifest?: AppManifest }> {
        try {
            const hwid = await hardwareIdService.getHardwareId();
            const verification = hardwareIdService.verifyOfflineActivationCode(licenseKey, hwid, activationCode);

            if (!verification.valid || !verification.payload) {
                return {
                    success: false,
                    message: verification.error || 'کد فعال‌سازی یا لایسنس با این دستگاه مطابقت ندارد.'
                };
            }

            const p = verification.payload;
            const newManifest = encryptedStorageService.createManifestObject({
                licenseKey: licenseKey.trim().toUpperCase(),
                hardwareId: hwid,
                workspaceId: p.workspaceId || 'default',
                companyName: clientName || p.companyName || 'مشتری مجاز نرم‌افزار اشک قلم',
                expireDate: p.expireDate || '1410-12-29',
                isUnlimited: p.isUnlimited ?? true,
                standaloneOfflineMode: true,
                features: ['ALL_MODULES', 'OFFLINE_STORAGE', 'UNLIMITED_CUSTOMERS', 'UNLIMITED_DOCUMENTS']
            });

            await encryptedStorageService.saveAppManifest(newManifest);
            // Keep the activation's tenant scope available to the later, explicit server-connection step.
            // Offline activation itself must not enable cloud sync.
            await workspaceService.updateConfig({
                workspaceId: newManifest.workspaceId,
                licenseKey: newManifest.licenseKey,
                workspaceToken: '',
                customServerUrl: '',
                standaloneOfflineMode: true
            });

            // ذخیره فلگ در حافظه محلی
            if (typeof window !== 'undefined') {
                localStorage.setItem('ashk_license_status', 'ACTIVATED');
                localStorage.setItem('ashk_license_type', p.isUnlimited ? 'UNLIMITED' : 'LIMITED');
                localStorage.setItem('ashk_license_key', licenseKey.trim().toUpperCase());
                localStorage.setItem('ashk_activation_code', activationCode.trim());
                localStorage.removeItem('ashk_server_license_data');
            }

            // ارسال رویداد جهت به‌روزرسانی آنی تمامی کامپوننت‌ها
            window.dispatchEvent(new CustomEvent('ashk-license-updated', { detail: newManifest }));

            return {
                success: true,
                message: 'فعال‌سازی با موفقیت انجام شد و کلیه محدودیت‌های نرم‌افزار برداشته شد.',
                manifest: newManifest
            };
        } catch (err: any) {
            return {
                success: false,
                message: err.message || 'خطا در ثبت فعال‌سازی'
            };
        }
    }

    /**
     * ساخت متن پیامک یا پیام پیام‌رسان آماده برای ارسال به خریدار
     */
    formatCustomerDeliveryMessage(record: LicenseRecord): string {
        const planTitle = PLAN_CONFIGS[record.plan].title;
        return `با سلام و احترام خدمت ${record.clientName} عزیز،
سپاس از انتخاب نرم‌افزار جامع حسابداری و اتوماسیون مالی اشک قلم.

اطلاعات لایسنس و فعال‌سازی نرم‌افزار شما:
🏷 نام کسب‌وکار: ${record.clientName}
📦 نسخه فعال‌شده: ${planTitle}
🔑 شماره لایسنس: ${record.licenseKey}
🔐 کد فعال‌سازی دستگاه: ${record.activationCode}
📅 تاریخ اعتبار: ${record.isUnlimited ? 'مادام‌العمر و دائمی' : record.expireDate}

راهنمای فعال‌سازی:
۱- در نرم‌افزار، روی دکمه «فعال‌سازی لایسنس» کلیک کنید.
۲- شماره لایسنس و کد فعال‌سازی بالا را در فرم مربوطه وارد کنید.
۳- روی دکمه «تأیید و فعال‌سازی» کلیک نمایید تا تمام محدودیت‌ها بازگشایی شوند.

📞 پشتیبانی فنی اشک قلم: ۰۹۱۲۰۰۰۰۰۰۰
با تشکر از اعتماد شما`;
    }
}

export const licenseGeneratorService = new LicenseGeneratorService();
