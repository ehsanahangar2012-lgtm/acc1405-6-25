import React, { useState, useEffect } from 'react';
import { Megaphone, X, ExternalLink, Sparkles, DownloadCloud, Settings2, Check, RefreshCw } from 'lucide-react';
import { getPersianDate, toPersianDigits } from '../utils';
import { useStore } from '../store';
import { persistentStorage } from '../services/persistentStorage';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'promo' | 'info';
  date: string;
  link?: string;
  linkText?: string;
}

// تابع دریافت اطلاعیه‌ها و پیشنهادات از سرور مرکزی، فایل کانفیگ یا حافظه اشتراکی سرور
const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const currentDate = getPersianDate();

  // ۱. بررسی دریافت مستقیم از پایگاه داده ابری هاست (persistentStorage)
  try {
    const remoteData = await persistentStorage.loadData('announcements');
    if (Array.isArray(remoteData) && remoteData.length > 0) {
      const activeBroadcasts = remoteData
        .filter((b: any) => b.active !== false)
        .map((b: any) => ({
          id: b.id || 'ann-' + Math.random(),
          title: b.title || 'اطلاعیه سامانه',
          content: b.message || b.content || '',
          type: (b.type === 'DISCOUNT' ? 'promo' : b.type === 'UPDATE' ? 'update' : 'info') as 'promo' | 'update' | 'info',
          date: b.date || currentDate,
          link: b.link || '',
          linkText: b.linkText || 'مشاهده جزئیات'
        }));
      if (activeBroadcasts.length > 0) {
        return activeBroadcasts;
      }
    }
  } catch {}

  // ۲. بررسی دریافت از کش محلی سرور مادر / پورتال مدیریت سرور مرکزی (ClientBroadcastHub)
  try {
    const serverBroadcasts = localStorage.getItem('ashk_server_broadcasts');
    if (serverBroadcasts) {
      const parsed = JSON.parse(serverBroadcasts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeBroadcasts = parsed
          .filter(b => b.active !== false)
          .map(b => ({
            id: b.id || 'ann-' + Math.random(),
            title: b.title || 'اطلاعیه سامانه',
            content: b.message || b.content || '',
            type: (b.type === 'DISCOUNT' ? 'promo' : b.type === 'UPDATE' ? 'update' : 'info') as 'promo' | 'update' | 'info',
            date: b.date || currentDate,
            link: b.link || '',
            linkText: b.linkText || 'مشاهده جزئیات'
          }));
        if (activeBroadcasts.length > 0) {
          return activeBroadcasts;
        }
      }
    }
  } catch {}

  // ۲. بررسی فراخوانی API مرکزی (در صورت فعال بودن وب‌سرور یا cPanel)
  try {
    const res = await fetch('/api/broadcasts.php', { method: 'GET', cache: 'no-cache' }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          id: item.id || 'ann-' + Math.random(),
          title: item.title || 'اطلاعیه سامانه',
          content: item.content || item.message || '',
          type: (item.type === 'promo' || item.type === 'update' ? item.type : 'info') as 'promo' | 'update' | 'info',
          date: item.date || currentDate,
          link: item.link || '',
          linkText: item.linkText || 'مشاهده جزئیات'
        }));
      }
    }
  } catch {}

  // ۳. اطلاعیه‌های پیش‌فرض پویا با تاریخ جاری شمسی (بدون هیچ تاریخ ثابت یا قدیمی)
  return [
    {
      id: 'app-update-latest',
      title: 'ارتقای پایگاه داده و سرعت سامانه (نسخه ۱۶.۱۲.۰)',
      content: 'موتور پایگاه داده ایزوله ویندوز فعال گردید. تمامی اطلاعات هم‌اکنون به صورت فایل دیتابیس مستقل روی هارد دیسک و خروجی رابطه ای SQL ذخیره می‌شوند.',
      type: 'update',
      date: currentDate,
      link: '#update-engine',
      linkText: 'بررسی وضعیت دیتابیس'
    },
    {
      id: 'festival-promo-current',
      title: 'جشنواره تخفیف ویژه نرم‌افزار جامع اشک قلم',
      content: 'با ارتقا یا تمدید سالانه لایسنس کسب‌وکار و فعال‌سازی سرویس مؤدیان، از ۴۰٪ تخفیف انحصاری بهره‌مند شوید.',
      type: 'promo',
      date: currentDate,
      link: '#contact-sales',
      linkText: 'دریافت تخفیف'
    }
  ];
};

export const SplashAnnouncement: React.FC = () => {
  const currentUser = useStore(state => state.currentUser);
  const isAdmin = !currentUser || currentUser.roleId === 'admin' || Boolean(currentUser.permissions?.settings?.edit);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // وضعیت ویرایش محتوا برای مدیر و هنگام نصب
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<'update' | 'promo' | 'info'>('promo');
  const [editLink, setEditLink] = useState('');
  const [editLinkText, setEditLinkText] = useState('');

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements();
      const seenIds = JSON.parse(localStorage.getItem('seen_announcements') || '[]');
      
      // نمایش مواردی که کاربر هنوز ندیده است (یا همه در حالت تنظیم مجدد)
      const newAnnouncements = data.filter(a => !seenIds.includes(a.id));
      
      if (newAnnouncements.length > 0) {
        setAnnouncements(newAnnouncements);
        setIsOpen(true);
      } else if (data.length > 0 && localStorage.getItem('ashk_always_show_announcement') === 'true') {
        setAnnouncements(data);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // بررسی پس از تاخیر کوتاه تا لود اولیه انجام شود
    const timer = setTimeout(loadAnnouncements, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (announcements[currentIndex]) {
      const seenIds = JSON.parse(localStorage.getItem('seen_announcements') || '[]');
      localStorage.setItem('seen_announcements', JSON.stringify([...seenIds, announcements[currentIndex].id]));
    }

    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsOpen(false);
      setIsEditing(false);
    }
  };

  const handleAction = () => {
    const current = announcements[currentIndex];
    if (current?.link === '#update-engine') {
      window.location.hash = '/settings';
      setIsOpen(false);
    } else if (current?.link === '#contact-sales') {
      window.dispatchEvent(new CustomEvent('open-trial-limit-modal', { detail: { reason: 'PROMO' } }));
      setIsOpen(false);
    } else if (current?.link) {
      window.open(current.link, '_blank');
    }
  };

  const handleStartEdit = () => {
    const current = announcements[currentIndex] || {
      title: '',
      content: '',
      date: getPersianDate(),
      type: 'promo',
      link: '',
      linkText: ''
    };
    setEditTitle(current.title);
    setEditContent(current.content);
    setEditDate(current.date || getPersianDate());
    setEditType(current.type || 'promo');
    setEditLink(current.link || '');
    setEditLinkText(current.linkText || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim() || !editContent.trim()) return;

    const currentId = announcements[currentIndex]?.id || 'ann-' + Date.now();
    const updatedAnnouncement: Announcement = {
      id: currentId,
      title: editTitle.trim(),
      content: editContent.trim(),
      date: editDate.trim() || getPersianDate(),
      type: editType,
      link: editLink.trim() || undefined,
      linkText: editLinkText.trim() || undefined
    };

    const updatedList = [...announcements];
    updatedList[currentIndex] = updatedAnnouncement;
    setAnnouncements(updatedList);

    // ذخیره در سرور مادر و حافظه محلی
    try {
      const serverBroadcasts = localStorage.getItem('ashk_server_broadcasts');
      let broadcastsList = serverBroadcasts ? JSON.parse(serverBroadcasts) : [];
      if (!Array.isArray(broadcastsList)) broadcastsList = [];

      const existingIndex = broadcastsList.findIndex((b: any) => b.id === currentId);
      const broadcastItem = {
        id: currentId,
        title: updatedAnnouncement.title,
        message: updatedAnnouncement.content,
        type: updatedAnnouncement.type === 'promo' ? 'DISCOUNT' : updatedAnnouncement.type === 'update' ? 'UPDATE' : 'NOTICE',
        date: updatedAnnouncement.date,
        link: updatedAnnouncement.link,
        linkText: updatedAnnouncement.linkText,
        active: true
      };

      if (existingIndex >= 0) {
        broadcastsList[existingIndex] = broadcastItem;
      } else {
        broadcastsList.unshift(broadcastItem);
      }
      localStorage.setItem('ashk_server_broadcasts', JSON.stringify(broadcastsList));
      // پاک کردن سابقه بازدید تا همه کلاینت‌ها اعلان ویرایش شده را ببینند
      localStorage.removeItem('seen_announcements');
    } catch {}

    setIsEditing(false);
  };

  if (!isOpen || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'update': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'promo': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'update': return <DownloadCloud size={24} />;
      case 'promo': return <Sparkles size={24} />;
      default: return <Megaphone size={24} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col animate-scale-up">
        
        <div className="absolute top-5 left-5 flex items-center gap-2 z-10">
          {isAdmin && (
            <button 
              type="button"
              onClick={() => isEditing ? setIsEditing(false) : handleStartEdit()}
              className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition"
              title="ویرایش متن و تاریخ این پیشنهاد"
            >
              <Settings2 size={18} />
            </button>
          )}
          <button 
            type="button"
            onClick={handleClose}
            className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {isEditing ? (
          /* فرم ویرایش آنلاین محتوا برای مدیر یا هنگام نصب */
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-5 h-5 text-teal-500" />
              <h3 className="font-black text-slate-800 dark:text-white text-base">ویرایش محتوای پاپ‌آپ و تاریخ پیشنهاد</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان پیشنهاد یا اطلاعیه:</label>
              <input 
                type="text" 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تاریخ نمایش (شمسی):</label>
                <input 
                  type="text" 
                  value={editDate} 
                  onChange={e => setEditDate(e.target.value)}
                  placeholder={getPersianDate()}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">نوع اطلاعیه:</label>
                <select 
                  value={editType} 
                  onChange={e => setEditType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="promo">جشنواره و پیشنهاد ویژه</option>
                  <option value="update">بروزرسانی نرم‌افزار</option>
                  <option value="info">اطلاعیه عمومی</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">متن پیام یا توضیحات تخفیف:</label>
              <textarea 
                rows={3}
                value={editContent} 
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
              >
                <Check size={16} />
                <span>ذخیره و انتشار در سامانه</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 font-bold text-xs"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          /* نمایش استاندارد پاپ‌آپ */
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${getTypeStyles(current.type)}`}>
              {getTypeIcon(current.type)}
            </div>

            <div className="flex gap-2 items-center mb-2 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${getTypeStyles(current.type)}`}>
                {current.type === 'update' ? 'بروزرسانی' : current.type === 'promo' ? 'پیشنهاد جشنواره' : 'اطلاعیه'}
              </span>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">بخش IT اشک قلم | www.ashkghalam.ir</span>
              <span className="text-xs text-slate-500 font-bold mr-auto">{toPersianDigits(current.date)}</span>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight">{current.title}</h2>
            
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-6 font-medium mb-6">
              {current.content}
            </p>

            <div className="mt-auto flex flex-col sm:flex-row gap-2.5">
              {current.link && (
                <button 
                  onClick={handleAction}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-3 font-black text-xs flex items-center justify-center gap-1.5 transition shadow"
                >
                  {current.linkText || 'مشاهده جزئیات'}
                  <ExternalLink size={14} />
                </button>
              )}
              <button 
                onClick={handleClose}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl py-3 font-black text-xs transition"
              >
                {announcements.length > 1 && currentIndex < announcements.length - 1 ? 'بعدی' : 'متوجه شدم'}
              </button>
            </div>

            {announcements.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-5">
                {announcements.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-5 bg-teal-600' : 'w-1.5 bg-slate-200 dark:bg-slate-800'}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
