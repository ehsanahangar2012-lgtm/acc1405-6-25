// License Quota & Limit Enforcement Service
// مدیریت سقف نسخه پایه و مستقل: حداکثر ۳۰ طرف حساب و حداکثر ۱۰۰ سند حسابداری
import { encryptedStorageService, AppManifest } from './encryptedStorageService';
import { hardwareIdService } from './hardwareIdService';
import { isAndroidApp } from '../utils';

export const MAX_TRIAL_CUSTOMERS = 30;
export const MAX_TRIAL_DOCUMENTS = 100;

export const MAX_ANDROID_DEFAULT_CUSTOMERS = 30;
export const MAX_ANDROID_DEFAULT_DOCUMENTS = 50;

export const MAX_HEMAYAT_CUSTOMERS = 70;
export const MAX_HEMAYAT_DOCUMENTS = 450;

export interface QuotaStatus {
    isLicensed: boolean; // آیا لایسنس تجاری فعال است؟
    isTrial: boolean; // آیا در حالت پایه و آزمایشی است؟
    customerCount: number; // تعداد مشتریان فعلی
    maxCustomers: number; // سقف مشتریان (۲۰ یا نامحدود)
    remainingCustomers: number;
    isCustomerLimitReached: boolean;

    documentCount: number; // تعداد اسناد (فاکتورها، حواله‌ها، تراکنش‌ها، چک‌ها)
    maxDocuments: number; // سقف اسناد (۲۰۰ یا نامحدود)
    remainingDocuments: number;
    isDocumentLimitReached: boolean;

    isExceeded: boolean; // آیا از هرکدام از سقف‌ها عبور کرده است؟
    planTitle: string;
    companyName: string;
    expireDate: string;
    hwid: string;
}

class LicenseQuotaService {
    private cachedManifest: AppManifest | null = null;
    private listeners: Array<() => void> = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('ashk-license-updated', () => {
                this.cachedManifest = null;
                this.notifyListeners();
            });
        }
    }

    subscribe(fn: () => void): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(fn => {
            try { fn(); } catch (e) { console.error(e); }
        });
    }

    /**
     * بررسی فعال بودن لایسنس یا پیوند با PWA / سرور اصلی در نسخه اندروید
     */
    isAndroidActivatedOrLinked(): boolean {
        if (typeof window === 'undefined') return false;
        if (localStorage.getItem('ashk_license_status') !== 'ACTIVATED') return false;

        const licenseKey = (
            localStorage.getItem('ashk_license_key') ||
            localStorage.getItem('ashk_active_license_key') ||
            ''
        ).trim();
        const activationCode = (localStorage.getItem('ashk_activation_code') || '').trim();

        let serverVerified = false;
        try {
            const data = JSON.parse(localStorage.getItem('ashk_server_license_data') || 'null');
            serverVerified = Boolean(
                data?.serverVerified === true &&
                data?.licenseKey &&
                data.licenseKey === licenseKey &&
                data?.workspaceId &&
                data.workspaceId !== 'default' &&
                data.workspaceId !== 'main'
            );
        } catch {}

        const offlineLicenseConfirmed = Boolean(
            licenseKey &&
            activationCode &&
            !licenseKey.startsWith('PWA-HOST-LIC-')
        );
        return serverVerified || offlineLicenseConfirmed;
    }

    /**
     * فعال‌سازی اپلیکیشن همراه با مشخصات لایسنس ثبت‌شده در سرور اصلی (Mother Server / PWA Host)
     */
    activateWithServerLicense(details?: {
        companyName?: string;
        plan?: string;
        expireDate?: string;
        licenseKey?: string;
        hostUrl?: string;
        syncToken?: string;
        workspaceId?: string;
        verifiedByServer?: boolean;
    }): void {
        if (typeof window === 'undefined') return;
        if (
            details?.verifiedByServer !== true ||
            !details.licenseKey?.trim() ||
            !details.hostUrl?.trim() ||
            !details.syncToken?.trim() ||
            !details.workspaceId ||
            details.workspaceId === 'default' ||
            details.workspaceId === 'main'
        ) {
            console.warn('[License] Refusing activation without server-verified tenant license.');
            return;
        }

        const companyName = details.companyName || localStorage.getItem('ashk_company_name') || 'شرکت تجاری فعال سرور اصلی';
        const plan = details?.plan || 'UNLIMITED';
        const expireDate = details?.expireDate || 'دائمی (۱۰ ساله - متصل به سرور اصلی)';
        const licenseKey = details.licenseKey.trim();

        localStorage.setItem('ashk_pwa_linked', 'true');
        localStorage.setItem('ashk_android_activated', 'true');
        localStorage.setItem('ashk_license_status', 'ACTIVATED');
        localStorage.setItem('ashk_license_plan', plan);
        localStorage.setItem('ashk_company_name', companyName);
        localStorage.setItem('ashk_license_key', licenseKey);

        const serverData = {
            companyName,
            plan,
            planTitle: 'نسخه تجاری همراه (فعال‌شده با لایسنس سرور اصلی - نامحدود)',
            expireDate,
            licenseKey,
            hostUrl: details?.hostUrl || localStorage.getItem('ashk_host_url') || '',
            syncToken: details?.syncToken || localStorage.getItem('ashk_host_sync_token') || '',
            linkedAt: new Date().toISOString()
        };
        localStorage.setItem('ashk_server_license_data', JSON.stringify({ ...serverData, serverVerified: true, workspaceId: details.workspaceId }));

        try {
            const manifest = encryptedStorageService.createManifestObject({
                licenseKey,
                hardwareId: 'ANDROID-PWA-LINKED',
                workspaceId: 'default',
                companyName,
                expireDate,
                isUnlimited: true
            });
            encryptedStorageService.saveAppManifest(manifest).catch(() => {});
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('ashk-license-updated'));
        this.notifyListeners();
    }

    /**
     * دریافت مشخصات لایسنس فعال سرور اصلی
     */
    getMainServerLicenseInfo(): {
        companyName: string;
        planTitle: string;
        expireDate: string;
        isUnlimited: boolean;
        hostUrl: string;
    } {
        let serverData: any = {};
        try {
            const raw = localStorage.getItem('ashk_server_license_data');
            if (raw) serverData = JSON.parse(raw);
        } catch (_) {}

        return {
            companyName: serverData.companyName || localStorage.getItem('ashk_company_name') || 'سامانه مرکزی اشک قلم',
            planTitle: serverData.planTitle || 'نسخه تجاری متصل به سرور اصلی (نامحدود)',
            expireDate: serverData.expireDate || 'دائمی (معتبر در سرور اصلی)',
            isUnlimited: true,
            hostUrl: serverData.hostUrl || localStorage.getItem('ashk_host_url') || ''
        };
    }

    /**
     * بررسی سریع اینکه آیا لایسنس کامل و معتبر روی سیستم فعال شده است یا خیر
     */
    async isFullyLicensed(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        // پلتفرم اندروید: در حالت پیش‌فرض محدود به ۵۰ سند، با فعال‌سازی یا لینک به PWA فعال می‌شود
        if (isAndroidApp()) {
            return this.isAndroidActivatedOrLinked();
        }

        // بررسی کش سریع
        const localStatus = localStorage.getItem('ashk_license_status');
        if (localStatus === 'ACTIVATED' && this.isFullyLicensedSync()) {
            return true;
        }

        try {
            const manifest = await encryptedStorageService.getAppManifest();
            if (manifest && manifest.status === 'ACTIVATED' && this.isFullyLicensedSync()) {
                this.cachedManifest = manifest;
                return true;
            }
        } catch {
            return false;
        }

        return false;
    }

    /**
     * همگام و بررسی سریع بدون async
     */
    isFullyLicensedSync(): boolean {
        if (typeof window === 'undefined') return false;

        // ۰. پلتفرم اندروید: در حالت پیش‌فرض سقف ۵۰ سند دارد و با فعال‌سازی یا لینک به PWA فعال می‌شود
        if (isAndroidApp()) {
            return this.isAndroidActivatedOrLinked();
        }

        // ۱. بررسی وضعیت لایسنس فعال روی سیستم (فقط در صورت داشتن وضعیت ACTIVATED و کلید معتبر یا مانیفست تایید شده)
        const localStatus = localStorage.getItem('ashk_license_status');
        const licenseKey = (
            localStorage.getItem('ashk_license_key') ||
            localStorage.getItem('ashk_active_license_key') ||
            ''
        ).trim();
        const activationCode = (localStorage.getItem('ashk_activation_code') || '').trim();
        let serverVerified = false;
        try {
            const data = JSON.parse(localStorage.getItem('ashk_server_license_data') || 'null');
            serverVerified = Boolean(
                data?.serverVerified === true &&
                data?.licenseKey === licenseKey &&
                data?.workspaceId &&
                data.workspaceId !== 'default' &&
                data.workspaceId !== 'main'
            );
        } catch {}
        const offlineLicenseConfirmed = Boolean(
            licenseKey && activationCode && !licenseKey.startsWith('PWA-HOST-LIC-')
        );
        if (localStatus === 'ACTIVATED' && (serverVerified || offlineLicenseConfirmed)) {
            return true;
        }

        // پیش‌فرض: در حالت عادی بدون لایسنس معتبر، محدودیت‌های آزمایشی فعال است
        return false;
    }

    /**
     * دریافت پلن فعال جاری
     */
    getCurrentPlan(): string {
        if (typeof window === 'undefined') return 'TRIAL';

        // پلتفرم اندروید
        if (isAndroidApp()) {
            if (this.isAndroidActivatedOrLinked()) {
                return 'COMMERCIAL_ANDROID_LINKED';
            }
            return 'ANDROID_TRIAL_50';
        }

        if (this.isFullyLicensedSync()) {
            const plan = localStorage.getItem('ashk_license_plan');
            if (plan) return plan;
            return 'UNLIMITED';
        }

        return 'TRIAL';
    }

    /**
     * دریافت وضعیت جامع سهمیه و لایسنس بر اساس آمارهای استور
     */
    getQuotaStatus(peopleCount: number, docCount: number, hwidStr: string = ''): QuotaStatus {
        const isLicensed = this.isFullyLicensedSync();
        const currentPlan = this.getCurrentPlan();

        const customerCount = peopleCount;
        const documentCount = docCount;

        if (isLicensed) {
            // نسخه همراه متصل به PWA یا فعال‌شده با لایسنس سرور اصلی
            if (isAndroidApp() || currentPlan === 'COMMERCIAL_ANDROID_LINKED' || currentPlan === 'COMMERCIAL_ANDROID') {
                const serverLicense = this.getMainServerLicenseInfo();
                return {
                    isLicensed: true,
                    isTrial: false,
                    customerCount,
                    maxCustomers: -1,
                    remainingCustomers: 999999,
                    isCustomerLimitReached: false,
                    documentCount,
                    maxDocuments: -1,
                    remainingDocuments: 999999,
                    isDocumentLimitReached: false,
                    isExceeded: false,
                    planTitle: serverLicense.planTitle || 'نسخه تجاری همراه (فعال‌شده با لایسنس سرور اصلی - نامحدود)',
                    companyName: serverLicense.companyName || localStorage.getItem('ashk_company_name') || 'نسخه تجاری فعال سرور اصلی',
                    expireDate: serverLicense.expireDate || 'دائمی (بدون محدودیت سند و طرف حساب)',
                    hwid: hwidStr || 'ANDROID-COMMERCIAL-UNLIMITED'
                };
            }

            // پلن حمایتی کسب‌وکارهای خرد و نوپا
            if (currentPlan === 'HEMAYAT') {
                const maxCust = MAX_HEMAYAT_CUSTOMERS;
                const maxDoc = MAX_HEMAYAT_DOCUMENTS;
                const isCustomerLimitReached = customerCount >= maxCust;
                const isDocumentLimitReached = documentCount >= maxDoc;
                const isExceeded = isCustomerLimitReached || isDocumentLimitReached;

                return {
                    isLicensed: true,
                    isTrial: false,
                    customerCount,
                    maxCustomers: maxCust,
                    remainingCustomers: Math.max(0, maxCust - customerCount),
                    isCustomerLimitReached,
                    documentCount,
                    maxDocuments: maxDoc,
                    remainingDocuments: Math.max(0, maxDoc - documentCount),
                    isDocumentLimitReached,
                    isExceeded,
                    planTitle: `نسخه حامی اشک قلم (ویژه کسب‌وکارهای نوپا - سقف ${maxCust} طرف حساب / ${maxDoc} سند)`,
                    companyName: localStorage.getItem('ashk_company_name') || 'نسخه حامی فعال',
                    expireDate: 'دائمی (۱۰ ساله)',
                    hwid: hwidStr
                };
            }

            return {
                isLicensed: true,
                isTrial: false,
                customerCount,
                maxCustomers: -1,
                remainingCustomers: 999999,
                isCustomerLimitReached: false,
                documentCount,
                maxDocuments: -1,
                remainingDocuments: 999999,
                isDocumentLimitReached: false,
                isExceeded: false,
                planTitle: 'نسخه تجاری نامحدود (فعال)',
                companyName: localStorage.getItem('ashk_company_name') || 'نسخه تجاری فعال',
                expireDate: 'دائمی / معتبر',
                hwid: hwidStr
            };
        }

        // پلتفرم اندروید در حالت پیش‌فرض (نسخه محدود با سقف ۵۰ سند)
        if (isAndroidApp() || currentPlan === 'ANDROID_TRIAL_50') {
            const isCustomerLimitReached = customerCount >= MAX_ANDROID_DEFAULT_CUSTOMERS;
            const isDocumentLimitReached = documentCount >= MAX_ANDROID_DEFAULT_DOCUMENTS;
            const isExceeded = isCustomerLimitReached || isDocumentLimitReached;

            return {
                isLicensed: false,
                isTrial: true,
                customerCount,
                maxCustomers: MAX_ANDROID_DEFAULT_CUSTOMERS,
                remainingCustomers: Math.max(0, MAX_ANDROID_DEFAULT_CUSTOMERS - customerCount),
                isCustomerLimitReached,
                documentCount,
                maxDocuments: MAX_ANDROID_DEFAULT_DOCUMENTS,
                remainingDocuments: Math.max(0, MAX_ANDROID_DEFAULT_DOCUMENTS - documentCount),
                isDocumentLimitReached,
                isExceeded,
                planTitle: `نسخه پیش‌فرض همراه (محدود به ۵۰ سند)`,
                companyName: localStorage.getItem('ashk_company_name') || 'نسخه همراه اشک قلم',
                expireDate: 'سقف آزمایشی ۵۰ سند (جهت نامحدودسازی فعال یا به PWA لینک کنید)',
                hwid: hwidStr
            };
        }

        const isCustomerLimitReached = customerCount >= MAX_TRIAL_CUSTOMERS;
        const isDocumentLimitReached = documentCount >= MAX_TRIAL_DOCUMENTS;
        const isExceeded = isCustomerLimitReached || isDocumentLimitReached;

        return {
            isLicensed: false,
            isTrial: true,
            customerCount,
            maxCustomers: MAX_TRIAL_CUSTOMERS,
            remainingCustomers: Math.max(0, MAX_TRIAL_CUSTOMERS - customerCount),
            isCustomerLimitReached,
            documentCount,
            maxDocuments: MAX_TRIAL_DOCUMENTS,
            remainingDocuments: Math.max(0, MAX_TRIAL_DOCUMENTS - documentCount),
            isDocumentLimitReached,
            isExceeded,
            planTitle: `نسخه پایه و مستقل (آزمایشی ${MAX_TRIAL_CUSTOMERS} طرف حساب / ${MAX_TRIAL_DOCUMENTS} سند)`,
            companyName: 'نسخه مستقل محلی',
            expireDate: 'تا پایان سقف آزمایشی',
            hwid: hwidStr
        };
    }

    /**
     * اعتبارسنجی ثبت مشتری جدید در استور
     */
    canAddPerson(currentPeopleCount: number): { allowed: boolean; reason?: string } {
        // پلتفرم اندروید: در حالت پیش‌فرض دارای سقف، و پس از فعال‌سازی یا لینک به PWA نامحدود
        if (isAndroidApp()) {
            if (this.isAndroidActivatedOrLinked()) {
                return { allowed: true };
            }
            if (currentPeopleCount >= MAX_ANDROID_DEFAULT_CUSTOMERS) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                        detail: { 
                            reason: 'CUSTOMERS_LIMIT', 
                            current: currentPeopleCount, 
                            max: MAX_ANDROID_DEFAULT_CUSTOMERS,
                            platform: 'android'
                        }
                    }));
                }
                return {
                    allowed: false,
                    reason: `سقف ثبت طرف حساب در نسخه پیش‌فرض همراه (${MAX_ANDROID_DEFAULT_CUSTOMERS} نفر) تکمیل شده است. جهت ارتقا، لطفاً لایسنس را فعال کرده یا با پیوند به سیستم PWA / سرور اصلی آن را نامحدود نمایید.`
                };
            }
            return { allowed: true };
        }

        if (this.isFullyLicensedSync()) {
            const currentPlan = this.getCurrentPlan();
            if (currentPlan === 'HEMAYAT') {
                const maxCust = MAX_HEMAYAT_CUSTOMERS;
                if (currentPeopleCount >= maxCust) {
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                            detail: { reason: 'CUSTOMERS_LIMIT', current: currentPeopleCount, max: maxCust }
                        }));
                    }
                    return {
                        allowed: false,
                        reason: `سقف نسخه حامی (${maxCust} طرف حساب) تکمیل شده است. جهت ارتقا به نسخه نامحدود تجاری، لطفاً با پشتیبانی هماهنگ فرمایید.`
                    };
                }
            }
            return { allowed: true };
        }

        if (currentPeopleCount >= MAX_TRIAL_CUSTOMERS) {
            // اعلام رویداد باز شدن دیالوگ فعال‌سازی
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                    detail: { reason: 'CUSTOMERS_LIMIT', current: currentPeopleCount, max: MAX_TRIAL_CUSTOMERS }
                }));
            }
            return {
                allowed: false,
                reason: `سقف نسخه پایه مستقل (${MAX_TRIAL_CUSTOMERS} طرف حساب) پر شده است. برای ثبت طرف حساب‌های بیشتر، لطفاً با پشتیبانی تماس گرفته و لایسنس خود را فعال نمایید.`
            };
        }

        return { allowed: true };
    }

    /**
     * اعتبارسنجی ثبت سند جدید در استور (فاکتور، حواله انبار، چک، تراکنش)
     */
    canAddDocument(currentDocCount: number): { allowed: boolean; reason?: string } {
        // پلتفرم اندروید: در حالت پیش‌فرض سقف ۵۰ سند، و پس از فعال‌سازی یا لینک به PWA نامحدود
        if (isAndroidApp()) {
            if (this.isAndroidActivatedOrLinked()) {
                return { allowed: true };
            }
            if (currentDocCount >= MAX_ANDROID_DEFAULT_DOCUMENTS) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                        detail: { 
                            reason: 'DOCUMENTS_LIMIT', 
                            current: currentDocCount, 
                            max: MAX_ANDROID_DEFAULT_DOCUMENTS,
                            platform: 'android'
                        }
                    }));
                }
                return {
                    allowed: false,
                    reason: `سقف ثبت اسناد در نسخه پیش‌فرض همراه (${MAX_ANDROID_DEFAULT_DOCUMENTS} سند) تکمیل شده است. برای ثبت اسناد بیشتر، لطفاً با فعال‌سازی لایسنس یا پیوند به سیستم PWA / سرور اصلی، برنامه را فعال فرمایید.`
                };
            }
            return { allowed: true };
        }

        if (this.isFullyLicensedSync()) {
            const currentPlan = this.getCurrentPlan();
            if (currentPlan === 'HEMAYAT') {
                const maxDoc = MAX_HEMAYAT_DOCUMENTS;
                if (currentDocCount >= maxDoc) {
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                            detail: { reason: 'DOCUMENTS_LIMIT', current: currentDocCount, max: maxDoc }
                        }));
                    }
                    return {
                        allowed: false,
                        reason: `سقف نسخه حامی (${maxDoc} سند مالی) تکمیل شده است. جهت ارتقا به نسخه نامحدود تجاری، لطفاً با پشتیبانی هماهنگ فرمایید.`
                    };
                }
            }
            return { allowed: true };
        }

        if (currentDocCount >= MAX_TRIAL_DOCUMENTS) {
            // اعلام رویداد باز شدن دیالوگ فعال‌سازی
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                    detail: { reason: 'DOCUMENTS_LIMIT', current: currentDocCount, max: MAX_TRIAL_DOCUMENTS }
                }));
            }
            return {
                allowed: false,
                reason: `سقف نسخه پایه مستقل (${MAX_TRIAL_DOCUMENTS} سند حسابداری) پر شده است. برای صدور و ثبت اسناد جدید، لطفاً با پشتیبانی تماس گرفته و لایسنس خود را فعال نمایید.`
            };
        }

        return { allowed: true };
    }
}

export const licenseQuotaService = new LicenseQuotaService();
