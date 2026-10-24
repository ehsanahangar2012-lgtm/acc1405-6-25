// سرویس مدیریت متون و برچسب‌های تفکیک‌شده بر اساس پلتفرم (ویندوز / اندروید / وب سرور)
import { getAppPlatform, AppPlatform } from '../utils';

export interface PlatformCopyDictionary {
    platformKey: AppPlatform;
    platformTitle: string;
    platformBadge: string;
    welcomeMessage: string;
    storageDescription: string;
    backupHeading: string;
    backupPathDescription: string;
    localDriveName: string;
    printModeTitle: string;
    printInstruction: string;
    syncInstruction: string;
    hardwareIntegrationLabel: string;
    scannerLabel: string;
    signaturePrompt: string;
    shortcutHelp: string;
    offlineModeNotice: string;
    connectionSuccessNotice: string;
    appFooterTagline: string;
    smsRelayPrompt: string;
    exportReportPrompt: string;
}

const WINDOWS_COPY: PlatformCopyDictionary = {
    platformKey: 'windows',
    platformTitle: 'نرم‌افزار جامع حسابداری و مالی اشک قلم (نسخه دسکتاپ ویندوز)',
    platformBadge: 'نسخه مستقل ویندوز (EXE)',
    welcomeMessage: 'به نرم‌افزار حسابداری ویندوز خوش آمدید. داده‌ها بر روی دیتابیس محلی با حداکثر سرعت پردازش می‌شوند.',
    storageDescription: 'دیتابیس فوق‌سریع محلی ویندوز (Local Vault) بدون وابستگی به اینترنت',
    backupHeading: 'پشتیبان‌گیری روی درایو ویندوز و فلش مموری',
    backupPathDescription: 'مسیر ذخیره پشتیبان: پوشه اسناد ویندوز (Documents / AshkeGhalam_Backups) و فلش مموری',
    localDriveName: 'درایو محلی ویندوز',
    printModeTitle: 'چاپ مستقیم با پرینترهای ویندوز (A4, A5, فیش‌پرینتر حرارتی)',
    printInstruction: 'اتصال مستقیم به کلیه درایورهای چاپگر ویندوز (USB/LAN) با امکان چاپ سریع بدون وقفه',
    syncInstruction: 'همگام‌سازی ناهمگام و بدون قفل شدن نرم‌افزار با سرور مرکزی ابری اشک قلم',
    hardwareIntegrationLabel: 'اتصال به پوز بانکی ویندوز و دستگاه بارکدخوان USB/بی‌سیم',
    scannerLabel: 'بارکدخوان تفنگی USB یا اسکنر نوری متصل به رایانه',
    signaturePrompt: 'ثبت امضا با قلم نوری، تبلت گرافیکی یا ماوس در ویندوز',
    shortcutHelp: 'کلیدهای میانبر سریع: F2 (فاکتور جدید) | F5 (تازه‌سازی) | Ctrl+P (چاپ) | Ctrl+S (ذخیره)',
    offlineModeNotice: 'نرم‌افزار در وضعیت محلی ویندوز با بالاترین سرعت و امنیت کار می‌کند.',
    connectionSuccessNotice: 'نرم‌افزار ویندوز به وب‌سرور متصل شد. همگام‌سازی ناهمگام و پرسرعت فعال گردید.',
    appFooterTagline: 'نرم‌افزار دسکتاپ حسابداری اشک قلم • ویژه ویندوز ۷، ۱۰، ۱۱ (۳۲ و ۶۴ بیت)',
    smsRelayPrompt: 'ارسال خودکار پیامک از طریق پل ارتباطی با گوشی اندروید یا خط اختصاصی',
    exportReportPrompt: 'خروجی فایل اکسل (Excel)، پی‌دی‌اف (PDF) و دیتابیس در پوشه خروجی‌های ویندوز'
};

const ANDROID_COPY: PlatformCopyDictionary = {
    platformKey: 'android',
    platformTitle: 'حسابداری همراه اشک قلم (نسخه همراه اندروید)',
    platformBadge: 'نسخه همراه اندروید (APK)',
    welcomeMessage: 'به برنامه حسابداری همراه خوش آمدید. ویژه مدیریت ویزیتوری، فاکتور همراه و انبارگردانی.',
    storageDescription: 'دیتابیس امن حافظه داخلی گوشی موبایل با دسترسی آفلاین کامل',
    backupHeading: 'پشتیبان‌گیری در حافظه گوشی و پیام‌رسان‌ها',
    backupPathDescription: 'مسیر ذخیره: حافظه داخلی گوشی (Download / AshkeGhalam_Mobile) و اشتراک‌گذاری در ایتا/بله/واتساپ',
    localDriveName: 'حافظه داخلی گوشی',
    printModeTitle: 'چاپ فاکتور با پرینترهای همراه بلوتوث و حرارتی جیبی',
    printInstruction: 'اتصال مستقیم با بلوتوث به فیش‌پرینترهای کمری و حرارتی و اشتراک تصویر/PDF فاکتور در شبکه‌های اجتماعی',
    syncInstruction: 'همگام‌سازی بلادرنگ با سرور مرکزی از طریق اینترنت سیمکارت و وای‌فای',
    hardwareIntegrationLabel: 'اسکن بارکد با دوربین گوشی، موقعیت‌یاب مشتری و پوز موبایلی',
    scannerLabel: 'اسکن سریع بارکد کالا با دوربین پشتی تلفن همراه',
    signaturePrompt: 'امضای مستقیم مشتری با انگشت یا قلم لمسی بر روی صفحه گوشی',
    shortcutHelp: 'دستورات لمسی: کشیدن به راست (منو) | لمس طولانی روی ردیف (عملیات سریع) | دوبار لمس (ویرایش)',
    offlineModeNotice: 'برنامه اندروید کاملاً آفلاین کار می‌کند؛ در صورت اتصال اینترنت داده‌ها خودکار همگام می‌شوند.',
    connectionSuccessNotice: 'اپلیکیشن اندروید به سرور مرکزی متصل شد؛ انتقال داده‌ها و پیامک فعال است.',
    appFooterTagline: 'حسابداری همراه اشک قلم • ویژه گوشی‌ها و تبلت‌های اندروید و پوزهای هوشمند اندرویدی',
    smsRelayPrompt: 'ارسال مستقیم پیامک از سیمکارت گوشی همراه با تعرفه عادی به شماره مشتری',
    exportReportPrompt: 'اشتراک‌گذاری گزارش و فاکتور به صورت PDF و عکس در ایتا، بله، تلگرام و واتساپ'
};

const WEB_COPY: PlatformCopyDictionary = {
    platformKey: 'web',
    platformTitle: 'سامانه ابری و وب‌سرویس جامع حسابداری اشک قلم',
    platformBadge: 'سامانه ابری و سرور مادر (Cloud Web)',
    welcomeMessage: 'به پنل ابری و متمرکز حسابداری اشک قلم خوش آمدید. دسترسی چندکاربره از سراسر کشور.',
    storageDescription: 'دیتابیس متمرکز ابری با رمزنگاری پیشرفته و سرورهای توزیع‌شده',
    backupHeading: 'پشتیبان‌گیری ابری خودکار و دریافت فایل پایگاه‌داده',
    backupPathDescription: 'ذخیره خودکار در فضای ذخیره‌سازی ابری ایمن با قابلیت دانلود فوری نسخه پشتیبان',
    localDriveName: 'پایگاه داده ابری سرور',
    printModeTitle: 'چاپ استاندارد ابری و تولید فایل‌های PDF باکیفیت بالا',
    printInstruction: 'پشتیبانی از پرینت مستقیم مرورگر در تمام ابعاد A4, A5 و فیش سازگار با انواع چاپگرها',
    syncInstruction: 'ارتباط مستقیم و پیوسته با پایگاه‌داده اصلی سامانه ابری',
    hardwareIntegrationLabel: 'اتصال از طریق درگاه‌های وب‌سرویس و وب‌هوک‌های مالیاتی سامانه مودیان',
    scannerLabel: 'بارکدخوان وب و ورودی هوشمند کد کالا',
    signaturePrompt: 'امضای دیجیتال رسمی با گواهی الکترونیک یا پد امضا در مرورگر',
    shortcutHelp: 'میانبرهای وب: Alt+N (سند جدید) | Alt+S (جستجو) | Ctrl+P (پیش‌نمایش چاپ)',
    offlineModeNotice: 'حالت پشتیبان مرورگر فعال است؛ به محض اتصال مجدد، تغییرات با سرور ادغام می‌شوند.',
    connectionSuccessNotice: 'ارتباط آنلاین پایدار با سرور مرکزی ابری برقرار است.',
    appFooterTagline: 'سامانه ابری حسابداری اشک قلم • دسترسی ۲۴/۷ از هر مرورگر و دستگاه در سراسر کشور',
    smsRelayPrompt: 'ارسال پیامک از خطوط خدماتی ابری یا از طریق پل متصل به برنامه اندروید',
    exportReportPrompt: 'دانلود فوری گزارش‌ها با فرمت‌های Excel ،PDF و JSON سازگار با سامانه‌های مالیاتی'
};

export class PlatformCopyService {
    static getCopy(platform?: AppPlatform): PlatformCopyDictionary {
        const currentPlatform = platform || getAppPlatform();
        switch (currentPlatform) {
            case 'android':
                return ANDROID_COPY;
            case 'windows':
                return WINDOWS_COPY;
            case 'pwa':
            case 'web':
            default:
                return WEB_COPY;
        }
    }

    static getPlatformName(platform?: AppPlatform): string {
        return this.getCopy(platform).platformTitle;
    }

    static getStorageLabel(platform?: AppPlatform): string {
        return this.getCopy(platform).storageDescription;
    }

    static getBackupPrompt(platform?: AppPlatform): string {
        return this.getCopy(platform).backupHeading;
    }

    static getShortcuts(platform?: AppPlatform): string {
        return this.getCopy(platform).shortcutHelp;
    }
}
