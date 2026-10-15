
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { Product, Voucher, Person, PrintTheme, VoucherItem, LogisticsProfile, VoucherTemplate } from '../types';
import { generateId, toPersianDigits, formatCurrency, generateTrackingCode, getPersianDate, getPersianTime, fileToBase64, getNextCustomerCode, getNextProductCode } from '../utils';
import { Plus, Package, FileOutput, Printer, X, Trash2, ArrowLeft, History, Eye, Truck, AlignLeft, BookMarked, Camera, CheckCircle2, FileSpreadsheet, PackagePlus, CarFront, UserCheck, Bot, Sparkles, Scale, MapPinned, UserPlus, Info, Link as LinkIcon, Smartphone, Weight, Search, LayoutGrid, List, Layers, ShoppingBag, Image as ImageIcon, Share2, Download, Palette, PenTool, Banknote, QrCode, FileText, Send, AlertTriangle, TrendingUp, TrendingDown, BarChart3, Undo2, Save, Copy, Barcode, Scan, HelpCircle, Shuffle } from 'lucide-react';
import { NumberInput, FullScreenSignatureModal, ConfirmModal, JalaliDatePicker, useKeyboardShortcut } from '../components/Shared';
import { VoucherPrint } from '../components/VoucherPrint';
import { RequestSignatureButton } from '../components/RequestSignatureButton';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { analyzeInventoryStock } from '../services/geminiService';
import ExcelImport from '../components/ExcelImport';
import html2canvas from 'html2canvas';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { MobileVoucherWizard } from '../components/MobileVoucherWizard';
import { useMobile } from '../useMobile';
import { generateAutoSerialNumber, initHardwareBarcodeScanner } from '../services/barcodeService';

const Inventory = () => {
  const { products, people, invoices, addProduct, updateProduct, deleteProduct, addPerson, deleteVoucher, vouchers, addVoucher, setVoucherSignature, setVoucherCompanySignature, setVoucherSupervisorSignature, lastVoucherNumber, companies, logisticsProfiles, addLogisticsProfile } = useStore();
  
  const [view, setView] = useState<'main' | 'preview' | 'voucher'>('main');
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'history'>('history');
  
  // Modals & States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState<'products' | 'people' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'voucher' | 'product', id: string} | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [activeSignRole, setActiveSignRole] = useState<'company' | 'supervisor' | 'receiver'>('receiver');
  const [printTheme, setPrintTheme] = useState<PrintTheme>('smart');
  
  const [showImportJsonModal, setShowImportJsonModal] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'voucher' | 'product_serial' | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('ALL');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnVoucherId, setReturnVoucherId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [voucherTemplates, setVoucherTemplates] = useState<VoucherTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form States
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [voucherItems, setVoucherItems] = useState<VoucherItem[]>([]);
  const [voucherType, setVoucherType] = useState<'IN'|'OUT'|'RETURN'>('OUT');
  const [voucherPersonId, setVoucherPersonId] = useState('');
  const [voucherRelatedInvoiceId, setVoucherRelatedInvoiceId] = useState('');
  const [voucherSupervisor, setVoucherSupervisor] = useState('');
  const [voucherVehicle, setVoucherVehicle] = useState({ part1: '', part2: 'ب', part3: '', part4: '' });
  const [voucherPhone, setVoucherPhone] = useState('');
  const [voucherDate, setVoucherDate] = useState(getPersianDate());
  const [voucherTracking, setVoucherTracking] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState<string[]>([]);
  const [voucherStatus, setVoucherStatus] = useState<'PENDING' | 'IN_TRANSIT' | 'DELIVERED'>('PENDING');
  
  // Mobile Wizard State
  const { isMobile } = useMobile();
  const [wizardMode, setWizardMode] = useState<boolean | null>(null);
  const isWizardActive = wizardMode !== null ? wizardMode : isMobile;

  const handleSaveVoucherFromWizard = (voucher: Voucher) => {
    const fullPlate = voucher.vehicleNumber || '';
    if (voucher.supervisor && voucher.receiverPhone) {
      addLogisticsProfile({ id: generateId(), name: voucher.supervisor, phone: voucher.receiverPhone, vehicleNumber: fullPlate });
    }

    const voucherPreview = JSON.stringify({
      type: 'voucher',
      number: voucher.number,
      date: voucher.date,
      time: voucher.time,
      voucherType: voucher.type === 'OUT' ? 'خروج' : voucher.type === 'IN' ? 'ورود' : 'برگشت',
      person: voucher.personName,
      items: voucher.items.map(i => ({ 
        name: i.productName, 
        productName: i.productName,
        quantity: i.quantity, 
        unit: i.unit,
        shelfLocation: i.shelfLocation
      })),
      totalWeight: voucher.totalWeight,
      trackingCode: voucher.trackingCode,
      supervisor: voucher.supervisor,
      vehicleNumber: fullPlate,
      receiverPhone: voucher.receiverPhone,
      loadingPhotos: voucher.loadingPhotos,
      notes: voucher.notes,
      status: voucher.status,
      signature: null,
      supervisorSignature: null,
      companySignature: null
    });
    sessionStorage.setItem(`voucher_preview_${voucher.id}`, voucherPreview);
    
    addVoucher(voucher);
    setSelectedVoucherId(voucher.id);
    setView('main');
  };
  
  const [newProd, setNewProd] = useState<Partial<Product>>({ name: '', unit: 'عدد', weight: 0, shelfLocation: '' });
  const [newPers, setNewPers] = useState<Partial<Person>>({ name: '', phone: '', category: 'مشتری عادی' });

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const saved = localStorage.getItem('voucherTemplates');
      if (saved) setVoucherTemplates(JSON.parse(saved));
      
      // بررسی پارامترهای آدرس برای اکشن ثبت سریع کالا
      const hash = window.location.hash;
      const queryIndex = hash.indexOf('?');
      if (queryIndex !== -1) {
          const queryString = hash.slice(queryIndex);
          const params = new URLSearchParams(queryString);
          const action = params.get('action');
          if (action === 'new-product') {
              setActiveSubTab('products');
              setShowAddProduct(true);
              window.location.hash = hash.slice(0, queryIndex);
          }
      }
  }, []);

  useEffect(() => {
      // Auto-generate tracking code when date changes or new voucher
      if (view === 'voucher' && !voucherTracking) {
          setVoucherTracking(generateTrackingCode('VCH', lastVoucherNumber + 1, voucherDate));
      }
  }, [view, voucherDate, lastVoucherNumber]);

  // Available Invoices for linking
  const availableInvoices = useMemo(() => {
      if (!voucherPersonId) return [];
      return invoices.filter(i => i.personId === voucherPersonId).sort((a,b) => b.number - a.number);
  }, [voucherPersonId, invoices]);

  // Statistics
  const stats = useMemo(() => {
    const totalWeight = voucherItems.reduce((sum, item) => sum + ((item.weight || 0) * item.quantity), 0);
    const estimatedValue = voucherItems.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.productId);
        return sum + ((prod?.sellPrice || 0) * item.quantity);
    }, 0);
    return { totalWeight, estimatedValue };
  }, [voucherItems, products]);

  const lowStockProducts = useMemo(() => 
      products.filter(p => p.stock <= (p.minStock || 5)),
  [products]);

  // استخراج دسته‌های اصلی و زیرمجموعه‌ها
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products]);

  const subCategoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter) {
        if (p.subCategory?.trim()) set.add(p.subCategory.trim());
      }
    });
    return Array.from(set);
  }, [products, selectedCategoryFilter]);

  const filteredProducts = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return products.filter(p => {
      // فیلتر دسته اصلی
      if (selectedCategoryFilter !== 'ALL' && p.category !== selectedCategoryFilter) {
        return false;
      }
      // فیلتر زیرمجموعه
      if (selectedSubCategoryFilter !== 'ALL' && p.subCategory !== selectedSubCategoryFilter) {
        return false;
      }
      // فیلتر متنی: نام، کد، شماره سریال و مسیر دسته‌بندی
      if (!q) return true;
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCode = (p.code || '').toLowerCase().includes(q);
      const matchSerial = (p.serialNumber || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      const matchSub = (p.subCategory || '').toLowerCase().includes(q);
      const matchPath = (p.categoryPath || '').toLowerCase().includes(q);
      return matchName || matchCode || matchSerial || matchCat || matchSub || matchPath;
    });
  }, [products, searchTerm, selectedCategoryFilter, selectedSubCategoryFilter]);

  // شنونده سراسری اسکنر بارکدخوان دستی
  useEffect(() => {
    const unsubscribeScanner = initHardwareBarcodeScanner((scannedCode) => {
      if (showAddProduct) {
        // اسکن مستقیم شماره سریال در فرم تعریف کالا
        setNewProd(prev => ({ ...prev, serialNumber: scannedCode }));
      } else if (view === 'voucher') {
        handleBarcodeScanned(scannedCode);
      } else if (activeSubTab === 'products') {
        setSearchTerm(scannedCode);
      }
    });

    return () => unsubscribeScanner();
  }, [showAddProduct, view, activeSubTab, products, voucherItems]);

  // Handle Export Image
  const handleExportImage = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
    const link = document.createElement('a');
    link.download = `Voucher-${vouchers.find(v => v.id === selectedVoucherId)?.trackingCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const generateRemoteSignLink = async (role: string) => {
    try {
      const v = vouchers.find(x => x.id === selectedVoucherId);
      if (!v) return;
      
      let docPreview = '';
      const voucherPreview = sessionStorage.getItem(`voucher_preview_${v.id}`);
      if (voucherPreview) {
        docPreview = voucherPreview;
      } else {
        const voucherData = {
          type: 'voucher',
          number: v.number,
          date: v.date,
          time: v.time,
          voucherType: v.type === 'OUT' ? 'خروج' : v.type === 'IN' ? 'ورود' : 'برگشت',
          person: v.personName,
          items: v.items.map(i => ({ 
            name: i.productName, 
            productName: i.productName,
            quantity: i.quantity, 
            unit: i.unit,
            shelfLocation: i.shelfLocation
          })),
          totalWeight: v.totalWeight,
          trackingCode: v.trackingCode,
          supervisor: v.supervisor,
          vehicleNumber: v.vehicleNumber,
          receiverPhone: v.receiverPhone,
          loadingPhotos: v.loadingPhotos || [],
          notes: v.notes,
          status: v.status,
          signature: v.signature,
          supervisorSignature: v.supervisorSignature,
          companySignature: v.companySignature
        };
        docPreview = JSON.stringify(voucherData);
      }
      
      const token = await simpleSignatureService.createRequest(v.id, 'رسید', docPreview);
      const url = `${window.location.origin}${window.location.pathname}#/sign/${token}`;
      
      if (navigator.clipboard && window.isSecureContext) {
          try {
              await navigator.clipboard.writeText(url);
              alert('لینک امضای راه دور کپی شد. می‌توانید آن را برای مشتری یا راننده ارسال کنید.');
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

  const handleSaveVoucher = () => {
      if (!voucherPersonId || voucherItems.length === 0) return alert('اطلاعات ناقص است (طرف حساب و اقلام الزامی است).');
      const person = people.find(p => p.id === voucherPersonId);
      const fullPlate = `${voucherVehicle.part1} ${voucherVehicle.part2} ${voucherVehicle.part3} ${voucherVehicle.part4}`.trim();
      const nextNum = lastVoucherNumber + 1;
      
      if (voucherSupervisor && voucherPhone) {
          addLogisticsProfile({ id: generateId(), name: voucherSupervisor, phone: voucherPhone, vehicleNumber: fullPlate });
      }

      const sortedItems = [...voucherItems].sort((a, b) => (a.shelfLocation || '').localeCompare(b.shelfLocation || ''));

      const voucher: Voucher = { 
          id: generateId(), companyId: companies.find(c => c.isActive)?.id || 'default', 
          number: nextNum, trackingCode: voucherTracking || generateTrackingCode('VCH', nextNum, voucherDate), 
          date: voucherDate, time: getPersianTime(), type: voucherType, 
          personId: voucherPersonId, personName: person?.name || 'ناشناس', 
          relatedInvoiceId: voucherRelatedInvoiceId || undefined,
          supervisor: voucherSupervisor, vehicleNumber: fullPlate, 
          receiverPhone: voucherPhone, 
          items: sortedItems, 
          totalWeight: stats.totalWeight, estimatedValue: stats.estimatedValue, 
          loadingPhotos: loadingPhotos, notes: voucherNotes,
          status: voucherStatus
      };
      
      // ذخیره پیشنمایش کامل برای امضا
      const voucherPreview = JSON.stringify({
        type: 'voucher',
        number: voucher.number,
        date: voucher.date,
        time: voucher.time,
        voucherType: voucher.type === 'OUT' ? 'خروج' : voucher.type === 'IN' ? 'ورود' : 'برگشت',
        person: voucher.personName,
        items: voucher.items.map(i => ({ 
          name: i.productName, 
          productName: i.productName,
          quantity: i.quantity, 
          unit: i.unit,
          shelfLocation: i.shelfLocation
        })),
        totalWeight: voucher.totalWeight,
        trackingCode: voucher.trackingCode,
        supervisor: voucher.supervisor,
        vehicleNumber: fullPlate,
        receiverPhone: voucherPhone,
        loadingPhotos: loadingPhotos,
        notes: voucherNotes,
        status: voucherStatus,
        signature: null,
        supervisorSignature: null,
        companySignature: null
      });
      sessionStorage.setItem(`voucher_preview_${voucher.id}`, voucherPreview);
      
      addVoucher(voucher);
      setVoucherItems([]);
      setLoadingPhotos([]);
      setVoucherNotes('');
      setVoucherTracking('');
      setVoucherRelatedInvoiceId('');
      setVoucherStatus('PENDING');
      setView('main');
  };

  const handleSaveTemplate = () => {
      if (voucherItems.length === 0) return alert('لیست اقلام خالی است');
      const name = prompt('نام الگو:');
      if (!name) return;
      const template: VoucherTemplate = {
          id: generateId(),
          name,
          items: voucherItems,
          description: voucherNotes
      };
      setVoucherTemplates([...voucherTemplates, template]);
      localStorage.setItem('voucherTemplates', JSON.stringify([...voucherTemplates, template]));
      alert('✅ الگو ذخیره شد');
  };

  const handleLoadTemplate = (template: VoucherTemplate) => {
      setVoucherItems(template.items);
      setVoucherNotes(template.description || '');
      setShowTemplates(false);
  };

  const handleReturnVoucher = () => {
      if (!returnVoucherId || !returnReason) return alert('لطفاً دلیل برگشت را وارد کنید');
      const originalVoucher = vouchers.find(v => v.id === returnVoucherId);
      if (!originalVoucher) return;
      
      const returnVoucher: Voucher = {
          ...originalVoucher,
          id: generateId(),
          number: lastVoucherNumber + 1,
          type: 'RETURN',
          relatedVoucherId: returnVoucherId,
          returnReason,
          date: getPersianDate(),
          time: getPersianTime(),
          trackingCode: generateTrackingCode('RTN', lastVoucherNumber + 1, getPersianDate())
      };
      
      addVoucher(returnVoucher);
      setShowReturnModal(false);
      setReturnVoucherId(null);
      setReturnReason('');
      alert('✅ حواله برگشتی ثبت شد');
  };

  const handleBarcodeScanned = (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (scanTarget === 'product_serial') {
          setNewProd(prev => ({ ...prev, serialNumber: cleanCode }));
          setShowAddProduct(true);
          setShowBarcodeScanner(false);
          setScanTarget(null);
          alert(`✅ شماره سریال اسکن شد: ${cleanCode}`);
          return;
      }

      // جستجو در محصولات با کد، سریال یا شناسه
      const product = products.find(p => p.code === cleanCode || p.serialNumber === cleanCode || p.id === cleanCode);
      if (product) {
          const existing = voucherItems.find(i => i.productId === product.id);
          if (existing) {
              setVoucherItems(voucherItems.map(i => 
                  i.productId === product.id ? {...i, quantity: i.quantity + 1} : i
              ));
          } else {
              setVoucherItems([...voucherItems, {
                  productId: product.id,
                  productName: product.name,
                  quantity: 1,
                  unit: product.unit,
                  weight: product.weight,
                  shelfLocation: product.shelfLocation
              }]);
          }
          alert(`✅ کالای ${product.name} اضافه شد.`);
      } else {
          // اگر پیدا نشد و در حالت انبار است، پیشنهاد تعریف کالا با این سریال
          if (confirm(`کالایی با بارکد/سریال «${cleanCode}» یافت نشد. آیا مایل به تعریف کالای جدید با این سریال هستید؟`)) {
              setNewProd({
                  name: '',
                  serialNumber: cleanCode,
                  unit: 'عدد',
                  stock: 0,
                  buyPrice: 0,
                  sellPrice: 0
              });
              setShowAddProduct(true);
          }
      }
      setShowBarcodeScanner(false);
      setScanTarget(null);
  };

  const recallDriver = (profile: LogisticsProfile) => {
      setVoucherSupervisor(profile.name);
      setVoucherPhone(profile.phone);
      const parts = profile.vehicleNumber.split(' ');
      if (parts.length === 4) {
          setVoucherVehicle({ part1: parts[0], part2: parts[1], part3: parts[2], part4: parts[3] });
      }
  };

  const parseProductsSummary = (summary: string) => {
    if (!summary) return [];
    const lines = summary.split(/[|\n]/).map(line => line.trim()).filter(line => line !== '');
    return lines.map(line => {
      const parts = line.split('/').map(p => p.trim());
      const productName = parts[0] || '';
      
      let quantity = 1;
      let unit = 'عدد';
      let shelfLocation = '';
      let weight = 0;
      let value = 0;
      let description = '';

      parts.forEach(part => {
        const cleanPart = part.trim();
        if (cleanPart.startsWith('تعداد:')) {
          const qtyStr = cleanPart.replace('تعداد:', '').trim();
          const numMatch = qtyStr.match(/[\d,.]+/);
          if (numMatch) {
            quantity = Number(numMatch[0].replace(/,/g, ''));
          }
          const unitStr = qtyStr.replace(/[\d,.\s]+/g, '').trim();
          if (unitStr) {
            unit = unitStr;
          }
        } else if (cleanPart.startsWith('قفسه:')) {
          shelfLocation = cleanPart.replace('قفسه:', '').trim();
        } else if (cleanPart.startsWith('وزن:')) {
          const wStr = cleanPart.replace('وزن:', '').trim();
          const numMatch = wStr.match(/[\d,.]+/);
          if (numMatch) {
            weight = Number(numMatch[0].replace(/,/g, ''));
          }
        } else if (cleanPart.startsWith('ارزش:')) {
          const vStr = cleanPart.replace('ارزش:', '').trim();
          const numMatch = vStr.match(/[\d,.]+/);
          if (numMatch) {
            value = Number(numMatch[0].replace(/,/g, ''));
          }
        } else if (cleanPart.startsWith('توضیحات:')) {
          description = cleanPart.replace('توضیحات:', '').trim();
        }
      });

      return {
        productName,
        quantity,
        unit,
        shelfLocation,
        weight,
        value,
        description
      };
    });
  };

  const processImportJson = (text: string, showAlertOnError = true) => {
    try {
      let cleanText = text.trim();
      if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
        cleanText = cleanText.substring(1, cleanText.length - 1);
      }
      
      // Unescape escaped quotes if double escaped
      if (cleanText.includes('\\"')) {
        try {
          const parsedOnce = JSON.parse(`"${cleanText}"`);
          cleanText = parsedOnce;
        } catch(e) {}
      }

      cleanText = cleanText.replace(/(:\s*)(\d+(?:,\d+)+(?:\.\d+)?)/g, (match, prefix, numStr) => {
        return prefix + numStr.replace(/,/g, '');
      });

      const data = JSON.parse(cleanText);
      
      // receipt can be wrapped in "receipt" key, or directly at root level
      const receipt = data.receipt || data;
      
      if (!receipt || (!receipt.trackingCode && !receipt.productsSummary)) {
        if (showAlertOnError) {
          alert('قالب متن نامعتبر است. ساختار باید شامل مشخصات حواله و خلاصه کالاها باشد.');
        }
        return false;
      }

      // 1. Match or create Person
      let personId = '';
      const recipientName = receipt.recipientName || 'شخص ناشناس';
      const existingPerson = people.find(p => p.name === recipientName);
      if (existingPerson) {
        personId = existingPerson.id;
      } else {
        personId = generateId();
        addPerson({
          id: personId,
          name: recipientName,
          balance: 0,
          code: getNextCustomerCode(people),
          isCustomer: true,
          category: 'مشتری عادی'
        } as Person);
      }

      // 2. Parse products summary
      const parsedItems = parseProductsSummary(receipt.productsSummary || '');
      if (parsedItems.length === 0) {
        if (showAlertOnError) {
          alert('هیچ کالایی در بخش خلاصه کالاها یافت نشد.');
        }
        return false;
      }

      // 3. Match or create products, then create VoucherItem list
      const newVoucherItems: VoucherItem[] = [];
      let autoAddedProductsCount = 0;
      let tempProductsList = [...products];

      for (const item of parsedItems) {
        let product = tempProductsList.find(p => p.name === item.productName);
        if (!product) {
          const newProdId = generateId();
          const newCode = getNextProductCode(tempProductsList);
          product = {
            id: newProdId,
            name: item.productName,
            code: newCode,
            unit: item.unit || 'عدد',
            weight: item.weight || 0,
            shelfLocation: item.shelfLocation || '',
            stock: 0,
            reservedStock: 0,
            buyPrice: 0,
            sellPrice: item.value ? (item.value / (item.quantity || 1)) : 0
          } as Product;
          addProduct(product);
          tempProductsList.push(product);
          autoAddedProductsCount++;
        }

        newVoucherItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unit: product.unit,
          weight: product.weight || item.weight,
          shelfLocation: item.shelfLocation || product.shelfLocation,
          description: item.description
        });
      }

      // 4. Driver/Supervisor Info
      setVoucherSupervisor(receipt.driverName || '');

      // 4.1 Parse vehicle plate if present
      if (receipt.vehiclePlate) {
        const plateStr = receipt.vehiclePlate;
        const numMatches = plateStr.match(/\d+/g);
        const letterMatch = plateStr.match(/[الف-ی]/);
        
        if (numMatches && numMatches.length >= 2 && letterMatch) {
          let p1 = '';
          let p3 = '';
          let p4 = '';
          numMatches.forEach(num => {
            if (num.length === 3) {
              p3 = num;
            } else if (num.length === 2) {
              if (!p1) p1 = num;
              else p4 = num;
            }
          });
          
          if (p1 && p3) {
            setVoucherVehicle({
              part1: p1,
              part2: letterMatch[0],
              part3: p3,
              part4: p4 || numMatches[0]
            });
          }
        }
      }
      
      // 5. Tracking Code
      setVoucherTracking(receipt.trackingCode || '');

      // 6. Photo
      if (receipt.photoUri) {
        let photoUrl = receipt.photoUri;
        if (!photoUrl.startsWith('data:')) {
          photoUrl = `data:image/jpeg;base64,${photoUrl}`;
        }
        setLoadingPhotos([photoUrl]);
      } else {
        setLoadingPhotos([]);
      }

      // 7. Auto detect voucher type: RETURN if items contain "برگشتی"
      const hasReturnItem = parsedItems.some(item => item.productName.includes('برگشتی') || item.description.includes('برگشتی'));
      setVoucherType(hasReturnItem ? 'RETURN' : 'OUT');

      // Set state for form
      setVoucherPersonId(personId);
      setVoucherItems(newVoucherItems);
      
      let notes = `وارد شده از متن JSON\nشرکت: ${receipt.companyName || ''}`;
      if (receipt.comments) {
        notes += `\nتوضیحات فرستنده: ${receipt.comments}`;
      }
      setVoucherNotes(notes);
      
      // Switch view to voucher entry
      setView('voucher');

      if (showAlertOnError) {
        let msg = '✅ اطلاعات حواله با موفقیت بارگذاری شد.';
        if (autoAddedProductsCount > 0) {
          msg += `\nتعداد ${autoAddedProductsCount} کالا جدید به انبار اضافه شد.`;
        }
        alert(msg);
      }
      return true;
    } catch (err: any) {
      console.error(err);
      if (showAlertOnError) {
        let suggestion = '';
        const trimmed = text.trim();
        if (!trimmed.startsWith('{')) {
          suggestion = '\n\n💡 پیشنهاد: متن وارد شده با علامت "{" شروع نشده است. به نظر می‌رسد متن را ناقص کپی کرده‌اید یا خطوط ابتدایی آن جا افتاده‌اند.';
        } else if (trimmed.includes('entName') || trimmed.includes('ctsSummary') || trimmed.includes('atedValue') || /[^"](Count|Weight|ments)":/.test(trimmed)) {
          suggestion = '\n\n💡 پیشنهاد: به نظر می‌رسد متن از سمت چپ بریده شده است (مثلاً حروف ابتدایی کلیدهایی مانند recipientName یا comments حذف شده‌اند). لطفاً کل متن را به طور کامل انتخاب و کپی کنید.';
        }
        alert('خطا در تحلیل متن JSON. لطفاً از صحت فرمت مطمئن شوید.\nخطا: ' + err.message + suggestion);
      }
      return false;
    }
  };

  const handleImportVoucherJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const success = processImportJson(text, false);
      if (!success) {
        // Try reading as windows-1256 if utf-8 fails
        const reader2 = new FileReader();
        reader2.onload = (e2) => {
          const text2 = e2.target?.result as string;
          const success2 = processImportJson(text2, false);
          if (!success2) {
            // Try reading as UTF-16LE
            const reader3 = new FileReader();
            reader3.onload = (e3) => {
              const text3 = e3.target?.result as string;
              processImportJson(text3, true); // final try, show error if still fails
            };
            reader3.readAsText(file, 'utf-16le');
          }
        };
        reader2.readAsText(file, 'windows-1256');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  useKeyboardShortcut(['Alt', 'N'], () => { if(view === 'main') setView('voucher'); });
  useKeyboardShortcut(['Alt', 'S'], () => { if(view === 'voucher') handleSaveVoucher(); });
  useKeyboardShortcut(['Escape'], () => { setView('main'); setShowAddProduct(false); setShowAddPerson(false); });

  return (
    <div className="animate-fade-in relative min-h-screen">
      {view === 'main' && (
        <div className="space-y-8 animate-fade-in pb-20">
          <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3"><Package className="text-indigo-400"/> انبارداری و لجستیک</h1>
              <p className="text-slate-400 text-xs mt-1 font-bold">پایش موجودی و مدیریت هوشمند ناوگان حمل و نقل</p>
              {lowStockProducts.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-rose-400 text-xs font-bold animate-pulse">
                  <AlertTriangle size={14} />
                  {lowStockProducts.length} کالا کمتر از حد مجاز
                </div>
              )}
            </div>
            <div className="flex gap-3 w-full md:w-auto flex-wrap">
                <button onClick={async () => { setIsAnalyzing(true); const res = await analyzeInventoryStock(products, vouchers); setAiAnalysis(res); setIsAnalyzing(false); }} className="flex-1 md:flex-none bg-gradient-to-br from-indigo-600 to-purple-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg">
                    <Bot size={20}/> تحلیل AI
                </button>
                <button onClick={() => setShowImportJsonModal(true)} className="flex-1 md:flex-none bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg">
                    <FileText size={20}/> دریافت حواله (JSON)
                </button>
                <button onClick={() => setView('voucher')} className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl" title="حواله جدید (Alt+N)">
                    <Plus size={24} /> صدور حواله
                </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-6">
                  <div className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
                      <nav className="space-y-2">
                        <TabItem active={activeSubTab === 'history'} onClick={() => setActiveSubTab('history')} icon={History} label="تاریخچه حواله‌ها" />
                        <TabItem active={activeSubTab === 'products'} onClick={() => setActiveSubTab('products')} icon={Layers} label="موجودی انبار" />
                      </nav>
                  </div>
              </div>
              <div className="lg:col-span-3">
                  <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[600px]">
                      {activeSubTab === 'history' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase">
                                    <tr><th className="p-8">کد رهگیری</th><th className="p-8">طرف حساب</th><th className="p-8">نوع</th><th className="p-8">راننده</th><th className="p-8 text-center">عملیات</th></tr>
                                </thead>
                                <tbody className="text-slate-200 text-sm font-bold divide-y divide-white/5">
                                    {vouchers.sort((a,b) => b.number - a.number).map(v => (
                                        <tr key={v.id} className="hover:bg-white/5 transition-all group">
                                            <td className="p-8 font-mono text-indigo-400">{toPersianDigits(v.trackingCode)}</td>
                                            <td className="p-8 font-black text-white">{v.personName}</td>
                                            <td className="p-8"><span className={`px-3 py-1 rounded-lg text-[10px] ${v.type==='IN'?'bg-emerald-500/20 text-emerald-400':v.type==='RETURN'?'bg-amber-500/20 text-amber-400':'bg-rose-500/20 text-rose-400'}`}>{v.type==='IN'?'ورود':v.type==='RETURN'?'برگشت':'خروج'}</span></td>
                                            <td className="p-8 text-slate-400">{v.supervisor || '---'}</td>
                                            <td className="p-8">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => { setSelectedVoucherId(v.id); setView('preview'); }} className="p-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye size={18}/></button>
                                                    {v.type === 'OUT' && (
                                                        <button onClick={() => { setReturnVoucherId(v.id); setShowReturnModal(true); }} className="p-3 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-600 hover:text-white transition-all" title="ثبت برگشت"><Undo2 size={18}/></button>
                                                    )}
                                                    <button onClick={() => setDeleteTarget({type: 'voucher', id: v.id})} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                      ) : (
                        <div className="p-8 space-y-6">
                            <div className="flex flex-col gap-4 px-2">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <h2 className="text-white font-black text-xl flex items-center gap-2">
                                            <Package className="text-teal-400" size={22} />
                                            <span>کالاهای موجود انبار</span>
                                            <span className="text-xs bg-white/5 text-slate-400 font-mono px-2.5 py-1 rounded-xl">
                                                {toPersianDigits(filteredProducts.length)} از {toPersianDigits(products.length)}
                                            </span>
                                        </h2>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setScanTarget('product_serial');
                                                setShowBarcodeScanner(true);
                                            }}
                                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg border border-indigo-500/30 transition-all cursor-pointer"
                                            title="اسکن بارکد / شماره سریال با دوربین یا اسکنر"
                                        >
                                            <Scan size={18} />
                                            <span className="hidden sm:inline">اسکن بارکدخوان</span>
                                        </button>
                                        <button onClick={() => setShowExcelImport('products')} className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg cursor-pointer"><FileSpreadsheet size={18}/> ورود اکسل</button>
                                        <button onClick={() => { setNewProd({name: '', unit: 'عدد', weight: 0, shelfLocation: '', serialNumber: '', category: '', subCategory: '', subSubCategory: ''}); setShowAddProduct(true); }} className="flex-1 md:flex-none bg-teal-600 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg cursor-pointer"><PackagePlus size={18}/> کالا جدید</button>
                                    </div>
                                </div>

                                {/* نوار جستجو و فیلترهای چند سطحی دسته‌بندی */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5">
                                    <div className="sm:col-span-5 relative">
                                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input 
                                            type="text" 
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-white text-xs font-bold outline-none focus:border-teal-500" 
                                            placeholder="جستجو بر اساس نام، کد یا شماره سریال..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {/* فیلتر دسته اصلی */}
                                    <div className="sm:col-span-4">
                                        <select
                                            value={selectedCategoryFilter}
                                            onChange={e => {
                                                setSelectedCategoryFilter(e.target.value);
                                                setSelectedSubCategoryFilter('ALL');
                                            }}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none focus:border-teal-500"
                                        >
                                            <option value="ALL">همه دسته‌های اصلی</option>
                                            {categoriesList.map((cat, i) => (
                                                <option key={i} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* فیلتر زیرمجموعه */}
                                    <div className="sm:col-span-3">
                                        <select
                                            value={selectedSubCategoryFilter}
                                            onChange={e => setSelectedSubCategoryFilter(e.target.value)}
                                            disabled={selectedCategoryFilter === 'ALL' && subCategoriesList.length === 0}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none focus:border-teal-500 disabled:opacity-50"
                                        >
                                            <option value="ALL">همه زیرمجموعه‌ها</option>
                                            {subCategoriesList.map((sub, i) => (
                                                <option key={i} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="bg-black/20 p-6 rounded-3xl border border-white/5 flex flex-col justify-between group hover:border-teal-500/30 transition-all gap-3">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1">
                                                <div className="text-white font-black text-lg mb-1 flex items-center gap-2">
                                                    {p.name}
                                                    {p.stock <= (p.minStock || 5) && <AlertTriangle size={16} className="text-rose-400" />}
                                                </div>
                                                
                                                {/* مسیر دسته‌بندی و زیرمجموعه‌ها */}
                                                {(p.category || p.subCategory) && (
                                                    <div className="text-[11px] text-teal-300 font-bold flex items-center gap-1.5 mb-2 bg-teal-500/10 px-2 py-0.5 rounded-lg w-fit border border-teal-500/20">
                                                        <Layers size={13} />
                                                        <span>{p.categoryPath || `${p.category || 'بدون دسته'}${p.subCategory ? ` / ${p.subCategory}` : ''}${p.subSubCategory ? ` / ${p.subSubCategory}` : ''}`}</span>
                                                    </div>
                                                )}

                                                {/* شماره سریال کالا */}
                                                {p.serialNumber && (
                                                    <div className="text-xs text-indigo-300 font-mono font-bold flex items-center gap-1.5 mb-2 bg-indigo-500/10 px-2.5 py-1 rounded-lg w-fit border border-indigo-500/20">
                                                        <Barcode size={14} />
                                                        <span>سریال: {p.serialNumber}</span>
                                                    </div>
                                                )}

                                                <div className="flex gap-4">
                                                    <span className="text-[10px] text-slate-500 font-black uppercase flex items-center gap-1"><MapPinned size={12}/> {p.shelfLocation || '---'}</span>
                                                    <span className="text-[10px] text-slate-500 font-black uppercase flex items-center gap-1"><Weight size={12}/> {p.weight} KG</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-left">
                                                    <div className={`text-2xl font-black font-mono ${p.stock > 5 ? 'text-teal-400' : 'text-rose-400'}`}>
                                                        {toPersianDigits(p.stock)}
                                                    </div>
                                                    <div className="text-[9px] text-slate-600 font-black uppercase">{p.unit}</div>
                                                </div>
                                                <button onClick={() => { setEditingProduct(p); setNewProd(p); setShowAddProduct(true); }} className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                <button onClick={() => setDeleteTarget({type: 'product', id: p.id})} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                      )}
                  </div>
              </div>
          </div>
        </div>
      )}

      {view === 'voucher' && isWizardActive && (
        <MobileVoucherWizard
          products={products}
          people={people}
          invoices={invoices}
          logisticsProfiles={logisticsProfiles}
          companies={companies}
          lastVoucherNumber={lastVoucherNumber}
          initialType={voucherType === 'RETURN' ? 'OUT' : voucherType}
          onCancel={() => setView('main')}
          onSaveVoucher={handleSaveVoucherFromWizard}
          onAddPerson={() => setShowAddPerson(true)}
          onAddProduct={() => setShowAddProduct(true)}
          onScanBarcode={() => setShowBarcodeScanner(true)}
        />
      )}

      {view === 'voucher' && !isWizardActive && (
        <div className="space-y-8 animate-fade-in pb-32 min-h-screen">
            <header className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between shadow-2xl gap-4">
                <div className="flex items-center gap-6">
                    <button onClick={() => setView('main')} className="bg-white/5 text-white p-4 rounded-2xl hover:bg-white/10 transition-all" title="بازگشت (Esc)"><ArrowLeft/></button>
                    <div>
                        <h2 className="text-2xl font-black text-white">ثبت حواله جدید</h2>
                        <span className="text-[10px] text-slate-500 font-bold block mt-1">فرم جامع دسکتاپ</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setWizardMode(true)} className="bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg text-xs transition-all">
                        <Sparkles size={16}/> سوئیچ به حالت مرحله‌ای (Wizard)
                    </button>
                    <button onClick={() => setShowImportJsonModal(true)} className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg text-sm">
                        <FileText size={18}/> دریافت از فایل (JSON)
                    </button>
                    <div className="flex bg-slate-950 p-4 rounded-3xl border border-white/5 items-center gap-6 shadow-inner">
                        <div className="flex flex-col items-center px-4 border-l border-white/5">
                            <span className="text-[9px] text-slate-500 font-black uppercase mb-1">وزن کل تخمینی</span>
                            <span className="text-lg font-black font-mono text-teal-400">{toPersianDigits(stats.totalWeight)} KG</span>
                        </div>
                        <div className="flex flex-col items-center px-4">
                            <span className="text-[9px] text-slate-500 font-black uppercase mb-1">ارزش تقریبی کالا</span>
                            <span className="text-lg font-black font-mono text-amber-400">{formatCurrency(stats.estimatedValue)}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-500 font-black pr-2 block uppercase">تحویل‌گیرنده / خریدار</label>
                                    <button onClick={() => setShowExcelImport('people')} className="text-emerald-400 text-[10px] font-black flex items-center gap-1 hover:text-white transition-colors"><FileSpreadsheet size={14}/> ورود اکسل</button>
                                </div>
                                <div className="flex gap-2">
                                    <select className="flex-1 bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-teal-500" value={voucherPersonId} onChange={e => { setVoucherPersonId(e.target.value); setVoucherRelatedInvoiceId(''); }}>
                                        <option value="">--- انتخاب شخص ---</option>
                                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button 
                                        onClick={() => setShowAddPerson(true)} 
                                        type="button" 
                                        className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg" 
                                        title="ثبت سریع شخص جدید"
                                    >
                                        <UserPlus size={22} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-500 font-black pr-2 block uppercase">اتصال به فاکتور (اختیاری)</label>
                                    {availableInvoices.length > 0 && <span className="text-[10px] text-amber-400 font-black">{availableInvoices.length} فاکتور باز</span>}
                                </div>
                                <select 
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-amber-500" 
                                    value={voucherRelatedInvoiceId} 
                                    onChange={e => setVoucherRelatedInvoiceId(e.target.value)}
                                    disabled={!voucherPersonId}
                                >
                                    <option value="">--- بدون فاکتور مرجع ---</option>
                                    {availableInvoices.map(inv => (
                                        <option key={inv.id} value={inv.id}>فاکتور شماره {toPersianDigits(inv.number)} ({toPersianDigits(inv.date)})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="relative pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-500 font-black pr-2 block uppercase">مباشر حمل / راننده</label>
                                <div className="group relative">
                                    <button className="text-indigo-400 text-[10px] font-black flex items-center gap-1 hover:text-white"><History size={14}/> فراخوانی راننده</button>
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 hidden group-hover:block overflow-hidden">
                                        {logisticsProfiles.map(lp => (
                                            <button key={lp.id} onClick={() => recallDriver(lp)} className="w-full text-right p-4 hover:bg-white/5 border-b border-white/5 last:border-0 text-xs text-slate-300 font-bold flex justify-between items-center">
                                                <span>{lp.name}</span>
                                                <span className="text-[9px] font-mono text-slate-500">{lp.vehicleNumber}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <input className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-indigo-500" placeholder="نام راننده..." value={voucherSupervisor} onChange={e => setVoucherSupervisor(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div><label className="text-xs text-slate-500 font-black pr-2 block mb-2 uppercase">تلفن راننده</label><input className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-mono shadow-inner outline-none focus:border-indigo-500" placeholder="۰۹۱۲۰۰۰۰۰۰۰" value={voucherPhone} onChange={e => setVoucherPhone(e.target.value)} /></div>
                            <div><label className="text-xs text-slate-500 font-black pr-2 block mb-2 uppercase">پلاک خودرو</label>
                                <div className="flex gap-2" dir="ltr">
                                    <input className="w-16 bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-center font-black" placeholder="۱۲" value={voucherVehicle.part1} onChange={e => setVoucherVehicle({...voucherVehicle, part1: e.target.value.slice(0,2)})} />
                                    <select className="w-16 bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-center font-black outline-none" value={voucherVehicle.part2} onChange={e => setVoucherVehicle({...voucherVehicle, part2: e.target.value})}>
                                        <option>الف</option><option>ب</option><option>پ</option><option>ت</option><option>ث</option><option>ج</option><option>د</option><option>ر</option><option>ز</option><option>س</option><option>ش</option><option>ص</option><option>ط</option><option>ع</option><option>ف</option><option>ق</option><option>ک</option><option>گ</option><option>ل</option><option>م</option><option>ن</option><option>و</option><option>ه</option><option>ی</option>
                                    </select>
                                    <input className="w-24 bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-center font-black" placeholder="۳۴۵" value={voucherVehicle.part3} onChange={e => setVoucherVehicle({...voucherVehicle, part3: e.target.value.slice(0,3)})} />
                                    <input className="w-16 bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-center font-black" placeholder="۶۷" value={voucherVehicle.part4} onChange={e => setVoucherVehicle({...voucherVehicle, part4: e.target.value.slice(0,2)})} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <h3 className="text-white font-black flex items-center gap-3"><ShoppingBag className="text-teal-400"/> لیست اقلام و قطعات</h3>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <button onClick={() => setShowBarcodeScanner(true)} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10 hover:bg-indigo-600 hover:text-white transition-all shadow-lg" title="اسکن بارکد"><QrCode size={20}/></button>
                                <button onClick={() => setShowTemplates(true)} className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/10 hover:bg-purple-600 hover:text-white transition-all shadow-lg" title="الگوها"><BookMarked size={20}/></button>
                                <select className="hidden md:block bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-teal-500 w-48" onChange={(e) => {
                                    const prod = products.find(p => p.id === e.target.value);
                                    if (prod) setVoucherItems([...voucherItems, { productId: prod.id, productName: prod.name, quantity: 1, unit: prod.unit, weight: prod.weight, shelfLocation: prod.shelfLocation }]);
                                    e.target.value = "";
                                }}>
                                    <option value="">+ درج از انبار...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({toPersianDigits(p.stock)} {p.unit})</option>)}
                                </select>
                                <button onClick={() => {
                                    const modal = document.createElement('div');
                                    modal.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md';
                                    modal.innerHTML = `
                                      <div class="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
                                        <div class="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                                          <h3 class="text-lg font-black text-white flex items-center gap-2">
                                            <svg class="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                                            انتخاب کالا از انبار
                                          </h3>
                                          <button onclick="this.closest('.fixed').remove()" class="p-2 text-slate-500 hover:text-white">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                          </button>
                                        </div>
                                        <div class="mb-4">
                                          <input type="text" id="productSearch" placeholder="جستجوی کالا..." class="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500" />
                                        </div>
                                        <div id="productList" class="space-y-2 overflow-y-auto flex-1"></div>
                                      </div>
                                    `;
                                    document.body.appendChild(modal);
                                    
                                    const productList = modal.querySelector('#productList');
                                    const searchInput = modal.querySelector('#productSearch') as HTMLInputElement;
                                    
                                    const renderProducts = (filter = '') => {
                                      const filtered = products.filter(p => (p.name || '').toLowerCase().includes((filter || '').toLowerCase()) ||
                                        (p.code && p.code.toLowerCase().includes((filter || '').toLowerCase()))
                                      );
                                      
                                      if (productList) {
                                        productList.innerHTML = filtered.length === 0 
                                          ? '<div class="text-center py-10 text-slate-500">کالایی یافت نشد</div>'
                                          : filtered.map(p => `
                                            <button data-product-id="${p.id}" class="w-full text-right p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl transition-all flex justify-between items-center">
                                              <div class="flex-1">
                                                <div class="text-white font-bold text-sm">${p.name}</div>
                                                <div class="text-xs text-slate-500 mt-1">موجودی: ${toPersianDigits(p.stock)} ${p.unit}</div>
                                              </div>
                                              <div class="text-teal-400 font-mono text-lg font-black">${toPersianDigits(p.stock)}</div>
                                            </button>
                                          `).join('');
                                        
                                        productList.querySelectorAll('[data-product-id]').forEach(btn => {
                                          btn.addEventListener('click', () => {
                                            const prod = products.find(p => p.id === btn.getAttribute('data-product-id'));
                                            if (prod) {
                                              setVoucherItems([...voucherItems, { 
                                                productId: prod.id, 
                                                productName: prod.name, 
                                                quantity: 1, 
                                                unit: prod.unit, 
                                                weight: prod.weight, 
                                                shelfLocation: prod.shelfLocation 
                                              }]);
                                              modal.remove();
                                            }
                                          });
                                        });
                                      }
                                    };
                                    
                                    renderProducts();
                                    searchInput?.addEventListener('input', (e) => renderProducts((e.target as HTMLInputElement).value));
                                    modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
                                }} className="md:hidden flex-1 bg-teal-600 text-white px-4 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg">
                                    <Package size={18}/> درج از انبار
                                </button>
                                <button onClick={() => setShowAddProduct(true)} className="p-3 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/10 hover:bg-teal-600 hover:text-white transition-all shadow-lg" title="کالا جدید"><PackagePlus size={20}/></button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {voucherItems.map((item, idx) => {
                                const prod = products.find(p => p.id === item.productId);
                                const lowStock = prod && prod.stock < item.quantity;
                                return (
                                <div key={idx} className={`bg-black/20 p-6 rounded-[2rem] border-2 ${lowStock ? 'border-rose-500/50' : 'border-white/5'} flex flex-col md:flex-row items-start md:items-center gap-4 group`}>
                                    <div className="flex-1 w-full">
                                        <div className="text-white font-black text-xl flex items-center gap-2 mb-2">
                                            {item.productName}
                                            {lowStock && <AlertTriangle size={18} className="text-rose-400" />}
                                            {prod && <span className="text-sm text-slate-500 font-mono">(موجودی: {toPersianDigits(prod.stock)})</span>}
                                        </div>
                                        <div className="flex gap-4 mt-2">
                                            <span className="text-xs text-slate-500 font-black uppercase flex items-center gap-1"><MapPinned size={14}/> {item.shelfLocation || '---'}</span>
                                            <span className="text-xs text-slate-500 font-black uppercase flex items-center gap-1"><Weight size={14}/> {item.weight} KG</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        {/* Shelf Location Input */}
                                        <div className="flex-1 md:w-32">
                                            <label className="text-xs text-slate-600 block mb-2 font-bold">قفسه</label>
                                            <input className="w-full bg-slate-950 border-2 border-white/5 rounded-xl px-4 py-3 text-white text-sm font-mono text-center focus:border-teal-500 outline-none" value={item.shelfLocation || ''} onChange={e => { const n=[...voucherItems]; n[idx].shelfLocation=e.target.value; setVoucherItems(n); }} placeholder="A-10" />
                                        </div>

                                        {/* Quantity Input */}
                                        <div className="flex-1 md:w-40">
                                            <label className="text-xs text-slate-600 block mb-2 font-bold">تعداد</label>
                                            <NumberInput value={item.quantity} onChange={v => { const n = [...voucherItems]; n[idx].quantity = v; setVoucherItems(n); }} />
                                        </div>
                                        
                                        <button onClick={() => setVoucherItems(voucherItems.filter((_,i) => i !== idx))} className="text-rose-500 p-3 hover:bg-rose-500/10 rounded-xl transition-all mt-6"><Trash2 size={22}/></button>
                                    </div>
                                </div>
                            )})}
                            {voucherItems.length === 0 && <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] text-slate-600 font-bold">لیست اقلام خالی است.</div>}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                        <h3 className="text-white font-black mb-6 flex items-center gap-3"><Camera className="text-blue-400"/> تصاویر گزارش بارگیری (Loading Proof)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {loadingPhotos.map((p, i) => (
                                <div key={i} className="aspect-square bg-black/40 rounded-2xl overflow-hidden border border-white/10 relative group">
                                    <img src={p} className="w-full h-full object-cover" />
                                    <button onClick={() => setLoadingPhotos(loadingPhotos.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                                </div>
                            ))}
                            <label className="aspect-square bg-white/5 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:border-blue-500/50 hover:text-blue-400 transition-all cursor-pointer">
                                <ImageIcon size={32}/><span className="text-[10px] font-black uppercase mt-2">افزودن عکس</span>
                                <input type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={async (e) => { if(e.target.files){ const files = Array.from(e.target.files) as File[]; const b64s=await Promise.all(files.map(f=>fileToBase64(f))); setLoadingPhotos([...loadingPhotos, ...b64s]); } }} />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl lg:sticky lg:top-24 space-y-6">
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button onClick={() => setVoucherType('IN')} className={`flex-1 py-4 rounded-xl font-black transition-all ${voucherType === 'IN' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/5 text-slate-500'}`}>ورود کالا</button>
                                <button onClick={() => setVoucherType('OUT')} className={`flex-1 py-4 rounded-xl font-black transition-all ${voucherType === 'OUT' ? 'bg-rose-600 text-white shadow-lg' : 'bg-white/5 text-slate-500'}`}>خروج کالا</button>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 font-bold pr-2">وضعیت حواله</label>
                                <select className="w-full bg-slate-950 border border-white/10 rounded-2xl p-3 text-white text-xs font-bold outline-none focus:border-teal-500" value={voucherStatus} onChange={e => setVoucherStatus(e.target.value as any)}>
                                    <option value="PENDING">در انتظار ارسال</option>
                                    <option value="IN_TRANSIT">در حال حمل</option>
                                    <option value="DELIVERED">تحویل داده شده</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold pr-2">کد رهگیری (اختیاری)</label>
                                <div className="flex gap-2">
                                    <input className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-mono outline-none focus:border-teal-500" value={voucherTracking} onChange={e => setVoucherTracking(e.target.value)} placeholder="Auto Generated" />
                                    <button onClick={() => setVoucherTracking(generateTrackingCode('VCH', lastVoucherNumber+1, voucherDate))} className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-teal-400"><QrCode size={18}/></button>
                                </div>
                            </div>
                            <textarea className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-teal-500 h-32 resize-none" placeholder="توضیحات تکمیلی حواله..." value={voucherNotes} onChange={e => setVoucherNotes(e.target.value)} />
                        </div>
                        <div className="pt-4 border-t border-white/5 space-y-3">
                            <h3 className="text-white font-black mb-4 flex items-center gap-3"><UserCheck className="text-indigo-400"/> تاییدات نهایی</h3>
                            <button onClick={handleSaveTemplate} className="w-full bg-purple-600/20 border border-purple-500/30 text-purple-300 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-600 hover:text-white transition-all"><Save size={18}/> ذخیره به عنوان الگو</button>
                            <button onClick={handleSaveVoucher} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-teal-600/20 active:scale-95 transition-all" title="صدور حواله (Alt+S)">تایید و صدور حواله</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {view === 'preview' && (
        <div className="fixed inset-0 z-[6000] bg-slate-950 flex flex-col no-print animate-fade-in">
          <header className="w-full bg-slate-900 border-b border-white/10 p-6 flex justify-between items-center z-10 px-6 md:px-12 shadow-2xl shrink-0">
            <div className="flex items-center gap-6">
                <button onClick={() => setView('main')} className="bg-white/5 text-white p-4 rounded-2xl hover:bg-rose-600 transition-all shadow-lg" title="بازگشت (Esc)"><ArrowLeft size={28}/></button>
                <div className="hidden md:block">
                    <h2 className="text-white font-black text-xl">پیش‌نمایش حواله گرافیکی</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Canva Optimized Graphics</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
                {selectedVoucherId && (
                  <RequestSignatureButton
                    documentId={selectedVoucherId}
                    documentType="رسید"
                  />
                )}
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 gap-2">
                    <button onClick={() => { setActiveSignRole('supervisor'); setShowSignaturePad(true); }} className="px-4 py-2 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-[9px] font-black transition-all flex items-center gap-2 border border-blue-500/10"><PenTool size={14}/> امضای راننده</button>
                    <button onClick={async () => {
                      const v = vouchers.find(x => x.id === selectedVoucherId);
                      if(!v) return;
                      
                      try {
                        let docPreview = '';
                        const voucherPreview = sessionStorage.getItem(`voucher_preview_${v.id}`);
                        if (voucherPreview) {
                          docPreview = voucherPreview;
                        } else {
                          const voucherData = {
                            type: 'voucher',
                            number: v.number,
                            date: v.date,
                            time: v.time,
                            voucherType: v.type === 'OUT' ? 'خروج' : v.type === 'IN' ? 'ورود' : 'برگشت',
                            person: v.personName,
                            items: v.items.map(i => ({ 
                              name: i.productName, 
                              productName: i.productName,
                              quantity: i.quantity, 
                              unit: i.unit,
                              shelfLocation: i.shelfLocation
                            })),
                            totalWeight: v.totalWeight,
                            trackingCode: v.trackingCode,
                            supervisor: v.supervisor,
                            vehicleNumber: v.vehicleNumber,
                            receiverPhone: v.receiverPhone,
                            loadingPhotos: v.loadingPhotos || [],
                            notes: v.notes,
                            status: v.status,
                            signature: v.signature,
                            supervisorSignature: v.supervisorSignature,
                            companySignature: v.companySignature
                          };
                          docPreview = JSON.stringify(voucherData);
                        }
                        
                        const token = await simpleSignatureService.createRequest(v.id, 'رسید', docPreview);
                        const url = `${window.location.origin}${window.location.pathname}#/sign/${token}`;
                        const text = `🔐 *درخواست امضای حواله*\n\nسلام ${v.personName} عزیز،\n\nلطفاً حواله ${v.type==='OUT'?'خروج':'ورود'} شماره ${v.number} را مشاهده و امضا کنید:\n${url}\n\n✅ امن و رمزنگاری شده\n⏰ اعتبار: 72 ساعت`;
                        const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
                        const telegram = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                        
                        const modal = document.createElement('div');
                        modal.className = 'fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in';
                        modal.innerHTML = `
                          <div class="bg-slate-900 rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl" dir="rtl">
                            <h3 class="text-xl font-black text-white mb-6 flex items-center gap-2"><svg class="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg> اشتراکگذاری حواله</h3>
                            <div class="space-y-3">
                              <a href="${whatsapp}" target="_blank" class="flex items-center gap-3 p-4 bg-green-600/20 border border-green-600/30 rounded-2xl hover:bg-green-600/30 transition-all w-full">
                                <svg class="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                <div class="flex-1 text-right"><p class="text-white font-bold text-sm">واتساپ</p><p class="text-slate-400 text-xs">ارسال مستقیم</p></div>
                              </a>
                              <a href="${telegram}" target="_blank" class="flex items-center gap-3 p-4 bg-blue-600/20 border border-blue-600/30 rounded-2xl hover:bg-blue-600/30 transition-all w-full">
                                <svg class="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                <div class="flex-1 text-right"><p class="text-white font-bold text-sm">تلگرام</p><p class="text-slate-400 text-xs">اشتراکگذاری</p></div>
                              </a>
                              <button onclick="navigator.clipboard.writeText('${url}'); this.innerHTML='<svg class=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 13l4 4L19 7\"></path></svg> کپی شد!'" class="flex items-center justify-center gap-2 p-4 bg-slate-800 border border-white/10 rounded-2xl hover:bg-slate-700 transition-all w-full text-white font-bold text-sm">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2\" d=\"M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z\"></path></svg>
                                کپی لینک
                              </button>
                              <button onclick="this.closest('.fixed').remove()" class="w-full py-3 bg-slate-700 text-white rounded-xl font-bold text-sm mt-2">بستن</button>
                            </div>
                          </div>
                      `;
                      document.body.appendChild(modal);
                      modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
                    } catch (err) {
                      console.error(err);
                      alert('خطا در ایجاد لینک امضای راه دور.');
                    }
                    }} className="px-4 py-2 text-teal-400 hover:bg-teal-600 hover:text-white rounded-xl text-[9px] font-black transition-all flex items-center gap-2 border border-teal-500/10"><Share2 size={14}/> اشتراکگذاری</button>
                </div>
                <select className="bg-slate-800 border border-white/10 rounded-2xl px-4 py-2 text-white text-[10px] font-black outline-none focus:border-teal-500 shadow-inner" value={printTheme} onChange={e => setPrintTheme(e.target.value as PrintTheme)}>
                    <option value="persian">🇮🇷 تم اصیل ایرانی (کانوا و نقوش هشتی)</option>
                    <option value="smart">💎 تم فیروزه‌ای هوشمند</option>
                    <option value="premium">🌊 تم لاجوردی مدیریتی</option>
                    <option value="industrial">🔥 تم صنعتی نارنجی</option>
                    <option value="official">🏛️ تم رسمی کلاسیک</option>
                </select>
                <button onClick={handleExportImage} className="p-3 bg-white/5 text-slate-300 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Download size={20}/></button>
                <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2"><Printer size={20}/> چاپ</button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar">
            <div ref={printRef} className="bg-white shadow-[0_60px_150px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden" style={{ width: 'min(98vw, 215mm)', minHeight: '297mm' }}>
                {vouchers.find(v => v.id === selectedVoucherId) && <VoucherPrint data={vouchers.find(v => v.id === selectedVoucherId)!} theme={printTheme} />}
            </div>
          </main>
        </div>
      )}

      {/* MODALS */}
      {showAddProduct && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fade-in backdrop-blur-md no-print p-4">
            <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 lg:p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[92vh] overflow-y-auto custom-scrollbar" dir="rtl">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <PackagePlus className="text-teal-400" /> 
                  <span>{editingProduct ? 'ویرایش مشخصات کالا' : 'تعریف و ثبت کالای جدید'}</span>
                </h3>
                <button 
                  onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} 
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* نام کالا و واحد */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block pr-1">نام و عنوان کالا *</label>
                    <input 
                      placeholder="نام کالا..." 
                      className="w-full bg-slate-950 p-3.5 rounded-xl text-white outline-none border border-white/10 focus:border-teal-500 font-bold text-sm" 
                      value={newProd.name || ''} 
                      onChange={e => setNewProd({...newProd, name: e.target.value})} 
                      autoFocus 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block pr-1">واحد سنجش</label>
                    <select 
                      value={newProd.unit || 'عدد'}
                      onChange={e => setNewProd({...newProd, unit: e.target.value})}
                      className="w-full bg-slate-950 p-3.5 rounded-xl text-white outline-none border border-white/10 focus:border-teal-500 font-bold text-xs"
                    >
                      <option value="عدد">عدد</option>
                      <option value="کیلوگرم">کیلوگرم</option>
                      <option value="بسته">بسته</option>
                      <option value="کارتن">کارتن</option>
                      <option value="متر">متر</option>
                      <option value="لیتر">لیتر</option>
                      <option value="دستگاه">دستگاه</option>
                    </select>
                  </div>
                </div>

                {/* بخش شماره سریال: اتوماتیک، دستی و دریافت از طریق اسکنر دستی */}
                <div className="bg-slate-950 p-4 rounded-2xl border-2 border-indigo-400/50 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-indigo-200 flex items-center gap-1.5">
                      <Barcode size={18} className="text-indigo-400" />
                      <span>شماره سریال اختصاصی کالا</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const autoSerial = generateAutoSerialNumber('SN');
                          setNewProd(prev => ({ ...prev, serialNumber: autoSerial }));
                        }}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 border border-indigo-300 transition-all cursor-pointer shadow-md active:scale-95"
                        title="تولید خودکار شماره سریال یکتا بر اساس فرمول استاندارد"
                      >
                        <Shuffle size={14} />
                        <span>تولید اتوماتیک</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScanTarget('product_serial');
                          setShowBarcodeScanner(true);
                        }}
                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 border border-teal-300 transition-all cursor-pointer shadow-md active:scale-95"
                        title="اسکن سریال با بارکدخوان یا دوربین"
                      >
                        <Scan size={14} />
                        <span>اسکن با بارکدخوان دستی</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="سریال دستی یا اسکن از طریق بارکدخوان دستی (تفنگی)..." 
                      value={newProd.serialNumber || ''} 
                      onChange={e => setNewProd({ ...newProd, serialNumber: e.target.value })}
                      className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3.5 text-white font-mono text-sm tracking-wider font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                  <p className="text-xs text-indigo-200 font-bold">
                    💡 می‌توانید بارکدخوان دستی (تفنگی) را روی این کادر بگیرید تا شماره سریال بلادرنگ وارد و ثبت شود.
                  </p>
                </div>

                {/* بخش دسته‌بندی کالا در چندین زیرمجموعه (دسته اصلی، زیرمجموعه ۱، زیرمجموعه ۲) */}
                <div className="bg-slate-950 p-4 rounded-2xl border-2 border-slate-700 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-teal-300">
                    <Layers size={18} />
                    <span>دسته‌بندی چند سطحی کالا (شاخه‌ای)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* دسته اصلی */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">دسته اصلی *</label>
                      <input 
                        list="main-categories-list"
                        placeholder="مثال: دیجیتال یا مواد اولیه" 
                        value={newProd.category || ''} 
                        onChange={e => {
                          const cat = e.target.value;
                          const path = `${cat}${newProd.subCategory ? ` / ${newProd.subCategory}` : ''}${newProd.subSubCategory ? ` / ${newProd.subSubCategory}` : ''}`;
                          setNewProd({ ...newProd, category: cat, categoryPath: path });
                        }}
                        className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30"
                      />
                      <datalist id="main-categories-list">
                        {categoriesList.map((c, i) => <option key={i} value={c} />)}
                      </datalist>
                    </div>

                    {/* زیرمجموعه اول */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">زیرمجموعه ۱ (فرعی)</label>
                      <input 
                        list="sub-categories-list"
                        placeholder="مثال: لپ‌تاپ یا قطعات" 
                        value={newProd.subCategory || ''} 
                        onChange={e => {
                          const sub = e.target.value;
                          const path = `${newProd.category || ''}${sub ? ` / ${sub}` : ''}${newProd.subSubCategory ? ` / ${newProd.subSubCategory}` : ''}`;
                          setNewProd({ ...newProd, subCategory: sub, categoryPath: path });
                        }}
                        className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30"
                      />
                      <datalist id="sub-categories-list">
                        {subCategoriesList.map((s, i) => <option key={i} value={s} />)}
                      </datalist>
                    </div>

                    {/* زیرمجموعه دوم (سطح سوم) */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">زیرمجموعه ۲ (تکمیلی)</label>
                      <input 
                        placeholder="مثال: سری گیمینگ یا مدل خاص" 
                        value={newProd.subSubCategory || ''} 
                        onChange={e => {
                          const sub2 = e.target.value;
                          const path = `${newProd.category || ''}${newProd.subCategory ? ` / ${newProd.subCategory}` : ''}${sub2 ? ` / ${sub2}` : ''}`;
                          setNewProd({ ...newProd, subSubCategory: sub2, categoryPath: path });
                        }}
                        className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30"
                      />
                    </div>
                  </div>
                  {newProd.categoryPath && (
                    <div className="text-[11px] font-black text-teal-300 bg-teal-950/60 p-2 rounded-lg border border-teal-500/30">
                      مسیر دسته‌بندی: {newProd.categoryPath}
                    </div>
                  )}
                </div>

                {/* قیمت خرید، فروش و موجودی اولیه */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">قیمت خرید (تومان)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      className="w-full bg-slate-900 p-3 rounded-xl text-white font-mono text-xs font-bold border-2 border-slate-600 outline-none focus:border-teal-400"
                      value={newProd.buyPrice || ''}
                      onChange={e => setNewProd({...newProd, buyPrice: Number(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">قیمت فروش (تومان)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      className="w-full bg-slate-900 p-3 rounded-xl text-white font-mono text-xs font-bold border-2 border-slate-600 outline-none focus:border-teal-400"
                      value={newProd.sellPrice || ''}
                      onChange={e => setNewProd({...newProd, sellPrice: Number(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">موجودی اولیه</label>
                    <input 
                      type="number"
                      placeholder="0"
                      className="w-full bg-slate-900 p-3 rounded-xl text-white font-mono text-xs font-bold border-2 border-slate-600 outline-none focus:border-teal-400"
                      value={newProd.stock || ''}
                      onChange={e => setNewProd({...newProd, stock: Number(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* وزن و موقعیت قفسه */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white pr-1 block">وزن (KG)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 p-3 rounded-xl text-white font-mono text-xs font-bold border-2 border-slate-600 outline-none focus:border-teal-400" 
                      value={newProd.weight || ''} 
                      onChange={e => setNewProd({...newProd, weight: Number(e.target.value) || 0})} 
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white pr-1 block">موقعیت قفسه</label>
                    <input 
                      placeholder="A-10" 
                      className="w-full bg-slate-900 p-3 rounded-xl text-white text-xs font-bold border-2 border-slate-600 outline-none focus:border-teal-400" 
                      value={newProd.shelfLocation || ''} 
                      onChange={e => setNewProd({...newProd, shelfLocation: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* دکمه‌های تایید و انصراف */}
              <div className="pt-4 mt-4 border-t-2 border-slate-700 flex gap-3">
                <button 
                  type="button"
                  onClick={() => { 
                    if (!newProd.name?.trim()) {
                      alert('نام کالا الزامی است.');
                      return;
                    } 
                    if (editingProduct) { 
                      updateProduct(editingProduct.id, {
                        ...newProd,
                        serialNumber: newProd.serialNumber?.trim() || undefined,
                        category: newProd.category?.trim() || undefined,
                        subCategory: newProd.subCategory?.trim() || undefined,
                        subSubCategory: newProd.subSubCategory?.trim() || undefined,
                        categoryPath: newProd.categoryPath?.trim() || undefined
                      }); 
                      setEditingProduct(null); 
                    } else { 
                      const id = generateId(); 
                      const createdProduct = {
                        id, 
                        ...newProd, 
                        name: newProd.name.trim(),
                        code: newProd.code || getNextProductCode(products), 
                        sellPrice: newProd.sellPrice || 0, 
                        buyPrice: newProd.buyPrice || 0, 
                        stock: newProd.stock || 0, 
                        reservedStock: 0,
                        serialNumber: newProd.serialNumber?.trim() || undefined,
                        category: newProd.category?.trim() || undefined,
                        subCategory: newProd.subCategory?.trim() || undefined,
                        subSubCategory: newProd.subSubCategory?.trim() || undefined,
                        categoryPath: newProd.categoryPath?.trim() || undefined
                      } as Product;
                      addProduct(createdProduct); 
                      if (view === 'voucher') {
                        setVoucherItems([...voucherItems, {
                          productId: id, 
                          productName: createdProduct.name, 
                          quantity: 1, 
                          unit: createdProduct.unit, 
                          weight: createdProduct.weight, 
                          shelfLocation: createdProduct.shelfLocation
                        }]);
                      } 
                    } 
                    setShowAddProduct(false); 
                    setNewProd({ name: '', unit: 'عدد', weight: 0, shelfLocation: '', serialNumber: '', category: '', subCategory: '', subSubCategory: '' }); 
                  }} 
                  className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 py-3.5 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all cursor-pointer border border-teal-300"
                >
                  {editingProduct ? 'ذخیره تغییرات' : 'ذخیره و ثبت کالا'}
                </button>
                <button 
                  type="button"
                  onClick={() => { 
                    setShowAddProduct(false); 
                    setEditingProduct(null); 
                    setNewProd({ name: '', unit: 'عدد', weight: 0, shelfLocation: '', serialNumber: '', category: '', subCategory: '', subSubCategory: '' }); 
                  }} 
                  className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3.5 rounded-xl font-bold text-xs cursor-pointer border border-slate-600"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
      )}

      {showAddPerson && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fade-in backdrop-blur-md no-print">
            <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-md rounded-t-[3rem] md:rounded-[3rem] p-6 lg:p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white flex items-center gap-3"><UserPlus className="text-indigo-400" /> تعریف شخص</h3><button onClick={() => setShowAddPerson(false)} className="p-2 text-slate-500 hover:text-white"><X/></button></div>
              <div className="space-y-4 flex-1">
                <input placeholder="نام کامل" className="w-full bg-slate-950 p-4 rounded-2xl text-white outline-none border border-white/5 focus:border-indigo-500 font-black" value={newPers.name} onChange={e => setNewPers({...newPers, name: e.target.value})} autoFocus />
                <input placeholder="۰۹۱۲۰۰۰۰۰۰۰ (اختیاری)" className="w-full bg-slate-950 p-4 rounded-2xl text-white font-mono shadow-inner border border-white/5" value={newPers.phone} onChange={e => setNewPers({...newPers, phone: e.target.value})} />
              </div>
              <button onClick={() => { if(!newPers.name) return; const id=generateId(); addPerson({id, ...newPers, balance:0, code: getNextCustomerCode(people), isCustomer:true, category:'مشتری عادی'} as Person); if(view==='voucher') setVoucherPersonId(id); setShowAddPerson(false); setNewPers({name: '', phone: '', category: 'مشتری عادی'}); }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active-scale-95 transition-all mt-4">ثبت و انتخاب</button>
              <button onClick={() => { setShowAddPerson(false); setNewPers({name: '', phone: '', category: 'مشتری عادی'}); }} className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold mt-2">انصراف</button>
            </div>
          </div>
      )}

      {isAnalyzing && <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md no-print"><div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-pop-up"><div className="flex items-center gap-4 mb-8"><div className="w-16 h-16 bg-teal-600/20 rounded-2xl flex items-center justify-center text-teal-400"><Bot size={40}/></div><h3 className="text-2xl font-black text-white">سامانه تحلیل و هوشمندسازی انبارداری (دپارتمان IT اشک قلم | www.ashkghalam.ir)</h3></div><div className="bg-black/40 p-8 rounded-3xl border border-white/5 text-slate-300 leading-9 text-sm italic whitespace-pre-line shadow-inner max-h-[500px] overflow-y-auto">{aiAnalysis || 'در حال تحلیل داده‌ها...'}</div><button onClick={() => setAiAnalysis(null)} className="w-full mt-8 bg-teal-600 text-white py-4 rounded-2xl font-black shadow-xl">تایید</button></div></div>}

      <FullScreenSignatureModal isOpen={showSignaturePad} onClose={() => setShowSignaturePad(false)} onSave={(img: string) => { if(selectedVoucherId) { if(activeSignRole==='supervisor') setVoucherSupervisorSignature(selectedVoucherId, img); else if(activeSignRole==='receiver') setVoucherSignature(selectedVoucherId, img); else setVoucherCompanySignature(selectedVoucherId, img); } }} />
      <ConfirmModal 
        isOpen={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        onConfirm={() => {
          if(deleteTarget) {
            if(deleteTarget.type === 'voucher') deleteVoucher(deleteTarget.id);
            else deleteProduct(deleteTarget.id);
          }
          setDeleteTarget(null);
        }} 
        title={deleteTarget?.type === 'voucher' ? 'حذف حواله' : 'حذف کالا'} 
        message={deleteTarget?.type === 'voucher' ? 'آیا از حذف این سند اطمینان دارید؟ موجودی انبار بازگردانی خواهد شد.' : 'آیا از حذف این کالا اطمینان دارید؟'} 
      />
      {showExcelImport && <ExcelImport type={showExcelImport} onClose={() => setShowExcelImport(null)} />}
      {showBarcodeScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowBarcodeScanner(false)} />}

      {showTemplates && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md no-print">
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl animate-pop-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3"><BookMarked className="text-purple-400" /> الگوهای حواله</h3>
                <button onClick={() => setShowTemplates(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {voucherTemplates.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">هیچ الگویی ذخیره نشده</div>
                ) : (
                  voucherTemplates.map(t => (
                    <div key={t.id} className="bg-slate-950 p-5 rounded-2xl border border-white/5 flex justify-between items-center hover:border-purple-500/30 transition-all group">
                      <div>
                        <div className="text-white font-bold">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{t.items.length} قلم کالا</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleLoadTemplate(t)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-500 transition-all">بارگذاری</button>
                        <button onClick={() => { setVoucherTemplates(voucherTemplates.filter(x => x.id !== t.id)); localStorage.setItem('voucherTemplates', JSON.stringify(voucherTemplates.filter(x => x.id !== t.id))); }} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      )}

      {showImportJsonModal && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fade-in backdrop-blur-md no-print">
            <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-2xl rounded-t-[3rem] md:rounded-[3rem] p-6 lg:p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <FileText className="text-indigo-400" /> واردات حواله از متن JSON
                </h3>
                <button onClick={() => { setShowImportJsonModal(false); setPastedJson(''); }} className="p-2 text-slate-500 hover:text-white"><X/></button>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-slate-400 font-bold leading-6">
                  متن JSON حواله را در کادر زیر قرار دهید یا از دکمه انتخاب فایل استفاده کنید.
                </p>
                <textarea
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-indigo-500 h-64 resize-y font-mono text-left"
                  placeholder='{"receipt": ...}'
                  value={pastedJson}
                  onChange={e => setPastedJson(e.target.value)}
                  dir="ltr"
                />
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2" dir="rtl">
                  <label className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-white/5">
                    <Download size={14} className="rotate-180" /> انتخاب فایل JSON...
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setPastedJson(evt.target?.result as string || '');
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => {
                        if (!pastedJson.trim()) return alert('لطفاً ابتدا متن JSON را وارد کنید.');
                        const success = processImportJson(pastedJson);
                        if (success) {
                          setShowImportJsonModal(false);
                          setPastedJson('');
                        }
                      }}
                      className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all"
                    >
                      پردازش و واردات
                    </button>
                    <button
                      onClick={() => { setShowImportJsonModal(false); setPastedJson(''); }}
                      className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold text-sm"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {showReturnModal && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md no-print">
            <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-pop-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3"><Undo2 className="text-amber-400" /> ثبت برگشت کالا</h3>
                <button onClick={() => { setShowReturnModal(false); setReturnVoucherId(null); setReturnReason(''); }} className="p-2 text-slate-500 hover:text-white"><X/></button>
              </div>
              <div className="space-y-4">
                <textarea className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-amber-500 h-32 resize-none" placeholder="دلیل برگشت کالا را بنویسید..." value={returnReason} onChange={e => setReturnReason(e.target.value)} autoFocus />
                <button onClick={handleReturnVoucher} className="w-full bg-amber-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all">ثبت حواله برگشتی</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

const TabItem = ({ active, onClick, icon: Icon, label }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-xl' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}><Icon size={20}/><span className="font-black text-sm">{label}</span></button>
);

const StatusRow = ({ label, active }: any) => (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"><span className="text-[10px] font-black text-slate-500 uppercase">{label}</span>{active ? <CheckCircle2 size={16} className="text-teal-400"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-700"></div>}</div>
);

export default Inventory;
