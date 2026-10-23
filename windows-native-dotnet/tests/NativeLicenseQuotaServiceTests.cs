using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeLicenseQuotaServiceTests
{
    [TestMethod]
    public void TrialCustomerQuotaAllowsTwentyNineButRejectsTheThirtyFirstRecord()
    {
        var data = new AccountingData();
        for (var i = 0; i < 29; i++) data.Customers.Add(new CustomerRecord { Name = $"مشتری {i}" });
        Assert.IsTrue(NativeLicenseQuotaService.CanAddCustomer(data, null).Allowed);

        data.Customers.Add(new CustomerRecord { Name = "مشتری ۳۰" });
        var decision = NativeLicenseQuotaService.CanAddCustomer(data, null);
        Assert.IsFalse(decision.Allowed);
        Assert.AreEqual(30, decision.Limit);
        StringAssert.Contains(decision.Message, "۳۰");
    }

    [TestMethod]
    public void TrialDocumentQuotaAllowsNinetyNineButRejectsTheNextRecord()
    {
        var data = new AccountingData();
        for (var i = 0; i < 99; i++) data.Invoices.Add(new InvoiceRecord { Number = i + 1 });
        Assert.IsTrue(NativeLicenseQuotaService.CanAddDocument(data, null).Allowed);

        data.Invoices.Add(new InvoiceRecord { Number = 100 });
        var decision = NativeLicenseQuotaService.CanAddDocument(data, null);
        Assert.IsFalse(decision.Allowed);
        Assert.AreEqual(100, decision.Limit);
    }

    [TestMethod]
    public void VerifiedHemayatEntitlementUsesSourceFallbackLimitsWhenClaimsUseMinusOne()
    {
        var payload = ValidEntitlement();
        payload.Plan = "HEMAYAT";
        payload.MaxCustomers = -1;
        payload.MaxDocuments = -1;

        var limits = NativeLicenseQuotaService.GetLimits(payload);

        Assert.IsTrue(limits.IsLicensed);
        Assert.AreEqual(70, limits.MaxCustomers);
        Assert.AreEqual(450, limits.MaxDocuments);
    }

    [TestMethod]
    public void UnlimitedEntitlementHasNoCustomerOrDocumentLimit()
    {
        var payload = ValidEntitlement();
        payload.IsUnlimited = true;
        payload.MaxCustomers = 0;
        payload.MaxDocuments = 0;
        var data = new AccountingData();
        for (var i = 0; i < 110; i++)
        {
            data.Customers.Add(new CustomerRecord { Name = $"مشتری {i}" });
            data.Invoices.Add(new InvoiceRecord { Number = i + 1 });
        }

        Assert.IsTrue(NativeLicenseQuotaService.CanAddCustomer(data, payload).Allowed);
        Assert.IsTrue(NativeLicenseQuotaService.CanAddDocument(data, payload).Allowed);
    }

    [TestMethod]
    public void ExpiredPayloadDoesNotUnlockCommercialQuota()
    {
        var payload = ValidEntitlement();
        payload.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds();
        payload.IsUnlimited = true;
        var data = new AccountingData();
        for (var i = 0; i < 30; i++) data.Customers.Add(new CustomerRecord { Name = $"مشتری {i}" });

        var decision = NativeLicenseQuotaService.CanAddCustomer(data, payload);

        Assert.IsFalse(decision.Allowed);
        Assert.AreEqual("TRIAL", NativeLicenseQuotaService.GetLimits(payload).Plan);
        Assert.AreEqual(30, decision.Limit);
    }

    private static VerifiedLicensePayload ValidEntitlement() => new()
    {
        Issuer = "ashkghalam-license-v1",
        WorkspaceId = "workspace-test",
        LicenseKeyHash = new string('a', 64),
        HardwareId = "ASHK-HWID-1111-2222-3333-4444",
        Plan = "GOLD",
        MaxCustomers = 100,
        MaxDocuments = 500,
        MaxUsers = 3,
        IsUnlimited = false,
        Features = ["invoices"],
        ExpireDate = "2027-12-31",
        IssuedAt = DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds(),
        ExpiresAt = DateTimeOffset.UtcNow.AddDays(20).ToUnixTimeSeconds()
    };
}
