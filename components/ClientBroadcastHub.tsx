import React, { useState, useEffect } from 'react';
import { Megaphone, Send, Sparkles, Bell, Tag, AlertTriangle, ShieldCheck, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { toPersianDigits, isDesktopApp } from '../utils';
import { persistentStorage } from '../services/persistentStorage';

export interface ServerAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'DISCOUNT' | 'NOTICE' | 'ALERT' | 'UPDATE';
  date: string;
  author: string;
  active: boolean;
}

export const ClientBroadcastHub: React.FC = () => {
  const { currentUser } = useStore();
  const isDesktop = isDesktopApp();

  const [announcements, setAnnouncements] = useState<ServerAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem('ashk_server_broadcasts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'ann-1',
        title: 'همگام‌سازی ابری و امضای دیجیتال نسخه‌ اختصاصی اشک قلم',
        message: 'قابلیت همگام‌سازی دوطرفه بین نسخه دسکتاپ ویندوز و وب‌سرور ابری فعال شد. لطفاً کلاینت‌های متصل را به‌روزرسانی نمایید.',
        type: 'UPDATE',
        date: new Date().toLocaleDateString('fa-IR'),
        author: 'مدیر کل سرور',
        active: true
      }
    ];
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadFromHost = async () => {
      try {
        setIsLoading(true);
        const remoteData = await persistentStorage.loadData('announcements');
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          setAnnouncements(remoteData);
          localStorage.setItem('ashk_server_broadcasts', JSON.stringify(remoteData));
        }
      } catch (err) {
        console.warn('Failed to load announcements from host:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadFromHost();
  }, []);

  const [newTitle, setNewTitle] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [newType, setNewType] = useState<'DISCOUNT' | 'NOTICE' | 'ALERT' | 'UPDATE'>('NOTICE');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMsg.trim()) return;

    const newAnnouncement: ServerAnnouncement = {
      id: 'ann-' + Date.now(),
      title: newTitle.trim(),
      message: newMsg.trim(),
      type: newType,
      date: new Date().toLocaleDateString('fa-IR'),
      author: currentUser?.fullName || 'مدیر سیستم',
      active: true
    };

    const updated = [newAnnouncement, ...announcements];
    setAnnouncements(updated);
    try {
      localStorage.setItem('ashk_server_broadcasts', JSON.stringify(updated));
      await persistentStorage.saveData('announcements', updated);
      window.dispatchEvent(new Event('ashk_broadcasts_updated'));
    } catch (err) {
      console.warn('Failed to persist announcements:', err);
    }

    setNewTitle('');
    setNewMsg('');
    setSuccessMsg('اطلاعیه با موفقیت در هاست ذخیره و به تمامی کلاینت‌ها و پایانه‌ها مخابره شد.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDelete = async (id: string) => {
    const updated = announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    try {
      localStorage.setItem('ashk_server_broadcasts', JSON.stringify(updated));
      await persistentStorage.saveData('announcements', updated);
      window.dispatchEvent(new Event('ashk_broadcasts_updated'));
    } catch (err) {
      console.warn('Failed to persist announcements deletion:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12" dir="rtl">
      {/* هدر صفحه */}
      <div className="bg-gradient-to-r from-teal-900/90 to-indigo-900/90 border border-teal-500/20 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2.5 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-500/30">
                <Megaphone size={26} />
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                مرکز انتشار اطلاعیه‌ها و پیام‌های سرور مادر
              </h1>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isDesktop 
                ? 'مشاهده بخشنامه‌ها، اطلاعیه‌های رسمی، تخفیف‌های دوره‌ای و پیام‌های ارسالی از سرور مرکزی به کلاینت‌های فعال.'
                : 'ارسال و انتشار لحظه‌ای اخبار، تخفیف‌های ویژه، هشدارها و پیام‌های سامانه به تمامی پایانه‌ها و کلاینت‌های متصل به سرور مادر.'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 border border-white/20 text-teal-200">
              {isDesktop ? 'نسخه کلاینت ویندوز' : 'سرور مرکزی (Web Mother Server)'}
            </span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="text-sm font-bold">{successMsg}</span>
        </div>
      )}

      {/* اگر نسخه وب (سرور مادر) است، فرم ارسال اطلاعیه نمایش داده شود */}
      {!isDesktop && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <Send size={20} className="text-teal-400" />
            <h2 className="text-lg font-bold text-white">ارسال پیام یا تخفیف جدید به کلاینت‌ها</h2>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">عنوان اطلاعیه / تخفیف</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="مثال: تخفیف ویژه تمدید سالانه و به‌روزرسانی سامانه مؤدیان"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">نوع پیام</label>
                <select 
                  value={newType} 
                  onChange={e => setNewType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="NOTICE">اطلاعیه عمومی</option>
                  <option value="DISCOUNT">تخفیف و جشنواره</option>
                  <option value="ALERT">هشدار و اطلاعیه مهم</option>
                  <option value="UPDATE">بروزرسانی نسخه</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">متن کامل پیام و جزئیات</label>
              <textarea 
                rows={3}
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="متن پیام جهت نمایش در اسپلش‌اسکرین و پنل کلاینت‌ها..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2"
              >
                <Send size={16} />
                <span>انتشار و ارسال به همه کلاینت‌ها</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* لیست اطلاعیه‌ها و پیام‌های فعال */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Bell size={20} className="text-indigo-400" />
          <span>اطلاعیه‌ها و پیام‌های جاری سرور ({toPersianDigits(announcements.length)})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.map((item) => {
            let badgeBg = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
            let icon = <Sparkles size={16} className="text-teal-400" />;
            if (item.type === 'DISCOUNT') {
              badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              icon = <Tag size={16} className="text-amber-400" />;
            } else if (item.type === 'ALERT') {
              badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
              icon = <AlertTriangle size={16} className="text-rose-400" />;
            } else if (item.type === 'UPDATE') {
              badgeBg = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
              icon = <RefreshCw size={16} className="text-indigo-400" />;
            }

            return (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${badgeBg}`}>
                      {icon}
                      <span>
                        {item.type === 'DISCOUNT' && 'تخفیف ویژه'}
                        {item.type === 'NOTICE' && 'اطلاعیه'}
                        {item.type === 'ALERT' && 'هشدار مهم'}
                        {item.type === 'UPDATE' && 'بروزرسانی'}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {toPersianDigits(item.date)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    {item.message}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">ارسال‌کننده: {item.author}</span>
                  {!isDesktop && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                      title="حذف اطلاعیه"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
