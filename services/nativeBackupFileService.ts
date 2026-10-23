import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from '../utils';
import { backupEncryptionService } from './backupEncryptionService';
interface NativeBackupPlugin {
  saveBackup(options: { fileName: string; content: string; mimeType?: string }): Promise<{ success?: boolean; cancelled?: boolean; uri?: string; bytesWritten?: number }>;
}
interface DesktopBackupBridge {
  writeLocalBackup?: (fileName: string, data: string) => Promise<{ success?: boolean; error?: string; filePath?: string }>;
}
const nativeBackupPlugin = registerPlugin<NativeBackupPlugin>('NativeBackup');
export interface EncryptedBackupSaveResult {
  success: boolean; cancelled?: boolean; fileName: string; location?: string; method?: 'android' | 'desktop' | 'download';
}
/** Save only password-encrypted backup envelopes and require platform confirmation. */
export async function saveEncryptedBackupFile(fileName: string, encryptedText: string): Promise<EncryptedBackupSaveResult> {
  if (typeof window === 'undefined') throw new Error('محیط ذخیره‌سازی در دسترس نیست.');
  if (typeof fileName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,179}\.(json|agbak)$/.test(fileName)) throw new Error('نام فایل پشتیبان معتبر نیست.');
  if (typeof encryptedText !== 'string' || !encryptedText) throw new Error('محتوای فایل پشتیبان خالی است.');
  let envelope: unknown;
  try { envelope = JSON.parse(encryptedText); } catch { throw new Error('فایل خروجی باید یک پوشش رمزگذاری‌شده معتبر باشد.'); }
  if (!backupEncryptionService.isEncryptedEnvelope(envelope)) throw new Error('برای جلوگیری از ذخیره اطلاعات مالی به‌صورت متن ساده، فقط فایل رمزگذاری‌شده پذیرفته می‌شود.');
  const expectedBytes = new TextEncoder().encode(encryptedText).byteLength;
  if (isAndroidApp()) {
    const result = await nativeBackupPlugin.saveBackup({ fileName, content: encryptedText, mimeType: 'application/json' });
    if (result?.cancelled) return { success: false, cancelled: true, fileName };
    if (result?.success !== true || typeof result.uri !== 'string' || !result.uri || result.bytesWritten !== expectedBytes) {
      throw new Error('ذخیره فایل پشتیبان در مسیر انتخاب‌شده تأیید نشد.');
    }
    return { success: true, fileName, location: result.uri, method: 'android' };
  }
  const desktop = (window as any).electronDesktopAPI as DesktopBackupBridge | undefined;
  if (desktop && typeof desktop.writeLocalBackup === 'function' && fileName.endsWith('.json')) {
    const result = await desktop.writeLocalBackup(fileName, encryptedText);
    if (result?.success === true && typeof result.filePath === 'string' && result.filePath.length > 0) {
      return { success: true, fileName, location: result.filePath, method: 'desktop' };
    }
    if (result?.error !== 'BACKUP_DIRECTORY_NOT_SELECTED') throw new Error(result?.error || 'ذخیره فایل پشتیبان رمزگذاری‌شده در پوشه ویندوز ناموفق بود.');
    // No configured directory: fall through to an encrypted file download.
  }
  const blob = new Blob([encryptedText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 30_000); }
  return { success: true, fileName, method: 'download' };
}
