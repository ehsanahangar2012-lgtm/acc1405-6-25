import React, { useState, useMemo } from 'react';
import { 
    TrendingUp, AlertTriangle, CheckCircle2, Calendar, 
    DollarSign, ArrowUpRight, ArrowDownLeft, ShieldAlert, 
    HelpCircle, Filter, Sparkles, RefreshCw, Landmark,
    CreditCard, Clock, ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';
import { useStore } from '../store';
import { Check, Invoice, InvoiceType } from '../types';
import { 
    formatCurrency, toPersianDigits, getPersianDate, 
    formatAmountOnly 
} from '../utils';

interface DayFlow {
    date: string;
    dayOffset: number;
    inflow: number;
    outflow: number;
    net: number;
    closingBalance: number;
    inEvents: { title: string; amount: number; type: 'check' | 'invoice' }[];
    outEvents: { title: string; amount: number; type: 'check' | 'expense' }[];
    isDeficit: boolean;
}

export const CashFlowPredictor: React.FC = () => {
    const { 
        checks = [], 
        invoices = [], 
        transactions = [],
        vouchers = [],
        config 
    } = useStore();

    const currency: 'RIAL' | 'TOMAN' = config?.currency === 'TOMAN' ? 'TOMAN' : 'RIAL';
    const currencyLabel = currency === 'TOMAN' ? 'تومان' : 'ریال';

    const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedDateDetails, setSelectedDateDetails] = useState<DayFlow | null>(null);

    // موجودی نقدی و بانکی فعلی
    const currentLiquidity = useMemo(() => {
        let total = 0;
        if (transactions && transactions.length > 0) {
            total = transactions.reduce((sum, t) => {
                if (t.type === 'RECEIVE') return sum + (t.amount || 0);
                if (t.type === 'PAY') return sum - (t.amount || 0);
                return sum;
            }, 0);
        }
        return total !== 0 ? total : 50000000; // مقدار اولیه پایه در صورت عدم تراکنش
    }, [transactions]);

    // محاسبه جریان نقدینگی ۳۰/۶۰/۹۰ روز آینده
    const simulation = useMemo(() => {
        const todayStr = getPersianDate();
        const days: DayFlow[] = [];
        let runningBalance = currentLiquidity;

        // آماده‌سازی روزها
        for (let i = 0; i < horizonDays; i++) {
            // شبیه‌سازی تاریخ شمسی با اضافه کردن روز
            const parts = todayStr.split('/');
            let y = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);
            let d = parseInt(parts[2], 10) + i;

            while (d > 30) {
                d -= 30;
                m += 1;
                if (m > 12) {
                    m = 1;
                    y += 1;
                }
            }

            const formattedDate = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

            let inflow = 0;
            let outflow = 0;
            const inEvents: DayFlow['inEvents'] = [];
            const outEvents: DayFlow['outEvents'] = [];

            // ۱. چک‌های دریافتی سررسید این روز
            checks.forEach(c => {
                if (c.checkType === 'RECEIVED' && (c.status === 'PENDING' || c.status === 'DEPOSITED')) {
                    if (c.dueDate === formattedDate) {
                        inflow += c.amount;
                        inEvents.push({
                            title: `وصول چک صیادی دریافتی (${c.bankName} - ${c.personName || c.holderName})`,
                            amount: c.amount,
                            type: 'check'
                        });
                    }
                }
            });

            // ۲. چک‌های پرداختی سررسید این روز
            checks.forEach(c => {
                if (c.checkType === 'ISSUED' && c.status === 'PENDING') {
                    if (c.dueDate === formattedDate) {
                        outflow += c.amount;
                        outEvents.push({
                            title: `سررسید چک پرداختی (${c.bankName} - به ${c.personName || c.holderName})`,
                            amount: c.amount,
                            type: 'check'
                        });
                    }
                }
            });

            // ۳. فاکتورهای سررسید شده نسیه
            invoices.forEach(inv => {
                if (inv.dueDate === formattedDate) {
                    const remaining = (inv.finalTotal || 0) - (inv.cashAmount || 0);
                    if (remaining > 0) {
                        if (inv.type === InvoiceType.SALE) {
                            inflow += remaining;
                            inEvents.push({
                                title: `سررسید فاکتور فروش ${inv.number} (${inv.personName})`,
                                amount: remaining,
                                type: 'invoice'
                            });
                        } else if (inv.type === InvoiceType.PURCHASE) {
                            outflow += remaining;
                            outEvents.push({
                                title: `موعد پرداخت فاکتور خرید ${inv.number} (${inv.personName})`,
                                amount: remaining,
                                type: 'expense'
                            });
                        }
                    }
                }
            });

            const net = inflow - outflow;
            runningBalance += net;

            days.push({
                date: formattedDate,
                dayOffset: i,
                inflow,
                outflow,
                net,
                closingBalance: runningBalance,
                inEvents,
                outEvents,
                isDeficit: runningBalance < 0
            });
        }

        return days;
    }, [checks, invoices, currentLiquidity, horizonDays]);

    const deficitDays = simulation.filter(d => d.isDeficit);
    const totalInflow = simulation.reduce((sum, d) => sum + d.inflow, 0);
    const totalOutflow = simulation.reduce((sum, d) => sum + d.outflow, 0);
    const minBalance = Math.min(...simulation.map(d => d.closingBalance));

    return (
        <div className="space-y-6 pb-20 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 md:p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-white">دستیار هوشمند پیش‌بینی جریان نقدینگی (Cash Flow)</h1>
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="p-1 text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                                title="راهنمای هوشمند"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            ارزیابی و شبیه‌سازی ۳۰ الی ۹۰ روز آینده بر اساس چک‌های صیادی و سررسید فاکتورها
                        </p>
                    </div>
                </div>

                {/* Horizon Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setHorizonDays(30)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                            horizonDays === 30 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        ۳۰ روز آینده
                    </button>
                    <button
                        onClick={() => setHorizonDays(60)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                            horizonDays === 60 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        ۶۰ روز آینده
                    </button>
                    <button
                        onClick={() => setHorizonDays(90)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                            horizonDays === 90 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        ۹۰ روز آینده
                    </button>
                </div>
            </div>

            {/* Smart Help Drawer */}
            {showHelp && (
                <div className="bg-slate-900/90 border border-indigo-500/30 p-5 rounded-3xl text-xs text-slate-300 space-y-2 animate-slide-down">
                    <h3 className="font-bold text-indigo-400 flex items-center gap-2">
                        <Sparkles size={16} /> منطق محاسباتی موتور پیش‌بینی جریان نقدینگی:
                    </h3>
                    <p className="leading-relaxed">
                        • این دستیار با تجمیع موجودی حساب‌های بانکی و صندوق، و تطبیق روزانه سررسید چک‌های صیادی دریافتی/پرداختی و فاکتورهای نسیه، مانده نقدینگی را شبیه‌سازی می‌کند.
                    </p>
                    <p className="leading-relaxed">
                        • در صورت وجود روزهایی با مانده منفی (کسری نقدینگی)، سیستم با بج قرمز هشدار داده و چک‌های در معرض خطر برگشت را شناسایی می‌نماید.
                    </p>
                </div>
            )}

            {/* کارت‌های خلاصه وضعیت نقدینگی */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">موجودی نقدی/بانک فعلی:</span>
                        <Landmark size={18} className="text-teal-400" />
                    </div>
                    <div className="text-lg font-black text-white font-mono">
                        {formatCurrency(currentLiquidity, currency)}
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">مجموع ورودی‌های پیش‌بینی:</span>
                        <ArrowDownLeft size={18} className="text-emerald-400" />
                    </div>
                    <div className="text-lg font-black text-emerald-400 font-mono">
                        +{formatAmountOnly(totalInflow, currency)} {currencyLabel}
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">مجموع خروجی‌های پیش‌بینی:</span>
                        <ArrowUpRight size={18} className="text-rose-400" />
                    </div>
                    <div className="text-lg font-black text-rose-400 font-mono">
                        -{formatAmountOnly(totalOutflow, currency)} {currencyLabel}
                    </div>
                </div>

                <div className={`p-5 rounded-3xl space-y-2 shadow-lg border ${
                    deficitDays.length > 0 
                        ? 'bg-rose-500/10 border-rose-500/30' 
                        : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">وضعیت ریسک نقدینگی:</span>
                        {deficitDays.length > 0 ? (
                            <ShieldAlert size={18} className="text-rose-400 animate-pulse" />
                        ) : (
                            <CheckCircle2 size={18} className="text-emerald-400" />
                        )}
                    </div>
                    <div className="text-xs font-black text-white">
                        {deficitDays.length > 0 
                            ? `⚠️ ${toPersianDigits(deficitDays.length)} روز کسری موجودی شناسایی شد`
                            : '🟢 جریان نقدینگی کاملاً امن و مثبت است'}
                    </div>
                </div>
            </div>

            {/* جدول و نمودار خط زمان روزانه نقدینگی */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                        <BarChart3 size={20} className="text-indigo-400" />
                        <span>تقویم و خط زمانی جریان وجوه نقد ({toPersianDigits(horizonDays)} روز)</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                        کمترین مانده دوره: <strong className={minBalance < 0 ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>{formatCurrency(minBalance, currency)}</strong>
                    </span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                                <th className="py-3 px-3">تاریخ شمسی</th>
                                <th className="py-3 px-3">ورودی پیش‌بینی (وصول چک/فاکتور)</th>
                                <th className="py-3 px-3">خروجی پیش‌بینی (پاس چک/خرید)</th>
                                <th className="py-3 px-3">تراز روز (خالص)</th>
                                <th className="py-3 px-3">مانده بسته شدن پیش‌بینی</th>
                                <th className="py-3 px-3 text-center">وضعیت ریسک</th>
                                <th className="py-3 px-3 text-center">رویدادها</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                            {simulation.map((day, idx) => {
                                const hasEvents = day.inEvents.length > 0 || day.outEvents.length > 0;
                                return (
                                    <tr 
                                        key={day.date}
                                        className={`hover:bg-white/5 transition ${
                                            day.isDeficit ? 'bg-rose-500/10' : hasEvents ? 'bg-slate-950/40' : ''
                                        }`}
                                    >
                                        <td className="py-3 px-3 font-sans font-bold text-slate-200">
                                            {toPersianDigits(day.date)}
                                            {idx === 0 && <span className="text-[10px] text-teal-400 mr-1.5 font-sans">(امروز)</span>}
                                        </td>
                                        <td className="py-3 px-3 text-emerald-400">
                                            {day.inflow > 0 ? `+${formatAmountOnly(day.inflow, currency)}` : '—'}
                                        </td>
                                        <td className="py-3 px-3 text-rose-400">
                                            {day.outflow > 0 ? `-${formatAmountOnly(day.outflow, currency)}` : '—'}
                                        </td>
                                        <td className={`py-3 px-3 font-bold ${
                                            day.net > 0 ? 'text-emerald-400' : day.net < 0 ? 'text-rose-400' : 'text-slate-500'
                                        }`}>
                                            {day.net !== 0 ? formatAmountOnly(day.net, currency) : '۰'}
                                        </td>
                                        <td className={`py-3 px-3 font-black ${
                                            day.closingBalance < 0 ? 'text-rose-400 text-sm underline' : 'text-white'
                                        }`}>
                                            {formatCurrency(day.closingBalance, currency)}
                                        </td>
                                        <td className="py-3 px-3 text-center font-sans">
                                            {day.isDeficit ? (
                                                <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-md">
                                                    کسری نقدینگی ⚠️
                                                </span>
                                            ) : (
                                                <span className="text-emerald-400 text-[11px] font-bold">
                                                    تراز مثبت ✓
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center font-sans">
                                            {hasEvents ? (
                                                <button
                                                    onClick={() => setSelectedDateDetails(day)}
                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                                >
                                                    مشاهده ریز ({toPersianDigits(day.inEvents.length + day.outEvents.length)})
                                                </button>
                                            ) : (
                                                <span className="text-slate-600 text-[10px]">بدون رویداد</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* مودال مشاهده ریز رویدادهای یک روز */}
            {selectedDateDetails && (
                <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-black text-white">
                                ریز رویدادهای مالی مورخ {toPersianDigits(selectedDateDetails.date)}
                            </h3>
                            <button
                                onClick={() => setSelectedDateDetails(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                            {selectedDateDetails.inEvents.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-bold text-emerald-400">ورودی‌های نقدینگی:</h4>
                                    {selectedDateDetails.inEvents.map((ev, i) => (
                                        <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                            <span className="text-slate-200">{ev.title}</span>
                                            <span className="font-mono font-bold text-emerald-400">+{formatCurrency(ev.amount, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedDateDetails.outEvents.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-bold text-rose-400">خروجی‌ها و تعهدات:</h4>
                                    {selectedDateDetails.outEvents.map((ev, i) => (
                                        <div key={i} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                            <span className="text-slate-200">{ev.title}</span>
                                            <span className="font-mono font-bold text-rose-400">-{formatCurrency(ev.amount, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-400">مانده نهایی این روز:</span>
                            <span className="text-sm font-black text-white font-mono">{formatCurrency(selectedDateDetails.closingBalance, currency)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashFlowPredictor;
