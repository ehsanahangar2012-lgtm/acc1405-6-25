import React, { useState, useEffect } from 'react';
import { ShieldAlert, Download, KeyRound, AlertTriangle, HardDrive, Info, X } from 'lucide-react';
import { licenseQuotaService } from '../services/licenseQuotaService';
import { useStore } from '../store';
import { autoBackupService } from '../services/autoBackupService';

export const TrialDataProtectionWarningBanner: React.FC = () => {
    const { people, invoices, vouchers, transactions, checks } = useStore();
    const [isLicensed, setIsLicensed] = useState(licenseQuotaService.isFullyLicensedSync());
    const [currentPlan, setCurrentPlan] = useState(licenseQuotaService.getCurrentPlan());
    const [isDismissed, setIsDismissed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('ashk_trial_warning_dismissed') === 'true';
    });
    const [backupSuccess, setBackupSuccess] = useState(false);

    useEffect(() => {
        const updateStatus = () => {
            setIsLicensed(licenseQuotaService.isFullyLicensedSync());
            setCurrentPlan(licenseQuotaService.getCurrentPlan());
        };

        const unsubscribe = licenseQuotaService.subscribe(updateStatus);
        window.addEventListener('ashk-license-updated', updateStatus);

        return () => {
            unsubscribe();
            window.removeEventListener('ashk-license-updated', updateStatus);
        };
    }, []);

    // در صورتی که لایسنس تجاری نامحدود فعال باشد، بنر هشدار آزمایشی نمایش داده نمی‌شود
    const isTrialOrFree = !isLicensed || currentPlan === 'TRIAL' || currentPlan === 'HEMAYAT';
    if (!isTrialOrFree || isDismissed) return null;

    const handleDismiss = () => {
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('ashk_trial_warning_dismissed', 'true');
        }
    };

    const handleQuickBackup = async () => {
        try {
            await autoBackupService.createBackup(() => useStore.getState());
            setBackupSuccess(true);
            setTimeout(() => setBackupSuccess(false), 4000);
        } catch (e) {
            console.error('Backup trigger error:', e);
        }
    };

    const handleOpenActivation = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open-activation-dashboard'));
        }
    };

    return (
        <div 
            id="trial-data-protection-warning-banner"
            className="mb-6 w-full bg-red-600 border border-red-700 rounded-2xl shadow-xl overflow-hidden text-right no-print"
            dir="rtl"
        >
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-red-700/50">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <ShieldAlert size={22} />
                    </div>
                    <div className="overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm sm:text-base font-black text-white drop-shadow-sm">
                                اطلاعیه مهم حفاظت از داده‌ها و شرایط استفاده
                            </span>
                            <span className="text-[10px] bg-red-900/60 text-red-100 px-2 py-0.5 rounded-full border border-red-800 font-bold shadow-inner">
                                {currentPlan === 'HEMAYAT' ? 'نسخه حامی (نوپا)' : 'نسخه آزمایشی / رایگان'}
                            </span>
                        </div>
                        <p className="text-xs text-red-100 drop-shadow-sm font-medium">
                            مسئولیت نگهداری داده‌ها بر عهده کاربر است. لطفا مرتباً بکاپ بگیرید.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={handleQuickBackup}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
                        title="دانلود فایل پشتیبان داده‌ها"
                    >
                        <Download size={14} />
                        <span>{backupSuccess ? 'پشتیبان ذخیره شد ✓' : 'پشتیبان‌گیری فوری'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenActivation}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                    >
                        <KeyRound size={14} />
                        <span>ارتقا به لایسنس تجاری</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="p-2 bg-red-800/60 hover:bg-red-800 text-red-100 hover:text-white rounded-xl transition cursor-pointer flex items-center justify-center shadow-inner"
                        title="بستن هشدار"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* متن تفصیلی هشدار و بند عدم تعهد */}
            <div className="p-4 sm:p-5 bg-red-700/30 text-xs text-white leading-relaxed space-y-3">
                <div className="flex items-start gap-2.5">
                    <AlertTriangle size={17} className="text-red-200 shrink-0 mt-0.5" />
                    <p className="text-red-50 font-medium text-[13px]">
                        <strong>کاربر گرامی،</strong> با توجه به ذخیره‌سازی داده‌ها در حافظه مرورگر دستگاه در نسخه‌های رایگان و آزمایشی (بدون سرویس ابری متمرکز)، 
                        <strong className="text-white bg-red-900/40 px-1 py-0.5 rounded mx-1"> شرکت مهندسی اشک قلم هیچ‌گونه مسئولیت و تعهدی در قبال از بین رفتن، آسیب یا حذف داده‌ها</strong> ناشی از پاک شدن کش مرورگر، تغییر سیستم‌عامل یا خرابی دستگاه ندارد.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-3 border-t border-red-500/30">
                    <div className="bg-red-900/40 p-3 rounded-xl border border-red-500/20 flex items-center gap-2.5 shadow-inner">
                        <HardDrive size={18} className="text-red-200 shrink-0" />
                        <span className="text-red-50 text-xs">
                            <strong>توصیه اکید:</strong> به صورت روزانه از بخش تنظیمات یا دکمه بالا خروجی فایل پشتیبان (<code className="bg-red-950/50 px-1 py-0.5 rounded text-[10px]">.json</code>) دریافت و روی فلش یا فضای امن ذخیره کنید.
                        </span>
                    </div>

                    <div className="bg-red-900/40 p-3 rounded-xl border border-red-500/20 flex items-center gap-2.5 shadow-inner">
                        <Info size={18} className="text-red-200 shrink-0" />
                        <span className="text-red-50 text-xs">
                            برای برخورداری از مزایای ذخیره‌سازی امن، بکاپ خودکار ابری و تضمین حفظ داده‌ها، لطفاً نسبت به <button onClick={handleOpenActivation} className="underline font-bold hover:text-white cursor-pointer">ارتقاء به لایسنس تجاری (نسخه ابری)</button> اقدام فرمایید.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
