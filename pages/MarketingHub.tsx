import React, { useState, useEffect } from 'react';
import { useMarketingStore } from '../store-marketing';
import { useStore } from '../store';
import { generateId, getPersianDate, toPersianDigits, formatCurrency, isDesktopApp } from '../utils';
import { CMSSchema, CMSEntry, B2BLead, SeoKeyword } from '../types-marketing';
import { InvoiceType } from '../types';
import { PrintCalculator } from '../components/PrintCalculator';
import { PersianSEOAuditor } from '../components/PersianSEOAuditor';
import { WebServiceNoticeBanner } from '../components/WebServiceNoticeBanner';
import { 
  Megaphone, FileText, TrendingUp, Users, Settings, Database, Plus, Trash2, 
  CheckCircle, Edit, ArrowLeftRight, ExternalLink, Globe, Send, Share2, AlertTriangle, ArrowRightLeft,
  Lock, PhoneCall
} from 'lucide-react';

const MarketingHub: React.FC = () => {
  const isDesktop = isDesktopApp();
  const {
    schemas, entries, seoKeywords, seoAudits, leads, publisherConfig, isLoading,
    addSchema, updateSchema, deleteSchema,
    addEntry, updateEntry, deleteEntry,
    addSeoKeyword, updateSeoKeyword, deleteSeoKeyword,
    updateLead, deleteLead, updatePublisherConfig, fetchFromHost
  } = useMarketingStore();

  const appStore = useStore(); // the main financial store to bridge leads to invoices

  const [activeTab, setActiveTab] = useState<'cms' | 'seo' | 'crm' | 'publisher'>('cms');

  // CMS Editor states
  const [showAddSchema, setShowAddSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaDesc, setNewSchemaDesc] = useState('');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entrySlug, setEntrySlug] = useState('');
  const [entryStatus, setEntryStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [entrySeoTitle, setEntrySeoTitle] = useState('');
  const [entrySeoDesc, setEntrySeoDesc] = useState('');
  const [entryFieldValues, setEntryFieldValues] = useState<Record<string, any>>({});

  // SEO Rank simulation state
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordVolume, setNewKeywordVolume] = useState(1500);

  // CRM bridging state
  const [leadToBridge, setLeadToBridge] = useState<B2BLead | null>(null);

  // Trigger initial fetch from server on load
  useEffect(() => {
    fetchFromHost();
  }, []);

  // Set default schema configuration for printing house if schemas are empty
  useEffect(() => {
    if (schemas.length === 0 && !isLoading) {
      // Create a default printing product schema
      const defaultPrintSchema: CMSSchema = {
        id: 'schema_print_product',
        name: 'کاتالوگ محصول چاپی',
        description: 'فیلدهای مشخصات کاغذ، ابعاد و تیراژ محصولات بسته‌بندی برای وب‌سایت عمومی',
        fields: [
          { name: 'جنس مقوا', key: 'material', type: 'text', required: true },
          { name: 'گرماژ پیشنهادی', key: 'gsm', type: 'number', required: true },
          { name: 'پوشش محافظ', key: 'coating', type: 'select', required: false, options: ['سلفون مات', 'سلفون براق', 'یووی ورنی', 'بدون سلفون'] },
          { name: 'آدرس فایل تیغ قالب (PDF)', key: 'die_cut_file', type: 'image', required: false },
          { name: 'ویژگی‌های برجسته محصول', key: 'features', type: 'rich-text', required: false }
        ],
        createdAt: getPersianDate(),
        updatedAt: getPersianDate()
      };
      addSchema(defaultPrintSchema);
    }
  }, [schemas, isLoading]);

  // Handle entry creation or update
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchemaId || !entrySlug) return;

    if (editingEntryId) {
      updateEntry(editingEntryId, {
        slug: entrySlug,
        status: entryStatus,
        seoTitle: entrySeoTitle,
        seoDescription: entrySeoDesc,
        fields: entryFieldValues
      });
    } else {
      const newEntry: CMSEntry = {
        id: 'entry_' + generateId(),
        schemaId: selectedSchemaId,
        slug: entrySlug,
        status: entryStatus,
        seoTitle: entrySeoTitle,
        seoDescription: entrySeoDesc,
        seoKeywords: [],
        fields: entryFieldValues,
        createdAt: getPersianDate(),
        updatedAt: getPersianDate()
      };
      addEntry(newEntry);
    }

    // Reset Form
    setShowAddEntry(false);
    setEditingEntryId(null);
    setEntrySlug('');
    setEntrySeoTitle('');
    setEntrySeoDesc('');
    setEntryFieldValues({});
  };

  const handleEditEntry = (entry: CMSEntry) => {
    setSelectedSchemaId(entry.schemaId);
    setEntrySlug(entry.slug);
    setEntryStatus(entry.status);
    setEntrySeoTitle(entry.seoTitle);
    setEntrySeoDesc(entry.seoDescription);
    setEntryFieldValues(entry.fields || {});
    setEditingEntryId(entry.id);
    setShowAddEntry(true);
  };

  // Add SEO keyword simulation
  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword) return;

    // Simulate difficulty & initial positions
    const difficulty = Math.floor(Math.random() * 40) + 20; // 20-60
    const startPos = Math.floor(Math.random() * 80) + 15; // 15-95

    const kw: SeoKeyword = {
      id: 'kw_' + generateId(),
      keyword: newKeyword,
      volume: newKeywordVolume,
      difficulty,
      currentPosition: startPos,
      previousPosition: startPos + (Math.random() > 0.5 ? 3 : -3),
      history: [
        { date: '۰۳/۰۱', position: startPos + 5 },
        { date: '۰۳/۰۲', position: startPos + 2 },
        { date: '۰۳/۰۳', position: startPos }
      ],
      competitors: [
        { name: 'چاپخانه خورشید', url: 'khorshidprint.ir', rank: Math.max(1, startPos - 4) },
        { name: 'مجتمع کارتن کاران', url: 'kartonkaran.com', rank: Math.max(1, startPos - 8) }
      ],
      updatedAt: getPersianDate()
    };

    addSeoKeyword(kw);
    setNewKeyword('');
  };

  // Bridge CRM Lead directly to Invoice in Financial Core Store
  const bridgeLeadToInvoice = (lead: B2BLead) => {
    if (!lead.calculatorConfig) return;

    // Generate Invoice and save it in standard store
    const config = lead.calculatorConfig;
    const trackingCode = 'INV-LID-' + lead.id.slice(-5).toUpperCase();
    const newInvoiceId = 'inv_' + generateId();

    // 1. Prepopulate a customer if not exists
    let clientCustomerId = '';
    const existingPerson = appStore.people.find(p => p.phone === lead.phone || p.name === lead.name);
    
    if (existingPerson) {
      clientCustomerId = existingPerson.id;
    } else {
      const newPersonId = 'person_' + generateId();
      appStore.addPerson({
        id: newPersonId,
        name: lead.name,
        phone: lead.phone,
        address: 'ثبت شده خودکار از لید سئو',
        balance: 0,
        code: 'C-' + (appStore.people.length + 1001),
        notes: lead.company ? `شرکت: ${lead.company}` : ''
      });
      clientCustomerId = newPersonId;
    }

    // 2. Prepopulate a mock print product
    const mockPrintProductId = 'prod_' + generateId();
    appStore.addProduct({
      id: mockPrintProductId,
      name: `جعبه سفارشی ${config.paperType} (${config.widthCm}×${config.lengthCm}×${config.heightCm})`,
      code: 'P-' + (appStore.products.length + 1001),
      price: Math.round(config.estimatedCost / config.quantity),
      stock: config.quantity,
      unit: 'عدد',
      reservedStock: 0
    });

    // 3. Draft the invoice
    appStore.addInvoice({
      id: newInvoiceId,
      companyId: 'default',
      number: appStore.invoices.length + 5000,
      date: getPersianDate(),
      dueDate: getPersianDate(),
      type: InvoiceType.SALE,
      personId: clientCustomerId,
      personName: lead.name,
      items: [
        {
          productId: mockPrintProductId,
          productName: `جعبه سفارشی ${config.paperType} GSM ${config.paperWeight}`,
          quantity: config.quantity,
          buyPrice: 0,
          unitPrice: Math.round(config.estimatedCost / config.quantity),
          total: config.estimatedCost,
          profit: Math.round(config.estimatedCost * 0.2)
        }
      ],
      subTotal: config.estimatedCost,
      totalProfit: Math.round(config.estimatedCost * 0.2),
      discount: 0,
      tax: Math.round(config.estimatedCost * 0.09),
      finalTotal: Math.round(config.estimatedCost * 1.09),
      cashAmount: 0,
      checkAmount: 0,
      trackingCode,
      taxId: 'TXID' + Date.now().toString().slice(-10)
    });

    // 4. Set lead status to INVOICE (Won)
    updateLead(lead.id, { status: 'INVOICE' });
    setLeadToBridge(null);

    // Notify user
    alert(`جعبه چاپی مشتری با موفقیت به عنوان پیش‌فاکتور فروش شماره ${appStore.invoices.length + 5000} و مشتری در حسابداری اشک قلم ثبت گردید!`);
  };

  return (
    <div className="space-y-8 min-h-screen text-slate-100 font-sans" dir="rtl">
      {/* بنر اطلاع‌رسانی خدمات وب */}
      <WebServiceNoticeBanner
        serviceName="خدمات وب و هاست بازاریابی"
        title="هاب بازاریابی، کاتالوگ آنلاین و سئو متصل به وب‌سایت و هاست"
        description="این ماژول برای انتشار آنلاین کاتالوگ‌های محصولات، دریافت لیدهای B2B از وب‌سایت وردپرس/اختصاصی و ارزیابی سئو طراحی شده است. در نسخه دسکتاپ، پردازش‌های وب به دلیل ایزوله بودن دیتابیس لوکال، از طریق پنل هاست یا نسخه تحت وب مدیریت می‌شوند."
      />

      {/* هشدار غیرفعال بودن در دسکتاپ در صورت باز شدن صفحه */}
      {isDesktop && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 text-amber-300">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-white">ماژول بازاریابی و سئو در نسخه دسکتاپ غیرفعال است</h4>
              <p className="text-xs text-amber-200/80 mt-0.5">جهت استفاده از خدمات سئو، وب‌سایت و فرم‌های آنلاین، از نسخه وب‌سرور یا هاست اختصاصی استفاده فرمایید.</p>
            </div>
          </div>
          <a
            href="https://eitaa.com/ashkghalamCo"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition"
          >
            <PhoneCall size={14} />
            <span>پشتیبانی ایتا</span>
          </a>
        </div>
      )}

      {/* Visual Header */}
      <div className="bg-gradient-to-l from-teal-900/30 via-slate-900 to-indigo-900/10 border border-white/5 p-8 md:p-10 rounded-[3rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-teal-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[150px] bg-indigo-500/10 rounded-full blur-[80px]"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 text-center md:text-right">
            <span className="text-[10px] font-black tracking-widest text-teal-400 bg-teal-500/20 px-4 py-1.5 rounded-full uppercase">
              HubSpot + Ahrefs B2B Suite
            </span>
            <h1 className="text-3xl font-black text-white leading-tight">هاب رشد بازاریابی و بهینه‌سازی سئو چاپ</h1>
            <p className="text-slate-400 text-xs md:text-sm font-bold">
              مدیریت یکپارچه کاتالوگ‌های چاپی، ردیابی کلمات کلیدی گوگل، ماشین حساب محاسبات فنی و بسترسازی لیدهای ورودی
            </p>
          </div>
          <div className="flex bg-slate-950/70 p-2 rounded-[2rem] border border-white/5 gap-2 shrink-0">
            <button
              onClick={() => { setActiveTab('cms'); fetchFromHost(); }}
              className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black transition-all ${
                activeTab === 'cms' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={16} />
              کاتالوگ محتوا (CMS)
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black transition-all ${
                activeTab === 'seo' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp size={16} />
              آنالیزور گوگل (SEO)
            </button>
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black transition-all ${
                activeTab === 'crm' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={16} />
              خط لوله فروش (CRM)
            </button>
            <button
              onClick={() => setActiveTab('publisher')}
              className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black transition-all ${
                activeTab === 'publisher' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe size={16} />
              انتشار و پیوندها
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-10">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-xs font-black text-slate-500">در حال همگام‌سازی با هاست اصلی...</span>
        </div>
      )}

      {/* Tab Contents */}
      {!isLoading && (
        <div className="space-y-6">
          {/* TAB 1: Contentful-style Headless CMS */}
          {activeTab === 'cms' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Database className="text-teal-400" size={20} />
                      مدیریت محتوای کاتالوگ محصولات چاپی و مقالات بسته‌بندی
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold">
                      ایجاد شِماهای فیلد اختصاصی و مدیریت فایل‌های قالب بسته‌بندی B2B
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSchemaId(schemas[0]?.id || '');
                      setShowAddEntry(true);
                      setEditingEntryId(null);
                    }}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-black text-xs px-5 py-3.5 rounded-2xl active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus size={16} />
                    افزودن مدخل کاتالوگ جدید
                  </button>
                </div>

                {/* Entry List */}
                {entries.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 text-xs font-bold bg-slate-950/20 rounded-2xl border-2 border-dashed border-white/5">
                    هیچ محتوایی ثبت نشده است. همین حالا یک مدخل کاتالوگ چاپی برای وب‌سایت ایجاد کنید.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {entries.map(entry => {
                      const schema = schemas.find(s => s.id === entry.schemaId);
                      return (
                        <div
                          key={entry.id}
                          className="bg-slate-950/60 border border-white/5 hover:border-teal-500/20 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg">
                                {schema?.name || 'کاتالوگ عمومی'}
                              </span>
                              <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${
                                entry.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                {entry.status === 'PUBLISHED' ? 'منتشر شده' : 'پیش‌نویس'}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm font-black text-white hover:text-teal-400 transition-colors">
                                {entry.slug}
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-1 font-mono" dir="ltr">
                                /post/{entry.slug}
                              </p>
                            </div>

                            {/* Render Schema Fields */}
                            <div className="space-y-1.5 pt-3 border-t border-white/5 text-[10px] text-slate-400 font-bold">
                              {Object.entries(entry.fields || {}).map(([key, val]) => {
                                const fieldDef = schema?.fields.find(f => f.key === key);
                                return (
                                  <div key={key} className="flex justify-between">
                                    <span>{fieldDef?.name || key}:</span>
                                    <span className="text-slate-300 truncate max-w-[150px]">{String(val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-5 border-t border-white/5 mt-4">
                            <button
                              onClick={() => handleEditEntry(entry)}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-[10px] transition-all flex items-center justify-center gap-1.5"
                            >
                              <Edit size={12} />
                              ویرایش فیلدها
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Schema / Dynamic Field schema configuration modal dialog */}
              {showAddEntry && (
                <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl animate-fade-in space-y-6">
                  <h3 className="text-base font-black text-white pb-3 border-b border-white/5">
                    {editingEntryId ? 'ویرایش فیلدهای محتوای کاتالوگ' : 'ایجاد محتوای کاتالوگ چاپی جدید'}
                  </h3>

                  <form onSubmit={handleSaveEntry} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-black pr-2">الگوی فیلدها (Schema)</label>
                        <select
                          value={selectedSchemaId}
                          onChange={e => setSelectedSchemaId(e.target.value)}
                          className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold"
                        >
                          {schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-black pr-2">نام مستعار آدرس وب‌سایت (Slug)</label>
                        <input
                          type="text"
                          value={entrySlug}
                          onChange={e => setEntrySlug(e.target.value)}
                          required
                          placeholder="box-kraft-printed"
                          className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Dynamic Fields inputs based on Selected Schema definition */}
                    {selectedSchemaId && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-xs font-black text-teal-400">مشخصات فنی کاتالوگ (فیلدهای سفارشی شما):</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {schemas.find(s => s.id === selectedSchemaId)?.fields.map(field => (
                            <div key={field.key} className="space-y-2">
                              <label className="text-[10px] text-slate-400 font-bold pr-2">
                                {field.name} {field.required ? '*' : ''}
                              </label>
                              {field.type === 'select' ? (
                                <select
                                  value={entryFieldValues[field.key] || ''}
                                  onChange={e => setEntryFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-teal-500 font-bold"
                                >
                                  <option value="">انتخاب کنید...</option>
                                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  value={entryFieldValues[field.key] || ''}
                                  onChange={e => setEntryFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  required={field.required}
                                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-teal-500 font-bold"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-black pr-2">عنوان متا برای سئو کاتالوگ</label>
                        <input
                          type="text"
                          value={entrySeoTitle}
                          onChange={e => setEntrySeoTitle(e.target.value)}
                          placeholder="خرید جعبه بسته‌بندی کرافت با چاپ اختصاصی"
                          className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-black pr-2">توضیح متا برای گوگل</label>
                        <input
                          type="text"
                          value={entrySeoDesc}
                          onChange={e => setEntrySeoDesc(e.target.value)}
                          className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEntryStatus('PUBLISHED')}
                          className={`px-4 py-2 text-xs font-black rounded-xl border ${
                            entryStatus === 'PUBLISHED' ? 'bg-emerald-600 border-emerald-500 text-white' : 'text-slate-500 border-white/5'
                          }`}
                        >
                          انتشار فوری
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryStatus('DRAFT')}
                          className={`px-4 py-2 text-xs font-black rounded-xl border ${
                            entryStatus === 'DRAFT' ? 'bg-amber-600 border-amber-500 text-white' : 'text-slate-500 border-white/5'
                          }`}
                        >
                          ذخیره پیش‌نویس
                        </button>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="bg-teal-600 hover:bg-teal-500 text-white font-black text-xs px-6 py-3.5 rounded-2xl active:scale-95 transition-all"
                        >
                          ثبت مدخل کاتالوگ
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddEntry(false)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-6 py-3.5 rounded-2xl transition-all"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEO Suite & Persian Content Auditor */}
          {activeTab === 'seo' && (
            <div className="space-y-8 animate-fade-in">
              <PersianSEOAuditor />

              {/* Semrush Keyword Rank Tracker Dashboard */}
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2 pb-4 border-b border-white/5">
                  <TrendingUp className="text-indigo-400" size={20} />
                  شبیه‌ساز و ردیاب کلمات کلیدی گوگل (Google Keyword Rank Tracker)
                </h3>

                <form onSubmit={handleAddKeyword} className="bg-slate-950/60 p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-[10px] text-slate-400 font-bold pr-2">کلمه کلیدی هدف برای ردیابی رتبه</label>
                    <input
                      type="text"
                      placeholder="مانند: چاپ هولوگرام در تهران"
                      value={newKeyword}
                      onChange={e => setNewKeyword(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-48">
                    <label className="text-[10px] text-slate-400 font-bold pr-2">سرچ ولوم ماهانه گوگل</label>
                    <input
                      type="number"
                      value={newKeywordVolume}
                      onChange={e => setNewKeywordVolume(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-center font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-6 py-4 rounded-xl active:scale-95 transition-all mt-6 w-full md:w-auto"
                  >
                    افزودن کلمه کلیدی
                  </button>
                </form>

                {/* Keyword list */}
                {seoKeywords.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs font-bold">
                    هیچ کلمه کلیدی در حال ردیابی نیست. عبارتی را وارد نمایید.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-slate-400 font-black">
                          <th className="pb-4 pr-4">کلمه کلیدی ردیابی شده</th>
                          <th className="pb-4 text-center">جستجوی ماهانه (Volume)</th>
                          <th className="pb-4 text-center">سختی کیورد (KD)</th>
                          <th className="pb-4 text-center">رتبه در نتایج گوگل</th>
                          <th className="pb-4 text-center">تغییر رتبه</th>
                          <th className="pb-4 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs font-bold">
                        {seoKeywords.map(kw => {
                          const diff = kw.previousPosition - kw.currentPosition;
                          return (
                            <tr key={kw.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-4 pr-4 text-white font-black">{kw.keyword}</td>
                              <td className="py-4 text-center font-mono">{toPersianDigits(kw.volume.toLocaleString())}</td>
                              <td className="py-4 text-center font-mono">
                                <span className={`px-2.5 py-1 rounded-lg ${
                                  kw.difficulty > 50 ? 'bg-rose-500/10 text-rose-400' : kw.difficulty > 30 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  {toPersianDigits(kw.difficulty)}%
                                </span>
                              </td>
                              <td className="py-4 text-center font-mono text-teal-400 text-sm font-black">
                                #{toPersianDigits(kw.currentPosition)}
                              </td>
                              <td className="py-4 text-center font-mono text-sm">
                                {diff > 0 ? (
                                  <span className="text-emerald-400">▲ +{toPersianDigits(diff)}</span>
                                ) : diff < 0 ? (
                                  <span className="text-rose-400">▼ {toPersianDigits(diff)}</span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="py-4 text-center">
                                <button
                                  onClick={() => deleteSeoKeyword(kw.id)}
                                  className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-xl transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HubSpot-style B2B CRM Pipeline & Print Calculator */}
          {activeTab === 'crm' && (
            <div className="space-y-8 animate-fade-in">
              <PrintCalculator />

              {/* B2B Pipelines deal board */}
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2 pb-4 border-b border-white/5">
                  <Users className="text-teal-400" size={20} />
                  خط لوله استعلامات B2B و کاریابی بسته‌بندی (Sales Deal Pipeline)
                </h3>

                {/* Board Layout */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-w-[900px]">
                  {/* Columns */}
                  {(['INQUIRY', 'QUOTATION', 'CONTRACT', 'INVOICE', 'LOST'] as const).map(stage => {
                    const stageLeads = leads.filter(l => l.status === stage);
                    const stageNames = {
                      INQUIRY: '۱. استعلام اولیه',
                      QUOTATION: '۲. برآورد قیمت',
                      CONTRACT: '۳. تایید فرم و قالب',
                      INVOICE: '۴. فاکتور شده (موفق)',
                      LOST: '۵. عدم همکاری (Lost)'
                    };
                    const stageColors = {
                      INQUIRY: 'border-t-indigo-500',
                      QUOTATION: 'border-t-amber-500',
                      CONTRACT: 'border-t-teal-500',
                      INVOICE: 'border-t-emerald-500',
                      LOST: 'border-t-rose-500'
                    };

                    return (
                      <div key={stage} className={`bg-slate-950/40 border border-white/5 border-t-4 ${stageColors[stage]} rounded-3xl p-4 min-h-[350px] space-y-4`}>
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                          <span className="text-[11px] font-black text-slate-300">{stageNames[stage]}</span>
                          <span className="text-[10px] font-black bg-slate-900 px-2 py-0.5 rounded text-slate-500 font-mono">
                            {toPersianDigits(stageLeads.length)}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {stageLeads.map(lead => (
                            <div key={lead.id} className="bg-slate-900/80 border border-white/5 p-4 rounded-2xl space-y-3 shadow-sm hover:border-teal-500/20 transition-all">
                              <div>
                                <h5 className="text-[11px] font-black text-white truncate">{lead.name}</h5>
                                <p className="text-[9px] text-slate-500 truncate mt-0.5">{lead.company || 'شخص حقیقی'}</p>
                              </div>

                              {lead.calculatorConfig && (
                                <div className="text-[8px] bg-slate-950 p-2 rounded-lg text-slate-400 font-bold space-y-1">
                                  <div>جعبه {lead.calculatorConfig.paperType} ({lead.calculatorConfig.quantity} عدد)</div>
                                  <div className="text-teal-400 font-mono">{toPersianDigits(Math.round(lead.dealValue / 10).toLocaleString())} تومان</div>
                                </div>
                              )}

                              {/* Stage movement actions */}
                              <div className="flex justify-between items-center pt-2 border-t border-white/5 gap-1.5">
                                <select
                                  value={lead.status}
                                  onChange={e => updateLead(lead.id, { status: e.target.value as any })}
                                  className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[8px] text-slate-400 font-bold outline-none flex-1"
                                >
                                  <option value="INQUIRY">استعلام</option>
                                  <option value="QUOTATION">پیش‌فاکتور</option>
                                  <option value="CONTRACT">قرارداد</option>
                                  <option value="INVOICE">موفق</option>
                                  <option value="LOST">ناموفق</option>
                                </select>

                                {stage !== 'INVOICE' && (
                                  <button
                                    onClick={() => setLeadToBridge(lead)}
                                    title="تبدیل لید به فاکتور رسمی"
                                    className="bg-teal-600/20 text-teal-400 hover:bg-teal-600 hover:text-white p-1 rounded transition-colors"
                                  >
                                    <ArrowRightLeft size={10} />
                                  </button>
                                )}

                                <button
                                  onClick={() => deleteLead(lead.id)}
                                  className="text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-colors"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lead Bridging Confirmation Modal */}
              {leadToBridge && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 space-y-6">
                    <div className="w-12 h-12 bg-teal-500/10 text-teal-400 rounded-2xl flex items-center justify-center mx-auto">
                      <ArrowRightLeft size={24} />
                    </div>
                    <div className="text-center space-y-2">
                      <h4 className="text-lg font-black text-white">انتقال لید به حسابداری رسمی</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        آیا مایلید لید مربوط به مشتری <span className="text-teal-400 font-black">"{leadToBridge.name}"</span> را به عنوان فاکتور ثبت شده در حسابداری، مشتری و کالا به دفتر کل اشک قلم پیوند دهید؟
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => bridgeLeadToInvoice(leadToBridge)}
                        className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-3.5 rounded-xl text-xs"
                      >
                        بله، صادر شود
                      </button>
                      <button
                        onClick={() => setLeadToBridge(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Publisher & Headless API configs */}
          {activeTab === 'publisher' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Globe className="text-indigo-400" size={20} />
                    پیکربندی توزیع محتوا و انتشار خودکار (Social & Web Publisher)
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    پیوند کاتالوگ با کانال تلگرام، پیام‌رسان بله و سئو سایت عمومی
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bots settings */}
                  <div className="space-y-4 bg-slate-950/60 p-6 rounded-3xl border border-white/5">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Send className="text-teal-400" size={14} />
                      ربات پیام‌رسان‌ها (تلگرام و بله)
                    </h4>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold">توکن ربات تلگرام (Telegram Bot Token)</label>
                        <input
                          type="password"
                          value={publisherConfig.telegramBotToken}
                          onChange={e => updatePublisherConfig({ telegramBotToken: e.target.value })}
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-teal-500 font-mono text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold">شناسه کانال تلگرام (Channel Chat ID)</label>
                        <input
                          type="text"
                          value={publisherConfig.telegramChannelChatId}
                          onChange={e => updatePublisherConfig({ telegramChannelChatId: e.target.value })}
                          placeholder="@ashkghalam_channel"
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-teal-500 font-mono text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tg_en"
                          checked={publisherConfig.telegramEnabled}
                          onChange={e => updatePublisherConfig({ telegramEnabled: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500 bg-slate-950 border-white/5"
                        />
                        <label htmlFor="tg_en" className="text-xs text-slate-300 font-bold">انتشار خودکار در کانال تلگرام به هنگام انتشار مدخل</label>
                      </div>
                    </div>
                  </div>

                  {/* Public URLs & Sitemaps */}
                  <div className="space-y-4 bg-slate-950/60 p-6 rounded-3xl border border-white/5">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <Globe className="text-indigo-400" size={14} />
                      پیوندهای سئو سایت و خروجی موتورهای جستجو
                    </h4>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold">آدرس وب‌سایت عمومی (Public URL)</label>
                        <input
                          type="text"
                          value={publisherConfig.publicWebRootUrl}
                          onChange={e => updatePublisherConfig({ publicWebRootUrl: e.target.value })}
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-left"
                          dir="ltr"
                        />
                      </div>

                      {/* Display Sitemap URL */}
                      <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">لینک نقشه سایت پویا گوگل (XML Sitemap URL):</div>
                        <a
                          href={`${publisherConfig.publicWebRootUrl || 'https://ashkghalam.ir'}/marketing-api.php?action=sitemap`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-400 font-mono hover:underline truncate block pt-1"
                          dir="ltr"
                        >
                          {`${publisherConfig.publicWebRootUrl || 'https://ashkghalam.ir'}/marketing-api.php?action=sitemap`}
                        </a>
                      </div>

                      {/* Headless API Endpoint */}
                      <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">آدرس API عمومی بدون احراز هویت (Headless Public Feed):</div>
                        <a
                          href={`${publisherConfig.publicWebRootUrl || 'https://ashkghalam.ir'}/marketing-api.php?action=public_posts`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-teal-400 font-mono hover:underline truncate block pt-1"
                          dir="ltr"
                        >
                          {`${publisherConfig.publicWebRootUrl || 'https://ashkghalam.ir'}/marketing-api.php?action=public_posts`}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketingHub;
