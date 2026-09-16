import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Settings, HardDrive, Clock, Building2, 
  KeyRound, Database, FileSpreadsheet, CheckCircle2, 
  X, ArrowLeft, Lock, AlertTriangle, Sparkles, Cpu
} from 'lucide-react';
import { isDesktopApp } from '../utils';
import { AccountingLogo } from './AccountingLogo';

export const WindowsSafetyOnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has permanently dismissed this popup
    const isDismissed = localStorage.getItem('ashk_windows_safety_guide_dismissed');
    if (isDismissed === 'true') {
      return;
    }

    // Show on Windows / Desktop environment or initial launch
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismissPermanently = () => {
    localStorage.setItem('ashk_windows_safety_guide_dismissed', 'true');
    setIsOpen(false);
  };

  const handleGoToSettings = () => {
    setIsOpen(false);
    navigate('/settings');
  };

  if (!isOpen) return null;

  const safetyItems = [
    {
      icon: <Building2 className="w-5 h-5 text-emerald-400" />,
      title: '۱. تعریف مشخصات شرکت و اطلاعات مالیاتی',
      desc: 'نام تجاری، شماره ثبت، شناسه ملی و آپلود لوگو و امضای رسمی جهت درج خودکار روی فاکتورها، کاردکس‌ها و اسناد رسمی.',
      action: 'تنظیمات > مشخصات شرکت'
    },
    {
      icon: <HardDrive className="w-5 h-5 text-teal-400" />,
      title: '۲. تعیین پوشه امن پشتیبان‌گیری محلی (Local Backup Path)',
      desc: 'برای جلوگیری از حذف ناخواسته داده‌ها هنگام نصب مجدد ویندوز، پوشه بک‌آپ را در درایوی مجزا از درایو C (مانند D:\\AshkBackups) مشخص فرمایید.',
      action: 'تنظیمات > پشتیبان‌گیری ویندوز'
    },
    {
      icon: <Clock className="w-5 h-5 text-cyan-400" />,
      title: '۳. فعال‌سازی پشتیبان‌گیری خودکار و زمان‌دار',
      desc: 'سرویس ذخیره‌سازی دوره‌ای روزانه و ایجاد فایل پشتیبان هنگام خروج از برنامه را فعال کنید تا سلامت اسناد همواره تضمین گردد.',
      action: 'تنظیمات > زمان‌بندی پشتیبان'
    },
    {
      icon: <KeyRound className="w-5 h-5 text-amber-400" />,
      title: '۴. بررسی شناسه سخت‌افزاری (HWID) و لایسنس',
      desc: 'نرم‌افزار با شناسه یکتای مادربرد سیستم شما فعال می‌شود و بدون نیاز به اینترنت یا دانگل فیزیکی، کارکرد ۱۰۰٪ آفلاین دارد.',
      action: 'داشبورد لایسنس'
    },
    {
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      title: '۵. همگام‌سازی ابری با هاست مرکزی (Cloud Sync)',
      desc: 'در صورت تمایل به ارتباط چندکاربره و دسترسی از راه دور، آدرس هاست پشتیبان را در بخش همگام‌سازی تنظیم نمایید.',
      action: 'تنظیمات > همگام‌سازی ابری'
    },
    {
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      title: '۶. کلیدهای میانبر سریع حسابداری',
      desc: 'استفاده از کلیدهای میانبر Alt+1 تا Alt+9 جهت جابجایی فوق سریع بین فاکتور، انبار، اشخاص، چک‌ها و گزارشات مالی.',
      action: 'کلید میانبر F1 / Help'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[9500] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none no-print"
      dir="rtl"
    >
      <div 
        className="w-full max-w-2xl bg-[#0e1726] border border-white/15 rounded-[2rem] shadow-2xl overflow-hidden animate-scale-up text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Modal Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-900 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <AccountingLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base sm:text-lg text-white">
                  اطلاعیه و چک‌لیست ضروری راه‌اندازی (نسخه ویندوز)
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-full">
                  امنیت اطلاعات
                </span>
              </div>
              <p className="text-[11px] text-teal-300 font-bold mt-1">
                توسعه و پشتیبانی تخصصی: دپارتمان IT اشک قلم | www.ashkghalam.ir
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="بستن پنجره"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs custom-scrollbar">
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px] sm:text-xs">
              کاربر گرامی، جهت حصول اطمینان از حفظ کامل اسناد مالی، انبار و امنیت اطلاعات در سیستم‌های ویندوزی، توصیه اکید می‌شود اقدامات زیر را در بخش تنظیمات سامانه بررسی فرمایید:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safetyItems.map((item, idx) => (
              <div 
                key={idx} 
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-teal-500/30 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.icon}
                    <h3 className="font-black text-white text-xs group-hover:text-teal-300 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                  <span>مسیر دسترسی:</span>
                  <span className="text-teal-400 font-mono">{item.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Permanent Dismiss Button */}
          <button
            onClick={handleDismissPermanently}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-black transition-all flex items-center gap-1.5"
            title="این پیام دیگر برای شما نمایش داده نخواهد شد"
          >
            <CheckCircle2 size={15} className="text-emerald-400" />
            دیگر نمایش نده
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              متوجه شدم (بستن)
            </button>

            <button
              onClick={handleGoToSettings}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center gap-2"
            >
              <Settings size={15} />
              ورود به بخش تنظیمات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WindowsSafetyOnboardingModal;
