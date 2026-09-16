// امکانات مالی حرفه‌ای - Types

// 1. حسابداری دوبل
export interface AccountingEntry {
  id: string;
  date: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  referenceId?: string;
  referenceType?: string;
  documentNumber?: number;
  documentType?: 'OPERATIONAL' | 'OPENING' | 'CLOSING' | 'ADJUSTMENT';
  fiscalYear?: string;
  status?: 'DRAFT' | 'APPROVED' | 'POSTED';
  createdBy?: string;
  approvedBy?: string;
  approvedDate?: string;
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  level: 'MAIN' | 'SUB' | 'DETAIL';
  parentId?: string;
  isActive: boolean;
}

export interface TrialBalance {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

// 2. مالیات
export interface TaxConfig {
  id: string;
  name: string;
  rate: number;
  type: 'VAT' | 'INCOME' | 'WITHHOLDING';
  isActive: boolean;
}

export interface TaxReport {
  id: string;
  period: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalPurchases: number;
  taxableAmount: number;
  taxAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'PAID';
}

// 3. جریان نقدینگی
export interface CashFlowEntry {
  id: string;
  date: string;
  category: 'OPERATING' | 'INVESTING' | 'FINANCING';
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
  description: string;
}

export interface CashFlowForecast {
  date: string;
  expectedInflow: number;
  expectedOutflow: number;
  projectedBalance: number;
}

// 4. حسابداری پروژه‌ای
export interface Project {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate?: string;
  budget: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  clientId?: string;
}

export interface ProjectTransaction {
  id: string;
  projectId: string;
  date: string;
  type: 'REVENUE' | 'EXPENSE';
  amount: number;
  description: string;
  categoryId?: string;
}

// 5. دارایی‌های ثابت
export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  salvageValue: number;
  usefulLife: number;
  depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';
  accumulatedDepreciation: number;
  bookValue: number;
  status: 'ACTIVE' | 'DISPOSED' | 'SOLD';
}

export interface DepreciationSchedule {
  assetId: string;
  period: string;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

// 6. بودجه‌بندی
export interface Budget {
  id: string;
  name: string;
  year: string;
  type: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  status: 'DRAFT' | 'APPROVED' | 'ACTIVE';
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  accountId: string;
  period: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
}

// 7. وام و اعتبارات
export interface Loan {
  id: string;
  loanNumber: string;
  lenderName: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  installmentAmount: number;
  remainingBalance: number;
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED';
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  paidDate?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

// 8. تحلیل‌های مالی
export interface FinancialRatio {
  period: string;
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  returnOnAssets: number;
  returnOnEquity: number;
  profitMargin: number;
  grossMargin: number;
}

export interface BreakEvenAnalysis {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
}

// 9. تطبیق بانکی
export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT';
  balance: number;
  currency: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  isReconciled: boolean;
  matchedTransactionId?: string;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  date: string;
  bankBalance: number;
  bookBalance: number;
  difference: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
}

// 10. چند ارزی
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  lastUpdated: string;
}

export interface MultiCurrencyTransaction {
  id: string;
  date: string;
  baseCurrency: string;
  foreignCurrency: string;
  foreignAmount: number;
  exchangeRate: number;
  baseAmount: number;
  gainLoss?: number;
}

// 11. حسابرسی
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
}

// 12. گزارشات مالی
export interface BalanceSheet {
  date: string;
  assets: {
    current: number;
    fixed: number;
    total: number;
  };
  liabilities: {
    current: number;
    longTerm: number;
    total: number;
  };
  equity: {
    capital: number;
    retained: number;
    total: number;
  };
}

export interface IncomeStatement {
  period: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  otherIncome: number;
  otherExpenses: number;
  netIncome: number;
}

export interface AgingReport {
  personId: string;
  personName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

// 13. AI و هوش مصنوعی
export interface AIInsight {
  id: string;
  date: string;
  type: 'COST_OPTIMIZATION' | 'REVENUE_FORECAST' | 'RISK_ALERT' | 'TREND_ANALYSIS';
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionable: boolean;
  recommendations?: string[];
}

export interface OCRDocument {
  id: string;
  uploadDate: string;
  fileName: string;
  documentType: 'INVOICE' | 'RECEIPT' | 'CONTRACT';
  extractedData: any;
  confidence: number;
  status: 'PENDING' | 'PROCESSED' | 'VERIFIED' | 'REJECTED';
}
