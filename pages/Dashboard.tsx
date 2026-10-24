
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { formatCurrency, toPersianDigits } from '../utils';
import { 
  Bot, Calendar, BellRing, BarChart3, PackageSearch, Activity, Layers, 
  AlertCircle, TrendingUp, Clock, PlusCircle, FileText, Users, CreditCard,
  ArrowLeft, Zap, Sparkles, BookOpen
} from 'lucide-react';
import { analyzeFinancialData } from '../services/geminiService';
import { InvoiceType } from '../types';
import { CheckAlerts, CashFlowForecast, AIInsights } from '../components/SmartFeatures';
import { ExecutiveDashboard } from '../components/ExecutiveDashboard';
import { LazyRender } from '../components/LazyRender';

const Dashboard = () => {
  const { invoices, products, checks, people } = useStore();
  const [aiAnalysis, setAiAnalysis] = useState<string>('در حال آماده‌سازی تحلیل هوشمند...');
  const [loadingAi, setLoadingAi] = useState(false);

  const upcomingChecks = checks.filter(c => c.status === 'PENDING').sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  
  // یادآور فاکتورهای منقضی شده
  const overdueInvoices = useMemo(() => {
      const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
      return invoices.filter(inv => {
          if (!inv.dueDate || inv.type === InvoiceType.PROFORMA) return false;
          const isOverdue = inv.dueDate < today;
          const hasBalance = inv.finalTotal > (inv.cashAmount + inv.checkAmount);
          return isOverdue && hasBalance;
      }).slice(0, 3);
  }, [invoices]);

  const totalSales = invoices.filter(i => i.type === InvoiceType.SALE).reduce((sum, i) => sum + i.finalTotal, 0);
  const totalReceivables = checks.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + c.amount, 0);
  const inventoryValue = products.reduce((acc, p) => acc + (p.buyPrice * p.stock), 0);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-24">
      <CheckAlerts />
      <LazyRender minHeight={120} placeholderText="در حال بارگذاری تحلیل‌های هوشمند...">
        <AIInsights />
      </LazyRender>
      <LazyRender minHeight={140} placeholderText="در حال آماده‌سازی پیش‌بینی جریان نقدینگی...">
        <CashFlowForecast />
      </LazyRender>
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">پیشخوان مدیریتی</h1>
          <p className="text-slate-600 dark:text-slate-400 text-[10px] md:text-sm font-bold mt-1">خلاصه وضعیت کسب‌وکار و یادآورهای هوشمند</p>
        </div>
        <button onClick={async () => { setLoadingAi(true); const res = await analyzeFinancialData({totalSales, totalReceivables, totalPurchase: 0, totalPayables: 0}); setAiAnalysis(res); setLoadingAi(false); }} className="w-full md:w-auto bg-gradient-to-br from-purple-600 to-indigo-700 text-white px-8 py-4 rounded-[1.8rem] flex items-center justify-center gap-3 shadow-xl font-black active:scale-95 transition-all">
          <Bot size={20} className={loadingAi ? 'animate-spin' : ''} /> {loadingAi ? 'در حال تحلیل...' : 'مشاوره هوشمند AI'}
        </button>
      </header>

      {/* بخش دسترسی سریع و ثبت فوری (Quick Actions) با طراحی بزرگ و برجسته */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs md:text-sm font-black text-slate-800 dark:text-slate-200">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>دکمه‌های ثبت و عملیات سریع</span>
          </div>
          <span className="text-[11px] text-slate-500 font-bold hidden sm:inline">
            دسترسی مستقیم همراه با کلیدهای میانبر
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {/* ۱. ثبت فاکتور جدید */}
            <Link 
              to="/invoices" 
              className="bg-gradient-to-br from-teal-900/90 via-slate-900 to-slate-950 border-2 border-teal-500/40 hover:border-teal-400 rounded-3xl p-5 md:p-6 flex items-center justify-between gap-4 transition-all duration-300 group shadow-xl hover:shadow-teal-500/20 relative overflow-hidden active:scale-[0.98]"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/15 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-teal-500/25 transition-all"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-14 h-14 bg-teal-500/20 border-2 border-teal-400/50 rounded-2xl flex items-center justify-center text-teal-300 group-hover:scale-110 group-hover:bg-teal-500/30 transition-all shrink-0 shadow-lg shadow-teal-950">
                      <FileText size={28} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-white font-black text-base md:text-lg group-hover:text-teal-300 transition-colors">
                      ثبت فاکتور جدید
                    </div>
                    <div className="text-[11px] text-teal-200/80 font-bold flex items-center gap-1.5">
                      <span>فروش، پیش‌فاکتور، خرید</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 z-10 shrink-0">
                  <span className="px-2.5 py-1 bg-teal-500/20 text-teal-300 font-mono text-[10px] font-black rounded-lg border border-teal-500/30 shadow-sm">
                    Alt + 2
                  </span>
                  <ArrowLeft className="w-4 h-4 text-teal-400/60 group-hover:text-teal-300 group-hover:-translate-x-1 transition-all" />
                </div>
            </Link>

            {/* ۲. تعریف شخص / طرف‌حساب */}
            <Link 
              to="/customers" 
              className="bg-gradient-to-br from-indigo-900/90 via-slate-900 to-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 rounded-3xl p-5 md:p-6 flex items-center justify-between gap-4 transition-all duration-300 group shadow-xl hover:shadow-indigo-500/20 relative overflow-hidden active:scale-[0.98]"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-indigo-500/25 transition-all"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-14 h-14 bg-indigo-500/20 border-2 border-indigo-400/50 rounded-2xl flex items-center justify-center text-indigo-300 group-hover:scale-110 group-hover:bg-indigo-500/30 transition-all shrink-0 shadow-lg shadow-indigo-950">
                      <Users size={28} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-white font-black text-base md:text-lg group-hover:text-indigo-300 transition-colors">
                      تعریف شخص/شرکت
                    </div>
                    <div className="text-[11px] text-indigo-200/80 font-bold flex items-center gap-1.5">
                      <span>مشتری، تأمین‌کننده، ویزیتور</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 z-10 shrink-0">
                  <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black rounded-lg border border-indigo-500/30 shadow-sm">
                    Alt + 6
                  </span>
                  <ArrowLeft className="w-4 h-4 text-indigo-400/60 group-hover:text-indigo-300 group-hover:-translate-x-1 transition-all" />
                </div>
            </Link>

            {/* ۳. ثبت سند حسابداری دوبل */}
            <Link 
              to="/accounting" 
              className="bg-gradient-to-br from-amber-900/90 via-slate-900 to-slate-950 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 md:p-6 flex items-center justify-between gap-4 transition-all duration-300 group shadow-xl hover:shadow-amber-500/20 relative overflow-hidden active:scale-[0.98]"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-amber-500/25 transition-all"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-14 h-14 bg-amber-500/20 border-2 border-amber-400/50 rounded-2xl flex items-center justify-center text-amber-300 group-hover:scale-110 group-hover:bg-amber-500/30 transition-all shrink-0 shadow-lg shadow-amber-950">
                      <BookOpen size={28} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-white font-black text-base md:text-lg group-hover:text-amber-300 transition-colors">
                      ثبت سند دوبل
                    </div>
                    <div className="text-[11px] text-amber-200/80 font-bold flex items-center gap-1.5">
                      <span>سند حسابداری، بدهکار/بستانکار</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 z-10 shrink-0">
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black rounded-lg border border-amber-500/30 shadow-sm">
                    سند دوبل
                  </span>
                  <ArrowLeft className="w-4 h-4 text-amber-400/60 group-hover:text-amber-300 group-hover:-translate-x-1 transition-all" />
                </div>
            </Link>

            {/* ۴. ثبت چک صیادی و خزانه‌داری */}
            <Link 
              to="/checks" 
              className="bg-gradient-to-br from-rose-900/90 via-slate-900 to-slate-950 border-2 border-rose-500/40 hover:border-rose-400 rounded-3xl p-5 md:p-6 flex items-center justify-between gap-4 transition-all duration-300 group shadow-xl hover:shadow-rose-500/20 relative overflow-hidden active:scale-[0.98]"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/15 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-rose-500/25 transition-all"></div>
                <div className="flex items-center gap-4 z-10">
                  <div className="w-14 h-14 bg-rose-500/20 border-2 border-rose-400/50 rounded-2xl flex items-center justify-center text-rose-300 group-hover:scale-110 group-hover:bg-rose-500/30 transition-all shrink-0 shadow-lg shadow-rose-950">
                      <CreditCard size={28} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-white font-black text-base md:text-lg group-hover:text-rose-300 transition-colors">
                      ثبت چک صیادی
                    </div>
                    <div className="text-[11px] text-rose-200/80 font-bold flex items-center gap-1.5">
                      <span>شناسه ۱۶ رقمی صیاد، سررسید</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 z-10 shrink-0">
                  <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 font-mono text-[10px] font-black rounded-lg border border-rose-500/30 shadow-sm">
                    Alt + 4
                  </span>
                  <ArrowLeft className="w-4 h-4 text-rose-400/60 group-hover:text-rose-300 group-hover:-translate-x-1 transition-all" />
                </div>
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <OverviewCard title="مجموع سرمایه انبار" value={inventoryValue} icon={PackageSearch} color="blue" />
          <OverviewCard title="مطالبات سررسید نشده" value={totalReceivables} icon={BarChart3} color="amber" />
          <OverviewCard title="تراز کل اشخاص" value={people.reduce((a,p)=>a+p.balance,0)} icon={Layers} color="rose" />
          <OverviewCard title="مجموع فروش (نقدی/چک)" value={totalSales} icon={Activity} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <h3 className="text-slate-900 dark:text-white font-black text-sm md:text-xl mb-6 flex items-center gap-3 relative z-10"><AlertCircle className="text-rose-500" size={18}/> فاکتورهای معوقه (یادآور تسویه)</h3>
              <div className="space-y-3 relative z-10">
                  {overdueInvoices.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center p-4 md:p-5 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-black/30 transition-all">
                          <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0"><Clock size={18}/></div>
                              <div>
                                  <div className="text-slate-900 dark:text-white font-black text-xs md:text-sm mb-1">{inv.personName}</div>
                                  <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md w-fit">سررسید: {toPersianDigits(inv.dueDate)}</div>
                              </div>
                          </div>
                          <div className="text-left">
                              <div className="text-rose-600 dark:text-rose-400 font-mono font-black text-sm md:text-base">{formatCurrency(inv.finalTotal - (inv.cashAmount + inv.checkAmount))}</div>
                              <div className="text-[9px] text-slate-500 font-black mt-1">مانده حساب</div>
                          </div>
                      </div>
                  ))}
                  {overdueInvoices.length === 0 && <div className="text-center py-10 text-slate-500 dark:text-slate-400 font-bold text-xs italic bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">خوشبختانه فاکتور معوقه‌ای یافت نشد.</div>}
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-2xl flex flex-col relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
              <h3 className="text-slate-900 dark:text-white font-black text-sm md:text-xl mb-6 flex items-center gap-3 relative z-10"><TrendingUp className="text-emerald-500 dark:text-emerald-400" size={18}/> چک‌های در جریان</h3>
              <div className="space-y-3 flex-1 relative z-10">
                  {upcomingChecks.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-black/30 transition-all">
                          <div>
                              <div className="text-slate-900 dark:text-white font-black text-xs mb-1">{c.bankName}</div>
                              <div className="text-[9px] text-slate-500">{toPersianDigits(c.dueDate)}</div>
                          </div>
                          <div className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-sm">{formatCurrency(c.amount)}</div>
                      </div>
                  ))}
                  {upcomingChecks.length === 0 && <div className="text-center py-10 text-slate-500 dark:text-slate-400 font-bold text-xs italic bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">چکی برای روزهای آینده ثبت نشده است.</div>}
              </div>
          </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none"></div>
          <h3 className="text-slate-900 dark:text-white font-black text-xl mb-6 flex items-center gap-3 relative z-10"><Bot className="text-purple-600 dark:text-purple-400" size={24}/> مشاوره هوشمند مالی</h3>
          <p className="text-slate-700 dark:text-slate-300 leading-8 text-sm italic bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5 relative z-10">{aiAnalysis}</p>
      </div>
      
      <LazyRender minHeight={380} placeholderText="در حال بارگذاری شاخص‌های کلیدی و داشبورد تفصیلی مدیران...">
        <ExecutiveDashboard />
      </LazyRender>
    </div>
  );
};

const OverviewCard = ({ title, value, icon: Icon, color }: any) => {
    const colors: any = {
        emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-sm',
        blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-sm',
        amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-sm',
        rose: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-sm',
    };
    return (
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md p-5 md:p-7 rounded-[2rem] md:rounded-[2.8rem] border border-slate-200 dark:border-white/5 flex flex-col gap-3 md:gap-6 group hover:-translate-y-1 transition-all shadow-md hover:shadow-lg dark:shadow-xl dark:hover:shadow-2xl">
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl md:rounded-3xl flex items-center justify-center border transition-transform group-hover:scale-110 group-hover:rotate-3 ${colors[color]}`}><Icon size={20} className="md:w-7 md:h-7" /></div>
            <div>
                <span className="text-slate-600 dark:text-slate-400 text-[9px] md:text-xs font-black uppercase tracking-widest block mb-1">{title}</span>
                <div className="text-sm md:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tighter truncate">{formatCurrency(value)}</div>
            </div>
        </div>
    );
};

export default Dashboard;
