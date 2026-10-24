using System.Text;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeLicenseStoreTests
{
    [TestMethod]
    public void SaveAndLoadRoundTripsStateWithoutWritingLicenseKeyAsPlaintext()
    {
        var root = Path.Combine(Path.GetTempPath(), "AshkeGhalam-LicenseTests-" + Guid.NewGuid().ToString("N"));
        var file = Path.Combine(root, "license-state.dat");
        const string secret = "SENSITIVE-LICENSE-KEY-DO-NOT-WRITE-PLAINTEXT";
        try
        {
            var store = new NativeLicenseStore(file);
            Assert.IsNull(store.Load());

            store.Save(new NativeLicenseState
            {
                LicenseKey = secret,
                WorkspaceId = "workspace-test",
                HardwareId = "ASHK-HWID-1111-2222-3333-4444",
                CompanyName = "شرکت آزمون",
                Payload = new VerifiedLicensePayload
                {
                    Issuer = "ashkghalam-license-v1",
                    WorkspaceId = "workspace-test",
                    CompanyName = "شرکت آزمون",
                    LicenseKeyHash = new string('a', 64),
                    HardwareId = "ASHK-HWID-1111-2222-3333-4444",
                    Plan = "GOLD",
                    MaxCustomers = 100,
                    MaxDocuments = 500,
                    MaxUsers = 3,
                    IsUnlimited = false,
                    Features = ["invoices"],
                    ExpireDate = "2027-12-31",
                    IssuedAt = 100,
                    ExpiresAt = 200
                },
                Receipt = new ServerLicenseReceipt
                {
                    Algorithm = "RSASSA-PKCS1-v1_5-SHA256",
                    SignedPayload = Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"test\":true}")),
                    Signature = Convert.ToBase64String([1, 2, 3])
                },
                VerifiedAtUtc = DateTimeOffset.UtcNow
            });

            Assert.IsTrue(File.Exists(file));
            var fileText = Encoding.UTF8.GetString(File.ReadAllBytes(file));
            Assert.IsFalse(fileText.Contains(secret, StringComparison.Ordinal));
            var restored = store.Load();

            Assert.IsNotNull(restored);
            Assert.AreEqual(secret, restored.LicenseKey);
            Assert.AreEqual("workspace-test", restored.WorkspaceId);
            Assert.AreEqual("GOLD", restored.Payload.Plan);
            Assert.AreEqual("RSASSA-PKCS1-v1_5-SHA256", restored.Receipt.Algorithm);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    [TestMethod]
    public void ClearRemovesEncryptedLicenseSidecar()
    {
        var root = Path.Combine(Path.GetTempPath(), "AshkeGhalam-LicenseTests-" + Guid.NewGuid().ToString("N"));
        var file = Path.Combine(root, "license-state.dat");
        var store = new NativeLicenseStore(file);
        try
        {
            store.Save(new NativeLicenseState
            {
                LicenseKey = "LICENSE-KEY-CLEAR-TEST",
                WorkspaceId = "workspace-test",
                HardwareId = "ASHK-HWID-1111-2222-3333-4444",
                Payload = new VerifiedLicensePayload { Plan = "TRIAL" },
                Receipt = new ServerLicenseReceipt
                {
                    Algorithm = "RSASSA-PKCS1-v1_5-SHA256",
                    SignedPayload = Convert.ToBase64String([1, 2, 3]),
                    Signature = Convert.ToBase64String([4, 5, 6])
                },
                VerifiedAtUtc = DateTimeOffset.UtcNow
            });
            Assert.IsTrue(File.Exists(file));
            store.Clear();
            Assert.IsFalse(File.Exists(file));
            Assert.IsNull(store.Load());
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }
}
