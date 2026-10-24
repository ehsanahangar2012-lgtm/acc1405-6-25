using System.Net.Http;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Manual, workspace-bound snapshot sync using the authenticated host storage API.
/// Differences are sent back to the UI for explicit resolution; no silent merge or license issuing occurs here.
/// </summary>
public sealed class NativeAccountingSyncService
{
    private const string SnapshotId = "native_wpf_accounting_dataset_v1";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<AccountingData?> DownloadAsync(ServerConnectionSettings settings, NativeLicenseState license,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateClient(settings, license);
        using var request = CreateRequest(HttpMethod.Post, "storage.php", license);
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            action = "get", table = "config", id = SnapshotId
        }), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"سرور همگام‌سازی پاسخ {(int)response.StatusCode} برگرداند.");
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        if (!root.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True)
            throw new InvalidDataException("خواندن داده از فضای کاری سرور تأیید نشد.");
        if (!root.TryGetProperty("data", out var row) || row.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        if (row.ValueKind != JsonValueKind.Object ||
            !row.TryGetProperty("id", out var id) ||
            !string.Equals(id.GetString(), SnapshotId, StringComparison.Ordinal))
            throw new InvalidDataException("رکورد همگام‌سازی سرور معتبر نیست.");
        if (!row.TryGetProperty("workspaceId", out var workspace) ||
            !string.Equals(workspace.GetString(), license.WorkspaceId, StringComparison.Ordinal))
            throw new InvalidDataException("شناسهٔ فضای کاری سرور با لایسنس این دستگاه مطابقت ندارد.");
        if (!row.TryGetProperty("snapshot", out var snapshot))
            throw new InvalidDataException("دادهٔ حسابداری در رکورد سرور موجود نیست.");

        var remote = snapshot.ValueKind == JsonValueKind.String
            ? JsonSerializer.Deserialize<AccountingData>(snapshot.GetString() ?? "", JsonOptions)
            : snapshot.Deserialize<AccountingData>(JsonOptions);
        return AccountingDataValidator.Validate(remote);
    }

    public async Task UploadAsync(ServerConnectionSettings settings, NativeLicenseState license, AccountingData data,
        CancellationToken cancellationToken = default)
    {
        var validated = AccountingDataValidator.Validate(data.DeepCopy());
        using var client = CreateClient(settings, license);
        using var request = CreateRequest(HttpMethod.Post, "storage.php", license);
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            action = "save",
            table = "config",
            data = new
            {
                id = SnapshotId,
                workspaceId = license.WorkspaceId,
                schemaVersion = validated.SchemaVersion,
                updatedAtUtc = DateTimeOffset.UtcNow,
                snapshot = validated
            }
        }), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"ذخیرهٔ فضای کاری روی سرور تأیید نشد (HTTP {(int)response.StatusCode}).");
        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True)
            throw new InvalidDataException("سرور موفقیت ذخیرهٔ فضای کاری را تأیید نکرد.");
    }

    private static HttpsApiClient CreateClient(ServerConnectionSettings settings, NativeLicenseState license)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(license);
        var address = ApiEndpointPolicy.ValidateBaseAddress(settings.BaseUrl);
        var trusted = new Uri(ServerLicenseClient.AuthorityUrl + "/");
        if (!string.Equals(address.Host, trusted.Host, StringComparison.OrdinalIgnoreCase) ||
            address.Port != trusted.Port || !string.Equals(address.Scheme, trusted.Scheme, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("همگام‌سازی فقط با سرور اصلی HTTPS اشک قلم مجاز است.");
        if (string.IsNullOrWhiteSpace(license.WorkspaceId) || string.IsNullOrWhiteSpace(license.LicenseKey))
            throw new InvalidOperationException("ابتدا لایسنس معتبر را از سرور اصلی تأیید کنید.");
        if (!string.IsNullOrWhiteSpace(settings.WorkspaceId) &&
            !string.Equals(settings.WorkspaceId.Trim(), license.WorkspaceId, StringComparison.Ordinal))
            throw new InvalidOperationException("شناسهٔ فضای کاری با لایسنس تأییدشده یکسان نیست.");
        return new HttpsApiClient(address, TimeSpan.FromSeconds(45));
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string path, NativeLicenseState license)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-Workspace-ID", license.WorkspaceId);
        request.Headers.Add("X-Workspace-Token", license.LicenseKey);
        request.Headers.Add("X-Device-HWID", license.HardwareId);
        return request;
    }
}
