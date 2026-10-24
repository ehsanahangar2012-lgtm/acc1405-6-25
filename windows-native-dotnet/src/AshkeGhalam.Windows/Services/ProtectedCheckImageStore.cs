using System.IO;
using System.Security.Cryptography;
using System.Text;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Keeps a DPAPI-protected file mirror of cheque photos beside the local accounting dataset.
/// The encrypted image copy inside AccountingData is retained so encrypted backups stay self-contained.
/// </summary>
public static class ProtectedCheckImageStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("AshkeGhalam.WPF.CheckImage.v1");

    public static string DirectoryPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AshkeGhalam", "WindowsNative", "CheckImages");

    public static bool Synchronize(IReadOnlyCollection<CheckRecord> checks)
    {
        ArgumentNullException.ThrowIfNull(checks);
        var changed = false;
        var retained = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (checks.Any(check => !string.IsNullOrWhiteSpace(check.ImageDataBase64)) ||
            checks.Any(check => IsManagedPath(check.ImagePath)))
            Directory.CreateDirectory(DirectoryPath);

        foreach (var check in checks)
        {
            if (check is null) continue;
            if (!string.IsNullOrWhiteSpace(check.ImageDataBase64))
            {
                var relativePath = Store(check.Id, check.ImageDataBase64);
                retained.Add(Path.GetFileName(relativePath));
                if (!string.Equals(check.ImagePath, relativePath, StringComparison.Ordinal))
                {
                    check.ImagePath = relativePath;
                    changed = true;
                }
            }
            else if (TryResolveManagedPath(check.ImagePath, out var existing) && File.Exists(existing))
                retained.Add(Path.GetFileName(existing));
        }

        if (Directory.Exists(DirectoryPath))
        {
            foreach (var file in Directory.EnumerateFiles(DirectoryPath, "*.ashkimg", SearchOption.TopDirectoryOnly))
            {
                if (retained.Contains(Path.GetFileName(file))) continue;
                try { File.Delete(file); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
        return changed;
    }

    public static string Store(string checkId, string encodedImage)
    {
        if (string.IsNullOrWhiteSpace(checkId) || checkId.Length > 128 ||
            checkId.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch is not ('_' or '-')))
            throw new InvalidDataException("شناسهٔ چک برای ذخیرهٔ تصویر معتبر نیست.");
        byte[] raw;
        try { raw = Convert.FromBase64String(encodedImage); }
        catch (FormatException ex) { throw new InvalidDataException("دادهٔ تصویر چک معتبر نیست.", ex); }
        if (raw.Length == 0 || raw.Length > 5 * 1024 * 1024)
            throw new InvalidDataException("حجم تصویر چک معتبر نیست.");

        Directory.CreateDirectory(DirectoryPath);
        var fileName = checkId + ".ashkimg";
        var path = Path.Combine(DirectoryPath, fileName);
        try
        {
            if (File.Exists(path))
            {
                try
                {
                    var oldRaw = ReadProtectedFile(path);
                    try { if (oldRaw.AsSpan().SequenceEqual(raw)) return "CheckImages/" + fileName; }
                    finally { CryptographicOperations.ZeroMemory(oldRaw); }
                }
                catch (CryptographicException) { }
                catch (IOException) { }
            }
            var encrypted = ProtectedData.Protect(raw, Entropy, DataProtectionScope.CurrentUser);
            var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 32 * 1024, FileOptions.WriteThrough))
                {
                    stream.Write(encrypted, 0, encrypted.Length);
                    stream.Flush(flushToDisk: true);
                }
                File.Move(temporary, path, overwrite: true);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(encrypted);
                if (File.Exists(temporary)) File.Delete(temporary);
            }
            return "CheckImages/" + fileName;
        }
        finally { CryptographicOperations.ZeroMemory(raw); }
    }

    public static byte[] Read(string relativePath)
    {
        if (!TryResolveManagedPath(relativePath, out var path) || !File.Exists(path))
            throw new FileNotFoundException("فایل تصویر محافظت‌شده پیدا نشد.");
        return ReadProtectedFile(path);
    }

    public static void ClearAll()
    {
        if (!Directory.Exists(DirectoryPath)) return;
        foreach (var file in Directory.EnumerateFiles(DirectoryPath, "*.ashkimg", SearchOption.TopDirectoryOnly))
        {
            try { File.Delete(file); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private static byte[] ReadProtectedFile(string path) =>
        ProtectedData.Unprotect(File.ReadAllBytes(path), Entropy, DataProtectionScope.CurrentUser);

    private static bool IsManagedPath(string? value) => TryResolveManagedPath(value, out _);

    private static bool TryResolveManagedPath(string? value, out string path)
    {
        path = "";
        if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Replace('\\', '/');
        const string prefix = "CheckImages/";
        if (!normalized.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return false;
        var fileName = normalized[prefix.Length..];
        if (fileName.Length < 9 || !fileName.EndsWith(".ashkimg", StringComparison.OrdinalIgnoreCase) ||
            fileName.Contains('/') || fileName.Contains("..", StringComparison.Ordinal))
            return false;
        var candidate = Path.GetFullPath(Path.Combine(DirectoryPath, fileName));
        var root = Path.GetFullPath(DirectoryPath) + Path.DirectorySeparatorChar;
        if (!candidate.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return false;
        path = candidate;
        return true;
    }
}
