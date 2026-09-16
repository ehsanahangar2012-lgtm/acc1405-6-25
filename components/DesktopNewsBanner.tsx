import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Sparkles, 
    Tag, 
    ChevronRight, 
    ChevronLeft, 
    X, 
    ExternalLink, 
    Clock, 
    Info, 
    AlertTriangle, 
    Gift, 
    ArrowUpRight,
    Volume2,
    CheckCircle2
} from 'lucide-react';
import { isDesktopApp } from '../utils';
import { persistentStorage } from '../services/persistentStorage';

export interface NewsBroadcastItem {
    id: string;
    title: string;
    message: string;
    type: 'DISCOUNT' | 'UPDATE' | 'NOTICE' | 'ALERT';
    senderName?: string;
    date?: string;
    linkUrl?: string;
    linkText?: string;
    isImportant?: boolean;
}

const DEFAULT_DESKTOP_NEWS: NewsBroadcastItem[] = [
    {
        id: 'news-1',
        title: 'همگام‌سازی ابری و امضای دیجیتال سامانه مالی اشک قلم',
        message: 'قابلیت همگام‌سازی لحظه‌ای داده‌ها با پایگاه داده هاست و کارکرد آفلاین پایدار در دسترس است.',
        type: 'UPDATE',
        senderName: 'بخش IT اشک قلم | www.ashkghalam.ir',
        date: 'امروز',
        isImportant: true
    }
];

export const DesktopNewsBanner: React.FC = () => {
    const [newsList, setNewsList] = useState<NewsBroadcastItem[]>(DEFAULT_DESKTOP_NEWS);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedNews, setSelectedNews] = useState<NewsBroadcastItem | null>(null);

    const isDesktop = isDesktopApp();

    const fetchAnnouncements = async () => {
        try {
            // ۱. اولویت نخست: فراخوانی از persistentStorage سرور
            const remote = await persistentStorage.loadData('announcements');
            const source = (Array.isArray(remote) && remote.length > 0) 
                ? remote 
                : JSON.parse(localStorage.getItem('ashk_server_broadcasts') || '[]');

            if (Array.isArray(source) && source.length > 0) {
                const mapped: NewsBroadcastItem[] = source.map((item: any, idx: number) => ({
                    id: item.id || `bc-${idx}`,
                    title: item.title || 'اطلاعیه سامانه',
                    message: item.message || item.content || '',
                    type: item.type === 'DISCOUNT' ? 'DISCOUNT' : item.type === 'ALERT' ? 'ALERT' : item.type === 'UPDATE' ? 'UPDATE' : 'NOTICE',
                    senderName: item.author || item.senderName || 'بخش IT اشک قلم | www.ashkghalam.ir',
                    date: item.date || item.createdAt || 'اخیر',
                    linkUrl: item.linkUrl,
                    linkText: item.linkText,
                    isImportant: !!item.isImportant
                }));
                setNewsList(mapped);
            }
        } catch (e) {
            console.warn('Failed to load news banner items:', e);
        }
    };

    useEffect(() => {
        fetchAnnouncements();

        const handleUpdate = () => fetchAnnouncements();
        window.addEventListener('ashk_broadcasts_updated', handleUpdate);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener('ashk_broadcasts_updated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    // چرخش خودکار پیام‌ها هر ۷ ثانیه
    useEffect(() => {
        if (isPaused || newsList.length <= 1 || isDismissed) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % newsList.length);
        }, 7000);
        return () => clearInterval(interval);
    }, [isPaused, newsList.length, isDismissed]);

    if (isDismissed || newsList.length === 0) return null;

    const currentItem = newsList[currentIndex] || newsList[0];

    const getBadgeStyle = (type: NewsBroadcastItem['type']) => {
        switch (type) {
            case 'DISCOUNT':
                return {
                    bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
                    icon: <Gift size={13} className="text-amber-400 shrink-0" />,
                    label: 'جشنواره و تخفیف'
                };
            case 'UPDATE':
                return {
                    bg: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
                    icon: <Sparkles size={13} className="text-teal-400 shrink-0" />,
                    label: 'بروزرسانی سیستم'
                };
            case 'ALERT':
                return {
                    bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
                    icon: <AlertTriangle size={13} className="text-rose-400 shrink-0" />,
                    label: 'هشدار مهم'
                };
            default:
                return {
                    bg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
                    icon: <Info size={13} className="text-sky-400 shrink-0" />,
                    label: 'اطلاعیه رسمی'
                };
        }
    };

    const badge = getBadgeStyle(currentItem.type);

    return (
        <>
            <div 
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className="mb-4 w-full bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-200 overflow-hidden no-print"
                dir="rtl"
            >
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                    {/* برچسب دسته‌بندی و عنوان خبر */}
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0 ${badge.bg}`}>
                            {badge.icon}
                            <span>{badge.label}</span>
                        </span>

                        <button
                            type="button"
                            onClick={() => setSelectedNews(currentItem)}
                            className="text-right truncate text-xs font-bold text-slate-200 hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-2"
                        >
                            <span className="truncate">{currentItem.title}</span>
                            <span className="hidden lg:inline text-[11px] text-slate-400 font-normal truncate max-w-md">
                                — {currentItem.message}
                            </span>
                        </button>
                    </div>

                    {/* دکمه‌های کنترل اسلاید و اقدامات */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {newsList.length > 1 && (
                            <div className="flex items-center gap-0.5 bg-slate-950/60 border border-slate-800 rounded-xl px-1 py-0.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrentIndex(prev => (prev - 1 + newsList.length) % newsList.length)}
                                    title="پیام قبلی"
                                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                                >
                                    <ChevronRight size={14} />
                                </button>
                                <span className="text-[10px] font-mono text-slate-400 px-1">
                                    {currentIndex + 1}/{newsList.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentIndex(prev => (prev + 1) % newsList.length)}
                                    title="پیام بعدی"
                                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setSelectedNews(currentItem)}
                            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl text-[11px] font-bold transition cursor-pointer"
                        >
                            <span>مطالعه متن کامل</span>
                            <ArrowUpRight size={12} />
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsDismissed(true)}
                            title="بستن موقت نوار خبر"
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* پنجره پاپ‌آپ متن کامل خبر */}
            {selectedNews && (
                <div 
                    className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    dir="rtl"
                    onClick={() => setSelectedNews(null)}
                >
                    <div 
                        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${getBadgeStyle(selectedNews.type).bg}`}>
                                    {getBadgeStyle(selectedNews.type).icon}
                                    <span>{getBadgeStyle(selectedNews.type).label}</span>
                                </span>
                                <span className="text-xs text-slate-400">
                                    {selectedNews.date}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedNews(null)}
                                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <h3 className="text-lg font-black text-white mb-3 leading-snug">
                            {selectedNews.title}
                        </h3>

                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap mb-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                            {selectedNews.message}
                        </p>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-slate-400">
                                فرستنده: <strong className="text-slate-200">{selectedNews.senderName || 'پشتیبانی نرم‌افزار'}</strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedNews(null)}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-teal-900/30 transition cursor-pointer"
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
