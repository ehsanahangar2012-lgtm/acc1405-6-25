
export enum InvoiceType {
  SALE = 'فروش',
  PURCHASE = 'خرید',
  PROFORMA = 'پیش‌فاکتور'
}

export type PrintTheme = 'modern' | 'official' | 'premium' | 'thermal' | 'minimal' | 'classic' | 'smart' | 'colorful' | 'industrial' | 'creative' | 'persian';

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    category?: 'FINANCIAL' | 'SYNC' | 'OPERATION' | 'SYSTEM';
    title?: string;
    timestamp?: string;
    actionLabel?: string;
    actionUrl?: string;
}

export interface OfflineOperation {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    table: string;
    data: any;
    timestamp: string;
    retryCount: number;
}

export interface ModulePermission {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface UserPermissions {
    dashboard: ModulePermission;
    invoices: ModulePermission;
    inventory: ModulePermission;
    checks: ModulePermission;
    finance: ModulePermission;
    customers: ModulePermission;
    reports: ModulePermission;
    settings: ModulePermission;
    users: ModulePermission;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: UserPermissions;
}

export interface LogisticsProfile {
    id: string;
    name: string;
    phone: string;
    vehicleNumber: string;
}

export interface AppUser {
    id: string;
    username: string;
    password?: string;
    hashedPassword?: string;
    fullName: string;
    roleId: string;
    permissions: UserPermissions;
    is_active: boolean;
    lastActive?: string;
    email?: string;
    phone?: string;
    recoveryKey?: string;
    securityQuestion?: string;
    securityAnswerHash?: string;
}

export interface CompanyBranch {
    id: string;
    companyId: string;
    name: string; // نام شعبه، مثلاً شعبه مرکزی، شعبه بازار، شعبه غرب
    code?: string; // کد شعبه
    phone?: string;
    address?: string;
    managerName?: string;
    economicCode?: string;
    nationalId?: string;
    registrationNumber?: string;
    postalCode?: string;
    logo?: string;
    stamp?: string;
    signature?: string;
    isDefault?: boolean;
}

export interface CompanyProfile {
    id: string;
    name: string;
    legalName?: string;
    economicCode?: string;
    nationalId?: string;
    registrationNumber?: string;
    postalCode?: string;
    address: string;
    phone: string;
    email?: string;
    website?: string;
    isActive: boolean;
    logo?: string;
    stamp?: string;
    signature?: string;
    managerName?: string;
    shebaNumber?: string;
    cardNumber?: string;
    accountOwner?: string;
    branches?: CompanyBranch[];
}

export interface SystemConfig {
    // General
    currency: 'RIAL' | 'TOMAN';
    showDecimal: boolean;
    dateFormat: 'JALALI' | 'GREGORIAN';
    fiscalYear?: string;
    fiscalStartDate?: string;
    fiscalEndDate?: string;
    
    // Cloud - Host Only
    cloudEnabled: boolean;
    cloudProvider: 'HOST';
    syncInterval: number;

    // Financial Defaults
    defaultTaxRate: number;
    defaultInvoiceFooter: string;
    invoiceDueDays: number;

    // UI & Experience
    appTheme: 'DARK' | 'LIGHT' | 'SYSTEM';
    uiScale: number;
    soundEnabled?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
    
    // Display Options
    showProductCode?: boolean;
    showStock?: boolean;
    showProfit?: boolean;
    thousandSeparator?: boolean;
    decimalPlaces?: number;
    
    // Confirmations
    confirmDeleteInvoice?: boolean;
    confirmDeleteProduct?: boolean;
    confirmDeleteCustomer?: boolean;
    
    // Data Management
    compressData?: boolean;
    autoCleanup?: boolean;
    
    // Print Settings
    autoPrint?: boolean;
    paperSize?: string;
    
    // Integrations
    smsPanelEnabled: boolean;
    smsApiKey?: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  buyPrice?: number;
  sellPrice?: number;
  price?: number;
  stock: number;
  reservedStock: number;
  minStock?: number;
  unit: string;
  weight?: number; 
  shelfLocation?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

export interface Person {
  id: string;
  code?: string;
  name: string;
  phone?: string;
  email?: string;
  balance: number;
  category?: string;
  type?: 'CUSTOMER' | 'VENDOR';
  isCustomer?: boolean;
  isSupplier?: boolean;
  address?: string;
  nationalId?: string;
  notes?: string;
}

export interface InvoiceItem {
    productId: string;
    productName: string;
    quantity: number;
    buyPrice: number;
    unitPrice: number;
    total: number;
    profit: number;
    description?: string;
}

export interface WorkflowSignatures {
    warehouse?: string;
    sales?: string;
    customer?: string;
    driver?: string;
}

export interface Invoice {
    id: string;
    companyId: string;
    branchId?: string;
    companyName?: string;
    branchName?: string;
    companySnapshot?: {
        name: string;
        legalName?: string;
        economicCode?: string;
        nationalId?: string;
        registrationNumber?: string;
        postalCode?: string;
        address: string;
        phone: string;
        logo?: string;
        stamp?: string;
        signature?: string;
        managerName?: string;
    };
    branchSnapshot?: {
        id: string;
        name: string;
        code?: string;
        phone?: string;
        address?: string;
        managerName?: string;
        logo?: string;
        stamp?: string;
        signature?: string;
        postalCode?: string;
        economicCode?: string;
        registrationNumber?: string;
        nationalId?: string;
    };
    number: number;
    prefix?: string;
    trackingCode: string;
    date: string;
    dueDate?: string;
    personId: string;
    personName: string;
    type: InvoiceType;
    items: InvoiceItem[];
    subTotal: number;
    totalProfit: number;
    tax: number;
    discount: number;
    finalTotal: number;
    cashAmount: number;
    checkAmount: number;
    checks?: Check[];
    payments?: Array<{
        id: string;
        date: string;
        amount: number;
        method: 'CASH' | 'POS' | 'CARD' | 'CHECK';
        trackingCode?: string;
        description?: string;
    }>;
    description?: string;
    attachments?: string[];
    signature?: string;
    driverName?: string;
    driverPhone?: string;
    vehiclePlate?: string;
    workflowSignatures?: WorkflowSignatures;
    taxId?: string;
    showPreviousBalance?: boolean;
}

export interface VoucherItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    weight?: number;
    shelfLocation?: string;
    description?: string;
    imageUrl?: string;
}

export interface VoucherTemplate {
    id: string;
    name: string;
    items: VoucherItem[];
    description?: string;
}

export interface Voucher {
    id: string;
    companyId: string;
    number: number;
    trackingCode: string;
    date: string;
    time?: string;
    type: 'IN' | 'OUT' | 'RETURN';
    personId: string;
    personName: string;
    relatedInvoiceId?: string;
    relatedVoucherId?: string;
    returnReason?: string;
    supervisor?: string;
    vehicleNumber?: string;
    receiverPhone?: string;
    items: VoucherItem[];
    totalWeight?: number; 
    estimatedValue?: number;
    signature?: string;
    companySignature?: string;
    supervisorSignature?: string;
    loadingPhotos?: string[]; 
    notes?: string;
    status?: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';
    deliveryTime?: string;
    qrCode?: string;
    movementType?: InventoryMovementType;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
    warehouseId?: string;
}

export interface Transaction {
    id: string;
    companyId?: string;
    date: string;
    type: string;
    amount: number;
    personId: string;
    personName?: string;
    description: string;
    balanceAfter: number;
    isDebit: boolean;
    referenceId?: string;
    relatedInvoiceId?: string; // For nesting in Cardex
    signature?: string;
    receiptImage?: string;
    trackingCode?: string;
    metadata?: any;
}

export interface CheckTransfer {
    id: string;
    companyId: string;
    number: number;
    date: string;
    personId: string;
    personName: string;
    nationalId?: string;
    trackingCode: string;
    checkIds: string[];
    signature?: string;
    receiverSignature?: string;
    receiverNationalId?: string;
    items: any[];
    description?: string;
    status?: 'PENDING' | 'CONFIRMED';
}

export interface Check {
  id: string;
  bankName: string;
  amount: number;
  dueDate: string;
  issueDate?: string;
  status: 'PENDING' | 'DEPOSITED' | 'PASSED' | 'BOUNCED' | 'TRANSFERRED' | 'CASHED' | 'RETURNED';
  sayadId: string;
  checkNumber?: string;
  holderName: string;
  personId?: string;
  personName?: string;
  relatedInvoiceId?: string;
  imageUrl?: string;
  history?: any[];
  isHighPriority?: boolean;
  description?: string; // توضیحات چک
  checkType?: 'RECEIVED' | 'ISSUED'; // دریافتی / پرداختی
}

// قرارداد
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type ContractType = 'SERVICE' | 'SALE' | 'PURCHASE' | 'EMPLOYMENT' | 'LEASE' | 'OTHER';

export interface ContractItem {
    id: string;
    description: string;
    amount: number;
    dueDate?: string;
    isPaid?: boolean;
}

export interface Contract {
    id: string;
    companyId: string;
    number: number;
    title: string;
    type: ContractType;
    status: ContractStatus;
    personId: string;
    personName: string;
    startDate: string;
    endDate?: string;
    totalAmount: number;
    description?: string;
    items: ContractItem[];
    attachments?: string[];
    signature?: string;
    companySignature?: string;
    trackingCode: string;
    createdAt: string;
    tags?: string[];
}

export interface Salary {
    id: string;
    employeeId: string;
    employeeName: string;
    date: string;
    amount: number;
    bonus: number;
    deductions: number;
    netAmount: number;
}

export interface DashboardStats {
    totalSales: number;
    totalPurchase: number;
    totalReceivables: number;
    totalPayables: number;
}

export const IRANIAN_BANKS = ['بانک ملی', 'بانک ملت', 'بانک صادرات', 'بانک تجارت', 'بانک سپه', 'بانک پاسارگاد', 'بانک سامان', 'بانک پارسیارن', 'بانک کشاورزی', 'بانک مسکن', 'بانک رفاه', 'بانک نوین', 'بانک سینا', 'پست بانک', 'بانک توسعه تعاون', 'بانک شهر', 'بانک دی', 'بانک انصار', 'بانک سرمایه', 'بانک ایران زمین', 'بانک گردشگری', 'بانک خاورمیانه', 'بانک آینده', 'بانک رسالت'];

export type InventoryMovementType =
  | 'GOODS_RECEIPT'          // رسید ورود کالا (خرید)
  | 'GOODS_ISSUE'            // حواله خروج کالا (فروش)
  | 'INTERNAL_TRANSFER'      // انتقال بین انبارها
  | 'INVENTORY_ADJUSTMENT'   // تعدیل انبار
  | 'PRODUCTION_CONSUMPTION' // مصرف تولید (مواد اولیه)
  | 'PRODUCTION_OUTPUT'      // خروجی تولید (محصول نهایی)
  | 'RETURN_RECEIPT'         // رسید برگشت از فروش
  | 'RETURN_ISSUE';          // حواله برگشت از خرید

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  description?: string;
  isActive: boolean;
}

export interface StockTransaction {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  quantity: number; // Signed (positive for additions, negative for subtractions)
  date: string;
  referenceId: string;
  referenceType: 'VOUCHER' | 'INVOICE' | 'ADJUSTMENT' | 'MANUAL';
  description?: string;
  timestamp: number;
}

export interface InventoryAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  referenceId?: string;
}

