import {
  getAndroidEncryptedItem,
  isNativeAndroidSecureStorage,
  removeAndroidEncryptedItem,
  setAndroidEncryptedItem
} from './androidSecureStorage';

type DesktopBridge = {
  isDesktop?: boolean;
  invoke?: (channel: string, payload?: unknown) => Promise<any>;
};

function desktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as any).electronDesktopAPI;
  return candidate && candidate.isDesktop === true && typeof candidate.invoke === 'function'
    ? candidate as DesktopBridge
    : null;
}

function validateKey(key: string): void {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) {
    throw new Error('کلید بکاپ محلی معتبر نیست.');
  }
}

/** True only where a native OS-encrypted storage implementation is installed. */
export function hasNativeBackupStorage(): boolean {
  return isNativeAndroidSecureStorage() || desktopBridge() !== null;
}

/**
 * Native backup storage never falls back to IndexedDB/localStorage on write failure.
 * Android keys are protected by Android Keystore AES-GCM; Windows values by Electron
 * safeStorage. Browser/PWA callers should continue using their separately labelled
 * browser-local backup path.
 */
export async function getNativeBackupValue(key: string): Promise<string | null> {
  validateKey(key);
  if (isNativeAndroidSecureStorage()) {
    return getAndroidEncryptedItem('backup:' + key);
  }
  const bridge = desktopBridge();
  if (!bridge) throw new Error('ذخیره‌سازی رمزگذاری‌شدهٔ بومی در دسترس نیست.');
  const result = await bridge.invoke('secure-backup-store-get', { key });
  if (!result || result.success !== true || (result.value !== null && typeof result.value !== 'string')) {
    throw new Error(result?.error || 'خواندن امن بکاپ محلی ناموفق بود.');
  }
  return result.value;
}

export async function setNativeBackupValue(key: string, value: string): Promise<void> {
  validateKey(key);
  if (typeof value !== 'string') throw new Error('مقدار بکاپ محلی معتبر نیست.');
  if (isNativeAndroidSecureStorage()) {
    await setAndroidEncryptedItem('backup:' + key, value);
    return;
  }
  const bridge = desktopBridge();
  if (!bridge) throw new Error('ذخیره‌سازی رمزگذاری‌شدهٔ بومی در دسترس نیست.');
  const result = await bridge.invoke('secure-backup-store-set', { key, value });
  if (!result || result.success !== true || result.encryptedAtRest !== true) {
    throw new Error(result?.error || 'ذخیره امن بکاپ محلی تأیید نشد.');
  }
}

export async function removeNativeBackupValue(key: string): Promise<void> {
  validateKey(key);
  if (isNativeAndroidSecureStorage()) {
    await removeAndroidEncryptedItem('backup:' + key);
    return;
  }
  const bridge = desktopBridge();
  if (!bridge) throw new Error('ذخیره‌سازی رمزگذاری‌شدهٔ بومی در دسترس نیست.');
  const result = await bridge.invoke('secure-backup-store-remove', { key });
  if (!result || result.success !== true) {
    throw new Error(result?.error || 'حذف امن بکاپ محلی تأیید نشد.');
  }
}
