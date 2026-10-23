import React, { useRef, useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Package, Users, Banknote, PenTool, Landmark, 
  PieChart, Settings, UserCog, LogOut, Lock, Star, HelpCircle, BookOpen, 
  TrendingUp, Calculator, Briefcase, Building2, DollarSign, CreditCard, 
  Brain, ShieldCheck, BarChart3, ScrollText, Calendar, RefreshCw, Workflow, 
  FileSpreadsheet, ChevronDown, ChevronLeft, ChevronUp, FileCode2, KeyRound, Cloud,
  MessageSquare, Network, Headphones, Sparkles, Megaphone, DownloadCloud,
  ChevronsDown, ChevronsUp, FolderOpen, Folder, Smartphone, FolderArchive
} from 'lucide-react';
import { useStore } from '../store';
import { UserPermissions } from '../types';
import { isDesktopApp, isAndroidApp, isMotherWebPortal } from '../utils';
import { AccountingLogo } from './AccountingLogo';
import { PlatformCopyService } from '../services/platformCopyService';
import { AppDownloadCenterModal } from './AppDownloadCenterModal';
import { APP_VERSION } from '../config';

interface SidebarNavItem {
  to: string;
  icon: any;
  label: string;
  perm?: string;
  disabled?: boolean;
  shortcut?: string;
  keyCombo?: string[];
  badge?: string;
}

interface SidebarGroup {
  label: string;
  icon: any;
  perm?: string;
  items: SidebarNavItem[];
}

const Sidebar = () => {
  const companies = useStore(state => state.companies);
  const currentUser = useStore(state => state.currentUser);
  const logout = useStore(state => state.logout);
  const activeCompany = companies.find(c => c.isActive) || companies[0];
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDesktop = isDesktopApp();
  const isNativeClient = isDesktop || isAndroidApp();
  const isMotherPortal = isMotherWebPortal();

  const navRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const mainItems: SidebarNavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'پیشخوان', perm: 'dashboard', shortcut: 'Alt+1', keyCombo: ['Alt', '1'] },
    { to: '/invoices', icon: FileText, label: 'فاکتورها', perm: 'invoices', shortcut: 'Alt+2', keyCombo: ['Alt', '2'] },
    { to: '/inventory', icon: Package, label: 'انبارداری', perm: 'inventory', shortcut: 'Alt+3', keyCombo: ['Alt', '3'] },
    { to: '/checks', icon: Banknote, label: 'مدیریت چک', perm: 'checks', shortcut: 'Alt+4', keyCombo: ['Alt', '4'] },
    { to: '/finance', icon: Landmark, label: 'امور مالی', perm: 'finance', shortcut: 'Alt+5', keyCombo: ['Alt', '5'] },
    { to: '/customers', icon: Users, label: 'اشخاص', perm: 'customers', shortcut: 'Alt+6', keyCombo: ['Alt', '6'] },
  ];

  const groups: SidebarGroup[] = [
    {
      label: 'مدیریت کسب‌وکار',
      icon: Briefcase,
      perm: 'finance',
      items: [
        { to: '/projects', icon: Briefcase, label: 'پروژه‌ها', perm: 'finance' },
        { to: '/contracts', icon: ScrollText, label: 'قراردادها', perm: 'finance' },
        { to: '/assets', icon: Building2, label: 'دارایی‌های ثابت', perm: 'finance' },
        { to: '/budget', icon: PieChart, label: 'بودجه‌بندی', perm: 'finance' },
        { 
          to: '/marketing', 
          icon: TrendingUp, 
          label: 'بازاریابی و سئو', 
          perm: 'reports',
          disabled: isDesktop,
          badge: isDesktop ? 'مختص نسخه هاست' : undefined
        },
        { to: '/import-center', icon: FileSpreadsheet, label: 'مرکز واردات اسناد', perm: 'inventory' },
      ]
    },
    {
      label: 'حسابداری پیشرفته',
      icon: BookOpen,
      perm: 'finance',
      items: [
        { to: '/accounting', icon: BookOpen, label: 'حسابداری دوبل', perm: 'finance' },
        { to: '/cashflow-predictor', icon: TrendingUp, label: 'پیش‌بینی جریان نقدینگی', perm: 'finance', badge: '۳۰-۹۰ روز' },
        { to: '/cashflow', icon: TrendingUp, label: 'جریان نقدینگی', perm: 'finance' },
        { to: '/tax', icon: Calculator, label: 'مدیریت مالیات', perm: 'finance' },
        { to: '/loans', icon: CreditCard, label: 'وام‌ها', perm: 'finance' },
        { to: '/due-calendar', icon: Calendar, label: 'دفترچه قسط و تقویم چک', perm: 'finance' },
        { to: '/bank-reconciliation', icon: Building2, label: 'تطبیق بانکی', perm: 'finance' },
        { to: '/currency', icon: DollarSign, label: 'چند ارزی', perm: 'finance' },
        { to: '/workflow-rules', icon: Workflow, label: 'الگوی جریان مالی', perm: 'finance' },
      ]
    },
    {
      label: 'گزارشات و تحلیل',
      icon: PieChart,
      perm: 'reports',
      items: [
        { to: '/reports', icon: BarChart3, label: 'گزارشات عمومی', perm: 'reports', shortcut: 'Alt+7', keyCombo: ['Alt', '7'] },
        { to: '/financial-reports', icon: PieChart, label: 'گزارشات پیشرفته', perm: 'reports' },
        { to: '/ai-assistant', icon: Brain, label: 'دستیار هوشمند', perm: 'finance' },
      ]
    },
    {
      label: 'امضای دیجیتال',
      icon: ShieldCheck,
      perm: 'finance',
      items: [
        { to: '/signature-dashboard', icon: ShieldCheck, label: 'داشبورد امضا', perm: 'finance' },
        { to: '/signature-management', icon: PenTool, label: 'مدیریت امضا', perm: 'finance' },
      ]
    },
    {
      label: 'خدمات تجاری و ابری',
      icon: Sparkles,
      perm: 'settings',
      items: [
        ...(isMotherPortal ? [{ to: '/license-manager', icon: KeyRound, label: 'صدور لایسنس و مدیریت کلاینت‌ها (پرتال مدیر)', perm: 'settings' }] : []),
        { to: '/moadian', icon: Landmark, label: 'سامانه مؤدیان مالیاتی', perm: 'finance' },
        { to: '/pos-terminal', icon: CreditCard, label: 'کارتخوان بانکی (PC-POS)', perm: 'finance' },
        { to: '/cloud-vault', icon: Cloud, label: 'پشتیبان ابری (Cloud Vault)', perm: 'settings' },
        { to: '/sms-center', icon: MessageSquare, label: 'پنل پیامک هوشمند', perm: 'finance' },
        { to: '/multi-user-lan', icon: Network, label: 'شبکه محلی چندکاربره', perm: 'settings' },
        { to: '/client-broadcast', icon: Megaphone, label: isDesktop ? 'اطلاعیه‌ها و تخفیف‌ها' : 'انتشار اطلاعیه به کلاینت‌ها', perm: 'settings' },
        { to: '/install-android', icon: Smartphone, label: isMotherPortal ? 'ساخت نسخه‌ها و مدیریت اتصال' : 'اتصال سرور و فعال‌سازی لایسنس', badge: isMotherPortal ? 'پرتال' : 'کلاینت' },
        { to: '/mobile-catalog', icon: BookOpen, label: 'کاتالوگ ویزیتوری همراه + امضای لمسی', badge: 'ویزیتور' },
        { to: '/catalog', icon: BookOpen, label: 'کاتالوگ و معرفی محصول', badge: 'کاتالوگ' },
        { to: '/support-sla', icon: Headphones, label: 'پشتیبانی و تمدید سالانه', perm: 'settings' },
      ]
    },
    {
      label: 'تنظیمات و سیستم',
      icon: Settings,
      perm: 'settings',
      items: [
        { to: '/fiscal-year', icon: Calendar, label: 'سال مالی', perm: 'settings' },
        { to: '/security', icon: Lock, label: 'امنیت داده‌ها', perm: 'settings' },
        { to: '/data-sync', icon: RefreshCw, label: 'همگام‌سازی داده‌ها', perm: 'settings' },
        { to: '/advanced-settings', icon: Settings, label: 'تنظیمات پیشرفته', perm: 'settings' },
        { to: '/users', icon: UserCog, label: 'کاربران', perm: 'users', shortcut: 'Alt+8', keyCombo: ['Alt', '8'] },
      ]
    }
  ];

  const bottomItems: SidebarNavItem[] = [
    ...(isMotherPortal ? [{ to: '/debug-center', icon: FileCode2, label: 'مرکز دیباگ سیستم', perm: 'settings' }] : []),
    { to: '/updates', icon: DownloadCloud, label: 'مرکز آپدیت (OTA)', badge: 'جدید' },
    { to: '/settings', icon: Settings, label: 'تنظیمات عمومی', perm: 'settings', shortcut: 'Alt+9', keyCombo: ['Alt', '9'] },
    { to: '/help', icon: HelpCircle, label: 'آموزش و راهنما' },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeGroup: Record<string, boolean> = {};
    groups.forEach(g => {
      const hasActiveChild = g.items.some(item => pathname === item.to);
      if (hasActiveChild) {
        activeGroup[g.label] = true;
      }
    });
    return activeGroup;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const collapseAllGroups = () => {
    setOpenGroups({});
  };

  const expandAllGroups = () => {
    const all: Record<string, boolean> = {};
    groups.forEach(g => { all[g.label] = true; });
    setOpenGroups(all);
  };

  // بررسی وضعیت اسکرول
  const checkScrollState = () => {
    if (!navRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = navRef.current;
    setCanScrollUp(scrollTop > 20);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 20);
  };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    
    checkScrollState();
    nav.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);
    
    return () => {
      nav.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [openGroups]);

  // اسکرول نرم به پایین یا بالا
  const scrollToTop = () => {
    navRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    if (navRef.current) {
      navRef.current.scrollTo({ top: navRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // ارسال رویداد اسکرول ماوس تنها از بخش‌های خارج از nav به بخش اسکرول‌شونده
  const handleAsideWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (navRef.current && !navRef.current.contains(e.target as Node)) {
      navRef.current.scrollTop += e.deltaY;
    }
  };

  // اسکرول خودکار به آیتم فعال هنگام تغییر صفحه
  useEffect(() => {
    // باز کردن گروه مربوطه اگر در آن مسیر هستیم
    groups.forEach(g => {
      if (g.items.some(item => pathname === item.to)) {
        setOpenGroups(prev => ({ ...prev, [g.label]: true }));
      }
    });

    const activeEl = navRef.current?.querySelector('a.active, a[aria-current="page"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [pathname]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const key = e.key;
        let targetPath: string | null = null;
        
        switch(key) {
          case '1': targetPath = '/'; break;
          case '2': targetPath = '/invoices'; break;
          case '3': targetPath = '/inventory'; break;
          case '4': targetPath = '/checks'; break;
          case '5': targetPath = '/finance'; break;
          case '6': targetPath = '/customers'; break;
          case '7': targetPath = '/reports'; break;
          case '8': targetPath = '/users'; break;
          case '9': targetPath = '/settings'; break;
        }
        
        if (targetPath) {
          e.preventDefault();
          navigate(targetPath);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const renderLink = (item: SidebarNavItem, isChild = false) => {
    const userPerm = item.perm ? currentUser?.permissions[item.perm as keyof UserPermissions] : { view: true };
    if (currentUser && !userPerm?.view) return null;

    if (item.disabled) {
      return (
        <div key={item.to} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 cursor-not-allowed opacity-50 ${isChild ? 'mr-4' : ''}`} title="دسترسی غیرفعال">
          <Lock className="w-4 h-4 shrink-0" />
          <span className="font-bold text-xs">{item.label}</span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${isChild ? 'mr-3 border-r-2 border-slate-700/60' : ''} ${
            isActive
              ? 'bg-teal-600/25 text-teal-400 border border-teal-500/30 shadow-md font-black'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          }`
        }
      >
        <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="font-bold text-xs truncate">{item.label}</span>
          {item.label === 'اشخاص' && <Star size={8} className="text-amber-400 fill-amber-400" />}
        </div>
        {item.badge && (
          <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1.5 py-0.5 rounded-md font-black shrink-0">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  const hasAnyOpen = Object.values(openGroups).some(Boolean);

  return (
    <aside 
      onWheel={handleAsideWheel}
      className="fixed right-0 top-8 bottom-0 w-64 bg-[#0d1527] border-l border-white/5 z-[100] hidden md:flex flex-col no-print shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-white/5 shrink-0 bg-[#0d1527]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-lg border border-white/10 shrink-0 overflow-hidden">
            {activeCompany?.logo ? <img src={activeCompany.logo} className="w-full h-full object-cover rounded-xl" alt="Logo" /> : <AccountingLogo size="sm" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-xs sm:text-sm text-white truncate">{activeCompany?.name || 'اشک قلم'}</span>
            <span className="text-[8px] text-teal-400 font-bold truncate mt-0.5">
              {PlatformCopyService.getCopy().platformBadge}
            </span>
          </div>
        </div>

        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-activation-dashboard'))}
          title="مدیریت لایسنس و قفل سخت‌افزاری HWID"
          className="text-[9px] bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 px-1.5 py-1 rounded-lg font-bold font-mono transition cursor-pointer shrink-0"
        >
          v{APP_VERSION}
        </button>
      </div>

      {/* Quick Action Bar: Collapse/Expand All & Quick Scroll Helpers */}
      <div className="px-3 py-1.5 bg-[#0a101f] border-b border-white/5 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <button
          type="button"
          onClick={hasAnyOpen ? collapseAllGroups : expandAllGroups}
          className="flex items-center gap-1 hover:text-teal-300 transition text-[10px] font-bold"
          title={hasAnyOpen ? 'بستن همه زیرمنوها' : 'بازکردن همه زیرمنوها'}
        >
          {hasAnyOpen ? <Folder size={12} className="text-amber-400" /> : <FolderOpen size={12} className="text-teal-400" />}
          <span>{hasAnyOpen ? 'بستن گروه‌ها' : 'بازکردن گروه‌ها'}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={scrollToTop}
            disabled={!canScrollUp}
            className={`p-1 rounded-md transition ${canScrollUp ? 'text-slate-300 hover:text-teal-300 hover:bg-white/5' : 'text-slate-700 opacity-40'}`}
            title="اسکرول به بالا"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            onClick={scrollToBottom}
            disabled={!canScrollDown}
            className={`p-1 rounded-md transition ${canScrollDown ? 'text-slate-300 hover:text-teal-300 hover:bg-white/5' : 'text-slate-700 opacity-40'}`}
            title="اسکرول به تنظیمات و پایین"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* Scrollable Nav Items */}
      <nav 
        ref={navRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden sidebar-scrollbar py-2.5 px-2.5 space-y-1 focus:outline-none"
        tabIndex={0}
      >
        {/* Main Items */}
        {mainItems.map(item => renderLink(item))}

        <div className="h-px bg-white/5 my-2"></div>

        {/* Collapsible Submenus */}
        {groups.map((group) => {
          const groupPerm = group.perm ? currentUser?.permissions[group.perm as keyof UserPermissions] : { view: true };
          if (currentUser && !groupPerm?.view) return null;

          const isOpen = !!openGroups[group.label];
          return (
            <div key={group.label} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-white/5 cursor-pointer ${
                  isOpen ? 'bg-white/[0.04] text-slate-100 font-bold' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <group.icon className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="font-bold text-xs">{group.label}</span>
                </div>
                {isOpen ? <ChevronDown size={13} className="opacity-60" /> : <ChevronLeft size={13} className="opacity-60" />}
              </button>
              
              {isOpen && (
                <div className="space-y-1 pr-1.5 transition-all duration-200 animate-slide-down">
                  {group.items.map(item => renderLink(item, true))}
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom Navigation (Settings, Updates, Help) */}
        <div className="pt-2.5 mt-2.5 border-t border-white/5 space-y-1 pb-4">
          <div className="px-2 pb-1 text-[9px] font-black text-slate-500 uppercase tracking-wider">
            سیستم و تنظیمات
          </div>
          {bottomItems.map(item => renderLink(item))}

          {/* Download App Package Button: owner web portal only */}
          {isMotherPortal && (
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/30 group mt-2 font-bold text-xs"
              title="دانلود نسخه‌های مستقل نصبی ویندوز، اندروید و هاست"
            >
              <FolderArchive className="w-4 h-4 shrink-0 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="truncate">مرکز دانلود نرم‌افزار (EXE / APK)</span>
            </button>
          )}
        </div>
      </nav>

      {/* Floating Bottom Scroll Hint when overflowing */}
      {canScrollDown && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="w-full py-1 bg-teal-950/80 hover:bg-teal-900/90 text-teal-300 border-t border-teal-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-all shrink-0 animate-pulse"
        >
          <ChevronsDown size={12} />
          <span>موارد بیشتر / تنظیمات</span>
        </button>
      )}
      
      {/* Footer User Profile */}
      <div className="p-3 border-t border-white/5 shrink-0 bg-[#0a101f]">
        <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[8px] text-slate-400 font-black uppercase mb-0.5">کاربر فعال</div>
            <div className="text-white font-black text-xs truncate">{currentUser?.fullName || 'کاربر عادی'}</div>
          </div>
          <button onClick={logout} className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition shrink-0 cursor-pointer" title="خروج از سیستم">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <AppDownloadCenterModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />
    </aside>
  );
};

export default Sidebar;
