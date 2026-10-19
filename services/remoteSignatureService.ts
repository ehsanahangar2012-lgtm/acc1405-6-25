import CryptoJS from 'crypto-js';
import type { SignatureRequest, DigitalSignature, AuthLog, OTPResponse, SignatureVerification, SignatureReport, DocumentType, SignatureStatus } from '../types-signature';
import { hostUrlService } from './hostUrlService';
import { workspaceService } from './workspaceService';
import { fetchWithTimeout, safeFetchJson, unpackPayloadFromToken } from '../utils';

const API_BASE = '/remote-signature-api.php';

const ENCRYPTION_KEY = 'ashke-ghalam-signature-2024';

class RemoteSignatureService {
  // ایجاد درخواست امضا
  async createSignatureRequest(params: {
    documentId: string;
    documentType: DocumentType;
    documentTitle: string;
    documentUrl: string;
    signerName: string;
    signerNationalId: string;
    signerPhone: string;
    signerEmail?: string;
    authMethod: 'otp_sms' | 'otp_email' | 'link';
  }): Promise<SignatureRequest> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    
    const request: SignatureRequest = {
      id: this.generateId(),
      ...params,
      requesterName: localStorage.getItem('userName') || 'کاربر',
      requesterUserId: localStorage.getItem('userId') || '1',
      status: 'pending',
      signatureToken: token,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    const secureHeaders = await workspaceService.getSecureHeaders();
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...secureHeaders },
      body: JSON.stringify({
        action: 'create_request',
        data: request,
      }),
    });

    if (!res?.success || !res?.data?.id || !res?.data?.signatureToken) {
      throw new Error('درخواست امضای امن از سرور دریافت نشد');
    }
    return res.data;
  }

  // ارسال OTP
  async sendOTP(requestId: string, method: 'sms' | 'email', signatureToken: string): Promise<OTPResponse> {
    if (!signatureToken) throw new Error('لینک امضا نامعتبر است');
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_otp',
        requestId,
        signatureToken,
        method,
      }),
    });
    if (!res?.success) throw new Error(res?.error || 'ارسال کد تأیید از سرور انجام نشد');
    return res as OTPResponse;
  }

  // تأیید OTP
  async verifyOTP(requestId: string, otpCode: string, signatureToken: string): Promise<{ success: boolean; message: string; sessionToken?: string }> {
    if (!signatureToken) return { success: false, message: 'لینک امضا نامعتبر است' };
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify_otp',
        requestId,
        signatureToken,
        otpCode,
      }),
    });
    if (!res?.success || !res?.sessionToken) {
      return { success: false, message: res?.error || 'کد تأیید نامعتبر است' };
    }
    return { success: true, message: res.message || 'کد تأیید شد', sessionToken: res.sessionToken };
  }

  // دریافت اطلاعات درخواست با توکن
  async getRequestByToken(token: string): Promise<SignatureRequest | null> {
    try {
      const res = await safeFetchJson(`${API_BASE}?action=get_by_token&token=${encodeURIComponent(token)}`);
      if (res && (res.data || res.id || res.signatureToken)) {
        return res.data || res;
      }
    } catch (e) {
      console.warn('remoteSignatureService API fetch failed:', e);
    }

    // Fallback: unpack token payload directly
    const unpacked = unpackPayloadFromToken(token);
    if (unpacked && unpacked.payload) {
      const p = unpacked.payload;
      const previewStr = typeof p.preview === 'string' ? p.preview : JSON.stringify(p.preview || {});
      let docTitle = p.type || 'سند رسمی';
      let signerName = 'مشتری گرامی';
      let signerPhone = '';
      
      try {
        if (previewStr) {
          const parsed = JSON.parse(previewStr);
          signerName = parsed.personName || parsed.customer || signerName;
          signerPhone = parsed.phone || parsed.personPhone || '';
          docTitle = `${p.type || 'فاکتور'} شماره ${parsed.number || ''}`;
        }
      } catch {}

      return {
        id: p.id || unpacked.uuid,
        signatureToken: token,
        documentId: p.docId || 'DOC-1',
        documentType: (p.type || 'INVOICE') as any,
        documentTitle: docTitle,
        documentUrl: typeof window !== 'undefined' ? `${window.location.origin}/#/sign/${token}` : '',
        signerName: signerName,
        signerNationalId: '---',
        signerPhone: signerPhone || '---',
        authMethod: 'link',
        requesterName: 'مجموعه تجاری',
        requesterUserId: '1',
        status: 'pending',
        expiresAt: p.exp || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        createdAt: p.created || new Date().toISOString()
      };
    }

    return null;
  }

  // امضای سند
  async signDocument(params: {
    requestId: string;
    signatureToken: string;
    sessionToken?: string;
    signatureData: string;
    signatureImage?: string;
  }): Promise<DigitalSignature> {
    const request = await this.getRequestByToken(params.signatureToken);
    if (!request || request.id !== params.requestId) {
      throw new Error('درخواست امضا با این لینک تطبیق ندارد');
    }
    
    // محاسبه هش سند
    const documentHash = request ? await this.calculateDocumentHash(request.documentUrl) : '';
    
    // رمزنگاری داده امضا
    const encryptedSignature = this.encryptData(params.signatureData);
    
    const signature: DigitalSignature = {
      id: this.generateId(),
      requestId: params.requestId,
      signatureData: encryptedSignature,
      signatureImage: params.signatureImage,
      signerName: request?.signerName || 'امضا کننده',
      signerNationalId: request?.signerNationalId || '0000000000',
      signedAt: new Date().toISOString(),
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      certificateHash: request ? this.generateCertificateHash(request, documentHash) : '',
      documentHash,
    };

    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sign_document',
        data: signature,
        signatureToken: params.signatureToken,
        sessionToken: params.sessionToken,
      }),
    });
    if (!res?.success || !res?.data) {
      throw new Error(res?.error || 'ثبت امضا توسط سرور تأیید نشد');
    }
    return res.data as DigitalSignature;
  }

  // رد امضا
  async rejectSignature(requestId: string, reason: string, signatureToken: string, sessionToken?: string): Promise<void> {
    if (!signatureToken) throw new Error('لینک امضا نامعتبر است');
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject_signature',
        requestId,
        reason,
        signatureToken,
        sessionToken,
      }),
    });
    if (!res?.success) throw new Error(res?.error || 'ثبت رد امضا توسط سرور تأیید نشد');
  }

  // دریافت درخواست
  async getRequest(requestId: string): Promise<SignatureRequest | null> {
    const secureHeaders = await workspaceService.getSecureHeaders();
    const res = await safeFetchJson(`${API_BASE}?action=get_request&id=${encodeURIComponent(requestId)}`, {
      headers: secureHeaders,
    });
    return res?.success ? (res.data || null) : null;
  }

  // لیست درخواستها
  async listRequests(filters?: {
    status?: SignatureStatus;
    documentType?: DocumentType;
    fromDate?: string;
    toDate?: string;
  }): Promise<SignatureRequest[]> {
    const params = new URLSearchParams({ action: 'list_requests', ...filters as any });
    const secureHeaders = await workspaceService.getSecureHeaders();
    const res = await safeFetchJson(`${API_BASE}?${params}`, { headers: secureHeaders });
    return res?.success && Array.isArray(res.data) ? res.data : [];
  }

  // تأیید امضا
  async verifySignature(signatureId: string): Promise<SignatureVerification> {
    const secureHeaders = await workspaceService.getSecureHeaders();
    const res = await safeFetchJson(`${API_BASE}?action=verify_signature&id=${encodeURIComponent(signatureId)}`, {
      headers: secureHeaders,
    });
    if (!res?.success || !res?.data) throw new Error('تأیید امضا از سرور دریافت نشد');
    return res.data as SignatureVerification;
  }

  // گزارش امضاها
  async getReport(): Promise<SignatureReport> {
    const secureHeaders = await workspaceService.getSecureHeaders();
    const res = await safeFetchJson(`${API_BASE}?action=get_report`, { headers: secureHeaders });
    return res?.success && res?.data ? res.data : { totalRequests: 0, pendingRequests: 0, signedRequests: 0, rejectedRequests: 0, expiredRequests: 0, requestsByType: {}, recentActivity: [] } as unknown as SignatureReport;
  }

  // تولید لینک امضا با استفاده از hostUrl
  generateSignatureLink(token: string): string {
    try {
      if (typeof hostUrlService !== 'undefined' && hostUrlService.getBaseUrl) {
        // استفاده از getBaseUrl (async) - برای sync از config استفاده میکنیم
        const config = hostUrlService.getConfig();
        if (config?.baseUrl) {
          return `${config.baseUrl}/public-signature.html?token=${token}`;
        }
      }
    } catch (error) {
      console.warn('hostUrlService not available:', error);
    }
    // fallback به URL محلی
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      return `${baseUrl}/#/public-signature?token=${token}`;
    }
    return `/public-signature.html?token=${token}`;
  }

  // رمزنگاری داده
  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  // رمزگشایی داده
  decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // محاسبه هش سند
  private async calculateDocumentHash(documentUrl: string): Promise<string> {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);
      return CryptoJS.SHA256(wordArray).toString();
    } catch {
      return CryptoJS.SHA256(documentUrl).toString();
    }
  }

  // تولید هش گواهی
  private generateCertificateHash(request: SignatureRequest, documentHash: string): string {
    const data = `${request.signerNationalId}${request.signedAt}${documentHash}`;
    return CryptoJS.SHA256(data).toString();
  }

  // دریافت IP کلاینت
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 2000);
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // ثبت لاگ احراز هویت
  private async logAuth(requestId: string, method: 'otp_sms' | 'otp_email', success: boolean): Promise<void> {
    const log: AuthLog = {
      id: this.generateId(),
      requestId,
      method,
      attemptedAt: new Date().toISOString(),
      success,
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
    };

    const secureHeaders = await workspaceService.getSecureHeaders();
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...secureHeaders },
      body: JSON.stringify({
        action: 'log_auth',
        data: log,
      }),
    });
  }

  // تولید شناسه یکتا
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // تولید توکن
  private generateToken(): string {
    return CryptoJS.SHA256(`${Date.now()}-${Math.random()}`).toString().substr(0, 32);
  }
}

export const remoteSignatureService = new RemoteSignatureService();
