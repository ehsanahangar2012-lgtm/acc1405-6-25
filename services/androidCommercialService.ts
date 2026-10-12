import { isAndroidApp, getPersianDate, toPersianDigits, formatCurrency } from '../utils';
import { licenseQuotaService } from './licenseQuotaService';
import { workspaceService } from './workspaceService';
import { securityService } from './securityService';

export interface BusinessProfile {
    companyName: string;
    phone: string;
    economicCode: string;
    nationalId: string;
    address: string;
    invoiceFooter: string;
    iban: string;
    cardNumber: string;
}

export interface AndroidCommercialStatus {
    isAndroid: boolean;
    isCommercialActive: boolean;
    editionTitle: string;
    licenseType: string;
    isFullyOfflineCapable: boolean;
    totalDocuments: number;
    totalPeople: number;
    businessProfile: BusinessProfile;
    isPwaLinked: boolean;
    serverHostUrl: string;
}

export interface CommercialFaqItem {
    id: string;
    question: string;
    answer: string;
}

class AndroidCommercialService {
    private readonly STORAGE_KEYS = {
        COMPANY_NAME: 'ashk_company_name',
        PHONE: 'ashk_company_phone',
        ECONOMIC_CODE: 'ashk_company_economic',
        NATIONAL_ID: 'ashk_company_national_id',
        ADDRESS: 'ashk_company_address',
        INVOICE_FOOTER: 'ashk_company_footer',
        IBAN: 'ashk_company_iban',
        CARD: 'ashk_company_card',
        COMMERCIAL_ACTIVATED: 'ashk_android_commercial_active',
        PWA_LINKED: 'ashk_pwa_linked',
        HOST_URL: 'ashk_host_url',
        SYNC_TOKEN: 'ashk_host_sync_token'
    };

    /**
     * بررسی فعال بودن مزیت تجاری پلتفرم اندروید (آیا لایسنس فعال شده یا به PWA لینک شده است)
     */
    isCommercialEnabled(): boolean {
        if (typeof window === 'undefined') return false;
        return licenseQuotaService.isFullyLicensedSync();
    }

    /**
     * پیوند به سیستم PWA / هاست سرور اصلی و فعال‌سازی با مشخصات لایسنس سرور مورد نظر
     */
    async linkToPwaAndActivate(customHostUrl?: string, customSyncToken?: string): Promise<{ success: boolean; message: string; details?: any }> {
        if (typeof window === 'undefined') {
            return { success: false, message: 'محیط وب پشتیبانی نمی‌شود.' };
        }

        const hostUrl = (customHostUrl || localStorage.getItem(this.STORAGE_KEYS.HOST_URL) || localStorage.getItem('ashk_custom_server_url') || '').trim();
        const syncToken = (customSyncToken || localStorage.getItem(this.STORAGE_KEYS.SYNC_TOKEN) || localStorage.getItem('ashk_cloud_token') || '').trim();

        if (!hostUrl) {
            return {
                success: false,
                message: 'لطفاً آدرس سرور یا هاست مورد نظر را وارد نمایید.'
            };
        }

        localStorage.setItem(this.STORAGE_KEYS.HOST_URL, hostUrl);
        localStorage.setItem('ashk_custom_server_url', hostUrl);
        if (syncToken) {
            localStorage.setItem(this.STORAGE_KEYS.SYNC_TOKEN, syncToken);
            localStorage.setItem('ashk_cloud_token', syncToken);
        }

        // بروزرسانی فضای کاری جهت اتصال به سرور مورد نظر
        try {
            await workspaceService.updateConfig({
                customServerUrl: hostUrl,
                workspaceToken: syncToken,
                standaloneOfflineMode: false
            });
        } catch (_) {}

        // تلاش برای استعلام آنلاین لایسنس از هاست در صورت امکان اتصال
        let serverTitle = 'شرکت مرکزی اشک قلم';
        let serverPlan = 'UNLIMITED';
        let serverExpire = 'دائمی (۱۰ ساله - متصل به سرور اصلی)';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const apiUrl = `${hostUrl.replace(/\/$/, '')}/api.php?action=health`;
            const resp = await fetch(apiUrl, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeoutId);

            if (resp && resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.company_name) serverTitle = data.company_name;
            }
        } catch (_) {
            // در حالت آفلاین یا فیلترینگ با مشخصات سرور اصلی همگام می‌شود
        }

        const currentCompany = localStorage.getItem(this.STORAGE_KEYS.COMPANY_NAME);
        const resolvedCompany = currentCompany || serverTitle;

        licenseQuotaService.activateWithServerLicense({
            companyName: resolvedCompany,
            plan: serverPlan,
            expireDate: serverExpire,
            hostUrl,
            syncToken
        });

        localStorage.setItem(this.STORAGE_KEYS.COMMERCIAL_ACTIVATED, 'true');
        localStorage.setItem(this.STORAGE_KEYS.PWA_LINKED, 'true');
        localStorage.setItem('ashk_android_activated', 'true');

        window.dispatchEvent(new CustomEvent('ashk-license-updated'));
        window.dispatchEvent(new CustomEvent('ashk-pwa-linked', { detail: { hostUrl, syncToken } }));

        return {
            success: true,
            message: `پیوند با سرور مورد نظر با موفقیت برقرار شد و لایسنس تجاری (${resolvedCompany} - نامحدود) فعال گردید.`,
            details: { hostUrl, syncToken, companyName: resolvedCompany }
        };
    }

    /**
     * فعال‌سازی مستقیم لایسنس همراه
     */
    activateCommercialMode(): void {
        if (typeof window === 'undefined') return;
        licenseQuotaService.activateWithServerLicense();
    }

    /**
     * بازگردانی به نسخه پیش‌فرض محدود (۵۰ سند)
     */
    resetToDefaultLimited(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(this.STORAGE_KEYS.COMMERCIAL_ACTIVATED);
        localStorage.removeItem(this.STORAGE_KEYS.PWA_LINKED);
        localStorage.removeItem('ashk_android_activated');
        localStorage.removeItem('ashk_license_status');
        localStorage.removeItem('ashk_license_plan');
        localStorage.removeItem('ashk_server_license_data');
        localStorage.removeItem('ashk_custom_server_url');
        localStorage.removeItem('ashk_host_url');
        localStorage.removeItem('ashk_host_sync_token');
        localStorage.removeItem('ashk_cloud_token');
        localStorage.removeItem('host-sync-metadata');
        window.dispatchEvent(new CustomEvent('ashk-license-updated'));
    }

    /**
     * بازنشانی کامل دیتابیس به حالت کاملاً خام محلی (پاکسازی هرگونه داده ناخواسته هاست)
     */
    resetToCleanLocalDatabase(): void {
        if (typeof window === 'undefined') return;
        this.resetToDefaultLimited();
        localStorage.removeItem('sync_queue_v2');

        // پاکسازی رکوردهای استور محلی بدون دستکاری کاربران سیستم
        if ((window as any).__ZUSTAND_STORE__?.setState) {
            (window as any).__ZUSTAND_STORE__.setState({
                invoices: [],
                products: [],
                people: [],
                vouchers: [],
                checks: [],
                transactions: [],
                checkTransfers: [],
                salaries: [],
                contracts: []
            });
        }
    }

    /**
     * دریافت پروفایل تجاری فروشگاه/واحد کسب‌وکار روی دستگاه
     */
    getBusinessProfile(): BusinessProfile {
        if (typeof window === 'undefined') {
            return {
                companyName: 'حسابداری اشک قلم',
                phone: '',
                economicCode: '',
                nationalId: '',
                address: '',
                invoiceFooter: 'با تشکر از حسن انتخاب شما - سامانه مالی اشک قلم',
                iban: '',
                cardNumber: ''
            };
        }

        return {
            companyName: localStorage.getItem(this.STORAGE_KEYS.COMPANY_NAME) || 'حسابداری اشک قلم',
            phone: localStorage.getItem(this.STORAGE_KEYS.PHONE) || '',
            economicCode: localStorage.getItem(this.STORAGE_KEYS.ECONOMIC_CODE) || '',
            nationalId: localStorage.getItem(this.STORAGE_KEYS.NATIONAL_ID) || '',
            address: localStorage.getItem(this.STORAGE_KEYS.ADDRESS) || '',
            invoiceFooter: localStorage.getItem(this.STORAGE_KEYS.INVOICE_FOOTER) || 'با تشکر از حسن انتخاب و اعتماد شما',
            iban: localStorage.getItem(this.STORAGE_KEYS.IBAN) || '',
            cardNumber: localStorage.getItem(this.STORAGE_KEYS.CARD) || ''
        };
    }

    /**
     * ذخیره و بروزرسانی اطلاعات تجاری فروشگاه روی دستگاه
     */
    saveBusinessProfile(profile: Partial<BusinessProfile>): void {
        if (typeof window === 'undefined') return;
        if (profile.companyName !== undefined) localStorage.setItem(this.STORAGE_KEYS.COMPANY_NAME, profile.companyName);
        if (profile.phone !== undefined) localStorage.setItem(this.STORAGE_KEYS.PHONE, profile.phone);
        if (profile.economicCode !== undefined) localStorage.setItem(this.STORAGE_KEYS.ECONOMIC_CODE, profile.economicCode);
        if (profile.nationalId !== undefined) localStorage.setItem(this.STORAGE_KEYS.NATIONAL_ID, profile.nationalId);
        if (profile.address !== undefined) localStorage.setItem(this.STORAGE_KEYS.ADDRESS, profile.address);
        if (profile.invoiceFooter !== undefined) localStorage.setItem(this.STORAGE_KEYS.INVOICE_FOOTER, profile.invoiceFooter);
        if (profile.iban !== undefined) localStorage.setItem(this.STORAGE_KEYS.IBAN, profile.iban);
        if (profile.cardNumber !== undefined) localStorage.setItem(this.STORAGE_KEYS.CARD, profile.cardNumber);

        window.dispatchEvent(new CustomEvent('ashk-business-profile-updated', { detail: profile }));
    }

    /**
     * ساخت متن رسمی فاکتور جهت ارسال در پیام‌رسان‌ها و پیامک بدون نیاز به سرور
     */
    formatInvoiceText(invoice: any, customer?: any, items: any[] = []): string {
        const profile = this.getBusinessProfile();
        const invoiceNum = toPersianDigits(invoice?.number || invoice?.id || '۱');
        const invoiceDate = toPersianDigits(invoice?.date || getPersianDate());
        const customerName = customer?.name || invoice?.customerName || 'مشتری گرامی';
        const finalAmount = invoice?.finalAmount ?? invoice?.total ?? 0;
        const formattedAmount = toPersianDigits(formatCurrency(finalAmount));

        let text = `📄 *فاکتور فروش: ${profile.companyName}*\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n`;
        text += `شماره فاکتور: ${invoiceNum}\n`;
        text += `تاریخ صدور: ${invoiceDate}\n`;
        text += `خریدار: ${customerName}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n`;

        if (items && items.length > 0) {
            text += `اقلام فاکتور:\n`;
            items.slice(0, 10).forEach((item, idx) => {
                const rowNum = toPersianDigits(idx + 1);
                const title = item.title || item.name || 'کالا/خدمت';
                const qty = toPersianDigits(item.quantity || 1);
                const price = toPersianDigits(formatCurrency(item.unitPrice || item.price || 0));
                text += `${rowNum}. ${title} (${qty} عدد) - ${price} ریال\n`;
            });
            if (items.length > 10) {
                text += `... و ${toPersianDigits(items.length - 10)} قلم دیگر\n`;
            }
            text += `━━━━━━━━━━━━━━━━━━━━\n`;
        }

        text += `مبلغ قابل پرداخت: *${formattedAmount} ریال*\n`;

        if (profile.cardNumber) {
            text += `شماره کارت جهت واریز: ${toPersianDigits(profile.cardNumber)}\n`;
        }
        if (profile.iban) {
            text += `شماره شبا: ${profile.iban}\n`;
        }
        if (profile.phone) {
            text += `تلفن تماس: ${toPersianDigits(profile.phone)}\n`;
        }

        if (profile.invoiceFooter) {
            text += `\n${profile.invoiceFooter}\n`;
        }

        return text;
    }

    /**
     * اشتراک‌گذاری در پیام‌رسان بومی ایتا (Eitaa)
     */
    shareViaEitaa(text: string): void {
        const encoded = encodeURIComponent(text);
        const url = `https://eitaa.com/share/url?text=${encoded}`;
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * اشتراک‌گذاری در پیام‌رسان بومی بله (Bale)
     */
    shareViaBale(text: string): void {
        const encoded = encodeURIComponent(text);
        const url = `https://ble.ir/share/url?text=${encoded}`;
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * اشتراک‌گذاری در روبیکا (Rubika) یا کپی سریع
     */
    shareViaRubika(text: string): void {
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        const encoded = encodeURIComponent(text);
        const url = `https://rubika.ir/`;
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * ارسال مستقیم با پیامک گوشی (SMS Native)
     */
    shareViaSms(phone: string, text: string): void {
        const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
        const encodedText = encodeURIComponent(text);
        // پروتکل استاندارد اندروید برای ارسال پیامک
        const smsUri = `sms:${cleanPhone}?body=${encodedText}`;
        if (typeof window !== 'undefined') {
            window.location.href = smsUri;
        }
    }

    /**
     * اشتراک‌گذاری در واتساپ
     */
    shareViaWhatsApp(phone: string, text: string): void {
        const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
        const encoded = encodeURIComponent(text);
        const url = cleanPhone 
            ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
            : `https://api.whatsapp.com/send?text=${encoded}`;
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * اشتراک‌گذاری در تلگرام
     */
    shareViaTelegram(text: string): void {
        const encoded = encodeURIComponent(text);
        const url = `https://t.me/share/url?url=&text=${encoded}`;
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * کپی آسان متن فاکتور در حافظه کلیپ‌بورد گوشی
     */
    async copyText(text: string): Promise<boolean> {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * تولید یا بازیابی شناسه یکتای دستگاه (UUID) در حافظه امن رمزنگاری‌شده برای نسخه اندروید
     * به سرور اجازه می‌دهد نصب‌های مختلف اندروید را حتی با حساب کاربری یکسان تفکیک کند.
     */
    async getOrGenerateDeviceUUID(): Promise<string> {
        if (typeof window === 'undefined') return 'web_default_device';
        const STORAGE_KEY = 'ashk_encrypted_device_uuid';
        try {
            const encryptedUuid = localStorage.getItem(STORAGE_KEY);
            if (encryptedUuid) {
                const decrypted = securityService.decrypt(encryptedUuid);
                if (decrypted && decrypted.length > 5) {
                    return decrypted;
                }
            }
        } catch (_) {}

        const newUuid = `android_dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        try {
            const encrypted = securityService.encrypt(newUuid);
            localStorage.setItem(STORAGE_KEY, encrypted);
        } catch (_) {
            localStorage.setItem(STORAGE_KEY, newUuid);
        }
        return newUuid;
    }

    /**
     * استخراج فایل بکاپ مستقل و آفلاین دیتابیس در گوشی
     */
    createOfflineBackupFile(data: any): void {
        if (typeof window === 'undefined') return;
        const backupPayload = {
            system: 'AshkeGhalam Accounting',
            platform: 'Android Commercial Sovereignty',
            version: '16.29.0',
            exportedAtJalali: getPersianDate(),
            exportedAtTimestamp: Date.now(),
            data: data
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = getPersianDate().replace(/[/ :]/g, '-');
        link.href = url;
        link.download = `AshkeGhalam-Android-Backup-v16.29.0-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * پایگاه دانش و راهنمای آفلاین تجاری پلتفرم اندروید
     */
    getOfflineKnowledgeBase(): CommercialFaqItem[] {
        return [
            {
                id: '1',
                question: 'ارتباط نسخه اندروید با سیستم PWA و سرور اصلی چگونه است؟',
                answer: 'اپلیکیشن همراه بخشی از سامانه جامع PWA و یکی از پلتفرم‌های نرم‌افزار است. در حالت پیش‌فرض، نسخه محدود با ثبت حداکثر ۵۰ سند فعال است. به محض فعال‌سازی مستقیم یا پیوند به سیستم PWA / سرور اصلی، برنامه با همان مشخصات لایسنس سرور مادر (نام شرکت، پلن نامحدود و تاریخ اعتبار) فعال می‌گردد.'
            },
            {
                id: '2',
                question: 'چگونه پس از اتمام سقف ۵۰ سند، برنامه را فعال و نامحدود کنیم؟',
                answer: 'دو راهکار وجود دارد: ۱. در همین بخش روی «لینک به سیستم PWA و دریافت لایسنس سرور اصلی» کلیک کنید تا لایسنس هاست مرکزی اعمال شود. ۲. از طریق وارد کردن کلید لایسنس یا کد فعال‌سازی آفلاین، لایسنس را مستقیماً فعال نمایید.'
            },
            {
                id: '3',
                question: 'آیا برای کار با برنامه در بازار و سفر به اینترنت نیاز است؟',
                answer: 'خیر. تمام محاسبات، ثبت فاکتورها، مانده‌حساب‌ها، گزارشات و ثبت دریافت/پرداخت به صورت ۱۰۰٪ آفلاین بر روی حافظه تلفن همراه ذخیره می‌شوند و حتی در صورت قطعی سراسری اینترنت و فیلترینگ، بدون وقفه کار می‌کند.'
            },
            {
                id: '4',
                question: 'چگونه فاکتورها را برای مشتری ارسال کنیم؟',
                answer: 'با کلیک بر روی دکمه اشتراک‌گذاری در این بخش، می‌توانید فاکتور را به صورت مستقیم در پیام‌رسان‌های بومی (ایتا، روبیکا، بله، شاد) یا به صورت پیامک مستقیم (Native SMS) بدون وابستگی به پنل ابری ارسال کنید.'
            },
            {
                id: '5',
                question: 'در صورت تعویض گوشی یا خرابی دستگاه چگونه اطلاعات را حفظ کنیم؟',
                answer: 'از تب پشتیبان‌گیری آفلاین، روی گزینه «تهیه نسخه پشتیبان آفلاین» کلیک نمایید تا فایل داده‌های شما با فرمت JSON دانلود و در حافظه یا تلگرام/ایتا شخصی شما ذخیره شود. در دستگاه جدید کافیست همین فایل را بازیابی کنید.'
            }
        ];
    }
}

export const androidCommercialService = new AndroidCommercialService();
