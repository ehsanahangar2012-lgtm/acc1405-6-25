import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Person, Product, Invoice, Check, Voucher, CompanyProfile, SystemConfig, AppUser, ModulePermission, Role, UserPermissions, Transaction, CheckTransfer, LogisticsProfile, Salary, InvoiceType, Notification, OfflineOperation, Contract } from './types';
import { generateId, getPersianDate, generateTrackingCode, toPersianDigits, downloadJSON } from './utils';
import { ImportBatch, ImportMappingConfig } from './types-import';
import { backupService } from './services/backupService';
import { autoBackupService } from './services/autoBackupService';
import { backupMigrationService } from './services/backupMigrationService';
import { securityService } from './services/securityService';
import { realConnectionService } from './services/realConnectionService';
import { hostDB } from './services/hostDatabaseService';
import { auditTrail } from './services/auditTrailService';
import { rbacService, PREDEFINED_ROLES } from './services/rbacService';
import { AccountingEngine } from './services/accountingEngine';
import { useFinancialStore } from './store-financial';
import PersonLedgerService from './services/personLedgerService';
import { dataBridge } from './services/dataBridge';
import { idbService } from './services/indexedDBService';
import { persistentStorage } from './services/persistentStorage';
import { deletedRecordsRegistry } from './services/deletedRecordsRegistry';
import { licenseQuotaService } from './services/licenseQuotaService';
import { desktopDatabaseService } from './services/desktopDatabaseService';
import { APP_VERSION } from './config';
import { isNativeAndroidSecureStorage, getAndroidEncryptedItem, setAndroidEncryptedItem, removeAndroidEncryptedItem } from './services/androidSecureStorage';
import { hasNativeBackupStorage } from './services/nativeBackupStorage';
async function localStorageRemoveLegacy(name: string): Promise<void> {
    try {
        localStorage.removeItem(name);
        localStorage.removeItem('ashke-ghalam-rbac-v14-accounting');
        localStorage.removeItem('ashke-ghalam-currency');
    } catch {}
}


const emptyPerm = (val: boolean = false): ModulePermission => ({ view: val, create: val, edit: val, delete: val });

const fullPermissions = (): UserPermissions => ({
    dashboard: emptyPerm(true), invoices: emptyPerm(true), inventory: emptyPerm(true),
    checks: emptyPerm(true), finance: emptyPerm(true), customers: emptyPerm(true),
    reports: emptyPerm(true),
    settings: emptyPerm(true), users: emptyPerm(true)
});

// Prefer immutable product IDs; names are only a legacy fallback and may be duplicated.
function findInventoryProduct(products: Product[], item: { productId?: string; productName?: string }): Product | undefined {
  if (item.productId) {
    const byId = products.find(product => product.id === item.productId);
    if (byId) return byId;
  }
  return products.find(product => product.name === item.productName);
}

function findInventoryProductIndex(products: Product[], item: { productId?: string; productName?: string }): number {
  if (item.productId) {
    const byId = products.findIndex(product => product.id === item.productId);
    if (byId >= 0) return byId;
  }
  return products.findIndex(product => product.name === item.productName);
}

// Single source of truth for stock movement semantics, including both return directions.
function voucherStockDelta(voucher: Voucher, quantity: number): number {
  if (voucher.type === 'IN') return quantity;
  if (voucher.type === 'OUT') return -quantity;
  return voucher.movementType === 'RETURN_RECEIPT' ? quantity : -quantity;
}

function validateVoucherInventoryChange(
  products: Product[],
  operations: Array<{ voucher: Voucher; multiplier?: 1 | -1 }>,
  validateAfterEachOperation = true
): string | null {
  const projectedStock = new Map<string, number>();
  for (const product of products) {
    const stock = Number(product.stock ?? 0);
    if (!Number.isFinite(stock)) {
      return `موجودی ثبت‌شدهٔ کالای «${product.name}» نامعتبر است؛ ابتدا موجودی کالا را اصلاح کنید.`;
    }
    projectedStock.set(product.id, stock);
  }

  for (const operation of operations) {
    const { voucher, multiplier = 1 } = operation;
    for (const item of voucher.items || []) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `تعداد کالای «${item.productName || 'نامشخص'}» در حواله باید عددی معتبر و بزرگ‌تر از صفر باشد.`;
      }

      const product = findInventoryProduct(products, item);
      if (!product) continue; // Non-catalog items do not have a stock counter here.

      const current = projectedStock.get(product.id) ?? 0;
      const next = current + (voucherStockDelta(voucher, quantity) * multiplier);
      projectedStock.set(product.id, next);
      if (validateAfterEachOperation && next < 0) {
        return `موجودی کالای «${product.name}» کافی نیست. موجودی پس از این حواله به ${next} می‌رسد.`;
      }
    }
  }

  if (!validateAfterEachOperation) {
    for (const product of products) {
      const next = projectedStock.get(product.id) ?? 0;
      if (next < 0) {
        return `این تغییر موجودی کالای «${product.name}» را منفی می‌کند (${next}). ابتدا گردش‌های مرتبط را اصلاح کنید.`;
      }
    }
  }
  return null;
}

const DEFAULT_ROLES: Role[] = [
    { id: 'admin', name: 'مدیر سیستم', description: 'دسترسی کامل به تمام بخش‌ها', permissions: fullPermissions() }
];

interface AppState {
  currentUser: AppUser | null;
  users: AppUser[];
  roles: Role[];
  companies: CompanyProfile[];
  config: SystemConfig;
  products: Product[];
  people: Person[];
  invoices: Invoice[];
  vouchers: Voucher[];
  logisticsProfiles: LogisticsProfile[];
  checks: Check[];
  transactions: Transaction[];
  checkTransfers: CheckTransfer[];
  isOnline: boolean;
  lastVoucherNumber: number;
  lastTransferNumber: number;
  defaultInvoiceFooter: string;
  savedDescriptions: string[];
  salaries: Salary[];
  contracts: Contract[];
  notifications: Notification[];
  offlineQueue: OfflineOperation[];
  lastSyncTime: string | null;
  setOfflineQueue: (queue: OfflineOperation[]) => void;
  
  importConfigs: ImportMappingConfig[];
  importBatches: ImportBatch[];
  addImportConfig: (config: ImportMappingConfig) => void;
  deleteImportConfig: (id: string) => void;
  addImportBatch: (batch: ImportBatch) => void;
  commitImportBatch: (batchId: string, currentUser: any) => void;
  rollbackImportBatch: (batchId: string, currentUser: any) => void;
  
  login: (user: AppUser) => void;
  logout: () => void;
  
  addUser: (user: AppUser) => void;
  updateUser: (id: string, up: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  
  addCompany: (c: CompanyProfile) => void;
  updateCompany: (id: string, up: Partial<CompanyProfile>) => void;
  setActiveCompany: (id: string) => void;
  deleteCompany: (id: string) => void;
  addBranch: (companyId: string, branch: any) => void;
  updateBranch: (companyId: string, branchId: string, up: any) => void;
  deleteBranch: (companyId: string, branchId: string) => void;
  
  addProduct: (p: Product) => void;
  addProducts: (ps: Product[]) => void;
  updateProduct: (id: string, up: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addPerson: (p: Person) => void;
  updatePerson: (id: string, up: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  
  addInvoice: (i: Invoice) => boolean;
  deleteInvoice: (id: string) => void;
  updateInvoice: (id: string, updated: Invoice) => boolean;
  setInvoiceSignature: (id: string, signature: string, role?: 'warehouse' | 'sales' | 'customer' | 'driver') => void;
  
  addCheck: (c: Check, personId?: string) => void;
  updateCheckStatus: (id: string, status: Check['status'], note: string) => void;
  updateCheckImage: (id: string, imageUrl: string) => void;
  updateCheckMetadata: (id: string, meta: Partial<Check>) => void;
  
  addVoucher: (v: Voucher) => void;
  updateVoucher: (id: string, updated: Voucher) => void;
  deleteVoucher: (id: string) => void;
  setVoucherSignature: (id: string, signature: string) => void;
  setVoucherCompanySignature: (id: string, signature: string) => void;
  setVoucherSupervisorSignature: (id: string, signature: string) => void;

  addLogisticsProfile: (lp: LogisticsProfile) => void;
  deleteLogisticsProfile: (id: string) => void;
  
  addGeneralFinance: (type: 'INCOME' | 'EXPENSE', amount: number, desc: string, personId?: string, signature?: string, relatedInvoiceId?: string, receiptImage?: string) => Transaction;
  addInvoicePayment: (invoiceId: string, payment: {
      amount: number;
      date: string;
      method: 'CASH' | 'POS' | 'CARD' | 'CHECK';
      description?: string;
      trackingCode?: string;
      checkDetails?: {
          bankName: string;
          checkNumber: string;
          sayadId?: string;
          dueDate: string;
      };
  }) => Transaction | null;
  deleteTransaction: (id: string) => void;
  addSalary: (s: Salary) => void;
  
  addContract: (c: Contract) => void;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  setContractSignature: (id: string, signature: string, role?: 'company' | 'person') => void;
  
  addCheckTransfer: (t: CheckTransfer) => void;
  updateCheckTransfer: (id: string, updates: Partial<CheckTransfer>) => void;
  deleteCheckTransfer: (id: string) => void;
  
  addSavedDescription: (desc: string) => void;
  removeSavedDescription: (index: number) => void;
  updateConfig: (up: Partial<SystemConfig>) => void;
  setOnlineStatus: (s: boolean) => void;
  hydrateStore: (data: Partial<AppState>) => void;
  exportBackup: () => void;
  
  addNotification: (type: Notification['type'], message: string, title?: string, category?: Notification['category']) => void;
  removeNotification: (id: string) => void;
  addOfflineOperation: (operation: OfflineOperation) => void;
  processOfflineQueue: () => Promise<void>;
  clearOfflineQueue: () => void;
  updateLastSyncTime: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      // Expose the store only during local development for debugging.
      // Production renderers must not receive a write-capable global state handle.
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        (window as any).__ZUSTAND_STORE__ = { getState: get, setState: set };
      }

      // ارسال درخواست فول بک‌آپ خودکار به هاست در شاخه backup با سقف ۱۰ فایل
      const triggerAutoBackup = (reason: string) => {
        setTimeout(() => {
          try {
            autoBackupService.triggerFullAutoBackup(get(), reason);
          } catch (e) {
            console.warn('Auto backup trigger error:', e);
          }
        }, 300);
      };
      
      return {
      currentUser: null,
      // Fresh installations require the owner to create an administrator account.
      users: [],
      roles: PREDEFINED_ROLES as any,
      companies: [{ 
          id: 'default', 
          name: 'اشک قلم', 
          legalName: 'شرکت فناوری و حسابداری اشک قلم',
          economicCode: '411456789012',
          nationalId: '14008765432',
          registrationNumber: '542109',
          postalCode: '1458963214',
          address: 'تهران، خیابان ولیعصر، برج فناوری، طبقه ۴', 
          phone: '۰۲۱-۸۸۸۸۸۸۸۸', 
          isActive: true,
          branches: [
              {
                  id: 'branch-central',
                  companyId: 'default',
                  name: 'شعبه مرکزی',
                  code: '101',
                  phone: '۰۲۱-۸۸۸۸۸۸۸۸',
                  address: 'تهران، خیابان ولیعصر، برج فناوری، طبقه ۴',
                  managerName: 'مدیریت مرکزی',
                  isDefault: true
              }
          ]
      }],
      config: { 
          currency: 'RIAL', 
          showDecimal: false, 
          cloudEnabled: false, 
          cloudProvider: 'HOST', 
          syncInterval: 30,
          dateFormat: 'JALALI',
          defaultTaxRate: 9,
          defaultInvoiceFooter: "کالا صحیح و سالم تحویل گردید.",
          invoiceDueDays: 7,
          appTheme: 'DARK',
          uiScale: 100,
          smsPanelEnabled: false
      },
      products: [],
      people: [],
      invoices: [],
      vouchers: [],
      logisticsProfiles: [],
      checks: [],
      transactions: [],
      checkTransfers: [],
      salaries: [],
      contracts: [],
      notifications: [],
      offlineQueue: [],
      lastSyncTime: null,
      isOnline: true, // شروع با true، سرویس realConnection آن را بروز میکند
      importConfigs: [
        {
          id: 'def-receipt',
          name: 'الگوی پیش‌فرض رسید ورود کالا (GOODS_RECEIPT)',
          voucherType: 'GOODS_RECEIPT',
          itemsPath: 'items',
          rootMapping: {
            number: 'document_number',
            trackingCode: 'tracking_code',
            date: 'date',
            time: 'time',
            personName: 'person_name',
            supervisor: 'supervisor',
            vehicleNumber: 'vehicle_number',
            receiverPhone: 'receiver_phone',
            notes: 'notes'
          },
          itemMapping: {
            productName: 'product_name',
            quantity: 'qty',
            unit: 'unit',
            weight: 'weight',
            shelfLocation: 'shelf_location',
            description: 'description'
          }
        },
        {
          id: 'def-issue',
          name: 'الگوی پیش‌فرض حواله خروج کالا (GOODS_ISSUE)',
          voucherType: 'GOODS_ISSUE',
          itemsPath: 'items',
          rootMapping: {
            number: 'document_number',
            trackingCode: 'tracking_code',
            date: 'date',
            time: 'time',
            personName: 'person_name',
            supervisor: 'supervisor',
            vehicleNumber: 'vehicle_number',
            receiverPhone: 'receiver_phone',
            notes: 'notes'
          },
          itemMapping: {
            productName: 'product_name',
            quantity: 'qty',
            unit: 'unit',
            weight: 'weight',
            shelfLocation: 'shelf_location',
            description: 'description'
          }
        }
      ],
      importBatches: [],
      lastVoucherNumber: 1000,
      lastTransferNumber: 100,
      defaultInvoiceFooter: "کالا صحیح و سالم تحویل گردید و حق هرگونه اعتراض بعدی سلب شد.",
      savedDescriptions: ["تحویل درب انبار می‌باشد.", "کالا صحیح و سالم تحویل گردید."],

      addNotification: (type, message, title, category) => set(s => ({
          notifications: [...s.notifications, {
              id: generateId(),
              type,
              message,
              title,
              category,
              timestamp: getPersianDate()
          }]
      })),
      removeNotification: (id) => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),

      addOfflineOperation: (operation) => set(s => ({ offlineQueue: [...s.offlineQueue, operation] })),
      processOfflineQueue: async () => {
        const { offlineQueue, config } = get();
        if (!config.cloudEnabled || offlineQueue.length === 0) return;
        
        try {
          for (const op of offlineQueue) {
            // Process each operation
            console.log('Processing offline operation:', op);
          }
          set({ offlineQueue: [], lastSyncTime: new Date().toLocaleString('fa-IR') });
        } catch (error) {
          console.error('Offline sync failed:', error);
        }
      },
      clearOfflineQueue: () => set({ offlineQueue: [] }),
      updateLastSyncTime: () => set({ lastSyncTime: new Date().toLocaleString('fa-IR') }),
      setOfflineQueue: (queue) => set({ offlineQueue: queue }),

      login: (user) => {
          const perms = { ...fullPermissions(), ...user.permissions };
          sessionStorage.setItem('auth_token', Date.now().toString());
          
          // ثبت در Audit Trail
          auditTrail.log(user.id, user.fullName, 'LOGIN', 'user', user.id, undefined, undefined, 'LOW').catch(() => {});
          
          set({ currentUser: { ...user, permissions: perms } });
      },
      logout: () => {
          const { currentUser } = get();
          if (currentUser) {
              auditTrail.log(currentUser.id, currentUser.fullName, 'LOGOUT', 'user', currentUser.id, undefined, undefined, 'LOW').catch(() => {});
          }
          set({ currentUser: null });
      },
      
      addUser: (user) => set(s => {
          const alreadyExists = s.users.some(existing =>
              existing.id === user.id ||
              String(existing.username || '').trim().toLowerCase() === String(user.username || '').trim().toLowerCase()
          );
          if (!alreadyExists) {
              const quotaCheck = licenseQuotaService.canAddUser(s.users.length);
              if (!quotaCheck.allowed) {
                  return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف کاربران نسخه فعلی تکمیل شده است.' }] };
              }
          }
          const { password, ...rest } = user;
          const hashedPassword = password
              ? securityService.hashPasswordV2(password)
              : (user.hashedPassword || '');
          const stampedUser = { ...rest, hashedPassword, updatedAt: new Date().toISOString() };
          delete (stampedUser as any).password;
          const newUsers = [...s.users.filter(u => u.id !== user.id && u.username !== user.username), stampedUser];
          persistentStorage.saveData('users', newUsers).catch(() => {});
          return { users: newUsers };
      }),
      updateUser: (id, up) => set(s => {
          const { password, ...rest } = up;
          const updateObj = { ...rest } as any;
          if (password) updateObj.hashedPassword = securityService.hashPasswordV2(password);
          updateObj.updatedAt = new Date().toISOString();
          const updatedUsers = s.users.map(u => {
              if (u.id !== id) return u;
              const updated = { ...u, ...updateObj } as any;
              delete updated.password;
              return updated;
          });
          persistentStorage.saveData('users', updatedUsers).catch(() => {});
          return { users: updatedUsers };
      }),
      deleteUser: (id) => set(s => {
          deletedRecordsRegistry.registerDeletion(id, 'user');
          const filtered = s.users.filter(u => u.id !== id);
          persistentStorage.saveData('users', filtered).catch(() => {});
          hostDB.deleteFromHost('users', id).catch(() => {});
          return { users: filtered };
      }),

      addCompany: (c) => set(s => {
          const stamped = { ...c, updatedAt: new Date().toISOString() };
          dataBridge.save('companies', stamped);
          persistentStorage.saveData('companies', [...s.companies, stamped]).catch(() => {});
          triggerAutoBackup(`ثبت شرکت ${c.name}`);
          return { companies: [...s.companies, stamped] };
      }),
      updateCompany: (id, up) => set(s => {
          const updated = s.companies.map(c => c.id === id ? {...c, ...up, updatedAt: new Date().toISOString()} : c);
          const company = updated.find(c => c.id === id);
          if (company) {
              hostDB.save('companies', company).catch(() => {});
              persistentStorage.saveData('companies', updated).catch(() => {});
          }
          triggerAutoBackup(`ویرایش مشخصات شرکت ${company?.name || ''}`);
          return { companies: updated };
      }),
      setActiveCompany: (id) => set(s => {
          const updated = s.companies.map(c => ({...c, isActive: c.id === id}));
          backupService.backupData('companies', updated).catch(() => {});
          persistentStorage.saveData('companies', updated).catch(() => {});
          triggerAutoBackup('تغییر شعبه فعال شرکت');
          return { companies: updated };
      }),
      deleteCompany: (id) => set(s => {
          deletedRecordsRegistry.registerDeletion(id, 'company');
          const filtered = s.companies.filter(c => c.id !== id);
          triggerAutoBackup('حذف شرکت');
          
          // اگر شعبه فعال حذف شد، اولین شعبه باقیمانده را فعال کن
          const wasActive = s.companies.find(c => c.id === id)?.isActive;
          if (wasActive && filtered.length > 0) {
              filtered[0].isActive = true;
          }
          
          persistentStorage.saveData('companies', filtered).catch(() => {});
          hostDB.deleteFromHost('companies', id).catch(() => {});
          return { companies: filtered };
      }),
      addBranch: (companyId, branch) => set(s => {
          const updated = s.companies.map(c => {
              if (c.id === companyId) {
                  const branches = c.branches || [];
                  return { ...c, branches: [...branches, branch], updatedAt: new Date().toISOString() };
              }
              return c;
          });
          persistentStorage.saveData('companies', updated).catch(() => {});
          return { companies: updated };
      }),
      updateBranch: (companyId, branchId, up) => set(s => {
          const updated = s.companies.map(c => {
              if (c.id === companyId) {
                  const branches = (c.branches || []).map(b => b.id === branchId ? { ...b, ...up } : b);
                  return { ...c, branches, updatedAt: new Date().toISOString() };
              }
              return c;
          });
          persistentStorage.saveData('companies', updated).catch(() => {});
          return { companies: updated };
      }),
      deleteBranch: (companyId, branchId) => set(s => {
          const updated = s.companies.map(c => {
              if (c.id === companyId) {
                  const branches = (c.branches || []).filter(b => b.id !== branchId);
                  return { ...c, branches, updatedAt: new Date().toISOString() };
              }
              return c;
          });
          persistentStorage.saveData('companies', updated).catch(() => {});
          return { companies: updated };
      }),

      addProduct: (p) => set(s => {
          if (s.products.some(prod => prod.name === p.name || (p.code && prod.code === p.code))) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `خطا: کالایی با نام "${p.name}" یا کد مشابه از قبل وجود دارد.` }] };
          }
          const product = { ...p, reservedStock: p.reservedStock || 0, updatedAt: new Date().toISOString() };
          const updated = [...s.products, product];
          dataBridge.save('products', product);
          persistentStorage.saveData('products', updated).catch(() => {});
          return { products: updated, notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'کالا با موفقیت ثبت شد.' }] };
      }),
      addProducts: (ps) => set(s => {
          const stamped = ps.map(p => ({ ...p, reservedStock: p.reservedStock || 0, updatedAt: new Date().toISOString() }));
          const updated = [...s.products, ...stamped];
          persistentStorage.saveData('products', updated).catch(() => {});
          return { products: updated };
      }),
      updateProduct: (id, up) => set(s => {
          const updated = s.products.map(p => p.id === id ? {...p, ...up, updatedAt: new Date().toISOString()} : p);
          const prod = updated.find(p => p.id === id);
          if (prod) {
              hostDB.save('products', prod).catch(() => {});
              persistentStorage.saveData('products', updated).catch(() => {});
          }
          return { products: updated };
      }),
      deleteProduct: (id) => set(s => {
          deletedRecordsRegistry.registerDeletion(id, 'product');
          const filtered = s.products.filter(p => p.id !== id);
          hostDB.deleteFromHost('products', id).catch(() => {});
          persistentStorage.saveData('products', filtered).catch(() => {});
          return { products: filtered };
      }),
      addPerson: (p) => set(s => {
          const quotaCheck = licenseQuotaService.canAddPerson(s.people.length);
          if (!quotaCheck.allowed) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف نسخه پایه (۲۰ مشتری) پر شده است.' }] };
          }
          if (s.people.some(per => per.name === p.name || (p.code && per.code === p.code))) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `خطا: طرف حسابی با نام "${p.name}" یا کد مشابه از قبل وجود دارد.` }] };
          }
          const stamped = { ...p, updatedAt: new Date().toISOString() };
          const updated = [...s.people, stamped];
          dataBridge.save('people', stamped);
          persistentStorage.saveData('people', updated).catch(() => {});
          return { people: updated, notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'طرف حساب با موفقیت ثبت شد.' }] };
      }),
      updatePerson: (id, up) => set(s => {
          const updated = s.people.map(p => p.id === id ? {...p, ...up, updatedAt: new Date().toISOString()} : p);
          const per = updated.find(p => p.id === id);
          if (per) {
              hostDB.save('people', per).catch(() => {});
              persistentStorage.saveData('people', updated).catch(() => {});
          }
          return { people: updated };
      }),
      deletePerson: (id) => set(s => {
          deletedRecordsRegistry.registerDeletion(id, 'person');
          const filtered = s.people.filter(p => p.id !== id);
          hostDB.deleteFromHost('people', id).catch(() => {});
          persistentStorage.saveData('people', filtered).catch(() => {});
          return { 
              people: filtered,
              transactions: s.transactions.filter(t => t.personId !== id)
          };
      }),

      addInvoice: (i) => {
          let saved = false;
          set(s => {
          if (s.currentUser && !s.currentUser.permissions.invoices.create) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز ثبت فاکتور را ندارید.' }] };
          }
          const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
          const quotaCheck = licenseQuotaService.canAddDocument(totalDocs);
          if (!quotaCheck.allowed) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف نسخه پایه (۲۰۰ سند) پر شده است.' }] };
          }
          const updated = [...s.invoices, i];

          // فاکتور تنها پس از ثبت موفق سند حسابداری پذیرفته و ذخیره می‌شود.
          try {
              AccountingEngine.postInvoice(i);
          } catch (err) {
              console.error('AccountingEngine error in addInvoice:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return {
                  notifications: [...s.notifications, {
                      id: generateId(),
                      type: 'error',
                      message: `ثبت فاکتور انجام نشد: ${reason}`
                  }]
              };
          }

          hostDB.save('invoices', i).catch(() => {});
          
          let newTransactions = [...s.transactions];
          const personIndex = s.people.findIndex(p => p.id === i.personId);
          let updatedPeople = [...s.people];
          
          if (personIndex !== -1 && i.type !== InvoiceType.PROFORMA) {
              newTransactions.push({
                  id: generateId(),
                  date: i.date,
                  type: i.type === InvoiceType.SALE ? 'INVOICE_SALE' : 'INVOICE_PURCHASE',
                  amount: i.finalTotal,
                  personId: i.personId,
                  personName: i.personName,
                  description: `فاکتور ${i.type} شماره ${i.number}`,
                  balanceAfter: 0,
                  isDebit: i.type === InvoiceType.SALE,
                  referenceId: i.id,
                  trackingCode: i.trackingCode
              });

              if (i.cashAmount > 0) {
                  newTransactions.push({
                      id: generateId(),
                      date: i.date,
                      type: 'CASH_PAYMENT',
                      amount: i.cashAmount,
                      personId: i.personId,
                      personName: i.personName,
                      description: `دریافت نقدی بابت فاکتور ${i.number}`,
                      balanceAfter: 0,
                      isDebit: i.type !== InvoiceType.SALE,
                      referenceId: i.id,
                      relatedInvoiceId: i.id,
                      trackingCode: 'CSH-' + i.number
                  });
              }

              if (i.checkAmount > 0 && i.checks && i.checks.length > 0) {
                  const checkNumbers = i.checks.map(c => c.checkNumber || c.sayadId || 'چک').join('، ');
                  newTransactions.push({
                      id: generateId(),
                      date: i.date,
                      type: 'CHECK_INFO',
                      amount: i.checkAmount,
                      personId: i.personId,
                      personName: i.personName,
                      description: `چک ${checkNumbers} - محاسبه شده در فاکتور ${i.number}`,
                      balanceAfter: 0,
                      isDebit: i.type !== InvoiceType.SALE,
                      referenceId: i.id,
                      relatedInvoiceId: i.id,
                      trackingCode: 'CHK-' + i.number,
                      metadata: { calculatedInInvoice: true, invoiceNumber: i.number }
                  });
              }

              // محاسبه دقیق و بلادرنگ مانده حساب شخص پس از ثبت این فاکتور
              const exactBalance = PersonLedgerService.getBalance(i.personId, updated, newTransactions, s.checks);
              updatedPeople[personIndex] = {
                  ...updatedPeople[personIndex],
                  balance: exactBalance
              };
              newTransactions.forEach(t => {
                  if (t.referenceId === i.id || t.relatedInvoiceId === i.id) {
                      t.balanceAfter = exactBalance;
                  }
              });
          }

          const invoiceChecks = (i.checks || []).map(check => ({
              ...check,
              personId: i.personId,
              personName: i.personName,
              relatedInvoiceId: i.id
          }));
          const updatedChecks = [
              ...s.checks.filter(existing => !invoiceChecks.some(check => check.id === existing.id)),
              ...invoiceChecks
          ];
          invoiceChecks.forEach(check => hostDB.save('checks', check).catch(() => {}));
          persistentStorage.saveData('checks', updatedChecks).catch(() => {});

          saved = true;
          triggerAutoBackup(`ثبت فاکتور ${i.number}`);
          return { 
              invoices: updated, 
              checks: updatedChecks,
              people: updatedPeople,
              transactions: newTransactions,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'فاکتور و تراکنش‌های مالی ثبت شد.' }]
          };
          });
          return saved;
      },

      deleteInvoice: (id) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.invoices.delete) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز حذف فاکتور را ندارید.' }] };
          }
          const inv = s.invoices.find(v => v.id === id);
          if (!inv) return {};

          const relatedTrans = s.transactions.filter(t => t.referenceId === id || t.relatedInvoiceId === id);

          // Reverse invoice-day entries and every linked payment journal atomically.
          try {
              AccountingEngine.reverseInvoiceAndPayments(inv, relatedTrans);
          } catch (err) {
              console.error('AccountingEngine error in deleteInvoice:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return {
                  notifications: [...s.notifications, {
                      id: generateId(),
                      type: 'error',
                      message: `ابطال فاکتور انجام نشد؛ فاکتور حفظ شد: ${reason}`
                  }]
              };
          }

          deletedRecordsRegistry.registerDeletion(id, 'invoice');
          if (s.currentUser) {
              auditTrail.log(s.currentUser.id, s.currentUser.fullName, 'DELETE', 'invoice', id, inv, undefined, 'HIGH').catch(() => {});
          }
          hostDB.deleteFromHost('invoices', id).catch(() => {});
          const nextInvoices = s.invoices.filter(v => v.id !== id);
          persistentStorage.saveData('invoices', nextInvoices).catch(() => {});

          if (inv.personId) {
              PersonLedgerService.removeByReference(inv.personId, id);
          }
          // سند اصلی فاکتور پس از حذف، دیگر از آرایه فاکتورها محاسبه نمی‌شود؛
          // پس برگشت جداگانه‌ی تراکنش نوع فاکتور، مانده را دوباره معکوس می‌کند.
          const reversalTransactions = relatedTrans
              .filter(t => t.type !== 'INVOICE_SALE' && t.type !== 'INVOICE_PURCHASE' && t.type !== 'REVERSAL')
              .map(t => ({
              id: generateId(),
              date: getPersianDate(),
              type: 'REVERSAL',
              amount: t.amount,
              personId: t.personId,
              personName: t.personName,
              description: `[اصلاحی - برگشتی] بابت ${t.description}`,
              balanceAfter: 0,
              isDebit: !t.isDebit,
              referenceId: id,
              trackingCode: 'REV-' + (t.trackingCode || '')
          }));

          const nextTransactions = [...s.transactions, ...reversalTransactions];
          const exactBalance = inv.personId ? PersonLedgerService.getBalance(inv.personId, nextInvoices, nextTransactions, s.checks) : 0;
          reversalTransactions.forEach(t => t.balanceAfter = exactBalance);
          const updatedPeople = s.people.map(p => p.id === inv.personId ? { ...p, balance: exactBalance } : p);

          triggerAutoBackup(`ابطال فاکتور ${inv.number}`);
          return { 
              invoices: nextInvoices, 
              transactions: nextTransactions,
              people: updatedPeople,
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: 'فاکتور ابطال و سند اصلاحی صادر شد.' }] 
          };
      }),

      updateInvoice: (id, updated) => {
          let saved = false;
          set(s => {
          if (s.currentUser && !s.currentUser.permissions.invoices.edit) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز ویرایش فاکتور را ندارید.' }] };
          }
          
          const oldInvoice = s.invoices.find(v => v.id === id);
          if (!oldInvoice) return {};
          // The editor may omit payment history and other metadata; merge with the stored record.
          const finalUpdated = { ...oldInvoice, ...updated, id };
          const separatelyPostedPaymentIds = new Set(
              (finalUpdated.payments || []).filter(payment => payment.accountingPosted === true).map(payment => payment.id)
          );
          const separatelyPostedCash = (finalUpdated.payments || [])
              .filter(payment => payment.accountingPosted === true && payment.method !== 'CHECK')
              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const separatelyPostedChecks = (finalUpdated.payments || [])
              .filter(payment => payment.accountingPosted === true && payment.method === 'CHECK')
              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const embeddedCashAmount = Math.max(0, Number(finalUpdated.cashAmount || 0) - separatelyPostedCash);
          const embeddedCheckAmount = Math.max(0, Number(finalUpdated.checkAmount || 0) - separatelyPostedChecks);
          const nextInvoices = s.invoices.map(v => v.id === id ? finalUpdated : v);

          // Cache cleanup is intentionally deferred until accounting succeeds.
          // If posting fails, the previous invoice and its cached ledger must remain intact.
          const affectedPersonIds = new Set<string>();
          if (oldInvoice?.personId) affectedPersonIds.add(oldInvoice.personId);
          if (finalUpdated?.personId) affectedPersonIds.add(finalUpdated.personId);

          // ویرایش فقط پس از ثبت موفق سند حسابداری ادامه پیدا می‌کند.
          try {
              AccountingEngine.postInvoice(finalUpdated);
          } catch (err) {
              console.error('AccountingEngine error in updateInvoice:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return {
                  notifications: [...s.notifications, {
                      id: generateId(),
                      type: 'error',
                      message: `ویرایش فاکتور انجام نشد؛ اطلاعات قبلی حفظ شد: ${reason}`
                  }]
              };
          }

          // Invalidate transient invoice previews only after accounting posting succeeds.
          if (typeof sessionStorage !== 'undefined') {
              try {
                  sessionStorage.removeItem(`invoice_preview_${id}`);
                  sessionStorage.removeItem(`invoice_${id}`);
              } catch {}
          }

          // Rebuild invoice-day summary rows, but keep actual dated payment transactions.
          const filteredTransactions = s.transactions.filter(t => {
              if (t.referenceId !== id && t.relatedInvoiceId !== id) return true;
              return separatelyPostedPaymentIds.has(t.id);
          });
          const newTransList: Transaction[] = [];

          if (finalUpdated.personId && finalUpdated.type !== InvoiceType.PROFORMA) {
              newTransList.push({
                  id: generateId(),
                  date: finalUpdated.date,
                  type: finalUpdated.type === InvoiceType.SALE ? 'INVOICE_SALE' : 'INVOICE_PURCHASE',
                  amount: finalUpdated.finalTotal,
                  personId: finalUpdated.personId,
                  personName: finalUpdated.personName,
                  description: `فاکتور ${finalUpdated.type === InvoiceType.SALE ? 'فروش' : 'خرید'} شماره ${finalUpdated.number}`,
                  balanceAfter: 0,
                  isDebit: finalUpdated.type === InvoiceType.SALE,
                  referenceId: finalUpdated.id,
                  trackingCode: finalUpdated.trackingCode
              });

              if (embeddedCashAmount > 0) {
                  newTransList.push({
                      id: generateId(),
                      date: finalUpdated.date,
                      type: 'CASH_PAYMENT',
                      amount: embeddedCashAmount,
                      personId: finalUpdated.personId,
                      personName: finalUpdated.personName,
                      description: `دریافت نقدی بابت فاکتور ${finalUpdated.number}`,
                      balanceAfter: 0,
                      isDebit: finalUpdated.type !== InvoiceType.SALE,
                      referenceId: finalUpdated.id,
                      relatedInvoiceId: finalUpdated.id,
                      trackingCode: 'CSH-' + finalUpdated.number
                  });
              }

              if (embeddedCheckAmount > 0) {
                  const checkNumbers = finalUpdated.checks?.map(c => c.checkNumber || c.sayadId || 'چک').join('، ') || 'چک';
                  newTransList.push({
                      id: generateId(),
                      date: finalUpdated.date,
                      type: 'CHECK_INFO',
                      amount: embeddedCheckAmount,
                      personId: finalUpdated.personId,
                      personName: finalUpdated.personName,
                      description: `چک ${checkNumbers} - محاسبه شده در فاکتور ${finalUpdated.number}`,
                      balanceAfter: 0,
                      isDebit: finalUpdated.type !== InvoiceType.SALE,
                      referenceId: finalUpdated.id,
                      relatedInvoiceId: finalUpdated.id,
                      trackingCode: 'CHK-' + finalUpdated.number,
                      metadata: { calculatedInInvoice: true, invoiceNumber: finalUpdated.number }
                  });
              }
          }

          const nextTransactions = [...filteredTransactions, ...newTransList];

          // محاسبه دقیق مانده حساب با استفاده از آرایه‌های جدید
          const updatedPeople = s.people.map(p => {
              if (affectedPersonIds.has(p.id)) {
                  const exactBal = PersonLedgerService.getBalance(p.id, nextInvoices, nextTransactions);
                  return { ...p, balance: exactBal };
              }
              return p;
          });

          // تنظیم مانده بعد از تراکنش روی اقلام ثبت‌شده
          if (finalUpdated.personId) {
              const exactBal = PersonLedgerService.getBalance(finalUpdated.personId, nextInvoices, nextTransactions);
              newTransList.forEach(t => t.balanceAfter = exactBal);
          }

          const invoiceChecks = (finalUpdated.checks || []).map(check => ({
              ...check,
              personId: finalUpdated.personId,
              personName: finalUpdated.personName,
              relatedInvoiceId: id
          }));
          const nextChecks = [
              ...s.checks.filter(existing => !invoiceChecks.some(check => check.id === existing.id)),
              ...invoiceChecks
          ];
          invoiceChecks.forEach(check => hostDB.save('checks', check).catch(() => {}));
          persistentStorage.saveData('checks', nextChecks).catch(() => {});
          hostDB.save('invoices', finalUpdated).catch(() => {});
          persistentStorage.saveData('invoices', nextInvoices).catch(() => {});
          persistentStorage.saveData('people', updatedPeople).catch(() => {});
          persistentStorage.saveData('transactions', nextTransactions).catch(() => {});

          saved = true;
          triggerAutoBackup(`ویرایش فاکتور ${finalUpdated.number}`);
          return { 
              invoices: nextInvoices, 
              checks: nextChecks,
              transactions: nextTransactions,
              people: updatedPeople,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'فاکتور با موفقیت اصلاح شد؛ سند قبلی ابطال و سند جدید جایگزین شد.' }] 
          };
          });
          return saved;
      },

      setInvoiceSignature: (id, signature, role = 'customer') => set(s => {
          const updated = s.invoices.map(inv => inv.id === id ? { 
              ...inv, 
              workflowSignatures: { 
                  ...(inv.workflowSignatures || {}), 
                  [role]: signature 
              },
              signature: role === 'customer' ? signature : inv.signature 
          } : inv);
          
          const changedInv = updated.find(inv => inv.id === id);
          if (changedInv) {
              hostDB.save('invoices', changedInv).catch(() => {});
              persistentStorage.saveData('inv_' + id, changedInv).catch(() => {});
          }

          return { invoices: updated };
      }),

      addCheck: (c, personId) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.checks.create) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز ثبت چک را ندارید.' }] };
          }
          const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
          const quotaCheck = licenseQuotaService.canAddDocument(totalDocs);
          if (!quotaCheck.allowed) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف نسخه پایه (۲۰۰ سند) پر شده است.' }] };
          }
          const targetPersonId = personId || c.personId;
          try {
              AccountingEngine.postCheck(c, targetPersonId);
          } catch (err) {
              console.error('AccountingEngine error in addCheck:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `ثبت چک انجام نشد؛ اطلاعات قبلی حفظ شد: ${reason}` }] };
          }

          hostDB.save('checks', {...c, personId: targetPersonId}).catch(() => {});
          const exactBalance = targetPersonId ? PersonLedgerService.getBalance(targetPersonId) : 0;
          const updatedPeople = s.people.map(p => p.id === targetPersonId ? { ...p, balance: exactBalance } : p);

          triggerAutoBackup(`ثبت چک ${c.checkNumber || c.sayadId || ''}`);
          return { 
              checks: [...s.checks, {...c, personId: targetPersonId}],
              people: updatedPeople,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'چک ثبت و سند حسابداری صادر شد.' }]
          };
      }),

      updateCheckStatus: (id, status, note) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.checks.edit) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز تغییر وضعیت چک را ندارید.' }] };
          }
          const check = s.checks.find(c => c.id === id);
          if (!check) return {};

          try {
              AccountingEngine.postCheckStatusChange(check, status);
          } catch (err) {
              console.error('AccountingEngine error in updateCheckStatus:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `تغییر وضعیت چک ثبت نشد؛ وضعیت قبلی حفظ شد: ${reason}` }] };
          }

          const targetPersonId = check.personId;
          const exactBalance = targetPersonId ? PersonLedgerService.getBalance(targetPersonId) : 0;
          const updatedPeople = s.people.map(p => p.id === targetPersonId ? { ...p, balance: exactBalance } : p);

          const updatedCheck = { ...check, status };
          hostDB.save('checks', updatedCheck).catch(() => {});
          persistentStorage.saveData('checks', s.checks.map(c => c.id === id ? updatedCheck : c)).catch(() => {});

          triggerAutoBackup(`تغییر وضعیت چک ${check.checkNumber || ''}`);
          return { 
              checks: s.checks.map(c => c.id === id ? { ...c, status } : c),
              people: updatedPeople,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: `وضعیت چک تغییر یافت و سند حسابداری صادر شد: ${status}` }]
          };
      }),
      
      updateCheckImage: (id, imageUrl) => set(s => {
          const updatedChecks = s.checks.map(c => c.id === id ? { ...c, imageUrl } : c);
          const changed = updatedChecks.find(c => c.id === id);
          if (changed) {
              hostDB.save('checks', changed).catch(() => {});
              persistentStorage.saveData('checks', updatedChecks).catch(() => {});
          }
          triggerAutoBackup(`تصویر چک ${id}`);
          return { checks: updatedChecks, notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'تصویر چک بروزرسانی شد.' }] };
      }),
      updateCheckMetadata: (id, meta) => set(s => {
          const updatedChecks = s.checks.map(c => c.id === id ? { ...c, ...meta } : c);
          const changed = updatedChecks.find(c => c.id === id);
          if (changed) {
              hostDB.save('checks', changed).catch(() => {});
              persistentStorage.saveData('checks', updatedChecks).catch(() => {});
          }
          triggerAutoBackup(`مشخصات چک ${id}`);
          return { checks: updatedChecks, notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'اطلاعات چک بروزرسانی شد.' }] };
      }),

      addCheckTransfer: (t) => set(s => {
          const updatedChecks = s.checks.map(c => t.checkIds.includes(c.id) ? { ...c, status: 'TRANSFERRED' as const } : c);
          const totalAmount = t.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;
          if (totalAmount > 0) {
              const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
              const quotaCheck = licenseQuotaService.canAddDocument(totalDocs);
              if (!quotaCheck.allowed) {
                  return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف اسناد نسخه فعلی تکمیل شده است؛ واگذاری چک ثبت نشد.' }] };
              }
          }

          try {
              AccountingEngine.postCheckTransfer(t);
          } catch (err) {
              console.error('AccountingEngine error in addCheckTransfer:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `واگذاری چک ثبت نشد؛ اطلاعات قبلی حفظ شد: ${reason}` }] };
          }

          const exactBalance = t.personId ? PersonLedgerService.getBalance(t.personId) : 0;
          const updatedPeople = s.people.map(p => p.id === t.personId ? { ...p, balance: exactBalance } : p);

          let newTransactions = [...s.transactions];

          if (totalAmount > 0) {
              newTransactions.push({
                  id: generateId(),
                  date: t.date,
                  type: 'CHECK_TRANSFER_INFO',
                  amount: totalAmount,
                  personId: t.personId,
                  personName: t.personName,
                  description: `واگذاری ${t.checkIds.length} فقره چک به ${t.personName} (سند ${t.number})`,
                  balanceAfter: exactBalance,
                  isDebit: true,
                  referenceId: t.id,
                  trackingCode: t.trackingCode,
                  metadata: { isTransfer: true, checkCount: t.checkIds.length }
              });
          }

          return { 
              checkTransfers: [...s.checkTransfers, t], 
              lastTransferNumber: Math.max(s.lastTransferNumber, t.number),
              checks: updatedChecks,
              people: updatedPeople,
              transactions: newTransactions,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'سند واگذاری با موفقیت صادر شد.' }]
          };
      }),

      updateCheckTransfer: (id, updates) => set(s => {
          const updated = s.checkTransfers.map(t => t.id === id ? {...t, ...updates} : t);
          const changed = updated.find(t => t.id === id);
          if (changed) {
              hostDB.save('check_transfers', changed).catch(() => {});
              persistentStorage.saveData('check_transfers', updated).catch(() => {});
          }
          return { checkTransfers: updated };
      }),
      
      deleteCheckTransfer: (id) => set(s => {
          const transfer = s.checkTransfers.find(t => t.id === id);
          if (!transfer) return {};

          // Reverse all related accounting entries as one operation before deleting the source record.
          try {
              AccountingEngine.reverseCheckTransfer(transfer);
          } catch (err) {
              console.error('AccountingEngine error in deleteCheckTransfer:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `ابطال واگذاری انجام نشد؛ سند حفظ شد: ${reason}` }] };
          }

          deletedRecordsRegistry.registerDeletion(id, 'checkTransfer');
          hostDB.deleteFromHost('check_transfers', id).catch(() => {});
          persistentStorage.saveData('check_transfers', s.checkTransfers.filter(t => t.id !== id)).catch(() => {});

          const updatedChecks = s.checks.map(c => transfer.checkIds.includes(c.id) ? { ...c, status: 'PENDING' as const } : c);
          const exactBalance = transfer.personId ? PersonLedgerService.getBalance(transfer.personId) : 0;
          const updatedPeople = s.people.map(p => p.id === transfer.personId ? { ...p, balance: exactBalance } : p);

          let totalAmount = transfer.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;
          let newTransactions = [...s.transactions];

          if (totalAmount > 0) {
              newTransactions.push({
                  id: generateId(),
                  date: getPersianDate(),
                  type: 'CHECK_TRANSFER_INFO',
                  amount: totalAmount,
                  personId: transfer.personId,
                  personName: transfer.personName,
                  description: `[اصلاحی - برگشتی] ابطال واگذاری ${transfer.trackingCode}`,
                  balanceAfter: exactBalance,
                  isDebit: false,
                  referenceId: transfer.id,
                  trackingCode: 'REV-' + transfer.trackingCode,
                  metadata: { isReversal: true }
              });
          }

          return { 
              checkTransfers: s.checkTransfers.filter(t => t.id !== id),
              checks: updatedChecks,
              people: updatedPeople,
              transactions: newTransactions,
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: 'سند واگذاری ابطال و سند اصلاحی صادر شد.' }]
          };
      }),

      addVoucher: (v) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.inventory.create) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز ثبت حواله انبار را ندارید.' }] };
          }
          const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
          const createsLedgerInfo = Boolean(v.personId && s.people.some(person => person.id === v.personId));
          const quotaCheck = licenseQuotaService.canAddDocument(totalDocs + (createsLedgerInfo ? 1 : 0));
          if (!quotaCheck.allowed) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: quotaCheck.reason || 'سقف نسخه پایه (۲۰۰ سند) پر شده است.' }] };
          }
          const stockError = validateVoucherInventoryChange(s.products, [{ voucher: v }]);
          if (stockError) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `حواله ثبت نشد: ${stockError}` }] };
          }

          hostDB.save('vouchers', v).catch(() => {});
          let updatedPeople = [...s.people];
          let newTransactions = [...s.transactions];
          
          if (v.personId) {
              const pIndex = updatedPeople.findIndex(p => p.id === v.personId);
              if (pIndex !== -1) {
                  newTransactions.push({
                      id: generateId(),
                      date: v.date,
                      type: 'VOUCHER_INFO',
                      amount: v.estimatedValue || 0,
                      personId: v.personId,
                      personName: v.personName,
                      description: `حواله ${v.type === 'OUT' ? 'خروج' : 'ورود'} انبار ${v.number} (ثبت آماری)`,
                      balanceAfter: updatedPeople[pIndex].balance,
                      isDebit: v.type === 'OUT', 
                      referenceId: v.id,
                      relatedInvoiceId: v.relatedInvoiceId,
                      trackingCode: v.trackingCode,
                      metadata: { items: v.items.map(i => `${i.productName} (${i.quantity})`).join('، ') }
                  });
              }
          }

          // به‌روزرسانی موجودی انبار کالاها
          let updatedProducts = [...s.products];
          v.items.forEach(item => {
              const pIndex = findInventoryProductIndex(updatedProducts, item);
              if (pIndex !== -1) {
                  const change = voucherStockDelta(v, item.quantity);
                  updatedProducts[pIndex] = {
                      ...updatedProducts[pIndex],
                      stock: (updatedProducts[pIndex].stock || 0) + change
                  };
                  hostDB.save('products', updatedProducts[pIndex]).catch(() => {});
              }
          });

          triggerAutoBackup(`ثبت حواله انبار ${v.number}`);
          return { 
              vouchers: [...s.vouchers, v], 
              products: updatedProducts,
              people: updatedPeople,
              transactions: newTransactions,
              lastVoucherNumber: Math.max(s.lastVoucherNumber, v.number), 
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'حواله انبار ثبت و موجودی کالاها به‌روزرسانی شد.' }] 
          };
      }),

      updateVoucher: (id, updated) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.inventory.edit) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز ویرایش حواله انبار را ندارید.' }] };
          }
          const oldVoucher = s.vouchers.find(v => v.id === id);
          if (!oldVoucher) return {};
          const finalUpdated: Voucher = { ...updated, id };

          const stockError = validateVoucherInventoryChange(s.products, [
              { voucher: oldVoucher, multiplier: -1 },
              { voucher: finalUpdated, multiplier: 1 }
          ], false);
          if (stockError) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `ویرایش حواله انجام نشد: ${stockError}` }] };
          }

          let updatedProducts = [...s.products];
          // خنثی کردن تغییرات قدیم
          oldVoucher.items.forEach(item => {
              const pIndex = findInventoryProductIndex(updatedProducts, item);
              if (pIndex !== -1) {
                  const change = -voucherStockDelta(oldVoucher, item.quantity);
                  updatedProducts[pIndex] = {
                      ...updatedProducts[pIndex],
                      stock: (updatedProducts[pIndex].stock || 0) + change
                  };
              }
          });

          // اعمال تغییرات جدید
          finalUpdated.items.forEach(item => {
              const pIndex = findInventoryProductIndex(updatedProducts, item);
              if (pIndex !== -1) {
                  const change = voucherStockDelta(finalUpdated, item.quantity);
                  updatedProducts[pIndex] = {
                      ...updatedProducts[pIndex],
                      stock: (updatedProducts[pIndex].stock || 0) + change
                  };
              }
          });

          // ذخیره محصولات تغییر یافته در هاست
          updatedProducts.forEach(p => {
              hostDB.save('products', p).catch(() => {});
          });
          hostDB.save('vouchers', finalUpdated).catch(() => {});
          const nextVouchers = s.vouchers.map(v => v.id === id ? finalUpdated : v);
          persistentStorage.saveData('products', updatedProducts).catch(() => {});
          persistentStorage.saveData('vouchers', nextVouchers).catch(() => {});

          triggerAutoBackup(`ویرایش حواله انبار ${finalUpdated.number}`);
          return { 
              products: updatedProducts,
              vouchers: nextVouchers,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'حواله انبار ویرایش و موجودی به‌روزرسانی شد.' }]
          };
      }),
      
      deleteVoucher: (id) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.inventory.delete) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز حذف حواله انبار را ندارید.' }] };
          }
          const voucher = s.vouchers.find(x => x.id === id);
          if (!voucher) return {};

          const stockError = validateVoucherInventoryChange(s.products, [
              { voucher, multiplier: -1 }
          ], false);
          if (stockError) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `حذف حواله انجام نشد: ${stockError}` }] };
          }

          deletedRecordsRegistry.registerDeletion(id, 'voucher');
          hostDB.deleteFromHost('vouchers', id).catch(() => {});
          persistentStorage.saveData('vouchers', s.vouchers.filter(x => x.id !== id)).catch(() => {});

          let updatedProducts = [...s.products];
          voucher.items.forEach(item => {
              const pIndex = findInventoryProductIndex(updatedProducts, item);
              if (pIndex !== -1) {
                  const change = -voucherStockDelta(voucher, item.quantity);
                  updatedProducts[pIndex] = {
                      ...updatedProducts[pIndex],
                      stock: (updatedProducts[pIndex].stock || 0) + change
                  };
                  hostDB.save('products', updatedProducts[pIndex]).catch(() => {});
              }
          });
          persistentStorage.saveData('products', updatedProducts).catch(() => {});

          triggerAutoBackup(`حذف حواله انبار`);
          return { 
              vouchers: s.vouchers.filter(x => x.id !== id), 
              products: updatedProducts,
              transactions: s.transactions.filter(t => t.referenceId !== id),
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: 'حواله انبار حذف و موجودی بازگردانی شد.' }]
          };
      }),

      setVoucherSignature: (id, signature) => set(s => {
          const updated = s.vouchers.map(v => v.id === id ? { ...v, signature } : v);
          const changed = updated.find(v => v.id === id);
          if (changed) {
              hostDB.save('vouchers', changed).catch(() => {});
              persistentStorage.saveData('vch_' + id, changed).catch(() => {});
          }
          return { vouchers: updated };
      }),
      setVoucherCompanySignature: (id, companySignature) => set(s => {
          const updated = s.vouchers.map(v => v.id === id ? { ...v, companySignature } : v);
          const changed = updated.find(v => v.id === id);
          if (changed) {
              hostDB.save('vouchers', changed).catch(() => {});
              persistentStorage.saveData('vch_' + id, changed).catch(() => {});
          }
          return { vouchers: updated };
      }),
      setVoucherSupervisorSignature: (id, supervisorSignature) => set(s => {
          const updated = s.vouchers.map(v => v.id === id ? { ...v, supervisorSignature } : v);
          const changed = updated.find(v => v.id === id);
          if (changed) {
              hostDB.save('vouchers', changed).catch(() => {});
              persistentStorage.saveData('vch_' + id, changed).catch(() => {});
          }
          return { vouchers: updated };
      }),

      addLogisticsProfile: (lp) => set(s => ({ logisticsProfiles: [...s.logisticsProfiles, lp] })),
      deleteLogisticsProfile: (id) => set(s => ({ logisticsProfiles: s.logisticsProfiles.filter(x => x.id !== id) })),

      addImportConfig: (config) => set(s => ({ importConfigs: [...s.importConfigs, config] })),
      deleteImportConfig: (id) => set(s => ({ importConfigs: s.importConfigs.filter(c => c.id !== id) })),
      addImportBatch: (batch) => set(s => ({ importBatches: [batch, ...s.importBatches] })),

      commitImportBatch: (batchId, currentUser) => set(s => {
          const batch = s.importBatches.find(b => b.id === batchId);
          if (!batch || batch.status !== 'PENDING_VAL') return {};

          const stockError = validateVoucherInventoryChange(
              s.products,
              batch.vouchers.map(voucher => ({ voucher }))
          );
          if (stockError) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `ثبت نهایی واردات لغو شد: ${stockError}` }] };
          }

          const updatedBatches = s.importBatches.map(b => 
              b.id === batchId ? { ...b, status: 'COMMITTED' as const } : b
          );

          // Pushing all vouchers to main vouchers list, and updating product stocks
          let updatedProducts = [...s.products];
          let updatedPeople = [...s.people];
          let newTransactions = [...s.transactions];
          
          batch.vouchers.forEach(v => {
              // 1. Save voucher to Host DB (simulated)
              hostDB.save('vouchers', v).catch(() => {});

              // 2. Add statistical transaction
              if (v.personId) {
                  const pIndex = updatedPeople.findIndex(p => p.id === v.personId);
                  if (pIndex !== -1) {
                      newTransactions.push({
                          id: generateId(),
                          date: v.date,
                          type: 'VOUCHER_INFO',
                          amount: v.estimatedValue || 0,
                          personId: v.personId,
                          personName: v.personName,
                          description: `حواله ${v.type === 'OUT' ? 'خروج' : 'ورود'} انبار ${v.number} (واردات از فایل)`,
                          balanceAfter: updatedPeople[pIndex].balance,
                          isDebit: v.type === 'OUT', 
                          referenceId: v.id,
                          relatedInvoiceId: v.relatedInvoiceId,
                          trackingCode: v.trackingCode,
                          metadata: { items: v.items.map(i => `${i.productName} (${i.quantity})`).join('، '), importBatchId: batchId }
                      });
                  }
              }

              // 3. Update stock of products
              v.items.forEach(item => {
                  const pIndex = findInventoryProductIndex(updatedProducts, item);
                  if (pIndex !== -1) {
                      const qty = item.quantity;
                      const stockChange = voucherStockDelta(v, qty);
                      
                      updatedProducts[pIndex] = {
                          ...updatedProducts[pIndex],
                          stock: Number(updatedProducts[pIndex].stock ?? 0) + stockChange
                      };
                      
                      // Save product update to Host DB (simulated)
                      hostDB.save('products', updatedProducts[pIndex]).catch(() => {});
                  }
              });
          });

          // 4. Log in auditTrail
          if (currentUser) {
              auditTrail.log(
                  currentUser.id, 
                  currentUser.fullName, 
                  'CREATE', 
                  'import_batch_commit', 
                  batchId, 
                  null, 
                  { vouchersCount: batch.vouchers.length, voucherType: batch.voucherType }, 
                  'MEDIUM'
              ).catch(() => {});
          }

          const maxNumber = batch.vouchers.reduce((max, v) => Math.max(max, v.number), s.lastVoucherNumber);

          return {
              importBatches: updatedBatches,
              vouchers: [...s.vouchers, ...batch.vouchers],
              products: updatedProducts,
              people: updatedPeople,
              transactions: newTransactions,
              lastVoucherNumber: maxNumber,
              notifications: [...s.notifications, { id: generateId(), type: 'success', message: `واردات دسته ${batchId} با موفقیت ثبت نهایی شد.` }]
          };
      }),

      rollbackImportBatch: (batchId, currentUser) => set(s => {
          const batch = s.importBatches.find(b => b.id === batchId);
          if (!batch || batch.status !== 'COMMITTED') return {};

          const updatedBatches = s.importBatches.map(b => 
              b.id === batchId ? { ...b, status: 'ROLLEDBACK' as const } : b
          );

          const batchVoucherIds = new Set(batch.vouchers.map(v => v.id));

          // 1. Delete vouchers from Host DB
          batch.vouchers.forEach(v => {
              hostDB.deleteFromHost('vouchers', v.id).catch(() => {});
          });

          // 2. Reverse product stocks
          let updatedProducts = [...s.products];
          batch.vouchers.forEach(v => {
              v.items.forEach(item => {
                  const pIndex = findInventoryProductIndex(updatedProducts, item);
                  if (pIndex !== -1) {
                      const qty = item.quantity;
                      const stockChange = -voucherStockDelta(v, qty);
                      
                      updatedProducts[pIndex] = {
                          ...updatedProducts[pIndex],
                          stock: Number(updatedProducts[pIndex].stock ?? 0) + stockChange
                      };
                      hostDB.save('products', updatedProducts[pIndex]).catch(() => {});
                  }
              });
          });

          // 3. Remove transactions related to these vouchers
          const updatedTransactions = s.transactions.filter(t => !t.referenceId || !batchVoucherIds.has(t.referenceId));

          // 4. Filter out vouchers from main list
          const updatedVouchers = s.vouchers.filter(v => !batchVoucherIds.has(v.id));

          // 5. Log in auditTrail
          if (currentUser) {
              auditTrail.log(
                  currentUser.id, 
                  currentUser.fullName, 
                  'DELETE', 
                  'import_batch_rollback', 
                  batchId, 
                  { vouchersCount: batch.vouchers.length, voucherType: batch.voucherType }, 
                  null, 
                  'HIGH'
              ).catch(() => {});
          }

          return {
              importBatches: updatedBatches,
              vouchers: updatedVouchers,
              products: updatedProducts,
              transactions: updatedTransactions,
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: `واردات دسته ${batchId} با موفقیت بازگردانی شد.` }]
          };
      }),

      addGeneralFinance: (type, amount, desc, personId, signature, relatedInvoiceId, receiptImage) => {
          const s = get();
          const notifyError = (message: string) => {
              set(state => ({ notifications: [...state.notifications, { id: generateId(), type: 'error', message }] }));
              return {} as Transaction;
          };
          if (s.currentUser && !s.currentUser.permissions.finance.create) {
              return notifyError('خطا: شما مجوز ثبت تراکنش مالی را ندارید.');
          }
          const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
          const quotaCheck = licenseQuotaService.canAddDocument(totalDocs);
          if (!quotaCheck.allowed) {
              return notifyError(quotaCheck.reason || 'سقف نسخه پایه (۲۰۰ سند) پر شده است.');
          }
          if (!Number.isFinite(amount) || amount <= 0) {
              return notifyError('مبلغ تراکنش مالی باید عددی معتبر و بزرگ‌تر از صفر باشد.');
          }

          const relatedInvoice = relatedInvoiceId
              ? s.invoices.find(invoice => invoice.id === relatedInvoiceId)
              : undefined;
          if (relatedInvoiceId && !relatedInvoice) {
              return notifyError('فاکتور مرتبط یافت نشد؛ تراکنش ثبت نشد.');
          }
          if (relatedInvoice && (
              (type === 'INCOME' && relatedInvoice.type !== InvoiceType.SALE) ||
              (type === 'EXPENSE' && relatedInvoice.type !== InvoiceType.PURCHASE)
          )) {
              return notifyError('نوع دریافت/پرداخت با نوع فاکتور مرتبط سازگار نیست.');
          }
          if (relatedInvoice && personId && personId !== relatedInvoice.personId) {
              return notifyError('طرف‌حساب تراکنش با طرف‌حساب فاکتور یکسان نیست.');
          }

          const effectivePersonId = relatedInvoice?.personId || personId || '';
          const effectivePersonName = relatedInvoice?.personName ||
              ((get().people || []).find(p => p && p.id === effectivePersonId)?.name || '');
          const transId = generateId();
          const trackingCode = generateId().slice(0, 8);
          const transactionDate = getPersianDate();
          const newTrans: Transaction = {
              id: transId,
              date: transactionDate,
              type: relatedInvoice
                  ? (type === 'INCOME' ? 'INVOICE_RECEIPT' : 'CASH_PAYMENT')
                  : (type === 'INCOME' ? 'GENERAL_INCOME' : 'EXPENSE'),
              amount,
              personId: effectivePersonId,
              personName: effectivePersonName,
              description: desc,
              balanceAfter: 0,
              isDebit: type === 'EXPENSE',
              relatedInvoiceId,
              referenceId: relatedInvoice ? transId : undefined,
              signature,
              receiptImage,
              trackingCode
          };

          let nextInvoices = s.invoices;
          let updatedInvoice: Invoice | undefined;
          if (relatedInvoice) {
              const paymentEntry = {
                  id: transId,
                  date: transactionDate,
                  amount,
                  method: 'CASH' as const,
                  trackingCode,
                  description: desc,
                  accountingPosted: true
              };
              updatedInvoice = {
                  ...relatedInvoice,
                  cashAmount: (relatedInvoice.cashAmount || 0) + amount,
                  payments: [...(relatedInvoice.payments || []), paymentEntry]
              };
              nextInvoices = s.invoices.map(invoice => invoice.id === relatedInvoice.id ? updatedInvoice! : invoice);
          }

          // A linked invoice receipt/payment gets its own dated journal, not a second
          // generic transaction journal. Standalone finance items retain the generic flow.
          try {
              if (updatedInvoice) {
                  AccountingEngine.postInvoicePayment(updatedInvoice, newTrans, 'CASH');
              } else {
                  AccountingEngine.postGeneralTransaction(newTrans);
              }
          } catch (err) {
              console.error('AccountingEngine error in addGeneralFinance:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return notifyError(`ثبت تراکنش مالی انجام نشد؛ اطلاعات قبلی حفظ شد: ${reason}`);
          }

          const nextTransactions = [...s.transactions, newTrans];
          const exactBalance = effectivePersonId
              ? PersonLedgerService.getBalance(effectivePersonId, nextInvoices, nextTransactions, s.checks)
              : 0;
          newTrans.balanceAfter = exactBalance;
          const updatedPeople = effectivePersonId
              ? s.people.map(p => p.id === effectivePersonId ? { ...p, balance: exactBalance } : p)
              : s.people;

          if (updatedInvoice) hostDB.save('invoices', updatedInvoice).catch(() => {});
          hostDB.save('transactions', newTrans).catch(() => {});
          if (updatedInvoice) persistentStorage.saveData('invoices', nextInvoices).catch(() => {});
          persistentStorage.saveData('transactions', nextTransactions).catch(() => {});
          if (effectivePersonId) persistentStorage.saveData('people', updatedPeople).catch(() => {});

          set(state => ({
              invoices: nextInvoices,
              transactions: nextTransactions,
              people: updatedPeople,
              notifications: [...state.notifications, {
                  id: generateId(),
                  type: 'success',
                  message: updatedInvoice
                      ? (type === 'INCOME' ? 'دریافتی فاکتور ثبت شد و سند آن در تاریخ دریافت صادر گردید.' : 'پرداخت فاکتور ثبت شد و سند آن در تاریخ پرداخت صادر گردید.')
                      : (type === 'INCOME' ? 'دریافتی مالی ثبت و در کاردکس طرف‌حساب اعمال شد.' : 'پرداختی مالی ثبت و در کاردکس شخص اعمال شد.')
              }]
          }));
          triggerAutoBackup(type === 'INCOME' ? 'دریافتی مالی' : 'پرداختی مالی');
          return newTrans;
      },

      addInvoicePayment: (invoiceId, payment) => {
          const s = get();
          const notifyError = (message: string) => {
              set(state => ({ notifications: [...state.notifications, { id: generateId(), type: 'error', message }] }));
              return null;
          };

          if (s.currentUser && !s.currentUser.permissions.finance.create) {
              return notifyError('خطا: شما مجوز ثبت دریافت مالی را ندارید.');
          }

          const invoice = s.invoices.find(inv => inv.id === invoiceId);
          if (!invoice) return notifyError('فاکتور مورد نظر یافت نشد.');
          if (invoice.type !== InvoiceType.SALE && invoice.type !== InvoiceType.PURCHASE) {
              return notifyError('برای پیش‌فاکتور یا سند غیرمالی نمی‌توان پرداخت ثبت کرد.');
          }
          if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
              return notifyError('مبلغ پرداخت باید عددی معتبر و بزرگ‌تر از صفر باشد.');
          }
          if (typeof payment.date !== 'string' || !payment.date.trim()) {
              return notifyError('تاریخ پرداخت الزامی است.');
          }

          const amountAlreadyPaid = Number(invoice.cashAmount || 0) + Number(invoice.checkAmount || 0);
          const remainingBalance = Number(invoice.finalTotal || 0) - amountAlreadyPaid;
          if (!Number.isFinite(remainingBalance) || remainingBalance <= 0) {
              return notifyError('این فاکتور ماندهٔ قابل پرداخت ندارد؛ از ثبت پرداخت تکراری جلوگیری شد.');
          }
          if (payment.amount > remainingBalance) {
              return notifyError(`مبلغ پرداخت از ماندهٔ فاکتور بیشتر است. مانده: ${Math.max(0, remainingBalance).toLocaleString('fa-IR')}`);
          }

          const isSale = invoice.type === InvoiceType.SALE;
          const isCheck = payment.method === 'CHECK';
          if (isCheck && (!payment.checkDetails || !payment.checkDetails.checkNumber.trim())) {
              return notifyError('برای پرداخت با چک، شماره چک و مشخصات آن الزامی است.');
          }
          if (isCheck && payment.checkDetails?.sayadId && payment.checkDetails.sayadId.replace(/\D/g, '').length !== 16) {
              return notifyError('شناسه صیادی چک باید دقیقاً ۱۶ رقم باشد.');
          }

          const totalDocs = s.invoices.length + s.vouchers.length + s.transactions.length + s.checks.length;
          const createsTwoDocuments = payment.method === 'CHECK';
          const quotaCheck = licenseQuotaService.canAddDocument(totalDocs + (createsTwoDocuments ? 1 : 0));
          if (!quotaCheck.allowed) {
              return notifyError(quotaCheck.reason || 'سقف اسناد نسخه فعلی تکمیل شده است؛ پرداخت ثبت نشد.');
          }

          const transId = generateId();
          const trackingCode = payment.trackingCode ||
              (isCheck ? payment.checkDetails?.checkNumber : ('RCV-' + Date.now().toString().slice(-6)));
          const methodTitle = payment.method === 'CASH' ? 'نقدی' :
              payment.method === 'POS' ? 'کارتخوان' :
              payment.method === 'CARD' ? 'کارت به کارت' : 'چک صیادی';
          const defaultDesc = isSale
              ? `دریافت ${methodTitle} بابت فاکتور فروش شماره ${invoice.number}`
              : `پرداخت ${methodTitle} بابت فاکتور خرید شماره ${invoice.number}`;
          const description = payment.description || defaultDesc;

          let checkToSave: Check | null = null;
          let nextChecks = s.checks;
          if (isCheck && payment.checkDetails) {
              // Reuse the payment ID so deleting the payment can also remove its check record.
              checkToSave = {
                  id: transId,
                  bankName: payment.checkDetails.bankName,
                  amount: payment.amount,
                  dueDate: payment.checkDetails.dueDate,
                  issueDate: payment.date,
                  sayadId: payment.checkDetails.sayadId || '',
                  checkNumber: payment.checkDetails.checkNumber.trim(),
                  holderName: invoice.personName || 'نامشخص',
                  personId: invoice.personId,
                  personName: invoice.personName,
                  status: 'PENDING',
                  checkType: isSale ? 'RECEIVED' : 'ISSUED',
                  relatedInvoiceId: invoice.id
              };
              nextChecks = [...s.checks, checkToSave];
          }

          const newTrans: Transaction = {
              id: transId,
              date: payment.date,
              type: isCheck ? 'CHECK_INFO' : 'INVOICE_RECEIPT',
              amount: payment.amount,
              personId: invoice.personId,
              personName: invoice.personName,
              description,
              balanceAfter: 0,
              isDebit: !isSale,
              // Give the payment its own reference; invoice linkage remains in relatedInvoiceId.
              referenceId: transId,
              relatedInvoiceId: invoice.id,
              trackingCode,
              metadata: {
                  invoiceNumber: invoice.number,
                  invoiceId: invoice.id,
                  paymentMethod: payment.method,
                  checkId: checkToSave?.id
              }
          };

          const updatedInvoice = {
              ...invoice,
              cashAmount: !isCheck ? ((invoice.cashAmount || 0) + payment.amount) : (invoice.cashAmount || 0),
              checkAmount: isCheck ? ((invoice.checkAmount || 0) + payment.amount) : (invoice.checkAmount || 0),
              checks: isCheck && checkToSave ? [...(invoice.checks || []), checkToSave] : invoice.checks,
              payments: [
                  ...(invoice.payments || []),
                  {
                      id: transId,
                      date: payment.date,
                      amount: payment.amount,
                      method: payment.method,
                      trackingCode,
                      description,
                      accountingPosted: true
                  }
              ]
          };

          // Post the real dated journal before changing any source records or caches.
          try {
              AccountingEngine.postInvoicePayment(updatedInvoice, newTrans, payment.method);
          } catch (err) {
              console.error('AccountingEngine error in addInvoicePayment:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return notifyError(`ثبت پرداخت انجام نشد؛ اطلاعات قبلی حفظ شد: ${reason}`);
          }

          const nextInvoices = s.invoices.map(inv => inv.id === invoiceId ? updatedInvoice : inv);
          const nextTransactions = [...s.transactions, newTrans];

          const exactBalance = invoice.personId
              ? PersonLedgerService.getBalance(invoice.personId, nextInvoices, nextTransactions, nextChecks)
              : 0;
          newTrans.balanceAfter = exactBalance;
          const updatedPeople = invoice.personId
              ? s.people.map(p => p.id === invoice.personId ? { ...p, balance: exactBalance } : p)
              : s.people;

          if (checkToSave) hostDB.save('checks', checkToSave).catch(() => {});
          hostDB.save('invoices', updatedInvoice).catch(() => {});
          hostDB.save('transactions', newTrans).catch(() => {});
          persistentStorage.saveData('checks', nextChecks).catch(() => {});
          persistentStorage.saveData('invoices', nextInvoices).catch(() => {});
          persistentStorage.saveData('transactions', nextTransactions).catch(() => {});
          if (invoice.personId) persistentStorage.saveData('people', updatedPeople).catch(() => {});

          set(state => ({
              invoices: nextInvoices,
              transactions: nextTransactions,
              checks: nextChecks,
              people: updatedPeople,
              notifications: [
                  ...state.notifications,
                  {
                      id: generateId(),
                      type: 'success',
                      message: `پرداخت ${payment.amount.toLocaleString('fa-IR')} برای فاکتور شماره ${invoice.number} ثبت شد و سند حسابداری آن در تاریخ پرداخت صادر گردید.`
                  }
              ]
          }));

          triggerAutoBackup(`پرداخت فاکتور ${invoice.number}`);
          return newTrans;
      },

      deleteTransaction: (id) => set(s => {
          if (s.currentUser && !s.currentUser.permissions.finance.delete) {
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: 'خطا: شما مجوز حذف تراکنش مالی را ندارید.' }] };
          }
          const trans = s.transactions.find(t => t.id === id);
          if (!trans) return {};

          const linkedInvoice = trans.relatedInvoiceId
              ? s.invoices.find(invoice => invoice.id === trans.relatedInvoiceId)
              : undefined;
          const paymentRecord = linkedInvoice?.payments?.find(payment => payment.id === trans.id);
          const checkIdFromMetadata = (trans.metadata as any)?.checkId;
          const linkedCheck = s.checks.find(check =>
              check.id === trans.id ||
              (checkIdFromMetadata && check.id === checkIdFromMetadata) ||
              (trans.relatedInvoiceId &&
                  (trans.metadata as any)?.paymentMethod === 'CHECK' &&
                  check.relatedInvoiceId === trans.relatedInvoiceId &&
                  check.amount === trans.amount &&
                  check.checkNumber === trans.trackingCode)
          ) || linkedInvoice?.checks?.find(check =>
              check.id === trans.id ||
              (checkIdFromMetadata && check.id === checkIdFromMetadata) ||
              (trans.relatedInvoiceId &&
                  (trans.metadata as any)?.paymentMethod === 'CHECK' &&
                  check.amount === trans.amount &&
                  check.checkNumber === trans.trackingCode)
          );

          // Reverse journals before deleting either the transaction or its linked check.
          try {
              AccountingEngine.reverseTransactionAndCheck(trans, linkedCheck);
          } catch (err) {
              console.error('AccountingEngine error in deleteTransaction:', err);
              const reason = err instanceof Error ? err.message : 'خطای نامشخص حسابداری';
              return { notifications: [...s.notifications, { id: generateId(), type: 'error', message: `حذف تراکنش انجام نشد؛ اطلاعات قبلی حفظ شد: ${reason}` }] };
          }

          deletedRecordsRegistry.registerDeletion(id, 'transaction');
          hostDB.deleteFromHost('transactions', id).catch(() => {});
          const filteredTransactions = s.transactions.filter(t => t.id !== id);

          let nextChecks = s.checks;
          if (linkedCheck) {
              deletedRecordsRegistry.registerDeletion(linkedCheck.id, 'check');
              hostDB.deleteFromHost('checks', linkedCheck.id).catch(() => {});
              nextChecks = s.checks.filter(check => check.id !== linkedCheck.id);
          }

          let nextInvoices = s.invoices;
          if (linkedInvoice && paymentRecord) {
              const isCheckPayment = paymentRecord.method === 'CHECK';
              const updatedInvoice = {
                  ...linkedInvoice,
                  cashAmount: isCheckPayment
                      ? (linkedInvoice.cashAmount || 0)
                      : Math.max(0, (linkedInvoice.cashAmount || 0) - paymentRecord.amount),
                  checkAmount: isCheckPayment
                      ? Math.max(0, (linkedInvoice.checkAmount || 0) - paymentRecord.amount)
                      : (linkedInvoice.checkAmount || 0),
                  payments: (linkedInvoice.payments || []).filter(payment => payment.id !== trans.id),
                  checks: (linkedInvoice.checks || []).filter(check =>
                      check.id !== trans.id &&
                      check.id !== checkIdFromMetadata &&
                      (!linkedCheck || check.id !== linkedCheck.id)
                  )
              };
              nextInvoices = s.invoices.map(invoice => invoice.id === linkedInvoice.id ? updatedInvoice : invoice);
              hostDB.save('invoices', updatedInvoice).catch(() => {});
              persistentStorage.saveData('invoices', nextInvoices).catch(() => {});
          }

          persistentStorage.saveData('transactions', filteredTransactions).catch(() => {});
          persistentStorage.saveData('checks', nextChecks).catch(() => {});

          const personId = trans.personId || linkedCheck?.personId;
          const exactBalance = personId
              ? PersonLedgerService.getBalance(personId, nextInvoices, filteredTransactions, nextChecks)
              : 0;
          const updatedPeople = s.people.map(p => p.id === personId ? { ...p, balance: exactBalance } : p);
          if (personId) persistentStorage.saveData('people', updatedPeople).catch(() => {});

          return {
              invoices: nextInvoices,
              transactions: filteredTransactions,
              checks: nextChecks,
              people: updatedPeople,
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: 'تراکنش حذف شد؛ اسناد حسابداری معکوس و ماندهٔ فاکتور/چک باز‌محاسبه شد.' }]
          };
      }),
      
      addSalary: (s) => set(state => ({ salaries: [...state.salaries, s] })),
      
      addContract: (c) => set(s => ({ 
          contracts: [...s.contracts, c],
          notifications: [...s.notifications, { id: generateId(), type: 'success', message: 'قرارداد ثبت شد.' }]
      })),
      updateContract: (id, updates) => set(s => {
          const updated = s.contracts.map(c => c.id === id ? {...c, ...updates} : c);
          const changed = updated.find(c => c.id === id);
          if (changed) {
              hostDB.save('contracts', changed).catch(() => {});
              persistentStorage.saveData('contracts', updated).catch(() => {});
          }
          return { contracts: updated };
      }),
      deleteContract: (id) => set(s => {
          deletedRecordsRegistry.registerDeletion(id, 'contract');
          hostDB.deleteFromHost('contracts', id).catch(() => {});
          persistentStorage.saveData('contracts', s.contracts.filter(c => c.id !== id)).catch(() => {});
          return { 
              contracts: s.contracts.filter(c => c.id !== id),
              notifications: [...s.notifications, { id: generateId(), type: 'info', message: 'قرارداد حذف شد.' }]
          };
      }),
      setContractSignature: (id, signature, role = 'person') => set(s => {
          const updated = s.contracts.map(c => c.id === id ? {
              ...c,
              signature: role === 'person' ? signature : c.signature,
              companySignature: role === 'company' ? signature : c.companySignature
          } : c);
          const changed = updated.find(c => c.id === id);
          if (changed) {
              hostDB.save('contracts', changed).catch(() => {});
              persistentStorage.saveData('ctr_' + id, changed).catch(() => {});
          }
          return { contracts: updated };
      }),
      
      addSavedDescription: (desc) => set(s => ({ savedDescriptions: [...s.savedDescriptions, desc] })),
      removeSavedDescription: (idx) => set(s => ({ savedDescriptions: s.savedDescriptions.filter((_, i) => i !== idx) })),
      updateConfig: (up) => set(s => {
          const newConfig = {...s.config, ...up};
          if (up.currency) {
              try { localStorage.setItem('ashke-ghalam-currency', up.currency); } catch {}
              window.dispatchEvent(new CustomEvent('currency-change', { detail: up.currency }));
          }
          if (up.appTheme) {
              try { localStorage.setItem('ashke-ghalam-theme', up.appTheme); } catch {}
              window.dispatchEvent(new CustomEvent('theme-change', { detail: up.appTheme }));
          }
          backupService.backupData('config', newConfig).catch(() => {});
          return { config: newConfig };
      }),
      setOnlineStatus: (isOnline) => set({ isOnline }),
      hydrateStore: (data) => {
          const restoreFinancialData = (source: any) => {
              const incoming = source?.financialData;
              if (!incoming || typeof incoming !== 'object') return;
              const keys = [
                  'accountingEntries', 'chartOfAccounts', 'taxConfigs', 'taxReports',
                  'cashFlowEntries', 'projects', 'projectTransactions', 'fixedAssets',
                  'budgets', 'budgetLines', 'loans', 'loanInstallments', 'bankAccounts',
                  'bankTransactions', 'currencies', 'auditLogs', 'fiscalPeriods',
                  'aiInsights', 'ocrDocuments'
              ];
              const patch: Record<string, any[]> = {};
              keys.forEach(key => {
                  if (Array.isArray(incoming[key])) patch[key] = incoming[key];
              });
              if (Object.keys(patch).length > 0) {
                  useFinancialStore.setState(patch as any);
              }
          };

          try {
              if (data && typeof data === 'object') {
                  const hasBackupTables = 
                      data.companies || data.products || data.people || 
                      data.invoices || data.vouchers || data.checks || 
                      data.transactions || data.salaries || data.contracts ||
                      data.checkTransfers || data.users;
                  if (hasBackupTables) {
                      const migrated = backupMigrationService.migrateBackupData(data);

                      // ۱. جمع‌آوری شناسه تمامی رکوردهای بازیابی شده جهت لغو حذف (Un-tombstone)
                      const allRestoredIds: string[] = [];
                      const entityArrays = [
                          migrated.companies, migrated.products, migrated.people,
                          migrated.invoices, migrated.vouchers, migrated.checks,
                          migrated.transactions, migrated.salaries, migrated.contracts,
                          migrated.checkTransfers, migrated.users, migrated.roles,
                          migrated.importConfigs
                      ];
                      entityArrays.forEach(arr => {
                          if (Array.isArray(arr)) {
                              arr.forEach((item: any) => {
                                  if (item && item.id) allRestoredIds.push(item.id);
                              });
                          }
                      });

                      // لغو تامب‌استون‌ها برای جلوگیری از حذف مجدد پس از سینک
                      if (allRestoredIds.length > 0) {
                          deletedRecordsRegistry.unmarkDeleted(allRestoredIds);
                      }

                      // ۲. ذخیره مستقیم و فوری در Persistent Storage هاست
                      const tablesToSync: Array<{ table: string; data: any[] }> = [
                          { table: 'companies', data: migrated.companies || [] },
                          { table: 'products', data: migrated.products || [] },
                          { table: 'people', data: migrated.people || [] },
                          { table: 'invoices', data: migrated.invoices || [] },
                          { table: 'vouchers', data: migrated.vouchers || [] },
                          { table: 'checks', data: migrated.checks || [] },
                          { table: 'transactions', data: migrated.transactions || [] },
                          { table: 'check_transfers', data: migrated.checkTransfers || [] },
                          { table: 'checkTransfers', data: migrated.checkTransfers || [] },
                          { table: 'salaries', data: migrated.salaries || [] },
                          { table: 'contracts', data: migrated.contracts || [] },
                          { table: 'users', data: migrated.users || [] },
                          { table: 'roles', data: migrated.roles || [] },
                          { table: 'importConfigs', data: migrated.importConfigs || [] }
                      ];

                      tablesToSync.forEach(({ table, data: tableData }) => {
                          if (tableData && Array.isArray(tableData) && tableData.length > 0) {
                              persistentStorage.saveData(table, tableData).catch(() => {});
                          }
                      });

                      // Native apps already persist through Android Keystore or Electron safeStorage.
                      // Avoid creating a second full-state copy in browser IndexedDB on those builds.
                      if (!hasNativeBackupStorage()) {
                          idbService.save('backups', {
                              id: 'ashke-ghalam-rbac-v15-accounting',
                              data: JSON.stringify(migrated)
                          }).catch(() => {});
                      }

                      restoreFinancialData(data);
                      set(s => ({ ...s, ...migrated }));
                      return;
                  }
              }
          } catch (e) {
              console.error('Error in hydrateStore migration:', e);
          }
          restoreFinancialData(data);
          const operationalData: any = { ...(data as any) };
          delete operationalData.financialData;
          set(s => ({ ...s, ...operationalData }));
      },
      exportBackup: () => {
          const state = get();
          const allBranches = (state.companies || []).flatMap(c => (c.branches || []).map(b => ({ ...b, companyId: c.id })));
          const backupData: any = {
              timestamp: new Date().toISOString(),
              version: APP_VERSION,
              backupFormatVersion: 2,
              companies: state.companies,
              branches: allBranches,
              products: state.products,
              people: state.people,
              invoices: state.invoices,
              vouchers: state.vouchers,
              checks: state.checks,
              transactions: state.transactions,
              checkTransfers: state.checkTransfers,
              salaries: state.salaries,
              contracts: state.contracts,
              config: state.config,
              users: state.users,
              roles: state.roles,
              importConfigs: state.importConfigs,
              importBatches: state.importBatches,
              // Accounting has its own Zustand store; include it or a backup cannot restore the financial ledger.
              financialData: useFinancialStore.getState(),
              signature: ''
          };
          backupData.signature = securityService.signBackup(backupData);
          downloadJSON(backupData, `AshkeGhalam-Backup-${getPersianDate().replace(/\//g, '-')}`);
          backupService.backupData('full-export', backupData).catch(() => {});
      }
    };
    },
    {
      name: 'ashke-ghalam-rbac-v15-accounting',
      version: 1,
      migrate: (persistedState: any) => {
          if (!persistedState || typeof persistedState !== 'object') return persistedState;
          const migrated: any = { ...persistedState };
          const legacyWeakHash = securityService.hashPassword('123');
          const knownRecoveryKeys = new Set([
              'ASHK-REC-9988-7711',
              'ASHK-REC-4433-2211',
              'ASHK-SUPER-MASTER-EMERGENCY-2026'
          ]);
          if (Array.isArray(migrated.users)) {
              migrated.users = migrated.users
                  .filter((user: any) => {
                      if (!user || typeof user !== 'object') return false;
                      const username = String(user.username || '').trim().toLowerCase();
                      const defaultCredential = user.password === '123' || user.hashedPassword === legacyWeakHash;
                      return !(['admin', 'user'].includes(username) && defaultCredential);
                  })
                  .map((user: any) => {
                      const next = { ...user };
                      if (typeof next.password === 'string' && next.password && !next.hashedPassword) {
                          next.hashedPassword = securityService.hashPassword(next.password);
                      }
                      delete next.password;
                      if (knownRecoveryKeys.has(String(next.recoveryKey || '').trim().toUpperCase())) {
                          delete next.recoveryKey;
                      }
                      return next;
                  });
          }
          // Do not restore an authenticated session from persisted application state.
          migrated.currentUser = null;
          return migrated;
      },
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
            // Native Android: main accounting state must live in Android Keystore-backed storage.
            if (isNativeAndroidSecureStorage()) {
                const protectedValue = await getAndroidEncryptedItem(name);
                if (protectedValue !== null) return protectedValue;

                // Migrate older copies once. If native encryption fails, do not fall back to plaintext.
                let legacyValue: string | null = null;
                try {
                    let record = await idbService.get('backups', name);
                    if (!record || !record.data) {
                        record = await idbService.get('backups', 'ashke-ghalam-rbac-v14-accounting');
                    }
                    if (record && typeof record.data === 'string') legacyValue = record.data;
                } catch (error) {
                    console.warn('[Store] Legacy Android IndexedDB migration check failed:', error);
                }
                if (legacyValue === null) {
                    legacyValue = localStorage.getItem(name) ?? localStorage.getItem('ashke-ghalam-rbac-v14-accounting');
                }
                if (legacyValue === null) return null;

                let migratedValue = legacyValue;
                if (!legacyValue.trim().startsWith('{')) {
                    const decrypted = securityService.decrypt(legacyValue);
                    if (decrypted && decrypted.trim().startsWith('{')) migratedValue = decrypted;
                }
                await setAndroidEncryptedItem(name, migratedValue);
                await localStorageRemoveLegacy(name);
                await idbService.remove(name).catch(() => {});
                await idbService.remove('ashke-ghalam-rbac-v14-accounting').catch(() => {});
                return migratedValue;
            }

            // Native Windows local state is read through OS-backed encryption in Electron.
            try {
                const desktopData = await desktopDatabaseService.loadFromDatabase();
                if (desktopData) {
                    if (desktopData.trim().startsWith('{')) return desktopData;
                    const decrypted = securityService.decrypt(desktopData);
                    return decrypted && decrypted.trim().startsWith('{') ? decrypted : desktopData;
                }
            } catch (e) {
                console.warn('[Store] Desktop database read failed:', e);
            }

            // Older web/PWA/desktop fallback migration.
            try {
                let record = await idbService.get('backups', name);
                if (!record || !record.data) record = await idbService.get('backups', 'ashke-ghalam-rbac-v14-accounting');
                if (record && record.data) {
                    const val = record.data;
                    if (typeof val === 'string' && val.trim().startsWith('{')) return val;
                    const decrypted = securityService.decrypt(val);
                    return decrypted && decrypted.trim().startsWith('{') ? decrypted : val;
                }
            } catch (e) {
                console.error('Error reading legacy state from IndexedDB:', e);
            }

            let val = localStorage.getItem(name);
            if (!val) val = localStorage.getItem('ashke-ghalam-rbac-v14-accounting');
            if (!val) return null;
            try {
                await idbService.set(name, val);
                localStorage.removeItem('ashke-ghalam-rbac-v14-accounting');
                localStorage.removeItem(name);
            } catch (e) {
                console.error('Error migrating legacy state to IndexedDB:', e);
            }
            if (val.trim().startsWith('{')) return val;
            const decrypted = securityService.decrypt(val);
            return decrypted && decrypted.trim().startsWith('{') ? decrypted : val;
        },
        setItem: async (name, value) => {
            // Android: persist the primary application state only using Android Keystore AES-GCM.
            if (isNativeAndroidSecureStorage()) {
                await setAndroidEncryptedItem(name, value);
                localStorage.removeItem(name);
                localStorage.removeItem('ashke-ghalam-rbac-v14-accounting');
                localStorage.removeItem('ashke-ghalam-currency');
                await idbService.remove(name).catch(() => {});
                await idbService.remove('ashke-ghalam-rbac-v14-accounting').catch(() => {});
                return;
            }

            // Windows Electron keeps the main full-state snapshot encrypted by OS safeStorage.
            if (desktopDatabaseService.isDesktopDatabaseAvailable()) {
                const saved = await desktopDatabaseService.saveToDatabase(value);
                if (!saved) throw new Error('SECURE_DESKTOP_DATABASE_WRITE_FAILED');
                localStorage.removeItem(name);
                localStorage.removeItem('ashke-ghalam-currency');
                return;
            }

            // Browser/PWA fallback: IndexedDB is retained for compatibility, but is not
            // claimed to provide hardware-backed at-rest encryption.
            try {
                await idbService.set(name, value);
                localStorage.removeItem(name);
                try {
                    const parsed = JSON.parse(value);
                    const currency = parsed?.state?.config?.currency;
                    if (currency) localStorage.setItem('ashke-ghalam-currency', currency);
                } catch {}
            } catch (e) {
                // Legacy web mode only. Never use this plaintext fallback in native apps.
                console.error('Error saving state to IndexedDB:', e);
                localStorage.setItem(name, value);
            }
        },
        removeItem: async (name) => {
            if (isNativeAndroidSecureStorage()) {
                await removeAndroidEncryptedItem(name);
                localStorage.removeItem(name);
            }
            try {
                await idbService.remove(name);
            } catch (e) {
                console.error('Error removing state from IndexedDB:', e);
            }
            localStorage.removeItem(name);
            localStorage.removeItem('ashke-ghalam-rbac-v14-accounting');
            localStorage.removeItem('ashke-ghalam-currency');
        }
      })),
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(([key, val]) => 
          typeof val !== 'function' && !['notifications', 'isOnline', 'currentUser'].includes(key)
        )
      ),
    }
  )
);
