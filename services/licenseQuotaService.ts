// License Quota & Limit Enforcement Service
// مدیریت سقف نسخه پایه و مستقل: حداکثر ۳۰ طرف حساب و حداکثر ۱۰۰ سند حسابداری
import { encryptedStorageService, AppManifest } from './encryptedStorageService';
import { hardwareIdService } from './hardwareIdService';
import { isAndroidApp } from '../utils';
import { refreshServerLicense, VerifiedLicensePayload } from './serverLicenseReceiptService';

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
    // Session-only proof: localStorage values cannot set this flag. It is set only after a fresh, signed server receipt is checked.
    private serverReceiptVerifiedInSession = false;
    private refreshPromise: Promise<boolean> | null = null;
    private serverEntitlements: VerifiedLicensePayload | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            const refresh = () => {
                this.cachedManifest = null;
                this.serverReceiptVerifiedInSession = false;
                this.serverEntitlements = null;
                this.notifyListeners();
                void this.refreshCachedServerLicense();
            };
            window.addEventListener('ashk-license-updated', refresh);
            window.addEventListener('online', () => void this.refreshCachedServerLicense());
            void this.refreshCachedServerLicense();
        }
    }

    private async refreshCachedServerLicense(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = (async () => {
            const raw = localStorage.getItem('ashk_server_license_data');
            if (!raw) {
                this.serverReceiptVerifiedInSession = false;
                this.serverEntitlements = null;
                return false;
            }
            let stored: any;
            try { stored = JSON.parse(raw); } catch {
                this.serverReceiptVerifiedInSession = false;
                return false;
            }
            const licenseKey = String(stored?.licenseKey || '').trim();
            const workspaceId = String(stored?.workspaceId || '').trim();
            const hostUrl = String(stored?.hostUrl || '').trim();
            if (!licenseKey || !workspaceId || !hostUrl || ['default', 'main'].includes(workspaceId)) {
                this.serverReceiptVerifiedInSession = false;
                return false;
            }

            try {
                const hwid = String(stored?.hwid || await hardwareIdService.getHardwareId()).trim();
                const verified = await refreshServerLicense({ hostUrl, licenseKey, workspaceId, hwid });
                if (!verified) {
                    this.serverReceiptVerifiedInSession = false;
                    localStorage.setItem('ashk_server_license_data', JSON.stringify({ ...stored, serverVerified: false }));
                    this.notifyListeners();
                    return false;
                }

                const p = verified.payload;
                const updated = {
                    ...stored,
                    serverVerified: true,
                    licenseReceipt: verified.receipt,
                    workspaceId: p.workspace_id,
                    licenseKey,
                    hwid: p.hwid,
                    plan: p.plan,
                    maxCustomers: p.max_customers,
                    maxDocuments: p.max_documents,
                    maxUsers: p.max_users,
                    isUnlimited: p.is_unlimited,
                    features: p.features,
                    expireDate: p.expire_date,
                    verifiedAt: new Date().toISOString()
                };
                localStorage.setItem('ashk_server_license_data', JSON.stringify(updated));
                localStorage.setItem('ashk_license_plan', p.plan);
                localStorage.setItem('ashk_license_type', p.is_unlimited ? 'UNLIMITED' : 'LIMITED');
                this.serverReceiptVerifiedInSession = true;
                this.serverEntitlements = p;
                this.notifyListeners();
                return true;
            } catch {
                this.serverReceiptVerifiedInSession = false;
                this.serverEntitlements = null;
                return false;
            }
        })();

        try {
            return await this.refreshPromise;
        } finally {
            this.refreshPromise = null;
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

        let serverVerified = false;
        try {
            const data = JSON.parse(localStorage.getItem('ashk_server_license_data') || 'null');
            serverVerified = Boolean(
                data?.serverVerified === true &&
                data?.licenseKey === licenseKey &&
                data?.workspaceToken === licenseKey &&
                data?.syncToken === licenseKey &&
                typeof data?.hostUrl === 'string' &&
                /^https?:\/\//i.test(data.hostUrl) &&
                data?.workspaceId &&
                data.workspaceId !== 'default' &&
                data.workspaceId !== 'main'
            );
        } catch {}

        // Local flags are only cache metadata. A fresh signed server receipt must have been verified in this session.
        return serverVerified && this.serverReceiptVerifiedInSession;
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
        maxCustomers?: number;
        maxDocuments?: number;
        isUnlimited?: boolean;
        features?: string[];
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
            planTitle: details?.isUnlimited === false
                ? `نسخه تجاری محدود (${plan})`
                : 'نسخه تجاری همراه (فعال‌شده با لایسنس سرور اصلی)',
            expireDate,
            licenseKey,
            hostUrl: details?.hostUrl || localStorage.getItem('ashk_host_url') || '',
            syncToken: details?.syncToken || localStorage.getItem('ashk_host_sync_token') || '',
            workspaceToken: details?.syncToken || localStorage.getItem('ashk_host_sync_token') || '',
            maxCustomers: Number.isFinite(details?.maxCustomers) ? details?.maxCustomers : (plan === 'HEMAYAT' ? MAX_HEMAYAT_CUSTOMERS : -1),
            maxDocuments: Number.isFinite(details?.maxDocuments) ? details?.maxDocuments : (plan === 'HEMAYAT' ? MAX_HEMAYAT_DOCUMENTS : -1),
            isUnlimited: details?.isUnlimited ?? (plan !== 'HEMAYAT'),
            features: details?.features || (plan === 'HEMAYAT' ? ['BASIC_MODULES'] : ['ALL_MODULES']),
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
            isUnlimited: serverData.isUnlimited === true,
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
        let serverVerified = false;
        try {
            const data = JSON.parse(localStorage.getItem('ashk_server_license_data') || 'null');
            serverVerified = Boolean(
                data?.serverVerified === true &&
                data?.licenseKey === licenseKey &&
                data?.workspaceToken === licenseKey &&
                data?.syncToken === licenseKey &&
                typeof data?.hostUrl === 'string' &&
                /^https?:\/\//i.test(data.hostUrl) &&
                data?.workspaceId &&
                data.workspaceId !== 'default' &&
                data.workspaceId !== 'main'
            );
        } catch {}
        if (localStatus === 'ACTIVATED' && serverVerified && this.serverReceiptVerifiedInSession) {
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
                return this.serverEntitlements?.plan || 'COMMERCIAL_ANDROID_LINKED';
            }
            return 'ANDROID_TRIAL_50';
        }

        if (this.isFullyLicensedSync()) {
            return this.serverEntitlements?.plan || 'LICENSED';
        }

        return 'TRIAL';
    }

    private getCurrentEntitlements(): {
        plan: string; maxCustomers: number; maxDocuments: number; isUnlimited: boolean;
        expireDate: string; features: string[];
    } {
        const p = this.serverEntitlements;
        const plan = p?.plan || this.getCurrentPlan();
        const defaults: Record<string, [number, number]> = {
            TRIAL: [MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS],
            ANDROID_TRIAL_50: [MAX_ANDROID_DEFAULT_CUSTOMERS, MAX_ANDROID_DEFAULT_DOCUMENTS],
            HEMAYAT: [MAX_HEMAYAT_CUSTOMERS, MAX_HEMAYAT_DOCUMENTS],
            BRONZE: [50, 500],
            SILVER: [200, 2000],
            GOLD: [MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS],
            ENTERPRISE: [MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS],
            LICENSED: [MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS]
        };
        const fallback = defaults[plan] || [MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS];
        const isUnlimited = p?.is_unlimited === true;
        const maxCustomers = isUnlimited ? -1 :
            (p && Number.isFinite(p.max_customers) && p.max_customers >= 0 ? p.max_customers :
                (fallback[0] >= 0 ? fallback[0] : MAX_TRIAL_CUSTOMERS));
        const maxDocuments = isUnlimited ? -1 :
            (p && Number.isFinite(p.max_documents) && p.max_documents >= 0 ? p.max_documents :
                (fallback[1] >= 0 ? fallback[1] : MAX_TRIAL_DOCUMENTS));
        return {
            plan,
            maxCustomers,
            maxDocuments,
            isUnlimited,
            expireDate: p?.is_unlimited ? 'دائمی' : (p?.expire_date || ''),
            features: Array.isArray(p?.features) ? p.features : ['BASIC_MODULES']
        };
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
            const entitlements = this.getCurrentEntitlements();
            const isUnlimited = entitlements.isUnlimited;
            const maxCust = isUnlimited ? -1 : entitlements.maxCustomers;
            const maxDoc = isUnlimited ? -1 : entitlements.maxDocuments;
            const isCustomerLimitReached = !isUnlimited && customerCount >= maxCust;
            const isDocumentLimitReached = !isUnlimited && documentCount >= maxDoc;
            const planTitle = isUnlimited
                ? `پلن ${entitlements.plan} نامحدود (تأییدشده توسط سرور)`
                : entitlements.plan === 'HEMAYAT'
                    ? `نسخه حامی اشک قلم (سقف ${maxCust} طرف حساب / ${maxDoc} سند)`
                    : `پلن تجاری ${entitlements.plan} (${maxCust} طرف حساب / ${maxDoc} سند)`;

            return {
                isLicensed: true,
                isTrial: false,
                customerCount,
                maxCustomers: maxCust,
                remainingCustomers: isUnlimited ? 999999 : Math.max(0, maxCust - customerCount),
                isCustomerLimitReached,
                documentCount,
                maxDocuments: maxDoc,
                remainingDocuments: isUnlimited ? 999999 : Math.max(0, maxDoc - documentCount),
                isDocumentLimitReached,
                isExceeded: isCustomerLimitReached || isDocumentLimitReached,
                planTitle,
                companyName: localStorage.getItem('ashk_company_name') || 'مشتری مجاز اشک قلم',
                expireDate: entitlements.expireDate || 'ثبت‌شده در سرور',
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
        const isLicensed = this.isFullyLicensedSync();
        const entitlements = isLicensed ? this.getCurrentEntitlements() : null;
        const maxCustomers = entitlements
            ? (entitlements.isUnlimited ? -1 : entitlements.maxCustomers)
            : MAX_TRIAL_CUSTOMERS;

        if (maxCustomers < 0 || currentPeopleCount < maxCustomers) return { allowed: true };
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                detail: { reason: 'CUSTOMERS_LIMIT', current: currentPeopleCount, max: maxCustomers, platform: isAndroidApp() ? 'android' : 'desktop' }
            }));
        }
        return {
            allowed: false,
            reason: isLicensed
                ? `سقف پلن ${entitlements!.plan} (${maxCustomers} طرف حساب) تکمیل شده است. برای ارتقا یا افزایش سهمیه با پشتیبانی تماس بگیرید.`
                : `سقف نسخه آزمایشی (${maxCustomers} طرف حساب) تکمیل شده است؛ لایسنس آنلاین را فعال کنید.`
        };
    }

    canAddDocument(currentDocCount: number): { allowed: boolean; reason?: string } {
        const isLicensed = this.isFullyLicensedSync();
        const entitlements = isLicensed ? this.getCurrentEntitlements() : null;
        const trialMax = isAndroidApp() ? MAX_ANDROID_DEFAULT_DOCUMENTS : MAX_TRIAL_DOCUMENTS;
        const maxDocuments = entitlements
            ? (entitlements.isUnlimited ? -1 : entitlements.maxDocuments)
            : trialMax;

        if (maxDocuments < 0 || currentDocCount < maxDocuments) return { allowed: true };
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
                detail: { reason: 'DOCUMENTS_LIMIT', current: currentDocCount, max: maxDocuments, platform: isAndroidApp() ? 'android' : 'desktop' }
            }));
        }
        return {
            allowed: false,
            reason: isLicensed
                ? `سقف پلن ${entitlements!.plan} (${maxDocuments} سند) تکمیل شده است. برای ارتقا یا افزایش سهمیه با پشتیبانی تماس بگیرید.`
                : `سقف نسخه آزمایشی (${maxDocuments} سند) تکمیل شده است؛ لایسنس آنلاین را فعال کنید.`
        };
    }

}

export const licenseQuotaService = new LicenseQuotaService();
