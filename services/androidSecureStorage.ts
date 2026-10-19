import { registerPlugin } from '@capacitor/core';

type NativeSecureStoragePlugin = {
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string }): Promise<{ success: boolean }>;
  removeItem(options: { key: string }): Promise<{ success: boolean }>;
};

const nativeSecureStorage = registerPlugin<NativeSecureStoragePlugin>('NativeSecureStorage');

export function isNativeAndroidSecureStorage(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  try {
    return Boolean(
      capacitor?.isNativePlatform?.() &&
      capacitor?.getPlatform?.() === 'android'
    );
  } catch {
    return false;
  }
}

function validKey(key: string): void {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) {
    throw new Error('INVALID_SECURE_STORAGE_KEY');
  }
}

export async function getAndroidEncryptedItem(key: string): Promise<string | null> {
  validKey(key);
  const result = await nativeSecureStorage.getItem({ key });
  if (!result || (result.value !== null && typeof result.value !== 'string')) {
    throw new Error('ANDROID_SECURE_STORAGE_BAD_RESPONSE');
  }
  return result.value;
}

export async function setAndroidEncryptedItem(key: string, value: string): Promise<void> {
  validKey(key);
  if (typeof value !== 'string') throw new Error('INVALID_SECURE_STORAGE_VALUE');
  const result = await nativeSecureStorage.setItem({ key, value });
  if (result?.success !== true) throw new Error('ANDROID_SECURE_STORAGE_WRITE_FAILED');
}

export async function removeAndroidEncryptedItem(key: string): Promise<void> {
  validKey(key);
  const result = await nativeSecureStorage.removeItem({ key });
  if (result?.success !== true) throw new Error('ANDROID_SECURE_STORAGE_REMOVE_FAILED');
}

/**
 * Zustand-compatible storage that uses Android Keystore-backed AES-GCM only in a
 * native Android application. It never falls back to plaintext localStorage after
 * an Android native storage failure. Browser/PWA platforms retain their normal store.
 */
export function createAndroidAwareStateStorage() {
  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isNativeAndroidSecureStorage()) return localStorage.getItem(name);
      const secured = await getAndroidEncryptedItem(name);
      if (secured !== null) return secured;

      // One-time migration for the prior unencrypted Zustand financial store.
      const legacy = localStorage.getItem(name);
      if (legacy === null) return null;
      await setAndroidEncryptedItem(name, legacy);
      localStorage.removeItem(name);
      return legacy;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      if (isNativeAndroidSecureStorage()) {
        await setAndroidEncryptedItem(name, value);
        localStorage.removeItem(name);
        return;
      }
      localStorage.setItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
      if (isNativeAndroidSecureStorage()) await removeAndroidEncryptedItem(name);
      localStorage.removeItem(name);
    }
  };
}
