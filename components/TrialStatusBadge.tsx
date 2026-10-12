import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Users, FileText, Lock } from 'lucide-react';
import { useStore } from '../store';
import { licenseQuotaService, MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS } from '../services/licenseQuotaService';
import { isAndroidApp } from '../utils';

export const TrialStatusBadge: React.FC = () => {
    const customerCount = useStore(state => state.people.length);
    const documentCount = useStore(state => 
        state.invoices.length + state.vouchers.length + state.transactions.length + state.checks.length
    );
    const [isLicensed, setIsLicensed] = useState(() => licenseQuotaService.isFullyLicensedSync());
    const isAndroid = isAndroidApp();

    useEffect(() => {
        const updateStatus = () => {
            setIsLicensed(licenseQuotaService.isFullyLicensedSync());
        };
        updateStatus();
        const unsubscribe = licenseQuotaService.subscribe(updateStatus);
        window.addEventListener('storage', updateStatus);
        return () => {
            unsubscribe();
            window.removeEventListener('storage', updateStatus);
        };
    }, []);

    const handleOpenLimitModal = () => {
        window.dispatchEvent(new CustomEvent('open-trial-limit-modal', {
            detail: { reason: 'MANUAL' }
        }));
    };

    if (isAndroid) {
        if (isLicensed) {
            return (
                <button
                    type="button"
                    id="license-status-badge-android-active"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-android-commercial-hub'))}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold shadow-xs cursor-pointer hover:bg-emerald-500/25 transition"
                    title="نسخه همراه با لایسنس سرور اصلی فعال است (کلیک جهت مشاهده و مدیریت)"
                >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>همراه فعال (لایسنس سرور اصلی)</span>
                </button>
            );
        }

        return (
            <button
                type="button"
                id="license-status-badge-android-trial"
                onClick={() => window.dispatchEvent(new CustomEvent('open-android-commercial-hub'))}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold shadow-xs cursor-pointer hover:bg-amber-500/25 transition"
                title="نسخه پیش‌فرض همراه (سقف ۵۰ سند - کلیک جهت فعال‌سازی یا لینک به PWA)"
            >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>همراه ({documentCount}/۵۰ سند)</span>
            </button>
        );
    }

    if (isLicensed) {
        return (
            <button
                type="button"
                id="license-status-badge-active"
                onClick={() => window.dispatchEvent(new CustomEvent('open-activation-dashboard'))}
                className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shadow-xs cursor-pointer hover:bg-emerald-500/20 transition"
                title="نرم‌افزار با لایسنس تجاری فعال است"
            >
                <ShieldCheck className="w-3 h-3" />
                <span>نسخه تجاری فعال</span>
            </button>
        );
    }

    const isNearOrExceeded = customerCount >= (MAX_TRIAL_CUSTOMERS - 3) || documentCount >= (MAX_TRIAL_DOCUMENTS - 10);

    return (
        <button
            type="button"
            id="trial-status-badge"
            onClick={handleOpenLimitModal}
            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition shadow-xs cursor-pointer ${
                isNearOrExceeded
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 animate-pulse'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-teal-500/40'
            }`}
            title="کلیک جهت مشاهده وضعیت سهمیه و فعال‌سازی لایسنس"
        >
            <div className="flex items-center gap-1">
                {isNearOrExceeded ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Sparkles className="w-2.5 h-2.5 text-teal-400" />}
                <span>پایه:</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[9px]">
                <span className={customerCount >= MAX_TRIAL_CUSTOMERS ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {customerCount}/{MAX_TRIAL_CUSTOMERS}
                </span>
                <span>•</span>
                <span className={documentCount >= MAX_TRIAL_DOCUMENTS ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {documentCount}/{MAX_TRIAL_DOCUMENTS}
                </span>
            </div>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded">
                فعال‌سازی
            </span>
        </button>
    );
};
