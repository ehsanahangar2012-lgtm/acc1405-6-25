import React, { useState } from 'react';
import { 
  Headphones, ShieldCheck, Clock, Award, PhoneCall, Monitor, 
  Send, CheckCircle2, AlertTriangle, Calculator, Sparkles,
  HelpCircle, MessageSquare, RefreshCw
} from 'lucide-react';
import { 
  SlaSupportService, SlaContract, SupportTicket 
} from '../services/slaSupportService';
import { toPersianDigits, formatCurrency } from '../utils';

export default function SlaSupportContracts() {
  const [contract, setContract] = useState<SlaContract>(() => SlaSupportService.getContract());
  const [tickets, setTickets] = useState<SupportTicket[]>(() => SlaSupportService.getTickets());
  const [activeTab, setActiveTab] = useState<'STATUS' | 'RENEWAL_CALC' | 'NEW_TICKET'>('STATUS');

  // فرم ثبت تیکت / ریموت
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('TAX_MOADIAN');
  const [remoteSessionId, setRemoteSessionId] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ماشین‌حساب تمدید قرارداد
  const [calcPlan, setCalcPlan] = useState<'BRONZE' | 'SILVER' | 'GOLD_VIP'>('GOLD_VIP');
  const [calcUsers, setCalcUsers] = useState(3);
  const [includeMoadian, setIncludeMoadian] = useState(true);
  const [includeCloud, setIncludeCloud] = useState(true);

  const renewalEstimate = SlaSupportService.calculateRenewalCost({
    currentPlan: calcPlan,
    usersCount: calcUsers,
    includeMoadianTaxUpdates: includeMoadian,
    includeCloudBackup: includeCloud
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDescription.trim()) {
      alert('لطفاً عنوان و شرح درخواست را وارد فرمایید.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newTicket = SlaSupportService.createTicket({
        title: ticketTitle,
        category: ticketCategory,
        priority: remoteSessionId ? 'URGENT' : 'NORMAL',
        remoteSessionId: remoteSessionId || undefined,
        description: ticketDescription
      });

      setTickets(SlaSupportService.getTickets());
      setIsSubmitting(false);
      setNotice(`درخواست پشتیبانی شما با کد پیگیری ${newTicket.id} ثبت گردید. کارشناس پشتیبانی به زودی با شما تماس خواهد گرفت.`);
      setTicketTitle('');
      setRemoteSessionId('');
      setTicketDescription('');
      setActiveTab('STATUS');
      setTimeout(() => setNotice(null), 6000);
    }, 800);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* هدر صفحه */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-900 to-amber-950 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
            <Headphones className="w-8 h-8 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">قرارداد پشتیبانی و به‌روزرسانی سالانه (SLA)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                سطح طلایی VIP
              </span>
            </div>
            <p className="text-amber-100/80 text-sm mt-1">
              پشتیبانی تلفنی مستقیم، اتصال ریموت AnyDesk و دریافت خودکار جدیدترین تغییرات قوانین مالیاتی و سامانه مؤدیان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('NEW_TICKET')}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Monitor className="w-4 h-4" /> درخواست اتصال ریموت / تیکت فوری
          </button>
        </div>
      </div>

      {/* اعلان موفقیت */}
      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-xs">✕</button>
        </div>
      )}

      {/* تب‌های صفحه */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('STATUS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'STATUS' ? 'bg-amber-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          وضعیت قرارداد و تیکت‌ها
        </button>
        <button
          onClick={() => setActiveTab('RENEWAL_CALC')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'RENEWAL_CALC' ? 'bg-amber-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          محاسبه‌گر تمدید سالانه پشتیبانی
        </button>
        <button
          onClick={() => setActiveTab('NEW_TICKET')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'NEW_TICKET' ? 'bg-amber-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ثبت درخواست جدید پشتیبانی
        </button>
      </div>

      {/* تب ۱: وضعیت قرارداد و سوابق تیکت */}
      {activeTab === 'STATUS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">اعتبار گارانتی و پشتیبانی</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  قرارداد فعال
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800">
                {toPersianDigits(contract.remainingDays)} <span className="text-sm font-normal text-slate-500">روز باقیمانده</span>
              </div>
              <div className="text-xs text-slate-500">
                تاریخ انقضای دوره جاری: {toPersianDigits(contract.expireDate)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <PhoneCall className="w-5 h-5 text-amber-600" />
                <span>خط مستقیم پشتیبانی و کارشناس معین</span>
              </div>
              <div className="text-base font-black text-slate-800 font-mono">
                {contract.supportPhone}
              </div>
              <div className="text-xs text-slate-600">
                {contract.assignedExpert}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Monitor className="w-5 h-5 text-indigo-600" />
                <span>ساعت پشتیبانی ریموت دسکتاپ</span>
              </div>
              <div className="text-2xl font-black text-slate-800">
                {toPersianDigits(contract.remoteSupportHoursLeft)} <span className="text-sm font-normal text-slate-500">ساعت باقیمانده</span>
              </div>
              <div className="text-xs text-slate-500">
                اتصال امن از طریق AnyDesk یا RustDesk
              </div>
            </div>
          </div>

          {/* لیست تیکت‌ها */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">سوابق تیکت‌ها و درخواست‌های پشتیبانی</h2>
              <span className="text-xs text-slate-500">تعداد: {toPersianDigits(tickets.length)}</span>
            </div>

            <div className="divide-y divide-slate-100">
              {tickets.map(t => (
                <div key={t.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{t.title}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.id}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {t.status === 'RESOLVED' ? 'حل شده' : 'در حال پیگیری کارشناس'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>

                  {t.remoteSessionId && (
                    <div className="text-xs text-indigo-700 font-mono bg-indigo-50/70 px-2 py-1 rounded w-fit">
                      شناسه اتصال ریموت: {t.remoteSessionId}
                    </div>
                  )}

                  {t.response && (
                    <div className="mt-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-900 leading-relaxed">
                      <strong>پاسخ کارشناس اشک قلم:</strong> {t.response}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400">
                    زمان ثبت درخواست: {toPersianDigits(t.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* تب ۲: ماشین‌حساب تمدید پشتیبانی سالانه */}
      {activeTab === 'RENEWAL_CALC' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-600" /> برآورد آنلاین هزینه تمدید سالانه قرارداد پشتیبانی
              </h2>
              <p className="text-xs text-slate-500 mt-1">امکانات و ماژول‌های مورد نیاز برای سال آینده را انتخاب فرمایید:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">سطح قرارداد پشتیبانی (SLA)</label>
                <select
                  value={calcPlan}
                  onChange={e => setCalcPlan(e.target.value as any)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="GOLD_VIP">طلایی VIP (پشتیبانی تلفنی + ریموت اختصاصی + اولویت فوری)</option>
                  <option value="SILVER">نقره‌ای (پشتیبانی تلفنی و رفع باگ در ساعات اداری)</option>
                  <option value="BRONZE">برنزی (صرفاً دریافت آپدیت‌ها و تیکت آنلاین)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تعداد سیستم‌ها / صندوق‌های تحت شبکه</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={calcUsers}
                  onChange={e => setCalcUsers(Math.max(1, Number(e.target.value)))}
                  className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMoadian}
                    onChange={e => setIncludeMoadian(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-bold text-slate-700">شامل دریافت کلیه آپدیت‌های بخشنامه‌ها و تغییرات سامانه مؤدیان در طول سال</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCloud}
                    onChange={e => setIncludeCloud(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-bold text-slate-700">شامل ۱ سال اشتراک گاوصندوق ابری پشتیبان‌گیری خودکار (Cloud Vault)</span>
                </label>
              </div>
            </div>
          </div>

          {/* فاکتور پیش‌نمایش قیمت */}
          <div className="bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-amber-800">پیش‌فاکتور تمدید سالانه پشتیبانی</div>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {formatCurrency(renewalEstimate.finalPrice)} <span className="text-xs font-normal">تومان / سالانه</span>
              </div>

              <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>قیمت پایه خدمات:</span>
                  <span className="font-mono">{formatCurrency(renewalEstimate.basePrice)} تومان</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>تخفیف وفاداری مشتری (۱۰٪):</span>
                  <span className="font-mono">-{formatCurrency(renewalEstimate.discounts)} تومان</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert('پیش‌فاکتور رسمی تمدید ثبت گردید. جهت پرداخت و صدور فاکتور با شماره ۰۲۱-۸۸۹۹۰۰۱۱ تماس حاصل فرمایید.')}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
            >
              صدور و تمدید آنی قرارداد پشتیبانی
            </button>
          </div>
        </div>
      )}

      {/* تب ۳: ثبت درخواست پشتیبانی یا ریموت */}
      {activeTab === 'NEW_TICKET' && (
        <form onSubmit={handleCreateTicket} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Monitor className="w-5 h-5 text-indigo-600" /> ثبت درخواست پشتیبانی و اتصال ریموت دسکتاپ
            </h2>
            <p className="text-xs text-slate-500 mt-1">کارشناسان پشتیبانی پس از بررسی تیکت، به سیستم شما متصل خواهند شد.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان مشکل یا درخواست</label>
            <input
              type="text"
              value={ticketTitle}
              onChange={e => setTicketTitle(e.target.value)}
              placeholder="مثال: سوال در مورد نحوه صدور فاکتور ارزی یا خطای مودیان"
              className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی موضوع</label>
              <select
                value={ticketCategory}
                onChange={e => setTicketCategory(e.target.value as any)}
                className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="TAX_MOADIAN">سامانه مؤدیان و مالیات</option>
                <option value="ACCOUNTING_ISSUE">مسائل حسابداری و اسناد</option>
                <option value="HARDWARE_POS">اتصال کارتخوان (PC-POS) یا بارکدخوان</option>
                <option value="BACKUP_RECOVERY">پشتیبان‌گیری ابری و ریکاوری</option>
                <option value="GENERAL">سایر امور عمومی</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">کد نرم‌افزار ریموت (AnyDesk / RustDesk)</label>
              <input
                type="text"
                value={remoteSessionId}
                onChange={e => setRemoteSessionId(e.target.value)}
                placeholder="مثال: 984 210 334"
                className="w-full p-2.5 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">توضیحات تکمیلی</label>
            <textarea
              rows={4}
              value={ticketDescription}
              onChange={e => setTicketDescription(e.target.value)}
              placeholder="شرح دقیق مشکل یا نیاز خود را شرح دهید..."
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all text-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> در حال ارسال...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> ارسال تیکت به کارشناس پشتیبانی
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
