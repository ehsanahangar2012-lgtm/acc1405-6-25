import CryptoJS from 'crypto-js';

const BACKUP_FORMAT = 'ASHKEGHALAM_ENCRYPTED_BACKUP_V1';
const BACKUP_VERSION = 1;
const KDF_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 16;
const AES_KEY_BYTES = 32;
const HMAC_KEY_BYTES = 32;

type EncryptedBackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  cipher: 'AES-256-CBC';
  authentication: 'HMAC-SHA256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
};

function requirePassphrase(passphrase: string): void {
  if (typeof passphrase !== 'string' || passphrase.trim().length < 12) {
    throw new Error('رمز پشتیبان باید حداقل ۱۲ نویسه داشته باشد.');
  }
}

function deriveKeys(passphrase: string, salt: CryptoJS.lib.WordArray) {
  const material = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: (AES_KEY_BYTES + HMAC_KEY_BYTES) / 4,
    iterations: KDF_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
  return {
    encryptionKey: CryptoJS.lib.WordArray.create(material.words.slice(0, AES_KEY_BYTES / 4), AES_KEY_BYTES),
    authenticationKey: CryptoJS.lib.WordArray.create(
      material.words.slice(AES_KEY_BYTES / 4, (AES_KEY_BYTES + HMAC_KEY_BYTES) / 4),
      HMAC_KEY_BYTES
    )
  };
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right) || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function isEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Partial<EncryptedBackupEnvelope>;
  return envelope.format === BACKUP_FORMAT &&
    envelope.version === BACKUP_VERSION &&
    envelope.cipher === 'AES-256-CBC' &&
    envelope.authentication === 'HMAC-SHA256' &&
    envelope.kdf === 'PBKDF2-SHA256';
}

function validateEnvelope(envelope: EncryptedBackupEnvelope): void {
  if (envelope.iterations !== KDF_ITERATIONS) throw new Error('تنظیمات رمزنگاری فایل پشتیبان پشتیبانی نمی‌شود.');
  if (!/^[a-f0-9]{32}$/i.test(envelope.salt) || !/^[a-f0-9]{32}$/i.test(envelope.iv)) {
    throw new Error('ساختار رمزنگاری فایل پشتیبان معتبر نیست.');
  }
  if (typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 24 ||
      envelope.ciphertext.length > 180 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)) {
    throw new Error('داده رمزنگاری‌شده فایل پشتیبان معتبر نیست.');
  }
  if (!/^[a-f0-9]{64}$/i.test(envelope.mac)) throw new Error('برچسب امنیتی فایل پشتیبان معتبر نیست.');
}

export class BackupEncryptionService {
  static readonly format = BACKUP_FORMAT;

  static isEncryptedEnvelope(value: unknown): boolean {
    return isEnvelope(value);
  }

  /**
   * Portable passphrase-encrypted backup: AES-256-CBC with encrypt-then-MAC
   * (HMAC-SHA256), independent random salt/IV, and PBKDF2-SHA256 key separation.
   * This protects a backup file, not the application's live database or runtime.
   */
  static encryptJson(data: unknown, passphrase: string): string {
    requirePassphrase(passphrase);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('ساختار داده پشتیبان باید یک شیء معتبر باشد.');
    }

    const salt = CryptoJS.lib.WordArray.random(SALT_BYTES);
    const iv = CryptoJS.lib.WordArray.random(IV_BYTES);
    const { encryptionKey, authenticationKey } = deriveKeys(passphrase, salt);
    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).ciphertext.toString(CryptoJS.enc.Base64);

    const saltHex = salt.toString(CryptoJS.enc.Hex);
    const ivHex = iv.toString(CryptoJS.enc.Hex);
    const authenticatedText = [BACKUP_FORMAT, String(BACKUP_VERSION), String(KDF_ITERATIONS), saltHex, ivHex, ciphertext].join('.');
    const mac = CryptoJS.HmacSHA256(authenticatedText, authenticationKey).toString(CryptoJS.enc.Hex);

    const envelope: EncryptedBackupEnvelope = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      cipher: 'AES-256-CBC',
      authentication: 'HMAC-SHA256',
      kdf: 'PBKDF2-SHA256',
      iterations: KDF_ITERATIONS,
      salt: saltHex,
      iv: ivHex,
      ciphertext,
      mac
    };
    return JSON.stringify(envelope, null, 2);
  }

  static decryptJson(text: string, passphrase: string): any {
    requirePassphrase(passphrase);
    if (typeof text !== 'string' || text.length > 140 * 1024 * 1024) {
      throw new Error('حجم یا محتوای فایل پشتیبان معتبر نیست.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('فایل پشتیبان قابل خواندن نیست.');
    }
    if (!isEnvelope(parsed)) throw new Error('این فایل، پشتیبان رمزنگاری‌شده اشک قلم نیست.');
    const envelope = parsed;
    validateEnvelope(envelope);

    const salt = CryptoJS.enc.Hex.parse(envelope.salt);
    const iv = CryptoJS.enc.Hex.parse(envelope.iv);
    const { encryptionKey, authenticationKey } = deriveKeys(passphrase, salt);
    const authenticatedText = [
      BACKUP_FORMAT,
      String(BACKUP_VERSION),
      String(envelope.iterations),
      envelope.salt,
      envelope.iv,
      envelope.ciphertext
    ].join('.');
    const expectedMac = CryptoJS.HmacSHA256(authenticatedText, authenticationKey).toString(CryptoJS.enc.Hex);
    if (!constantTimeHexEqual(expectedMac, envelope.mac.toLowerCase())) {
      throw new Error('رمز اشتباه است یا فایل پشتیبان دستکاری شده/آسیب دیده است.');
    }

    try {
      const plaintext = CryptoJS.AES.decrypt(envelope.ciphertext, encryptionKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }).toString(CryptoJS.enc.Utf8);
      if (!plaintext) throw new Error('empty plaintext');
      const value = JSON.parse(plaintext);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid payload');
      return value;
    } catch {
      throw new Error('رمز اشتباه است یا محتوای فایل پشتیبان معتبر نیست.');
    }
  }
}

export const backupEncryptionService = BackupEncryptionService;
