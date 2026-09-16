
import { securityService } from './services/securityService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
export const toPersianDigits = (n: string | number | undefined): string => {
  if (n === undefined || n === null) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n
    .toString()
    .replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

export const getCurrentCurrency = (): 'RIAL' | 'TOMAN' => {
  try {
    const fastCur = localStorage.getItem('ashke-ghalam-currency');
    if (fastCur === 'RIAL' || fastCur === 'TOMAN') {
      return fastCur;
    }
    const stored = localStorage.getItem('ashke-ghalam-rbac-v15-accounting') || localStorage.getItem('ashke-ghalam-rbac-v14-accounting');
    if (stored) {
      let decrypted = stored;
      if (!stored.trim().startsWith('{')) {
        decrypted = securityService.decrypt(stored);
      }
      const parsed = JSON.parse(decrypted);
      if (parsed?.state?.config?.currency === 'TOMAN' || parsed?.state?.config?.currency === 'RIAL') {
        return parsed.state.config.currency;
      }
    }
  } catch {
    // fallback default
  }
  return 'RIAL';
};

export const getCurrencyLabel = (currency?: 'RIAL' | 'TOMAN'): string => {
  const cur = currency || getCurrentCurrency();
  return cur === 'TOMAN' ? 'تومان' : 'ریال';
};

export const convertRialToDisplay = (amount: number, currency?: 'RIAL' | 'TOMAN'): number => {
  const cur = currency || getCurrentCurrency();
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  return cur === 'TOMAN' ? Math.round(amount / 10) : amount;
};

export const convertDisplayToRial = (amount: number, currency?: 'RIAL' | 'TOMAN'): number => {
  const cur = currency || getCurrentCurrency();
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  return cur === 'TOMAN' ? amount * 10 : amount;
};

export const formatAmountOnly = (amount: number, currency?: 'RIAL' | 'TOMAN'): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '۰';
  const displayVal = convertRialToDisplay(amount, currency);
  return toPersianDigits(displayVal.toLocaleString());
};

export const formatCurrency = (amount: number, currency?: 'RIAL' | 'TOMAN'): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    const label = getCurrencyLabel(currency);
    return `۰ ${label}`;
  }
  const cur = currency || getCurrentCurrency();
  const displayAmount = cur === 'TOMAN' ? Math.round(amount / 10) : amount;
  const label = cur === 'TOMAN' ? 'تومان' : 'ریال';
  return toPersianDigits(displayAmount.toLocaleString()) + ' ' + label;
};

export const formatNumber = (amount: number): string => {
    if (!amount && amount !== 0) return '';
    return amount.toLocaleString();
};

export const parseNumber = (str: string): number => {
    if (!str) return 0;
    return Number(str.toString().replace(/,/g, '').replace(/[^0-9.-]+/g,""));
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
};

import { generateCode128Svg, generateQrCodeSvg } from './services/barcodeService';

export const generateTrackingCode = (prefix: string, number: number, date: string): string => {
    const cleanDate = date.replace(/\//g, '');
    return `${prefix}-${cleanDate}-${number}`;
};

// تولید QR Code کاملاً استاندارد و آفلاین با قابلیت اسکن توسط دوربین انواع تلفن همراه
export const getQrCodeUrl = (data: string): string => {
    return generateLocalQrSvg(data);
};

export const generateLocalQrSvg = (data: string): string => {
    if (!data) return '';
    return generateQrCodeSvg(data, 200);
};

// تولید بارکد میله‌ای استاندارد Code 128 آفلاین
export const generateBarcodeSvg = (data: string): string => {
    if (!data) return '';
    return generateCode128Svg(data.toString());
};

// Optimized Image Compression
export const compressImage = async (file: File, maxWidth = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth * height) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Preserve transparency for PNG/WEBP/GIF by using PNG format, otherwise JPEG
                const mimeType = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif'
                    ? 'image/png'
                    : 'image/jpeg';
                
                resolve(canvas.toDataURL(mimeType, mimeType === 'image/jpeg' ? quality : undefined));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return compressImage(file);
};

export const captureFromCamera = (): Promise<File> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject('No file selected');
      }
    };
    
    input.click();
  });
};

export const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const result = [];
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const obj: any = {};
        const currentline = lines[i].split(',');
        headers.forEach((header, index) => {
            obj[header] = currentline[index]?.trim();
        });
        result.push(obj);
    }
    return result;
};

export const getPersianDate = (): string => {
    return new Date().toLocaleDateString('fa-IR-u-nu-latn');
};

export const getPersianTime = (): string => {
    return new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback...', err);
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
};

export const getJalaliMonths = () => [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const calculateDaysDiff = (date1: string, date2: string): number => {
    const [y1, m1, d1] = date1.split('/').map(Number);
    const [y2, m2, d2] = date2.split('/').map(Number);
    const days1 = y1 * 365 + m1 * 30 + d1;
    const days2 = y2 * 365 + m2 * 30 + d2;
    return days2 - days1;
};

export const generatePaymentQR = (data: any): string => {
    return generateLocalQrSvg(JSON.stringify(data));
};

export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 2500): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const getNextCustomerCode = (people: { code?: string }[]): string => {
  const numericCodes = people
    .map(p => {
      const match = p.code?.match(/^C-(\d+)$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((val): val is number => val !== null);
  
  const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 1000;
  return `C-${maxCode + 1}`;
};

export const getNextProductCode = (products: { code?: string }[]): string => {
  const numericCodes = products
    .map(p => {
      const match = p.code?.match(/^P-(\d+)$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((val): val is number => val !== null);
  
  const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 1000;
  return `P-${maxCode + 1}`;
};



/**
 * Generate a PDF Blob from an HTML element using html2canvas and jsPDF.
 * @param element The DOM element to capture.
 * @returns Promise that resolves with a PDF Blob.
 */
export const generatePdfBlob = async (element: HTMLElement): Promise<Blob> => {
  const originalShadow = element.style.boxShadow;
  const originalBorderRadius = element.style.borderRadius;
  element.style.boxShadow = 'none';
  element.style.borderRadius = '0';
  
  try {
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Font loading wait skipped:', e);
      }
    }

    const html2canvasFn = (html2canvas as any).default || html2canvas;
    const canvas = await html2canvasFn(element, {
      scale: 2.5, // Crisp high-definition scale for Persian typography and tables
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
    
    const JsPDFClass = (jsPDF as any).default || jsPDF;
    const pdf = new JsPDFClass('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    
    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add subsequent pages if canvas height overflows A4 page limit
    while (heightLeft > 1) {
      position -= pageHeight; // Shift position up by one page
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    return pdf.output('blob');
  } finally {
    element.style.boxShadow = originalShadow;
    element.style.borderRadius = originalBorderRadius;
  }
};

/**
 * Trigger a download for a given Blob as a file.
 * @param blob The file data.
 * @param filename Desired filename.
 */
export const downloadPdfBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Send the generated PDF to the backend for email dispatch.
 * Expects an endpoint `/api/invoices/send-pdf` handling multipart/form-data.
 */
export const sendInvoicePdf = async (pdfBlob: Blob, invoiceId: string): Promise<void> => {
  const form = new FormData();
  form.append('file', pdfBlob, `${invoiceId}.pdf`);
  form.append('invoiceId', invoiceId);
  await fetch('/api/invoices/send-pdf', {
    method: 'POST',
    body: form,
  });
};

/**
 * Safe fetch JSON helper that avoids Unexpected token '<' errors when server returns HTML/error pages.
 */
export const safeFetchJson = async (input: RequestInfo | URL, init?: RequestInit, fallback: any = null): Promise<any> => {
  try {
    const response = await fetch(input, init);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return fallback;
    }
    return await response.json();
  } catch (error) {
    return fallback;
  }
};

/**
 * Detect if running inside Windows desktop application (Electron, Tauri, or desktop runtime)
 */
export const isDesktopApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isElectron = Boolean(
    (window as any).electron ||
    (window as any).process?.versions?.electron ||
    (window as any).__TAURI__ ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
  const isLocalStorageFlag = localStorage.getItem('ashk_is_desktop') === 'true';
  return isElectron || isLocalStorageFlag;
};


