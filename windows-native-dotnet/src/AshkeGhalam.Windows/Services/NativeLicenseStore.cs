using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Stores the last server-verified receipt and its associated license key only as a
/// DPAPI-protected sidecar for this Windows user. A saved receipt is not silently refreshed
/// or treated as perpetually valid; UI can request a fresh online verification.
/// </summary>
public sealed class NativeLicenseState
{
    public int SchemaVersion { get; set; } = 1;
    public string LicenseKey { get; set; } = "";
    public string WorkspaceId { get; set; } = "";
    public string HardwareId { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public VerifiedLicensePayload Payload { get; set; } = new();
    public ServerLicenseReceipt Receipt { get; set; } = new();
    public DateTimeOffset VerifiedAtUtc { get; set; }
}

public sealed class NativeLicenseStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("AshkeGhalam.WPF.LicenseState.v1");
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };
    private readonly string _filePath;

    public NativeLicenseStore(string? filePath = null)
    {
        _filePath = filePath ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AshkeGhalam", "WindowsNative", "license-state.dat");
    }

    public NativeLicenseState? Load()
    {
        if (!File.Exists(_filePath)) return null;
        try
        {
            var encrypted = File.ReadAllBytes(_filePath);
            if (encrypted.Length is 0 or > 2 * 1024 * 1024)
                throw new InvalidDataException("حجم وضعیت لایسنس ذخیره‌شده معتبر نیست.");
            var json = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
            var state = JsonSerializer.Deserialize<NativeLicenseState>(json);
            ValidateStateShape(state);
            return state;
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or InvalidDataException or IOException)
        {
            throw new InvalidDataException(
                "وضعیت لایسنس محلی قابل تأیید نیست. برای ایمنی، آن را فعال فرض نکردیم؛ از مسیر فعال‌سازی، اعتبار را دوباره با سرور بررسی کنید.",
                ex);
        }
    }

    public void Save(NativeLicenseState state)
    {
        ValidateStateShape(state);
        var json = JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions);
        var encrypted = ProtectedData.Protect(json, Entropy, DataProtectionScope.CurrentUser);
        var directory = Path.GetDirectoryName(_filePath)
            ?? throw new InvalidOperationException("مسیر وضعیت لایسنس معتبر نیست.");
        Directory.CreateDirectory(directory);
        var temp = _filePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 16 * 1024, FileOptions.WriteThrough))
            {
                stream.Write(encrypted, 0, encrypted.Length);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temp, _filePath, overwrite: true);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    public void Clear()
    {
        if (File.Exists(_filePath)) File.Delete(_filePath);
    }

    private static void ValidateStateShape(NativeLicenseState? state)
    {
        if (state is null || state.SchemaVersion != 1 ||
            string.IsNullOrWhiteSpace(state.LicenseKey) || state.LicenseKey.Length > 512 ||
            string.IsNullOrWhiteSpace(state.WorkspaceId) || state.WorkspaceId.Length > 180 ||
            string.IsNullOrWhiteSpace(state.HardwareId) || state.HardwareId.Length > 160 ||
            state.CompanyName is null || state.CompanyName.Length > 500 ||
            state.Payload is null || state.Receipt is null ||
            string.IsNullOrWhiteSpace(state.Receipt.SignedPayload) ||
            string.IsNullOrWhiteSpace(state.Receipt.Signature) ||
            state.Receipt.Algorithm != "RSASSA-PKCS1-v1_5-SHA256" ||
            state.VerifiedAtUtc == default)
            throw new InvalidDataException("وضعیت محلی لایسنس ناقص یا ناسازگار است.");
    }
}
