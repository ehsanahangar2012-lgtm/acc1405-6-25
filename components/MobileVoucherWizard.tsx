import React, { useState, useMemo } from 'react';
import { 
  Package, ArrowRight, ArrowLeft, Check, UserPlus, QrCode, 
  Trash2, Plus, Camera, Image as ImageIcon, X, AlertTriangle, 
  MapPinned, Weight, ShoppingBag, Truck, UserCheck, CheckCircle2,
  FileText, HelpCircle, Save, Sparkles, Hash, Phone, Car
} from 'lucide-react';
import { Product, Person, Invoice, Voucher, VoucherItem, InvoiceType } from '../types';
import { toPersianDigits, formatCurrency, generateId, generateTrackingCode, getPersianDate, getPersianTime } from '../utils';
import { NumberInput } from './Shared';

interface LogisticsProfile {
  id: string;
  name: string;
  phone: string;
  vehicleNumber: string;
}

interface MobileVoucherWizardProps {
  products: Product[];
  people: Person[];
  invoices: Invoice[];
  logisticsProfiles: LogisticsProfile[];
  companies: any[];
  lastVoucherNumber: number;
  initialType?: 'IN' | 'OUT';
  onCancel: () => void;
  onSaveVoucher: (voucher: Voucher) => void;
  onAddPerson?: () => void;
  onAddProduct?: () => void;
  onScanBarcode?: () => void;
}

export const MobileVoucherWizard: React.FC<MobileVoucherWizardProps> = ({
  products,
  people,
  invoices,
  logisticsProfiles,
  companies,
  lastVoucherNumber,
  initialType = 'OUT',
  onCancel,
  onSaveVoucher,
  onAddPerson,
  onAddProduct,
  onScanBarcode,
}) => {
  // Wizard steps: 1: Party & Type, 2: Transport & Driver, 3: Items & Stock, 4: Proof & Finalize
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [showSmartGuide, setShowSmartGuide] = useState(false);

  // Form State
  const [voucherType, setVoucherType] = useState<'IN' | 'OUT'>(initialType);
  const [voucherPersonId, setVoucherPersonId] = useState('');
  const [voucherRelatedInvoiceId, setVoucherRelatedInvoiceId] = useState('');
  const [voucherDate, setVoucherDate] = useState(getPersianDate());
  
  // Transport State
  const [voucherSupervisor, setVoucherSupervisor] = useState('');
  const [voucherPhone, setVoucherPhone] = useState('');
  const [voucherVehicle, setVoucherVehicle] = useState({ part1: '', part2: 'ب', part3: '', part4: '' });
  const [showDriverRecall, setShowDriverRecall] = useState(false);

  // Items State
  const [voucherItems, setVoucherItems] = useState<VoucherItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Proof & Status State
  const [voucherStatus, setVoucherStatus] = useState<'PENDING' | 'IN_TRANSIT' | 'DELIVERED'>('PENDING');
  const [voucherTracking, setVoucherTracking] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState<string[]>([]);

  // Validation errors for current step
  const [stepError, setStepError] = useState<string | null>(null);

  // Related Invoices
  const availableInvoices = useMemo(() => {
    if (!voucherPersonId) return [];
    const targetType = voucherType === 'OUT' ? InvoiceType.SALE : InvoiceType.PURCHASE;
    return invoices.filter(inv => inv.personId === voucherPersonId && inv.type === targetType);
  }, [invoices, voucherPersonId, voucherType]);

  // Calculations
  const stats = useMemo(() => {
    let totalWeight = 0;
    let estimatedValue = 0;
    voucherItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const qty = item.quantity || 0;
      const weight = item.weight || prod?.weight || 0;
      totalWeight += qty * weight;
      const price = prod?.price || 0;
      estimatedValue += qty * price;
    });
    return { totalWeight, estimatedValue };
  }, [voucherItems, products]);

  // Recall Driver
  const handleRecallDriver = (lp: LogisticsProfile) => {
    setVoucherSupervisor(lp.name);
    setVoucherPhone(lp.phone);
    if (lp.vehicleNumber) {
      const parts = lp.vehicleNumber.split(' ');
      if (parts.length >= 4) {
        setVoucherVehicle({
          part1: parts[0] || '',
          part2: parts[1] || 'ب',
          part3: parts[2] || '',
          part4: parts[3] || ''
        });
      }
    }
    setShowDriverRecall(false);
  };

  // Step Validation & Navigation
  const goToNextStep = () => {
    setStepError(null);
    if (currentStep === 1) {
      if (!voucherPersonId) {
        setStepError('لطفاً ابتدا شخص تحویل‌گیرنده یا طرف حساب را انتخاب کنید.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Driver details are optional or recommended
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (voucherItems.length === 0) {
        setStepError('لطفاً حداقل یک قلم کالا به حواله اضافه کنید.');
        return;
      }
      setCurrentStep(4);
    }
  };

  const goToPrevStep = () => {
    setStepError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any);
    } else {
      onCancel();
    }
  };

  // Add Item to Voucher
  const addItem = (product: Product) => {
    const existingIndex = voucherItems.findIndex(i => i.productId === product.id);
    if (existingIndex > -1) {
      const updated = [...voucherItems];
      updated[existingIndex].quantity += 1;
      setVoucherItems(updated);
    } else {
      setVoucherItems([
        ...voucherItems,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unit: product.unit || 'عدد',
          weight: product.weight || 0,
          shelfLocation: product.shelfLocation || ''
        }
      ]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  };

  // Update item quantity
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...voucherItems];
    const newQty = Math.max(1, updated[index].quantity + delta);
    updated[index].quantity = newQty;
    setVoucherItems(updated);
  };

  // Update item shelf
  const updateShelf = (index: number, shelf: string) => {
    const updated = [...voucherItems];
    updated[index].shelfLocation = shelf;
    setVoucherItems(updated);
  };

  // Remove item
  const removeItem = (index: number) => {
    setVoucherItems(voucherItems.filter((_, i) => i !== index));
  };

  // Handle Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            setLoadingPhotos(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Final Submit
  const handleFinalSubmit = () => {
    if (!voucherPersonId || voucherItems.length === 0) {
      setStepError('اطلاعات طرف حساب و اقلام الزامی است.');
      return;
    }

    const person = people.find(p => p.id === voucherPersonId);
    const fullPlate = `${voucherVehicle.part1} ${voucherVehicle.part2} ${voucherVehicle.part3} ${voucherVehicle.part4}`.trim();
    const nextNum = lastVoucherNumber + 1;
    const activeCompany = companies.find(c => c.isActive) || companies[0];

    const sortedItems = [...voucherItems].sort((a, b) => (a.shelfLocation || '').localeCompare(b.shelfLocation || ''));

    const newVoucher: Voucher = {
      id: generateId(),
      companyId: activeCompany?.id || 'default',
      number: nextNum,
      trackingCode: voucherTracking || generateTrackingCode('VCH', nextNum, voucherDate),
      date: voucherDate,
      time: getPersianTime(),
      type: voucherType,
      personId: voucherPersonId,
      personName: person?.name || 'ناشناس',
      relatedInvoiceId: voucherRelatedInvoiceId || undefined,
      supervisor: voucherSupervisor || undefined,
      vehicleNumber: fullPlate || undefined,
      receiverPhone: voucherPhone || undefined,
      items: sortedItems,
      totalWeight: stats.totalWeight,
      estimatedValue: stats.estimatedValue,
      loadingPhotos: loadingPhotos,
      notes: voucherNotes || undefined,
      status: voucherStatus
    };

    onSaveVoucher(newVoucher);
  };

  // Steps definition
  const steps = [
    { num: 1, label: 'طرف حساب و نوع' },
    { num: 2, label: 'ناوگان و راننده' },
    { num: 3, label: 'اقلام و کالاها' },
    { num: 4, label: 'تایید و صدور' },
  ];

  const selectedPerson = people.find(p => p.id === voucherPersonId);

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1527] text-slate-100 font-sans pb-32 animate-fade-in" dir="rtl">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#0d1527]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={goToPrevStep}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl active:scale-95 transition-all"
              title={currentStep === 1 ? 'انصراف' : 'مرحله قبل'}
            >
              <ArrowRight size={20} />
            </button>
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                <span>صدور مرحله‌ای حواله</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  voucherType === 'OUT' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {voucherType === 'OUT' ? 'خروج از انبار' : 'ورود به انبار'}
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                گام {toPersianDigits(currentStep)} از ۴: {steps[currentStep - 1].label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Smart Guide Button */}
            <button
              onClick={() => setShowSmartGuide(true)}
              className="w-9 h-9 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center transition-all shadow-sm active:scale-90"
              title="راهنمای هوشمند ویزارد حواله"
            >
              <HelpCircle size={18} />
            </button>
            <button
              onClick={onCancel}
              className="p-2 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-all text-xs font-bold"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="mt-3">
          <div className="grid grid-cols-4 gap-1.5 mb-1.5">
            {steps.map((s) => {
              const isDone = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex flex-col items-center">
                  <div 
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      isDone 
                        ? 'bg-teal-400' 
                        : isCurrent 
                          ? 'bg-gradient-to-r from-teal-500 to-indigo-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]' 
                          : 'bg-white/10'
                    }`}
                  />
                  <span className={`text-[9px] mt-1 font-bold truncate max-w-full ${
                    isCurrent ? 'text-teal-300 font-black' : isDone ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Error alert */}
      {stepError && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-rose-400 text-xs font-bold animate-shake">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* STEP 1: Party & Type */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fade-in">
            {/* Voucher Type Toggle */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl">
              <label className="text-xs text-slate-400 font-bold block mb-2">نوع حواله انبارداری</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVoucherType('OUT')}
                  className={`py-3.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    voucherType === 'OUT'
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-600/30 scale-[1.02]'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowRight size={16} />
                  <span>خروج کالا (ارسال/فروش)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherType('IN')}
                  className={`py-3.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    voucherType === 'IN'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowLeft size={16} />
                  <span>ورود کالا (رسید/خرید)</span>
                </button>
              </div>
            </div>

            {/* Party Selector */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-300 font-black">
                  {voucherType === 'OUT' ? 'تحویل‌گیرنده / خریدار' : 'تامین‌کننده / فروشنده'} <span className="text-rose-400">*</span>
                </label>
                {onAddPerson && (
                  <button 
                    onClick={onAddPerson}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-xl"
                  >
                    <UserPlus size={13} /> + ثبت سریع شخص
                  </button>
                )}
              </div>

              <select
                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold shadow-inner outline-none focus:border-teal-500 transition-colors"
                value={voucherPersonId}
                onChange={(e) => {
                  setVoucherPersonId(e.target.value);
                  setVoucherRelatedInvoiceId('');
                  setStepError(null);
                }}
              >
                <option value="">-- انتخاب طرف حساب از لیست --</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${toPersianDigits(p.phone)})` : ''}</option>
                ))}
              </select>

              {selectedPerson && (
                <div className="bg-teal-500/10 border border-teal-500/20 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-teal-400" />
                    <span className="font-black text-white">{selectedPerson.name}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{toPersianDigits(selectedPerson.phone || '')}</span>
                </div>
              )}
            </div>

            {/* Related Invoice Selector */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-bold">اتصال به فاکتور مرتبط (اختیاری)</label>
                {availableInvoices.length > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    {toPersianDigits(availableInvoices.length)} فاکتور در دسترس
                  </span>
                )}
              </div>

              <select
                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3.5 text-white text-xs font-bold outline-none focus:border-amber-500 disabled:opacity-50"
                value={voucherRelatedInvoiceId}
                onChange={(e) => setVoucherRelatedInvoiceId(e.target.value)}
                disabled={!voucherPersonId}
              >
                <option value="">-- بدون اتصال به فاکتور --</option>
                {availableInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    فاکتور شماره {toPersianDigits(inv.number)} ({toPersianDigits(inv.date)}) - {formatCurrency(inv.finalTotal)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                در صورت انتخاب فاکتور، حواله صادره مستقیماً در پرونده مالی فاکتور ثبت خواهد شد.
              </p>
            </div>

            {/* Date Input */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">تاریخ ثبت حواله:</span>
              <span className="text-sm font-mono font-black text-teal-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5">
                {toPersianDigits(voucherDate)}
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Transport & Fleet */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-300 font-black flex items-center gap-1.5">
                  <Truck size={16} className="text-indigo-400" />
                  <span>نام مباشر حمل یا راننده</span>
                </label>
                {logisticsProfiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDriverRecall(!showDriverRecall)}
                    className="text-xs text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    فراخوانی راننده ({toPersianDigits(logisticsProfiles.length)})
                  </button>
                )}
              </div>

              {/* Recall Dropdown for Mobile */}
              {showDriverRecall && (
                <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-2 space-y-1 shadow-2xl max-h-44 overflow-y-auto">
                  <div className="text-[10px] text-slate-500 font-bold px-2 py-1">رانندگان اخیر:</div>
                  {logisticsProfiles.map(lp => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => handleRecallDriver(lp)}
                      className="w-full text-right p-2.5 rounded-xl hover:bg-white/10 flex justify-between items-center text-xs font-bold transition-all"
                    >
                      <span className="text-white">{lp.name}</span>
                      <span className="text-[10px] font-mono text-indigo-400">{lp.vehicleNumber}</span>
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                placeholder="مثال: علی محمدی"
                value={voucherSupervisor}
                onChange={e => setVoucherSupervisor(e.target.value)}
              />

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-2 flex items-center gap-1">
                  <Phone size={14} className="text-slate-500" />
                  <span>شماره تماس راننده</span>
                </label>
                <input
                  type="tel"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-sm font-mono outline-none focus:border-indigo-500 transition-colors text-left"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={voucherPhone}
                  onChange={e => setVoucherPhone(e.target.value)}
                />
              </div>

              {/* Iranian Plate Input */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-2 flex items-center gap-1">
                  <Car size={14} className="text-slate-500" />
                  <span>پلاک هوشمند خودرو</span>
                </label>
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-1.5" dir="ltr">
                  <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-1 rounded">ایران</span>
                  <input
                    type="text"
                    maxLength={2}
                    className="w-12 bg-white/5 border border-white/10 rounded-xl p-2.5 text-center font-mono font-black text-white text-sm outline-none focus:border-indigo-500"
                    placeholder="۶۸"
                    value={voucherVehicle.part4}
                    onChange={e => setVoucherVehicle({ ...voucherVehicle, part4: e.target.value.slice(0, 2) })}
                  />
                  <input
                    type="text"
                    maxLength={3}
                    className="w-16 bg-white/5 border border-white/10 rounded-xl p-2.5 text-center font-mono font-black text-white text-sm outline-none focus:border-indigo-500"
                    placeholder="۳۴۵"
                    value={voucherVehicle.part3}
                    onChange={e => setVoucherVehicle({ ...voucherVehicle, part3: e.target.value.slice(0, 3) })}
                  />
                  <select
                    className="w-14 bg-white/5 border border-white/10 rounded-xl p-2 text-center font-black text-white text-xs outline-none focus:border-indigo-500"
                    value={voucherVehicle.part2}
                    onChange={e => setVoucherVehicle({ ...voucherVehicle, part2: e.target.value })}
                  >
                    {['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'د', 'ر', 'ز', 'س', 'ش', 'ص', 'ط', 'ع', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    maxLength={2}
                    className="w-12 bg-white/5 border border-white/10 rounded-xl p-2.5 text-center font-mono font-black text-white text-sm outline-none focus:border-indigo-500"
                    placeholder="۱۲"
                    value={voucherVehicle.part1}
                    onChange={e => setVoucherVehicle({ ...voucherVehicle, part1: e.target.value.slice(0, 2) })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-3xl text-xs text-indigo-300 leading-relaxed">
              💡 تکمیل اطلاعات راننده باعث صدور خودکار بارنامه دیجیتال و امکان ارسال پیامک کد رهگیری به مباشر حمل می‌شود.
            </div>
          </div>
        )}

        {/* STEP 3: Items & Stock */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Action Bar for Adding items */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-3.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all"
              >
                <Plus size={18} />
                <span>+ انتخاب کالا از انبار</span>
              </button>

              {onScanBarcode && (
                <button
                  type="button"
                  onClick={onScanBarcode}
                  className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 p-3.5 rounded-2xl active:scale-95 transition-all"
                  title="اسکن بارکد کالا"
                >
                  <QrCode size={20} />
                </button>
              )}

              {onAddProduct && (
                <button
                  type="button"
                  onClick={onAddProduct}
                  className="bg-white/5 text-slate-300 border border-white/10 p-3.5 rounded-2xl active:scale-95 transition-all"
                  title="تعریف کالای جدید"
                >
                  <Package size={20} />
                </button>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/80 border border-white/10 p-3 rounded-2xl">
              <div className="text-center border-l border-white/5">
                <span className="text-[9px] text-slate-400 font-bold block">تعداد اقلام</span>
                <span className="text-sm font-black font-mono text-teal-400">{toPersianDigits(voucherItems.length)} قلم</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-slate-400 font-bold block">وزن کل تخمینی</span>
                <span className="text-sm font-black font-mono text-amber-400">{toPersianDigits(stats.totalWeight)} کیلوگرم</span>
              </div>
            </div>

            {/* Item Cards List */}
            <div className="space-y-3">
              {voucherItems.map((item, idx) => {
                const prod = products.find(p => p.id === item.productId);
                const isLowStock = prod && voucherType === 'OUT' && prod.stock < item.quantity;

                return (
                  <div 
                    key={idx}
                    className={`bg-slate-900/90 border-2 ${
                      isLowStock ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/10'
                    } p-4 rounded-3xl shadow-xl space-y-3 relative group`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm truncate">{item.productName}</h4>
                          {isLowStock && (
                            <span className="text-[9px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <AlertTriangle size={10} /> کسری انبار
                            </span>
                          )}
                        </div>
                        {prod && (
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                            <span>موجودی: <strong className="font-mono text-teal-400">{toPersianDigits(prod.stock)}</strong> {item.unit}</span>
                            {prod.weight ? <span>وزن واحد: <strong className="font-mono">{toPersianDigits(prod.weight)}</strong> kg</span> : null}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                        title="حذف این قلم"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      {/* Quantity Stepper */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">تعداد ({item.unit})</label>
                        <div className="flex items-center bg-slate-950 border border-white/10 rounded-xl overflow-hidden p-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, 1)}
                            className="w-8 h-8 rounded-lg bg-teal-600/30 text-teal-300 flex items-center justify-center active:scale-90 transition-all font-bold"
                          >
                            +
                          </button>
                          <span className="flex-1 text-center font-mono font-black text-white text-sm">
                            {toPersianDigits(item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, -1)}
                            className="w-8 h-8 rounded-lg bg-white/5 text-slate-300 flex items-center justify-center active:scale-90 transition-all font-bold"
                          >
                            -
                          </button>
                        </div>
                      </div>

                      {/* Shelf Location */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">شماره قفسه/انبار</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-white font-mono text-center text-xs outline-none focus:border-teal-500"
                          placeholder="مثلاً A-12"
                          value={item.shelfLocation || ''}
                          onChange={(e) => updateShelf(idx, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {voucherItems.length === 0 && (
                <div className="py-12 px-4 text-center border-2 border-dashed border-white/10 rounded-3xl space-y-3">
                  <ShoppingBag size={40} className="mx-auto text-slate-600" />
                  <p className="text-xs text-slate-400 font-bold">هنوز هیچ کالایی به این حواله افزوده نشده است.</p>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(true)}
                    className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg"
                  >
                    + انتخاب کالا از انبار
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Proof, Finalize & Notes */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-fade-in">
            {/* Status & Tracking */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-black block mb-2">وضعیت ابتدایی حواله</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3.5 text-white text-xs font-bold outline-none focus:border-teal-500"
                  value={voucherStatus}
                  onChange={e => setVoucherStatus(e.target.value as any)}
                >
                  <option value="PENDING">در انتظار خروج / آماده‌سازی</option>
                  <option value="IN_TRANSIT">در حال حمل توسط ناوگان</option>
                  <option value="DELIVERED">تحویل نهایی گردیده</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs text-slate-300 font-black">کد رهگیری حواله</label>
                  <button
                    type="button"
                    onClick={() => setVoucherTracking(generateTrackingCode('VCH', lastVoucherNumber + 1, voucherDate))}
                    className="text-[10px] text-teal-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <Sparkles size={12} /> تولید خودکار
                  </button>
                </div>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3 text-white text-xs font-mono outline-none focus:border-teal-500"
                  placeholder="VCH-..."
                  value={voucherTracking}
                  onChange={e => setVoucherTracking(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-black block mb-2">توضیحات و دستورات بارگیری</label>
                <textarea
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3.5 text-white text-xs outline-none focus:border-teal-500 h-24 resize-none leading-relaxed"
                  placeholder="نکات مربوط به نحوه بسته‌بندی، امضا یا شرایط تخلیه بار..."
                  value={voucherNotes}
                  onChange={e => setVoucherNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Proof of Loading Photos */}
            <div className="bg-slate-900/80 border border-white/10 p-4 rounded-3xl shadow-xl space-y-3">
              <label className="text-xs text-slate-300 font-black flex items-center gap-2">
                <Camera size={16} className="text-blue-400" />
                <span>تصاویر بارگیری (Proof of Loading)</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {loadingPhotos.map((photo, i) => (
                  <div key={i} className="aspect-square bg-slate-950 rounded-2xl overflow-hidden border border-white/10 relative group">
                    <img src={photo} alt="بارگیری" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLoadingPhotos(loadingPhotos.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-90 shadow-md"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <label className="aspect-square bg-white/5 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-all">
                  <Camera size={22} className="mb-1" />
                  <span className="text-[9px] font-black">+ عکس بار</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </div>

            {/* Summary Review Card */}
            <div className="bg-gradient-to-br from-teal-900/30 to-indigo-900/30 border border-teal-500/30 p-4 rounded-3xl shadow-2xl space-y-2 text-xs">
              <h4 className="font-black text-white text-sm flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-teal-400" />
                <span>خلاصه نهایی حواله</span>
              </h4>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">طرف حساب:</span>
                <span className="font-black text-white">{selectedPerson?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">تعداد اقلام:</span>
                <span className="font-mono font-black text-teal-300">{toPersianDigits(voucherItems.length)} قلم</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">وزن کل:</span>
                <span className="font-mono font-black text-amber-300">{toPersianDigits(stats.totalWeight)} kg</span>
              </div>
              {voucherSupervisor && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">مباشر حمل:</span>
                  <span className="font-black text-white">{voucherSupervisor}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Controls - Thumb friendly */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d1527]/95 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={goToPrevStep}
              className="py-4 px-6 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0"
            >
              <ArrowRight size={16} />
              <span>مرحله قبل</span>
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={goToNextStep}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-teal-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>مرحله بعد: {steps[currentStep].label}</span>
              <ArrowLeft size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-teal-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              <span>تایید و صدور نهایی حواله</span>
            </button>
          )}
        </div>
      </footer>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Package size={18} className="text-teal-400" />
                <span>انتخاب کالا از انبار</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-3">
              <input
                type="text"
                placeholder="جستجوی نام کالا، کد یا قفسه..."
                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3.5 text-white text-xs outline-none focus:border-teal-500"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
              {products
                .filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) || (p.code || '').toLowerCase().includes(productSearch.toLowerCase()))
                .map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addItem(prod)}
                    className="w-full text-right p-3.5 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all flex items-center justify-between group active:scale-[0.98]"
                  >
                    <div>
                      <div className="font-black text-white text-xs">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        موجودی: <strong className="text-teal-400 font-mono">{toPersianDigits(prod.stock)}</strong> {prod.unit}
                        {prod.shelfLocation ? ` | قفسه: ${prod.shelfLocation}` : ''}
                      </div>
                    </div>
                    <span className="p-2 bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-white rounded-xl transition-all">
                      <Plus size={16} />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Smart Guide Modal for Wizard */}
      {showSmartGuide && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-teal-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-teal-400">
                <HelpCircle size={22} />
                <h3 className="font-black text-white text-base">راهنمای هوشمند صدور حواله موبایل</h3>
              </div>
              <button onClick={() => setShowSmartGuide(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <strong className="text-teal-300 block mb-1">گام اول - انتخاب طرف حساب:</strong>
                تعیین نوع حواله (ورود کالا جهت شارژ انبار یا خروج کالا به منظور تحویل به مشتری) و اتصال به فاکتورهای باز.
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <strong className="text-indigo-300 block mb-1">گام دوم - ناوگان و راننده:</strong>
                امکان فراخوانی رانندگان پیشین و درج پلاک هوشمند جهت رهگیری محموله و ثبت بارنامه الکترونیک.
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <strong className="text-amber-300 block mb-1">گام سوم - لیست اقلام:</strong>
                افزودن سریع کالا، پایش موجودی لحظه‌ای و اختصاص شماره قفسه انبار با دکمه‌های کنترلی بزرگ لمسی.
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <strong className="text-emerald-300 block mb-1">گام چهارم - تایید و تصویر بارگیری:</strong>
                ثبت تصویر محموله در بارگیری و صدور نهایی سند حواله با تولید خودکار بارکد و کد رهگیری یکتا.
              </div>
            </div>

            <button
              onClick={() => setShowSmartGuide(false)}
              className="w-full bg-teal-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileVoucherWizard;
