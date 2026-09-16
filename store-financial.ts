import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AccountingEntry, ChartOfAccount, TaxConfig, TaxReport, CashFlowEntry,
  Project, ProjectTransaction, FixedAsset, Budget, BudgetLine, Loan,
  LoanInstallment, BankAccount, BankTransaction, Currency, AuditLog,
  FiscalPeriod, AIInsight, OCRDocument
} from './types-financial';
import { generateId, getPersianDate } from './utils';
import { useStore } from './store';

interface FinancialState {
  // حسابداری دوبل
  accountingEntries: AccountingEntry[];
  chartOfAccounts: ChartOfAccount[];
  
  // مالیات
  taxConfigs: TaxConfig[];
  taxReports: TaxReport[];
  
  // جریان نقدینگی
  cashFlowEntries: CashFlowEntry[];
  
  // پروژهها
  projects: Project[];
  projectTransactions: ProjectTransaction[];
  
  // داراییهای ثابت
  fixedAssets: FixedAsset[];
  
  // بودجه
  budgets: Budget[];
  budgetLines: BudgetLine[];
  
  // وامها
  loans: Loan[];
  loanInstallments: LoanInstallment[];
  
  // بانک
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  
  // ارز
  currencies: Currency[];
  
  // حسابرسی
  auditLogs: AuditLog[];
  fiscalPeriods: FiscalPeriod[];
  
  // AI
  aiInsights: AIInsight[];
  ocrDocuments: OCRDocument[];
  
  // Actions
  addAccountingEntry: (entry: Omit<AccountingEntry, 'id'>) => void;
  addChartOfAccount: (account: ChartOfAccount) => void;
  addTaxReport: (report: TaxReport) => void;
  addCashFlowEntry: (entry: Omit<CashFlowEntry, 'id'>) => void;
  addProject: (project: Project) => void;
  addProjectTransaction: (transaction: ProjectTransaction) => void;
  addFixedAsset: (asset: FixedAsset) => void;
  calculateDepreciation: (assetId: string, date: string) => number;
  addBudget: (budget: Budget) => void;
  addBudgetLine: (line: BudgetLine) => void;
  addLoan: (loan: Loan) => void;
  addLoanInstallment: (installment: LoanInstallment) => void;
  payLoanInstallment: (installmentId: string) => void;
  addBankAccount: (account: BankAccount) => void;
  addBankTransaction: (transaction: BankTransaction) => void;
  reconcileBankTransaction: (transactionId: string, matchedId: string) => void;
  addCurrency: (currency: Currency) => void;
  updateExchangeRate: (code: string, rate: number) => void;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  closeFiscalPeriod: (periodId: string) => void;
  updateFiscalPeriodStatus: (periodId: string, status: FiscalPeriod['status']) => void;
  addAIInsight: (insight: AIInsight) => void;
  addOCRDocument: (doc: OCRDocument) => void;
  
  // روال‌های بستن و افتتاح سال مالی
  closeFiscalYear: (year: string) => void;
  openFiscalYear: (year: string, prevYear: string) => void;

  // گزارشات و صحت‌سنجی
  getTrialBalance: () => any[];
  validateTrialBalance: () => { isBalanced: boolean; totalDebit: number; totalCredit: number; difference: number };
  runConsistencyChecks: () => { type: string; message: string; severity: 'warning' | 'error' }[];
  getBalanceSheet: (date: string) => any;
  getIncomeStatement: (startDate: string, endDate: string) => any;
  getAgingReport: () => any[];
  getCashFlowForecast: (days: number) => any[];
  getFinancialRatios: (period: string) => any;
  getProjectProfitability: (projectId: string) => any;
}

export const useFinancialStore = create<FinancialState>()(
  persist(
    (set, get) => ({
      accountingEntries: [],
      chartOfAccounts: [
        { id: '1000', code: '1000', name: 'داراییها', type: 'ASSET', level: 'MAIN', isActive: true },
        { id: '1100', code: '1100', name: 'داراییهای جاری', type: 'ASSET', level: 'SUB', parentId: '1000', isActive: true },
        { id: '1110', code: '1110', name: 'صندوق', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1120', code: '1120', name: 'بانک', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1130', code: '1130', name: 'حسابهای دریافتنی (مشتریان)', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1140', code: '1140', name: 'اسناد دریافتنی نزد صندوق', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1150', code: '1150', name: 'اسناد دریافتنی در جریان وصول', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1160', code: '1160', name: 'موجودی کالا', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1170', code: '1170', name: 'مالیات و عوارض خرید (پیش‌پرداخت)', type: 'ASSET', level: 'DETAIL', parentId: '1100', isActive: true },
        { id: '1200', code: '1200', name: 'داراییهای ثابت', type: 'ASSET', level: 'SUB', parentId: '1000', isActive: true },
        { id: '2000', code: '2000', name: 'بدهیها', type: 'LIABILITY', level: 'MAIN', isActive: true },
        { id: '2100', code: '2100', name: 'بدهیهای جاری', type: 'LIABILITY', level: 'SUB', parentId: '2000', isActive: true },
        { id: '2110', code: '2110', name: 'حسابهای پرداختنی (تامین‌کنندگان)', type: 'LIABILITY', level: 'DETAIL', parentId: '2100', isActive: true },
        { id: '2120', code: '2120', name: 'مالیات بر ارزش افزوده پرداختنی', type: 'LIABILITY', level: 'DETAIL', parentId: '2100', isActive: true },
        { id: '2130', code: '2130', name: 'اسناد پرداختنی', type: 'LIABILITY', level: 'DETAIL', parentId: '2100', isActive: true },
        { id: '3000', code: '3000', name: 'حقوق صاحبان سهام', type: 'EQUITY', level: 'MAIN', isActive: true },
        { id: '3100', code: '3100', name: 'سرمایه ثبتی', type: 'EQUITY', level: 'SUB', parentId: '3000', isActive: true },
        { id: '3200', code: '3200', name: 'سود انباشته (سنواتی)', type: 'EQUITY', level: 'DETAIL', parentId: '3000', isActive: true },
        { id: '3990', code: '3990', name: 'تراز افتتاحیه / اختتامیه', type: 'EQUITY', level: 'DETAIL', parentId: '3000', isActive: true },
        { id: '4000', code: '4000', name: 'درآمدها', type: 'REVENUE', level: 'MAIN', isActive: true },
        { id: '4100', code: '4100', name: 'درآمد فروش', type: 'REVENUE', level: 'SUB', parentId: '4000', isActive: true },
        { id: '4110', code: '4110', name: 'فروش داخلی کالا', type: 'REVENUE', level: 'DETAIL', parentId: '4100', isActive: true },
        { id: '5000', code: '5000', name: 'هزینهها', type: 'EXPENSE', level: 'MAIN', isActive: true },
        { id: '5100', code: '5100', name: 'بهای تمام شده کالای فروش رفته', type: 'EXPENSE', level: 'SUB', parentId: '5000', isActive: true },
        { id: '5110', code: '5110', name: 'بهای تمام شده کالای فروش رفته (جزئی)', type: 'EXPENSE', level: 'DETAIL', parentId: '5100', isActive: true },
        { id: '5200', code: '5200', name: 'هزینههای عملیاتی (اداری و عمومی)', type: 'EXPENSE', level: 'DETAIL', parentId: '5000', isActive: true },
      ],
      taxConfigs: [
        { id: 'vat', name: 'مالیات بر ارزش افزوده', rate: 9, type: 'VAT', isActive: true }
      ],
      taxReports: [],
      cashFlowEntries: [],
      projects: [],
      projectTransactions: [],
      fixedAssets: [],
      budgets: [],
      budgetLines: [],
      loans: [],
      loanInstallments: [],
      bankAccounts: [],
      bankTransactions: [],
      currencies: [
        { code: 'IRR', name: 'ریال', symbol: '﷼', exchangeRate: 1, lastUpdated: getPersianDate() },
        { code: 'USD', name: 'دلار آمریکا', symbol: '$', exchangeRate: 580000, lastUpdated: getPersianDate() },
        { code: 'EUR', name: 'یورو', symbol: '€', exchangeRate: 630000, lastUpdated: getPersianDate() },
      ],
      auditLogs: [],
      fiscalPeriods: [
        // دوره‌های پیش‌فرض سال ۱۴۰۴
        { id: '1404-01', name: 'فروردین ۱۴۰۴', startDate: '1404/01/01', endDate: '1404/01/31', status: 'OPEN' },
        { id: '1404-02', name: 'اردیبهشت ۱۴۰۴', startDate: '1404/02/01', endDate: '1404/02/31', status: 'OPEN' },
        { id: '1404-03', name: 'خرداد ۱۴۰۴', startDate: '1404/03/01', endDate: '1404/03/31', status: 'OPEN' },
        { id: '1404-04', name: 'تیر ۱۴۰۴', startDate: '1404/04/01', endDate: '1404/04/31', status: 'OPEN' },
        { id: '1404-05', name: 'مرداد ۱۴۰۴', startDate: '1404/05/01', endDate: '1404/05/31', status: 'OPEN' },
        { id: '1404-06', name: 'شهریور ۱۴۰۴', startDate: '1404/06/01', endDate: '1404/06/31', status: 'OPEN' },
        { id: '1404-07', name: 'مهر ۱۴۰۴', startDate: '1404/07/01', endDate: '1404/07/30', status: 'OPEN' },
        { id: '1404-08', name: 'آبان ۱۴۰۴', startDate: '1404/08/01', endDate: '1404/08/30', status: 'OPEN' },
        { id: '1404-09', name: 'آذر ۱۴۰۴', startDate: '1404/09/01', endDate: '1404/09/30', status: 'OPEN' },
        { id: '1404-10', name: 'دی ۱۴۰۴', startDate: '1404/10/01', endDate: '1404/10/30', status: 'OPEN' },
        { id: '1404-11', name: 'بهمن ۱۴۰۴', startDate: '1404/11/01', endDate: '1404/11/30', status: 'OPEN' },
        { id: '1404-12', name: 'اسفند ۱۴۰۴', startDate: '1404/12/01', endDate: '1404/12/29', status: 'OPEN' }
      ],
      aiInsights: [],
      ocrDocuments: [],

      // ثبت سند حسابداری با دروازه صحت‌سنجی
      addAccountingEntry: (entry) => {
        const chart = get().chartOfAccounts || [];
        const debitAcc = chart.find(a => a.id === entry.debitAccountId);
        const creditAcc = chart.find(a => a.id === entry.creditAccountId);
        
        if (!debitAcc) throw new Error(`حساب بدهکار نامعتبر: شناسه یافت نشد (${entry.debitAccountId})`);
        if (!creditAcc) throw new Error(`حساب بستانکار نامعتبر: شناسه یافت نشد (${entry.creditAccountId})`);
        if (!entry.amount || entry.amount <= 0) throw new Error(`مبلغ سند حسابداری باید مثبت و بزرگتر از صفر باشد.`);
        
        // بررسی بسته نبودن دوره مالی
        const matchedPeriod = (get().fiscalPeriods || []).find(p => p.startDate <= entry.date && entry.date <= p.endDate);
        if (matchedPeriod && (matchedPeriod.status === 'CLOSED' || matchedPeriod.status === 'LOCKED')) {
          throw new Error(`خطا در ثبت سند: دوره مالی مربوط به تاریخ ${entry.date} بسته یا قفل شده است.`);
        }

        set(s => ({
          accountingEntries: [...s.accountingEntries, { ...entry, id: generateId() }]
        }));
      },

      addChartOfAccount: (account) => set(s => ({
        chartOfAccounts: [...s.chartOfAccounts, account]
      })),

      addTaxReport: (report) => set(s => ({
        taxReports: [...s.taxReports, report]
      })),

      addCashFlowEntry: (entry) => set(s => ({
        cashFlowEntries: [...s.cashFlowEntries, { ...entry, id: generateId() }]
      })),

      addProject: (project) => set(s => ({
        projects: [...s.projects, project]
      })),

      addProjectTransaction: (transaction) => set(s => ({
        projectTransactions: [...s.projectTransactions, transaction]
      })),

      addFixedAsset: (asset) => set(s => ({
        fixedAssets: [...s.fixedAssets, asset]
      })),

      calculateDepreciation: (assetId, date) => {
        const asset = get().fixedAssets.find(a => a.id === assetId);
        if (!asset) return 0;

        if (asset.depreciationMethod === 'STRAIGHT_LINE') {
          return (asset.purchasePrice - asset.salvageValue) / asset.usefulLife / 12;
        }
        return 0;
      },

      addBudget: (budget) => set(s => ({
        budgets: [...s.budgets, budget]
      })),

      addBudgetLine: (line) => set(s => ({
        budgetLines: [...s.budgetLines, line]
      })),

      addLoan: (loan) => set(s => ({
        loans: [...s.loans, loan]
      })),

      addLoanInstallment: (installment) => set(s => ({
        loanInstallments: [...s.loanInstallments, installment]
      })),

      payLoanInstallment: (installmentId) => set(s => ({
        loanInstallments: s.loanInstallments.map(i =>
          i.id === installmentId ? { ...i, status: 'PAID', paidDate: getPersianDate() } : i
        )
      })),

      addBankAccount: (account) => set(s => ({
        bankAccounts: [...s.bankAccounts, account]
      })),

      addBankTransaction: (transaction) => set(s => ({
        bankTransactions: [...s.bankTransactions, transaction]
      })),

      reconcileBankTransaction: (transactionId, matchedId) => set(s => ({
        bankTransactions: s.bankTransactions.map(t =>
          t.id === transactionId ? { ...t, isReconciled: true, matchedTransactionId: matchedId } : t
        )
      })),

      addCurrency: (currency) => set(s => ({
        currencies: [...s.currencies, currency]
      })),

      updateExchangeRate: (code, rate) => set(s => ({
        currencies: s.currencies.map(c =>
          c.code === code ? { ...c, exchangeRate: rate, lastUpdated: getPersianDate() } : c
        )
      })),

      addAuditLog: (log) => set(s => ({
        auditLogs: [...s.auditLogs, { ...log, id: generateId(), timestamp: new Date().toISOString() }]
      })),

      closeFiscalPeriod: (periodId) => set(s => ({
        fiscalPeriods: s.fiscalPeriods.map(p =>
          p.id === periodId ? { ...p, status: 'CLOSED' } : p
        )
      })),

      updateFiscalPeriodStatus: (periodId, status) => set(s => ({
        fiscalPeriods: s.fiscalPeriods.map(p =>
          p.id === periodId ? { ...p, status } : p
        )
      })),

      addAIInsight: (insight) => set(s => ({
        aiInsights: [...s.aiInsights, insight]
      })),

      addOCRDocument: (doc) => set(s => ({
        ocrDocuments: [...s.ocrDocuments, doc]
      })),

      // بستن سال مالی (Year-Closing Procedure)
      closeFiscalYear: (year) => {
        const trial = get().getTrialBalance();
        const accounts = get().chartOfAccounts;
        const currentLocalDate = getPersianDate();

        // 1. یافتن کلیه حساب‌های موقت (درآمدها و هزینه‌ها)
        const temporaryBalances = trial.filter(t => {
          const acc = accounts.find(a => a.id === t.accountId);
          return acc && (acc.type === 'REVENUE' || acc.type === 'EXPENSE');
        });

        if (temporaryBalances.length === 0) return;

        // 2. صدور سند بستن حساب‌های موقت و انتقال سود/زیان به سود انباشته (3200)
        let totalRev = 0;
        let totalExp = 0;

        temporaryBalances.forEach(bal => {
          const acc = accounts.find(a => a.id === bal.accountId);
          if (!acc) return;

          if (acc.type === 'REVENUE') {
            // درآمد بستانکار است، برای بستن آن را بدهکار می‌کنیم
            const amount = Math.abs(bal.balance);
            totalRev += amount;
            get().addAccountingEntry({
              date: `${year}/12/29`,
              description: `سند اختتامیه - بستن حساب موقت درآمد ${acc.name}`,
              debitAccountId: acc.id,
              creditAccountId: '3990', // تراز اختتامیه
              amount,
              documentType: 'CLOSING',
              status: 'POSTED'
            });
          } else if (acc.type === 'EXPENSE') {
            // هزینه بدهکار است، برای بستن آن را بستانکار می‌کنیم
            const amount = Math.abs(bal.balance);
            totalExp += amount;
            get().addAccountingEntry({
              date: `${year}/12/29`,
              description: `سند اختتامیه - بستن حساب موقت هزینه ${acc.name}`,
              debitAccountId: '3990', // تراز اختتامیه
              creditAccountId: acc.id,
              amount,
              documentType: 'CLOSING',
              status: 'POSTED'
            });
          }
        });

        // 3. انتقال مانده تراز اختتامیه به سود/زیان انباشته (3200)
        const netProfit = totalRev - totalExp;
        if (netProfit !== 0) {
          get().addAccountingEntry({
            date: `${year}/12/29`,
            description: `سند اختتامیه - انتقال سود/زیان خالص سال مالی به سود انباشته`,
            debitAccountId: netProfit > 0 ? '3990' : '3200',
            creditAccountId: netProfit > 0 ? '3200' : '3990',
            amount: Math.abs(netProfit),
            documentType: 'CLOSING',
            status: 'POSTED'
          });
        }

        // 4. قفل کردن دوره‌های مالی سال مذکور
        set(s => ({
          fiscalPeriods: s.fiscalPeriods.map(p =>
            p.startDate.startsWith(year) ? { ...p, status: 'LOCKED' } : p
          )
        }));
      },

      // افتتاح سال مالی جدید (Year-Opening Procedure)
      openFiscalYear: (year, prevYear) => {
        const trial = get().getTrialBalance();
        const accounts = get().chartOfAccounts;

        // 1. یافتن مانده حساب‌های دایمی (دارایی، بدهی، حقوق صاحبان سهام)
        const permanentBalances = trial.filter(t => {
          const acc = accounts.find(a => a.id === t.accountId);
          return acc && (acc.type === 'ASSET' || acc.type === 'LIABILITY' || acc.type === 'EQUITY') && acc.id !== '3990';
        });

        // 2. صدور سند افتتاحیه سال جدید در تاریخ اول فروردین سال جدید
        permanentBalances.forEach(bal => {
          const acc = accounts.find(a => a.id === bal.accountId);
          if (!acc || bal.balance === 0) return;

          if (bal.balance > 0) {
            // مانده بدهکار (دارایی‌ها): بدهکار کردن در سال جدید در مقابل حساب تراز افتتاحیه (3990)
            get().addAccountingEntry({
              date: `${year}/01/01`,
              description: `سند افتتاحیه سال مالی ${year} - انتقال مانده بدهکار حساب ${acc.name}`,
              debitAccountId: acc.id,
              creditAccountId: '3990',
              amount: Math.abs(bal.balance),
              documentType: 'OPENING',
              status: 'POSTED'
            });
          } else {
            // مانده بستانکار (بدهی و حقوق صاحبان سهام): بستانکار کردن در سال جدید
            get().addAccountingEntry({
              date: `${year}/01/01`,
              description: `سند افتتاحیه سال مالی ${year} - انتقال مانده بستانکار حساب ${acc.name}`,
              debitAccountId: '3990',
              creditAccountId: acc.id,
              amount: Math.abs(bal.balance),
              documentType: 'OPENING',
              status: 'POSTED'
            });
          }
        });

        // 3. تعریف دوره‌های سال جدید در صورت عدم وجود
        const hasPeriods = get().fiscalPeriods.some(p => p.startDate.startsWith(year));
        if (!hasPeriods) {
          const newPeriods: FiscalPeriod[] = [
            { id: `${year}-01`, name: `فروردین ${year}`, startDate: `${year}/01/01`, endDate: `${year}/01/31`, status: 'OPEN' },
            { id: `${year}-02`, name: `اردیبهشت ${year}`, startDate: `${year}/02/01`, endDate: `${year}/02/31`, status: 'OPEN' },
            { id: `${year}-03`, name: `خرداد ${year}`, startDate: `${year}/03/01`, endDate: `${year}/03/31`, status: 'OPEN' },
            { id: `${year}-04`, name: `تیر ${year}`, startDate: `${year}/04/01`, endDate: `${year}/04/31`, status: 'OPEN' },
            { id: `${year}-05`, name: `مرداد ${year}`, startDate: `${year}/05/01`, endDate: `${year}/05/31`, status: 'OPEN' },
            { id: `${year}-06`, name: `شهریور ${year}`, startDate: `${year}/06/01`, endDate: `${year}/06/31`, status: 'OPEN' },
            { id: `${year}-07`, name: `مهر ${year}`, startDate: `${year}/07/01`, endDate: `${year}/07/30`, status: 'OPEN' },
            { id: `${year}-08`, name: `آبان ${year}`, startDate: `${year}/08/01`, endDate: `${year}/08/30`, status: 'OPEN' },
            { id: `${year}-09`, name: `آذر ${year}`, startDate: `${year}/09/01`, endDate: `${year}/09/30`, status: 'OPEN' },
            { id: `${year}-10`, name: `دی ${year}`, startDate: `${year}/10/01`, endDate: `${year}/10/30`, status: 'OPEN' },
            { id: `${year}-11`, name: `بهمن ${year}`, startDate: `${year}/11/01`, endDate: `${year}/11/30`, status: 'OPEN' },
            { id: `${year}-12`, name: `اسفند ${year}`, startDate: `${year}/12/01`, endDate: `${year}/12/29`, status: 'OPEN' }
          ];
          set(s => ({ fiscalPeriods: [...s.fiscalPeriods, ...newPeriods] }));
        }
      },

      // تراز آزمایشی (Trial Balance Calculation)
      getTrialBalance: () => {
        const entries = get().accountingEntries;
        const accounts = get().chartOfAccounts;
        const balances = new Map();

        entries.forEach(entry => {
          const debit = balances.get(entry.debitAccountId) || { debit: 0, credit: 0 };
          debit.debit += entry.amount;
          balances.set(entry.debitAccountId, debit);

          const credit = balances.get(entry.creditAccountId) || { debit: 0, credit: 0 };
          credit.credit += entry.amount;
          balances.set(entry.creditAccountId, credit);
        });

        return accounts.map(acc => {
          const bal = balances.get(acc.id) || { debit: 0, credit: 0 };
          return {
            accountId: acc.id,
            accountName: acc.name,
            debit: bal.debit,
            credit: bal.credit,
            balance: bal.debit - bal.credit
          };
        });
      },

      // صحت‌سنجی تراز آزمایشی (Trial Balance Integrity Validator)
      validateTrialBalance: () => {
        const trial = get().getTrialBalance();
        const totalDebit = trial.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = trial.reduce((sum, item) => sum + item.credit, 0);
        const diff = totalDebit - totalCredit;

        return {
          isBalanced: Math.abs(diff) < 1,
          totalDebit,
          totalCredit,
          difference: diff
        };
      },

      // ممیزی خودکار یکپارچگی مالی (Automatic Consistency Audits)
      runConsistencyChecks: () => {
        const alerts: { type: string; message: string; severity: 'warning' | 'error' }[] = [];
        const entries = get().accountingEntries;
        const accounts = get().chartOfAccounts;

        // 1. بررسی اقلام یتیم (Orphans checking)
        entries.forEach(entry => {
          const debitExists = accounts.some(a => a.id === entry.debitAccountId);
          const creditExists = accounts.some(a => a.id === entry.creditAccountId);
          if (!debitExists) {
            alerts.push({
              type: 'ORPHAN_ACCOUNT',
              message: `سند مورخ ${entry.date} دارای شناسه حساب بدهکار نامعتبر یا حذف‌شده است (${entry.debitAccountId})`,
              severity: 'error'
            });
          }
          if (!creditExists) {
            alerts.push({
              type: 'ORPHAN_ACCOUNT',
              message: `سند مورخ ${entry.date} دارای شناسه حساب بستانکار نامعتبر یا حذف‌شده است (${entry.creditAccountId})`,
              severity: 'error'
            });
          }
        });

        // 2. بررسی تراز کلی دفتر کل
        const trialStatus = get().validateTrialBalance();
        if (!trialStatus.isBalanced) {
          alerts.push({
            type: 'LEDGER_UNBALANCED',
            message: `دفتر کل کلان غیرتراز است! اختلاف به میزان ${trialStatus.difference.toLocaleString()} ریال`,
            severity: 'error'
          });
        }

        // 3. تطابق حساب‌های معین تفصیلی اشخاص با استور اصلی
        try {
          const people = useStore.getState().people || [];
          people.forEach(p => {
            const ledgerFile = localStorage.getItem(`ledger-${p.id}`);
            if (ledgerFile) {
              const ledger = JSON.parse(ledgerFile);
              const lastBal = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
              if (Math.abs(p.balance - lastBal) > 1) {
                alerts.push({
                  type: 'SUBLEDGER_MISMATCH',
                  message: `اختلاف حساب اشخاص: مانده مشتری ${p.name} در استور (${p.balance.toLocaleString()}) با کاردکس تفصیلی (${lastBal.toLocaleString()}) همخوانی ندارد.`,
                  severity: 'warning'
                });
              }
            }
          });
        } catch (e) {
          // Ignore if store is not loaded yet
        }

        return alerts;
      },

      getBalanceSheet: (date) => {
        const trial = get().getTrialBalance();
        const accounts = get().chartOfAccounts;

        const getTotal = (type: string) =>
          trial
            .filter(t => accounts.find(a => a.id === t.accountId)?.type === type)
            .reduce((sum, t) => sum + Math.abs(t.balance), 0);

        return {
          date,
          assets: {
            current: getTotal('ASSET'),
            fixed: 0,
            total: getTotal('ASSET')
          },
          liabilities: {
            current: getTotal('LIABILITY'),
            longTerm: 0,
            total: getTotal('LIABILITY')
          },
          equity: {
            capital: getTotal('EQUITY'),
            retained: 0,
            total: getTotal('EQUITY')
          }
        };
      },

      getIncomeStatement: (startDate, endDate) => {
        const entries = get().accountingEntries.filter(
          e => e.date >= startDate && e.date <= endDate
        );
        const accounts = get().chartOfAccounts;

        const getTotal = (type: string) =>
          entries
            .filter(e => accounts.find(a => a.id === e.creditAccountId)?.type === type)
            .reduce((sum, e) => sum + e.amount, 0);

        const revenue = getTotal('REVENUE');
        const expenses = getTotal('EXPENSE');

        return {
          period: `${startDate} - ${endDate}`,
          revenue,
          costOfGoodsSold: 0,
          grossProfit: revenue,
          operatingExpenses: expenses,
          operatingIncome: revenue - expenses,
          otherIncome: 0,
          otherExpenses: 0,
          netIncome: revenue - expenses
        };
      },

      getAgingReport: () => {
        return [];
      },

      getCashFlowForecast: (days) => {
        return [];
      },

      getFinancialRatios: (period) => {
        const bs = get().getBalanceSheet(period);
        const is = get().getIncomeStatement(period, period);

        return {
          period,
          currentRatio: bs.assets.current / bs.liabilities.current || 0,
          quickRatio: (bs.assets.current - 0) / bs.liabilities.current || 0,
          debtToEquity: bs.liabilities.total / bs.equity.total || 0,
          returnOnAssets: is.netIncome / bs.assets.total || 0,
          returnOnEquity: is.netIncome / bs.equity.total || 0,
          profitMargin: is.netIncome / is.revenue || 0,
          grossMargin: is.grossProfit / is.revenue || 0
        };
      },

      getProjectProfitability: (projectId) => {
        const transactions = get().projectTransactions.filter(t => t.projectId === projectId);
        const revenue = transactions.filter(t => t.type === 'REVENUE').reduce((s, t) => s + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

        return {
          projectId,
          revenue,
          expenses,
          profit: revenue - expenses,
          profitMargin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0
        };
      }
    }),
    {
      name: 'financial-store-v1'
    }
  )
);
