import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Database, Zap, CheckCircle2, Megaphone, Tag, AlertTriangle, Laptop, X } from 'lucide-react';
import { toPersianDigits, isDesktopApp } from '../utils';
import { AccountingLogo } from './AccountingLogo';

interface SplashScreenProps {
  onFinish?: () => void;
}

const DEFAULT_TIPS = [
  {
    title: 'میانبرهای صفحه‌کلید',
    desc: 'با فشردن Alt+1 تا Alt+6 بین پیشخوان، فاکتورها، انبار، چک‌ها و اشخاص فوراً جابجا شوید.'
  },
  {
    title: 'ثبت سریع فاکتور',
    desc: 'در هنگام صدور فاکتور با زدن کلید Alt+S فاکتور بدون نیاز به ماوس مستقیماً ثبت نهایی می‌شود.'
  },
  {
    title: 'سامانه مؤدیان مالیاتی',
    desc: 'تمامی فاکتورهای فروش با الگوریتم ورهوف و شناسه ۲۲ رقمی مستقیماً به کارپوشه مالیاتی ارسال می‌شوند.'
  },
  {
    title: 'اتصال به کارتخوان بانکی (PC-POS)',
    desc: 'مبلغ فاکتور را بدون وارد کردن دستی به کارتخوان ارسال کنید و کد پیگیری را در سند ذخیره نمایید.'
  },
  {
    title: 'گاوصندوق ابری پشتیبان‌گیری',
    desc: 'پشتیبان‌گیری ابری روزانه اطلاعات مالی شما را در صورت خرابی یا تعویض رایانه کاملاً بیمه می‌کند.'
  },
  {
    title: 'امضای دیجیتال و مهر رسمی',
    desc: 'فاکتورها و اسناد پرداخت را با قلم نوری یا تبلت امضا کرده و با مهر اختصاصی پرینت بگیرید.'
  }
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('در حال تحلیل منابع و آغاز بهینه‌سازی...');
  const [perfMetrics, setPerfMetrics] = useState<{ resourceCount: number; loadTimeMs: number; memoryMb?: number }>({ resourceCount: 0, loadTimeMs: 0 });
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [serverNotice, setServerNotice] = useState<any>(null);
  const isDesktop = isDesktopApp();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ashk_server_broadcasts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setServerNotice(parsed[0]);
        }
      }
    } catch {}

    const startTime = performance.now();

    // پایش مداوم متریک‌های window.performance برای محاسبه پیشرفت واقعی بارگذاری کامپوننت‌های سنگین
    const perfInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = Math.round(now - startTime);
      
      let resourceCount = 0;
      let scriptsAndStyles = 0;
      let isDomReady = document.readyState === 'complete';
      
      if (typeof window !== 'undefined' && 'performance' in window) {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        resourceCount = resources.length;
        scriptsAndStyles = resources.filter(r => r.initiatorType === 'script' || r.initiatorType === 'css' || r.initiatorType === 'fetch').length;
      }

      const mem = (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024)) : undefined;
      setPerfMetrics({ resourceCount, loadTimeMs: elapsed, memoryMb: mem });

      // محاسبه وزن‌دار درصد پیشرفت بر اساس وضعیت DOM، منابع و زمان
      let calculatedProgress = Math.min(
        100,
        Math.max(
          15,
          Math.round(
            (isDomReady ? 35 : 15) +
            Math.min(45, (scriptsAndStyles / Math.max(scriptsAndStyles + 2, 10)) * 45) +
            Math.min(20, (elapsed / 2200) * 20)
          )
        )
      );

      // پیام‌های وضعیت متناسب با مراحل اجرایی
      if (calculatedProgress < 35) {
        setStatusText(`بارگذاری استایل‌ها و فونت‌های پایه (${toPersianDigits(resourceCount)} منبع شناسایی شد)...`);
      } else if (calculatedProgress < 65) {
        setStatusText(`تحلیل بسته‌های اسکریپتی و موتور حسابداری (${toPersianDigits(scriptsAndStyles)} ماژول)...`);
      } else if (calculatedProgress < 88) {
        setStatusText(`راه‌اندازی پایگاه داده و بررسی لایسنس دستگاه (${toPersianDigits(elapsed)}ms)...`);
      } else if (calculatedProgress < 100) {
        setStatusText(`آماده‌سازی پیشخوان و بهینه‌سازی رندر گرافیکی...`);
      } else {
        setStatusText(`بارگذاری با موفقیت در ${toPersianDigits(elapsed)} میلی‌ثانیه تکمیل شد.`);
      }

      setProgress(prev => Math.max(prev, calculatedProgress));

      if (elapsed >= 2800 || (isDomReady && elapsed >= 2000 && calculatedProgress >= 95)) {
        setProgress(100);
        clearInterval(perfInterval);
        setTimeout(() => {
          handleClose();
        }, 350);
      }
    }, 120);

    const tipInterval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % DEFAULT_TIPS.length);
    }, 2000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(perfInterval);
      clearInterval(tipInterval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClose = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 350);
  };

  const tip = DEFAULT_TIPS[currentTipIndex];

  return (
    <div 
      className={`fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center p-6 text-white transition-opacity duration-300 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      dir="rtl"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-teal-600/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[140px]" />
      </div>

      <div className="relative w-full max-w-xl bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl text-center space-y-6">
        
        {/* دکمه بستن / رد کردن (Esc) */}
        <button
          onClick={handleClose}
          className="absolute top-5 left-5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/5"
          title="رد کردن صفحه اسپلش (Esc)"
        >
          <span>رد کردن</span>
          <X size={14} />
        </button>

        <div className="flex flex-col items-center justify-center space-y-3">
          <AccountingLogo size="xl" className="mb-1 drop-shadow-2xl" />

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                سامانه حسابداری اشک قلم
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {isDesktop ? 'نسخه کلاینت ایزوله' : 'نسخه شبکه'}
              </span>
            </div>
            <p className="text-xs text-teal-400 font-black mt-1">
              طراحی و توسعه: دپارتمان IT اشک قلم | www.ashkghalam.ir • نسخه ۱۶.۲۲.۰
            </p>
          </div>
        </div>

        {/* اگر اطلاعیه یا هشدار از سرور مادر وجود دارد */}
        {serverNotice && (
          <div className="bg-teal-950/60 border border-teal-500/30 rounded-2xl p-4 text-right space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
              <Megaphone size={15} />
              <span>پیام ویژه سرور مادر: {serverNotice.title}</span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2">
              {serverNotice.message}
            </p>
          </div>
        )}

        <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 text-right transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles size={15} /> نکته آموزشی #{toPersianDigits(currentTipIndex + 1)}: {tip.title}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {toPersianDigits(currentTipIndex + 1)} / {toPersianDigits(DEFAULT_TIPS.length)}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {tip.desc}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 truncate">
              <Zap size={14} className="text-teal-400 shrink-0" />
              <span className="truncate">{statusText}</span>
            </span>
            <span className="font-mono font-bold text-teal-400">{toPersianDigits(progress)}٪</span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
            <div 
              className="bg-gradient-to-r from-teal-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* اطلاعات عملکردی بلادرنگ دریافتی از window.performance */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
            <span>منابع لود شده: {toPersianDigits(perfMetrics.resourceCount)} مورد</span>
            <span>زمان سپری شده: {toPersianDigits(perfMetrics.loadTimeMs)}ms {perfMetrics.memoryMb ? `| رم: ${toPersianDigits(perfMetrics.memoryMb)}MB` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
