import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { 
  CheckCircle2, AlertCircle, Info, X, Bell, AlertTriangle, RefreshCw, 
  ChevronUp, ChevronDown, Wifi, WifiOff, DollarSign, Layers, ShieldCheck, 
  Clock, HelpCircle, Check, Trash2, Sliders, Smartphone
} from 'lucide-react';
import { useMobile } from '../useMobile';
import { autoSyncService } from '../services/autoSyncService';
import { toPersianDigits, getPersianDate } from '../utils';
import { TrialStatusBadge } from './TrialStatusBadge';
import SmartSectionGuide from './SmartSectionGuide';
import { androidBackButtonService } from '../services/androidBackButtonService';

interface AndroidHeadsUpItemProps {
    notif: any;
    badge: { label: string; bg: string; icon: React.ReactNode };
    onDismiss: (notificationId: string) => void;
    onOpenDrawer: () => void;
}

const AndroidHeadsUpItem: React.FC<AndroidHeadsUpItemProps> = ({ notif, badge, onDismiss, onOpenDrawer }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Display for 1 second, then auto fade out
        const fadeTimer = setTimeout(() => {
            setIsExiting(true);
        }, 1000);

        const removeTimer = setTimeout(() => {
            onDismiss(notif.id);
        }, 1220);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, [onDismiss]);

    const handleManualDismiss = () => {
        setIsExiting(true);
        setTimeout(() => {
            onDismiss(notif.id);
        }, 200);
    };

    return (
        <div
            className={`pointer-events-auto w-full max-w-md bg-slate-900/95 hover:bg-slate-900 border border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 transition-all ${
                isExiting ? 'animate-notif-out' : 'animate-notif-in'
            }`}
        >
            {/* Icon & Message Container */}
            <div 
                onClick={onOpenDrawer}
                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
            >
                <div className={`p-2 rounded-xl shrink-0 border ${badge.bg}`}>
                    {badge.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-300">
                            {notif.title || badge.label}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">لحظاتی پیش</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate mt-0.5">
                        {notif.message}
                    </p>
                </div>
            </div>

            {/* Dismiss button */}
            <button
                onClick={handleManualDismiss}
                className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                title="بستن اعلان"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export const NotificationBar: React.FC = () => {
    const { notifications, removeNotification, addNotification, isOnline } = useStore();
    const { isMobile } = useMobile();
    
    // Heads-up active alert banner (the latest one sliding from top)
    const [headsUpQueue, setHeadsUpQueue] = useState<string[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FINANCIAL' | 'SYNC' | 'OPERATION'>('ALL');
    const [syncing, setSyncing] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [currentTime, setCurrentTime] = useState('');

    // Update real-time clock for android status bar
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setCurrentTime(toPersianDigits(`${hours}:${minutes}`));
        };
        updateClock();
        const interval = setInterval(updateClock, 30000);
        return () => clearInterval(interval);
    }, []);

    // Listen to new notifications and trigger Android Heads-Up Banner
    useEffect(() => {
        if (notifications.length > 0) {
            const latest = notifications[notifications.length - 1];
            if (!headsUpQueue.includes(latest.id)) {
                setHeadsUpQueue(prev => [...prev.slice(-2), latest.id]);
            }
        }
    }, [notifications]);

    // Detect category helper if not explicitly supplied
    const getNotificationCategory = (notif: { message: string; type: string; category?: string }): 'FINANCIAL' | 'SYNC' | 'OPERATION' | 'SYSTEM' => {
        if (notif.category) return notif.category as any;
        const msg = notif.message.toLowerCase();
        if (msg.includes('چک') || msg.includes('مالی') || msg.includes('بدهی') || msg.includes('تراز') || msg.includes('قسط') || msg.includes('ریال') || msg.includes('مبلغ') || msg.includes('صندوق')) {
            return 'FINANCIAL';
        }
        if (msg.includes('سینک') || msg.includes('sync') || msg.includes('اتصال') || msg.includes('اینترنت') || msg.includes('هاست') || msg.includes('شبکه') || msg.includes('سرور') || msg.includes('پایگاه')) {
            return 'SYNC';
        }
        if (msg.includes('ثبت') || msg.includes('ذخیره') || msg.includes('صدور') || msg.includes('حواله') || msg.includes('فاکتور') || msg.includes('قرارداد') || msg.includes('موفق')) {
            return 'OPERATION';
        }
        return 'SYSTEM';
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await autoSyncService.loadFromHost();
            addNotification(
                'success',
                'همگام‌سازی اطلاعات با هاست مرکزی با موفقیت انجام شد.',
                'همگام‌سازی ابری',
                'SYNC'
            );
        } catch {
            addNotification(
                'error',
                'خطا در ارتباط با سرور هاست. لطفاً اتصال اینترنت خود را بررسی کنید.',
                'خطای سینک',
                'SYNC'
            );
        } finally {
            setSyncing(false);
        }
    };

    const clearAll = () => {
        notifications.forEach(n => removeNotification(n.id));
        setHeadsUpQueue([]);
    };

    // Filter notifications in drawer
    const filteredNotifications = useMemo(() => {
        if (selectedCategory === 'ALL') return notifications;
        return notifications.filter(n => getNotificationCategory(n) === selectedCategory);
    }, [notifications, selectedCategory]);

    const activeHeadsUpList = notifications.filter(n => headsUpQueue.includes(n.id));

    const dismissHeadsUp = useCallback((notificationId: string) => {
        setHeadsUpQueue(prev => prev.filter(id => id !== notificationId));
        removeNotification(notificationId);
    }, [removeNotification]);

    // In native Android, Back should close the notification shade before leaving the page.
    useEffect(() => {
        return androidBackButtonService.registerHandler(() => {
            if (showGuideModal) {
                setShowGuideModal(false);
                return true;
            }
            if (isDrawerOpen) {
                setIsDrawerOpen(false);
                return true;
            }
            return false;
        });
    }, [isDrawerOpen, showGuideModal]);

    // Escape is a reliable desktop/PWA fallback; clicking the backdrop also closes the shade.
    useEffect(() => {
        if (!isDrawerOpen && !showGuideModal) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDrawerOpen(false);
                setShowGuideModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDrawerOpen, showGuideModal]);

    // Category Badge Details
    const getCategoryBadge = (category: 'FINANCIAL' | 'SYNC' | 'OPERATION' | 'SYSTEM') => {
        switch (category) {
            case 'FINANCIAL':
                return { label: 'هشدار مالی', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <DollarSign size={13} /> };
            case 'SYNC':
                return { label: 'وضعیت سینک', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <RefreshCw size={13} /> };
            case 'OPERATION':
                return { label: 'تایید عملیات', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={13} /> };
            default:
                return { label: 'سیستمی', bg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: <Info size={13} /> };
        }
    };

    // Test notification triggers for user demonstration
    const triggerDemoAlert = (type: 'FINANCIAL' | 'SYNC' | 'OPERATION') => {
        if (type === 'FINANCIAL') {
            addNotification(
                'warning',
                'یک فقره چک دریافتی به مبلغ ۵۰,۰۰۰,۰۰۰ ریال کمتر از ۲۴ ساعت دیگر سررسید می‌شود.',
                'هشدار سررسید چک',
                'FINANCIAL'
            );
        } else if (type === 'SYNC') {
            addNotification(
                'error',
                'ارتباط با سرور پشتیبان با تاخیر مواجه شد، درخواست در صف آفلاین ذخیره گردید.',
                'خطای اتصال به هاست',
                'SYNC'
            );
        } else {
            addNotification(
                'success',
                'حواله خروج انبار شماره ۹۰۲ با موفقیت صادر و امضای دیجیتال ثبت گردید.',
                'تایید صدور حواله',
                'OPERATION'
            );
        }
    };

    return (
        <>
            {/* 1. ANDROID MINI STATUS BAR TICKER (Top of the screen) */}
            <header className="fixed top-0 left-0 right-0 z-[8000] no-print select-none" dir="rtl">
                <div 
                    className="w-full h-8 bg-slate-950/90 hover:bg-slate-900/95 backdrop-blur-md border-b border-white/5 pr-3 pl-3 md:px-4 flex items-center justify-between text-[11px] text-slate-400 font-mono transition-colors shadow-xs"
                >
                    {/* Left: Clock, status pill, Trial Badge and Smart Guide */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-slate-200 tracking-wider text-xs">{currentTime || '۱۲:۰۰'}</span>
                        <div className="h-3 w-px bg-white/10 mx-0.5"></div>
                        <div className="flex items-center gap-1 text-[10px]">
                            {isOnline ? (
                                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                                    <Wifi size={11} />
                                    <span className="hidden sm:inline">آنلاین</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-rose-400 font-bold">
                                    <WifiOff size={11} />
                                    <span className="hidden sm:inline">آفلاین</span>
                                </span>
                            )}
                        </div>
                        <div className="h-3 w-px bg-white/10 mx-0.5 hidden sm:block"></div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <TrialStatusBadge />
                            <SmartSectionGuide />
                        </div>
                    </div>

                    {/* Center: Quick Android Ticker Message or drag hint */}
                    <div 
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate max-w-[160px] sm:max-w-xs md:max-w-md cursor-pointer"
                    >
                        {notifications.length > 0 ? (
                            <div className="flex items-center gap-1 text-teal-400 font-bold truncate animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                                <span className="truncate">{notifications[notifications.length - 1].message}</span>
                            </div>
                        ) : (
                            <span className="text-slate-500 hidden md:inline">سامانه حسابداری اشک قلم • آماده و همگام</span>
                        )}
                    </div>

                    {/* Right: Notification count badge & swipe indicator */}
                    <div 
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        className="flex items-center gap-2 font-bold shrink-0 cursor-pointer"
                    >
                        {notifications.length > 0 && (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[9px] flex items-center gap-1">
                                <Bell size={10} />
                                {toPersianDigits(notifications.length.toString())}
                            </span>
                        )}
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </header>

            {/* 2. ANDROID HEADS-UP NOTIFICATION (Small non-intrusive banner on top with 1s display & auto fade-out) */}
            <div className="fixed top-9 left-0 right-0 z-[8500] pointer-events-none flex flex-col items-center gap-2 px-3 no-print" dir="rtl">
                {activeHeadsUpList.map((notif) => {
                    const cat = getNotificationCategory(notif);
                    const badge = getCategoryBadge(cat);

                    return (
                        <AndroidHeadsUpItem
                            key={notif.id}
                            notif={notif}
                            badge={badge}
                            onDismiss={dismissHeadsUp}
                            onOpenDrawer={() => setIsDrawerOpen(true)}
                        />
                    );
                })}
            </div>

            {/* 3. ANDROID NOTIFICATION SHADE / DRAWER (Slides down from top) */}
            <div
                aria-hidden={!isDrawerOpen}
                className={`fixed inset-x-0 top-0 z-[8800] bg-slate-950/98 border-b border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform duration-200 no-print flex flex-col ${
                    isDrawerOpen ? 'translate-y-0 pointer-events-auto' : '-translate-y-full pointer-events-none'
                }`}
                style={{
                    maxHeight: isMobile ? '52vh' : '72vh',
                    overflow: 'hidden',
                    overscrollBehavior: 'contain',
                    transform: isDrawerOpen ? 'translateY(0)' : 'translateY(-105%)',
                    visibility: isDrawerOpen ? 'visible' : 'hidden',
                    willChange: isDrawerOpen ? 'transform' : 'auto'
                }}
                dir="rtl"
            >
                {/* Drawer Header (responsive so the close action stays visible on narrow phones) */}
                <div className="p-3 sm:p-4 border-b border-white/10 space-y-2.5 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div className="flex items-center justify-between gap-3 w-full sm:w-auto min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
                                    <Bell size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                                        مرکز اعلان‌های سیستم
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono shrink-0">
                                            {toPersianDigits(notifications.length.toString())}
                                        </span>
                                    </h3>
                                    <p className="hidden sm:block text-[10px] text-slate-400 font-medium">هشدارهای مالی، خطاهای سینک و تاییدیه‌ها</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDrawerOpen(false)}
                                aria-label="بستن مرکز اعلان‌ها"
                                title="بستن اعلان‌ها"
                                className="min-w-10 min-h-10 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-1 transition-all border border-white/10 shrink-0"
                            >
                                <X size={18} />
                                <span className="text-[11px] font-bold">بستن</span>
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* Smart Guide Button */}
                            <button
                                onClick={() => setShowGuideModal(true)}
                                className="w-8 h-8 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/20 transition-all active:scale-95"
                                title="راهنمای اعلان‌ها"
                            >
                                <HelpCircle size={16} />
                            </button>

                            {/* Manual Sync Button */}
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                                title="همگام‌سازی فوری با هاست"
                            >
                                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">سینک فوری</span>
                            </button>

                            {/* Clear All */}
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAll}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-black flex items-center gap-1.5 transition-all"
                                >
                                    <Trash2 size={14} />
                                    <span>پاک کردن</span>
                                </button>
                            )}


                        </div>
                    </div>

                    {/* Quick Category Filters & Demo Trigger Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                            {(['ALL', 'FINANCIAL', 'SYNC', 'OPERATION'] as const).map((cat) => {
                                const labels: Record<string, string> = {
                                    ALL: 'همه اعلان‌ها',
                                    FINANCIAL: 'هشدارهای مالی',
                                    SYNC: 'سینک و شبکه',
                                    OPERATION: 'تایید عملیات'
                                };
                                const isSelected = selectedCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                                            isSelected 
                                                ? 'bg-teal-600 text-white shadow-md' 
                                                : 'bg-white/5 text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        {labels[cat]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Test Notification Quick Actions (Helpful for quick verification) */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span>تست سیستم:</span>
                            <button onClick={() => triggerDemoAlert('FINANCIAL')} className="text-amber-400 hover:underline px-1">مالی</button>
                            <span>•</span>
                            <button onClick={() => triggerDemoAlert('SYNC')} className="text-cyan-400 hover:underline px-1">سینک</button>
                            <span>•</span>
                            <button onClick={() => triggerDemoAlert('OPERATION')} className="text-emerald-400 hover:underline px-1">تایید</button>
                        </div>
                    </div>
                </div>

                {/* Notifications List Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                    {filteredNotifications.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center text-slate-600">
                                <Bell size={22} />
                            </div>
                            <p className="text-xs text-slate-400 font-bold">هیچ اعلان فعالی در این بخش وجود ندارد.</p>
                            <p className="text-[10px] text-slate-600">هشدارهای مالی، خطاهای سینک و تاییدیه‌ها در اینجا نمایش داده خواهند شد.</p>
                        </div>
                    ) : (
                        filteredNotifications.map((n) => {
                            const cat = getNotificationCategory(n);
                            const badge = getCategoryBadge(cat);

                            return (
                                <div
                                    key={n.id}
                                    className="bg-slate-900/80 hover:bg-slate-900 border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-start gap-3 transition-all group shadow-sm"
                                >
                                    <div className={`p-2 rounded-xl shrink-0 border ${badge.bg}`}>
                                        {badge.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-black text-white flex items-center gap-2">
                                                {n.title || badge.label}
                                                <span className={`text-[9px] px-2 py-0.2 rounded-md font-bold ${badge.bg}`}>
                                                    {badge.label}
                                                </span>
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-mono">
                                                {n.timestamp ? toPersianDigits(n.timestamp) : 'امروز'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                            {n.message}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeNotification(n.id)}
                                        className="min-w-9 min-h-9 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center shrink-0 transition-colors"
                                        title="حذف"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Drawer Footer Handle */}
                <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="min-h-10 p-2 border-t border-white/5 flex items-center justify-center gap-2 cursor-pointer bg-slate-950/60 hover:bg-slate-900/80 transition-colors text-slate-300"
                    aria-label="بستن مرکز اعلان‌ها"
                >
                    <ChevronUp size={16} />
                    <span className="text-xs font-bold">بستن مرکز اعلان‌ها</span>
                </button>
            </div>

            {/* Backdrop for open drawer */}
            {isDrawerOpen && (
                <div
                    onClick={() => setIsDrawerOpen(false)}
                    className="fixed inset-0 z-[8700] bg-black/60 backdrop-blur-xs no-print transition-opacity"
                ></div>
            )}

            {/* Smart Guide Modal for Notification System */}
            {showGuideModal && (
                <div className="fixed inset-0 z-[9500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-teal-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 text-teal-400">
                                <HelpCircle size={22} />
                                <h3 className="font-black text-white text-base">راهنمای سیستم نوتیفیکیشن‌بار اندرویدی</h3>
                            </div>
                            <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-amber-300 block mb-1">💰 هشدارهای مالی (Financial Alerts):</strong>
                                سررسید چک‌های صیادی، موعد اقساط قراردادها، نزدیک شدن به سقف اعتبار اشخاص و مغایرت‌های حسابداری فوراً به عنوان هشدار مالی زرد/قرمز هشدار داده می‌شوند.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-cyan-300 block mb-1">🔄 وضعیت سینک و شبکه (Sync Status):</strong>
                                در صورت قطعی اتصال یا تاخیر در همگام‌سازی ابری، داده‌ها در صف آفلاین ذخیره شده و خطای سینک به عنوان نوار هشدار به کاربر اعلام می‌شود تا از همزمانی داده‌ها اطمینان حاصل کند.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-emerald-300 block mb-1">✅ تایید عملیات (Operation Confirmations):</strong>
                                صدور حواله، ثبت فاکتور رسمی، امضای دیجیتال و تراکنش‌های انبار بلافاصله با نشان سبز تایید و بدون ایجاد وقفه در کار شما اعلام می‌گردند.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-indigo-300 block mb-1">📱 دسترسی آسان شبیه نوار اندروید:</strong>
                                با لمس نوار باریک بالای صفحه، کشوی کامل اعلان‌ها باز شده و امکان فیلتر دسته‌بندی و سینک فوری فراهم است.
                            </div>
                        </div>

                        <button
                            onClick={() => setShowGuideModal(false)}
                            className="w-full bg-teal-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
