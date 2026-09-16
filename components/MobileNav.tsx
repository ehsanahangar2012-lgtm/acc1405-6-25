import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Package, Users, Menu, ScrollText, Banknote } from 'lucide-react';
import { useResponsiveLayout } from './ResponsiveLayoutManager';

export const MobileNav: React.FC = () => {
    const { isNavVisible, setOpenDrawer, isMaxTableMode } = useResponsiveLayout();

    return (
        <nav 
            className={`fixed bottom-4 left-3 right-3 transition-all duration-300 z-[150] md:hidden flex items-center justify-around px-2 no-print shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-[2rem] border border-white/10 backdrop-blur-xl ${
                isMaxTableMode ? 'h-14 bg-slate-950/90' : 'h-16 bg-slate-900/90'
            } ${
                isNavVisible ? 'translate-y-0 opacity-100' : 'translate-y-28 opacity-0 pointer-events-none'
            }`}
            dir="rtl"
        >
            <MobileNavItem to="/" icon={LayoutDashboard} label="پیشخوان" isMax={isMaxTableMode} />
            <MobileNavItem to="/invoices" icon={FileText} label="فاکتورها" isMax={isMaxTableMode} />
            <MobileNavItem to="/inventory" icon={Package} label="انبار" isMax={isMaxTableMode} />
            <MobileNavItem to="/contracts" icon={ScrollText} label="قراردادها" isMax={isMaxTableMode} />
            
            {/* Quick Drawer Opener for All Modules */}
            <button
                onClick={() => setOpenDrawer(true)}
                className="flex flex-col items-center justify-center gap-0.5 transition-all w-12 h-full text-slate-400 hover:text-teal-400 active:scale-95"
                title="سایر منوها و تنظیمات چیدمان"
            >
                <div className="p-1.5 rounded-xl bg-white/5 text-slate-300">
                    <Menu size={20} />
                </div>
                <span className="text-[8px] font-bold">بیشتر</span>
            </button>
        </nav>
    );
};

const MobileNavItem = ({ to, icon: Icon, label, isMax }: { to: string; icon: any; label: string; isMax?: boolean }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 transition-all duration-300 w-12 h-full relative group ${
                isActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
            }`
        }
    >
        {({ isActive }) => (
            <>
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-teal-500/20 text-teal-400' : 'bg-transparent'}`}>
                    <Icon size={isMax ? 18 : 20} className={`transition-all duration-300 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                </div>
                <span className={`text-[8px] font-black transition-all duration-300 truncate ${isActive ? 'opacity-100 text-teal-400' : 'opacity-80'}`}>
                    {label}
                </span>
                {isActive && (
                    <div className="absolute -bottom-1 w-1.5 h-1 bg-teal-400 rounded-full shadow-[0_0_8px_rgba(20,184,166,1)]" />
                )}
            </>
        )}
    </NavLink>
);

export default MobileNav;
