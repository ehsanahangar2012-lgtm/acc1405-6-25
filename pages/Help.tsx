import React, { useState } from 'react';
import { 
    HelpCircle, BookOpen, Key, Zap, Cloud, Bot, ShieldCheck, 
    FileText, Package, Banknote, Users, MessageCircle, Monitor, Smartphone,
    Terminal, Download, CheckCircle2, Copy, RefreshCw, Layers, ArrowLeftRight,
    HardDrive, Cpu, Code, Calculator, CheckSquare, Sparkles, Scale, Landmark,
    CreditCard, Network, AlertCircle, ArrowRight, ChevronDown, ChevronUp, Search,
    PhoneCall, Send, Headphones, Globe
} from 'lucide-react';
import { getPersianDate, toPersianDigits, isDesktopApp, getAppPlatform } from '../utils';
import { PlatformContentService } from '../services/platformContentService';

export const Help = () => {
    const isDesktop = isDesktopApp();
    const currentPlatform = getAppPlatform();
    const [activeTab, setActiveTab] = useState<'platform' | 'accounting-guide' | 'modules' | 'shortcuts' | 'faq'>(
        'platform'
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
                '۱. در بخش چک‌ها، چک جدید را با شناسه صیادی، نام بانک، مبلغ و تاریخ سررسید ثبت کنید.',
                '۲. سیستم ۳ روز قبل از موعد سررسید در پیشخوان و لیست چک‌ها وضعیت زرد هشدار را نمایش می‌دهد.',
                '۳. در صورت وصول چک، روی دکمه «وصول» کلیک کنید تا سند حسابداری و افزایش موجودی بانک خودکار ثبت شود.',
                '۴. قابلیت انتقال چک به شخص ثالث (خرج چک) با یک کلیک و ثبت زنجیره انتقال فراهم است.'
            ],
            tip: 'نکته طلایی: وضعیت چک به صورت اتوماتیک در گزارش گردش حساب شخص و تراز مالی منعکس می‌گردد.'
        },
        {
            id: 'finance',
            title: 'اسناد دوبل، دریافت/پرداخت و دفاتر (General Ledger)',
            icon: Landmark,
            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
            summary: 'صدور اسناد دوبل با رعایت بالانس بدهکار/بستانکار، مدیریت حساب‌های بانکی و صندوق‌ها، کدینگ کل/معین/تفصیلی و تراز آزمایشی.',
            steps: [
                '۱. تمامی فاکتورها و دریافت/پرداخت‌ها به طور خودکار سند دوبل متناظر را ایجاد می‌کنند.',
                '۲. برای ثبت هزینه‌های جاری (اجاره، حقوق، آب و برق)، از منوی امور مالی «ثبت هزینه/دریافت» را انتخاب فرمایید.',
                '۳. در بخش تراز آزمایشی می‌توانید برابری گردش بدهکار و بستانکار کل و معین را در هر بازه زمانی ارزیابی کنید.'
            ],
            tip: 'نکته طلایی: موتور انطباق مالی از ثبت اسناد ناتراز جلوگیری می‌کند تا ترازنامه شما همواره استاندارد و دقیق باشد.'
        },
        {
            id: 'customers',
            title: 'اشخاص، مشتریان و پرونده مالی (CRM & Ledger)',
            icon: Users,
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            summary: 'ثبت اطلاعات هویتی و مالیاتی اشخاص، سقف اعتبار، ریز صورتحساب طرف‌حساب، ارسال پیامک مانده و لینک پرداخت.',
            steps: [
                '۱. اشخاص را در دسته‌های مشتری، تأمین‌کننده، یا پرسنل با کد اقتصادی/ملی تعریف کنید.',
                '۲. برای هر مشتری سقف اعتبار تعیین کنید تا در صورت بدهی بیش از حد مجاز، سیستم هشدار دهد.',
                '۳. با فشردن دکمه «پرونده مالی»، کاردکس ریز خریدها، واریزی‌ها و مانده نهایی شخص را در قالب PDF چاپ یا ارسال کنید.'
            ],
            tip: 'نکته طلایی: ارسال صورتحساب به صورت لینک آنلاین از طریق پیامک یا واتساپ برای مشتری مقدور است.'
        }
    ];

    const shortcutsList = [
        { key: 'Alt + 1', desc: 'انتقال سریع به پیشخوان اصلی (Dashboard)' },
        { key: 'Alt + 2', desc: 'ورود به بخش فاکتورها و صدور فاکتور جدید' },
        { key: 'Alt + 3', desc: 'انتقال به انبارداری و لیست کالاها' },
        { key: 'Alt + 4', desc: 'ورود به مدیریت خزانه‌داری و چک‌های صیادی' },
        { key: 'Alt + 5', desc: 'ورود به امور مالی، حساب‌ها و اسناد دوبل' },
        { key: 'Alt + 6', desc: 'انتقال به دفتر اشخاص و طرف‌حساب‌ها' },
        { key: 'Alt + S', desc: 'ثبت و ذخیره سریع فرم یا سند فعال' },
        { key: 'Alt + P', desc: 'ارسال سند جاری به چاپگر و پیش‌نمایش پرینت' },
        { key: 'Esc', desc: 'بستن پنجره‌ها و مودال‌های فعال' }
    ];

    const faqs = [
        {
            q: 'آیا نرم‌افزار بدون اینترنت (آفلاین) کار می‌کند؟',
            a: 'بله، ۱۰۰٪. نرم‌افزار حسابداری اشک قلم دارای پایگاه داده محلی مستقل است و کلیه عملیات ثبت فاکتور، انبار، پرینت و گزارشات بدون نیاز به اینترنت با نهایت سرعت انجام می‌شود. به محض اتصال به اینترنت، اطلاعات به صورت امن با سرور همگام خواهند شد.'
        },
        {
            q: 'چگونه پیامک فاکتور را بدون هزینه برای مشتری ارسال کنم؟',
            a: 'در نسخه موبایل اندروید یا با انتخاب گزینه «ارسال با سیم‌کارت گوشی»، سیستم مستقیماً برنامه پیامک گوشی شما را با متن آماده و لینک صورتحساب باز می‌کند و می‌توانید با سیم‌کارت خود بدون کسر شارژ پنل ارسال فرمایید.'
        },
        {
            q: 'آیا سرعت سیستم در نسخه ویندوز با اتصال به سرور کاهش می‌یابد؟',
            a: 'خیر. در نسخه جدید، تمامی عملیات همگام‌سازی به صورت غیرمسدودکننده (Non-blocking) و در زمان‌های بیکاری سیستم در پس‌زمینه اجرا می‌شوند؛ بنابراین کار با فرم‌ها و باز کردن صفحات همواره با سرعت 0ms و حداکثر فریم‌ریت انجام می‌شود.'
        },
        {
            q: 'چگونه از اطلاعات حسابداری فایل پشتیبان (بک‌آپ) تهیه کنم؟',
            a: 'از منوی تنظیمات یا پیشخوان روی «مدیریت پشتیبان‌گیری» کلیک کرده و دکمه «پشتیبان‌گیری کامل» را بفشارید. فایل فشرده امن با رمزنگاری اختصاصی در هارد یا حافظه ذخیره می‌شود.'
        }
    ];

    const winDetails = PlatformContentService.getDetails('windows');
    const andDetails = PlatformContentService.getDetails('android');
    const webDetails = PlatformContentService.getDetails('web');

    return (
        <div className="space-y-8 pb-16 animate-fade-in" dir="rtl">
            {/* سربرگ اصلی صفحه راهنما */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
                                <BookOpen size={22} />
                            </div>
                            <span className="text-xs font-black uppercase text-teal-400 tracking-wider">
                                پایگاه دانش و راهنمای تخصصی
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-white">راهنمای جامع سامانه حسابداری اشک قلم</h1>
                        <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
                            مرجع استاندارد کاربری، تفکیک قابلیت‌های ویندوز، اندروید و وب‌سرویس، و کلیدهای میانبر سریع.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href="tel:09120000000"
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition"
                        >
                            <PhoneCall size={15} className="text-teal-400" />
                            <span>پشتیبانی تلفنی</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* تب‌های ناوبری صفحه */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/70 border border-white/5 rounded-2xl">
                <button
                    onClick={() => setActiveTab('platform')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'platform'
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Monitor size={16} /> تفکیک پلتفرم‌ها (ویندوز / اندروید / وب)
                </button>

                <button
                    onClick={() => setActiveTab('accounting-guide')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'accounting-guide'
                            ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-lg'
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
                    <Layers size={16} /> راهنمای ماژول‌ها ({toPersianDigits(accountingModules.length)})
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

            {/* محتوای تفکیک پلتفرم‌ها */}
            {activeTab === 'platform' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* کارت ویندوز دسکتاپ */}
                        <div className="bg-slate-900/90 border border-teal-500/30 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-teal-500/20 text-teal-400 rounded-2xl border border-teal-500/30">
                                    <Monitor size={26} />
                                </div>
                                <span className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
                                    {currentPlatform === 'windows' ? '🟢 نسخه فعال شما' : 'نسخه Win64'}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-white">{winDetails.title}</h3>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{winDetails.subtitle}</p>
                            </div>

                            <div className="space-y-3 pt-2 text-xs text-slate-300">
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-teal-400 block">⚡ معماری پردازش:</strong>
                                    <span>{winDetails.engineDescription}</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-teal-400 block">🖨️ چاپ و تجهیزات جانبی:</strong>
                                    <span>{winDetails.printerCapability}</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-teal-400 block">🔄 همگام‌سازی سرور:</strong>
                                    <span>{winDetails.syncCapability}</span>
                                </div>
                            </div>
                        </div>

                        {/* کارت اندروید موبایل */}
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                    <Smartphone size={26} />
                                </div>
                                <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                    {currentPlatform === 'android' ? '🟢 نسخه فعال شما' : 'نسخه Mobile APK'}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-white">{andDetails.title}</h3>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{andDetails.subtitle}</p>
                            </div>

                            <div className="space-y-3 pt-2 text-xs text-slate-300">
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-emerald-400 block">📱 ارسال پیامک مستقیم (Native SIM):</strong>
                                    <span>{andDetails.smsCapability}</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-emerald-400 block">📷 بارکدخوان و امضا:</strong>
                                    <span>اسکن بارکد با دوربین گوشی و ثبت امضای لمسی خریدار پای فاکتور</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-emerald-400 block">⚡ مصرف دیتا:</strong>
                                    <span>{andDetails.syncCapability}</span>
                                </div>
                            </div>
                        </div>

                        {/* کارت وب و هاست */}
                        <div className="bg-slate-900/90 border border-sky-500/30 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-sky-500/20 text-sky-400 rounded-2xl border border-sky-500/30">
                                    <Globe size={26} />
                                </div>
                                <span className="text-[10px] font-black uppercase text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
                                    {currentPlatform === 'web' ? '🟢 نسخه فعال شما' : 'نسخه Cloud SaaS'}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-white">{webDetails.title}</h3>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{webDetails.subtitle}</p>
                            </div>

                            <div className="space-y-3 pt-2 text-xs text-slate-300">
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-sky-400 block">👥 دسترسی چندکاربره (RBAC):</strong>
                                    <span>تعریف کاربران متعدد با سطوح دسترسی دقیق و نظارت همزمان شعبات</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-sky-400 block">☁️ پشتیبان‌گیری متمرکز:</strong>
                                    <span>ذخیره خودکار بک‌آپ در دیتابیس هاست مرکزی با امنیت کامل</span>
                                </div>
                                <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1">
                                    <strong className="text-sky-400 block">💼 سامانه مودیان:</strong>
                                    <span>تولید کدهای استاندارد مالیاتی و اتصال به کارپوشه سازمان مالیاتی</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* محتوای تب اصول گردش کار حسابداری */}
            {activeTab === 'accounting-guide' && (
                <div className="space-y-6">
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

                            <div className="bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-teal-600/20 text-teal-400 font-black text-sm flex items-center justify-center border border-teal-500/30">
                                    ۲
                                </div>
                                <h3 className="text-sm font-bold text-white">صدور فاکتور</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    صدور فاکتور خرید/فروش و اثرگذاری خودکار بر موجودی انبار و حساب شخص.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-teal-600/20 text-teal-400 font-black text-sm flex items-center justify-center border border-teal-500/30">
                                    ۳
                                </div>
                                <h3 className="text-sm font-bold text-white">خزانه‌داری</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    ثبت دریافت و پرداخت نقدی، کارتخوان بانکی و ثبت چک‌های صیادی.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-teal-600/20 text-teal-400 font-black text-sm flex items-center justify-center border border-teal-500/30">
                                    ۴
                                </div>
                                <h3 className="text-sm font-bold text-white">اسناد دوبل</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    صدور اتوماتیک سند مالی و ثبت هزینه‌ها و استهلاک در سرفصل‌های معین.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-teal-600/20 text-teal-400 font-black text-sm flex items-center justify-center border border-teal-500/30">
                                    ۵
                                </div>
                                <h3 className="text-sm font-bold text-white">گزارشات و بستن</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    گزارش سود و زیان، تراز آزمایشی، ترازنامه، کاردکس و بستن سال مالی.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* محتوای تب ماژول‌ها */}
            {activeTab === 'modules' && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        {accountingModules.map(mod => {
                            const isExpanded = expandedModule === mod.id;
                            const Icon = mod.icon;
                            return (
                                <div 
                                    key={mod.id}
                                    className="bg-slate-900/70 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all shadow-md"
                                >
                                    <div 
                                        onClick={() => toggleModule(mod.id)}
                                        className="p-5 flex items-center justify-between cursor-pointer select-none"
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
