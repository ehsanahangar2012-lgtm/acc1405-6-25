import React from 'react';

interface AccountingLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showText?: boolean;
  textColor?: string;
  subtitle?: string;
}

export const AccountingLogo: React.FC<AccountingLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
  textColor = 'text-white',
  subtitle = 'سامانه جامع مالی و حسابداری'
}) => {
  const getDimension = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs': return 20;
      case 'sm': return 28;
      case 'md': return 38;
      case 'lg': return 52;
      case 'xl': return 72;
      default: return 38;
    }
  };

  const dim = getDimension();

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} dir="rtl">
      {/* Modern Accounting Shield & Ledger Vector Emblem */}
      <div 
        style={{ width: `${dim}px`, height: `${dim}px` }} 
        className="relative shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-800 shadow-xl border border-emerald-400/30 p-1 group transition-transform duration-300 hover:scale-105"
      >
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <svg 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-md"
        >
          {/* Shield / Ledger Outline */}
          <path 
            d="M24 4L8 10V22C8 33.2 14.8 41.6 24 44C33.2 41.6 40 33.2 40 22V10L24 4Z" 
            fill="url(#shieldGrad)" 
            stroke="#34d399" 
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Golden Balance Beam / Scales of Accounting */}
          <path 
            d="M16 16H32" 
            stroke="#fbbf24" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
          <path 
            d="M24 13V20" 
            stroke="#fbbf24" 
            strokeWidth="2" 
            strokeLinecap="round"
          />

          {/* Left Balance Pan (Credit) */}
          <path 
            d="M14 20L18 20L16 25L14 20Z" 
            fill="#38bdf8" 
            stroke="#38bdf8" 
            strokeWidth="1"
          />
          <path d="M16 16L14 20" stroke="#fbbf24" strokeWidth="1" />
          <path d="M16 16L18 20" stroke="#fbbf24" strokeWidth="1" />

          {/* Right Balance Pan (Debit) */}
          <path 
            d="M30 20L34 20L32 25L30 20Z" 
            fill="#38bdf8" 
            stroke="#38bdf8" 
            strokeWidth="1"
          />
          <path d="M32 16L30 20" stroke="#fbbf24" strokeWidth="1" />
          <path d="M32 16L34 20" stroke="#fbbf24" strokeWidth="1" />

          {/* Financial Growth Chart Bars inside Shield */}
          <rect x="15" y="29" width="3.5" height="7" rx="1" fill="#6ee7b7" />
          <rect x="20.5" y="26" width="3.5" height="10" rx="1" fill="#34d399" />
          <rect x="26" y="22" width="3.5" height="14" rx="1" fill="#10b981" />
          <rect x="31.5" y="19" width="3.5" height="17" rx="1" fill="#fbbf24" />

          {/* Ascending Trend Line */}
          <path 
            d="M16 28L22 24L28 20L34 16" 
            stroke="#ffffff" 
            strokeWidth="1.8" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          <circle cx="34" cy="16" r="1.5" fill="#ffffff" />

          {/* Gradients */}
          <defs>
            <linearGradient id="shieldGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#064e3b" stopOpacity="0.95" />
              <stop stopColor="#0f766e" stopOpacity="0.85" />
              <stop stopColor="#0e7490" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Optional Brand Title & Subtitle */}
      {showText && (
        <div className="flex flex-col text-right">
          <span className={`font-black text-sm md:text-base leading-tight tracking-tight ${textColor}`}>
            اشک قلم
          </span>
          <span className="text-[10px] text-teal-400 font-bold leading-tight mt-0.5">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};

export default AccountingLogo;
