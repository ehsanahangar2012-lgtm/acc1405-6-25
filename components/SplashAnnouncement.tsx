import React, { useState, useEffect } from 'react';
import { Megaphone, X, ExternalLink, Sparkles, DownloadCloud, Settings2, Check } from 'lucide-react';
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

// تابع ساخت شناسه یکتا و پایدار (deterministic) بدون تولید رندوم تا پیام‌های دیده شده دوباره نمایش داده نشوند
const generateStableId = (item: any, fallbackPrefix: string, index: number): string => {
  if (item.id && typeof item.id === 'string' && !item.id.includes('Math.random') && !item.id.startsWith('ann-0.')) {
    return item.id;
  }
  const rawKey = `${(item.title || '').trim()}::${(item.content || item.message || '').trim().slice(0, 40)}`;
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = Math.imul(31, hash) + rawKey.charCodeAt(i) | 0;
  }
  return `${fallbackPrefix}-${index}-${(hash >>> 0).toString(16)}`;
};

// تابع دریافت اطلاعیه‌ها و پیشنهادات از سرور مرکزی، فایل کانفیگ یا حافظه اشتراکی سرور
const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const currentDate = getPersianDate();

  // ۱. بررسی دریافت مستقیم از پایگاه داده ابری هاست (persistentStorage)
  try {
    const remoteData = await persistentStorage.loadData('announcements');
    if (Array.isArray(remoteData) && remoteData.length > 0) {
      const activeBroadcasts = remoteData
        .filter((b: any) => b.active !== false)
        .map((b: any, idx: number) => ({
          id: generateStableId(b, 'remote-ann', idx),
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
          .map((b, idx) => ({
            id: generateStableId(b, 'local-bc', idx),
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

  // ۳. بررسی فراخوانی API مرکزی (در صورت فعال بودن وب‌سرور یا cPanel)
  try {
    const res = await fetch('/api/broadcasts.php', { method: 'GET', cache: 'no-cache' }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any, idx: number) => ({
          id: generateStableId(item, 'api-ann', idx),
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

  // ۴. اطلاعیه‌های پیش‌فرض اولیه سامانه با شناسه‌های ثابت و مشخص
  return [
    {
      id: 'app-update-latest-v16',
      title: 'ارتقای پایگاه داده و سرعت سامانه (نسخه ۱۶.۱۲.۰)',
      content: 'موتور پایگاه داده ایزوله ویندوز فعال گردید. تمامی اطلاعات هم‌اکنون به صورت فایل دیتابیس مستقل روی هارد دیسک و خروجی رابطه‌ای SQL ذخیره می‌شوند.',
      type: 'update',
      date: currentDate,
      link: '#update-engine',
      linkText: 'بررسی وضعیت دیتابیس'
    },
    {
      id: 'festival-promo-current-v16',
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
  const [, setIsLoading] = useState(true);

  // وضعیت ویرایش محتوا برای مدیر
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<'update' | 'promo' | 'info'>('promo');
  const [editLink, setEditLink] = useState('');
  const [editLinkText, setEditLinkText] = useState('');

  // ذخیره شناسه‌های پیام‌های نمایش داده شده در حافظه تا در دفعات بعدی باز نشوند
  const markIdsAsSeen = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      const stored = localStorage.getItem('seen_announcements');
      const seenIds: string[] = stored ? JSON.parse(stored) : [];
      const updated = Array.from(new Set([...seenIds, ...ids]));
      localStorage.setItem('seen_announcements', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving seen_announcements:', e);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements();
      let seenIds: string[] = [];
      try {
        const stored = localStorage.getItem('seen_announcements');
        seenIds = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(seenIds)) seenIds = [];
      } catch {
        seenIds = [];
      }

      // فقط مواردی که کاربر هرگز ندیده است انتخاب می‌شوند
      const unreadAnnouncements = data.filter(a => a.id && !seenIds.includes(a.id));

      if (unreadAnnouncements.length > 0) {
        setAnnouncements(unreadAnnouncements);
        setIsOpen(true);
        // به محض نمایش به کاربر، شناسه‌ها ثبت می‌شوند تا در راه‌اندازی‌های بعدی دوباره نمایش داده نشوند
        markIdsAsSeen(unreadAnnouncements.map(a => a.id));
      } else {
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // بررسی پس از تاخیر کوتاه برای روان بودن بارگذاری برنامه
    const timer = setTimeout(loadAnnouncements, 800);
    return () => clearTimeout(timer);
  }, []);

  // بستن کل پنجره و جلوگیری قطعی از نمایش مجدد همه پیام‌های حاضر
  const handleCloseAll = () => {
    markIdsAsSeen(announcements.map(a => a.id));
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleNextOrClose = () => {
    if (announcements[currentIndex]) {
      markIdsAsSeen([announcements[currentIndex].id]);
    }

    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleCloseAll();
    }
  };

  const handleAction = () => {
    const current = announcements[currentIndex];
    if (current) {
      markIdsAsSeen([current.id]);
    }
    if (current?.link === '#update-engine') {
      window.location.hash = '/settings';
      handleCloseAll();
    } else if (current?.link === '#contact-sales') {
      window.dispatchEvent(new CustomEvent('open-trial-limit-modal', { detail: { reason: 'PROMO' } }));
      handleCloseAll();
    } else if (current?.link) {
      window.open(current.link, '_blank');
      handleCloseAll();
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

    const currentId = announcements[currentIndex]?.id || ('ann-edit-' + Date.now());
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
              className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition cursor-pointer"
              title="ویرایش متن و تاریخ این پیشنهاد"
            >
              <Settings2 size={18} />
            </button>
          )}
          <button 
            type="button"
            onClick={handleCloseAll}
            className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition cursor-pointer"
            title="بستن و عدم نمایش مجدد"
          >
            <X size={18} />
          </button>
        </div>

        {isEditing ? (
          /* فرم ویرایش آنلاین محتوا برای مدیر */
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
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">متن توضیحات:</label>
              <textarea 
                rows={4}
                value={editContent} 
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 leading-relaxed font-medium outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تاریخ نمایش:</label>
                <input 
                  type="text" 
                  value={editDate} 
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center outline-none focus:border-teal-500"
                  placeholder="1403/01/01"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">نوع پیام:</label>
                <select 
                  value={editType} 
                  onChange={e => setEditType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-teal-500"
                >
                  <option value="promo">جشنواره و تخفیف</option>
                  <option value="update">بروزرسانی سامانه</option>
                  <option value="info">اطلاعیه عمومی</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">لینک یا دستور:</label>
                <input 
                  type="text" 
                  value={editLink} 
                  onChange={e => setEditLink(e.target.value)}
                  placeholder="#update-engine یا آدرس سایت"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dir-ltr outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">متن روی دکمه:</label>
                <input 
                  type="text" 
                  value={editLinkText} 
                  onChange={e => setEditLinkText(e.target.value)}
                  placeholder="مشاهده جزئیات"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button 
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
              >
                <Check size={16} />
                <span>ذخیره و انتشار در سامانه</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 font-bold text-xs cursor-pointer"
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
              <a href="https://ashkghalam.ir" target="_blank" rel="noreferrer" className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold hover:underline underline-offset-2">ashkghalam.ir</a>
              <span className="text-xs text-slate-500 font-bold mr-auto">{toPersianDigits(current.date)}</span>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight">{current.title}</h2>
            
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-6 font-medium mb-6">
              {current.content}
            </p>

            {/* نشانگر ذخیره دائمی وضعیت بازدید */}
            <div className="mb-4 p-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 select-none">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>این پیام در شروع‌های بعدی برنامه دیگر نمایش داده نخواهد شد.</span>
            </div>

            <div className="mt-auto flex flex-col sm:flex-row gap-2.5">
              {current.link && (
                <button 
                  onClick={handleAction}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-3 font-black text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                >
                  {current.linkText || 'مشاهده جزئیات'}
                  <ExternalLink size={14} />
                </button>
              )}
              {announcements.length > 1 && currentIndex < announcements.length - 1 ? (
                <>
                  <button 
                    onClick={handleNextOrClose}
                    className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl py-3 text-xs transition cursor-pointer shadow"
                  >
                    پیام بعدی ({toPersianDigits(currentIndex + 2)} از {toPersianDigits(announcements.length)})
                  </button>
                  <button 
                    onClick={handleCloseAll}
                    className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl py-3 font-black text-xs transition cursor-pointer"
                    title="بستن تمام پیام‌ها"
                  >
                    بستن همه
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleCloseAll}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl py-3 font-black text-xs transition cursor-pointer"
                >
                  متوجه شدم و بستن
                </button>
              )}
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
