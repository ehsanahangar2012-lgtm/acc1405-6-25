// License Quota & Limit Enforcement Service
// مدیریت سقف نسخه پایه و مستقل: حداکثر ۳۰ طرف حساب و حداکثر ۱۰۰ سند حسابداری
import { encryptedStorageService, AppManifest } from './encryptedStorageService';
import { hardwareIdService } from './hardwareIdService';

export const MAX_TRIAL_CUSTOMERS = 30;
export const MAX_TRIAL_DOCUMENTS = 100;

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
     * بررسی سریع اینکه آیا لایسنس کامل و معتبر روی سیستم فعال شده است یا خیر
     */
    async isFullyLicensed(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        // بررسی کش سریع
        const localStatus = localStorage.getItem('ashk_license_status');
        if (localStatus === 'ACTIVATED') {
            return true;
        }

        try {
            const manifest = await encryptedStorageService.getAppManifest();
            if (manifest && manifest.status === 'ACTIVATED') {
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
        // ۱. در حالت سیستم مادر (Mother Server)، سیستم به صورت لایسنس کامل و بدون محدودیت عمل می‌کند
        if (localStorage.getItem('ashk_mother_server') === 'true') {
            return true;
        }

        // ۲. در حالت وب سرور هاست (cPanel / Web Server)، سیستم به عنوان نسخه مادر یا سرور مرکزی بدون محدودیت کار می‌کند
        const isWeb = typeof window !== 'undefined' && !(window as any).electronDesktopAPI && !(window as any).__TAURI__;
        if (isWeb) {
            const status = localStorage.getItem('ashk_license_status');
            if (status !== 'EXPIRED') {
                return true;
            }
        }

        // ۳. بررسی وضعیت لایسنس فعال روی سیستم
        const localStatus = localStorage.getItem('ashk_license_status');
        return localStatus === 'ACTIVATED';
    }

    /**
     * دریافت پلن فعال جاری
     */
    getCurrentPlan(): string {
        if (typeof window === 'undefined') return 'UNLIMITED';
        if (localStorage.getItem('ashk_mother_server') === 'true') {
            return 'UNLIMITED';
        }

        const isWeb = typeof window !== 'undefined' && !(window as any).electronDesktopAPI && !(window as any).__TAURI__;
        if (isWeb) {
            const status = localStorage.getItem('ashk_license_status');
            if (status !== 'EXPIRED') {
                return 'UNLIMITED';
            }
        }

        const plan = localStorage.getItem('ashk_license_plan');
        if (plan) return plan;
        return this.isFullyLicensedSync() ? 'UNLIMITED' : 'TRIAL';
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
