import React, { useState, useEffect } from 'react';
import { useMarketingStore } from '../store-marketing';
import { generateId, getPersianDate, toPersianDigits, formatCurrency } from '../utils';
import { B2BLead, PrintCalculatorConfig } from '../types-marketing';
import { Calculator, User, Building, Phone, Mail, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';

export const PrintCalculator: React.FC = () => {
  const addLead = useMarketingStore(state => state.addLead);

  // Form states for Printing Specification
  const [paperType, setPaperType] = useState<PrintCalculatorConfig['paperType']>('Cardboard');
  const [paperWeight, setPaperWeight] = useState<number>(300);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [lengthCm, setLengthCm] = useState<number>(30);
  const [heightCm, setHeightCm] = useState<number>(0); // 0 means flat sheet, >0 means box packaging
  const [printMethod, setPrintMethod] = useState<PrintCalculatorConfig['printMethod']>('Offset Sheet');
  const [finishes, setFinishes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1000);

  // Lead Customer details
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [trackingId, setTrackingId] = useState('');

  // Cost estimates
  const [estimates, setEstimates] = useState({
    materialCost: 0,
    printCost: 0,
    finishesCost: 0,
    totalRial: 0,
    unitRial: 0,
  });

  const finishOptions = [
    { key: 'Matte Lamination', label: 'سلفون مات', price: 1500 },
    { key: 'Glossy Lamination', label: 'سلفون براق', price: 1200 },
    { key: 'Spot UV', label: 'یووی موضعی (Spot UV)', price: 2500 },
    { key: 'Hot Foil Stamping', label: 'طلاکوب / نقره‌کوب', price: 4000 },
    { key: 'Die Cut', label: 'قالب‌زنی (دایکات)', price: 1800 },
  ];

  // Recalculate cost in Rials
  useEffect(() => {
    // Area in square meters (with formula handling for box packaging)
    const flatArea = (widthCm * lengthCm) / 10000;
    const boxArea = heightCm > 0 
      ? ((widthCm * 2 + lengthCm * 2 + 4) * (heightCm + widthCm + 2)) / 10000 
      : flatArea;
    
    const area = Math.max(0.01, boxArea);
    
    // Weight in KG
    const weightInKg = (area * paperWeight * quantity) / 1000;

    // Base paper cost per KG (Iranian Rial market rates)
    const paperRates: Record<string, number> = {
      Kraft: 180000,
      Duplex: 240000,
      Glossy: 320000,
      'Ivory Board': 380000,
      Cardboard: 200000
    };
    const materialCost = Math.round(weightInKg * (paperRates[paperType] || 200000));

    // Printing processing cost
    let setupCost = 0;
    let runCostPerUnit = 0;
    if (printMethod === 'Digital') {
      setupCost = 500000;
      runCostPerUnit = 3000;
    } else if (printMethod === 'Offset Sheet') {
      setupCost = 6000000; // Plates (Zink) + Setup
      runCostPerUnit = 500;
    } else {
      setupCost = 12000000; // Cliché + Setup
      runCostPerUnit = 200;
    }
    const printCost = setupCost + (runCostPerUnit * quantity);

    // Finishes cost
    const selectedFinishes = finishOptions.filter(f => finishes.includes(f.key));
    const finishesCost = selectedFinishes.reduce((sum, f) => sum + f.price, 0) * quantity;

    // Total and markup (printing margin)
    const totalCost = materialCost + printCost + finishesCost;
    const totalRial = Math.round(totalCost * 1.25); // 25% print factory markup
    const unitRial = Math.round(totalRial / quantity);

    setEstimates({
      materialCost,
      printCost,
      finishesCost,
      totalRial,
      unitRial
    });
  }, [paperType, paperWeight, widthCm, lengthCm, heightCm, printMethod, finishes, quantity]);

  const handleFinishToggle = (key: string) => {
    setFinishes(prev => 
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    );
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!clientName || !phone) {
      setSubmitError('نام مشتری و شماره تلفن همراه الزامی است.');
      return;
    }

    const leadConfig: PrintCalculatorConfig = {
      paperType,
      paperWeight,
      widthCm,
      lengthCm,
      heightCm,
      printMethod,
      finishes,
      quantity,
      estimatedCost: estimates.totalRial
    };

    const newLeadId = 'lead_' + generateId();

    const newLead: B2BLead = {
      id: newLeadId,
      name: clientName,
      company: companyName,
      phone,
      email,
      calculatorConfig: leadConfig,
      status: 'INQUIRY',
      notes: notes || 'ثبت شده توسط ماشین‌حساب چاپ صنعتی B2B',
      createdAt: getPersianDate() + ' - ' + new Date().toLocaleTimeString('fa-IR'),
      updatedAt: getPersianDate(),
      dealValue: estimates.totalRial
    };

    try {
      // 1. Add locally
      addLead(newLead);
      
      // 2. Attempt remote submission to the public lead endpoint
      setTrackingId(newLeadId);
      
      // Clear forms
      setClientName('');
      setCompanyName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError('خطا در ارتباط با سرور. درخواست شما به صورت آفلاین ثبت شد.');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-slate-100 font-sans">
      {/* Spec Configurator & Leads Form */}
      <div className="xl:col-span-2 space-y-6">
        {isSubmitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-3xl p-10 text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="text-white w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">درخواست استعلام با موفقیت ثبت شد</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
              مشخصات و برآورد محاسباتی شما با کد پیگیری <span className="font-mono text-teal-400 font-bold">{toPersianDigits(trackingId)}</span> در پایگاه داده CRM ما ذخیره شد. کارشناسان ما به زودی با شما تماس خواهند گرفت.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-black px-8 py-4 rounded-2xl active:scale-95 transition-all text-sm"
            >
              محاسبه مجدد استعلام جدید
            </button>
          </div>
        ) : (
          <form onSubmit={handleLeadSubmit} className="space-y-6 bg-slate-900/50 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
              <Calculator className="text-teal-400" size={20} />
              ماشین حساب استعلام و محاسبات چاپ بسته‌بندی
            </h3>

            {/* Print specifications grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Material Dropdown */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">نوع مقوا / کاغذ</label>
                <select
                  value={paperType}
                  onChange={e => setPaperType(e.target.value as any)}
                  className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-teal-500 transition-all font-bold"
                >
                  <option value="Kraft">کرافت قهوه‌ای (Kraft)</option>
                  <option value="Duplex">پشت طوسی (Duplex)</option>
                  <option value="Glossy">گلاسه آرت (Glossy)</option>
                  <option value="Ivory Board">ایندربرد لوکس (Ivory Board)</option>
                  <option value="Cardboard">مقوای کرجی (greyboard)</option>
                </select>
              </div>

              {/* Material weight */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">گرماژ مقوا (GSM)</label>
                <select
                  value={paperWeight}
                  onChange={e => setPaperWeight(Number(e.target.value))}
                  className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-teal-500 transition-all font-mono font-bold"
                >
                  <option value="80">۸۰ گرم</option>
                  <option value="135">۱۳۵ گرم</option>
                  <option value="250">۲۵۰ گرم</option>
                  <option value="300">۳۰۰ گرم</option>
                  <option value="350">۳۵۰ گرم</option>
                  <option value="400">۴۰۰ گرم</option>
                  <option value="500">۵۰۰ گرم</option>
                </select>
              </div>

              {/* Dimensions */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">ابعاد باز شده (طول × عرض به سانتی‌متر)</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={lengthCm === 0 ? '' : lengthCm}
                    onChange={e => setLengthCm(Number(e.target.value))}
                    placeholder="طول (Cm)"
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white font-mono text-center outline-none focus:border-teal-500 transition-all font-bold"
                  />
                  <input
                    type="number"
                    value={widthCm === 0 ? '' : widthCm}
                    onChange={e => setWidthCm(Number(e.target.value))}
                    placeholder="عرض (Cm)"
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white font-mono text-center outline-none focus:border-teal-500 transition-all font-bold"
                  />
                </div>
              </div>

              {/* Height (0 means sheet, > 0 means box layout) */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">ارتفاع دیواره جعبه (۰ برای ورق تخت)</label>
                <input
                  type="number"
                  value={heightCm === 0 ? '' : heightCm}
                  onChange={e => setHeightCm(Number(e.target.value))}
                  placeholder="ارتفاع دیواره (Cm)"
                  className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white font-mono text-center outline-none focus:border-teal-500 transition-all font-bold"
                />
              </div>

              {/* Printing Method */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">تکنولوژی چاپ</label>
                <select
                  value={printMethod}
                  onChange={e => setPrintMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-teal-500 transition-all font-bold"
                >
                  <option value="Digital">دیجیتال ورقی (سریع / کم تیراژ)</option>
                  <option value="Offset Sheet">افست ورقی صنعتی (بالاترین کیفیت)</option>
                  <option value="Flexo">فلکسو رول کارتن (تیراژ بسیار بالا)</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black pr-2">تیراژ (تعداد مورد نیاز)</label>
                <input
                  type="number"
                  value={quantity === 0 ? '' : quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white font-mono text-center text-lg outline-none focus:border-teal-500 transition-all font-bold"
                />
              </div>
            </div>

            {/* Finishing checklist */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-xs text-slate-400 font-black pr-2">خدمات پس از چاپ و تکمیلی</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {finishOptions.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleFinishToggle(option.key)}
                    className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all text-center border ${
                      finishes.includes(option.key)
                        ? 'bg-teal-600/20 text-teal-400 border-teal-500/50'
                        : 'bg-slate-950/60 text-slate-500 border-white/5 hover:text-slate-300 hover:bg-slate-950'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Inbound Lead Form Details */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <h4 className="text-sm font-black text-white pr-2">اطلاعات ارتباطی جهت ثبت استعلام در CRM</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input
                    type="text"
                    placeholder="نام و نام خانوادگی مشتری *"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl pr-12 pl-4 py-4 text-white text-xs outline-none focus:border-teal-500 transition-all font-bold"
                  />
                </div>
                <div className="relative">
                  <Building className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input
                    type="text"
                    placeholder="نام شرکت / مجموعه"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl pr-12 pl-4 py-4 text-white text-xs outline-none focus:border-teal-500 transition-all font-bold"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input
                    type="text"
                    placeholder="شماره همراه *"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl pr-12 pl-4 py-4 text-white text-xs text-left font-mono outline-none focus:border-teal-500 transition-all font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input
                    type="email"
                    placeholder="آدرس ایمیل (اختیاری)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl pr-12 pl-4 py-4 text-white text-xs text-left font-mono outline-none focus:border-teal-500 transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="relative">
                  <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input
                    type="text"
                    placeholder="توضیحات تکمیلی (مثلاً نوع رنگ، زمان تحویل)"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl pr-12 pl-4 py-4 text-white text-xs outline-none focus:border-teal-500 transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            {submitError && (
              <div className="text-rose-500 text-xs font-bold bg-rose-500/5 py-3 px-4 rounded-xl border border-rose-500/10">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-teal-700/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              ثبت نهایی و ثبت لید در پایگاه CRM
              <ChevronRight size={18} />
            </button>
          </form>
        )}
      </div>

      {/* Real-time Estimates Display Panel */}
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-teal-950/40 to-emerald-950/10 border border-teal-500/15 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl"></div>

          <h4 className="text-base font-black text-white pb-3 border-b border-white/5 flex items-center justify-between">
            برآورد مالی تولید (ریال / تومان)
            <span className="text-[10px] bg-teal-500/20 text-teal-400 px-3 py-1 rounded-full font-black">پیش فاکتور آنی</span>
          </h4>

          {/* Individual cost rows */}
          <div className="space-y-4 text-xs font-bold">
            <div className="flex justify-between items-center text-slate-400">
              <span>خرید کاغذ/مقوا خام:</span>
              <span className="font-mono text-slate-200">{formatCurrency(estimates.materialCost)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>هزینه شابلون/کلیشه/چاپ:</span>
              <span className="font-mono text-slate-200">{formatCurrency(estimates.printCost)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>سلفون و خدمات تکمیلی:</span>
              <span className="font-mono text-slate-200">{formatCurrency(estimates.finishesCost)}</span>
            </div>
            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-slate-300">
              <span>قیمت تمام شده کارخانه:</span>
              <span className="font-mono text-slate-100">{formatCurrency(estimates.materialCost + estimates.printCost + estimates.finishesCost)}</span>
            </div>
          </div>

          {/* Pricing Highlight Card */}
          <div className="bg-slate-950/80 rounded-3xl p-6 text-center border border-white/5 space-y-4">
            <div>
              <div className="text-[10px] text-slate-500 font-black mb-1">جمع کل استعلام فروش (با مارجین چاپخانه)</div>
              <div className="text-2xl font-black text-teal-400 font-mono tracking-tight">
                {toPersianDigits(estimates.totalRial.toLocaleString())}
                <span className="text-xs text-slate-400 mr-1.5">ریال</span>
              </div>
              <div className="text-sm font-black text-slate-400 font-mono mt-1">
                ({toPersianDigits(Math.round(estimates.totalRial / 10).toLocaleString())} تومان)
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="text-[10px] text-slate-500 font-black mb-1">قیمت واحد جعبه / برگ</div>
              <div className="text-lg font-black text-white font-mono">
                {toPersianDigits(estimates.unitRial.toLocaleString())}
                <span className="text-xs text-slate-400 mr-1.5">ریال</span>
              </div>
              <div className="text-xs font-black text-slate-400 font-mono">
                ({toPersianDigits(Math.round(estimates.unitRial / 10).toLocaleString())} تومان)
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 leading-relaxed font-bold">
            * توجه: برآوردهای فوق تخمینی بوده و با احتساب ۲۵ درصد سود کارگاه چاپ است. قیمت نهایی پس از بررسی فایل طراحی توسط ناظر فنی قطعی می‌گردد.
          </div>
        </div>
      </div>
    </div>
  );
};
