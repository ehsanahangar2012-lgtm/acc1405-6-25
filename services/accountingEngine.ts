import { useFinancialStore } from '../store-financial';
import { useStore } from '../store';
import PersonLedgerService from './personLedgerService';
import { Invoice, InvoiceType, Check, CheckTransfer, Transaction } from '../types';
import { AccountingEntry } from '../types-financial';
import { generateId, getPersianDate } from '../utils';

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

    // 2. Validate non-zero positive amounts
    if (!entry.amount || entry.amount <= 0) {
      throw new Error(`مبلغ سند حسابداری باید بزرگتر از صفر باشد: (${entry.amount})`);
    }

    // 3. Validate fiscal period rules
    const date = entry.date;
    const periods = finStore.fiscalPeriods || [];
    
    // Find matching fiscal period
    const matchedPeriod = periods.find(p => p.startDate <= date && date <= p.endDate);
    if (matchedPeriod && (matchedPeriod.status === 'CLOSED' || matchedPeriod.status === 'LOCKED')) {
      throw new Error(`خطای انطباق: دوره مالی مربوط به تاریخ ${date} بسته یا قفل شده است.`);
    }

    // Check against global fiscal config if store periods are empty
    const globalConfig = useStore.getState().config;
    if (globalConfig.fiscalStartDate && globalConfig.fiscalEndDate) {
      if (date < globalConfig.fiscalStartDate || date > globalConfig.fiscalEndDate) {
        // Warning or error for out of boundary posting
        console.warn(`پست خارج از بازه سال مالی پیکربندی شده: ${date}`);
      }
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

    // Find all matching entries that have not already been reversed
    const matches = entries.filter(e => 
      e.referenceId === referenceId && 
      e.referenceType === referenceType &&
      !e.description.startsWith('[اصلاحی - برگشتی]')
    );

    if (matches.length === 0) return;

    const currentLocalDate = getPersianDate();
    const stornoEntries: AccountingEntry[] = [];

    matches.forEach(match => {
      const stornoId = generateId();
      const stornoEntry: AccountingEntry = {
        id: stornoId,
        date: currentLocalDate,
        description: `[اصلاحی - برگشتی] بابت ${match.description}`,
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
    // در سند اصلاحی، سند قبل حذف و سند جدید به طور کامل جایگزین می‌شود
    useFinancialStore.setState(s => ({
      accountingEntries: s.accountingEntries.filter(e => e.referenceId !== invoice.id)
    }));
    
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
      if (invoice.cashAmount > 0) {
        // Debit: Cash (1110) / Credit: Accounts Receivable (1130)
        this.postDoubleEntry(
          invoice.date,
          `دریافت نقدی بابت ${docDescription}`,
          '1110',
          '1130',
          invoice.cashAmount,
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
      if (invoice.cashAmount > 0) {
        // Debit: Accounts Payable (2110) / Credit: Cash (1110)
        this.postDoubleEntry(
          invoice.date,
          `پرداخت نقدی بابت ${docDescription}`,
          '2110',
          '1110',
          invoice.cashAmount,
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
  }

  /**
   * Post check operations.
   */
  static postCheck(check: Check, personId?: string) {
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
  }

  /**
   * Post check status transitions.
   */
  static postCheckStatusChange(check: Check, status: Check['status']) {
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
  }

  /**
   * Post Check Transfers (خرج چک).
   */
  static postCheckTransfer(transfer: CheckTransfer) {
    this.postStornoReversal(transfer.id, 'CHECK_TRANSFER');

    const totalAmount = transfer.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    if (totalAmount <= 0) return;

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
  }

  /**
   * Post General Income/Expense Transactions.
   */
  static postGeneralTransaction(trans: Transaction) {
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
