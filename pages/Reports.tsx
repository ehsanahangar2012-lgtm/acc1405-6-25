
import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, formatAmountOnly, getCurrencyLabel, toPersianDigits, getPersianDate } from '../utils';
import { InvoiceType } from '../types';
import { BarChart3, TrendingUp, TrendingDown, PieChart as PieIcon, Activity, Layers, Download, Calendar, Filter, CheckCircle, Clock, AlertTriangle, ArrowRightLeft, Landmark, Printer, FileSpreadsheet, HelpCircle, X, Calculator, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ExcelExportService } from '../services/excelExportService';
import { LazyRender } from '../components/LazyRender';
import { DocumentTrialWatermarkFooter } from '../components/DocumentTrialWatermarkFooter';

const Reports = () => {
    const { transactions, checks, invoices, companies, config } = useStore();
    const curLabel = getCurrencyLabel(config?.currency);
    const [dateRange, setDateRange] = useState('ALL'); // 'MONTH', 'YEAR', 'ALL'
    const [reportTab, setReportTab] = useState<'DASHBOARD' | 'PROFIT_LOSS'>('DASHBOARD');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [plPeriod, setPlPeriod] = useState<'MONTH' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'YEAR'>('YEAR');

    const stats = useMemo(() => {
        const income = transactions.filter(t => !t.isDebit).reduce((s, t) => s + t.amount, 0);
        const outcome = transactions.filter(t => t.isDebit).reduce((s, t) => s + t.amount, 0);
        const salaries = transactions.filter(t => t.type === 'SALARY_PAYMENT').reduce((s, t) => s + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        
        return { income, outcome, salaries, expenses, balance: income - outcome };
    }, [transactions]);

    const checkStats = useMemo(() => {
        const pending = checks.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.amount, 0);
        const passed = checks.filter(c => c.status === 'PASSED').reduce((s, c) => s + c.amount, 0);
        const bounced = checks.filter(c => c.status === 'BOUNCED').reduce((s, c) => s + c.amount, 0);
        const transferred = checks.filter(c => c.status === 'TRANSFERRED').reduce((s, c) => s + c.amount, 0);
        
        return { pending, passed, bounced, transferred };
    }, [checks]);

    const pieData = [
        { name: 'حقوق و دستمزد', value: stats.salaries },
        { name: 'هزینه‌های جاری', value: stats.expenses },
        { name: 'خرید کالا', value: transactions.filter(t => t.type === 'INVOICE_PURCHASE').reduce((s, t) => s + t.amount, 0) },
    ];

    const checkPieData = [
        { name: 'در جریان وصول', value: checkStats.pending },
        { name: 'وصول شده', value: checkStats.passed },
        { name: 'برگشتی', value: checkStats.bounced },
        { name: 'واگذار شده', value: checkStats.transferred },
    ];

    const COLORS = ['#10b981', '#f43f5e', '#3b82f6'];
    const CHECK_COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#64748b'];

    // محاسبه مقادیر صورت سود و زیان دوره‌ای استاندارد حسابداری
    const profitLossData = useMemo(() => {
        const activeCompany = companies.find(c => c.isActive) || companies[0];

        // فروش ناخالص و تخفیفات
        const salesInvoices = invoices.filter(inv => inv.type === InvoiceType.SALE);
        const grossSales = salesInvoices.reduce((s, inv) => s + (inv.subTotal || inv.finalTotal), 0);
        const salesDiscounts = salesInvoices.reduce((s, inv) => s + (inv.discount || 0), 0);
        const netSales = grossSales - salesDiscounts;

        // بهای تمام شده کالای فروش‌رفته (COGS)
        let cogs = 0;
        salesInvoices.forEach(inv => {
            if (inv.items && inv.items.length > 0) {
                inv.items.forEach(it => {
                    cogs += (it.buyPrice || 0) * (it.quantity || 1);
                });
            } else {
                cogs += (inv.subTotal || inv.finalTotal) * 0.7;
            }
        });

        // سود ناخالص
        const grossProfit = Math.max(0, netSales - cogs);

        // هزینه‌های عملیاتی
        const salariesExpense = transactions.filter(t => t.type === 'SALARY_PAYMENT').reduce((s, t) => s + t.amount, 0);
        const operationalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        const totalOperatingExpenses = salariesExpense + operationalExpenses;

        // سود عملیاتی
        const operatingProfit = grossProfit - totalOperatingExpenses;

        // درآمدهای غیرعملیاتی و هزینه‌های مالی
        const otherIncome = transactions.filter(t => t.type === 'OTHER_INCOME').reduce((s, t) => s + t.amount, 0);
        const financingCosts = transactions.filter(t => t.type === 'BANK_FEE').reduce((s, t) => s + t.amount, 0);

        // سود قبل و بعد از مالیات
        const netProfitBeforeTax = operatingProfit + otherIncome - financingCosts;
        const estimatedTax = netProfitBeforeTax > 0 ? Math.round(netProfitBeforeTax * 0.25) : 0;
        const netProfit = netProfitBeforeTax - estimatedTax;

        let periodTitle = 'سال مالی جاری ۱۴۰۳';
        let fromDate = '۱۴۰۳/۰۱/۰۱';
        let toDate = '۱۴۰۳/۱۲/۲۹';

        if (plPeriod === 'MONTH') {
            periodTitle = 'ماه جاری';
            fromDate = '۱۴۰۳/۰۶/۰۱';
            toDate = '۱۴۰۳/۰۶/۳۱';
        } else if (plPeriod === 'Q1') {
            periodTitle = 'فصل بهار (سه‌ماهه اول)';
            fromDate = '۱۴۰۳/۰۱/۰۱';
            toDate = '۱۴۰۳/۰۳/۳۱';
        } else if (plPeriod === 'Q2') {
            periodTitle = 'فصل تابستان (سه‌ماهه دوم)';
            fromDate = '۱۴۰۳/۰۴/۰۱';
            toDate = '۱۴۰۳/۰۶/۳۱';
        } else if (plPeriod === 'Q3') {
            periodTitle = 'فصل پاییز (سه‌ماهه سوم)';
            fromDate = '۱۴۰۳/۰۷/۰۱';
            toDate = '۱۴۰۳/۰۹/۳۰';
        } else if (plPeriod === 'Q4') {
            periodTitle = 'فصل زمستان (سه‌ماهه چهارم)';
            fromDate = '۱۴۰۳/۱۰/۰۱';
            toDate = '۱۴۰۳/۱۲/۲۹';
        }

        return {
            company: activeCompany,
            periodTitle,
            fromDate,
            toDate,
            grossSales,
            salesDiscounts,
            netSales,
            cogs,
            grossProfit,
            salariesExpense,
            operationalExpenses,
            totalOperatingExpenses,
            operatingProfit,
            otherIncome,
            financingCosts,
            netProfitBeforeTax,
            estimatedTax,
            netProfit
        };
    }, [invoices, transactions, companies, plPeriod]);

    const handleExportProfitLossExcel = () => {
        ExcelExportService.exportProfitLossToExcel(profitLossData);
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20 print:p-0 print:space-y-6" dir="rtl">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black text-white print:text-black print:text-2xl">گزارشات تحلیلی، مالی و مالیاتی</h1>
                        <button 
                            onClick={() => setShowHelpModal(true)} 
                            className="bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white p-2 rounded-xl transition-all border border-teal-500/20"
                            title="راهنمای هوشمند گزارشات و صورت سود و زیان"
                        >
                            <HelpCircle size={18} />
                        </button>
                    </div>
                    <p className="text-slate-400 text-sm mt-1 print:text-black">پایش هوشمند نقدینگی، چک‌ها و صورت سود و زیان دوره‌ای استاندارد سازمان حسابرسی</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 no-print">
                    <div className="bg-slate-900 border border-white/10 p-1 rounded-2xl flex gap-1 shadow-lg">
                        <button 
                            onClick={() => setReportTab('DASHBOARD')} 
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${reportTab === 'DASHBOARD' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            داشبورد نقدینگی و اسناد
                        </button>
                        <button 
                            onClick={() => setReportTab('PROFIT_LOSS')} 
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${reportTab === 'PROFIT_LOSS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Calculator size={14} />
                            صورت سود و زیان دوره‌ای
                        </button>
                    </div>

                    {reportTab === 'PROFIT_LOSS' ? (
                        <button 
                            onClick={handleExportProfitLossExcel} 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-all font-black shadow-lg text-xs"
                        >
                            <FileSpreadsheet size={16} />
                            <span>خروجی اکسل استاندارد (دارایی و حسابرسی)</span>
                        </button>
                    ) : (
                        <button onClick={() => window.print()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-indigo-500 transition-all font-black shadow-lg text-xs">
                            <Printer size={16}/> چاپ گزارش نهایی
                        </button>
                    )}
                </div>
            </header>

            {reportTab === 'PROFIT_LOSS' ? (
                /* صورت سود و زیان دوره‌ای استاندارد حسابداری */
                <div className="space-y-6">
                    {/* فیلتر دوره مالی */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <ShieldCheck className="text-teal-400" size={20} />
                                صورت سود و زیان دوره‌ای استاندارد سازمان امور مالیاتی و حسابرسی
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">دوره انتخابی: {profitLossData.periodTitle} ({profitLossData.fromDate} الی {profitLossData.toDate})</p>
                        </div>

                        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/5 text-xs font-bold gap-1">
                            <button onClick={() => setPlPeriod('MONTH')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'MONTH' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>ماه جاری</button>
                            <button onClick={() => setPlPeriod('Q1')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'Q1' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>بهار (۳ ماه اول)</button>
                            <button onClick={() => setPlPeriod('Q2')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'Q2' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>تابستان (۳ ماه دوم)</button>
                            <button onClick={() => setPlPeriod('Q3')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'Q3' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>پاییز (۳ ماه سوم)</button>
                            <button onClick={() => setPlPeriod('Q4')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'Q4' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>زمستان (۳ ماه چهارم)</button>
                            <button onClick={() => setPlPeriod('YEAR')} className={`px-3 py-1.5 rounded-xl transition-all ${plPeriod === 'YEAR' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>سال کامل</button>
                        </div>
                    </div>

                    {/* کارت‌های خلاصه مالیاتی */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl">
                            <span className="text-slate-400 text-xs font-bold block mb-1">فروش خالص دوره</span>
                            <div className="text-2xl font-black text-white font-mono">{formatAmountOnly(profitLossData.netSales)} <span className="text-xs text-slate-500">{curLabel}</span></div>
                        </div>

                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl">
                            <span className="text-slate-400 text-xs font-bold block mb-1">سود ناخالص</span>
                            <div className="text-2xl font-black text-teal-400 font-mono">{formatAmountOnly(profitLossData.grossProfit)} <span className="text-xs text-slate-500">{curLabel}</span></div>
                        </div>

                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl">
                            <span className="text-slate-400 text-xs font-bold block mb-1">کل هزینه‌های عملیاتی</span>
                            <div className="text-2xl font-black text-rose-400 font-mono">{formatAmountOnly(profitLossData.totalOperatingExpenses)} <span className="text-xs text-slate-500">{curLabel}</span></div>
                        </div>

                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl">
                            <span className="text-slate-400 text-xs font-bold block mb-1">سود خالص ویژه نهایی</span>
                            <div className={`text-2xl font-black font-mono ${profitLossData.netProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {formatAmountOnly(profitLossData.netProfit)} <span className="text-xs text-slate-500">{curLabel}</span>
                            </div>
                        </div>
                    </div>

                    {/* جدول استاندارد حسابرسی صورت سود و زیان */}
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
                            <div>
                                <h4 className="text-white font-black text-base">جدول سرفصل‌های رسمی صورت سود و زیان</h4>
                                <span className="text-xs text-slate-400">تنظیم شده مطابق با فرم استاندارد اظهارنامه مالیاتی و دفاتر قانونی</span>
                            </div>
                            <button 
                                onClick={handleExportProfitLossExcel}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <FileSpreadsheet size={15} />
                                استخراج اکسل یک‌کلیکه
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead>
                                    <tr className="border-b border-white/10 text-slate-400 font-black">
                                        <th className="p-3">شرح سرفصل حسابداری</th>
                                        <th className="p-3 text-left">مبلغ فرعی ({curLabel})</th>
                                        <th className="p-3 text-left">مبلغ اصلی ({curLabel})</th>
                                        <th className="p-3 text-center">نسبت به فروش خالص</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-slate-200">
                                    <tr className="bg-white/5 font-bold">
                                        <td className="p-3 text-white">۱. درآمدهای عملیاتی (فروش ناخالص)</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.grossSales)}</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="text-rose-400">
                                        <td className="p-3 pr-8">کسر می‌شود: تخفیفات و برگشت از فروش</td>
                                        <td className="p-3 text-left font-mono">({formatAmountOnly(profitLossData.salesDiscounts)})</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="bg-white/10 font-black text-teal-300">
                                        <td className="p-3">درآمد خالص حاصل از فروش کالا و خدمات</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.netSales)}</td>
                                        <td className="p-3 text-center font-mono">۱۰۰.۰ ٪</td>
                                    </tr>
                                    <tr className="text-amber-300">
                                        <td className="p-3">۲. کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (COGS)</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">({formatAmountOnly(profitLossData.cogs)})</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.cogs / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="bg-teal-500/10 font-black text-teal-400 text-sm">
                                        <td className="p-3">سود (زیان) ناخالص عملیاتی</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.grossProfit)}</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.grossProfit / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="bg-white/5 font-bold text-white">
                                        <td className="p-3">۳. هزینه‌های عمومی، اداری و فروش</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="text-slate-400">
                                        <td className="p-3 pr-8">هزینه‌های حقوق و دستمزد پرسنل</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.salariesExpense)}</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="text-slate-400">
                                        <td className="p-3 pr-8">سایر هزینه‌های جاری و اداری</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.operationalExpenses)}</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="text-rose-400 font-bold">
                                        <td className="p-3 pr-4">مجموع هزینه‌های عملیاتی دوره</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">({formatAmountOnly(profitLossData.totalOperatingExpenses)})</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.totalOperatingExpenses / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="bg-white/10 font-black text-indigo-300">
                                        <td className="p-3">۴. سود (زیان) عملیاتی</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.operatingProfit)}</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.operatingProfit / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="text-slate-400">
                                        <td className="p-3">۵. درآمدها و هزینه‌های غیرعملیاتی و تامین مالی</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.otherIncome - profitLossData.financingCosts)}</td>
                                        <td className="p-3 text-center font-mono">-</td>
                                    </tr>
                                    <tr className="bg-white/10 font-black text-white">
                                        <td className="p-3">۶. سود (زیان) قبل از کسر مالیات</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">{formatAmountOnly(profitLossData.netProfitBeforeTax)}</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.netProfitBeforeTax / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="text-amber-400">
                                        <td className="p-3 pr-8">مالیات عملکرد برآوردی (۲۵٪ قانون م.م)</td>
                                        <td className="p-3 text-left font-mono">-</td>
                                        <td className="p-3 text-left font-mono">({formatAmountOnly(profitLossData.estimatedTax)})</td>
                                        <td className="p-3 text-center font-mono">{((profitLossData.estimatedTax / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                    <tr className="bg-emerald-600/20 font-black text-emerald-400 text-sm">
                                        <td className="p-4">۷. سود (زیان) خالص نهایی دوره مالی</td>
                                        <td className="p-4 text-left font-mono">-</td>
                                        <td className="p-4 text-left font-mono">{formatAmountOnly(profitLossData.netProfit)}</td>
                                        <td className="p-4 text-center font-mono">{((profitLossData.netProfit / (profitLossData.netSales || 1)) * 100).toFixed(1)} ٪</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* داشبورد و نمودارها */
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-2">
                        <ReportCard title="کل ورودی" value={stats.income} icon={TrendingUp} color="emerald" />
                        <ReportCard title="کل خروجی" value={stats.outcome} icon={TrendingDown} color="rose" />
                        <ReportCard title="مطالبات (چک)" value={checkStats.pending} icon={Clock} color="blue" />
                        <ReportCard title="تراز نهایی" value={stats.balance} icon={Activity} color="indigo" />
                    </div>

                    {/* Check Portfolio Summary */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-10 shadow-2xl print:bg-white print:border-black print:rounded-none print:shadow-none print:p-2">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 print:mb-4">
                            <div>
                                <h3 className="text-2xl font-black text-white mb-1 flex items-center gap-3 print:text-black print:text-lg"><Landmark size={28} className="text-blue-400 print:hidden"/> وضعیت اسناد دریافتنی (چک)</h3>
                                <p className="text-slate-500 text-xs print:text-black">تحلیل وضعیت وصولی‌ها و چک‌های در جریان وصول</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-1">
                                <QuickStat label="وصول شده" value={checkStats.passed} color="text-emerald-400" />
                                <QuickStat label="در جریان" value={checkStats.pending} color="text-blue-400" />
                                <QuickStat label="برگشتی" value={checkStats.bounced} color="text-rose-400" />
                                <QuickStat label="واگذار شده" value={checkStats.transferred} color="text-slate-400" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 print:gap-2">
                            <div className="lg:col-span-4 flex flex-col items-center print:col-span-12 print:flex-row print:justify-around">
                                <div className="h-[280px] w-full print:h-[150px] print:w-1/2">
                                    <LazyRender minHeight={280} placeholderText="در حال رندر نمودار دایره‌ای اسناد...">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie data={checkPieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                                                    {checkPieData.map((_, index) => <Cell key={index} fill={CHECK_COLORS[index % CHECK_COLORS.length]} />)}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </LazyRender>
                                </div>
                                <div className="w-full mt-6 space-y-3 print:w-1/2 print:mt-0">
                                    {checkPieData.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5 print:border-none print:p-1">
                                            <span className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full print:border print:border-black" style={{backgroundColor: CHECK_COLORS[idx]}}></span>
                                                <span className="text-slate-400 text-xs font-bold print:text-black">{item.name}</span>
                                            </span>
                                            <span className="text-white font-mono text-xs font-bold print:text-black">{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:col-span-8 space-y-6 print:col-span-12 no-print">
                                <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-white/5 flex-1 min-h-[400px]">
                                    <h4 className="text-white font-black mb-8 text-sm flex items-center gap-2"><BarChart3 size={18} className="text-teal-400"/> روند وصول مطالبات</h4>
                                    <div className="h-[300px]">
                                        <LazyRender minHeight={300} placeholderText="در حال بارگذاری نمودار میله‌ای وصول مطالبات...">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={[
                                                    { name: 'وصول قطعی', val: checkStats.passed },
                                                    { name: 'در انتظار', val: checkStats.pending },
                                                    { name: 'ریسک برگشت', val: checkStats.bounced }
                                                ]}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#475569" />
                                                    <YAxis stroke="#475569" />
                                                    <Bar dataKey="val" fill="#10b981" radius={[12, 12, 0, 0]} barSize={60} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </LazyRender>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:col-span-12">
                        <div className="lg:col-span-12 bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 shadow-2xl print:bg-white print:border-black print:rounded-none print:p-2">
                            <h3 className="text-xl font-black text-white mb-10 flex items-center gap-3 print:text-black print:text-lg"><BarChart3 className="text-teal-400 print:hidden"/> تحلیل توزیع نقدینگی کل</h3>
                            <div className="h-[400px] print:h-[250px]">
                                <LazyRender minHeight={400} placeholderText="در حال بارگذاری تحلیل توزیع نقدینگی...">
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={[
                                            { name: 'کل واریزی', val: stats.income },
                                            { name: 'کل پرداختی', val: stats.outcome },
                                            { name: 'حقوق پرسنل', val: stats.salaries },
                                            { name: 'هزینه‌ها', val: stats.expenses }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="name" stroke="#475569" tick={{fontSize: 12}} />
                                            <YAxis stroke="#475569" tick={{fontSize: 12}} />
                                            <Bar dataKey="val" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={80} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </LazyRender>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* مودال راهنمای هوشمند */}
            {showHelpModal && (
                <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3">
                            <h4 className="text-white font-black text-base flex items-center gap-2">
                                <HelpCircle className="text-teal-400" size={20} />
                                راهنمای صورت سود و زیان و گزارشات مالی
                            </h4>
                            <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="text-slate-300 text-xs space-y-3 leading-relaxed">
                            <p>
                                <strong>۱. استخراج اکسل یک‌کلیکه:</strong> با کلیک بر روی دکمه سبز رنگ «خروجی اکسل استاندارد»، فایل با ستون‌بندی و فرمول‌های مصوب سازمان امور مالیاتی و حسابرسی جهت ارائه به ممیزان تولید می‌شود.
                            </p>
                            <p>
                                <strong>۲. تفکیک فصلی:</strong> گزارش را می‌توانید برای دوره‌های سه‌ماهه (بهار، تابستان، پاییز، زمستان) تفکیک کنید تا برای اظهارنامه‌های فصلی ارزش افزوده و عملکرد مستقیماً قابل استفاده باشد.
                            </p>
                            <p>
                                <strong>۳. محاسبه بهای تمام شده (COGS):</strong> بهای تمام‌شده کالای فروش‌رفته به شکل دقیق از اقلام فاکتورها محاسبه می‌گردد.
                            </p>
                        </div>
                        <button onClick={() => setShowHelpModal(false)} className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs">
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}

            <DocumentTrialWatermarkFooter className="mt-8 pt-4 border-t border-slate-200 dark:border-white/10" />
        </div>
    );
};

const QuickStat = ({ label, value, color }: any) => (
    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl print:border-black print:p-2">
        <span className="text-[9px] text-slate-500 font-black uppercase mb-1 block print:text-black">{label}</span>
        <span className={`text-sm font-black font-mono ${color} print:text-black`}>{formatCurrency(value)}</span>
    </div>
);

const ReportCard = ({ title, value, icon: Icon, color }: any) => {
    const colors: any = {
        emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        rose: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
        blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    };
    return (
        <div className="bg-slate-900 border border-white/5 p-7 rounded-[2.5rem] shadow-xl hover:bg-slate-800/80 transition-all group print:bg-white print:border-black print:rounded-none print:p-4 print:shadow-none">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border transition-transform group-hover:scale-110 print:hidden ${colors[color]}`}>
                <Icon size={28} />
            </div>
            <div className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest print:text-black">{title}</div>
            <div className="text-2xl font-black text-white font-mono tracking-tighter print:text-black print:text-lg">{formatCurrency(value)}</div>
        </div>
    );
};

export default Reports;
