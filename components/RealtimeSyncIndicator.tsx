import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, X, HelpCircle, Server, Activity, Database, Sparkles } from 'lucide-react';
import { realtimeSyncService } from '../services/realtimeSyncService';
import { realConnectionService } from '../services/realConnectionService';
import { syncQueue } from '../services/syncQueueService';
import { hostDB } from '../services/hostDatabaseService';
import { toPersianDigits, getPersianDate, getPersianTime } from '../utils';

export type HostLedState = 'green' | 'yellow' | 'red';

export const RealtimeSyncIndicator: React.FC = () => {
    const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [isHostOnline, setIsHostOnline] = useState<boolean>(true);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [queueCount, setQueueCount] = useState<number>(0);
    const [lastCheckTime, setLastCheckTime] = useState<string>('');
    const [showModal, setShowModal] = useState<boolean>(false);
    const [showHelp, setShowHelp] = useState<boolean>(false);

    // بررسی وضعیت و محاسبه وضعیت سه‌گانه LED: سبز / زرد / قرمز
    const evaluateStatus = async () => {
        const details = realConnectionService.getConnectionDetails();
        setIsBrowserOnline(details.browserOnline);
        setIsHostOnline(details.hostOnline);

        try {
            const stats = syncQueue.getStats();
            setQueueCount(stats.total);
        } catch {
            setQueueCount(0);
        }

        setLastCheckTime(`${getPersianDate()} ساعت ${getPersianTime()}`);
    };

    useEffect(() => {
        // شروع سرویس بلادرنگ
        realtimeSyncService.start();
        evaluateStatus();

        // مشترک شدن در تغییرات وضعیت اتصال
        const unsubscribe = realConnectionService.subscribe((online) => {
            setIsHostOnline(online);
            evaluateStatus();
        });

        const handleOnline = () => {
            setIsBrowserOnline(true);
            evaluateStatus();
        };

        const handleOffline = () => {
            setIsBrowserOnline(false);
            setIsHostOnline(false);
            evaluateStatus();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // بررسی دوره‌ای صف و وضعیت هاست هر ۲۰ ثانیه
        const interval = setInterval(evaluateStatus, 20000);

        return () => {
            realtimeSyncService.stop();
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    // وضعیت LED خبری:
    // ۱. سبز: اتصال پایدار (اینترنت وصل + هاست پاسخگو + بدون سینک فعال + صف خالی)
    // ۲. زرد: مشکل موقت (در حال سینک یا اینترنت وصل ولی هاست با تاخیر یا وجود موارد در صف)
    // ۳. قرمز: عدم اتصال (آفلاین یا قطع کامل ارتباط با سرور)
    const ledState: HostLedState = (() => {
        if (!isBrowserOnline || (!isHostOnline && queueCount > 5)) {
            return 'red';
        }
        if (isSyncing || queueCount > 0 || !isHostOnline) {
            return 'yellow';
        }
        return 'green';
    })();

    const handleForceSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await realtimeSyncService.forceSync();
            await hostDB.processQueue().catch(() => {});
            await evaluateStatus();
        } catch (err) {
            console.error('Force sync error:', err);
        } finally {
            setTimeout(() => {
                setIsSyncing(false);
                evaluateStatus();
            }, 800);
        }
    };

    // متن خلاصه وضعیت
    const getStatusText = () => {
        if (ledState === 'green') return 'متصل به هاست';
        if (ledState === 'yellow') {
            if (isSyncing) return 'در حال همگام‌سازی...';
            if (queueCount > 0) return `${toPersianDigits(queueCount.toString())} در صف ارسال`;
            return 'بررسی ارتباط هاست';
        }
        return 'عدم اتصال به هاست';
    };

    return (
        <>
            {/* نمای موبایل: LED خبری مینیاتوری در گوشه چپ نوار وضعیت بدون هیچ‌گونه تداخل */}
            <div className="fixed top-1 left-2.5 z-[8900] md:hidden no-print" dir="rtl">
                <button
                    onClick={() => setShowModal(true)}
                    className={`relative flex items-center justify-center w-6 h-6 rounded-full border transition-all active:scale-90 ${
                        ledState === 'green'
                            ? 'bg-emerald-950/80 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                            : ledState === 'yellow'
                            ? 'bg-amber-950/80 border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse'
                            : 'bg-rose-950/80 border-rose-500/60 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                    }`}
                    title={`وضعیت هاست: ${getStatusText()} (لمس برای مشاهده جزئیات)`}
                    aria-label="نشانگر LED وضعیت اتصال به هاست"
                >
                    {/* حلقه بیرونی پالس نوری */}
                    <span 
                        className={`absolute inset-0 rounded-full opacity-75 ${
                            ledState === 'green'
                                ? 'bg-emerald-500/20'
                                : ledState === 'yellow'
                                ? 'bg-amber-400/30 animate-ping'
                                : 'bg-rose-500/30 animate-ping'
                        }`}
                        style={{ animationDuration: ledState === 'yellow' ? '2.5s' : '3s' }}
                    />
                    
                    {/* هسته درخشان LED */}
                    <span 
                        className={`w-2.5 h-2.5 rounded-full z-10 transition-colors ${
                            ledState === 'green'
                                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                : ledState === 'yellow'
                                ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                                : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                        }`}
                    />
                </button>
            </div>

            {/* نمای دسکتاپ: نشانگر جمع‌وجور شیک کنار دکمه راهنما بدون تداخل */}
            <div className="fixed top-3 left-14 z-[90] hidden md:flex items-center gap-1.5 no-print" dir="rtl">
                <div 
                    onClick={() => setShowModal(true)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-102 ${
                        ledState === 'green'
                            ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-400'
                            : ledState === 'yellow'
                            ? 'bg-slate-900/90 border-amber-500/40 text-amber-300'
                            : 'bg-slate-900/90 border-rose-500/40 text-rose-400'
                    }`}
                >
                    {/* LED نقطه نوری */}
                    <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            ledState === 'green' ? 'bg-emerald-400' :
                            ledState === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                            ledState === 'green' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' :
                            ledState === 'yellow' ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]' : 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
                        }`} />
                    </span>

                    <span className="text-[11px] font-black tracking-tight">
                        {getStatusText()}
                    </span>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleForceSync();
                        }}
                        disabled={isSyncing}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white disabled:opacity-40"
                        title="همگام‌سازی دستی و تست اتصال"
                    >
                        <RefreshCw size={11} className={isSyncing ? 'animate-spin text-teal-400' : ''} />
                    </button>
                </div>
            </div>

            {/* مدال تعاملی وضعیت هوشمند اتصال به هاست و تفسیر LED */}
            {showModal && (
                <div 
                    className="fixed inset-0 z-[9600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print"
                    dir="rtl"
                    onClick={() => setShowModal(false)}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up"
                    >
                        {/* هدر مدال */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                                    ledState === 'green'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : ledState === 'yellow'
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                }`}>
                                    <Activity size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-sm">وضعیت اتصال به هاست ابری</h3>
                                    <span className="text-[10px] text-slate-400 font-medium">نشانگر زنده و صف همگام‌سازی اطلاعات</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20 flex items-center justify-center"
                                    title="راهنمای نشانگر هوشمند"
                                >
                                    <HelpCircle size={15} />
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-7 h-7 rounded-lg bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* وضعیت زنده فعلی */}
                        <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                            ledState === 'green'
                                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                : ledState === 'yellow'
                                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <span className="relative flex h-3.5 w-3.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                        ledState === 'green' ? 'bg-emerald-400' :
                                        ledState === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'
                                    }`} />
                                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                                        ledState === 'green' ? 'bg-emerald-500' :
                                        ledState === 'yellow' ? 'bg-amber-400' : 'bg-rose-500'
                                    }`} />
                                </span>
                                <div>
                                    <span className="text-xs font-black block text-white">
                                        {ledState === 'green' && 'اتصال کامل و فعال به هاست'}
                                        {ledState === 'yellow' && 'هشدار موقت یا در حال همگام‌سازی'}
                                        {ledState === 'red' && 'عدم برقراری ارتباط با هاست'}
                                    </span>
                                    <span className="text-[10px] opacity-80 block mt-0.5">
                                        {ledState === 'green' && 'داده‌ها به صورت لحظه‌ای با هاست همگام می‌شوند.'}
                                        {ledState === 'yellow' && 'تغییرات در صف ارسال موقت قرار دارند و ذخیره شده‌اند.'}
                                        {ledState === 'red' && 'سامانه در حالت آفلاین محلی فعال است و اطلاعات محفوظ می‌باشد.'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* راهنمای ۳ حالت رنگی LED خبری */}
                        <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 space-y-2 text-xs">
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">راهنمای رنگ‌های LED خبری در موبایل:</span>
                            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] shrink-0" />
                                <strong className="text-emerald-400">سبز:</strong>
                                <span>اتصال پایدار و تبادل زنده داده با هاست</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b] shrink-0 animate-pulse" />
                                <strong className="text-amber-400">زرد:</strong>
                                <span>مشکل موقت، تاخیر، یا در حال سینک/وجود داده در صف</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444] shrink-0" />
                                <strong className="text-rose-400">قرمز:</strong>
                                <span>عدم اتصال به سرور یا قطع اینترنت</span>
                            </div>
                        </div>

                        {/* جزئیات تشخیصی */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-slate-400 text-[10px] block">اینترنت مرورگر:</span>
                                <span className={`font-black ${isBrowserOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isBrowserOnline ? 'متصل' : 'قطع'}
                                </span>
                            </div>
                            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-slate-400 text-[10px] block">پاسخگویی هاست:</span>
                                <span className={`font-black ${isHostOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {isHostOnline ? 'آنلاین' : 'تاخیر / بدون پاسخ'}
                                </span>
                            </div>
                            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-slate-400 text-[10px] block">عملیات در صف همگام‌سازی:</span>
                                <span className="font-mono font-bold text-white">
                                    {toPersianDigits(queueCount.toString())} رکورد
                                </span>
                            </div>
                            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-slate-400 text-[10px] block">آخرین بررسی:</span>
                                <span className="font-mono text-[9px] text-slate-300">
                                    {lastCheckTime || 'در حال بررسی...'}
                                </span>
                            </div>
                        </div>

                        {/* دکمه‌های اقدام */}
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleForceSync}
                                disabled={isSyncing}
                                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                                <span>{isSyncing ? 'در حال همگام‌سازی...' : 'تست اتصال و ارسال صف'}</span>
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RealtimeSyncIndicator;
