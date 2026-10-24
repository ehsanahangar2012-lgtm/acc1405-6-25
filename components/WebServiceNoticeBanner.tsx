import React from 'react';
import { Globe, ArrowUpRight, ShieldCheck, PhoneCall, Send, Sparkles, ExternalLink } from 'lucide-react';
import { isDesktopApp } from '../utils';

interface WebServiceNoticeBannerProps {
  title?: string;
  description?: string;
  serviceName?: string;
  className?: string;
}

export const WebServiceNoticeBanner: React.FC<WebServiceNoticeBannerProps> = ({
  title = 'سرویس متصل به خدمات وب و هاست ابری',
  description = 'این بخش از طریق وب‌سرویس‌های آنلاین، هاست سرور یا پروتکل‌های امن اینترنتی پردازش می‌شود. در صورت فعال بودن لایسنس و دسترسی به هاست، اطلاعات با امنیت کامل ارسال و همگام‌سازی می‌گردند.',
  serviceName,
  className = ''
}) => {
  const isDesktop = isDesktopApp();

  return (
    <div className={`p-4 md:p-5 rounded-2xl md:rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/40 border border-teal-500/20 shadow-md text-right dir-rtl relative overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 shadow-inner">
            <Globe className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs md:text-sm font-black text-white flex items-center gap-1.5">
                <span>{title}</span>
                {serviceName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {serviceName}
                  </span>
                )}
              </h4>
              {isDesktop && (
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 font-bold">
                  ارتباط امن هاستینگ
                </span>
              )}
            </div>
            <p className="text-[11px] md:text-xs text-slate-300 leading-relaxed max-w-3xl">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <a
            href="tel:09353108763"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-emerald-400 text-xs font-bold border border-slate-700/80 transition shadow-sm"
          >
            <PhoneCall size={14} />
            <span className="font-mono">۰۹۳۵۳۱۰۸۷۶۳</span>
          </a>
          <a
            href="https://eitaa.com/ashkghalamCo"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-bold border border-teal-500/30 transition shadow-sm"
          >
            <Send size={14} />
            <span>ایتا @ashkghalamCo</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default WebServiceNoticeBanner;
