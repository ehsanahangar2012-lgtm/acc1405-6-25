import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  HelpCircle, X, Sparkles, BookOpen, Lightbulb, 
  Keyboard, ShieldCheck, CheckCircle2, ChevronLeft, ArrowRight,
  Search, ExternalLink, Calendar, CreditCard, Landmark, DollarSign,
  TrendingUp, Calculator, Building2, Package, Users, FileText, CheckSquare
} from 'lucide-react';
import { getPersianDate, toPersianDigits } from '../utils';

export interface SectionGuideContent {
  title: string;
  subtitle: string;
  description: string;
  keyFeatures: string[];
  tips?: string[];
  shortcuts?: { key: string; description: string }[];
  aiAdvice?: string;
  path: string;
  icon?: any;
}

export const SECTION_GUIDES: Record<string, SectionGuideContent> = {
  '/login': {
    path: '/login',
    icon: ShieldCheck,
    title: 'ورود به سیستم و همگام‌سازی دستگاه‌ها',
    subtitle: 'احراز هویت امن، ورود چند دستگاهی و تبادل ابری داده‌ها',
    description: 'در این صفحه می‌توانید با نام کاربری و کلمه عبور ثبت‌شده وارد سامانه شوید. اطلاعات کاربران و حساب‌ها به صورت خودکار و امن بین تمام دستگاه‌ها و هاست ابری همگام‌سازی می‌شود.',
    keyFeatures: [
      'همگام‌سازی خودکار و بلادرنگ حساب‌های کاربری با سرور مرکزی ابری',
      'امکان ورود در چندین کامپیوتر، تبلت و گوشی با دیتابیس متمرکز',
      'رمزنگاری امن اطلاعات ورود و دسترسی‌های کاربران',
      'پشتیبانی کامل از کارکرد آفلاین و سینک آنی پس از برقراری اینترنت'
    ],
    tips: [
      'در صورت تعریف کاربر جدید در دستگاه دیگر، دکمه «همگام‌سازی با سرور» را کلیک کنید تا حساب کاربری بارگذاری شود.',
      'پس از ورود در هر دستگاه جدید، تمامی فاکتورها، انبار و اسناد مالی به سرعت از هاست دریافت می‌شوند.'
    ],
    shortcuts: [
      { key: 'Enter', description: 'ورود به سیستم' },
      { key: '?', description: 'باز کردن همین راهنمای هوشمند' }
    ],
    aiAdvice: 'هنگام ورود در یک دستگاه جدید، مطمئن شوید دستگاه به اینترنت متصل است تا آخرین داده‌های ابری بازیابی شوند.'
  },
  '/': {
    path: '/',
    icon: Building2,
    title: 'پیشخوان و داشبورد مدیریتی',
    subtitle: 'نمای کلی از وضعیت کسب‌وکار، گردش مالی و هشدارهای سررسید',
    description: 'در این بخش وضعیت کلی فروش، خریدهای اخیر، مانده حساب مشتریان، سررسید چک‌ها و شاخص‌های مالی به صورت لحظه‌ای قابل مشاهده است.',
    keyFeatures: [
      'نمودار تحلیلی درآمد و هزینه در طول ماه‌های سال شمسی',
      'فهرست هوشمند چک‌های نزدیک به سررسید با امکان اقدام سریع',
      'دسترسی سریع به صدور فاکتور جدید، ثبت دریافت/پرداخت و بررسی انبار',
      'نمایش شاخص‌های کلیدی عملکرد مالی (KPI) به صورت زنده'
    ],
    tips: [
      'برای دسترسی سریع به پیشخوان می‌توانید از کلید میانبر Alt+1 استفاده کنید.',
      'با کلیک روی کارت‌های هشدار، مستقیماً به بخش مدیریت مربوطه هدایت می‌شوید.'
    ],
    shortcuts: [
      { key: 'Alt + 1', description: 'انتقال سریع به پیشخوان' },
      { key: '?', description: 'باز کردن همین راهنمای هوشمند' }
    ],
    aiAdvice: 'ثبت روزانه تمام تراکنش‌ها باعث افزایش دقت تحلیل‌های دپارتمان IT اشک قلم و پیش‌بینی جریان نقدی خواهد شد.'
  },
  '/invoices': {
    path: '/invoices',
    icon: FileText,
    title: 'مدیریت و صدور فاکتورها',
    subtitle: 'صدور، ویرایش، چاپ رسمی، ارسال پیامک و ثبت امضای دیجیتال',
    description: 'این بخش به شما امکان صدور فاکتورهای رسمی و غیررسمی با محاسبه خودکار مالیات بر ارزش افزوده، اعمال تخفیف، ارسال پیامک آنلاین با لینک امضا و پرداخت، و اتصال به کاردکس کالا را می‌دهد.',
    keyFeatures: [
      'صدور فاکتور فروش، خرید، پیش‌فاکتور و برگشت از فروش با پیشوند سفارشی',
      'ارسال خودکار پیامک صورتحساب حاوی لینک پرداخت و امضای آنلاین به خریدار',
      'تولید خودکار سند حسابداری متناظر برای هر فاکتور در سیستم دوبل',
      'امضای دیجیتال مشتری، انباردار و ویزیتور با قالب‌های چاپ استاندارد A4/A5'
    ],
    tips: [
      'هنگام افزودن اقلام، موجودی کالا به صورت زنده نمایش داده می‌شود.',
      'برای تسویه، می‌توانید ترکیبی از پرداخت نقدی و چک‌های صیادی را ثبت نمایید.'
    ],
    shortcuts: [
      { key: 'Alt + 2', description: 'انتقال سریع به بخش فاکتورها' },
      { key: 'Ctrl + P', description: 'چاپ فاکتور انتخاب‌شده' }
    ],
    aiAdvice: 'پیش از تایید نهایی فاکتورهای با مبلغ بالا، گزینه ارسال پیامک را فعال بگذارید تا خریدار سریعاً امضا و واریز را نهایی کند.'
  },
  '/inventory': {
    path: '/inventory',
    icon: Package,
    title: 'انبارداری و مدیریت کالا',
    subtitle: 'کاردکس کالا، نقطه سفارش، حواله انبار و موجودی لحظه‌ای',
    description: 'سیستم انبارداری هوشمند با قابلیت ثبت ورود و خروج، هشدار کسری موجودی، ثبت عکس کالا و گزارش‌گیری چند لایه.',
    keyFeatures: [
      'کاردکس ریالی و تعدادی کالا با محاسبه قیمت میانگین موزون',
      'صدور حواله ورود، خروج و انتقال بین انبارها با امضای انباردار',
      'جستجوی پیشرفته بر اساس بارکد، کد کالا، قفسه و دسته‌بندی'
    ],
    tips: [
      'نقطه سفارش (حداقل موجودی) را تنظیم کنید تا سیستم پیش از اتمام کالا هشدار دهد.',
      'با اسکنر بارکد می‌توانید مستقیماً کالاها را در انبار فراخوانی کنید.'
    ],
    shortcuts: [{ key: 'Alt + 3', description: 'انتقال سریع به انبارداری' }]
  },
  '/checks': {
    path: '/checks',
    icon: CheckSquare,
    title: 'مدیریت اسناد دریافتنی و پرداختنی (چک‌ها)',
    subtitle: 'پیگیری چک‌های صیادی، سررسیدها، واگذاری و استعلام',
    description: 'مدیریت یکپارچه چک‌های دریافتی و پرداختی با شناسه صیادی ۱۶ رقمی، تاریخ سررسید شمسی و قابلیت ثبت تصویر چک.',
    keyFeatures: [
      'یادآوری خودکار چک‌های سررسید شده تا ۷ روز آینده',
      'امکان تغییر وضعیت (پاس شده، برگشتی، در جریان، خرج شده)',
      'انتقال و واگذاری چک به همراه ثبت رسید تحویل امضاشده',
      'سوئیچ به نمای تقویم هوشمند روزشمار جهت بررسی بصری بار مالی'
    ],
    tips: [
      'ثبت دقیق شناسه صیاد امکان رهگیری آسان اسناد را فراهم می‌کند.'
    ],
    shortcuts: [{ key: 'Alt + 4', description: 'انتقال سریع به مدیریت چک' }]
  },
  '/due-calendar': {
    path: '/due-calendar',
    icon: Calendar,
    title: 'دفترچه قسط و تقویم شمسی سررسید',
    subtitle: 'نمای جامع روزشمار چک‌های دریافتی، پرداختی و اقساط وام‌ها',
    description: 'تقویم اختصاصی شمسی که سررسید تمامی چک‌های ورودی، خروجی و اقساط ماهانه تسهیلات بانکی را در قالب تقویم و دفترچه قسط متمرکز نمایش می‌دهد.',
    keyFeatures: [
      'مشاهده بار مالی هر روز ماه با رنگ‌بندی تفکیک‌شده (سبز: چک دریافتی، قرمز: پرداختی، زرد: قسط)',
      'دفترچه قسط هوشمند با قابلیت پرداخت اقساط و ثبت سند خودکار',
      'هشدارهای فوری سررسید‌های ۳ روز آینده و محاسبه کسری نقدینگی',
      'خروجی اکسل کامل تعهدات ماه جاری و دوره‌ای'
    ],
    tips: [
      'با کلیک روی هر روز در تقویم، فهرست کامل تعهدات آن روز در کادر بازشونده نمایش می‌یابد.',
      'از دفترچه قسط می‌توانید اقساط را با کسر خودکار از حساب بانکی تسویه کنید.'
    ],
    aiAdvice: 'همواره تراز چک‌های دریافتی و پرداختی هفته آینده را با هم بسنجید تا با کمبود نقدینگی مواجه نشوید.'
  },
  '/finance': {
    path: '/finance',
    icon: Landmark,
    title: 'امور مالی و خزانه‌داری',
    subtitle: 'تراکنش‌های نقدی، حساب‌های بانکی، تنخواه و حقوق و دستمزد',
    description: 'ثبت و پیگیری تمامی دریافت‌ها، پرداخت‌ها، نقل و انتقالات بانکی و تسویه‌های مالی پرسنل.',
    keyFeatures: [
      'مدیریت حساب‌های بانکی، صندوق و کارت‌خوان‌ها',
      'محاسبه و پرداخت حقوق، پاداش و کسورات پرسنل',
      'صورتحساب دقیق مالی با قابلیت خروجی اکسل و PDF'
    ],
    shortcuts: [{ key: 'Alt + 5', description: 'انتقال سریع به امور مالی' }]
  },
  '/customers': {
    path: '/customers',
    icon: Users,
    title: 'اشخاص و طرف‌های حساب',
    subtitle: 'مشتریان، تامین‌کنندگان، بازاریابان و کاردکس استاندارد حساب',
    description: 'ثبت پرونده کامل مشتریان، سقف اعتبار، مانده بدهی/طلبکاری، کاردکس استاندارد حسابرسی و خروجی اکسل رسمی.',
    keyFeatures: [
      'خروجی اکسل کاردکس استاندارد حسابداری با تراز معین و شناسه ملی',
      'ارسال پیامک صورت‌حساب و مانده بدهی با الگوهای قانونی و پیگیری',
      'دسته‌بندی اشخاص به مشتری، همکار، ویزیتور و تامین‌کننده',
      'گزارش جامع گردش حساب با تفکیک فاکتورها، چک‌ها و پرداخت‌ها'
    ],
    shortcuts: [{ key: 'Alt + 6', description: 'انتقال سریع به اشخاص' }]
  },
  '/reports': {
    path: '/reports',
    icon: TrendingUp,
    title: 'گزارشات و تحلیل‌های مدیریتی',
    subtitle: 'صورت سود و زیان دوره‌ای، تراز مالی و خروجی اکسل رسمی',
    description: 'تولید گزارش‌های تحلیلی و مالی منطبق با استانداردهای حسابداری با فیلترهای تاریخی شمسی و فرمت استاندارد سازمان حسابرسی.',
    keyFeatures: [
      'صورت سود و زیان دوره‌ای (ماهانه، فصلی، سالانه) با خروجی استاندارد اکسل',
      'تحلیل بهای تمام‌شده کالای فروش‌رفته (COGS) و هزینه‌های عملیاتی',
      'گزارش فصلی مالیات بر ارزش افزوده و خرید/فروش فصلی ماده ۱۶۹',
      'چاپ رسمی و خروجی مستقیم کاربرگ مالیاتی'
    ],
    shortcuts: [{ key: 'Alt + 7', description: 'انتقال سریع به گزارشات' }]
  },
  '/loans': {
    path: '/loans',
    icon: CreditCard,
    title: 'مدیریت تسهیلات و وام‌ها',
    subtitle: 'ثبت وام‌های دریافتی، محاسبه جدول اقساط و ثبت سند خودکار',
    description: 'محاسبه فرمول سود بانکی، ایجاد خودکار جدول سررسید اقساط، اتصال به تقویم شمسی و تسویه منظم از حساب‌های بانکی.',
    keyFeatures: [
      'محاسبه دقیق سود و کارمزد به روش بانکی',
      'جدول زمان‌بندی اقساط با تاریخ شمسی و شناسه پرداخت',
      'انتقال مستقیم به تقویم تعهدات و دفترچه قسط'
    ]
  },
  '/tax': {
    path: '/tax',
    icon: Calculator,
    title: 'مدیریت مالیات و سامانه مودیان',
    subtitle: 'ارزش افزوده، گزارشات فصلی و ثبت کارپوشه مالیاتی',
    description: 'محاسبه خودکار مالیات بر ارزش افزوده (۱۰٪)، تهیه فایل الکترونیکی گزارشات فصلی و کنترل تکالیف قانونی.',
    keyFeatures: [
      'تفکیک مالیات بر ارزش افزوده خرید و فروش',
      'تطبیق با کارپوشه سامانه مودیان مالیاتی',
      'گزارش استاندارد ماده ۱۶۹ مکرر قانون مالیات‌های مستقیم'
    ]
  },
  '/cashflow': {
    path: '/cashflow',
    icon: DollarSign,
    title: 'مدیریت جریان نقدینگی (Cash Flow)',
    subtitle: 'پیش‌بینی ورودی و خروجی نقدینگی و مدیریت ریسک مالی',
    description: 'تحلیل توان نقدینگی شرکت در افق‌های زمانی ۳۰، ۶۰ و ۹۰ روزه بر اساس فاکتورهای باز، چک‌ها و تعهدات.',
    keyFeatures: [
      'نمودار پیش‌بینی مانده نقدینگی روزانه',
      'شبیه‌سازی سناریوهای تاخیر در وصول مطالبات',
      'تشخیص زودهنگام روزهای منفی نقدی جهت تمهید استقراض یا وصول'
    ]
  },
  '/bank-reconciliation': {
    path: '/bank-reconciliation',
    icon: Building2,
    title: 'تطبیق و مغایرت‌گیری بانکی',
    subtitle: 'تطبیق اسناد دفاتر با صورتحساب رسمی بانک',
    description: 'بارگذاری صورتحساب بانکی، تطبیق خودکار اقلام باز و کشف اقلام باز و تاخیری جهت بستن حساب‌ها.',
    keyFeatures: [
      'تطبیق خودکار بر اساس مبلغ و تاریخ با خطای قابل تنظیم',
      'کشف چک‌های بین‌راهی و واریزی‌های نامشخص',
      'صدور گزارش رسمی صورت مغایرت بانکی'
    ]
  },
  '/accounting': {
    path: '/accounting',
    icon: BookOpen,
    title: 'حسابداری دوبل و اسناد مالی',
    subtitle: 'کدینگ استاندارد، صدور سند، تراز آزمایشی و دفاتر قانونی',
    description: 'سامانه کامل حسابداری دوبل بر پایه درخت کدینگ حساب‌ها (کل، معین، تفصیلی) همراه با کنترل تراز اسناد.',
    keyFeatures: [
      'صدور اسناد حسابداری دوبل با کنترل بالانس بدهکار و بستانکار',
      'دفتر روزنامه، دفتر کل، دفتر معین و تراز آزمایشی ۴ و ۸ ستونی',
      'تولید خودکار سند برای کلیه عملیات فاکتور و خزانه‌داری'
    ]
  },
  '/settings': {
    path: '/settings',
    icon: ShieldCheck,
    title: 'تنظیمات سامانه و پشتیبان‌گیری',
    subtitle: 'پیکربندی شرکت، فرمت‌های چاپ، اتصال به هاست و امنیت داده‌ها',
    description: 'مدیریت مشخصات حقوقی شرکت، انتخاب واحد پول (ریال/تومان)، پشتیبان‌گیری ابری و محلی و اتصال به اپلیکیشن موبایل.',
    keyFeatures: [
      'پشتیبان‌گیری رمزنگاری‌شده و همگام‌سازی لحظه‌ای با هاست اختصاصی',
      'تنظیم مهر، لوگو، سربرگ و متن پیش‌فرض اسناد',
      'اتصال به اپلیکیشن موبایل اشک قلم از طریق QR Code و وب‌سرویس'
    ],
    shortcuts: [{ key: 'Alt + 9', description: 'انتقال سریع به تنظیمات' }]
  },
  '/catalog': {
    path: '/catalog',
    icon: BookOpen,
    title: 'شناسنامه رسمی و کاتالوگ ۱۲ صفحه‌ای اشک قلم',
    subtitle: 'معرفی جامع ویژگی‌های فنی، آفلاین-اول، سامانه مؤدیان و دپارتمان IT اشک قلم',
    description: 'کاتالوگ مصور ۱۲ صفحه‌ای به همراه پیام‌های تبلیغاتی تأییدشده و قابلیتهای استنادپذیر جهت معرفی به مدیران، حسابداران و صاحبان کسب‌وکار.',
    keyFeatures: [
      'شناسنامه ۱۲ صفحه‌ای مصور و قابل چاپ با فرمت A4 یا دانلود PDF',
      'معرفی معماری Offline-First و دیتابیس محلی IndexedDB برای عدم وابستگی به اینترنت',
      'تشریح لایسنس سخت‌افزاری دیجیتال HWID بدون نیاز به دانگل USB',
      'پیام‌های تبلیغاتی اثربخش ویژه صاحبان اصناف و مدیران مالی'
    ],
    tips: [
      'برای دریافت خروجی جهت چاپ یا ارسال به مشتریان، از دکمه «چاپ / دانلود PDF» استفاده کنید.',
      'همچنین می‌توانید نسخه وب مستقل کاتالوگ را مستقیماً ارسال فرمایید.'
    ]
  },
  '/marketing': {
    path: '/marketing',
    icon: Sparkles,
    title: 'مرکز بازاریابی و تولید محتوا',
    subtitle: 'پوسترها، پست‌های شبکه‌های اجتماعی و کاتالوگ اختصاصی',
    description: 'ابزار ویژه برای نمایندگان و تیم‌های بازاریابی جهت استخراج بنرها، پست‌ها و کاتالوگ‌های معرفی محصولات اشک قلم.',
    keyFeatures: [
      'دسترسی به پیام‌های تبلیغاتی کوتاه‌برد و بلندبرد',
      'مشخصات فنی استاندارد قابل درج در مناقصات و کاتالوگ‌ها',
      'ارتباط مستقیم با پشتیبانی ایتا جهت دریافت نمایندگی'
    ]
  },
  '/help': {
    path: '/help',
    icon: HelpCircle,
    title: 'مرکز آموزش، مستندات و وب‌سرویس‌ها',
    subtitle: 'راهنمای ساخت فایل EXE ویندوز، اتصال برنامه‌های اندرویدی و کلیدهای میانبر',
    description: 'آموزش‌های کاربردی گام‌به‌گام برای تمامی ماژول‌های سامانه، راهنمای ساخت فایل اجرایی مستقل ویندوز (EXE) و پروتکل تبادل مستقیم داده‌ها با اندروید.',
    keyFeatures: [
      'راهنمای گام‌به‌گام خروجی فایل اجرایی مستقل EXE برای ویندوز',
      'مستندات کامل REST API جهت سینک دوطرفه با پروژه‌های اندرویدی (فاکتورها، حواله‌ها، کالاها)',
      'پاسخ به سوالات پرتکرار و ارتباط مستقیم با پشتیبانی در واتساپ'
    ]
  }
};

export const SmartSectionGuide: React.FC<{ customPath?: string }> = ({ customPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = customPath || location.pathname;

  // باز کردن راهنما با کلید میانبر '?' یا 'Shift + /' یا 'F1'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // اگر کاربر داخل فیلد متنی تایپ می‌کند، مانع باز شدن شویم
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      
      if (!isInput && (e.key === '?' || (e.shiftKey && e.key === '/') || e.key === 'F1')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ریست کردن مسیر انتخابی هنگام باز شدن مجدد
  useEffect(() => {
    if (isOpen) {
      setSelectedPath(currentPath);
      setSearchQuery('');
    }
  }, [isOpen, currentPath]);

  // یافتن راهنمای متناسب
  const activePath = selectedPath || currentPath;
  const guide = SECTION_GUIDES[activePath] || SECTION_GUIDES['/'] || {
    path: '/',
    title: 'سامانه ابری اشک قلم',
    subtitle: 'راهنمای هوشمند این بخش',
    description: 'شما در حال مشاهده یکی از بخش‌های تخصصی سامانه ابری اشک قلم هستید. تمامی عملیات بر پایه تاریخ شمسی و استانداردهای حسابداری انجام می‌پذیرد.',
    keyFeatures: [
      'ذخیره‌سازی هوشمند و همگام‌سازی آنی با هاست',
      'پشتیبانی از امضای دیجیتال و چاپ استاندارد',
      'قابلیت اتصال به اپلیکیشن‌های همراه و وب‌سرویس'
    ],
    tips: [
      'از دکمه‌های میانبر و نوار ناوبری راست‌چین برای سرعت عمل بیشتر استفاده کنید.'
    ]
  };

  const currentDate = getPersianDate();

  // فیلتر کردن راهنماها برای جستجو
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return Object.values(SECTION_GUIDES).filter(g => 
      g.title.toLowerCase().includes(q) || 
      g.subtitle.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <>
      {/* دکمه trigger راهنمای هوشمند */}
      <button
        id="smart-guide-trigger"
        onClick={() => setIsOpen(true)}
        className="relative group px-2 py-0.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/25 text-teal-400 border border-teal-500/30 transition-all duration-300 active:scale-95 shadow-xs flex items-center justify-center gap-1 cursor-pointer"
        title="راهنمای هوشمند این بخش (کلید میانبر ? یا F1)"
        aria-label="راهنمای هوشمند"
      >
        <HelpCircle size={13} className="transition-transform group-hover:rotate-12 text-teal-300" />
        <span className="text-[10px] font-black hidden sm:inline">راهنمای بخش</span>
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping absolute -top-0.5 -right-0.5" />
      </button>

      {/* مودال راهنمای هوشمند بخش */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in" 
          dir="rtl"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-slate-900 border border-teal-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg text-white font-black text-xl shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{guide.title}</h3>
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold">
                      نسخه ۱۵.۸.۰ (آفلاین کامل)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{guide.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="بستن (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* نوار جستجوی سریع بین تمام بخش‌ها */}
            <div className="pt-3 pb-1 relative z-10">
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در راهنمای سایر بخش‌ها (فاکتور، انبار، چک، تقویم، سود و زیان...)"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* نتایج جستجو */}
              {searchQuery && (
                <div className="mt-2 max-h-36 overflow-y-auto space-y-1 bg-slate-950/90 p-2 rounded-xl border border-teal-500/20 text-xs">
                  {filteredGuides.length > 0 ? (
                    filteredGuides.map((g) => (
                      <button
                        key={g.path}
                        onClick={() => {
                          setSelectedPath(g.path);
                          setSearchQuery('');
                        }}
                        className={`w-full text-right p-2 rounded-lg flex items-center justify-between transition-colors ${activePath === g.path ? 'bg-teal-600/30 text-teal-300 font-bold' : 'hover:bg-white/5 text-slate-300'}`}
                      >
                        <span>{g.title}</span>
                        <span className="text-[10px] text-slate-400">{g.subtitle}</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-center text-slate-500 text-xs">بخشی با این عنوان یافت نشد.</div>
                  )}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="py-4 overflow-y-auto space-y-5 custom-scrollbar text-right relative z-10 flex-1 pr-1 pl-1">
              {/* Description Card */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed">
                {guide.description}
              </div>

              {/* Key Features */}
              <div>
                <h4 className="text-xs font-black text-teal-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <CheckCircle2 size={16} /> امکانات و قابلیت‌های اصلی:
                </h4>
                <ul className="space-y-2">
                  {guide.keyFeatures.map((feat, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips & Recommendations */}
              {guide.tips && guide.tips.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <Lightbulb size={16} /> نکات کاربردی و بهینه‌سازی:
                  </h4>
                  <div className="space-y-2">
                    {guide.tips.map((tip, idx) => (
                      <div key={idx} className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                        💡 {tip}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard Shortcuts */}
              {guide.shortcuts && guide.shortcuts.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <Keyboard size={16} /> کلیدهای میانبر:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {guide.shortcuts.map((sc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/5 text-xs">
                        <span className="text-slate-400">{sc.description}</span>
                        <kbd className="px-2 py-1 bg-white/10 text-white rounded font-mono text-[11px] font-bold">
                          {sc.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Advice */}
              {guide.aiAdvice && (
                <div className="bg-gradient-to-r from-teal-950/50 to-indigo-950/50 border border-teal-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <Sparkles size={20} className="text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-teal-300 mb-1">پیشنهاد هوشمند سامانه:</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{guide.aiAdvice}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-4 flex items-center justify-between text-[11px] text-slate-500 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-400 font-bold">تاریخ امروز:</span>
                  <span>{toPersianDigits(currentDate)}</span>
                </div>
                {activePath !== currentPath && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate(activePath);
                    }}
                    className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-xs font-bold"
                  >
                    <span>انتقال به این بخش</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartSectionGuide;
