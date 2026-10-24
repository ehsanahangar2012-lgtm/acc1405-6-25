using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record DueCalendarItem(
    DateTimeOffset DueDate,
    string Kind,
    string DocumentNumber,
    string Contact,
    decimal Amount,
    string Status,
    int DaysFromDue,
    string ReferenceType,
    string ReferenceId);

/// <summary>
/// Builds a local due-date view from unpaid invoices and unresolved checks.
/// It never invents a due date where the source record has none.
/// </summary>
public static class DueCalendarService
{
    private static readonly HashSet<string> ResolvedCheckStatuses = new(StringComparer.Ordinal)
    {
        "PASSED", "CASHED"
    };

    public static IReadOnlyList<DueCalendarItem> GetItems(AccountingData data, DateTimeOffset? asOf = null)
    {
        ArgumentNullException.ThrowIfNull(data);
        var today = (asOf ?? DateTimeOffset.Now).Date;
        var result = new List<DueCalendarItem>();

        foreach (var invoice in data.Invoices)
        {
            if (invoice.Status == "لغو شده" || invoice.Type == "PROFORMA" || invoice.DueDate is not DateTimeOffset dueDate)
                continue;

            var remaining = AccountingRules.RemainingForInvoice(data, invoice);
            if (remaining <= 0m)
                continue;

            var kind = invoice.Type == "PURCHASE" ? "پرداخت به تأمین‌کننده" : "دریافت از مشتری";
            result.Add(new DueCalendarItem(
                dueDate,
                kind,
                invoice.DisplayNumber,
                invoice.CustomerName,
                remaining,
                invoice.Status,
                (dueDate.Date - today).Days,
                invoice.Type,
                invoice.Id));
        }

        foreach (var check in data.Checks)
        {
            if (ResolvedCheckStatuses.Contains(check.Status))
                continue;

            var received = string.IsNullOrWhiteSpace(check.CheckType) ||
                string.Equals(check.CheckType, "RECEIVED", StringComparison.Ordinal);
            var kind = received ? "وصول چک دریافتی" : "پرداخت چک صادره";
            var contact = string.IsNullOrWhiteSpace(check.PersonName) ? check.HolderName : check.PersonName;
            var label = check.Status switch
            {
                "PENDING" => "در انتظار",
                "DEPOSITED" => "واگذار به بانک",
                "BOUNCED" => "برگشتی — نیازمند پیگیری",
                "RETURNED" => "عودت‌شده — نیازمند پیگیری",
                "TRANSFERRED" => "واگذار شده",
                _ => check.Status
            };

            result.Add(new DueCalendarItem(
                check.DueDate,
                kind,
                string.IsNullOrWhiteSpace(check.CheckNumber) ? check.SayadId : check.CheckNumber,
                contact,
                check.Amount,
                label,
                (check.DueDate.Date - today).Days,
                "CHECK",
                check.Id));
        }

        return result
            .OrderBy(item => item.DueDate)
            .ThenBy(item => item.Kind, StringComparer.Ordinal)
            .ThenBy(item => item.DocumentNumber, StringComparer.Ordinal)
            .ToList();
    }
}
