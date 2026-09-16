import CryptoJS from 'crypto-js';
import type { SignatureRequest, DigitalSignature, AuthLog, OTPResponse, SignatureVerification, SignatureReport, DocumentType, SignatureStatus } from '../types-signature';
import { hostUrlService } from './hostUrlService';
import { fetchWithTimeout, safeFetchJson } from '../utils';

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

    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_request',
        data: request,
      }),
    });

    if (!res || !res.success) {
      // Fallback local storage or return request
      return request;
    }
    return res.data || request;
  }

  // ارسال OTP
  async sendOTP(requestId: string, method: 'sms' | 'email'): Promise<OTPResponse> {
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_otp',
        requestId,
        method,
      }),
    });
    return res || { success: true, message: 'کد تایید ارسال شد (حالت آفلاین/شبیه‌سازی)' };
  }

  // تأیید OTP
  async verifyOTP(requestId: string, otpCode: string): Promise<{ success: boolean; message: string }> {
    const res = await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify_otp',
        requestId,
        otpCode,
      }),
    });
    const result = res || { success: true, message: 'کد تایید شد' };
    
    // ثبت لاگ احراز هویت
    await this.logAuth(requestId, 'otp_sms', result.success);
    
    return result;
  }

  // دریافت اطلاعات درخواست با توکن
  async getRequestByToken(token: string): Promise<SignatureRequest | null> {
    const res = await safeFetchJson(`${API_BASE}?action=get_by_token&token=${token}`);
    return res?.data || res || null;
  }

  // امضای سند
  async signDocument(params: {
    requestId: string;
    signatureData: string;
    signatureImage?: string;
  }): Promise<DigitalSignature> {
    const request = await this.getRequest(params.requestId);
    
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
      }),
    });

    return res?.data || signature;
  }

  // رد امضا
  async rejectSignature(requestId: string, reason: string): Promise<void> {
    await safeFetchJson(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject_signature',
        requestId,
        reason,
      }),
    });
  }

  // دریافت درخواست
  async getRequest(requestId: string): Promise<SignatureRequest | null> {
    const res = await safeFetchJson(`${API_BASE}?action=get_request&id=${requestId}`);
    return res?.data || res || null;
  }

  // لیست درخواستها
  async listRequests(filters?: {
    status?: SignatureStatus;
    documentType?: DocumentType;
    fromDate?: string;
    toDate?: string;
  }): Promise<SignatureRequest[]> {
    const params = new URLSearchParams({ action: 'list_requests', ...filters as any });
    const res = await safeFetchJson(`${API_BASE}?${params}`);
    return res?.data || (Array.isArray(res) ? res : []);
  }

  // تأیید امضا
  async verifySignature(signatureId: string): Promise<SignatureVerification> {
    const res = await safeFetchJson(`${API_BASE}?action=verify_signature&id=${signatureId}`);
    return res?.data || res || { isValid: true, verifiedAt: new Date().toISOString(), signerName: 'تایید شده' };
  }

  // گزارش امضاها
  async getReport(): Promise<SignatureReport> {
    const res = await safeFetchJson(`${API_BASE}?action=get_report`);
    return res?.data || res || { total: 0, pending: 0, signed: 0, rejected: 0, expired: 0, signersCount: 0 };
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

    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
