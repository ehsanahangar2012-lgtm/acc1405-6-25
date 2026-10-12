
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { CompanyProfile, SystemConfig } from '../types';
import { generateId, fileToBase64, formatNumber, isDesktopApp, isAndroidApp } from '../utils';
import { smartStorage } from '../services/smartStorageService';
import { 
    Settings as SettingsIcon, Building2, Landmark, ShieldCheck, Palette, 
    Plus, Trash2, CheckCircle2, Upload, Coins, ToggleRight, Database, 
    Fingerprint, MapPin, Phone, Cloud, Wifi, WifiOff, X, Save, 
    PenTool, Unlock, HardDrive, Smartphone, Server, BellRing, 
    MonitorCheck, Percent, CalendarClock, Globe, LogOut, Activity, 
    AlertTriangle, Calendar, FileText, RefreshCw, Layers, Copy, Check, Key, Link, HelpCircle, ArrowLeftRight
} from 'lucide-react';

import BackupManager from '../components/BackupManager';
import FiscalYear from './FiscalYear';
import WorkspaceManager from '../components/WorkspaceManager';
import { CompanyHostSyncService } from '../services/companyHostSyncService';
import { licenseQuotaService } from '../services/licenseQuotaService';

const Settings = () => {
    const { companies, config, updateConfig, addCompany, updateCompany, setActiveCompany, deleteCompany, isOnline, exportBackup, logout, addNotification } = useStore();
    const [activeSection, setActiveSection] = useState<'general' | 'sync' | 'companies' | 'financial' | 'fiscal' | 'advanced' | 'backup' | 'workspace'>('general');
    const [copiedToken, setCopiedToken] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [licenseInputKey, setLicenseInputKey] = useState('');

    const getSyncToken = () => {
        let token = localStorage.getItem('ashk_host_sync_token');
        if (!token) {
            token = `AG-HOST-VAULT-${Math.floor(1000 + Math.random() * 9000)}-SYNC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            localStorage.setItem('ashk_host_sync_token', token);
        }
        return token;
    };

    const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://acc.yourdomain.ir';
    
    // Company Modal State
    const [showAddCompany, setShowAddCompany] = useState(false);
    const [newComp, setNewComp] = useState<Partial<CompanyProfile>>({});

    const handleAddCompany = () => {
        if (!newComp.name) {
            useStore.getState().addNotification('error', 'نام شرکت الزامی است');
            return;
        }
        try {
            addCompany({
                id: generateId(),
                name: newComp.name,
                address: newComp.address || '',
                phone: newComp.phone || '',
                isActive: false,
                ...newComp
            } as CompanyProfile);
            setShowAddCompany(false);
            setNewComp({});
            useStore.getState().addNotification('success', 'شرکت با موفقیت اضافه شد');
        } catch (error) {
            console.error('Add company error:', error);
            useStore.getState().addNotification('error', 'خطا در افزودن شرکت');
        }
    };

    const handleUpload = async (id: string, type: 'logo' | 'stamp' | 'signature', e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        
        try {
            const base64 = await fileToBase64(e.target.files[0]);
            updateCompany(id, { [type]: base64 });
            useStore.getState().addNotification('success', 'فایل با موفقیت بارگذاری شد');
        } catch (error) {
            console.error('File upload error:', error);
            const errorMessage = error instanceof Error ? error.message : 'خطا در بارگذاری فایل';
            useStore.getState().addNotification('error', errorMessage);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 pb-16 min-h-[calc(100vh-6rem)] animate-fade-in">
            {/* Settings Sidebar / Topbar */}
            <aside className="lg:w-72 shrink-0 bg-white dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl lg:rounded-[2.5rem] p-4 lg:p-6 flex flex-col shadow-lg dark:shadow-2xl lg:self-start lg:sticky lg:top-4 z-10">
                <div className="flex items-center gap-3 mb-3 lg:mb-6 px-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                        <SettingsIcon className="text-white" size={20}/>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base lg:text-lg font-black text-slate-900 dark:text-white truncate">کنسول تنظیمات</h2>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase hidden lg:block">System Configuration</p>
                    </div>
                </div>
                
                <nav className="flex lg:flex-col flex-row overflow-x-auto lg:overflow-y-visible gap-1.5 lg:gap-2 custom-scrollbar py-1 lg:py-0 -mx-1 px-1 lg:mx-0 lg:px-0">
                    <SidebarItem active={activeSection === 'general'} onClick={() => setActiveSection('general')} icon={MonitorCheck} label="عمومی و رابط کاربری" />
                    <SidebarItem active={activeSection === 'sync'} onClick={() => setActiveSection('sync')} icon={Server} label="مرکز همگام‌سازی و کد پیوند سرور" />
                    <SidebarItem active={activeSection === 'companies'} onClick={() => setActiveSection('companies')} icon={Building2} label="مدیریت شعب" />
                    <SidebarItem active={activeSection === 'financial'} onClick={() => setActiveSection('financial')} icon={Landmark} label="پیکربندی مالی" />
                    <SidebarItem active={activeSection === 'advanced'} onClick={() => setActiveSection('advanced')} icon={SettingsIcon} label="تنظیمات پیشرفته" />
                    <SidebarItem active={activeSection === 'fiscal'} onClick={() => setActiveSection('fiscal')} icon={Calendar} label="سال مالی" />
                    <SidebarItem active={activeSection === 'workspace'} onClick={() => setActiveSection('workspace')} icon={Layers} label="فضای کاری و استقلال پرتابل" />
                    <SidebarItem active={activeSection === 'backup'} onClick={() => setActiveSection('backup')} icon={HardDrive} label="پشتیبان‌گیری و مدیریت داده" />
                </nav>

                <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-slate-200 dark:border-white/5 space-y-3 hidden lg:block">
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all font-bold text-xs">
                        <LogOut size={16}/> خروج از حساب کاربری
                    </button>
                    <div className="text-center px-1">
                        <p className="text-[9px] text-teal-400 dark:text-teal-300 font-black leading-tight">طراحی و توسعه: دپارتمان IT اشک قلم | www.ashkghalam.ir</p>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl lg:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 xl:p-10 shadow-lg dark:shadow-2xl flex flex-col">
                <div className="flex-1 min-w-0">
                    {!licenseQuotaService.isFullyLicensedSync() && (
                        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={24} className="shrink-0" />
                            <div className="text-xs font-bold leading-relaxed">
                                <span>توجه: برنامه بدون لایسنس فعال و در حالت محدود (سقف ۵۰ سند و ۳۰ مشتری) کار می‌کند. برای دسترسی نامحدود و همگام‌سازی کامل، لایسنس یا توکن ابری را در بخش پیوند سرور وارد کنید.</span>
                            </div>
                        </div>
                    )}

                    {/* --- GENERAL SETTINGS --- */}
                    {activeSection === 'general' && (
                        <div className="space-y-6 sm:space-y-8 animate-fade-in">
                            <SectionHeader title="تنظیمات عمومی" subtitle="شخصی‌سازی تجربه کاربری و تنظیمات پایه" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                <SettingCard title="تم و ظاهر برنامه" icon={Palette} color="text-indigo-600 dark:text-indigo-400">
                                    <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                        {(['DARK', 'LIGHT', 'SYSTEM'] as const).map(theme => (
                                            <button 
                                                key={theme} 
                                                onClick={() => {
                                                    updateConfig({ appTheme: theme });
                                                    useStore.getState().addNotification('success', `پوسته برنامه به حالت ${theme === 'DARK' ? 'تاریک' : theme === 'LIGHT' ? 'روشن' : 'سیستمی'} تغییر یافت.`);
                                                }}
                                                className={`py-2.5 px-2 rounded-lg text-[11px] sm:text-xs font-black transition-all active:scale-95 text-center flex items-center justify-center gap-1 ${config.appTheme === theme ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'}`}
                                            >
                                                {theme === 'DARK' ? '🌙 تاریک' : theme === 'LIGHT' ? '☀️ روشن' : '💻 سیستم'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                                        {config.appTheme === 'LIGHT' ? 'پوسته روشن فعال است (کنتراست بالا و مناسب محیط‌های اداری).' : config.appTheme === 'DARK' ? 'پوسته تاریک فعال است (طراحی تیره و مناسب نور کم).' : 'هماهنگ با تم ویندوز/مرورگر دستگاه شما.'}
                                    </p>
                                </SettingCard>

                                <SettingCard title="فرمت تاریخ و تقویم" icon={CalendarClock} color="text-teal-600 dark:text-teal-400">
                                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                        <button onClick={() => updateConfig({dateFormat: 'JALALI'})} className={`py-2.5 rounded-lg text-xs font-black transition-all ${config.dateFormat === 'JALALI' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>هجری شمسی (جلالی)</button>
                                        <button onClick={() => updateConfig({dateFormat: 'GREGORIAN'})} className={`py-2.5 rounded-lg text-xs font-black transition-all ${config.dateFormat === 'GREGORIAN' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>میلادی (Gregorian)</button>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 font-medium">
                                        {config.dateFormat === 'JALALI' ? 'نمایش تمامی تاریخ‌ها بر مبنای تقویم رسمی هجری شمسی' : 'نمایش تاریخ‌ها بر مبنای تقویم میلادی'}
                                    </p>
                                </SettingCard>
                            </div>

                            <div className="bg-slate-50 dark:bg-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-200 dark:border-white/10">
                                <h3 className="text-slate-900 dark:text-white font-black text-sm mb-4 flex items-center gap-2"><BellRing size={16} className="text-amber-600 dark:text-amber-400"/> اعلان‌ها و پیامک</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                                        <div className="pr-1">
                                            <div className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm mb-1">ارسال پیامک به مشتری</div>
                                            <div className="text-[11px] text-slate-500">ارسال خودکار پیامک هنگام صدور فاکتور</div>
                                        </div>
                                        <Toggle checked={config.smsPanelEnabled} onChange={() => updateConfig({smsPanelEnabled: !config.smsPanelEnabled})} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                                        <div className="pr-1">
                                            <div className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm mb-1">اعلان صوتی</div>
                                            <div className="text-[11px] text-slate-500">پخش صدا هنگام ثبت تراکنش</div>
                                        </div>
                                        <Toggle checked={config.soundEnabled || false} onChange={() => updateConfig({soundEnabled: !config.soundEnabled})} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SERVER SYNC & LINK TOKEN --- */}
                    {activeSection === 'sync' && (
                        <div className="space-y-8 animate-fade-in">
                            <SectionHeader title="مرکز همگام‌سازی و کد پیوند سرور (Sync Token)" subtitle="دریافت کد اتصال اختصاصی جهت همگام‌سازی نسخه ویندوز با دیتابیس وب سرور مادر" />

                            {((isDesktopApp() || isAndroidApp()) && !licenseQuotaService.isFullyLicensedSync()) ? (
                                <div className="bg-amber-500/10 border border-amber-500/30 p-6 md:p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
                                    <div className="flex items-center gap-3 text-amber-500 font-black text-base">
                                        <ShieldCheck size={26}/>
                                        <span>حالت آفلاین امن (بدون ارتباط با سایت و اینترنت)</span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                        برطبق ضوابط امنیتی و اجرایی، نرم‌افزار اندروید و ویندوز هیچ‌گونه ارتباطی با وب‌سایت، هاست یا سرورهای خارجی در حالت آزمایشی ندارد. تمامی داده‌ها صرفاً به صورت محلی ذخیره و پشتیبان‌گیری می‌شوند. جهت نمایش و فعال‌سازی گزینه‌های اتصال به هاست و سینک ابری، لطفاً لایسنس تجاری معتبر خود را وارد نمایید:
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <input 
                                            type="text" 
                                            placeholder="کلید لایسنس تجاری (مثال: AG-LIC-2026-XXXX)" 
                                            value={licenseInputKey}
                                            onChange={(e) => setLicenseInputKey(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono"
                                        />
                                        <button 
                                            onClick={() => {
                                                if (!licenseInputKey.trim()) {
                                                    addNotification('error', 'لطفاً کلید لایسنس را وارد کنید');
                                                    return;
                                                }
                                                licenseQuotaService.activateWithServerLicense({ licenseKey: licenseInputKey.trim(), companyName: 'شرکت تجاری فعال' });
                                                addNotification('success', 'لایسنس با موفقیت تأیید شد! گزینه‌های اتصال به هاست فعال شدند.');
                                                setLicenseInputKey('');
                                            }}
                                            className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl font-black text-xs transition shadow-lg shrink-0"
                                        >
                                            تأیید و فعال‌سازی اتصال
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Token Banner */}
                                    <div className="bg-gradient-to-br from-indigo-900/60 via-slate-900 to-purple-950/80 p-6 md:p-8 rounded-[2.5rem] border border-indigo-500/30 shadow-2xl space-y-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                                            🔑 کد پیوند اختصاصی سرور مادر
                                        </span>
                                        <h3 className="text-xl font-black text-white mt-2">کلید رمزنوشت و اتصال ابری (Sync Token)</h3>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            این کلید رمزنگاری‌شده اختصاصی سرور شماست. با وارد کردن این کد و آدرس هاست در نسخه ویندوزی، دیتابیس لوکال ویندوز مستقیماً به هاست متصل و همگام می‌شود.
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-indigo-600/30 border border-indigo-400/30 rounded-2xl flex items-center justify-center shrink-0 text-indigo-300">
                                        <Key size={24} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    {/* Sync Token Card */}
                                    <div className="bg-slate-950/90 border border-teal-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                            <span>کد پیوند اختصاصی سرور (Sync Token):</span>
                                            <span className="text-[10px] text-teal-400 font-mono">HMAC-SHA256 Encrypted</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl border border-white/10 font-mono text-sm text-teal-300 font-bold tracking-wider select-all">
                                            <Key size={16} className="text-teal-400 shrink-0" />
                                            <span className="truncate flex-1">{getSyncToken()}</span>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(getSyncToken());
                                                    setCopiedToken(true);
                                                    addNotification('success', 'کد پیوند اختصاصی سرور در حافظه کپی شد.');
                                                    setTimeout(() => setCopiedToken(false), 3000);
                                                }}
                                                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                                            >
                                                {copiedToken ? <Check size={14}/> : <Copy size={14}/>}
                                                <span>{copiedToken ? 'کپی شد' : 'کپی کلید'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Host URL Card */}
                                    <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-5 space-y-3">
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                            <span>آدرس هاست وب (Host Base URL):</span>
                                            <span className="text-[10px] text-indigo-400 font-mono">Active Web Origin</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl border border-white/10 font-mono text-xs text-indigo-200 font-bold dir-ltr select-all">
                                            <Globe size={16} className="text-indigo-400 shrink-0" />
                                            <span className="truncate flex-1 text-left">{hostUrl}</span>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(hostUrl);
                                                    setCopiedUrl(true);
                                                    addNotification('success', 'آدرس هاست سرور در حافظه کپی شد.');
                                                    setTimeout(() => setCopiedUrl(false), 3000);
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 dir-rtl"
                                            >
                                                {copiedUrl ? <Check size={14}/> : <Copy size={14}/>}
                                                <span>{copiedUrl ? 'کپی شد' : 'کپی آدرس'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3 Step Guide */}
                            <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] space-y-4">
                                <h3 className="text-slate-900 dark:text-white font-black text-sm flex items-center gap-2">
                                    <HelpCircle size={18} className="text-teal-400" />
                                    راهنمای ۳ گام اتصال نسخه ویندوز به هاست سرور مادر
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-black text-xs flex items-center justify-center">۱</div>
                                        <h4 className="text-white font-bold text-xs">اجرای نسخه ویندوز</h4>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            برنامه ویندوزی را اجرا کرده و وارد منوی «تنظیمات» ➔ «مدیریت همگام‌سازی ابری» (یا بخش Cloud Vault) شوید.
                                        </p>
                                    </div>
                                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-black text-xs flex items-center justify-center">۲</div>
                                        <h4 className="text-white font-bold text-xs">ورود آدرس و کلید</h4>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            آدرس هاست فوق و کلید همگام‌سازی (Sync Token) کپی‌شده در بالا را در کادرهای مربوطه ویندوز قرار دهید.
                                        </p>
                                    </div>
                                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">۳</div>
                                        <h4 className="text-white font-bold text-xs">برقراری پیوند و همگام‌سازی</h4>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            دکمه «تست و برقراری پیوند» را بزنید. پس از تأیید، تمامی ثبت‌ها و اسناد ویندوز با دیتابیس هاست سینک می‌شوند.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* --- COMPANIES SETTINGS --- */}
                    {activeSection === 'companies' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <SectionHeader title="مدیریت شرکتها و مخزن هاست" subtitle="اطلاعات حقوقی، لوگو، مهر و امضاها در بخش مجزای هاست" />
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={async () => {
                                            const res = await CompanyHostSyncService.syncCompaniesToHost(companies);
                                            if (res.success) {
                                                useStore.getState().addNotification('success', res.message || 'اطلاعات و مدارک شرکت‌ها با موفقیت در هاست ذخیره شد.');
                                            } else {
                                                useStore.getState().addNotification('info', 'اطلاعات به عنوان پشتیبان محلی ذخیره شد.');
                                            }
                                        }} 
                                        className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
                                        title="ذخیره کلیه اطلاعات، لوگوها و مهرهای شرکت‌ها روی هاست"
                                    >
                                        <Cloud size={16}/> ذخیره در مخزن هاست
                                    </button>
                                    <button onClick={() => setShowAddCompany(true)} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"><Plus size={16}/> شعبه جدید</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {companies.map(company => (
                                    <CompanyCard 
                                        key={company.id}
                                        company={company}
                                        updateCompany={updateCompany}
                                        handleUpload={handleUpload}
                                        setActiveCompany={setActiveCompany}
                                        deleteCompany={deleteCompany}
                                        canDelete={companies.length > 1}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- FINANCIAL SETTINGS --- */}
                    {activeSection === 'financial' && (
                        <div className="space-y-8 animate-fade-in">
                            <SectionHeader title="پیکربندی مالی" subtitle="واحد پول، مالیات و پیشفرضهای حسابداری" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SettingCard title="واحد پول سیستم" icon={Coins} color="text-amber-400">
                                    <div className="flex bg-slate-950 p-1.5 rounded-xl border border-white/5">
                                        <button 
                                            onClick={() => {
                                                updateConfig({currency: 'RIAL'});
                                                useStore.getState().addNotification('success', 'واحد پول سراسری برنامه به ریال (IRR) تغییر یافت.');
                                            }} 
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95 ${config.currency === 'RIAL' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            ریال (IRR)
                                        </button>
                                        <button 
                                            onClick={() => {
                                                updateConfig({currency: 'TOMAN'});
                                                useStore.getState().addNotification('success', 'واحد پول سراسری برنامه به تومان تغییر یافت (تمام مبالغ با تقسیم بر ۱۰ نمایش داده می‌شوند).');
                                            }} 
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95 ${config.currency === 'TOMAN' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            تومان (Toman)
                                        </button>
                                    </div>
                                    <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-white/5 text-[11px] text-slate-400 space-y-1">
                                        <div className="flex justify-between font-medium">
                                            <span>نمونه نمایش در فاکتور:</span>
                                            <span className="font-mono font-black text-amber-400">
                                                {config.currency === 'TOMAN' ? '۱,۰۰۰,۰۰۰ تومان' : '۱۰,۰۰۰,۰۰۰ ریال'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {config.currency === 'TOMAN' 
                                                ? 'تمام مقادیر مالی در کاردکس، اسناد، چک‌ها و فاکتورها به صورت خودکار به تومان محاسبه و نمایش داده می‌شوند.' 
                                                : 'مبالغ به صورت دقیق و مبنایی به ریال محاسبه و نمایش داده می‌شوند.'}
                                        </div>
                                    </div>
                                </SettingCard>

                                <SettingCard title="مالیات بر ارزش افزوده" icon={Percent} color="text-rose-400">
                                    <div className="flex items-center gap-4">
                                        <input 
                                            type="number" 
                                            className="w-20 bg-slate-950 border border-white/5 rounded-xl p-2 text-center text-white font-black outline-none focus:border-rose-500" 
                                            value={config.defaultTaxRate}
                                            onChange={e => updateConfig({defaultTaxRate: Number(e.target.value)})} 
                                        />
                                        <span className="text-xs text-slate-400 font-bold">درصد پیشفرض برای فاکتورها</span>
                                    </div>
                                </SettingCard>
                            </div>

                            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-4">
                                <h3 className="text-white font-black text-sm mb-2 flex items-center gap-2"><PenTool size={16} className="text-indigo-400"/> پانویس پیشفرض فاکتورها</h3>
                                <textarea 
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white text-xs leading-6 outline-none focus:border-indigo-500 h-24 resize-none shadow-inner"
                                    value={config.defaultInvoiceFooter}
                                    onChange={e => updateConfig({defaultInvoiceFooter: e.target.value})}
                                    placeholder="متنی که در پایین تمام فاکتورها نمایش داده میشود..."
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'fiscal' && <FiscalYear />}

                    {/* --- ADVANCED SETTINGS --- */}
                    {activeSection === 'advanced' && (
                        <div className="space-y-8 animate-fade-in">
                            <SectionHeader title="تنظیمات پیشرفته" subtitle="کنترل دقیق رفتار سیستم و بهینهسازی" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SettingCard title="ذخیرهسازی خودکار" icon={Save} color="text-blue-400">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">فعالسازی</span>
                                            <Toggle checked={config.autoSave !== false} onChange={() => updateConfig({autoSave: !config.autoSave})} />
                                        </div>
                                        {config.autoSave !== false && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-400">فاصله زمانی (ثانیه)</span>
                                                <input type="number" min="10" max="300" className="w-20 bg-slate-950 border border-white/5 rounded-lg p-2 text-center text-white text-xs" value={config.autoSaveInterval || 60} onChange={e => updateConfig({autoSaveInterval: Number(e.target.value)})} />
   
                                        </div>
                                         )}
                                    </div>
                                </SettingCard>

                                <SettingCard title="تأیید قبل از حذف" icon={AlertTriangle} color="text-orange-400">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">فاکتورها</span>
                                            <Toggle checked={config.confirmDeleteInvoice !== false} onChange={() => updateConfig({confirmDeleteInvoice: !config.confirmDeleteInvoice})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">محصولات</span>
                                            <Toggle checked={config.confirmDeleteProduct !== false} onChange={() => updateConfig({confirmDeleteProduct: !config.confirmDeleteProduct})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">مشتریان</span>
                                            <Toggle checked={config.confirmDeleteCustomer !== false} onChange={() => updateConfig({confirmDeleteCustomer: !config.confirmDeleteCustomer})} />
                                        </div>
                                    </div>
                                </SettingCard>

                                <SettingCard title="نمایش اطلاعات" icon={MonitorCheck} color="text-purple-400">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">نمایش کد محصول</span>
                                            <Toggle checked={config.showProductCode !== false} onChange={() => updateConfig({showProductCode: !config.showProductCode})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">نمایش موجودی</span>
                                            <Toggle checked={config.showStock !== false} onChange={() => updateConfig({showStock: !config.showStock})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">نمایش سود</span>
                                            <Toggle checked={config.showProfit || false} onChange={() => updateConfig({showProfit: !config.showProfit})} />
                                        </div>
                                    </div>
                                </SettingCard>

                                <SettingCard title="فرمت اعداد" icon={Coins} color="text-emerald-400">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">جداکننده هزارگان</span>
                                            <Toggle checked={config.thousandSeparator !== false} onChange={() => updateConfig({thousandSeparator: !config.thousandSeparator})} />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400">اعشار</span>
                                            <select className="flex-1 bg-slate-950 border border-white/5 rounded-lg p-2 text-white text-xs" value={config.decimalPlaces || 0} onChange={e => updateConfig({decimalPlaces: Number(e.target.value)})}>
                                                <option value="0">بدون اعشار</option>
                                                <option value="2">2 رقم</option>
                                                <option value="3">3 رقم</option>
                                            </select>
                                        </div>
                                    </div>
                                </SettingCard>
                            </div>

                            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                                <h3 className="text-white font-black text-sm mb-4 flex items-center gap-2"><Database size={16} className="text-cyan-400"/> مدیریت حافظه</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
                                        <div>
                                            <div className="text-white font-bold text-xs mb-1">فشرده‌سازی داده</div>
                                            <div className="text-[10px] text-slate-500">کاهش حجم ذخیره‌سازی</div>
                                        </div>
                                        <Toggle checked={config.compressData || false} onChange={() => updateConfig({compressData: !config.compressData})} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
                                        <div>
                                            <div className="text-white font-bold text-xs mb-1">پاکسازی خودکار</div>
                                            <div className="text-[10px] text-slate-500">حذف داده‌های قدیمی</div>
                                        </div>
                                        <Toggle checked={config.autoCleanup || false} onChange={() => updateConfig({autoCleanup: !config.autoCleanup})} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                                <h3 className="text-white font-black text-sm mb-4 flex items-center gap-2"><FileText size={16} className="text-indigo-400"/> تنظیمات چاپ</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
                                        <span className="text-xs text-slate-400">چاپ خودکار پس از ثبت</span>
                                        <Toggle checked={config.autoPrint || false} onChange={() => updateConfig({autoPrint: !config.autoPrint})} />
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-2xl border border-white/5">
                                        <span className="text-xs text-slate-400">اندازه کاغذ</span>
                                        <select className="flex-1 bg-slate-900 border border-white/5 rounded-lg p-2 text-white text-xs" value={config.paperSize || 'A4'} onChange={e => updateConfig({paperSize: e.target.value})}>
                                            <option value="A4">A4</option>
                                            <option value="A5">A5</option>
                                            <option value="thermal">حرارتی 80mm</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- WORKSPACE & PORTABLE INDEPENDENCE --- */}
                    {activeSection === 'workspace' && (
                        <div className="space-y-8 animate-fade-in">
                            <SectionHeader title="فضای کاری و استقلال نسخه پرتابل" subtitle="پیکربندی فضاهای ابری مجزا، لایسنس و کارکرد مستقل برای اشخاص و مشتریان دیگر" />
                            <WorkspaceManager />
                        </div>
                    )}

                    {/* --- BACKUP SETTINGS --- */}
                    {activeSection === 'backup' && (
                        <div className="space-y-8 animate-fade-in">
                            <SectionHeader title="مدیریت پشتیبانگیری" subtitle="ایجاد و بازیابی نسخههای پشتیبان" />
                            <BackupManager />
                        </div>
                    )}
                </div>
                <footer className="mt-8 pt-4 border-t border-white/5 text-center hidden lg:block">
                    <p className="text-[10px] text-teal-400 font-black">طراحی و توسعه: دپارتمان IT</p>
                </footer>
            </div>

            {/* Add Company Modal */}
            {showAddCompany && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-pop-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white font-black text-xl">تعریف شعبه جدید</h3>
                            <button onClick={() => setShowAddCompany(false)} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white outline-none focus:border-teal-500 font-bold" placeholder="نام شعبه" value={newComp.name || ''} onChange={e => setNewComp({...newComp, name: e.target.value})} autoFocus />
                            <input className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white outline-none focus:border-teal-500 font-mono text-left" placeholder="تلفن" value={newComp.phone || ''} onChange={e => setNewComp({...newComp, phone: e.target.value})} />
                            <textarea className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white outline-none focus:border-teal-500 h-24 resize-none" placeholder="آدرس" value={newComp.address || ''} onChange={e => setNewComp({...newComp, address: e.target.value})} />
                            <button onClick={handleAddCompany} className="w-full bg-teal-600 text-white py-4 rounded-xl font-black text-lg shadow-xl active:scale-95 transition-all">ثبت شعبه</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components
const CompanyCard = ({ company, updateCompany, handleUpload, setActiveCompany, deleteCompany, canDelete }: any) => {
    const [local, setLocal] = useState({ name: company.name, phone: company.phone, address: company.address });
    
    useEffect(() => {
        setLocal({ name: company.name, phone: company.phone, address: company.address });
    }, [company.name, company.phone, company.address]);

    const handleBlur = (field: string) => {
        if (local[field as keyof typeof local] !== company[field as keyof typeof company]) {
            updateCompany(company.id, { [field]: local[field as keyof typeof local] });
        }
    };

    return (
        <div className={`bg-slate-950/50 p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group ${company.isActive ? 'border-teal-500/50 shadow-teal-500/10' : 'border-white/5'}`}>
            {company.isActive && <div className="absolute top-0 left-0 bg-teal-600 text-white text-[9px] font-black px-4 py-1 rounded-br-2xl">شعبه فعال</div>}
            
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="relative group/logo w-24 h-24 bg-slate-900 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {company.logo ? <img src={company.logo} className="w-full h-full object-contain p-2" /> : <Building2 className="text-slate-600" size={32}/>}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center cursor-pointer transition-all"><Upload size={20} className="text-white"/><input type="file" className="hidden" onChange={e => handleUpload(company.id, 'logo', e)}/></label>
                </div>
                
                <div className="flex-1 w-full space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black outline-none focus:border-teal-500" value={local.name} onChange={e => setLocal({...local, name: e.target.value})} onBlur={() => handleBlur('name')} placeholder="نام شرکت" />
                        <input className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-teal-500 text-left" value={local.phone} onChange={e => setLocal({...local, phone: e.target.value})} onBlur={() => handleBlur('phone')} placeholder="شماره تماس" />
                    </div>
                    <textarea className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-teal-500 h-16 resize-none" value={local.address} onChange={e => setLocal({...local, address: e.target.value})} onBlur={() => handleBlur('address')} placeholder="آدرس پستی..." />
                </div>
            </div>

            <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
                <div className="flex-1 flex gap-4">
                    <UploadBox label="مهر دیجیتال" hasImage={!!company.stamp} onUpload={e => handleUpload(company.id, 'stamp', e)} icon={Landmark} />
                    <UploadBox label="امضای مدیریت" hasImage={!!company.signature} onUpload={e => handleUpload(company.id, 'signature', e)} icon={PenTool} />
                </div>
                <div className="flex items-center gap-2">
                    {!company.isActive && <button onClick={() => setActiveCompany(company.id)} className="p-3 bg-teal-500/10 text-teal-400 rounded-xl hover:bg-teal-500 hover:text-white transition-all"><CheckCircle2 size={20}/></button>}
                    {canDelete && <button onClick={() => deleteCompany(company.id)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={20}/></button>}
                </div>
            </div>
        </div>
    );
};

const SidebarItem = ({ active, onClick, icon: Icon, label }: any) => (
    <button 
        onClick={onClick} 
        className={`flex-shrink-0 lg:w-full flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 lg:py-3.5 rounded-xl lg:rounded-2xl transition-all ${
            active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black' 
                : 'bg-slate-100/60 dark:bg-slate-950/40 lg:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200 font-bold'
        }`}
    >
        <Icon size={18} className={active ? 'text-white' : 'text-slate-500 dark:text-slate-400 shrink-0'} />
        <span className="text-xs lg:text-xs whitespace-nowrap">{label}</span>
        {active && <div className="hidden lg:block mr-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
    </button>
);

const SectionHeader = ({ title, subtitle }: any) => (
    <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">{subtitle}</p>
    </div>
);

const SettingCard = ({ title, icon: Icon, color, children }: any) => (
    <div className="bg-slate-50/80 dark:bg-slate-950/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-200 dark:border-white/10 space-y-3 sm:space-y-4 hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none transition-all flex flex-col justify-between">
        <div>
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm shrink-0 ${color}`}>
                    <Icon size={18} className="sm:w-5 sm:h-5"/>
                </div>
                <h3 className="text-slate-900 dark:text-white font-black text-xs sm:text-sm">{title}</h3>
            </div>
            {children}
        </div>
    </div>
);

const Toggle = ({ checked, onChange }: any) => (
    <button 
        type="button"
        onClick={onChange} 
        className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
        <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all ${checked ? 'right-6' : 'right-1'}`}></div>
    </button>
);

const UploadBox = ({ label, hasImage, onUpload, icon: Icon }: any) => (
    <div className="flex-1 relative group cursor-pointer">
        <div className={`h-24 bg-slate-900 border-2 border-dashed ${hasImage ? 'border-teal-500/50' : 'border-white/10'} rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:border-teal-500`}>
            {hasImage ? <CheckCircle2 className="text-teal-500" size={24}/> : <Icon className="text-slate-600" size={24}/>}
            <span className="text-[9px] text-slate-500 font-bold">{label}</span>
        </div>
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} accept="image/*" />
    </div>
);



export default Settings;
