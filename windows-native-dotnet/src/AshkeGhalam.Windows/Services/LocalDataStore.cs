using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Protects this beta's local dataset for the current Windows user using DPAPI.
/// This is not a multi-user database or a substitute for server-side authorization.
/// </summary>
public sealed class LocalDataStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("AshkeGhalam.WPF.LocalData.v1");
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly string _filePath;

    public LocalDataStore(string? filePath = null)
    {
        _filePath = filePath ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AshkeGhalam", "WindowsNative", "accounting-data.dat");
    }

    public AccountingData Load()
    {
        if (!File.Exists(_filePath))
            return new AccountingData();

        byte[]? encrypted = null;
        byte[]? json = null;
        try
        {
            encrypted = File.ReadAllBytes(_filePath);
            if (encrypted.Length == 0 || encrypted.Length > 100 * 1024 * 1024)
                throw new InvalidDataException("حجم فایل دادهٔ محلی معتبر نیست.");

            json = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
            var data = JsonSerializer.Deserialize<AccountingData>(json);
            return AccountingDataValidator.Validate(data);
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or InvalidDataException or IOException)
        {
            throw new InvalidDataException(
                "فایل دادهٔ محلی خوانده یا تأیید نشد. برای جلوگیری از بازنویسی ناخواسته، ثبت اطلاعات غیرفعال شد؛ از بخش بازیابی، یک بک‌آپ معتبر بازیابی کنید.",
                ex);
        }
        finally
        {
            if (encrypted is not null)
                CryptographicOperations.ZeroMemory(encrypted);
            if (json is not null)
                CryptographicOperations.ZeroMemory(json);
        }
    }

    public void Save(AccountingData data)
    {
        AccountingDataValidator.Validate(data);
        var json = JsonSerializer.SerializeToUtf8Bytes(data, JsonOptions);
        byte[]? encrypted = null;
        var temp = _filePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            encrypted = ProtectedData.Protect(json, Entropy, DataProtectionScope.CurrentUser);
            var directory = Path.GetDirectoryName(_filePath)
                ?? throw new InvalidOperationException("مسیر ذخیره‌سازی محلی معتبر نیست.");
            Directory.CreateDirectory(directory);

            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, FileOptions.WriteThrough))
            {
                stream.Write(encrypted, 0, encrypted.Length);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temp, _filePath, overwrite: true);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(json);
            if (encrypted is not null)
                CryptographicOperations.ZeroMemory(encrypted);
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

}
