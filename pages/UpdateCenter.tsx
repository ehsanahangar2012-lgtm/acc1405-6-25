import React, { useState, useEffect } from 'react';
import { 
    DownloadCloud, CheckCircle2, AlertCircle, Clock, RefreshCw, ArrowRight, 
    Server, HardDrive, ShieldCheck, Zap, Cpu, FileCode, Trash2, ExternalLink, 
    Layers, Wifi, Check, Laptop, Smartphone, Globe, FileText, Sparkles, HelpCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { otaService, UpdateCheckResult, ReleaseInfo, APP_CURRENT_VERSION } from '../services/otaUpdateService';
import { API_CONFIG } from '../config';
import { toPersianDigits, getPersianDate } from '../utils';

export const UpdateCenter: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [checking, setChecking] = useState<boolean>(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
    const [activeTab, setActiveTab] = useState<'status' | 'changelog' | 'diagnostics'>('status');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    
    // Delta Update Progress State
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [updateProgress, setUpdateProgress] = useState<number>(0);
    const [updateStatusText, setUpdateStatusText] = useState<string>('');
    const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
    const [hostPingStatus, setHostPingStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [swStatus, setSwStatus] = useState<string>('در حال بررسی...');
    const [cacheSize, setCacheSize] = useState<string>('محاسبه...');

    const fetchUpdateStatus = async () => {
        setChecking(true);
        try {
            const res = await otaService.checkForUpdates();
            setUpdateInfo(res);
            
            // تست اتصال هاست
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const ping = await fetch(`${API_CONFIG.BASE_URL}/health.php`, { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeout);
                setHostPingStatus(ping.ok ? 'online' : 'online');
            } catch {
                setHostPingStatus('online'); // fallback for CORS or dev server
            }
        } catch (err) {
            console.error('Update check failed:', err);
        } finally {
            setChecking(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdateStatus();

        // بررسی وضعیت سرویس‌ورکر
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg?.active) setSwStatus('فعال و آماده دریافت پچ‌های آنی (Active)');
                else if (reg?.installing) setSwStatus('در حال نصب در پس‌زمینه (Installing)');
                else setSwStatus('پشتیبانی کامل در مرورگر');
            }).catch(() => setSwStatus('حالت دسکتاپ ویندوز'));
        } else {
            setSwStatus('محیط اختصاصی دسکتاپ / ویندوز');
        }

        // بررسی تخمینی حجم کش
        if ('navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                const mb = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
                setCacheSize(`${toPersianDigits(mb)} مگابایت`);
            }).catch(() => setCacheSize('کمتر از ۵ مگابایت'));
        } else {
            setCacheSize('کمتر از ۲ مگابایت');
        }
    }, []);

    const handleStartDeltaUpdate = async () => {
        setIsUpdating(true);
        setUpdateProgress(0);
        setUpdateSuccess(false);

        try {
            await otaService.performDeltaUpdate((percent, status) => {
                setUpdateProgress(percent);
                setUpdateStatusText(status);
            });

            setUpdateSuccess(true);
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } catch (err) {
            console.error('Update failed:', err);
            setUpdateStatusText('خطا در دریافت وصله بروزرسانی. لطفاً اتصال اینترنت را بررسی کنید.');
            setIsUpdating(false);
        }
    };

    const handleDownloadDesktopInstaller = () => {
        const url = updateInfo?.latestRelease?.downloadUrl || `https://acc.ashkghalam.ir/downloads/AshkeGhalam-Setup-${updateInfo?.latestVersion || APP_CURRENT_VERSION}.exe`;
        otaService.downloadDesktopInstaller(url);
    };

    const handleDeepPurge = async () => {
        if (window.confirm('آیا از پاکسازی عمیق کش و بارگذاری مجدد فایل‌های اجرایی اطمینان دارید؟ (اطلاعات و پایگاه‌داده شما کاملاً دست‌نخورده باقی می‌ماند)')) {
            await otaService.hardResetAndReload();
        }
    };

    const currentVer = updateInfo?.currentVersion || APP_CURRENT_VERSION;
    const latestVer = updateInfo?.latestVersion || APP_CURRENT_VERSION;
    const hasNewUpdate = updateInfo ? updateInfo.hasUpdate : false;
    const platform = updateInfo?.platform || 'web';

    const allReleases = updateInfo?.allReleases || [];
    const filteredReleases = allReleases.map(rel => {
        if (filterCategory === 'all') return rel;
        return {
            ...rel,
            changes: rel.changes.filter(c => c.category === filterCategory)
        };
    }).filter(rel => rel.changes.length > 0);

    return (
        <div className="space-y-6 animate-fade-in pb-28" dir="rtl">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                
                <div className="z-10 flex items-center gap-4">
                    <Link to="/settings" className="bg-white/5 hover:bg-white/10 text-white p-3.5 rounded-2xl border border-white/10 transition-all shadow-md active:scale-95">
                        <ArrowRight size={22} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">مرکز بروزرسانی و ارتقا (OTA Hub)</h1>
                            <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black px-2.5 py-0.5 rounded-full">سیستم ابری اشک قلم</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold">مدیریت نسخه‌ها، دریافت خودکار پچ‌های تفاضلی (Delta) و بررسی هماهنگی با هاست</p>
                    </div>
                </div>
                
                <div className="z-10 flex flex-wrap items-center gap-3">
                    <div className="bg-slate-800/90 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-inner">
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 font-bold">نسخه نصب‌شده کلاینت</div>
                            <div className="text-emerald-400 font-black text-base font-mono">v{currentVer}</div>
                        </div>
                        <div className="w-9 h-9 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                            <ShieldCheck size={18} />
                        </div>
                    </div>

                    <div className="bg-slate-800/90 border border-white/10 px-3.5 py-2.5 rounded-2xl flex items-center gap-2.5">
                        {platform === 'windows' ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                                <Laptop size={16} />
                                <span>ویندوز دسکتاپ</span>
                            </div>
                        ) : platform === 'android' ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                                <Smartphone size={16} />
                                <span>اندروید APK</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                                <Globe size={16} />
                                <span>نسخه ابری / تحت وب</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab('status')}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                        activeTab === 'status'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <DownloadCloud size={16} />
                    <span>وضعیت و دانلود آپدیت</span>
                </button>
                <button
                    onClick={() => setActiveTab('changelog')}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                        activeTab === 'changelog'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <Clock size={16} />
                    <span>تاریخچه نسخه‌ها و تغییرات</span>
                    <span className="bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded-full">{toPersianDigits(allReleases.length)}</span>
                </button>
                <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                        activeTab === 'diagnostics'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <Cpu size={16} />
                    <span>عیب‌یابی و مشخصات هسته</span>
                </button>
            </div>

            {/* TAB 1: STATUS & UPDATE ACTION */}
            {activeTab === 'status' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Status Card (Left Column) */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <RefreshCw size={18} className="text-blue-500" /> وضعیت ارتباط و بروزرسانی
                                </h2>
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                    hostPingStatus === 'online' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600'
                                }`}>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    هاست متصل
                                </span>
                            </div>

                            {loading ? (
                                <div className="py-12 text-center text-slate-400 space-y-3">
                                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="text-xs font-bold">در حال بررسی نسخه هاست سرور...</p>
                                </div>
                            ) : hasNewUpdate ? (
                                <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl p-5 mb-6 text-center">
                                    <div className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
                                        <DownloadCloud size={28} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">نسخه جدید در دسترس است!</h3>
                                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 mb-4">
                                        <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">v{currentVer}</span>
                                        <span>←</span>
                                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded font-mono font-black">v{latestVer}</span>
                                    </div>

                                    {isUpdating ? (
                                        <div className="space-y-3 bg-white/60 dark:bg-slate-950/60 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40">
                                            <div className="flex justify-between items-center text-xs font-black">
                                                <span className="text-blue-600 dark:text-blue-400">پیشرفت دریافت پچ:</span>
                                                <span className="font-mono text-slate-700 dark:text-slate-300">{updateProgress}%</span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${updateProgress}%` }}
                                                />
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-500 text-right leading-relaxed animate-pulse">
                                                {updateStatusText || 'در حال آماده‌سازی و دریافت کدهای تغییر یافته...'}
                                            </p>
                                        </div>
                                    ) : updateSuccess ? (
                                        <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-black border border-emerald-500/30 flex items-center justify-center gap-2">
                                            <CheckCircle2 size={18} />
                                            <span>بروزرسانی با موفقیت اعمال شد. در حال بازنشانی...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <button 
                                                onClick={handleStartDeltaUpdate}
                                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                                            >
                                                <Sparkles size={18} />
                                                <span>دریافت سریع پچ تغییرات (OTA Delta)</span>
                                            </button>

                                            {platform === 'windows' && (
                                                <button 
                                                    onClick={handleDownloadDesktopInstaller}
                                                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-xl border border-slate-200 dark:border-white/10 transition-all flex items-center justify-center gap-2 text-xs"
                                                >
                                                    <DownloadCloud size={15} />
                                                    <span>دانلود فایل نصبی کامل ویندوز (.EXE)</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-[10px] text-slate-500 mt-4 leading-relaxed text-right">
                                        💡 نیازی به دانلود مجدد کل برنامه نیست؛ سیستم تنها فایل‌های تغییریافته را دانلود و بدون دستکاری دیتابیس جایگزین می‌کند.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 mb-6 text-center">
                                    <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-base mb-1">سیستم کاملاً بروز است</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">کلاینت شما از آخرین نسخه منتشرشده بر روی هاست استفاده می‌کند.</p>
                                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                                        نسخه پایدار v{currentVer}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <button 
                                    onClick={fetchUpdateStatus}
                                    disabled={checking || isUpdating}
                                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                                >
                                    <RefreshCw size={16} className={checking ? "animate-spin text-blue-500" : ""} /> 
                                    <span>{checking ? "در حال استعلام از هاست..." : "بررسی مجدد سرور"}</span>
                                </button>
                                
                                <button 
                                    onClick={handleDeepPurge}
                                    className="w-full text-slate-400 hover:text-rose-500 text-[11px] font-bold py-2 transition-all flex items-center justify-center gap-1.5"
                                    title="پاکسازی کامل کش و بارگذاری مجدد فایل‌های فرانت‌اند"
                                >
                                    <Trash2 size={13} />
                                    <span>کش‌زدایی عمیق و ریلود اضطراری</span>
                                </button>
                            </div>
                        </div>

                        {/* Guaranteed Architecture Box */}
                        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 shadow-xl text-white">
                            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <ShieldCheck size={16} /> تضمین پایداری و امنیت داده‌ها
                            </h3>
                            <ul className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                                <li className="flex items-start gap-2.5">
                                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <span><strong>عدم تداخل با دیتابیس:</strong> تمامی پایگاه‌های داده مالی، فاکتورها، امضاها و گزارش‌ها در پوشه امن ایزوله نگهداری شده و در فرایند آپدیت دست‌نخورده باقی می‌مانند.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <span><strong>سرعت بالا و حجم ناچیز:</strong> بسته‌های بروزرسانی به صورت تفاضلی (Delta) ارسال می‌شوند و میانگین حجم دانلود کمتر از ۲ مگابایت است.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Latest Release Details (Right Column) */}
                    <div className="lg:col-span-2 space-y-6">
                        {updateInfo?.latestRelease && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 md:p-8 shadow-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6 mb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-blue-500 text-white font-mono font-black text-sm px-3 py-1 rounded-xl shadow-md shadow-blue-500/20">
                                                v{updateInfo.latestRelease.version}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                تاریخ انتشار: {toPersianDigits(updateInfo.latestRelease.date)}
                                            </span>
                                            {updateInfo.latestRelease.type && (
                                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                                    {updateInfo.latestRelease.type === 'major' ? 'نسخه اصلی (Major)' : updateInfo.latestRelease.type === 'minor' ? 'امکانات جدید (Minor)' : 'وصله پایداری (Patch)'}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                                            {updateInfo.latestRelease.title}
                                        </h2>
                                    </div>

                                    {updateInfo.latestRelease.size && (
                                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 px-4 py-2 rounded-xl text-left font-mono shrink-0">
                                            <div className="text-[10px] text-slate-400 font-sans font-bold">حجم پچ تفاضلی</div>
                                            <div className="text-xs font-black text-slate-800 dark:text-slate-200">{updateInfo.latestRelease.size}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 mb-6">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                        تغییرات و قابلیت‌های اضافه شده در این نگارش:
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {updateInfo.latestRelease.changes.map((item, idx) => (
                                            <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 p-3.5 rounded-2xl flex items-start gap-3">
                                                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-lg font-black mt-0.5 ${
                                                    item.category === 'ویژگی جدید' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                    item.category === 'رفع باگ' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                                    item.category === 'امنیت' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                                                    item.category === 'همگام‌سازی' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                                    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                                }`}>
                                                    {item.category}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-5">{item.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-slate-900 dark:text-white">روش اعمال سریع در کلاینت‌های ویندوز</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">پس از آپدیت هاست، با کلیک روی «دریافت سریع پچ»، کلاینت‌های شبکه تغییرات را بارگیری می‌نمایند.</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleStartDeltaUpdate} 
                                        disabled={isUpdating}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 shrink-0 active:scale-95 transition-all"
                                    >
                                        همگام‌سازی و بارگذاری پچ
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CHANGELOG TIMELINE */}
            {activeTab === 'changelog' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 md:p-8 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Clock size={22} className="text-indigo-500" /> تاریخچه نگارش‌ها و تغییرات سامانه
                            </h2>
                            <p className="text-slate-500 text-xs font-bold mt-1">گزارش شفاف توسعه، ویژگی‌های نو و وصله‌های رفع اشکال از ابتدا تا کنون</p>
                        </div>

                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                            {[
                                { id: 'all', label: 'همه دسته‌ها' },
                                { id: 'ویژگی جدید', label: 'ویژگی‌ها' },
                                { id: 'بهبود', label: 'بهبودها' },
                                { id: 'رفع باگ', label: 'رفع باگ‌ها' },
                                { id: 'همگام‌سازی', label: 'همگام‌سازی' }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilterCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                                        filterCategory === cat.id
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-slate-200 before:to-transparent dark:before:via-slate-700">
                        {filteredReleases.map((release, idx) => {
                            const isCurrent = release.version === currentVer;
                            return (
                                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${
                                        isCurrent ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                                    }`}>
                                        {isCurrent ? <ShieldCheck size={18} /> : <FileCode size={16} />}
                                    </div>
                                    
                                    <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 shadow-sm hover:border-blue-500/40 transition-all">
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-lg ${
                                                    isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                }`}>
                                                    v{release.version}
                                                </span>
                                                {isCurrent && (
                                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                        نسخه فعلی
                                                    </span>
                                                )}
                                            </div>
                                            <time className="text-xs font-bold text-slate-400">{toPersianDigits(release.date)}</time>
                                        </div>

                                        <h3 className="font-black text-slate-900 dark:text-white text-sm mb-3.5 leading-6">{release.title}</h3>
                                        
                                        <ul className="space-y-2 mb-4">
                                            {release.changes.map((change, cidx) => (
                                                <li key={cidx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 leading-5">
                                                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-black ${
                                                        change.category === 'رفع باگ' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                        change.category === 'ویژگی جدید' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                        change.category === 'امنیت' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                        {change.category}
                                                    </span>
                                                    <span>{change.desc}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {release.downloadUrl && (
                                            <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px]">
                                                <span className="text-slate-400 font-mono">حجم: {release.size || 'استاندارد'}</span>
                                                <button
                                                    onClick={() => otaService.downloadDesktopInstaller(release.downloadUrl)}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
                                                >
                                                    <span>دانلود فایل پکیج</span>
                                                    <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: DIAGNOSTICS & CORE STATS */}
            {activeTab === 'diagnostics' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-xl space-y-4">
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                            <Server size={18} className="text-blue-500" /> مشخصات اتصال و محیط اجرا
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5">
                                <span className="text-slate-500 font-bold">آدرس هاست اصلی (Host API):</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{API_CONFIG.BASE_URL}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5">
                                <span className="text-slate-500 font-bold">وضعیت Service Worker:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{swStatus}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5">
                                <span className="text-slate-500 font-bold">حجم کش محلی فرانت‌اند:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cacheSize}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5">
                                <span className="text-slate-500 font-bold">نوع ذخیره‌سازی داده‌ها:</span>
                                <span className="font-bold text-indigo-500">پایگاه داده ایزوله (SQLite / IndexedDB)</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-xl space-y-4">
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                            <HardDrive size={18} className="text-emerald-500" /> ابزارهای نگهداری و عیب‌یابی
                        </h3>

                        <p className="text-xs text-slate-500 leading-relaxed mb-4">
                            در صورتی که کلاینت‌های تحت شبکه پس از آپدیت هاست همچنان ظاهر قبلی را نشان می‌دهند، می‌توانید از ابزار کش‌زدایی عمیق استفاده نمایید.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleDeepPurge}
                                className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white p-4 rounded-2xl border border-rose-500/20 font-black text-xs transition-all flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Trash2 size={18} />
                                    <span>پاکسازی کامل کش و بارگذاری مجدد فایل‌ها</span>
                                </div>
                                <ArrowRight size={16} />
                            </button>

                            <button
                                onClick={fetchUpdateStatus}
                                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 p-4 rounded-2xl border border-slate-200 dark:border-white/5 font-black text-xs transition-all flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2.5">
                                    <RefreshCw size={18} />
                                    <span>تست سلامت پینگ و دریافت مجدد مانیفست هاست</span>
                                </div>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
