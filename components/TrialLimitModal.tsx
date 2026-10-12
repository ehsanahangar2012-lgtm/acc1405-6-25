// Trial Limit & Support Activation Modal (دیالوگ اتمام سقف نسخه پایه و تماس با پشتیبانی جهت لایسنس)
import React, { useState, useEffect } from 'react';
import { 
    Lock, 
    ShieldAlert, 
    CheckCircle2, 
    Copy, 
    Check, 
    PhoneCall, 
    MessageSquare, 
    Send, 
    KeyRound, 
    HelpCircle, 
    X, 
    Sparkles, 
    Users, 
    FileText,
    Loader2,
    Globe,
    RefreshCw
} from 'lucide-react';
import { hardwareIdService } from '../services/hardwareIdService';
import { licenseGeneratorService } from '../services/licenseGeneratorService';
import { 
    licenseQuotaService, 
    MAX_TRIAL_CUSTOMERS, 
    MAX_TRIAL_DOCUMENTS, 
    MAX_HEMAYAT_CUSTOMERS, 
    MAX_HEMAYAT_DOCUMENTS,
    MAX_ANDROID_DEFAULT_CUSTOMERS,
    MAX_ANDROID_DEFAULT_DOCUMENTS
} from '../services/licenseQuotaService';
import { androidCommercialService } from '../services/androidCommercialService';
import { isAndroidApp } from '../utils';
import { useStore } from '../store';

interface TrialLimitModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    reason?: 'CUSTOMERS_LIMIT' | 'DOCUMENTS_LIMIT' | 'MANUAL';
}

export const TrialLimitModal: React.FC<TrialLimitModalProps> = ({
    isOpen = true,
    onClose,
    reason = 'MANUAL'
}) => {
    const { people, invoices, vouchers, transactions, checks } = useStore();
    const [hwid, setHwid] = useState('');
    const [copiedHwid, setCopiedHwid] = useState(false);
    const [licenseKey, setLicenseKey] = useState('');
    const [activationCode, setActivationCode] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [isLinkingPwa, setIsLinkingPwa] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isAndroid = isAndroidApp();
    const customerCount = people.length;
    const documentCount = invoices.length + vouchers.length + transactions.length + checks.length;
    const isHemayat = licenseQuotaService.getCurrentPlan() === 'HEMAYAT';
    
    const maxCust = isAndroid ? MAX_ANDROID_DEFAULT_CUSTOMERS : (isHemayat ? MAX_HEMAYAT_CUSTOMERS : MAX_TRIAL_CUSTOMERS);
    const maxDoc = isAndroid ? MAX_ANDROID_DEFAULT_DOCUMENTS : (isHemayat ? MAX_HEMAYAT_DOCUMENTS : MAX_TRIAL_DOCUMENTS);

    useEffect(() => {
        hardwareIdService.getHardwareId().then(setHwid);
    }, []);

    const handleCopyHwid = () => {
        if (!hwid) return;
        navigator.clipboard.writeText(hwid);
        setCopiedHwid(true);
        setTimeout(() => setCopiedHwid(false), 2000);
    };

    const handleLinkPwaAndActivate = async () => {
        setIsLinkingPwa(true);
        setStatusMessage(null);
        try {
            const result = await androidCommercialService.linkToPwaAndActivate();
            if (result.success) {
                setStatusMessage({ type: 'success', text: result.message });
                setTimeout(() => {
                    if (onClose) onClose();
                }, 1600);
            } else {
                setStatusMessage({ type: 'error', text: result.message });
            }
        } catch (e: any) {
            setStatusMessage({ type: 'error', text: 'خطا در برقراری ارتباط با PWA و هاست سرور' });
        } finally {
            setIsLinkingPwa(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim() || !activationCode.trim()) {
            setStatusMessage({ type: 'error', text: 'لطفاً شماره لایسنس و کد فعال‌سازی را کامل وارد کنید.' });
            return;
        }

        setIsActivating(true);
        setStatusMessage(null);

        const result = await licenseGeneratorService.applyLicenseToCurrentDevice(licenseKey.trim(), activationCode.trim());

        setIsActivating(false);
        if (result.success) {
            setStatusMessage({ type: 'success', text: result.message });
            setTimeout(() => {
                if (onClose) onClose();
            }, 1800);
        } else {
            setStatusMessage({ type: 'error', text: result.message });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md dir-rtl text-right font-sans animate-fade-in">
            <div id="trial-limit-modal-card" className="w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 p-6 border-b border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                            <Lock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <span>{isAndroid ? 'سقف نسخه پیش‌فرض همراه' : 'سقف نسخه پایه مستقل'}</span>
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                    {isAndroid ? 'پایان سقف ۵۰ سند' : 'پایان سهمیه آزمایشی'}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isAndroid 
                                    ? 'جهت ثبت اسناد بیشتر، با یک کلیک به سیستم PWA لینک کنید یا لایسنس را فعال فرمایید'
                                    : 'جهت ثبت نامحدود مشتریان و اسناد، لایسنس خود را فعال فرمایید'}
                            </p>
                        </div>
                    </div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
                    
                    {/* Quota Progress Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-4 rounded-2xl border ${customerCount >= maxCust ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-950/60 border-slate-800'}`}>
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-teal-400" /> مشتریان:</span>
                                <span className="font-mono font-bold">{customerCount} / {maxCust}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                                <div 
                                    className={`h-full rounded-full ${customerCount >= maxCust ? 'bg-rose-500' : 'bg-teal-500'}`}
                                    style={{ width: `${Math.min(100, (customerCount / maxCust) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-2xl border ${documentCount >= maxDoc ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-950/60 border-slate-800'}`}>
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-teal-400" /> اسناد مالی:</span>
                                <span className="font-mono font-bold">{documentCount} / {maxDoc}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                                <div 
                                    className={`h-full rounded-full ${documentCount >= maxDoc ? 'bg-rose-500' : 'bg-teal-500'}`}
                                    style={{ width: `${Math.min(100, (documentCount / maxDoc) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* PWA Link Banner for Mobile Platform */}
                    {isAndroid && (
                        <div className="bg-gradient-to-r from-teal-950/70 via-slate-900 to-slate-900 border border-teal-500/40 p-4 rounded-2xl space-y-3 shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-white flex items-center gap-1.5">
                                    <Globe className="w-4 h-4 text-teal-400" />
                                    <span>پیوند مستقیم با سیستم PWA و فعال‌سازی با لایسنس سرور اصلی</span>
                                </span>
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full font-bold border border-teal-500/30">
                                    یک‌کلیکه
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                این اپلیکیشن پلتفرم همراه سامانه PWA است. با کلیک بر روی دکمه زیر، مشخصات لایسنس فعال در سرور اصلی به صورت خودکار دریافت شده و برنامه بدون محدودیت فعال می‌گردد.
                            </p>
                            <button
                                type="button"
                                onClick={handleLinkPwaAndActivate}
                                disabled={isLinkingPwa}
                                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30 disabled:opacity-50"
                            >
                                {isLinkingPwa ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>در حال برقراری پیوند با PWA و دریافت مشخصات لایسنس سرور...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>🔗 پیوند به سیستم PWA و فعال‌سازی با لایسنس سرور اصلی</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Explanatory Banner */}
                    <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
                        <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            <span>مراحل ساده دریافت لایسنس دائمی و نامحدود:</span>
                        </div>
                        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside pr-1 leading-relaxed">
                            <li>کد اختصاصی دستگاه (HWID) زیر را با دکمه کپی بردارید.</li>
                            <li>کد را از طریق تماس یا پیام‌رسان برای پشتیبانی و صاحب اثر ارسال نمایید.</li>
                            <li>کلید لایسنس و کد فعال‌سازی دریافت‌شده را در فرم زیر وارد کرده و دکمه فعال‌سازی را بزنید.</li>
                        </ol>
                    </div>

                    {/* Hardware ID Display Box */}
                    <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-2xl space-y-2">
                        <div className="text-xs text-slate-400 flex items-center justify-between">
                            <span>کد اختصاصی این رایانه (HWID):</span>
                            <span className="text-[10px] text-teal-400">یکتا و مخصوص این سیستم</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl p-3 font-mono font-bold text-xs text-teal-300 tracking-wider text-left select-all overflow-x-auto">
                                {hwid || 'در حال محاسبه شناسه دستگاه...'}
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyHwid}
                                className="bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
                            >
                                {copiedHwid ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedHwid ? 'کپی شد' : 'کپی کد'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Contact Support Channels */}
                    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 rounded-2xl">
                        <div className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-emerald-400" />
                            <span>راه‌های ارتباط با واحد فروش و پشتیبانی لایسنس:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <a
                                href="tel:09120000000"
                                className="p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700 text-emerald-300 flex items-center gap-2 transition"
                            >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>تماس تلفنی مستقیم</span>
                            </a>
                            <a
                                href="https://web.eitaa.com/#@ashkghalamco"
                                target="_blank"
                                rel="noreferrer"
                                className="p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700 text-cyan-300 flex items-center gap-2 transition"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>پشتیبانی ایتا و تلگرام (@ashkghalamco)</span>
                            </a>
                        </div>
                    </div>

                    {/* Activation Form */}
                    <form onSubmit={handleActivate} className="space-y-4 pt-2 border-t border-slate-800">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4 text-teal-400" />
                            <span>ثبت کلید لایسنس و فعال‌سازی فوری:</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-400 font-bold">شماره لایسنس (License Key):</label>
                                <input
                                    type="text"
                                    value={licenseKey}
                                    onChange={e => setLicenseKey(e.target.value)}
                                    placeholder="ASHK-XXXX-XXXX-XXXX"
                                    className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 text-white font-mono text-xs outline-none focus:border-teal-500 text-left transition"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-400 font-bold">کد فعال‌سازی (Activation Code):</label>
                                <input
                                    type="text"
                                    value={activationCode}
                                    onChange={e => setActivationCode(e.target.value)}
                                    placeholder="ACT-XXXX-XXXX-XXXX"
                                    className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 text-white font-mono text-xs outline-none focus:border-teal-500 text-left transition"
                                />
                            </div>
                        </div>

                        {statusMessage && (
                            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                                statusMessage.type === 'success' 
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                            }`}>
                                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                <span>{statusMessage.text}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isActivating}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-teal-900/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isActivating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>در حال بررسی امضای لایسنس...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>تأیید و فعال‌سازی نامحدود نرم‌افزار</span>
                                </>
                            )}
                        </button>
                    </form>

                </div>

            </div>
        </div>
    );
};
