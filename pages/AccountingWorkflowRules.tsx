import React, { useState } from 'react';
import { 
  Workflow, FileText, Package, Users, Banknote, Landmark, ShieldCheck, 
  ArrowLeftRight, Info, Code, Play, RefreshCw, Layers, CheckSquare, 
  AlertTriangle, BookOpen, Clock, HelpCircle, Sparkles
} from 'lucide-react';

interface BlueprintNode {
  id: string;
  label: string;
  icon: any;
  color: string;
  borderColor: string;
  debitCredit: string;
  iranLaw: string;
  codeReference: string;
  description: string;
}

const NODES: BlueprintNode[] = [
  {
    id: 'invoice',
    label: 'فاکتور (Invoice)',
    icon: FileText,
    color: 'bg-teal-500/10 text-teal-400',
    borderColor: 'border-teal-500/30',
    description: 'سند اولیه معامله کالا یا خدمات که مبنای ارزش‌گذاری مالیاتی و مبادلات تجاری است.',
    debitCredit: `بدهکار: حساب دریافتنی مشتری (حسابهای معین اشخاص)\nبستانکار: درآمد فروش (فروش کالا/خدمات)\nبستانکار: مالیات بر ارزش افزوده پرداختنی (در صورت شمول قانون ۹٪ مالیات)`,
    iranLaw: `مطابق قانون پایانه‌های فروشگاهی و سامانه مودیان ایران:\n- تخصیص ۹٪ مالیات بر ارزش افزوده روی اقلام مشمول.\n- ضرورت تفکیک قیمت خرید و فروش کالا.\n- تولید شماره منحصر‌به‌فرد مالیاتی مودیان (کد رهگیری فاکتور).`,
    codeReference: `کامپوننت: pages/Invoices.tsx\nتابع ثبت: handleSaveInvoice()\nمتد استور: addInvoice(invoice) در store.ts`
  },
  {
    id: 'voucher',
    label: 'حواله انبار (Voucher)',
    icon: Package,
    color: 'bg-indigo-500/10 text-indigo-400',
    borderColor: 'border-indigo-500/30',
    description: 'سند ورود یا خروج فیزیکی کالا از انبار که برای کنترل دارایی‌های فیزیکی صادر می‌شود.',
    debitCredit: `حواله خروج (OUT): بدهکار بهای تمام شده کالای فروش رفته / بستانکار انبار کالا (موجودی کالا)\nحواله ورود (IN): بدهکار انبار کالا / بستانکار حساب پرداختنی تامین‌کننده`,
    iranLaw: `قوانین مالی و انبارداری انحصار ایران:\n- تفکیک کالاها بر اساس مکان فیزیکی (شماره قفسه انبار).\n- ضرورت امضای ترخیص‌کننده، مباشر حمل (راننده) و امضای دیجیتال تحویل‌گیرنده جهت اثبات تحویل کالا (ماده ۳۷۵ قانون تجارت).`,
    codeReference: `کامپوننت: pages/Inventory.tsx\nتابع ثبت: handleSaveVoucher()\nمتد استور: addVoucher(voucher) در store.ts`
  },
  {
    id: 'check',
    label: 'مدیریت چک صیاد (Check)',
    icon: Banknote,
    color: 'bg-amber-500/10 text-amber-400',
    borderColor: 'border-amber-500/30',
    description: 'ابزار تعهد پرداخت مدت‌دار که در ایران تحت نظارت مستقیم سامانه صیاد بانک مرکزی است.',
    debitCredit: `دریافت چک: بدهکار اسناد دریافتنی (نزد صندوق) / بستانکار حساب دریافتنی مشتری\nوصول چک: بدهکار حساب بانک / بستانکار اسناد دریافتنی\nواگذاری چک: بدهکار حساب پرداختنی همکار / بستانکار اسناد دریافتنی`,
    iranLaw: `قانون جدید چک صیادی بانک مرکزی ایران:\n- الزامی بودن شناسه ۱۶ رقمی صیاد.\n- عدم امکان صدور چک در وجه حامل؛ ثبت چک حتماً در وجه شخص مشخص.\n- مراحل وضعیت‌دهی دقیق: نزد صندوق (PENDING) -> واگذار شده (TRANSFERRED) -> وصول شده (PASSED) -> برگشتی (BOUNCED).`,
    codeReference: `کامپوننت: pages/Checks.tsx\nتابع ثبت چک: saveBatchChecks()\nمتد استور: addCheck() و updateCheckStatus() در store.ts`
  },
  {
    id: 'receipt_payment',
    label: 'دریافت و پرداخت (Finance)',
    icon: Landmark,
    color: 'bg-emerald-500/10 text-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'ثبت جابجایی وجوه نقد و بانکی که تراز نقدی کل سیستم حسابداری را تحت تاثیر قرار می‌دهد.',
    debitCredit: `دریافت نقدی: بدهکار صندوق/بانک / بستانکار حساب دریافتنی مشتری\nپرداخت نقدی: بدهکار حساب پرداختنی تامین‌کننده / بستانکار صندوق/بانک`,
    iranLaw: `ماده ۱۷ و ۱۴ قانون مالیات‌های مستقیم ایران:\n- لزوم ثبت دقیق اطلاعات تراکنش بانکی (شماره فیش، شماره کارت یا تراکنش شبا).\n- سقف تراکنش‌های نقدی مجاز بدون فیش بانکی.`,
    codeReference: `کامپوننت: pages/Finance.tsx\nتابع ثبت: addGeneralFinance() در store.ts\nمدیریت کاردکس: Customers.tsx (مشاهده گردش کاردکس جامع)`
  }
];

interface SimulatorScenario {
  title: string;
  steps: string[];
  accountingEntries: { debit: string; credit: string; amount: string }[];
  impact: string;
}

const SCENARIOS: SimulatorScenario[] = [
  {
    title: 'فروش کالا به صورت اعتباری (Credit Sale)',
    steps: [
      'کاربر فاکتور فروش کالا را ثبت می‌کند (Invoices.tsx).',
      'فاکتور به صورت خودکار ثبت و کد رهگیری مالیاتی صادر می‌شود.',
      'تراز مالی بدهکاری مشتری به ارزش فاکتور افزایش می‌یابد.',
      'یک سند تراکنش مالی از نوع INVOICE_SALE ثبت می‌شود.'
    ],
    accountingEntries: [
      { debit: 'بدهکار: حسابهای دریافتنی تجاری (مشتری)', credit: '---', amount: '۱۰۰٪ مبلغ فاکتور' },
      { debit: '---', credit: 'بستانکار: درآمد حاصل از فروش کالا', amount: '۹۱٪ (بهای کالا)' },
      { debit: '---', credit: 'بستانکار: مالیات بر ارزش افزوده پرداختنی', amount: '۹٪ مالیات ارزش افزوده' }
    ],
    impact: 'بدهکاری مشتری افزایش یافته و سود/درآمد شناسایی می‌شود. کدهای رهگیری فاکتور تولید و ثبت می‌شوند.'
  },
  {
    title: 'دریافت چک صیادی بابت تسویه بدهی مشتری (Check Receipt)',
    steps: [
      'چک صیادی با شناسه ۱۶ رقمی و تاریخ سررسید در فاکتور یا منوی چک ثبت می‌شود.',
      'وضعیت چک روی «نزد صندوق» قرار می‌گیرد (اسناد دریافتنی).',
      'بدهکاری مشتری به اندازه مبلغ چک کاهش پیدا می‌کند.',
      'تراکنش مالی تسویه موقت بابت فاکتور صادر می‌شود.'
    ],
    accountingEntries: [
      { debit: 'بدهکار: اسناد دریافتنی نزد صندوق (چک صیاد)', credit: '---', amount: 'مبلغ چک' },
      { debit: '---', credit: 'بستانکار: حسابهای دریافتنی مشتری', amount: 'مبلغ چک' }
    ],
    impact: 'مانده تراز بدهکاری مشتری کاهش می‌یابد اما وجه نقد نهایی به بانک واریز نشده تا زمان وصول چک.'
  },
  {
    title: 'وصول چک صیادی نزد صندوق (Check Cashing)',
    steps: [
      'چک در سررسید وصول می‌شود و وضعیت آن در برنامه به «PASSED» تغییر می‌کند.',
      'مبلغ از صندوق چک خارج و به موجودی حساب بانک انتخابی واریز می‌شود.',
      'سند حسابداری وصول نهایی صادر می‌شود.'
    ],
    accountingEntries: [
      { debit: 'بدهکار: موجودی بانک (حساب بانکی شرکت)', credit: '---', amount: 'مبلغ وصولی چک' },
      { debit: '---', credit: 'بستانکار: اسناد دریافتنی نزد صندوق (چک صیاد)', amount: 'مبلغ وصولی چک' }
    ],
    impact: 'اسناد دریافتنی کاهش یافته و تراز نقد و بانک واقعی سیستم افزایش می‌یابد.'
  },
  {
    title: 'صدور حواله انبار خروج کالا و تحویل به راننده (Warehouse Goods Release)',
    steps: [
      'حواله خروج کالا (OUT Voucher) با اتصال به فاکتور مرجع صادر می‌شود.',
      'مشخصات پلاک خودرو و راننده (مباشر حمل) ثبت می‌شود.',
      'تعداد کالا از موجودی انبار کالا کسر شده و وضعیت انبار بروزرسانی می‌شود.',
      'امضای دیجیتال راننده و تحویل‌گیرنده در حواله انبار ثبت می‌شود.'
    ],
    accountingEntries: [
      { debit: 'بدهکار: بهای تمام شده کالای فروش رفته (کاردکس انبار)', credit: '---', amount: 'بهای تمام‌شده کالا' },
      { debit: '---', credit: 'بستانکار: موجودی انبار کالا', amount: 'بهای تمام‌شده کالا' }
    ],
    impact: 'موجودی فیزیکی انبار کالا کاهش یافته و بهای تمام شده کالای فروش رفته محاسبه و ثبت می‌گردد.'
  }
];

const AccountingWorkflowRules = () => {
  const [activeTab, setActiveTab] = useState<'flow' | 'simulator' | 'compliance'>('flow');
  const [selectedNode, setSelectedNode] = useState<BlueprintNode | null>(NODES[0]);
  const [selectedScenario, setSelectedScenario] = useState<SimulatorScenario>(SCENARIOS[0]);

  return (
    <div className="space-y-8 animate-fade-in pb-20 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
        <div className="text-center md:text-right w-full md:w-auto">
          <h1 className="text-2xl font-black text-white flex items-center justify-center md:justify-start gap-3">
            <Workflow className="text-teal-400" size={28} />
            پنل الگو و نقشه جریان حسابداری
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
            Accounting Blueprint & Iranian Law Integration Reference Panel
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/5 w-fit shadow-lg gap-2">
        <button 
          onClick={() => setActiveTab('flow')} 
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'flow' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Layers size={16} />
          نقشه تعاملی جریان اسناد
        </button>
        <button 
          onClick={() => setActiveTab('simulator')} 
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Play size={16} />
          شبیه‌ساز و الگوهای مالی
        </button>
        <button 
          onClick={() => setActiveTab('compliance')} 
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'compliance' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ShieldCheck size={16} />
          قوانین حسابداری و راه‌حل‌ها
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'flow' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Visual Interactive Map (Left in RTL, taking 7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/60 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col justify-between min-h-[500px]">
            <div>
              <h3 className="text-white font-black text-lg mb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-teal-400" />
                چرخه یکپارچه اسناد مالی و لجستیک
              </h3>
              <p className="text-slate-400 text-xs font-medium mb-8">
                برای مشاهده کدهای سند حسابداری دوبل و قوانین بانکی مرتبط با هر ماژول، روی آن کلیک کنید:
              </p>
            </div>

            {/* Simulated Map Grid Flow */}
            <div className="relative flex flex-col items-center justify-center py-10 gap-12">
              
              {/* Row 1: Source Documents */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full z-10">
                {NODES.filter(n => ['invoice', 'voucher'].includes(n.id)).map(node => {
                  const NodeIcon = node.icon;
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`w-64 p-6 rounded-3xl border-2 transition-all text-right flex items-center gap-4 group hover:scale-105 active:scale-95 ${
                        isSelected 
                          ? `${node.color} ${node.borderColor} border-teal-500 shadow-[0_0_25px_rgba(20,184,166,0.25)]`
                          : 'bg-slate-950/40 border-white/5 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${node.color}`}>
                        <NodeIcon size={24} />
                      </div>
                      <div>
                        <div className="font-black text-sm text-white">{node.label}</div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">تاثیر روی انبار و حساب مودی</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Central Arrow/Relation Row */}
              <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                <ArrowLeftRight size={24} className="animate-pulse text-indigo-500 rotate-90" />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">ارتباط خودکار تراز و کالا</span>
              </div>

              {/* Row 2: Payment and Checking */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full z-10">
                {NODES.filter(n => ['check', 'receipt_payment'].includes(n.id)).map(node => {
                  const NodeIcon = node.icon;
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`w-64 p-6 rounded-3xl border-2 transition-all text-right flex items-center gap-4 group hover:scale-105 active:scale-95 ${
                        isSelected 
                          ? `${node.color} ${node.borderColor} border-teal-500 shadow-[0_0_25px_rgba(20,184,166,0.25)]`
                          : 'bg-slate-950/40 border-white/5 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${node.color}`}>
                        <NodeIcon size={24} />
                      </div>
                      <div>
                        <div className="font-black text-sm text-white">{node.label}</div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">تراکنش صیادی و نقدینگی</div>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>

            <div className="flex gap-2 items-center bg-black/20 p-4 rounded-2xl border border-white/5 text-[10px] text-slate-500 font-bold">
              <Info size={14} className="text-teal-400 shrink-0" />
              <span>این چرخه به صورت خودکار تراز مالی و کاردکس را هماهنگ نگه می‌دارد. تغییر هر آیتم مستقیماً روی سایر آیتم‌های متصل اثرگذار است.</span>
            </div>
          </div>

          {/* Details & Specifications Panel (Right in RTL, taking 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {selectedNode ? (
              <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-fade-in">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${selectedNode.color}`}>
                    <selectedNode.icon size={28} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-xl">{selectedNode.label}</h3>
                    <p className="text-[10px] text-teal-400 font-black tracking-widest uppercase">Integration Blueprint</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-slate-400 text-xs font-black mb-2 flex items-center gap-2"><HelpCircle size={14}/> تعریف و نقش</h4>
                  <p className="text-slate-200 text-xs leading-6 font-bold">{selectedNode.description}</p>
                </div>

                {/* Accounting entries */}
                <div className="p-5 bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                  <h4 className="text-teal-400 text-xs font-black mb-3 flex items-center gap-2"><BookOpen size={14}/> سند مالی دوبل مربوطه (Debit/Credit)</h4>
                  <pre className="text-slate-300 text-xs leading-6 font-mono whitespace-pre-line font-black">{selectedNode.debitCredit}</pre>
                </div>

                {/* Iranian law */}
                <div className="p-5 bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                  <h4 className="text-amber-400 text-xs font-black mb-3 flex items-center gap-2"><Landmark size={14}/> تطبیق با قوانین مالی و بانکی ایران</h4>
                  <pre className="text-slate-300 text-xs leading-6 font-mono whitespace-pre-line font-bold">{selectedNode.iranLaw}</pre>
                </div>

                {/* Developer References */}
                <div className="p-5 bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                  <h4 className="text-indigo-400 text-xs font-black mb-3 flex items-center gap-2"><Code size={14}/> راهنمای فنی کدهای برنامه (Developer Rule)</h4>
                  <pre className="text-slate-400 text-[10px] leading-5 font-mono whitespace-pre-line">{selectedNode.codeReference}</pre>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-10 shadow-2xl flex items-center justify-center h-full text-slate-500 font-bold">
                لطفاً یکی از بخش‌ها را در نقشه روبه‌رو انتخاب کنید.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8">
          <div>
            <h3 className="text-white font-black text-xl mb-2 flex items-center gap-2">
              <Play className="text-indigo-400" size={22} />
              شبیه‌ساز هوشمند چرخه اسناد (Financial Cycle Sandbox)
            </h3>
            <p className="text-slate-400 text-xs font-medium">
              یکی از سناریوهای رایج حسابداری در ایران را انتخاب کنید تا نحوه تغییر داده‌ها، اثرات تراز و اسناد دوبل تولید شده را به صورت تعاملی ببینید:
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Scenario Selection list */}
            <div className="lg:col-span-4 space-y-3">
              {SCENARIOS.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedScenario(sc)}
                  className={`w-full text-right p-5 rounded-2xl border transition-all flex items-center justify-between font-black text-xs ${
                    selectedScenario.title === sc.title
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-md'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:bg-black/40 hover:text-white'
                  }`}
                >
                  <span>{sc.title}</span>
                  <Play size={12} className={selectedScenario.title === sc.title ? 'text-indigo-400' : 'text-slate-600'} />
                </button>
              ))}
            </div>

            {/* Simulator Output Details */}
            <div className="lg:col-span-8 bg-slate-950/40 border border-white/5 rounded-[2rem] p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h4 className="text-white font-black text-base">{selectedScenario.title}</h4>
                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Active Simulator Flow</span>
              </div>

              {/* Steps of document generation */}
              <div>
                <h5 className="text-slate-400 text-xs font-black mb-3 flex items-center gap-2"><Clock size={14} className="text-slate-400" /> ترتیب گردش مدارک و وظایف:</h5>
                <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-200 font-bold pr-2">
                  {selectedScenario.steps.map((step, idx) => (
                    <li key={idx} className="leading-6">{step}</li>
                  ))}
                </ol>
              </div>

              {/* Journal Entry details */}
              <div className="p-5 bg-slate-900 border border-white/5 rounded-2xl shadow-inner">
                <h5 className="text-teal-400 text-xs font-black mb-4 flex items-center gap-2"><BookOpen size={14} className="text-teal-400" /> ثبت سند مالی دوبل متناظر (روزنامه):</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500"><th className="pb-3 pr-2">حساب معین/تفصیلی</th><th className="pb-3 text-left">مبلغ/نسبت</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-bold">
                      {selectedScenario.accountingEntries.map((ent, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="py-3.5 pr-2 font-mono">{ent.debit !== '---' ? ent.debit : ent.credit}</td>
                          <td className="py-3.5 text-left font-mono text-teal-400">{ent.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final impact check */}
              <div className="flex gap-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl items-start">
                <CheckSquare className="text-indigo-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <h5 className="text-white font-black text-xs">اثرات نهایی ترازنامه و انبار:</h5>
                  <p className="text-slate-300 text-[11px] font-bold leading-5 mt-1">{selectedScenario.impact}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <h3 className="text-white font-black text-lg flex items-center gap-2 border-b border-white/5 pb-4"><Landmark size={20} className="text-amber-400"/> انطباق با قوانین بانکی و مالیاتی ایران</h3>
            <div className="space-y-4 text-xs leading-6 text-slate-300">
              <div className="space-y-1.5">
                <h4 className="text-white font-black text-sm">۱. تایید قانون چک صیادی جدید (سامانه صیاد):</h4>
                <p className="font-bold">ثبت هویت کامل صادرکننده و دریافت‌کننده به صورت کاملاً کدگذاری‌شده و اختصاصی به همراه تاریخ سررسید دقیق الزامی است. سامانه امکان صدور چک در وجه حامل را ندارد و تمام انتقالات چک باید با تایید صیاد و امضا در وجه طرف معین انجام شود.</p>
              </div>
              <div className="space-y-1.5 pt-4 border-t border-white/5">
                <h4 className="text-white font-black text-sm">۲. قانون ۹٪ مالیات بر ارزش افزوده (VAT):</h4>
                <p className="font-bold">تمامی مبالغ ثبت شده در فاکتورهای رسمی کالا و خدمات ملزم به اعمال قانون ۹٪ ارزش افزوده هستند که در اسناد دوبل به صورت بدهکار/بستانکار جاری ارزش افزوده ثبت شده و به صورت فصلی به سازمان امور مالیاتی کشور تسویه می‌گردد.</p>
              </div>
              <div className="space-y-1.5 pt-4 border-t border-white/5">
                <h4 className="text-white font-black text-sm">۳. ماده ۳۷۵ قانون تجارت (اثبات تحویل کالا):</h4>
                <p className="font-bold">وجود مشخصات مباشر حمل (راننده) و امضا/تایید الکترونیک گیرنده سند به عنوان سند قطعی تحویل قلمداد شده و جهت رسیدگی به اختلافات تجاری در محاکم عمومی ایران کاربرد حقوقی دارد.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <h3 className="text-white font-black text-lg flex items-center gap-2 border-b border-white/5 pb-4"><Code size={20} className="text-indigo-400"/> راهنمای برنامه‌نویسان (Code Development Standards)</h3>
            <div className="space-y-4 text-xs leading-6 text-slate-400">
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10px] space-y-2">
                <p className="text-teal-400">// قاعده اول: هر فاکتور باید یک تراکنش کاردکس مالی متناظر تولید کند.</p>
                <p className="text-slate-500">addInvoice (i) =&gt; set(s =&gt; &#123; ... create transaction in s.transactions ... &#125;)</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10px] space-y-2">
                <p className="text-teal-400">// قاعده دوم: تغییر وضعیت چک صیادی نباید مستقیماً تراز مشتری را تغییر دهد.</p>
                <p className="text-slate-500">تغییر تراز مالی فقط در زمان واگذاری (DEPOSITED) یا ثبت اولیه انجام می‌شود. وصول چک (PASSED) فقط حسابهای بانکی را افزایش می‌دهد.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10px] space-y-2">
                <p className="text-teal-400">// قاعده سوم: همگام‌سازی محلی (Local-First) داده‌های مالی.</p>
                <p className="text-slate-500">استفاده از فیلد updatedAt و ثبت در Deletion Registry برای حفظ یکپارچگی ردیف‌های حذف شده در حالت آفلاین.</p>
              </div>
              <div className="flex gap-2 items-center bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 text-[10px] text-rose-400 font-bold">
                <AlertTriangle size={14} className="shrink-0" />
                <span>توجه: هرگونه تغییر در استورهای Zustand یا فرم‌های ثبت مالی باید قوانین شبیه‌ساز مالی بالا را به طور کامل حفظ کند.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingWorkflowRules;
