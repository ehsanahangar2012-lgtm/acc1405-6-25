import React, { useState, useEffect } from 'react';
import { 
    Smartphone, Download, CheckCircle2, Zap, Wifi, Shield, 
    Key, Globe, Copy, Check, FileCode, ArrowLeftRight, HelpCircle, 
    RefreshCw, Terminal, ExternalLink, Cloud, Sparkles, Monitor, 
    HardDrive, Cpu, CheckCircle, AlertTriangle, Layers, ChevronRight, X
} from 'lucide-react';
import { useStore } from '../store';
import { hardwareIdService } from '../services/hardwareIdService';
import { androidCommercialService } from '../services/androidCommercialService';
import { workspaceService } from '../services/workspaceService';
import { APP_VERSION, APP_RELEASE_DATE } from '../config';
import { isAndroidApp, isDesktopApp, isMotherWebPortal } from '../utils';

const InstallAndroid: React.FC = () => {
    const { addNotification } = useStore();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const isNativeClient = isDesktopApp() || isAndroidApp();
    const isMotherPortal = isMotherWebPortal();
    const [activeTab, setActiveTab] = useState<'windows' | 'apk' | 'pwa' | 'sync' | 'license'>(() => isMotherPortal ? 'windows' : isNativeClient ? 'sync' : 'pwa');
    const [copiedAppUrl, setCopiedAppUrl] = useState(false);
    const [copiedBatContent, setCopiedBatContent] = useState(false);
    const [copiedWinBatContent, setCopiedWinBatContent] = useState(false);
    const [androidHwid, setAndroidHwid] = useState('');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [activeGuideStep, setActiveGuideStep] = useState<number>(1);

    // Host & Sync settings
    const [hostUrl, setHostUrl] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ashk_host_url') || localStorage.getItem('ashk_custom_server_url') || '';
    });
    const [syncToken, setSyncToken] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ashk_host_sync_token') || localStorage.getItem('ashk_cloud_token') || '';
    });
    const [workspaceId, setWorkspaceId] = useState(() => workspaceService.getWorkspaceId());

    useEffect(() => {
        if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        hardwareIdService.getHardwareId().then(id => {
            setAndroidHwid(`AG-DEV-${id.replace(/[^A-Z0-9]/gi, '').substring(0, 12).toUpperCase()}`);
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
            addNotification('success', 'اپلیکیشن مستقل با موفقیت روی دستگاه نصب شد.');
        }
        setDeferredPrompt(null);
    };

    const handleSaveAndroidSync = async () => {
        const trimmedUrl = hostUrl.trim();
        const trimmedToken = syncToken.trim();
        const trimmedWorkspaceId = workspaceId.trim();

        if (!trimmedUrl || !trimmedToken || !trimmedWorkspaceId) {
            addNotification('error', 'آدرس سرور، شناسه فضای کاری و توکن اختصاصی را کامل وارد کنید.');
            return;
        }

        const result = await androidCommercialService.connectToServer(
            trimmedUrl,
            trimmedToken,
            trimmedWorkspaceId
        );
        if (result.success) {
            setHostUrl(trimmedUrl);
            setSyncToken(trimmedToken);
            setWorkspaceId(trimmedWorkspaceId);
            addNotification('success', result.message);
        } else {
            addNotification('error', result.message);
        }
    };

    const currentLiveUrl = typeof window !== 'undefined' ? window.location.origin : 'https://acc.ashkghalam.ir';

    const handleCopyLiveUrl = () => {
        navigator.clipboard.writeText(currentLiveUrl);
        setCopiedAppUrl(true);
        addNotification('success', 'آدرس اینترنتی وب‌اپلیکیشن در کلیپ‌بورد کپی شد.');
        setTimeout(() => setCopiedAppUrl(false), 3000);
    };

    // اسکریپت بات اختصاصی بیلد و اجرای ویندوز
    const winBatCode = `@echo off
chcp 65001 >nul
title AshkeGhalam Accounting - Windows Standalone Launcher v${APP_VERSION}
cls
echo ================================================================
echo   نرم افزار حسابداری و مدیریت مالی اشک قلم - نگارش ${APP_VERSION}
echo   نسخه فعلی Electron؛ مهاجرت ‎.NET/SQLite در نقشه‌راه آینده
echo ================================================================
echo.

set APP_DATA_DIR=%APPDATA%\\AshkeGhalam
if not exist "%APP_DATA_DIR%" mkdir "%APP_DATA_DIR%"

echo [1/3] بررسی محیط اجرایی و پیش نیازهای ویندوز...
echo [2/3] بارگذاری پایگاه داده محلی مستقل از مسیر: %APP_DATA_DIR%
echo [3/3] اجرای مستقیم کلاینت سبک اشک قلم...
echo.

if exist "AshkeGhalam-Portable-v${APP_VERSION}.exe" (
    start "" "AshkeGhalam-Portable-v${APP_VERSION}.exe"
    exit /b 0
)
if exist "AshkeGhalam-Setup-v${APP_VERSION}.exe" (
    start "" "AshkeGhalam-Setup-v${APP_VERSION}.exe"
    exit /b 0
)

echo [خطا] فایل اجرایی نسخه ${APP_VERSION} کنار این اسکریپت پیدا نشد.
echo این اسکریپت فقط لانچر است؛ index.html جایگزین EXE مستقل نیست.
echo بسته‌های آزمون را از بخش Artifacts در GitHub Actions دریافت کنید:
echo https://github.com/ehsanahangar2012-lgtm/acc1405-6-25/actions/workflows/build-apk.yml
pause
exit /b 1`;

    // اسکریپت بات اختصاصی بیلد اندروید
    const apkBatCode = `@echo off
setlocal
chcp 65001 >nul
title AshkeGhalam - Android Standalone APK Builder v${APP_VERSION}

echo ================================================================
echo   سامانه تولید فایل نصبی مستقل اندروید اشک قلم v${APP_VERSION}
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] موتور Node.js روی سیستم شناسایی نشد!
    echo لطفاً Node.js را از سایت رسمی https://nodejs.org نصب فرمایید.
    pause
    exit /b 1
)

if not exist node_modules (
echo [خطا] وابستگی‌های پروژه نصب نیستند.
echo ابتدا در ریشه پروژه دستور bun install --frozen-lockfile را اجرا کنید.
pause
exit /b 1
)

echo [1/2] بازسازی رابط کاربری و ساخت APK...
npm run build:apk
if %errorlevel% neq 0 (
    echo.
    echo [خطا] در فرآیند پکیج بندی خطایی رخ داد.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] خروجی APK در پوشه downloads تولید شد؛ برای انتشار رسمی، keystore امضای انتشار لازم است.
echo.
pause`;

    const downloadBatFile = (code: string, fileName: string) => {
        const blob = new Blob([code], { type: 'application/x-bat;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('success', `فایل ${fileName} با موفقیت دانلود شد.`);
    };

    return (
        <div className="space-y-6 dir-rtl text-right font-sans max-w-7xl mx-auto pb-16" dir="rtl">
            {/* Top Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner shrink-0">
                        <Cpu className="w-9 h-9" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-white">
                                سامانه تولید و استقرار برنامه‌های مستقل ویندوز و اندروید
                            </h1>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                                نسخه {APP_VERSION}
                            </span>
                            
                            {/* دکمه راهنمای هوشمند ؟ الزامی در تمام بخش‌ها */}
                            <button
                                onClick={() => setShowHelpModal(true)}
                                className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 px-2.5 py-1 rounded-xl border border-amber-500/30 transition-all cursor-pointer font-black text-xs flex items-center gap-1 shadow-sm"
                                title="راهنمای هوشمند تولید برنامه‌های مستقل ویندوز و اندروید (؟)"
                            >
                                <HelpCircle size={15} />
                                <span>راهنما ؟</span>
                            </button>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            فرآیند گام‌به‌گام ساخت فایل‌های اجرایی ویندوز (EXE / Portable)، اندروید (APK)، نصب مستقل PWA و همگام‌سازی ۳ سویه
                        </p>
                    </div>
                </div>

                {/* Device Hardware Status */}
                <div className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl text-center shrink-0 w-full md:w-auto">
                    <div className="text-[10px] text-slate-400">شناسه اختصاصی سخت‌افزار (Hardware ID)</div>
                    <div className="text-xs font-mono font-black text-teal-400 tracking-wider mt-0.5 select-all" dir="ltr">
                        {androidHwid || 'AG-DEV-89F2A410BC71'}
                    </div>
                </div>
            </div>

            {/* Build tools are owner-portal-only; installed clients only need connection and activation. */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
                {isMotherPortal && (
                    <button onClick={() => setActiveTab('windows')} className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'windows' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                        <Monitor className="w-4 h-4" /><span>ساخت نسخه ویندوز</span>
                    </button>
                )}
                {isMotherPortal && (
                    <button onClick={() => setActiveTab('apk')} className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'apk' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                        <Smartphone className="w-4 h-4" /><span>ساخت APK اندروید</span>
                    </button>
                )}
                {!isNativeClient && (
                    <button onClick={() => setActiveTab('pwa')} className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'pwa' ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                        <Download className="w-4 h-4" /><span>نصب PWA</span>
                    </button>
                )}
                <button onClick={() => setActiveTab('sync')} className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'sync' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                    <ArrowLeftRight className="w-4 h-4" /><span>اتصال سرور و همگام‌سازی</span>
                </button>
                <button onClick={() => setActiveTab('license')} className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'license' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                    <Key className="w-4 h-4" /><span>فعال‌سازی لایسنس</span>
                </button>
            </div>

            {/* TAB 1: WINDOWS STANDALONE PIPELINE */}
            {isMotherPortal && activeTab === 'windows' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Step-by-Step Interactive Workflow */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                                    🖥️ گردش‌کار گام‌به‌گام ساخت نسخه دسکتاپ ویندوز
                                </span>
                                <h2 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                                    <Monitor className="text-indigo-400" size={22} />
                                    <span>مراحل تولید و راه‌اندازی بسته مستقل ویندوز (بدون نیاز به نصب نرم‌افزار جانبی)</span>
                                </h2>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    نسخه فعلی به‌صورت برنامه مستقل دسکتاپ با Electron بسته‌بندی می‌شود؛ داده‌ها محلی نگهداری می‌شوند. مهاجرت به Tauri یا ‎.NET/SQLite هنوز انجام نشده و پس از آزمون کارایی برنامه‌ریزی می‌شود.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowHelpModal(true)}
                                className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30 transition text-xs font-black flex items-center gap-1.5 shrink-0"
                            >
                                <HelpCircle size={15} />
                                <span>راهنمای مراحل ویندوز ؟</span>
                            </button>
                        </div>

                        {/* Step-by-Step Visual Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className={`p-5 rounded-2xl border transition-all ${activeGuideStep === 1 ? 'bg-indigo-950/60 border-indigo-500 shadow-lg' : 'bg-slate-950/70 border-white/5'}`} onClick={() => setActiveGuideStep(1)}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">۱</span>
                                    <span className="text-[10px] text-indigo-400 font-bold">باندل فرانت‌اند</span>
                                </div>
                                <h4 className="text-xs font-bold text-white mb-1.5">کامپایل دارایی‌های وب</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    کامپایل تمامی صفحات، موتورهای محاسبه مالی و کامپوننت‌ها به پوشه توزیع نهایی <code className="text-indigo-300 font-mono">dist</code>
                                </p>
                            </div>

                            <div className={`p-5 rounded-2xl border transition-all ${activeGuideStep === 2 ? 'bg-indigo-950/60 border-indigo-500 shadow-lg' : 'bg-slate-950/70 border-white/5'}`} onClick={() => setActiveGuideStep(2)}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">۲</span>
                                    <span className="text-[10px] text-teal-400 font-bold">بسته‌بندی فعلی Electron</span>
                                </div>
                                <h4 className="text-xs font-bold text-white mb-1.5">اجرای مستقل دسکتاپ</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    ساخت فعلی از Electron و Chromium استفاده می‌کند؛ بنابراین ادعای مصرف RAM زیر ۱۰۰ مگابایت یا اجرای آنی تأیید نشده است. نسخه WebView2/Tauri یا ‎.NET/SQLite باید جداگانه ساخته و با داده‌های واقعی بنچمارک شود.
                                </p>
                            </div>

                            <div className={`p-5 rounded-2xl border transition-all ${activeGuideStep === 3 ? 'bg-indigo-950/60 border-indigo-500 shadow-lg' : 'bg-slate-950/70 border-white/5'}`} onClick={() => setActiveGuideStep(3)}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs">۳</span>
                                    <span className="text-[10px] text-amber-400 font-bold">ایزولاسیون دیتابیس</span>
                                </div>
                                <h4 className="text-xs font-bold text-white mb-1.5">حفاظت از اسناد در AppData</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    تفکیک دیتابیس مالی در مسیر امن سیستم‌عامل تا هنگام آپدیت برنامه هیچ داده‌ای حذف نگردد.
                                </p>
                            </div>

                            <div className={`p-5 rounded-2xl border transition-all ${activeGuideStep === 4 ? 'bg-indigo-950/60 border-indigo-500 shadow-lg' : 'bg-slate-950/70 border-white/5'}`} onClick={() => setActiveGuideStep(4)}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">۴</span>
                                    <span className="text-[10px] text-emerald-400 font-bold">خروجی و دانلود</span>
                                </div>
                                <h4 className="text-xs font-bold text-white mb-1.5">صدور فایل نصبی و پرتابل</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    تولید فایل‌های نهایی نصبی (Setup.exe)، پرتابل یک-کلیک و بسته کامل با نام نسخه <code className="text-emerald-300 font-mono">v{APP_VERSION}</code>
                                </p>
                            </div>
                        </div>

                        {/* Download Windows Packages Section */}
                        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Download size={18} className="text-emerald-400" />
                                <span>دانلود مستقیم بسته‌های باینری ویندوز نسخه {APP_VERSION}:</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Windows Installer Setup */}
                                <div className="bg-slate-900 border border-slate-700/70 hover:border-emerald-500/40 p-4 rounded-xl flex flex-col justify-between gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-white">فایل نصبی Setup ویندوز</span>
                                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">پیشنهادی</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            نصب خودکار، ساخت آیکون دسکتاپ و مدیریت ایزوله مسیر داده‌ها
                                        </p>
                                    </div>
                                    <a
                                        href={`https://github.com/ehsanahangar2012-lgtm/acc1405-6-25/releases/latest/download/AshkeGhalam-Setup-v${APP_VERSION}.exe`}
                                        download={`AshkeGhalam-Setup-v${APP_VERSION}.exe`}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <Download size={14} />
                                        <span>دانلود AshkeGhalam-Setup-v{APP_VERSION}.exe</span>
                                    </a>
                                </div>

                                {/* Windows Portable ZIP */}
                                <div className="bg-slate-900 border border-slate-700/70 hover:border-indigo-500/40 p-4 rounded-xl flex flex-col justify-between gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-white">بسته پرتابل ۱-کلیک (ZIP)</span>
                                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">بدون نیاز به نصب</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            استخراج و اجرای فوری روی هر کامپیوتر یا فلش مموری بدون هیچ پیش‌نیاز
                                        </p>
                                    </div>
                                    <a
                                        href={`https://github.com/ehsanahangar2012-lgtm/acc1405-6-25/releases/latest/download/AshkeGhalam-Windows-Portable-v${APP_VERSION}.zip`}
                                        download={`AshkeGhalam-Windows-Portable-v${APP_VERSION}.zip`}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <HardDrive size={14} />
                                        <span>دانلود نسخه پرتابل (ZIP)</span>
                                    </a>
                                </div>

                                {/* Portable Direct EXE */}
                                <div className="bg-slate-900 border border-slate-700/70 hover:border-cyan-500/40 p-4 rounded-xl flex flex-col justify-between gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-white">فایل تک-اجرایی Portable.exe</span>
                                            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold">اجرای مستقیم</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            فایل اجرایی مستقل بدون نیاز به استخراج، مناسب کاربران عمومی
                                        </p>
                                    </div>
                                    <a
                                        href={`https://github.com/ehsanahangar2012-lgtm/acc1405-6-25/releases/latest/download/AshkeGhalam-Portable-v${APP_VERSION}.exe`}
                                        download={`AshkeGhalam-Portable-v${APP_VERSION}.exe`}
                                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <Monitor size={14} />
                                        <span>دانلود AshkeGhalam-Portable-v{APP_VERSION}.exe</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* 1-Click Batch Automation Script */}
                        <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <Terminal size={16} className="text-indigo-400" />
                                    اسکریپت ۱-کلیک اجرای بومی ویندوز (Run-AshkeGhalam.bat):
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => downloadBatFile(winBatCode, 'Run-AshkeGhalam.bat')}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                                    >
                                        <Download size={14} />
                                        <span>دانلود Run-AshkeGhalam.bat</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(winBatCode);
                                            setCopiedWinBatContent(true);
                                            addNotification('success', 'محتوای اسکریپت بات در کلیپ‌بورد کپی شد.');
                                            setTimeout(() => setCopiedWinBatContent(false), 3000);
                                        }}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-white/10"
                                    >
                                        {copiedWinBatContent ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                        <span>{copiedWinBatContent ? 'کپی شد' : 'کپی اسکریپت'}</span>
                                    </button>
                                </div>
                            </div>
                            <pre className="text-xs font-mono text-indigo-300 dir-ltr text-left overflow-x-auto p-4 bg-slate-900/90 rounded-xl leading-relaxed max-h-36 custom-scrollbar">
                                {winBatCode}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ANDROID STANDALONE PIPELINE (APK) */}
            {isMotherPortal && activeTab === 'apk' && (
                <div className="space-y-6 animate-fade-in">
                    {/* SECTION 1: Online Instant APK Builders */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                                    🌐 روش ۱: سایت‌های ابری و رایگان ساخت آنی APK
                                </span>
                                <h2 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                                    <Cloud className="text-indigo-400" size={22} />
                                    <span>تبدیل مستقیم آنلاین به فایل نصبی اندروید (APK / AAB)</span>
                                </h2>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    بهترین روش بدون نیاز به ابزارهای سنگین برنامه‌نویسی: کافیست آدرس برنامه را کپی و در سایت‌های زیر وارد کنید تا فایل نصبی تحویل شود.
                                </p>
                            </div>

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

                            {/* Direct Download of pre-built APK */}
                            <div className="bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-400/60 p-5 rounded-2xl space-y-3 transition flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-white">دانلود مستقیم فایل نصبی APK</span>
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                            نسخه {APP_VERSION}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        فایل نصبی کامپایل‌شده و آماده APK با دوربین اسکن بارکد، کاردکس آفلاین و ارسال پیامک.
                                    </p>
                                </div>
                                <a
                                    href={`https://github.com/ehsanahangar2012-lgtm/acc1405-6-25/releases/latest/download/AshkeGhalam-v${APP_VERSION}.apk`}
                                    download={`AshkeGhalam-v${APP_VERSION}.apk`}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                                >
                                    <Download size={13} />
                                    <span>دانلود AshkeGhalam-v{APP_VERSION}.apk</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Local Android Build Script */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-purple-400 font-black uppercase tracking-wider bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                                    💻 روش ۲: بیلد محلی در کامپیوتر (Node.js & Capacitor)
                                </span>
                                <h2 className="text-xl font-black text-white mt-1">تولید خودکار در سیستم با فایل بات اصلاح‌شده</h2>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    اسکریپت جدید به طور مستقیم با موتور پایدار Node.js اجرا شده و فایل‌های بیلد قدیمی را پاکسازی و پکیج APK نسخه {APP_VERSION} را تولید می‌کند.
                                </p>
                            </div>

                            <button
                                onClick={() => downloadBatFile(apkBatCode, 'build-android-apk.bat')}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                            >
                                <Download size={16} />
                                <span>دانلود فایل جدید build-android-apk.bat</span>
                            </button>
                        </div>

                        {/* Step Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-purple-600/30 text-purple-400 flex items-center justify-center text-xs">۱</span>
                                    <span>اجرای فایل بات</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    فایل <code className="text-purple-300 font-mono">build-android-apk.bat</code> را در پوشه پروژه اجرا کنید.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-teal-600/30 text-teal-400 flex items-center justify-center text-xs">۲</span>
                                    <span>دستور خط فرمان NPM</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    یا در ترمینال دستور <code className="text-teal-300 font-mono">npm run build:apk</code> را تایپ کنید.
                                </p>
                            </div>

                            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">۳</span>
                                    <span>محل خروجی APK</span>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    فایل APK در ریشه و مسیر <code className="text-emerald-300 font-mono">downloads/AshkeGhalam-v{APP_VERSION}.apk</code> ذخیره می‌شود.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PWA STANDALONE */}
            {!isNativeClient && activeTab === 'pwa' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                        <div className="space-y-2">
                            <span className="text-[10px] text-teal-400 font-black uppercase tracking-wider bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                                🚀 نصب بدون نیاز به کافه‌بازار و گوگل‌پلی
                            </span>
                            <h2 className="text-xl font-black text-white">نصب مستقیم روی صفحه اصلی گوشی و تبلت</h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                وب‌اپلیکیشن پیشرونده (PWA) اشک قلم دارای موتور مستقل ذخیره‌سازی محلی (IndexedDB) بوده و به صورت کامل مانند یک نرم‌افزار نیتیو بدون وابستگی به مرورگر اجرا می‌شود.
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
                            <span>مزایای استفاده از نسخه مستقل PWA</span>
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

            {/* TAB 4: THREE-WAY SYNC */}
            {activeTab === 'sync' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
                    <div className="space-y-1">
                        <span className="text-[10px] text-teal-400 font-black uppercase tracking-wider bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                            🔄 همگام‌سازی ابری و محلی ۳ سویه
                        </span>
                        <h2 className="text-xl font-black text-white">اتصال کلاینت به سرور و سایر دستگاه‌ها</h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            ابتدا لایسنس معتبر دستگاه را فعال کنید. سپس شناسه فضای کاری ثبت‌شده، آدرس سرور و توکن اختصاصی آن را وارد کنید. اتصال فقط پس از تأیید سرور ذخیره می‌شود؛ اتصال به‌تنهایی لایسنس را فعال یا سهمیه را افزایش نمی‌دهد.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Globe size={14} className="text-teal-400" />
                                <span>آدرس سرور (Host URL):</span>
                            </label>
                            <input
                                type="url"
                                value={hostUrl}
                                onChange={(e) => setHostUrl(e.target.value)}
                                placeholder="https://acc.yourdomain.ir"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-teal-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Key size={14} className="text-amber-400" />
                                <span>شناسه فضای کاری (Workspace ID):</span>
                            </label>
                            <input
                                type="text"
                                value={workspaceId}
                                onChange={(e) => setWorkspaceId(e.target.value)}
                                placeholder="client_rahimi"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Key size={14} className="text-violet-400" />
                                <span>توکن اختصاصی سرور:</span>
                            </label>
                            <input
                                type="password"
                                autoComplete="off"
                                value={syncToken}
                                onChange={(e) => setSyncToken(e.target.value)}
                                placeholder="توکن اختصاصی این مشتری"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-violet-500"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                        <button
                            onClick={handleSaveAndroidSync}
                            className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30"
                        >
                            <RefreshCw size={16} />
                            <span>تأیید لایسنس و آزمون اتصال</span>
                        </button>

                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>✅ معماری Last-Write-Wins با اولویت زمان ثبت اسناد فعال است.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: LICENSING */}
            {activeTab === 'license' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
                    <div className="space-y-1">
                        <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                            🔑 قفل هوشمند سخت‌افزاری مستقل
                        </span>
                        <h2 className="text-xl font-black text-white">فعال‌سازی لایسنس تجاری روی کلاینت‌ها</h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            فعال‌سازی تجاری فقط با پاسخ دارای امضای دیجیتال RSA از سرور مادر انجام می‌شود؛ کدهای آفلاین قدیمی به دلیل ضعف رمزنگاری پذیرفته نمی‌شوند. کلید خصوصی امضا فقط روی سرور نگهداری می‌شود.
                        </p>
                    </div>

                    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400">شناسه سخت‌افزاری دستگاه جاری (Hardware ID):</div>
                            <div className="text-lg font-black font-mono text-amber-400 tracking-wider mt-1 select-all" dir="ltr">
                                {androidHwid}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(androidHwid);
                                addNotification('success', 'شناسه سخت‌افزاری کپی شد.');
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Copy size={16} />
                            <span>کپی شناسه جهت صدور لایسنس</span>
                        </button>
                    </div>

                    <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white flex items-center gap-2">
                                <Globe size={18} className="text-teal-400" />
                                <span>ورود کد لایسنس دستگاه</span>
                            </span>
                            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full font-bold border border-teal-500/30">
                                فقط پس از اعتبارسنجی کد مجاز است
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            آدرس سرور و توکن را در تب «اتصال سرور و همگام‌سازی» وارد کنید. اتصال به سرور به‌تنهایی لایسنس تجاری را فعال نمی‌کند؛ کد فعال‌سازی دستگاه را از مسیر تأیید لایسنس وارد کنید.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-activation-dashboard'))}
                                className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30 w-full sm:w-auto"
                            >
                                <RefreshCw size={16} />
                                <span>ورود و اعتبارسنجی کد لایسنس</span>
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

            {/* Smart Guide Modal (?) */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl text-right">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                                    <HelpCircle size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">راهنمای هوشمند تولید برنامه‌های مستقل ویندوز و اندروید</h3>
                                    <p className="text-xs text-slate-400">سامانه اتوماسیون و توزیع نسخه‌های نصبی اشک قلم نسخه {APP_VERSION}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowHelpModal(false)}
                                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-indigo-400 flex items-center gap-1.5">
                                    <Monitor size={16} />
                                    <span>۱. نسخه مستقل ویندوز فعلی (Electron):</span>
                                </h4>
                                <p>
                                    نسخه فعلی با Electron بسته‌بندی می‌شود و موتور Chromium دارد؛ بنابراین مصرف RAM و حجم بسته باید اندازه‌گیری شود، نه اینکه مصرف زیر ۱۰۰ مگابایت فرض شود. مسیر داده‌ها باید در آزمون ارتقا و حذف بررسی شود. گزینه‌های Tauri یا ‎.NET/SQLite در مرحله بعد ارزیابی می‌شوند.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-purple-400 flex items-center gap-1.5">
                                    <Smartphone size={16} />
                                    <span>۲. تولید فایل نصبی APK اندروید:</span>
                                </h4>
                                <p>
                                    دو راهکار برای شما فراهم شده است:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-slate-400 pr-2">
                                    <li><strong>سایت‌های ابری فوری (PWABuilder):</strong> با فشردن دکمه کپی آدرس و قرار دادن آن در سایت، فایل APK آماده را دانلود فرمایید.</li>
                                    <li><strong>اسکریپت محلی (build-android-apk.bat):</strong> اجرای فایل بات در سیستم، پاکسازی نسخه‌های قبلی و تولید خروجی دقیق را انجام می‌دهد.</li>
                                </ul>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-teal-400 flex items-center gap-1.5">
                                    <Download size={16} />
                                    <span>۳. تفاوت نصب PWA با فایل نصبی:</span>
                                </h4>
                                <p>
                                    نصب PWA نیازی به کافه‌بازار یا فایل ندارد و با زدن Add to Home Screen در مرورگر، نرم‌افزار مانند یک اپلیکیشن مستقل در گوشی می‌نشیند و به صورت ۱۰۰٪ آفلاین کار می‌کند.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                                    <Key size={16} />
                                    <span>۴. امنیت و قفل سخت‌افزاری آفلاین:</span>
                                </h4>
                                <p>
                                    کد فعال‌سازی تجاری از روی شناسه سخت‌افزاری اختصاصی صادر شده و در زمان قطع اینترنت یا شرایط فیلترینگ، اعتبار لایسنس بدون افت کارایی احراز می‌گردد.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-white/10">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
                            >
                                متوجه شدم، بستن راهنما
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallAndroid;
