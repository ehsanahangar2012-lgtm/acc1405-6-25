import CryptoJS from 'crypto-js';
import { SignatureRequest, DigitalSignature, SignatureStatus, OTPVerification } from '../digital-signature-types-complete';
import { fetchWithTimeout } from '../utils';

class DigitalSignatureService {
  private readonly API_BASE = '/api/signature';
  private readonly ENCRYPTION_KEY = 'ashke-ghalam-signature-key-2024';

  // ایجاد درخواست امضا
  async createSignatureRequest(documentId: string, signerInfo: any): Promise<SignatureRequest> {
    const request: SignatureRequest = {
      id: this.generateId(),
      documentId,
      signerInfo,
      status: SignatureStatus.PENDING,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      verificationCode: this.generateOTP()
    };

    await this.sendOTP(signerInfo.phone, request.verificationCode!);
    await this.saveRequest(request);
    await this.logAudit('CREATE_REQUEST', request.id, signerInfo.nationalId);
    
    return request;
  }

  // تولید لینک امضا
  generateSignatureLink(requestId: string): string {
    const token = this.encryptToken({ requestId, timestamp: Date.now() });
    return `${window.location.origin}/sign/${token}`;
  }

  // اعتبارسنجی لینک
  async validateSignatureLink(token: string): Promise<SignatureRequest | null> {
    try {
      const data = this.decryptToken(token);
      const request = await this.getRequest(data.requestId);
      
      if (!request || new Date(request.expiresAt) < new Date()) {
        return null;
      }
      
      return request;
    } catch {
      return null;
    }
  }

  // تأیید OTP
  async verifyOTP(requestId: string, code: string): Promise<boolean> {
    const request = await this.getRequest(requestId);
    if (!request || request.verificationCode !== code) {
      await this.logAudit('OTP_FAILED', requestId, '');
      return false;
    }
    
    await this.logAudit('OTP_SUCCESS', requestId, request.signerInfo.nationalId);
    return true;
  }

  // ثبت امضا
  async signDocument(requestId: string, signatureData: string, ipAddress: string): Promise<DigitalSignature> {
    const request = await this.getRequest(requestId);
    if (!request) throw new Error('درخواست یافت نشد');

    const signature: DigitalSignature = {
      id: this.generateId(),
      documentId: request.documentId,
      signerId: request.signerInfo.nationalId,
      signatureData: this.encryptSignature(signatureData),
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent: navigator.userAgent,
      certificateInfo: await this.generateCertificate(),
      complianceData: {
        iranianLawCompliance: true,
        auditTrail: [],
        legalValidation: {
          isValid: true,
          validationDate: new Date().toISOString(),
          validatorId: 'SYSTEM',
          complianceNotes: 'منطبق با قوانین امضای الکترونیکی ایران'
        }
      }
    };

    await this.saveSignature(signature);
    await this.updateRequestStatus(requestId, SignatureStatus.SIGNED);
    await this.logAudit('SIGN_DOCUMENT', requestId, request.signerInfo.nationalId);
    
    return signature;
  }

  // رد امضا
  async rejectSignature(requestId: string, reason: string): Promise<void> {
    await this.updateRequestStatus(requestId, SignatureStatus.REJECTED);
    await this.logAudit('REJECT_SIGNATURE', requestId, reason);
  }

  // دریافت اسناد امضا شده
  async getSignedDocuments(filters?: any): Promise<DigitalSignature[]> {
    const response = await fetch(`${this.API_BASE}/signed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    return response.json();
  }

  // تولید گواهی امضا
  async generateCertificate() {
    const keyPair = await this.generateRSAKeyPair();
    return {
      algorithm: 'RSA-2048',
      publicKey: keyPair.publicKey,
      issuer: 'Ashke Ghalam Cloud',
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      serialNumber: this.generateId()
    };
  }

  // متدهای کمکی
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private encryptToken(data: any): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.ENCRYPTION_KEY).toString();
  }

  private decryptToken(token: string): any {
    const bytes = CryptoJS.AES.decrypt(token, this.ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  private encryptSignature(data: string): string {
    return CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY).toString();
  }

  private async generateRSAKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    );
    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return { publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))) };
  }

  private async sendOTP(phone: string, code: string): Promise<void> {
    await fetch(`${this.API_BASE}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
  }

  private async saveRequest(request: SignatureRequest): Promise<void> {
    await fetch(`${this.API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  private async getRequest(id: string): Promise<SignatureRequest | null> {
    const response = await fetch(`${this.API_BASE}/requests/${id}`);
    return response.ok ? response.json() : null;
  }

  private async saveSignature(signature: DigitalSignature): Promise<void> {
    await fetch(`${this.API_BASE}/signatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signature)
    });
  }

  private async updateRequestStatus(id: string, status: SignatureStatus): Promise<void> {
    await fetch(`${this.API_BASE}/requests/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  private async logAudit(action: string, requestId: string, userId: string): Promise<void> {
    await fetch(`${this.API_BASE}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        action,
        requestId,
        userId,
        ipAddress: await this.getClientIP()
      })
    });
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 2000);
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}

export const digitalSignatureService = new DigitalSignatureService();
