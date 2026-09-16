
import React, { useState, useEffect } from 'react';
import { Plus, X, FileText, Package, Banknote, Landmark, PackagePlus, UserPlus, BookOpenCheck, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickActionFAB: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const actions = [
        { icon: FileText, label: 'فاکتور فروش جدید', desc: 'صدور فاکتور و ارسال پیامک', color: 'bg-teal-600 hover:bg-teal-500', to: '/invoices' },
        { icon: UserPlus, label: 'ثبت سریع شخص', desc: 'مشتری یا تامین‌کننده جدید', color: 'bg-purple-600 hover:bg-purple-500', to: '/customers?action=new-person' },
        { icon: Banknote, label: 'ثبت چک صیادی', desc: 'دریافتی یا پرداختی', color: 'bg-amber-600 hover:bg-amber-500', to: '/checks' },
        { icon: Landmark, label: 'دریافت و پرداخت', desc: 'صندوق، بانک و تنخواه', color: 'bg-rose-600 hover:bg-rose-500', to: '/finance' },
        { icon: PackagePlus, label: 'ثبت کالا / موجودی', desc: 'ورود به انبار و قیمت‌گذاری', color: 'bg-emerald-600 hover:bg-emerald-500', to: '/inventory?action=new-product' },
        { icon: BookOpenCheck, label: 'سند حسابداری', desc: 'سند دستی دوبل', color: 'bg-indigo-600 hover:bg-indigo-500', to: '/accounting' },
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClick = (to: string) => {
        setIsOpen(false);
        navigate(to);
    };

    return (
        <div className="fixed bottom-20 left-4 md:bottom-8 md:left-8 z-[200] no-print">
            {/* Overlay backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Quick Actions List */}
            <div className={`absolute bottom-16 left-0 flex flex-col items-start gap-3 transition-all duration-300 origin-bottom-left ${
                isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-75 opacity-0 pointer-events-none'
            }`}>
                {/* Header tag */}
                <div className="bg-slate-900/90 backdrop-blur-md border border-teal-500/30 text-teal-400 px-4 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-teal-400 animate-pulse" />
                    <span>دسترسی سریع عملیات مالی</span>
                </div>

                {actions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleClick(action.to)}
                        className="flex items-center gap-3 group whitespace-nowrap bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/60 p-2.5 rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 cursor-pointer"
                        style={{ transitionDelay: `${idx * 25}ms` }}
                    >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110 ${action.color}`}>
                            <action.icon size={20} strokeWidth={2.5} />
                        </div>
                        <div className="text-right pl-3">
                            <div className="text-white text-xs font-black group-hover:text-teal-400 transition-colors">
                                {action.label}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                                {action.desc}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Toggle FAB Button */}
            <button
                type="button"
                id="quick-actions-fab-btn"
                title="عملیات سریع"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_30px_rgba(13,148,136,0.45)] hover:shadow-[0_15px_40px_rgba(13,148,136,0.6)] transition-all duration-300 transform border-2 border-white/20 active:scale-95 cursor-pointer ${
                    isOpen ? 'bg-rose-600 rotate-90 scale-105' : 'bg-gradient-to-tr from-teal-700 to-teal-500 hover:from-teal-600 hover:to-teal-400'
                }`}
            >
                {isOpen ? <X size={28} strokeWidth={2.5} /> : <Plus size={30} strokeWidth={2.5} />}
            </button>
        </div>
    );
};

export default QuickActionFAB;
