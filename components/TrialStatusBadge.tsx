// Trial & License Status Badge for Top Bar / Header
import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Users, FileText, Lock } from 'lucide-react';
import { useStore } from '../store';
import { licenseQuotaService, MAX_TRIAL_CUSTOMERS, MAX_TRIAL_DOCUMENTS } from '../services/licenseQuotaService';

export const TrialStatusBadge: React.FC = () => {
    const customerCount = useStore(state => state.people.length);
    const documentCount = useStore(state => 
        state.invoices.length + state.vouchers.length + state.transactions.length + state.checks.length
    );
    const [isLicensed, setIsLicensed] = useState(() => licenseQuotaService.isFullyLicensedSync());

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

    if (isLicensed) {
        return (
            <div 
                id="license-status-badge-active"
                className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shadow-xs"
                title="نرم‌افزار با لایسنس تجاری فعال است"
            >
                <ShieldCheck className="w-3 h-3" />
                <span>نسخه تجاری فعال</span>
            </div>
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
