import { registerPlugin } from '@capacitor/core';

type NativeSecureStoragePlugin = {
  getItem(options: { key: string }): Promise<{ found: boolean; value?: string }>;
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
  if (!result || typeof result.found !== 'boolean') {
    throw new Error('ANDROID_SECURE_STORAGE_BAD_RESPONSE');
  }
  if (!result.found) return null;
  if (typeof result.value !== 'string') throw new Error('ANDROID_SECURE_STORAGE_BAD_RESPONSE');
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

type DesktopSecureStorageApi = {
  isDesktop?: boolean;
  invoke?: (channel: string, payload?: unknown) => Promise<any>;
};

function getDesktopSecureStorageApi(): DesktopSecureStorageApi | null {
  if (typeof window === 'undefined') return null;
  const api = (window as any).electronDesktopAPI;
  return api?.isDesktop === true && typeof api.invoke === 'function'
    ? api as DesktopSecureStorageApi
    : null;
}

export function isNativeDesktopSecureStorage(): boolean {
  return getDesktopSecureStorageApi() !== null;
}

async function getDesktopEncryptedItem(key: string): Promise<string | null> {
  validKey(key);
  const api = getDesktopSecureStorageApi();
  if (!api) throw new Error('DESKTOP_SECURE_STORAGE_UNAVAILABLE');
  const result = await api.invoke!('secure-backup-store-get', { key: 'zustand:' + key });
  if (!result || result.success !== true || (result.value !== null && typeof result.value !== 'string')) {
    throw new Error(result?.error || 'DESKTOP_SECURE_STORAGE_READ_FAILED');
  }
  if (result.encryptedAtRest !== true) throw new Error('DESKTOP_SECURE_STORAGE_NOT_ENCRYPTED');
  return result.value;
}

async function setDesktopEncryptedItem(key: string, value: string): Promise<void> {
  validKey(key);
  if (typeof value !== 'string') throw new Error('INVALID_SECURE_STORAGE_VALUE');
  const api = getDesktopSecureStorageApi();
  if (!api) throw new Error('DESKTOP_SECURE_STORAGE_UNAVAILABLE');
  const result = await api.invoke!('secure-backup-store-set', { key: 'zustand:' + key, value });
  if (!result || result.success !== true || result.encryptedAtRest !== true) {
    throw new Error(result?.error || 'DESKTOP_SECURE_STORAGE_WRITE_FAILED');
  }
}

async function removeDesktopEncryptedItem(key: string): Promise<void> {
  validKey(key);
  const api = getDesktopSecureStorageApi();
  if (!api) throw new Error('DESKTOP_SECURE_STORAGE_UNAVAILABLE');
  const result = await api.invoke!('secure-backup-store-remove', { key: 'zustand:' + key });
  if (!result || result.success !== true) {
    throw new Error(result?.error || 'DESKTOP_SECURE_STORAGE_REMOVE_FAILED');
  }
}

/**
 * Zustand-compatible storage for native apps:
 * - Android uses Android Keystore AES-GCM.
 * - Electron uses OS-backed safeStorage via a restricted IPC channel.
 * - Browser/PWA keeps its existing storage and is not claimed to have hardware-backed
 *   encryption at rest.
 *
 * Native storage failures never silently fall back to plaintext localStorage.
 */
export function createAndroidAwareStateStorage() {
  return {
    getItem: async (name: string): Promise<string | null> => {
      if (isNativeAndroidSecureStorage()) {
        const secured = await getAndroidEncryptedItem(name);
        if (secured !== null) return secured;

        // One-time migration from the prior unencrypted financial store.
        const legacy = localStorage.getItem(name);
        if (legacy === null) return null;
        await setAndroidEncryptedItem(name, legacy);
        localStorage.removeItem(name);
        return legacy;
      }

      if (isNativeDesktopSecureStorage()) {
        const secured = await getDesktopEncryptedItem(name);
        if (secured !== null) return secured;

        // Migrate only after encrypted storage explicitly reports no existing value.
        const legacy = localStorage.getItem(name);
        if (legacy === null) return null;
        await setDesktopEncryptedItem(name, legacy);
        localStorage.removeItem(name);
        return legacy;
      }

      return localStorage.getItem(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
      if (isNativeAndroidSecureStorage()) {
        await setAndroidEncryptedItem(name, value);
        localStorage.removeItem(name);
        return;
      }

      if (isNativeDesktopSecureStorage()) {
        await setDesktopEncryptedItem(name, value);
        localStorage.removeItem(name);
        return;
      }

      localStorage.setItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
      if (isNativeAndroidSecureStorage()) {
        await removeAndroidEncryptedItem(name);
        localStorage.removeItem(name);
        return;
      }

      if (isNativeDesktopSecureStorage()) {
        await removeDesktopEncryptedItem(name);
        localStorage.removeItem(name);
        return;
      }

      localStorage.removeItem(name);
    }
  };
}
