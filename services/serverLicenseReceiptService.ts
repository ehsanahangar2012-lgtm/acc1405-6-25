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
