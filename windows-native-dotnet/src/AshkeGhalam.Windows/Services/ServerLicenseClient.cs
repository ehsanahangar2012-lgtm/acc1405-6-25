using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AshkeGhalam.Windows.Services;

public sealed class ServerLicenseReceipt
{
    [JsonPropertyName("signed_payload")]
    public string SignedPayload { get; set; } = "";
    [JsonPropertyName("signature")]
    public string Signature { get; set; } = "";
    [JsonPropertyName("algorithm")]
    public string Algorithm { get; set; } = "";
}

public sealed class VerifiedLicensePayload
{
    [JsonPropertyName("issuer")] public string Issuer { get; set; } = "";
    [JsonPropertyName("workspace_id")] public string WorkspaceId { get; set; } = "";
    [JsonPropertyName("company_name")] public string CompanyName { get; set; } = "";
    [JsonPropertyName("license_key_hash")] public string LicenseKeyHash { get; set; } = "";
    [JsonPropertyName("hwid")] public string HardwareId { get; set; } = "";
    [JsonPropertyName("plan")] public string Plan { get; set; } = "";
    [JsonPropertyName("max_customers")] public int MaxCustomers { get; set; }
    [JsonPropertyName("max_documents")] public int MaxDocuments { get; set; }
    [JsonPropertyName("max_users")] public int MaxUsers { get; set; }
    [JsonPropertyName("is_unlimited")] public bool IsUnlimited { get; set; }
    [JsonPropertyName("features")] public List<string> Features { get; set; } = [];
    [JsonPropertyName("expire_date")] public string ExpireDate { get; set; } = "";
    [JsonPropertyName("issued_at")] public long IssuedAt { get; set; }
    [JsonPropertyName("expires_at")] public long ExpiresAt { get; set; }
}

public sealed class VerifiedServerLicense
{
    public VerifiedLicensePayload Payload { get; set; } = new();
    public ServerLicenseReceipt Receipt { get; set; } = new();
}

public sealed record ServerLicenseVerificationResult(
    bool Success, string Message, VerifiedServerLicense? License = null);

/// <summary>
/// Talks to the same fixed HTTPS authority and verifies the same RSA-SHA256 signed receipt
/// used by the source TypeScript client. No signing/private key or license bypass exists here.
/// </summary>
public sealed class ServerLicenseClient
{
    public const string AuthorityUrl = "https://acc.ashkghalam.ir";
    private const string ReceiptAlgorithm = "RSASSA-PKCS1-v1_5-SHA256";
    private static readonly string[] AllowedPlans = ["TRIAL", "HEMAYAT", "BRONZE", "SILVER", "GOLD", "ENTERPRISE"];
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly HttpClient Http = CreateHttpClient();
    private static readonly SemaphoreSlim KeyLock = new(1, 1);
    private static RSA? _cachedPublicKey;

    private static HttpClient CreateHttpClient()
    {
        var handler = new HttpClientHandler { AllowAutoRedirect = false };
        return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(20) };
    }

    public async Task<ServerLicenseVerificationResult> VerifyAsync(
        string licenseKey, string workspaceId, string hardwareId, CancellationToken cancellationToken = default)
    {
        licenseKey = (licenseKey ?? "").Trim();
        workspaceId = (workspaceId ?? "").Trim();
        hardwareId = (hardwareId ?? "").Trim().ToUpperInvariant();

        if (licenseKey.Length is < 4 or > 512)
            return new(false, "کلید لایسنس را به‌درستی وارد کنید.");
        if (workspaceId.Length is < 1 or > 180 || workspaceId.Equals("default", StringComparison.OrdinalIgnoreCase) ||
            workspaceId.Equals("main", StringComparison.OrdinalIgnoreCase))
            return new(false, "شناسهٔ فضای کاری معتبر نیست.");
        if (hardwareId.Length == 0)
            return new(false, "شناسهٔ دستگاه موجود نیست؛ تأیید لایسنس متوقف شد.");

        try
        {
            var receipt = await RequestReceiptAsync(licenseKey, workspaceId, hardwareId, cancellationToken);
            if (receipt is null)
                return new(false, "سرور لایسنس مجوز فعال همراه با رسید امضاشده برنگرداند.");
            var verified = await VerifyReceiptAsync(licenseKey, workspaceId, hardwareId, receipt, cancellationToken);
            return verified is null
                ? new(false, "رسید لایسنس از نظر امضا، دستگاه، فضای کاری، تاریخ یا سهمیه معتبر نیست.")
                : new(true, "لایسنس توسط سرور و امضای رمزنگاری‌شده تأیید شد.", verified);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return new(false, "درخواست تأیید لایسنس لغو شد.");
        }
        catch (TaskCanceledException)
        {
            return new(false, "پاسخ سرور لایسنس در مهلت مقرر دریافت نشد.");
        }
        catch (HttpRequestException)
        {
            return new(false, "اتصال امن به سرور لایسنس برقرار نشد؛ اینترنت و دسترسی به سرور را بررسی کنید.");
        }
        catch (JsonException)
        {
            return new(false, "پاسخ سرور لایسنس ساختار معتبر JSON نداشت.");
        }
        catch (CryptographicException)
        {
            return new(false, "بررسی امضای رمزنگاری‌شدهٔ لایسنس انجام نشد.");
        }
        catch (Exception)
        {
            // Never place a key, signed payload, or server body into UI/log output.
            return new(false, "تأیید لایسنس کامل نشد. هیچ مجوزی به‌صورت محلی جعل یا فعال نشد.");
        }
    }

    private static async Task<ServerLicenseReceipt?> RequestReceiptAsync(
        string licenseKey, string workspaceId, string hardwareId, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.Serialize(new
        {
            action = "verify_license",
            workspace_id = workspaceId,
            token = licenseKey,
            hwid = hardwareId
        });
        foreach (var endpoint in new[]
        {
            AuthorityUrl + "/tenant-manager.php",
            AuthorityUrl + "/host-backend/tenant-manager.php"
        })
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Accept.ParseAdd("application/json");
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using var response = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound)
                continue;
            if ((int)response.StatusCode is >= 300 and < 400)
                throw new HttpRequestException("Redirect is not accepted for licensing API.");
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            using var json = JsonDocument.Parse(text);
            var root = json.RootElement;
            if (!root.TryGetProperty("allowed", out var allowed) || allowed.ValueKind != JsonValueKind.True ||
                !root.TryGetProperty("status", out var status) || status.GetString() != "ACTIVE" ||
                !root.TryGetProperty("license_receipt", out var receiptElement) ||
                receiptElement.ValueKind != JsonValueKind.Object)
                return null;

            return receiptElement.Deserialize<ServerLicenseReceipt>(JsonOptions);
        }
        return null;
    }

    private static async Task<VerifiedServerLicense?> VerifyReceiptAsync(
        string licenseKey, string workspaceId, string hardwareId, ServerLicenseReceipt receipt,
        CancellationToken cancellationToken)
    {
        if (receipt.Algorithm != ReceiptAlgorithm ||
            string.IsNullOrWhiteSpace(receipt.SignedPayload) ||
            string.IsNullOrWhiteSpace(receipt.Signature))
            return null;

        byte[] payloadBytes;
        byte[] signatureBytes;
        try
        {
            payloadBytes = Convert.FromBase64String(receipt.SignedPayload);
            signatureBytes = Convert.FromBase64String(receipt.Signature);
        }
        catch (FormatException) { return null; }

        if (payloadBytes.Length is 0 or > 128 * 1024 || signatureBytes.Length is 0 or > 4096)
            return null;

        var key = await GetPublicKeyAsync(cancellationToken);
        if (!key.VerifyData(payloadBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
            return null;

        var payload = JsonSerializer.Deserialize<VerifiedLicensePayload>(payloadBytes, JsonOptions);
        if (payload is null)
            return null;

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (payload.Issuer != "ashkghalam-license-v1" ||
            !string.Equals(payload.WorkspaceId, workspaceId, StringComparison.Ordinal) ||
            !string.Equals(payload.HardwareId, hardwareId, StringComparison.OrdinalIgnoreCase) ||
            payload.IssuedAt <= 0 || payload.IssuedAt > now + 60 ||
            payload.ExpiresAt <= now || !AllowedPlans.Contains(payload.Plan, StringComparer.Ordinal) ||
            payload.Features is null || payload.Features.Count > 1000 ||
            payload.Features.Any(f => f is null || f.Length > 200) ||
            payload.MaxCustomers < -1 || payload.MaxDocuments < -1 || payload.MaxUsers < 1 ||
            payload.CompanyName.Length > 500)
            return null;

        var expectedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(licenseKey.ToUpperInvariant()))).ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(payload.LicenseKeyHash.ToLowerInvariant()),
                Encoding.ASCII.GetBytes(expectedHash)))
            return null;

        if (!payload.IsUnlimited)
        {
            if (!DateOnly.TryParseExact(payload.ExpireDate, "yyyy-MM-dd",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var expiry) ||
                expiry.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture) != payload.ExpireDate ||
                expiry.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc) < DateTime.UtcNow)
                return null;
        }

        return new VerifiedServerLicense { Payload = payload, Receipt = receipt };
    }

    private static async Task<RSA> GetPublicKeyAsync(CancellationToken cancellationToken)
    {
        if (_cachedPublicKey is not null) return _cachedPublicKey;
        await KeyLock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedPublicKey is not null) return _cachedPublicKey;
            foreach (var endpoint in new[]
            {
                AuthorityUrl + "/tenant-manager.php?action=public_key",
                AuthorityUrl + "/host-backend/tenant-manager.php?action=public_key"
            })
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
                request.Headers.Accept.ParseAdd("application/json");
                using var response = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if (response.StatusCode == HttpStatusCode.NotFound)
                    continue;
                if ((int)response.StatusCode is >= 300 and < 400)
                    throw new HttpRequestException("Redirect is not accepted for licensing public key.");
                if (!response.IsSuccessStatusCode)
                    continue;
                var text = await response.Content.ReadAsStringAsync(cancellationToken);
                using var json = JsonDocument.Parse(text);
                var root = json.RootElement;
                if (!root.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True ||
                    !root.TryGetProperty("public_key", out var publicKeyElement) ||
                    publicKeyElement.ValueKind != JsonValueKind.String)
                    continue;

                var pem = publicKeyElement.GetString();
                if (string.IsNullOrWhiteSpace(pem) || pem.Length > 32 * 1024)
                    continue;
                var rsa = RSA.Create();
                try
                {
                    rsa.ImportFromPem(pem);
                    if (rsa.KeySize < 2048)
                        throw new CryptographicException("The server RSA key is too short.");
                    _cachedPublicKey = rsa;
                    return rsa;
                }
                catch
                {
                    rsa.Dispose();
                    throw;
                }
            }
            throw new HttpRequestException("The licensing public key endpoint is unavailable.");
        }
        finally
        {
            KeyLock.Release();
        }
    }
}
