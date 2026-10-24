using System.Globalization;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Native WPF port of the source application's ChartOfAccount and AccountingEntry rules.
/// Entries are append-only after posting: corrections must be recorded as a new adjustment.
/// </summary>
public static class NativeLedgerService
{
    private static readonly string[] AccountTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
    private static readonly string[] AccountLevels = ["MAIN", "SUB", "DETAIL"];
    private static readonly string[] DocumentTypes = ["OPERATIONAL", "OPENING", "CLOSING", "ADJUSTMENT"];

    public sealed record TrialBalanceLine(
        string AccountId, string Code, string Name, string Type,
        decimal Debit, decimal Credit, decimal Balance);

    public static void SeedDefaultChart(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        if (data.LedgerAccounts.Count > 0)
            throw new InvalidOperationException("سرفصل‌های حساب موجود است؛ برای جلوگیری از کدهای تکراری، سرفصل پیش‌فرض دوباره ایجاد نشد.");

        // Codes follow services/accountingEngine.ts in the source web/Electron app.
        var defaults = new (string Code, string Name, string Type)[]
        {
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
        };

        foreach (var item in defaults)
        {
            data.LedgerAccounts.Add(new ChartOfAccountRecord
            {
                Code = item.Code,
                Name = item.Name,
                Type = item.Type,
                Level = "MAIN",
                IsActive = true
            });
        }
    }

    public static ChartOfAccountRecord AddAccount(
        AccountingData data, string code, string name, string type, string level, string? parentId)
    {
        ArgumentNullException.ThrowIfNull(data);
        code = (code ?? string.Empty).Trim();
        name = (name ?? string.Empty).Trim();
        type = (type ?? string.Empty).Trim().ToUpperInvariant();
        level = (level ?? string.Empty).Trim().ToUpperInvariant();
        parentId = (parentId ?? string.Empty).Trim();

        if (code.Length is < 2 or > 32) throw new InvalidOperationException("کد حساب باید بین ۲ تا ۳۲ نویسه باشد.");
        if (name.Length is < 2 or > 160) throw new InvalidOperationException("نام حساب باید بین ۲ تا ۱۶۰ نویسه باشد.");
        if (!AccountTypes.Contains(type, StringComparer.Ordinal)) throw new InvalidOperationException("نوع حساب معتبر نیست.");
        if (!AccountLevels.Contains(level, StringComparer.Ordinal)) throw new InvalidOperationException("سطح حساب معتبر نیست.");
        if (data.LedgerAccounts.Any(a => string.Equals(a.Code, code, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("کد حساب از قبل وجود دارد.");

        var account = new ChartOfAccountRecord
        {
            Code = code,
            Name = name,
            Type = type,
            Level = level,
            ParentId = parentId,
            IsActive = true
        };
        ValidateAccountParent(data, account);
        data.LedgerAccounts.Add(account);
        return account;
    }

    public static AccountingEntryRecord PostEntry(AccountingData data, AccountingEntryRecord draft)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(draft);

        var debit = data.LedgerAccounts.SingleOrDefault(a => a.Id == draft.DebitAccountId && a.IsActive)
            ?? throw new InvalidOperationException("حساب بدهکار فعال و معتبری انتخاب نشده است.");
        var credit = data.LedgerAccounts.SingleOrDefault(a => a.Id == draft.CreditAccountId && a.IsActive)
            ?? throw new InvalidOperationException("حساب بستانکار فعال و معتبری انتخاب نشده است.");
        if (debit.Id == credit.Id) throw new InvalidOperationException("حساب بدهکار و بستانکار نمی‌توانند یکسان باشند.");

        var description = (draft.Description ?? string.Empty).Trim();
        if (description.Length is < 2 or > 1000) throw new InvalidOperationException("شرح سند باید بین ۲ تا ۱۰۰۰ نویسه باشد.");
        if (draft.Amount <= 0m) throw new InvalidOperationException("مبلغ سند باید بیشتر از صفر باشد.");
        var amount = AccountingRules.Money(draft.Amount);
        if (amount <= 0m) throw new InvalidOperationException("مبلغ پس از گردکردن باید بیشتر از صفر باشد.");
        if (!DocumentTypes.Contains(draft.DocumentType, StringComparer.Ordinal))
            throw new InvalidOperationException("نوع سند حسابداری معتبر نیست.");

        var normalizedDate = NormalizeAndValidateDate(draft.Date);
        if (data.NextJournalNumber < 1) throw new InvalidOperationException("شمارنده شماره سند حسابداری نامعتبر است.");

        var entry = new AccountingEntryRecord
        {
            Id = Guid.NewGuid().ToString("N"),
            Number = data.NextJournalNumber,
            Date = normalizedDate,
            Description = description,
            DebitAccountId = debit.Id,
            CreditAccountId = credit.Id,
            Amount = amount,
            ReferenceId = (draft.ReferenceId ?? string.Empty).Trim(),
            ReferenceType = (draft.ReferenceType ?? string.Empty).Trim(),
            DocumentType = draft.DocumentType,
            FiscalYear = !string.IsNullOrWhiteSpace(draft.FiscalYear)
                ? draft.FiscalYear.Trim()
                : IsWithinActiveFiscalYear(normalizedDate, data.Preferences)
                    ? data.Preferences.ActiveFiscalYear.Trim()
                    : normalizedDate.Split('/')[0],
            Status = "POSTED",
            CreatedAt = DateTimeOffset.Now
        };

        data.JournalEntries.Add(entry);
        data.NextJournalNumber = checked(data.NextJournalNumber + 1);
        return entry;
    }

    public static string NormalizeAndValidateDate(string? value) =>
        PersianDateInputService.Format(PersianDateInputService.Parse(value, "تاریخ سند"));

    public static IReadOnlyList<TrialBalanceLine> GetTrialBalance(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        var posted = data.JournalEntries.Where(e => e.Status is "POSTED" or "APPROVED").ToList();
        var debits = posted.GroupBy(e => e.DebitAccountId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Sum(e => e.Amount), StringComparer.Ordinal);
        var credits = posted.GroupBy(e => e.CreditAccountId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Sum(e => e.Amount), StringComparer.Ordinal);
        return data.LedgerAccounts
            .OrderBy(a => a.Code, StringComparer.OrdinalIgnoreCase)
            .Select(account =>
            {
                var debit = debits.GetValueOrDefault(account.Id, 0m);
                var credit = credits.GetValueOrDefault(account.Id, 0m);
                return new TrialBalanceLine(account.Id, account.Code, account.Name, account.Type,
                    debit, credit, debit - credit);
            })
            .ToList();
    }

    private static void ValidateAccountParent(AccountingData data, ChartOfAccountRecord account)
    {
        if (account.Level == "MAIN")
        {
            if (!string.IsNullOrWhiteSpace(account.ParentId))
                throw new InvalidOperationException("حساب اصلی نباید والد داشته باشد.");
            return;
        }

        var parent = data.LedgerAccounts.SingleOrDefault(a => a.Id == account.ParentId && a.IsActive)
            ?? throw new InvalidOperationException("برای حساب فرعی باید والد فعال انتخاب شود.");
        var expectedParentLevel = account.Level == "SUB" ? "MAIN" : "SUB";
        if (parent.Level != expectedParentLevel)
            throw new InvalidOperationException(account.Level == "SUB"
                ? "والد حساب معین باید یک حساب کل باشد."
                : "والد حساب تفصیلی باید یک حساب معین باشد.");
        if (parent.Type != account.Type)
            throw new InvalidOperationException("نوع حساب فرزند باید با نوع حساب والد یکسان باشد.");
    }

    private static bool IsWithinActiveFiscalYear(string normalizedDate, AccountingPreferences? preferences)
    {
        if (preferences is null ||
            string.IsNullOrWhiteSpace(preferences.ActiveFiscalYear) ||
            string.IsNullOrWhiteSpace(preferences.FiscalYearStartDate) ||
            string.IsNullOrWhiteSpace(preferences.FiscalYearEndDate))
            return false;

        // All dates are normalized as yyyy/MM/dd, so ordinal comparison is chronological
        // within the supported normalized Jalali or Gregorian date format.
        return string.CompareOrdinal(normalizedDate, preferences.FiscalYearStartDate) >= 0 &&
               string.CompareOrdinal(normalizedDate, preferences.FiscalYearEndDate) <= 0;
    }

    private static string CurrentJalaliYear()
    {
        var calendar = new PersianCalendar();
        return calendar.GetYear(DateTime.Now).ToString(CultureInfo.InvariantCulture);
    }

    private static string NormalizeDigits(string value)
    {
        var builder = new System.Text.StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '۰' and <= '۹') builder.Append((char)('0' + ch - '۰'));
            else if (ch is >= '٠' and <= '٩') builder.Append((char)('0' + ch - '٠'));
            else builder.Append(ch);
        }
        return builder.ToString();
    }
}
