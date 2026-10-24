using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class ServerLicenseClientTests
{
    private const string LicenseKey = "ASHK-TEST-KEY-827364";
    private const string WorkspaceId = "client_test_01";
    private const string HardwareId = "ASHK-HWID-1111-2222-3333-4444";

    [TestMethod]
    public async Task VerifyAsyncAcceptsActiveServerReceiptWithCorrectRsaSignatureAndClaims()
    {
        using var rsa = RSA.Create(2048);
        using var http = new HttpClient(new FakeLicenseApiHandler(rsa, LicenseKey, WorkspaceId, HardwareId));
        var client = new ServerLicenseClient(http);

        var result = await client.VerifyAsync(LicenseKey, WorkspaceId, HardwareId);

        Assert.IsTrue(result.Success, result.Message);
        Assert.IsNotNull(result.License);
        Assert.AreEqual("GOLD", result.License.Payload.Plan);
        Assert.AreEqual(250, result.License.Payload.MaxCustomers);
        Assert.AreEqual(WorkspaceId, result.License.Payload.WorkspaceId);
        Assert.AreEqual(HardwareId, result.License.Payload.HardwareId);
        Assert.AreEqual(ServerLicenseClient.AuthorityUrl, "https://acc.ashkghalam.ir");
    }

    [TestMethod]
    public async Task VerifyAsyncRejectsReceiptBoundToDifferentWorkspaceEvenWhenSignatureIsValid()
    {
        using var rsa = RSA.Create(2048);
        using var http = new HttpClient(new FakeLicenseApiHandler(
            rsa, LicenseKey, WorkspaceId, HardwareId, payloadWorkspaceId: "different_workspace"));
        var client = new ServerLicenseClient(http);

        var result = await client.VerifyAsync(LicenseKey, WorkspaceId, HardwareId);

        Assert.IsFalse(result.Success);
        Assert.IsNull(result.License);
    }

    [TestMethod]
    public async Task VerifyAsyncRejectsInvalidSignature()
    {
        using var rsa = RSA.Create(2048);
        using var http = new HttpClient(new FakeLicenseApiHandler(
            rsa, LicenseKey, WorkspaceId, HardwareId, tamperSignature: true));
        var client = new ServerLicenseClient(http);

        var result = await client.VerifyAsync(LicenseKey, WorkspaceId, HardwareId);

        Assert.IsFalse(result.Success);
        Assert.IsNull(result.License);
    }

    private sealed class FakeLicenseApiHandler : HttpMessageHandler
    {
        private readonly string _publicKeyPem;
        private readonly string _receiptJson;

        public FakeLicenseApiHandler(
            RSA rsa, string key, string workspaceId, string hardwareId,
            string? payloadWorkspaceId = null, bool tamperSignature = false)
        {
            _publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();
            var now = DateTimeOffset.UtcNow;
            var validThrough = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20));
            var licenseKeyHash = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(key.Trim().ToUpperInvariant()))).ToLowerInvariant();
            var payload = new
            {
                issuer = "ashkghalam-license-v1",
                workspace_id = payloadWorkspaceId ?? workspaceId,
                company_name = "شرکت آزمایشی",
                license_key_hash = licenseKeyHash,
                hwid = hardwareId,
                plan = "GOLD",
                max_customers = 250,
                max_documents = 2000,
                max_users = 10,
                is_unlimited = false,
                features = new[] { "invoices", "inventory", "reports" },
                expire_date = validThrough.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                issued_at = now.ToUnixTimeSeconds(),
                expires_at = now.AddDays(5).ToUnixTimeSeconds()
            };
            var bytes = JsonSerializer.SerializeToUtf8Bytes(payload);
            var signature = rsa.SignData(bytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            if (tamperSignature) signature[0] ^= 0x80;

            _receiptJson = JsonSerializer.Serialize(new
            {
                allowed = true,
                status = "ACTIVE",
                license_receipt = new
                {
                    signed_payload = Convert.ToBase64String(bytes),
                    signature = Convert.ToBase64String(signature),
                    algorithm = "RSASSA-PKCS1-v1_5-SHA256"
                }
            });
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var uri = request.RequestUri?.AbsoluteUri ?? "";
            if (request.Method == HttpMethod.Get && uri.Contains("action=public_key", StringComparison.Ordinal))
            {
                var keyBody = JsonSerializer.Serialize(new { success = true, public_key = _publicKeyPem });
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(keyBody, Encoding.UTF8, "application/json")
                });
            }

            if (request.Method == HttpMethod.Post && uri.StartsWith(
                    ServerLicenseClient.AuthorityUrl, StringComparison.Ordinal))
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(_receiptJson, Encoding.UTF8, "application/json")
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
