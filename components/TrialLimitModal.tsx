// Trial Limit & Support Activation Modal (دیالوگ اتمام سقف نسخه پایه و تماس با پشتیبانی جهت لایسنس)
import React, { useState, useEffect } from 'react';
import { 
    Lock, 
    ShieldAlert, 

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

    Globe,
} from 'lucide-react';
import { hardwareIdService } from '../services/hardwareIdService';
import { 
    licenseQuotaService, 
    MAX_TRIAL_CUSTOMERS, 
    MAX_TRIAL_DOCUMENTS, 
    MAX_HEMAYAT_CUSTOMERS, 
    MAX_HEMAYAT_DOCUMENTS,
    MAX_ANDROID_DEFAULT_CUSTOMERS,
    MAX_ANDROID_DEFAULT_DOCUMENTS
} from '../services/licenseQuotaService';
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
    const [statusMessage, setStatusMessage] = useState<{ type: 'error'; text: string } | null>(null);

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

    const handleActivate = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanKey = licenseKey.trim().toUpperCase();
        if (!cleanKey) {
            setStatusMessage({ type: 'error', text: 'لطفاً کلید لایسنس را وارد کنید.' });
            return;
        }

        // Legacy ACT codes depended on an embedded client secret and are intentionally disabled.
        // Delegate activation to the server-authoritative flow; this modal must not report success.
        const workspaceId = `ws_${cleanKey.replace(/[^A-Z0-9]/gi, '').toLowerCase()}`;
        setStatusMessage(null);
        window.dispatchEvent(new CustomEvent('open-activation-dashboard', {
            detail: { licenseKey: cleanKey, workspaceId }
        }));
        onClose?.();
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
                                    ? 'برای ثبت اسناد بیشتر، کلید لایسنس را در سرور مادر به‌صورت آنلاین تأیید کنید'
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

                    {/* Explain the required license-first sequence; server reachability is not a license. */}
                    {isAndroid && (
                        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                                <Globe className="w-4 h-4" />
                                <span>ابتدا لایسنس معتبر دستگاه را فعال کنید</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                اتصال به سرور به‌تنهایی محدودیت اسناد را حذف نمی‌کند. شماره لایسنس و کد فعال‌سازی اختصاصی را در فرم زیر وارد کنید؛ پس از تأیید، می‌توانید سرور را از بخش «اتصال سرور و همگام‌سازی» متصل کنید.
                            </p>
                        </div>
                    )}

                    {/* Explanatory Banner */}
                    <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
                        <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            <span>مراحل فعال‌سازی امن لایسنس:</span>
                        </div>
                        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside pr-1 leading-relaxed">
                            <li>کد اختصاصی دستگاه (HWID) زیر را با دکمه کپی بردارید.</li>
                            <li>کلید لایسنس صادرشده را در کادر زیر وارد کنید.</li>
                            <li>سرور مادر، وضعیت لایسنس، شناسه دستگاه و امضای دیجیتال را آنلاین بررسی می‌کند.</li>
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
                            <span>تأیید آنلاین کلید لایسنس:</span>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-400 font-bold">کلید لایسنس (License Key):</label>
                            <input type="text" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="ASHK-XXXX-XXXX-XXXX" autoComplete="off" className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 text-white font-mono text-xs outline-none focus:border-teal-500 text-left transition" />
                        </div>
                        {statusMessage && (
                            <div className="p-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                <Lock className="w-4 h-4" />
                                <span>{statusMessage.text}</span>
                            </div>
                        )}
                        <button type="submit" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-teal-900/30 transition flex items-center justify-center gap-2 cursor-pointer">
                            <Globe className="w-4 h-4" />
                            <span>تأیید آنلاین و فعال‌سازی</span>
                        </button>
                    </form>

                </div>

            </div>
        </div>
    );
};
