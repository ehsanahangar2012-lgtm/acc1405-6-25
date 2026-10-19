// Android Commercial Sovereignty Hub Modal (مرکز استقلال و مدیریت نسخه تجاری همراه اشک قلم)
import React, { useState, useEffect } from 'react';
import {
    ShieldCheck,
    Smartphone,
    Share2,
    HardDriveDownload,
    HardDriveUpload,
    Save,
    Check,
    Copy,
    MessageSquare,
    Send,
    HelpCircle,
    X,
    Building2,
    Phone,
    CreditCard,
    FileText,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Info,
    ExternalLink,
    Lock,
    Globe,
    RefreshCw,
    Loader2,
    Key
} from 'lucide-react';
import { useStore } from '../store';
import { androidCommercialService, BusinessProfile } from '../services/androidCommercialService';
import { licenseQuotaService, MAX_ANDROID_DEFAULT_DOCUMENTS, MAX_ANDROID_DEFAULT_CUSTOMERS } from '../services/licenseQuotaService';
import { workspaceService } from '../services/workspaceService';
import { isAndroidApp, toPersianDigits, getPersianDate, formatCurrency } from '../utils';
import { useAndroidBackButtonHandler } from '../useMobile';

interface AndroidCommercialHubModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const AndroidCommercialHubModal: React.FC<AndroidCommercialHubModalProps> = ({
    isOpen = true,
    onClose
}) => {
    useAndroidBackButtonHandler(() => {
        if (isOpen && onClose) {
            onClose();
            return true;
        }
        return false;
    }, Boolean(isOpen && onClose));

    const { people, invoices, vouchers, transactions, checks } = useStore();
    const [activeTab, setActiveTab] = useState<'status' | 'share' | 'backup' | 'guide'>('status');
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => androidCommercialService.getBusinessProfile());
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [copiedText, setCopiedText] = useState(false);
    const [activeFaq, setActiveFaq] = useState<string | null>(null);
    const [isLicensed, setIsLicensed] = useState(() => licenseQuotaService.isFullyLicensedSync());
    const [isLinking, setIsLinking] = useState(false);
    const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);
    const [targetHostUrl, setTargetHostUrl] = useState(() => localStorage.getItem('ashk_host_url') || localStorage.getItem('ashk_custom_server_url') || '');
    const [targetSyncToken, setTargetSyncToken] = useState(() => localStorage.getItem('ashk_host_sync_token') || localStorage.getItem('ashk_cloud_token') || '');
    const [targetWorkspaceId, setTargetWorkspaceId] = useState(() => workspaceService.getWorkspaceId());

    const isAndroid = isAndroidApp();
    const totalDocs = invoices.length + vouchers.length + transactions.length + checks.length;
    const totalPeople = people.length;

    useEffect(() => {
        const updateLic = () => {
            setIsLicensed(licenseQuotaService.isFullyLicensedSync());
        };
        const unsub = licenseQuotaService.subscribe(updateLic);
        if (invoices.length > 0 && !selectedInvoiceId) {
            setSelectedInvoiceId(invoices[invoices.length - 1].id);
        }
        return () => unsub();
    }, [invoices]);

    const handleConnectToServer = async () => {
        setIsLinking(true);
        setLinkSuccessMsg(null);
        try {
            const res = await androidCommercialService.connectToServer(targetHostUrl, targetSyncToken, targetWorkspaceId);
            if (res.success) {
                setIsLicensed(licenseQuotaService.isFullyLicensedSync());
                setLinkSuccessMsg(res.message);
            } else {
                alert(res.message);
            }
        } catch (_) {}
        setIsLinking(false);
    };

    const handleResetCleanDatabase = () => {
        if (window.confirm('آیا از بازنشانی کامل دیتابیس به حالت کاملاً خام محلی مطمئن هستید؟ کلیه داده‌های ناخواسته حذف و سقف پیش‌فرض ۵۰ سند فعال می‌گردد.')) {
            androidCommercialService.resetToCleanLocalDatabase();
            setIsLicensed(false);
            setLinkSuccessMsg('دیتابیس با موفقیت به حالت کاملاً خام محلی و سقف ۵۰ سند بازنشانی شد.');
        }
    };

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        androidCommercialService.saveBusinessProfile(businessProfile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
    };

    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId) || invoices[invoices.length - 1];
    const invoiceCustomer = selectedInvoice ? people.find(p => p.id === (selectedInvoice as any).personId || p.id === (selectedInvoice as any).customerId) : null;
    const invoiceItems = selectedInvoice ? (selectedInvoice as any).items || [] : [];
    const invoiceShareText = selectedInvoice 
        ? androidCommercialService.formatInvoiceText(selectedInvoice, invoiceCustomer, invoiceItems) 
        : `فاکتور فعالی یافت نشد. می‌توانید از بخش فاکتورها، فاکتور جدید صادر فرمایید.`;

    const handleCopyShareText = async () => {
        const success = await androidCommercialService.copyText(invoiceShareText);
        if (success) {
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2000);
        }
    };

    const handleExportBackup = () => {
        const storeState = useStore.getState();
        androidCommercialService.createOfflineBackupFile(storeState);
    };

    const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.data) {
                    useStore.setState(parsed.data);
                    alert('اطلاعات با موفقیت از فایل پشتیبان بازگردانی شد.');
                } else {
                    alert('ساختار فایل پشتیبان نامعتبر است.');
                }
            } catch (err) {
                alert('خطا در خواندن فایل پشتیبان.');
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md dir-rtl text-right font-sans animate-fade-in">
            <div 
                id="android-commercial-hub-card"
                className="w-full max-w-3xl bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 p-5 sm:p-6 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-white">مرکز نسخه تجاری همراه اشک قلم</h2>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    مستقل و نامحدود
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                استقلال کامل، بدون سقف ثبت سند و آماده تجاری‌سازی در بازار و محیط‌های سیار
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Smart Guide Button */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('guide')}
                            title="راهنمای هوشمند نسخه تجاری اندروید"
                            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                activeTab === 'guide'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                            }`}
                        >
                            <HelpCircle className="w-4 h-4 text-amber-400" />
                            <span className="hidden sm:inline">راهنما</span>
                        </button>

                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                                title="بستن"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 gap-2 overflow-x-auto text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setActiveTab('status')}
                        className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'status'
                                ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span>شناسنامه و تنظیمات تجاری</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('share')}
                        className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'share'
                                ? 'border-teal-400 text-teal-300 bg-teal-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Share2 className="w-4 h-4" />
                        <span>اشتراک‌گذاری فاکتور و پیام‌رسان‌ها</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('backup')}
                        className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'backup'
                                ? 'border-sky-400 text-sky-300 bg-sky-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <HardDriveDownload className="w-4 h-4" />
                        <span>استقلال داده‌ها و بکاپ آفلاین</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('guide')}
                        className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'guide'
                                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        <span>راهنمای هوشمند (؟)</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    {activeTab === 'status' && (
                        <div className="space-y-6">
                            {/* Commercial Status Card */}
                            {isLicensed ? (
                                <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5 rounded-2xl border border-emerald-500/30 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                <ShieldCheck className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                    <span>وضعیت: همراه فعال با لایسنس سرور اصلی</span>
                                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                                        نامحدود و فعال
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    متصل به مشخصات لایسنس سرور مادر • بدون سقف ثبت سند و مشتری • کارکرد ۱۰۰٪ مستقل و آفلاین
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-mono bg-slate-950/60 px-3 py-2 rounded-xl border border-white/5">
                                            <span className="text-slate-400">طرف حساب‌ها:</span>
                                            <span className="text-emerald-400 font-bold">{toPersianDigits(totalPeople)} (نامحدود)</span>
                                            <span className="text-slate-600">|</span>
                                            <span className="text-slate-400">اسناد:</span>
                                            <span className="text-emerald-400 font-bold">{toPersianDigits(totalDocs)} (نامحدود)</span>
                                        </div>
                                    </div>
                                    {linkSuccessMsg && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                                            <span>{linkSuccessMsg}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 p-5 rounded-2xl border border-amber-500/30 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                                    <Lock className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                        <span>نسخه پیش‌فرض همراه (سقف ۵۰ سند)</span>
                                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                                            نسخه محدود
                                                        </span>
                                                    </h3>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        در حالت پیش‌فرض حداکثر ۵۰ سند قابل ثبت است. جهت ثبت نامحدود، به سیستم PWA / سرور اصلی لینک کنید.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-mono bg-slate-950/60 px-3 py-2 rounded-xl border border-white/5">
                                                <span className="text-slate-400">اسناد ثبت‌شده:</span>
                                                <span className={`font-bold ${totalDocs >= MAX_ANDROID_DEFAULT_DOCUMENTS ? 'text-rose-400' : 'text-amber-400'}`}>
                                                    {toPersianDigits(totalDocs)} / {toPersianDigits(MAX_ANDROID_DEFAULT_DOCUMENTS)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${totalDocs >= MAX_ANDROID_DEFAULT_DOCUMENTS ? 'bg-rose-500' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min(100, (totalDocs / MAX_ANDROID_DEFAULT_DOCUMENTS) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Action Card: Link to PWA / Main Server with Custom Host and Token */}
                                    <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/40 p-4 rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                                                <Globe className="w-4 h-4 text-teal-400" />
                                                <span>اتصال به سرور پس از تأیید لایسنس</span>
                                            </span>
                                            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold border border-teal-500/30">
                                                لایسنس معتبر الزامی است
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            ابتدا لایسنس دستگاه را فعال کنید. سپس شناسه فضای کاری ثبت‌شده، آدرس سرور و توکن اختصاصی را وارد کنید. اتصال موفق، به‌تنهایی سقف اسناد را حذف یا لایسنس را فعال نمی‌کند:
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                                    <Globe size={12} className="text-teal-400" />
                                                    <span>آدرس سرور مورد نظر (Host URL):</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={targetHostUrl}
                                                    onChange={(e) => setTargetHostUrl(e.target.value)}
                                                    placeholder="https://acc.yourdomain.ir"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                                    <Key size={12} className="text-amber-400" />
                                                    <span>شناسه فضای کاری (Workspace ID):</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={targetWorkspaceId}
                                                    onChange={(e) => setTargetWorkspaceId(e.target.value)}
                                                    placeholder="client_rahimi"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-amber-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                                    <Key size={12} className="text-violet-400" />
                                                    <span>توکن اختصاصی سرور:</span>
                                                </label>
                                                <input
                                                    type="password"
                                                    autoComplete="off"
                                                    value={targetSyncToken}
                                                    onChange={(e) => setTargetSyncToken(e.target.value)}
                                                    placeholder="توکن اختصاصی این مشتری"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono dir-ltr focus:outline-none focus:border-violet-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-800">
                                            <button
                                                type="button"
                                                onClick={handleConnectToServer}
                                                disabled={isLinking}
                                                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/30 disabled:opacity-50"
                                            >
                                                {isLinking ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>در حال بررسی اتصال و مجوز فضای کاری...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-4 h-4" />
                                                        <span>🔗 آزمون اتصال سرور</span>
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => window.dispatchEvent(new CustomEvent('open-activation-dashboard'))}
                                                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <span>🔑 ثبت لایسنس مستقیم</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleResetCleanDatabase}
                                                className="w-full sm:w-auto py-3 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                                                title="پاکسازی داده‌های ناخواسته و بازنشانی به دیتابیس خام محلی"
                                            >
                                                <span>🧹 بازنشانی به داده خام</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Business Profile Form */}
                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/60">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-emerald-400" />
                                        <span>مشخصات تجاری واحد صنفی / فروشگاه (درج در فاکتورها)</span>
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('guide')}
                                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        title="راهنمای تنظیمات تجاری"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        <span>راهنما؟</span>
                                    </button>
                                </div>

                                <form onSubmit={handleSaveProfile} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                                نام فروشگاه / کسب‌وکار:
                                            </label>
                                            <input
                                                type="text"
                                                value={businessProfile.companyName}
                                                onChange={e => setBusinessProfile({ ...businessProfile, companyName: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                                placeholder="مثال: بازرگانی قلم / فروشگاه اشک قلم"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                                شماره تماس / همراه فروشگاه:
                                            </label>
                                            <input
                                                type="text"
                                                value={businessProfile.phone}
                                                onChange={e => setBusinessProfile({ ...businessProfile, phone: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                                placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                                شماره کارت بانکی (جهت واریز مشتری):
                                            </label>
                                            <input
                                                type="text"
                                                value={businessProfile.cardNumber}
                                                onChange={e => setBusinessProfile({ ...businessProfile, cardNumber: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                                placeholder="۶۰۳۷-۹۹..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                                شماره شبا (IBAN):
                                            </label>
                                            <input
                                                type="text"
                                                value={businessProfile.iban}
                                                onChange={e => setBusinessProfile({ ...businessProfile, iban: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                                placeholder="IR..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">
                                            متن پانویس فاکتورها و پیام‌های ارسالی:
                                        </label>
                                        <textarea
                                            value={businessProfile.invoiceFooter}
                                            onChange={e => setBusinessProfile({ ...businessProfile, invoiceFooter: e.target.value })}
                                            rows={2}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                            placeholder="با تشکر از اعتماد شما..."
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-[11px] text-slate-400">
                                            اطلاعات به طور اختصاصی روی حافظه دستگاه ذخیره می‌گردند.
                                        </span>
                                        <button
                                            type="submit"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/40"
                                        >
                                            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                            <span>{saveSuccess ? 'ذخیره شد' : 'ذخیره مشخصات'}</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'share' && (
                        <div className="space-y-6">
                            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Share2 className="w-4 h-4 text-teal-400" />
                                        <span>اشتراک‌گذاری فاکتور در پیام‌رسان‌های بومی و پیامک مستقیم</span>
                                    </h4>
                                    {invoices.length > 0 && (
                                        <select
                                            value={selectedInvoiceId}
                                            onChange={e => setSelectedInvoiceId(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                                        >
                                            {invoices.map((inv, idx) => (
                                                <option key={inv.id} value={inv.id}>
                                                    فاکتور #{toPersianDigits(inv.number || idx + 1)} - {(inv as any).customerName || (inv as any).personName || 'مشتری'} ({toPersianDigits(formatCurrency((inv as any).finalAmount ?? (inv as any).finalTotal ?? 0))} ریال)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400 mb-4">
                                    بدون نیاز به سرور یا اینترنت خارجی، فاکتور را با یک کلیک به پیام‌رسان‌های ایرانی و بین‌المللی ارسال نمایید.
                                </p>

                                {/* Preview Card */}
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto mb-4 select-all">
                                    {invoiceShareText}
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => androidCommercialService.shareViaEitaa(invoiceShareText)}
                                        className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/30 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>ارسال به ایتا (Eitaa)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => androidCommercialService.shareViaBale(invoiceShareText)}
                                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/30 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        <span>ارسال به بله (Bale)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => androidCommercialService.shareViaRubika(invoiceShareText)}
                                        className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/30 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        <span>روبیکا (Rubika)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const custPhone = invoiceCustomer?.phone || '';
                                            androidCommercialService.shareViaSms(custPhone, invoiceShareText);
                                        }}
                                        className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-600/30 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                                    >
                                        <Phone className="w-4 h-4" />
                                        <span>پیامک مستقیم (SMS)</span>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={handleCopyShareText}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-slate-700"
                                    >
                                        {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        <span>{copiedText ? 'متن فاکتور کپی شد' : 'کپی متن فاکتور'}</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const custPhone = invoiceCustomer?.phone || '';
                                                androidCommercialService.shareViaWhatsApp(custPhone, invoiceShareText);
                                            }}
                                            className="text-xs text-emerald-400 hover:underline cursor-pointer"
                                        >
                                            واتساپ
                                        </button>
                                        <span className="text-slate-600">•</span>
                                        <button
                                            type="button"
                                            onClick={() => androidCommercialService.shareViaTelegram(invoiceShareText)}
                                            className="text-xs text-sky-400 hover:underline cursor-pointer"
                                        >
                                            تلگرام
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'backup' && (
                        <div className="space-y-6">
                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/60">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                                    <HardDriveDownload className="w-4 h-4 text-sky-400" />
                                    <span>استقلال کامل داده‌ها و پشتیبان‌گیری آفلاین در حافظه گوشی</span>
                                </h4>
                                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                                    داده‌های شما ۱۰۰٪ در پایگاه داده محلی گوشی قرار دارد. بدون نیاز به اینترنت و بدون کوچک‌ترین ریسک، با یک کلیک نسخه پشتیبان کامل را دانلود و نگه‌داری نمایید.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Export Card */}
                                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                                                <HardDriveDownload className="w-4 h-4 text-emerald-400" />
                                                <span>خروجی فایل پشتیبان (Backup)</span>
                                            </h5>
                                            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                                                شامل کلیه فاکتورها، انبار، چک‌ها، مانده حساب‌ها و مشتریان با برچسب نسخه ۱۶.۲۵.۰ و تاریخ شمسی.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleExportBackup}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/40"
                                        >
                                            <HardDriveDownload className="w-4 h-4" />
                                            <span>دانلود فایل پشتیبان آفلاین</span>
                                        </button>
                                    </div>

                                    {/* Import Card */}
                                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                                                <HardDriveUpload className="w-4 h-4 text-sky-400" />
                                                <span>بازیابی اطلاعات از فایل پشتیبان (Restore)</span>
                                            </h5>
                                            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                                                جهت انتقال اطلاعات به دستگاه جدید یا بازگردانی فایل‌های پشتیبان قبلی بدون نیاز به شبکه.
                                            </p>
                                        </div>
                                        <label className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-sky-950/40 text-center">
                                            <HardDriveUpload className="w-4 h-4" />
                                            <span>انتخاب فایل و بازیابی</span>
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleImportBackup}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'guide' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <HelpCircle className="w-4 h-4 text-amber-400" />
                                    <span>راهنمای هوشمند نسخه تجاری و استقلال پلتفرم اندروید</span>
                                </h4>
                                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">
                                    پاسخ‌های درون‌برنامه‌ای آفلاین
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {androidCommercialService.getOfflineKnowledgeBase().map(faq => {
                                    const isOpenFaq = activeFaq === faq.id;
                                    return (
                                        <div
                                            key={faq.id}
                                            className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setActiveFaq(isOpenFaq ? null : faq.id)}
                                                className="w-full p-3.5 text-right flex items-center justify-between text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] shrink-0 font-bold">
                                                        ؟
                                                    </span>
                                                    <span>{faq.question}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-mono">
                                                    {isOpenFaq ? '−' : '+'}
                                                </span>
                                            </button>
                                            {isOpenFaq && (
                                                <div className="px-4 pb-3.5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-950/40">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="font-bold text-slate-300">نسخه ۱۶.۲۵.۰ تجاری همراه</span>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <span className="text-slate-500 hidden sm:inline">موتور محاسباتی محلی ۱۰۰٪ آفلاین</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs"
                        >
                            بستن پنجره
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
