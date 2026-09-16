// Desktop Initial Setup & Onboarding Wizard (تنظیمات اولیه راه‌اندازی نسخه مستقل و دسکتاپ)
// اجرای کاملاً خام و آفلاین با قابلیت انتخاب مسیر ذخیره‌سازی داده‌ها و سال مالی
import React, { useState, useEffect } from 'react';
import { 
    Folder, 
    HardDrive, 
    Sparkles, 
    CheckCircle2, 
    Building2, 
    Calendar, 
    Coins, 
    ShieldCheck, 
    ArrowLeft, 
    ArrowRight, 
    Info, 
    WifiOff, 
    Laptop,
    KeyRound
} from 'lucide-react';
import { useStore } from '../store';
import { hardwareIdService } from '../services/hardwareIdService';

interface DesktopSetupWizardProps {
    isOpen?: boolean;
    onComplete?: () => void;
}

export const DesktopSetupWizard: React.FC<DesktopSetupWizardProps> = ({
    isOpen = true,
    onComplete
}) => {
    const { companies, updateCompany, updateConfig } = useStore();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [hwid, setHwid] = useState<string>('');
    const [isDesktop, setIsDesktop] = useState<boolean>(false);

    // مقادیر فرم
    const [companyName, setCompanyName] = useState('فروشگاه و دفتر بازرگانی من');
    const [fiscalYear, setFiscalYear] = useState('1404');
    const [currency, setCurrency] = useState<'تومان' | 'ریال'>('تومان');
    const [dataPath, setDataPath] = useState('C:\\Users\\AppData\\Roaming\\AshkeGhalam');
    const [enableAutoBackup, setEnableAutoBackup] = useState(true);

    useEffect(() => {
        const init = async () => {
            const devInfo = await hardwareIdService.getDeviceInfo();
            setHwid(devInfo.hwid);
            setIsDesktop(devInfo.isDesktop);

            // دریافت مسیر پیش‌فرض کاربر در ویندوز
            if (typeof window !== 'undefined') {
                const desktopApi = (window as any).electronDesktopAPI;
                if (desktopApi && typeof desktopApi.getUserDataPath === 'function') {
                    try {
                        const path = await desktopApi.getUserDataPath();
                        if (path) setDataPath(path);
                    } catch (e) {
                        console.warn(e);
                    }
                }
            }
        };
        init();
    }, []);

    const handleSelectCustomFolder = async () => {
        if (typeof window !== 'undefined') {
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                try {
                    const selected = await desktopApi.invoke('select-directory');
                    if (selected) {
                        setDataPath(selected);
                    }
                } catch (e) {
                    console.warn('Directory selection dialog error:', e);
                }
            }
        }
    };

    const handleFinishSetup = () => {
        // ذخیره نام و مشخصات شرکت
        const activeComp = companies.find(c => c.isActive) || companies[0];
        if (activeComp) {
            updateCompany(activeComp.id, {
                name: companyName.trim() || 'فروشگاه بازرگانی'
            });
        }
        updateConfig({
            fiscalYear: fiscalYear.trim() || '1404',
            currency: currency === 'تومان' ? 'TOMAN' : 'RIAL'
        });

        // ذخیره مسیر ذخیره‌سازی داده‌ها و تنظیمات راه‌اندازی اولیه
        if (typeof window !== 'undefined') {
            localStorage.setItem('ashk_initial_setup_done', 'true');
            localStorage.setItem('ashk_custom_data_path', dataPath);
            localStorage.setItem('ashk_company_name', companyName);
            localStorage.setItem('ashk_fiscal_year', fiscalYear);
            localStorage.setItem('ashk_currency', currency);
            localStorage.setItem('ashk_auto_backup_enabled', enableAutoBackup ? 'true' : 'false');
            
            const desktopApi = (window as any).electronDesktopAPI;
            if (desktopApi && typeof desktopApi.invoke === 'function') {
                desktopApi.invoke('set-data-path', dataPath).catch(() => {});
            }
        }

        if (onComplete) {
            onComplete();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl dir-rtl text-right font-sans animate-fade-in">
            <div id="desktop-setup-wizard-card" className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-900/60 via-slate-900 to-emerald-900/40 p-6 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-inner">
                            <Laptop className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white">راه‌اندازی اولیه نسخه دسکتاپ اشک قلم</h2>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    <WifiOff className="w-3 h-3" />
                                    ۱۰۰٪ آفلاین و مستقل
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">پیکربندی هوشمند دیتابیس محلی، مسیر ذخیره‌سازی و اطلاعات کسب‌وکار</p>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
                        <span className="text-xs font-bold text-teal-400 font-mono">گام {step} از ۳</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-slate-800">
                    <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${(step / 3) * 100}%` }}
                    ></div>
                </div>

                {/* Body Content */}
                <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-slate-200">

                    {/* STEP 1: خوش‌آمدگویی و استقلال داده‌ها */}
                    {step === 1 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex items-start gap-4">
                                <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl mt-1">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-sm font-bold text-white">نرم‌افزار کاملاً خام و بدون وابستگی</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        این برنامه به صورت کاملاً مستقل روی این رایانه نصب شده است. تمامی اسناد حسابداری، فاکتورها و اطلاعات مشتریان شما روی هارد دیسک همین رایانه ذخیره شده و هیچ نیازی به اتصال به اینترنت وجود ندارد.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/20 p-5 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                    <Sparkles className="w-4 h-4" />
                                    <span>سقف استفاده از نسخه پایه و مستقل:</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                                        <div className="text-2xl font-black text-amber-400 font-mono">۲۰</div>
                                        <div className="text-xs text-slate-400 mt-1">طرف حساب و مشتری</div>
                                    </div>
                                    <div className="grid grid-cols-1 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                                        <div className="text-2xl font-black text-amber-400 font-mono">۲۰۰</div>
                                        <div className="text-xs text-slate-400 mt-1">سند مالی و فاکتور</div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                                    شما می‌توانید تا ۲۰ مشتری و ۲۰۰ سند حسابداری را کاملاً رایگان ثبت و تست نمایید. پس از آن برای ادامه کار، کافیست با پشتیبانی تماس گرفته و لایسنس دائمی خود را دریافت کنید.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                                <span>شناسه سخت‌افزاری دستگاه (HWID):</span>
                                <span className="font-mono font-bold text-teal-300">{hwid || 'در حال آماده‌سازی...'}</span>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: اطلاعات کسب‌وکار و سال مالی */}
                    {step === 2 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-teal-400" />
                                    نام فروشگاه، شرکت یا شخص حسابدار:
                                </label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    placeholder="مثال: بازرگانی اشک قلم"
                                    className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl p-3.5 text-white outline-none focus:border-teal-500 text-sm transition"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-teal-400" />
                                        سال مالی آغازین:
                                    </label>
                                    <input
                                        type="text"
                                        value={fiscalYear}
                                        onChange={e => setFiscalYear(e.target.value)}
                                        placeholder="۱۴۰۴"
                                        className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl p-3.5 text-white outline-none focus:border-teal-500 font-mono text-sm transition"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-teal-400" />
                                        واحد پول پیش‌فرض:
                                    </label>
                                    <select
                                        value={currency}
                                        onChange={e => setCurrency(e.target.value as any)}
                                        className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl p-3.5 text-white outline-none focus:border-teal-500 text-sm transition cursor-pointer"
                                    >
                                        <option value="تومان">تومان (پیشنهادی)</option>
                                        <option value="ریال">ریال</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs text-slate-400 leading-relaxed flex items-start gap-3">
                                <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                                <span>تمام سربرگ‌ها، فاکتورهای فروش و پرینت‌ها بر اساس نام کسب‌وکار و واحد پولی که اینجا تعیین می‌کنید تنظیم خواهند شد.</span>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: مسیر ذخیره‌سازی داده‌ها (Data Directory) */}
                    {step === 3 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <HardDrive className="w-4 h-4 text-teal-400" />
                                    محل ذخیره‌سازی فایل‌های دیتابیس و پشتیبان‌ها روی هارد دیسک:
                                </label>
                                
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={dataPath}
                                        onChange={e => setDataPath(e.target.value)}
                                        className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-2xl p-3.5 text-white outline-none focus:border-teal-500 font-mono text-xs transition text-left"
                                        dir="ltr"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSelectCustomFolder}
                                        className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 hover:border-teal-500/50 px-4 py-3.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-md"
                                    >
                                        <Folder className="w-4 h-4" />
                                        <span>تغییر مسیر...</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    مسیر پیش‌فرض ویندوز در پوشه امن AppData ذخیره می‌شود تا هنگام ارتقا یا حذف نصب، داده‌های مالی شما به هیچ وجه پاک نشوند.
                                </p>
                            </div>

                            {/* سوئیچ بک‌آپ خودکار */}
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex items-center justify-between cursor-pointer hover:border-slate-700 transition" onClick={() => setEnableAutoBackup(!enableAutoBackup)}>
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-white">پشتیبان‌گیری خودکار روزانه در همین پوشه</div>
                                    <div className="text-[11px] text-slate-400">یک کپی رمزگذاری شده از دیتابیس در هر بار بستن نرم‌افزار تهیه شود.</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={enableAutoBackup}
                                    onChange={e => setEnableAutoBackup(e.target.checked)}
                                    className="w-5 h-5 accent-teal-500 rounded cursor-pointer"
                                />
                            </div>

                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span>سیستم آماده ثبت اسناد و فاکتورها به صورت کاملاً مستقل و آفلاین می‌باشد.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="bg-slate-950/80 p-5 border-t border-slate-800 flex items-center justify-between">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep((step - 1) as any)}
                            className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                        >
                            <ArrowRight className="w-4 h-4" />
                            <span>مرحله قبل</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={() => setStep((step + 1) as any)}
                            className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30"
                        >
                            <span>مرحله بعد</span>
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinishSetup}
                            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>پایان راه‌اندازی و ورود به برنامه</span>
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
