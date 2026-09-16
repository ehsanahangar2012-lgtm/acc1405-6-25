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
    CheckCircle2,
    Monitor,
    Smartphone,
    Globe
} from 'lucide-react';
import { isDesktopApp, isAndroidApp, getAppPlatform } from '../utils';
import { persistentStorage } from '../services/persistentStorage';
import { PlatformContentService } from '../services/platformContentService';

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
    platform?: 'all' | 'windows' | 'android' | 'web';
}

const getDefaultPlatformNews = (): NewsBroadcastItem[] => {
    const platform = getAppPlatform();
    const details = PlatformContentService.getDetails(platform);

    if (platform === 'windows') {
        return [
            {
                id: 'news-win-1',
                title: 'بهینه‌سازی سرعت فوق‌سریع در نسخه ویندوز دسکتاپ',
                message: 'عملکرد نرم‌افزار در حالت متصل و آفلاین با حافظه کش RAM و ذخیره‌سازی غیرمسدودکننده بهینه‌سازی شد. سرعت اجرای برنامه‌ها به حداکثر رسیده است.',
                type: 'UPDATE',
                senderName: 'پشتیبانی فنی اشک قلم — دسکتاپ ویندوز',
                date: 'امروز',
                isImportant: true,
                platform: 'windows'
            },
            {
                id: 'news-win-2',
                title: 'کلیدهای میانبر سریع ویندوز',
                message: 'با کلیدهای Alt+1 (پیشخوان) تا Alt+6 (اشخاص) و Alt+7 (گزارشات) با نهایت سرعت بین بخش‌های مختلف جابجا شوید.',
                type: 'NOTICE',
                senderName: 'راهنمای کاربری ویندوز',
                date: 'امروز',
                isImportant: false,
                platform: 'windows'
            }
        ];
    } else if (platform === 'android') {
        return [
            {
                id: 'news-and-1',
                title: 'ارسال مستقیم پیامک با سیم‌کارت گوشی اندروید',
                message: 'در نسخه همراه اندروید، فاکتورها و صورتحساب‌ها را مستقیماً با سیم‌کارت داخلی گوشی و بدون نیاز به خرید اعتبار پیامکی برای مشتریان ارسال فرمایید.',
                type: 'UPDATE',
                senderName: 'واحد موبایل اشک قلم',
                date: 'امروز',
                isImportant: true,
                platform: 'android'
            },
            {
                id: 'news-and-2',
                title: 'اسکنر بارکد با دوربین تلفن همراه',
                message: 'در بخش انبار و صدور فاکتور با لمس دکمه دوربین، بارکد کالاها را به سرعت اسکن و ثبت نمایید.',
                type: 'NOTICE',
                senderName: 'راهنمای اندروید',
                date: 'امروز',
                isImportant: false,
                platform: 'android'
            }
        ];
    } else {
        return [
            {
                id: 'news-web-1',
                title: 'سامانه ابری و وب‌سرویس یکپارچه مالی اشک قلم',
                message: 'پایگاه داده متمرکز، پشتیبان‌گیری خودکار ابری، تعریف دسترسی کاربران و اتصال یکپارچه با اپلیکیشن اندروید و ویندوز فعال است.',
                type: 'UPDATE',
                senderName: 'مرکز سرور و هاست اشک قلم',
                date: 'امروز',
                isImportant: true,
                platform: 'web'
            }
        ];
    }
};

export const DesktopNewsBanner: React.FC = () => {
    const [newsList, setNewsList] = useState<NewsBroadcastItem[]>(getDefaultPlatformNews());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedNews, setSelectedNews] = useState<NewsBroadcastItem | null>(null);

    const platform = getAppPlatform();

    const fetchAnnouncements = async () => {
        try {
            const remote = await persistentStorage.loadData('announcements');
            const source = (Array.isArray(remote) && remote.length > 0) 
                ? remote 
                : JSON.parse(localStorage.getItem('ashk_server_broadcasts') || '[]');

            if (Array.isArray(source) && source.length > 0) {
                const currentPlat = getAppPlatform();
                const filtered = source.filter((item: any) => !item.platform || item.platform === 'all' || item.platform === currentPlat);
                
                if (filtered.length > 0) {
                    const mapped: NewsBroadcastItem[] = filtered.map((item: any, idx: number) => ({
                        id: item.id || `bc-${idx}`,
                        title: item.title || 'اطلاعیه سامانه',
                        message: item.message || item.content || '',
                        type: item.type === 'DISCOUNT' ? 'DISCOUNT' : item.type === 'ALERT' ? 'ALERT' : item.type === 'UPDATE' ? 'UPDATE' : 'NOTICE',
                        senderName: item.author || item.senderName || 'پشتیبانی سامانه اشک قلم',
                        date: item.date || item.createdAt || 'امروز',
                        linkUrl: item.linkUrl,
                        linkText: item.linkText,
                        isImportant: !!item.isImportant,
                        platform: item.platform || 'all'
                    }));
                    setNewsList(mapped);
                    return;
                }
            }
            setNewsList(getDefaultPlatformNews());
        } catch (e) {
            setNewsList(getDefaultPlatformNews());
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

    // چرخش خودکار پیام‌ها هر ۸ ثانیه
    useEffect(() => {
        if (isPaused || newsList.length <= 1 || isDismissed) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % newsList.length);
        }, 8000);
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
                            <span>مطالعه کامل</span>
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
                                مرجع: <strong className="text-slate-200">{selectedNews.senderName || 'سامانه حسابداری اشک قلم'}</strong>
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
