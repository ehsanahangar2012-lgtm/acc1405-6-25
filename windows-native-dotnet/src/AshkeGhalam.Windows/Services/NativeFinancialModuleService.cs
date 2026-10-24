using System.Globalization;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Native, validated finance operations: currency conversion, loans/amortization, and bank reconciliation.
/// Market rates are deliberately not guessed or silently downloaded.
/// </summary>
public static class NativeFinancialModuleService
{
    public static string BaseCurrencyCode(AccountingData data) =>
        string.Equals(data.Preferences?.Currency, "TOMAN", StringComparison.OrdinalIgnoreCase) ? "IRT" : "IRR";

    public static void EnsureDefaults(AccountingData data)
    {
        data.CurrencyRates ??= [];
        AddFixedRate(data, "IRR", "ریال ایران", "ریال", 1m);
        AddFixedRate(data, "IRT", "تومان ایران", "تومان", 10m);
        AddUnconfiguredRate(data, "USD", "دلار آمریکا", "$");
        AddUnconfiguredRate(data, "EUR", "یورو", "€");
        AddUnconfiguredRate(data, "AED", "درهم امارات", "د.إ");
    }

    private static void AddFixedRate(AccountingData data, string code, string name, string symbol, decimal rate)
    {
        var current = data.CurrencyRates.FirstOrDefault(item => item.Code == code);
        if (current is null)
        {
            data.CurrencyRates.Add(new CurrencyRateRecord
            {
                Code = code, Name = name, Symbol = symbol, RialPerUnit = rate,
                IsRateConfigured = true, LastUpdated = DateTimeOffset.Now
            });
        }
        else
        {
            current.Name = name;
            current.Symbol = symbol;
            current.RialPerUnit = rate;
            current.IsRateConfigured = true;
        }
    }

    private static void AddUnconfiguredRate(AccountingData data, string code, string name, string symbol)
    {
        if (data.CurrencyRates.Any(item => string.Equals(item.Code, code, StringComparison.OrdinalIgnoreCase))) return;
        data.CurrencyRates.Add(new CurrencyRateRecord
        {
            Code = code, Name = name, Symbol = symbol, RialPerUnit = 0m,
            IsRateConfigured = false, LastUpdated = DateTimeOffset.MinValue
        });
    }

    public static void SetRate(AccountingData data, string code, decimal rialPerUnit)
    {
        EnsureDefaults(data);
        code = (code ?? "").Trim().ToUpperInvariant();
        if (code is "IRR" or "IRT")
            throw new InvalidOperationException("نسبت ریال و تومان ثابت است: هر تومان برابر ۱۰ ریال.");
        if (rialPerUnit <= 0m || rialPerUnit > 1_000_000_000_000_000m)
            throw new InvalidOperationException("نرخ ارز باید مثبت و در محدودهٔ معتبر باشد.");
        var rate = data.CurrencyRates.SingleOrDefault(item => item.Code == code)
            ?? throw new InvalidOperationException("ارز انتخاب‌شده در فهرست وجود ندارد.");
        rate.RialPerUnit = decimal.Round(rialPerUnit, 4, MidpointRounding.AwayFromZero);
        rate.IsRateConfigured = true;
        rate.LastUpdated = DateTimeOffset.Now;
    }

    public static decimal ConvertCurrencyAmount(AccountingData data, decimal amount, string fromCode, string toCode)
    {
        if (amount < 0m) throw new InvalidOperationException("مبلغ تبدیل نمی‌تواند منفی باشد.");
        EnsureDefaults(data);
        fromCode = (fromCode ?? "").Trim().ToUpperInvariant();
        toCode = (toCode ?? "").Trim().ToUpperInvariant();
        if (string.Equals(fromCode, toCode, StringComparison.Ordinal)) return AccountingRules.Money(amount);

        var from = data.CurrencyRates.SingleOrDefault(item => item.Code == fromCode)
            ?? throw new InvalidOperationException("ارز مبدا پیدا نشد.");
        var to = data.CurrencyRates.SingleOrDefault(item => item.Code == toCode)
            ?? throw new InvalidOperationException("ارز مقصد پیدا نشد.");
        if (!from.IsRateConfigured || from.RialPerUnit <= 0m)
            throw new InvalidOperationException($"نرخ معتبر برای «{from.Name}» ثبت نشده است.");
        if (!to.IsRateConfigured || to.RialPerUnit <= 0m)
            throw new InvalidOperationException($"نرخ معتبر برای «{to.Name}» ثبت نشده است.");
        return AccountingRules.Money(amount * from.RialPerUnit / to.RialPerUnit);
    }

    public static DateTime ParsePersianDate(string text)
    {
        var normalized = NativeLedgerService.NormalizeAndValidateDate(text);
        var parts = normalized.Split('/');
        var calendar = new PersianCalendar();
        return calendar.ToDateTime(
            int.Parse(parts[0], CultureInfo.InvariantCulture),
            int.Parse(parts[1], CultureInfo.InvariantCulture),
            int.Parse(parts[2], CultureInfo.InvariantCulture),
            0, 0, 0, 0, PersianCalendar.PersianEra);
    }

    public static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    public static LoanRecord CreateLoan(
        AccountingData data, string lenderName, decimal principalAmount,
        decimal annualInterestRatePercent, int installmentCount, DateTimeOffset startDate,
        string fundingAccountCode, string notes = "")
    {
        ArgumentNullException.ThrowIfNull(data);
        lenderName = (lenderName ?? "").Trim();
        fundingAccountCode = (fundingAccountCode ?? "").Trim();
        if (lenderName.Length is < 2 or > 180)
            throw new InvalidOperationException("نام وام‌دهنده باید بین ۲ تا ۱۸۰ نویسه باشد.");
        principalAmount = AccountingRules.Money(principalAmount);
        if (principalAmount <= 0m) throw new InvalidOperationException("اصل وام باید مثبت باشد.");
        if (annualInterestRatePercent < 0m || annualInterestRatePercent > 100m)
            throw new InvalidOperationException("نرخ بهرهٔ سالانه باید بین صفر تا ۱۰۰ درصد باشد.");
        if (installmentCount is < 1 or > 360) throw new InvalidOperationException("تعداد اقساط باید بین ۱ تا ۳۶۰ باشد.");
        if (startDate == default) throw new InvalidOperationException("تاریخ شروع وام معتبر نیست.");
        if (fundingAccountCode is not ("1110" or "1120"))
            throw new InvalidOperationException("حساب دریافت وام باید صندوق یا بانک باشد.");

        EnsureBaseChart(data);
        var fundAccount = RequireAccount(data, fundingAccountCode, "ASSET");
        var liabilityAccount = EnsureAccount(data, "2140", "وام‌های پرداختنی", "LIABILITY");
        var jalaliYear = new PersianCalendar().GetYear(startDate.DateTime);
        var loanNumber = $"LN-{jalaliYear:0000}-{data.Loans.Count + 1:0000}";
        while (data.Loans.Any(item => string.Equals(item.LoanNumber, loanNumber, StringComparison.OrdinalIgnoreCase)))
            loanNumber = $"LN-{jalaliYear:0000}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

        var loan = new LoanRecord
        {
            LoanNumber = loanNumber, LenderName = lenderName,
            PrincipalAmount = principalAmount, AnnualInterestRatePercent = decimal.Round(annualInterestRatePercent, 4),
            StartDate = startDate, InstallmentCount = installmentCount, RemainingPrincipal = principalAmount,
            CurrencyCode = BaseCurrencyCode(data), FundingAccountCode = fundingAccountCode,
            Status = "ACTIVE", Notes = (notes ?? "").Trim(), CreatedAt = DateTimeOffset.Now
        };
        data.Loans.Add(loan);

        var outstanding = principalAmount;
        var allocatedPrincipal = 0m;
        for (var n = 1; n <= installmentCount; n++)
        {
            var principal = n == installmentCount
                ? AccountingRules.Money(principalAmount - allocatedPrincipal)
                : AccountingRules.Money(principalAmount / installmentCount);
            var interest = AccountingRules.Money(outstanding * annualInterestRatePercent / 100m / 12m);
            var dueDate = startDate.AddMonths(n);
            data.LoanInstallments.Add(new LoanInstallmentRecord
            {
                LoanId = loan.Id, InstallmentNumber = n,
                DueDate = new DateTimeOffset(dueDate.DateTime, TimeZoneInfo.Local.GetUtcOffset(dueDate.DateTime)),
                PrincipalAmount = principal, InterestAmount = interest,
                TotalAmount = AccountingRules.Money(principal + interest), Status = "PENDING"
            });
            allocatedPrincipal = AccountingRules.Money(allocatedPrincipal + principal);
            outstanding = Math.Max(0m, AccountingRules.Money(outstanding - principal));
        }

        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = FormatPersianDate(startDate), Description = $"دریافت وام {loan.LoanNumber} از {loan.LenderName}",
            DebitAccountId = fundAccount.Id, CreditAccountId = liabilityAccount.Id,
            Amount = principalAmount, ReferenceId = loan.Id, ReferenceType = "LOAN_RECEIPT",
            DocumentType = "OPERATIONAL"
        });
        return loan;
    }

    public static LoanInstallmentRecord PayInstallment(AccountingData data, string installmentId, string fundingAccountCode)
    {
        ArgumentNullException.ThrowIfNull(data);
        var installment = data.LoanInstallments.SingleOrDefault(item => item.Id == installmentId)
            ?? throw new InvalidOperationException("قسط انتخاب‌شده پیدا نشد.");
        if (!string.Equals(installment.Status, "PENDING", StringComparison.Ordinal))
            throw new InvalidOperationException("این قسط قبلاً تسویه شده است.");
        var loan = data.Loans.SingleOrDefault(item => item.Id == installment.LoanId)
            ?? throw new InvalidOperationException("وام مرتبط با قسط وجود ندارد.");
        if (fundingAccountCode is not ("1110" or "1120"))
            throw new InvalidOperationException("حساب پرداخت باید صندوق یا بانک باشد.");

        EnsureBaseChart(data);
        var liabilityAccount = EnsureAccount(data, "2140", "وام‌های پرداختنی", "LIABILITY");
        var interestAccount = EnsureAccount(data, "5300", "هزینهٔ بهرهٔ وام", "EXPENSE");
        var fundAccount = RequireAccount(data, fundingAccountCode, "ASSET");
        var date = FormatPersianDate(DateTimeOffset.Now);
        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = date, Description = $"بازپرداخت اصل قسط {installment.InstallmentNumber} وام {loan.LoanNumber}",
            DebitAccountId = liabilityAccount.Id, CreditAccountId = fundAccount.Id,
            Amount = installment.PrincipalAmount, ReferenceId = installment.Id,
            ReferenceType = "LOAN_INSTALLMENT_PRINCIPAL", DocumentType = "OPERATIONAL"
        });
        if (installment.InterestAmount > 0m)
            NativeLedgerService.PostEntry(data, new AccountingEntryRecord
            {
                Date = date, Description = $"هزینهٔ بهرهٔ قسط {installment.InstallmentNumber} وام {loan.LoanNumber}",
                DebitAccountId = interestAccount.Id, CreditAccountId = fundAccount.Id,
                Amount = installment.InterestAmount, ReferenceId = installment.Id,
                ReferenceType = "LOAN_INSTALLMENT_INTEREST", DocumentType = "OPERATIONAL"
            });

        installment.Status = "PAID";
        installment.PaidAt = DateTimeOffset.Now;
        installment.PaymentAccountCode = fundingAccountCode;
        loan.RemainingPrincipal = Math.Max(0m, AccountingRules.Money(loan.RemainingPrincipal - installment.PrincipalAmount));
        if (!data.LoanInstallments.Any(item => item.LoanId == loan.Id && item.Status == "PENDING")) loan.Status = "PAID";
        return installment;
    }

    public static BankTransactionRecord AddBankTransaction(
        AccountingData data, string accountId, DateTimeOffset date, string description,
        string direction, decimal amount, string reference = "")
    {
        var account = data.BankAccounts.SingleOrDefault(item => item.Id == accountId && item.IsActive)
            ?? throw new InvalidOperationException("حساب بانکی فعال انتخاب نشده است.");
        direction = (direction ?? "").Trim().ToUpperInvariant();
        if (direction is not ("CREDIT" or "DEBIT"))
            throw new InvalidOperationException("نوع تراکنش بانکی معتبر نیست.");
        description = (description ?? "").Trim();
        amount = AccountingRules.Money(amount);
        if (description.Length < 2 || amount <= 0m || date == default)
            throw new InvalidOperationException("تاریخ، شرح و مبلغ تراکنش بانکی را بررسی کنید.");
        var transaction = new BankTransactionRecord
        {
            BankAccountId = account.Id, Date = date, Description = description,
            Direction = direction, Amount = amount, Reference = (reference ?? "").Trim()
        };
        data.BankTransactions.Add(transaction);
        return transaction;
    }

    public static void ReconcileBankTransaction(AccountingData data, string transactionId, string paymentId)
    {
        var transaction = data.BankTransactions.SingleOrDefault(item => item.Id == transactionId)
            ?? throw new InvalidOperationException("تراکنش بانکی پیدا نشد.");
        if (transaction.IsReconciled) throw new InvalidOperationException("این تراکنش قبلاً تطبیق شده است.");
        var account = data.BankAccounts.SingleOrDefault(item => item.Id == transaction.BankAccountId)
            ?? throw new InvalidOperationException("حساب بانکی تراکنش پیدا نشد.");
        var payment = data.Payments.SingleOrDefault(item => item.Id == paymentId)
            ?? throw new InvalidOperationException("دریافت/پرداخت انتخاب‌شده پیدا نشد.");
        var invoice = data.Invoices.SingleOrDefault(item => item.Id == payment.InvoiceId)
            ?? throw new InvalidOperationException("فاکتور مرجع دریافت/پرداخت پیدا نشد.");
        var expectedDirection = invoice.Type == "SALE" ? "CREDIT" : invoice.Type == "PURCHASE" ? "DEBIT" : "";
        if (!string.Equals(account.CurrencyCode, BaseCurrencyCode(data), StringComparison.Ordinal))
            throw new InvalidOperationException("تطبیق خودکار فقط برای حساب با واحد پول اصلی ثبت‌شده فعال است.");
        if (transaction.Amount != payment.Amount || transaction.Direction != expectedDirection)
            throw new InvalidOperationException("تطبیق رد شد؛ مبلغ یا جهت گردش با سند سازگار نیست.");
        if (data.BankTransactions.Any(item => item.Id != transaction.Id && item.LinkedPaymentId == payment.Id))
            throw new InvalidOperationException("این دریافت/پرداخت قبلاً به تراکنش بانکی دیگری متصل شده است.");
        transaction.LinkedPaymentId = payment.Id;
        transaction.IsReconciled = true;
        transaction.ReconciliationNote = "تطبیق دقیق بر اساس مبلغ، جهت و سند مرجع";
        transaction.ReconciledAt = DateTimeOffset.Now;
    }

    public static void MarkBankTransactionReviewed(AccountingData data, string transactionId, string note)
    {
        var transaction = data.BankTransactions.SingleOrDefault(item => item.Id == transactionId)
            ?? throw new InvalidOperationException("تراکنش بانکی پیدا نشد.");
        if (transaction.IsReconciled) throw new InvalidOperationException("این تراکنش قبلاً بررسی شده است.");
        note = (note ?? "").Trim();
        if (note.Length < 3) throw new InvalidOperationException("برای بررسی دستی، شرح یا شمارهٔ مرجع وارد کنید.");
        transaction.IsReconciled = true;
        transaction.ReconciliationNote = note;
        transaction.ReconciledAt = DateTimeOffset.Now;
    }

    public static decimal BankAccountBalance(AccountingData data, BankAccountRecord account) =>
        AccountingRules.Money(account.OpeningBalance +
            data.BankTransactions.Where(item => item.BankAccountId == account.Id)
                .Sum(item => item.Direction == "CREDIT" ? item.Amount : -item.Amount));

    private static void EnsureBaseChart(AccountingData data)
    {
        if (data.LedgerAccounts.Count == 0) NativeLedgerService.SeedDefaultChart(data);
        EnsureAccount(data, "2140", "وام‌های پرداختنی", "LIABILITY");
        EnsureAccount(data, "5300", "هزینهٔ بهرهٔ وام", "EXPENSE");
    }

    private static ChartOfAccountRecord EnsureAccount(AccountingData data, string code, string name, string type)
    {
        var existing = data.LedgerAccounts.SingleOrDefault(account =>
            string.Equals(account.Code, code, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            if (existing.Type != type || !existing.IsActive)
                throw new InvalidOperationException($"حساب {code} باید فعال و از نوع {type} باشد.");
            return existing;
        }
        return NativeLedgerService.AddAccount(data, code, name, type, "MAIN", null);
    }

    private static ChartOfAccountRecord RequireAccount(AccountingData data, string code, string type)
    {
        var account = data.LedgerAccounts.SingleOrDefault(item =>
            string.Equals(item.Code, code, StringComparison.OrdinalIgnoreCase) && item.IsActive);
        if (account is null || account.Type != type)
            throw new InvalidOperationException($"سرفصل حساب فعال {code} برای عملیات مالی وجود ندارد.");
        return account;
    }
}
