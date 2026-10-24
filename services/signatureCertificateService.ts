import CryptoJS from 'crypto-js';

export interface SignatureCertificateData {
  documentId: string;
  documentType: string;
  documentTitle: string;
  signerName: string;
  signerNationalId: string;
  signerPhone: string;
  signerEmail?: string;
  signatureDate: string;
  signatureTime: string;
  ipAddress: string;
  certificateId: string;
  signatureHash: string;
  verificationCode: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  template: string;
}

class SignatureCertificateService {
  private readonly CERTIFICATE_STORAGE_KEY = 'signature_certificates';
  private readonly CERTIFICATE_TEMPLATES_KEY = 'certificate_templates';

  /**
   * تولید گواهی امضای دیجیتال
   */
  async generateCertificate(signatureData: Omit<SignatureCertificateData, 'certificateId' | 'verificationCode'>): Promise<SignatureCertificateData> {
    const certificateId = this.generateCertificateId();
    const verificationCode = this.generateVerificationCode();

    const certificate: SignatureCertificateData = {
      ...signatureData,
      certificateId,
      verificationCode
    };

    // ذخیره گواهی
    await this.saveCertificate(certificate);

    return certificate;
  }

  /**
   * دریافت گواهی بر اساس شناسه
   */
  async getCertificate(certificateId: string): Promise<SignatureCertificateData | null> {
    const certificates = await this.getAllCertificates();
    return certificates.find(cert => cert.certificateId === certificateId) || null;
  }

  /**
   * تأیید اعتبار گواهی
   */
  async verifyCertificate(certificateId: string, verificationCode: string): Promise<boolean> {
    const certificate = await this.getCertificate(certificateId);
    return certificate?.verificationCode === verificationCode;
  }

  /**
   * دریافت تمام گواهیها
   */
  async getAllCertificates(): Promise<SignatureCertificateData[]> {
    try {
      const stored = localStorage.getItem(this.CERTIFICATE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('خطا در دریافت گواهیها:', error);
      return [];
    }
  }

  /**
   * ذخیره گواهی
   */
  private async saveCertificate(certificate: SignatureCertificateData): Promise<void> {
    try {
      const certificates = await this.getAllCertificates();
      certificates.push(certificate);
      localStorage.setItem(this.CERTIFICATE_STORAGE_KEY, JSON.stringify(certificates));
    } catch (error) {
      console.error('خطا در ذخیره گواهی:', error);
      throw new Error('امکان ذخیره گواهی وجود ندارد');
    }
  }

  /**
   * تولید شناسه یکتا برای گواهی
   */
  private generateCertificateId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * تولید کد تأیید
   */
  private generateVerificationCode(): string {
    return CryptoJS.SHA256(Date.now().toString() + Math.random().toString()).toString().substring(0, 16).toUpperCase();
  }

  /**
   * تولید هش امضا
   */
  generateSignatureHash(documentId: string, signerNationalId: string, timestamp: string): string {
    const data = `${documentId}-${signerNationalId}-${timestamp}`;
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * صدور گواهی برای سند امضا شده
   */
  async issueCertificateForSignedDocument(documentData: {
    documentId: string;
    documentType: string;
    documentTitle: string;
    signerName: string;
    signerNationalId: string;
    signerPhone: string;
    signerEmail?: string;
    ipAddress: string;
  }): Promise<SignatureCertificateData> {
    const now = new Date();
    const signatureDate = now.toLocaleDateString('fa-IR');
    const signatureTime = now.toLocaleTimeString('fa-IR');
    const signatureHash = this.generateSignatureHash(
      documentData.documentId,
      documentData.signerNationalId,
      now.getTime().toString()
    );

    return await this.generateCertificate({
      ...documentData,
      signatureDate,
      signatureTime,
      signatureHash
    });
  }

  /**
   * جستجو در گواهیها
   */
  async searchCertificates(query: {
    documentId?: string;
    signerNationalId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SignatureCertificateData[]> {
    const certificates = await this.getAllCertificates();
    
    return certificates.filter(cert => {
      if (query.documentId && !cert.documentId.includes(query.documentId)) return false;
      if (query.signerNationalId && cert.signerNationalId !== query.signerNationalId) return false;
      if (query.dateFrom && cert.signatureDate < query.dateFrom) return false;
      if (query.dateTo && cert.signatureDate > query.dateTo) return false;
      return true;
    });
  }

  /**
   * حذف گواهی (فقط برای مدیران)
   */
  async deleteCertificate(certificateId: string): Promise<boolean> {
    try {
      const certificates = await this.getAllCertificates();
      const filteredCertificates = certificates.filter(cert => cert.certificateId !== certificateId);
      localStorage.setItem(this.CERTIFICATE_STORAGE_KEY, JSON.stringify(filteredCertificates));
      return true;
    } catch (error) {
      console.error('خطا در حذف گواهی:', error);
      return false;
    }
  }

  /**
   * آمار گواهیها
   */
  async getCertificateStats(): Promise<{
    total: number;
    thisMonth: number;
    thisWeek: number;
    today: number;
  }> {
    const certificates = await this.getAllCertificates();
    const now = new Date();
    const today = now.toLocaleDateString('fa-IR');
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fa-IR');
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('fa-IR');

    return {
      total: certificates.length,
      thisMonth: certificates.filter(cert => cert.signatureDate >= thisMonthStart).length,
      thisWeek: certificates.filter(cert => cert.signatureDate >= thisWeekStart).length,
      today: certificates.filter(cert => cert.signatureDate === today).length
    };
  }
}

export const signatureCertificateService = new SignatureCertificateService();