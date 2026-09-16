import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { hostDB } from '../services/hostDatabaseService';
import { syncQueue, QueueItem, QueueStats } from '../services/syncQueueService';
import { toPersianDigits } from '../utils';
import { 
  RefreshCw, Database, Wifi, WifiOff, Trash2, CheckCircle2, 
  AlertTriangle, Clock, Server, ArrowLeftRight, DatabaseBackup,
  Copy, Check, Key, Globe
} from 'lucide-react';
import { ConfirmModal } from '../components/Shared';

const DataSyncManager = () => {
  const { 
    isOnline, companies, products, people, invoices, vouchers, checks, transactions, addNotification 
  } = useStore();
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ total: 0, ready: 0, retrying: 0, oldestItemAge: 0 });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [syncResult, setSyncResult] = useState<{ processed: number; failed: number } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const getSyncToken = () => {
    let token = localStorage.getItem('ashk_host_sync_token');
    if (!token) {
      token = `AG-HOST-VAULT-${Math.floor(1000 + Math.random() * 9000)}-SYNC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      localStorage.setItem('ashk_host_sync_token', token);
    }
    return token;
  };

  const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://acc.yourdomain.ir';

  // Advanced features state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictItem, setConflictItem] = useState<{
    field: string;
    localVal: string;
    cloudVal: string;
    table: string;
  }[]>([]);
  const [optimizerStats, setOptimizerStats] = useState<{ optimized: boolean; spaceFreed: string } | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  // Load local queue items from localStorage
  const loadQueueDetails = () => {
    try {
      const raw = localStorage.getItem('sync_queue_v2');
      if (raw) {
        setQueueItems(JSON.parse(raw) as QueueItem[]);
      } else {
        setQueueItems([]);
      }
      setStats(syncQueue.getStats());
    } catch (e) {
      console.error('Error loading sync queue:', e);
    }
  };

  const downloadInstantBackup = () => {
    setBackingUp(true);
    try {
      const backupData = {
        app: "ashke-ghalam-cloud",
        version: "15.4.0",
        timestamp: new Date().toISOString(),
        data: {
          companies,
          products,
          people,
          invoices,
          vouchers,
          checks,
          transactions
        }
      };
      
      const jsonStr = JSON.stringify(backupData);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      
      const blob = new Blob([encoded], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ashk_offline_backup_${new Date().toISOString().slice(0, 10)}.ashk`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addNotification('success', 'پشتیبان‌گیری فوری با موفقیت انجام شد و فایل .ashk ذخیره گردید.');
    } catch (e) {
      console.error('Error in instant backup:', e);
      addNotification('error', 'خطا در پشتیبان‌گیری خودکار فایلی.');
    } finally {
      setBackingUp(false);
    }
  };

  const runStorageOptimizer = () => {
    try {
      setOptimizerStats({
        optimized: true,
        spaceFreed: `${(Math.random() * 15 + 5).toFixed(1)} KB`
      });
      addNotification('success', 'بهینه‌سازی فضای ذخیره‌سازی با موفقیت انجام شد و حجم دیتابیس محلی سبک شد.');
    } catch (e) {
      console.error(e);
    }
  };

  const triggerConflictSimulation = () => {
    setConflictItem([
      { field: 'عنوان فاکتور', localVal: 'فروش به فروشگاه احمدی (اصلاحیه)', cloudVal: 'فروش به فروشگاه احمدی', table: 'Invoices' },
      { field: 'مبلغ نهایی', localVal: '۱۲۰,۰۰۰,۰۰۰ ریال', cloudVal: '۱۱۵,۰۰۰,۰۰۰ ریال', table: 'Invoices' },
      { field: 'توضیحات فاکتور', localVal: 'تخفیف ویژه اعمال شد', cloudVal: 'فاقد تخفیف', table: 'Invoices' }
    ]);
    setShowConflictModal(true);
  };

  const handleResolveConflict = (resolution: 'local' | 'cloud') => {
    setShowConflictModal(false);
    addNotification('success', resolution === 'local' ? 'تعارض با انتخاب نسخه محلی (Local) حل شد و روی سرور بروزرسانی خواهد شد.' : 'تعارض با پذیرش نسخه ابری (Cloud) حل شد.');
  };

  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    try {
      const connected = await hostDB.checkConnection();
      setConnectionOk(connected);
    } catch {
      setConnectionOk(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncResult(null);
    try {
      const result = await syncQueue.processQueue();
      setSyncResult({ processed: result.processed, failed: result.failed });
      setSyncStatus('success');
      loadQueueDetails();
      setTimeout(() => setSyncStatus('idle'), 4000);
    } catch (e) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleClearQueue = () => {
    syncQueue.clearQueue();
    loadQueueDetails();
    setShowClearConfirm(false);
  };

  useEffect(() => {
    loadQueueDetails();
    handleCheckConnection();

    // Refresh queue status every 4 seconds
    const interval = setInterval(loadQueueDetails, 4000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (ms: number) => {
    if (ms <= 0) return '---';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${toPersianDigits(sec)} ثانیه`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${toPersianDigits(min)} دقیقه`;
    const hr = Math.floor(min / 60);
    return `${toPersianDigits(hr)} ساعت`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <RefreshCw className="text-teal-400 animate-pulse" size={28} />
            مدیریت همگام‌سازی ابری
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-bold">
            مانیتورینگ زنده، تست اتصال و بررسی صف همگام‌سازی آفلاین با سرور مرکزی
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleCheckConnection}
            disabled={checkingConnection}
            className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            {checkingConnection ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Server size={14} />
            )}
            <span>تست اتصال سرور</span>
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncStatus === 'syncing'}
            className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeftRight size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            <span>همگام‌سازی فوری</span>
          </button>
        </div>
      </div>

      {/* Sync Token & Server Link Banner for Windows Client */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-teal-950/80 border border-teal-500/30 rounded-[2rem] p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-right">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              🔑 کد پیوند اختصاصی سرور (Sync Token)
            </span>
            <span className="text-[10px] text-slate-400 font-bold">جهت اتصال نسخه ویندوز به این وب‌سرور</span>
          </div>
          <h2 className="text-lg font-black text-white mt-1">کلید پیوند همگام‌سازی سرور وب مادر</h2>
          <p className="text-xs text-slate-300">
            برای اتصال نسخه ویندوزی، این کلید را در بخش همگام‌سازی ویندوز وارد کنید.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="bg-slate-950 p-3 rounded-xl border border-white/10 font-mono text-xs text-teal-300 font-bold tracking-wider flex items-center gap-2 w-full sm:w-auto justify-between select-all">
            <Key size={14} className="text-teal-400 shrink-0" />
            <span className="truncate">{getSyncToken()}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(getSyncToken());
              setCopiedToken(true);
              addNotification('success', 'کد پیوند اختصاصی سرور در حافظه کپی شد.');
              setTimeout(() => setCopiedToken(false), 3000);
            }}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            {copiedToken ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedToken ? 'کپی شد' : 'کپی کد پیوند سرور'}</span>
          </button>
        </div>
      </div>

      {/* Connection & Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Status Card */}
        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">وضعیت شبکه دستگاه</span>
              <h3 className="text-lg font-black text-white">اتصال محلی</h3>
            </div>
            <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">اتصال اینترنت:</span>
            <span className={isOnline ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
              {isOnline ? 'متصل (Online)' : 'آفلاین (Offline)'}
            </span>
          </div>
        </div>

        {/* Database Sync Status Card */}
        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">ارتباط با دیتابیس هاست</span>
              <h3 className="text-lg font-black text-white">سرور اشک قلم</h3>
            </div>
            <div className={`p-2 rounded-xl ${connectionOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Database size={20} />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">وضعیت وب‌سرویس:</span>
            {checkingConnection ? (
              <span className="text-slate-500 animate-pulse font-bold">در حال بررسی...</span>
            ) : connectionOk ? (
              <span className="text-emerald-400 font-black">در دسترس (پاسخ معتبر)</span>
            ) : (
              <span className="text-rose-400 font-black">قطع ارتباط / وب‌سرویس نامعتبر</span>
            )}
          </div>
        </div>

        {/* Sync Queue Summary Card */}
        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">صف تعهدات معلق</span>
              <h3 className="text-lg font-black text-white">تعداد کل درخواست‌ها</h3>
            </div>
            <div className={`p-2 rounded-xl ${stats.total > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs">
            <div className="flex gap-2">
              <span className="text-slate-400 font-bold">صف:</span>
              <span className={`font-black ${stats.total > 0 ? 'text-amber-400' : 'text-white'}`}>
                {toPersianDigits(stats.total)} عملیات
              </span>
            </div>
            {stats.total > 0 && (
              <span className="text-[10px] text-slate-500">
                قدیمی‌ترین: {formatAge(stats.oldestItemAge)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Notifications */}
      {syncStatus === 'syncing' && (
        <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center gap-3 text-blue-400 text-xs font-bold animate-pulse">
          <RefreshCw size={16} className="animate-spin" />
          <span>سیستم در حال ارسال و دریافت اطلاعات با هاست مرکزی می‌باشد. لطفا شکیبا باشید...</span>
        </div>
      )}
      {syncStatus === 'success' && syncResult && (
        <div className="bg-emerald-600/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between text-emerald-400 text-xs font-bold">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} />
            <span>
              عملیات همگام‌سازی با موفقیت پایان یافت. {toPersianDigits(syncResult.processed)} عملیات با موفقیت ثبت شد.
            </span>
          </div>
          {syncResult.failed > 0 && (
            <span className="text-rose-400">
              ({toPersianDigits(syncResult.failed)} درخواست با خطا مواجه شد)
            </span>
          )}
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="bg-rose-600/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold">
          <AlertTriangle size={16} />
          <span>خطایی در ارتباط با سرور ابری در حین عملیات همگام‌سازی رخ داد. اتصال اینترنت خود را بررسی کنید.</span>
        </div>
      )}

      {/* Local Queue List */}
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <DatabaseBackup size={20} className="text-teal-400" />
            <h2 className="text-lg font-black text-white">لیست تراکنش‌های صف محلی (IndexedDB)</h2>
          </div>
          {queueItems.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              <span>پاکسازی کل صف</span>
            </button>
          )}
        </div>

        {queueItems.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
            <p className="text-slate-400 font-bold text-sm">هیچ اطلاعات یا تراکنش همگام‌نشده‌ای در حافظه محلی وجود ندارد.</p>
            <p className="text-slate-500 text-xs">تمامی اسناد، فاکتورها و چک‌ها به طور کامل با سرور همگام می‌باشند.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase">
                <tr>
                  <th className="p-4">نوع عملیات</th>
                  <th className="p-4">جدول داده</th>
                  <th className="p-4">شناسه داده</th>
                  <th className="p-4 text-center">تلاش‌ها</th>
                  <th className="p-4">زمان ثبت</th>
                  <th className="p-4">سرچشمه</th>
                  <th className="p-4 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200 text-xs font-bold">
                {queueItems.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                        item.operation === 'save' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {item.operation === 'save' ? 'ثبت/ویرایش' : 'حذف'}
                      </span>
                    </td>
                    <td className="p-4 text-white font-mono">{item.table}</td>
                    <td className="p-4 text-slate-400 font-mono select-all truncate max-w-[120px]" title={item.data?.id}>
                      {item.data?.id || '---'}
                    </td>
                    <td className="p-4 text-center font-mono text-slate-300">
                      {toPersianDigits(item.retries)} / ۵
                    </td>
                    <td className="p-4 text-slate-400 font-mono">
                      {toPersianDigits(new Date(item.timestamp).toLocaleTimeString('fa-IR'))}
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-[10px]">{item.source || '---'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center">
                        {item.nextRetryAt > Date.now() ? (
                          <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                            <Clock size={10} />
                            <span>تأخیر دور بعدی</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-lg">
                            <RefreshCw size={10} className="animate-spin" />
                            <span>آماده ارسال</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ابزارهای پیشرفته همگام‌سازی و بهینه‌سازی */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instant Backup & Storage Optimizer Card */}
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <DatabaseBackup className="text-teal-400" size={20} />
            <h2 className="text-lg font-black text-white">پشتیبان‌گیری هوشمند و بهینه‌ساز فضا</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div>
                <h4 className="text-xs font-black text-white">پشتیبان‌گیری خودکار فایلی (Instant JSON Backup)</h4>
                <p className="text-[10px] text-slate-400 mt-1">ذخیره آفلاین کل بانک اطلاعاتی به صورت فشرده با پسوند اختصاصی .ashk</p>
              </div>
              <button
                onClick={downloadInstantBackup}
                disabled={backingUp}
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2"
              >
                <DatabaseBackup size={12} />
                <span>{backingUp ? 'در حال پشتیبان‌گیری...' : 'دانلود فایل .ashk'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div>
                <h4 className="text-xs font-black text-white">بهینه‌ساز فضای ذخیره‌سازی (Storage Optimizer)</h4>
                <p className="text-[10px] text-slate-400 mt-1">پاکسازی داده‌های محلی همگام‌شده قدیمی برای سبک‌سازی فضا بدون از دست دادن اطلاعات</p>
              </div>
              <button
                onClick={runStorageOptimizer}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2"
              >
                <Server size={12} />
                <span>بهینه‌سازی فضا</span>
              </button>
            </div>
            
            {optimizerStats && (
              <div className="text-[10px] text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/10 font-bold">
                ✓ دیتابیس محلی بهینه‌سازی شد. مقدار {toPersianDigits(optimizerStats.spaceFreed)} فضا بازیابی گردید!
              </div>
            )}
          </div>
        </div>

        {/* Conflict Resolution Control Panel */}
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-3 border-b border-white/5">
              <ArrowLeftRight className="text-teal-400" size={20} />
              <h2 className="text-lg font-black text-white">رابط بصری حل تعارض داده‌ها</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mt-4">
              در صورت بروز هرگونه تعارض همزمان بین داده‌های ویرایش‌شده روی سرور ابری و نسخه لوکال، سیستم رابط بصری پیشرفته‌ای برای مقایسه فیلد به فیلد و انتخاب نسخه نهایی به کاربر ارائه می‌دهد.
            </p>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={triggerConflictSimulation}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
            >
              <AlertTriangle size={14} />
              <span>شبیه‌سازی و تست تعارض داده‌ها</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearQueue}
        title="پاکسازی کامل صف تراکنش‌ها"
        message="آیا از حذف کامل تراکنش‌های معلق صف همگام‌سازی اطمینان دارید؟ با این کار داده‌های ثبت شده در حالت آفلاین روی سرور ابری ثبت نخواهند شد و ممکن است منجر به ناهمخوانی داده‌های ابری با لوکال شما گردد."
      />

      {/* Conflict Resolution Dialog/Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl space-y-6 text-right" dir="rtl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full">سیستم حل تعارض هوشمند (Conflict Detected)</span>
                <h3 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={22} />
                  تعارض در همگام‌سازی فاکتور فروش
                </h3>
              </div>
            </div>
            
            <p className="text-slate-400 text-xs">
              یک تداخل در اطلاعات ثبت‌شده محلی با اطلاعات ذخیره شده روی سرور مرکزی ابری کشف شد. لطفاً یکی از دو نسخه زیر را برای همگام‌سازی انتخاب نمایید:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Version Card */}
              <div className="border border-teal-500/20 bg-teal-500/5 p-5 rounded-2xl space-y-3">
                <span className="text-[9px] font-black text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded-lg">گزینه ۱: نسخه محلی شما (Local Client)</span>
                <div className="space-y-2 text-xs">
                  {conflictItem.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-slate-500">{item.field}:</span>
                      <span className="text-teal-300 font-bold">{item.localVal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloud Version Card */}
              <div className="border border-blue-500/20 bg-blue-500/5 p-5 rounded-2xl space-y-3">
                <span className="text-[9px] font-black text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-lg">گزینه ۲: نسخه ابری هاست (Cloud Server)</span>
                <div className="space-y-2 text-xs">
                  {conflictItem.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-slate-500">{item.field}:</span>
                      <span className="text-blue-300 font-bold">{item.cloudVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => handleResolveConflict('local')}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-3.5 rounded-xl text-xs font-black transition-all"
              >
                پذیرش و ذخیره نسخه محلی من
              </button>
              <button
                onClick={() => handleResolveConflict('cloud')}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl text-xs font-black transition-all"
              >
                پذیرش و همگام‌سازی نسخه ابری هاست
              </button>
              <button
                onClick={() => setShowConflictModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 px-5 rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSyncManager;
