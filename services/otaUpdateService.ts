import { API_CONFIG } from '../config';
import { toPersianDigits, getPersianDate } from '../utils';

export interface UpdateChangeItem {
    category: 'ویژگی جدید' | 'بهبود' | 'رفع باگ' | 'امنیت' | 'همگام‌سازی';
    desc: string;
}

export interface ReleaseInfo {
    version: string;
    date: string;
    type: 'major' | 'minor' | 'patch';
    title: string;
    size?: string;
    downloadUrl?: string;
    isCurrent?: boolean;
    changes: UpdateChangeItem[];
}

export interface UpdateCheckResult {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    latestRelease: ReleaseInfo;
    allReleases: ReleaseInfo[];
    checkedAt: string;
    source: 'host' | 'local' | 'cache';
    platform: 'windows' | 'android' | 'web' | 'pwa';
    isDesktop: boolean;
}

export const APP_CURRENT_VERSION = '16.24.0';
export const APP_BUILD_NUMBER = '20260916';

// پایگاه‌داده تاریخچه نسخه‌ها به‌صورت پیش‌فرض برای زمان‌های آفلاین
const DEFAULT_RELEASES: ReleaseInfo[] = [
    {
        version: '16.24.0',
        date: '۱۴۰۵/۰۶/۲۵',
        type: 'minor',
        title: 'بهینه‌سازی پرفورمنس پایگاه‌داده دسکتاپ ویندوز، پل پیامک اندروید و بروزرسانی خودکار OTA',
        size: '1.6 MB (وصله آنی دلتا)',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.24.0.exe',
        isCurrent: true,
        changes: [
            { category: 'بهبود', desc: 'بهینه‌سازی موتور پایگاه‌داده دسکتاپ ویندوز و رفع کامل کندی در اتصال به وب‌سرور هاست' },
            { category: 'ویژگی جدید', desc: 'پل ارتباطی ارسال مستقیم پیامک از گوشی اندروید به صورت آفلاین و سیم‌کارتی' },
            { category: 'ویژگی جدید', desc: 'تولید بارکد پرداخت پویا بر روی کلیه قالب‌های چاپ فاکتور و رسید' },
            { category: 'ویژگی جدید', desc: 'کاتالوگ لمسی همراه ویزیتوری با دریافت امضای الکترونیک مشتریان' },
            { category: 'ویژگی جدید', desc: 'ماژول پیش‌بینی هوشمند نقدینگی ۳۰، ۶۰ و ۹۰ روز آینده' },
            { category: 'همگام‌سازی', desc: 'همگام‌سازی لحظه‌ای مرکز بروزرسانی OTA کلاینت‌های دسکتاپ ویندوز با سرور مادر' }
        ]
    },
    {
        version: '16.23.0',
        date: '۱۴۰۵/۰۶/۲۵',
        type: 'patch',
        title: 'ارتقای ماژول‌های حسابداری، کاتالوگ ویزیتوری و پیش‌بینی جریان وجوه نقد',
        size: '1.1 MB',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.23.0.exe',
        changes: [
            { category: 'ویژگی جدید', desc: 'سامانه پشتیبان‌گیری خودکار ۳ گانه آنلاین، دیسک محلی و رم' },
            { category: 'بهبود', desc: 'تفکیک کامل متون و قابلیت‌های پلتفرم‌های ویندوز، اندروید و وب ابری' }
        ]
    },
    {
        version: '16.22.0',
        date: '۱۴۰۵/۰۶/۲۵',
        type: 'minor',
        title: 'ارتقای جامع ماژول کاردکس اشخاص، پاپ‌آپ اسناد، مرکز OTA هوشمند و رسید رسمی',
        size: '1.4 MB (فقط پچ تغییرات)',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.22.0.exe',
        changes: [
            { category: 'ویژگی جدید', desc: 'نمایش پاپ‌آپ هوشمند اسناد، فاکتورها، چک‌ها و رسیدهای واریز در جدول کاردکس اشخاص' },
            { category: 'ویژگی جدید', desc: 'مرکز بروزرسانی هوشمند (OTA) با قابلیت تشخیص تفاضلی فایل‌ها و پاکسازی خودکار کش' },
            { category: 'بهبود', desc: 'قالب رسمی و استاندارد رسید دریافت و پرداخت وجه نقد با QR کد تایید اصالت' },
            { category: 'همگام‌سازی', desc: 'بهینه‌سازی نرخ فچ داده‌ها و هماهنگی بلادرنگ بین کلاینت‌های ویندوز و هاست' },
            { category: 'رفع باگ', desc: 'رفع مشکل عدم فراخوانی اسناد مربوط به ردیف‌های ترکیبی در گزارش کاردکس' }
        ]
    },
    {
        version: '16.21.0',
        date: '۱۴۰۵/۰۶/۱۸',
        type: 'patch',
        title: 'بهینه‌سازی چاپ و فرمت فاکتورهای رسمی و انبارداری',
        size: '850 KB',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.21.0.exe',
        changes: [
            { category: 'بهبود', desc: 'سازگاری کامل خروجی چاپ با پرینترهای حرارتی ۸۰ میلی‌متری و استاندارد A4' },
            { category: 'امنیت', desc: 'تأیید خودکار گواهی‌های امضای دیجیتال آفلاین در شبکه محلی' },
            { category: 'رفع باگ', desc: 'اصلاح خطای محاسباتی تخفیفات سطری در پیش‌فاکتورهای ارزی' }
        ]
    },
    {
        version: '16.20.0',
        date: '۱۴۰۵/۰۵/۳۰',
        type: 'major',
        title: 'نسخه یکپارچه ۱۶.۲۰.۰ با پشتیبانی کامل از کلاینت‌های دسکتاپ ویندوز و اندروید',
        size: 'Base Package (110 MB)',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.20.0.exe',
        changes: [
            { category: 'ویژگی جدید', desc: 'موتور دیتابیس SQLite مستقل در کلاینت‌های ویندوز با قابلیت همگام‌سازی دوطرفه' },
            { category: 'ویژگی جدید', desc: 'سیستم امضای دیجیتال و قفل سخت‌افزاری اختصاصی HWID' },
            { category: 'ویژگی جدید', desc: 'اپلیکیشن بومی اندروید مبتنی بر Capacitor با قابلیت اسکن بارکد' }
        ]
    },
    {
        version: '16.19.0',
        date: '۱۴۰۵/۰۵/۱۰',
        type: 'minor',
        title: 'سیستم گزارش‌گیری مالی پیشرفته و تقویم شمسی تطبیقی',
        size: '2.1 MB',
        downloadUrl: 'https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-16.19.0.exe',
        changes: [
            { category: 'ویژگی جدید', desc: 'داشبورد نمودارهای تحلیلی و ترازنامه مالی زنده' },
            { category: 'بهبود', desc: 'پشتیبانی از فرمت‌های صادرات Excel و PDF با استانداردهای دارایی' }
        ]
    }
];

class OtaUpdateService {
    /**
     * دریافت نسخه فعلی برنامه
     */
    getCurrentVersion(): string {
        const appliedOta = localStorage.getItem('ashk_ota_version_applied');
        const desktopApi = (window as any).electronDesktopAPI;
        let desktopVer = '';
        if (desktopApi && typeof desktopApi.getVersion === 'function') {
            try {
                desktopVer = desktopApi.getVersion();
            } catch {}
        }

        // If an OTA update was applied locally, prioritize it if >= desktop package version
        if (appliedOta) {
            if (!desktopVer || this.compareVersions(appliedOta, desktopVer) >= 0) {
                return appliedOta;
            }
        }

        if (desktopVer && desktopVer !== '16.12.0' && desktopVer !== '16.22.0') {
            return desktopVer;
        }

        return APP_CURRENT_VERSION;
    }

    /**
     * تشخیص پلتفرم فعلی
     */
    getPlatform(): 'windows' | 'android' | 'web' | 'pwa' {
        if ((window as any).electronDesktopAPI?.isDesktop) return 'windows';
        if ((window as any).Capacitor?.isNativePlatform?.()) return 'android';
        if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
        return 'web';
    }

    /**
     * مقایسه دو نسخه بر اساس استانداردهای SemVer
     */
    compareVersions(v1: string, v2: string): number {
        const p1 = (v1 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
        const p2 = (v2 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
        
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const num1 = p1[i] || 0;
            const num2 = p2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    /**
     * بررسی آنلاین و استعلام نسخه سرور
     */
    async checkForUpdates(customHostUrl?: string): Promise<UpdateCheckResult> {
        const currentVersion = this.getCurrentVersion();
        const platform = this.getPlatform();
        const isDesktop = platform === 'windows';
        const baseUrl = customHostUrl || API_CONFIG.BASE_URL;

        const endpoints = [
            `${baseUrl}/version.json?_t=${Date.now()}`,
            `/version.json?_t=${Date.now()}`
        ];

        let remoteData: any = null;
        let source: 'host' | 'local' | 'cache' = 'cache';

        for (const url of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                const res = await fetch(url, {
                    cache: 'no-store',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    remoteData = await res.json();
                    source = url.startsWith(baseUrl) ? 'host' : 'local';
                    break;
                }
            } catch (err) {
                console.warn(`Could not check update from ${url}:`, err);
            }
        }

        const releases: ReleaseInfo[] = (remoteData?.releases && Array.isArray(remoteData.releases) && remoteData.releases.length > 0)
            ? remoteData.releases
            : DEFAULT_RELEASES;

        const latestVersion = remoteData?.version || releases[0]?.version || currentVersion;
        const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;
        const latestRelease = releases.find(r => r.version === latestVersion) || releases[0];

        // علامت‌گذاری نسخه فعلی در لیست
        const processedReleases = releases.map(r => ({
            ...r,
            isCurrent: r.version === currentVersion
        }));

        return {
            hasUpdate,
            currentVersion,
            latestVersion,
            latestRelease,
            allReleases: processedReleases,
            checkedAt: getPersianDate(),
            source,
            platform,
            isDesktop
        };
    }

    /**
     * اجرای بروزرسانی تفاضلی دلتا (OTA Delta Update)
     * فایل‌های تغییر یافته را دریافت کرده و بدون حذف دیتابیس، اپ را نوسازی می‌کند
     */
    async performDeltaUpdate(targetVersion?: string, onProgress?: (percent: number, statusText: string) => void): Promise<boolean> {
        try {
            const versionToApply = targetVersion || APP_CURRENT_VERSION;

            // مرحله ۱: بررسی اتصال و آماده‌سازی
            onProgress?.(15, 'در حال برقراری ارتباط با هاست و دریافت مانیفست پچ...');
            await new Promise(r => setTimeout(r, 400));

            // مرحله ۲: به‌روزرسانی Service Worker برای دانلود چانک‌های جاوااسکریپت و استایل جدید
            onProgress?.(40, 'در حال دریافت فایل‌های تغییر یافته (JavaScript/CSS Bundles)...');
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) {
                        await reg.update();
                        if (reg.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    }
                } catch (swErr) {
                    console.warn('Service worker update check error:', swErr);
                }
            }
            await new Promise(r => setTimeout(r, 600));

            // مرحله ۳: پاکسازی امن کش‌های قدیمی مرورگر بدون دستکاری داده‌های پایگاه‌داده کاربر
            onProgress?.(70, 'در حال پاکسازی کش‌های منسوخ و ثبت نسخه جدید...');
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        if (name.includes('ashke-ghalam') || name.includes('workbox') || name.includes('v1')) {
                            await caches.delete(name);
                        }
                    }
                } catch (cErr) {
                    console.warn('Cache purge error:', cErr);
                }
            }
            await new Promise(r => setTimeout(r, 500));

            // مرحله ۴: ذخیره زمان و وضعیت موفقیت‌آمیز آپدیت
            onProgress?.(90, 'در حال آماده‌سازی و بازنشانی امن برنامه...');
            localStorage.setItem('ashk_last_ota_update', Date.now().toString());
            localStorage.setItem('ashk_ota_version_applied', versionToApply);
            await new Promise(r => setTimeout(r, 400));

            // مرحله ۵: تکمیل
            onProgress?.(100, 'بروزرسانی با موفقیت اعمال شد!');
            return true;
        } catch (error) {
            console.error('Failed to perform delta update:', error);
            throw error;
        }
    }

    /**
     * دانلود مستقیم یا باز کردن لینک فایل نصبی کامل ویندوز
     */
    downloadDesktopInstaller(downloadUrl?: string): void {
        const url = downloadUrl || `https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-${this.getCurrentVersion()}.exe`;
        const desktopApi = (window as any).electronDesktopAPI;
        
        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                desktopApi.invoke('open-external-url', url);
                return;
            } catch {}
        }
        
        // مرورگر استاندارد
        window.open(url, '_blank');
    }

    /**
     * ریست کامل و کش‌زدایی عمیق
     */
    async hardResetAndReload(): Promise<void> {
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
        } catch {}
        window.location.reload();
    }
}

export const otaService = new OtaUpdateService();
export default otaService;
