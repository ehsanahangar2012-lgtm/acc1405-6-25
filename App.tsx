
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import QuickActionFAB from './components/QuickActionFAB';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import { HostDatabaseSync } from './components/HostDatabaseSync';
import { NotificationBar } from './components/NotificationBar';
import { EnvironmentIndicator } from './components/EnvironmentIndicator';
import RealtimeSyncIndicator from './components/RealtimeSyncIndicator';
import { ToastProvider } from './components/ToastProvider';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import SupportChat from './components/SupportChat';
import SmartSectionGuide from './components/SmartSectionGuide';
import { ResponsiveLayoutProvider, useResponsiveLayout } from './components/ResponsiveLayoutManager';
import { useStore } from './store';
import { securityService } from './services/securityService';
import { autoBackupService } from './services/autoBackupService';
import { idbService } from './services/indexedDBService';
import { crossDeviceSync } from './services/crossDeviceSync';
import { autoSyncService } from './services/autoSyncService';
import { realConnectionService } from './services/realConnectionService';
import { realtimeSyncService } from './services/realtimeSyncService';
import { syncQueue } from './services/syncQueueService';
import { tauriExitManager } from './services/tauriExitManager';
import { androidBackButtonService } from './services/androidBackButtonService';
import { adminChatNotificationService } from './services/adminChatNotificationService';
import { AuthService } from './services/authService';
import { ActivationDashboard } from './components/ActivationDashboard';
import { DesktopSetupWizard } from './components/DesktopSetupWizard';
import { TrialLimitModal } from './components/TrialLimitModal';
import { AndroidCommercialHubModal } from './components/AndroidCommercialHubModal';
import { SplashScreen } from './components/SplashScreen';
import { ClientBroadcastHub } from './components/ClientBroadcastHub';
import { SmartPasswordRecoveryModal } from './components/SmartPasswordRecoveryModal';
import { TrialDataProtectionWarningBanner } from './components/TrialDataProtectionWarningBanner';
import { SplashAnnouncement } from './components/SplashAnnouncement';
import { WindowsSafetyOnboardingModal } from './components/WindowsSafetyOnboardingModal';
import { AppDialogModal } from './components/AppDialogModal';
import { AccountingLogo } from './components/AccountingLogo';
import { dialogService } from './services/dialogService';
import { UpdateCenter } from './pages/UpdateCenter';
import { workspaceService } from './services/workspaceService';
import { isDesktopApp, isAndroidApp, isMotherWebPortal } from './utils';
import { FEATURES } from './config';
import { Lock, User as UserIcon, LogIn, PenTool, Loader2, WifiOff, Cloud, RefreshCw, KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';

// Helper to retry lazy loaded components on dynamic import failure
const lazyWithRetry = <T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) =>
    lazy(async () => {
        const pageKey = 'chunk_reload_' + window.location.hash;
        const pageHasBeenReloaded = sessionStorage.getItem(pageKey);
        try {
            const component = await factory();
            sessionStorage.removeItem(pageKey);
            return component;
        } catch (error) {
            if (!pageHasBeenReloaded) {
                sessionStorage.setItem(pageKey, 'true');
                window.location.reload();
                return new Promise(() => {}) as any;
            }
            throw error;
        }
    });

// Lazy loaded components
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Invoices = lazyWithRetry(() => import('./pages/Invoices'));
const Inventory = lazyWithRetry(() => import('./pages/Inventory'));
const Checks = lazyWithRetry(() => import('./pages/Checks'));
const Customers = lazyWithRetry(() => import('./pages/Customers'));
const Finance = lazyWithRetry(() => import('./pages/Finance'));
const Reports = lazyWithRetry(() => import('./pages/Reports'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Users = lazyWithRetry(() => import('./pages/Users'));
const Help = lazyWithRetry(() => import('./pages/Help'));
const InstallAndroid = lazyWithRetry(() => import('./pages/InstallAndroid'));
const SimpleSignaturePage = lazyWithRetry(() => import('./pages/SimpleSignaturePage'));
const RemoteSignaturePage = lazyWithRetry(() => import('./pages/RemoteSignaturePage'));
const SignatureManagement = lazyWithRetry(() => import('./pages/SignatureManagement'));
const SignatureManagementDashboard = lazyWithRetry(() => import('./pages/SignatureManagementDashboard'));
const Contracts = lazyWithRetry(() => import('./pages/Contracts'));
const FiscalYear = lazyWithRetry(() => import('./pages/FiscalYear'));
const MarketingHub = lazyWithRetry(() => import('./pages/MarketingHub'));
const CatalogPage = lazyWithRetry(() => import('./pages/CatalogPage'));
const ImportCenter = lazyWithRetry(() => import('./pages/ImportCenter'));
const DebugCenter = lazyWithRetry(() => import('./pages/DebugCenter'));
const LicenseManager = lazyWithRetry(() => import('./pages/LicenseManager'));

// ماژول‌های تجاری و ابری پیشرفته
const MoadianTaxHub = lazyWithRetry(() => import('./pages/MoadianTaxHub'));
const PosTerminalManagement = lazyWithRetry(() => import('./pages/PosTerminalManagement'));
const CloudBackupVault = lazyWithRetry(() => import('./pages/CloudBackupVault'));
const SmsMarketingHub = lazyWithRetry(() => import('./pages/SmsMarketingHub'));
const MultiUserLanHub = lazyWithRetry(() => import('./pages/MultiUserLanHub'));
const SlaSupportContracts = lazyWithRetry(() => import('./pages/SlaSupportContracts'));

// صفحات مالی حرفهای
const DoubleEntryAccounting = lazyWithRetry(() => import('./pages/DoubleEntryAccounting'));
const CashFlowManagement = lazyWithRetry(() => import('./pages/CashFlowManagement'));
const TaxManagement = lazyWithRetry(() => import('./pages/TaxManagement'));
const ProjectManagement = lazyWithRetry(() => import('./pages/ProjectManagement'));
const FixedAssetsManagement = lazyWithRetry(() => import('./pages/FixedAssetsManagement'));
const BudgetManagement = lazyWithRetry(() => import('./pages/BudgetManagement'));
const LoanManagement = lazyWithRetry(() => import('./pages/LoanManagement'));
const JalaliDueCalendar = lazyWithRetry(() => import('./components/JalaliDueCalendar'));
const BankReconciliation = lazyWithRetry(() => import('./pages/BankReconciliation'));
const MultiCurrencyManagement = lazyWithRetry(() => import('./pages/MultiCurrencyManagement'));
const AdvancedFinancialReports = lazyWithRetry(() => import('./pages/AdvancedFinancialReports'));
const AIFinancialAssistant = lazyWithRetry(() => import('./pages/AIFinancialAssistant'));
const DataSyncManager = lazyWithRetry(() => import('./pages/DataSyncManager'));
const AdvancedSettings = lazyWithRetry(() => import('./pages/AdvancedSettings'));
const AccountingWorkflowRules = lazyWithRetry(() => import('./pages/AccountingWorkflowRules'));
const MobileCatalog = lazyWithRetry(() => import('./pages/MobileCatalog'));
const CashFlowPredictor = lazyWithRetry(() => import('./pages/CashFlowPredictor'));
import { AndroidSmsRelayModal } from './components/AndroidSmsRelayModal';

const LoadingFallback = () => (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-teal-400 animate-fade-in">
        <Loader2 size={48} className="animate-spin mb-4" />
        <span className="text-xs font-black tracking-widest uppercase">در حال بارگذاری هوشمند...</span>
    </div>
);

const LazyComponentWrapper = ({ children }: { children: React.ReactNode }) => (
    <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
            {children}
        </Suspense>
    </ErrorBoundary>
);

const ConnectionStatus = () => {
    const { isOnline } = useStore();
    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[2000] bg-rose-600/90 backdrop-blur-md py-1.5 px-4 flex items-center justify-center gap-2 animate-slide-down no-print">
            <WifiOff size={14} className="text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">شما آفلاین هستید - تغییرات در حافظه محلی ذخیره می‌شوند</span>
        </div>
    );
};

const LoginPage = () => {
    const { login, users, addUser, updateUser } = useStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [setupFullName, setSetupFullName] = useState('');
    const [setupUsername, setSetupUsername] = useState('');
    const [setupEmail, setSetupEmail] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
    const [setupMessage, setSetupMessage] = useState('');
    const [usersHydrated, setUsersHydrated] = useState(() => useStore.persist.hasHydrated());

    // Do not offer first-run setup until the asynchronous persisted store has loaded.
    useEffect(() => {
        if (useStore.persist.hasHydrated()) {
            setUsersHydrated(true);
            return;
        }
        return useStore.persist.onFinishHydration(() => setUsersHydrated(true));
    }, []);

    // Remove only the exact legacy demo accounts created with the known default password.
    // User-created administrator accounts with a different password are preserved.
    useEffect(() => {
        if (!usersHydrated || workspaceService.isRemoteCloudConfigured()) return;
        const storedUsers = useStore.getState().users || [];
        const legacyDefaultHash = securityService.hashPassword('123');
        const safeUsers = storedUsers.filter(user => {
            const cleanUsername = (user.username || '').trim().toLowerCase();
            const seededName = cleanUsername === 'admin' || cleanUsername === 'user';
            const seededPassword = user.password === '123' || user.hashedPassword === legacyDefaultHash;
            return !(seededName && seededPassword);
        });
        if (safeUsers.length !== storedUsers.length) {
            useStore.setState({ users: safeUsers });
        }
    }, [usersHydrated]);

    // همگام‌سازی خودکار حساب‌های کاربری با سرور مرکزی ابری هنگام بارگذاری (صرفاً در صورت اتصال و پیکربندی صریح سرور)
    useEffect(() => {
        let isMounted = true;
        const fetchRemoteUsers = async () => {
            if (!navigator.onLine || !workspaceService.isRemoteCloudConfigured()) return;
            try {
                setIsSyncing(true);
                await autoSyncService.syncUsersOnly();
                if (isMounted) {
                    setSyncMessage('اطلاعات کاربران با هاست ابری همگام است');
                }
            } catch (err) {
                console.warn('Sync users error on login page:', err);
            } finally {
                if (isMounted) setIsSyncing(false);
            }
        };

        fetchRemoteUsers();
        return () => { isMounted = false; };
    }, []);

    const needsInitialSetup = usersHydrated && users.length === 0 && !workspaceService.isRemoteCloudConfigured();

    const handleCreateInitialAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSetupMessage('');

        const cleanUsername = setupUsername.trim();
        const cleanName = setupFullName.trim();
        const cleanEmail = setupEmail.trim();

        if (!cleanName) {
            setError('نام کامل مدیر را وارد کنید.');
            return;
        }
        if (cleanUsername.length < 4 || /\s/.test(cleanUsername)) {
            setError('نام کاربری باید حداقل ۴ نویسه و بدون فاصله باشد.');
            return;
        }
        if (setupPassword.length < 12) {
            setError('برای حساب مدیر، رمز عبور باید حداقل ۱۲ نویسه داشته باشد.');
            return;
        }
        if (setupPassword !== setupPasswordConfirm) {
            setError('رمز عبور و تکرار آن یکسان نیستند.');
            return;
        }
        if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError('قالب ایمیل معتبر نیست.');
            return;
        }
        if ((useStore.getState().users || []).length > 0) {
            setError('حساب کاربری از قبل ایجاد شده است؛ صفحه را تازه‌سازی کنید و وارد شوید.');
            return;
        }

        const adminRole = useStore.getState().roles.find((role: any) => role.id === 'admin');
        if (!adminRole) {
            setError('نقش مدیر سیستم یافت نشد. تنظیمات اولیه را بررسی کنید.');
            return;
        }

        try {
            const createdUser = AuthService.createUser({
                username: cleanUsername,
                fullName: cleanName || 'مدیر سیستم',
                roleId: 'admin',
                permissions: adminRole.permissions,
                is_active: true,
                email: cleanEmail || undefined,
                password: setupPassword
            });
            addUser(createdUser);
            setUsername(cleanUsername);
            setPassword('');
            setSetupPassword('');
            setSetupPasswordConfirm('');
            setSetupMessage('حساب مدیر ساخته شد. اکنون با رمز انتخاب‌شده وارد شوید. اگر ایمیل بازیابی ثبت نکرده‌اید، آن را از تنظیمات کاربر تکمیل کنید.');
        } catch {
            setError('ساخت حساب مدیر انجام نشد؛ لطفاً دوباره تلاش کنید.');
        }
    };

    const handleManualSync = async () => {
        if (!workspaceService.isRemoteCloudConfigured()) {
            setSyncMessage('برنامه در حالت محلی مستقل و خام است (جهت اتصال، ابتدا آدرس سرور و توکن را وارد نمایید)');
            return;
        }
        setIsSyncing(true);
        setSyncMessage('در حال اتصال به سرور و دریافت اطلاعات...');
        try {
            const ok = await autoSyncService.syncUsersOnly();
            if (ok) {
                setSyncMessage('کاربران و اطلاعات با موفقیت از هاست دریافت شدند');
            } else {
                setSyncMessage('دسترسی به سرور برقرار است');
            }
        } catch (e) {
            setSyncMessage('خطا در ارتباط با سرور ابری');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSyncing(true);

        try {
            // ۱. بررسی با کاربران موجود در حافظه محلی
            let currentUsers = useStore.getState().users || [];
            let user = AuthService.validateCredentials(username, password, currentUsers);

            // ۲. اگر در این دستگاه یافت نشد (دستگاه جدید یا دوم)، فقط در صورت پیکربندی سرور از هاست دریافت کن
            if (!user && navigator.onLine && workspaceService.isRemoteCloudConfigured()) {
                setSyncMessage('کاربر در این سیستم یافت نشد. در حال بررسی با سرور مرکزی...');
                await autoSyncService.syncUsersOnly();
                currentUsers = useStore.getState().users || [];
                user = AuthService.validateCredentials(username, password, currentUsers);
            }

            if (user) {
                const existingUser = useStore.getState().users.find(u => u.id === user!.id);
                if (existingUser && (!securityService.isPasswordHashV2(existingUser.hashedPassword) || existingUser.password)) {
                    updateUser(existingUser.id, { password });
                    user = useStore.getState().users.find(u => u.id === existingUser.id) || user;
                }
                if (user.password) {
                    const { password: _legacyPassword, ...safeUser } = user;
                    user = safeUser as typeof user;
                }
                login(user);
                // بارگذاری تمام فاکتورها، حساب‌ها و اسناد تنها در صورت پیکربندی و اتصال صریح به سرور
                if (workspaceService.isRemoteCloudConfigured()) {
                    autoSyncService.loadFromHost().catch(() => {});
                }
            } else {
                setError('نام کاربری یا رمز عبور اشتباه است.');
            }
        } catch (err) {
            setError('خطا در ورود به سامانه');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#111827] flex items-start sm:items-center justify-center p-3 sm:p-6 pb-8 relative overflow-x-hidden overflow-y-auto overscroll-y-contain font-sans" dir="rtl">
            <div className="fixed top-4 left-4 z-50">
                <SmartSectionGuide customPath="/login" />
            </div>

            <div className="hidden sm:block absolute -top-[20%] -right-[10%] w-[700px] h-[700px] bg-teal-900/20 rounded-full blur-[100px] opacity-40"></div>
            <div className="w-full max-w-md bg-slate-900 border border-white/20 p-5 sm:p-8 rounded-3xl shadow-2xl animate-fade-in relative z-10 mb-4">
                <div className="flex flex-col items-center mb-8">
                    <AccountingLogo size="lg" className="mb-4" />
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">اشک قلم کلود</h1>
                    <p className="text-teal-400 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                        سامانه متمرکز چند دستگاهی و ابری
                    </p>
                </div>

                {/* وضعیت همگام‌سازی ابری */}
                <div className="mb-6 p-3 bg-slate-950/70 border border-white/5 rounded-2xl flex items-center justify-between gap-3 text-xs text-slate-300">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Cloud size={16} className={isSyncing ? "text-amber-400 animate-pulse" : "text-teal-400"} />
                        <span className="truncate text-[11px]">
                            {syncMessage || 'همگام‌سازی ابری فعال است'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        title="همگام‌سازی با سرور ابری"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                        <RefreshCw size={13} className={isSyncing ? "animate-spin text-teal-400" : ""} />
                        <span>سینک</span>
                    </button>
                </div>

                {setupMessage && (
                    <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold">
                        {setupMessage}
                    </div>
                )}

                {!usersHydrated && !workspaceService.isRemoteCloudConfigured() ? (
                    <div className="flex items-center justify-center gap-3 py-10 text-slate-300 text-sm">
                        <Loader2 size={20} className="animate-spin text-teal-400" />
                        <span>در حال بررسی حساب‌های ذخیره‌شده…</span>
                    </div>
                ) : needsInitialSetup ? (
                    <form onSubmit={handleCreateInitialAdmin} className="space-y-3.5 sm:space-y-4">
                        <div className="rounded-xl p-3.5 bg-slate-950 border border-teal-400/40 space-y-1">
                            <p className="text-sm font-extrabold text-white">راه‌اندازی اولیه مدیر</p>
                            <p className="text-sm leading-6 text-slate-200">این فرم فقط برای ساخت اولین حساب مدیر است. هیچ نام کاربری یا رمز عبور پیش‌فرضی وجود ندارد.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="setup-admin-fullname" className="block text-sm font-extrabold text-white">نام کامل مدیر (الزامی)</label>
                            <input id="setup-admin-fullname" type="text" autoComplete="name" className="w-full bg-slate-950 border border-white/35 rounded-2xl p-3.5 min-h-12 text-base text-white placeholder:text-slate-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20" placeholder="مثلاً: علی رضایی" value={setupFullName} required onChange={e => setSetupFullName(e.target.value)} />
                            <p className="text-sm leading-6 text-slate-300">نامی که در حساب کاربری و سوابق مدیریتی نمایش داده می‌شود.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="setup-admin-username" className="block text-sm font-extrabold text-white">نام کاربری (الزامی)</label>
                            <input id="setup-admin-username" type="text" autoComplete="username" minLength={4} className="w-full bg-slate-950 border border-white/35 rounded-2xl p-3.5 min-h-12 text-base text-white placeholder:text-slate-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 font-mono" placeholder="حداقل ۴ نویسه؛ برای ورود استفاده می‌شود" value={setupUsername} onChange={e => setSetupUsername(e.target.value)} required />
                            <p className="text-sm leading-6 text-slate-300">شناسه ورود مدیر است؛ آن را به دیگران ندهید.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="setup-admin-email" className="block text-sm font-extrabold text-white">ایمیل بازیابی (اختیاری)</label>
                            <input id="setup-admin-email" type="email" autoComplete="email" className="w-full bg-slate-950 border border-white/35 rounded-2xl p-3.5 min-h-12 text-base text-white placeholder:text-slate-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20" placeholder="name@example.com" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} />
                            <p className="text-sm leading-6 text-slate-300">برای بازیابی دسترسی لازم است؛ اگر وارد نکنید، بعداً از تنظیمات تکمیلش کنید.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="setup-admin-password" className="block text-sm font-extrabold text-white">رمز عبور مدیر (الزامی)</label>
                            <input id="setup-admin-password" type="password" autoComplete="new-password" minLength={12} className="w-full bg-slate-950 border border-white/35 rounded-2xl p-3.5 min-h-12 text-base text-white placeholder:text-slate-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 font-mono" placeholder="حداقل ۱۲ نویسه" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} required />
                            <p className="text-sm leading-6 text-slate-300">حداقل ۱۲ نویسه و ترجیحاً عبارت عبور طولانی و منحصربه‌فرد انتخاب کنید.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="setup-admin-password-confirm" className="block text-sm font-extrabold text-white">تکرار رمز عبور (الزامی)</label>
                            <input id="setup-admin-password-confirm" type="password" autoComplete="new-password" minLength={12} className="w-full bg-slate-950 border border-white/35 rounded-2xl p-3.5 min-h-12 text-base text-white placeholder:text-slate-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 font-mono" placeholder="رمز انتخاب‌شده را دوباره وارد کنید" value={setupPasswordConfirm} onChange={e => setSetupPasswordConfirm(e.target.value)} required />
                            <p className="text-sm leading-6 text-slate-300">باید دقیقاً با رمز عبور بالا یکسان باشد.</p>
                        </div>
                        {error && <div className="text-rose-400 text-xs text-center font-bold bg-rose-500/10 py-3 px-4 rounded-xl border border-rose-500/20">{error}</div>}
                        <button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-teal-900/30 transition-all flex items-center justify-center gap-2">
                            <ShieldCheck size={20} />
                            <span>ایجاد حساب امن مدیر</span>
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 pr-2 font-bold flex items-center gap-1.5">
                            <UserIcon size={14} className="text-teal-400" />
                            نام کاربری
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-950/90 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-teal-500 font-mono transition-all text-left placeholder:text-slate-600" 
                            placeholder="username"
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 pr-2 font-bold flex items-center gap-1.5">
                            <Lock size={14} className="text-teal-400" />
                            رمز عبور
                        </label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-950/90 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-teal-500 font-mono transition-all text-left placeholder:text-slate-600" 
                            placeholder="••••••••"
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    {error && (
                        <div className="text-rose-400 text-xs text-center font-bold bg-rose-500/10 py-3 px-4 rounded-xl border border-rose-500/20">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isSyncing}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>در حال ورود و بررسی...</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>ورود به پنل کاربری</span>
                            </>
                        )}
                    </button>
                    </form>
                )}

                {/* پیوند بازیابی هوشمند رمز عبور */}
                <div className="mt-5 text-center">
                    <button
                        type="button"
                        onClick={() => setShowRecoveryModal(true)}
                        className="w-full py-2.5 px-4 bg-slate-950/40 hover:bg-teal-500/10 border border-white/5 hover:border-teal-500/30 rounded-2xl text-xs text-teal-400 hover:text-teal-300 font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                        <KeyRound size={15} className="text-teal-400" />
                        <span>فراموشی رمز عبور؟ (بازیابی هوشمند با ایمیل یا کد پشتیبان)</span>
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 text-center flex flex-col items-center gap-1">
                    <p className="text-[11px] text-slate-400">امکان اتصال همزمان چندین سیستم • پشتیبان‌گیری ابری و آفلاین</p>
                    <p className="text-[10px] text-teal-400 font-semibold tracking-wide"><a href="https://ashkghalam.ir" target="_blank" rel="noreferrer" className="hover:underline underline-offset-2">ashkghalam.ir</a></p>
                </div>
            </div>

            {/* مدال بازیابی هوشمند رمز عبور */}
            <SmartPasswordRecoveryModal
                isOpen={showRecoveryModal}
                onClose={() => setShowRecoveryModal(false)}
                initialUsername={username}
                onSuccess={(u, p) => {
                    setUsername(u);
                    setPassword(p);
                    setError('');
                    setSyncMessage('رمز عبور با موفقیت بازنشانی شد. اکنون می‌توانید وارد شوید.');
                }}
            />
        </div>
    );
};

// سیستم هوشمند پیش‌بارگذاری مسیرمحور (Route-Aware Preloader) برای اولویت‌بندی لود صفحات بر اساس موقعیت کاربر
const preloadedRouteSet = new Set<string>();

const executeIdlePreload = (loader: () => Promise<any>, key: string, delayMs = 0) => {
    if (preloadedRouteSet.has(key)) return;
    preloadedRouteSet.add(key);

    const run = () => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                loader().catch(() => {});
            }, { timeout: 3000 });
        } else {
            setTimeout(() => {
                loader().catch(() => {});
            }, 300);
        }
    };

    if (delayMs > 0) {
        setTimeout(run, delayMs);
    } else {
        run();
    }
};

const useSmartRoutePreloader = () => {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;

        // On phones and native Android WebView, background-prefetching several large
        // accounting modules competes with first paint and makes startup feel slow.
        // Let mobile load only the route the user actually opened.
        if (
            typeof window !== 'undefined' &&
            (isAndroidApp() || window.matchMedia('(max-width: 768px)').matches)
        ) {
            return;
        }

        switch (path) {
            case '/':
            case '':
                // کاربر در پیشخوان: اولویت ۱: گزارشات مالی و فاکتورها، اولویت ۲: مالی و اسناد دریافتنی
                executeIdlePreload(() => import('./pages/Reports'), 'Reports', 100);
                executeIdlePreload(() => import('./pages/AdvancedFinancialReports'), 'AdvancedFinancialReports', 350);
                executeIdlePreload(() => import('./pages/Invoices'), 'Invoices', 700);
                executeIdlePreload(() => import('./pages/Finance'), 'Finance', 1200);
                executeIdlePreload(() => import('./pages/Checks'), 'Checks', 1600);
                break;

            case '/invoices':
                // کاربر در فاکتورها: اولویت ۱: مشتریان، انبار، سامانه مؤدیان و کارتخوان
                executeIdlePreload(() => import('./pages/Customers'), 'Customers', 100);
                executeIdlePreload(() => import('./pages/Inventory'), 'Inventory', 300);
                executeIdlePreload(() => import('./pages/MoadianTaxHub'), 'MoadianTaxHub', 600);
                executeIdlePreload(() => import('./pages/PosTerminalManagement'), 'PosTerminalManagement', 900);
                executeIdlePreload(() => import('./pages/SignatureManagement'), 'SignatureManagement', 1200);
                break;

            case '/reports':
            case '/financial-reports':
                // کاربر در گزارشات: هوش مصنوعی، حسابداری دوبل و جریان نقدینگی
                executeIdlePreload(() => import('./pages/AIFinancialAssistant'), 'AIFinancialAssistant', 100);
                executeIdlePreload(() => import('./pages/DoubleEntryAccounting'), 'DoubleEntryAccounting', 350);
                executeIdlePreload(() => import('./pages/CashFlowManagement'), 'CashFlowManagement', 700);
                break;

            case '/checks':
                // کاربر در چک‌ها: تقویم سررسید، مغایرت بانکی و امور مالی
                executeIdlePreload(() => import('./components/JalaliDueCalendar'), 'JalaliDueCalendar', 100);
                executeIdlePreload(() => import('./pages/BankReconciliation'), 'BankReconciliation', 300);
                executeIdlePreload(() => import('./pages/Finance'), 'Finance', 600);
                break;

            case '/customers':
                // کاربر در اشخاص: فاکتورها، پیامک و قراردادها
                executeIdlePreload(() => import('./pages/Invoices'), 'Invoices', 100);
                executeIdlePreload(() => import('./pages/SmsMarketingHub'), 'SmsMarketingHub', 350);
                executeIdlePreload(() => import('./pages/Contracts'), 'Contracts', 700);
                break;

            case '/inventory':
                executeIdlePreload(() => import('./pages/Invoices'), 'Invoices', 100);
                executeIdlePreload(() => import('./pages/FixedAssetsManagement'), 'FixedAssetsManagement', 400);
                break;

            case '/settings':
            case '/advanced-settings':
                executeIdlePreload(() => import('./pages/FiscalYear'), 'FiscalYear', 100);
                executeIdlePreload(() => import('./pages/LicenseManager'), 'LicenseManager', 300);
                executeIdlePreload(() => import('./pages/DataSyncManager'), 'DataSyncManager', 600);
                break;

            default:
                executeIdlePreload(() => import('./pages/Dashboard'), 'Dashboard', 200);
                executeIdlePreload(() => import('./pages/Invoices'), 'Invoices', 500);
                break;
        }
    }, [location.pathname]);
};

const MainAppLayout: React.FC = () => {
    const { isMaxTableMode } = useResponsiveLayout();
    const { theme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const isLight = theme.mode === 'light';

    const handlePageBack = () => {
        const historyIndex = Number((window.history.state as { idx?: number } | null)?.idx ?? 0);
        if (historyIndex > 0) navigate(-1);
        else navigate('/');
    };

    // اجرای پیش‌بارگذاری هوشمند وابسته به مسیر فعلی
    useSmartRoutePreloader();

    return (
        <div className={`min-h-screen flex font-sans overflow-x-hidden ${isLight ? 'bg-[#f1f5f9] text-slate-900' : 'bg-[#111827] text-slate-100'}`} dir="rtl">
            <EnvironmentIndicator />
            <HostDatabaseSync />
            <RealtimeSyncIndicator />
            <Sidebar />
            <main className={`flex-1 transition-all duration-300 ${
                isMaxTableMode 
                    ? 'p-1.5 sm:p-2.5 pt-10 md:mr-64 md:p-6 md:pt-11' 
                    : 'p-3 sm:p-4 pt-10 md:p-10 md:pt-11 md:mr-64'
            }`}>
                {location.pathname !== '/' && (
                    <div className="mb-3 flex items-center justify-start no-print">
                        <button
                            type="button"
                            onClick={handlePageBack}
                            aria-label="بازگشت به صفحه قبلی"
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-bold text-slate-200 shadow-sm transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <ArrowRight size={17} />
                            <span>بازگشت</span>
                        </button>
                    </div>
                )}
                <TrialDataProtectionWarningBanner />
                <ErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/invoices" element={<Invoices />} />
                            <Route path="/inventory" element={<Inventory />} />
                            <Route path="/checks" element={<Checks />} />
                            <Route path="/finance" element={<Finance />} />
                            <Route path="/customers" element={<Customers />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/users" element={<Users />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/help" element={<Help />} />
                            
                            {/* مسیرهای مالی حرفهای */}
                            <Route path="/accounting" element={<DoubleEntryAccounting />} />
                            <Route path="/cashflow" element={<CashFlowManagement />} />
                            <Route path="/tax" element={<TaxManagement />} />
                            <Route path="/projects" element={<ProjectManagement />} />
                            <Route path="/assets" element={<FixedAssetsManagement />} />
                            <Route path="/budget" element={<BudgetManagement />} />
                            <Route path="/loans" element={<LoanManagement />} />
                            <Route path="/due-calendar" element={<JalaliDueCalendar />} />
                            <Route path="/bank-reconciliation" element={<BankReconciliation />} />
                            <Route path="/currency" element={<MultiCurrencyManagement />} />
                            <Route path="/financial-reports" element={<AdvancedFinancialReports />} />
                            <Route path="/ai-assistant" element={<AIFinancialAssistant />} />
                            <Route path="/data-sync" element={<DataSyncManager />} />
                            <Route path="/advanced-settings" element={<AdvancedSettings />} />
                            <Route path="/signature-management" element={<SignatureManagement />} />
                            <Route path="/signature-dashboard" element={<SignatureManagementDashboard />} />
                            <Route path="/contracts" element={<Contracts />} />
                            <Route path="/fiscal-year" element={<FiscalYear />} />
                            <Route path="/security" element={<Navigate to="/settings" replace />} />
                            <Route path="/workflow-rules" element={<AccountingWorkflowRules />} />
                            <Route path="/marketing" element={<MarketingHub />} />
                            <Route path="/catalog" element={<CatalogPage />} />
                            <Route path="/import-center" element={<ImportCenter />} />
                            <Route path="/debug-center" element={isMotherWebPortal() ? <DebugCenter /> : <Navigate to="/" replace />} />
                            <Route path="/license-manager" element={isMotherWebPortal() ? <LicenseManager /> : <Navigate to="/" replace />} />
                            <Route path="/client-broadcast" element={<ClientBroadcastHub />} />
                            
                            {/* ماژول‌های تجاری و ابری */}
                            <Route path="/mobile-catalog" element={<MobileCatalog />} />
                            <Route path="/sales-rep" element={<MobileCatalog />} />
                            <Route path="/cashflow-predictor" element={<CashFlowPredictor />} />
                            <Route path="/moadian" element={<MoadianTaxHub />} />
                            <Route path="/pos-terminal" element={<PosTerminalManagement />} />
                            <Route path="/cloud-vault" element={<CloudBackupVault />} />
                            <Route path="/sms-center" element={<SmsMarketingHub />} />
                            <Route path="/multi-user-lan" element={<MultiUserLanHub />} />
                            <Route path="/support-sla" element={<SlaSupportContracts />} />
                            <Route path="/updates" element={<UpdateCenter />} />
                            
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </main>
            <AndroidSmsRelayModal />
            <MobileNav />
            <QuickActionFAB />
            <SupportChat />
            <div className="fixed inset-0 z-[-1] pointer-events-none opacity-40">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-900/10 rounded-full blur-[120px]"></div>
            </div>
        </div>
    );
};

/**
 * تابع پاکسازی کش و بازنشانی جامع (Clear Cache and Reset Utility)
 * پاک کردن کامل localStorage، IndexedDB و sessionStorage جهت تضمین یک شروع کاملاً خام (Clean Slate)
 */
export async function clearCacheAndResetApp(): Promise<void> {
    try {
        if (typeof window !== 'undefined') {
            sessionStorage.clear();
            sessionStorage.setItem('system_reset', 'true');
            localStorage.clear();

            if (window.indexedDB && window.indexedDB.databases) {
                try {
                    const dbs = await window.indexedDB.databases();
                    for (const db of dbs) {
                        if (db.name) {
                            window.indexedDB.deleteDatabase(db.name);
                        }
                    }
                } catch (_) {
                    window.indexedDB.deleteDatabase('AshkeGhalamDB');
                    window.indexedDB.deleteDatabase('AshkeGhalamOfflineDB');
                }
            } else {
                window.indexedDB.deleteDatabase('AshkeGhalamDB');
                window.indexedDB.deleteDatabase('AshkeGhalamOfflineDB');
            }

            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            }

            window.location.reload();
        }
    } catch (err) {
        console.error('Reset error:', err);
        window.location.reload();
    }
}

if (typeof window !== 'undefined') {
    (window as any).clearCacheAndResetApp = clearCacheAndResetApp;
}

const App = () => {
  const currentUser = useStore(state => state.currentUser);
  const logout = useStore(state => state.logout);

  // سیستم مدیریت نشست و خروج خودکار پس از ۱۵ دقیقه بیکاری
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        dialogService.showSessionTimeout(() => {
          logout();
        });
      }, 15 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser, logout]);

  useEffect(() => {
    // راهاندازی IndexedDB
    idbService.init().catch(() => {});
    
    // راهاندازی سرویس تشخیص اتصال واقعی با تاخیر کوتاه
    const initConnection = setTimeout(() => {
      const unsubscribe = realConnectionService.subscribe((isOnline) => {
        useStore.getState().setOnlineStatus(isOnline);
      });
      
      // فورس چک اولیه
      realConnectionService.forceCheck();
    }, 100);
    
    // بررسی فلگ ریست
    const resetFlag = sessionStorage.getItem('system_reset');
    if (resetFlag) {
      return () => {
        clearTimeout(initConnection);
        realConnectionService.stopMonitoring();
      };
    }
    
    // شروع سرویس‌های همگام‌سازی ابری تنها در صورتی که اتصال به سرور پیکربندی و تایید شده باشد
    if (workspaceService.isRemoteCloudConfigured()) {
      if (FEATURES.ENABLE_CROSS_DEVICE_SYNC) {
        crossDeviceSync.startAutoSync();
      }
      if (FEATURES.ENABLE_AUTO_SYNC) {
        autoSyncService.start();
      }
      realtimeSyncService.start();
    }
    
    // شروع پشتیبانگیری خودکار
    if (currentUser && FEATURES.ENABLE_AUTO_BACKUP) {
      autoBackupService.start(() => useStore.getState());
    }

    // راه‌اندازی مدیر خروج دسکتاپ و تاوری
    tauriExitManager.init(() => useStore.getState());

    // راه‌اندازی مدیر دکمه بازگشت فیزیکی اندروید
    androidBackButtonService.init((msg) => {
      useStore.getState().addNotification('info', msg);
    });

    // پایش هوشمند پیام‌های چت پشتیبانی و نوتیفیکیشن زنده برای ادمین و سیستم
    // Standalone desktop builds should not poll the hosted support API every 12 seconds.
    // Live support notifications start only when the owner explicitly configured a remote workspace.
    if (currentUser && workspaceService.isRemoteCloudConfigured()) {
      adminChatNotificationService.startMonitoring(isAndroidApp() ? 12000 : 30000);
    }

    // شروع پردازش دوره‌ای صف سینک - هر ۲ دقیقه (صرفاً در صورت اتصال به سرور)
    const queueTimer = setInterval(() => {
      if (navigator.onLine && workspaceService.isRemoteCloudConfigured()) {
        syncQueue.processQueue().catch(() => {});
      }
    }, 2 * 60 * 1000); // هر ۲ دقیقه

    // پردازش فوری هنگام اولیه در صورت اتصال به سرور
    if (workspaceService.isRemoteCloudConfigured()) {
      setTimeout(() => syncQueue.processQueue().catch(() => {}), 3000);
    }
    
    return () => {
      clearTimeout(initConnection);
      clearInterval(queueTimer);
      autoBackupService.stop();
      if (FEATURES.ENABLE_CROSS_DEVICE_SYNC) {
        crossDeviceSync.stopAutoSync();
      }
      if (FEATURES.ENABLE_AUTO_SYNC) {
        autoSyncService.stop();
      }
      realtimeSyncService.stop();
      adminChatNotificationService.stopMonitoring();
      realConnectionService.stopMonitoring();
    };
  }, [currentUser]);

  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationPrefill, setActivationPrefill] = useState<{ licenseKey?: string; companyName?: string; workspaceId?: string }>({});
  const [showAndroidCommercialModal, setShowAndroidCommercialModal] = useState(false);
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false);
  const [trialLimitReason, setTrialLimitReason] = useState<'CUSTOMERS_LIMIT' | 'DOCUMENTS_LIMIT' | 'USERS_LIMIT' | 'MANUAL'>('MANUAL');
  const [showSetupWizard, setShowSetupWizard] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!isDesktopApp()) {
      localStorage.setItem('ashk_initial_setup_done', 'true');
      // سرور وب/هاست به عنوان سیستم مادر فعال است، اما اندروید در حالت پیش‌فرض با سقف ۵۰ سند شروع می‌شود
      if (!isAndroidApp()) {
        localStorage.setItem('ashk_license_status', 'ACTIVATED');
        localStorage.setItem('ashk_mother_server', 'true');
      }
      return false;
    }
    return localStorage.getItem('ashk_initial_setup_done') === null;
  });
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;

    // Mobile users should enter the app immediately instead of waiting through
    // the 2–3 second animated welcome screen on a smaller/less powerful device.
    if (isAndroidApp() || window.matchMedia('(max-width: 768px)').matches) {
      sessionStorage.setItem('ashk_splash_seen', 'true');
      return false;
    }

    const sessionSeen = sessionStorage.getItem('ashk_splash_seen');
    if (!sessionSeen) {
      sessionStorage.setItem('ashk_splash_seen', 'true');
      return true;
    }
    return false;
  });

  // Route-aware preloading is handled by useSmartRoutePreloader on desktop.
  // Avoid importing nine large financial modules during initial startup; mobile WebView
  // should spend its bandwidth and CPU on the active screen only.

  useEffect(() => {
    const handleOpenActivation = (event: Event) => {
      const detail = (event as CustomEvent<{ licenseKey?: string; companyName?: string; workspaceId?: string }>).detail;
      setActivationPrefill(detail && typeof detail === 'object' ? detail : {});
      setShowActivationModal(true);
    };
    const handleOpenAndroidCommercial = () => setShowAndroidCommercialModal(true);
    const handleOpenTrialLimit = (e: any) => {
      if (e.detail?.reason) setTrialLimitReason(e.detail.reason);
      setShowTrialLimitModal(true);
    };

    window.addEventListener('open-activation-dashboard', handleOpenActivation);
    window.addEventListener('open-android-commercial-hub', handleOpenAndroidCommercial);
    window.addEventListener('open-trial-limit-modal', handleOpenTrialLimit);
    return () => {
      window.removeEventListener('open-activation-dashboard', handleOpenActivation);
      window.removeEventListener('open-android-commercial-hub', handleOpenAndroidCommercial);
      window.removeEventListener('open-trial-limit-modal', handleOpenTrialLimit);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        {!showSplash && <SplashAnnouncement />}
        <ToastProvider>
          <HashRouter>
            <ResponsiveLayoutProvider>
              <NotificationBar />
              <ConnectionStatus />
              <WindowsSafetyOnboardingModal />
              <AppDialogModal />
              {showSetupWizard && (
                <DesktopSetupWizard 
                  isOpen={showSetupWizard}
                  onComplete={() => setShowSetupWizard(false)}
                />
              )}
              {showTrialLimitModal && (
                <TrialLimitModal
                  isOpen={showTrialLimitModal}
                  reason={trialLimitReason}
                  onClose={() => setShowTrialLimitModal(false)}
                />
              )}
              {showActivationModal && (
                <ActivationDashboard 
                  isOpen={showActivationModal} 
                  onClose={() => setShowActivationModal(false)}
                  initialLicenseKey={activationPrefill.licenseKey}
                  initialCompanyName={activationPrefill.companyName}
                  initialWorkspaceId={activationPrefill.workspaceId}
                />
              )}
              {showAndroidCommercialModal && (
                <AndroidCommercialHubModal
                  isOpen={showAndroidCommercialModal}
                  onClose={() => setShowAndroidCommercialModal(false)}
                />
              )}
              <Routes>
                <Route path="/install-android" element={
                    <LazyComponentWrapper><InstallAndroid /></LazyComponentWrapper>
                } />
                <Route path="/sign/:token" element={
                    <LazyComponentWrapper><SimpleSignaturePage /></LazyComponentWrapper>
                } />
                <Route path="/remote-sign/:token" element={
                    <LazyComponentWrapper><SimpleSignaturePage /></LazyComponentWrapper>
                } />
                <Route path="/remote-sign" element={
                    <LazyComponentWrapper><RemoteSignaturePage /></LazyComponentWrapper>
                } />
                <Route path="/public-signature/:token" element={
                    <LazyComponentWrapper><SimpleSignaturePage /></LazyComponentWrapper>
                } />
                <Route path="*" element={
                    !currentUser ? <LoginPage /> : <MainAppLayout />
                } />
              </Routes>
            </ResponsiveLayoutProvider>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
