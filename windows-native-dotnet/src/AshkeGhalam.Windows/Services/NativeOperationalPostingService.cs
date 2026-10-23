using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Creates idempotent, paired journal entries for native operational records.
/// Posting metadata is stored in ReferenceType/ReferenceId so old schema-v1 files remain readable.
/// Each posting is a debit-credit pair of exactly the same amount; corrections are reversal entries.
/// </summary>
public static class NativeOperationalPostingService
{
    private static readonly (string Code, string Name, string Type)[] RequiredAccounts =
    [
        ("1000", "صندوق", "ASSET"),
        ("1010", "بانک", "ASSET"),
        ("1020", "اسناد دریافتنی", "ASSET"),
        ("1100", "حساب‌های دریافتنی", "ASSET"),
        ("1200", "موجودی کالا", "ASSET"),
        ("1300", "مالیات و عوارض خرید", "ASSET"),
        ("2000", "حساب‌های پرداختنی", "LIABILITY"),
        ("2020", "اسناد پرداختنی", "LIABILITY"),
        ("2100", "مالیات و عوارض پرداختنی", "LIABILITY"),
        ("3000", "سرمایه", "EQUITY"),
        ("3100", "سود و زیان انباشته", "EQUITY"),
        ("4000", "درآمد فروش", "REVENUE"),
        ("4100", "سایر درآمدها", "REVENUE"),
        ("5000", "بهای تمام‌شده کالای فروش‌رفته", "EXPENSE"),
        ("5100", "هزینه حقوق و دستمزد", "EXPENSE"),
        ("5200", "هزینه اجاره", "EXPENSE"),
        ("5300", "هزینه‌های اداری و عملیاتی", "EXPENSE"),
        ("5400", "مالیات و عوارض هزینه‌ای", "EXPENSE")
    ];

    public static void Reconcile(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        var hasPostableOperations =
            data.Invoices.Any(i => i.Type is "SALE" or "PURCHASE") ||
            data.Payments.Count > 0 ||
            data.Expenses.Count > 0;
        if (!hasPostableOperations)
            return;

        EnsureRequiredAccounts(data);

        foreach (var invoice in data.Invoices.OrderBy(i => i.CreatedAt).ThenBy(i => i.Number))
        {
            if (invoice.Type == "PROFORMA")
                continue;

            if (invoice.Status == "لغو شده")
            {
                ReverseInvoiceEntries(data, invoice);
                continue;
            }

            PostInvoiceEntries(data, invoice);
        }

        foreach (var payment in data.Payments.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id, StringComparer.Ordinal))
        {
            var invoice = data.Invoices.SingleOrDefault(i => i.Id == payment.InvoiceId);
            if (invoice is null || invoice.Type == "PROFORMA" || invoice.Status == "لغو شده")
                continue;
            PostPayment(data, invoice, payment);
        }

        foreach (var expense in data.Expenses.OrderBy(e => e.CreatedAt).ThenBy(e => e.Id, StringComparer.Ordinal))
            PostExpense(data, expense);
    }

    private static void EnsureRequiredAccounts(AccountingData data)
    {
        foreach (var required in RequiredAccounts)
        {
            var existing = data.LedgerAccounts.SingleOrDefault(a =>
                string.Equals(a.Code, required.Code, StringComparison.OrdinalIgnoreCase));
            if (existing is null)
            {
                data.LedgerAccounts.Add(new ChartOfAccountRecord
                {
                    Code = required.Code,
                    Name = required.Name,
                    Type = required.Type,
                    Level = "MAIN",
                    IsActive = true
                });
                continue;
            }

            if (!string.Equals(existing.Type, required.Type, StringComparison.Ordinal) || !existing.IsActive)
                throw new InvalidOperationException(
                    $"برای ثبت خودکار اسناد، سرفصل {required.Code} باید فعال و از نوع {required.Type} باشد. کدینگ حساب را بررسی کنید.");
        }
    }

    private static void PostInvoiceEntries(AccountingData data, InvoiceRecord invoice)
    {
        var date = ToJalaliDate(invoice.CreatedAt);
        if (invoice.Type == "SALE")
        {
            var netSales = AccountingRules.Money(invoice.Subtotal - invoice.Discount);
            PostOnce(data, invoice.Id, "AUTO_INVOICE_SALE_REVENUE", date,
                $"فروش فاکتور {invoice.DisplayNumber}", "1100", "4000", netSales);

            PostOnce(data, invoice.Id, "AUTO_INVOICE_SALE_TAX", date,
                $"مالیات فروش فاکتور {invoice.DisplayNumber}", "1100", "2100", invoice.TaxAmount);

            var cost = AccountingRules.Money(invoice.Lines.Sum(line => line.BuyPrice * line.Quantity));
            PostOnce(data, invoice.Id, "AUTO_INVOICE_SALE_COGS", date,
                $"بهای تمام‌شده فاکتور {invoice.DisplayNumber}", "5000", "1200", cost);
        }
        else if (invoice.Type == "PURCHASE")
        {
            var netPurchase = AccountingRules.Money(invoice.Subtotal - invoice.Discount);
            PostOnce(data, invoice.Id, "AUTO_INVOICE_PURCHASE_STOCK", date,
                $"خرید موجودی فاکتور {invoice.DisplayNumber}", "1200", "2000", netPurchase);

            PostOnce(data, invoice.Id, "AUTO_INVOICE_PURCHASE_TAX", date,
                $"مالیات خرید فاکتور {invoice.DisplayNumber}", "1300", "2000", invoice.TaxAmount);
        }
    }

    private static void PostPayment(AccountingData data, InvoiceRecord invoice, PaymentRecord payment)
    {
        var method = (payment.Method ?? string.Empty).Trim();
        var isCheck = method.Contains("چک", StringComparison.Ordinal);
        var isBank = !isCheck && (
            method.Contains("بانک", StringComparison.Ordinal) ||
            method.Contains("انتقال", StringComparison.Ordinal) ||
            method.Contains("واریز", StringComparison.Ordinal) ||
            method.Contains("کارت", StringComparison.Ordinal));

        string counterAccount = isCheck ? (invoice.Type == "PURCHASE" ? "2020" : "1020")
            : isBank ? "1010" : "1000";

        if (invoice.Type == "PURCHASE")
        {
            // Paying a supplier reduces accounts payable and credits the selected payment source.
            PostOnce(data, payment.Id, "AUTO_PAYMENT", ToJalaliDate(payment.CreatedAt),
                $"پرداخت فاکتور خرید {invoice.DisplayNumber} — {method}",
                "2000", counterAccount, payment.Amount);
        }
        else
        {
            // Receipt from a customer increases cash/bank/checks and reduces receivables.
            PostOnce(data, payment.Id, "AUTO_PAYMENT", ToJalaliDate(payment.CreatedAt),
                $"دریافت بابت فاکتور فروش {invoice.DisplayNumber} — {method}",
                counterAccount, "1100", payment.Amount);
        }
    }

    private static void PostExpense(AccountingData data, ExpenseRecord expense)
    {
        var combined = (expense.Category + " " + expense.Title).Trim();
        var expenseAccount = combined.Contains("اجاره", StringComparison.Ordinal) ? "5200"
            : combined.Contains("حقوق", StringComparison.Ordinal) || combined.Contains("دستمزد", StringComparison.Ordinal) ? "5100"
            : combined.Contains("مالیات", StringComparison.Ordinal) ? "5400"
            : "5300";

        PostOnce(data, expense.Id, "AUTO_EXPENSE", ToJalaliDate(expense.CreatedAt),
            $"هزینه: {expense.Title}", expenseAccount, "1000", expense.Amount);
    }

    private static void ReverseInvoiceEntries(AccountingData data, InvoiceRecord invoice)
    {
        var sourceEntries = data.JournalEntries
            .Where(entry => entry.ReferenceId == invoice.Id &&
                entry.ReferenceType.StartsWith("AUTO_INVOICE_", StringComparison.Ordinal) &&
                entry.Status is "POSTED" or "APPROVED")
            .ToList();

        foreach (var source in sourceEntries)
        {
            var reversalType = "AUTO_REVERSAL_" + source.Id;
            if (data.JournalEntries.Any(entry => entry.ReferenceType == reversalType && entry.ReferenceId == invoice.Id))
                continue;

            NativeLedgerService.PostEntry(data, new AccountingEntryRecord
            {
                Date = ToJalaliDate(DateTimeOffset.Now),
                Description = $"برگشت خودکار: {source.Description}",
                DebitAccountId = source.CreditAccountId,
                CreditAccountId = source.DebitAccountId,
                Amount = source.Amount,
                ReferenceId = invoice.Id,
                ReferenceType = reversalType,
                DocumentType = "ADJUSTMENT",
                FiscalYear = source.FiscalYear,
                Status = "POSTED"
            });
        }
    }

    private static void PostOnce(
        AccountingData data,
        string referenceId,
        string referenceType,
        string date,
        string description,
        string debitCode,
        string creditCode,
        decimal amount)
    {
        amount = AccountingRules.Money(amount);
        if (amount <= 0m)
            return;

        if (data.JournalEntries.Any(entry =>
            entry.ReferenceId == referenceId && entry.ReferenceType == referenceType))
            return;

        var debit = FindRequiredAccount(data, debitCode);
        var credit = FindRequiredAccount(data, creditCode);
        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = date,
            Description = description,
            DebitAccountId = debit.Id,
            CreditAccountId = credit.Id,
            Amount = amount,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            DocumentType = "OPERATIONAL",
            Status = "POSTED"
        });
    }

    private static ChartOfAccountRecord FindRequiredAccount(AccountingData data, string code) =>
        data.LedgerAccounts.SingleOrDefault(a =>
            string.Equals(a.Code, code, StringComparison.OrdinalIgnoreCase) && a.IsActive)
        ?? throw new InvalidOperationException($"سرفصل فعال با کد {code} برای ثبت خودکار سند پیدا نشد.");

    private static string ToJalaliDate(DateTimeOffset value)
    {
        if (value == default)
            value = DateTimeOffset.Now;
        var calendar = new PersianCalendar();
        var date = value.LocalDateTime;
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(date), calendar.GetMonth(date), calendar.GetDayOfMonth(date));
    }
}
