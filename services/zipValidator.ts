/**
 * ZipValidator Service - AshkeGhalam Accounting System
 * دپارتمان IT اشک قلم - نسخه ۱۶.۵۲.۰
 * 
 * سرویس جامع و کلاینت-ساید اعتبارسنجی ساختار و اصالت فایل‌های ZIP سورس‌کد مالی و حسابداری
 * - بررسی امضای باینری (Magic Bytes) و سلامت آرشیو فشرده
 * - محافظت در برابر حملات Zip Slip (تجاوز از مسیر) و Zip Bomb
 * - تطبیق فرمت‌های معتبر سورس کد (.ts, .tsx, .js, .jsx, .json, .css, .sql, .php)
 * - شناسایی و اعتبارسنجی الگوها و کدهای دامنه حسابداری و مدیریت مالی
 * - ۱۰۰٪ مستقل و کلاینت‌ساید بدون نیاز به اینترنت و سرور خارجی
 */

import JSZip from 'jszip';

export interface CodeFileMeta {
  name: string;
  size: number;
  extension: string;
  isAccountingRelated: boolean;
}

export interface ZipValidationResult {
  isValid: boolean;
  error?: string;
  warnings: string[];
  details: {
    fileName: string;
    fileSize: number;
    formattedFileSize: string;
    totalEntries: number;
    sourceCodeFilesCount: number;
    accountingFilesCount: number;
    hasPackageJson: boolean;
    hasAccountingSignatures: boolean;
    uncompressedSize: number;
    formattedUncompressedSize: string;
    compressionRatio: number;
    codeFiles: CodeFileMeta[];
    detectedAccountingModules: string[];
  };
  extractedFiles?: {
    name: string;
    content: string;
    localContent: string;
  }[];
}

// پسوندهای مجاز و شناخته شده کدهای منبع سیستم حسابداری
const VALID_SOURCE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'sql', 'php', 'html'
]);

// کلمات کلیدی مشخص‌کننده ماژول‌های حسابداری و مالی
const ACCOUNTING_PATH_KEYWORDS = [
  'account', 'accounting', 'invoice', 'finance', 'financial',
  'check', 'cheque', 'voucher', 'ledger', 'tax', 'moadian',
  'inventory', 'cashflow', 'customer', 'store', 'types',
  'fiscal', 'bank', 'balance', 'sanad', 'factor', 'anbar',
  'bedehkar', 'bestankar', 'salary', 'payroll', 'cardex'
];

// امضاهای متنی درون کدهای حسابداری
const ACCOUNTING_CODE_SIGNATURES = [
  'debit', 'credit', 'voucher', 'invoice', 'balance', 'ledger',
  'toman', 'rial', 'taxrate', 'discount', 'subtotal', 'financial',
  'بدهکار', 'بستانکار', 'فاکتور', 'حواله', 'سند', 'کاردکس', 'موجودی'
];

export class ZipValidator {
  /**
   * تبدیل بایت به رشته خوانا
   */
  public static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * اعتبارسنجی جادویی (Magic Bytes) هدر فایل ZIP
   */
  public static async verifyZipHeader(file: Blob): Promise<{ isValidZipHeader: boolean; headerHex: string }> {
    try {
      const slice = file.slice(0, 4);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // امضاهای معتبر ZIP:
      // 0x50 0x4B 0x03 0x04 (PK\x03\x04 - Local File Header)
      // 0x50 0x4B 0x05 0x06 (PK\x05\x06 - Empty ZIP Central Directory)
      // 0x50 0x4B 0x07 0x08 (PK\x07\x08 - Spanned ZIP)
      const isPk = bytes[0] === 0x50 && bytes[1] === 0x4B;
      const isZip = isPk && (
        (bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08)
      );

      const headerHex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

      return { isValidZipHeader: isZip, headerHex };
    } catch {
      return { isValidZipHeader: false, headerHex: 'ERROR' };
    }
  }

  /**
   * اعتبارسنجی جامع و استخراج همزمان سورس‌کدهای حسابداری
   */
  public static async validateAndExtract(
    file: File | Blob, 
    fileName = 'archive.zip'
  ): Promise<ZipValidationResult> {
    const warnings: string[] = [];
    const detectedModules = new Set<string>();

    // ۱. بررسی هدر باینری فایل ZIP
    const { isValidZipHeader, headerHex } = await this.verifyZipHeader(file);
    if (!isValidZipHeader) {
      return {
        isValid: false,
        error: `فایل ارائه‌شده یک آرشیو ZIP معتبر استاندارد نیست (هدر: ${headerHex}). لطفاً یک فایل با پسوند .zip انتخاب فرمایید.`,
        warnings: [],
        details: {
          fileName,
          fileSize: file.size,
          formattedFileSize: this.formatBytes(file.size),
          totalEntries: 0,
          sourceCodeFilesCount: 0,
          accountingFilesCount: 0,
          hasPackageJson: false,
          hasAccountingSignatures: false,
          uncompressedSize: 0,
          formattedUncompressedSize: '۰ بایت',
          compressionRatio: 0,
          codeFiles: [],
          detectedAccountingModules: []
        }
      };
    }

    // ۲. تلاش برای بارگذاری با JSZip و کشف محتویات
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (zipError: any) {
      return {
        isValid: false,
        error: `خطا در باز کردن ساختار فشرده ZIP: فایل ممکن است ناقص، رمزگذاری‌شده یا خراب باشد (${zipError?.message || 'خرابی بایت‌ها'}).`,
        warnings: [],
        details: {
          fileName,
          fileSize: file.size,
          formattedFileSize: this.formatBytes(file.size),
          totalEntries: 0,
          sourceCodeFilesCount: 0,
          accountingFilesCount: 0,
          hasPackageJson: false,
          hasAccountingSignatures: false,
          uncompressedSize: 0,
          formattedUncompressedSize: '۰ بایت',
          compressionRatio: 0,
          codeFiles: [],
          detectedAccountingModules: []
        }
      };
    }

    // ۳. آنالیز و غربال‌گری ورودی‌های ZIP
    let totalEntries = 0;
    let uncompressedSize = 0;
    let hasPackageJson = false;
    let hasAccountingSignatures = false;
    const codeFilesMeta: CodeFileMeta[] = [];
    const extractedFiles: { name: string; content: string; localContent: string }[] = [];
    const asyncTasks: Promise<void>[] = [];

    // محدودیت‌های امنیتی پیشگیری از Zip Bomb و Zip Slip
    const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024; // ۲۵۰ مگابایت
    const MAX_COMPRESSION_RATIO = 120; // حداکثر ضریب تراکم

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      totalEntries++;

      // بررسی امنیتی Zip Slip (تجاوز از مسیر پوشه با ../ یا /)
      if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        return {
          isValid: false,
          error: `هشدار امنیتی: فایل درون ZIP دارای مسیر غیرمجاز (Zip Slip Traversal: ${relativePath}) است و پردازش آن متوقف شد.`,
          warnings,
          details: {
            fileName,
            fileSize: file.size,
            formattedFileSize: this.formatBytes(file.size),
            totalEntries,
            sourceCodeFilesCount: 0,
            accountingFilesCount: 0,
            hasPackageJson: false,
            hasAccountingSignatures: false,
            uncompressedSize,
            formattedUncompressedSize: this.formatBytes(uncompressedSize),
            compressionRatio: 0,
            codeFiles: [],
            detectedAccountingModules: []
          }
        };
      }

      // رد کردن دایرکتوری‌ها، فایل‌های پنهان مک، git و پوشه سنگین node_modules
      if (zipEntry.dir || 
          relativePath.startsWith('__MACOSX') || 
          relativePath.includes('/.git/') || 
          relativePath.includes('node_modules/') ||
          relativePath.endsWith('.DS_Store')) {
        continue;
      }

      // استخراج پسوند فایل
      const cleanPath = relativePath.replace(/\\/g, '/');
      const parts = cleanPath.split('.');
      const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

      if (VALID_SOURCE_EXTENSIONS.has(ext)) {
        if (cleanPath.endsWith('package.json')) {
          hasPackageJson = true;
          detectedModules.add('مدیریت وابستگی‌ها (package.json)');
        }

        // بررسی تعلق به ماژول‌های حسابداری بر اساس نام و مسیر فایل
        const lowerPath = cleanPath.toLowerCase();
        let isAccountingRelated = false;
        for (const kw of ACCOUNTING_PATH_KEYWORDS) {
          if (lowerPath.includes(kw)) {
            isAccountingRelated = true;
            detectedModules.add(kw);
          }
        }

        codeFilesMeta.push({
          name: cleanPath,
          size: 0,
          extension: ext,
          isAccountingRelated
        });

        // خواندن محتوای فایل سورس کد
        const task = zipEntry.async('string').then(content => {
          uncompressedSize += content.length;
          
          // بازبینی محتوای کدهای سورس برای امضاهای محاسبات مالی
          if (!hasAccountingSignatures) {
            const lowerContent = content.substring(0, 10000).toLowerCase();
            for (const sig of ACCOUNTING_CODE_SIGNATURES) {
              if (lowerContent.includes(sig)) {
                hasAccountingSignatures = true;
                break;
              }
            }
          }

          extractedFiles.push({
            name: cleanPath,
            content,
            localContent: content
          });
        });

        asyncTasks.push(task);
      }
    }

    // منتظر پایان خواندن تمامی فایل‌های معتبر
    await Promise.all(asyncTasks);

    // ۴. بررسی امنیتی اندازه پس از استخراج (Zip Bomb Protection)
    const compressionRatio = file.size > 0 ? Math.round(uncompressedSize / file.size) : 1;
    if (uncompressedSize > MAX_UNCOMPRESSED_BYTES || compressionRatio > MAX_COMPRESSION_RATIO) {
      return {
        isValid: false,
        error: `هشدار امنیتی: حجم استخراج‌شده (${this.formatBytes(uncompressedSize)}) یا نرخ تراکم (${compressionRatio}x) بیش از حد استاندارد است. این فایل ممکن است از نوع Zip Bomb باشد.`,
        warnings,
        details: {
          fileName,
          fileSize: file.size,
          formattedFileSize: this.formatBytes(file.size),
          totalEntries,
          sourceCodeFilesCount: extractedFiles.length,
          accountingFilesCount: 0,
          hasPackageJson,
          hasAccountingSignatures,
          uncompressedSize,
          formattedUncompressedSize: this.formatBytes(uncompressedSize),
          compressionRatio,
          codeFiles: codeFilesMeta,
          detectedAccountingModules: Array.from(detectedModules)
        }
      };
    }

    // ۵. اعتبارسنجی فرمت کدهای سورس
    if (extractedFiles.length === 0) {
      return {
        isValid: false,
        error: 'آرشیو ZIP ارائه‌شده فاقد هرگونه فایل سورس‌کد معتبر حسابداری (شامل .ts, .tsx, .js, .json, .css, .sql) است.',
        warnings,
        details: {
          fileName,
          fileSize: file.size,
          formattedFileSize: this.formatBytes(file.size),
          totalEntries,
          sourceCodeFilesCount: 0,
          accountingFilesCount: 0,
          hasPackageJson,
          hasAccountingSignatures,
          uncompressedSize,
          formattedUncompressedSize: this.formatBytes(uncompressedSize),
          compressionRatio,
          codeFiles: [],
          detectedAccountingModules: []
        }
      };
    }

    // ۶. مرتب‌سازی الفبایی فایل‌ها جهت نمایش ساختار درختی مرتب
    extractedFiles.sort((a, b) => a.name.localeCompare(b.name));

    // ۷. تولید هشدارهای راهنما (Warnings) برای کیفیت سورس‌کد مالی
    const accountingFilesCount = codeFilesMeta.filter(c => c.isAccountingRelated).length;
    if (accountingFilesCount === 0 && !hasAccountingSignatures) {
      warnings.push('امضای صریح ماژول‌های حسابداری در عناوین فایل‌ها شناسایی نشد؛ ممکن است پروژه شامل کدهای عمومی فرانت‌اند باشد.');
    }
    if (!hasPackageJson) {
      warnings.push('فایل package.json در ریشه آرشیو مشاهده نشد.');
    }

    return {
      isValid: true,
      warnings,
      details: {
        fileName,
        fileSize: file.size,
        formattedFileSize: this.formatBytes(file.size),
        totalEntries,
        sourceCodeFilesCount: extractedFiles.length,
        accountingFilesCount,
        hasPackageJson,
        hasAccountingSignatures,
        uncompressedSize,
        formattedUncompressedSize: this.formatBytes(uncompressedSize),
        compressionRatio,
        codeFiles: codeFilesMeta,
        detectedAccountingModules: Array.from(detectedModules)
      },
      extractedFiles
    };
  }
}

export const zipValidator = ZipValidator;
export default ZipValidator;
