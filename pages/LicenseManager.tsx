// License Management Portal for Author & Admin (پورتال مدیریت لایسنس و صدور کد برای صاحب اثر و مدیر سیستم)
import React, { useState, useEffect } from 'react';
import { 
    KeyRound, 
    ShieldCheck, 
    Plus, 
    Search, 
    Copy, 
    Check, 
    Send, 
    Building2, 
    Calendar, 
    Phone, 
    Coins, 
    Users, 
    Award, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Download, 
    Sparkles, 
    Cpu, 
    Layers, 
    FileText, 
    Trash2, 
    RefreshCw,
    HelpCircle,
    TrendingUp,
    Cloud,
    MessageSquare,
    Receipt,
    CreditCard
} from 'lucide-react';
import { 
    licenseGeneratorService, 
    LicenseRecord, 
    LicensePlan, 
    PLAN_CONFIGS 
} from '../services/licenseGeneratorService';
import { hardwareIdService } from '../services/hardwareIdService';

const LicenseManager: React.FC = () => {
    const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'create' | 'list' | 'services'>('create');
    
    // مقادیر فرم صدور لایسنس
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientHwid, setClientHwid] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<LicensePlan>('GOLD');
    const [expireDate, setExpireDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); });
    const [pricePaid, setPricePaid] = useState<number>(PLAN_CONFIGS.GOLD.defaultPrice);
    const [notes, setNotes] = useState('');
    
    // نتیجه صدور
    const [generatedRecord, setGeneratedRecord] = useState<LicenseRecord | null>(null);
    const [copiedMessage, setCopiedMessage] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [currentHwid, setCurrentHwid] = useState('');
    const [licenseServerUrl, setLicenseServerUrl] = useState(() => typeof window !== 'undefined' ? window.location.origin : '');
    const [adminSecret, setAdminSecret] = useState('');
    const [isIssuing, setIsIssuing] = useState(false);
    const [issueError, setIssueError] = useState('');

    useEffect(() => {
        loadLicenses();
        hardwareIdService.getHardwareId().then(setCurrentHwid);
    }, []);

    const loadLicenses = () => {
        const list = licenseGeneratorService.getAllLicenses();
        setLicenses(list);
    };

    const handlePlanChange = (plan: LicensePlan) => {
        setSelectedPlan(plan);
        setPricePaid(PLAN_CONFIGS[plan].defaultPrice);
        if (PLAN_CONFIGS[plan].isUnlimited) {
            setExpireDate('9999-12-31');
        } else {
            const d = new Date();
            d.setDate(d.getDate() + PLAN_CONFIGS[plan].validityDays);
            setExpireDate(d.toISOString().slice(0, 10));
        }
    };

    const handleGenerateLicense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName.trim() || !clientHwid.trim()) {
            alert('نام خریدار و HWID ثبت‌شده از دستگاه مشتری الزامی است.');
            return;
        }
        const resolvedServerUrl = (licenseServerUrl.trim() || window.location.origin).replace(/\/+$/, '');
        const cleanAdminSecret = adminSecret.trim();
        if (!resolvedServerUrl || !cleanAdminSecret) {
            setIssueError('برای صدور تجاری، نشانی سرور مادر و کلید مدیریت سرور را وارد کنید.');
            return;
        }

        setIsIssuing(true);
        setIssueError('');
        try {
            const newLicenseKey = licenseGeneratorService.generateLicenseKey();
            const workspaceId = `ws_${newLicenseKey.replace(/[^A-Z0-9]/gi, '').toLowerCase()}`;
            const planConfig = PLAN_CONFIGS[selectedPlan];
            const effectiveExpireDate = planConfig.isUnlimited ? '9999-12-31' : expireDate;
            if (!planConfig.isUnlimited) {
                const parsedExpiry = new Date(`${effectiveExpireDate}T00:00:00Z`);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveExpireDate) || Number.isNaN(parsedExpiry.getTime()) || parsedExpiry.toISOString().slice(0, 10) !== effectiveExpireDate) {
                    throw new Error('تاریخ انقضا باید یک تاریخ معتبر میلادی با فرمت YYYY-MM-DD باشد.');
                }
            }

            const payload = {
                action: 'add',
                workspace_id: workspaceId,
                title: clientName.trim(),
                token: newLicenseKey,
                expire_date: effectiveExpireDate,
                status: 'ACTIVE',
                is_unlimited: planConfig.isUnlimited,
                max_users: selectedPlan === 'ENTERPRISE' ? 50 : 5,
                plan: selectedPlan,
                max_customers: planConfig.maxCustomers,
                max_documents: planConfig.maxDocuments,
                features: planConfig.isUnlimited
                    ? ['ALL_MODULES', 'OFFLINE_STORAGE', 'UNLIMITED_CUSTOMERS', 'UNLIMITED_DOCUMENTS']
                    : ['BASIC_MODULES'],
                hwid: clientHwid.trim(),
                contact_person: clientName.trim(),
                phone: clientPhone.trim(),
                notes: notes.trim()
            };

            const apiCandidates = [
                `${resolvedServerUrl}/tenant-manager.php`,
                `${resolvedServerUrl}/host-backend/tenant-manager.php`
            ];
            let response: Response | null = null;
            let data: any = null;
            for (const apiUrl of apiCandidates) {
                try {
                    const candidate = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Admin-Secret': cleanAdminSecret
                        },
                        body: JSON.stringify(payload),
                        cache: 'no-store'
                    });
                    response = candidate;
                    data = await candidate.json().catch(() => null);
                    if (candidate.status !== 404) break;
                } catch (error) {
                    if (apiUrl === apiCandidates[apiCandidates.length - 1]) throw error;
                }
            }

            if (!response?.ok || data?.success !== true) {
                throw new Error(data?.message || 'ثبت لایسنس در سرور ناموفق بود. تنظیمات سرور و کلید مدیریت را بررسی کنید.');
            }

            const newRecord: LicenseRecord = {
                id: `LIC-${Date.now()}`,
                licenseKey: newLicenseKey,
                activationCode: '',
                workspaceId,
                serverUrl: resolvedServerUrl,
                clientName: clientName.trim(),
                clientPhone: clientPhone.trim(),
                hwid: clientHwid.trim(),
                plan: selectedPlan,
                maxCustomers: planConfig.maxCustomers,
                maxDocuments: planConfig.maxDocuments,
                isUnlimited: planConfig.isUnlimited,
                issueDate: new Date().toISOString().slice(0, 10),
                expireDate: effectiveExpireDate,
                pricePaid,
                notes,
                status: 'ACTIVE'
            };

            licenseGeneratorService.saveLicenseRecord(newRecord);
            setGeneratedRecord(newRecord);
            loadLicenses();
        } catch (error: any) {
            setIssueError(error?.message || 'ثبت امن لایسنس روی سرور انجام نشد.');
        } finally {
            setIsIssuing(false);
        }
    };

    const handleCopyCustomerMessage = (rec: LicenseRecord) => {
        const msg = licenseGeneratorService.formatCustomerDeliveryMessage(rec);
        navigator.clipboard.writeText(msg);
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2500);
    };

    const handleRevoke = async (id: string) => {
        const record = licenses.find(item => item.id === id);
        if (!record) return;
        if (!window.confirm('آیا از غیرفعال‌سازی این لایسنس در سرور مطمئن هستید؟')) return;
        if (!adminSecret.trim()) {
            alert('ابتدا کلید مدیریت سرور را در بخش اتصال پرتال وارد کنید.');
            return;
        }
        if (!record.workspaceId || !record.serverUrl) {
            alert('این رکورد قدیمی فقط در حافظه مرورگر ثبت شده و شناسه سروری ندارد؛ ابطال سروری برای آن ممکن نیست.');
            return;
        }
        try {
            const baseUrl = record.serverUrl.replace(/\/+$/, '');
            let response: Response | null = null;
            let data: any = null;
            for (const apiUrl of [`${baseUrl}/tenant-manager.php`, `${baseUrl}/host-backend/tenant-manager.php`]) {
                const candidate = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret.trim() },
                    body: JSON.stringify({ action: 'revoke_license', workspace_id: record.workspaceId }),
                    cache: 'no-store'
                });
                response = candidate;
                data = await candidate.json().catch(() => null);
                if (candidate.status !== 404) break;
            }
            if (!response?.ok || data?.success !== true) throw new Error(data?.message || 'ابطال سروری انجام نشد.');
            licenseGeneratorService.revokeLicense(id);
            loadLicenses();
            alert('لایسنس در سرور نیز غیرفعال شد.');
        } catch (error: any) {
            alert(error?.message || 'خطا در ارتباط با سرور مادر.');
        }
    };

    const handleExportBackup = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(licenses, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `ashk_licenses_backup_${Date.now()}.json`);
        dlAnchor.click();
    };

    const filteredLicenses = licenses.filter(l => 
        l.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.clientPhone.includes(searchQuery) ||
        l.licenseKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.hwid.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalRevenue = licenses.reduce((sum, l) => sum + (l.pricePaid || 0), 0);
    const activeCount = licenses.filter(l => l.status === 'ACTIVE').length;

    return (
        <div className="space-y-6 dir-rtl text-right font-sans max-w-7xl mx-auto pb-12">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
                        <KeyRound className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-white">پورتال صدور لایسنس و مدیریت تجاری</h1>
                            <span className="text-xs bg-teal-500/20 text-teal-300 font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30">
                                پنل صاحب اثر و ادمین
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            صدور، ثبت و ابطال لایسنس‌ها در سرور مادر؛ کلاینت‌ها فقط فعال‌سازی آنلاین دارند
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
                    <div className="bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-2xl text-center">
                        <div className="text-[10px] text-slate-400">لایسنس‌های فعال</div>
                        <div className="text-base font-black text-teal-400 font-mono">{activeCount}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-2xl text-center">
                        <div className="text-[10px] text-slate-400">درآمد کل فروش</div>
                        <div className="text-base font-black text-emerald-400 font-mono">
                            {totalRevenue.toLocaleString('fa-IR')} <span className="text-[10px] font-normal">تومان</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Server-only licensing controls: these settings exist only in the mother web portal. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 border border-amber-500/30 rounded-2xl p-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-200">آدرس ریشه سرور مادر (بدون /host-backend)</label>
                    <input
                        type="url"
                        value={licenseServerUrl}
                        onChange={e => setLicenseServerUrl(e.target.value)}
                        placeholder="https://ashkghalam.ir"
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono text-left"
                        dir="ltr"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-200">کلید مدیریت سرور (Admin Secret)</label>
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={adminSecret}
                        onChange={e => setAdminSecret(e.target.value)}
                        placeholder="از فایل سمت سرور workspaces_auth.json"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono text-left"
                        dir="ltr"
                    />
                </div>
                <p className="md:col-span-2 text-[11px] text-slate-400 leading-relaxed">
                    کلید مدیریت فقط برای ارسال درخواست‌های احراز هویت‌شده استفاده می‌شود و در رکورد لایسنس ذخیره نمی‌شود. بدون تأیید سرور، صدور لایسنس متوقف خواهد شد.
                </p>
                {issueError && <p className="md:col-span-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{issueError}</p>}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'create'
                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Plus className="w-4 h-4" />
                    <span>صدور لایسنس و ثبت در سرور</span>
                </button>

                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'list'
                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>دفتر ثبت لایسنس‌های صادر شده ({licenses.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('services')}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeTab === 'services'
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-900/30'
                            : 'bg-slate-900 text-amber-300 hover:text-white border border-amber-500/30'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>راهنمای تجاری‌سازی و خدمات درآمدزا</span>
                </button>
            </div>

            {/* TAB 1: صدور لایسنس جدید */}
            {activeTab === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                    
                    {/* فرم تولید لایسنس */}
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-teal-400" />
                                <span>مشخصات خریدار و پارامترهای قفل سخت‌افزاری</span>
                            </h2>
                            <span className="text-[11px] text-slate-400">ثبت امن لایسنس در سرور مادر</span>
                        </div>

                        <form onSubmit={handleGenerateLicense} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5 text-teal-400" />
                                        نام خریدار / شرکت / فروشگاه:
                                    </label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        placeholder="مثال: بازرگانی برادران حسینی"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-white text-xs outline-none focus:border-teal-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5 text-teal-400" />
                                        شماره تماس / موبایل:
                                    </label>
                                    <input
                                        type="text"
                                        value={clientPhone}
                                        onChange={e => setClientPhone(e.target.value)}
                                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                                        className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-white text-xs outline-none focus:border-teal-500 font-mono transition text-left"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* شناسه سخت‌افزاری خریدار */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                        <Cpu className="w-3.5 h-3.5 text-teal-400" />
                                        شناسه سخت‌افزاری دستگاه خریدار (HWID):
                                    </label>
                                    {currentHwid && (
                                        <button
                                            type="button"
                                            onClick={() => setClientHwid(currentHwid)}
                                            className="text-[10px] text-teal-400 hover:text-teal-300 transition cursor-pointer"
                                        >
                                            استفاده از HWID همین سیستم (برای تست)
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={clientHwid}
                                    onChange={e => setClientHwid(e.target.value)}
                                    placeholder="ASHK-HWID-XXXX-XXXX-XXXX-XXXX"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-white text-xs outline-none focus:border-teal-500 font-mono transition text-left tracking-wider"
                                    dir="ltr"
                                />
                                <p className="text-[11px] text-slate-400">
                                    خریدار این کد را در دیالوگ لایسنس دسکتاپ خود مشاهده کرده و برای شما ارسال می‌کند.
                                </p>
                            </div>

                            {/* انتخاب پلن لایسنس */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5 text-teal-400" />
                                    نوع پلن و سطح دسترسی لایسنس:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {(Object.keys(PLAN_CONFIGS) as LicensePlan[]).filter(p => p !== 'TRIAL').map(p => {
                                        const cfg = PLAN_CONFIGS[p];
                                        const isSelected = selectedPlan === p;
                                        return (
                                            <div
                                                key={p}
                                                onClick={() => handlePlanChange(p)}
                                                className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                                                    isSelected
                                                        ? p === 'HEMAYAT' 
                                                            ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/50'
                                                            : 'bg-teal-950/40 border-teal-500 shadow-md shadow-teal-950/50'
                                                        : p === 'HEMAYAT'
                                                            ? 'bg-emerald-950/10 border-emerald-500/30 hover:border-emerald-500/60'
                                                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-white">{cfg.title}</span>
                                                        {p === 'HEMAYAT' && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                                                حمایتی
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isSelected && <CheckCircle2 className={`w-4 h-4 ${p === 'HEMAYAT' ? 'text-emerald-400' : 'text-teal-400'}`} />}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                                                    <span>{cfg.isUnlimited ? 'مشتری و سند نامحدود' : `${cfg.maxCustomers} طرف حساب / ${cfg.maxDocuments} سند`}</span>
                                                    <span className={`font-mono font-bold ${p === 'HEMAYAT' ? 'text-emerald-400' : 'text-teal-400'}`}>
                                                        {cfg.defaultPrice === 0 ? 'رایگان (همیشگی)' : `${cfg.defaultPrice.toLocaleString('fa-IR')} ت`}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                                        زمان‌بندی و اعتبار لایسنس:
                                    </label>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setExpireDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))}
                                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                                        >
                                            ۱ ماهه
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpireDate(new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10))}
                                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                                        >
                                            ۳ ماهه
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpireDate(new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10))}
                                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                                        >
                                            ۶ ماهه
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpireDate(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))}
                                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                                        >
                                            ۱ ساله
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpireDate('9999-12-31')}
                                            className="px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold transition cursor-pointer"
                                        >
                                            مادام‌العمر (دائمی)
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-300">تاریخ انقضا (میلادی، YYYY-MM-DD):</label>
                                        <input
                                            type="text"
                                            value={expireDate}
                                            onChange={e => setExpireDate(e.target.value)}
                                            placeholder="2027-10-19"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-white text-xs outline-none focus:border-teal-500 font-mono transition text-left"
                                            dir="ltr"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                            <Coins className="w-3.5 h-3.5 text-teal-400" />
                                            مبلغ دریافتی از مشتری (تومان):
                                        </label>
                                        <input
                                            type="number"
                                            value={pricePaid}
                                            onChange={e => setPricePaid(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-white text-xs outline-none focus:border-teal-500 font-mono transition text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isIssuing}
                                className="w-full py-4 rounded-2xl disabled:opacity-50 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-teal-900/30 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>{isIssuing ? 'در حال ثبت امن روی سرور…' : 'ثبت لایسنس در سرور مادر'}</span>
                            </button>
                        </form>
                    </div>

                    {/* جعبه نتیجه صدور لایسنس و متن ارسالی به خریدار */}
                    <div className="lg:col-span-5 space-y-4">
                        {generatedRecord ? (
                            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">لایسنس با موفقیت صادر گردید!</h3>
                                        <p className="text-xs text-slate-400">اطلاعات زیر پس از ثبت سروری آماده تحویل به مشتری هستند</p>
                                    </div>
                                </div>

                                <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                    <div>
                                        <div className="text-[11px] text-slate-400">شماره لایسنس اختصاصی:</div>
                                        <div className="font-mono font-bold text-teal-300 text-sm mt-0.5 tracking-wider select-all">
                                            {generatedRecord.licenseKey}
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-800">
                                        <div className="text-[11px] text-slate-400">شناسه فضای کاری ثبت‌شده در سرور:</div>
                                        <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5 tracking-wider select-all">
                                            {generatedRecord.workspaceId || '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* دکمه کپی متن آماده برای ارسال به خریدار در پیام‌رسان‌ها */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleCopyCustomerMessage(generatedRecord)}
                                        className="py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {copiedMessage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        <span>{copiedMessage ? 'متن کپی شد!' : 'کپی پیام آماده برای مشتری'}</span>
                                    </button>

                                    <a
                                        href={`https://web.eitaa.com/#@ashkghalamco`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-3.5 px-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>ارسال به مشتری در ایتا</span>
                                    </a>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                                    💡 فعال‌سازی فقط پس از تأیید سرور مادر و مطابق پلن ثبت‌شده انجام می‌شود؛ کد آفلاین قابل جعل دیگر تولید نمی‌شود.
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                                    <KeyRound className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-white">هنوز لایسنسی صادر نشده است</h3>
                                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                                        اطلاعات خریدار را وارد کنید؛ لایسنس فقط پس از ثبت موفق در سرور مادر صادر می‌شود.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* TAB 2: لیست و دفتر لایسنس‌ها */}
            {activeTab === 'list' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="جستجو بر اساس نام خریدار، تلفن، لایسنس یا HWID..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white outline-none focus:border-teal-500 transition"
                            />
                        </div>

                        <button
                            onClick={handleExportBackup}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                            <Download className="w-4 h-4 text-teal-400" />
                            <span>خروجی فایل پشتیبان لایسنس‌ها (JSON)</span>
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                        <table className="w-full text-xs text-right">
                            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                                <tr>
                                    <th className="p-3.5">نام مشتری / فروشگاه</th>
                                    <th className="p-3.5">شماره تماس</th>
                                    <th className="p-3.5">پلن لایسنس</th>
                                    <th className="p-3.5">شناسه دستگاه (HWID)</th>
                                    <th className="p-3.5">شماره لایسنس</th>
                                    <th className="p-3.5">شناسه فضای کاری</th>
                                    <th className="p-3.5">تاریخ صدور / انقضا</th>
                                    <th className="p-3.5">مبلغ</th>
                                    <th className="p-3.5 text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {filteredLicenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-500">
                                            هیچ لایسنسی ثبت نشده است.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLicenses.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-950/40 transition">
                                            <td className="p-3.5 font-bold text-white">{rec.clientName}</td>
                                            <td className="p-3.5 font-mono text-slate-300">{rec.clientPhone || '—'}</td>
                                            <td className="p-3.5">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${PLAN_CONFIGS[rec.plan].badgeColor}`}>
                                                    {PLAN_CONFIGS[rec.plan].title}
                                                </span>
                                            </td>
                                            <td className="p-3.5 font-mono text-teal-400 text-[11px] max-w-[140px] truncate" title={rec.hwid}>
                                                {rec.hwid}
                                            </td>
                                            <td className="p-3.5 font-mono text-slate-200">{rec.licenseKey}</td>
                                            <td className="p-3.5 font-mono text-emerald-400">{rec.workspaceId || 'قدیمی/ثبت‌نشده'}</td>
                                            <td className="p-3.5 text-slate-400 text-[11px]">
                                                <div>صدور: {rec.issueDate}</div>
                                                <div className="text-[10px] text-slate-500">انقضا: {rec.isUnlimited ? 'دائمی' : rec.expireDate}</div>
                                            </td>
                                            <td className="p-3.5 font-mono text-emerald-400">
                                                {(rec.pricePaid || 0).toLocaleString('fa-IR')} ت
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleCopyCustomerMessage(rec)}
                                                        title="کپی پیام آماده مشتری"
                                                        className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition cursor-pointer"
                                                    >
                                                        <Send className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRevoke(rec.id)}
                                                        title="لغو یا ابطال"
                                                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: خدمات تجاری‌سازی و مدل‌های کسب درآمد */}
            {activeTab === 'services' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-6 rounded-3xl">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-7 h-7 text-amber-400" />
                            <div>
                                <h2 className="text-lg font-black text-white">استراتژی‌های عملیاتی تجاری‌سازی و کسب درآمد از نرم‌افزار</h2>
                                <p className="text-xs text-slate-400 mt-1">مدل‌های درآمد پایدار، فروش ماژول‌های جانبی و اشتراک‌های ابری</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        
                        {/* سرویس ۱: سامانه مودیان و کارپوشه مالیاتی */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۱. اتصال به سامانه مودیان مالیاتی</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                یکی از پرتقاضاترین نیازهای بازاریان ایران. ارسال مستقیم فاکتورهای الکترونیکی به سامانه مودیان بدون واسطه معتمد مالیاتی.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-teal-300 font-bold">
                                پیشنهاد قیمت ماژول: ۲ الی ۵ میلیون تومان سالانه
                            </div>
                        </div>

                        {/* سرویس ۲: پنل پیامک خدماتی هوشمند */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۲. ارسال پیامک خودکار مانده و سررسید چک</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                ارسال پیامک لینک فاکتور، یادآوری چک‌های ۳ روز آینده و ارسال وضعیت مانده‌حساب به مشتریان با خط خدماتی بدون بلک‌لیست.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-300 font-bold">
                                مدل درآمدی: فروش شارژ پیامک با حاشیه سود ۳۰ الی ۵۰ درصد
                            </div>
                        </div>

                        {/* سرویس ۳: پشتیبان‌گیری ابری و همگام‌سازی چند شعبه */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                                <Cloud className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۳. فضای ابری پشتیبان و اتصال چند سیستمه</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                همگام‌سازی اطلاعات بین چند فروشگاه یا لپ‌تاپ مدیر و سیستم حسابدار در فروشگاه با ذخیره‌سازی ابری امن و پشتیبان‌گیری خودکار شبانه.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-cyan-300 font-bold">
                                اشتراک ماهانه یا سالانه: ۵۰۰ هزار الی ۱.۵ میلیون تومان در سال
                            </div>
                        </div>

                        {/* سرویس ۴: اتصال پوز و کارتخوان بانکی */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۴. اتصال مستقیم به کارتخوان‌های بانکی (PC-POS)</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                ارسال خودکار مبلغ فاکتور به دستگاه کارتخوان سداد، به‌پرداخت، سامان کیش و آسان‌پرداخت جهت جلوگیری از خطای انسانی در ثبت مبالغ.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-purple-300 font-bold">
                                هزینه راه‌اندازی و فعال‌سازی پروتکل: ۱ الی ۲ میلیون تومان
                            </div>
                        </div>

                        {/* سرویس ۵: قرارداد پشتیبانی VIP سالانه */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۵. قرارداد پشتیبانی طلایی سالانه (SLA)</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                دریافت آپدیت‌های سالانه قوانین مالیاتی، پاسخگویی تلفنی اولویت‌دار، اتصال ریموت و رفع اشکالات سندهای اشتباه کاربران.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300 font-bold">
                                نرخ استاندارد بازار: ۲۰ الی ۳۰ درصد قیمت کل نرم‌افزار سالانه
                            </div>
                        </div>

                        {/* سرویس ۶: سفارشی‌سازی فرمت فاکتور و آموزش */}
                        <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 p-5 rounded-3xl space-y-3 transition group">
                            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">۶. طراحی فاکتور اختصاصی و آموزش پرسنل</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                طراحی قالب اختصاصی چاپ با لوگو، واترمارک و بارکد دو بعدی، به همراه جلسات آموزش حسابداری به صندوق‌دار یا منشی مشتری.
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-rose-300 font-bold">
                                دستمزد خدمات حضوری یا آنلاین: ۵۰۰ هزار الی ۲ میلیون تومان
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default LicenseManager;
