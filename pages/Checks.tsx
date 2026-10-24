
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { Check, CheckTransfer, IRANIAN_BANKS, Person } from '../types';
import { CameraGuide } from '../components/CameraGuide';
import { CheckAlerts, CashFlowForecast } from '../components/SmartFeatures';
import { fileToBase64, formatCurrency, toPersianDigits, generateId, getPersianDate, generateTrackingCode, getNextCustomerCode } from '../utils';
import { 
    Camera, CheckCircle2, RefreshCw, Eye, ArrowRight, Printer, Search, Filter, 
    Trash2, Star, Link as LinkIcon, X, Plus, Save, PenTool, ShieldCheck, 
    TrendingUp, AlertOctagon, History, ScanLine, ImagePlus, User, Fingerprint, Banknote,
    Share2, Undo2, Layers, RotateCw, ZoomIn, ZoomOut, Sun, Contrast, Crop,
    Calculator, Landmark, CornerDownLeft, Bell, MessageSquare, AlertTriangle, FileText,
    Move, ImageIcon, List, LayoutGrid, Info, ArrowLeft, UserCheck, Bot, Calendar as CalendarIcon, Copy, MessageCircle, Upload
} from 'lucide-react';
import { NumberInput, JalaliDatePicker, ConfirmModal, FullScreenSignatureModal } from '../components/Shared';
import { PrintTemplate } from '../components/PrintTemplates';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { OfflineOcrEngine } from '../services/offlineOcrEngine';
import { CameraService } from '../services/cameraService';
import JalaliDueCalendar from '../components/JalaliDueCalendar';

const STATUS_CONFIG: any = {
    'PENDING': { label: 'نزد صندوق', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Landmark },
    'DEPOSITED': { label: 'خواباندن به حساب', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Landmark },
    'PASSED': { label: 'وصول شده', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    'BOUNCED': { label: 'برگشت خورده', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: AlertOctagon },
    'TRANSFERRED': { label: 'خرج شده (واگذار)', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: ArrowRight },
    'CASHED': { label: 'نقد شده', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: Banknote },
    'RETURNED': { label: 'عودتی', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Undo2 },
};

const Checks = () => {
  const { checks, addCheck, updateCheckStatus, updateCheckImage, updateCheckMetadata, people, addPerson, addCheckTransfer, updateCheckTransfer, deleteCheckTransfer, checkTransfers, lastTransferNumber, companies, currentUser, invoices } = useStore();
  
  const [mainTab, setMainTab] = useState<'CHECKS' | 'TRANSFERS'>('CHECKS');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'calendar'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signingTransferId, setSigningTransferId] = useState<string | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [ocrEngine, setOcrEngine] = useState<'auto' | 'tesseract' | 'gemini'>('auto');
  const batchInputRef = useRef<HTMLInputElement>(null);
  
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null);
  
  // Batch Entry State
  const [batchChecks, setBatchChecks] = useState<Partial<Check>[]>([]);
  const [batchPayerId, setBatchPayerId] = useState('');
  
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [previewCheckImage, setPreviewCheckImage] = useState<string | null>(null);
  const [activeCheckPrint, setActiveCheckPrint] = useState<Check | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferSignature, setTransferSignature] = useState<string | null>(null);
  
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const activeTransfer = useMemo(() => checkTransfers.find(t => t.id === activeTransferId) || null, [checkTransfers, activeTransferId]);

  const [editorState, setEditorState] = useState({ brightness: 100, contrast: 100, zoom: 0.5, x: 0, y: 0, rotation: 0 });
  const editorImgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailImageRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const selectedCheck = useMemo(() => checks.find(c => c.id === selectedCheckId) || null, [checks, selectedCheckId]);
  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    const transferId = params.get('transfer');
    if (viewId) {
      const check = checks.find(c => c.id === viewId);
      if (check) { setSelectedCheckId(check.id); setShowDetailModal(true); }
    } else if (transferId) {
      setMainTab('TRANSFERS');
      const transfer = checkTransfers.find(t => t.id === transferId);
      if (transfer) { setActiveTransferId(transfer.id); setShowPrintPreview(true); }
    }
  }, [checks, checkTransfers]);

  const stats = useMemo(() => {
      const pending = checks.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.amount, 0);
      const passed = checks.filter(c => c.status === 'PASSED').reduce((s, c) => s + c.amount, 0);
      return { pending, passed };
  }, [checks]);

  const confirmTransfer = () => {
      const idsToTransfer = selectedIds.length > 0 ? selectedIds : (selectedCheckId ? [selectedCheckId] : []);
      if (idsToTransfer.length === 0) return alert('هیچ چکی انتخاب نشده است.');
      const person = people.find(p => p.id === transferTargetId);
      if (!person) return alert('گیرنده را انتخاب کنید.');
      const nextNum = lastTransferNumber + 1;
      const transferItems = idsToTransfer.map(id => {
          const c = checks.find(x => x.id === id);
          if (!c) return null;
          return { bankName: c.bankName, sayadId: c.sayadId, amount: c.amount, dueDate: c.dueDate, imageUrl: c.imageUrl };
      }).filter(Boolean);
      const transferObj: CheckTransfer = {
          id: generateId(), companyId: companies.find(c => c.isActive)?.id || 'default', 
          number: nextNum, date: getPersianDate(),
          personId: person.id, personName: person.name, nationalId: person.nationalId,
          trackingCode: generateTrackingCode('TRF', nextNum, getPersianDate()),
          checkIds: [...idsToTransfer], signature: transferSignature || undefined, 
          description: transferDesc, items: transferItems, status: 'PENDING'
      };
      
      // Store will handle the accounting transaction creation automatically
      addCheckTransfer(transferObj);
      
      setActiveTransferId(transferObj.id); setShowTransferModal(false); setSelectedIds([]); setShowDetailModal(false); setShowPrintPreview(true);
      setTransferSignature(null); setTransferDesc(''); setTransferTargetId('');
  };

  const handleShareLink = async (trId: string) => {
      try {
          const tr = checkTransfers.find(t => t.id === trId);
          if (!tr) return;
          const token = await simpleSignatureService.createRequest(trId, 'CHECK_TRANSFER', JSON.stringify(tr));
          const url = window.location.origin + window.location.pathname + `#/sign/${token}`;
          
          if (navigator.clipboard && window.isSecureContext) {
              try {
                  await navigator.clipboard.writeText(url);
                  alert('لینک امضای راه دور کپی شد.');
              } catch (copyErr) {
                  prompt('مرورگر اجازه کپی نداد. لینک را دستی کپی کنید:', url);
              }
          } else {
              prompt('لینک امضا (دستی کپی کنید):', url);
          }
      } catch (err) {
          console.error(err);
          alert('خطا در ایجاد لینک امضای راه دور.');
      }
  };

  const handleShareReceiptText = async (trId: string) => {
      try {
          const tr = checkTransfers.find(t => t.id === trId);
          if (!tr) return;
          const token = await simpleSignatureService.createRequest(trId, 'CHECK_TRANSFER', JSON.stringify(tr));
          const url = window.location.origin + window.location.pathname + `#/sign/${token}`;
          const txt = `
رسید واگذاری چک
گیرنده: ${tr.personName}
تاریخ: ${tr.date}
کد پیگیری: ${tr.trackingCode}
تعداد چک: ${tr.checkIds.length} فقره
مبلغ کل: ${formatCurrency(tr.items?.reduce((s:number, i:any)=>s+(i.amount||0),0))}

جهت مشاهده و امضای دیجیتال:
${url}
          `;
          if (navigator.clipboard && window.isSecureContext) {
              try {
                  await navigator.clipboard.writeText(txt);
                  alert('متن رسید کپی شد. می‌توانید در پیام‌رسان‌ها ارسال کنید.');
              } catch (copyErr) {
                  prompt('مرورگر اجازه کپی نداد. لینک را دستی کپی کنید:', url);
              }
          } else {
              prompt('لینک امضا (دستی کپی کنید):', url);
          }
      } catch (err) {
          console.error(err);
          alert('خطا در ایجاد لینک امضای راه دور.');
      }
  };

  const processAI = async () => {
      if (!rawImage) return;
      setIsProcessingAI(true);
      try {
          // پردازش با موتور هوشمند کاملاً آفلاین
          const extracted = await OfflineOcrEngine.processCheckOffline(rawImage);
          setBatchChecks([{
              id: generateId(),
              amount: extracted.amount || 0,
              bankName: extracted.bankName || '',
              sayadId: extracted.sayadId || '',
              holderName: extracted.holderName || '',
              dueDate: extracted.dueDate || getPersianDate(),
              imageUrl: rawImage
          }]);
          setShowImageEditor(false);
          setShowAddModal(true);
      } catch (e) {
          console.error('Offline OCR error:', e);
          setBatchChecks([{
              id: generateId(),
              amount: 0,
              bankName: '',
              sayadId: '',
              holderName: '',
              dueDate: getPersianDate(),
              imageUrl: rawImage
          }]);
          setShowImageEditor(false);
          setShowAddModal(true);
      } finally {
          setIsProcessingAI(false);
      }
  };

  const addEmptyCheckRow = () => {
      setBatchChecks([...batchChecks, { id: generateId(), amount: 0, bankName: '', sayadId: '', dueDate: getPersianDate() }]);
  };

  const handleQuickAddPerson = () => {
      if (!newPersonName.trim()) return;
      const id = generateId();
      addPerson({ id, name: newPersonName, phone: newPersonPhone, balance: 0, code: getNextCustomerCode(people) } as any);
      setBatchPayerId(id);
      setTransferTargetId(id);
      setNewPersonName('');
      setNewPersonPhone('');
      setShowAddPersonModal(false);
  };

  const handleRowImageUpload = async (idx: number, file: File) => {
      try {
          const b64 = await fileToBase64(file);
          const updated = [...batchChecks];
          updated[idx].imageUrl = b64;
          setBatchChecks(updated);

          // Attempt offline OCR extraction to auto-populate if fields are empty
          try {
              const res = await OfflineOcrEngine.processCheckOffline(b64);
              const refreshed = [...updated];
              if (res.sayadId && !refreshed[idx].sayadId) refreshed[idx].sayadId = res.sayadId;
              if (res.amount && !refreshed[idx].amount) refreshed[idx].amount = res.amount;
              if (res.bankName && !refreshed[idx].bankName) refreshed[idx].bankName = res.bankName;
              if (res.dueDate && !refreshed[idx].dueDate) refreshed[idx].dueDate = res.dueDate;
              setBatchChecks(refreshed);
          } catch {}
      } catch (err) {
          console.error("Error reading check image file:", err);
      }
  };

  const handleRowCameraCapture = async (idx: number) => {
      try {
          const b64 = await CameraService.capturePhoto({ quality: 90 });
          if (b64) {
              const updated = [...batchChecks];
              updated[idx].imageUrl = b64;
              setBatchChecks(updated);

              try {
                  const res = await OfflineOcrEngine.processCheckOffline(b64);
                  const refreshed = [...updated];
                  if (res.sayadId && !refreshed[idx].sayadId) refreshed[idx].sayadId = res.sayadId;
                  if (res.amount && !refreshed[idx].amount) refreshed[idx].amount = res.amount;
                  if (res.bankName && !refreshed[idx].bankName) refreshed[idx].bankName = res.bankName;
                  if (res.dueDate && !refreshed[idx].dueDate) refreshed[idx].dueDate = res.dueDate;
                  setBatchChecks(refreshed);
              } catch {}
          }
      } catch (err) {
          console.error("Camera capture error:", err);
      }
  };

  const saveBatchChecks = () => {
      if (batchChecks.length === 0) return;
      const payer = people.find(p => p.id === batchPayerId);
      
      batchChecks.forEach(c => {
          if (!c.amount || !c.bankName) return;
          addCheck({
              id: c.id || generateId(),
              status: 'PENDING',
              amount: c.amount!,
              bankName: c.bankName!,
              sayadId: c.sayadId || '',
              holderName: c.holderName || payer?.name || '',
              personId: batchPayerId,
              personName: payer?.name,
              dueDate: c.dueDate || getPersianDate(),
              imageUrl: c.imageUrl,
              description: c.description || '',
              isHighPriority: false
          }, batchPayerId);
      });
      setShowAddModal(false);
      setBatchChecks([]);
      setBatchPayerId('');
  };

  const handleBatchUpload = async (files: FileList) => {
      const images: string[] = [];
      for (let i = 0; i < files.length; i++) {
          const base64 = await fileToBase64(files[i]);
          images.push(base64);
      }
      
      setIsProcessingAI(true);
      setBatchProgress({ current: 0, total: images.length });

      const parsedList: Partial<Check>[] = [];
      for (let idx = 0; idx < images.length; idx++) {
          setBatchProgress({ current: idx + 1, total: images.length });
          const img = images[idx];
          try {
              const res = await OfflineOcrEngine.processCheckOffline(img);
              parsedList.push({
                  id: generateId(),
                  amount: res.amount || 0,
                  bankName: res.bankName || '',
                  sayadId: res.sayadId || '',
                  holderName: res.holderName || '',
                  dueDate: res.dueDate || getPersianDate(),
                  imageUrl: img
              });
          } catch {
              parsedList.push({
                  id: generateId(),
                  amount: 0,
                  bankName: '',
                  sayadId: '',
                  holderName: '',
                  dueDate: getPersianDate(),
                  imageUrl: img
              });
          }
      }

      setBatchChecks(parsedList);
      setIsProcessingAI(false);
      setBatchProgress({ current: 0, total: 0 });
      setShowAddModal(true);
  };

  const cropView = () => {
      if (!editorImgRef.current || !rawImage) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = editorImgRef.current;
      
      // Basic simulation of "Current View" cropping
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      if (ctx) {
          ctx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%)`;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((editorState.rotation * Math.PI) / 180);
          ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2);
          const croppedB64 = canvas.toDataURL('image/jpeg');
          
          if (selectedCheckId) {
              updateCheckImage(selectedCheckId, croppedB64);
              alert('تصویر چک بروزرسانی شد.');
              setShowImageEditor(false);
          } else {
              setBatchChecks([...batchChecks, { id: generateId(), imageUrl: croppedB64, amount: 0, bankName: '', sayadId: '', dueDate: getPersianDate() }]);
              setShowImageEditor(false);
              setShowAddModal(true);
          }
      }
  };

  const filteredChecks = useMemo(() => checks.filter(c => {
      const matchTab = statusFilter === 'ALL' ? true : c.status === statusFilter;
      const matchSearch = (c.sayadId || '').includes(searchTerm || '') || (c.holderName && (c.holderName || '').toLowerCase().includes((searchTerm || '').toLowerCase()));
      return matchTab && matchSearch;
  }).sort((a, b) => b.dueDate.localeCompare(a.dueDate)), [checks, statusFilter, searchTerm]);

  // Calendar Logic
  const calendarData = useMemo(() => {
      const days: any = {};
      filteredChecks.forEach(c => {
          if (!days[c.dueDate]) days[c.dueDate] = [];
          days[c.dueDate].push(c);
      });
      return days;
  }, [filteredChecks]);

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      <CheckAlerts />
      <CashFlowForecast />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) { const b64 = await fileToBase64(e.target.files[0]); setRawImage(b64); setEditorState({brightness:100, contrast:100, zoom:0.5, x:0, y:0, rotation:0}); setShowImageEditor(true); setSelectedCheckId(null); } }} />
      <input type="file" ref={batchInputRef} className="hidden" accept="image/*" multiple onChange={e => e.target.files && handleBatchUpload(e.target.files)} />
      <input type="file" ref={detailImageRef} className="hidden" accept="image/*" onChange={async e => { if(selectedCheckId && e.target.files?.[0]) { const b64 = await fileToBase64(e.target.files[0]); updateCheckImage(selectedCheckId, b64); } }} />

      <div className="bg-slate-900/40 p-8 rounded-[3rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 no-print">
          <div className="flex gap-8">
              <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">نزد صندوق</p><h3 className="text-2xl font-black text-blue-400 font-mono">{formatCurrency(stats.pending).replace(' ریال','')}</h3></div>
              <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">وصول شده</p><h3 className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(stats.passed).replace(' ریال','')}</h3></div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => { setRawImage(null); setBatchChecks([{ id: generateId(), amount: 0, bankName: '', sayadId: '', dueDate: getPersianDate() }]); setShowAddModal(true); }} className="flex-1 md:flex-none bg-white/5 text-white px-8 py-4 rounded-2xl border border-white/10 font-black text-sm transition-all hover:bg-white/10 flex items-center gap-2"><Plus size={18}/> ثبت دستی</button>
              <button onClick={() => setShowCameraGuide(true)} className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl active:scale-95 transition-all"><Camera size={24}/> دوربین</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl active:scale-95 transition-all"><ScanLine size={24}/> اسکن تکی</button>
              <button onClick={() => batchInputRef.current?.click()} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl active:scale-95 transition-all"><Layers size={24}/> چندتایی</button>
          </div>
      </div>

      <div className="flex justify-between items-center no-print">
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/5 w-fit shadow-lg">
              <button onClick={() => setMainTab('CHECKS')} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${mainTab === 'CHECKS' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>لیست چک‌ها</button>
              <button onClick={() => setMainTab('TRANSFERS')} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${mainTab === 'TRANSFERS' ? 'bg-indigo-900 text-white' : 'text-slate-500'}`}>تاریخچه واگذاری</button>
          </div>
          {mainTab === 'CHECKS' && (
              <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setViewMode('grid')} className={`p-3 rounded-lg ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
                  <button onClick={() => setViewMode('list')} className={`p-3 rounded-lg ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500'}`}><List size={18}/></button>
                  <button onClick={() => setViewMode('calendar')} className={`p-3 rounded-lg ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-slate-500'}`}><CalendarIcon size={18}/></button>
              </div>
          )}
      </div>

      {mainTab === 'CHECKS' ? (
          viewMode === 'calendar' ? (
              <JalaliDueCalendar />
          ) : viewMode === 'list' ? (
              <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                          <thead className="bg-white/5 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                              <tr>
                                  <th className="p-4 text-center w-12">
                                      <span className="sr-only">انتخاب</span>
                                  </th>
                                  <th className="p-4 text-center w-28">تصویر چک</th>
                                  <th className="p-4">بانک / صادرکننده</th>
                                  <th className="p-4 text-center font-mono">شناسه صیادی (۱۶ رقم)</th>
                                  <th className="p-4 text-center">تاریخ سررسید</th>
                                  <th className="p-4 text-left">مبلغ (ریال / تومان)</th>
                                  <th className="p-4 text-center">وضعیت</th>
                                  <th className="p-4 text-center w-36">عملیات</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-200 text-sm font-bold">
                              {filteredChecks.length === 0 ? (
                                  <tr>
                                      <td colSpan={8} className="p-12 text-center text-slate-500 font-bold">
                                          هیچ چکی در این دسته‌بندی یافت نشد.
                                      </td>
                                  </tr>
                              ) : (
                                  filteredChecks.map(check => (
                                      <tr 
                                          key={check.id} 
                                          className={`hover:bg-white/[0.04] transition-colors cursor-pointer group ${selectedIds.includes(check.id) ? 'bg-indigo-950/30' : ''}`}
                                          onClick={() => { setSelectedCheckId(check.id); setShowDetailModal(true); }}
                                      >
                                          <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                              <button 
                                                  onClick={() => setSelectedIds(prev => prev.includes(check.id) ? prev.filter(x => x !== check.id) : [...prev, check.id])} 
                                                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${selectedIds.includes(check.id) ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-600 hover:text-white border border-white/10'}`}
                                              >
                                                  <CheckCircle2 size={16}/>
                                              </button>
                                          </td>
                                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                              {check.imageUrl ? (
                                                  <img 
                                                      src={check.imageUrl} 
                                                      alt="تصویر چک" 
                                                      onClick={() => setPreviewCheckImage(check.imageUrl!)} 
                                                      className="w-14 h-9 object-cover rounded-xl border border-white/20 shadow-md hover:scale-125 transition-transform cursor-pointer inline-block"
                                                      title="کلیک برای مشاهده بزرگ تصویر چک"
                                                  />
                                              ) : (
                                                  <div className="w-14 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-600 inline-flex">
                                                      <Banknote size={16} />
                                                  </div>
                                              )}
                                          </td>
                                          <td className="p-4">
                                              <div className="font-black text-white text-base">
                                                  {check.bankName}
                                              </div>
                                              <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                                                  {check.holderName || check.personName || 'نامشخص'}
                                              </div>
                                          </td>
                                          <td className="p-4 text-center font-mono">
                                              <span className="text-xs tracking-widest text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 inline-block">
                                                  {toPersianDigits(check.sayadId || '---')}
                                              </span>
                                          </td>
                                          <td className="p-4 text-center font-mono">
                                              <span className="text-white text-sm block">{toPersianDigits(check.dueDate)}</span>
                                          </td>
                                          <td className="p-4 text-left font-mono">
                                              <div className="text-emerald-400 font-black text-base">{formatCurrency(check.amount)}</div>
                                              <div className="text-[10px] text-slate-400 font-sans font-bold">{toPersianDigits(Math.round(check.amount / 10).toLocaleString())} تومان</div>
                                          </td>
                                          <td className="p-4 text-center">
                                              <span className={`px-3 py-1 rounded-xl text-[10px] font-black inline-flex items-center gap-1 border ${STATUS_CONFIG[check.status]?.color}`}>
                                                  {STATUS_CONFIG[check.status]?.label}
                                              </span>
                                          </td>
                                          <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                              <div className="flex items-center justify-center gap-1.5">
                                                  <button 
                                                      onClick={() => { setSelectedCheckId(check.id); setShowDetailModal(true); }}
                                                      className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all"
                                                      title="مشاهده جزئیات چک"
                                                  >
                                                      <Eye size={16}/>
                                                  </button>
                                                  <button 
                                                      onClick={() => setActiveCheckPrint(check)}
                                                      className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all"
                                                      title="چاپ رسید لاشه چک"
                                                  >
                                                      <Printer size={16}/>
                                                  </button>
                                                  <button 
                                                      onClick={() => { setSelectedIds([check.id]); setShowTransferModal(true); }}
                                                      className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all"
                                                      title="واگذاری / خرج چک"
                                                  >
                                                      <ArrowRight size={16}/>
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredChecks.map(check => (
                      <div 
                          key={check.id} 
                          className={`bg-slate-900/60 p-5 rounded-[2.5rem] border-2 transition-all cursor-pointer group relative overflow-hidden shadow-xl hover:border-amber-500/40 ${selectedIds.includes(check.id) ? 'border-indigo-500' : 'border-white/5'}`} 
                          onClick={() => { setSelectedCheckId(check.id); setShowDetailModal(true); }}
                      >
                          <div className="flex justify-between items-start gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                  {check.imageUrl ? (
                                      <img 
                                          src={check.imageUrl} 
                                          alt="چک" 
                                          onClick={(e) => { e.stopPropagation(); setPreviewCheckImage(check.imageUrl!); }}
                                          className="w-16 h-11 object-cover rounded-2xl border border-white/20 shadow-md shrink-0 hover:scale-110 transition-transform cursor-pointer" 
                                          title="کلیک جهت مشاهده بزرگ چک"
                                      />
                                  ) : (
                                      <div className="w-14 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                                          <Banknote size={22}/>
                                      </div>
                                  )}
                                  <div>
                                      <h4 className="text-white font-black text-lg leading-tight">{check.bankName}</h4>
                                      <span className="text-[11px] text-slate-400 font-mono tracking-wider block mt-0.5">{toPersianDigits(check.sayadId || '---')}</span>
                                  </div>
                              </div>
                              <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(check.id) ? prev.filter(x => x !== check.id) : [...prev, check.id]); }} 
                                  className={`p-2 rounded-xl transition-colors ${selectedIds.includes(check.id) ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-600 hover:text-white'}`}
                              >
                                  <CheckCircle2 size={18}/>
                              </button>
                          </div>

                          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-white/5 mb-4">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-slate-400 font-bold">صاحب حساب:</span>
                                  <span className="text-xs text-white font-bold truncate max-w-[160px]">{check.holderName || check.personName || 'نامشخص'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-slate-400 font-bold">مبلغ چک:</span>
                                  <span className="text-emerald-400 font-mono font-black text-lg">{formatCurrency(check.amount)}</span>
                              </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/5 pt-3">
                              <span className="text-white font-mono font-bold text-xs flex items-center gap-1.5">
                                  <CalendarIcon size={14} className="text-slate-500"/>
                                  {toPersianDigits(check.dueDate)}
                              </span>
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); setActiveCheckPrint(check); }}
                                      className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                                      title="چاپ رسید"
                                  >
                                      <Printer size={15}/>
                                  </button>
                                  <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black border ${STATUS_CONFIG[check.status]?.color}`}>
                                      {STATUS_CONFIG[check.status]?.label}
                                  </span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )
      ) : (
          <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                  <table className="w-full text-right">
                      <thead className="bg-white/5 text-slate-500 text-[10px] uppercase font-black"><tr><th className="p-6">کد سند</th><th className="p-6">تاریخ</th><th className="p-6">گیرنده</th><th className="p-6 text-left">مبلغ کل</th><th className="p-6 text-center">عملیات</th></tr></thead>
                      <tbody className="divide-y divide-white/5 text-slate-300 text-sm font-bold">
                          {checkTransfers.map(tr => (
                              <tr key={tr.id} className="hover:bg-white/5 transition-all">
                                  <td className="p-6 font-mono text-indigo-400">{toPersianDigits(tr.trackingCode)}</td>
                                  <td className="p-6 font-mono text-xs">{toPersianDigits(tr.date)}</td>
                                  <td className="p-6 font-black text-white">{tr.personName}</td>
                                  <td className="p-6 text-teal-400 font-mono text-left">{formatCurrency(tr.items?.reduce((s:number,i:any)=>s+(i.amount||0),0))}</td>
                                  <td className="p-6 text-center">
                                      <div className="flex justify-center gap-2">
                                          <button onClick={() => { setActiveTransferId(tr.id); setShowPrintPreview(true); }} className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 transition-all"><Eye size={18}/></button>
                                          <button onClick={() => handleShareReceiptText(tr.id)} className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-600 transition-all"><MessageCircle size={18}/></button>
                                          <button onClick={() => setDeleteTransferId(tr.id)} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-4 rounded-full shadow-2xl z-[100] flex items-center gap-4 animate-pop-up">
              <span className="font-black text-sm">{toPersianDigits(selectedIds.length)} چک انتخاب شده</span>
              <div className="h-4 w-px bg-white/30"></div>
              <button onClick={() => { setShowTransferModal(true); setShowDetailModal(false); }} className="font-bold hover:text-indigo-200">واگذاری گروهی</button>
              <button onClick={() => setSelectedIds([])} className="bg-white/20 p-1 rounded-full hover:bg-white/40"><X size={14}/></button>
          </div>
      )}

      {/* --- BATCH ADD MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-3 md:p-6 animate-fade-in no-print">
            <div className="bg-slate-900 border border-white/10 w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop-up flex flex-col max-h-[92vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/40">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                            <Banknote className="text-amber-400" size={24}/> ثبت و صدور چک‌های صیادی و بانکی
                        </h3>
                        <span className="text-xs text-slate-400 mt-1">
                            ثبت مشخصات چک، بارگزاری تصویر لاشه چک و اسکن مستقیم با دوربین با فضای کامل فیلدها
                        </span>
                    </div>
                    <button onClick={() => setShowAddModal(false)} className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-5 bg-slate-950 border-b border-white/5 flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-4">
                    <div className="flex-1 max-w-md">
                        <label className="text-[11px] text-slate-400 font-black pr-2 uppercase mb-1.5 block">دریافت از طرف حساب (مشتری/صاحب حساب)</label>
                        <div className="flex gap-2">
                            <select 
                                className="flex-1 bg-slate-900 border border-white/10 rounded-2xl p-3 text-white font-bold text-sm outline-none focus:border-amber-500" 
                                value={batchPayerId} 
                                onChange={e => setBatchPayerId(e.target.value)}
                            >
                                <option value="">انتخاب شخص...</option>
                                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button 
                                onClick={() => setShowAddPersonModal(true)} 
                                className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 rounded-2xl font-black text-xs flex items-center gap-1 shrink-0 transition-all shadow" 
                                title="افزودن شخص جدید"
                            >
                                <User size={16}/><Plus size={12}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={addEmptyCheckRow} 
                            className="bg-teal-600/15 hover:bg-teal-600/25 text-teal-400 border border-teal-500/30 px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                            <Plus size={16}/> افزودن فقره چک دیگر
                        </button>
                    </div>
                </div>

                <div className="p-4 md:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/50">
                    {batchChecks.map((check, idx) => (
                        <div key={idx} className="bg-slate-950 p-5 rounded-3xl border border-white/10 hover:border-amber-500/30 transition-all space-y-4 shadow-lg">
                            {/* Card Header: Check index, Image attachments, Scan & Delete */}
                            <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-black text-xs flex items-center justify-center">
                                        {toPersianDigits(idx + 1)}
                                    </span>
                                    <span className="text-white font-black text-sm">فقره چک شماره {toPersianDigits(idx + 1)}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {check.imageUrl ? (
                                        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-emerald-500/30">
                                            <img 
                                                src={check.imageUrl} 
                                                alt="تصویر چک" 
                                                onClick={() => setPreviewCheckImage(check.imageUrl!)}
                                                className="w-16 h-10 object-cover rounded-xl border border-emerald-500/50 cursor-pointer shadow hover:scale-105 transition-transform" 
                                                title="مشاهده تصویر بزرگ چک"
                                            />
                                            <button 
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const res = await OfflineOcrEngine.processCheckOffline(check.imageUrl!);
                                                        const n = [...batchChecks];
                                                        if (res.sayadId) n[idx].sayadId = res.sayadId;
                                                        if (res.amount) n[idx].amount = res.amount;
                                                        if (res.bankName) n[idx].bankName = res.bankName;
                                                        if (res.dueDate) n[idx].dueDate = res.dueDate;
                                                        setBatchChecks(n);
                                                    } catch {}
                                                }}
                                                className="text-[10px] text-teal-400 hover:text-teal-300 font-bold px-2 py-1 bg-teal-500/10 rounded-lg transition-all"
                                                title="استخراج مجدد اطلاعات با OCR"
                                            >
                                                استخراج OCR
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => { const n = [...batchChecks]; n[idx].imageUrl = undefined; setBatchChecks(n); }} 
                                                className="text-rose-400 hover:text-rose-300 p-1 rounded-lg"
                                                title="حذف تصویر"
                                            >
                                                <X size={15}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {/* File Upload Button */}
                                            <label className="cursor-pointer bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all">
                                                <Upload size={13} className="text-amber-400"/>
                                                <span>بارگزاری عکس چک</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={e => {
                                                        if (e.target.files?.[0]) handleRowImageUpload(idx, e.target.files[0]);
                                                    }} 
                                                />
                                            </label>
                                            {/* Camera Scan Button */}
                                            <button 
                                                type="button"
                                                onClick={() => handleRowCameraCapture(idx)}
                                                className="cursor-pointer bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white px-3 py-1.5 rounded-xl border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                                                title="تصویربرداری مستقیم با دوربین یا اسکنر"
                                            >
                                                <Camera size={13} className="text-indigo-400"/>
                                                <span>اسکن با دوربین</span>
                                            </button>
                                        </div>
                                    )}

                                    {batchChecks.length > 1 && (
                                        <button 
                                            type="button"
                                            onClick={() => setBatchChecks(batchChecks.filter((_, i) => i !== idx))} 
                                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                            title="حذف این ردیف"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Main 4-Column Grid with ample space */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* 1. شناسه صیادی (۱۶ رقم) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center pr-2 pl-1">
                                        <label className="text-[10px] text-slate-400 font-bold">شناسه صیادی (۱۶ رقم)</label>
                                        <span className={`text-[10px] font-mono font-bold ${check.sayadId?.length === 16 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {toPersianDigits(check.sayadId?.length || 0)} / ۱۶
                                        </span>
                                    </div>
                                    <input 
                                        className={`chk-sayad-${idx} w-full bg-slate-900 px-4 py-3 rounded-2xl border border-white/10 text-white font-mono text-base font-black outline-none focus:border-amber-500 text-center tracking-[0.25em]`} 
                                        placeholder="---- ---- ---- ----" 
                                        value={check.sayadId} 
                                        onChange={e => { const n = [...batchChecks]; n[idx].sayadId = e.target.value.replace(/\D/g, ''); setBatchChecks(n); }} 
                                        maxLength={16} 
                                    />
                                </div>

                                {/* 2. بانک صادرکننده */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-bold pr-2 block">بانک صادرکننده</label>
                                    <select 
                                        className={`chk-bank-${idx} w-full bg-slate-900 px-4 py-3 rounded-2xl border border-white/10 text-white text-xs font-bold outline-none focus:border-amber-500 h-[48px]`} 
                                        value={check.bankName} 
                                        onChange={e => { const n = [...batchChecks]; n[idx].bankName = e.target.value; setBatchChecks(n); }}
                                    >
                                        <option value="">انتخاب بانک...</option>
                                        {IRANIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                {/* 3. مبلغ (ریال) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center pr-2 pl-1">
                                        <label className="text-[10px] text-slate-400 font-bold">مبلغ (ریال)</label>
                                        {check.amount ? (
                                            <span className="text-[10px] text-emerald-400 font-bold">
                                                {toPersianDigits(Math.round(check.amount / 10).toLocaleString())} تومان
                                            </span>
                                        ) : null}
                                    </div>
                                    <NumberInput 
                                        value={check.amount || 0} 
                                        onChange={v => { const n = [...batchChecks]; n[idx].amount = v; setBatchChecks(n); }} 
                                        className={`chk-amount-${idx} !bg-slate-900 !rounded-2xl !p-3 !font-mono !text-base !font-black !text-white`} 
                                    />
                                </div>

                                {/* 4. تاریخ سررسید */}
                                <div className="space-y-1 relative z-[1250]">
                                    <JalaliDatePicker 
                                        label="تاریخ سررسید" 
                                        value={check.dueDate} 
                                        onChange={v => { const n = [...batchChecks]; n[idx].dueDate = v; setBatchChecks(n); }} 
                                    />
                                </div>
                            </div>

                            {/* Row 2: شرح / بابت */}
                            <div className="pt-1">
                                <input 
                                    className={`chk-desc-${idx} w-full bg-slate-900/80 px-4 py-2.5 rounded-xl border border-white/5 text-white text-xs outline-none focus:border-amber-500 placeholder:text-slate-600`} 
                                    placeholder="توضیحات اختیاری، بابت فاکتور یا قرارداد، نام شعبه..." 
                                    value={check.description || ''} 
                                    onChange={e => { const n = [...batchChecks]; n[idx].description = e.target.value; setBatchChecks(n); }} 
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 border-t border-white/5 bg-slate-950 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                        <span className="text-xs text-slate-400 font-bold">
                            تعداد: <span className="text-white font-mono font-black">{toPersianDigits(batchChecks.length)} فقره</span>
                        </span>
                        <span className="text-xs text-slate-400 font-bold">
                            مجموع مبلغ: <span className="text-emerald-400 font-mono font-black text-sm">
                                {formatCurrency(batchChecks.reduce((sum, c) => sum + (c.amount || 0), 0))}
                            </span>
                        </span>
                    </div>
                    <button 
                        onClick={saveBatchChecks} 
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white px-10 py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
                    >
                        تایید و ذخیره نهایی
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- IMAGE EDITOR & SMART CROP --- */}
      {showImageEditor && rawImage && (
        <div className="fixed inset-0 z-[1300] bg-black flex flex-col no-print animate-fade-in">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                <img 
                    ref={editorImgRef}
                    src={rawImage} 
                    style={{ transform: `scale(${editorState.zoom}) rotate(${editorState.rotation}deg)`, filter: `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%)` }} 
                    className="transition-all duration-200 origin-center"
                />
                <div className="absolute inset-0 border-[30px] border-black/50 pointer-events-none"></div> {/* Visual Crop Guide */}
                
                {isProcessingAI && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                        <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-indigo-400 font-black animate-pulse">هوش مصنوعی در حال خواندن چک...</p>
                        {batchProgress.total > 0 && (
                            <p className="text-white text-sm mt-2">{batchProgress.current} / {batchProgress.total}</p>
                        )}
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setOcrEngine('tesseract')} className={`px-4 py-2 rounded-lg text-xs ${ocrEngine === 'tesseract' ? 'bg-teal-600' : 'bg-white/10'}`}>موتور محلی (آفلاین)</button>
                            <button onClick={() => setOcrEngine('gemini')} className={`px-4 py-2 rounded-lg text-xs ${ocrEngine === 'gemini' ? 'bg-indigo-600' : 'bg-white/10'}`}>پردازش ابری (دپارتمان IT)</button>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-slate-900 p-6 flex flex-col gap-4 border-t border-white/10 shrink-0">
                <div className="flex justify-center gap-6">
                    <button onClick={() => setEditorState(s => ({...s, rotation: s.rotation - 90}))} className="text-white hover:text-indigo-400"><RotateCw size={24}/></button>
                    <button onClick={() => setEditorState(s => ({...s, zoom: s.zoom + 0.1}))} className="text-white hover:text-indigo-400"><ZoomIn size={24}/></button>
                    <button onClick={() => setEditorState(s => ({...s, zoom: Math.max(0.1, s.zoom - 0.1)}))} className="text-white hover:text-indigo-400"><ZoomOut size={24}/></button>
                </div>
                <div className="flex gap-4">
                    <button onClick={processAI} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                        <Bot size={20}/> <span>استخراج مشخصات چک (دپارتمان IT)</span>
                    </button>
                    <button onClick={cropView} className="flex-1 bg-teal-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                        <Crop size={20}/> <span>برش نمای فعلی و ذخیره</span>
                    </button>
                    <button onClick={() => setShowImageEditor(false)} className="w-16 bg-rose-600/20 text-rose-500 rounded-2xl flex items-center justify-center"><X/></button>
                </div>
            </div>
        </div>
      )}

      {/* --- DETAIL MODAL --- */}
      {showDetailModal && selectedCheck && (
        <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 animate-fade-in no-print">
            <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-pop-up relative group">
                {/* Background Check Image */}
                {selectedCheck.imageUrl && (
                    <div className="absolute inset-0 z-0 opacity-10 pointer-events-none grayscale">
                        <img src={selectedCheck.imageUrl} className="w-full h-full object-cover" />
                    </div>
                )}
                
                <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-950 relative z-10 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <button onClick={() => setShowDetailModal(false)} className="p-2 bg-black/20 text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black backdrop-blur-md shadow-lg border border-white/5 ${STATUS_CONFIG[selectedCheck.status]?.color}`}>{STATUS_CONFIG[selectedCheck.status]?.label}</span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-white shadow-black drop-shadow-md mb-1">{selectedCheck.bankName}</h3>
                        <p className="text-slate-400 text-xs font-mono">{toPersianDigits(selectedCheck.sayadId)}</p>
                    </div>
                </div>
                
                <div className="p-8 space-y-6 relative z-10 bg-slate-900/80 backdrop-blur-sm h-full">
                    <div className="flex justify-between items-center bg-slate-950/50 p-5 rounded-3xl border border-white/5 shadow-inner">
                        <span className="text-slate-500 text-xs font-bold">مبلغ چک</span>
                        <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{formatCurrency(selectedCheck.amount).replace(' ریال','')}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <span className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">تاریخ سررسید</span>
                            <span className="text-white font-bold text-lg">{toPersianDigits(selectedCheck.dueDate)}</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <span className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">دریافت از</span>
                            <span className="text-white font-bold text-lg truncate">{selectedCheck.personName || selectedCheck.holderName}</span>
                        </div>
                    </div>
                    
                    {selectedCheck.relatedInvoiceId && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="text-indigo-400" size={18}/>
                                <span className="text-xs text-indigo-300 font-bold">مرتبط با فاکتور شماره {toPersianDigits(invoices.find(i => i.id === selectedCheck.relatedInvoiceId)?.number || '')}</span>
                            </div>
                            <button onClick={() => { setShowDetailModal(false); window.location.hash = '#/invoices'; }} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold">مشاهده</button>
                        </div>
                    )}

                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {['PASSED', 'BOUNCED', 'CASHED', 'RETURNED'].map(s => (
                            <button key={s} onClick={() => { updateCheckStatus(selectedCheck.id, s as any, ''); setShowDetailModal(false); }} className={`flex-shrink-0 px-4 py-3 rounded-xl text-[10px] font-bold border transition-all ${selectedCheck.status === s ? 'bg-white text-black' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                                {STATUS_CONFIG[s].label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-white/5">
                        <button onClick={() => { setShowTransferModal(true); setShowDetailModal(false); setSelectedIds([selectedCheck.id]); }} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">واگذاری / خرج چک</button>
                        <button onClick={() => { setActiveCheckPrint(selectedCheck); setShowDetailModal(false); }} className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all" title="چاپ رسید لاشه چک"><Printer size={20}/></button>
                        {selectedCheck.imageUrl ? (
                            <button onClick={() => { setPreviewCheckImage(selectedCheck.imageUrl!); }} className="p-4 bg-white/5 text-white rounded-2xl border border-white/10 hover:bg-white/10" title="مشاهده تصویر بزرگ چک"><Eye size={20}/></button>
                        ) : (
                            <button onClick={() => detailImageRef.current?.click()} className="p-4 bg-white/5 text-amber-400 rounded-2xl border border-white/10 hover:bg-amber-600 hover:text-white transition-all" title="افزودن تصویر چک"><ImagePlus size={20}/></button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- TRANSFER MODAL --- */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 animate-fade-in no-print">
            <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-pop-up">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/40">
                    <h3 className="text-lg font-black text-white flex items-center gap-2"><ArrowRight className="text-indigo-400"/> واگذاری چک به شخص</h3>
                    <button onClick={() => setShowTransferModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-center">
                        <p className="text-xs text-indigo-300 font-bold mb-1">شما در حال واگذاری</p>
                        <p className="text-2xl font-black text-white">{toPersianDigits(selectedIds.length > 0 ? selectedIds.length : 1)} <span className="text-xs font-bold text-indigo-300">فقره چک</span></p>
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-black pr-2 uppercase">طرف حساب (گیرنده)</label>
                        <div className="flex gap-2">
                            <select className="flex-1 bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-bold outline-none focus:border-indigo-500" value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)}>
                                <option value="">انتخاب گیرنده...</option>
                                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button 
                                type="button"
                                onClick={() => setShowAddPersonModal(true)}
                                className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg"
                                title="ثبت سریع شخص جدید"
                            >
                                <Plus size={22} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-black pr-2 uppercase">توضیحات سند</label>
                        <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white outline-none focus:border-indigo-500" placeholder="بابت..." value={transferDesc} onChange={e => setTransferDesc(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <button onClick={() => setShowSignaturePad(true)} className="py-4 rounded-2xl bg-white/5 text-white text-xs font-bold border border-white/10 hover:bg-white/10 flex flex-col items-center gap-1">
                            {transferSignature ? <CheckCircle2 className="text-emerald-400" size={18}/> : <PenTool size={18}/>}
                            {transferSignature ? 'امضا شد' : 'امضای دستی'}
                        </button>
                        <button onClick={confirmTransfer} className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                            تایید و صدور سند
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showPrintPreview && activeTransfer && (
        <div className="fixed inset-0 z-[1500] bg-[#020617] flex flex-col animate-fade-in overflow-hidden">
            <header className="bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center px-6 md:px-12 shrink-0 shadow-2xl">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setShowPrintPreview(false); setActiveTransferId(null); }} className="bg-white/5 text-white p-4 rounded-2xl hover:bg-rose-600 transition-all"><ArrowLeft size={28}/></button>
                    <div><h2 className="text-white font-black text-xl tracking-tighter">پیش‌نمایش رسید واگذاری</h2></div>
                </div>
                <div className="flex gap-2">
                    {!activeTransfer.signature && (
                        <button onClick={() => { setSigningTransferId(activeTransfer.id); setShowSignaturePad(true); }} className="bg-teal-500/10 text-teal-400 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 border border-teal-500/20 hover:bg-teal-500 hover:text-white transition-all"><PenTool size={18}/> ثبت امضا</button>
                    )}
                    <button onClick={() => handleShareLink(activeTransfer.id)} className="bg-white/5 text-indigo-400 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 border border-white/10 hover:bg-indigo-600 hover:text-white transition-all"><LinkIcon size={18}/> لینک امضا</button>
                    <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 flex items-center gap-2"><Printer size={20}/> چاپ</button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar scroll-smooth">
                <div className="relative transform-gpu transition-all origin-top duration-300 mb-32 print-content" style={{ width: 'min(95vw, 210mm)' }}>
                    <div ref={printRef} className="bg-white shadow-[0_40px_120px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden print-content" style={{ minHeight: '297mm' }}>
                        <PrintTemplate data={activeTransfer} theme="official" type="CHECK_TRANSFER"/>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showCameraGuide && (
          <CameraGuide 
              onCapture={(base64) => {
                  setRawImage(base64);
                  setShowCameraGuide(false);
                  setShowImageEditor(true);
              }} 
              onClose={() => setShowCameraGuide(false)} 
          />
      )}

      {/* Other Modals... */}
      {/* --- QUICK ADD PERSON MODAL --- */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2"><User className="text-amber-400" size={20}/> تعریف سریع شخص</h3>
                <div className="space-y-4">
                    <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-bold outline-none focus:border-amber-500" placeholder="نام کامل..." value={newPersonName} onChange={e => setNewPersonName(e.target.value)} autoFocus />
                    <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono outline-none focus:border-amber-500" placeholder="شماره تماس (اختیاری)" value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} />
                    <button onClick={handleQuickAddPerson} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95">ذخیره و انتخاب</button>
                    <button onClick={() => setShowAddPersonModal(false)} className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold">انصراف</button>
                </div>
            </div>
        </div>
      )}

      {/* --- SINGLE CHECK PRINT PREVIEW MODAL --- */}
      {activeCheckPrint && (
        <div className="fixed inset-0 z-[1500] bg-[#020617] flex flex-col animate-fade-in overflow-hidden">
            <header className="bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center px-6 md:px-12 shrink-0 shadow-2xl">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveCheckPrint(null)} className="bg-white/5 text-white p-3 rounded-2xl hover:bg-rose-600 transition-all">
                        <ArrowLeft size={24}/>
                    </button>
                    <div>
                        <h2 className="text-white font-black text-xl tracking-tight">رسید و لاشه چک دریافتی / واگذار شده</h2>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{activeCheckPrint.bankName} - صیادی: {toPersianDigits(activeCheckPrint.sayadId)}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 flex items-center gap-2 transition-all">
                        <Printer size={20}/> چاپ سند چک
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar scroll-smooth">
                <div className="relative transform-gpu transition-all origin-top duration-300 mb-32 print-content" style={{ width: 'min(95vw, 210mm)' }}>
                    <div className="bg-white shadow-[0_40px_120px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden print-content" style={{ minHeight: '297mm' }}>
                        <PrintTemplate data={activeCheckPrint} theme="official" type="CHECK"/>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- CHECK IMAGE PREVIEW MODAL --- */}
      {previewCheckImage && (
        <div className="fixed inset-0 z-[1600] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in no-print" onClick={() => setPreviewCheckImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <div className="absolute -top-12 right-0 flex items-center gap-3">
                    <button 
                        onClick={() => {
                            const w = window.open('');
                            w?.document.write(`<img src="${previewCheckImage}" style="max-width:100%; height:auto;" />`);
                        }} 
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-colors"
                    >
                        باز کردن در پنجره جدید
                    </button>
                    <button onClick={() => setPreviewCheckImage(null)} className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-full transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                <img 
                    src={previewCheckImage} 
                    alt="تصویر بزرگ چک" 
                    className="max-w-full max-h-[80vh] object-contain rounded-3xl border border-white/20 shadow-2xl" 
                />
            </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTransferId} onClose={() => setDeleteTransferId(null)} onConfirm={() => deleteTransferId && deleteCheckTransfer(deleteTransferId)} title="ابطال سند واگذاری" message="آیا از ابطال این سند اطمینان دارید؟ با ابطال سند، چک‌ها به وضعیت 'نزد صندوق' باز می‌گردند و تراکنش مالی مربوطه معکوس می‌شود." />
      <FullScreenSignatureModal isOpen={showSignaturePad} onClose={() => { setShowSignaturePad(false); setSigningTransferId(null); }} onSave={(img: string) => { 
          if(signingTransferId) {
              updateCheckTransfer(signingTransferId, {signature: img, status: 'CONFIRMED'});
              // Force refresh/update if active
              if(activeTransferId === signingTransferId) {
                  // The useStore subscription will handle update, but re-render might lag if not careful.
                  // React state update is automatic with Zustand hooks.
              }
          } else if(activeTransferId) {
              updateCheckTransfer(activeTransferId, {signature: img, status: 'CONFIRMED'}); 
          } else {
              setTransferSignature(img);
          }
      }} />
    </div>
  );
};

export default Checks;
