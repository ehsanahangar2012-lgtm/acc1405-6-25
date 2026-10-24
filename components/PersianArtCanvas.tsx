import React, { useEffect, useRef } from 'react';

/**
 * کتیبه و ترنج اسلیمی تذهیب زرین (وکتور سنتی خالص)
 */
export const PersianToranjSvg: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    {/* شمسه لوزی هشت‌پر اسلیمی */}
    <path
      d="M20 2 L24 14 L36 10 L28 20 L38 28 L25 26 L20 38 L15 26 L2 28 L12 20 L4 10 L16 14 Z"
      fill="#d4af37"
      fillOpacity="0.85"
      stroke="#854d0e"
      strokeWidth="1"
    />
    <circle cx="20" cy="20" r="4.5" fill="#0f172a" stroke="#d4af37" strokeWidth="1" />
    <circle cx="20" cy="20" r="2" fill="#0d9488" />
  </svg>
);

/**
 * لچک گوشه تذهیب سنتی اسلیمی (بدون تداخل با متن، فیت شده در پس‌زمینه)
 */
export const IslimiCornerSvg: React.FC<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  size?: number;
}> = ({
  position = 'top-right',
  size = 64,
}) => {
  let transform = '';
  switch (position) {
    case 'top-left':
      transform = 'none';
      break;
    case 'top-right':
      transform = 'scaleX(-1)';
      break;
    case 'bottom-left':
      transform = 'scaleY(-1)';
      break;
    case 'bottom-right':
      transform = 'scale(-1, -1)';
      break;
    default:
      transform = 'none';
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform, transformOrigin: 'center' }}
      className="pointer-events-none select-none shrink-0"
    >
      {/* زمینه لچک تذهیب زرین و لاجوردی */}
      <path
        d="M0 0 L100 0 C75 12 50 35 35 50 C20 65 12 75 0 100 Z"
        fill="#f8fafc"
        fillOpacity="0.6"
      />
      {/* خطوط جدول‌کشی زرین و سرمه‌ای */}
      <path
        d="M0 3 L97 3 C74 15 48 38 34 54 C18 72 12 80 3 97"
        stroke="#c59b27"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M0 8 L90 8 C68 20 44 42 30 58 C15 75 8 85 3 92"
        stroke="#0f172a"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* پیچک‌های اسلیمی دهن‌اژدری */}
      <path
        d="M15 15 C30 12 45 22 40 35 C35 48 20 42 25 30 C28 22 38 25 32 32"
        stroke="#b8860b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22" cy="22" r="3" fill="#c59b27" />
      <circle cx="50" cy="14" r="2.5" fill="#0d9488" />
      <circle cx="14" cy="50" r="2.5" fill="#0d9488" />
      <polygon points="0,0 12,0 0,12" fill="#c59b27" />
    </svg>
  );
};

/**
 * شمسه تذهیب مرکزی با کانوا برای پس‌زمینه
 */
export const PersianWatermarkCanvas: React.FC<{
  opacity?: number;
  size?: number;
}> = ({
  opacity = 0.035,
  size = 540,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    ctx.save();
    ctx.globalAlpha = opacity;

    // حلقه‌های تذهیب
    const rings = [40, 75, 115, 160, 210, 255];
    rings.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = idx % 2 === 0 ? '#b8860b' : '#0f172a';
      ctx.lineWidth = idx === rings.length - 1 ? 2 : 1.2;
      ctx.stroke();
    });

    // شمسه ۱۶ پر هندسی
    const points = 16;
    const outerR = 245;
    const innerR = 170;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // شعاع‌های اسلیمی
    for (let i = 0; i < 32; i++) {
      const angle = (i * 2 * Math.PI) / 32;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 80, cy + Math.sin(angle) * 80);
      ctx.lineTo(cx + Math.cos(angle) * 240, cy + Math.sin(angle) * 240);
      ctx.strokeStyle = i % 2 === 0 ? '#b8860b' : '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }, [opacity, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size}px` }}
      className="pointer-events-none select-none"
    />
  );
};

/**
 * سرلوحه و کتیبه سربرگ سلطنتی شاه‌عباسی و صفوی (بدون رنگ‌های نئونی، با رنگ لاجوردی و زرین فاخر)
 */
export const PersianHeaderBanner: React.FC<{
  title: string;
  subtitle?: string;
  code?: string;
  date?: string;
  typeBadge?: string;
}> = ({ title, subtitle, code, date, typeBadge }) => {
  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-sm border-2 border-[#b8860b] bg-[#0f172a] text-white mb-4">
      {/* خط حاشیه طلاکوب داخلی */}
      <div className="p-3 md:p-4 bg-gradient-to-r from-[#09111e] via-[#111c30] to-[#09111e] border border-[#d4af37]/40 rounded-[10px] m-0.5 relative">
        {/* نقوش اسلیمی گوشه کتیبه */}
        <div className="absolute top-0 right-0 opacity-20 pointer-events-none">
          <IslimiCornerSvg position="top-right" size={54} />
        </div>
        <div className="absolute top-0 left-0 opacity-20 pointer-events-none">
          <IslimiCornerSvg position="top-left" size={54} />
        </div>

        <div className="relative z-10 flex flex-row items-center justify-between gap-4 w-full">
          {/* سمت راست: نشان ترنج و نام واحد تجاری */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-[#0b1322] border-2 border-[#d4af37] flex items-center justify-center shadow-inner shrink-0">
              <span className="text-[#fef08a] text-lg font-black">❖</span>
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black text-[#faf8f2] tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-[#cbd5e1] font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* مرکز: ترنج و برچسب اصالت */}
          {typeBadge && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#b8860b]/20 border border-[#d4af37] text-[#fef08a] text-[11px] font-black">
              <span className="text-[#d4af37]">✦</span>
              <span>{typeBadge}</span>
              <span className="text-[#d4af37]">✦</span>
            </div>
          )}

          {/* سمت چپ: مشخصات سند (شماره و تاریخ شمسی) */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {code && (
              <div className="bg-[#080d16] px-3 py-1 rounded-lg border border-[#d4af37]/40 text-right">
                <span className="text-[9px] text-slate-400 block">شماره سند:</span>
                <span className="text-xs font-black text-[#fef08a] font-mono">{code}</span>
              </div>
            )}
            {date && (
              <div className="bg-[#080d16] px-3 py-1 rounded-lg border border-[#d4af37]/40 text-right">
                <span className="text-[9px] text-slate-400 block">تاریخ صدور:</span>
                <span className="text-xs font-black text-white font-mono">{date}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * کادر اطلاعاتی با جدول‌کشی اصیل سنتی (بدون قرارگیری لچک روی متن‌ها)
 */
export const PersianCard: React.FC<{
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}> = ({ title, icon, children, className = '', badge }) => {
  return (
    <div
      className={`relative bg-[#fdfbf7] border-2 border-[#c59b27]/80 rounded-xl p-3.5 shadow-2xs overflow-hidden ${className}`}
    >
      {/* سربرگ کارت با خط تذهیب زرین */}
      {title && (
        <div className="flex items-center justify-between border-b-2 border-[#c59b27]/40 pb-2 mb-2.5 px-0.5">
          <div className="flex items-center gap-1.5">
            {icon && <span className="text-[#0d9488]">{icon}</span>}
            <span className="text-xs font-black text-[#0f172a]">{title}</span>
          </div>
          {badge && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-[#0d9488]/10 text-[#0f766e] border border-[#0d9488]/30">
              {badge}
            </span>
          )}
        </div>
      )}

      {/* متن‌های داخلی با خوانایی ۱۰۰٪ */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

/**
 * مهر و شمسه هشت‌پر تذهیب اصالت سند (کاملاً تراز و بدون هرگونه بریدگی)
 */
export const PersianHashtiSeal: React.FC<{
  title?: string;
  subtitle?: string;
  code?: string;
}> = ({ title = 'اصالت سند', subtitle = 'نظام جامع اشک قلم', code }) => {
  return (
    <div className="relative inline-flex flex-col items-center justify-center p-1 text-center select-none w-full max-w-[140px]">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {/* مربع اول */}
          <rect
            x="14"
            y="14"
            width="72"
            height="72"
            rx="6"
            fill="#fffdf7"
            stroke="#b8860b"
            strokeWidth="2"
          />
          {/* مربع دوم ۴۵ درجه */}
          <rect
            x="14"
            y="14"
            width="72"
            height="72"
            rx="6"
            fill="#fffdf7"
            fillOpacity="0.8"
            stroke="#0f172a"
            strokeWidth="1.5"
            transform="rotate(45 50 50)"
          />
          <circle cx="50" cy="50" r="31" stroke="#b8860b" strokeWidth="1" strokeDasharray="2 1.5" fill="none" />
          <circle cx="50" cy="50" r="28" stroke="#0d9488" strokeWidth="0.8" fill="none" />
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center px-1">
          <span className="text-[#b8860b] text-[9px] leading-none">❖</span>
          <span className="text-[9.5px] font-black text-[#0f172a] leading-tight mt-0.5">{title}</span>
          <span className="text-[7.5px] font-bold text-slate-600 leading-tight mt-0.5">{subtitle}</span>
          {code && (
            <span className="text-[7px] font-mono font-black text-[#0f766e] mt-0.5 px-1 bg-emerald-50 rounded border border-emerald-300 max-w-[76px] truncate">
              {code}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
