import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useFinancialStore } from '../store-financial';
import { Check } from '../types';
import { formatCurrency, toPersianDigits, getPersianDate } from '../utils';
import { 
    Calendar as CalendarIcon, ChevronRight, ChevronLeft, Bell, AlertTriangle, 
    CheckCircle2, Clock, Landmark, CreditCard, ArrowDownLeft, ArrowUpRight, 
    Filter, HelpCircle, FileSpreadsheet, Send, DollarSign, X, CheckCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface JalaliDueCalendarProps {
    onSelectCheck?: (check: Check) => void;
}

// نام ماه‌های شمسی
const JALALI_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

export const JalaliDueCalendar: React.FC<JalaliDueCalendarProps> = ({ onSelectCheck }) => {
    const { checks, updateCheckStatus, addNotification } = useStore();
    const { loans, loanInstallments, payLoanInstallment } = useFinancialStore();

    const todayStr = getPersianDate(); // e.g. "1403/06/12"
    const [currentYear, setCurrentYear] = useState(() => {
        const parts = todayStr.split('/');
        return parseInt(parts[0]) || 1403;
    });
    const [currentMonth, setCurrentMonth] = useState(() => {
        const parts = todayStr.split('/');
        return parseInt(parts[1]) || 6;
    });

    const [activeTab, setActiveTab] = useState<'CALENDAR' | 'INSTALLMENT_BOOK'>('CALENDAR');
    const [filterType, setFilterType] = useState<'ALL' | 'RECEIVED' | 'ISSUED' | 'INSTALLMENT'>('ALL');
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [selectedLoanId, setSelectedLoanId] = useState<string>('');

    // تعداد روزهای ماه شمسی
    const daysInMonth = useMemo(() => {
        if (currentMonth <= 6) return 31;
        if (currentMonth <= 11) return 30;
        // اسفند (ساده‌سازی سال کبیسه)
        const leapYears = [1399, 1403, 1408, 1412, 1416];
        return leapYears.includes(currentYear) ? 30 : 29;
    }, [currentYear, currentMonth]);

    // ناوبری ماه‌ها
    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentYear(y => y - 1);
            setCurrentMonth(12);
        } else {
            setCurrentMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentYear(y => y + 1);
            setCurrentMonth(1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    };

    const handleGoToday = () => {
        const parts = todayStr.split('/');
        setCurrentYear(parseInt(parts[0]) || 1403);
        setCurrentMonth(parseInt(parts[1]) || 6);
        setSelectedDate(todayStr);
    };

    // دسته‌بندی تمام رویدادهای سررسید (چک‌های دریافتی، چک‌های پرداختی، اقساط)
    const allDueEvents = useMemo(() => {
        const events: Array<{
            id: string;
            date: string;
            type: 'RECEIVED' | 'ISSUED' | 'INSTALLMENT';
            title: string;
            subTitle: string;
            amount: number;
            status: string;
            rawItem?: any;
        }> = [];

        // ۱. چک‌ها
        checks.forEach(c => {
            const isIssued = c.checkType === 'ISSUED';
            const isReceived = !isIssued;

            if (filterType === 'RECEIVED' && !isReceived) return;
            if (filterType === 'ISSUED' && !isIssued) return;
            if (filterType === 'INSTALLMENT') return;

            events.push({
                id: c.id,
                date: c.dueDate,
                type: isIssued ? 'ISSUED' : 'RECEIVED',
                title: `${isIssued ? 'چک پرداختی' : 'چک دریافتی'}: ${c.bankName}`,
                subTitle: `${c.holderName || 'نامشخص'} - صیاد: ${c.sayadId || '-'}`,
                amount: c.amount,
                status: c.status,
                rawItem: c
            });
        });

        // ۲. اقساط وام‌ها و تسهیلات
        if (filterType === 'ALL' || filterType === 'INSTALLMENT') {
            loanInstallments.forEach(inst => {
                const parentLoan = loans.find(l => l.id === inst.loanId);
                const isPaid = inst.status === 'PAID';

                events.push({
                    id: inst.id,
                    date: inst.dueDate,
                    type: 'INSTALLMENT',
                    title: `قسط وام: ${parentLoan?.lenderName || 'تسهیلات'}`,
                    subTitle: `اصل: ${formatCurrency(inst.principalAmount)} + سود: ${formatCurrency(inst.interestAmount)}`,
                    amount: inst.totalAmount,
                    status: inst.status,
                    rawItem: inst
                });
            });
        }

        return events;
    }, [checks, loanInstallments, loans, filterType]);

    // تقویم بر اساس روزهای ماه
    const monthCalendarDays = useMemo(() => {
        const daysMap: Record<string, typeof allDueEvents> = {};
        allDueEvents.forEach(evt => {
            if (!daysMap[evt.date]) daysMap[evt.date] = [];
            daysMap[evt.date].push(evt);
        });
        return daysMap;
    }, [allDueEvents]);

    // محاسبه رویدادهای سررسید نزدیک (۳ روز آینده) و معوقات
    const nearAlerts = useMemo(() => {
        const upcoming: typeof allDueEvents = [];
        const overdue: typeof allDueEvents = [];

        allDueEvents.forEach(evt => {
            if (evt.status === 'PASSED' || evt.status === 'PAID') return;

            if (evt.date < todayStr) {
                overdue.push(evt);
            } else if (evt.date >= todayStr) {
                // مقایسه ساده روزها در بازه نزدیک
                const dateParts = evt.date.split('/').map(Number);
                const todayParts = todayStr.split('/').map(Number);
                if (dateParts[0] === todayParts[0] && dateParts[1] === todayParts[1]) {
                    const diffDays = dateParts[2] - todayParts[2];
                    if (diffDays >= 0 && diffDays <= 3) {
                        upcoming.push(evt);
                    }
                }
            }
        });

        return { upcoming, overdue };
    }, [allDueEvents, todayStr]);

    // آمار سرجمع ماه جاری
    const monthSummary = useMemo(() => {
        const monthPrefix = `${currentYear}/${String(currentMonth).padStart(2, '0')}`;
        let receivedSum = 0;
        let issuedSum = 0;
        let installmentSum = 0;

        allDueEvents.forEach(e => {
            if (e.date.startsWith(monthPrefix)) {
                if (e.type === 'RECEIVED') receivedSum += e.amount;
                if (e.type === 'ISSUED') issuedSum += e.amount;
                if (e.type === 'INSTALLMENT') installmentSum += e.amount;
            }
        });

        return {
            receivedSum,
            issuedSum,
            installmentSum,
            netBalance: receivedSum - (issuedSum + installmentSum)
        };
    }, [allDueEvents, currentYear, currentMonth]);

    // لیست رویدادهای روز انتخاب شده
    const selectedDateEvents = useMemo(() => {
        return monthCalendarDays[selectedDate] || [];
    }, [monthCalendarDays, selectedDate]);

    // استخراج اکسل دفترچه اقساط
    const handleExportInstallmentsExcel = () => {
        const targetLoan = loans.find(l => l.id === selectedLoanId) || loans[0];
        const targetInstallments = targetLoan 
            ? loanInstallments.filter(i => i.loanId === targetLoan.id)
            : loanInstallments;

        const data: any[][] = [
            ['دفترچه اقساط و جدول زمان‌بندی بازپرداخت تسهیلات (اشک قلم)'],
            [`نام وام دهنده / بانک: ${targetLoan?.lenderName || 'کلیه تسهیلات'}`, `شماره قرارداد/وام: ${targetLoan?.loanNumber || '-'}`],
            [`اصل تسهیلات: ${targetLoan?.principalAmount || 0} ریال`, `نرخ سود: ${targetLoan?.interestRate || 0} ٪`],
            [`تاریخ استخراج: ${getPersianDate()}`, 'واحد ارقام: ریال ایران'],
            [],
            ['ردیف', 'تاریخ سررسید شمسی', 'مبلغ اصل قسط', 'مبلغ سود/کارمزد', 'مبلغ کل قسط (ریال)', 'وضعیت پرداخت', 'تاریخ پرداخت قطعی']
        ];

        targetInstallments.forEach((inst, idx) => {
            data.push([
                idx + 1,
                inst.dueDate,
                inst.principalAmount,
                inst.interestAmount,
                inst.totalAmount,
                inst.status === 'PAID' ? 'پرداخت شده' : inst.status === 'OVERDUE' ? 'معوق شده' : 'در انتظار سررسید',
                inst.paidDate || '-'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!views'] = [{ rightToLeft: true }];
        ws['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'دفترچه اقساط');
        XLSX.writeFile(wb, `دفترچه_اقساط_${targetLoan?.lenderName || 'تسهیلات'}_${getPersianDate().replace(/\//g, '-')}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* نوار سربرگ و راهنمای هوشمند */}
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <CalendarIcon className="text-teal-400 w-8 h-8" />
                            <h2 className="text-2xl font-black text-white">دفترچه قسط و تقویم هوشمند سررسیدها</h2>
                            <button 
                                onClick={() => setShowHelpModal(true)} 
                                className="bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white p-2 rounded-xl transition-all border border-teal-500/20"
                                title="راهنمای هوشمند تقویم و اقساط"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">پایش همزمان چک‌های دریافتی، پرداختی و جدول بازپرداخت اقساط در تقویم رسمی شمسی</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="bg-slate-950 p-1 rounded-2xl border border-white/5 flex gap-1">
                            <button 
                                onClick={() => setActiveTab('CALENDAR')} 
                                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'CALENDAR' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                تقویم ماهانه سررسید
                            </button>
                            <button 
                                onClick={() => setActiveTab('INSTALLMENT_BOOK')} 
                                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'INSTALLMENT_BOOK' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                دفترچه اقساط تسهیلات
                            </button>
                        </div>
                    </div>
                </div>

                {/* خلاصه جریان نقدینگی ماهانه */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl">
                        <div className="flex items-center justify-between text-emerald-400 text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5"><ArrowDownLeft size={14}/> چک‌های دریافتی ماه</span>
                        </div>
                        <div className="text-white font-mono font-black text-base">{formatCurrency(monthSummary.receivedSum).replace(' ریال', '')} <span className="text-[10px] text-slate-400">ریال</span></div>
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-2xl">
                        <div className="flex items-center justify-between text-rose-400 text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5"><ArrowUpRight size={14}/> چک‌های پرداختی ماه</span>
                        </div>
                        <div className="text-white font-mono font-black text-base">{formatCurrency(monthSummary.issuedSum).replace(' ریال', '')} <span className="text-[10px] text-slate-400">ریال</span></div>
                    </div>

                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-3.5 rounded-2xl">
                        <div className="flex items-center justify-between text-indigo-400 text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5"><CreditCard size={14}/> اقساط سررسید ماه</span>
                        </div>
                        <div className="text-white font-mono font-black text-base">{formatCurrency(monthSummary.installmentSum).replace(' ریال', '')} <span className="text-[10px] text-slate-400">ریال</span></div>
                    </div>

                    <div className="bg-slate-800/80 border border-white/10 p-3.5 rounded-2xl">
                        <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5"><DollarSign size={14}/> تراز پیش‌بینی نقدی ماه</span>
                        </div>
                        <div className={`font-mono font-black text-base ${monthSummary.netBalance >= 0 ? 'text-teal-400' : 'text-amber-400'}`}>
                            {formatCurrency(monthSummary.netBalance).replace(' ریال', '')} <span className="text-[10px] text-slate-400">ریال</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* کارت‌های آلارم سررسید ۳ روز آینده و معوقات */}
            {(nearAlerts.upcoming.length > 0 || nearAlerts.overdue.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nearAlerts.upcoming.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-3xl flex items-start gap-3">
                            <Bell className="text-amber-400 shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <h4 className="text-amber-300 text-xs font-black mb-1">
                                    سررسیدهای ۳ روز آینده ({toPersianDigits(nearAlerts.upcoming.length)} مورد)
                                </h4>
                                <div className="space-y-1.5 text-xs text-slate-300 max-h-24 overflow-y-auto custom-scrollbar">
                                    {nearAlerts.upcoming.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-black/20 p-1.5 rounded-lg">
                                            <span>{item.title} ({toPersianDigits(item.date)})</span>
                                            <span className="font-mono font-bold text-amber-400">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {nearAlerts.overdue.length > 0 && (
                        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-3xl flex items-start gap-3">
                            <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <h4 className="text-rose-300 text-xs font-black mb-1">
                                    اسناد سررسید گذشته و معوق ({toPersianDigits(nearAlerts.overdue.length)} مورد)
                                </h4>
                                <div className="space-y-1.5 text-xs text-slate-300 max-h-24 overflow-y-auto custom-scrollbar">
                                    {nearAlerts.overdue.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-black/20 p-1.5 rounded-lg">
                                            <span>{item.title} ({toPersianDigits(item.date)})</span>
                                            <span className="font-mono font-bold text-rose-400">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'CALENDAR' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ماتریس تقویم ماهانه */}
                    <div className="lg:col-span-8 bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                        {/* نوار تغییر ماه و فیلترها */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <button onClick={handlePrevMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all">
                                    <ChevronRight size={20} />
                                </button>
                                <span className="text-white font-black text-lg min-w-[140px] text-center">
                                    {JALALI_MONTHS[currentMonth - 1]} {toPersianDigits(currentYear)}
                                </span>
                                <button onClick={handleNextMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all">
                                    <ChevronLeft size={20} />
                                </button>
                                <button onClick={handleGoToday} className="text-xs bg-white/5 hover:bg-white/10 text-teal-400 px-3 py-2 rounded-xl font-bold border border-teal-500/20">
                                    برو به امروز
                                </button>
                            </div>

                            {/* فیلتر نوع سند */}
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 text-xs font-bold">
                                <button onClick={() => setFilterType('ALL')} className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>همه</button>
                                <button onClick={() => setFilterType('RECEIVED')} className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'RECEIVED' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>دریافتی</button>
                                <button onClick={() => setFilterType('ISSUED')} className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'ISSUED' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>پرداختی</button>
                                <button onClick={() => setFilterType('INSTALLMENT')} className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'INSTALLMENT' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>اقساط</button>
                            </div>
                        </div>

                        {/* سرستون روزهای هفته */}
                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-slate-400 border-b border-white/5 pb-2">
                            {WEEK_DAYS.map(day => <div key={day}>{day}</div>)}
                        </div>

                        {/* خانه‌های روزهای تقویم */}
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const dayNum = i + 1;
                                const dateStr = `${currentYear}/${String(currentMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDate;
                                const dayEvents = monthCalendarDays[dateStr] || [];

                                const receivedCount = dayEvents.filter(e => e.type === 'RECEIVED').length;
                                const issuedCount = dayEvents.filter(e => e.type === 'ISSUED').length;
                                const instCount = dayEvents.filter(e => e.type === 'INSTALLMENT').length;

                                return (
                                    <div
                                        key={dayNum}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                                            isSelected 
                                                ? 'bg-teal-600/20 border-teal-500 shadow-lg' 
                                                : isToday
                                                    ? 'bg-indigo-600/10 border-indigo-500/40'
                                                    : 'bg-slate-950/60 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`font-mono text-xs font-black ${isToday ? 'text-teal-400 bg-teal-500/20 px-1.5 py-0.5 rounded-md' : 'text-slate-300'}`}>
                                                {toPersianDigits(dayNum)}
                                            </span>
                                            {dayEvents.length > 0 && (
                                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                                    {toPersianDigits(dayEvents.length)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1 mt-1">
                                            {receivedCount > 0 && (
                                                <div className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center justify-between">
                                                    <span>دریافتی</span>
                                                    <span className="font-mono">{toPersianDigits(receivedCount)}</span>
                                                </div>
                                            )}
                                            {issuedCount > 0 && (
                                                <div className="bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center justify-between">
                                                    <span>پرداختی</span>
                                                    <span className="font-mono">{toPersianDigits(issuedCount)}</span>
                                                </div>
                                            )}
                                            {instCount > 0 && (
                                                <div className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center justify-between">
                                                    <span>قسط</span>
                                                    <span className="font-mono">{toPersianDigits(instCount)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* سایدبار جزئیات روز انتخاب شده */}
                    <div className="lg:col-span-4 bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                                <div>
                                    <span className="text-slate-400 text-xs font-bold block">رویدادهای سررسید تاریخ:</span>
                                    <h3 className="text-xl font-black text-white font-mono mt-0.5">{toPersianDigits(selectedDate)}</h3>
                                </div>
                                <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-black text-teal-400">
                                    {toPersianDigits(selectedDateEvents.length)} سند
                                </span>
                            </div>

                            {selectedDateEvents.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 text-xs font-bold">
                                    در این تاریخ هیچ سند یا قسطی سررسید نمی‌شود.
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                                    {selectedDateEvents.map(evt => (
                                        <div 
                                            key={evt.id} 
                                            className={`p-4 rounded-2xl border transition-all ${
                                                evt.type === 'RECEIVED' 
                                                    ? 'bg-emerald-500/10 border-emerald-500/20' 
                                                    : evt.type === 'ISSUED'
                                                        ? 'bg-rose-500/10 border-rose-500/20'
                                                        : 'bg-indigo-500/10 border-indigo-500/20'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <h5 className="text-white text-xs font-black">{evt.title}</h5>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${
                                                    evt.status === 'PASSED' || evt.status === 'PAID'
                                                        ? 'bg-teal-500/20 text-teal-300'
                                                        : evt.status === 'BOUNCED' || evt.status === 'OVERDUE'
                                                            ? 'bg-rose-500/20 text-rose-300'
                                                            : 'bg-amber-500/20 text-amber-300'
                                                }`}>
                                                    {evt.status === 'PASSED' || evt.status === 'PAID' ? 'تسویه شده' : 'نزد صندوق / جاری'}
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-slate-400 mt-1">{evt.subTitle}</p>

                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                                                <span className="font-mono font-black text-white text-sm">
                                                    {formatCurrency(evt.amount)}
                                                </span>

                                                {evt.type === 'INSTALLMENT' && evt.status !== 'PAID' && (
                                                    <button 
                                                        onClick={() => {
                                                            payLoanInstallment(evt.id);
                                                            addNotification('success', 'قسط مورد نظر با موفقیت تسویه شد.');
                                                        }}
                                                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all"
                                                    >
                                                        ثبت پرداخت
                                                    </button>
                                                )}

                                                {evt.type !== 'INSTALLMENT' && onSelectCheck && (
                                                    <button 
                                                        onClick={() => onSelectCheck(evt.rawItem)}
                                                        className="text-teal-400 hover:text-white text-[10px] font-bold"
                                                    >
                                                        مشاهده سند
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-white/5 text-[11px] text-slate-400 text-center">
                            انتخاب هر روز، جزئیات و اسناد سررسید آن روز را نمایش می‌دهد.
                        </div>
                    </div>
                </div>
            ) : (
                /* تب دفترچه اقساط تسهیلات */
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <CreditCard className="text-indigo-400" size={24} />
                            <div>
                                <h3 className="text-lg font-black text-white">دفترچه اقساط و زمان‌بندی بازپرداخت وام‌ها</h3>
                                <p className="text-xs text-slate-400">محاسبه مانده، اصل، کارمزد و ثبت پرداخت هر قسط</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <select 
                                value={selectedLoanId} 
                                onChange={e => setSelectedLoanId(e.target.value)}
                                className="bg-slate-950 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            >
                                <option value="">همه تسهیلات و وام‌ها</option>
                                {loans.map(l => (
                                    <option key={l.id} value={l.id}>{l.lenderName} ({l.loanNumber})</option>
                                ))}
                            </select>

                            <button 
                                onClick={handleExportInstallmentsExcel}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg"
                            >
                                <FileSpreadsheet size={16} />
                                <span>استخراج اکسل دفترچه قسط</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 text-slate-400 font-black">
                                    <th className="p-3">ردیف</th>
                                    <th className="p-3">نام تسهیلات / بانک</th>
                                    <th className="p-3">سررسید شمسی</th>
                                    <th className="p-3 text-left">مبلغ اصل</th>
                                    <th className="p-3 text-left">مبلغ سود/کارمزد</th>
                                    <th className="p-3 text-left">مبلغ کل قسط</th>
                                    <th className="p-3 text-center">وضعیت</th>
                                    <th className="p-3 text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                                {loanInstallments
                                    .filter(inst => !selectedLoanId || inst.loanId === selectedLoanId)
                                    .map((inst, idx) => {
                                        const loan = loans.find(l => l.id === inst.loanId);
                                        const isPaid = inst.status === 'PAID';

                                        return (
                                            <tr key={inst.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-mono">{toPersianDigits(idx + 1)}</td>
                                                <td className="p-3 font-bold text-white">{loan?.lenderName || 'تسهیلات'}</td>
                                                <td className="p-3 font-mono text-teal-400">{toPersianDigits(inst.dueDate)}</td>
                                                <td className="p-3 text-left font-mono">{formatCurrency(inst.principalAmount).replace(' ریال', '')}</td>
                                                <td className="p-3 text-left font-mono">{formatCurrency(inst.interestAmount).replace(' ریال', '')}</td>
                                                <td className="p-3 text-left font-mono font-black text-white">{formatCurrency(inst.totalAmount).replace(' ریال', '')}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                                                        isPaid 
                                                            ? 'bg-emerald-500/20 text-emerald-400' 
                                                            : inst.dueDate < todayStr 
                                                                ? 'bg-rose-500/20 text-rose-400' 
                                                                : 'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                        {isPaid ? 'پرداخت شده' : inst.dueDate < todayStr ? 'معوق شده' : 'در انتظار'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {!isPaid ? (
                                                        <button 
                                                            onClick={() => {
                                                                payLoanInstallment(inst.id);
                                                                addNotification('success', 'قسط با موفقیت ثبت پرداخت شد.');
                                                            }}
                                                            className="bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                                                        >
                                                            ثبت تسویه
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-500 text-[10px] font-mono flex items-center justify-center gap-1">
                                                            <CheckCheck size={14} className="text-emerald-400" />
                                                            {toPersianDigits(inst.paidDate || '-')}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* مودال راهنمای هوشمند */}
            {showHelpModal && (
                <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3">
                            <h4 className="text-white font-black text-base flex items-center gap-2">
                                <HelpCircle className="text-teal-400" size={20} />
                                راهنمای کار با تقویم سررسید و دفترچه اقساط
                            </h4>
                            <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="text-slate-300 text-xs space-y-3 leading-relaxed">
                            <p>
                                <strong>۱. تفکیک رنگی اسناد:</strong> چک‌های دریافتی با برچسب سبز، چک‌های پرداختی با برچسب سرخ، و اقساط سررسید با برچسب نیلی متمایز شده‌اند.
                            </p>
                            <p>
                                <strong>۲. یادآورهای پیشگیرانه:</strong> هشدارهای ۳ روز آینده به صورت خودکار محاسبه شده و اسناد در آستانه سررسید را به شما یادآوری می‌کنند تا از برگشت چک یا جریمه دیرکرد اقساط جلوگیری شود.
                            </p>
                            <p>
                                <strong>۳. استخراج اکسل دفترچه اقساط:</strong> با زدن دکمه خروجی اکسل، جدول کامل سررسید، مبالغ اصل و فرع و وضعیت پرداختی‌ها در قالب استاندارد بانکی و حسابرسی تولید می‌گردد.
                            </p>
                        </div>
                        <button onClick={() => setShowHelpModal(false)} className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs">
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JalaliDueCalendar;
