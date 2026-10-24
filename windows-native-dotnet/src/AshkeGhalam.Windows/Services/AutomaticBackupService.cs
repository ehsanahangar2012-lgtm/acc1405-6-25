using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Scheduled AES-GCM backups. The backup password is DPAPI-protected for the current Windows user.
/// Only this service's own automatic-backup files are pruned; manually chosen backups are untouched.
/// </summary>
public static class AutomaticBackupService
{
    private const int DefaultRetention = 20;
    private static readonly byte[] PasswordEntropy = Encoding.UTF8.GetBytes("AshkeGhalam.WPF.AutoBackup.Password.v1");
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public sealed class Settings
    {
        public bool Enabled { get; set; }
        public int IntervalHours { get; set; } = 24;
        public int RetentionCount { get; set; } = DefaultRetention;
        public string ProtectedPassphrase { get; set; } = "";
        public DateTimeOffset? LastBackupUtc { get; set; }
        public string BackupDirectoryPath { get; set; } = "";
    }

    public static string DefaultBackupDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AshkeGhalam", "WindowsNative", "Backups");

    public static string BackupDirectory => GetBackupDirectory(LoadSettings());

    private static string GetBackupDirectory(Settings settings) =>
        Path.GetFullPath(string.IsNullOrWhiteSpace(settings.BackupDirectoryPath)
            ? DefaultBackupDirectory
            : settings.BackupDirectoryPath.Trim());

    public static void SetBackupDirectory(string directory)
    {
        if (string.IsNullOrWhiteSpace(directory))
            throw new ArgumentException("مسیر پوشهٔ پشتیبان را انتخاب کنید.", nameof(directory));
        var normalized = Path.GetFullPath(directory.Trim());
        Directory.CreateDirectory(normalized);
        var settings = LoadSettings();
        settings.BackupDirectoryPath = normalized;
        SaveSettings(settings);
    }

    private static string SettingsPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AshkeGhalam", "WindowsNative", "automatic-backup-settings.json");

    public static Settings LoadSettings()
    {
        if (!File.Exists(SettingsPath))
            return new Settings { BackupDirectoryPath = DefaultBackupDirectory };

        try
        {
            var settings = JsonSerializer.Deserialize<Settings>(File.ReadAllBytes(SettingsPath))
                ?? throw new InvalidDataException("تنظیمات پشتیبان خودکار خالی است.");
            if (settings.IntervalHours is not (1 or 6 or 12 or 24 or 168))
                settings.IntervalHours = 24;
            settings.RetentionCount = Math.Clamp(settings.RetentionCount, 1, 20);
            settings.ProtectedPassphrase ??= "";
            settings.BackupDirectoryPath = string.IsNullOrWhiteSpace(settings.BackupDirectoryPath)
                ? DefaultBackupDirectory : Path.GetFullPath(settings.BackupDirectoryPath);
            return settings;
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            throw new InvalidDataException("تنظیمات پشتیبان خودکار قابل خواندن نیست؛ برای جلوگیری از حذف یا بازنویسی ناخواسته بررسی لازم است.", ex);
        }
    }

    public static bool HasConfiguredPassphrase(Settings? settings = null) =>
        !string.IsNullOrWhiteSpace((settings ?? LoadSettings()).ProtectedPassphrase);

    public static void SetPassphrase(string passphrase)
    {
        if (string.IsNullOrWhiteSpace(passphrase) || passphrase.Trim().Length < 12)
            throw new ArgumentException("رمز پشتیبان باید حداقل ۱۲ نویسه داشته باشد.", nameof(passphrase));

        var settings = LoadSettings();
        var protectedBytes = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(passphrase), PasswordEntropy, DataProtectionScope.CurrentUser);
        settings.ProtectedPassphrase = Convert.ToBase64String(protectedBytes);
        SaveSettings(settings);
    }

    public static void SaveSettings(bool enabled, int intervalHours, int retentionCount = DefaultRetention)
    {
        if (intervalHours is not (1 or 6 or 12 or 24 or 168))
            throw new ArgumentOutOfRangeException(nameof(intervalHours), "بازه پشتیبان باید ۱، ۶، ۱۲، ۲۴ یا ۱۶۸ ساعت باشد.");

        var settings = LoadSettings();
        if (enabled && string.IsNullOrWhiteSpace(settings.ProtectedPassphrase))
            throw new InvalidOperationException("برای فعال‌کردن پشتیبان خودکار ابتدا رمز پشتیبان را تعیین کنید.");
        settings.Enabled = enabled;
        settings.IntervalHours = intervalHours;
        settings.RetentionCount = Math.Clamp(retentionCount, 1, DefaultRetention);
        SaveSettings(settings);
    }

    /// <summary>Creates a backup when the saved schedule is due. Returns null when no backup is due.</summary>
    public static string? TryCreateDueBackup(AccountingData data)
    {
        var settings = LoadSettings();
        if (!settings.Enabled)
            return null;

        var now = DateTimeOffset.UtcNow;
        if (settings.LastBackupUtc is DateTimeOffset last &&
            now < last.AddHours(settings.IntervalHours))
            return null;

        var passphrase = UnprotectPassphrase(settings);
        var path = CreateBackupFile(data, passphrase, GetBackupDirectory(settings), settings.RetentionCount, now);
        settings.LastBackupUtc = now;
        SaveSettings(settings);
        return path;
    }

    public static string CreateBackupNow(AccountingData data)
    {
        var settings = LoadSettings();
        var passphrase = UnprotectPassphrase(settings);
        var now = DateTimeOffset.UtcNow;
        var path = CreateBackupFile(data, passphrase, GetBackupDirectory(settings), settings.RetentionCount, now);
        settings.LastBackupUtc = now;
        SaveSettings(settings);
        return path;
    }

    public static string CreateBackupFile(
        AccountingData data,
        string passphrase,
        string directory,
        int retentionCount = DefaultRetention,
        DateTimeOffset? timestamp = null)
    {
        ArgumentNullException.ThrowIfNull(data);
        if (string.IsNullOrWhiteSpace(directory))
            throw new ArgumentException("مسیر پشتیبان معتبر نیست.", nameof(directory));
        retentionCount = Math.Clamp(retentionCount, 1, DefaultRetention);
        Directory.CreateDirectory(directory);

        var time = (timestamp ?? DateTimeOffset.Now).ToLocalTime();
        var calendar = new PersianCalendar();
        var fileName = string.Format(CultureInfo.InvariantCulture,
            "AshkeGhalam-AutoBackup-{0:0000}-{1:00}-{2:00}-{3:00}{4:00}{5:00}.ashkbackup",
            calendar.GetYear(time.DateTime), calendar.GetMonth(time.DateTime), calendar.GetDayOfMonth(time.DateTime),
            time.Hour, time.Minute, time.Second);
        var finalPath = Path.Combine(directory, fileName);
        // Avoid overwriting a prior same-second backup.
        if (File.Exists(finalPath))
            finalPath = Path.Combine(directory, Path.GetFileNameWithoutExtension(fileName) + "-" + Guid.NewGuid().ToString("N")[..6] + ".ashkbackup");

        var bytes = BackupFileService.CreateEncryptedBackup(data, passphrase);
        var temporaryPath = finalPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write,
                       FileShare.None, 64 * 1024, FileOptions.WriteThrough))
            {
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporaryPath, finalPath);
        }
        finally
        {
            if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
            CryptographicOperations.ZeroMemory(bytes);
        }

        PruneOldAutomaticBackups(directory, retentionCount);
        return finalPath;
    }

    public static int PruneOldAutomaticBackups(string directory, int retentionCount = DefaultRetention)
    {
        if (!Directory.Exists(directory)) return 0;
        retentionCount = Math.Clamp(retentionCount, 1, DefaultRetention);
        var files = new DirectoryInfo(directory)
            .GetFiles("AshkeGhalam-AutoBackup-*.ashkbackup", SearchOption.TopDirectoryOnly)
            .OrderByDescending(file => file.LastWriteTimeUtc)
            .ThenByDescending(file => file.Name, StringComparer.Ordinal)
            .ToList();

        var removed = 0;
        foreach (var file in files.Skip(retentionCount))
        {
            try { file.Delete(); removed++; }
            catch (IOException) { /* A backup open by another process will be pruned on the next run. */ }
            catch (UnauthorizedAccessException) { /* Preserve files whose deletion is not permitted. */ }
        }
        return removed;
    }

    private static string UnprotectPassphrase(Settings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.ProtectedPassphrase))
            throw new InvalidOperationException("رمز پشتیبان خودکار تنظیم نشده است.");
        try
        {
            var bytes = ProtectedData.Unprotect(
                Convert.FromBase64String(settings.ProtectedPassphrase), PasswordEntropy, DataProtectionScope.CurrentUser);
            try
            {
                var passphrase = Encoding.UTF8.GetString(bytes);
                if (passphrase.Trim().Length < 12)
                    throw new InvalidDataException("رمز پشتیبان ذخیره‌شده معتبر نیست.");
                return passphrase;
            }
            finally { CryptographicOperations.ZeroMemory(bytes); }
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            throw new CryptographicException("رمز پشتیبان خودکار برای حساب کاربری فعلی قابل بازکردن نیست؛ دوباره تعیینش کنید.", ex);
        }
    }

    private static void SaveSettings(Settings settings)
    {
        var directory = Path.GetDirectoryName(SettingsPath)!;
        Directory.CreateDirectory(directory);
        var bytes = JsonSerializer.SerializeToUtf8Bytes(settings, JsonOptions);
        var temp = SettingsPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write,
                       FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temp, SettingsPath, overwrite: true);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
            if (File.Exists(temp)) File.Delete(temp);
        }
    }
}
