import React, { useEffect, useState } from 'react';
import {
  Cloud, LockKeyhole, ShieldCheck, UploadCloud, RefreshCw, Trash2,
  AlertCircle, CheckCircle2, HardDrive, RotateCcw, Info
} from 'lucide-react';
import { useStore } from '../store';
import { useFinancialStore } from '../store-financial';
import { hostBackupService, HostBackupEntry } from '../services/hostBackupService';
import { backupMigrationService } from '../services/backupMigrationService';
import { workspaceService } from '../services/workspaceService';
import { toPersianDigits } from '../utils';

type Notice = { kind: 'success' | 'error' | 'warning' | 'info'; text: string };

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${toPersianDigits(value)} بایت`;
  if (value < 1024 * 1024) return `${toPersianDigits((value / 1024).toFixed(1))} کیلوبایت`;
  return `${toPersianDigits((value / (1024 * 1024)).toFixed(2))} مگابایت`;
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export default function CloudBackupVault() {
  const [snapshots, setSnapshots] = useState<HostBackupEntry[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = async (forceEncryptionCheck = false) => {
    setIsLoading(true);
    const configured = workspaceService.isRemoteCloudConfigured();
    setIsConfigured(configured);
    try {
      const ready = configured
        ? await hostBackupService.supportsEncryptedServerBackups(forceEncryptionCheck)
        : false;
      setEncryptionReady(ready);
      if (configured) {
        if (!ready) {
          const entries = await hostBackupService.listHostBackupsDetailed();
          setSnapshots(entries.success ? entries.backups : []);
          setNotice({
            kind: 'warning',
            text: entries.success
              ? 'سرور فعلی رمزنگاری AES-256-GCM را تأیید نکرده است؛ این نسخه از برنامه بکاپ جدید را به آن ارسال نمی‌کند. ابتدا نسخهٔ جدید host-backend را نصب و وضعیت را تازه‌سازی کنید.'
              : 'رمزنگاری سرور تأیید نشد و فهرست بکاپ‌ها هم قابل تأیید نیست. ' + (entries.error || '')
          });
        } else {
          const entries = await hostBackupService.listHostBackupsDetailed();
          setSnapshots(entries.success ? entries.backups : []);
          setNotice(entries.success ? null : {
            kind: 'error',
            text: 'خواندن فهرست از سرور تأیید نشد؛ فهرست خالی را به معنی نبود بکاپ تلقی نکنید. ' + (entries.error || '')
          });
        }
      } else {
        setSnapshots([]);
        setNotice({
          kind: 'info',
          text: 'اتصال امن فضای کاری تنظیم نشده است. در این حالت هیچ داده‌ای به سرور ارسال نمی‌شود؛ از بخش بکاپ محلی برای خروجی رمزگذاری‌شده استفاده کنید.'
        });
      }
    } catch {
      setEncryptionReady(false);
      setNotice({
        kind: 'error',
        text: 'بررسی اتصال یا فهرست بکاپ‌های سرور ناموفق بود. وضعیت ذخیره‌سازی را موفق فرض نکنید.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, []);

  const handleUploadBackup = async () => {
    if (!isConfigured) {
      setNotice({ kind: 'warning', text: 'ابتدا سرور و اعتبارنامهٔ فضای کاری را در تنظیمات پیکربندی کنید.' });
      return;
    }
    const ready = await hostBackupService.supportsEncryptedServerBackups(true);
    setEncryptionReady(ready);
    if (!ready) {
      setNotice({
        kind: 'error',
        text: 'ارسال لغو شد: سرور رمزنگاری در حالت سکون را تأیید نکرده است. هیچ بکاپ جدیدی ارسال نشد.'
      });
      return;
    }
    if (!window.confirm('داده‌های حسابداری به سرور تنظیم‌شده ارسال می‌شوند. فایل روی دیسک سرور با AES-256-GCM رمزگذاری می‌شود، اما این رمزنگاری سرتاسری نیست و مدیر مجاز سرور می‌تواند داده را از API بازیابی کند. ادامه می‌دهید؟')) {
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      const result = await hostBackupService.createBackup(useStore.getState(), 'manual', 'پشتیبان دستی از گاوصندوق ابری');
      if (result.remoteSaved === true && result.remoteStatus === 'SYNCED') {
        setNotice({ kind: 'success', text: 'پشتیبان در سرور ثبت و پاسخ رمزنگاری AES-256-GCM تأیید شد.' });
      } else {
        setNotice({
          kind: result.remoteStatus === 'WAITING' ? 'warning' : 'error',
          text: result.error || 'ذخیرهٔ ابری تأیید نشد؛ وضعیت را موفق فرض نکنید. نسخهٔ محلی دستگاه جداگانه بررسی شود.'
        });
      }
      await refresh(true);
    } catch (error: any) {
      setNotice({ kind: 'error', text: error?.message || 'ایجاد پشتیبان ابری ناموفق بود.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (snapshot: HostBackupEntry) => {
    if (!window.confirm('این کار اطلاعات فعلی حسابداری را با نسخهٔ انتخابی جایگزین می‌کند. قبل از ادامه مطمئن شوید یک بکاپ مستقل از اطلاعات فعلی دارید. ادامه می‌دهید؟')) {
      return;
    }
    setBusyId(snapshot.id);
    setNotice(null);
    try {
      const result = await hostBackupService.restoreFromHost(snapshot.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'بازیابی از سرور ناموفق بود.');
      }
      if (!result.integrityVerified && !window.confirm('یکپارچگی کامل payload قابل تأیید نشد؛ ممکن است بکاپ قدیمی باشد. آیا منبع این فایل را تأیید می‌کنید و با مسئولیت خود ادامه می‌دهید؟')) {
        return;
      }

      const payload = result.data;
      const restoredData = payload.data && typeof payload.data === 'object' ? { ...payload.data } : null;
      if (!restoredData) throw new Error('ساختار داده در فایل پشتیبان معتبر نیست.');
      const restoredAssets = payload.assets || {};

      if (Array.isArray(restoredAssets.companies) && Array.isArray(restoredData.companies)) {
        restoredData.companies = restoredData.companies.map((company: any) => {
          const asset = restoredAssets.companies.find((entry: any) => entry.id === company.id);
          return asset
            ? { ...company, logo: asset.logo ?? company.logo, stamp: asset.stamp ?? company.stamp, signature: asset.signature ?? company.signature }
            : company;
        });
      }
      if (Array.isArray(restoredAssets.checkImages)) restoredData.checkImages = restoredAssets.checkImages;
      if (Array.isArray(restoredAssets.signatures)) restoredData.signatures = restoredAssets.signatures;

      const { financialData, ...accountingState } = restoredData;
      const migrated = backupMigrationService.migrateBackupData(accountingState);
      useStore.getState().hydrateStore(migrated);
      if (financialData && typeof financialData === 'object' && !Array.isArray(financialData)) {
        useFinancialStore.setState(financialData);
      }

      setNotice({
        kind: result.integrityVerified ? 'success' : 'warning',
        text: result.integrityVerified
          ? 'بازیابی انجام شد و کنترل یکپارچگی payload تأیید شد.'
          : 'بازیابی انجام شد، اما کنترل کامل یکپارچگی payload تأیید نشد.'
      });
      window.location.reload();
    } catch (error: any) {
      setNotice({ kind: 'error', text: error?.message || 'بازیابی ناموفق بود.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (snapshot: HostBackupEntry) => {
    if (!window.confirm('نسخهٔ پشتیبان از سرور حذف شود؟ این کار برگشت‌پذیر نیست.')) return;
    setBusyId(snapshot.id);
    try {
      const success = await hostBackupService.deleteHostBackup(snapshot.id);
      if (!success) throw new Error('حذف توسط سرور تأیید نشد.');
      setNotice({ kind: 'success', text: 'نسخهٔ پشتیبان از سرور حذف شد.' });
      await refresh();
    } catch (error: any) {
      setNotice({ kind: 'error', text: error?.message || 'حذف بکاپ ناموفق بود.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" dir="rtl">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-3 text-sky-700"><Cloud className="h-7 w-7" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">گاوصندوق ابری پشتیبان‌گیری</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">فهرست و عملیات روی بکاپ‌های واقعی endpoint سرور؛ این صفحه دادهٔ نمونه یا موفقیت ساختگی نمایش نمی‌دهد.</p>
          </div>
        </div>
        <button onClick={() => void refresh(true)} disabled={isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> تازه‌سازی وضعیت
        </button>
      </header>

      {notice && (
        <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${
          notice.kind === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' :
          notice.kind === 'error' ? 'border-rose-300 bg-rose-50 text-rose-900' :
          notice.kind === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' :
          'border-sky-300 bg-sky-50 text-sky-950'
        }`}>
          {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> :
           notice.kind === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> :
           notice.kind === 'warning' ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> :
           <Info className="mt-0.5 h-5 w-5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><HardDrive className="h-5 w-5 text-sky-700" /> اتصال سرور</div>
          <div className="text-sm text-slate-700">{isConfigured ? 'اعتبارنامهٔ فضای کاری تنظیم شده' : 'پیکربندی نشده'}</div>
          <div className="mt-3 text-xs leading-5 text-slate-500">معتبر بودن پیکربندی به معنی موفقیت عملیات یا وجود بکاپ نیست؛ هر عملیات از پاسخ واقعی API بررسی می‌شود.</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><LockKeyhole className="h-5 w-5 text-emerald-700" /> رمزنگاری در حالت سکون</div>
          <div className={`text-sm font-bold ${encryptionReady ? 'text-emerald-800' : 'text-amber-800'}`}>{encryptionReady ? 'سرور AES-256-GCM را تأیید کرده' : 'تأیید نشده'}</div>
          <div className="mt-3 text-xs leading-5 text-slate-500">این محافظت فقط فایل روی دیسک سرور را رمز می‌کند؛ این روش رمزنگاری سرتاسری نیست.</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-indigo-700" /> وضعیت فهرست</div>
          <div className="text-2xl font-black text-slate-900">{toPersianDigits(snapshots.length)} <span className="text-sm font-medium text-slate-600">نسخه</span></div>
          <div className="mt-3 text-xs leading-5 text-slate-500">تعداد بر اساس فهرستی است که سرور برگردانده؛ خالی بودن فهرست به معنی وجود بکاپ نیست.</div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">پشتیبان‌گیری ابری دستی</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">ارسال فقط وقتی فعال است که endpoint احرازشده، رمزنگاری AES-256-GCM را صریحاً تأیید کند.</p>
          </div>
          <button onClick={() => void handleUploadBackup()} disabled={isLoading || !isConfigured || !encryptionReady} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
            <UploadCloud className="h-4 w-4" /> {isLoading ? 'در حال بررسی/ارسال...' : 'ایجاد بکاپ ابری رمزگذاری‌شده'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-black text-slate-900">نسخه‌های ثبت‌شده در سرور</h2>
          <span className="text-xs text-slate-600">محتوا در index محلی مرورگر ذخیره یا شبیه‌سازی نمی‌شود.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">شناسه</th>
                <th className="p-3">تاریخ</th>
                <th className="p-3">نوع</th>
                <th className="p-3">حجم ذخیره‌شده</th>
                <th className="p-3">حفاظت دیسک</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center leading-6 text-slate-600">
                  {isLoading ? 'در حال دریافت فهرست واقعی از سرور...' : isConfigured ? 'سرور فهرست بکاپی برنگرداند یا بکاپی ثبت نشده است.' : 'برای نمایش بکاپ‌های سرور، ابتدا اتصال امن فضای کاری را تنظیم کنید.'}
                </td></tr>
              ) : snapshots.map(snapshot => {
                const isBusy = busyId === snapshot.id;
                const encrypted = snapshot.encryptedAtRest === true && snapshot.encryption === 'AES-256-GCM';
                return (
                  <tr key={snapshot.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs text-slate-700">{snapshot.id}</td>
                    <td className="p-3 text-slate-700">{formatTimestamp(snapshot.timestamp)}</td>
                    <td className="p-3 text-slate-700">{snapshot.type === 'auto' ? 'خودکار' : 'دستی'}</td>
                    <td className="p-3 text-slate-700">{formatBytes(snapshot.size)}</td>
                    <td className="p-3">
                      {encrypted
                        ? <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"><LockKeyhole className="h-3.5 w-3.5" /> AES-256-GCM</span>
                        : <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900"><AlertCircle className="h-3.5 w-3.5" /> تأیید نشده</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => void handleRestore(snapshot)} disabled={isBusy} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 disabled:opacity-50">
                          <RotateCcw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} /> بازیابی
                        </button>
                        <button onClick={() => void handleDelete(snapshot)} disabled={isBusy} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50" title="حذف نسخه">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
