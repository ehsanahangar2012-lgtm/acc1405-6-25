import React, { useState } from 'react';
import { 
    HelpCircle, BookOpen, Key, Zap, Cloud, Bot, ShieldCheck, 
    FileText, Package, Banknote, Users, MessageCircle, Monitor, Smartphone,
    Terminal, Download, CheckCircle2, Copy, RefreshCw, Layers, ArrowLeftRight,
    HardDrive, Cpu, Code, Calculator, CheckSquare, Sparkles, Scale, Landmark,
    CreditCard, Network, AlertCircle, ArrowRight, ChevronDown, ChevronUp, Search,
    PhoneCall, Send, Headphones
} from 'lucide-react';
import { getPersianDate, toPersianDigits, isDesktopApp } from '../utils';

export const Help = () => {
    const isDesktop = isDesktopApp();
    const [activeTab, setActiveTab] = useState<'accounting-guide' | 'modules' | 'shortcuts' | 'faq'>(
        'accounting-guide'
    );
    const [expandedModule, setExpandedModule] = useState<string | null>('invoices');
    const [searchQuery, setSearchQuery] = useState('');

    const toggleModule = (id: string) => {
        setExpandedModule(prev => prev === id ? null : id);
    };

    const accountingModules = [
        {
            id: 'invoices',
            title: 'فاکتورها و فروش (Invoices & POS)',
            icon: FileText,
            color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
            summary: 'صدور فاکتور رسمی و غیررسمی، پیش‌فاکتور، حواله انبار، اعمال ارزش‌افزوده و تخفیفات ردیفی، تسویه نقدی/چکی/کارتخوان و چاپ فیش حرارتی و A4/A5.',
            steps: [
                '۱. در منوی فاکتورها، روی دکمه «فاکتور فروش جدید» کلیک کنید یا کلید Alt+2 را بفشارید.',
                '۲. خریدار را از لیست انتخاب کرده یا با یک کلیک شخص جدید اضافه فرمایید.',
                '۳. اقلام کالا را با جستجوی نام یا بارکدخوان انتخاب کنید؛ قیمت واحد، تعداد و تخفیف را مشخص نمایید.',
                '۴. نحوه تسویه را مشخص کنید (نقدی، چک صیادی، یا اتصال مستقیم به کارتخوان PC-POS).',
                '۵. با کلید Alt+S فاکتور را فوراً ثبت و در صورت نیاز پرینت رسمی یا امضای دیجیتال اخذ فرمایید.'
            ],
            tip: 'نکته طلایی: برای مشتریان اعتباری، در صورتی که مبلغ تسویه صفر باشد، سیستم خودکار مبلغ را به عنوان مانده بدهکاری در حساب شخص ثبت می‌کند.'
        },
        {
            id: 'inventory',
            title: 'انبارداری، کالاها و کاردکس (Inventory)',
            icon: Package,
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            summary: 'کنترل دقیق موجودی کالاها، ثبت نقطه سفارش، قیمت‌گذاری میانگین، گزارش کاردکس ریالی و تعدادی و انتقال بین انبارها.',
            steps: [
                '۱. کالاها را با کدینگ، بارکد، واحد سنجش و قیمت خرید/فروش تعریف کنید.',
                '۲. برای هر کالا «نقطه سفارش» تعیین کنید تا در زمان کمبود کالا در پیشخوان هشدار دریافت نمایید.',
                '۳. با ثبت فاکتور خرید، موجودی به صورت خودکار افزایش و با فاکتور فروش کاهش می‌یابد.',
                '۴. برای مشاهده تاریخچه ورود و خروج هر کالا، به بخش «کاردکس کالا» در منوی انبار مراجعه فرمایید.'
            ],
            tip: 'نکته طلایی: قابلیت واردسازی و خروجی اکسل در بخش انبار امکان بروزرسانی قیمت صدها کالا را در چند ثانیه فراهم می‌سازد.'
        },
        {
            id: 'checks',
            title: 'خزانه‌داری، چک صیادی و بانک (Treasury & Checks)',
            icon: Banknote,
            color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            summary: 'مدیریت چک‌های دریافتی و پرداختی با کد صیاد ۱۶ رقمی، خواباندن به حساب، وصول، خرج چک، استعلام شناسه صیادی و هشدار موعد سررسید.',
            steps: [
                '۱. چک‌های دریافتی یا صادره را با شناسه صیادی، تاریخ سررسید، مبلغ و بانک ثبت کنید.',
                '۲. وضعیت هر چک را می‌توانید به «نزد صندوق»، «در جریان وصول»، «وصول‌شده»، «خرج‌شده» یا «برگشتی» تغییر دهید.',
                '۳. در صورت خواباندن چک به حساب بانکی، سند حسابداری انتقال از صندوق به بانک خودکار صادر می‌شود.',
                '۴. در پیشخوان روزانه، چک‌های سررسید امروز و روزهای آینده به رنگ برجسته هشدار داده می‌شوند.'
            ],
            tip: 'نکته طلایی: با ثبت چک در بخش تسویه فاکتور، وضعیت حساب مشتری و شماره چک مستقیماً به فاکتور متصل می‌گردد.'
        },
        {
            id: 'moadian',
            title: 'سامانه مؤدیان و کارپوشه مالیاتی (Moadian Tax Hub)',
            icon: Calculator,
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            summary: 'ارسال آنلاین صورتحساب‌های الکترونیکی به سامانه امور مالیاتی با الگوریتم ورهوف، کلید خصوصی RSA، شناسه حافظه مالیاتی و استعلام وضعیت صورتحساب.',
            steps: [
                '۱. در منوی سامانه مؤدیان، شناسه یکتای حافظه مالیاتی و کلید خصوصی شرکت را وارد کنید.',
                '۲. فاکتورهای فروش تأیید شده را با شناسه کالا و خدمات مالیاتی (۱۳ رقمی) تطبیق دهید.',
                '۳. با کلیک روی «ارسال به کارپوشه مالیاتی»، صورتحساب با الگوریتم ورهوف رمزنگاری و به سازمان ارسال می‌شود.',
                '۴. شناسه ۲۲ رقمی مالیاتی اختصاص یافته و وضعیت تأیید/ابطال در جدول زنده نمایش می‌یابد.'
            ],
            tip: 'نکته طلایی: سیستم به طور خودکار شماره منحصر به فرد مالیاتی ۲۲ رقمی را مطابق آخرین استاندارد ۱۴۰۳ تولید می‌کند.'
        },
        {
            id: 'pos',
            title: 'کارتخوان بانکی متصل به کامپیوتر (PC-POS)',
            icon: CreditCard,
            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
            summary: 'ارسال خودکار مبلغ فاکتور به کارتخوان‌های سداد، به‌پرداخت، سامان‌کیش، پاسارگاد و ایران‌کیش جهت حذف خطای انسانی و تسویه فوق‌سریع.',
            steps: [
                '۱. در منوی کارتخوان بانکی (PC-POS)، مدل PSP و پورت اتصال (LAN یا کابل سریال COM) را تنظیم کنید.',
                '۲. در زمان صدور فاکتور یا دریافت وجه، دکمه «ارسال به کارتخوان» را فشار دهید.',
                '۳. مشتری کارت می‌کشد و رمز را وارد می‌کند؛ پس از موفقیت، شماره پیگیری و ارجاع در فاکتور ثبت می‌شود.'
            ],
            tip: 'نکته طلایی: نیازی به وارد کردن دستی مبلغ توسط صندوق‌دار نیست و خطر اشتباه در صفرهای مبلغ به صفر می‌رسد.'
        },
        {
            id: 'backup-lan',
            title: 'گاوصندوق ابری و شبکه محلی چندکاربره (Cloud & LAN)',
            icon: Cloud,
            color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
            summary: 'پشتیبان‌گیری رمزنگاری‌شده روزانه و کار همزمان چند کاربر در فروشگاه با قفل هوشمند اسناد جهت پیشگیری از بازنویسی داده‌ها.',
            steps: [
                '۱. در منوی گاوصندوق ابری (Cloud Vault)، پشتیبان‌گیری خودکار روزانه را فعال کنید تا همواره نسخه امن ذخیره شود.',
                '۲. در محیط‌های با چند سیستم، از ماژول «شبکه محلی چندکاربره» جهت همگام‌سازی لحظه‌ای استفاده فرمایید.',
                '۳. سیستم به طور خودکار قفل ویرایش روی فاکتور در حال تغییر قرار می‌دهد تا از تداخل چند کاربر جلوگیری شود.'
            ],
            tip: 'نکته طلایی: در حالت آفلاین کامل نیز تمامی تراکنش‌ها ثبت شده و به محض اتصال شبکه خودکار همگام می‌گردند.'
        }
    ];

    const shortcutsList = [
        { key: 'Alt + 1', desc: 'انتقال سریع به پیشخوان مدیریتی (Dashboard)' },
        { key: 'Alt + 2', desc: 'صدور و مدیریت فاکتورهای فروش و خرید' },
        { key: 'Alt + 3', desc: 'انبارداری، کاردکس و کنترل موجودی کالاها' },
        { key: 'Alt + 4', desc: 'خزانه‌داری و مدیریت چک‌های صیادی' },
        { key: 'Alt + 5', desc: 'مدیریت اشخاص، طرف‌حساب‌ها و بدهکار/بستانکار' },
        { key: 'Alt + 6', desc: 'گزارشات جامع سود و زیان، دفاتر و ترازنامه' },
        { key: 'Alt + 7', desc: 'دستیار هوش مصنوعی تحلیل مالی' },
        { key: 'Alt + 8', desc: 'مدیریت کاربران و سطوح دسترسی (RBAC)' },
        { key: 'Alt + 9', desc: 'تنظیمات عمومی، شرکت و سال مالی' },
        { key: 'Alt + S', desc: 'ذخیره و ثبت فوری فاکتور/سند در حال ویرایش' },
        { key: 'Ctrl + P', desc: 'چاپ فاکتور یا سند با قالب اختصاصی شرکت' },
        { key: 'Esc', desc: 'بستن پنجره‌ها و مودال‌های باز جاری' }
    ];

    const faqs = [
        {
            q: 'چگونه سال مالی جدید باز کنم و مانده حساب‌ها را انتقال دهم؟',
            a: 'از منوی «تنظیمات و سیستم» گزینه «سال مالی» را انتخاب کنید. پس از وارد کردن عنوان سال جدید (مثلا ۱۴۰۴)، با زدن دکمه «بستن حساب‌ها و صدور سند افتتاحیه»، تمام مانده‌حساب‌ها، موجودی انبار و چک‌های باز به صورت اتوماتیک به سال جدید منتقل می‌شوند.'
        },
        {
            q: 'آیا در صورت قطع اینترنت اطلاعات برنامه ذخیره می‌شود؟',
            a: 'بله، نرم‌افزار اشک قلم کاملاً آفلاین-اول (Offline First) طراحی شده است. تمام اطلاعات در دیتابیس امن محلی سیستم شما ذخیره شده و هیچ وابستگی حیاتی به اتصال اینترنت ندارد.'
        },
        {
            q: 'نحوه اعمال تخفیف ردیفی و کلی در فاکتور چگونه است؟',
            a: 'در جدول اقلام فاکتور می‌توانید برای هر قلم کالا درصد یا مبلغ تخفیف مشخص کنید. همچنین در انتهای فاکتور کادر «تخفیف کلی» وجود دارد که به صورت خودکار از جمع ناخالص کسر می‌گردد.'
        },
        {
            q: 'چطور می‌توانم لوگو و مشخصات فروشگاه را روی سربرگ فاکتور قرار دهم؟',
            a: 'به منوی «تنظیمات عمومی» -> «اطلاعات شرکت/فروشگاه» بروید. در آنجا می‌توانید لوگو، نام تجاری، شماره ثبت، تلفن، آدرس و متن پاورقی فاکتور را به راحتی تنظیم کنید.'
        }
    ];

    const filteredModules = accountingModules.filter(m => 
        m.title.includes(searchQuery) || 
        m.summary.includes(searchQuery) || 
        m.steps.some(s => s.includes(searchQuery))
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20" dir="rtl">
            {/* هدر صفحه آموزش و راهنما */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl gap-4">
                <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold">
                        <Sparkles size={14} /> مرجع جامع آموزشی و راهنمای کاربری نرم‌افزار
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        آموزش حسابداری و راهنمای بخش‌های اشک قلم
                    </h1>
                    <p className="text-slate-400 text-xs md:text-sm font-medium">
                        آشنایی با گردش کار مالی، نحوه صدور اسناد، ماژول‌های تجاری و کلیدهای میانبر
                    </p>
                </div>
                <div className="bg-gradient-to-r from-teal-600 to-indigo-600 p-3.5 rounded-2xl shadow-lg shrink-0">
                    <BookOpen className="text-white" size={28}/>
                </div>
            </header>

            {/* کارت راه‌های ارتباطی و پشتیبانی رسمی */}
            <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-indigo-950/60 border border-teal-500/30 p-5 md:p-6 rounded-[2rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                        <Headphones className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm md:text-base font-black text-white">پشتیبانی فنی، لایسنس و پاسخگویی آنلاین</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                فعال و در دسترس
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                            جهت راهنمایی نصب، فعال‌سازی لایسنس و رفع سوالات فنی حسابداری از طریق ایتا یا تماس تلفنی با کارشناسان ما در ارتباط باشید:
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <a
                        href="tel:09353108763"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-black text-xs border border-slate-700 shadow-md transition"
                    >
                        <PhoneCall size={16} />
                        <span className="font-mono text-sm">۰۹۳۵۳۱۰۸۷۶۳</span>
                    </a>
                    <a
                        href="https://eitaa.com/ashkghalamCo"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs shadow-lg shadow-teal-900/40 transition"
                    >
                        <Send size={16} />
                        <span>پیام در ایتا: @ashkghalamCo</span>
                    </a>
                </div>
            </div>

            {/* تب‌های اصلی صفحه راهنما */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/70 border border-white/5 rounded-2xl">
                <button
                    onClick={() => setActiveTab('accounting-guide')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'accounting-guide'
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Scale size={16} /> اصول گردش کار حسابداری
                </button>

                <button
                    onClick={() => setActiveTab('modules')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'modules'
                            ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Layers size={16} /> راهنمای گام‌به‌گام ماژول‌ها ({toPersianDigits(accountingModules.length)})
                </button>

                <button
                    onClick={() => setActiveTab('shortcuts')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'shortcuts'
                            ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Key size={16} /> کلیدهای میانبر سریع
                </button>

                <button
                    onClick={() => setActiveTab('faq')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'faq'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <HelpCircle size={16} /> پرسش‌های پرتکرار (FAQ)
                </button>
            </div>

            {/* محتوای تب اصول گردش کار حسابداری */}
            {activeTab === 'accounting-guide' && (
                <div className="space-y-6">
                    {/* کارت چرخه ۵ مرحله‌ای حسابداری */}
                    <div className="bg-slate-900/60 border border-white/5 p-6 md:p-8 rounded-[2rem] space-y-6 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400">
                                <Scale size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-white">چرخه استاندارد عملیات حسابداری در اشک قلم</h2>
                                <p className="text-slate-400 text-xs mt-0.5">مراحل گام‌به‌گام ثبت از تعریف پایه تا ترازنامه و سود و زیان</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2">
                            <div className="bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-teal-600/20 text-teal-400 font-black text-sm flex items-center justify-center border border-teal-500/30">
                                    ۱
                                </div>
                                <h3 className="text-sm font-bold text-white">تعاریف پایه</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    ثبت طرف‌حساب‌ها (مشتریان، تأمین‌کنندگان، پرسنل) و معرفی کالاها با بارکد و قیمت‌ها.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-blue-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-black text-sm flex items-center justify-center border border-blue-500/30">
                                    ۲
                                </div>
                                <h3 className="text-sm font-bold text-white">صدور فاکتور / حواله</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    ثبت فاکتور فروش یا خرید با محاسبه ارزش‌افزوده، تخفیف، بارکدخوان و چاپ فوری.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-amber-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-amber-600/20 text-amber-400 font-black text-sm flex items-center justify-center border border-amber-500/30">
                                    ۳
                                </div>
                                <h3 className="text-sm font-bold text-white">تسویه و خزانه‌داری</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    دریافت وجه از طریق کارتخوان بانکی (PC-POS)، نقد یا ثبت چک صیادی ۱۶ رقمی.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-purple-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 font-black text-sm flex items-center justify-center border border-purple-500/30">
                                    ۴
                                </div>
                                <h3 className="text-sm font-bold text-white">صدور سند اتوماتیک</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    تولید خودکار سند دوبل حسابداری (بدهکار/بستانکار) بدون نیاز به دانش تخصصی مالی.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30">
                                    ۵
                                </div>
                                <h3 className="text-sm font-bold text-white">گزارشات و کارپوشه</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    مشاهده سود و زیان، تراز آزمایشی، کاردکس انبار و ارسال مستقیم به سامانه مؤدیان.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* اصول کلیدی برای مدیریت مالی بدون خطا */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-3xl space-y-4">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                                <CheckCircle2 size={18} /> نکات کلیدی جهت پیشگیری از خطای محاسباتی
                            </div>
                            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                                    <span><strong>تنظیم صحیح واحد پولی:</strong> در تنظیمات مشخص کنید مبالغ با «ریال» یا «تومان» درج شوند تا تمامی محاسبات و گزارشات مطابق واحد انتخابی هماهنگ گردند.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                                    <span><strong>تعیین سقف اعتبار اشخاص:</strong> برای مشتریان نسیه، سقف اعتبار معین کنید تا در زمان ثبت فاکتور فراتر از سقف به صندوق‌دار هشدار داده شود.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                                    <span><strong>نقطه سفارش انبار:</strong> با فعال‌سازی نقطه سفارش، قبل از اتمام موجودی فیزیکی کالا، هشدار خرید دریافت خواهید کرد.</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-3xl space-y-4">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                                <ShieldCheck size={18} /> امنیت اطلاعات و بستن سال مالی
                            </div>
                            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                    <span><strong>پشتیبان‌گیری ابری و فلش:</strong> در پایان هر روز کاری یک فایل خروجی پشتیبان روی حافظه جانبی ذخیره فرمایید یا گزینه گاوصندوق ابری را فعال کنید.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                    <span><strong>سند افتتاحیه و اختتامیه:</strong> در پایان اسفندماه هر سال، با یک کلیک حساب‌های موقت بسته شده و سند افتتاحیه سال جدید خودکار ایجاد می‌شود.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                    <span><strong>سطوح دسترسی کاربران (RBAC):</strong> برای کاربران صندوق، انباردار و حسابدار نقش‌های محدود تعریف کنید تا امنیت اسناد حفظ گردد.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* محتوای تب راهنمای گام‌به‌گام ماژول‌ها */}
            {activeTab === 'modules' && (
                <div className="space-y-4">
                    {/* فیلد جستجوی سریع در ماژول‌ها */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="جستجو در آموزش ماژول‌ها (مثال: فاکتور، چک، مالیات، کارتخوان...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-3.5 pr-12 pl-4 text-white text-xs outline-none focus:border-teal-500 placeholder:text-slate-500"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    </div>

                    <div className="space-y-3">
                        {filteredModules.map((mod) => {
                            const Icon = mod.icon;
                            const isExpanded = expandedModule === mod.id;

                            return (
                                <div 
                                    key={mod.id} 
                                    className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden transition-all shadow-md"
                                >
                                    <div
                                        onClick={() => toggleModule(mod.id)}
                                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-all select-none"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl border ${mod.color}`}>
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">{mod.title}</h3>
                                                <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{mod.summary}</p>
                                            </div>
                                        </div>

                                        <div className="text-slate-500 hover:text-white p-1">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-4 bg-slate-950/40">
                                            <p className="text-xs text-slate-300 leading-relaxed">{mod.summary}</p>

                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                                                    <CheckSquare size={14} /> مراحل اجرایی و نحوه کاربری:
                                                </h4>
                                                <div className="space-y-1.5 pr-2">
                                                    {mod.steps.map((step, idx) => (
                                                        <div key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
                                                            <span className="text-teal-400 font-bold shrink-0">•</span>
                                                            <span className="leading-relaxed">{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-xs text-teal-300 font-medium">
                                                💡 {mod.tip}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* محتوای تب میانبرهای سریع */}
            {activeTab === 'shortcuts' && (
                <div className="bg-slate-900/60 border border-white/5 p-6 md:p-8 rounded-[2rem] space-y-6 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400">
                            <Key size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-white">کلیدهای میانبر صفحه‌کلید (Keyboard Shortcuts)</h2>
                            <p className="text-slate-400 text-xs mt-0.5">افزایش چشمگیر سرعت ثبت فاکتور و گردش در نرم‌افزار بدون نیاز به ماوس</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {shortcutsList.map((item, idx) => (
                            <div 
                                key={idx}
                                className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-2xl border border-white/5 hover:border-teal-500/30 transition-all"
                            >
                                <span className="text-xs text-slate-300 font-medium">{item.desc}</span>
                                <kbd className="px-3 py-1 bg-slate-800 text-teal-400 font-mono text-xs font-bold rounded-lg border border-slate-700 shadow-sm shrink-0">
                                    {item.key}
                                </kbd>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* محتوای تب سوالات پرتکرار (FAQ) */}
            {activeTab === 'faq' && (
                <div className="space-y-4">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl space-y-2 shadow-md">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <HelpCircle size={16} className="text-indigo-400 shrink-0" />
                                {faq.q}
                            </h3>
                            <p className="text-xs text-slate-300 leading-relaxed pr-6">
                                {faq.a}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Help;
