using System.Globalization;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record PersonKardexEntry(
    string Date,
    string Type,
    string Reference,
    string Description,
    decimal Debit,
    decimal Credit,
    decimal Balance,
    DateTimeOffset SortDate,
    bool IsInformational = false);

public sealed record PersonKardexReport(
    IReadOnlyList<PersonKardexEntry> Rows,
    decimal OpeningBalance,
    decimal TotalDebit,
    decimal TotalCredit,
    decimal ClosingBalance,
    int InvoiceCount,
    int PaymentCount,
    int CheckCount,
    int VoucherCount);

/// <summary>
/// Local WPF port of the source application's PersonLedgerService for the currently active company.
/// Sales increase receivables; purchases and receipts/payments follow the same signed balance rules
/// as the original application. Inventory vouchers are shown for context and do not change balances.
/// </summary>
public static class PersonKardexService
{
    private sealed record RawEntry(
        DateTimeOffset Date,
        int Priority,
        string Type,
        string Reference,
        string Description,
        decimal Debit,
        decimal Credit,
        bool Informational = false);

    public static PersonKardexReport GetReport(
        AccountingData data,
        CustomerRecord person,
        string? fromJalali = null,
        string? toJalali = null)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(person);

        var fromDate = ParseJalaliDate(fromJalali, "از تاریخ");
        var toDate = ParseJalaliDate(toJalali, "تا تاریخ");
        if (fromDate.HasValue && toDate.HasValue && toDate.Value.Date < fromDate.Value.Date)
            throw new FormatException("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.");

        var raw = new List<RawEntry>();
        var invoices = data.Invoices
            .Where(invoice => invoice.CustomerId == person.Id &&
                             invoice.Type != "PROFORMA" &&
                             invoice.Status != "لغو شده")
            .OrderBy(invoice => invoice.CreatedAt)
            .ToList();
        var invoiceById = data.Invoices.ToDictionary(invoice => invoice.Id, StringComparer.Ordinal);

        foreach (var invoice in invoices)
        {
            var isSale = string.Equals(invoice.Type, "SALE", StringComparison.OrdinalIgnoreCase);
            var action = isSale ? "فاکتور فروش" : "فاکتور خرید";
            raw.Add(new RawEntry(
                invoice.CreatedAt,
                1,
                "فاکتور",
                invoice.DisplayNumber,
                $"{action} {invoice.DisplayNumber} — {invoice.CustomerName}",
                isSale ? invoice.Total : 0m,
                isSale ? 0m : invoice.Total));
        }

        var personPayments = data.Payments
            .Where(payment =>
                invoiceById.TryGetValue(payment.InvoiceId, out var invoice) &&
                invoice.CustomerId == person.Id &&
                invoice.Type != "PROFORMA" &&
                invoice.Status != "لغو شده")
            .OrderBy(payment => payment.CreatedAt)
            .ToList();

        foreach (var payment in personPayments)
        {
            var invoice = invoiceById[payment.InvoiceId];
            var isSale = string.Equals(invoice.Type, "SALE", StringComparison.OrdinalIgnoreCase);
            var receiptOrPayment = isSale ? "دریافت" : "پرداخت";
            var method = string.IsNullOrWhiteSpace(payment.Method) ? "بدون روش" : payment.Method;
            var reference = string.IsNullOrWhiteSpace(payment.Reference)
                ? $"PAY-{payment.InvoiceNumber}"
                : payment.Reference;
            raw.Add(new RawEntry(
                payment.CreatedAt,
                2,
                "دریافت/پرداخت",
                reference,
                $"{receiptOrPayment} بابت {invoice.DisplayNumber} — {method}",
                isSale ? 0m : payment.Amount,
                isSale ? payment.Amount : 0m));
        }

        // Invoice-linked checks are reflected by the payment rows above in this WPF model;
        // only independent checks are added here to prevent double counting.
        var personChecks = data.Checks
            .Where(check => check.PersonId == person.Id && string.IsNullOrWhiteSpace(check.RelatedInvoiceId))
            .OrderBy(check => check.DueDate)
            .ToList();

        foreach (var check in personChecks)
        {
            var received = string.Equals(check.CheckType, "RECEIVED", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(check.CheckType, "IN", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(check.CheckType, "CHECK_RECEIVED", StringComparison.OrdinalIgnoreCase);
            var reference = !string.IsNullOrWhiteSpace(check.SayadId)
                ? check.SayadId
                : !string.IsNullOrWhiteSpace(check.CheckNumber) ? check.CheckNumber : check.Id;
            var date = check.IssueDate ?? check.DueDate;
            raw.Add(new RawEntry(
                date,
                3,
                received ? "چک دریافتی" : "چک پرداختی",
                reference,
                $"چک {(received ? "دریافتی" : "پرداختی")} — {check.BankName} — {check.Status}",
                received ? 0m : check.Amount,
                received ? check.Amount : 0m));
        }

        var personVouchers = data.Vouchers
            .Where(voucher => voucher.PersonId == person.Id)
            .OrderBy(voucher => voucher.Date)
            .ToList();

        foreach (var voucher in personVouchers)
        {
            var movement = voucher.MovementType switch
            {
                "GOODS_RECEIPT" => "ورود به انبار",
                "GOODS_ISSUE" => "خروج از انبار",
                "RETURN_RECEIPT" => "برگشت کالا به انبار",
                "RETURN_ISSUE" => "برگشت کالا از انبار",
                _ => voucher.Type switch { "IN" => "ورود به انبار", "OUT" => "خروج از انبار", _ => "مرجوعی کالا" }
            };
            var itemSummary = string.Join("، ", (voucher.Items ?? [])
                .Take(3)
                .Select(item => $"{item.ProductName} ({item.Quantity.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))} {item.Unit})"));
            var suffix = string.IsNullOrWhiteSpace(itemSummary) ? "" : $" — {itemSummary}";
            raw.Add(new RawEntry(
                voucher.Date,
                4,
                "حوالهٔ انبار",
                string.IsNullOrWhiteSpace(voucher.TrackingCode) ? voucher.Number.ToString(CultureInfo.InvariantCulture) : voucher.TrackingCode,
                $"{movement}؛ {voucher.Status}{suffix}",
                0m,
                0m,
                Informational: true));
        }

        raw = raw
            .OrderBy(entry => entry.Date)
            .ThenBy(entry => entry.Priority)
            .ThenBy(entry => entry.Reference, StringComparer.Ordinal)
            .ToList();

        var start = fromDate?.Date;
        var endExclusive = toDate?.Date.AddDays(1);
        var beforeRange = start.HasValue
            ? raw.Where(entry => entry.Date.LocalDateTime.Date < start.Value).ToList()
            : new List<RawEntry>();
        var inRange = raw.Where(entry =>
                (!start.HasValue || entry.Date.LocalDateTime.Date >= start.Value) &&
                (!endExclusive.HasValue || entry.Date.LocalDateTime.Date < endExclusive.Value))
            .ToList();

        var openingBalance = beforeRange.Sum(entry => entry.Debit - entry.Credit);
        var totalDebit = inRange.Sum(entry => entry.Debit);
        var totalCredit = inRange.Sum(entry => entry.Credit);
        var runningBalance = openingBalance;
        var rows = new List<PersonKardexEntry>();

        if (start.HasValue)
        {
            rows.Add(new PersonKardexEntry(
                "—",
                "ماندهٔ اول دوره",
                "—",
                $"ماندهٔ انتقالی تا پیش از {FormatJalaliDate(start.Value)}",
                0m,
                0m,
                openingBalance,
                new DateTimeOffset(start.Value)));
        }

        foreach (var entry in inRange)
        {
            runningBalance += entry.Debit - entry.Credit;
            rows.Add(new PersonKardexEntry(
                FormatJalaliDate(entry.Date),
                entry.Type,
                entry.Reference,
                entry.Description,
                entry.Debit,
                entry.Credit,
                runningBalance,
                entry.Date,
                entry.Informational));
        }

        return new PersonKardexReport(
            rows,
            openingBalance,
            totalDebit,
            totalCredit,
            runningBalance,
            invoices.Count,
            personPayments.Count,
            personChecks.Count,
            personVouchers.Count);
    }

    public static DateTime? ParseJalaliDate(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var normalized = NormalizeDigits(value.Trim()).Replace('-', '/').Replace('.', '/');
        var parts = normalized.Split('/', StringSplitOptions.TrimEntries);
        if (parts.Length != 3 ||
            !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var year) ||
            !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var month) ||
            !int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var day))
            throw new FormatException($"{fieldName} را به شکل سال/ماه/روز شمسی وارد کنید؛ نمونه: ۱۴۰۵/۰۱/۰۱.");

        try
        {
            return new PersianCalendar().ToDateTime(year, month, day, 0, 0, 0, 0).Date;
        }
        catch (ArgumentOutOfRangeException)
        {
            throw new FormatException($"{fieldName} معتبر نیست؛ تاریخ شمسی را بررسی کنید.");
        }
    }

    public static string FormatJalaliDate(DateTimeOffset value) => FormatJalaliDate(value.LocalDateTime);

    public static string FormatJalaliDate(DateTime value)
    {
        var calendar = new PersianCalendar();
        return $"{calendar.GetYear(value):0000}/{calendar.GetMonth(value):00}/{calendar.GetDayOfMonth(value):00}";
    }

    private static string NormalizeDigits(string value)
    {
        var chars = value.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] is >= '۰' and <= '۹')
                chars[i] = (char)('0' + chars[i] - '۰');
            else if (chars[i] is >= '٠' and <= '٩')
                chars[i] = (char)('0' + chars[i] - '٠');
        }
        return new string(chars);
    }
}
