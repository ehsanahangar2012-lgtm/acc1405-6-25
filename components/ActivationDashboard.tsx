// Activation Dashboard Component (داشبورد فعال‌سازی، لایسنس و قفل سخت‌افزاری HWID)
// فعال‌سازی آنلاین با تأیید امضای دیجیتال سرور و مدیریت AppManifest

import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, 
    KeyRound, 
    Cpu, 
    CheckCircle2, 
    XCircle, 
    Copy, 
    Check, 
    RefreshCw, 
    HardDrive, 
    Globe, 
    Lock, 
    Award, 
    Info, 
    HelpCircle,
    Building2,
    Calendar,
    Sparkles,
    Sliders,
    Send
} from 'lucide-react';
import { hardwareIdService, DeviceInfo } from '../services/hardwareIdService';
import { encryptedStorageService, AppManifest } from '../services/encryptedStorageService';
import { idbService } from '../services/indexedDBService';
import { workspaceService } from '../services/workspaceService';
import { verifyServerLicenseReceipt } from '../services/serverLicenseReceiptService';
import { HOST_BASE_URL } from '../config';

interface ActivationDashboardProps {
    isOpen?: boolean;
    onClose?: () => void;
    onActivationSuccess?: (manifest: AppManifest) => void;
}

export const ActivationDashboard: React.FC<ActivationDashboardProps> = ({
    isOpen = true,
    onClose,
    onActivationSuccess
}) => {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [manifest, setManifest] = useState<AppManifest | null>(null);
    const [licenseKey, setLicenseKey] = useState('');
        const [companyName, setCompanyName] = useState('');
    const [workspaceId, setWorkspaceId] = useState('default');
    const [serverUrl, setServerUrl] = useState(() => workspaceService.getConfig().customServerUrl || HOST_BASE_URL);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedHwid, setCopiedHwid] = useState(false);
    const [copiedSig, setCopiedSig] = useState(false);
    const [activeTab, setActiveTab] = useState<'online' | 'manifest'>('online');
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [showGuideModal, setShowGuideModal] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        setIsLoading(true);
        try {
            const devInfo = await hardwareIdService.getDeviceInfo();
            setDeviceInfo(devInfo);

            const activeManifest = await encryptedStorageService.getAppManifest();
            if (activeManifest) {
                setManifest(activeManifest);
                setLicenseKey(activeManifest.licenseKey || '');
                setCompanyName(activeManifest.companyName || '');
                setWorkspaceId(activeManifest.workspaceId || 'default');
            }
        } catch (e) {
            console.error('Error loading activation status:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyHwid = () => {
        if (!deviceInfo?.hwid) return;
        navigator.clipboard.writeText(deviceInfo.hwid);
        setCopiedHwid(true);
        setTimeout(() => setCopiedHwid(false), 2000);
    };

    const handleOnlineActivation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) {
            setMessage({ type: 'error', text: 'لطفاً کلید لایسنس را وارد کنید.' });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const hwid = deviceInfo?.hwid || await hardwareIdService.getHardwareId();
            const cleanWorkspaceId = workspaceId.trim();
            const cleanLicenseKey = licenseKey.trim();
            const resolvedServerUrl = (serverUrl.trim() || HOST_BASE_URL).replace(/\/+$/, '');
            const activationServerUrl = HOST_BASE_URL.replace(/\/+$/, '');

            if (!cleanWorkspaceId || ['default', 'main'].includes(cleanWorkspaceId) || !cleanLicenseKey) {
                setMessage({ type: 'error', text: 'برای فعال‌سازی آنلاین، شناسه فضای کاری اختصاصی ثبت‌شده و کلید لایسنس لازم است؛ default/main برای پرتال مادر رزرو شده‌اند.' });
                return;
            }

            // Accept only a response from a registered tenant entry in the server registry.
            const requestBody = JSON.stringify({
                action: 'verify_license',
                workspace_id: cleanWorkspaceId,
                token: cleanLicenseKey,
                hwid
            });
            // Commercial license authority is fixed by app configuration; the user-entered host is for data sync only.
            const apiCandidates = [
                `${activationServerUrl}/tenant-manager.php`,
                `${activationServerUrl}/host-backend/tenant-manager.php`
            ];
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            let response: Response | null = null;
            let data: any = null;
            try {
                for (const targetApi of apiCandidates) {
                    try {
                        const candidate = await fetch(targetApi, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: requestBody,
                            signal: controller.signal,
                            cache: 'no-store'
                        });
                        response = candidate;
                        data = await candidate.json().catch(() => null);
                        if (candidate.status !== 404) break;
                    } catch (error) {
                        if (controller.signal.aborted) throw error;
                    }
                }
            } finally {
                clearTimeout(timeoutId);
            }

            if (response?.ok && data?.allowed === true && data?.status === 'ACTIVE') {
                const verifiedReceipt = await verifyServerLicenseReceipt({
                    hostUrl: activationServerUrl,
                    licenseKey: cleanLicenseKey,
                    workspaceId: cleanWorkspaceId,
                    hwid,
                    receipt: data.license_receipt
                });
                if (!verifiedReceipt) {
                    throw new Error('امضای دیجیتال پاسخ لایسنس معتبر نیست؛ کلاینت فعال نشد.');
                }
                const receiptPayload = verifiedReceipt.payload;
                const resolvedCompany = receiptPayload.company_name || data.title || companyName || 'مشتری مجاز هاست';
                const resolvedExpireDate = receiptPayload.expire_date;
                const resolvedUnlimited = receiptPayload.is_unlimited === true;
                const resolvedFeatures = receiptPayload.features.filter((feature: unknown) => typeof feature === 'string') as string[];
                const resolvedPlan = receiptPayload.plan;
                const newManifest = encryptedStorageService.createManifestObject({
                    licenseKey: cleanLicenseKey,
                    hardwareId: hwid,
                    workspaceId: cleanWorkspaceId,
                    workspaceToken: cleanLicenseKey,
                    companyName: resolvedCompany,
                    expireDate: resolvedExpireDate,
                    isUnlimited: resolvedUnlimited,
                    standaloneOfflineMode: false,
                    customApiBaseUrl: resolvedServerUrl,
                    features: resolvedFeatures
                });

                await encryptedStorageService.saveAppManifest(newManifest);
                idbService.setScope({ workspaceId: cleanWorkspaceId, licenseKey: cleanLicenseKey });
                localStorage.setItem('ashk_license_status', 'ACTIVATED');
                localStorage.setItem('ashk_license_key', cleanLicenseKey);
                localStorage.removeItem('ashk_activation_code');
                localStorage.setItem('ashk_license_type', resolvedUnlimited ? 'UNLIMITED' : 'LIMITED');
                localStorage.setItem('ashk_license_plan', resolvedPlan);
                localStorage.setItem('ashk_server_license_data', JSON.stringify({
                    serverVerified: true,
                    workspaceId: cleanWorkspaceId,
                    licenseKey: cleanLicenseKey,
                    licenseReceipt: data.license_receipt,
                    hwid,
                    companyName: resolvedCompany,
                    plan: resolvedPlan,
                    expireDate: resolvedExpireDate,
                    isUnlimited: resolvedUnlimited,
                    hostUrl: resolvedServerUrl,
                    licenseAuthorityUrl: activationServerUrl,
                    syncToken: cleanLicenseKey,
                    workspaceToken: cleanLicenseKey,
                    maxCustomers: receiptPayload.max_customers,
                    maxDocuments: receiptPayload.max_documents,
                    features: resolvedFeatures,
                    verifiedAt: new Date().toISOString()
                }));
                localStorage.setItem('ashk_host_url', resolvedServerUrl);
                localStorage.setItem('ashk_custom_server_url', resolvedServerUrl);
                localStorage.setItem('ashk_host_sync_token', cleanLicenseKey);
                localStorage.setItem('ashk_cloud_token', cleanLicenseKey);
                await workspaceService.updateConfig({
                    workspaceId: cleanWorkspaceId,
                    workspaceToken: cleanLicenseKey,
                    customServerUrl: resolvedServerUrl,
                    licenseKey: cleanLicenseKey,
                    standaloneOfflineMode: false
                });

                window.dispatchEvent(new CustomEvent('ashk-license-updated'));
                setManifest(newManifest);
                setMessage({ type: 'success', text: 'امضای دیجیتال و اعتبار لایسنس از سرور تأیید شد؛ اتصال ثبت گردید.' });
                if (onActivationSuccess) onActivationSuccess(newManifest);
            } else {
                setMessage({ type: 'error', text: data?.message || 'سرور، فضای کاری یا کلید لایسنس را تأیید نکرد. لایسنس فعال نشد.' });
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err?.message || 'ارتباط امن با سرور برقرار نشد؛ لایسنس فعال نشد.'
            });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md dir-rtl text-right font-sans">
            <div id="activation-dashboard-card" className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-900/40 via-slate-900 to-emerald-900/30 p-6 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
                            <ShieldCheck className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white">داشبورد فعال‌سازی و قفل سخت‌افزاری</h2>
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 font-mono font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                                    HWID PROTECTED
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">مدیریت لایسنس، کد دستگاه و جداسازی داده‌های چندشرکته</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowGuideModal(true)} 
                            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition"
                            title="راهنما"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        {onClose && (
                            <button 
                                onClick={onClose} 
                                className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
                    
                    {/* Status Badge */}
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Cpu className="w-5 h-5 text-teal-400" />
                            <div>
                                <div className="text-xs text-slate-400">شناسه اختصاصی رایانه (HWID):</div>
                                <div className="text-sm font-mono font-bold text-teal-300 mt-0.5 select-all">
                                    {deviceInfo?.hwid || 'در حال محاسبه شناسه دستگاه...'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyHwid}
                                disabled={!deviceInfo?.hwid}
                                className="flex items-center gap-1.5 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                            >
                                {copiedHwid ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedHwid ? 'کپی شد' : 'کپی کد رایانه (HWID)'}</span>
                            </button>
                            <a
                                href="https://web.eitaa.com/#@ashkghalamco"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                                title="ارسال کد رایانه به پشتیبانی ایتا"
                            >
                                <Send className="w-4 h-4" />
                                <span>ارسال به ایتا</span>
                            </a>
                        </div>
                    </div>

                    {/* Messages */}
                    {message && (
                        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                            message.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' :
                            message.type === 'error' ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' :
                            'bg-sky-950/40 border-sky-500/30 text-sky-300'
                        }`}>
                            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />}
                            <div className="leading-relaxed">{message.text}</div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-slate-800 text-xs font-bold gap-2">
                        <button
                            onClick={() => setActiveTab('online')}
                            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                                activeTab === 'online' 
                                    ? 'border-teal-400 text-teal-300' 
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Globe className="w-4 h-4" />
                            <span>اتصال آنلاین و هاست</span>
                        </button>

                        {manifest && (
                            <button
                                onClick={() => setActiveTab('manifest')}
                                className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                                    activeTab === 'manifest' 
                                        ? 'border-teal-400 text-teal-300' 
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Award className="w-4 h-4" />
                                <span>مانیفست فعال جاری</span>
                            </button>
                        )}
                    </div>

                    {/* Online Tab */}
                    {activeTab === 'online' && (
                        <form onSubmit={handleOnlineActivation} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">آدرس هاست / سرور اختصاصی (اختیاری):</label>
                                <input 
                                    type="text"
                                    value={serverUrl}
                                    onChange={(e) => setServerUrl(e.target.value)}
                                    placeholder="https://your-domain.com (در صورت خالی بودن از مسیر پیش‌فرض استفاده می‌شود)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-teal-500 outline-none dir-ltr text-left"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">شناسه فضای کاری (Workspace ID):</label>
                                    <input 
                                        type="text"
                                        value={workspaceId}
                                        onChange={(e) => setWorkspaceId(e.target.value)}
                                        placeholder="مثال: client_rahimi"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-teal-500 outline-none dir-ltr text-left"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">توکن امنیتی هاست (Token):</label>
                                    <input 
                                        type="password"
                                        value={licenseKey}
                                        onChange={(e) => setLicenseKey(e.target.value)}
                                        placeholder="توکن تعریف شده در workspaces_auth.json"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-teal-500 outline-none dir-ltr text-left"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                <span>استعلام و ثبت اعتبارنامه‌های هاست</span>
                            </button>
                        </form>
                    )}

                    {/* Manifest Tab */}
                    {activeTab === 'manifest' && manifest && (
                        <div className="space-y-4 text-xs">
                            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400">وضعیت لایسنس:</span>
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {manifest.status}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400">نام مجموعه:</span>
                                    <span className="text-white font-bold">{manifest.companyName}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400">شناسه اسکوپ پایگاه داده:</span>
                                    <span className="text-teal-300 font-mono">{manifest.storagePrefix}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400">تاریخ انقضا:</span>
                                    <span className="text-amber-300 font-bold">{manifest.expireDate}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-slate-400">شناسه نمونه (Instance ID):</span>
                                    <span className="text-slate-300 font-mono text-[10px]">{manifest.instanceId}</span>
                                </div>
                            </div>

                            <div className="p-3 bg-teal-950/30 border border-teal-500/20 rounded-xl text-[11px] text-teal-200">
                                💡 داده‌های این دستگاه در اسکوپ اختصاصی <code className="bg-slate-900 px-1 py-0.5 rounded text-teal-400 font-mono">{manifest.storagePrefix}</code> ذخیره شده و از تمامی سیستم‌های دیگر مجزا است.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-teal-400" />
                        <span>ذخیره‌سازی رمزنگاری شده AES-256</span>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl transition"
                        >
                            بستن
                        </button>
                    )}
                </div>
            </div>

            {/* Guide Modal */}
            {showGuideModal && (
                <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md text-right space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="font-black text-white flex items-center gap-2 text-sm">
                                <HelpCircle className="w-5 h-5 text-teal-400" />
                                راهنمای سیستم لایسنس و قفل سخت‌افزاری
                            </h3>
                            <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                            <p>۱. <strong>شناسه HWID:</strong> شناسه این نصب برای ثبت و پشتیبانی است؛ به‌تنهایی گواه امنیتی محسوب نمی‌شود.</p>
                            <p>۲. <strong>اسکوپ‌بندی داده‌ها (Database Scoping):</strong> با وارد کردن لایسنس، دیتابیس دستگاه شما ایزوله شده و هیچ تداخلی با سایر لایسنس‌ها یا مشتریان نخواهد داشت.</p>
                            <p>۳. <strong>تأیید تجاری:</strong> لایسنس تجاری تنها با بررسی آنلاین امضای دیجیتال و وضعیت جاری آن در سرور معتبر است.</p>
                        </div>
                        <button
                            onClick={() => setShowGuideModal(false)}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-xl text-xs"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
