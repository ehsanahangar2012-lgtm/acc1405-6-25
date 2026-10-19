import { useFinancialStore } from '../store-financial';
import { useStore } from '../store';
import PersonLedgerService from './personLedgerService';
import { Invoice, InvoiceType, Check, CheckTransfer, Transaction } from '../types';
import { AccountingEntry } from '../types-financial';
import { generateId, getPersianDate } from '../utils';

// Normalize both Jalali/ISO-style YYYY/MM/DD dates to a comparable key.
function dateComparisonKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ascii = value.trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const datePart = ascii.split(/[T ]/, 1)[0];
  const parts = datePart.split(/[/-]/);
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) return null;
  const [year, month, day] = parts;
  if (year.length > 4 || month.length > 2 || day.length > 2) return null;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year.padStart(4, '0')}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
}

export class AccountingEngine {
  /**
   * Validate double-entry transaction parameters before appending to the ledger.
   */
  static validateEntry(entry: Omit<AccountingEntry, 'id'>) {
    const finStore = useFinancialStore.getState();
    const chart = finStore.chartOfAccounts || [];

    // 1. Validate accounts existence
    const debitAcc = chart.find(a => a.id === entry.debitAccountId);
    const creditAcc = chart.find(a => a.id === entry.creditAccountId);

    if (!debitAcc) {
      throw new Error(`حساب بدهکار نامعتبر است: شناسه یافت نشد (${entry.debitAccountId})`);
    }
    if (!creditAcc) {
      throw new Error(`حساب بستانکار نامعتبر است: شناسه یافت نشد (${entry.creditAccountId})`);
    }

    // 2. Validate a real positive amount and a meaningful posting date.
    if (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount <= 0) {
      throw new Error(`مبلغ سند حسابداری باید عددی محدود و بزرگتر از صفر باشد: (${entry.amount})`);
    }
    if (typeof entry.date !== 'string' || !entry.date.trim()) {
      throw new Error('تاریخ سند حسابداری الزامی است.');
    }
    if (entry.debitAccountId === entry.creditAccountId) {
      throw new Error('حساب بدهکار و بستانکار نمی‌توانند یکسان باشند.');
    }

    // 3. Prevent posting into closed/locked periods or outside configured periods.
    const date = entry.date;
    const dateKey = dateComparisonKey(date);
    if (!dateKey) {
      throw new Error(`قالب تاریخ سند معتبر نیست: ${date}. قالب مورد انتظار سال/ماه/روز است.`);
    }

    const globalConfig = useStore.getState().config;
    const targetYear = dateKey.slice(0, 4);
    const configuredYear = String(globalConfig.fiscalYear || '').trim();
    const fiscalStartKey = globalConfig.fiscalStartDate ? dateComparisonKey(globalConfig.fiscalStartDate) : null;
    const fiscalEndKey = globalConfig.fiscalEndDate ? dateComparisonKey(globalConfig.fiscalEndDate) : null;
    if (globalConfig.fiscalStartDate && !fiscalStartKey) {
      throw new Error('تاریخ شروع سال مالی در تنظیمات نامعتبر است.');
    }
    if (globalConfig.fiscalEndDate && !fiscalEndKey) {
      throw new Error('تاریخ پایان سال مالی در تنظیمات نامعتبر است.');
    }
    if (fiscalStartKey && fiscalEndKey && (dateKey < fiscalStartKey || dateKey > fiscalEndKey)) {
      throw new Error(`تاریخ ${date} خارج از بازه سال مالی پیکربندی‌شده است.`);
    }

    const periods = finStore.fiscalPeriods || [];
    const matchedPeriod = periods.find(p => {
      const startKey = dateComparisonKey(p.startDate);
      const endKey = dateComparisonKey(p.endDate);
      return Boolean(startKey && endKey && startKey <= dateKey && dateKey <= endKey);
    });

    if (!matchedPeriod) {
      const targetYearHasPeriods = periods.some(period =>
        dateComparisonKey(period.startDate)?.slice(0, 4) === targetYear
      );
      const currentYear = dateComparisonKey(getPersianDate())?.slice(0, 4);
      // Legacy/default stores only carried 1404 periods. Do not reject invoices dated
      // in the current Jalali year solely because its monthly periods were never opened.
      // A year that already has periods is treated strictly, so gaps and closed periods
      // are not bypassed.
      const mayUseUninitializedCurrentYear =
        !targetYearHasPeriods &&
        targetYear === currentYear &&
        (!configuredYear || configuredYear === targetYear);

      if (!mayUseUninitializedCurrentYear) {
        const currentConfiguredYear = configuredYear || 'تنظیم‌نشده';
        throw new Error(
          `برای تاریخ ${date} دورهٔ مالیِ باز پیدا نشد. سال مالی فعال: ${currentConfiguredYear}؛ از بخش سال مالی، سال موردنظر را افتتاح یا بازهٔ آن را اصلاح کنید.`
        );
      }
    }
    if (matchedPeriod && (matchedPeriod.status === 'CLOSED' || matchedPeriod.status === 'LOCKED')) {
      throw new Error(`خطای انطباق: دوره مالی مربوط به تاریخ ${date} بسته یا قفل شده است.`);
    }
    const fiscalStartKey = globalConfig.fiscalStartDate ? dateComparisonKey(globalConfig.fiscalStartDate) : null;
    const fiscalEndKey = globalConfig.fiscalEndDate ? dateComparisonKey(globalConfig.fiscalEndDate) : null;
    if (globalConfig.fiscalStartDate && !fiscalStartKey) {
      throw new Error('تاریخ شروع سال مالی در تنظیمات نامعتبر است.');
    }
    if (globalConfig.fiscalEndDate && !fiscalEndKey) {
      throw new Error('تاریخ پایان سال مالی در تنظیمات نامعتبر است.');
    }
    if (fiscalStartKey && fiscalEndKey && (dateKey < fiscalStartKey || dateKey > fiscalEndKey)) {
      throw new Error(`تاریخ ${date} خارج از بازه سال مالی پیکربندی‌شده است.`);
    }

    return true;
  }

  /**
   * Post a balanced double-entry transaction directly to the financial store.
   */
  static postDoubleEntry(
    date: string,
    description: string,
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    referenceId?: string,
    referenceType?: string,
    documentType: AccountingEntry['documentType'] = 'OPERATIONAL'
  ): string {
    if (amount <= 0) return '';

    const entryData: Omit<AccountingEntry, 'id'> = {
      date,
      description,
      debitAccountId,
      creditAccountId,
      amount,
      referenceId,
      referenceType,
      documentType,
      status: 'APPROVED',
      fiscalYear: useStore.getState().config.fiscalYear || '1404'
    };

    // Run validation checks
    this.validateEntry(entryData);

    const newId = generateId();
    useFinancialStore.setState(s => ({
      accountingEntries: [...s.accountingEntries, { ...entryData, id: newId }]
    }));

    return newId;
  }

  /**
   * Reverses previous ledger entries for a specific document reference (Storno / سند اصلاحی برگشتی).
   * Swaps debit and credit accounts, keeping the amount and reference metadata.
   */
  static postStornoReversal(referenceId: string, referenceType: string) {
    const finStore = useFinancialStore.getState();
    const entries = finStore.accountingEntries || [];

    // Select source entries that have not already received a storno entry.
    // The source-id marker makes repeated status changes idempotent.
    const matches = entries.filter(e => {
      if (e.referenceId !== referenceId ||
          e.referenceType !== referenceType ||
          e.description.startsWith('[اصلاحی - برگشتی]')) {
        return false;
      }

      const marker = `[REVERSAL_OF:${e.id}]`;
      const hasMarkedReversal = entries.some(reversal =>
        reversal.referenceId === referenceId &&
        reversal.referenceType === referenceType &&
        reversal.description.includes(marker)
      );
      if (hasMarkedReversal) return false;

      // Recognize legacy reversals created before source IDs were recorded.
      const legacyDescription = `[اصلاحی - برگشتی] بابت ${e.description}`;
      const hasLegacyReversal = entries.some(reversal =>
        reversal.referenceId === referenceId &&
        reversal.referenceType === referenceType &&
        reversal.description === legacyDescription &&
        reversal.debitAccountId === e.creditAccountId &&
        reversal.creditAccountId === e.debitAccountId &&
        reversal.amount === e.amount
      );
      return !hasLegacyReversal;
    });

    if (matches.length === 0) return;

    const currentLocalDate = getPersianDate();
    const stornoEntries: AccountingEntry[] = [];

    matches.forEach(match => {
      const stornoId = generateId();
      const stornoEntry: AccountingEntry = {
        id: stornoId,
        date: currentLocalDate,
        description: `[اصلاحی - برگشتی] بابت ${match.description} [REVERSAL_OF:${match.id}]`,
        debitAccountId: match.creditAccountId, // Swap accounts
        creditAccountId: match.debitAccountId,
        amount: match.amount,
        referenceId: match.referenceId,
        referenceType: match.referenceType,
        documentType: match.documentType,
        fiscalYear: match.fiscalYear,
        status: 'APPROVED'
      };

      // Validate the reversal entry before posting
      this.validateEntry(stornoEntry);
      stornoEntries.push(stornoEntry);
    });

    useFinancialStore.setState(s => ({
      accountingEntries: [...s.accountingEntries, ...stornoEntries]
    }));
  }

  /**
   * Post dynamic double-entry transactions for Invoices.
   */
  static postInvoice(invoice: Invoice) {
    // Keep a rollback point: a failure must not erase the previous posting or leave half a document.
    let previousEntries = [...(useFinancialStore.getState().accountingEntries || [])];
    const personId = invoice.personId;
    let previousLedgerCache: string | null = null;
    if (personId && typeof window !== 'undefined') {
      try { previousLedgerCache = localStorage.getItem(`ledger-${personId}`); } catch {}
    }

    let embeddedCashAmount = Number(invoice.cashAmount || 0);
    let embeddedCheckAmount = Number(invoice.checkAmount || 0);

    try {
    // Reject malformed invoice totals before removing any previously posted journal.
    if (invoice.type === InvoiceType.SALE || invoice.type === InvoiceType.PURCHASE) {
      const subtotal = Number(invoice.subTotal);
      const discount = Number(invoice.discount || 0);
      const tax = Number(invoice.tax || 0);
      const cashAmount = Number(invoice.cashAmount || 0);
      const checkAmount = Number(invoice.checkAmount || 0);
      const finalTotal = Number(invoice.finalTotal);
      const netAmount = subtotal - discount;
      const separatelyPostedPayments = (invoice.payments || []).filter(payment => payment.accountingPosted === true);
      const separatelyPostedCash = separatelyPostedPayments
        .filter(payment => payment.method !== 'CHECK')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const separatelyPostedChecks = separatelyPostedPayments
        .filter(payment => payment.method === 'CHECK')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      if (!Number.isFinite(netAmount) || netAmount <= 0 ||
          !Number.isFinite(tax) || tax < 0 ||
          !Number.isFinite(cashAmount) || cashAmount < 0 ||
          !Number.isFinite(checkAmount) || checkAmount < 0 ||
          !Number.isFinite(finalTotal) || finalTotal <= 0 ||
          !Number.isFinite(separatelyPostedCash) || separatelyPostedCash < 0 ||
          !Number.isFinite(separatelyPostedChecks) || separatelyPostedChecks < 0 ||
          separatelyPostedCash > cashAmount || separatelyPostedChecks > checkAmount) {
        throw new Error('مبالغ فاکتور نامعتبر است؛ مبلغ خالص، مالیات، پرداخت و جمع نهایی را بررسی کنید.');
      }

      embeddedCashAmount = cashAmount - separatelyPostedCash;
      embeddedCheckAmount = checkAmount - separatelyPostedChecks;
    }

    // Snapshot after input validation. The compatibility rule above permits current-year
    // invoices without prior monthly periods, but deliberately does not create/close a year.
    // Preserve any pre-existing entries while rolling back a failed invoice posting.
    previousEntries = [...(useFinancialStore.getState().accountingEntries || [])];

    // Keep the accounting audit trail: reverse any currently active postings first,
    // then append the replacement invoice entries. The catch below restores the snapshot
    // if any part of the correction fails.
    this.postStornoReversal(invoice.id, 'INVOICE');
    
    if (invoice.personId) {
      PersonLedgerService.removeByReference(invoice.personId, invoice.id);
    }

    const docDescription = `فاکتور ${invoice.type} شماره ${invoice.number} - ${invoice.personName}`;

    if (invoice.type === InvoiceType.SALE) {
      // Debit: Accounts Receivable (1130)
      // Credit: Sales (4110)
      this.postDoubleEntry(
        invoice.date,
        `${docDescription} - درآمد فروش`,
        '1130',
        '4110',
        invoice.subTotal - invoice.discount,
        invoice.id,
        'INVOICE'
      );

      // Credit: VAT Payable (2120)
      if (invoice.tax > 0) {
        this.postDoubleEntry(
          invoice.date,
          `${docDescription} - ارزش افزوده پرداختنی`,
          '1130',
          '2120',
          invoice.tax,
          invoice.id,
          'INVOICE'
        );
      }

      // Cash payments
      if (embeddedCashAmount > 0) {
        // Initial/legacy payment amounts are embedded in the invoice date journal.
        this.postDoubleEntry(
          invoice.date,
          `دریافت نقدی بابت ${docDescription}`,
          '1110',
          '1130',
          embeddedCashAmount,
          invoice.id,
          'INVOICE'
        );
      }

      // Check receipts reduce customer receivables and increase checks held.
      if (embeddedCheckAmount > 0) {
        this.postDoubleEntry(
          invoice.date,
          `دریافت چک بابت ${docDescription}`,
          '1140',
          '1130',
          embeddedCheckAmount,
          invoice.id,
          'INVOICE'
        );
      }

      // Sub-ledger updates
      if (invoice.personId) {
        PersonLedgerService.addEntry(invoice.personId, {
          date: invoice.date,
          type: 'INVOICE',
          referenceId: invoice.id,
          referenceNumber: String(invoice.number),
          description: `فاکتور فروش شماره ${invoice.number}`,
          debit: invoice.finalTotal,
          credit: 0
        });

        if (invoice.cashAmount > 0) {
          PersonLedgerService.addEntry(invoice.personId, {
            date: invoice.date,
            type: 'PAYMENT',
            referenceId: invoice.id,
            referenceNumber: `CSH-${invoice.number}`,
            description: `دریافت نقدی فاکتور`,
            debit: 0,
            credit: invoice.cashAmount,
            relatedInvoiceId: invoice.id
          });
        }

        if (invoice.checkAmount > 0) {
          PersonLedgerService.addEntry(invoice.personId, {
            date: invoice.date,
            type: 'CHECK',
            referenceId: invoice.id,
            referenceNumber: `CHK-${invoice.number}`,
            description: `دریافت چک بابت فاکتور`,
            debit: 0,
            credit: invoice.checkAmount,
            relatedInvoiceId: invoice.id
          });
        }
      }
    } else if (invoice.type === InvoiceType.PURCHASE) {
      // Debit: Inventory (1160)
      // Credit: Accounts Payable (2110)
      this.postDoubleEntry(
        invoice.date,
        `${docDescription} - خرید و ورود کالا`,
        '1160',
        '2110',
        invoice.subTotal - invoice.discount,
        invoice.id,
        'INVOICE'
      );

      // Debit: VAT Receivable (1170)
      if (invoice.tax > 0) {
        this.postDoubleEntry(
          invoice.date,
          `${docDescription} - مالیات خرید (پیش‌پرداخت)`,
          '1170',
          '2110',
          invoice.tax,
          invoice.id,
          'INVOICE'
        );
      }

      // Cash payments
      if (embeddedCashAmount > 0) {
        // Initial/legacy payment amounts are embedded in the invoice date journal.
        this.postDoubleEntry(
          invoice.date,
          `پرداخت نقدی بابت ${docDescription}`,
          '2110',
          '1110',
          embeddedCashAmount,
          invoice.id,
          'INVOICE'
        );
      }

      // Issued checks reduce accounts payable and increase check liabilities.
      if (embeddedCheckAmount > 0) {
        this.postDoubleEntry(
          invoice.date,
          `پرداخت چک بابت ${docDescription}`,
          '2110',
          '2130',
          embeddedCheckAmount,
          invoice.id,
          'INVOICE'
        );
      }

      // Sub-ledger updates
      if (invoice.personId) {
        PersonLedgerService.addEntry(invoice.personId, {
          date: invoice.date,
          type: 'INVOICE',
          referenceId: invoice.id,
          referenceNumber: String(invoice.number),
          description: `فاکتور خرید شماره ${invoice.number}`,
          debit: 0,
          credit: invoice.finalTotal
        });

        if (invoice.cashAmount > 0) {
          PersonLedgerService.addEntry(invoice.personId, {
            date: invoice.date,
            type: 'PAYMENT',
            referenceId: invoice.id,
            referenceNumber: `CSH-${invoice.number}`,
            description: `پرداخت نقدی فاکتور`,
            debit: invoice.cashAmount,
            credit: 0,
            relatedInvoiceId: invoice.id
          });
        }

        if (invoice.checkAmount > 0) {
          PersonLedgerService.addEntry(invoice.personId, {
            date: invoice.date,
            type: 'CHECK',
            referenceId: invoice.id,
            referenceNumber: `CHK-${invoice.number}`,
            description: `پرداخت چک بابت فاکتور`,
            debit: invoice.checkAmount,
            credit: 0,
            relatedInvoiceId: invoice.id
          });
        }
      }
    }

    // Refresh sub-ledger balance in store
    this.refreshPersonBalance(invoice.personId);
    } catch (error) {
      useFinancialStore.setState({ accountingEntries: previousEntries });
      if (personId && typeof window !== 'undefined') {
        try {
          if (previousLedgerCache === null) localStorage.removeItem(`ledger-${personId}`);
          else localStorage.setItem(`ledger-${personId}`, previousLedgerCache);
        } catch {}
      }
      throw error;
    }
  }

  /**
   * Post check operations.
   */
  static postCheck(check: Check, personId?: string) {
    return this.withPostingRollback([personId || check.personId], () => {
    if (!Number.isFinite(check.amount) || check.amount <= 0) {
      throw new Error('مبلغ چک باید عددی معتبر و بزرگ‌تر از صفر باشد.');
    }
    const targetPersonId = personId || check.personId;
    this.postStornoReversal(check.id, 'CHECK');
    
    if (targetPersonId) {
      PersonLedgerService.removeByReference(targetPersonId, check.id);
    }

    const isReceived = check.checkType === 'RECEIVED' || !check.checkType;

    if (isReceived) {
      // Received Check: Debit Received Check Asset (1140) / Credit Accounts Receivable (1130)
      this.postDoubleEntry(
        check.dueDate,
        `دریافت چک صیادی شماره ${check.checkNumber || ''} ${check.bankName} - نزد صندوق`,
        '1140',
        '1130',
        check.amount,
        check.id,
        'CHECK'
      );

      if (targetPersonId) {
        PersonLedgerService.addEntry(targetPersonId, {
          date: check.dueDate,
          type: 'CHECK',
          referenceId: check.id,
          referenceNumber: check.sayadId ? check.sayadId.slice(0, 8) : '',
          description: `دریافت چک ${check.bankName}`,
          debit: 0,
          credit: check.amount
        });
      }
    } else {
      // Issued Check: Debit Accounts Payable (2110) / Credit Issued Check Liability (2130)
      this.postDoubleEntry(
        check.dueDate,
        `پرداخت چک صیادی شماره ${check.checkNumber || ''} ${check.bankName} - اسناد پرداختنی`,
        '2110',
        '2130',
        check.amount,
        check.id,
        'CHECK'
      );

      if (targetPersonId) {
        PersonLedgerService.addEntry(targetPersonId, {
          date: check.dueDate,
          type: 'CHECK',
          referenceId: check.id,
          referenceNumber: check.sayadId ? check.sayadId.slice(0, 8) : '',
          description: `پرداخت چک ${check.bankName}`,
          debit: check.amount,
          credit: 0
        });
      }
    }

    this.refreshPersonBalance(targetPersonId);
    });
  }

  /**
   * Post check status transitions.
   */
  static postCheckStatusChange(check: Check, status: Check['status']) {
    return this.withPostingRollback([check.personId], () => {
    if (!Number.isFinite(check.amount) || check.amount <= 0) {
      throw new Error('مبلغ چک باید عددی معتبر و بزرگ‌تر از صفر باشد.');
    }
    // Reverse previous check status changes
    this.postStornoReversal(check.id, 'CHECK_STATUS');

    const isReceived = check.checkType === 'RECEIVED' || !check.checkType;
    const currentLocalDate = getPersianDate();

    // Check if check has ever been deposited in history
    const entries = useFinancialStore.getState().accountingEntries || [];
    const wasDeposited = entries.some(
      e => e.referenceId === check.id && e.debitAccountId === '1150' && !e.description.startsWith('[اصلاحی')
    );

    if (status === 'DEPOSITED') {
      if (isReceived) {
        // Debit: Checks in Transit (1150) / Credit: Checks in Hand (1140)
        this.postDoubleEntry(
          currentLocalDate,
          `واگذاری چک شماره ${check.checkNumber || ''} ${check.bankName} به بانک`,
          '1150',
          '1140',
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      }
    } else if (status === 'PASSED' || status === 'CASHED') {
      if (isReceived) {
        // Debit Bank (1120) / Credit Transit Checks (1150) or Checks in Hand (1140)
        const creditAccount = wasDeposited ? '1150' : '1140';
        this.postDoubleEntry(
          currentLocalDate,
          `وصول چک دریافتی شماره ${check.checkNumber || ''} ${check.bankName} به بانک`,
          '1120',
          creditAccount,
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      } else {
        // Debit Issued Checks (2130) / Credit Bank (1120)
        this.postDoubleEntry(
          currentLocalDate,
          `وصول چک پرداختی شماره ${check.checkNumber || ''} ${check.bankName} از بانک`,
          '2130',
          '1120',
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      }
    } else if (status === 'BOUNCED') {
      if (isReceived) {
        // Debit Customer Accounts Receivable (1130) / Credit Check Asset
        const creditAccount = wasDeposited ? '1150' : '1140';
        this.postDoubleEntry(
          currentLocalDate,
          `برگشت خوردن چک شماره ${check.checkNumber || ''} ${check.bankName}`,
          '1130',
          creditAccount,
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      } else {
        // Debit Issued Checks (2130) / Credit Accounts Payable (2110)
        this.postDoubleEntry(
          currentLocalDate,
          `برگشت خوردن چک پرداختی شماره ${check.checkNumber || ''} ${check.bankName}`,
          '2130',
          '2110',
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      }
    } else if (status === 'RETURNED') {
      if (isReceived) {
        // Debit Accounts Receivable (1130) / Credit Checks in Hand (1140)
        this.postDoubleEntry(
          currentLocalDate,
          `عودت چک دریافتی شماره ${check.checkNumber || ''} ${check.bankName}`,
          '1130',
          '1140',
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      } else {
        // Debit Issued Checks (2130) / Credit Accounts Payable (2110)
        this.postDoubleEntry(
          currentLocalDate,
          `عودت چک پرداختی شماره ${check.checkNumber || ''} ${check.bankName}`,
          '2130',
          '2110',
          check.amount,
          check.id,
          'CHECK_STATUS'
        );
      }
    }
    });
  }

  /**
   * Post Check Transfers (خرج چک).
   */
  static postCheckTransfer(transfer: CheckTransfer) {
    return this.withPostingRollback([transfer.personId], () => {
    this.postStornoReversal(transfer.id, 'CHECK_TRANSFER');

    const totalAmount = transfer.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new Error('مبلغ واگذاری چک باید عددی معتبر و بزرگ‌تر از صفر باشد.');
    }

    // Debit: Accounts Payable (2110) / Credit: Checks in Hand (1140)
    this.postDoubleEntry(
      transfer.date,
      `واگذاری ${transfer.checkIds.length} فقره چک به ${transfer.personName} (سند ${transfer.number})`,
      '2110',
      '1140',
      totalAmount,
      transfer.id,
      'CHECK_TRANSFER'
    );

    // Cancel pending statuses on the transferred checks
    const finStore = useFinancialStore.getState();
    transfer.checkIds.forEach(cid => {
      this.postStornoReversal(cid, 'CHECK_STATUS');
    });

    this.refreshPersonBalance(transfer.personId);
    });
  }

  /**
   * Post a later invoice settlement on the actual payment date instead of rewriting
   * the original invoice-date journal. Its reference is the payment transaction ID.
   */
  static postInvoicePayment(
    invoice: Invoice,
    payment: Pick<Transaction, 'id' | 'date' | 'amount' | 'description'>,
    method: 'CASH' | 'POS' | 'CARD' | 'CHECK'
  ) {
    return this.withPostingRollback([invoice.personId], () => {
      if (invoice.type !== InvoiceType.SALE && invoice.type !== InvoiceType.PURCHASE) {
        throw new Error('برای پیش‌فاکتور یا سند غیرمالی نمی‌توان پرداخت ثبت کرد.');
      }
      if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
        throw new Error('مبلغ پرداخت باید عددی معتبر و بزرگ‌تر از صفر باشد.');
      }
      if (typeof payment.date !== 'string' || !payment.date.trim()) {
        throw new Error('تاریخ پرداخت الزامی است.');
      }

      this.postStornoReversal(payment.id, 'INVOICE_PAYMENT');

      const isSale = invoice.type === InvoiceType.SALE;
      const debitAccount = isSale
        ? (method === 'CHECK' ? '1140' : '1110')
        : '2110';
      const creditAccount = isSale
        ? '1130'
        : (method === 'CHECK' ? '2130' : '1110');
      const methodLabel = method === 'CHECK' ? 'چک' :
        method === 'POS' ? 'کارتخوان' :
        method === 'CARD' ? 'کارت‌به‌کارت' : 'نقدی';

      this.postDoubleEntry(
        payment.date,
        `${isSale ? 'دریافت' : 'پرداخت'} ${methodLabel} بابت فاکتور ${invoice.number}: ${payment.description || ''}`.trim(),
        debitAccount,
        creditAccount,
        payment.amount,
        payment.id,
        'INVOICE_PAYMENT'
      );
    });
  }

  /**
   * Reverse an invoice and its separately posted payment journals in one transaction.
   */
  static reverseInvoiceAndPayments(invoice: Invoice, relatedTransactions: Transaction[]) {
    return this.withPostingRollback(
      [invoice.personId, ...relatedTransactions.map(transaction => transaction.personId)],
      () => {
        this.postStornoReversal(invoice.id, 'INVOICE');
        relatedTransactions.forEach(transaction => {
          this.postStornoReversal(transaction.id, 'INVOICE_PAYMENT');
          // Reverse legacy linked-finance entries created before invoice payments
          // received their own INVOICE_PAYMENT reference type.
          this.postStornoReversal(transaction.id, 'TRANSACTION');
        });

        // A payment made by cheque also has its own check journal and status history.
        const linkedChecks = (useStore.getState().checks || []).filter(check =>
          check.relatedInvoiceId === invoice.id
        );
        linkedChecks.forEach(check => {
          this.postStornoReversal(check.id, 'CHECK');
          this.postStornoReversal(check.id, 'CHECK_STATUS');
        });
      }
    );
  }

  /**
   * Reverse a transaction and any linked check journals before its source is deleted.
   */
  static reverseTransactionAndCheck(trans: Transaction, check?: Check) {
    return this.withPostingRollback([trans.personId, check?.personId], () => {
      this.postStornoReversal(trans.id, 'INVOICE_PAYMENT');
      this.postStornoReversal(trans.id, 'TRANSACTION');
      if (check) {
        this.postStornoReversal(check.id, 'CHECK');
        this.postStornoReversal(check.id, 'CHECK_STATUS');
      }
      if (trans.personId) {
        PersonLedgerService.removeByReference(trans.personId, trans.id);
      }
      if (check?.personId) {
        PersonLedgerService.removeByReference(check.personId, check.id);
      }
    });
  }

  /**
   * Reverse a check-transfer document and its affected check-status postings atomically.
   */
  static reverseCheckTransfer(transfer: CheckTransfer) {
    return this.withPostingRollback([transfer.personId], () => {
      this.postStornoReversal(transfer.id, 'CHECK_TRANSFER');
      transfer.checkIds.forEach(checkId => {
        this.postStornoReversal(checkId, 'CHECK_STATUS');
      });
      if (transfer.personId) {
        PersonLedgerService.removeByReference(transfer.personId, transfer.id);
      }
    });
  }

  /**
   * Reverse a financial transaction before its source record is deleted.
   */
  static reverseGeneralTransaction(trans: Transaction) {
    return this.withPostingRollback([trans.personId], () => {
      this.postStornoReversal(trans.id, 'INVOICE_PAYMENT');
      this.postStornoReversal(trans.id, 'TRANSACTION');
      if (trans.personId) {
        PersonLedgerService.removeByReference(trans.personId, trans.id);
      }
    });
  }

  /**
   * Post General Income/Expense Transactions.
   */
  static postGeneralTransaction(trans: Transaction) {
    return this.withPostingRollback([trans.personId], () => {
    if (!Number.isFinite(trans.amount) || trans.amount <= 0) {
      throw new Error('مبلغ تراکنش مالی باید عددی معتبر و بزرگ‌تر از صفر باشد.');
    }
    this.postStornoReversal(trans.id, 'TRANSACTION');

    if (trans.personId) {
      PersonLedgerService.removeByReference(trans.personId, trans.id);
      
      PersonLedgerService.addEntry(trans.personId, {
        date: trans.date,
        type: 'PAYMENT',
        referenceId: trans.id,
        referenceNumber: trans.trackingCode || '',
        description: trans.description,
        debit: trans.isDebit ? trans.amount : 0,
        credit: !trans.isDebit ? trans.amount : 0,
        relatedInvoiceId: trans.relatedInvoiceId
      });
    }

    // Double entry posting
    if (trans.isDebit) {
      // Expense / Payment
      if (trans.personId) {
        // Paid to vendor: Debit Accounts Payable (2110) / Credit Cash (1110)
        this.postDoubleEntry(trans.date, trans.description, '2110', '1110', trans.amount, trans.id, 'TRANSACTION');
      } else {
        // Direct expense: Debit Operating Expenses (5200) / Credit Cash (1110)
        this.postDoubleEntry(trans.date, trans.description, '5200', '1110', trans.amount, trans.id, 'TRANSACTION');
      }
    } else {
      // Income / Receipt
      if (trans.personId) {
        // Received from customer: Debit Cash (1110) / Credit Accounts Receivable (1130)
        this.postDoubleEntry(trans.date, trans.description, '1110', '1130', trans.amount, trans.id, 'TRANSACTION');
      } else {
        // Direct revenue: Debit Cash (1110) / Credit Sales Revenue (4100)
        this.postDoubleEntry(trans.date, trans.description, '1110', '4100', trans.amount, trans.id, 'TRANSACTION');
      }
    }

    this.refreshPersonBalance(trans.personId);
    });
  }

  /**
   * Run a compound journal/ledger operation atomically from the UI's perspective.
   * If any journal validation fails, restore every mutated journal entry, affected
   * person-ledger cache, and person balance before propagating the error.
   */
  private static withPostingRollback<T>(personIds: Array<string | undefined>, operation: () => T): T {
    const previousEntries = [...(useFinancialStore.getState().accountingEntries || [])];
    const previousPeople = [...(useStore.getState().people || [])];
    const ledgerSnapshots = new Map<string, string | null>();
    const ids = [...new Set(personIds.filter((id): id is string => Boolean(id)))];

    if (typeof window !== 'undefined') {
      for (const id of ids) {
        try {
          ledgerSnapshots.set(id, localStorage.getItem(`ledger-${id}`));
        } catch {}
      }
    }

    try {
      return operation();
    } catch (error) {
      useFinancialStore.setState({ accountingEntries: previousEntries });
      if (typeof window !== 'undefined') {
        for (const [id, raw] of ledgerSnapshots) {
          try {
            if (raw === null) localStorage.removeItem(`ledger-${id}`);
            else localStorage.setItem(`ledger-${id}`, raw);
          } catch {}
        }
      }
      try {
        useStore.setState({ people: previousPeople });
      } catch {}
      throw error;
    }
  }

  /**
   * Helper to recalculate a person's balance from their sub-ledger.
   */
  private static refreshPersonBalance(personId?: string) {
    if (!personId) return;
    try {
      useStore.setState((s) => {
        const updatedPeople = s.people.map(p => 
          p.id === personId ? { ...p, balance: PersonLedgerService.getBalance(personId) } : p
        );
        return { people: updatedPeople };
      });
    } catch (err) {
      console.error('Error refreshing person ledger balance:', err);
    }
  }
}
