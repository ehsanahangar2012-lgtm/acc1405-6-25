import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { auditTrail, AuditLog } from '../services/auditTrailService';
import { idbService } from '../services/indexedDBService';
import { toPersianDigits, downloadJSON } from '../utils';
import { 
  Settings, Database, Activity, Trash2, RefreshCw, Download, 
  Upload, AlertTriangle, Cpu, HardDrive, Network, Sparkles, Sliders, Info, Clock, AlertCircle
} from 'lucide-react';
import { ConfirmModal } from '../components/Shared';
import { API_CONFIG, APP_VERSION } from '../config';
import { useFinancialStore } from '../store-financial';
import { securityService } from '../services/securityService';

const AdvancedSettings: React.FC = () => {
  const { config, updateConfig, hydrateStore, companies, invoices, products, people, checks, contracts, addNotification } = useStore();
  
  const [activeTab, setActiveTab] = useState<'system' | 'database' | 'diagnostics' | 'logs'>('system');
  const [dbEstimate, setDbEstimate] = useState<{ usage: string; quota: string }>({ usage: '0', quota: '0' });
  const [latency, setLatency] = useState<number | null>(null);
  const [testingLatency, setTestingLatency] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // JSON Backup Import File Reader State
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(2);
        setDbEstimate({ usage: usageMB, quota: quotaMB });
      } catch (e) {
        console.error('Error fetching storage estimate:', e);
      }
    }
  };

  const testConnectionLatency = async () => {
    setTestingLatency(true);
    const start = performance.now();
    try {
      // test with api endpoint
      await fetch(API_CONFIG.HEALTH_API, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
      const end = performance.now();
      setLatency(Math.round(end - start));
    } catch {
      setLatency(null);
    } finally {
      setTestingLatency(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const allLogs = await auditTrail.getLogs();
      setLogs(allLogs.slice(0, 30)); // Show last 30 logs
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    }
  };

  useEffect(() => {
    fetchStorageEstimate();
    testConnectionLatency();
    loadAuditLogs();
  }, [activeTab]);

  const handleExportBackup = () => {
    const state = useStore.getState();
    const dataToExport: any = {
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      backupFormatVersion: 2,
      companies: state.companies,
      config: state.config,
      products: state.products,
      people: state.people,
      invoices: state.invoices,
      vouchers: state.vouchers,
      checks: state.checks,
      transactions: state.transactions,
      checkTransfers: state.checkTransfers,
      savedDescriptions: state.savedDescriptions,
      contracts: state.contracts,
      salaries: state.salaries,
      users: state.users,
      roles: state.roles,
      importConfigs: state.importConfigs,
      importBatches: state.importBatches,
      financialData: useFinancialStore.getState(),
      signature: ''
    };
    dataToExport.signature = securityService.signBackup(dataToExport);

    downloadJSON(dataToExport, `AshkeGhalam-Backup-${new Date().toISOString().slice(0, 10)}`);
    addNotification('success', 'پشتیبان کامل همراه با دفتر مالی و کنترل یکپارچگی صادر شد.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const hasBackupTables = Boolean(
          json && typeof json === 'object' &&
          (json.companies || json.products || json.people || json.invoices ||
           json.vouchers || json.checks || json.transactions || json.state)
        );
        if (!hasBackupTables) {
          addNotification('error', 'ساختار فایل پشتیبان معتبر نیست.');
          return;
        }

        const formatVersion = Number(json.backupFormatVersion || 0);
        const isValid = securityService.verifyBackup(json);
        if (formatVersion >= 2 && !isValid) {
          addNotification('error', 'کنترل یکپارچگی پشتیبان ناموفق بود؛ بازیابی متوقف شد.');
          return;
        }
        if (formatVersion < 2 && !isValid &&
            !confirm('این فایل قدیمی است و کنترل یکپارچگی نسخه جدید را ندارد. فقط اگر منبع فایل را می‌شناسید ادامه دهید. آیا می‌خواهید آن را مهاجرت دهید؟')) {
          return;
        }
        if (!confirm('بازیابی، اطلاعات فعلی را با داده‌های فایل جایگزین می‌کند. آیا ادامه می‌دهید؟')) {
          return;
        }

        hydrateStore(json);
        addNotification('success', 'اطلاعات پشتیبان با موفقیت بازیابی شد.');
        window.location.reload();
      } catch (err) {
        addNotification('error', 'فایل فایل پشتیبان نامعتبر است.');
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = () => {
    localStorage.removeItem('ashke-ghalam-rbac-v14-accounting');
    sessionStorage.clear();
    addNotification('info', 'حافظه محلی با موفقیت بازنشانی شد.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
        <div className="text-right">
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Sliders className="text-indigo-400" size={28} />
            پیکربندی و تنظیمات پیشرفته
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-bold">
            کنترل دقیق پارامترهای سیستم، نگهداری از دیتابیس لوکال و گزارشات عیب‌یابی
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Tabs */}
        <aside className="lg:w-64 shrink-0 bg-slate-900/60 border border-white/10 rounded-[2rem] p-4 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={Sliders} label="تنظیمات سیستم" />
          <TabButton active={activeTab === 'database'} onClick={() => setActiveTab('database')} icon={Database} label="نگهداری دیتابیس" />
          <TabButton active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} icon={Activity} label="عیب‌یابی شبکه و مرورگر" />
          <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={Info} label="لاگ‌های امنیت و خطاها" />
        </aside>

        {/* Content Box */}
        <main className="flex-1 bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 md:p-10 shadow-2xl min-h-[50vh]">
          
          {/* TAB 1: SYSTEM SETTINGS */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-white border-b border-white/5 pb-3">تنظیمات رفتاری سیستم</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto Save Card */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-indigo-400" />
                    <span className="text-white font-bold text-sm">ذخیره‌سازی خودکار</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl">
                    <span className="text-xs text-slate-400 font-bold">فعالسازی ذخیره‌سازی خودکار اسناد</span>
                    <button 
                      onClick={() => updateConfig({ autoSave: !config.autoSave })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.autoSave !== false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.autoSave !== false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                  {config.autoSave !== false && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">فاصله زمانی همگام‌سازی (ثانیه)</span>
                      <input 
                        type="number" 
                        min="10" 
                        max="300" 
                        className="bg-slate-900 border border-white/10 rounded-lg p-2 text-center text-white font-mono text-xs w-16" 
                        value={config.autoSaveInterval || 60} 
                        onChange={e => updateConfig({ autoSaveInterval: Number(e.target.value) })} 
                      />
                    </div>
                  )}
                </div>

                {/* Thousand Separator Card */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Sliders size={18} className="text-teal-400" />
                    <span className="text-white font-bold text-sm">فرمت و واحد شمارش پول</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl">
                    <span className="text-xs text-slate-400 font-bold">جداکننده سه رقمی هزارگان اعداد</span>
                    <button 
                      onClick={() => updateConfig({ thousandSeparator: !config.thousandSeparator })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.thousandSeparator !== false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.thousandSeparator !== false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">رقم‌های اعشار پس از ممیز</span>
                    <select 
                      className="bg-slate-900 border border-white/10 rounded-lg p-2 text-white font-bold text-xs" 
                      value={config.decimalPlaces || 0} 
                      onChange={e => updateConfig({ decimalPlaces: Number(e.target.value) })}
                    >
                      <option value="0">بدون اعشار</option>
                      <option value="2">۲ رقم اعشار</option>
                      <option value="3">۳ رقم اعشار</option>
                    </select>
                  </div>
                </div>

                {/* Confirmation Modals */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle size={18} className="text-amber-400" />
                    <span className="text-white font-bold text-sm">تأیید حذف اسناد مالی</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">حذف فاکتورها</span>
                    <button 
                      onClick={() => updateConfig({ confirmDeleteInvoice: !config.confirmDeleteInvoice })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.confirmDeleteInvoice !== false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.confirmDeleteInvoice !== false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">حذف محصولات انبار</span>
                    <button 
                      onClick={() => updateConfig({ confirmDeleteProduct: !config.confirmDeleteProduct })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.confirmDeleteProduct !== false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.confirmDeleteProduct !== false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                </div>

                {/* Display Preferences */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles size={18} className="text-purple-400" />
                    <span className="text-white font-bold text-sm">شخصی‌سازی نمایش المان‌ها</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">نمایش کد اختصاصی کالا</span>
                    <button 
                      onClick={() => updateConfig({ showProductCode: !config.showProductCode })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.showProductCode !== false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.showProductCode !== false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">نمایش سود خالص در فاکتورها</span>
                    <button 
                      onClick={() => updateConfig({ showProfit: !config.showProfit })} 
                      className={`w-10 h-6 rounded-full transition-all relative ${config.showProfit || false ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.showProfit || false ? 'left-1' : 'right-1'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATABASE OPERATIONS */}
          {activeTab === 'database' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-black text-white border-b border-white/5 pb-3">پشتیبان‌گیری و بازیابی اطلاعات</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="bg-slate-950/60 border border-white/5 p-6 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <Download className="text-teal-400" size={16} />
                      خروجی گرفتن از تمام پایگاه داده
                    </h3>
                    <p className="text-xs text-slate-500 leading-6">
                      دانلود نسخه متنی کامل پایگاه داده محلی (JSON) شامل تمامی فاکتورها، شرکت‌ها، اشخاص، چک‌ها، اسناد و انبار کالاها.
                    </p>
                  </div>
                  <button 
                    onClick={handleExportBackup} 
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-teal-600/10 flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    <span>پشتیبان‌گیری کامل (JSON)</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="bg-slate-950/60 border border-white/5 p-6 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <Upload className="text-indigo-400" size={16} />
                      وارد کردن اطلاعات پشتیبان
                    </h3>
                    <p className="text-xs text-slate-500 leading-6">
                      با بارگذاری فایل پشتیبان قبلی، تمامی اطلاعات جاری جایگزین و بازنشانی خواهند شد. قبل از اجرا مطمئن شوید فایل معتبر است.
                    </p>
                  </div>
                  <label className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-xs transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10">
                    <Upload size={14} />
                    <span>بارگذاری و بازیابی فایل JSON</span>
                    <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                  </label>
                </div>

                {/* Clear Card */}
                <div className="bg-rose-950/10 border border-rose-500/20 p-6 rounded-2xl md:col-span-2 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="space-y-1.5 text-right flex-1">
                    <h3 className="text-rose-400 font-bold text-sm flex items-center gap-2">
                      <AlertTriangle size={18} />
                      بازنشانی کامل تنظیمات و پاکسازی محلی (فکتوری ریست)
                    </h3>
                    <p className="text-xs text-slate-500 leading-6">
                      این کار تمام پایگاه‌های محلی ذخیره شده، اطلاعات شرکت‌ها، فاکتورها، نقش‌ها و تنظیمات اختصاصی دستگاه جاری را به طور کامل نابود خواهد کرد. در صورت عدم اطمینان، ابتدا خروجی پشتیبان بگیرید.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowResetConfirm(true)} 
                    className="shrink-0 bg-rose-600 hover:bg-rose-500 text-white px-6 py-4 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/15"
                  >
                    <Trash2 size={14} />
                    <span>حذف کامل و ریست کارخانه</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-black text-white border-b border-white/5 pb-3">ابزارهای عیب‌یابی و آزمایش</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Storage estimate card */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <HardDrive size={14} className="text-teal-400" />
                    <span>فضای دیتابیس مرورگر</span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono">{toPersianDigits(dbEstimate.usage)} MB</div>
                  <div className="text-[10px] text-slate-500">محدوده سهمیه مجاز دستگاه: {toPersianDigits(dbEstimate.quota)} MB</div>
                </div>

                {/* Connection Ping Card */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Network size={14} className="text-indigo-400" />
                    <span>تأخیر شبکه با سرور</span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {testingLatency ? (
                      <span className="text-xs text-slate-500 animate-pulse">در حال سنجش...</span>
                    ) : latency !== null ? (
                      `${toPersianDigits(latency)} ms`
                    ) : (
                      'ناموفق'
                    )}
                  </div>
                  <button 
                    onClick={testConnectionLatency} 
                    disabled={testingLatency}
                    className="text-[10px] text-indigo-400 font-bold hover:underline"
                  >
                    تست مجدد پینگ
                  </button>
                </div>

                {/* Database Record Counts */}
                <div className="bg-slate-950/60 border border-white/5 p-5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Cpu size={14} className="text-purple-400" />
                    <span>تراکنش‌های پایگاه داده جاری</span>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div className="flex justify-between"><span>شعب:</span><span className="font-mono">{toPersianDigits(companies.length)}</span></div>
                    <div className="flex justify-between"><span>فاکتورها:</span><span className="font-mono">{toPersianDigits(invoices.length)}</span></div>
                    <div className="flex justify-between"><span>کالاها:</span><span className="font-mono">{toPersianDigits(products.length)}</span></div>
                    <div className="flex justify-between"><span>اشخاص:</span><span className="font-mono">{toPersianDigits(people.length)}</span></div>
                  </div>
                </div>
              </div>

              {/* Browser details Card */}
              <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                <h3 className="text-white font-bold text-xs mb-3">مشخصات فنی سیستم‌عامل و مرورگر کلاینت</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-400">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-sans">سیستم‌عامل (User Agent):</span>
                    <span className="text-left max-w-[250px] truncate" title={navigator.userAgent}>{navigator.userAgent}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-sans">زبان محلی کلاینت:</span>
                    <span>{navigator.language}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-sans">اتصال کوکی‌ها:</span>
                    <span>{navigator.cookieEnabled ? 'فعال' : 'غیرفعال'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-sans">وضعیت آفلاین PWA:</span>
                    <span>{navigator.onLine ? 'آنلاین' : 'آفلاین'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h2 className="text-lg font-black text-white">لاگ تراکنش‌ها و هشدارهای امنیتی</h2>
                <button 
                  onClick={loadAuditLogs} 
                  className="p-2 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all"
                  title="تازه سازی لیست"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-600 italic text-xs">
                  هیچ لاگی در سیستم ثبت نشده است یا دسترسی به پایگاه داده لاگ‌ها مسدود است.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                        log.severity === 'CRITICAL' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                        log.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                        log.severity === 'MEDIUM' ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' :
                        'bg-slate-950/60 border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          log.action === 'DELETE' ? 'bg-rose-500/20 text-rose-400' :
                          log.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {log.action}
                        </span>
                        <div>
                          <p className="font-black text-white">{log.entity} / شناسه {log.entityId.substring(0, 8)}</p>
                          <p className="text-[10px] text-slate-500 font-normal">کاربر: {log.userName} | IP: {log.ip || '---'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono self-end md:self-auto">
                        <span>{toPersianDigits(new Date(log.timestamp).toLocaleDateString('fa-IR'))}</span>
                        <span>{toPersianDigits(new Date(log.timestamp).toLocaleTimeString('fa-IR'))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleFactoryReset}
        title="تأیید بازنشانی کارخانه"
        message="آیا از پاکسازی کامل اطلاعات لوکال جاری مطمئن هستید؟ این عمل غیرقابل بازگشت است و تمام داده‌ها از بین خواهند رفت."
      />
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-xs font-black shrink-0 lg:shrink-1 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    }`}
  >
    <Icon size={16} />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

export default AdvancedSettings;
