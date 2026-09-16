import React, { useState } from 'react';
import { 
  CreditCard, Wifi, ShieldCheck, RefreshCw, CheckCircle2, 
  AlertTriangle, Settings, History, ArrowRight, Play, Terminal
} from 'lucide-react';
import { 
  PcPosService, PosConfiguration, PosTransactionResult, PosProvider, PosConnectionType 
} from '../services/pcPosService';
import { PcPosPaymentModal } from '../components/PcPosPaymentModal';
import { toPersianDigits, formatCurrency } from '../utils';

export default function PosTerminalManagement() {
  const [config, setConfig] = useState<PosConfiguration>(() => PcPosService.getConfig());
  const [history, setHistory] = useState<PosTransactionResult[]>(() => PcPosService.getHistory());
  const [isTesting, setIsTesting] = useState(false);
  const [testNotice, setTestNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [testAmount, setTestAmount] = useState('50000');

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    PcPosService.saveConfig(config);
    setTestNotice({ success: true, message: 'تنظیمات کارتخوان بانکی با موفقیت ذخیره گردید.' });
    setTimeout(() => setTestNotice(null), 4000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await PcPosService.testConnection();
      setTestNotice({ success: res.success, message: `${res.message} (زمان پاسخ: ${res.pingMs} میلی‌ثانیه)` });
    } catch (e: any) {
      setTestNotice({ success: false, message: 'خطا در برقراری ارتباط با پوز: ' + (e?.message || 'خطای سوکت') });
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestNotice(null), 5000);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* هدر صفحه */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-cyan-950 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
            <CreditCard className="w-8 h-8 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">اتصال به کارتخوان بانکی (PC-POS)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                تسویه خودکار فاکتور
              </span>
            </div>
            <p className="text-cyan-100/80 text-sm mt-1">
              انتقال خودکار مبلغ فاکتور به دستگاه پوز، جلوگیری از اشتباهات صندوقدار، دریافت شناسه ارجاع (RRN) و چاپ رسید
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all"
          >
            <Play className="w-4 h-4 fill-current" /> تست ارسال وجه به پوز
          </button>
        </div>
      </div>

      {/* نتیجه تست */}
      {testNotice && (
        <div className={`p-4 rounded-xl flex items-center justify-between animate-fadeIn ${
          testNotice.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {testNotice.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span className="text-sm font-bold">{testNotice.message}</span>
          </div>
          <button onClick={() => setTestNotice(null)} className="text-xs">✕</button>
        </div>
      )}

      {/* تنظیمات و وضعیت پوز */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSaveConfig} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> پیکربندی درایور و ارتباط کارتخوان
            </h2>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'در حال تست...' : 'تست پینگ و ارتباط'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">شرکت ارائه‌دهنده خدمات پرداخت (PSP)</label>
              <select
                value={config.provider}
                onChange={e => setConfig({ ...config, provider: e.target.value as PosProvider })}
                className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="BEHPARDAKHT">به‌پرداخت ملت (بانک ملت)</option>
                <option value="SADAD">پرداخت الکترونیک سداد (بانک ملی)</option>
                <option value="FANAP">پرداخت الکترونیک پاسارگاد (فناپ)</option>
                <option value="ASAN_PARDAKHT">آسان‌پرداخت (آپ)</option>
                <option value="SAMAN">پرداخت الکترونیک سامان (سپ)</option>
                <option value="IRAN_KISH">کارت اعتباری ایران‌کیش</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع بستر اتصال</label>
              <select
                value={config.connectionType}
                onChange={e => setConfig({ ...config, connectionType: e.target.value as PosConnectionType })}
                className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="TEST_SIMULATOR">شبیه‌ساز هوشمند (جهت تست و آموزش صندوقدار)</option>
                <option value="LAN_IP">شبکه محلی / کابل LAN (IP Socket)</option>
                <option value="SERIAL_COM">کابل سریال / پورت COM (USB to RS232)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">آدرس IP کارتخوان در شبکه</label>
              <input
                type="text"
                value={config.ipAddress}
                onChange={e => setConfig({ ...config, ipAddress: e.target.value })}
                placeholder="192.168.1.150"
                className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">پورت اتصال (Port)</label>
              <input
                type="number"
                value={config.port}
                onChange={e => setConfig({ ...config, port: Number(e.target.value) })}
                placeholder="8888"
                className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره ترمینال (Terminal ID)</label>
              <input
                type="text"
                value={config.terminalId}
                onChange={e => setConfig({ ...config, terminalId: e.target.value })}
                placeholder="8820341"
                className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">پورت سریال (برای اتصال کابلی COM)</label>
              <input
                type="text"
                value={config.serialPort}
                onChange={e => setConfig({ ...config, serialPort: e.target.value })}
                placeholder="COM3"
                className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoPrintReceipt}
                  onChange={e => setConfig({ ...config, autoPrintReceipt: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-700">چاپ خودکار رسید مشتری توسط پرینتر پوز بلافاصله پس از تراکنش موفق</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all"
            >
              ذخیره تنظیمات کارتخوان
            </button>
          </div>
        </form>

        {/* کارت راهنما و تست سریع */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-600" /> تست سریع انتقال وجه
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            جهت اطمینان از صحت عملکرد کارتخوان، مبلغی را به صورت آزمایشی به دستگاه ارسال نمایید:
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">مبلغ تست (تومان)</label>
            <input
              type="number"
              value={testAmount}
              onChange={e => setTestAmount(e.target.value)}
              className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPayModal(true)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow transition-all flex items-center justify-center gap-2"
          >
            اجرای تست کشیدن کارت
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed">
            💡 <strong>نکته:</strong> در فرم ثبت و تسویه فاکتورها، دکمه مستقیم «پرداخت با کارتخوان» تعبیه شده است تا نیازی به ورود دستی مبلغ نباشد.
          </div>
        </div>
      </div>

      {/* تاریخچه تراکنش‌های پوز */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-800">تاریخچه تراکنش‌های کارتخوان بانکی</h2>
          </div>
          <span className="text-xs text-slate-500">تعداد تراکنش‌ها: {toPersianDigits(history.length)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">مبلغ (تومان)</th>
                <th className="p-3">شماره فاکتور</th>
                <th className="p-3">شماره مرجع بانکی (RRN)</th>
                <th className="p-3">کد پیگیری</th>
                <th className="p-3">شماره کارت</th>
                <th className="p-3">تاریخ و زمان</th>
                <th className="p-3 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    هنوز هیچ تراکنشی با کارتخوان ثبت نشده است.
                  </td>
                </tr>
              ) : (
                history.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="p-3 font-mono font-bold text-slate-800">{formatCurrency(tx.amount)}</td>
                    <td className="p-3 text-slate-600 font-bold">{toPersianDigits(tx.invoiceNumber || '-')}</td>
                    <td className="p-3 font-mono text-xs text-blue-700 font-bold">{tx.rrn || '-'}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{tx.traceNo || '-'}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{tx.maskedCardNumber || '-'}</td>
                    <td className="p-3 text-xs text-slate-500">{toPersianDigits(tx.timestamp)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        tx.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.success ? 'موفق' : 'ناموفق'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مدال تست پرداخت پوز */}
      {showPayModal && (
        <PcPosPaymentModal
          isOpen={showPayModal}
          amount={Number(testAmount) || 50000}
          invoiceNumber="1044-تست"
          payerName="مشتری تست کارتخوان"
          onSuccess={(res) => {
            setHistory(PcPosService.getHistory());
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
}
