import { Voucher, InventoryMovementType } from './types';

export interface ImportMappingConfig {
  id: string;
  name: string;
  voucherType: 'GOODS_RECEIPT' | 'GOODS_ISSUE' | 'INVENTORY_ADJUSTMENT' | 'PRODUCTION_CONSUMPTION' | 'PRODUCTION_OUTPUT';
  rootMapping: {
    number: string;
    trackingCode: string;
    date: string;
    time?: string;
    personName?: string;
    supervisor?: string;
    vehicleNumber?: string;
    receiverPhone?: string;
    notes?: string;
  };
  itemMapping: {
    productId?: string; // Can map by SKU/Code or direct ID
    productName: string;
    quantity: string;
    unit?: string;
    weight?: string;
    shelfLocation?: string;
    description?: string;
  };
  itemsPath: string; // Key in JSON for the items list, e.g. "items" or "items_list" or "products"
}

export type ImportValidationErrorType =
  | 'SCHEMA_MISMATCH'
  | 'DUPLICATE_DOC_NUM'
  | 'DUPLICATE_TRACKING'
  | 'INVALID_DATA'
  | 'MISSING_FIELD'
  | 'INVALID_PRODUCT'
  | 'INVALID_PERSON';

export interface ImportValidationError {
  index: number; // Index in the import array
  docNumber?: number;
  field?: string;
  type: ImportValidationErrorType;
  message: string;
}

export interface ImportValidationWarning {
  index: number;
  message: string;
}

export interface StockChangeReconciliation {
  productId: string;
  productName: string;
  beforeStock: number;
  changeQty: number; // Signed, + for receipt, - for issue
  afterStock: number;
}

export interface ImportReconciliationReport {
  batchId: string;
  totalVouchers: number;
  stockChanges: StockChangeReconciliation[];
  auditSummary: string;
}

export interface ImportBatch {
  id: string; // Format: IMP-XXXXXX
  timestamp: string; // Jalali date & time
  status: 'PENDING_VAL' | 'VALIDATED' | 'COMMITTED' | 'ROLLEDBACK';
  voucherType: 'GOODS_RECEIPT' | 'GOODS_ISSUE' | 'INVENTORY_ADJUSTMENT' | 'PRODUCTION_CONSUMPTION' | 'PRODUCTION_OUTPUT';
  rawCount: number;
  vouchers: Voucher[];
  errors: ImportValidationError[];
  warnings: ImportValidationWarning[];
  reconciliation: ImportReconciliationReport;
  mappingConfig: ImportMappingConfig;
  offline: boolean;
}
