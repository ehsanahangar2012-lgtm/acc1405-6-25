import { registerPlugin } from '@capacitor/core';
import { isAndroidApp, getPersianDate, toPersianDigits, formatCurrency } from '../utils';
import { APP_VERSION } from '../config';
import { backupEncryptionService } from './backupEncryptionService';
import { licenseQuotaService } from './licenseQuotaService';
import { workspaceService } from './workspaceService';
import { securityService } from './securityService';

interface NativeBackupPlugin {
    saveBackup(options: { fileName: string; content: string; mimeType?: string }): Promise<{
        success?: boolean; cancelled?: boolean; uri?: string; bytesWritten?: number;
    }>;
}
const nativeBackupPlugin = registerPlugin<NativeBackupPlugin>('NativeBackup');

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
    async connectToServer(customHostUrl?: string, customSyncToken?: string, customWorkspaceId?: string): Promise<{ success: boolean; message: string; details?: any }> {
        if (typeof window === 'undefined') {
            return { success: false, message: 'این عملیات فقط در نسخه نصب‌شده پشتیبانی می‌شود.' };
        }

        const hostUrl = (customHostUrl || localStorage.getItem(this.STORAGE_KEYS.HOST_URL) || localStorage.getItem('ashk_custom_server_url') || '').trim().replace(/\/+$/, '');
        const syncToken = (customSyncToken || localStorage.getItem(this.STORAGE_KEYS.SYNC_TOKEN) || localStorage.getItem('ashk_cloud_token') || '').trim();

        if (!hostUrl) return { success: false, message: 'آدرس سرور را وارد کنید.' };
        if (!syncToken) return { success: false, message: 'توکن اختصاصی سرور الزامی است.' };
        if (!licenseQuotaService.isFullyLicensedSync()) {
            return { success: false, message: 'ابتدا لایسنس این دستگاه را با کد معتبر فعال کنید؛ اتصال سرور به‌تنهایی لایسنس صادر نمی‌کند.' };
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(hostUrl);
        } catch {
            return { success: false, message: 'آدرس سرور معتبر نیست.' };
        }
        if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
            return { success: false, message: 'آدرس سرور باید یک HTTP(S) URL معتبر و بدون اطلاعات ورود داخل URL باشد.' };
        }

        const workspaceId = (customWorkspaceId || workspaceService.getWorkspaceId()).trim();
        if (!workspaceId || workspaceId === 'default' || workspaceId === 'main') {
            return { success: false, message: 'ابتدا در فعال‌سازی لایسنس یک شناسه فضای کاری اختصاصی و ثبت‌شده برای این مشتری تعیین کنید؛ فضای default برای پرتال مادر رزرو شده است.' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const healthResponse = await fetch(`${hostUrl}/api.php?action=health`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            const health = await healthResponse.json().catch(() => null);
            if (!healthResponse.ok || !health || health.status !== 'online') {
                return { success: false, message: 'سرور پاسخ سلامت معتبر نداد. آدرس و سرویس API را بررسی کنید.' };
            }

            const requestBody = JSON.stringify({ action: 'test', workspace_id: workspaceId });
            const headers = {
                'Content-Type': 'application/json',
                'X-Workspace-ID': workspaceId,
                'X-Workspace-Token': syncToken
            };

            let accessResponse: Response | null = null;
            let accessData: any = null;
            const endpointCandidates = [`${hostUrl}/storage.php`, `${hostUrl}/host-backend/storage.php`];
            for (const endpoint of endpointCandidates) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        cache: 'no-store',
                        headers,
                        body: requestBody,
                        signal: controller.signal
                    });
                    accessResponse = response;
                    accessData = await response.json().catch(() => null);
                    if (response.status !== 404) break;
                } catch (error) {
                    if (controller.signal.aborted) throw error;
                }
            }

            if (!accessResponse || !accessResponse.ok || accessData?.success !== true) {
                return {
                    success: false,
                    message: accessData?.message || accessData?.error || 'سرور فضای کاری را مجاز نکرد؛ شناسه و توکن باید در سرور ثبت شده باشند.'
                };
            }

            localStorage.setItem(this.STORAGE_KEYS.HOST_URL, hostUrl);
            localStorage.setItem('ashk_custom_server_url', hostUrl);
            localStorage.setItem(this.STORAGE_KEYS.SYNC_TOKEN, syncToken);
            localStorage.setItem('ashk_cloud_token', syncToken);
            await workspaceService.updateConfig({
                customServerUrl: hostUrl,
                workspaceToken: syncToken,
                standaloneOfflineMode: false
            });

            window.dispatchEvent(new CustomEvent('ashk-server-connection-updated', {
                detail: { hostUrl, workspaceId }
            }));

            return {
                success: true,
                message: 'اتصال و دسترسی فضای کاری تأیید شد. این آزمون لایسنس را فعال یا تمدید نمی‌کند؛ سهمیه تجاری فقط از لایسنس معتبر دستگاه خوانده می‌شود.',
                details: { hostUrl, workspaceId }
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error && error.name === 'AbortError'
                    ? 'مهلت اتصال به سرور تمام شد.'
                    : 'اتصال یا اعتبارسنجی فضای کاری ناموفق بود.'
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * فعال‌سازی مستقیم لایسنس همراه
     */
    activateCommercialMode(): void {
        console.warn('[License] Commercial activation requires a verified license; use the activation dashboard.');
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
        localStorage.removeItem('ashk_license_key');
        localStorage.removeItem('ashk_activation_code');
        localStorage.removeItem('ashk_active_license_key');
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
    /**
     * Export a passphrase-encrypted portable backup through Android's system folder picker.
     */
    async createOfflineBackupFile(data: any, passphrase: string): Promise<{ success: boolean; cancelled?: boolean; location?: string; fileName?: string }> {
        if (typeof window === 'undefined') throw new Error('محیط ذخیره‌سازی در دسترس نیست.');
        const backupPayload = {
            system: 'AshkeGhalam Accounting',
            platform: 'Portable Offline Backup',
            version: APP_VERSION,
            exportedAtJalali: getPersianDate(),
            exportedAtTimestamp: Date.now(),
            data
        };
        const encryptedJson = backupEncryptionService.encryptJson(backupPayload, passphrase);
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `AshkeGhalam-Android-Backup-v${APP_VERSION}-${dateStr}.agbak`;

        if (isAndroidApp()) {
            const result = await nativeBackupPlugin.saveBackup({ fileName, content: encryptedJson, mimeType: 'application/json' });
            if (result?.cancelled) return { success: false, cancelled: true, fileName };
            if (!result?.success) throw new Error('ذخیره فایل پشتیبان در مسیر انتخاب‌شده تأیید نشد.');
            return { success: true, location: result.uri, fileName };
        }

        const blob = new Blob([encryptedJson], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return { success: true, fileName };
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
