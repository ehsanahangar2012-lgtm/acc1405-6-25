import React, { useState } from 'react';
import { 
  Sparkles, Printer, Copy, Check, ExternalLink, 
  Layers, Landmark, CreditCard, Brain, Boxes, 
  Calendar, FileSignature, BarChart3, Send, ShieldCheck, 
  Lock, FileText
} from 'lucide-react';
import { isDesktopApp } from '../utils';

export const CatalogPage: React.FC = () => {
  const isDesktop = isDesktopApp();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/catalog.html');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const catalogPages = [
    {
      pageNumber: 1,
      tag: 'روی جلد',
      title: 'معرفی سامانه یکپارچه حسابداری اشک قلم',
      subtitle: 'کارکرد ۱۰۰٪ آفلاین با همگام‌سازی ابری و گزارش‌های تحلیلی پیشرفته',
      description: 'نسل جدید نرم‌افزارهای مالی که بدون قطعی اینترنت، ثبت سریع فاکتورها و تحلیل‌های هوشمند مالی را روی ویندوز، مک و موبایل فراهم می‌سازد.',
      cta: 'مدیریت مالی بدون مرز را از امروز تجربه کنید.',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      icon: Sparkles,
      image: '/images/page1.jpg',
      mockupData: {
        header: 'ASHK GHALAM ACC v16.15.0',
        status: '● آماده / آفلاین-اول',
        metrics: [
          { label: 'فروش کل ماه', val: '۴۲۵,۰۰۰,۰۰۰ تومان', color: 'text-teal-300' },
          { label: 'سود خالص سودآوری', val: '۳۲٪', color: 'text-emerald-400' },
          { label: 'چک‌های فعال', val: '۸ فقره', color: 'text-amber-300' },
          { label: 'کالا در انبار', val: '۱,۴۲۰ قلم', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 2,
      tag: 'معماری سیستم',
      title: 'کسب‌وکارتان با قطعی اینترنت تعطیل نمی‌شود!',
      subtitle: 'پایگاه‌داده محلی سریع روی مرورگر/دسکتاپ (IndexedDB)',
      description: 'ثبت بی‌وقفه اسناد بدون نیاز به اینترنت. با وصل شدن شبکه، اطلاعات بدون تداخل روی Cloud Vault همگام‌سازی می‌شوند.',
      cta: 'بدون دغدغه قطعی شبکه، با سرعت فاکتور بزنید.',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Layers,
      image: '/images/page2.jpg',
      mockupData: {
        header: 'موتور همگام‌سازی ابری (Cloud Vault Engine)',
        status: '⚡ ذخیره محلی + سینک پس از اتصال',
        metrics: [
          { label: 'دیتابیس محلی', val: 'IndexedDB (Dexie)', color: 'text-emerald-300' },
          { label: 'رمزنگاری داده‌ها', val: 'AES-256 Encrypted', color: 'text-teal-300' },
          { label: 'سرعت ذخیره‌سازی', val: '< ۵ میلی‌ثانیه', color: 'text-amber-300' },
          { label: 'حل تعارض', val: 'Timestamp High-Priority', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 3,
      tag: 'امنیت لایسنس',
      title: 'خداحافظی با دانگل‌های فیزیکی دست‌وپاگیر',
      subtitle: 'قفل هوشمند دیجیتال سخت‌افزاری بر پایه HWID',
      description: 'اعتبارسنجی امن لایسنس با اثرانگشت یکتای سیستم و امضای رمزنوشت HMAC-SHA256 بدون نیاز به قطعه فیزیکی جانبی.',
      cta: 'همین امروز لایسنس دیجیتال خود را آنی دریافت کنید.',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Lock,
      image: '/images/page3.jpg',
      mockupData: {
        header: 'لایسنس سخت‌افزاری (Device Binding)',
        status: '🛡️ HMAC-SHA256 Validated',
        metrics: [
          { label: 'کد HWID', val: 'AG-WIN-89A4-F29D', color: 'text-cyan-300' },
          { label: 'نوع اعتبار', val: 'دائمی (مادام‌العمر)', color: 'text-emerald-400' },
          { label: 'سقف اسناد', val: 'نامحدود', color: 'text-teal-300' },
          { label: 'وضعیت قفل', val: 'فعال / دیجیتال', color: 'text-amber-300' }
        ]
      }
    },
    {
      pageNumber: 4,
      tag: 'فروش و کارتخوان',
      title: 'صدور فاکتور و ارسال مستقیم به کارتخوان',
      subtitle: 'حذف کامل خطای انسانی کاربر در وارد کردن مبالغ',
      description: 'اتصال به پوز بانکی (PC-POS) جهت بستن مستقیم فاکتور روی دستگاه کارتخوان به همراه چاپ سریع فیش حرارتی ۸۰mm.',
      cta: 'خطای انسانی در ورود مبالغ به کارتخوان را به صفر برسانید.',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: CreditCard,
      image: '/images/page4.jpg',
      mockupData: {
        header: 'سامانه کارتخوان بانکی (PC-POS Terminal)',
        status: '💳 ارسال مستقیم وجه فاکتور',
        metrics: [
          { label: 'شماره فاکتور', val: '#1024', color: 'text-amber-300' },
          { label: 'مبلغ قابل پرداخت', val: '۱,۸۵۰,۰۰۰ تومان', color: 'text-emerald-400' },
          { label: 'وضعیت ترکنش', val: 'موفق (کارتخوان سامانه)', color: 'text-teal-300' },
          { label: 'چاپ فاکتور', val: 'حرارتی ۸۰mm', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 5,
      tag: 'سامانه مؤدیان',
      title: 'تکالیف مالیاتی شما، سریع‌تر و آسان‌تر',
      subtitle: 'ارسال مستقیم فاکتورها به سازمان امور مالیاتی',
      description: 'مدیریت کلیدهای عمومی و خصوصی RSA، محاسبه خودکار عوارض و ارزش افزوده و ارسال بدون هزینه نرم‌افزار واسط.',
      cta: 'بدون جریمه مالیاتی و هزینه واسطه فاکتور ارسال کنید.',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: Landmark,
      image: '/images/page5.jpg',
      mockupData: {
        header: 'ماژول مستقیم سامانه مؤدیان (Tax Hub)',
        status: '🏛️ تایید شده در سازمان امور مالیاتی',
        metrics: [
          { label: 'کد مالیاتی (Tax ID)', val: 'A12BC34-5678-90DE', color: 'text-rose-300' },
          { label: 'وضعیت فاکتور', val: 'استعلام موفق / تایید شده', color: 'text-emerald-400' },
          { label: 'ارزش افزوده', val: '۱۰٪ محاسبه خودکار', color: 'text-teal-300' },
          { label: 'کلید RSA', val: 'اختصاصی / محلی', color: 'text-amber-300' }
        ]
      }
    },
    {
      pageNumber: 6,
      tag: 'سامانه تحلیل مالی',
      title: 'موتور ارزیابی و تحلیل هوشمند کسب‌وکار',
      subtitle: 'تحلیل دقیق عملکردهای مالی و شاخص‌های کلیدی سودآوری',
      description: 'ارزیابی سود و زیان، تحلیل الگوی خرید مشتریان و پیش‌بینی نقدینگی هفته‌های آتی توسط دپارتمان IT اشک قلم.',
      cta: 'کسب‌وکارتان را بر اساس گزارش‌های تخصصی و آماری هدایت کنید.',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: Brain,
      image: '/images/page6.jpg',
      mockupData: {
        header: 'مرکز محاسبات و تحلیل مالی اشک قلم',
        status: '● دپارتمان IT اشک قلم',
        metrics: [
          { label: 'تحلیل نقدینگی', val: 'پیش‌بینی کسری ۱۲م برای هفته بعد', color: 'text-indigo-300' },
          { label: 'پیشنهاد هوشمند', val: 'پیگیری مطالبات فاکتور #1012', color: 'text-emerald-400' },
          { label: 'ارزیابی ریسک', val: 'سطح ایمن (پایین)', color: 'text-teal-300' },
          { label: 'الگوی خریداران', val: 'رشد خریدهای عمده کاغذ', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 7,
      tag: 'انبارداری چابک',
      title: 'تسلط کامل بر موجودی ریالی و کالاها',
      subtitle: 'کنترل دقیق انبار، انبارگردانی و نقطه سفارش',
      description: 'جلوگیری از انباشت یا کسر موجودی کالا با سیستم سیستم هشدار خودکار، تعریف بارکد و حواله انبار.',
      cta: 'با کنترل هوشمند انبار، سودآوری خود را حداکثر کنید.',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      icon: Boxes,
      image: '/images/page7.jpg',
      mockupData: {
        header: 'مدیریت انبار و انبارگردانی (Inventory Hub)',
        status: '📦 موجودی لحظه‌ای و هوشمند',
        metrics: [
          { label: 'کالای بحرانی', val: 'کاغذ گلاسه (۵ عدد باقی‌مانده)', color: 'text-rose-400' },
          { label: 'ارزش ریالی انبار', val: '۸۵۰,۰۰۰,۰۰۰ تومان', color: 'text-emerald-400' },
          { label: 'ورود با بارکد', val: 'اسکنر USB / بی‌سیم', color: 'text-teal-300' },
          { label: 'تعداد تنوع کالا', val: '۳۴۰ قلم فعال', color: 'text-amber-300' }
        ]
      }
    },
    {
      pageNumber: 8,
      tag: 'چک و اقساط',
      title: 'مدیریت چک صیادی و سررسید اقساط',
      subtitle: 'پیشگیری از برگشت چک و کنترل نقدینگی',
      description: 'زنجیره کامل گردش چک (ثبت، وصول، برگشت، خرج چک) با تقویم خورشیدی سررسید و جستجوی صیادی.',
      cta: 'نقدینگی و چک‌های خود را با اطمینان خاطر مدیریت کنید.',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Calendar,
      image: '/images/page8.jpg',
      mockupData: {
        header: 'مدیریت چک و تقویم سررسید (Cheque Calendar)',
        status: '📅 تقویم جلالی سررسید اسناد',
        metrics: [
          { label: 'چک نزدیک سررسید', val: 'بانک ملی #8841 (۵۰م)', color: 'text-purple-300' },
          { label: 'وضعیت اسناد', val: 'در جریان وصول', color: 'text-emerald-400' },
          { label: 'استعلام صیادی', val: 'تایید ثبت شده', color: 'text-teal-300' },
          { label: 'هشدارهای پیامکی', val: 'فعال برای خریدار', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 9,
      tag: 'امضای الکترونیکی',
      title: 'ثبت امضای آنلاین و تایید پیامکی (OTP)',
      subtitle: 'بستن قراردادها بدون نیاز به مراجعه حضوری',
      description: 'دریافت امضای لمسی روی بوم گرافیکی، ارسال کد تایید OTP و محاسبه هش SHA-256 جهت جلوگیری از دستکاری قرارداد.',
      cta: 'قراردادهای خود را در لحظه و از راه دور نهایی کنید.',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: FileSignature,
      image: '/images/page9.jpg',
      mockupData: {
        header: 'سیستم امضا و مدیریت قراردادها (Contracts Hub)',
        status: '✍️ امضای آنلاین با OTP پیامکی',
        metrics: [
          { label: 'وضعیت امضا', val: 'تایید شده با SMS OTP', color: 'text-emerald-400' },
          { label: 'هش قرارداد', val: 'SHA256: e3b0c44298fc1c14...', color: 'text-cyan-300' },
          { label: 'ثبت زمان (Timestamp)', val: '۱۴۰۵/۰۲/۱۵ - ۱۱:۳۰', color: 'text-teal-300' },
          { label: 'امضای طرفین', val: 'کامل / رسمی', color: 'text-amber-300' }
        ]
      }
    },
    {
      pageNumber: 10,
      tag: 'گزارشات و اکسل',
      title: 'گزارشات کامل مالی و خروجی اکسل',
      subtitle: 'شفافیت ۳۶۰ درجه سود و زیان و ترازنامه‌ها',
      description: 'دسترسی سریع به دفاتر معین و کل، تراز ۴ ستونی، گزارش سود و زیان و استخراج فوری فایل Excel تنها با یک کلیک.',
      cta: 'تنها با یک کلیک گزارشات مالی خود را به اکسل منتقل کنید.',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: BarChart3,
      image: '/images/page10.jpg',
      mockupData: {
        header: 'مرکز گزارشات پیشرفته (Financial Reports)',
        status: '📊 خروجی استاندارد Excel & PDF',
        metrics: [
          { label: 'گزارش سود و زیان', val: '+۱۲۸,۵۰۰,۰۰۰ تومان', color: 'text-emerald-400' },
          { label: 'تراز معین', val: 'تراز ۴ ستونی کاملاً متوازن', color: 'text-blue-300' },
          { label: 'سرعت خروجی', val: 'فوری / بدون افت فریم', color: 'text-teal-300' },
          { label: 'بهینه‌سازی رندر', val: 'Lazy Loading Active', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 11,
      tag: 'جدول مقایسه',
      title: 'اشک قلم در برابر نرم‌افزارهای سنتی',
      subtitle: 'برتری در تکنولوژی، کارکرد آفلاین و سادگی کاربری',
      description: 'مقایسه شفاف امکانات جدید اشک قلم با نرم‌افزارهای قدیمی و پیچیده موجود در بازار.',
      cta: 'ارتقا به نسل جدید نرم‌افزارهای مالی را از امروز آغاز کنید.',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: ShieldCheck,
      image: '/images/page11.jpg',
      mockupData: {
        header: 'جدول مقایسه تکنولوژی (Comparison Matrix)',
        status: '⭐ برتری مطلق در امکانات نسل جدید',
        metrics: [
          { label: 'کارکرد آفلاین کامل', val: '✔ اشک قلم (آفلاین-اول)', color: 'text-emerald-400' },
          { label: 'دانگل سخت‌افزاری', val: '❌ بی‌نیاز (HWID Digital)', color: 'text-teal-300' },
          { label: 'سامانه مؤدیان داخلی', val: '✔ بدون هزینه واسط', color: 'text-amber-300' },
          { label: 'نصب روی همه دستگاه‌ها', val: '✔ PWA + Desktop', color: 'text-cyan-300' }
        ]
      }
    },
    {
      pageNumber: 12,
      tag: 'پشت جلد',
      title: 'ارتباط با ما و ثبت سفارش لایسنس',
      subtitle: 'پشتیبانی سریع در پیام‌رسان ایتا و دریافت مشاوره',
      description: 'جهت دریافت لایسنس کلاینت‌ها، استعلام قیمت و دریافت پشتیبانی مستقیم با تیم ما در ایتا در ارتباط باشید.',
      cta: 'جهت دریافت مشاوره و فعال‌سازی با ما در ایتا در ارتباط باشید.',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Send,
      image: '/images/page12.jpg',
      mockupData: {
        header: 'ارتباط با پشتیبانی اشک قلم (Eitaa Messenger)',
        status: '💬 پاسخگویی سریع تیم فنی',
        metrics: [
          { label: 'آدرس کانال ایتا', val: '@ashkghalamco', color: 'text-cyan-300' },
          { label: 'لینک مستقیم', val: 'web.eitaa.com/#@ashkghalamco', color: 'text-teal-300' },
          { label: 'پشتیبانی لایسنس', val: 'فعال‌سازی آنی HWID', color: 'text-emerald-400' },
          { label: 'ساعات پاسخگویی', val: 'پشتیبانی دائمی', color: 'text-amber-300' }
        ]
      }
    }
  ];

  const professionalMessages = [
    { title: 'انضباط مالی و سامانه مؤدیان', text: 'با ماژول داخلی سامانه مؤدیان در اشک قلم، فاکتورهای فروش خود را مستقیماً و بدون هزینه نرم‌افزارهای واسط به سازمان امور مالیاتی ارسال کنید.' },
    { title: 'معماری مدرن Offline-First', text: 'ثبت اسناد در پایگاه‌داده محلی بدون وابستگی به اینترنت، و همگام‌سازی خودکار و رمزنگاری‌شده ابری به محض اتصال به شبکه.' },
    { title: 'قفل هوشمند HWID بدون دانگل', text: 'با دانگل‌های فیزیکی USB و خطرات مفقودی آن‌ها خداحافظی کنید؛ سیستم لایسنس دیجیتال HWID امنیت شما را تضمین می‌کند.' },
    { title: 'تحلیل دقیق و گزارش‌های پیشرفته', text: 'داده‌های مالی خود را به راهکارهای عملیاتی تبدیل کنید؛ سامانه تحلیل داده بخش IT اشک قلم روند سود و نقدینگی را شفاف می‌سازد.' },
    { title: 'امضای آنلاین و تایید پیامکی OTP', text: 'فرایند بستن قراردادها را با ثبت امضای لمسی، محاسبه هش امنیتی SHA-256 و اعتبارسنجی OTP پیامکی سرعت ببخشید.' }
  ];

  const retailerMessages = [
    { title: 'حسابداری بدون اینترنت', text: 'حتی اگر اینترنت کشور کاملاً قطع شود، اشک قلم بدون کوچک‌ترین وقفه‌ای کار می‌کند. فاکتور بزنید و انبار را مدیریت کنید!' },
    { title: 'ارسال مستقیم به کارتخوان', text: 'دیگر قیمت را دستی روی کارتخوان نزنید؛ با یک کلیک در اشک قلم، مبلغ فاکتور مستقیماً روی دستگاه کارتخوان می‌افتد.' },
    { title: 'سررسید چک‌ها فراموش نمی‌شود', text: 'چک‌های دریافتی و پرداختی را روی تقویم شمسی ببینید تا حساب‌هایتان را پر کنید و چکتان برگشت نخورد.' },
    { title: 'فاکتور بزنید و فوری چاپ کنید', text: 'از فیش‌پرینتر حرارتی تا پرینترهای A4 و A5؛ فاکتور مشتری را سریع و با ظاهر شیک چاپ کنید.' },
    { title: 'حسابداری روی گوشی و لپ‌تاپ', text: 'فرقی نمی‌کند پشت مغازه باشید یا در سفر؛ همیشه و همه‌جا حساب و کتاب مغازه‌تان دستتان است.' }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12 dir-rtl">
      {/* Top Action Bar */}
      <div className="no-print bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-teal-500/20">
            ✍️
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              کاتالوگ و شناسنامه رسمی اشک قلم
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">v16.15.0</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">معرفی کامل ۱۲ صفحه ویژگی‌ها، مشخصات فنی و پیام‌های تبلیغاتی</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-teal-400" />
            <span>پرینت / دانلود PDF</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copiedLink ? 'لینک فایل کپی شد!' : 'کپی لینک HTML'}</span>
          </button>

          <a
            href="/catalog.html"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-amber-400" />
            <span>مشاهده فایل HTML مجزا</span>
          </a>

          <a
            href="https://web.eitaa.com/#@ashkghalamco"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-teal-500/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>پشتیبانی در ایتا</span>
          </a>
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-4 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>شناسنامه فنی و مستندات رسمی بازاریابی محصول</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white leading-snug">
          سامانه یکپارچه حسابداری و مدیریت <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400">«اشک قلم»</span>
        </h2>

        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl mx-auto">
          معماری پیشرفته <strong className="text-teal-300">Offline-First</strong> (ثبت بی‌وقفه اسناد بدون اینترنت)، لایسنس دیجیتال سخت‌افزاری <strong className="text-teal-300">HWID</strong> بدون دانگل فیزیکی، اتصال مستقیم به کارتخوان بانکی، سامانه مؤدیان و ماژول‌های توسعه‌یافته توسط دپارتمان IT اشک قلم | www.ashkghalam.ir.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto pt-4 text-right">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] text-slate-400">معماری سیستم</div>
            <div className="text-xs font-bold text-teal-300 mt-1">۱۰۰٪ آفلاین + ابری</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] text-slate-400">امنیت لایسنس</div>
            <div className="text-xs font-bold text-teal-300 mt-1">امضای دیجیتال HWID</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] text-slate-400">سامانه مؤدیان</div>
            <div className="text-xs font-bold text-teal-300 mt-1">اتصال مستقیم و داخلی</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] text-slate-400">تیم توسعه و پشتیبانی</div>
            <div className="text-xs font-bold text-teal-300 mt-1">دپارتمان IT اشک قلم | www.ashkghalam.ir</div>
          </div>
        </div>
      </div>

      {/* 12-Page Grid Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span>صفحات ۱۲گانه کاتالوگ محصول</span>
          </h3>
          <span className="text-xs text-slate-400">نمای تفکیکی تمام صفحات کاتالوگ</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogPages.map((page, idx) => {
            const Icon = page.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 hover:border-teal-500/50 rounded-3xl p-5 space-y-4 transition duration-300 flex flex-col justify-between shadow-lg group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-400">صفحه {page.pageNumber} از ۱۲</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${page.badgeColor}`}>
                      {page.tag}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white group-hover:text-teal-300 transition flex items-center gap-2">
                    <Icon className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>{page.title}</span>
                  </h4>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {page.description}
                  </p>

                  {/* Mockup Preview Box */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px]">
                      <span className="text-teal-300 font-bold">{page.mockupData.header}</span>
                      <span className="text-emerald-400 font-sans">{page.mockupData.status}</span>
                    </div>

                    {(page as any).image && (
                      <div className="relative overflow-hidden rounded-xl border border-slate-800 my-1">
                        <img src={(page as any).image} alt={page.title} className="w-full h-28 object-cover group-hover:scale-105 transition duration-500" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 font-sans">
                      {page.mockupData.metrics.map((m, mIdx) => (
                        <div key={mIdx} className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                          <div className="text-slate-400 text-[9px]">{m.label}</div>
                          <div className={`font-bold mt-0.5 ${m.color}`}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-400">فراخوان اقدام (CTA):</div>
                  <div className="text-xs text-slate-300 italic">«{page.cta}»</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Marketing Messages Section */}
      <div className="space-y-6 pt-6">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-400" />
          <span>پیام‌های تبلیغاتی آماده و تأییدشده</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Professional Messages */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-teal-400 flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              <span>۵ پیام تبلیغاتی حرفه‌ای / سازمانی</span>
            </h4>

            <div className="space-y-3">
              {professionalMessages.map((msg, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>{msg.title}</span>
                    <button
                      onClick={() => handleCopyText(msg.text, idx)}
                      className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIndex === idx ? 'کپی شد' : 'کپی متن'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Retailer Messages */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>۵ پیام ساده (مختص صاحبان کسب‌وکار و فروشگاه‌ها)</span>
            </h4>

            <div className="space-y-3">
              {retailerMessages.map((msg, idx) => {
                const globalIndex = idx + 100;
                return (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{msg.title}</span>
                      <button
                        onClick={() => handleCopyText(msg.text, globalIndex)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedIndex === globalIndex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedIndex === globalIndex ? 'کپی شد' : 'کپی متن'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{msg.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Call To Action Banner */}
      <div className="bg-gradient-to-r from-teal-900/40 via-slate-900 to-emerald-900/40 border border-teal-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-right">
        <div className="space-y-1">
          <h4 className="text-base font-bold text-white">نیازمند فعال‌سازی لایسنس یا دریافت اطلاعات بیشتر هستید؟</h4>
          <p className="text-xs text-slate-300">پشتیبانی رسمی اشک قلم در پیام‌رسان ایتا آماده پاسخگویی به کلیه درخواست‌های شماست.</p>
        </div>

        <a
          href="https://web.eitaa.com/#@ashkghalamco"
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-900/30 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>ارسال پیام به ashkghalamco@ در ایتا</span>
        </a>
      </div>
    </div>
  );
};

export default CatalogPage;
