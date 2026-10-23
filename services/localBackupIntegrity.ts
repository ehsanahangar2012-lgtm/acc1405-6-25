import CryptoJS from 'crypto-js';

export interface LocalBackupIntegrityRecord {
  id: string;
  timestamp: number;
  data: string;
  size: number;
  label: string;
  checksumAlgorithm?: string;
  checksum?: string;
}

export interface LocalBackupIntegrityResult {
  data: Record<string, any>;
  integrityVerified: boolean;
}

/** SHA-256 over the exact serialized payload; detects corruption, not a hostile writer. */
export function checksumLocalBackupData(serializedData: string): string {
  if (typeof serializedData !== 'string') throw new Error('محتوای بکاپ محلی معتبر نیست.');
  return CryptoJS.SHA256(serializedData).toString(CryptoJS.enc.Hex);
}

/**
 * Validate structure before restore, and verify any checksum present.
 * Historic records without a checksum remain importable only after an explicit warning.
 */
export function verifyLocalBackupRecord(record: LocalBackupIntegrityRecord): LocalBackupIntegrityResult {
  if (!record || typeof record !== 'object' ||
      typeof record.id !== 'string' || !/^[0-9]{1,32}$/.test(record.id) ||
      !Number.isFinite(record.timestamp) ||
      typeof record.data !== 'string' || record.data.length === 0 ||
      record.data.length > 140 * 1024 * 1024) {
    throw new Error('ساختار رکورد بکاپ محلی معتبر نیست.');
  }

  let parsed: unknown;
  try { parsed = JSON.parse(record.data); }
  catch { throw new Error('محتوای بکاپ محلی خراب است؛ بازیابی متوقف شد.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ساختار داده بازیابی‌شده معتبر نیست.');
  }

  const payload = parsed as Record<string, any>;
  const arrayKeys = [
    'companies', 'products', 'people', 'invoices', 'vouchers',
    'checks', 'transactions', 'salaries', 'contracts', 'users',
    'roles', 'checkTransfers', 'importConfigs', 'importBatches'
  ];
  const presentArrayKeys = arrayKeys.filter(key => Object.prototype.hasOwnProperty.call(payload, key));
  if (presentArrayKeys.length === 0 || presentArrayKeys.some(key => !Array.isArray(payload[key]))) {
    throw new Error('دادهٔ بکاپ با ساختار مورد انتظار حسابداری سازگار نیست.');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'financialData') &&
      (!payload.financialData || typeof payload.financialData !== 'object' || Array.isArray(payload.financialData))) {
    throw new Error('ساختار اطلاعات مالی در بکاپ معتبر نیست.');
  }

  const hasChecksum = record.checksum !== undefined || record.checksumAlgorithm !== undefined;
  if (!hasChecksum) return { data: payload, integrityVerified: false };
  if (record.checksumAlgorithm !== 'sha256' ||
      typeof record.checksum !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(record.checksum)) {
    throw new Error('قالب کنترل یکپارچگی بکاپ پشتیبانی نمی‌شود؛ بازیابی متوقف شد.');
  }
  const actual = checksumLocalBackupData(record.data);
  if (actual !== record.checksum.toLowerCase()) {
    throw new Error('کنترل یکپارچگی بکاپ محلی ناموفق است؛ بازیابی متوقف شد.');
  }
  return { data: payload, integrityVerified: true };
}
