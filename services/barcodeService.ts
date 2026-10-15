import QRCode from 'qrcode';

export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'QR';

// تبدیل ارقام فارسی و عربی به انگلیسی
export const toAsciiDigits = (str: string): string => {
  if (!str) return '';
  return str
    .toString()
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
};

// جدول الگوهای استاندارد Code 128B
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

/**
 * تبدیل امن SVG به Data URL
 */
const toSvgDataUrl = (svgString: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svgString)))}`;
    }
  } catch {}
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
};

/**
 * تولید بارکد استاندارد Code 128 به فرمت SVG کاملاً آفلاین
 */
export const generateCode128Svg = (rawText: string, height = 60, barWidth = 2): string => {
  if (!rawText) return '';
  // تبدیل ارقام فارسی و عربی به انگلیسی
  const text = toAsciiDigits(rawText.toString()).trim();
  if (!text) return '';
  
  // تبدیل کاراکترها به مقادیر کد ۱۲۸ زیرمجموعه B
  const codes: number[] = [104]; // Start Code B
  let checksum = 104;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    let val = charCode - 32;
    if (val < 0 || val > 95) val = 0; // کاراکتر غیرمجاز
    codes.push(val);
    checksum += val * (i + 1);
  }
  
  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(106); // Stop Code
  
  // ساخت رشته خطوط بارکد
  let pattern = '0000000000'; // حاشیه خالی
  for (const code of codes) {
    const p = CODE128_PATTERNS[code] || '212222';
    for (let j = 0; j < p.length; j++) {
      const count = parseInt(p[j], 10);
      const isBar = j % 2 === 0;
      pattern += (isBar ? '1' : '0').repeat(count);
    }
  }
  pattern += '0000000000'; // حاشیه انتهایی
  
  const totalWidth = pattern.length * barWidth;
  let rects = '';
  
  for (let x = 0; x < pattern.length; x++) {
    if (pattern[x] === '1') {
      rects += `<rect x="${x * barWidth}" y="0" width="${barWidth}" height="${height}" fill="#000000"/>`;
    }
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 18}" width="${totalWidth}" height="${height + 18}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${rects}
    <text x="${totalWidth / 2}" y="${height + 14}" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle" fill="#1e293b">${text}</text>
  </svg>`;
  
  return toSvgDataUrl(svg);
};

/**
 * تولید بلادرنگ و همگام (Synchronous) QR Code استاندارد به صورت SVG Data URL
 */
export const generateQrCodeSvg = (text: string, size = 200): string => {
  if (!text) return '';
  try {
    let svgString = '';
    QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }, (err, str) => {
      if (!err && str) svgString = str;
    });

    if (svgString) {
      return toSvgDataUrl(svgString);
    }
  } catch (err) {
    console.error('خطا در تولید استاندارد QR Code:', err);
  }
  return '';
};

/**
 * تولید استاندارد QR Code به صورت DataURL با کتابخانه آفلاین qrcode
 */
export const generateQrCodeDataUrl = async (text: string, size = 200): Promise<string> => {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('خطا در تولید QR Code آفلاین:', error);
    // بازگشت SVG همگام استاندارد
    return generateQrCodeSvg(text, size);
  }
};

/**
 * بررسی پشتیبانی مرورگر از اسکنر بارکد سخت‌افزاری آفلاین
 */
export const isNativeBarcodeDetectorSupported = (): boolean => {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
};

/**
 * اسکن بارکد از فریم یا تصویر به صورت آفلاین
 */
export const scanBarcodeFromSource = async (
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap
): Promise<string | null> => {
  if (isNativeBarcodeDetectorSupported()) {
    try {
      // @ts-ignore
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix', 'upc_a', 'upc_e'],
      });
      const barcodes = await barcodeDetector.detect(source);
      if (barcodes && barcodes.length > 0) {
        return barcodes[0].rawValue;
      }
    } catch (err) {
      console.warn('BarcodeDetector error:', err);
    }
  }
  return null;
};

/**
 * تولید خودکار شماره سریال کالا (SN-YYYYMMDD-XXXXX) به صورت یکتا و آفلاین
 */
export const generateAutoSerialNumber = (prefix = 'SN'): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const randNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${y}${m}${d}-${randNum}`;
};

/**
 * شنونده سراسری اسکنر بارکدخوان دستی (USB / بلوتوث / بیسیم)
 * اسکنرهای دستی به صورت شبیه‌ساز کیبورد کار می‌کنند و با سرعت بالا تایپ کرده و در انتها کلید Enter ارسال می‌نمایند.
 */
export const initHardwareBarcodeScanner = (
  onScan: (scannedCode: string) => void,
  options?: { minLength?: number; maxIntervalMs?: number }
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const minLength = options?.minLength || 3;
  const maxIntervalMs = options?.maxIntervalMs || 65; // فاصله فشرده‌شدن کلیدها در اسکنر کمتر از ۶۵ میلی‌ثانیه است

  let buffer = '';
  let lastKeyTime = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    // اگر در فیلد متنی خاصی فوکوس است و کاربر عادی تایپ می‌کند نباید مزاحمت ایجاد کند مگر اینکه با سرعت بالا (اسکنر) وارد شود
    const target = e.target as HTMLElement;
    const isRegularInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

    const currentTime = Date.now();
    const interval = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      // اسکن پایان یافت
      if (buffer.length >= minLength) {
        const finalCode = toAsciiDigits(buffer).trim();
        if (finalCode) {
          // اگر اسکن سریع بوده، از پیش‌فرض جلوگیری کنیم
          if (isRegularInput && interval < 100) {
            e.preventDefault();
          }
          onScan(finalCode);
        }
      }
      buffer = '';
      return;
    }

    // اگر زمان بین دو کلید زیاد بود، بافر ریست می‌شود (تایپ دست انسان)
    if (interval > maxIntervalMs && buffer.length > 0) {
      buffer = '';
    }

    // جمع‌آوری کاراکترهای چاپ‌شدنی
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
};

