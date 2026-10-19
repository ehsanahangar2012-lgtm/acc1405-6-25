import React, { useEffect, useState } from 'react';
import { ActivationDashboard } from '../components/ActivationDashboard';
import { androidCommercialService } from '../services/androidCommercialService';
import { hardwareIdService } from '../services/hardwareIdService';
import { workspaceService } from '../services/workspaceService';
import { useStore } from '../store';

const InstallAndroidClient: React.FC = () => {
    const { addNotification } = useStore();
    const [showActivation, setShowActivation] = useState(false);
    const [hostUrl, setHostUrl] = useState(() => localStorage.getItem('ashk_host_url') || localStorage.getItem('ashk_custom_server_url') || '');
    const [syncToken, setSyncToken] = useState(() => localStorage.getItem('ashk_host_sync_token') || '');
    const [workspaceId, setWorkspaceId] = useState(() => workspaceService.getWorkspaceId());
    const [hwid, setHwid] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        hardwareIdService.getHardwareId().then(setHwid).catch(() => setHwid(''));
    }, []);

    const handleConnect = async () => {
        if (!hostUrl.trim() || !syncToken.trim() || !workspaceId.trim()) {
            addNotification('error', 'آدرس سرور، کلید لایسنس و شناسه فضای کاری ثبت‌شده را کامل کنید.');
            return;
        }
        setIsConnecting(true);
        try {
            const result = await androidCommercialService.connectToServer(hostUrl.trim(), syncToken.trim(), workspaceId.trim());
            if (result.success) {
                setHostUrl(hostUrl.trim());
                setSyncToken(syncToken.trim());
                addNotification('success', result.message);
            } else {
                addNotification('error', result.message);
            }
        } catch {
            addNotification('error', 'اتصال امن به سرور برقرار نشد.');
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5 text-right" dir="rtl">
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900 p-6">
                <h1 className="text-xl font-black text-white">فعال‌سازی و اتصال نسخه مشتری</h1>
                <p className="text-sm text-slate-400 mt-2 leading-7">
                    این نسخه فقط برای حسابداری مشتری، فعال‌سازی لایسنس و اتصال به فضای کاری ثبت‌شده است.
                    صدور لایسنس و ساخت فایل‌های نصب فقط در پرتال مادرِ وب انجام می‌شود.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setShowActivation(true)} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-3 text-sm font-bold text-white">
                        فعال‌سازی آنلاین لایسنس
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <h2 className="text-base font-bold text-white">اتصال به سرور و همگام‌سازی</h2>
                <div className="space-y-1">
                    <label className="text-xs text-slate-300">نشانی سرور مادر</label>
                    <input value={hostUrl} onChange={e => setHostUrl(e.target.value)} type="url" placeholder="https://ashkghalam.ir" dir="ltr" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white text-left" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-300">شناسه فضای کاری اختصاصی</label>
                    <input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} dir="ltr" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white text-left font-mono" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-300">کلید لایسنس / توکن اختصاصی</label>
                    <input value={syncToken} onChange={e => setSyncToken(e.target.value)} dir="ltr" type="password" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white text-left font-mono" />
                </div>
                <div className="text-xs text-slate-500 break-all">شناسه این دستگاه (HWID): <span className="font-mono text-cyan-300">{hwid || 'در حال دریافت…'}</span></div>
                <button disabled={isConnecting} onClick={handleConnect} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white">
                    {isConnecting ? 'در حال بررسی مجوز و اتصال…' : 'تأیید لایسنس و اتصال سرور'}
                </button>
            </div>

            {showActivation && (
                <ActivationDashboard
                    isOpen
                    onClose={() => setShowActivation(false)}
                    onActivationSuccess={(manifest) => {
                        setShowActivation(false);
                        setHostUrl(manifest.customApiBaseUrl || hostUrl);
                        setWorkspaceId(manifest.workspaceId || workspaceId);
                        setSyncToken(manifest.workspaceToken || manifest.licenseKey || syncToken);
                    }}
                />
            )}
        </div>
    );
};

export default InstallAndroidClient;
