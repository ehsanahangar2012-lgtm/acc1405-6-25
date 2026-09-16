import React, { useState, useEffect } from 'react';
import { 
    Layers, Shield, Globe, HardDrive, Wifi, WifiOff, CheckCircle2, 
    AlertTriangle, Download, RefreshCw, HelpCircle, Save, Key, 
    Server, Laptop, Building, FileCode, Check
} from 'lucide-react';
import { workspaceService, WorkspaceConfig } from '../services/workspaceService';
import { useStore } from '../store';

export const WorkspaceManager: React.FC = () => {
    const [config, setConfig] = useState<WorkspaceConfig>(workspaceService.getConfig());
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const current = workspaceService.getConfig();
        setConfig(current);
        if (typeof window !== 'undefined' && (window as any).electronDesktopAPI) {
            setIsDesktop(true);
        }
    }, []);

    const handleChange = (field: keyof WorkspaceConfig, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setSavedSuccess(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await workspaceService.updateConfig(config);
            setSavedSuccess(true);
            useStore.getState().addNotification('success', 'پیکربندی فضای کاری و استقلال نرم‌افزار با موفقیت ذخیره شد');
            setTimeout(() => setSavedSuccess(false), 4000);
        } catch (e) {
            useStore.getState().addNotification('error', 'خطا در ذخیره تنظیمات فضای کاری');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            // ذخیره موقت قبل از تست
            await workspaceService.updateConfig(config);
            const res = await workspaceService.testConnection();
            setTestResult(res);
            if (res.success) {
                useStore.getState().addNotification('success', res.message);
            } else {
                useStore.getState().addNotification('error', res.message);
            }
        } catch (err) {
            setTestResult({
                success: false,
                message: 'خطا در برقراری اتصال با هاست'
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleDownloadConfig = async () => {
        const desktopApi = (typeof window !== 'undefined') ? (window as any).electronDesktopAPI : null;
        
        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                const res = await desktopApi.invoke('export-app-config', {
                    workspace_id: config.workspaceId,
                    workspace_token: config.workspaceToken,
                    api_base_url: config.customServerUrl,
                    standalone_offline_mode: config.standaloneOfflineMode,
                    app_title: config.appTitle,
                    company_name: config.companyName,
                    license_key: config.licenseKey
                });
                if (res && res.success) {
                    useStore.getState().addNotification('success', `فایل کانفیگ در مسیر ${res.filePath} ذخیره گردید.`);
                    return;
                }
            } catch (err) {
                console.warn('Desktop export fallback:', err);
            }
        }

        // مرورگر وب - دانلود فایل متنی JSON
        const blob = new Blob([workspaceService.generateConfigFileString()], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'app-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        useStore.getState().addNotification('success', 'فایل app-config.json برای استفاده در نسخه پرتابل دانلود شد.');
    };

    const handleReset = async () => {
        if (window.confirm('آیا از بازنشانی فضای کاری به حالت پیش‌فرض مطمئن هستید؟')) {
            await workspaceService.resetToDefault();
            setConfig(workspaceService.getConfig());
            useStore.getState().addNotification('info', 'تنظیمات فضای کاری به پیش‌فرض اشک قلم بازنشانی شد.');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
            {/* Header with Help */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <Layers size={26} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                استقلال نسخه دسکتاپ و مدیریت فضاهای کاری مجزا
                                {config.standaloneOfflineMode ? (
                                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                                        کاملاً آفلاین و مستقل
                                    </span>
                                ) : config.workspaceId && config.workspaceId !== 'default' ? (
                                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                                        فضای ابری مجزا: {config.workspaceId}
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                                        فضای ابری اصلی (اشک قلم)
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                اختصاص فضا و دیتابیس مستقل در هاست برای افراد یا مشتریان دیگر بدون کوچک‌ترین تداخل با داده‌های اشک قلم
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                            id="btn-workspace-smart-help"
                            onClick={() => setShowHelp(!showHelp)}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                                showHelp 
                                    ? 'bg-amber-500 text-slate-900 border-amber-400' 
                                    : 'bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700'
                            }`}
                            title="راهنمای هوشمند استقلال نسخه پرتابل"
                        >
                            <HelpCircle size={16} />
                            <span>راهنما ؟</span>
                        </button>
                    </div>
                </div>

                {/* Smart Help Box */}
                {showHelp && (
                    <div className="mt-5 p-5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200/90 text-xs leading-relaxed space-y-3 animate-fade-in">
                        <div className="font-black text-amber-300 flex items-center gap-2">
                            <HelpCircle size={18} />
                            راهنمای استفاده از نسخه پرتابل برای اشخاص و مشتریان دیگر:
                        </div>
                        <ul className="list-disc list-inside space-y-2 pr-2">
                            <li>
                                <strong>روش ۱ (هاست اشتراکی با پوشه ایزوله):</strong> کافیست در کادر «شناسه فضای کاری»، یک نام یکتا برای مشتری (مثلاً <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-400">client_rahimi</code>) وارد کنید. سرور هاست به‌صورت خودکار یک پوشه مجزا در مسیر <code className="bg-black/40 px-1.5 py-0.5 rounded">/data/tenants/client_rahimi/</code> ایجاد می‌کند و تمام کالاها، شرکت‌ها، اشخاص و فاکتورهای ایشان به صورت ۱۰۰٪ مجزا ذخیره می‌شوند.
                            </li>
                            <li>
                                <strong>روش ۲ (نسخه کاملاً آفلاین محلی):</strong> با روشن کردن گزینه «حالت کاملاً آفلاین و مستقل»، نرم‌افزار به هیچ عنوان به هاست وصل نمی‌شود و کل داده‌ها روی همان سیستم محلی در پایگاه داده مستقل ذخیره می‌گردند.
                            </li>
                            <li>
                                <strong>روش ۳ (هاست اختصاصی مشتری):</strong> اگر مشتری هاست cPanel شخصی دارد، فایل‌های فولدر <code className="bg-black/40 px-1.5 py-0.5 rounded">host-backend</code> را در هاست او آپلود کرده و آدرس آن را در کادر «آدرس هاست سفارشی» قرار دهید.
                            </li>
                            <li>
                                <strong>توزیع آسان:</strong> با کلیک روی دکمه «دریافت فایل app-config.json»، فایل پیکربندی را دانلود کرده و کنار فایل اجرایی <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-400">Portable.exe</code> قرار دهید. نرم‌افزار با اجرای اول، خودکار با مشخصات و برند اختصاصی همان شخص باز می‌شود.
                            </li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Form Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mode & Identity */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400 font-black text-sm pb-2 border-b border-slate-700/60">
                        <Server size={18} />
                        <span>مشخصات فضای ابری و هاست</span>
                    </div>

                    {/* Standalone Offline Toggle */}
                    <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                        <div className="space-y-1 pr-1">
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                                {config.standaloneOfflineMode ? <WifiOff size={16} className="text-amber-400" /> : <Wifi size={16} className="text-emerald-400" />}
                                حالت کاملاً آفلاین و مستقل (Standalone)
                            </div>
                            <div className="text-[11px] text-slate-400">
                                بدون اتصال به سرور ابری؛ ذخیره ۱۰۰٪ محلی و امن در پایگاه داده رایانه
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={config.standaloneOfflineMode}
                                onChange={e => handleChange('standaloneOfflineMode', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>

                    {/* Workspace ID */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Layers size={14} className="text-indigo-400" />
                            شناسه اختصاصی فضای کاری (Workspace ID):
                        </label>
                        <input
                            type="text"
                            value={config.workspaceId}
                            disabled={config.standaloneOfflineMode}
                            onChange={e => handleChange('workspaceId', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                            placeholder="مثلاً: client_rahimi یا partner_tehran"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono disabled:opacity-50"
                        />
                        <p className="text-[10px] text-slate-400">
                            فقط حروف انگلیسی کوچک، اعداد و خط تیره. (برای نسخه اصلی عبارت <code className="text-indigo-400">default</code> است)
                        </p>
                    </div>

                    {/* Workspace Token / Secret */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Key size={14} className="text-indigo-400" />
                            کلید امنیتی / توکن فضای کاری (Workspace Secret):
                        </label>
                        <input
                            type="text"
                            value={config.workspaceToken}
                            disabled={config.standaloneOfflineMode}
                            onChange={e => handleChange('workspaceToken', e.target.value)}
                            placeholder="رمز عبور یا توکن اختصاصی جهت محافظت از پوشه هاست"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono disabled:opacity-50"
                        />
                    </div>

                    {/* Custom Server URL */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Globe size={14} className="text-indigo-400" />
                            آدرس هاست سفارشی (اختیاری):
                        </label>
                        <input
                            type="text"
                            value={config.customServerUrl}
                            disabled={config.standaloneOfflineMode}
                            onChange={e => handleChange('customServerUrl', e.target.value.trim())}
                            placeholder="پیش‌فرض: https://acc.ashkghalam.ir"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono disabled:opacity-50 text-left"
                            dir="ltr"
                        />
                    </div>
                </div>

                {/* Branding & License Info */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400 font-black text-sm pb-2 border-b border-slate-700/60">
                        <Building size={18} />
                        <span>برند، عنوان و مشخصات شخص / مشتری</span>
                    </div>

                    {/* App Title */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Laptop size={14} className="text-indigo-400" />
                            عنوان نرم‌افزار (نمایش در هدر و نوار عنوان ویندوز):
                        </label>
                        <input
                            type="text"
                            value={config.appTitle}
                            onChange={e => handleChange('appTitle', e.target.value)}
                            placeholder="مثلاً: سامانه مالی و انبارداری بازرگانی رحیمی"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>

                    {/* Company / Client Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Building size={14} className="text-indigo-400" />
                            نام شرکت یا شخص صاحب نسخه:
                        </label>
                        <input
                            type="text"
                            value={config.companyName}
                            onChange={e => handleChange('companyName', e.target.value)}
                            placeholder="مثلاً: بازرگانی رحیمی و شرکا"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>

                    {/* License Key */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Shield size={14} className="text-indigo-400" />
                            کد لایسنس یا شماره مجوز پرتابل:
                        </label>
                        <input
                            type="text"
                            value={config.licenseKey}
                            onChange={e => handleChange('licenseKey', e.target.value)}
                            placeholder="مثلاً: ASHK-PORTABLE-1403-RAHIMI"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                    </div>

                    {/* Desktop Environment Note */}
                    <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                            <FileCode size={14} />
                            محیط اجرایی کنونی: {isDesktop ? 'نسخه دسکتاپ ویندوز (Electron)' : 'مرورگر وب'}
                        </div>
                        <p className="text-indigo-300/80">
                            در نسخه ویندوز، با ذخیره تنظیمات، فایل <code className="bg-black/40 px-1 py-0.5 rounded text-indigo-200">app-config.json</code> کنار فایل اجرایی خودکار به‌روزرسانی می‌شود.
                        </p>
                    </div>
                </div>
            </div>

            {/* Test Result Message */}
            {testResult && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fade-in text-xs font-bold ${
                    testResult.success 
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                }`}>
                    {testResult.success ? <CheckCircle2 size={20} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={20} className="shrink-0 text-rose-400" />}
                    <div>
                        <p>{testResult.message}</p>
                        {testResult.details && (
                            <p className="text-[10px] font-normal opacity-80 mt-1 font-mono">
                                سرور: {testResult.details.workspace} | ایزوله: {testResult.details.is_isolated ? 'بله' : 'خیر'} | زمان سرور: {testResult.details.server_time}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-700/60">
                <div className="flex items-center gap-2">
                    <button
                        id="btn-save-workspace-config"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                    >
                        {savedSuccess ? <Check size={16} className="text-emerald-300" /> : <Save size={16} />}
                        <span>{savedSuccess ? 'ذخیره شد ✓' : isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
                    </button>

                    <button
                        id="btn-test-workspace-connection"
                        onClick={handleTest}
                        disabled={isTesting}
                        className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} />
                        <span>{isTesting ? 'در حال بررسی...' : 'تست اتصال به هاست'}</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        id="btn-download-app-config"
                        onClick={handleDownloadConfig}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                        title="خروجی فایل کانفیگ برای قرار دادن کنار فایل پرتابل EXE"
                    >
                        <Download size={16} />
                        <span>خروجی فایل app-config.json</span>
                    </button>

                    <button
                        id="btn-reset-workspace-default"
                        onClick={handleReset}
                        className="px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs transition-all"
                    >
                        بازنشانی به پیش‌فرض اشک قلم
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceManager;
