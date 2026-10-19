// انواع دادههای سیستم امضای دیجیتال منطبق با قوانین ایران

export interface DocumentMetadata {
  id: string;
  title: string;
  type: DocumentType;
  filePath: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
  iranianDate: string; // تاریخ شمسی
}

export enum DocumentType {
  INVOICE = 'فاکتور',
  CONTRACT = 'قرارداد', 
  FINANCIAL_STATEMENT = 'صورت_مالی',
  TAX_DECLARATION = 'اظهارنامه',
  ACCOUNTING_REPORT = 'گزارش_حسابداری',
  RECEIPT = 'رسید'
}

export interface SignatureRequest {
  id: string;
  documentId: string;
  signerInfo: SignerInfo;
  status: SignatureStatus;
  createdAt: string;
  expiresAt: string;
  signedAt?: string;
  ipAddress?: string;
  verificationCode?: string;
  signatureHash?: string;
}

export interface SignerInfo {
  name: string;
  nationalId: string; // کد ملی
  email: string;
  phone: string;
  role: string; // نقش در سازمان
}

export enum SignatureStatus {
  PENDING = 'در_انتظار',
  SIGNED = 'امضا_شده',
  REJECTED = 'رد_شده',
  EXPIRED = 'منقضی_شده',
  CANCELLED = 'لغو_شده'
}

export interface DigitalSignature {
  id: string;
  documentId: string;
  signerId: string;
  signatureData: string; // امضای رمزنگاری شده
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  certificateInfo: CertificateInfo;
  complianceData: ComplianceData;
}

export interface CertificateInfo {
  algorithm: string; // RSA-2048 یا بالاتر
  publicKey: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
}

export interface ComplianceData {
  iranianLawCompliance: boolean;
  auditTrail: AuditEntry[];
  legalValidation: LegalValidation;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  userId: string;
  ipAddress: string;
  details: string;
}

export interface LegalValidation {
  isValid: boolean;
  validationDate: string;
  validatorId: string;
  complianceNotes: string;
}

export interface SignatureSession {
  sessionId: string;
  documentId: string;
  signerId: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  otpVerified: boolean;
}

export interface OTPVerification {
  code: string;
  phone: string;
  expiresAt: string;
  attempts: number;
  verified: boolean;
}