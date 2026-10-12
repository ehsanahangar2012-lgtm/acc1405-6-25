import React, { useState, useEffect } from 'react';
import { 
    Smartphone, Download, CheckCircle2, Zap, Wifi, Shield, 
    Key, Globe, Copy, Check, FileCode, ArrowLeftRight, HelpCircle, RefreshCw, Terminal, ExternalLink, Cloud, Sparkles
} from 'lucide-react';
import { useStore } from '../store';
import { hardwareIdService } from '../services/hardwareIdService';
import { androidCommercialService } from '../services/androidCommercialService';
import { workspaceService } from '../services/workspaceService';

const InstallAndroid: React.FC = () => {
    const { addNotification } = useStore();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [activeTab, setActiveTab] = useState<'apk' | 'pwa' | 'sync' | 'license'>('apk');
    const [copiedCapacitor, setCopiedCapacitor] = useState(false);
    const [copiedBatContent, setCopiedBatContent] = useState(false);
    const [copiedAppUrl, setCopiedAppUrl] = useState(false);
    const [androidHwid, setAndroidHwid] = useState('');
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Host & Sync settings
    const [hostUrl, setHostUrl] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ashk_host_url') || localStorage.getItem('ashk_custom_server_url') || '';
    });
    const [syncToken, setSyncToken] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ashk_host_sync_token') || localStorage.getItem('ashk_cloud_token') || '';
    });

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        hardwareIdService.getHardwareId().then(id => {
            setAndroidHwid(`AND-${id.replace(/[^A-Z0-9]/gi, '').substring(0, 12).toUpperCase()}`);
        });

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallPWA = async () => {
        if (!deferredPrompt) {
            addNotification('info', 'از منوی مرورگر خود گزینه "نصب برنامه" یا "Add to Home Screen" را انتخاب کنید.');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            addNotification('success', 'اپلیکیشن با موفقیت نصب شد.');
        }
        setDeferredPrompt(null);
    };

    const handleSaveAndroidSync = async () => {
        const trimmedUrl = hostUrl.trim();
        const trimmedToken = syncToken.trim();
        if (trimmedUrl) {
            localStorage.setItem('ashk_host_url', trimmedUrl);
            localStorage.setItem('ashk_custom_server_url', trimmedUrl);
        }
        if (trimmedToken) {
            localStorage.setItem('ashk_host_sync_token', trimmedToken);
            localStorage.setItem('ashk_cloud_token', trimmedToken);
        }
        await workspaceService.updateConfig({
            customServerUrl: trimmedUrl,
            workspaceToken: trimmedToken,
            standaloneOfflineMode: false
        }).catch(() => {});
        addNotification('success', 'تنظیمات ارتباط با سرور با موفقیت ذخیره شد.');
    };

    const currentLiveUrl = typeof window !== 'undefined' ? window.location.origin : 'https://acc.yourdomain.ir';

    const handleCopyLiveUrl = () => {
        navigator.clipboard.writeText(currentLiveUrl);
        setCopiedAppUrl(true);
        addNotification('success', 'آدرس اینترنتی وب اپلیکیشن در کلیپ‌بورد کپی شد.');
        setTimeout(() => setCopiedAppUrl(false), 3000);
    };

    const batFileCode = `@echo off
setlocal
chcp 65001 >nul
title AshkeGhalam - Android APK Builder

echo ================================================================
echo   AshkeGhalam Android APK Builder (Capacitor)
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

node scripts/build-apk.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build process encountered an issue.
    pause
    exit /b %errorlevel%
)

echo.
echo Build completed successfully.
pause`;

    const downloadBatDirectly = () => {
        const blob = new Blob([batFileCode], { type: 'application/x-bat;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'build-android-apk.bat';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('success', 'فایل build-android-apk.bat اصلاح‌شده مستقیماً دانلود شد.');
    };

    return (
        <div className="space-y-6 dir-rtl text-right font-sans max-w-7xl mx-auto pb-16">
            {/* Top Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner shrink-0">
                        <Smartphone className="w-9 h-9" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-white">مرکز اختصاصی اپلیکیشن اندروید اشک قلم</h1>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                نسخه ۱۶.۲۲.۰ ۱۰۰٪ مستقل و آفلاین
                            </span>
                            <button
                                onClick={() => setShowHelpModal(true)}
                                className="bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white p-1.5 rounded-xl border border-teal-500/20 transition-all cursor-pointer"
                                title="راهنمای هوشمند خروجی APK"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            تولید فایل نصبی APK اندروید، سایت‌های آنلاین تبدیل فوری، ثبت اسناد آفلاین و همگام‌سازی خودکار ۳ سویه
                        </p>
                    </div>
                </div>

                {/* Device Status Badge */}
                <div className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl text-center shrink-0 w-full md:w-auto">
                    <div className="text-[10px] text-slate-400">شناسه دستگاه اندروید (Android HWID)</div>
                    <div className="text-xs font-mono font-black text-teal-400 tracking-wider mt-0.5 select-all">
                        {androidHwid || 'AND-89F2-A410-BC71'}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
                <button
                    onClick={() => setActiveTab('apk')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'apk'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <FileCode className="w-4 h-4" />
                    <span>خروجی فایل نصبی APK و ابزارهای آنلاین تبدیل</span>
                </button>

                <button
                    onClick={() => setActiveTab('pwa')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'pwa'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Download className="w-4 h-4" />
                    <span>نصب فوری و مستقل (PWA Standalone)</span>
                </button>

                <button
                    onClick={() => setActiveTab('sync')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'sync'
                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>همگام‌سازی ۳ سویه (Android 🔄 Windows 🔄 Web)</span>
                </button>

                <button
                    onClick={() => setActiveTab('license')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'license'
                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Key className="w-4 h-4" />
                    <span>لایسنس و فعال‌سازی تجاری نسخه موبایل</span>
                </button>
            </div>

            {/* TAB: Native APK & Online Builders */}
            {activeTab === 'apk' && (
                <div className="space-y-6 animate-fade-in">
                    {/* SECTION 1: Online Instant APK Builders */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                                    🌐 روش ۱: سایت‌های آنلاین و رایگان ساخت آنی APK (بدون نیاز به نصب هیچ برنامه)
                                </span>
                                <h2 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                                    <Cloud className="text-indigo-400" size={22} />
                                    <span>تبدیل مستقیم آنلاین به فایل نصبی اندروید (APK / AAB)</span>
                                </h2>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    بهترین و بدون دردسرترین راه ساخت فایل نصبی، استفاده از موتورهای ابری است. کافیست آدرس برنامه را وارد کنید و فایل APK آماده را دانلود کنید:
                                </p>
                            </div>

                            {/* Quick copy live URL button */}
                            <button
                                onClick={handleCopyLiveUrl}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-indigo-900/30"
                            >
                                {copiedAppUrl ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                                <span>{copiedAppUrl ? 'آدرس کپی شد' : 'کپی آدرس اینترنتی وب‌اپلیکیشن'}</span>
                            </button>
                        </div>

                        {/* Online Builders Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* PWABuilder (Microsoft) */}
                            <div className="bg-slate-950/80 border border-indigo-500/30 hover:border-indigo-400/60 p-5 rounded-2xl space-y-3 transition flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-white">PWABuilder (مایکروسافت)</span>
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                            رسمی و رایگان
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        معتبرترین سرویس دنیا ساخت شرکت مایکروسافت؛ فقط آدرس برنامه را وارد کرده و خروجی مستقیم پکیج APK یا بسته گوگل‌پلی (AAB) بگیرید.
                                    </p>
                                </div>
                                <a
                                    href="https://www.pwabuilder.com"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="w-full bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-indigo-500/30"
                                >
                                    <span>ورود به pwabuilder.com</span>
                                    <ExternalLink size={13} />
                                </a>
                            </div>

                            {/* WebIntoApp */}
                            <div className="bg-slate-950/80 border border-teal-500/30 hover:border-teal-400/60 p-5 rounded-2xl space-y-3 transition flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-white">WebIntoApp</span>
                                        <span className="text-[9px] bg-teal-500/20 text-teal-300 font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                                            ساخت ۲ دقیقه‌ای
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        تبدیل مستقیم آدرس وب‌سایت یا فایل ZIP پروژه به فایل نصبی APK اندروید با تنظیم آیکون، نام اپ و Splash Screen دلخواه.
                                    </p>
                                </div>
                                <a
                                    href="https://www.webintoapp.com"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="w-full bg-teal-600/30 hover:bg-teal-600 text-teal-200 hover:text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-teal-500/30"
                                >
                                    <span>ورود به webintoapp.com</span>
                                    <ExternalLink size={13} />
                                </a>
                            </div>

                            {/* GitHub Actions Cloud */}
                            <div className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-400/60 p-5 rounded-2xl space-y-3 transition flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-white">GitHub Actions (ابری)</span>
                                        <span className="text-[9px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                                            کامپایل رایگان گیت‌هاب
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        فایل گردش‌کار build-apk.yml در پروژه ایجاد شد. با اکسپورت به گیت‌هاب، سرورهای گیت‌هاب فایل APK را کامپایل و آماده دانلود می‌کنند.
                                    </p>
                                </div>
                                <div className="text-[10px] text-purple-300 bg-purple-500/10 p-2 rounded-lg text-center border border-purple-500/20">
                                    کلیک بر روی Export to GitHub بالای صفحه
                                </div>
                            </div>

                            {/* AppsGeyser */}
                            <div className="bg-slate-950/80 border border-amber-500/30 hover:border-amber-400/60 p-5 rounded-2xl space-y-3 transition flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-white">AppsGeyser</span>
                                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                            نصب با بارکد QR
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        ورود به سایت، قرار دادن آدرس وب‌اپ، تولید فوری فایل نصبی اندروید و امکان دانلود از طریق اسکن بارکد QR در گوشی.
                                    </p>
                                </div>
                                <a
                                    href="https://appsgeyser.com"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="w-full bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-amber-500/30"
                                >
                                    <span>ورود به appsgeyser.com</span>
                                    <ExternalLink size={13} />
                                </a>
                            </div>
                        </div>

                        {/* 3 Step Instruction */}
                        <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Sparkles className="text-amber-400 shrink-0" size={20} />
                                <div>
                                    <span className="font-bold text-white">راهنمای ۳ ثانیه‌ای برای PWABuilder:</span>
                                    <span className="text-slate-400 mr-2">
                                        ۱. روی «کپی آدرس اینترنتی وب‌اپلیکیشن» کلیک کنید. ۲. در سایت pwabuilder.com در کادر آدرس Paste کرده و Start بزنید. ۳. روی دکمه Package for Android کلیک کرده و فایل نصبی را تحویل بگیرید!
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Local Windows Build (Capacitor & Node Script) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-purple-400 font-black uppercase tracking-wider bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                                    💻 روش ۲: بیلد محلی در کامپیوتر با اسکریپت اصلاح‌شده (Node.js & Gradle)
                                </span>
                                <h2 className="text-xl font-black text-white mt-1">تولید خودکار در سیستم با فایل بات اصلاح‌شده (بدون باگ یونیکد)</h2>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    خطای قبلی کاراکترهای ویندوز برطرف شد. اسکریپت جدید به طور مستقیم با موتور پایدار Node.js اجرا شده و فایل APK را تولید می‌کند:
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                                <button
                                    onClick={downloadBatDirectly}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                                >
                                    <Download size={16} />
                                    <span>دانلود فایل جدید build-android-apk.bat</span>
                                </button>
                                <a
                                    href="/build-android-apk.sh"
                                    download="build-android-apk.sh"
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/10"
                                >
                                    <Download size={14} />
                                    <span>دانلود نسخه لینوکس/مک (.sh)</span>
                                </a>
                            </div>
                        </div>

                        {/* How-To Steps */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-purple-600/30 text-purple-400 flex items-center justify-center text-xs">۱</span>
                                    <span>دابل کلیک روی فایل بات</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    فایل <code className="text-purple-300 font-mono">build-android-apk.bat</code> جدید را در پوشه پروژه اجرا کنید. بیلد و خروجی APK خودکار با Node.js اجرا می‌شود.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-teal-600/30 text-teal-400 flex items-center justify-center text-xs">۲</span>
                                    <span>از طریق خط فرمان (NPM)</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    در ترمینال پوشه پروژه دستور زیر را وارد نمایید:
                                    <code className="block mt-1 p-2 bg-slate-900 rounded font-mono text-teal-300 text-left dir-ltr">npm run build:apk</code>
                                </p>
                            </div>

                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">۳</span>
                                    <span>محل ذخیره فایل نصبی</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    فایل APK تولیدشده در ریشه پروژه با نام <code className="text-amber-300 font-mono">AshkeGhalam-Debug.apk</code> کپی و آماده نصب می‌شود.
                                </p>
                            </div>
                        </div>

                        {/* Code Preview */}
                        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Terminal size={16} className="text-purple-400" />
                                    محتوای اسکریپت استاندارد و بدون باگ build-android-apk.bat:
                                </span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(batFileCode);
                                        setCopiedBatContent(true);
                                        addNotification('success', 'محتوای فایل بات در حافظه کپی شد.');
                                        setTimeout(() => setCopiedBatContent(false), 3000);
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
                                >
                                    {copiedBatContent ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span>{copiedBatContent ? 'کپی شد' : 'کپی اسکریپت بات'}</span>
                                </button>
                            </div>
                            <pre className="text-xs font-mono text-purple-300 dir-ltr text-left overflow-x-auto p-4 bg-slate-900/90 rounded-xl leading-relaxed max-h-40 custom-scrollbar">
                                {batFileCode}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: PWA Standalone */}
            {activeTab === 'pwa' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="space-y-2">
                            <span className="text-[10px] text-teal-400 font-black uppercase tracking-wider bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                                🚀 نصب بدون نیاز به بازار و گوگل‌پلی
                            </span>
                            <h2 className="text-xl font-black text-white">نصب مستقیم روی صفحه اصلی گوشی</h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                اپلیکیشن وب پیشرونده (PWA) اشک قلم دارای موتور مستقل ذخیره‌سازی محلی (IndexedDB) بوده و به صورت کامل مانند یک نرم‌افزار نیتیو بدون وابستگی به مرورگر اجرا می‌شود.
                            </p>
                        </div>

                        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-300 font-bold">وضعیت نصب روی این دستگاه:</span>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${isInstalled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                    {isInstalled ? '✔ نصب شده به عنوان اپلیکیشن مستقل' : '⏳ آماده نصب'}
                                </span>
                            </div>

                            <button
                                onClick={handleInstallPWA}
                                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white py-3.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30"
                            >
                                <Download size={18} />
                                <span>نصب مستقیم اپلیکیشن اشک قلم روی صفحه اصلی (Install PWA)</span>
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-teal-400" />
                            <span>مزایای استفاده از نسخه مستقل</span>
                        </h3>
                        <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">•</span>
                                <span>اجرای تمام‌صفحه بدون نوار آدرس مرورگر</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">•</span>
                                <span>ذخیره و پردازش ۱۰۰٪ آفلاین فاکتورها، انبارداری و اسناد</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">•</span>
                                <span>سرعت لود فوق‌العاده بالا به دلیل کش دائمی Service Worker</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">•</span>
                                <span>پشتیبانی کامل از بارکد اسکنر با دوربین گوشی</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {/* TAB: Sync Settings */}
            {activeTab === 'sync' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
                    <div className="space-y-1">
                        <span className="text-[10px] text-teal-400 font-black uppercase tracking-wider bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                            🔄 همگام‌سازی ابری و محلی ۳ سویه
                        </span>
                        <h2 className="text-xl font-black text-white">ارتباط دائمی موبایل با ویندوز و هاست</h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            اطلاعات ثبت‌شده روی موبایل هنگام دسترسی به اینترنت یا شبکه محلی با دیتابیس مرکزی و نرم‌افزار ویندوز تبادل می‌شود.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Globe size={14} className="text-teal-400" />
                                <span>آدرس هاست مرکزی یا سرور محلی (Host URL):</span>
                            </label>
                            <input
                                type="text"
                                value={hostUrl}
                                onChange={(e) => setHostUrl(e.target.value)}
                                placeholder="https://acc.ashkeghalam.ir"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Key size={14} className="text-amber-400" />
                                <span>توکن امنیتی همگام‌سازی (Sync Token):</span>
                            </label>
                            <input
                                type="text"
                                value={syncToken}
                                onChange={(e) => setSyncToken(e.target.value)}
                                placeholder="AG-HOST-VAULT-9821-SYNC-X72A"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                        <button
                            onClick={handleSaveAndroidSync}
                            className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30"
                        >
                            <RefreshCw size={16} />
                            <span>ذخیره تنظیمات و برقراری پیوند همگام‌سازی ۳ سویه</span>
                        </button>

                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>✅ معماری Last-Write-Wins با اولویت زمان ثبت اسناد فعال است.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Mobile License */}
            {activeTab === 'license' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
                    <div className="space-y-1">
                        <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                            🔑 قفل هوشمند سخت‌افزاری اندروید
                        </span>
                        <h2 className="text-xl font-black text-white">فعال‌سازی لایسنس تجاری روی گوشی اندروید</h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            در نسخه اندروید نیز مانند نسخه ویندوز، شناسه اختصاصی دستگاه (Android HWID) استخراج شده و کد فعال‌سازی آفلاین با امضای HMAC-SHA256 تولید می‌گردد.
                        </p>
                    </div>

                    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400">شناسه سخت‌افزاری دستگاه جاری (Android HWID):</div>
                            <div className="text-lg font-black font-mono text-amber-400 tracking-wider mt-1 select-all">
                                {androidHwid}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(androidHwid);
                                addNotification('success', 'شناسه سخت‌افزاری اندروید کپی شد.');
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Copy size={16} />
                            <span>کپی شناسه جهت صدور لایسنس</span>
                        </button>
                    </div>

                    {/* Link to PWA and Mother Server License Card */}
                    <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white flex items-center gap-2">
                                <Globe size={18} className="text-teal-400" />
                                <span>پیوند مستقیم با سیستم PWA و فعال‌سازی با لایسنس سرور اصلی</span>
                            </span>
                            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full font-bold border border-teal-500/30">
                                نسخه ۵۰ سندی ➔ نامحدود
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            این اپلیکیشن پلتفرم همراه و بخشی از سامانه PWA است که در حالت پیش‌فرض با سقف ۵۰ سند فعال می‌شود. با برقراری پیوند، مشخصات لایسنس فعال در سرور اصلی روی این دستگاه اعمال شده و محدودیت سند و مشتری به طور کامل حذف می‌گردد.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                            <button
                                onClick={async () => {
                                    const res = await androidCommercialService.linkToPwaAndActivate(hostUrl, syncToken);
                                    if (res.success) {
                                        addNotification('success', res.message);
                                    } else {
                                        addNotification('error', res.message);
                                    }
                                }}
                                className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30 w-full sm:w-auto"
                            >
                                <RefreshCw size={16} />
                                <span>پیوند به سیستم PWA و فعال‌سازی با لایسنس سرور</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (window.confirm('آیا از بازنشانی کامل دیتابیس به حالت خام محلی اطمینان دارید؟ کلیه اطلاعات ناخواسته حذف و سقف به ۵۰ سند بازمی‌گردد.')) {
                                        androidCommercialService.resetToCleanLocalDatabase();
                                        addNotification('success', 'دیتابیس به حالت کاملاً خام محلی با سقف ۵۰ سند بازنشانی گردید.');
                                    }
                                }}
                                className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 px-5 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                            >
                                <span>🧹 پاکسازی و بازنشانی به داده‌های خام</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Help Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                                <HelpCircle className="text-teal-400" size={20} />
                                <span>راهنمای خروجی فایل نصبی APK و سایت‌های آنلاین</span>
                            </h3>
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                            >
                                <Check size={18} />
                            </button>
                        </div>
                        <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                            <p>
                                🔹 <strong>چرا در AI Studio نمی‌توان مستقیم خروجی APK گرفت؟</strong> کانتینر ابری AI Studio صرفاً محیط اجرای وب و Node.js است و به دلیل حجم سنگین (بیش از ۱۰ گیگابایت)، پکیج‌های Android SDK، جاوا JDK و Gradle در آن نصب نیستند.
                            </p>
                            <p>
                                🔹 <strong>سریع‌ترین روش (سایت‌های آنلاین):</strong> سایت <strong>PWABuilder</strong> (محصول مایکروسافت) یا <strong>WebIntoApp</strong> را باز کنید، آدرس وب‌اپ را در آن کپی کنید و در ۶۰ ثانیه فایل نصبی رسمی APK یا بسته گوگل‌پلی (AAB) را دریافت کنید.
                            </p>
                            <p>
                                🔹 <strong>روش خودکار GitHub Actions:</strong> فایل گردش‌کار <code className="text-purple-300 font-mono">.github/workflows/build-apk.yml</code> به پروژه اضافه شده است. هر بار با گزینه Export to GitHub، سرورهای ابری گیت‌هاب به رایگان فایل نصبی APK را کامپایل و آماده دانلود می‌کنند.
                            </p>
                            <p>
                                🔹 <strong>روش ویندوز با فایل بات:</strong> با اسکریپت اصلاح‌شده <code className="text-teal-300 font-mono">build-android-apk.bat</code> خطای کاراکترهای ویندوز به کلی رفع شده و با موتور Node.js عملیات بیلد را انجام می‌دهد.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowHelpModal(false)}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold text-xs transition"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallAndroid;
