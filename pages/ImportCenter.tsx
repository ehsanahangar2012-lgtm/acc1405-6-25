import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { Voucher, VoucherItem, InventoryMovementType } from '../types';
import { ImportBatch, ImportMappingConfig, ImportValidationError, ImportValidationWarning, StockChangeReconciliation } from '../types-import';
import { generateId, getPersianDate, getPersianTime, generateTrackingCode, toPersianDigits } from '../utils';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Settings, 
  ChevronLeft, 
  History, 
  CornerUpLeft, 
  Eye, 
  FileJson, 
  ArrowUpDown, 
  AlertTriangle,
  Plus, 
  X, 
  Info,
  Calendar,
  Layers,
  Database
} from 'lucide-react';
import { ConfirmModal } from '../components/Shared';

const ImportCenter = () => {
  const { 
    products, 
    people, 
    vouchers, 
    currentUser, 
    importConfigs, 
    importBatches,
    addImportConfig,
    deleteImportConfig,
    addImportBatch,
    commitImportBatch,
    rollbackImportBatch
  } = useStore();

  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  
  // New Import States
  const [selectedConfigId, setSelectedConfigId] = useState<string>(importConfigs[0]?.id || '');
  const [jsonText, setJsonText] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Custom Config Builder States
  const [showConfigBuilder, setShowConfigBuilder] = useState<boolean>(false);
  const [newConfigName, setNewConfigName] = useState<string>('');
  const [newConfigType, setNewConfigType] = useState<ImportMappingConfig['voucherType']>('GOODS_RECEIPT');
  const [newItemsPath, setNewItemsPath] = useState<string>('items');
  const [newRootMapping, setNewRootMapping] = useState({
    number: 'document_number',
    trackingCode: 'tracking_code',
    date: 'date',
    time: 'time',
    personName: 'person_name',
    supervisor: 'supervisor',
    vehicleNumber: 'vehicle_number',
    receiverPhone: 'receiver_phone',
    notes: 'notes'
  });
  const [newItemMapping, setNewItemMapping] = useState({
    productName: 'product_name',
    quantity: 'qty',
    unit: 'unit',
    weight: 'weight',
    shelfLocation: 'shelf_location',
    description: 'description'
  });

  // Current Validation / Preview Batch
  const [previewBatch, setPreviewBatch] = useState<ImportBatch | null>(null);
  
  // History Detail Viewer
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<ImportBatch | null>(null);
  
  // Confirm rollback targets
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
    };
    reader.readAsText(file);
  };

  // Create Custom Config
  const handleSaveConfig = () => {
    if (!newConfigName.trim()) return alert('لطفاً نام الگو را وارد کنید.');
    
    const config: ImportMappingConfig = {
      id: generateId(),
      name: newConfigName,
      voucherType: newConfigType,
      itemsPath: newItemsPath || 'items',
      rootMapping: { ...newRootMapping },
      itemMapping: { ...newItemMapping }
    };
    
    addImportConfig(config);
    setSelectedConfigId(config.id);
    setShowConfigBuilder(false);
    
    // Clear form
    setNewConfigName('');
    setNewItemsPath('items');
  };

  // Dynamic Validation Engine
  const validateAndMap = () => {
    if (!jsonText.trim()) {
      alert('لطفاً کد JSON یا فایل آن را وارد کنید.');
      return;
    }

    try {
      const rawData = JSON.parse(jsonText);
      const rawRecords = Array.isArray(rawData) ? rawData : [rawData];
      
      const config = importConfigs.find(c => c.id === selectedConfigId);
      if (!config) {
        alert('الگوی نقشه‌نگاری انتخاب نشده است.');
        return;
      }

      const mappedVouchers: Voucher[] = [];
      const errors: ImportValidationError[] = [];
      const warnings: ImportValidationWarning[] = [];
      const batchId = generateId().replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase();

      rawRecords.forEach((raw: any, idx: number) => {
        const docNumRaw = raw[config.rootMapping.number];
        const docNumber = Number(docNumRaw);
        const trackingCode = raw[config.rootMapping.trackingCode] || '';
        const rawDate = raw[config.rootMapping.date] || getPersianDate();
        const rawTime = (config.rootMapping.time ? raw[config.rootMapping.time] : '') || getPersianTime();
        const personName = (config.rootMapping.personName ? raw[config.rootMapping.personName] : '') || 'وارداتی ناشناس';
        const supervisor = (config.rootMapping.supervisor ? raw[config.rootMapping.supervisor] : '') || '';
        const vehicleNumber = (config.rootMapping.vehicleNumber ? raw[config.rootMapping.vehicleNumber] : '') || '';
        const receiverPhone = (config.rootMapping.receiverPhone ? raw[config.rootMapping.receiverPhone] : '') || '';
        const notes = (config.rootMapping.notes ? raw[config.rootMapping.notes] : '') || 'واردات از فایل';

        // Validation: Document Number
        if (docNumRaw === undefined || docNumRaw === null || docNumRaw === '') {
          errors.push({
            index: idx,
            type: 'MISSING_FIELD',
            field: config.rootMapping.number,
            message: `فیلد شماره سند در ردیف ${idx + 1} یافت نشد.`
          });
        } else if (isNaN(docNumber)) {
          errors.push({
            index: idx,
            type: 'INVALID_DATA',
            field: config.rootMapping.number,
            message: `شماره سند ردیف ${idx + 1} معتبر نیست (باید عدد باشد). مقدار دریافت شده: "${docNumRaw}"`
          });
        }

        // Duplicate Document Number check inside the database
        if (vouchers.some(v => v.number === docNumber)) {
          errors.push({
            index: idx,
            docNumber,
            type: 'DUPLICATE_DOC_NUM',
            message: `شماره سند ${docNumber} از قبل در سیستم وجود دارد.`
          });
        }

        // Duplicate Document Number check inside the current import batch
        if (mappedVouchers.some(v => v.number === docNumber)) {
          errors.push({
            index: idx,
            docNumber,
            type: 'DUPLICATE_DOC_NUM',
            message: `شماره سند ${docNumber} در فایل ورودی بیش از یک بار تکرار شده است.`
          });
        }

        // Duplicate Tracking Code check in database
        if (trackingCode && vouchers.some(v => v.trackingCode === trackingCode)) {
          errors.push({
            index: idx,
            docNumber,
            type: 'DUPLICATE_TRACKING',
            message: `کد رهگیری "${trackingCode}" قبلاً در سیستم استفاده شده است.`
          });
        }

        // Duplicate Tracking Code check inside current import batch
        if (trackingCode && mappedVouchers.some(v => v.trackingCode === trackingCode)) {
          errors.push({
            index: idx,
            docNumber,
            type: 'DUPLICATE_TRACKING',
            message: `کد رهگیری "${trackingCode}" در فایل ورودی تکراری است.`
          });
        }

        // Resolve Person (Warning if not exists)
        const matchedPerson = people.find(p => p.name === personName);
        if (!matchedPerson) {
          warnings.push({
            index: idx,
            message: `طرف حساب "${personName}" در سیستم یافت نشد. این سند بدون اتصال به طرف حساب معتبر ثبت خواهد شد.`
          });
        }

        // Items Array Validation
        const rawItems = raw[config.itemsPath];
        if (!rawItems || !Array.isArray(rawItems)) {
          errors.push({
            index: idx,
            docNumber,
            type: 'SCHEMA_MISMATCH',
            message: `لیست اقلام در مسیر "${config.itemsPath}" در ردیف ${idx + 1} یافت نشد یا ساختار آرایه‌ای ندارد.`
          });
        }

        const voucherItems: VoucherItem[] = [];
        let totalWeight = 0;

        if (rawItems && Array.isArray(rawItems)) {
          rawItems.forEach((itemRaw: any, itemIdx: number) => {
            const prodName = itemRaw[config.itemMapping.productName];
            const qty = Number(itemRaw[config.itemMapping.quantity]);
            const unit = (config.itemMapping.unit ? itemRaw[config.itemMapping.unit] : '') || 'عدد';
            const weight = config.itemMapping.weight ? Number(itemRaw[config.itemMapping.weight] || 0) : 0;
            const shelf = config.itemMapping.shelfLocation ? itemRaw[config.itemMapping.shelfLocation] : '';
            const desc = config.itemMapping.description ? itemRaw[config.itemMapping.description] : '';

            if (!prodName) {
              errors.push({
                index: idx,
                docNumber,
                type: 'MISSING_FIELD',
                message: `نام کالا در آیتم ${itemIdx + 1} از سند ردیف ${idx + 1} خالی است.`
              });
            }

            if (isNaN(qty) || qty <= 0) {
              errors.push({
                index: idx,
                docNumber,
                type: 'INVALID_DATA',
                message: `مقدار کالا در آیتم ${itemIdx + 1} از سند ردیف ${idx + 1} باید عدد مثبت باشد. مقدار دریافتی: ${qty}`
              });
            }

            // Product Lookup (Warning if not exists)
            const matchedProduct = products.find(p => p.name === prodName);
            if (!matchedProduct) {
              warnings.push({
                index: idx,
                message: `کالای "${prodName}" در سیستم یافت نشد. این کالا باید قبل از اعمال نهایی ایجاد شود یا سند با این نام ثبت خواهد شد.`
              });
            }

            totalWeight += weight * (qty || 0);

            voucherItems.push({
              productId: matchedProduct?.id || generateId(),
              productName: prodName || 'کالای نامشخص',
              quantity: qty || 0,
              unit,
              weight: weight || undefined,
              shelfLocation: shelf || undefined,
              description: desc || undefined
            });
          });
        }

        const internalVoucherType = (config.voucherType === 'GOODS_RECEIPT' || config.voucherType === 'PRODUCTION_OUTPUT') ? 'IN' : 'OUT';

        const voucher: Voucher = {
          id: generateId(),
          companyId: 'default',
          number: docNumber || 0,
          trackingCode: trackingCode || generateTrackingCode('VCH', docNumber || 0, rawDate),
          date: rawDate,
          time: rawTime,
          type: internalVoucherType,
          personId: matchedPerson?.id || '',
          personName: personName,
          supervisor,
          vehicleNumber,
          receiverPhone,
          items: voucherItems,
          totalWeight,
          notes: notes,
          status: 'PENDING',
          movementType: config.voucherType as InventoryMovementType
        };

        mappedVouchers.push(voucher);
      });

      // 3. Build Reconciliation Report
      const stockChanges: StockChangeReconciliation[] = [];
      mappedVouchers.forEach(v => {
        v.items.forEach(item => {
          const prod = products.find(p => p.name === item.productName || p.id === item.productId);
          const productId = prod?.id || item.productId;
          const productName = prod?.name || item.productName;
          const beforeStock = prod?.stock || 0;
          
          let changeQty = item.quantity;
          // Subtractions for goods issue or production consumption
          if (v.type === 'OUT') {
            changeQty = -changeQty;
          }

          const existingIdx = stockChanges.findIndex(sc => sc.productId === productId);
          if (existingIdx !== -1) {
            stockChanges[existingIdx].changeQty += changeQty;
            stockChanges[existingIdx].afterStock = Math.max(0, stockChanges[existingIdx].beforeStock + stockChanges[existingIdx].changeQty);
          } else {
            stockChanges.push({
              productId,
              productName,
              beforeStock,
              changeQty,
              afterStock: Math.max(0, beforeStock + changeQty)
            });
          }
        });
      });

      const reconciliationReport = {
        batchId: `IMP-${batchId}`,
        totalVouchers: mappedVouchers.length,
        stockChanges,
        auditSummary: `تعداد ${mappedVouchers.length} سند انبارداری آماده ثبت انبار است.`
      };

      const batch: ImportBatch = {
        id: `IMP-${batchId}`,
        timestamp: `${getPersianDate()} ${getPersianTime()}`,
        status: errors.length > 0 ? 'PENDING_VAL' : 'VALIDATED',
        voucherType: config.voucherType,
        rawCount: rawRecords.length,
        vouchers: mappedVouchers,
        errors,
        warnings,
        reconciliation: reconciliationReport,
        mappingConfig: config,
        offline: !navigator.onLine
      };

      setPreviewBatch(batch);
    } catch (err) {
      alert('خطا در قالب‌بندی فایل JSON: ' + (err as Error).message);
    }
  };

  const handleCommitImport = () => {
    if (!previewBatch) return;
    if (previewBatch.errors.length > 0) {
      alert('نمی‌توان دسته‌ای که حاوی خطای اعتبارسنجی است را نهایی کرد. ابتدا خطاها را برطرف کنید.');
      return;
    }

    addImportBatch(previewBatch);
    commitImportBatch(previewBatch.id, currentUser);
    
    // Clear states
    setPreviewBatch(null);
    setJsonText('');
    setActiveTab('history');
  };

  const handleTriggerRollback = (batchId: string) => {
    setRollbackTargetId(batchId);
  };

  const handleConfirmRollback = () => {
    if (!rollbackTargetId) return;
    rollbackImportBatch(rollbackTargetId, currentUser);
    setRollbackTargetId(null);
    if (selectedBatchDetail?.id === rollbackTargetId) {
      setSelectedBatchDetail(prev => prev ? { ...prev, status: 'ROLLEDBACK' } : null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative z-10 text-right pb-24" dir="rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg border border-white/10 shrink-0">
            <FileSpreadsheet className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">مرکز واردات هوشمند اسناد</h1>
            <p className="text-slate-400 text-xs mt-1.5 font-bold uppercase tracking-wider">Universal Voucher Import Engine</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-950/80 p-2 rounded-2xl border border-white/5 relative z-10 max-w-xs md:max-w-none">
          <button 
            onClick={() => { setActiveTab('import'); setPreviewBatch(null); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'import' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <UploadCloud size={16} />
            <span>واردات جدید</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'history' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <History size={16} />
            <span>تاریخچه و مانیتورینگ</span>
          </button>
        </div>
      </div>

      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Controls Panel */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Form Glass Card */}
            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-3">
                  <Database className="text-teal-400" size={20} />
                  <span>بارگذاری و نگاشت فیلدها</span>
                </h2>
                
                <button 
                  onClick={() => setShowConfigBuilder(!showConfigBuilder)}
                  className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-teal-400 px-4 py-2.5 rounded-xl font-black transition-all flex items-center gap-2"
                >
                  <Settings size={14} />
                  <span>{showConfigBuilder ? 'بستن تنظیمات نگاشت' : 'تعریف الگوی جدید'}</span>
                </button>
              </div>

              {/* Mapping Config Builder Form */}
              {showConfigBuilder && (
                <div className="bg-slate-950/50 border border-teal-500/20 p-6 rounded-3xl space-y-6 animate-slide-down">
                  <h3 className="text-sm font-black text-teal-400 flex items-center gap-2">
                    <Plus size={16} />
                    <span>ایجاد الگوی نگاشت جدید فیلدها</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 pr-2 font-black">نام الگو</label>
                      <input 
                        type="text" 
                        placeholder="مانند: وب‌سرویس دیجی‌کالا" 
                        value={newConfigName} 
                        onChange={e => setNewConfigName(e.target.value)} 
                        className="w-full bg-slate-900 border border-white/5 rounded-xl p-3.5 text-xs text-white outline-none focus:border-teal-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 pr-2 font-black">نوع سند هدف</label>
                      <select 
                        value={newConfigType} 
                        onChange={e => setNewConfigType(e.target.value as ImportMappingConfig['voucherType'])}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl p-3.5 text-xs text-white outline-none focus:border-teal-500 transition-all font-black"
                      >
                        <option value="GOODS_RECEIPT">رسید ورود کالا (GOODS_RECEIPT)</option>
                        <option value="GOODS_ISSUE">حواله خروج کالا (GOODS_ISSUE)</option>
                        <option value="INVENTORY_ADJUSTMENT">تعدیل انبار (INVENTORY_ADJUSTMENT)</option>
                        <option value="PRODUCTION_CONSUMPTION">مصرف تولید (PRODUCTION_CONSUMPTION)</option>
                        <option value="PRODUCTION_OUTPUT">خروجی تولید (PRODUCTION_OUTPUT)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 pr-2 font-black">مسیر آرایه کالاها (JSON Path)</label>
                      <input 
                        type="text" 
                        placeholder="مانند: items یا products" 
                        value={newItemsPath} 
                        onChange={e => setNewItemsPath(e.target.value)} 
                        className="w-full bg-slate-900 border border-white/5 rounded-xl p-3.5 text-xs text-white outline-none focus:border-teal-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-xs font-black text-slate-300 mb-3">۱. نگاشت فیلدهای اصلی سند (سند ورودی → سیستم هدف)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.keys(newRootMapping).map((key) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[10px] text-slate-400 font-bold pr-1 capitalize">{key === 'number' ? 'شماره سند *' : key === 'trackingCode' ? 'کد رهگیری *' : key}</label>
                          <input 
                            type="text" 
                            value={(newRootMapping as any)[key]} 
                            onChange={e => {
                              const val = e.target.value;
                              setNewRootMapping(prev => ({ ...prev, [key]: val }));
                            }}
                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-teal-500 transition-all font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-xs font-black text-slate-300 mb-3">۲. نگاشت فیلدهای اقلام کالاها (سند ورودی → سیستم هدف)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.keys(newItemMapping).map((key) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[10px] text-slate-400 font-bold pr-1 capitalize">{key === 'productName' ? 'نام کالا *' : key === 'quantity' ? 'مقدار *' : key}</label>
                          <input 
                            type="text" 
                            value={(newItemMapping as any)[key]} 
                            onChange={e => {
                              const val = e.target.value;
                              setNewItemMapping(prev => ({ ...prev, [key]: val }));
                            }}
                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-teal-500 transition-all font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
                    <button 
                      onClick={() => setShowConfigBuilder(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-400 font-black hover:text-white"
                    >
                      انصراف
                    </button>
                    <button 
                      onClick={handleSaveConfig}
                      className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs text-white font-black shadow-lg"
                    >
                      ذخیره الگو
                    </button>
                  </div>
                </div>
              )}

              {/* Config Selector */}
              {!showConfigBuilder && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/30 p-4 rounded-3xl border border-white/5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 pr-2 font-black">الگوی فعال فیلدها</label>
                    <select 
                      value={selectedConfigId}
                      onChange={e => setSelectedConfigId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-xs text-teal-400 outline-none focus:border-teal-500 font-black"
                    >
                      {importConfigs.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end pr-4 text-slate-400 text-xs">
                    <Info size={16} className="text-teal-500 shrink-0" />
                    <span>فایل‌های ارسالی با فیلدهای الگوی انتخاب شده مطابقت داده خواهند شد.</span>
                  </div>
                </div>
              )}

              {/* Upload Drop Zone / Paste JSON Area */}
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center transition-all ${dragActive ? 'border-teal-500 bg-teal-500/5' : 'border-white/10 hover:border-white/20 bg-slate-950/20'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="text-slate-500 w-12 h-12 mb-4 animate-pulse" />
                  <span className="text-sm font-black text-slate-300">کشیدن و رها کردن فایل JSON اسناد در این بخش</span>
                  <span className="text-[10px] text-slate-500 mt-2 font-bold">یا فایل را به طور مستقیم انتخاب کنید</span>
                  
                  <input 
                    type="file" 
                    accept=".json"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 bg-slate-800 hover:bg-slate-700 border border-white/5 text-white font-black text-xs px-6 py-3 rounded-xl transition-all"
                  >
                    انتخاب فایل JSON
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-500 pr-4 font-black">یا داده‌های JSON را در این بخش پیست کنید (شبیه‌ساز وب‌سرویس/API)</label>
                  <textarea
                    rows={8}
                    placeholder={`[
  {
    "document_number": 1001,
    "tracking_code": "TRK-001",
    "date": "1402/10/15",
    "person_name": "شرکت پخش آریا",
    "items": [
      { "product_name": "نام کالا", "qty": 15, "unit": "عدد" }
    ]
  }
]`}
                    value={jsonText}
                    onChange={e => setJsonText(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-[2rem] p-5 text-xs text-slate-300 outline-none focus:border-teal-500 font-mono transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>

              {/* Actions Button */}
              <div className="flex gap-4 border-t border-white/5 pt-6">
                <button
                  onClick={validateAndMap}
                  className="flex-1 bg-gradient-to-br from-teal-500 to-emerald-600 text-white py-4.5 rounded-2xl font-black text-sm shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  <span>اعتبارسنجی و تطبیق اولیه اسناد</span>
                </button>
                
                {jsonText && (
                  <button
                    onClick={() => { setJsonText(''); setPreviewBatch(null); }}
                    className="bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-400 font-black text-sm px-6 rounded-2xl transition-all"
                    title="پاک کردن"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Validation & Preview Section */}
            {previewBatch && (
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden animate-slide-up">
                
                {/* Heading */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <Layers className="text-teal-400" size={20} />
                    <h2 className="text-lg font-black text-white">پیش‌نمایش اسناد نگاشت‌شده ({toPersianDigits(previewBatch.vouchers.length)} سند)</h2>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {previewBatch.errors.length > 0 ? (
                      <span className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3.5 py-1.5 rounded-xl text-[10px] font-black animate-pulse">
                        <AlertCircle size={12} />
                        <span>{toPersianDigits(previewBatch.errors.length)} خطا یافت شد</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 px-3.5 py-1.5 rounded-xl text-[10px] font-black">
                        <CheckCircle2 size={12} />
                        <span>کاملاً معتبر</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Batch Errors and Warnings Banner */}
                {(previewBatch.errors.length > 0 || previewBatch.warnings.length > 0) && (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {previewBatch.errors.map((err, i) => (
                      <div key={i} className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl flex items-start gap-3 text-xs text-rose-400">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black">سند ردیف {toPersianDigits(err.index + 1)} {err.docNumber ? `(شماره ${toPersianDigits(err.docNumber)})` : ''}:</span>
                          <span className="mr-1">{err.message}</span>
                        </div>
                      </div>
                    ))}
                    {previewBatch.warnings.map((warn, i) => (
                      <div key={i} className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-400">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black">ردیف {toPersianDigits(warn.index + 1)}:</span>
                          <span className="mr-1">{warn.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Vouchers Preview Table */}
                <div className="overflow-x-auto border border-white/5 rounded-3xl bg-slate-950/20">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-white/5 text-[10px] font-black text-slate-400">
                        <th className="p-4">شماره سند</th>
                        <th className="p-4">کد رهگیری</th>
                        <th className="p-4">طرف حساب</th>
                        <th className="p-4">تاریخ</th>
                        <th className="p-4">تعداد اقلام</th>
                        <th className="p-4 text-left">مجموع وزن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {previewBatch.vouchers.map((v, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all">
                          <td className="p-4 font-mono font-bold">{toPersianDigits(v.number)}</td>
                          <td className="p-4 text-slate-500 font-mono text-[10px]">{v.trackingCode}</td>
                          <td className="p-4 font-black">{v.personName}</td>
                          <td className="p-4 font-mono text-slate-400">{toPersianDigits(v.date)}</td>
                          <td className="p-4">{toPersianDigits(v.items.length)} ردیف</td>
                          <td className="p-4 text-left font-mono text-slate-400">{v.totalWeight ? `${toPersianDigits(v.totalWeight.toLocaleString())} کیلوگرم` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Commit Trigger */}
                <div className="flex items-center justify-between border-t border-white/5 pt-6 bg-slate-950/10 -mx-8 -mb-8 p-8 mt-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-black">فرآیند نهایی‌سازی اسناد</p>
                    <p className="text-[10px] text-slate-400 mt-1">با کلیک روی دکمه مقابل، اسناد در پایگاه داده انبارداری ثبت نهایی شده و موجودی انبار به طور خودکار تغییر می‌یابد.</p>
                  </div>
                  
                  <button
                    disabled={previewBatch.errors.length > 0}
                    onClick={handleCommitImport}
                    className={`px-8 py-4 rounded-xl font-black text-xs shadow-lg transition-all ${previewBatch.errors.length > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}
                  >
                    ثبت نهایی و به‌روزرسانی انبار
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Reconciliation Report Panel */}
          <div className="space-y-8">
            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-[80px] pointer-events-none"></div>
              
              <h2 className="text-lg font-black text-white flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                <ArrowUpDown className="text-teal-400" size={20} />
                <span>گزارش تطبیق موجودی (Reconciliation)</span>
              </h2>

              {previewBatch ? (
                <div className="space-y-6">
                  
                  {/* Status Info */}
                  <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} className="text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">تأثیرگذاری روی {toPersianDigits(previewBatch.reconciliation.stockChanges.length)} کالا</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">موجودی انبار پیش از ثبت نهایی تغییر نخواهد کرد.</p>
                    </div>
                  </div>

                  {/* Stock Changes List */}
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {previewBatch.reconciliation.stockChanges.map((sc, i) => {
                      const isAddition = sc.changeQty > 0;
                      return (
                        <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3 hover:border-white/10 transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{sc.productName}</span>
                            <span className={`text-xs font-black font-mono px-2 py-1 rounded-lg ${isAddition ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {isAddition ? '+' : ''}{toPersianDigits(sc.changeQty)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>موجودی فعلی: {toPersianDigits(sc.beforeStock)}</span>
                            <span>پیش‌بینی موجودی: {toPersianDigits(sc.afterStock)}</span>
                          </div>
                          
                          {/* Stock Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isAddition ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, Math.max(10, (sc.afterStock / (sc.beforeStock || 1)) * 50))}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                  <Database size={40} className="text-slate-700 mb-3" />
                  <p className="text-xs font-black">منتظر اعتبارسنجی داده‌ها</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">پس از اعتبارسنجی، پیش‌بینی تغییرات موجودی کالاها در این کادر نمایش داده می‌شود.</p>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* History Table */}
            <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl space-y-6">
              <h2 className="text-lg font-black text-white flex items-center gap-3 border-b border-white/5 pb-4">
                <History className="text-teal-400" size={20} />
                <span>تاریخچه دسته‌های وارد شده</span>
              </h2>

              {importBatches.length > 0 ? (
                <div className="overflow-x-auto border border-white/5 rounded-3xl bg-slate-950/20">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-white/5 text-[10px] font-black text-slate-400">
                        <th className="p-4">شناسه دسته</th>
                        <th className="p-4">زمان واردات</th>
                        <th className="p-4">نوع حواله</th>
                        <th className="p-4">تعداد اسناد</th>
                        <th className="p-4">وضعیت</th>
                        <th className="p-4 text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {importBatches.map((batch) => (
                        <tr 
                          key={batch.id} 
                          onClick={() => setSelectedBatchDetail(batch)}
                          className={`hover:bg-white/5 transition-all cursor-pointer ${selectedBatchDetail?.id === batch.id ? 'bg-white/5' : ''}`}
                        >
                          <td className="p-4 font-mono font-bold text-teal-400">{batch.id}</td>
                          <td className="p-4 font-mono text-slate-400">{toPersianDigits(batch.timestamp)}</td>
                          <td className="p-4">
                            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-black">
                              {batch.voucherType === 'GOODS_RECEIPT' ? 'رسید ورود کالا' : batch.voucherType === 'GOODS_ISSUE' ? 'حواله خروج کالا' : 'تعدیل انبار'}
                            </span>
                          </td>
                          <td className="p-4">{toPersianDigits(batch.rawCount)} سند</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                              batch.status === 'COMMITTED' ? 'bg-emerald-500/10 text-emerald-400' :
                              batch.status === 'ROLLEDBACK' ? 'bg-rose-500/10 text-rose-400 line-through' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {batch.status === 'COMMITTED' ? 'ثبت نهایی شده' :
                               batch.status === 'ROLLEDBACK' ? 'بازگردانی شده' : 'بررسی نشده'}
                            </span>
                          </td>
                          <td className="p-4 text-left" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2 justify-end">
                              <button 
                                onClick={() => setSelectedBatchDetail(batch)}
                                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300 transition-all"
                                title="مشاهده گزارش"
                              >
                                <Eye size={14} />
                              </button>
                              
                              {batch.status === 'COMMITTED' && (
                                <button 
                                  onClick={() => handleTriggerRollback(batch.id)}
                                  className="bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-xl text-rose-400 transition-all border border-rose-500/20"
                                  title="بازگردانی دسته (Rollback)"
                                >
                                  <CornerUpLeft size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                  <FileJson size={48} className="text-slate-700 mb-4 animate-bounce" />
                  <p className="text-sm font-black">تاریخچه واردات خالی است</p>
                  <p className="text-xs text-slate-600 mt-2">هنوز هیچ فایلی به پایگاه داده وارد نشده است.</p>
                </div>
              )}
            </div>

            {/* Sidebar Batch Detail Viewer */}
            <div className="space-y-8">
              <div className="bg-slate-900/40 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                
                <h2 className="text-lg font-black text-white flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                  <Layers className="text-teal-400" size={20} />
                  <span>جزئیات دسته وارداتی</span>
                </h2>

                {selectedBatchDetail ? (
                  <div className="space-y-6">
                    <div className="bg-slate-950/50 p-4 rounded-2xl space-y-3 border border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">شناسه رهگیری دسته:</span>
                        <span className="font-mono text-teal-400 font-black">{selectedBatchDetail.id}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">زمان ثبت واردات:</span>
                        <span className="font-mono text-slate-300">{toPersianDigits(selectedBatchDetail.timestamp)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">تعداد کل اسناد:</span>
                        <span className="text-slate-300">{toPersianDigits(selectedBatchDetail.rawCount)} سند</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">وضعیت دسته:</span>
                        <span className={`font-black ${
                          selectedBatchDetail.status === 'COMMITTED' ? 'text-emerald-400' :
                          selectedBatchDetail.status === 'ROLLEDBACK' ? 'text-rose-400 line-through' :
                          'text-amber-400'
                        }`}>{selectedBatchDetail.status === 'COMMITTED' ? 'ثبت نهایی شده' :
                             selectedBatchDetail.status === 'ROLLEDBACK' ? 'بازگردانی شده' : 'بررسی نشده'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">نوع بارگذاری:</span>
                        <span className="text-slate-300">{selectedBatchDetail.offline ? 'آفلاین' : 'آنلاین / API'}</span>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-4">
                      <h4 className="text-xs font-black text-slate-300 flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-teal-400" />
                        <span>گزارش مغایرت‌های انبار کالاها</span>
                      </h4>

                      <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedBatchDetail.reconciliation.stockChanges.map((sc, i) => {
                          const isAddition = sc.changeQty > 0;
                          return (
                            <div key={i} className="bg-slate-950/30 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="font-black text-white">{sc.productName}</p>
                                <p className="text-[10px] text-slate-500 mt-1">تغییر موجودی از {toPersianDigits(sc.beforeStock)} به {toPersianDigits(sc.afterStock)}</p>
                              </div>
                              <span className={`font-black font-mono ${isAddition ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isAddition ? '+' : ''}{toPersianDigits(sc.changeQty)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {selectedBatchDetail.status === 'COMMITTED' && (
                      <button
                        onClick={() => handleTriggerRollback(selectedBatchDetail.id)}
                        className="w-full bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-4"
                      >
                        <CornerUpLeft size={16} />
                        <span>انجام بازگردانی دسته (Rollback)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                    <Info size={36} className="text-slate-700 mb-3" />
                    <p className="text-xs font-black">یک دسته را از جدول انتخاب کنید</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">برای مشاهده جزئیات گزارش مغایرت و کنترل بازگردانی، روی یکی از ردیف‌های تاریخچه کلیک کنید.</p>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* Confirm Rollback Modal */}
      {rollbackTargetId && (
        <ConfirmModal
          isOpen={!!rollbackTargetId}
          onClose={() => setRollbackTargetId(null)}
          onConfirm={handleConfirmRollback}
          title="تأیید بازگردانی اسناد وارداتی"
          message={`آیا مطمئن هستید که می‌خواهید دسته وارداتی با شناسه ${rollbackTargetId} را بازگردانید؟ با این کار تمامی اسناد این دسته به صورت فیزیکی حذف شده و مقادیر انبار کالاها دقیقاً به حالت قبل معکوس می‌گردد.`}
          confirmText="بله، بازگردانی شود"
          type="warning"
        />
      )}

    </div>
  );
};

export default ImportCenter;
