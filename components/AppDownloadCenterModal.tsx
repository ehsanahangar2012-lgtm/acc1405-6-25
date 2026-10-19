import React, { useState } from 'react';
import { 
  Download, CheckCircle2, ShieldCheck, Monitor, Smartphone, 
  Server, HelpCircle, HardDrive, Cpu, Check, AlertCircle, X, ExternalLink
} from 'lucide-react';

import { APP_VERSION, APP_RELEASE_DATE } from '../config';

interface AppDownloadCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppDownloadCenterModal: React.FC<AppDownloadCenterModalProps> = ({ isOpen, onClose }) => {
  const [showGuide, setShowGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  if (!isOpen) return null;

  const RELEASE_DATE_SHAMSI = APP_RELEASE_DATE;

  const downloadPackages = [
    {
      id: 'win-installer',
      title: 'نرم‌افزار نسخه ویندوز (فایل نصبی Setup)',
      filename: `AshkeGhalam-Setup-v${APP_VERSION}.exe`,
      url: `${releaseBase}/AshkeGhalam-Setup-v${APP_VERSION}.exe`,
      platform: 'ویندوز ۱۰ و ۱۱ (Electron؛ بسته مستقل دسکتاپ)',
      description: 'نصب خودکار و ایجاد میانبر؛ داده‌های کاربر در مسیر داده برنامه نگهداری می‌شوند.',
      icon: Monitor,
      badge: 'پیشنهادی دسکتاپ',
      size: 'نصب‌کننده ویندوز'
    },
    {
      id: 'win-portable-zip',
      title: 'بسته جامع و مستقل ویندوز (ZIP - یک کلیک)',
      filename: `AshkeGhalam-Windows-Portable-v${APP_VERSION}.zip`,
      url: `${releaseBase}/AshkeGhalam-Windows-Portable-v${APP_VERSION}.zip`,
      platform: 'ویندوز ۱۰ و ۱۱ (Portable EXE داخل ZIP)',
      description: 'آرشیو شامل نسخه Portable ویندوز و راهنمای اجرا؛ برای جابه‌جایی یا نگهداری آسان.',
      icon: HardDrive,
      badge: '۱۰۰٪ تضمینی بدون پیش‌نیاز',
      size: 'بسته کامل نرم‌افزار'
    },
    {
      id: 'android-apk',
      title: 'اپلیکیشن اختصاصی اندروید (فایل نصبی APK)',
      filename: `AshkeGhalam-v${APP_VERSION}.apk`,
      url: `${releaseBase}/AshkeGhalam-v${APP_VERSION}.apk`,
      platform: 'اندروید ۷.۰ به بالا (گوشی، تبلت و پوز اندرویدی)',
      description: 'اسکن بارکد با دوربین، ثبت فاکتور ویزیتوری، کاردکس آفلاین و ارسال پیامک سیم‌کارتی',
      icon: Smartphone,
      badge: 'نسخه همراه',
      size: 'پکیج کامل APK'
    },
    {
      id: 'host-zip',
      title: 'بسته جامع استقرار روی هاست اشتراکی (ZIP)',
      filename: `ashke-ghalam-host-v${APP_VERSION}.zip`,
      url: `${releaseBase}/ashke-ghalam-host-v${APP_VERSION}.zip`,
      platform: 'وب‌سرور آپاچی / لایت‌اسپید / لینوکس cPanel',
      description: 'محتوای کامل فرانت‌اند و بک‌اند PHP به همراه .htaccess و ساختار جداول دیتابیس',
      icon: Server,
      badge: 'سرور و هاست',
      size: 'پکیج وب و دیتابیس'
    }
  ];

  const handleCopyLink = (url: string, id: string) => {
    const fullUrl = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).toString();
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 px-6 py-4 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
              <Download className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-emerald-300">مرکز دانلود نسخه‌های اجرایی اشک قلم</h2>
                <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  نسخه {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تاریخ انتشار: {RELEASE_DATE_SHAMSI} | ویندوز فعلی: Electron · اندروید فعلی: Capacitor/WebView
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Smart Guide Button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
              title="راهنمای هوشمند نصب و اجرا"
            >
              <HelpCircle className="w-4 h-4" />
              <span>راهنما ؟</span>
            </button>

            {/* Close */}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-2 rounded-lg transition"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right" dir="rtl">
          
          {/* Smart Guide Drawer / Banner */}
          {showGuide && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 animate-fadeIn space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <HelpCircle className="w-5 h-5 shrink-0" />
                <span>راهنمای هوشمند انتخاب و راه‌اندازی نسخه‌های اجرایی</span>
              </div>
              <ul className="text-xs text-amber-100/90 space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong>ویندوز نصبی (Setup):</strong> نسخه فعلی با Electron بسته‌بندی می‌شود؛ مهاجرت به ‎.NET/SQLite در نقشه‌راه آینده است.</li>
                <li><strong>ویندوز پرتابل (Portable):</strong> بدون نیاز به نصب، مستقیماً از روی فلش مموری یا هر پوشه‌ای با کلیک اجرا می‌شود.</li>
                <li><strong>اندروید (APK):</strong> فایل نصبی به طور کامل تمامی موتورهای آفلاین، اسکنر بارکد و ثبت اسناد مالی را درون خود دارد و مستقل از گوگل پلی کار می‌کند.</li>
                <li><strong>پکیج هاست (ZIP):</strong> برای استقرار نسخه ابری مرکزی سازمان بر روی هاست اشتراکی لینوکسی.</li>
              </ul>
            </div>
          )}

          {/* Security & Offline Guarantee */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-200/90 leading-relaxed">
              <strong className="text-emerald-300 block mb-1">نسخه‌های اجرایی منتشرشده:</strong>
              فایل‌های این بخش از GitHub Releases دریافت می‌شوند. نبود اتصال اینترنت برای ثبت حسابداری محلی پشتیبانی می‌شود، اما همگام‌سازی با سرور به پیکربندی و مجوز معتبر نیاز دارد.
            </div>
          </div>

          {/* Download Packages Cards */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              فهرست فایل‌های خروجی و بیلد مستقیم برنامه
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {downloadPackages.map((pkg) => {
                const IconComponent = pkg.icon;
                const isCopied = copiedLink === pkg.id;

                return (
                  <div 
                    key={pkg.id}
                    className="bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700 hover:border-emerald-500/40 rounded-xl p-4.5 transition flex flex-col justify-between gap-4 group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                              {pkg.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {pkg.platform}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-slate-700/80 text-emerald-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          {pkg.badge}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {pkg.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                        <span className="font-mono text-emerald-400 truncate max-w-[200px]" dir="ltr">
                          {pkg.filename}
                        </span>
                        <span className="text-slate-400 font-medium">
                          {pkg.size}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={pkg.url}
                        download={pkg.filename}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50"
                      >
                        <Download className="w-4 h-4" />
                        <span>دانلود مستقیم</span>
                      </a>
                      
                      <button
                        onClick={() => handleCopyLink(pkg.url, pkg.id)}
                        className="bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl text-xs transition"
                        title="کپی لینک مستقیم دانلود"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Offline Sync & Verification Notice */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 leading-relaxed space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>موتور اجرای فعلی دسکتاپ: Electron</span>
            </div>
            <p>
              فایل‌ها پس از ساخت و انتشار نسخه با برچسب نسخه (v{APP_VERSION}) در GitHub Releases قرار می‌گیرند؛ خروجی‌های آزمایشی از بخش Actions قابل دریافت‌اند.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-3.5 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>سیستم حسابداری اشک قلم نسخه {APP_VERSION} | تاریخ: {RELEASE_DATE_SHAMSI}</span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg transition text-xs font-bold"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
