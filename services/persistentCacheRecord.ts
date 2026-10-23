import CryptoJS from 'crypto-js';

export interface PersistentCacheRecord {
  version: 1;
  key: string;
  data: string;
  updatedAt: number;
  checksumAlgorithm: 'sha256';
  checksum: string;
}

export interface ParsedPersistentCacheRecord {
  record: PersistentCacheRecord;
  value: any;
  integrityVerified: boolean;
}

function checksum(data: string): string {
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

/** Map arbitrary logical keys to short, allow-listed native secure-storage keys. */
export function persistentCacheNativeKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 2048) {
    throw new Error('کلید کش محلی معتبر نیست.');
  }
  return 'persistent-storage:v1:' + CryptoJS.SHA256(key).toString(CryptoJS.enc.Hex).slice(0, 48);
}

export function createPersistentCacheRecord(
  key: string,
  serializedData: string,
  updatedAt = Date.now()
): PersistentCacheRecord {
  if (typeof key !== 'string' || key.length === 0 || typeof serializedData !== 'string') {
    throw new Error('محتوای کش محلی معتبر نیست.');
  }
  if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error('زمان کش محلی معتبر نیست.');
  return {
    version: 1,
    key,
    data: serializedData,
    updatedAt,
    checksumAlgorithm: 'sha256',
    checksum: checksum(serializedData)
  };
}

/**
 * Parse the local cache record. Historic IndexedDB entries may lack a checksum;
 * they are marked unverified and must be re-sealed before becoming native cache entries.
 */
export function parsePersistentCacheRecord(input: unknown, expectedKey: string): ParsedPersistentCacheRecord {
  let candidate: unknown = input;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); }
    catch { throw new Error('رکورد کش محلی قابل خواندن نیست.'); }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('ساختار رکورد کش محلی معتبر نیست.');
  }
  const raw = candidate as Record<string, any>;
  if (raw.key !== undefined && raw.key !== expectedKey) throw new Error('کلید رکورد کش محلی با داده سازگار نیست.');
  if (raw.version !== undefined && raw.version !== 1) throw new Error('نسخه رکورد کش محلی پشتیبانی نمی‌شود.');
  if (typeof raw.data !== 'string' || raw.data.length === 0) throw new Error('داده رکورد کش محلی معتبر نیست.');

  const hasChecksum = raw.checksum !== undefined || raw.checksumAlgorithm !== undefined;
  let verified = false;
  if (hasChecksum) {
    if (raw.checksumAlgorithm !== 'sha256' || typeof raw.checksum !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(raw.checksum)) {
      throw new Error('ساختار کنترل صحت کش محلی پشتیبانی نمی‌شود.');
    }
    if (checksum(raw.data) !== raw.checksum.toLowerCase()) {
      throw new Error('کنترل صحت کش محلی ناموفق است؛ داده خراب یا دستکاری شده است.');
    }
    verified = true;
  }

  let value: any;
  try { value = JSON.parse(raw.data); }
  catch { throw new Error('دادهٔ سریال‌شدهٔ کش محلی خراب است.'); }
  const updatedAt = Number.isFinite(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : 0;
  const record = hasChecksum
    ? raw as unknown as PersistentCacheRecord
    : createPersistentCacheRecord(expectedKey, raw.data, updatedAt || Date.now());

  return { record, value, integrityVerified: verified };
}
