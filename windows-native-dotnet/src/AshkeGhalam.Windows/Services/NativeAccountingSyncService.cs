using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Manual, workspace-bound snapshot synchronization against the actual host-backend/storage.php
/// contract. Uses load/save + key/value, validates the workspace in every response and never
/// silently resolves differences between devices.
/// </summary>
public sealed class NativeAccountingSyncService
{
    public const string SnapshotKey = "native_wpf_accounting_dataset_v1";
    private const int MaximumPayloadBytes = 24_000_000;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };
    private readonly Func<Uri, HttpMessageHandler>? _testHandlerFactory;

    public NativeAccountingSyncService() { }

    internal NativeAccountingSyncService(Func<Uri, HttpMessageHandler> testHandlerFactory)
    {
        _testHandlerFactory = testHandlerFactory ?? throw new ArgumentNullException(nameof(testHandlerFactory));
    }

    public async Task<AccountingData?> DownloadAsync(
        ServerConnectionSettings settings,
        NativeLicenseState license,
        CancellationToken cancellationToken = default)
    {
        var address = ValidateConnection(settings, license);
        using var client = CreateClient(address);
        var requestJson = JsonSerializer.Serialize(new { action = "load", key = SnapshotKey });
        var response = await SendStorageRequestAsync(client, address, license, requestJson, cancellationToken)
            .ConfigureAwait(false);
        using (response.Response)
        using (var document = ParseResponseDocument(response.Body))
        {
            var root = document.RootElement;
            EnsureResponseWorkspace(root, license.WorkspaceId);

            if (!IsSuccess(root))
            {
                // Host storage returns success:false + workspace without error for a missing key.
                if (!root.TryGetProperty("error", out _) &&
                    root.TryGetProperty("workspace", out var missingWorkspace) &&
                    string.Equals(missingWorkspace.GetString(), license.WorkspaceId, StringComparison.Ordinal))
                    return null;

                throw BuildStorageException(root, "خواندن فضای کاری از سرور تأیید نشد.");
            }

            if (!root.TryGetProperty("data", out var dataElement) ||
                dataElement.ValueKind != JsonValueKind.String)
                throw new InvalidDataException("پاسخ storage.php باید داده را به‌صورت رشتهٔ JSON برگرداند.");

            var savedJson = dataElement.GetString();
            if (string.IsNullOrWhiteSpace(savedJson))
                throw new InvalidDataException("دادهٔ فضای کاری روی سرور خالی است.");

            var envelope = JsonSerializer.Deserialize<WorkspaceSnapshotEnvelope>(savedJson, JsonOptions)
                ?? throw new InvalidDataException("ساختار تصویر ذخیره‌شدهٔ فضای کاری معتبر نیست.");
            if (!string.Equals(envelope.WorkspaceId, license.WorkspaceId, StringComparison.Ordinal))
                throw new InvalidDataException("شناسهٔ فضای کاری ذخیره‌شده با لایسنس تأییدشده مطابقت ندارد.");
            if (envelope.SchemaVersion < 1 || envelope.Snapshot is null)
                throw new InvalidDataException("نسخه یا محتوای تصویر دادهٔ حسابداری روی سرور نامعتبر است.");

            return AccountingDataValidator.Validate(envelope.Snapshot);
        }
    }

    public async Task UploadAsync(
        ServerConnectionSettings settings,
        NativeLicenseState license,
        AccountingData data,
        CancellationToken cancellationToken = default)
    {
        var address = ValidateConnection(settings, license);
        var validated = AccountingDataValidator.Validate(data.DeepCopy());
        var envelope = new WorkspaceSnapshotEnvelope
        {
            WorkspaceId = license.WorkspaceId,
            SchemaVersion = validated.SchemaVersion,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
            Snapshot = validated
        };
        var encodedSnapshot = JsonSerializer.Serialize(envelope, JsonOptions);
        if (Encoding.UTF8.GetByteCount(encodedSnapshot) > MaximumPayloadBytes)
            throw new InvalidDataException("حجم فضای کاری از محدودیت امن API سرور بیشتر است؛ حجم داده و تصاویر چک‌ها را بررسی کنید.");

        // storage.php expects a JSON string in "value", not an object under "data".
        var requestJson = JsonSerializer.Serialize(new
        {
            action = "save",
            key = SnapshotKey,
            value = encodedSnapshot
        }, JsonOptions);

        using var client = CreateClient(address);
        var response = await SendStorageRequestAsync(client, address, license, requestJson, cancellationToken)
            .ConfigureAwait(false);
        using (response.Response)
        using (var document = ParseResponseDocument(response.Body))
        {
            var root = document.RootElement;
            EnsureResponseWorkspace(root, license.WorkspaceId);
            if (!IsSuccess(root))
                throw BuildStorageException(root, "سرور موفقیت ذخیرهٔ فضای کاری را تأیید نکرد.");
        }
    }

    private static Uri ValidateConnection(ServerConnectionSettings settings, NativeLicenseState license)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(license);
        var address = ApiEndpointPolicy.ValidateBaseAddress(settings.BaseUrl);
        var trusted = new Uri(ServerLicenseClient.AuthorityUrl + "/");
        if (!string.Equals(address.Host, trusted.Host, StringComparison.OrdinalIgnoreCase) ||
            address.Port != trusted.Port ||
            !string.Equals(address.Scheme, trusted.Scheme, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("همگام‌سازی فقط به سرور اصلی HTTPS اشک قلم مجاز است.");

        var workspaceId = license.WorkspaceId ?? "";
        if (workspaceId.Length is < 1 or > 80 ||
            !workspaceId.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '_' or '-') ||
            workspaceId is "default" or "main")
            throw new InvalidOperationException("شناسهٔ فضای کاری برای API ذخیره‌سازی معتبر نیست.");
        if (string.IsNullOrWhiteSpace(license.LicenseKey) || license.LicenseKey.Length > 512)
            throw new InvalidOperationException("کلید دسترسی فضای کاری معتبر نیست.");
        if (string.IsNullOrWhiteSpace(license.HardwareId) || license.HardwareId.Length > 256)
            throw new InvalidOperationException("شناسهٔ دستگاه برای اتصال امن معتبر نیست.");
        if (!string.IsNullOrWhiteSpace(settings.WorkspaceId) &&
            !string.Equals(settings.WorkspaceId.Trim(), workspaceId, StringComparison.Ordinal))
            throw new InvalidOperationException("شناسهٔ فضای کاری تنظیم‌شده با لایسنس تأییدشده یکسان نیست.");
        return address;
    }

    private HttpsApiClient CreateClient(Uri address) =>
        _testHandlerFactory is null
            ? new HttpsApiClient(address, TimeSpan.FromSeconds(45))
            : new HttpsApiClient(address, _testHandlerFactory(address), TimeSpan.FromSeconds(45));

    private static JsonDocument ParseResponseDocument(string body)
    {
        try
        {
            var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind == JsonValueKind.Object) return document;
            document.Dispose();
            throw new InvalidDataException("پاسخ storage.php یک شیء JSON معتبر نیست.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("پاسخ storage.php ساختار JSON معتبر ندارد.", ex);
        }
    }

    private static void EnsureResponseWorkspace(JsonElement root, string expectedWorkspace)
    {
        if (!root.TryGetProperty("workspace", out var workspace) ||
            workspace.ValueKind != JsonValueKind.String ||
            !string.Equals(workspace.GetString(), expectedWorkspace, StringComparison.Ordinal))
            throw new InvalidDataException("پاسخ API به فضای کاری مورد انتظار متصل نیست.");
    }

    private static bool IsSuccess(JsonElement root) =>
        root.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.True;

    private static InvalidDataException BuildStorageException(JsonElement root, string fallback)
    {
        var code = root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.String
            ? error.GetString() : null;
        return string.IsNullOrWhiteSpace(code)
            ? new InvalidDataException(fallback)
            : new InvalidDataException(fallback + " کد پاسخ: " + code + ".");
    }

    private static async Task<(HttpResponseMessage Response, string Body)> SendStorageRequestAsync(
        HttpsApiClient client,
        Uri address,
        NativeLicenseState license,
        string requestJson,
        CancellationToken cancellationToken)
    {
        // Deployments may expose storage.php at the root or under host-backend/.
        // Redirects remain disabled; only a genuine HTTP 404 triggers candidate fallback.
        var paths = address.AbsolutePath.TrimEnd('/').EndsWith("/host-backend", StringComparison.OrdinalIgnoreCase)
            ? new[] { "storage.php" }
            : new[] { "storage.php", "host-backend/storage.php" };

        for (var i = 0; i < paths.Length; i++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, paths[i]);
            request.Headers.Accept.ParseAdd("application/json");
            request.Headers.Add("X-Workspace-ID", license.WorkspaceId);
            request.Headers.Add("X-Workspace-Token", license.LicenseKey);
            request.Headers.Add("X-Device-HWID", license.HardwareId);
            request.Content = new StringContent(requestJson, Encoding.UTF8, "application/json");

            var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.StatusCode == HttpStatusCode.NotFound && i < paths.Length - 1)
            {
                response.Dispose();
                continue;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                response.Dispose();
                throw new HttpRequestException($"سرور ذخیره‌سازی پاسخ HTTP {(int)response.StatusCode} برگرداند.");
            }
            return (response, body);
        }

        throw new HttpRequestException("مسیر storage.php روی سرور اصلی پیدا نشد.");
    }

    private sealed class WorkspaceSnapshotEnvelope
    {
        public string WorkspaceId { get; set; } = "";
        public int SchemaVersion { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }
        public AccountingData? Snapshot { get; set; }
    }
}
