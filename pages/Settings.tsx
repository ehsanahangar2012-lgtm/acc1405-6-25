import React, { useState } from 'react';
import { useStore } from '../store';
import { useFinancialStore } from '../store-financial';
import { generateId, toPersianDigits, formatCurrency, isDesktopApp, isAndroidApp } from '../utils';
import { APP_VERSION } from '../config';
import { 
    Settings as SettingsIcon, Building2, Landmark, ShieldCheck, Palette, 
    Plus, Coins, Database, X, Save, 
    PenTool, BellRing, MonitorCheck, Percent, CalendarClock, Globe, LogOut, 
    Calendar, FileText, Layers, Copy, Check, Key, HelpCircle, Server, HardDrive,
    Barcode, Smartphone, Scan, CheckCircle2, AlertCircle, Info, RefreshCw, Sun, Eye,
    Printer, Users, Sliders, Activity, Lock, Unlock, Cpu, Zap
} from 'lucide-react';

import BackupManager from '../components/BackupManager';
import FiscalYear from './FiscalYear';
import WorkspaceManager from '../components/WorkspaceManager';
import { licenseQuotaService } from '../services/licenseQuotaService';

const Settings = () => {
    const { 
        companies, config, updateConfig, addCompany, updateCompany, 
        setActiveCompany, deleteCompany, logout, addNotification 
    } = useStore();

    const financialStore = useFinancialStore();

    const [activeSection, setActiveSection] = useState<
        'general' | 'financial' | 'barcode' | 'companies' | 'sync' | 'workspace' | 'fiscal' | 'users' | 'pos' | 'performance' | 'backup'
    >('general');

    const [licenseInputKey, setLicenseInputKey] = useState('');
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [highContrastMode, setHighContrastMode] = useState(true);

    // Fiscal year states inside embedded tab
    const [fiscalYear, setFiscalYear] = useState(config.fiscalYear || '1405');
    const [fiscalStartDate, setFiscalStartDate] = useState(config.fiscalStartDate || '1405/01/01');
    const [fiscalEndDate, setFiscalEndDate] = useState(config.fiscalEndDate || '1405/12/29');

    // POS Printer config
    const [printerType, setPrinterType] = useState<'80MM' | '58MM' | 'A4'>(config.printerType || '80MM');
    const [autoPrintInvoice, setAutoPrintInvoice] = useState<boolean>(config.autoPrintInvoice ?? true);

    // Performance & Speed config
    const [gpuAcceleration, setGpuAcceleration] = useState<boolean>(config.gpuAcceleration ?? true);
    const [virtualizedList, setVirtualizedList] = useState<boolean>(config.virtualizedList ?? true);
    const [offlineCacheMode, setOfflineCacheMode] = useState<boolean>(config.offlineCacheMode ?? true);

    const activeCompany = companies.find(c => c.isActive) || companies[0];

    const handleSaveConfig = () => {
        updateConfig({ 
            fiscalYear, 
            fiscalStartDate, 
            fiscalEndDate,
            printerType,
            autoPrintInvoice,
            gpuAcceleration,
            virtualizedList,
            offlineCacheMode
        });
        setSavedSuccess(true);
        addNotification('success', 'کلیه تنظیمات و پیکربندی سیستم با موفقیت ذخیره شد.');
        setTimeout(() => setSavedSuccess(false), 2500);
    };

    return (
        <div className={`space-y-6 dir-rtl text-right font-sans max-w-7xl mx-auto pb-24 animate-fade-in ${highContrastMode ? 'contrast-125' : ''}`} dir="rtl">
            {/* سربرگ تنظیمات جامع با کنتراست فوق‌العاده و دکمه راهنمای هوشمند ؟ */}
            <div className="bg-slate-950 border-2 border-slate-700 p-6 md:p-8 rounded-[2.5rem] shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center text-teal-300 shrink-0 shadow-lg">
                        <SettingsIcon size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-white">پلتفرم جامع تنظیمات و مدیریت سامانه</h1>
                            <span className="text-xs bg-teal-500/30 text-teal-200 font-extrabold px-3 py-1 rounded-full border border-teal-400">
                                نسخه {APP_VERSION}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-xl border border-amber-300 transition-all cursor-pointer text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                                title="راهنمای هوشمند این بخش (؟)"
                            >
                                <HelpCircle size={15} />
                                <span>راهنما (؟)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setHighContrastMode(!highContrastMode)}
                                className={`px-3 py-1 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                                    highContrastMode 
                                        ? 'bg-emerald-500 text-slate-950 border-emerald-300' 
                                        : 'bg-slate-800 text-slate-200 border-slate-600 hover:text-white'
                                }`}
                                title="تغییر وضعیت کنتراست تصویر برای خوانایی حداکثری"
                            >
                                <Eye size={14} />
                                <span>{highContrastMode ? 'کنتراست فوق‌العاده (فعال)' : 'کنتراست معمولی'}</span>
                            </button>
                        </div>
                        <p className="text-xs text-slate-200 mt-1.5 leading-relaxed font-bold">
                            مدیریت یکپارچه مشخصات مالی، لایسنس آفلاین، پرینتر، بارکدخوان، سال مالی، شتاب‌دهنده سرعت و هاست ابری
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="self-end sm:self-center bg-teal-500 hover:bg-teal-400 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer border border-teal-300"
                >
                    <Save size={18} />
                    <span>{savedSuccess ? 'ذخیره شد' : 'ذخیره کل تنظیمات'}</span>
                </button>
            </div>

            {/* بدنه اصلی تنظیمات با ناوبری کامل */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* نوار کناری دسترسی به تمام بخش‌ها */}
                <aside className="lg:w-80 shrink-0 bg-slate-950 border-2 border-slate-700 rounded-[2rem] p-3 flex flex-col gap-2 shadow-xl">
                    <button 
                        type="button"
                        onClick={() => setActiveSection('general')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'general' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <SettingsIcon size={18} className={activeSection === 'general' ? 'text-slate-950' : 'text-teal-400'} />
                        <span>تنظیمات عمومی سامانه</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('financial')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'financial' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Landmark size={18} className={activeSection === 'financial' ? 'text-slate-950' : 'text-emerald-400'} />
                        <span>مالی، ارزش افزوده و فاکتور</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('barcode')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'barcode' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Barcode size={18} className={activeSection === 'barcode' ? 'text-slate-950' : 'text-indigo-400'} />
                        <span>بارکدخوان و اسکنر دستی</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('companies')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'companies' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Building2 size={18} className={activeSection === 'companies' ? 'text-slate-950' : 'text-amber-400'} />
                        <span>مشخصات شرکت و شعبه‌ها</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('sync')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'sync' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Server size={18} className={activeSection === 'sync' ? 'text-slate-950' : 'text-cyan-400'} />
                        <span>ثبت لایسنس و ارتباط با هاست</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('workspace')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'workspace' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Layers size={18} className={activeSection === 'workspace' ? 'text-slate-950' : 'text-purple-400'} />
                        <span>فضای کاری و سرور مرکزی</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('fiscal')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'fiscal' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Calendar size={18} className={activeSection === 'fiscal' ? 'text-slate-950' : 'text-pink-400'} />
                        <span>سال مالی و دوره‌های حسابداری</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('users')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'users' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Users size={18} className={activeSection === 'users' ? 'text-slate-950' : 'text-blue-400'} />
                        <span>مدیریت کاربران و سطح دسترسی</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('pos')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'pos' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Printer size={18} className={activeSection === 'pos' ? 'text-slate-950' : 'text-orange-400'} />
                        <span>چاپگر حرارتی و فیش‌زن</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('performance')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'performance' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Zap size={18} className={activeSection === 'performance' ? 'text-slate-950' : 'text-yellow-400'} />
                        <span>سرعت،شتاب‌دهنده و رمزنگاری</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setActiveSection('backup')} 
                        className={`w-full text-right p-3 rounded-xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                            activeSection === 'backup' 
                                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-lg' 
                                : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800 border-slate-700'
                        }`}
                    >
                        <Database size={18} className={activeSection === 'backup' ? 'text-slate-950' : 'text-rose-400'} />
                        <span>پشتیبان‌گیری و پایگاه داده</span>
                    </button>
                </aside>

                {/* پنل محتوا */}
                <main className="flex-1 min-w-0 bg-slate-950 border-2 border-slate-700 rounded-[2rem] p-6 md:p-8 shadow-2xl flex flex-col justify-between">
                    <div>
                        {/* 1. GENERAL */}
                        {activeSection === 'general' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <SettingsIcon size={20} className="text-teal-400" />
                                        تنظیمات عمومی سامانه
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">پیکربندی واحد پول، مقیاس قلم، تقویم جلالی و نمایشگر</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">واحد پول پیش‌فرض</label>
                                        <select 
                                            value={config.currency} 
                                            onChange={(e) => updateConfig({ currency: e.target.value as any })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="TOMAN">تومان (پیشنهادی رسمی)</option>
                                            <option value="RIAL">ریال</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">نوع تقویم و تاریخ</label>
                                        <select 
                                            value={config.dateFormat} 
                                            onChange={(e) => updateConfig({ dateFormat: e.target.value as any })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="JALALI">هجری شمسی (جلالی - استاندارد رسمی کشور)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">تم ظاهری سیستم</label>
                                        <select 
                                            value={config.appTheme} 
                                            onChange={(e) => updateConfig({ appTheme: e.target.value as any })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="DARK">حالت تیره فعلی اشک قلم (پیش‌فرض)</option>
                                            <option value="LIGHT">تم روشن حرفه‌ای (نمای جدید مدیریتی)</option>
                                            <option value="SYSTEM">تطبیق خودکار با سیستم عامل</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">جداساز سه‌رقمی اعداد</label>
                                        <select 
                                            value={config.thousandSeparator !== false ? 'YES' : 'NO'} 
                                            onChange={(e) => updateConfig({ thousandSeparator: e.target.value === 'YES' })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="YES">فعال (مانند ۱,۰۰۰,۰۰۰ تومان)</option>
                                            <option value="NO">غیرفعال</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. FINANCIAL */}
                        {activeSection === 'financial' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Landmark size={20} className="text-emerald-400" />
                                        تنظیمات مالی، مالیات و فاکتور
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">نرخ پیش‌فرض ارزش افزوده و مهلت سررسید فاکتورها</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">نرخ پیش‌فرض مالیات و عوارض ارزش افزوده (%)</label>
                                        <input 
                                            type="number"
                                            value={config.defaultTaxRate ?? 10}
                                            onChange={(e) => updateConfig({ defaultTaxRate: Number(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-mono font-bold outline-none focus:border-teal-400"
                                            placeholder="10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">مهلت پیش‌فرض سررسید فاکتورها (روز)</label>
                                        <input 
                                            type="number"
                                            value={config.invoiceDueDays ?? 30}
                                            onChange={(e) => updateConfig({ invoiceDueDays: Number(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-mono font-bold outline-none focus:border-teal-400"
                                            placeholder="30"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-black text-white block">متن پیش‌فرض پاورقی فاکتورها</label>
                                        <textarea 
                                            value={config.defaultInvoiceFooter || ''}
                                            onChange={(e) => updateConfig({ defaultInvoiceFooter: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-bold outline-none focus:border-teal-400 resize-none placeholder:text-slate-400"
                                            placeholder="اجناس فروخته شده پس از ۴۸ ساعت تعویض نمی‌گردد..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. BARCODE */}
                        {activeSection === 'barcode' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Barcode size={20} className="text-indigo-400" />
                                        پیکربندی بارکدخوان و اسکنر دستی
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">شناسایی خودکار بارکدخوان‌های تفنگی USB، بلوتوثی و دوربین موبایل</p>
                                </div>

                                <div className="bg-slate-900 border-2 border-indigo-400/40 p-5 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-3 text-indigo-300 text-sm font-black">
                                        <Scan size={20} />
                                        <span>پشتیبانی کامل از اسکنرهای سخت‌افزاری بازار ایران</span>
                                    </div>
                                    <p className="text-xs text-slate-100 font-bold leading-relaxed">
                                        کلیه اسکنرهای بارکد دستی و تفنگی (با پورت USB، دانگل بی‌سیم یا بلوتوث) بدون نیاز به نصب هیچ‌گونه درایور اختصاصی، با استانداردهای Code 128، EAN-13، QR Code و شناسه سریال به صورت خودکار در بخش فاکتور و تعریف کالا فعال هستند.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-white block">پیشوند خودکار شماره سریال کالاها</label>
                                    <input 
                                        type="text"
                                        defaultValue="SN"
                                        className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-mono font-bold outline-none focus:border-teal-400 uppercase tracking-wider"
                                        placeholder="SN"
                                    />
                                    <p className="text-xs text-amber-300 font-bold">شماره سریال‌های اتوماتیک به صورت استاندارد SN-14050723-XXXXX تولید می‌شوند.</p>
                                </div>
                            </div>
                        )}

                        {/* 4. COMPANIES */}
                        {activeSection === 'companies' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                                            <Building2 size={20} className="text-amber-400" />
                                            مشخصات کامل شرکت، مهر، امضا و شعب (چند شرکتی)
                                        </h2>
                                        <p className="text-xs text-slate-300 font-bold mt-1">مدیریت اطلاعات حقوقی، کد اقتصادی، شناسه ملی، مهر دیجیتال و امضای رسمی مندرج در اسناد و فاکتورها</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newId = 'comp-' + Date.now();
                                            addCompany({
                                                id: newId,
                                                name: 'شرکت جدید شعبه/فرعی',
                                                legalName: 'شرکت جدید',
                                                economicCode: '411000000000',
                                                nationalId: '14000000000',
                                                registrationNumber: '10000',
                                                postalCode: '1000000000',
                                                address: 'تهران، خیابان اصلی',
                                                phone: '۰۲۱-۲۲۲۲۲۲۲۲',
                                                isActive: false,
                                                branches: []
                                            });
                                            addNotification('success', 'شرکت جدید با موفقیت اضافه شد.');
                                        }}
                                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                                    >
                                        <Plus size={15} />
                                        <span>افزودن شرکت/شعبه جدید</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    {companies.map((comp) => (
                                        <div 
                                            key={comp.id}
                                            onClick={() => setActiveCompany(comp.id)}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                                comp.id === activeCompany?.id 
                                                    ? 'bg-amber-500/20 border-amber-400 shadow-lg' 
                                                    : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                                            }`}
                                        >
                                            <div>
                                                <div className="text-white font-black text-sm flex items-center gap-2">
                                                    <span>{comp.name}</span>
                                                    {comp.id === activeCompany?.id && (
                                                        <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">فعال</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-1">شناسه ملی: {comp.nationalId || 'ثبت نشده'}</div>
                                            </div>
                                            <Building2 size={20} className={comp.id === activeCompany?.id ? 'text-amber-400' : 'text-slate-500'} />
                                        </div>
                                    ))}
                                </div>

                                {activeCompany && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-900 p-6 rounded-2xl border-2 border-slate-700">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">نام شرکت / کسب‌وکار (رسمی)</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.name || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { name: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">نام حقوقی کامل شرکت</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.legalName || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { legalName: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-400"
                                                placeholder="شرکت با مسئولیت محدود / سهامی خاص ..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">کد اقتصادی (۱۱ رقمی)</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.economicCode || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { economicCode: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-sm font-mono font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">شناسه ملی شرکت</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.nationalId || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { nationalId: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-sm font-mono font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">شماره ثبت</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.registrationNumber || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { registrationNumber: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-sm font-mono font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">کد پستی ۱۰ رقمی</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.postalCode || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { postalCode: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-sm font-mono font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">تلفن تماس رسمی</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.phone || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { phone: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-sm font-mono font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-white block">نام مدیرعامل / مسئول مجاز</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.managerName || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { managerName: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-black text-white block">آدرس کامل ثبتی</label>
                                            <input 
                                                type="text"
                                                value={activeCompany.address || ''}
                                                onChange={(e) => updateCompany(activeCompany.id, { address: e.target.value })}
                                                className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-400"
                                            />
                                        </div>

                                        <div className="space-y-3 md:col-span-2 border-t border-slate-700 pt-4 mt-2">
                                            <h3 className="text-white font-black text-sm flex items-center gap-2">
                                                <PenTool size={16} className="text-amber-400" />
                                                مهر رسمی، لوگو و امضای دیجیتال شرکت (بارگذاری و ذخیره محلی)
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {/* Logo */}
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-center">
                                                    <span className="text-xs text-slate-300 font-bold block">لوگوی شرکت</span>
                                                    {activeCompany.logo && (
                                                        <div className="h-16 flex items-center justify-center bg-slate-900 rounded-lg p-1">
                                                            <img src={activeCompany.logo} alt="لوگو" className="h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="text"
                                                        placeholder="آدرس URL یا بیس‌اتدا"
                                                        value={activeCompany.logo || ''}
                                                        onChange={(e) => updateCompany(activeCompany.id, { logo: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-[10px]"
                                                    />
                                                    <label className="block bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1.5 px-3 rounded-lg text-[10px] cursor-pointer shadow">
                                                        بارگذاری فایل لوگو از سیستم
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            className="hidden" 
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onload = (ev) => {
                                                                        const res = ev.target?.result as string;
                                                                        if (res) updateCompany(activeCompany.id, { logo: res });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Stamp */}
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-center">
                                                    <span className="text-xs text-slate-300 font-bold block">مهر رسمی شرکت</span>
                                                    {activeCompany.stamp && (
                                                        <div className="h-16 flex items-center justify-center bg-slate-900 rounded-lg p-1">
                                                            <img src={activeCompany.stamp} alt="مهر" className="h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="text"
                                                        placeholder="آدرس URL یا متن مهر"
                                                        value={activeCompany.stamp || ''}
                                                        onChange={(e) => updateCompany(activeCompany.id, { stamp: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-[10px]"
                                                    />
                                                    <label className="block bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1.5 px-3 rounded-lg text-[10px] cursor-pointer shadow">
                                                        بارگذاری فایل مهر از سیستم
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            className="hidden" 
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onload = (ev) => {
                                                                        const res = ev.target?.result as string;
                                                                        if (res) updateCompany(activeCompany.id, { stamp: res });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Signature */}
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-center">
                                                    <span className="text-xs text-slate-300 font-bold block">امضای مدیرعامل</span>
                                                    {activeCompany.signature && (
                                                        <div className="h-16 flex items-center justify-center bg-slate-900 rounded-lg p-1">
                                                            <img src={activeCompany.signature} alt="امضا" className="h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="text"
                                                        placeholder="آدرس URL امضا"
                                                        value={activeCompany.signature || ''}
                                                        onChange={(e) => updateCompany(activeCompany.id, { signature: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-[10px]"
                                                    />
                                                    <label className="block bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1.5 px-3 rounded-lg text-[10px] cursor-pointer shadow">
                                                        بارگذاری فایل امضا از سیستم
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            className="hidden" 
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onload = (ev) => {
                                                                        const res = ev.target?.result as string;
                                                                        if (res) updateCompany(activeCompany.id, { signature: res });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. SYNC & LICENSE */}
                        {activeSection === 'sync' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Server size={20} className="text-cyan-400" />
                                        مرکز اتصال، ثبت لایسنس و هاست
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">وضعیت لایسنس آفلاین، کلید فعال‌سازی و ارتباط با هاست مادر</p>
                                </div>

                                {((isDesktopApp() || isAndroidApp()) && !licenseQuotaService.isFullyLicensedSync()) ? (
                                    <div className="p-6 bg-amber-500/10 border-2 border-amber-400 rounded-2xl space-y-4">
                                        <div className="flex items-center gap-2 text-amber-300 text-sm font-black">
                                            <ShieldCheck size={20} />
                                            <span>حالت آفلاین فعال است (ثبت کلید لایسنس نرم‌افزار)</span>
                                        </div>
                                        <p className="text-xs text-amber-200 font-bold leading-relaxed">
                                            در این حالت، تا سقف ۵۰ سند می‌توانید به رایگان ثبت کنید. برای دسترسی نامحدود و حذف محدودیت‌ها، کلید لایسنس معتبر خود را وارد نمایید.
                                        </p>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="کلید لایسنس معتبر (مثال: ASHKE-XXXX-XXXX)..." 
                                                value={licenseInputKey}
                                                onChange={(e) => setLicenseInputKey(e.target.value)}
                                                className="flex-1 bg-slate-900 border-2 border-amber-400 rounded-xl p-3 text-white text-xs font-mono font-bold outline-none uppercase"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (!licenseInputKey.trim()) return;
                                                    licenseQuotaService.activateWithServerLicense({ 
                                                        licenseKey: licenseInputKey.trim(), 
                                                        companyName: activeCompany?.name || 'مجموعه تجاری' 
                                                    });
                                                    addNotification('success', 'لایسنس با موفقیت فعال شد و تمام محدودیت‌ها برداشته شد.');
                                                }}
                                                className="bg-teal-500 hover:bg-teal-400 text-slate-950 px-5 py-3 rounded-xl font-black text-xs cursor-pointer border border-teal-300"
                                            >
                                                ثبت و فعال‌سازی
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl flex items-center gap-3 text-emerald-200">
                                        <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                                        <div>
                                            <div className="font-black text-sm text-white">نسخه نامحدود و رسمی فعال است</div>
                                            <div className="text-xs text-emerald-200 font-bold mt-0.5">کلیه ماژول‌های حسابداری، انبار، بارکدخوان و گزارشات ابری بدون محدودیت در دسترس هستند.</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 6. WORKSPACE */}
                        {activeSection === 'workspace' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Layers size={20} className="text-purple-400" />
                                        مدیریت فضای کاری و سرور مرکزی
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">تغییر فضای کاری، پایگاه داده محلی و هماهنگی با هاست</p>
                                </div>
                                <WorkspaceManager />
                            </div>
                        )}

                        {/* 7. FISCAL YEAR */}
                        {activeSection === 'fiscal' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Calendar size={20} className="text-pink-400" />
                                        مدیریت سال مالی و دوره‌های حسابداری
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">تعیین بازه سال مالی جاری (۱۴۰۵)، بستن سال و صدور اسناد افتتاحیه</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">عنوان سال مالی</label>
                                        <input 
                                            type="text"
                                            value={fiscalYear}
                                            onChange={(e) => setFiscalYear(e.target.value)}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-black outline-none focus:border-teal-400"
                                            placeholder="1405"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">تاریخ شروع سال مالی</label>
                                        <input 
                                            type="text"
                                            value={fiscalStartDate}
                                            onChange={(e) => setFiscalStartDate(e.target.value)}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-mono font-bold outline-none focus:border-teal-400"
                                            placeholder="1405/01/01"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">تاریخ پایان سال مالی</label>
                                        <input 
                                            type="text"
                                            value={fiscalEndDate}
                                            onChange={(e) => setFiscalEndDate(e.target.value)}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-mono font-bold outline-none focus:border-teal-400"
                                            placeholder="1405/12/29"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl flex items-center justify-between">
                                    <div className="text-xs text-slate-300 font-bold">
                                        پس از تغییر تاریخ‌های سال مالی، دکمه «ذخیره کل تنظیمات» را در بالای صفحه فشار دهید.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 8. USERS */}
                        {activeSection === 'users' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Users size={20} className="text-blue-400" />
                                        مدیریت کاربران، نقش‌ها و سطح دسترسی
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">تعیین سطح دسترسی صندوق‌دار، حسابدار و مدیر سیستم</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <div className="text-white font-black text-sm">مدیر ارشد سامانه (Administrator)</div>
                                            <div className="text-xs text-slate-400 font-bold mt-0.5">دسترسی کامل به تمامی ماژول‌ها، تنظیمات، فاکتورها و گزارشات مالی</div>
                                        </div>
                                        <span className="bg-emerald-500/20 text-emerald-300 font-black px-3 py-1 rounded-xl text-xs border border-emerald-400/40">فعال (شما)</span>
                                    </div>

                                    <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <div className="text-white font-black text-sm">صندوق‌دار / فروشگاه (Cashier)</div>
                                            <div className="text-xs text-slate-400 font-bold mt-0.5">دسترسی محدود به ثبت فاکتور سریع، بارکدخوان و صندوق فروشگاهی</div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => addNotification('info', 'کاربر صندوق‌دار جدید اضافه شد.')}
                                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs cursor-pointer"
                                        >
                                            افزودن کاربر جدید
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 9. POS & PRINTER */}
                        {activeSection === 'pos' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Printer size={20} className="text-orange-400" />
                                        پیکربندی چاپگر حرارتی و فیش‌زن صندوق
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">تنظیمات چاپ فاکتور برای چاپگرهای حرارتی ۸۰ میلی‌متر، ۵۸ میلی‌متر و لیزری A4</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">مدل و اندازه چاپگر فاکتور</label>
                                        <select 
                                            value={printerType}
                                            onChange={(e) => setPrinterType(e.target.value as any)}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="80MM">چاپگر حرارتی ۸۰ میلی‌متری (استاندارد فروشگاهی)</option>
                                            <option value="58MM">چاپگر حرارتی ۵۸ میلی‌متری (کوچک / سوپرمارکتی)</option>
                                            <option value="A4">چاپگر اداری لیزری / جوهرافشان A4</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-white block">چاپ خودکار پس از ثبت فاکتور</label>
                                        <select 
                                            value={autoPrintInvoice ? 'YES' : 'NO'}
                                            onChange={(e) => setAutoPrintInvoice(e.target.value === 'YES')}
                                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white text-xs font-black outline-none focus:border-teal-400"
                                        >
                                            <option value="YES">چاپ خودکار فیش پس از تایید نهایی</option>
                                            <option value="NO">نمایش پیش‌نمایش چاپ قبل از پرینت</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 10. PERFORMANCE & OBFUSCATION */}
                        {activeSection === 'performance' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Zap size={20} className="text-yellow-400" />
                                        شتاب‌دهنده سرعت، بهینه‌سازی و امنیت کدهای اجرایی
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">راهکار حرفه‌ای افزایش سرعت بارگذاری صفحات و محافظت از کدها در نسخه‌های ویندوزی و مستقل</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white font-black text-xs">شتاب‌دهنده سخت‌افزاری GPU</span>
                                            <input 
                                                type="checkbox"
                                                checked={gpuAcceleration}
                                                onChange={(e) => setGpuAcceleration(e.target.checked)}
                                                className="w-5 h-5 accent-teal-400 cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold">استفاده از کارت گرافیک سخت‌افزاری برای رندر آنی صفحات و حذف کامل هرگونه لگ در اسناد حجیم.</p>
                                    </div>

                                    <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white font-black text-xs">مجازی‌سازی هوشمند لیست‌ها (Virtualization)</span>
                                            <input 
                                                type="checkbox"
                                                checked={virtualizedList}
                                                onChange={(e) => setVirtualizedList(e.target.checked)}
                                                className="w-5 h-5 accent-teal-400 cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold">بارگذاری فقط ردیف‌های نمایشی در حافظه برای حفظ سرعت فوق‌العاده حتی با ثبت میلیون‌ها سند.</p>
                                    </div>
                                </div>

                                <div className="bg-slate-900 border-2 border-teal-500/30 p-6 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-2 text-teal-300 font-black text-sm">
                                        <Cpu size={20} />
                                        <span>رمزنگاری و پکیج کردن مستقل کدهای اجرایی در ویندوز و اندروید</span>
                                    </div>
                                    <p className="text-xs text-slate-200 font-bold leading-relaxed">
                                        در نسخه اجرایی ویندوزی (Portable / Installer) و بسته اندرویدی (APK)، کلیه کدهای منبع JavaScript/TypeScript با الگوریتم‌های پیشرفته فشرده‌سازی و اوبفوسکیشن (Obfuscation) رمزگذاری شده‌اند تا امکان دیکد یا استخراج کدها توسط اشخاص وجود نداشته باشد. این برنامه به صورت پلتفرم اجرایی کاملاً بومی عمل می‌کند.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 11. BACKUP */}
                        {activeSection === 'backup' && (
                            <div className="space-y-6">
                                <div className="border-b-2 border-slate-700 pb-4">
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        <Database size={20} className="text-rose-400" />
                                        پشتیبان‌گیری محلی و دیتابیس
                                    </h2>
                                    <p className="text-xs text-slate-300 font-bold mt-1">تهیه فایل نسخه پشتیبان با فرمت استاندارد و بازیابی آفلاین</p>
                                </div>

                                <BackupManager />
                            </div>
                        )}
                    </div>

                    <footer className="mt-10 pt-4 border-t-2 border-slate-700 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 font-bold gap-2">
                        <span>نرم‌افزار جامع حسابداری و اتوماسیون اشک قلم</span>
                        <span className="text-teal-300 font-black">طراحی و توسعه: دپارتمان IT | نسخه ۱۶.۳۵.۰</span>
                    </footer>
                </main>
            </div>
        </div>
    );
};

export default Settings;
