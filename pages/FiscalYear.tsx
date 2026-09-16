import { useState } from 'react';
import { useStore } from '../store';
import { useFinancialStore } from '../store-financial';
import { 
  Calendar, Save, FileText, Lock, Unlock, CheckCircle2, 
  AlertTriangle, Play, Settings, RefreshCw, Layers 
} from 'lucide-react';

export default function FiscalYear() {
    const { config, updateConfig } = useStore();
    const financialStore = useFinancialStore();
    
    const [fiscalYear, setFiscalYear] = useState(config.fiscalYear || '1404');
    const [fiscalStartDate, setFiscalStartDate] = useState(config.fiscalStartDate || '1404/01/01');
    const [fiscalEndDate, setFiscalEndDate] = useState(config.fiscalEndDate || '1404/12/29');
    
    const [closingYear, setClosingYear] = useState(config.fiscalYear || '1404');
    const [openingYear, setOpeningYear] = useState(
        (parseInt(config.fiscalYear || '1404') + 1).toString()
    );
    const [prevOpeningYear, setPrevOpeningYear] = useState(config.fiscalYear || '1404');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const periods = financialStore.fiscalPeriods || [];

    const handleSaveConfig = () => {
        updateConfig({ fiscalYear, fiscalStartDate, fiscalEndDate });
        showToast('تنظیمات سال مالی با موفقیت ذخیره شد.');
    };

    const handleCloseYear = () => {
        if (confirm(`آیا از بستن سال مالی ${closingYear} اطمینان دارید؟ تمام حساب‌های موقت سود و زیانی بسته شده و دوره‌ها قفل خواهند شد.`)) {
            try {
                financialStore.closeFiscalYear(closingYear);
                showToast(`سال مالی ${closingYear} با موفقیت بسته شد.`);
            } catch (err: any) {
                alert(`خطا در بستن سال مالی: ${err.message}`);
            }
        }
    };

    const handleOpenYear = () => {
        if (confirm(`آیا از افتتاح سال مالی جدید ${openingYear} بر اساس مانده‌های سال ${prevOpeningYear} اطمینان دارید؟ سند افتتاحیه صادر خواهد شد.`)) {
            try {
                financialStore.openFiscalYear(openingYear, prevOpeningYear);
                showToast(`سال مالی ${openingYear} با موفقیت افتتاح شد و دوره‌های ۱۲گانه صادر شدند.`);
            } catch (err: any) {
                alert(`خطا در افتتاح سال مالی: ${err.message}`);
            }
        }
    };

    const handleStatusChange = (periodId: string, status: 'OPEN' | 'CLOSED' | 'LOCKED') => {
        financialStore.updateFiscalPeriodStatus(periodId, status);
        showToast('وضعیت دوره مالی با موفقیت تغییر کرد.');
    };

    const showToast = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 4000);
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12" dir="rtl">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-purple-500/20 rounded-3xl flex items-center justify-center text-purple-400 mx-auto mb-4 border border-purple-500/30 shadow-lg">
                    <Calendar size={40} />
                </div>
                <h2 className="text-3xl font-black text-white">مدیریت سال و دوره‌های مالی</h2>
                <p className="text-slate-400 text-sm mt-2">کنترل دوره‌های حسابداری، بستن سال مالی و صدور اسناد افتتاحیه</p>
            </div>

            {/* Notification Toast */}
            {successMessage && (
                <div className="fixed bottom-5 right-5 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500/30 z-50 animate-bounce">
                    <CheckCircle2 size={20} />
                    <span className="font-bold text-sm">{successMessage}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Configuration Card */}
                <div className="md:col-span-1 bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-md flex flex-col justify-between space-y-6">
                    <div>
                        <div className="flex items-center gap-2 text-purple-400 font-black mb-4">
                            <Settings size={20} />
                            <h3>تنظیم سال مالی فعال</h3>
                        </div>
                        <p className="text-slate-400 text-xs mb-4">
                            سال مالی فعال سیستم که تراکنش‌ها و اسناد جاری در بازه آن ثبت می‌شوند.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold pr-1">عنوان سال مالی</label>
                                <input 
                                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl p-3 text-white text-center text-lg font-black outline-none focus:border-purple-500" 
                                    value={fiscalYear}
                                    onChange={e => setFiscalYear(e.target.value)}
                                    placeholder="1404"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold pr-1">تاریخ شروع</label>
                                <input 
                                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl p-3 text-white text-center font-bold outline-none focus:border-purple-500" 
                                    value={fiscalStartDate}
                                    onChange={e => setFiscalStartDate(e.target.value)}
                                    placeholder="1404/01/01"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold pr-1">تاریخ پایان</label>
                                <input 
                                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl p-3 text-white text-center font-bold outline-none focus:border-purple-500" 
                                    value={fiscalEndDate}
                                    onChange={e => setFiscalEndDate(e.target.value)}
                                    placeholder="1404/12/29"
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveConfig}
                        className="w-full bg-purple-600/80 hover:bg-purple-600 text-white py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 border border-purple-500/20 shadow-md"
                    >
                        <Save size={18} />
                        ذخیره تنظیمات
                    </button>
                </div>

                {/* Closing & Opening Operations Card */}
                <div className="md:col-span-2 bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-md space-y-6">
                    
                    {/* Closing Section */}
                    <div>
                        <div className="flex items-center gap-2 text-amber-400 font-black mb-2">
                            <Lock size={20} />
                            <h3>عملیات بستن سال مالی (سند اختتامیه)</h3>
                        </div>
                        <p className="text-slate-400 text-xs mb-4">
                            حساب‌های موقت فروش (۴۱۱۰) و هزینه‌ها (۵۱۱۰، ۵۲۰۰) بسته شده و سود/زیان خالص سال مالی به حساب سود انباشته (۳۲۰۰) منتقل می‌گردد. تمامی دوره‌های مالی آن سال قفل خواهند شد.
                        </p>
                        
                        <div className="flex gap-4 items-end bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                            <div className="w-1/2 space-y-2">
                                <label className="text-xs text-slate-400 font-bold">سال مالی جهت بستن</label>
                                <input 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-center font-bold outline-none focus:border-amber-500" 
                                    value={closingYear}
                                    onChange={e => setClosingYear(e.target.value)}
                                    placeholder="1404"
                                />
                            </div>
                            <button 
                                onClick={handleCloseYear}
                                className="w-1/2 bg-amber-600/80 hover:bg-amber-600 text-white py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-2 border border-amber-500/20 shadow-md"
                            >
                                <Lock size={16} />
                                اجرای بستن سال مالی
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-white/5 my-4"></div>

                    {/* Opening Section */}
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400 font-black mb-2">
                            <Unlock size={20} />
                            <h3>عملیات افتتاح سال مالی جدید</h3>
                        </div>
                        <p className="text-slate-400 text-xs mb-4">
                            مانده حساب‌های دایمی (دارایی، بدهی، سرمایه و سود انباشته) از سال قبل محاسبه و تحت عنوان تراز افتتاحیه (سند افتتاحیه مورخ ۰۱/۰۱ سال جدید) به حساب‌های جدید منتقل می‌گردد.
                        </p>

                        <div className="grid grid-cols-3 gap-4 items-end bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold">سال مالی جدید</label>
                                <input 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-center font-bold outline-none focus:border-emerald-500" 
                                    value={openingYear}
                                    onChange={e => setOpeningYear(e.target.value)}
                                    placeholder="1405"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold">مبنا قرار دادن سال</label>
                                <input 
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-center font-bold outline-none focus:border-emerald-500" 
                                    value={prevOpeningYear}
                                    onChange={e => setPrevOpeningYear(e.target.value)}
                                    placeholder="1404"
                                />
                            </div>
                            <button 
                                onClick={handleOpenYear}
                                className="bg-emerald-600/80 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-2 border border-emerald-500/20 shadow-md"
                            >
                                <Play size={16} />
                                افتتاح سال جدید
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Periods Management */}
            <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-400 font-black">
                        <Layers size={22} />
                        <h3>مدیریت وضعیت دوره‌های مالی ماهانه</h3>
                    </div>
                    <span className="bg-sky-500/10 text-sky-400 text-xs px-3 py-1 rounded-full border border-sky-500/20 font-bold">
                        تعداد دوره‌ها: {periods.length} دوره
                    </span>
                </div>
                
                <p className="text-slate-400 text-xs">
                    تغییر وضعیت دوره‌ها به <span className="text-amber-400 font-bold">بسته (CLOSED)</span> یا <span className="text-red-400 font-bold">قفل شده (LOCKED)</span> جلوی ثبت فاکتور، چک، پرداخت یا هرگونه سند حسابداری جدید را در آن بازه زمانی خواهد گرفت.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {periods.map(p => {
                        let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        let statusLabel = 'باز (OPEN)';
                        if (p.status === 'CLOSED') {
                            statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                            statusLabel = 'بسته (CLOSED)';
                        } else if (p.status === 'LOCKED') {
                            statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                            statusLabel = 'قفل (LOCKED)';
                        }

                        return (
                            <div key={p.id} className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4 shadow-md">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-white font-black text-sm">{p.name}</h4>
                                        <p className="text-[10px] text-slate-500 mt-1">{p.startDate} الی {p.endDate}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                                        {statusLabel}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        disabled={p.status === 'OPEN'}
                                        onClick={() => handleStatusChange(p.id, 'OPEN')}
                                        className="flex-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-emerald-400 text-[10px] py-1.5 rounded-lg border border-white/5 font-bold transition-all"
                                    >
                                        فعال‌سازی
                                    </button>
                                    <button 
                                        disabled={p.status === 'CLOSED'}
                                        onClick={() => handleStatusChange(p.id, 'CLOSED')}
                                        className="flex-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-amber-400 text-[10px] py-1.5 rounded-lg border border-white/5 font-bold transition-all"
                                    >
                                        بستن
                                    </button>
                                    <button 
                                        disabled={p.status === 'LOCKED'}
                                        onClick={() => handleStatusChange(p.id, 'LOCKED')}
                                        className="flex-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-red-400 text-[10px] py-1.5 rounded-lg border border-white/5 font-bold transition-all"
                                    >
                                        قفل‌کردن
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Warnings Guide */}
            <div className="flex items-start gap-3 p-5 bg-blue-500/10 rounded-3xl border border-blue-500/20">
                <FileText className="text-blue-400 mt-0.5 flex-shrink-0" size={24} />
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                    <p className="font-black text-blue-400 text-sm">نکات ممیزی و یکپارچگی مالی سالانه:</p>
                    <p>• سیستم بستن سال مالی تمام سودهای حاصل از فروش‌ها را در مقابل هزینه‌ها تهاتر کرده و مانده نهایی را در سود انباشته ثبت می‌کند.</p>
                    <p>• پس از قفل کردن دوره‌ها، هیچ کاربر و حتی مدیری امکان ثبت سند، ویرایش فاکتور یا پاس کردن چک در آن بازه زمانی را نخواهد داشت، مگر آنکه دوره موقتاً به حالت فعال (OPEN) بازگردد.</p>
                    <p>• در صورت ایجاد تراکنش‌های جدید پس از بستن سال مالی، باید فرآیند بستن را برای اعمال اصلاحات مجدداً تکرار نمایید.</p>
                </div>
            </div>
        </div>
    );
}
