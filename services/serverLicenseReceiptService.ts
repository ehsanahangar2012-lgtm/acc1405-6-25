export interface ServerLicenseReceipt {
  signed_payload: string;
  signature: string;
  algorithm: string;
}
export interface VerifiedLicensePayload {
  issuer: string;
  workspace_id: string;
  license_key_hash: string;
  hwid: string;
  plan: string;
  max_customers: number;
  max_documents: number;
  max_users: number;
  is_unlimited: boolean;
  features: string[];
  expire_date: string;
  issued_at: number;
  expires_at: number;
}
export interface VerifiedServerLicense {
  payload: VerifiedLicensePayload;
  receipt: ServerLicenseReceipt;
}

const publicKeys = new Map<string, CryptoKey>();
const ALGORITHM = 'RSASSA-PKCS1-v1_5-SHA256';

function baseUrl(value: string): string {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('نشانی سرور باید با HTTP یا HTTPS شروع شود.');
  const parsed = new URL(url);
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHost) throw new Error('برای تأیید امن لایسنس، اتصال HTTPS الزامی است.');
  return url;
}
function fromB64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function pemDer(value: string): Uint8Array {
  return fromB64(value.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, ''));
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
async function publicKey(hostUrl: string): Promise<CryptoKey> {
  const base = baseUrl(hostUrl);
  const cached = publicKeys.get(base);
  if (cached) return cached;
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto در این محیط در دسترس نیست.');
  let last: unknown;
  for (const url of [base + '/tenant-manager.php?action=public_key', base + '/host-backend/tenant-manager.php?action=public_key']) {
    try {
      const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.status === 404) continue;
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || typeof data.public_key !== 'string') {
        throw new Error(data?.message || 'دریافت کلید عمومی سرور انجام نشد.');
      }
      const key = await crypto.subtle.importKey('spki', pemDer(data.public_key), {
        name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'
      }, false, ['verify']);
      publicKeys.set(base, key);
      return key;
    } catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error('کلید عمومی سرور در دسترس نیست.');
}

export async function verifyServerLicenseReceipt(args: {
  hostUrl: string; licenseKey: string; workspaceId: string; hwid: string;
  receipt: ServerLicenseReceipt | null | undefined;
}): Promise<VerifiedServerLicense | null> {
  try {
    const { hostUrl, licenseKey, workspaceId, hwid, receipt } = args;
    if (!licenseKey?.trim() || !workspaceId?.trim() || !hwid?.trim() || !receipt) return null;
    if (receipt.algorithm !== ALGORITHM || !receipt.signed_payload || !receipt.signature) return null;
    const bytes = fromB64(receipt.signed_payload);
    const sig = fromB64(receipt.signature);
    const key = await publicKey(hostUrl);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, bytes)) return null;
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as VerifiedLicensePayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.issuer !== 'ashkghalam-license-v1' || payload.workspace_id !== workspaceId) return null;
    if (payload.license_key_hash !== await sha256(licenseKey.trim().toUpperCase())) return null;
    if (String(payload.hwid || '').toUpperCase() !== hwid.trim().toUpperCase()) return null;
    if (!Number.isFinite(payload.issued_at) || payload.issued_at > now + 60) return null;
    if (!Number.isFinite(payload.expires_at) || payload.expires_at <= now) return null;
    if (typeof payload.plan !== 'string' || !Array.isArray(payload.features)) return null;
    if (!Number.isFinite(payload.max_customers) || !Number.isFinite(payload.max_documents)) return null;
    if (payload.expire_date !== '9999-12-31') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.expire_date || '')) return null;
      const expires = new Date(payload.expire_date + 'T23:59:59Z');
      if (
        Number.isNaN(expires.getTime()) ||
        expires.toISOString().slice(0, 10) !== payload.expire_date ||
        expires.getTime() < Date.now()
      ) return null;
    }
    return { payload, receipt };
  } catch {
    return null;
  }
}

export async function refreshServerLicense(args: {
  hostUrl: string; licenseKey: string; workspaceId: string; hwid: string;
}): Promise<VerifiedServerLicense | null> {
  const base = baseUrl(args.hostUrl);
  const body = JSON.stringify({ action: 'verify_license', workspace_id: args.workspaceId, token: args.licenseKey, hwid: args.hwid });
  for (const endpoint of [base + '/tenant-manager.php', base + '/host-backend/tenant-manager.php']) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body, cache: 'no-store'
      });
      if (response.status === 404) continue;
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.allowed !== true || data?.status !== 'ACTIVE') return null;
      return await verifyServerLicenseReceipt({
        hostUrl: base, licenseKey: args.licenseKey, workspaceId: args.workspaceId,
        hwid: args.hwid, receipt: data.license_receipt
      });
    } catch { /* Try the alternate deployed endpoint, then fail closed. */ }
  }
  return null;
}
