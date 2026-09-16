import React, { useState } from 'react';
import { 
  Network, Server, Laptop, Users, ShieldCheck, RefreshCw, 
  Lock, Unlock, AlertCircle, CheckCircle2, Wifi, Settings,
  Radio, HardDrive
} from 'lucide-react';
import { 
  LanSyncService, LanNetworkConfig, LanWorkstation, DocumentLock 
} from '../services/lanSyncService';
import { toPersianDigits } from '../utils';

export default function MultiUserLanHub() {
  const [config, setConfig] = useState<LanNetworkConfig>(() => LanSyncService.getConfig());
  const [workstations, setWorkstations] = useState<LanWorkstation[]>(() => LanSyncService.getWorkstations());
  const [locks, setLocks] = useState<DocumentLock[]>(() => LanSyncService.getDocumentLocks());
  const [isScanning, setIsScanning] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    LanSyncService.saveConfig(config);
    setSuccessNotice('تنظیمات شبکه محلی با موفقیت ذخیره گردید.');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleScanNodes = async () => {
    setIsScanning(true);
    await new Promise(r => setTimeout(r, 1200));
    setWorkstations(LanSyncService.getWorkstations());
    setIsScanning(false);
    setSuccessNotice('پویش شبکه محلی انجام شد. تمام سیستم‌های آنلاین شناسایی شدند.');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleUnlockDoc = (docId: string) => {
    LanSyncService.unlockDocument(docId);
    setLocks(LanSyncService.getDocumentLocks());
    setSuccessNotice('قفل سند با موفقیت برداشته شد.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* هدر صفحه */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
            <Network className="w-8 h-8 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">شبکه محلی چندکاربره (Multi-User LAN)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                بدون نیاز به اینترنت
              </span>
            </div>
            <p className="text-indigo-100/80 text-sm mt-1">
              کار همزمان صندوقداران، مدیران و انبارداران در یک فروشگاه یا شرکت با اشتراک‌گذاری دیتابیس در شبکه محلی
            </p>
          </div>
        </div>

        <button
          onClick={handleScanNodes}
          disabled={isScanning}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'در حال پویش نودها...' : 'پویش ایستگاه‌های کاری'}
        </button>
      </div>

      {/* اعلان موفقیت */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-xs">✕</button>
        </div>
      )}

      {/* کارت‌های وضعیت ظرفیت لایسنس همزمان */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">سقف کاربران همزمان لایسنس</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              مجاز
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {toPersianDigits(workstations.length)} <span className="text-sm font-normal text-slate-500">از</span> {toPersianDigits(config.maxConcurrentSeats)} کاربر آنلاین
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full" 
              style={{ width: `${(workstations.length / config.maxConcurrentSeats) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <Server className="w-5 h-5 text-indigo-600" />
            <span>نقش این سیستم در شبکه</span>
          </div>
          <div className="text-base font-black text-slate-800">
            {config.role === 'HOST_SERVER' ? 'سرور و پایگاه‌داده مرکزی (Host)' : 'ایستگاه کاری کلاینت (Client)'}
          </div>
          <div className="text-xs font-mono text-slate-500">
            آدرس IP سرور: {config.serverHostIp}:{config.serverPort}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <Lock className="w-5 h-5 text-amber-600" />
            <span>قفل‌های انحصاری اسناد (Locking)</span>
          </div>
          <div className="text-base font-black text-slate-800">
            {toPersianDigits(locks.length)} سند در حال ویرایش همزمان
          </div>
          <div className="text-xs text-slate-500">
            سیستم به طور خودکار از بازنویسی تصادفی فاکتورها توسط دو صندوقدار جلوگیری می‌کند.
          </div>
        </div>
      </div>

      {/* لیست ایستگاه‌های کاری آنلاین */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800">سیستم‌ها و صندوق‌های متصل به شبکه محلی</h2>
          </div>
          <span className="text-xs text-slate-500">تعداد نودها: {toPersianDigits(workstations.length)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">نام نود / ایستگاه</th>
                <th className="p-3">کاربر وارد شده</th>
                <th className="p-3">نقش کاربری</th>
                <th className="p-3">آدرس IP</th>
                <th className="p-3">سند در حال ویرایش</th>
                <th className="p-3">آخرین پینگ</th>
                <th className="p-3 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workstations.map(node => (
                <tr key={node.id} className="hover:bg-slate-50/70">
                  <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                    {node.id === 'node-host' ? <Server className="w-4 h-4 text-indigo-600" /> : <Laptop className="w-4 h-4 text-slate-500" />}
                    <span>{node.nodeName}</span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{node.username}</td>
                  <td className="p-3 text-xs text-slate-500">{node.role}</td>
                  <td className="p-3 font-mono text-xs text-indigo-700 font-bold">{node.ipAddress}</td>
                  <td className="p-3 text-xs">
                    {node.currentWorkingDoc ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                        <Lock className="w-3 h-3" /> {node.currentWorkingDoc}
                      </span>
                    ) : (
                      <span className="text-slate-400">آزاد / آماده ثبت</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-500">{node.lastPing}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <Wifi className="w-3 h-3" /> متصل
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* فرم تنظیمات شبکه */}
      <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" /> تنظیمات اتصال شبکه محلی
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">نقش این سیستم</label>
            <select
              value={config.role}
              onChange={e => setConfig({ ...config, role: e.target.value as any })}
              className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="HOST_SERVER">سرور مرکزی (پایگاه‌داده اصلی روی این رایانه است)</option>
              <option value="CLIENT_WORKSTATION">کلاینت / ایستگاه کاری متصل به سرور</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">آدرس IP سرور حسابداری در شبکه</label>
            <input
              type="text"
              value={config.serverHostIp}
              onChange={e => setConfig({ ...config, serverHostIp: e.target.value })}
              className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">پورت سوکت شبکه</label>
            <input
              type="number"
              value={config.serverPort}
              onChange={e => setConfig({ ...config, serverPort: Number(e.target.value) })}
              className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold shadow-md transition-all text-xs"
          >
            ذخیره پیکربندی شبکه محلی
          </button>
        </div>
      </form>
    </div>
  );
}
