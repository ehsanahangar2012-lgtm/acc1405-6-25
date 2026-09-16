import React, { useState, useEffect } from 'react';
import { 
  Landmark, ShieldCheck, Send, CheckCircle2, AlertTriangle, 
  KeyRound, RefreshCw, FileText, Download, Eye, ExternalLink,
  Search, Sliders, Check, Copy, Clock, Database
} from 'lucide-react';
import { useStore } from '../store';
import { 
  MoadianTaxService, MoadianConfig, MoadianInvoiceRecord 
} from '../services/moadianTaxService';
import { formatCurrency, toPersianDigits } from '../utils';
import { InvoiceType } from '../types';
import { WebServiceNoticeBanner } from '../components/WebServiceNoticeBanner';

export default function MoadianTaxHub() {
  const { invoices } = useStore();
  const [config, setConfig] = useState<MoadianConfig>(() => MoadianTaxService.getConfig());
  const [records, setRecords] = useState<MoadianInvoiceRecord[]>(() => MoadianTaxService.getRecords());
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'HISTORY' | 'SETTINGS'>('INVOICES');
  
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);
  const [copiedTaxId, setCopiedTaxId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    MoadianTaxService.saveConfig(config);
    setSuccessNotice('تنظیمات سامانه مؤدیان با موفقیت ذخیره شد.');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleSendInvoice = async (inv: any) => {
    setSendingId(inv.id);
    try {
      const res = await MoadianTaxService.sendInvoiceToTaxAuthority(inv);
      setRecords(MoadianTaxService.getRecords());
      if (res.success) {
        setSuccessNotice(`صورتحساب شماره ${inv.number} با شماره مالیاتی ${res.taxId} در سامانه مؤدیان ثبت شد.`);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert('خطا در ارتباط با سامانه مؤدیان: ' + (e?.message || 'خطای ناشناخته'));
    } finally {
      setSendingId(null);
      setTimeout(() => setSuccessNotice(null), 5000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTaxId(text);
    setTimeout(() => setCopiedTaxId(null), 2000);
  };

  const salesInvoices = invoices.filter(i => (i.type === InvoiceType.SALE || !i.type));

  const filteredInvoices = salesInvoices.filter(i => 
    i.personName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(i.number).includes(searchTerm)
  );

  const stats = {
    totalSent: records.length,
    successCount: records.filter(r => r.status === 'SUCCESS').length,
    pendingCount: records.filter(r => r.status === 'PENDING').length,
    failedCount: records.filter(r => r.status === 'FAILED').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* بنر اطلاع‌رسانی خدمات وب */}
      <WebServiceNoticeBanner
        serviceName="سامانه کارپوشه مؤدیان"
        title="ارسال آنلاین صورتحساب‌ها به وب‌سرویس سازمان امور مالیاتی کشور"
        description="ارسال صورتحساب‌های الکترونیکی از طریق وب‌سرویس‌های امن سازمان امور مالیاتی کشور (قانون پایانه‌های فروشگاهی) با الگوریتم رمزنگاری ورهوف و کلیدهای RSA پردازش می‌شود."
      />

      {/* هدر صفحه */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 to-teal-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
            <Landmark className="w-8 h-8 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">اتصال به سامانه مؤدیان مالیاتی</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                قانون پایانه‌های فروشگاهی
              </span>
            </div>
            <p className="text-emerald-100/80 text-sm mt-1">
              تولید خودکار شناسه یکتای ۲۲ رقمی، امضای دیجیتال و ارسال مستقیم صورتحساب‌های الکترونیکی به کارپوشه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'INVOICES' ? 'bg-white text-emerald-900 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            فاکتورهای آماده ارسال
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'HISTORY' ? 'bg-white text-emerald-900 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            تاریخچه ارسال ({toPersianDigits(records.length)})
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'SETTINGS' ? 'bg-white text-emerald-900 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            تنظیمات و کلیدها
          </button>
        </div>
      </div>

      {/* اعلان موفقیت */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-900 text-xs">✕</button>
        </div>
      )}

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold">کل صورتحساب‌های ارسالی</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{toPersianDigits(stats.totalSent)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <div className="text-xs text-emerald-700 font-bold">تایید شده در کارپوشه</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{toPersianDigits(stats.successCount)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <div className="text-xs text-amber-700 font-bold">در انتظار استعلام</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{toPersianDigits(stats.pendingCount)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <div className="text-xs text-rose-700 font-bold">خطای ساختار / رد شده</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{toPersianDigits(stats.failedCount)}</div>
        </div>
      </div>

      {/* تب فاکتورهای فروش جهت ارسال */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800">فاکتورهای فروش سیستم جهت ارسال به سامانه مودیان</h2>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="جستجو در فاکتورها..."
                className="w-full pr-9 pl-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">شماره فاکتور</th>
                  <th className="p-3">مشتری</th>
                  <th className="p-3">تاریخ فاکتور</th>
                  <th className="p-3">مبلغ کل (تومان)</th>
                  <th className="p-3">مالیات بر ارزش افزوده</th>
                  <th className="p-3">شماره مالیاتی محاسبه‌شده</th>
                  <th className="p-3 text-center">وضعیت</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      هیچ فاکتور فروشی برای ارسال یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const existingRecord = records.find(r => r.invoiceId === inv.id);
                    const calculatedTaxId = existingRecord ? existingRecord.taxId : MoadianTaxService.generateTaxId(config.fiscalId, inv.number);
                    const isSending = sendingId === inv.id;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-bold text-slate-700">{toPersianDigits(inv.number)}</td>
                        <td className="p-3 font-semibold text-slate-800">{inv.personName || 'مشتری آزاد'}</td>
                        <td className="p-3 text-slate-500">{toPersianDigits(inv.date || '-')}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{formatCurrency(inv.finalTotal || 0)}</td>
                        <td className="p-3 font-mono text-emerald-600">
                          {formatCurrency(inv.tax || Math.round((inv.finalTotal || 0) * 0.1))}
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit">
                            <span>{calculatedTaxId}</span>
                            <button
                              onClick={() => copyToClipboard(calculatedTaxId)}
                              title="کپی شماره مالیاتی"
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {copiedTaxId === calculatedTaxId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {existingRecord ? (
                            existingRecord.status === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> ثبت شده
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-3 h-3" /> دارای خطا
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              <Clock className="w-3 h-3" /> آماده ارسال
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSendInvoice(inv)}
                              disabled={isSending}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                existingRecord?.status === 'SUCCESS'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isSending ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> در حال ارسال...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  {existingRecord?.status === 'SUCCESS' ? 'ارسال مجدد' : 'ارسال به مودیان'}
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => setSelectedPayload(MoadianTaxService.buildTaxInvoicePayload(inv, config, calculatedTaxId))}
                              title="مشاهده بسته JSON استاندارد سازمان امور مالیاتی"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تب تاریخچه ارسال‌ها */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">سوابق استعلام و ارسال به کارپوشه سازمان امور مالیاتی</h2>
            <div className="text-xs text-slate-500">
              تعداد رکوردها: {toPersianDigits(records.length)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">شماره فاکتور</th>
                  <th className="p-3">شماره مالیاتی (۲۲ رقمی)</th>
                  <th className="p-3">مشتری</th>
                  <th className="p-3">کد رهگیری مالیاتی</th>
                  <th className="p-3">زمان ارسال</th>
                  <th className="p-3 text-center">وضعیت</th>
                  <th className="p-3 text-center">بسته JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      هنوز هیچ صورتحسابی به سامانه مودیان ارسال نشده است.
                    </td>
                  </tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-bold text-slate-700">{toPersianDigits(r.invoiceNumber)}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{r.taxId}</td>
                      <td className="p-3 text-slate-800">{r.customerName}</td>
                      <td className="p-3 font-mono text-xs text-emerald-700 font-bold">{r.referenceNumber || '-'}</td>
                      <td className="p-3 text-slate-500 text-xs">{toPersianDigits(r.sentAt)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          r.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.status === 'SUCCESS' ? 'تایید کارپوشه' : 'خطای رد صورتحساب'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedPayload(r.rawPayload)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" /> مشاهده بسته
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تب تنظیمات اتصال */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">پیکربندی کلیدهای امنیتی سامانه مؤدیان</h2>
              <p className="text-xs text-slate-500 mt-1">این اطلاعات را از درگاه ملی خدمات مالیاتی (my.tax.gov.ir) و فایل CSR دریافت کنید.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {config.isSandbox ? 'محیط آزمایشی (سندباکس)' : 'محیط عملیاتی سازمان امور مالیاتی'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                شناسه یکتای حافظه مالیاتی (Fiscal ID) - ۶ کاراکتر
              </label>
              <input
                type="text"
                maxLength={6}
                value={config.fiscalId}
                onChange={e => setConfig({ ...config, fiscalId: e.target.value.toUpperCase() })}
                placeholder="مثال: A1B2C3"
                className="w-full p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">شناسه ۶ کاراکتری تولید شده در کارپوشه مالیاتی</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                شناسه اقتصادی / کارپوشه مؤدی (Client ID)
              </label>
              <input
                type="text"
                value={config.clientId}
                onChange={e => setConfig({ ...config, clientId: e.target.value })}
                placeholder="مثال: 14008923412"
                className="w-full p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                کلید خصوصی امضای دیجیتال (Private Key - فرمت PEM)
              </label>
              <textarea
                rows={4}
                value={config.privateKey}
                onChange={e => setConfig({ ...config, privateKey: e.target.value })}
                placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">این کلید در کامپیوتر شما محفوظ است و هرگز به سرور ثالث ارسال نمی‌گردد.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                الگوی پیش‌فرض صورتحساب
              </label>
              <select
                value={config.defaultPattern}
                onChange={e => setConfig({ ...config, defaultPattern: Number(e.target.value) as 1 | 2 })}
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value={1}>الگوی ۱: فروش با اطلاعات کامل و شناسه ملی خریدار</option>
                <option value={2}>الگوی ۲: فروش به مصرف‌کننده نهایی (بدون نیاز به کد ملی)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isSandbox}
                  onChange={e => setConfig({ ...config, isSandbox: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-slate-700">فعال‌سازی محیط آزمایشی (سندباکس مودیان)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSendOnInvoiceSave}
                  onChange={e => setConfig({ ...config, autoSendOnInvoiceSave: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">ارسال اتوماتیک به سامانه بلافاصله پس از ثبت نهایی فاکتور فروش</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
            >
              ذخیره تنظیمات و اعتبارسنجی
            </button>
          </div>
        </form>
      )}

      {/* مدال پیش‌نمایش بسته JSON استاندارد مودیان */}
      {selectedPayload && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800">بسته داده‌های الکترونیکی سامانه مؤدیان (JSON)</h3>
              </div>
              <button onClick={() => setSelectedPayload(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto text-left" dir="ltr">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => copyToClipboard(JSON.stringify(selectedPayload, null, 2))}
                className="text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> کپی در حافظه کلیپ‌بورد
              </button>
              <button
                onClick={() => setSelectedPayload(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
