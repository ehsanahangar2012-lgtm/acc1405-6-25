// انواع سند قابل امضا
export enum DocumentType {
  INVOICE = 'invoice',
  PURCHASE_INVOICE = 'purchase_invoice',
  CONTRACT = 'contract',
  FINANCIAL_STATEMENT = 'financial_statement',
  TAX_DECLARATION = 'tax_declaration',
  VAT_DECLARATION = 'vat_declaration',
  ACCOUNTING_REPORT = 'accounting_report',
  BALANCE_SHEET = 'balance_sheet',
  PROFIT_LOSS = 'profit_loss',
  CASH_FLOW = 'cash_flow',
  RECEIPT = 'receipt',
  VOUCHER = 'voucher',
  BANK_STATEMENT = 'bank_statement',
  AUDIT_REPORT = 'audit_report'
}

// وضعیت امضا
export enum DocumentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export type SignatureStatus = 'pending' | 'signed' | 'rejected' | 'expired' | 'cancelled';

// نوع احراز هویت
export type AuthMethod = 'otp_sms' | 'otp_email' | 'link';

// درخواست امضا
export interface SignatureRequest {
  id: string;
  documentId: string;
  documentType: DocumentType;
  documentTitle: string;
  documentUrl: string;
  requesterName: string;
  requesterUserId: string;
  signerName: string;
  signerNationalId: string;
  signerPhone: string;
  signerEmail?: string;
  status: SignatureStatus;
  authMethod: AuthMethod;
  signatureToken: string;
  expiresAt: string;
  createdAt: string;
  signedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

// سند امضای دیجیتال
export interface DigitalSignatureDocument {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl: string;
  createdAt: string;
  metadata: {
    iranianDate: string;
    [key: string]: any;
  };
}

// گردش کار امضا
export interface SignatureWorkflow {
  id: string;
  documentId: string;
  steps: SignatureRequest[];
  currentStep: number;
  status: DocumentStatus;
}

// امضای دیجیتال
export interface DigitalSignature {
  id: string;
  requestId: string;
  signatureData: string;
  signatureImage?: string;
  signerName: string;
  signerNationalId: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  certificateHash: string;
  documentHash: string;
}

// لاگ احراز هویت
export interface AuthLog {
  id: string;
  requestId: string;
  method: AuthMethod;
  attemptedAt: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  otpCode?: string;
  errorMessage?: string;
}

// پاسخ OTP
export interface OTPResponse {
  success: boolean;
  message: string;
  expiresIn?: number;
}

// پاسخ تأیید امضا
export interface SignatureVerification {
  isValid: boolean;
  signedAt: string;
  signerName: string;
  signerNationalId: string;
  documentHash: string;
  certificateHash: string;
  verifiedAt: string;
}

// گزارش امضا
export interface SignatureReport {
  totalRequests: number;
  pendingRequests: number;
  signedRequests: number;
  rejectedRequests: number;
  expiredRequests: number;
  requestsByType: Record<DocumentType, number>;
  recentActivity: SignatureRequest[];
}
