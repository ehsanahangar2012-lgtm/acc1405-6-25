using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record NativeQuotaLimits(int MaxCustomers, int MaxDocuments, bool IsLicensed, string Plan);

public sealed record NativeQuotaDecision(bool Allowed, string Message, int CurrentCount, int Limit);

/// <summary>
/// Conservative client-side quota policy. Entitlements are honored only when passed from a
/// receipt freshly verified online in this application session. No saved local flag unlocks a plan.
/// </summary>
public static class NativeLicenseQuotaService
{
    public const int TrialMaxCustomers = 30;
    public const int TrialMaxDocuments = 100;

    public static int CountDocuments(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        // Mirrors the source quota service's broad document domain: invoices, vouchers,
        // payments/transactions, checks and locally recorded expenses. Journal records are
        // included because the native branch adds a separate ledger module.
        return checked(data.Invoices.Count + data.Vouchers.Count + data.Payments.Count +
            data.Checks.Count + data.Expenses.Count + data.JournalEntries.Count);
    }

    public static NativeQuotaLimits GetLimits(VerifiedLicensePayload? sessionEntitlements)
    {
        if (sessionEntitlements is null ||
            sessionEntitlements.ExpiresAt <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            return new NativeQuotaLimits(TrialMaxCustomers, TrialMaxDocuments, false, "TRIAL");

        var plan = string.IsNullOrWhiteSpace(sessionEntitlements.Plan) ? "TRIAL" : sessionEntitlements.Plan;
        if (sessionEntitlements.IsUnlimited)
            return new NativeQuotaLimits(-1, -1, true, plan);

        var fallback = plan switch
        {
            "HEMAYAT" => (Customers: 70, Documents: 450),
            "BRONZE" => (Customers: 50, Documents: 500),
            "SILVER" => (Customers: 200, Documents: 2000),
            _ => (Customers: TrialMaxCustomers, Documents: TrialMaxDocuments)
        };
        var maxCustomers = sessionEntitlements.MaxCustomers >= 0
            ? sessionEntitlements.MaxCustomers : fallback.Customers;
        var maxDocuments = sessionEntitlements.MaxDocuments >= 0
            ? sessionEntitlements.MaxDocuments : fallback.Documents;

        return new NativeQuotaLimits(maxCustomers, maxDocuments, true, plan);
    }

    public static NativeQuotaDecision CanAddCustomer(AccountingData data, VerifiedLicensePayload? sessionEntitlements)
    {
        ArgumentNullException.ThrowIfNull(data);
        var limits = GetLimits(sessionEntitlements);
        var count = data.Customers.Count;
        if (limits.MaxCustomers < 0 || count < limits.MaxCustomers)
            return new NativeQuotaDecision(true, "ثبت طرف حساب مجاز است.", count, limits.MaxCustomers);

        var reason = limits.IsLicensed
            ? $"سقف پلن {limits.Plan} ({limits.MaxCustomers:N0} طرف حساب) تکمیل شده است. برای افزایش سهمیه با پشتیبانی تماس بگیرید."
            : $"نسخهٔ پایهٔ اشک قلم حداکثر {limits.MaxCustomers:N0} طرف حساب دارد؛ برای ادامه، لایسنس را آنلاین تأیید کنید.";
        return new NativeQuotaDecision(false, reason, count, limits.MaxCustomers);
    }

    public static NativeQuotaDecision CanAddDocument(AccountingData data, VerifiedLicensePayload? sessionEntitlements)
    {
        ArgumentNullException.ThrowIfNull(data);
        var limits = GetLimits(sessionEntitlements);
        var count = CountDocuments(data);
        if (limits.MaxDocuments < 0 || count < limits.MaxDocuments)
            return new NativeQuotaDecision(true, "ثبت سند مجاز است.", count, limits.MaxDocuments);

        var reason = limits.IsLicensed
            ? $"سقف پلن {limits.Plan} ({limits.MaxDocuments:N0} سند) تکمیل شده است. برای افزایش سهمیه با پشتیبانی تماس بگیرید."
            : $"نسخهٔ پایهٔ اشک قلم حداکثر {limits.MaxDocuments:N0} سند دارد؛ برای ادامه، لایسنس را آنلاین تأیید کنید.";
        return new NativeQuotaDecision(false, reason, count, limits.MaxDocuments);
    }
}
