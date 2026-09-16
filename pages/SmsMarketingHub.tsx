import React, { useState } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, Clock, AlertTriangle, 
  Settings, User, Phone, DollarSign, RefreshCw, PlusCircle,
  FileText, Calendar, Sparkles, Filter, Search
} from 'lucide-react';
import { useStore } from '../store';
import { 
  SmsGatewayService, SmsGatewayConfig, SmsLogEntry, SmsProvider 
} from '../services/smsGatewayService';
import { toPersianDigits, formatCurrency } from '../utils';
import { WebServiceNoticeBanner } from '../components/WebServiceNoticeBanner';

export default function SmsMarketingHub() {
  const { people, invoices, checks } = useStore();
  const [config, setConfig] = useState<SmsGatewayConfig>(() => SmsGatewayService.getConfig());
  const [logs, setLogs] = useState<SmsLogEntry[]>(() => SmsGatewayService.getLogs());
  const [activeTab, setActiveTab] = useState<'SEND' | 'LOGS' | 'SETTINGS'>('SEND');
  
  // فرم ارسال پیامک دستی
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customText, setCustomText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSelectTemplate = (type: 'INVOICE' | 'CHECK' | 'DEBT') => {
    if (type === 'INVOICE') {
      setCustomText('مشتری گرامی [نام_مشتری]، فاکتور خرید شماره [شماره_فاکتور] به مبلغ [مبلغ] تومان صادر گردید. با سپاس از اعتماد شما.');
    } else if (type === 'CHECK') {
      setCustomText('طرف‌حساب گرامی [نام_مشتری]، به استحضار می‌رساند چک شماره [شماره_چک] به مبلغ [مبلغ] تومان در تاریخ [تاریخ] سررسید خواهد شد.');
    } else if (type === 'DEBT') {
      setCustomText('جناب آقای/سرکار خانم [نام_مشتری]، مانده بدهی جاری حساب شما نزد بازرگانی اشک قلم مبلغ [مبلغ] تومان می‌باشد. جهت تسویه حساب اقدام فرمایید.');
    }
  };

  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPerson = people.find(p => p.id === selectedPersonId);
    const targetPhone = customPhone || targetPerson?.phone;

    if (!targetPhone) {
      alert('لطفاً شماره موبایل گیرنده را مشخص نمایید.');
      return;
    }
    if (!customText.trim()) {
      alert('متن پیامک نمی‌تواند خالی باشد.');
      return;
    }

    setIsSending(true);
    try {
      const res = await SmsGatewayService.sendSms({
        toPhone: targetPhone,
        recipientName: targetPerson?.name || 'مخاطب',
        message: customText,
        type: 'CUSTOM'
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setLogs(SmsGatewayService.getLogs());
        setConfig(SmsGatewayService.getConfig());
        setCustomText('');
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: 'خطا در ارسال پیامک: ' + (e?.message || 'خطای شبکه') });
    } finally {
      setIsSending(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    SmsGatewayService.saveConfig(config);
    setFeedback({ type: 'success', message: 'تنظیمات درگاه پیامک با موفقیت ذخیره گردید.' });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRecharge = (count: number) => {
    const newBal = SmsGatewayService.rechargeCredits(count);
    setConfig(SmsGatewayService.getConfig());
    setFeedback({ type: 'success', message: `بسته پیامک با موفقیت شارژ شد. موجودی جدید: ${toPersianDigits(newBal)} عدد` });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* بنر اطلاع‌رسانی خدمات وب */}
      <WebServiceNoticeBanner
        serviceName="وب‌سرویس درگاه پیامک"
        title="سامانه ارسال پیامک هوشمند متصل به وب‌سرویس‌های مخابراتی"
        description="ارسال پیامک‌های فاکتور، یادآوری چک و بدهی از طریق وب‌سرویس‌های آنلاین اپراتورهای پیامکی کشور (کاوه‌نگار، ملی‌پیامک و SMS.ir) پردازش می‌شود."
      />

      {/* هدر صفحه */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
            <MessageSquare className="w-8 h-8 text-purple-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">پنل پیامک هوشمند حسابداری</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                کاوه‌نگار / ملی‌پیامک / SMS.ir
              </span>
            </div>
            <p className="text-purple-100/80 text-sm mt-1">
              اطلاع‌رسانی خودکار صدور فاکتور، یادآوری سررسید چک، مانده‌حساب بدهی و ارسال پیامک‌های تبلیغاتی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center">
            <div className="text-[11px] text-purple-200">اعتبار باقیمانده پیامک</div>
            <div className="text-xl font-black text-amber-300">{toPersianDigits(config.balanceCredits)} عدد</div>
          </div>
          <button
            onClick={() => handleRecharge(200)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> شارژ سریع اعتبار
          </button>
        </div>
      </div>

      {/* اعلان فیدبک */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between animate-fadeIn ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span className="text-sm font-bold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs">✕</button>
        </div>
      )}

      {/* منوی تب‌ها */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('SEND')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'SEND' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ارسال پیامک جدید
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'LOGS' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          گزارش و تاریخچه ارسال‌ها ({toPersianDigits(logs.length)})
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'SETTINGS' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          تنظیمات پنل و ارسال خودکار
        </button>
      </div>

      {/* تب ۱: ارسال پیامک */}
      {activeTab === 'SEND' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSendManual} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" /> فرم ارسال پیامک به مشتری
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">انتخاب از طرف‌حساب‌ها</label>
                <select
                  value={selectedPersonId}
                  onChange={e => {
                    setSelectedPersonId(e.target.value);
                    const p = people.find(per => per.id === e.target.value);
                    if (p?.phone) setCustomPhone(p.phone);
                  }}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">-- انتخاب طرف‌حساب از دفترچه مشتریان --</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره موبایل دریافت‌کننده</label>
                <input
                  type="text"
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">متن پیامک</label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {toPersianDigits(customText.length)} کاراکتر (۱ پیامک فارسی)
                </span>
              </div>
              <textarea
                rows={4}
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="متن پیامک را اینجا تایپ کنید یا از الگوهای آماده سمت چپ استفاده فرمایید..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> در حال ارسال پیامک...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> ارسال پیامک آنی
                  </>
                )}
              </button>
            </div>
          </form>

          {/* الگوهای آماده */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> قالب‌های آماده پیامکی
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              با کلیک روی هر قالب، متن استاندارد در کادر پیامک قرار می‌گیرد:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSelectTemplate('INVOICE')}
                className="w-full text-right p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-xs"
              >
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5 text-purple-600" /> قالب صدور فاکتور
                </div>
                <div className="text-slate-500 line-clamp-2">فاکتور خرید شما صادر شد...</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('CHECK')}
                className="w-full text-right p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-xs"
              >
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> قالب سررسید چک
                </div>
                <div className="text-slate-500 line-clamp-2">چک شماره ... در تاریخ ... سررسید خواهد شد.</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('DEBT')}
                className="w-full text-right p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-xs"
              >
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600" /> قالب اعلام مانده بدهی
                </div>
                <div className="text-slate-500 line-clamp-2">مانده بدهی جاری شما مبلغ ... تومان می‌باشد.</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تب ۲: تاریخچه و لاگ‌ها */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">گزارش و وضعیت تحویل پیامک‌های ارسالی</h2>
            <span className="text-xs text-slate-500">تعداد کل: {toPersianDigits(logs.length)}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">گیرنده</th>
                  <th className="p-3">شماره موبایل</th>
                  <th className="p-3">متن پیامک</th>
                  <th className="p-3">نوع پیامک</th>
                  <th className="p-3">زمان ارسال</th>
                  <th className="p-3 text-center">وضعیت تحویل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      هیچ سابقه‌ای از پیامک‌های ارسالی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-bold text-slate-800">{log.recipientName}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{toPersianDigits(log.recipientPhone)}</td>
                      <td className="p-3 text-slate-700 max-w-xs truncate text-xs" title={log.messageText}>
                        {log.messageText}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {log.type === 'INVOICE' ? 'فاکتور' : log.type === 'CHECK_REMINDER' ? 'یادآوری چک' : 'سفارشی'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{toPersianDigits(log.sentAt)}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> تحویل شده
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تب ۳: تنظیمات پنل */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-bold text-slate-800 text-lg">پیکربندی پنل و خط اختصاصی ارسال پیامک</h2>
            <p className="text-xs text-slate-500 mt-1">مشخصات وب‌سرویس سامانه پیامکی خود را در این بخش تنظیم فرمایید.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">ارائه‌دهنده وب‌سرویس پیامک</label>
              <select
                value={config.provider}
                onChange={e => setConfig({ ...config, provider: e.target.value as SmsProvider })}
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="KAVEHNEGAR">کاوه‌نگار (Kavehnegar API)</option>
                <option value="MELLI_SMS">ملی‌پیامک (MelliSMS)</option>
                <option value="SMS_IR">سامانه پیامک ایران (SMS.ir)</option>
                <option value="FARAPAYAMAK">فراپیامک (Farapayamak)</option>
                <option value="CUSTOM_REST">وب‌سرویس دلخواه / REST Webhook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">شماره خط ارسال‌کننده (اختصاصی یا خدماتی)</label>
              <input
                type="text"
                value={config.senderNumber}
                onChange={e => setConfig({ ...config, senderNumber: e.target.value })}
                placeholder="مثال: 3000500600"
                className="w-full p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">کلید وب‌سرویس (API Key / Token)</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="کلید API امنیتی پنل پیامک"
                className="w-full p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">ارسال‌های خودکار و رویداد-محور</h3>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSendInvoice}
                  onChange={e => setConfig({ ...config, autoSendInvoice: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">ارسال خودکار پیامک صورتحساب و لینک مشاهده به خریدار بلافاصله پس از ثبت فاکتور</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSendCheckReminder}
                  onChange={e => setConfig({ ...config, autoSendCheckReminder: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">ارسال خودکار پیامک یادآوری چک ۳ روز قبل از موعد سررسید به طرف‌حساب</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSendDebtNotice}
                  onChange={e => setConfig({ ...config, autoSendDebtNotice: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">ارسال خودکار صورت‌وضعیت مانده بدهی در پایان هر ماه</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-md transition-all"
            >
              ذخیره تنظیمات درگاه پیامک
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
