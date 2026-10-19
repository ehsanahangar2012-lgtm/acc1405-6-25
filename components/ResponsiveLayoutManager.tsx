import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMobile } from '../useMobile';
import { 
  Maximize2, Minimize2, Sliders, HelpCircle, X, ChevronUp, 
  Table, Layers, Sparkles, Check, ArrowDownUp, Compass, FileSpreadsheet, BarChart3, RefreshCw, KeyRound,
  ScrollText, Landmark, Banknote, Package, FileText, LayoutDashboard, ShieldCheck, DownloadCloud, Settings
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

interface ResponsiveLayoutContextType {
  isMaxTableMode: boolean;
  toggleMaxTableMode: () => void;
  isCompactDensity: boolean;
  toggleCompactDensity: () => void;
  isNavVisible: boolean;
  setNavVisible: (visible: boolean) => void;
  openDrawer: boolean;
  setOpenDrawer: (open: boolean) => void;
}

const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextType | undefined>(undefined);

export const useResponsiveLayout = () => {
  const context = useContext(ResponsiveLayoutContext);
  if (!context) {
    throw new Error('useResponsiveLayout must be used within ResponsiveLayoutProvider');
  }
  return context;
};

interface ResponsiveLayoutProviderProps {
  children: ReactNode;
}

export const ResponsiveLayoutProvider: React.FC<ResponsiveLayoutProviderProps> = ({ children }) => {
  const { isMobile } = useMobile();
  const location = useLocation();

  // Load preferences from localStorage
  const [isMaxTableMode, setIsMaxTableMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ag_max_table_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [isCompactDensity, setIsCompactDensity] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ag_compact_density') === 'true';
    } catch {
      return true; // Default compact for mobile
    }
  });

  const [isNavVisible, setNavVisible] = useState<boolean>(true);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Check if current route has heavy financial tables
  const isTableHeavyRoute = [
    '/invoices', '/inventory', '/checks', '/finance', '/contracts', 
    '/customers', '/accounting', '/cashflow', '/budget', '/projects'
  ].some(path => location.pathname.startsWith(path));

  // Toggle handlers
  const toggleMaxTableMode = () => {
    setIsMaxTableMode(prev => {
      const next = !prev;
      try { localStorage.setItem('ag_max_table_mode', String(next)); } catch {}
      return next;
    });
  };

  const toggleCompactDensity = () => {
    setIsCompactDensity(prev => {
      const next = !prev;
      try { localStorage.setItem('ag_compact_density', String(next)); } catch {}
      return next;
    });
  };

  // Auto-hide mobile navigation on scroll down inside tables
  useEffect(() => {
    if (!isMobile) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > 120 && currentScrollY > lastScrollY + 20) {
            // Scrolling down -> hide nav to give max viewport to tables
            setNavVisible(false);
          } else if (currentScrollY < lastScrollY - 15 || currentScrollY <= 80) {
            // Scrolling up -> restore nav
            setNavVisible(true);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, lastScrollY]);

  return (
    <ResponsiveLayoutContext.Provider
      value={{
        isMaxTableMode,
        toggleMaxTableMode,
        isCompactDensity,
        toggleCompactDensity,
        isNavVisible,
        setNavVisible,
        openDrawer,
        setOpenDrawer
      }}
    >
      <div 
        className={`responsive-layout-root w-full min-h-screen ${
          isCompactDensity ? 'ag-compact-density text-[13px]' : ''
        }`}
        data-max-table={isMaxTableMode ? 'true' : 'false'}
      >
        {children}

        {/* Floating Quick Layout Tools for Mobile (Bottom Right above bottom nav) */}
        {isMobile && isTableHeavyRoute && (
          <div className="fixed bottom-24 right-4 z-[140] flex flex-col items-end gap-2 no-print" dir="rtl">
            {/* Quick Toggle: Max Table Space Mode */}
            <button
              onClick={toggleMaxTableMode}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl shadow-xl backdrop-blur-md text-xs font-black transition-all active:scale-95 border ${
                isMaxTableMode 
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-teal-500/30' 
                  : 'bg-slate-900/90 text-teal-400 border-white/10 hover:bg-slate-800'
              }`}
              title={isMaxTableMode ? 'خروج از حالت تمام‌جدول' : 'حداکثر فضای جدول مالی'}
            >
              {isMaxTableMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="text-[11px] font-bold">
                {isMaxTableMode ? 'نمای عادی' : 'فضای حداکثر جدول'}
              </span>
            </button>
          </div>
        )}

        {/* Global Navigation Drawer for Mobile (Fast access to all financial modules) */}
        {openDrawer && (
          <div className="fixed inset-0 z-[8900] bg-black/75 backdrop-blur-md flex flex-col justify-end no-print" dir="rtl">
            <div 
              className="bg-slate-900 border-t border-white/10 rounded-t-[2.5rem] p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-slide-up"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2 text-teal-400">
                  <Compass size={20} />
                  <h3 className="font-black text-white text-sm">منوی دسترسی جامع مالی</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGuideModal(true)}
                    className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center"
                    title="راهنمای چیدمان هوشمند"
                  >
                    <HelpCircle size={16} />
                  </button>
                  <button
                    onClick={() => setOpenDrawer(false)}
                    className="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Layout Customizer Switches */}
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-teal-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">حالت متراکم جداول مالی</span>
                    <span className="text-[10px] text-slate-400">کاهش فواصل برای نمایش ردیف‌های بیشتر</span>
                  </div>
                </div>
                <button
                  onClick={toggleCompactDensity}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    isCompactDensity ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isCompactDensity ? '-translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Navigation Grid by Modules */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar text-xs">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 px-1">بخش‌های پرکاربرد</span>
                  <div className="grid grid-cols-2 gap-2">
                    <DrawerNavLink to="/" icon={LayoutDashboard} label="پیشخوان" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/invoices" icon={FileText} label="فاکتورها" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/inventory" icon={Package} label="انبار و حواله‌ها" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/contracts" icon={ScrollText} label="قراردادها" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/checks" icon={Banknote} label="مدیریت چک‌ها" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/finance" icon={Landmark} label="خزانه‌داری و مالی" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/accounting" icon={Table} label="حسابداری دوبل" onClick={() => setOpenDrawer(false)} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 px-1">سایر ابزارهای مالی و مدیریتی</span>
                  <div className="grid grid-cols-2 gap-2">
                    <DrawerNavLink to="/cashflow" icon={Layers} label="جریان وجوه نقد" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/budget" icon={ArrowDownUp} label="بودجه‌بندی" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/customers" icon={ShieldCheck} label="طرف‌های حساب" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/reports" icon={BarChart3} label="گزارش‌های مالی" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/import-center" icon={FileSpreadsheet} label="مرکز واردات اسناد" onClick={() => setOpenDrawer(false)} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 px-1">عمومی</span>
                  <div className="grid grid-cols-2 gap-2">
                    <DrawerNavLink to="/data-sync" icon={RefreshCw} label="همگام‌سازی" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/install-android" icon={KeyRound} label="فعال‌سازی لایسنس و اتصال سرور" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/updates" icon={DownloadCloud} label="مرکز آپدیت (OTA)" onClick={() => setOpenDrawer(false)} />
                    <DrawerNavLink to="/settings" icon={Settings} label="تنظیمات" onClick={() => setOpenDrawer(false)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Guide Modal for Responsive Layout */}
        {showGuideModal && (
          <div className="fixed inset-0 z-[9500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-teal-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-teal-400">
                  <HelpCircle size={22} />
                  <h3 className="font-black text-white text-base">راهنمای هوشمند چیدمان واکنش‌گرا</h3>
                </div>
                <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <strong className="text-teal-300 block mb-1">📐 بهینه‌سازی حداکثر فضای جداول مالی:</strong>
                  با فشردن دکمه «فضای حداکثر جدول» در موبایل، پدینگ‌ها و حاشیه‌های اضافی حذف می‌شوند تا ستون‌های ارقام مالی، تاریخ‌های شمسی و شرح اسناد بدون اسکرول افقی مزاحم نمایش داده شوند.
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <strong className="text-indigo-300 block mb-1">🔽 پنهان‌سازی خودکار نوار هنگام اسکرول:</strong>
                  هنگام بررسی ردیف‌های بلند فاکتور یا انبار، منوی پایینی به طور خودکار به پایین جمع می‌شود و با اولین لمس به بالا، مجدداً ظاهر می‌گردد.
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <strong className="text-amber-300 block mb-1">⚡ بازچینش و کشوی جامع دسترسی سریع:</strong>
                  از طریق دکمه «بیشتر» در نوار ناوبری موبایل، تمامی ماژول‌های حسابداری شامل قراردادها، چک‌ها و واردات بدون نیاز به رفتن به پیشخوان در دسترس هستند.
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full bg-teal-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveLayoutContext.Provider>
  );
};

const DrawerNavLink: React.FC<{ to: string; icon: any; label: string; onClick: () => void }> = ({
  to,
  icon: Icon,
  label,
  onClick
}) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
        isActive
          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-black'
          : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/5'
      }`
    }
  >
    <Icon size={16} className="shrink-0 text-teal-400" />
    <span className="truncate">{label}</span>
  </NavLink>
);
