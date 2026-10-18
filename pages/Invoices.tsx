
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { Person, Product, Invoice, InvoiceItem, InvoiceType, Check, IRANIAN_BANKS, PrintTheme, CompanyBranch } from '../types';
import { formatCurrency, generateId, toPersianDigits, generateTrackingCode, getPersianDate, getPersianTime, generateLocalQrSvg, getNextCustomerCode, getNextProductCode, copyToClipboard, generatePdfBlob, downloadPdfBlob, sendInvoicePdf } from '../utils';
import { Plus, Trash2, Printer, X, Save, CreditCard, UserPlus, PackagePlus, ShoppingBag, PlusCircle, Edit, ArrowLeft, Eye, Wallet, Landmark, CheckCircle2, ShieldCheck, Workflow, BookmarkPlus, Calculator, Banknote, BookMarked, Info, Barcode as BarcodeIcon, QrCode, ScrollText, Share2, UserCheck, Smartphone, Truck, PenTool, TextQuote, Link as LinkIcon, Calendar, Send, FileText, Download, Camera, MessageSquare, HelpCircle, Building2, Store, ShieldAlert, ArrowUpDown, Shuffle, RotateCcw, Sparkles, Copy, ExternalLink, ArrowDown, ArrowUp, Scan, Barcode, Layers } from 'lucide-react';
import { NumberInput, JalaliDatePicker, FullScreenSignatureModal, ConfirmModal, useKeyboardShortcut } from '../components/Shared';
import { InvoicePrint, PROFORMA_STANDARD_NOTE } from '../components/InvoicePrint';
import { RequestSignatureButton } from '../components/RequestSignatureButton';
import { ShareModal } from '../components/ShareModal';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { SmsInvoiceService } from '../services/smsInvoiceService';
import { triggerDeviceSms, SmsGatewayService } from '../services/smsGatewayService';
import { licenseQuotaService } from '../services/licenseQuotaService';
import { PcPosPaymentModal } from '../components/PcPosPaymentModal';
import { InvoiceReceiptModal } from '../components/InvoiceReceiptModal';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { initHardwareBarcodeScanner, generateAutoSerialNumber } from '../services/barcodeService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * تعیین پیش‌فرض‌های هوشمند پیشوند و شماره فاکتور بر اساس نوع سند
 * - فاکتور فروش: شروع از 1001 با پیشوند INV-
 * - پیش‌فاکتور: شروع از 2001 با پیشوند PRO-
 * - فاکتور خرید: شروع از 3001 با پیشوند PUR-
 * - مرجوعی: شروع از 4001 با پیشوند RET-
 */
export const getInvoiceTypeDefaults = (targetType: InvoiceType, allInvoices: Invoice[]) => {
  const filtered = allInvoices.filter(i => i.type === targetType);
  if (targetType === InvoiceType.SALE) {
    const maxNum = filtered.reduce((max, inv) => Math.max(max, Number(inv.number) || 0), 1000);
    return { prefix: 'INV-', number: maxNum >= 1000 ? maxNum + 1 : 1001 };
  } else if (targetType === InvoiceType.PROFORMA) {
    const maxNum = filtered.reduce((max, inv) => Math.max(max, Number(inv.number) || 0), 2000);
    return { prefix: 'PRO-', number: maxNum >= 2000 ? maxNum + 1 : 2001 };
  } else if (targetType === InvoiceType.PURCHASE) {
    const maxNum = filtered.reduce((max, inv) => Math.max(max, Number(inv.number) || 0), 3000);
    return { prefix: 'PUR-', number: maxNum >= 3000 ? maxNum + 1 : 3001 };
  } else {
    const maxNum = filtered.reduce((max, inv) => Math.max(max, Number(inv.number) || 0), 1000);
    return { prefix: 'INV-', number: maxNum >= 1000 ? maxNum + 1 : 1001 };
  }
};

const Invoices = () => {
  const { invoices, products, people, checks, addInvoice, updateInvoice, deleteInvoice, addPerson, addProduct, setInvoiceSignature, companies, defaultInvoiceFooter, savedDescriptions, addSavedDescription, removeSavedDescription, addCheck, addBranch, addNotification } = useStore();
  
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const activeCompany = useMemo(() => companies.find(c => c.isActive) || companies[0], [companies]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(activeCompany?.id || 'default');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeCompany?.branches?.[0]?.id || '');
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [newBranch, setNewBranch] = useState<Partial<CompanyBranch>>({ name: '', code: '', phone: '', address: '', managerName: '' });

  // Currently selected company & branch
  const currentSelectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId) || activeCompany, [companies, selectedCompanyId, activeCompany]);
  const currentAvailableBranches = useMemo(() => currentSelectedCompany?.branches || [], [currentSelectedCompany]);
  const currentSelectedBranch = useMemo(() => currentAvailableBranches.find(b => b.id === selectedBranchId) || currentAvailableBranches[0], [currentAvailableBranches, selectedBranchId]);

  const handleCompanyChange = (compId: string) => {
    setSelectedCompanyId(compId);
    const targetComp = companies.find(c => c.id === compId);
    if (targetComp && targetComp.branches && targetComp.branches.length > 0) {
      setSelectedBranchId(targetComp.branches[0].id);
    } else {
      setSelectedBranchId('');
    }
  };

  const handleCreateQuickBranch = () => {
    if (!newBranch.name?.trim()) {
      alert('نام شعبه الزامی است');
      return;
    }
    const branchId = generateId();
    const createdBranch: CompanyBranch = {
      id: branchId,
      companyId: selectedCompanyId,
      name: newBranch.name.trim(),
      code: newBranch.code?.trim() || `${currentAvailableBranches.length + 1}`,
      phone: newBranch.phone?.trim() || currentSelectedCompany?.phone,
      address: newBranch.address?.trim() || currentSelectedCompany?.address,
      managerName: newBranch.managerName?.trim() || currentSelectedCompany?.managerName,
      logo: currentSelectedCompany?.logo,
      stamp: currentSelectedCompany?.stamp,
      signature: currentSelectedCompany?.signature
    };
    addBranch(selectedCompanyId, createdBranch);
    setSelectedBranchId(branchId);
    setShowBranchModal(false);
    setNewBranch({ name: '', code: '', phone: '', address: '', managerName: '' });
  };
  
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'preview'>('list');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDocPreview, setShareDocPreview] = useState<string>('');
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(getPersianDate());
  const [dueDate, setDueDate] = useState<string>(getPersianDate());
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [type, setType] = useState<InvoiceType>(InvoiceType.SALE);
  const [description, setDescription] = useState(defaultInvoiceFooter || '');
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [checkPayment, setCheckPayment] = useState<Partial<Check>[]>([]);
  const [taxId, setTaxId] = useState('');
  
  // پیشوند و شماره فاکتور با پیش‌فرض‌های هوشمند
  const [invoicePrefix, setInvoicePrefix] = useState<string>('INV-');
  const [invoiceNumber, setInvoiceNumber] = useState<number>(1001);
  const [showPosModal, setShowPosModal] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | InvoiceType>('ALL');

  // سورت لیست فاکتورها (پیش‌فرض: تاریخ صدور)
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'finalTotal' | 'personName' | 'dueDate'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // متغیرهای اسکنر دستی و تعریف سریع کالا از طریق اسکنر
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showQuickScanAddModal, setShowQuickScanAddModal] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [scannedPendingCode, setScannedPendingCode] = useState('');

  // مودال ارسال مستقیم پیامک اندروید / درگاه پیامک
  const [smsModalInvoice, setSmsModalInvoice] = useState<Invoice | null>(null);
  const [smsTargetPhone, setSmsTargetPhone] = useState<string>('');
  const [smsPreviewText, setSmsPreviewText] = useState<string>('');
  const [smsSignUrl, setSmsSignUrl] = useState<string>('');

  const handleProcessScannedCodeForInvoice = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // جستجو بر اساس کد، شماره سریال یا شناسه کالا
    const foundProduct = products.find(p => p.code === code || p.serialNumber === code || p.id === code);
    if (foundProduct) {
      setItems(prevItems => {
        const existingIdx = prevItems.findIndex(item => item.productId === foundProduct.id);
        if (existingIdx !== -1) {
          const next = [...prevItems];
          const updatedQty = next[existingIdx].quantity + 1;
          next[existingIdx] = {
            ...next[existingIdx],
            quantity: updatedQty,
            total: updatedQty * next[existingIdx].unitPrice
          };
          return next;
        } else {
          const unitPrice = type === InvoiceType.SALE ? (foundProduct.sellPrice || 0) : (foundProduct.buyPrice || 0);
          const nextOrder = prevItems.reduce((max, it) => Math.max(max, it.entryOrder || 0), 0) + 1;
          const newItem: InvoiceItem = {
            productId: foundProduct.id,
            productName: foundProduct.name,
            serialNumber: foundProduct.serialNumber,
            quantity: 1,
            buyPrice: foundProduct.buyPrice || 0,
            unitPrice,
            total: unitPrice,
            profit: type === InvoiceType.SALE ? (unitPrice - (foundProduct.buyPrice || 0)) : 0,
            description: '',
            entryOrder: nextOrder
          };
          return [newItem, ...prevItems];
        }
      });
      addNotification('success', `کالای «${foundProduct.name}» با اسکنر به فاکتور افزوده شد.`);
    } else {
      // کالا در انبار یافت نشد: باز کردن پنجره تعریف سریع کالا از اسکنر دستی
      setScannedPendingCode(code);
      setNewProd({
        name: '',
        code: getNextProductCode(products),
        serialNumber: code,
        sellPrice: 0,
        buyPrice: 0,
        unit: 'عدد',
        category: '',
        subCategory: ''
      });
      setShowQuickScanAddModal(true);
      addNotification('info', `بارکد/سریال «${code}» شناسایی شد. لطفاً نام و مشخصات کالا را وارد فرمایید.`);
    }
  };

  // شنود سراسری اسکنر دستی سخت‌افزاری (تفنگی / بارکدخوان USB و بی‌سیم)
  useEffect(() => {
    const unsubscribe = initHardwareBarcodeScanner((scannedCode) => {
      if (view === 'create' || view === 'edit') {
        handleProcessScannedCodeForInvoice(scannedCode);
      }
    });
    return () => unsubscribe();
  }, [view, products, type]);

  const handleConvertToSale = (inv: Invoice) => {
    if (confirm(`آیا مایلید پیش‌فاکتور شماره ${(inv.prefix || '') + toPersianDigits(inv.number)} به فاکتور فروش قطعی تبدیل شود؟\n\nبا تایید شما، سند مالی و حسابداری این فاکتور رسماً در دفاتر و مانده حساب مشتری ثبت خواهد شد.`)) {
      updateInvoice(inv.id, {
        ...inv,
        type: InvoiceType.SALE
      });
    }
  };

  const displayedInvoices = useMemo(() => {
    return invoices
      .filter(inv => filterType === 'ALL' || inv.type === filterType)
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
          const dateA = a.date || '';
          const dateB = b.date || '';
          comparison = dateA.localeCompare(dateB);
          if (comparison === 0) {
            comparison = (a.number || 0) - (b.number || 0);
          }
        } else if (sortBy === 'number') {
          comparison = (a.number || 0) - (b.number || 0);
        } else if (sortBy === 'finalTotal') {
          comparison = (a.finalTotal || 0) - (b.finalTotal || 0);
        } else if (sortBy === 'personName') {
          comparison = (a.personName || '').localeCompare(b.personName || '');
        } else if (sortBy === 'dueDate') {
          const dueA = a.dueDate || a.date || '';
          const dueB = b.dueDate || b.date || '';
          comparison = dueA.localeCompare(dueB);
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [invoices, filterType, sortBy, sortOrder]);

  const handleToggleSort = (field: 'date' | 'number' | 'finalTotal' | 'personName' | 'dueDate') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  // Driver Info
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [showPersonModal, setShowPersonModal] = useState(false);
  const [newPers, setNewPers] = useState<Partial<Person>>({ name: '', phone: '', category: 'مشتری عادی' });
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>({ name: '', sellPrice: 0, buyPrice: 0, unit: 'عدد' });
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [tempCheck, setTempCheck] = useState<Partial<Check>>({ bankName: '', amount: 0, sayadId: '', dueDate: getPersianDate() });
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [activeSignRole, setActiveSignRole] = useState<'warehouse' | 'sales' | 'customer' | 'driver'>('customer');
  const [printTheme, setPrintTheme] = useState<PrintTheme>('smart');
  const [autoSendSms, setAutoSendSms] = useState<boolean>(true);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showPreviousBalance, setShowPreviousBalance] = useState<boolean>(true);

  useEffect(() => {
    if (showPersonModal || showProductModal || showCheckModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
  }, [showPersonModal, showProductModal, showCheckModal]);

  useEffect(() => {
    if (showPersonModal) {
      setNewPers({ name: '', phone: '', category: 'مشتری عادی', code: getNextCustomerCode(people) });
    }
  }, [showPersonModal, people]);

  useEffect(() => {
    if (showProductModal) {
      setNewProd({ name: '', sellPrice: 0, buyPrice: 0, unit: 'عدد', code: getNextProductCode(products) });
    }
  }, [showProductModal, products]);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (viewId) {
      const inv = invoices.find(i => i.id === viewId);
      if (inv) {
        setSelectedInvoiceId(inv.id);
        setView('preview');
      }
    }
  }, [invoices]);

  const subTotal = useMemo(() => items.reduce((sum, i) => sum + (Number(i.total) || 0), 0), [items]);
  const payable = subTotal - discount + tax;
  const checkTotal = useMemo(() => checkPayment.reduce((sum, c) => sum + (c.amount || 0), 0), [checkPayment]);
  const remainingBalance = payable - cashAmount - checkTotal;

  const handleEdit = (inv: Invoice) => {
    setEditingId(inv.id); setSelectedPerson(inv.personId); setInvoiceDate(inv.date); setDueDate(inv.dueDate || inv.date);
    setInvoiceNumber(inv.number || 1);
    setInvoicePrefix(inv.prefix || '');
    setSelectedCompanyId(inv.companyId || activeCompany?.id || 'default');
    setSelectedBranchId(inv.branchId || '');
    // در زمان ویرایش: آخرین قلم‌های ورودی در بالای جدول برای عدم اسکرول قرار می‌گیرند
    const indexedItems = (inv.items || []).map((it, idx) => ({ ...it, entryOrder: it.entryOrder || (idx + 1) }));
    setItems([...indexedItems].reverse());
    setType(inv.type); setDescription(inv.description || '');
    setDiscount(inv.discount); setTax(inv.tax); setCashAmount(inv.cashAmount);
    setCheckPayment(inv.checks || []); 
    setDriverName(inv.driverName || ''); setDriverPhone(inv.driverPhone || ''); setVehiclePlate(inv.vehiclePlate || '');
    setTaxId(inv.taxId || '');
    setShowPreviousBalance(inv.showPreviousBalance !== undefined ? inv.showPreviousBalance : true);
    setView('edit');
  };

  const handlePreview = (inv: Invoice) => { 
    setSelectedInvoiceId(inv.id); 
    setShowPreviousBalance(inv.showPreviousBalance !== undefined ? inv.showPreviousBalance : true);
    // ذخیره پیشنمایش فاکتور برای استفاده در امضا - مرتب‌سازی اقلام به ترتیب ثبت از بالا به پایین
    const sortedInvItems = [...(inv.items || [])].sort((a, b) => (a.entryOrder || 0) - (b.entryOrder || 0));
    const documentPreview = JSON.stringify({
      type: 'invoice',
      number: inv.number,
      prefix: inv.prefix,
      date: inv.date,
      customer: inv.personName,
      items: sortedInvItems.map(i => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice })),
      total: inv.finalTotal
    });
    sessionStorage.setItem(`invoice_preview_${inv.id}`, documentPreview);
    setView('preview'); 
  };

  const resetForm = () => {
    setView('list'); setEditingId(null); setSelectedInvoiceId(null); setItems([]); setSelectedPerson('');
    setCashAmount(0); setCheckPayment([]); setDescription(defaultInvoiceFooter || ''); 
    setTax(0); setDiscount(0); setDriverName(''); setDriverPhone(''); setVehiclePlate('');
    setTaxId(''); 
    setShowPreviousBalance(true);
    setSelectedCompanyId(activeCompany?.id || 'default');
    setSelectedBranchId(activeCompany?.branches?.[0]?.id || '');
    const defaults = getInvoiceTypeDefaults(InvoiceType.SALE, invoices);
    setType(InvoiceType.SALE);
    setInvoicePrefix(defaults.prefix);
    setInvoiceNumber(defaults.number);
  };

  const handleOpenCreateForm = (targetType: InvoiceType = InvoiceType.SALE) => {
    setEditingId(null); setSelectedInvoiceId(null); setItems([]); setSelectedPerson('');
    setCashAmount(0); setCheckPayment([]); setDescription(defaultInvoiceFooter || ''); 
    setTax(0); setDiscount(0); setDriverName(''); setDriverPhone(''); setVehiclePlate('');
    setTaxId(''); 
    setShowPreviousBalance(true);
    setSelectedCompanyId(activeCompany?.id || 'default');
    setSelectedBranchId(activeCompany?.branches?.[0]?.id || '');
    
    const defaults = getInvoiceTypeDefaults(targetType, invoices);
    setType(targetType);
    setInvoicePrefix(defaults.prefix);
    setInvoiceNumber(defaults.number);
    if (targetType === InvoiceType.PROFORMA) {
      setDescription(PROFORMA_STANDARD_NOTE);
    }
    setView('create');
  };

  const handleSelectInvoiceType = (newType: InvoiceType) => {
    setType(newType);
    if (!editingId) {
      const defaults = getInvoiceTypeDefaults(newType, invoices);
      setInvoicePrefix(defaults.prefix);
      setInvoiceNumber(defaults.number);
      if (newType === InvoiceType.PROFORMA && (!description || description === defaultInvoiceFooter)) {
        setDescription(PROFORMA_STANDARD_NOTE);
      }
    }
  };

  const handleGenerateRandomNumber = () => {
    const randomNum = Math.floor(1001 + Math.random() * 89999);
    setInvoiceNumber(randomNum);
  };

  const handleResetToAutoDefaults = () => {
    const defaults = getInvoiceTypeDefaults(type, invoices);
    setInvoicePrefix(defaults.prefix);
    setInvoiceNumber(defaults.number);
  };

  const handleOpenSmsModal = async (inv: Invoice) => {
    const person = people.find(p => p.id === inv.personId);
    const targetPhone = person?.phone || '';
    setSmsModalInvoice(inv);
    setSmsTargetPhone(targetPhone);
    const targetComp = companies.find(c => c.id === inv.companyId) || activeCompany;
    const signUrl = await SmsInvoiceService.generateInvoiceSignUrl(inv);
    setSmsSignUrl(signUrl);
    const preview = SmsInvoiceService.buildInvoiceSmsText(inv, targetComp, signUrl);
    setSmsPreviewText(preview);
  };

  const handleSendViaAndroidDirect = () => {
    if (!smsTargetPhone.trim()) {
      alert('لطفاً شماره تلفن همراه خریدار را وارد نمایید.');
      return;
    }
    triggerDeviceSms(smsTargetPhone, smsPreviewText);
    setSmsModalInvoice(null);
  };

  const handleSendViaGateway = async () => {
    if (!smsModalInvoice) return;
    if (!smsTargetPhone.trim()) {
      alert('لطفاً شماره تلفن همراه خریدار را وارد نمایید.');
      return;
    }
    setIsSendingSms(true);
    try {
      const res = await SmsGatewayService.sendSms({
        toPhone: smsTargetPhone,
        recipientName: smsModalInvoice.personName,
        message: smsPreviewText,
        type: 'INVOICE'
      });
      alert(res.message);
      if (res.success) {
        setSmsModalInvoice(null);
      }
    } catch (e: any) {
      alert('خطا در ارسال پیامک: ' + (e?.message || 'نامشخص'));
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleAddCheck = () => {
      if (!tempCheck.amount || !tempCheck.bankName) return alert('مبلغ و نام بانک الزامی است');
      setCheckPayment([...checkPayment, { ...tempCheck, id: generateId(), status: 'PENDING' }]);
      setTempCheck({ bankName: '', amount: 0, sayadId: '', dueDate: getPersianDate() });
      setShowCheckModal(false);
  };

  const handleSaveInvoice = () => {
    console.log('handleSaveInvoice called', { selectedPerson, itemsLength: items.length });
    if (!selectedPerson || items.length === 0) {
      alert('طرف حساب و حداقل یک ردیف کالا الزامی است.');
      return;
    }

    if (taxId && !/^[A-Za-z0-9]{22}$/.test(taxId)) {
        alert('شناسه منحصر به فرد مالیاتی مودیان باید دقیقاً ۲۲ رقم/حرف انگلیسی باشد.');
        return;
    }

    const person = people.find(p => p.id === selectedPerson);
    console.log('Person found:', person);
    
    const processedChecks = checkPayment.map(c => {
        const checkId = c.id || generateId();
        const checkData = {
            ...c,
            id: checkId,
            status: c.status || 'PENDING' as const,
            holderName: person?.name || 'ناشناس',
            personId: selectedPerson,
            personName: person?.name,
            amount: c.amount || 0,
            bankName: c.bankName || '',
            sayadId: c.sayadId || '',
            dueDate: c.dueDate || getPersianDate(),
            relatedInvoiceId: editingId || generateId()
        } as Check;
        
        // ثبت چک در سیستم مدیریت چک در صورتی که قبلا ثبت نشده باشد
        const existingCheck = checks.find(ck => ck.id === checkId);
        if (!existingCheck) {
            addCheck(checkData, selectedPerson);
        }
        return checkData;
    });

    const finalInvoiceNumber = Number(invoiceNumber) || (editingId ? (invoices.find(v => v.id === editingId)?.number || 1) : (invoices.length > 0 ? Math.max(...invoices.map(i => i.number || 0)) + 1 : 1));

    const targetCompany = companies.find(c => c.id === selectedCompanyId) || activeCompany;
    const targetBranch = targetCompany?.branches?.find(b => b.id === selectedBranchId) || targetCompany?.branches?.[0];

    const invoice: Invoice = {
      id: editingId || generateId(),
      companyId: targetCompany?.id || 'default',
      branchId: targetBranch?.id || undefined,
      companyName: targetCompany?.name || 'مجموعه تجاری',
      branchName: targetBranch?.name || undefined,
      companySnapshot: targetCompany ? {
          name: targetCompany.name,
          legalName: targetCompany.legalName,
          economicCode: targetCompany.economicCode,
          nationalId: targetCompany.nationalId,
          registrationNumber: targetCompany.registrationNumber,
          postalCode: targetCompany.postalCode,
          address: targetCompany.address,
          phone: targetCompany.phone,
          logo: targetCompany.logo,
          stamp: targetCompany.stamp,
          signature: targetCompany.signature,
          managerName: targetCompany.managerName,
      } : undefined,
      branchSnapshot: targetBranch ? {
          id: targetBranch.id,
          name: targetBranch.name,
          code: targetBranch.code,
          phone: targetBranch.phone,
          address: targetBranch.address,
          managerName: targetBranch.managerName,
          logo: targetBranch.logo || targetCompany?.logo,
          stamp: targetBranch.stamp || targetCompany?.stamp,
          signature: targetBranch.signature || targetCompany?.signature,
          postalCode: targetBranch.postalCode || targetCompany?.postalCode,
          economicCode: targetBranch.economicCode || targetCompany?.economicCode,
          registrationNumber: targetBranch.registrationNumber || targetCompany?.registrationNumber,
          nationalId: targetBranch.nationalId || targetCompany?.nationalId,
      } : undefined,
      number: finalInvoiceNumber,
      prefix: invoicePrefix.trim() || undefined,
      trackingCode: '', date: invoiceDate, dueDate: dueDate, personId: selectedPerson, personName: person?.name || 'ناشناس',
      type, items: [...items].sort((a, b) => (a.entryOrder || 0) - (b.entryOrder || 0)), subTotal, totalProfit: 0, tax, discount, finalTotal: payable, cashAmount, checkAmount: checkTotal,
      driverName, driverPhone, vehiclePlate,
      checks: processedChecks, 
      description,
      taxId: taxId || undefined,
      showPreviousBalance
    };
    invoice.trackingCode = generateTrackingCode(invoice.prefix || 'INV', invoice.number, invoiceDate);
    if (editingId) updateInvoice(editingId, invoice); else addInvoice(invoice);

    // ارسال خودکار پیامک صورتحساب حاوی لینک امضا و پرداخت در صورت تمایل کاربر
    if (autoSendSms && person?.phone && type === InvoiceType.SALE) {
      SmsInvoiceService.sendInvoiceNotification(invoice, person, targetCompany).then(res => {
        if (res.success) {
          console.log('Invoice SMS sent successfully:', res.message);
        }
      }).catch(err => {
        console.warn('SMS dispatch error:', err);
      });
    }

    resetForm();
  };

  const handleSendSmsForInvoice = async (inv: Invoice) => {
    const person = people.find(p => p.id === inv.personId);
    if (!person?.phone) {
      alert(`شماره موبایل خریدار (${inv.personName}) در سیستم ثبت نشده است. لطفاً ابتدا از بخش اشخاص شماره را وارد نمایید.`);
      return;
    }

    setIsSendingSms(true);
    try {
      const activeCompany = companies.find(c => c.isActive) || companies[0];
      const result = await SmsInvoiceService.sendInvoiceNotification(inv, person, activeCompany);
      alert(result.message);
    } catch (err: any) {
      alert('خطا در ارسال پیامک: ' + (err?.message || 'نامشخص'));
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleOpenPersonModal = () => {
    const code = getNextCustomerCode(people);
    setNewPers({ name: '', phone: '', category: 'مشتری عادی', code });
    setShowPersonModal(true);
  };

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
      if (p.subCategory?.trim()) set.add(p.subCategory.trim());
    });
    return Array.from(set);
  }, [products]);

  const handleOpenProductModal = () => {
    const code = getNextProductCode(products);
    setNewProd({ 
      name: '', 
      sellPrice: 0, 
      buyPrice: 0, 
      unit: 'عدد', 
      code,
      serialNumber: '',
      category: '',
      subCategory: '',
      subSubCategory: ''
    });
    setShowProductModal(true);
  };

  const handleOpenCheckModal = () => {
    const defaultAmount = remainingBalance > 0 ? remainingBalance : 0;
    setTempCheck({ bankName: '', amount: defaultAmount, sayadId: '', dueDate: getPersianDate() });
    setShowCheckModal(true);
  };

  const handleQuickAddPerson = () => {
      if (!newPers.name?.trim()) return alert('نام شخص الزامی است.');
      const quotaCheck = licenseQuotaService.canAddPerson(people.length);
      if (!quotaCheck.allowed) {
          alert(quotaCheck.reason || 'سقف ثبت طرف حساب تکمیل شده است.');
          return;
      }
      const id = generateId();
      const code = newPers.code || getNextCustomerCode(people);
      addPerson({ id, ...newPers, name: newPers.name.trim(), balance: 0, code } as Person);
      setSelectedPerson(id); setShowPersonModal(false);
  };

  const handleQuickAddProduct = () => {
      if (!newProd.name?.trim()) return alert('نام کالا الزامی است.');
      const id = generateId();
      const code = newProd.code || getNextProductCode(products);
      const cat = newProd.category?.trim();
      const sub = newProd.subCategory?.trim();
      const sub2 = newProd.subSubCategory?.trim();
      const catPath = `${cat || ''}${sub ? ` / ${sub}` : ''}${sub2 ? ` / ${sub2}` : ''}`.trim() || undefined;

      const p: Product = { 
          id, 
          ...newProd, 
          name: newProd.name.trim(),
          code, 
          stock: 0, 
          reservedStock: 0,
          unit: newProd.unit || 'عدد',
          serialNumber: newProd.serialNumber?.trim() || undefined,
          category: cat || undefined,
          subCategory: sub || undefined,
          subSubCategory: sub2 || undefined,
          categoryPath: catPath,
          buyPrice: newProd.buyPrice || 0,
          sellPrice: newProd.sellPrice || 0
      };
      addProduct(p);
      const unitPrice = type === InvoiceType.SALE ? (p.sellPrice || 0) : (p.buyPrice || 0);
      const nextOrder = items.reduce((max, it) => Math.max(max, it.entryOrder || 0), 0) + 1;
      setItems([{ 
          productId: id, 
          productName: p.name, 
          serialNumber: p.serialNumber,
          quantity: 1, 
          buyPrice: p.buyPrice || 0, 
          unitPrice, 
          total: unitPrice, 
          profit: type === InvoiceType.SALE ? (unitPrice - (p.buyPrice || 0)) : 0, 
          description: '',
          entryOrder: nextOrder
      }, ...items]);
      setShowProductModal(false);
      setShowQuickScanAddModal(false);
      setScannedPendingCode('');
      setNewProd({ name: '', sellPrice: 0, buyPrice: 0, unit: 'عدد', serialNumber: '', category: '', subCategory: '', subSubCategory: '' });
      addNotification('success', `کالای «${p.name}» با موفقیت تعریف شد و به فاکتور افزوده گردید.`);
  };

  const handleSaveDescription = () => {
      if (description) {
          const lines = description.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          let addedCount = 0;
          lines.forEach(line => {
              if (line && !savedDescriptions.includes(line)) {
                  addSavedDescription(line);
                  addedCount++;
              }
          });
          if (addedCount > 0) {
              addNotification('success', `${toPersianDigits(addedCount)} سطر پانویس به لیست پانویس‌های آماده افزوده شد.`);
          } else {
              addNotification('info', 'این پانویس(ها) قبلاً در لیست پانویس‌های آماده ذخیره شده‌اند.');
          }
      }
  };

  const getInvoiceShareText = (inv: Invoice, url: string) => {
    const invCompany = companies.find(c => c.id === inv.companyId) || companies.find(c => c.isActive) || companies[0];
    const companyName = inv.companySnapshot?.name || inv.companyName || invCompany?.name || 'اشک قلم';
    
    const itemsList = inv.items
      .map(item => `🔹 ${item.productName} (${toPersianDigits(item.quantity)})`)
      .join('\n');
      
    const formattedDate = toPersianDigits(inv.date);
    const currentTime = toPersianDigits(getPersianTime());
    
    return `📄 فاکتور دیجیتال ${companyName}
━━━━━━━━━━━━━━━━━━━━
👤 خریدار: ${inv.personName}
🔢 شماره فاکتور: ${toPersianDigits(inv.number)}
📅 تاریخ صدور: ${formattedDate}
⏰ ساعت صدور: ${currentTime}
━━━━━━━━━━━━━━━━━━━━
📦 اقلام فاکتور:
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💰 مبلغ قابل پرداخت: ${formatCurrency(inv.finalTotal)}
━━━━━━━━━━━━━━━━━━━━
🔗 جهت مشاهده، پرداخت و امضای دیجیتال فاکتور روی لینک زیر کلیک کنید:
${url}

✍️ این فاکتور به صورت دیجیتال صادر شده و دارای امضای الکترونیک معتبر صادرکننده می‌باشد.`;
  };

  const handleShareLink = (invId: string) => {
    try {
      const inv = invoices.find(i => i.id === invId);
      if (!inv) return;
      const person = people.find(p => p.id === inv.personId);
      const activeComp = companies.find(c => c.id === inv.companyId) || companies.find(c => c.isActive) || companies[0];
      const fullDoc = { ...inv, person, company: activeComp };
      setSelectedInvoiceId(invId);
      setShareDocPreview(JSON.stringify(fullDoc));
      setShowShareModal(true);
    } catch (err) {
      console.error('خطا در باز کردن اشتراک‌گذاری فاکتور:', err);
    }
  };

  const downloadInvoiceAsPDF = async () => {
    if (!invoiceRef.current) return;
    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (!selectedInvoice) return;
    
    setDownloadingPDF(true);
    try {
      const element = invoiceRef.current;
      const pdfBlob = await generatePdfBlob(element);
      const filename = `فاکتور-${toPersianDigits(selectedInvoice.number)}.pdf`;
      downloadPdfBlob(pdfBlob, filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('خطا در دانلود PDF فاکتور.');
    } finally {
      setDownloadingPDF(false);
    }
  };
  const downloadAndSendPdf = async () => {
    if (!invoiceRef.current) return;
    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (!selectedInvoice) return;

    setDownloadingPDF(true);
    try {
      const element = invoiceRef.current;
      const pdfBlob = await generatePdfBlob(element);
      const filename = `فاکتور-${toPersianDigits(selectedInvoice.number)}.pdf`;
      downloadPdfBlob(pdfBlob, filename);
      
      // Try uploading the PDF to backend/mock server but catch failures gracefully
      try {
        await sendInvoicePdf(pdfBlob, selectedInvoice.id);
      } catch (sendError) {
        console.warn('Backend/mock server PDF dispatch failed (expected offline/mock behavior):', sendError);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('خطا در دانلود PDF فاکتور: ' + (error as Error).message);
    } finally {
      setDownloadingPDF(false);
    }
  };
  const downloadInvoiceAsImage = async () => {
    if (!invoiceRef.current) return;
    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (!selectedInvoice) return;

    setDownloadingImage(true);
    try {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.ready;
        } catch (e) {
          console.warn('Font loading wait skipped:', e);
        }
      }

      const element = invoiceRef.current;
      const originalShadow = element.style.boxShadow;
      const originalBorderRadius = element.style.borderRadius;
      element.style.boxShadow = 'none';
      element.style.borderRadius = '0';

      const html2canvasFn = (html2canvas as any).default || html2canvas;
      const canvas = await html2canvasFn(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
          clonedElement.dir = 'rtl';
          clonedElement.style.direction = 'rtl';
          clonedElement.style.letterSpacing = 'normal';
          const allNodes = clonedElement.querySelectorAll<HTMLElement>('*');
          allNodes.forEach((node) => {
            node.style.letterSpacing = 'normal';
            if (node.tagName === 'TABLE') {
              node.setAttribute('dir', 'rtl');
              node.style.direction = 'rtl';
              node.style.textAlign = 'right';
              node.style.width = '100%';
            }
            if (node.tagName === 'TH' || node.tagName === 'TD') {
              node.style.letterSpacing = 'normal';
            }
          });
        }
      });

      element.style.boxShadow = originalShadow;
      element.style.borderRadius = originalBorderRadius;

      const link = document.createElement('a');
      link.download = `فاکتور-${toPersianDigits(selectedInvoice.number)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating Image:', error);
      alert('خطا در دانلود تصویر فاکتور: ' + (error as Error).message);
    } finally {
      setDownloadingImage(false);
    }
  };

  // Keyboard Shortcuts
  useKeyboardShortcut(['Alt', 'N'], () => { if(view === 'list') { resetForm(); setView('create'); } });
  useKeyboardShortcut(['Alt', 'S'], () => { if(view === 'create' || view === 'edit') handleSaveInvoice(); });
  useKeyboardShortcut(['Alt', 'P'], () => { if(view === 'preview') window.print(); });
  useKeyboardShortcut(['Escape'], () => { if(view !== 'list') setView('list'); setShowPersonModal(false); setShowProductModal(false); setShowCheckModal(false); });

  // بررسی دوره‌ای و بلادرنگ امضای از راه دور در زمان مشاهده پیش‌نمایش
  useEffect(() => {
    if (view === 'preview' && selectedInvoiceId) {
      simpleSignatureService.syncSignedRequests();
      const interval = setInterval(() => {
        simpleSignatureService.syncSignedRequests();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [view, selectedInvoiceId]);

  if (view === 'preview') {
    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    const person = people.find(p => p.id === selectedInvoice?.personId);

    return (
      <div className="fixed inset-0 z-6000 bg-slate-950 flex flex-col animate-fade-in print-preview-modal print:static print:bg-white print:block print:h-auto print:overflow-visible">
        <header className="w-full bg-slate-900 border-b border-white/10 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center z-10 px-4 md:px-8 shadow-2xl gap-4 shrink-0 no-print">
          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
            <button onClick={() => setView('list')} className="bg-white/5 text-white p-3 md:p-4 rounded-2xl hover:bg-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0" title="بازگشت (Esc)"><ArrowLeft size={24}/></button>
            <div className="flex flex-col min-w-0">
              <h2 className="text-white font-black text-lg md:text-xl tracking-tighter truncate leading-none">پیش‌نمایش فاکتور</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Smart Document Preview</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center items-center w-full md:w-auto">

            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 gap-2">
              <button 
                onClick={() => setReceiptInvoice(selectedInvoice!)}
                className="bg-teal-500/10 hover:bg-teal-600 text-teal-400 hover:text-white px-3 md:px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border border-teal-500/20 shadow-sm"
                title="ثبت دریافت وجه / تسویه بابت این فاکتور"
              >
                <Banknote size={16}/> 
                <span className="hidden md:inline">ثبت دریافتی فاکتور</span>
              </button>
              <RequestSignatureButton documentId={selectedInvoice!.id} documentType="فاکتور" />
              <button onClick={() => { setActiveSignRole('customer'); setShowSignaturePad(true); }} className="bg-teal-500/10 hover:bg-teal-600 text-teal-400 hover:text-white px-3 md:px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border border-teal-500/10"><UserCheck size={16}/> <span className="hidden md:inline">امضای مشتری</span></button>
              <button 
                onClick={() => {
                  try {
                    const person = people.find(p => p.id === selectedInvoice!.personId);
                    const activeComp = companies.find(c => c.id === selectedInvoice!.companyId) || companies.find(c => c.isActive) || companies[0];
                    const fullDoc = { ...selectedInvoice!, person, company: activeComp };
                    setShareDocPreview(JSON.stringify(fullDoc));
                    setShowShareModal(true);
                  } catch (err) {
                    console.error('خطا در آماده‌سازی پنجره اشتراک‌گذاری:', err);
                  }
                }} 
                className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 md:px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border border-indigo-500/10 shadow-sm"
                title="اشتراک‌گذاری، دریافت امضای راه دور، و QR کد"
              >
                <Share2 size={16}/> 
                <span className="hidden md:inline">اشتراک‌گذاری و امضای آنلاین</span>
              </button>
              <button 
                onClick={() => handleSendSmsForInvoice(selectedInvoice!)}
                disabled={isSendingSms}
                className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white px-3 md:px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border border-emerald-500/10 disabled:opacity-50"
                title="ارسال پیامک صورتحساب با وب‌هوک محلی"
              >
                <MessageSquare size={16} />
                <span className="hidden md:inline">{isSendingSms ? 'در حال ارسال...' : 'ارسال پیامک'}</span>
              </button>
            </div>
            <select className="bg-slate-800 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-black outline-none focus:border-teal-500 shadow-inner" value={printTheme} onChange={e => setPrintTheme(e.target.value as PrintTheme)}>
                <option value="thermal">🧾 تم فیش پرینتر حرارتی ۸۰ میلی‌متری (پوز، صندوق و موبایل)</option>
                <option value="persian">🇮🇷 تم اصیل ایرانی (کانوا، نقوش هشتی و گره‌چینی)</option>
                <option value="smart">🏢 تم شرکتی مدرن (روشن)</option>
                <option value="creative">🎨 تم خلاقانه و زنده (روشن و خوانا)</option>
                <option value="official">🏛️ تم رسمی و مالیاتی دارایی (روشن)</option>
                <option value="industrial">⚙️ تم صنعتی دقیق (روشن)</option>
                <option value="minimal">📄 تم مینیمال اقتصادی (روشن)</option>
                <option value="premium">👑 تم مدیریتی زرین (عاجی روشن)</option>
            </select>
            <label className="flex items-center gap-2 bg-slate-800 border border-white/10 px-3.5 py-2.5 rounded-2xl cursor-pointer text-xs font-bold text-white transition-all select-none hover:bg-slate-700 shadow-inner">
              <input 
                type="checkbox" 
                checked={!showPreviousBalance} 
                onChange={e => setShowPreviousBalance(!e.target.checked)}
                className="w-4 h-4 rounded accent-teal-500 cursor-pointer"
              />
              <span className="text-xs">عدم نمایش مانده قبل (فقط این فاکتور)</span>
            </label>
            <button 
              onClick={downloadAndSendPdf} 
              disabled={downloadingPDF}
              className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-rose-500/10"
              title="دانلود و ارسال PDF فاکتور"
            >
              {downloadingPDF ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FileText size={16}/>
              )}
              <span>دانلود PDF</span>
            </button>
            <button 
              onClick={downloadInvoiceAsImage} 
              disabled={downloadingImage}
              className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-blue-500/10"
              title="دانلود تصویر فاکتور"
            >
              {downloadingImage ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Camera size={16}/>
              )}
              <span>دانلود تصویر</span>
            </button>
            <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 md:px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2" title="چاپ (Alt+P)">
              <Printer size={20}/>
              <span className="hidden sm:inline">چاپ فاکتور</span>
            </button>
          </div>
        </header>
        <div className="flex-1 w-full overflow-y-auto p-2 md:p-12 flex flex-col items-center bg-slate-950/95 custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block pb-28 md:pb-12">
          {/* دکمه سریع انتخاب فیش حرارتی در موبایل */}
          <div className="md:hidden w-full max-w-sm mb-3 flex items-center justify-between bg-slate-900/90 p-2.5 rounded-2xl border border-white/10 text-xs">
            <span className="text-slate-300 font-bold">حالت فیش پرینتر حرارتی موبایل:</span>
            <button
              onClick={() => setPrintTheme(printTheme === 'thermal' ? 'smart' : 'thermal')}
              className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all ${
                printTheme === 'thermal' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {printTheme === 'thermal' ? 'فعال (۸۰mm)' : 'تغییر به ۸۰mm'}
            </button>
          </div>

          <div className={`relative mb-24 w-full print-content print:mb-0 flex justify-center ${printTheme === 'thermal' ? 'max-w-[85mm]' : 'max-w-4xl'}`}>
            <div 
              ref={invoiceRef} 
              className={`invoice-paper bg-white text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.5)] rounded-none md:rounded-sm overflow-visible print-content print:shadow-none flex flex-col h-auto shrink-0 border border-slate-300 w-full ${
                printTheme === 'thermal' ? 'max-w-[80mm] p-0' : 'sheet-a4-white min-h-[297mm]'
              }`}
            >
              <InvoicePrint data={selectedInvoice!} person={person} theme={printTheme} showPreviousBalance={showPreviousBalance} />
            </div>
          </div>
        </div>

        {/* نوار عملیات لمسی پایین صفحه برای موبایل */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-3 px-4 z-50 flex items-center justify-between gap-2 shadow-[0_-8px_25px_rgba(0,0,0,0.5)] no-print">
          <button 
            onClick={() => window.print()} 
            className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Printer size={18} />
            <span>چاپ</span>
          </button>
          <button 
            onClick={downloadAndSendPdf} 
            disabled={downloadingPDF}
            className="flex-1 min-h-[48px] bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <FileText size={16} />
            <span>PDF</span>
          </button>
          <button 
            onClick={downloadInvoiceAsImage} 
            disabled={downloadingImage}
            className="flex-1 min-h-[48px] bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Camera size={16} />
            <span>عکس</span>
          </button>
          <button 
            onClick={() => setView('list')} 
            className="w-12 min-h-[48px] bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            title="بازگشت"
          >
            <X size={20} />
          </button>
        </div>
        <FullScreenSignatureModal isOpen={showSignaturePad} onClose={() => setShowSignaturePad(false)} onSave={(img: string) => { if(selectedInvoiceId) setInvoiceSignature(selectedInvoiceId, img, activeSignRole as any); }} />
        {showShareModal && selectedInvoice && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            documentId={selectedInvoice.id}
            documentType="فاکتور"
            documentPreview={shareDocPreview}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4 no-print">
        <div className="text-center md:text-right w-full md:w-auto">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">مدیریت فاکتورها</h1>
            <button 
              onClick={() => setShowHelpModal(true)} 
              className="bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white p-2 rounded-xl transition-all border border-teal-500/20"
              title="راهنمای هوشمند صدور فاکتور و ارسال پیامک"
            >
              <HelpCircle size={18} />
            </button>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Smart Financial Invoicing System</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {(view === 'create' || view === 'edit') && (
            <>
              <button 
                onClick={() => setShowPersonModal(true)} 
                className="flex-1 min-h-[48px] bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition-all" 
                title="ثبت سریع شخص"
              >
                <UserPlus size={18} />
                <span className="whitespace-nowrap">شخص جدید</span>
              </button>
              <button 
                onClick={() => setShowProductModal(true)} 
                className="flex-1 min-h-[48px] bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600 hover:text-white px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition-all" 
                title="ثبت سریع کالا"
              >
                <PackagePlus size={18} />
                <span className="whitespace-nowrap">کالای جدید</span>
              </button>
            </>
          )}
          <button 
            onClick={() => { if(view !== 'list') resetForm(); else setView('create'); }} 
            className="flex-1 md:flex-none min-h-[48px] bg-teal-600 hover:bg-teal-500 text-white px-5 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-2.5 shadow-xl font-black active:scale-95 transition-all text-xs md:text-sm whitespace-nowrap" 
            title={view === 'list' ? 'فاکتور جدید (Alt+N)' : 'بازگشت (Esc)'}
          >
            {view === 'list' ? <PlusCircle size={20} /> : <X size={20} />}
            <span>{view === 'list' ? 'فاکتور جدید' : 'انصراف و بازگشت'}</span>
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-4">
          {/* نوار فیلتر و سورت فاکتورها */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-2">
            {/* تب‌های نوع فاکتور */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filterType === 'ALL' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                همه ({toPersianDigits(invoices.length)})
              </button>
              <button
                onClick={() => setFilterType(InvoiceType.SALE)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filterType === InvoiceType.SALE ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                فروش ({toPersianDigits(invoices.filter(i => i.type === InvoiceType.SALE).length)})
              </button>
              <button
                onClick={() => setFilterType(InvoiceType.PROFORMA)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filterType === InvoiceType.PROFORMA ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                پیش‌فاکتور ({toPersianDigits(invoices.filter(i => i.type === InvoiceType.PROFORMA).length)})
              </button>
              <button
                onClick={() => setFilterType(InvoiceType.PURCHASE)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filterType === InvoiceType.PURCHASE ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                خرید ({toPersianDigits(invoices.filter(i => i.type === InvoiceType.PURCHASE).length)})
              </button>
            </div>

            {/* کنترل‌های مرتب‌سازی (پیش‌فرض: تاریخ صدور) */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
              <span className="text-xs text-slate-400 font-bold flex items-center gap-1 pr-2">
                <ArrowUpDown size={14} className="text-teal-400" />
                مرتب‌سازی:
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-teal-500"
              >
                <option value="date">تاریخ صدور (پیش‌فرض)</option>
                <option value="number">شماره فاکتور</option>
                <option value="finalTotal">مبلغ کل فاکتور</option>
                <option value="personName">نام طرف حساب</option>
                <option value="dueDate">تاریخ سررسید</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-white/5 transition-all"
                title={sortOrder === 'desc' ? 'ترتیب: نزولی (جدیدترین / بیشترین)' : 'ترتیب: صعودی (قدیمی‌ترین / کمترین)'}
              >
                {sortOrder === 'desc' ? (
                  <>
                    <ArrowDown size={14} className="text-amber-400" />
                    <span>نزولی</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={14} className="text-emerald-400" />
                    <span>صعودی</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {filterType === InvoiceType.PROFORMA && (
            <div className="text-amber-400 text-xs font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl flex items-center gap-1.5 mx-2">
              <ShieldAlert size={15} /> پیش‌فاکتورها سند برآورد هستند و در تراز مالی و مانده بدهی مشتری منظور نمی‌شوند.
            </div>
          )}

          <div className="bg-transparent md:bg-slate-900/60 border-none md:border border-white/5 rounded-[2.5rem] overflow-hidden shadow-none md:shadow-2xl">
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {displayedInvoices.map(inv => (
                <div key={inv.id} className="bg-slate-900/80 border border-white/10 p-5 rounded-4xl shadow-lg flex flex-col gap-4 active:scale-[0.98] transition-transform">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold block mb-1">فاکتور شماره {(inv.prefix || '') + toPersianDigits(inv.number)}</span>
                            <h3 className="text-white font-black text-lg">{inv.personName}</h3>
                            <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md font-bold inline-block mt-1">
                                {inv.branchName ? `${inv.companyName || 'اشک قلم'} - ${inv.branchName}` : (inv.companyName || 'شعبه مرکزی')}
                            </span>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                          inv.type === InvoiceType.SALE 
                            ? 'bg-teal-500/20 text-teal-400' 
                            : inv.type === InvoiceType.PROFORMA 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}>
                          {inv.type === InvoiceType.PROFORMA ? 'پیش‌فاکتور' : inv.type}
                        </span>
                    </div>
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {toPersianDigits(inv.date)}</span>
                        <span className="text-white font-mono font-black text-lg">{formatCurrency(inv.finalTotal)}</span>
                    </div>
                    {inv.type === InvoiceType.PROFORMA && (
                      <button 
                        onClick={() => handleConvertToSale(inv)} 
                        className="w-full min-h-[44px] bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-amber-500/30 shadow-sm"
                        title="تبدیل به فاکتور فروش قطعی و ثبت در سیستم حسابداری"
                      >
                        <CheckCircle2 size={16}/> تبدیل به فاکتور فروش قطعی
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => setReceiptInvoice(inv)} className="flex-1 min-h-[44px] bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all" title="ثبت دریافت یا پرداخت وجه بابت این فاکتور"><Banknote size={16}/> ثبت دریافتی</button>
                        <button onClick={() => handlePreview(inv)} className="flex-1 min-h-[44px] bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"><Eye size={16}/> نمایش و چاپ</button>
                        <button onClick={() => handleEdit(inv)} className="flex-1 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"><Edit size={16}/> ویرایش</button>
                        <button onClick={() => handleOpenSmsModal(inv)} className="w-11 min-h-[44px] bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95" title="ارسال پیامک مستقیم اندروید / وب‌سرویس"><Smartphone size={16}/></button>
                        <button onClick={() => handleShareLink(inv.id)} className="w-11 min-h-[44px] bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-95" title="اشتراک‌گذاری"><Share2 size={16}/></button>
                        <button onClick={() => setDeleteTarget(inv.id)} className="w-11 min-h-[44px] bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl flex items-center justify-center active:scale-95 transition-all" title="حذف فاکتور"><Trash2 size={17}/></button>
                    </div>
                </div>
              ))}
            </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right" dir="rtl">
              <thead className="bg-white/5 text-slate-400 text-[11px] font-black">
                <tr>
                  <th onClick={() => handleToggleSort('number')} className="p-5 cursor-pointer hover:text-teal-300 transition-colors select-none">
                    <div className="flex items-center gap-1">
                      <span>شماره</span>
                      {sortBy === 'number' && (sortOrder === 'desc' ? <ArrowDown size={13} className="text-teal-400"/> : <ArrowUp size={13} className="text-teal-400"/>)}
                    </div>
                  </th>
                  <th onClick={() => handleToggleSort('date')} className="p-5 cursor-pointer hover:text-teal-300 transition-colors select-none">
                    <div className="flex items-center gap-1">
                      <span>تاریخ صدور</span>
                      {sortBy === 'date' && (sortOrder === 'desc' ? <ArrowDown size={13} className="text-teal-400"/> : <ArrowUp size={13} className="text-teal-400"/>)}
                    </div>
                  </th>
                  <th onClick={() => handleToggleSort('personName')} className="p-5 cursor-pointer hover:text-teal-300 transition-colors select-none">
                    <div className="flex items-center gap-1">
                      <span>طرف حساب و شعبه</span>
                      {sortBy === 'personName' && (sortOrder === 'desc' ? <ArrowDown size={13} className="text-teal-400"/> : <ArrowUp size={13} className="text-teal-400"/>)}
                    </div>
                  </th>
                  <th className="p-5">نوع سند</th>
                  <th onClick={() => handleToggleSort('finalTotal')} className="p-5 text-right cursor-pointer hover:text-teal-300 transition-colors select-none">
                    <div className="flex items-center justify-end gap-1">
                      <span>مبلغ نهایی</span>
                      {sortBy === 'finalTotal' && (sortOrder === 'desc' ? <ArrowDown size={13} className="text-teal-400"/> : <ArrowUp size={13} className="text-teal-400"/>)}
                    </div>
                  </th>
                  <th className="p-5 text-center">عملیات و ارتباط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200 text-sm">
                {displayedInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5 font-mono text-slate-400 font-black">{(inv.prefix || '') + toPersianDigits(inv.number)}</td>
                    <td className="p-5 text-xs text-slate-300 font-mono">{toPersianDigits(inv.date)}</td>
                    <td className="p-5">
                      <div className="font-black text-white">{inv.personName}</div>
                      <div className="text-[11px] text-teal-400/80 font-bold mt-0.5">
                        {inv.branchName ? `${inv.companyName || 'اشک قلم'} (${inv.branchName})` : (inv.companyName || 'شعبه مرکزی')}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                        inv.type === InvoiceType.SALE 
                          ? 'bg-teal-500/20 text-teal-400' 
                          : inv.type === InvoiceType.PROFORMA 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {inv.type === InvoiceType.PROFORMA ? 'پیش‌فاکتور' : inv.type}
                      </span>
                    </td>
                    <td className="p-5 text-right font-mono font-black text-white">{formatCurrency(inv.finalTotal)}</td>
                    <td className="p-4 flex justify-center gap-2">
                      {inv.type === InvoiceType.PROFORMA && (
                        <button 
                          onClick={() => handleConvertToSale(inv)} 
                          className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-600 hover:text-white transition-all font-bold flex items-center gap-1 text-xs" 
                          title="تبدیل پیش‌فاکتور به فاکتور فروش قطعی و ثبت حسابداری"
                        >
                          <CheckCircle2 size={18}/>
                          <span className="hidden xl:inline">تبدیل به فروش</span>
                        </button>
                      )}
                      <button onClick={() => setReceiptInvoice(inv)} className="p-3 bg-teal-500/10 text-teal-400 rounded-xl hover:bg-teal-600 hover:text-white transition-all" title="ثبت دریافت وجه / تسویه بابت این فاکتور"><Banknote size={18}/></button>
                      <button onClick={() => handlePreview(inv)} className="p-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all" title="پیش‌نمایش و چاپ"><Eye size={18}/></button>
                      <button onClick={() => handleEdit(inv)} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all" title="ویرایش"><Edit size={18}/></button>
                      <button onClick={() => handleOpenSmsModal(inv)} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all" title="ارسال پیامک مستقیم اندروید / وب‌سرویس"><Smartphone size={18}/></button>
                      <button onClick={() => handleShareLink(inv.id)} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all" title="اشتراک‌گذاری"><Share2 size={18}/></button>
                      <button onClick={() => setDeleteTarget(inv.id)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all" title="حذف"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
          {/* ... (Create/Edit Form remains mostly same, just ensuring responsiveness) ... */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 md:p-10 shadow-2xl space-y-4">
              <div className="space-y-3">
                {/* انتخاب نوع سند: فروش / پیش‌فاکتور / خرید */}
                <div className="bg-slate-950/90 p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 text-xs font-black">نوع سند فاکتور:</span>
                    <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => handleSelectInvoiceType(InvoiceType.SALE)}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${type === InvoiceType.SALE ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        فاکتور فروش (INV-)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectInvoiceType(InvoiceType.PROFORMA)}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${type === InvoiceType.PROFORMA ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        پیش‌فاکتور (PRO-)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectInvoiceType(InvoiceType.PURCHASE)}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${type === InvoiceType.PURCHASE ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        فاکتور خرید (PUR-)
                      </button>
                    </div>
                  </div>

                  {type === InvoiceType.PROFORMA && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right" dir="rtl">
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-200 leading-relaxed">
                          <strong>پیش‌فاکتور سندی غیرمالی است:</strong> تا زمان تبدیل به فاکتور قطعی، هیچ‌گونه سند مالی، بدهکاری یا بستانکاری در دفاتر حسابداری ثبت نمی‌گردد. پانویس قانونی عدم تعهد قیمت در صورت تغییر بهای تمام‌شده و نوسان بازار به صورت خودکار به برگه چاپی پیوست می‌شود.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDescription(PROFORMA_STANDARD_NOTE)}
                        className="shrink-0 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-400/40 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        درج پانویس استاندارد در متن
                      </button>
                    </div>
                  )}
                </div>

                {/* انتخاب شرکت و شعبه جهت سربرگ، مهر و امضا */}
                <div className="bg-slate-950/80 p-4 md:p-5 rounded-2xl border border-teal-500/20 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-teal-400 font-black text-sm">
                      <Building2 size={18} />
                      <span>صادرکننده فاکتور (تنظیم سربرگ، مهر و امضا)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBranchModal(true)}
                      className="flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-xl transition-all border border-teal-500/20 font-bold"
                    >
                      <Plus size={14} />
                      <span>افزودن شعبه جدید</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-xs font-bold pr-1 mb-1.5 block">انتخاب شرکت / مجموعه</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-teal-500 appearance-none pl-8"
                          value={selectedCompanyId}
                          onChange={e => handleCompanyChange(e.target.value)}
                        >
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isActive ? '(فعال)' : ''}
                            </option>
                          ))}
                        </select>
                        <Building2 size={16} className="absolute left-3 top-3.5 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 text-xs font-bold pr-1 mb-1.5 block">انتخاب شعبه صادرکننده</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-teal-500 appearance-none pl-8"
                          value={selectedBranchId}
                          onChange={e => setSelectedBranchId(e.target.value)}
                        >
                          {currentAvailableBranches.length > 0 ? (
                            currentAvailableBranches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name} {b.code ? `(کد ${toPersianDigits(b.code)})` : ''}
                              </option>
                            ))
                          ) : (
                            <option value="">شعبه مرکزی</option>
                          )}
                        </select>
                        <Store size={16} className="absolute left-3 top-3.5 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* نوار پیش‌نمایش هویت سربرگ انتخابی */}
                  <div className="bg-slate-900/90 border border-white/5 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 shrink-0">
                        {currentSelectedBranch?.logo || currentSelectedCompany?.logo ? (
                          <img
                            src={currentSelectedBranch?.logo || currentSelectedCompany?.logo}
                            alt="لوگو"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 size={20} className="text-teal-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-black text-sm flex items-center gap-2">
                          <span>{currentSelectedCompany?.name || 'مجموعه تجاری'}</span>
                          {currentSelectedBranch?.name && (
                            <span className="bg-teal-500/20 text-teal-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                              شعبه: {currentSelectedBranch.name}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          <span>تلفن: {toPersianDigits(currentSelectedBranch?.phone || currentSelectedCompany?.phone || '---')}</span>
                          <span>|</span>
                          <span className="truncate max-w-[200px] md:max-w-[320px]">
                            {currentSelectedBranch?.address || currentSelectedCompany?.address || 'تهران'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {(currentSelectedBranch?.stamp || currentSelectedCompany?.stamp) && (
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={12} /> مهر فعال
                        </span>
                      )}
                      {(currentSelectedBranch?.signature || currentSelectedCompany?.signature) && (
                        <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md border border-blue-500/20 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={12} /> امضای دیجیتال
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* شماره فاکتور و پیشوند سفارشی با قابلیت رندوم و پیش‌فرض هوشمند */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div>
                      <span className="text-white text-xs font-black flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        شماره‌گذاری و پیشوند فاکتور
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {type === InvoiceType.SALE && 'پیش‌فرض فاکتور فروش: پیشوند INV- و شماره از 1001 به بالا'}
                        {type === InvoiceType.PROFORMA && 'پیش‌فرض پیش‌فاکتور: پیشوند PRO- و شماره از 2001 به بالا'}
                        {type === InvoiceType.PURCHASE && 'پیش‌فرض فاکتور خرید: پیشوند PUR- و شماره از 3001 به بالا'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateRandomNumber}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-purple-500/30 active:scale-95 transition-all"
                        title="تولید شماره فاکتور تصادفی و یکتا"
                      >
                        <Shuffle size={14} />
                        <span>شماره رندوم</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetToAutoDefaults}
                        className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-teal-500/30 active:scale-95 transition-all"
                        title="بازنشانی به شماره ترتیبی و پیشوند استاندارد این نوع فاکتور"
                      >
                        <RotateCcw size={14} />
                        <span>پیش‌فرض هوشمند</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <label className="text-slate-400 text-xs font-bold pr-1 mb-1.5 block">پیشوند فاکتور (اختیاری)</label>
                      <input 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white font-mono text-sm tracking-wider outline-none focus:border-teal-500 uppercase"
                        value={invoicePrefix}
                        onChange={e => setInvoicePrefix(e.target.value)}
                        placeholder="مثال: INV- یا PRO-"
                      />
                    </div>
                    <div className="md:col-span-8">
                      <label className="text-slate-400 text-xs font-bold pr-1 mb-1.5 block">شماره فاکتور (پیشنهادی / قابل ویرایش دستی)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          min="1"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white font-mono font-black text-base outline-none focus:border-teal-500"
                          value={invoiceNumber}
                          onChange={e => setInvoiceNumber(parseInt(e.target.value) || 1)}
                        />
                        <span className="shrink-0 text-xs font-bold bg-white/5 text-slate-300 px-3.5 py-3 rounded-xl border border-white/5 font-mono whitespace-nowrap">
                          شناسه ثبت: {(invoicePrefix || '') + toPersianDigits(invoiceNumber)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold pr-2 mb-2 block">طرف حساب</label>
                  <div className="flex gap-2">
                    <select className="flex-1 bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-base font-bold shadow-inner outline-none focus:border-teal-500" value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}>
                      <option value="">انتخاب از لیست...</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button 
                      onClick={handleOpenPersonModal} 
                      type="button" 
                      className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white w-14 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg" 
                      title="ثبت سریع شخص جدید"
                    >
                      <UserPlus size={22} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <JalaliDatePicker label="تاریخ فاکتور" value={invoiceDate} onChange={setInvoiceDate} />
                  <JalaliDatePicker label="سررسید" value={dueDate} onChange={setDueDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs font-bold pr-2 mb-2 block">شناسه یکتای ۲۲ رقمی مالیاتی (سامانه مودیان - اختیاری)</label>
                  <input 
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3.5 text-white font-mono text-sm text-center tracking-wider outline-none focus:border-teal-500 uppercase"
                    maxLength={22}
                    value={taxId}
                    onChange={e => setTaxId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                    placeholder="E.g. A1B2C3D4E5F6G7H8I9J0K1"
                    tabIndex={3}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Truck size={16} className="text-indigo-400"/> حمل (اختیاری)</h3>
                <div className="space-y-3">
                   <input className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-white text-base font-bold" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="نام راننده" />
                   <div className="grid grid-cols-2 gap-3">
                     <input className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-white font-mono text-base" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="تلفن" />
                     <input className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-white text-base font-bold" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="پلاک" />
                   </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 md:p-10 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><ShoppingBag size={18} className="text-teal-400"/> اقلام و کالاها</h3>
                <span className="text-[11px] text-teal-400/80 font-bold bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">
                  ردیف‌های جدید در بالای جدول افزوده می‌شوند
                </span>
              </div>
              {/* نوار اسکنر دستی بارکدخوان و شماره سریال با کنتراست بالا و راهنمای هوشمند */}
              <div className="bg-slate-950 p-4 rounded-2xl border-2 border-indigo-400/50 mb-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-black">
                    <Barcode size={20} className="text-indigo-400" />
                    <span>ورودی اسکنر دستی بارکدخوان و شماره سریال:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-xl border border-amber-400/40 text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                      title="راهنمای هوشمند اسکنر دستی (؟)"
                    >
                      <HelpCircle size={14} />
                      <span>راهنما (؟)</span>
                    </button>
                    <span className="text-[11px] text-indigo-200 font-bold bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-500/30">
                      پشتیبانی خودکار از کیبورد اسکنر و Enter
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="بارکد یا شماره سریال را با اسکنر تفنگی اسکن کنید (یا تایپ و Enter)..."
                    value={manualBarcodeInput}
                    onChange={e => setManualBarcodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (manualBarcodeInput.trim()) {
                          handleProcessScannedCodeForInvoice(manualBarcodeInput.trim());
                          setManualBarcodeInput('');
                        }
                      }
                    }}
                    className="flex-1 bg-slate-900 border-2 border-slate-600 rounded-xl px-3.5 py-3 text-white font-mono text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 tracking-wider placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualBarcodeInput.trim()) {
                        handleProcessScannedCodeForInvoice(manualBarcodeInput.trim());
                        setManualBarcodeInput('');
                      } else {
                        setShowBarcodeScanner(true);
                      }
                    }}
                    className="bg-indigo-500 hover:bg-indigo-400 text-slate-950 px-4 py-3 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer whitespace-nowrap border border-indigo-300"
                    title="ثبت بارکد اسکن شده یا باز کردن اسکنر تصویری"
                  >
                    <Scan size={16} />
                    <span>{manualBarcodeInput.trim() ? 'ثبت کالا در فاکتور' : 'اسکن با دوربین'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <select className="product-select flex-1 min-w-0 bg-slate-950 border-2 border-slate-600 rounded-xl p-3.5 text-white text-sm font-bold outline-none focus:border-teal-400" onChange={(e) => {
                      const product = products.find(p => p.id === e.target.value);
                      if (product) {
                          const nextOrder = items.reduce((max, it) => Math.max(max, it.entryOrder || 0), 0) + 1;
                          const newItem: InvoiceItem = {
                              productId: product.id, productName: product.name, 
                              serialNumber: product.serialNumber,
                              quantity: 1,
                              buyPrice: product.buyPrice || 0, unitPrice: type === InvoiceType.SALE ? (product.sellPrice || 0) : (product.buyPrice || 0),
                              total: type === InvoiceType.SALE ? (product.sellPrice || 0) : (product.buyPrice || 0),
                              profit: type === InvoiceType.SALE ? ((product.sellPrice || 0) - (product.buyPrice || 0)) : 0,
                              description: '',
                              entryOrder: nextOrder
                          };
                          setItems([newItem, ...items]);
                          setTimeout(() => {
                              (document.querySelector(`.qty-input-0`) as HTMLInputElement)?.focus();
                          }, 50);
                      }
                      e.target.value = "";
                  }}>
                  <option value="">+ انتخاب کالا برای افزودن به بالاترین سطر (دسترسی سریع بدون اسکرول)...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.serialNumber ? `(سریال: ${p.serialNumber})` : ''} {p.category ? `[${p.category}]` : ''}
                    </option>
                  ))}
              </select>
              <button 
                type="button"
                onClick={() => {
                  const nextOrder = items.reduce((max, it) => Math.max(max, it.entryOrder || 0), 0) + 1;
                  const newItem: InvoiceItem = {
                    productId: 'manual-' + generateId(),
                    productName: '',
                    quantity: 1,
                    buyPrice: 0,
                    unitPrice: 0,
                    total: 0,
                    profit: 0,
                    description: '',
                    entryOrder: nextOrder
                  };
                  setItems([newItem, ...items]);
                  setTimeout(() => {
                    (document.querySelector('.name-input-0') as HTMLInputElement)?.focus();
                  }, 50);
                }}
                className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-100 border-2 border-slate-600 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer"
                title="افزودن ردیف آزاد / دستی به بالاترین سطر"
              >
                <PlusCircle size={16} />
                <span className="hidden sm:inline">ردیف آزاد در بالا</span>
              </button>
              <button onClick={handleOpenProductModal} className="shrink-0 bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer font-black border border-teal-300 shadow-md" title="تعریف سریع کالای جدید">
                <PackagePlus size={22} />
              </button>
              </div>
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-2xl text-slate-300 font-bold text-sm bg-slate-950/40">
                    هیچ کالایی به فاکتور افزوده نشده است. از اسکنر دستی یا کادر انتخاب کالا استفاده نمایید.
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border-2 border-slate-700 space-y-2.5 shadow-md">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="shrink-0 bg-teal-500/20 text-teal-300 border border-teal-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md" title="ترتیب ثبت در فاکتور نهایی">
                            ردیف {toPersianDigits(item.entryOrder || (items.length - idx))}
                          </span>
                          {item.serialNumber && (
                            <span className="shrink-0 bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1" title="شماره سریال اختصاصی کالا">
                              <Barcode size={12} className="text-indigo-400" />
                              <span>{item.serialNumber}</span>
                            </span>
                          )}
                          {item.productId.startsWith('manual-') ? (
                            <input
                              className={`name-input-${idx} flex-1 bg-slate-900 border-2 border-slate-600 rounded-lg px-2.5 py-1 text-sm text-white font-bold outline-none focus:border-teal-400`}
                              placeholder="نام کالا یا خدمات دستی..."
                              value={item.productName}
                              onChange={e => {
                                const n = [...items];
                                n[idx].productName = e.target.value;
                                setItems(n);
                              }}
                            />
                          ) : (
                            <span className="text-white font-black text-sm truncate">{item.productName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-teal-300 font-mono font-black text-xs bg-slate-900 px-3 py-1.5 rounded-lg border-2 border-slate-700">
                            {formatCurrency(item.total)}
                          </span>
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-rose-400 p-1.5 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer" title="حذف ردیف"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberInput 
                          label="تعداد" 
                          value={item.quantity} 
                          onChange={v => { const n = [...items]; n[idx].quantity = v; n[idx].total = v * n[idx].unitPrice; setItems(n); }} 
                          className={`qty-input-${idx}`}
                          onKeyDown={e => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  (document.querySelector(`.price-input-${idx}`) as HTMLInputElement)?.focus();
                              }
                          }}
                        />
                        <NumberInput 
                          label="فی (قیمت واحد)" 
                          value={item.unitPrice} 
                          onChange={v => { const n = [...items]; n[idx].unitPrice = v; n[idx].total = v * item.quantity; setItems(n); }} 
                          className={`price-input-${idx}`}
                          onKeyDown={e => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  (document.querySelector(`.desc-input-${idx}`) as HTMLInputElement)?.focus();
                              }
                          }}
                        />
                      </div>
                      <input 
                        className={`desc-input-${idx} w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-400 outline-none`} 
                        placeholder="توضیحات این ردیف (اختیاری)..." 
                        value={item.description || ''} 
                        onChange={e => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} 
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                (document.querySelector('.product-select') as HTMLSelectElement)?.focus();
                            }
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 md:p-10 shadow-2xl">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Wallet size={18} className="text-indigo-400"/> پرداخت</h3>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <NumberInput label="تخفیف" value={discount} onChange={setDiscount} className="text-rose-400" />
                      <NumberInput label="مالیات" value={tax} onChange={setTax} className="text-indigo-400" />
                    </div>
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-2">
                        <NumberInput label="نقدی" value={cashAmount} onChange={setCashAmount} className="text-emerald-400" />
                        <button
                          type="button"
                          onClick={() => setShowPosModal(true)}
                          className="w-full mt-2 py-2.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <CreditCard size={16} />
                          <span>پرداخت مستقیم با کارتخوان بانکی (PC-POS)</span>
                        </button>
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs font-bold pr-2 mb-2 block">چک</label>
                        <button onClick={handleOpenCheckModal} className="w-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"><CreditCard size={18}/> ثبت چک</button>
                        {checkPayment.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {checkPayment.map((c, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-white/5 text-xs">
                                        <div>
                                            <span className="text-white font-bold block">{c.bankName}</span>
                                            <span className="text-slate-400 font-mono font-bold">{formatCurrency(c.amount)}</span>
                                        </div>
                                        <button onClick={() => setCheckPayment(checkPayment.filter((_, idx) => idx !== i))} className="text-rose-500 p-2 hover:bg-rose-500/10 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* دکمه / تیک کنترل نمایش مانده فاکتورهای قبل */}
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-white/10 flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 select-none">
                        <input 
                          type="checkbox" 
                          checked={!showPreviousBalance} 
                          onChange={e => setShowPreviousBalance(!e.target.checked)}
                          className="w-4 h-4 rounded accent-teal-500 cursor-pointer"
                        />
                        <span>عدم نمایش مانده فاکتورهای قبل (فقط مبلغ این فاکتور)</span>
                      </label>
                      <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                        {showPreviousBalance ? 'مانده پیشین فعال' : 'تنها تسویه این فاکتور'}
                      </span>
                    </div>
                </div>
                
                {/* Footer Description Section */}
                <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <h4 className="text-sm font-black text-white flex items-center gap-2"><TextQuote size={18} className="text-slate-400"/> توضیحات و پانویس فاکتور</h4>
                        <div className="flex gap-2 w-full md:w-auto items-start">
                            <div className="flex-1 md:flex-none bg-slate-950 border border-white/10 rounded-xl p-2 max-h-36 overflow-y-auto custom-scrollbar min-w-[220px]">
                                {savedDescriptions.length === 0 ? (
                                    <div className="text-[10px] text-slate-500 p-1 text-center">پانویس آماده‌ای ثبت نشده است</div>
                                ) : (
                                    savedDescriptions.map((desc, i) => {
                                        const cleanDesc = desc.trim();
                                        const currentLines = description.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                                        const isChecked = currentLines.includes(cleanDesc);

                                        return (
                                            <div key={i} className="flex items-center justify-between gap-1.5 p-1 hover:bg-white/5 rounded text-[10px] text-white">
                                                <label className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-3.5 h-3.5 accent-teal-500 shrink-0"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setDescription(prev => {
                                                                    const lines = prev ? prev.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
                                                                    if (!lines.includes(cleanDesc)) {
                                                                        lines.push(cleanDesc);
                                                                    }
                                                                    return lines.join('\n');
                                                                });
                                                            } else {
                                                                setDescription(prev => {
                                                                    const lines = prev.split(/\r?\n/).map(l => l.trim()).filter(l => l !== cleanDesc && Boolean(l));
                                                                    return lines.join('\n');
                                                                });
                                                            }
                                                        }}
                                                    />
                                                    <span className="truncate flex-1" title={cleanDesc}>{cleanDesc}</span>
                                                </label>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        if (confirm(`آیا از حذف این پانویس از لیست اطمینان دارید؟\n«${cleanDesc.slice(0, 30)}...»`)) {
                                                            removeSavedDescription(i);
                                                        }
                                                    }}
                                                    className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded transition-all shrink-0" 
                                                    title="حذف این پانویس"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <button onClick={handleSaveDescription} className="p-2.5 bg-white/5 rounded-xl hover:bg-teal-600 hover:text-white transition-all text-slate-400 shrink-0" title="ذخیره متن فعلی به عنوان پانویس آماده"><BookmarkPlus size={16}/></button>
                        </div>
                    </div>
                    <textarea 
                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white text-xs leading-6 outline-none focus:border-teal-500 h-28 resize-none shadow-inner" 
                        placeholder="توضیحات و پانویس فاکتور (هر شرط یا پانویس در یک سطر جداگانه)..." 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
                        <span>ℹ️ هر پانویس در یک خط مجزا قرار می‌گیرد و در برگه چاپی نیز خط‌به‌خط نمایش داده می‌شود.</span>
                        <span className="font-mono text-teal-400 font-bold">{toPersianDigits(description.split(/\r?\n/).filter(Boolean).length)} خط پانویس</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl sticky top-24 space-y-6">
              <div className="space-y-4">
                 <SignIndicator label="ثبت اقلام در انبار" active={items.length > 0} icon={ShoppingBag} />
                 <SignIndicator label="محاسبه تراز مالی" active={payable > 0} icon={Calculator} />
                 <SignIndicator label="اطلاعات راننده" active={!!driverName} icon={Truck} />
              </div>

              {/* گزینه ارسال پیامک هوشمند به خریدار */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={autoSendSms} 
                    onChange={e => setAutoSendSms(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-emerald-400" />
                    ارسال خودکار پیامک صورتحساب
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 leading-relaxed pr-6">
                  بلافاصله پس از ثبت فاکتور، پیامک شامل شماره فاکتور، مبلغ و لینک اختصاصی امضا و پرداخت به شماره موبایل خریدار ارسال می‌شود.
                </p>
              </div>

              <div className="pt-2 border-t border-white/5">
                <button 
                  onClick={() => {
                    console.log('Save button clicked');
                    handleSaveInvoice();
                  }} 
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white py-5 rounded-3xl flex items-center justify-center gap-3 transition-all shadow-xl font-black text-lg active:scale-95 shadow-teal-600/20" 
                  title="ذخیره و ثبت (Alt+S)"
                >
                    <Save size={24}/> <span>تایید و ثبت نهایی</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نوار زنده مبلغ نهایی فاکتور در پایین صفحه */}
      {(view === 'create' || view === 'edit') && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-teal-500/20 px-4 md:px-8 py-3 shadow-[0_-10px_25px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-4 no-print" dir="rtl">
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>تعداد اقلام:</span>
              <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg">
                {toPersianDigits(items.length)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span>جمع کالاها:</span>
              <span className="font-mono font-bold text-slate-200">
                {formatCurrency(subTotal)}
              </span>
            </div>
            {discount > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-rose-400">
                <span>تخفیف:</span>
                <span className="font-mono font-bold">
                  - {formatCurrency(discount)}
                </span>
              </div>
            )}
            {tax > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-indigo-400">
                <span>مالیات:</span>
                <span className="font-mono font-bold">
                  + {formatCurrency(tax)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 px-3.5 py-1.5 rounded-xl">
              <span className="text-teal-400 font-bold text-xs md:text-sm">مبلغ نهایی فاکتور (زنده):</span>
              <span className="text-teal-300 font-black font-mono text-base md:text-xl">
                {formatCurrency(payable)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all"
              title="تایید و ثبت نهایی فاکتور (Alt+S)"
            >
              <Save size={18} />
              <span>ثبت نهایی فاکتور</span>
            </button>
          </div>
        </div>
      )}

      {/* MODALS - QUICK REGISTRATION - FIXED WITH PORTAL AND BOTTOM SHEET */}
      {showPersonModal && createPortal(
          <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in no-print" style={{ direction: 'rtl' }}>
              <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-md rounded-t-[2.5rem] md:rounded-[3rem] p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[90vh] overflow-y-auto">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3"><UserPlus className="text-indigo-400" size={24}/> تعریف سریع شخص</h3>
                    <button onClick={() => setShowPersonModal(false)} className="text-slate-500 hover:text-white hidden md:block"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 pr-2 font-black">شماره مشتری (خودکار)</label>
                        <input 
                          className="w-full bg-slate-950/50 p-4 rounded-2xl border border-white/5 text-slate-400 font-mono outline-none cursor-not-allowed" 
                          value={newPers.code || ''} 
                          disabled 
                          readOnly
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 pr-2 font-black">نام کامل</label>
                        <input 
                          className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-black outline-none focus:border-indigo-500 transition-all" 
                          placeholder="نام کامل..." 
                          value={newPers.name} 
                          onChange={e => setNewPers({...newPers, name: e.target.value})} 
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 pr-2 font-black">شماره تماس (اختیاری)</label>
                        <input 
                          className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono outline-none focus:border-indigo-500 transition-all" 
                          placeholder="۰۹۱۲۰۰۰۰۰۰۰" 
                          value={newPers.phone} 
                          onChange={e => setNewPers({...newPers, phone: e.target.value})} 
                        />
                      </div>
                      <button onClick={handleQuickAddPerson} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black shadow-xl mt-4 active:scale-95 transition-all">ذخیره و انتخاب</button>
                      <button onClick={() => setShowPersonModal(false)} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold mt-2 md:hidden">انصراف</button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* مودال تعریف سریع کالا (با دکمه + یا از طریق اسکنر دستی) با کنتراست بالا */}
      {(showProductModal || showQuickScanAddModal) && createPortal(
          <div className="fixed inset-0 z-9999 bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in no-print p-4" style={{ direction: 'rtl' }}>
            <div className="bg-slate-950 border-2 border-slate-700 w-full max-w-xl rounded-t-[2.5rem] md:rounded-[3rem] p-6 md:p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-4 md:hidden"></div>
              
              <div className="flex justify-between items-center mb-5 border-b-2 border-slate-700 pb-4">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                    <PackagePlus className="text-teal-400" size={24}/>
                    <span>{showQuickScanAddModal ? 'تعریف و ثبت سریع کالا از طریق اسکنر دستی' : 'تعریف سریع کالای جدید در فاکتور'}</span>
                  </h3>
                  {scannedPendingCode && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs bg-amber-500/20 text-amber-300 font-mono font-bold px-3 py-1 rounded-lg border border-amber-400/40 flex items-center gap-1.5">
                        <Barcode size={14} />
                        کد اسکن شده: {scannedPendingCode}
                      </span>
                      <span className="text-[11px] text-slate-300 font-bold">
                        (این کالا در سیستم یافت نشد؛ با تکمیل فرم فوراً به فاکتور افزوده می‌شود)
                      </span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => { setShowProductModal(false); setShowQuickScanAddModal(false); }} 
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X size={22}/>
                </button>
              </div>

              <div className="space-y-4">
                {/* کد کالا، نام و واحد */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">کد کالا</label>
                    <input 
                      className="w-full bg-slate-900 p-3 rounded-xl border-2 border-slate-700 text-slate-300 font-mono font-bold text-xs outline-none" 
                      value={newProd.code || ''} 
                      disabled 
                      readOnly
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-black text-white block pr-1">نام کالا یا خدمات *</label>
                    <input 
                      className="w-full bg-slate-900 p-3 rounded-xl border-2 border-slate-600 text-white font-black text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30" 
                      placeholder="عنوان دقیق کالا..." 
                      value={newProd.name || ''} 
                      onChange={e => setNewProd({...newProd, name: e.target.value})} 
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">واحد سنجش</label>
                    <select 
                      value={newProd.unit || 'عدد'}
                      onChange={e => setNewProd({...newProd, unit: e.target.value})}
                      className="w-full bg-slate-900 p-3 rounded-xl border-2 border-slate-600 text-white text-xs font-bold outline-none focus:border-teal-400"
                    >
                      <option value="عدد">عدد</option>
                      <option value="کیلوگرم">کیلوگرم</option>
                      <option value="بسته">بسته</option>
                      <option value="کارتن">کارتن</option>
                      <option value="متر">متر</option>
                      <option value="دستگاه">دستگاه</option>
                    </select>
                  </div>
                </div>

                {/* بخش شماره سریال: اتوماتیک، دستی و دریافت از طریق اسکنر دستی */}
                <div className="bg-slate-900 p-4 rounded-2xl border-2 border-indigo-400/50 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
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
                        className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 border border-indigo-300 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="تولید خودکار شماره سریال یکتا بر اساس فرمول استاندارد"
                      >
                        <Shuffle size={13} />
                        <span>تولید اتوماتیک</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 border border-teal-300 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="اسکن سریال با اسکنر تفنگی یا دوربین"
                      >
                        <Scan size={13} />
                        <span>اسکن با بارکدخوان</span>
                      </button>
                    </div>
                  </div>

                  <input 
                    type="text" 
                    placeholder="شماره سریال دستی، اسکن بارکدخوان تفنگی یا دوربین..." 
                    value={newProd.serialNumber || ''} 
                    onChange={e => setNewProd({ ...newProd, serialNumber: e.target.value })}
                    className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-3 text-white font-mono text-sm tracking-wider font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                  />
                  <p className="text-xs text-indigo-200 font-bold">
                    💡 می‌توانید بارکدخوان دستی را مستقیماً شلیک کنید تا شماره سریال کالا تکمیل شود.
                  </p>
                </div>

                {/* بخش دسته‌بندی کالا در چندین زیرمجموعه (دسته اصلی، زیرمجموعه ۱، زیرمجموعه ۲) */}
                <div className="bg-slate-900 p-4 rounded-2xl border-2 border-slate-700 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-teal-300">
                    <Layers size={18} />
                    <span>دسته‌بندی چند سطحی کالا</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* دسته اصلی */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">دسته اصلی</label>
                      <input 
                        list="invoice-main-categories"
                        placeholder="مثال: دیجیتال" 
                        value={newProd.category || ''} 
                        onChange={e => {
                          const cat = e.target.value;
                          const path = `${cat}${newProd.subCategory ? ` / ${newProd.subCategory}` : ''}${newProd.subSubCategory ? ` / ${newProd.subSubCategory}` : ''}`;
                          setNewProd({ ...newProd, category: cat, categoryPath: path });
                        }}
                        className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-2.5 text-white text-xs font-bold outline-none focus:border-teal-400"
                      />
                      <datalist id="invoice-main-categories">
                        {categoriesList.map((c, i) => <option key={i} value={c} />)}
                      </datalist>
                    </div>

                    {/* زیرمجموعه اول */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">زیرمجموعه ۱</label>
                      <input 
                        list="invoice-sub-categories"
                        placeholder="مثال: لوازم جانبی" 
                        value={newProd.subCategory || ''} 
                        onChange={e => {
                          const sub = e.target.value;
                          const path = `${newProd.category || ''}${sub ? ` / ${sub}` : ''}${newProd.subSubCategory ? ` / ${newProd.subSubCategory}` : ''}`;
                          setNewProd({ ...newProd, subCategory: sub, categoryPath: path });
                        }}
                        className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-2.5 text-white text-xs font-bold outline-none focus:border-teal-400"
                      />
                      <datalist id="invoice-sub-categories">
                        {subCategoriesList.map((s, i) => <option key={i} value={s} />)}
                      </datalist>
                    </div>

                    {/* زیرمجموعه دوم */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-white block pr-1">زیرمجموعه ۲</label>
                      <input 
                        placeholder="مثال: کابل و مبدل" 
                        value={newProd.subSubCategory || ''} 
                        onChange={e => {
                          const sub2 = e.target.value;
                          const path = `${newProd.category || ''}${newProd.subCategory ? ` / ${newProd.subCategory}` : ''}${sub2 ? ` / ${sub2}` : ''}`;
                          setNewProd({ ...newProd, subSubCategory: sub2, categoryPath: path });
                        }}
                        className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-2.5 text-white text-xs font-bold outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                </div>

                {/* قیمت خرید و فروش */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">قیمت خرید (تومان)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 p-3.5 rounded-xl border-2 border-slate-600 text-white font-mono font-bold text-xs outline-none focus:border-teal-400" 
                      value={newProd.buyPrice || ''} 
                      onChange={e => setNewProd({...newProd, buyPrice: Number(e.target.value)})} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-white block pr-1">قیمت فروش (تومان)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 p-3.5 rounded-xl border-2 border-slate-600 text-white font-mono font-bold text-xs outline-none focus:border-teal-400" 
                      value={newProd.sellPrice || ''} 
                      onChange={e => setNewProd({...newProd, sellPrice: Number(e.target.value)})} 
                      placeholder="0" 
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={handleQuickAddProduct} 
                    className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all cursor-pointer border border-teal-300"
                  >
                    ذخیره و ثبت کالا در فاکتور
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowProductModal(false); setShowQuickScanAddModal(false); }} 
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 rounded-2xl font-bold text-xs cursor-pointer border border-slate-600"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
      )}

      {/* اسکنر بارکد و شماره سریال با دوربین */}
      {showBarcodeScanner && (
        <BarcodeScanner 
          onScan={(code) => {
            setShowBarcodeScanner(false);
            if (showProductModal || showQuickScanAddModal) {
              setNewProd(prev => ({ ...prev, serialNumber: code }));
            } else {
              handleProcessScannedCodeForInvoice(code);
            }
          }} 
          onClose={() => setShowBarcodeScanner(false)} 
        />
      )}

      {showCheckModal && createPortal(
          <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in no-print" style={{ direction: 'rtl' }}>
              <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-md rounded-t-[2.5rem] md:rounded-[3rem] p-8 shadow-2xl animate-slide-up md:animate-pop-up max-h-[90vh] overflow-y-auto">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3"><CreditCard className="text-amber-400" size={24}/> ثبت چک دریافتی</h3>
                    <button onClick={() => setShowCheckModal(false)} className="text-slate-500 hover:text-white hidden md:block"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold pr-2">مبلغ چک (ریال)</label>
                          <NumberInput value={tempCheck.amount || 0} onChange={v => setTempCheck({...tempCheck, amount: v})} autoFocus />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold pr-2">نام بانک</label>
                          <select className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-bold outline-none" value={tempCheck.bankName} onChange={e => setTempCheck({...tempCheck, bankName: e.target.value})}>
                              <option value="">انتخاب بانک...</option>
                              {IRANIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold pr-2">شناسه صیادی (۱۶ رقم)</label>
                          <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono outline-none focus:border-amber-500 tracking-widest text-center" placeholder="----------------" value={tempCheck.sayadId} onChange={e => setTempCheck({...tempCheck, sayadId: e.target.value})} maxLength={16} />
                      </div>
                      <div className="space-y-1">
                          <JalaliDatePicker label="تاریخ سررسید" value={tempCheck.dueDate} onChange={v => setTempCheck({...tempCheck, dueDate: v})} />
                      </div>
                      <button onClick={handleAddCheck} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-black shadow-xl mt-4 active:scale-95 transition-all">ثبت چک در فاکتور</button>
                      <button onClick={() => setShowCheckModal(false)} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold mt-2 md:hidden">انصراف</button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* مودال راهنمای هوشمند صدور فاکتور و ارسال پیامک */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h4 className="text-white font-black text-base flex items-center gap-2">
                <HelpCircle className="text-teal-400" size={20} />
                راهنمای هوشمند صدور فاکتور و پیامک
              </h4>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="text-slate-300 text-xs space-y-3 leading-relaxed">
              <p>
                <strong>۱. شماره و پیشوند فاکتور:</strong> شماره فاکتور کاملاً قابل ویرایش بوده و می‌توانید پیشوند دلخواه (مانند INV- یا ف-) را به آن اضافه کنید.
              </p>
              <p>
                <strong>۲. ارسال خودکار پیامک:</strong> با فعال بودن گزینه «ارسال خودکار پیامک صورتحساب»، پس از ثبت فاکتور بلافاصله پیامکی حاوی شناسه فاکتور، مبلغ کل و لینک امضا و پرداخت آنلاین برای مشتری ارسال می‌شود.
              </p>
              <p>
                <strong>۳. وب‌هوک پیامک محلی (کاوانگار / ملی‌پیامک):</strong> پیامک‌ها از طریق پنل سرور و وب‌هوک بومی ایران با سرعت بالا و عبور از بلک‌لیست مخابراتی تحویل می‌شوند.
              </p>
              <p>
                <strong>۴. تم‌های روشن و خوانا:</strong> در بخش پیش‌نمایش، تم‌های شرکتی، رسمی و کریتیو با زمینه روشن و کنتراست عالی جهت چاپ و اشتراک‌گذاری در دسترس است.
              </p>
            </div>
            <button onClick={() => setShowHelpModal(false)} className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs">
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* مدال افزودن سریع شعبه جدید */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-teal-400 font-black">
                <Store size={20} />
                <span>افزودن شعبه جدید به {currentSelectedCompany?.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">نام شعبه (الزامی)</label>
                <input
                  type="text"
                  placeholder="مثال: شعبه بازار، شعبه غرب، نمایندگی ۲"
                  value={newBranch.name || ''}
                  onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">کد شعبه</label>
                  <input
                    type="text"
                    placeholder="مثال: 101"
                    value={newBranch.code || ''}
                    onChange={e => setNewBranch({ ...newBranch, code: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">نام مسئول شعبه</label>
                  <input
                    type="text"
                    placeholder="نام مدیر / مسئول"
                    value={newBranch.managerName || ''}
                    onChange={e => setNewBranch({ ...newBranch, managerName: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">تلفن شعبه</label>
                <input
                  type="text"
                  placeholder="تلفن ثابت یا همراه شعبه"
                  value={newBranch.phone || ''}
                  onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">آدرس شعبه</label>
                <textarea
                  rows={2}
                  placeholder="نشانی دقیق شعبه جهت درج در سربرگ فاکتور"
                  value={newBranch.address || ''}
                  onChange={e => setNewBranch({ ...newBranch, address: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCreateQuickBranch}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm"
              >
                ثبت و اعمال روی فاکتور
              </button>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-4 py-3 rounded-xl transition-all text-sm"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {showPosModal && (
        <PcPosPaymentModal
          isOpen={showPosModal}
          amount={payable > cashAmount ? payable - cashAmount : payable}
          invoiceNumber={String(invoiceNumber)}
          payerName={people.find(p => p.id === selectedPerson)?.name}
          onSuccess={(posRes) => {
            setCashAmount(prev => prev + posRes.amount);
            setDescription(prev => (prev ? prev + '\n' : '') + `تسویه با کارتخوان پوز (${posRes.terminalId}) - کد پیگیری: ${posRes.rrn}`);
            setShowPosModal(false);
          }}
          onClose={() => setShowPosModal(false)}
        />
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteInvoice(deleteTarget)} title="حذف فاکتور" message="آیا از حذف این فاکتور اطمینان دارید؟" />

      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          documentId={selectedInvoiceId || ''}
          documentType="فاکتور"
          documentPreview={shareDocPreview}
        />
      )}

      {receiptInvoice && (
        <InvoiceReceiptModal
          invoice={receiptInvoice}
          onClose={() => setReceiptInvoice(null)}
        />
      )}

      {/* مودال ارسال پیامک مستقیم اندروید یا وب‌سرویس ابری */}
      {smsModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="text-white font-black text-base">ارسال پیامک صورتحساب</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    فاکتور {(smsModalInvoice.prefix || '') + toPersianDigits(smsModalInvoice.number)} | طرف حساب: {smsModalInvoice.personName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSmsModalInvoice(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-300 text-xs font-bold block mb-1.5">شماره موبایل گیرنده</label>
                <input
                  type="text"
                  value={smsTargetPhone}
                  onChange={e => setSmsTargetPhone(e.target.value)}
                  placeholder="09123456789"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-300 text-xs font-bold">متن پیامک (قابل ویرایش)</label>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(smsPreviewText);
                      alert('متن پیامک در کلیپ‌بورد کپی شد.');
                    }}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-bold"
                  >
                    <Copy size={13} /> کپی متن
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={smsPreviewText}
                  onChange={e => setSmsPreviewText(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-slate-200 text-xs font-mono leading-relaxed outline-none focus:border-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {/* ارسال مستقیم اندروید */}
              <button
                type="button"
                onClick={handleSendViaAndroidDirect}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all border border-emerald-400/30"
              >
                <Smartphone size={20} />
                <span>ارسال مستقیم با برنامه پیامک گوشی اندروید (سیم‌کارت - رایگان)</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendViaGateway}
                  disabled={isSendingSms}
                  className="py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-purple-500/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{isSendingSms ? 'در حال ارسال...' : 'ارسال با وب‌سرویس ابری'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSmsModalInvoice(null)}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-all"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SignIndicator = ({ label, active, icon: Icon }: any) => (
    <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${active ? 'bg-teal-500/10 border-teal-500/30' : 'bg-white/5 border-white/5'}`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-600'}`}><Icon size={18}/></div>
            <span className={`text-[10px] font-black ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
        </div>
        <div className={`w-4 h-4 rounded-full border-2 ${active ? 'bg-teal-500 border-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.5)]' : 'bg-slate-900 border-slate-700'}`}></div>
    </div>
);

export default Invoices;
