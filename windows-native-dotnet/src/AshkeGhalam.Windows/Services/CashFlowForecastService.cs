using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record CashFlowMovement(
    DateTimeOffset Date,
    string Direction,
    string Kind,
    string DocumentNumber,
    string Counterparty,
    decimal Amount,
    string Status,
    bool IsOverdue,
    int DaysFromDue,
    string ReferenceType,
    string ReferenceId);

public sealed record CashFlowProjectionLine(
    DateTimeOffset Date,
    decimal ExpectedInflows,
    decimal ExpectedOutflows,
    decimal NetChange,
    decimal ProjectedBalance,
    int MovementCount,
    int OverdueCount);

public sealed record CashFlowForecastSnapshot(
    DateTimeOffset AsOf,
    int HorizonDays,
    decimal OpeningBalance,
    decimal TotalExpectedInflows,
    decimal TotalExpectedOutflows,
    decimal ProjectedClosingBalance,
    IReadOnlyList<CashFlowProjectionLine> Projection,
    IReadOnlyList<CashFlowMovement> Movements);

/// <summary>
/// Estimates short-term cash from dated, outstanding local commitments.
/// It is explicitly a forecast, not bank reconciliation; linked checks are skipped
/// when an open invoice is already represented to avoid double-counting the same obligation.
/// </summary>
public static class CashFlowForecastService
{
    private static readonly HashSet<string> SettledCheckStatuses = new(StringComparer.Ordinal)
    {
        "PASSED", "CASHED", "RETURNED", "BOUNCED"
    };

    private static readonly HashSet<string> ExpectedCheckStatuses = new(StringComparer.Ordinal)
    {
        "PENDING", "DEPOSITED", "TRANSFERRED"
    };

    private static readonly HashSet<string> CashAccountCodes = new(StringComparer.Ordinal)
    {
        "1110", "1120"
    };

    public static CashFlowForecastSnapshot Build(
        AccountingData data,
        int horizonDays = 30,
        DateTimeOffset? asOf = null)
    {
        ArgumentNullException.ThrowIfNull(data);
        if (horizonDays is not (30 or 60 or 90))
            throw new ArgumentOutOfRangeException(nameof(horizonDays), "افق پیش‌بینی باید ۳۰، ۶۰ یا ۹۰ روز باشد.");

        var today = (asOf ?? DateTimeOffset.Now).Date;
        var cutoff = today.AddDays(horizonDays);
        var openingBalance = NativeLedgerService.GetTrialBalance(data)
            .Where(account => CashAccountCodes.Contains(account.Code))
            .Sum(account => account.Balance);

        var movements = new List<CashFlowMovement>();

        foreach (var invoice in data.Invoices)
        {
            if (invoice.Status == "لغو شده" ||
                invoice.Type == "PROFORMA" ||
                invoice.DueDate is not DateTimeOffset dueDate)
                continue;

            var remaining = AccountingRules.RemainingForInvoice(data, invoice);
            if (remaining <= 0m || dueDate.Date > cutoff)
                continue;

            var daysFromDue = (dueDate.Date - today).Days;
            var isPurchase = invoice.Type == "PURCHASE";
            movements.Add(new CashFlowMovement(
                EffectiveForecastDate(dueDate, today),
                isPurchase ? "خروج وجه" : "ورود وجه",
                isPurchase ? "پرداخت به تأمین‌کننده" : "دریافت از مشتری",
                invoice.DisplayNumber,
                invoice.CustomerName,
                remaining,
                invoice.Status,
                daysFromDue < 0,
                daysFromDue,
                invoice.Type,
                invoice.Id));
        }

        foreach (var check in data.Checks)
        {
            if (!ExpectedCheckStatuses.Contains(check.Status) ||
                SettledCheckStatuses.Contains(check.Status) ||
                check.DueDate.Date > cutoff)
                continue;

            // A linked check may already be represented by the outstanding invoice balance.
            // Do not count it a second time until the source invoice/check allocation model is unified.
            if (!string.IsNullOrWhiteSpace(check.RelatedInvoiceId) &&
                data.Invoices.Any(invoice => invoice.Id == check.RelatedInvoiceId && invoice.Status != "لغو شده"))
                continue;

            var received = string.IsNullOrWhiteSpace(check.CheckType) ||
                string.Equals(check.CheckType, "RECEIVED", StringComparison.Ordinal);
            var daysFromDue = (check.DueDate.Date - today).Days;
            var number = string.IsNullOrWhiteSpace(check.CheckNumber) ? check.SayadId : check.CheckNumber;
            var contact = string.IsNullOrWhiteSpace(check.PersonName) ? check.HolderName : check.PersonName;
            movements.Add(new CashFlowMovement(
                EffectiveForecastDate(check.DueDate, today),
                received ? "ورود وجه" : "خروج وجه",
                received ? "وصول چک دریافتی" : "پرداخت چک صادره",
                number,
                contact,
                AccountingRules.Money(check.Amount),
                check.Status,
                daysFromDue < 0,
                daysFromDue,
                "CHECK",
                check.Id));
        }

        var orderedMovements = movements
            .OrderBy(movement => movement.Date)
            .ThenBy(movement => movement.Direction, StringComparer.Ordinal)
            .ThenBy(movement => movement.DocumentNumber, StringComparer.Ordinal)
            .ToList();

        var dailyGroups = orderedMovements.GroupBy(movement => movement.Date.Date)
            .ToDictionary(group => group.Key, group => group.ToList());
        if (!dailyGroups.ContainsKey(today))
            dailyGroups[today] = [];

        var projection = new List<CashFlowProjectionLine>();
        var runningBalance = openingBalance;
        foreach (var date in dailyGroups.Keys.OrderBy(date => date))
        {
            var dayMovements = dailyGroups[date];
            var inflows = dayMovements
                .Where(movement => movement.Direction == "ورود وجه")
                .Sum(movement => movement.Amount);
            var outflows = dayMovements
                .Where(movement => movement.Direction == "خروج وجه")
                .Sum(movement => movement.Amount);
            runningBalance = AccountingRules.Money(runningBalance + inflows - outflows);
            projection.Add(new CashFlowProjectionLine(
                new DateTimeOffset(date, TimeSpan.Zero),
                inflows,
                outflows,
                inflows - outflows,
                runningBalance,
                dayMovements.Count,
                dayMovements.Count(movement => movement.IsOverdue)));
        }

        return new CashFlowForecastSnapshot(
            new DateTimeOffset(today, TimeSpan.Zero),
            horizonDays,
            openingBalance,
            orderedMovements.Where(movement => movement.Direction == "ورود وجه").Sum(movement => movement.Amount),
            orderedMovements.Where(movement => movement.Direction == "خروج وجه").Sum(movement => movement.Amount),
            projection.Count == 0 ? openingBalance : projection[^1].ProjectedBalance,
            projection,
            orderedMovements);
    }

    private static DateTimeOffset EffectiveForecastDate(DateTimeOffset dueDate, DateTime today)
    {
        var effectiveDate = dueDate.Date < today ? today : dueDate.Date;
        return new DateTimeOffset(effectiveDate, TimeSpan.Zero);
    }
}
