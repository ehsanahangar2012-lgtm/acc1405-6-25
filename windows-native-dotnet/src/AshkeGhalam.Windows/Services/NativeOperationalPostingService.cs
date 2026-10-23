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
        ("1110", "صندوق", "ASSET"),
        ("1120", "بانک", "ASSET"),
        ("1130", "حساب‌های دریافتنی", "ASSET"),
        ("1140", "اسناد دریافتنی / چک در دست", "ASSET"),
        ("1150", "چک‌های در جریان وصول", "ASSET"),
        ("1160", "موجودی کالا", "ASSET"),
        ("1170", "مالیات و عوارض خرید", "ASSET"),
        ("2110", "حساب‌های پرداختنی", "LIABILITY"),
        ("2120", "مالیات و عوارض فروش پرداختنی", "LIABILITY"),
        ("2130", "اسناد پرداختنی / چک صادره", "LIABILITY"),
        ("3000", "سرمایه", "EQUITY"),
        ("3100", "سود و زیان انباشته", "EQUITY"),
        ("4100", "سایر درآمدها", "REVENUE"),
        ("4110", "درآمد فروش", "REVENUE"),
        ("5000", "بهای تمام‌شده کالای فروش‌رفته", "EXPENSE"),
        ("5200", "هزینه‌های عملیاتی", "EXPENSE")
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
                $"فروش فاکتور {invoice.DisplayNumber}", "1130", "4110", netSales);

            PostOnce(data, invoice.Id, "AUTO_INVOICE_SALE_TAX", date,
                $"مالیات فروش فاکتور {invoice.DisplayNumber}", "1130", "2120", invoice.TaxAmount);

            var cost = AccountingRules.Money(invoice.Lines.Sum(line => line.BuyPrice * line.Quantity));
            PostOnce(data, invoice.Id, "AUTO_INVOICE_SALE_COGS", date,
                $"بهای تمام‌شده فاکتور {invoice.DisplayNumber}", "5000", "1160", cost);
        }
        else if (invoice.Type == "PURCHASE")
        {
            var netPurchase = AccountingRules.Money(invoice.Subtotal - invoice.Discount);
            PostOnce(data, invoice.Id, "AUTO_INVOICE_PURCHASE_STOCK", date,
                $"خرید موجودی فاکتور {invoice.DisplayNumber}", "1160", "2110", netPurchase);

            PostOnce(data, invoice.Id, "AUTO_INVOICE_PURCHASE_TAX", date,
                $"مالیات خرید فاکتور {invoice.DisplayNumber}", "1170", "2110", invoice.TaxAmount);
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

        string counterAccount = isCheck ? (invoice.Type == "PURCHASE" ? "2130" : "1140")
            : isBank ? "1120" : "1110";

        if (invoice.Type == "PURCHASE")
        {
            // Paying a supplier reduces accounts payable and credits the selected payment source.
            PostOnce(data, payment.Id, "AUTO_PAYMENT", ToJalaliDate(payment.CreatedAt),
                $"پرداخت فاکتور خرید {invoice.DisplayNumber} — {method}",
                "2110", counterAccount, payment.Amount);
        }
        else
        {
            // Receipt from a customer increases cash/bank/checks and reduces receivables.
            PostOnce(data, payment.Id, "AUTO_PAYMENT", ToJalaliDate(payment.CreatedAt),
                $"دریافت بابت فاکتور فروش {invoice.DisplayNumber} — {method}",
                counterAccount, "1130", payment.Amount);
        }
    }

    private static void PostExpense(AccountingData data, ExpenseRecord expense)
    {
        var expenseAccount = "5200"; // Matches source accountingEngine.postGeneralTransaction for direct expenses.

        PostOnce(data, expense.Id, "AUTO_EXPENSE", ToJalaliDate(expense.CreatedAt),
            $"هزینه: {expense.Title}", expenseAccount, "1110", expense.Amount);
    }

    private static void ReverseInvoiceEntries(AccountingData data, InvoiceRecord invoice)
    {
        var linkedPaymentIds = data.Payments
            .Where(payment => payment.InvoiceId == invoice.Id)
            .Select(payment => payment.Id)
            .ToHashSet(StringComparer.Ordinal);

        var sourceEntries = data.JournalEntries
            .Where(entry =>
                entry.Status is "POSTED" or "APPROVED" &&
                ((entry.ReferenceId == invoice.Id &&
                  entry.ReferenceType.StartsWith("AUTO_INVOICE_", StringComparison.Ordinal)) ||
                 (linkedPaymentIds.Contains(entry.ReferenceId) &&
                  entry.ReferenceType == "AUTO_PAYMENT")) &&
                !WasReversed(data, entry))
            .ToList();

        foreach (var source in sourceEntries)
            ReverseEntry(data, source);
    }

    private static bool WasReversed(AccountingData data, AccountingEntryRecord source)
    {
        var reversalType = "AUTO_REVERSAL_" + source.Id;
        return data.JournalEntries.Any(entry =>
            entry.ReferenceType == reversalType &&
            entry.ReferenceId == source.ReferenceId &&
            (entry.Status is "POSTED" or "APPROVED"));
    }

    private static void ReverseEntry(AccountingData data, AccountingEntryRecord source)
    {
        if (WasReversed(data, source))
            return;

        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = ToJalaliDate(DateTimeOffset.Now),
            Description = $"برگشت خودکار: {source.Description}",
            DebitAccountId = source.CreditAccountId,
            CreditAccountId = source.DebitAccountId,
            Amount = source.Amount,
            ReferenceId = source.ReferenceId,
            ReferenceType = "AUTO_REVERSAL_" + source.Id,
            DocumentType = "ADJUSTMENT",
            FiscalYear = source.FiscalYear,
            Status = "POSTED"
        });
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
        var debit = amount > 0m ? FindRequiredAccount(data, debitCode) : null;
        var credit = amount > 0m ? FindRequiredAccount(data, creditCode) : null;
        var normalizedDate = amount > 0m ? NativeLedgerService.NormalizeAndValidateDate(date) : "";

        var activeSources = data.JournalEntries
            .Where(entry => entry.ReferenceId == referenceId &&
                entry.ReferenceType == referenceType &&
                (entry.Status is "POSTED" or "APPROVED") &&
                !WasReversed(data, entry))
            .ToList();

        if (amount <= 0m)
        {
            foreach (var stale in activeSources)
                ReverseEntry(data, stale);
            return;
        }

        var matching = activeSources.FirstOrDefault(entry =>
            entry.Amount == amount &&
            entry.DebitAccountId == debit!.Id &&
            entry.CreditAccountId == credit!.Id &&
            entry.Date == normalizedDate &&
            entry.Description == description);

        if (matching is not null)
        {
            // Keep one matching active posting and reverse any stale duplicates left by older builds.
            foreach (var stale in activeSources.Where(entry => entry.Id != matching.Id))
                ReverseEntry(data, stale);
            return;
        }

        foreach (var stale in activeSources)
            ReverseEntry(data, stale);

        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = normalizedDate,
            Description = description,
            DebitAccountId = debit!.Id,
            CreditAccountId = credit!.Id,
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
