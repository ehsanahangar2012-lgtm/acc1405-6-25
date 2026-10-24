using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public static class BackupFileService
{
    private const string Format = "ASHKEGHALAM_WPF_BACKUP_V1";
    private const int Iterations = 310_000;
    private const int SaltLength = 16;
    private const int NonceLength = 12;
    private const int KeyLength = 32;
    private const int TagLength = 16;
    private const int MaxBackupBytes = 100 * 1024 * 1024;
    private static readonly byte[] AdditionalData = Encoding.UTF8.GetBytes(Format);
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private sealed class BackupEnvelope
    {
        public string Format { get; set; } = "";
        public int Version { get; set; }
        public string Cipher { get; set; } = "";
        public string Kdf { get; set; } = "";
        public int Iterations { get; set; }
        public string Salt { get; set; } = "";
        public string Nonce { get; set; } = "";
        public string Ciphertext { get; set; } = "";
        public string Tag { get; set; } = "";
    }

    public static byte[] CreateEncryptedBackup(AccountingData data, string passphrase)
    {
        AccountingDataValidator.Validate(data);
        ValidatePassphrase(passphrase);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(data, JsonOptions);
        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var nonce = RandomNumberGenerator.GetBytes(NonceLength);
        var key = Rfc2898DeriveBytes.Pbkdf2(passphrase, salt, Iterations, HashAlgorithmName.SHA256, KeyLength);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagLength];
        try
        {
            using (var aes = new AesGcm(key, TagLength))
                aes.Encrypt(nonce, plaintext, ciphertext, tag, AdditionalData);
            var envelope = new BackupEnvelope
            {
                Format = Format, Version = 1, Cipher = "AES-256-GCM",
                Kdf = "PBKDF2-SHA256", Iterations = Iterations,
                Salt = Convert.ToBase64String(salt), Nonce = Convert.ToBase64String(nonce),
                Ciphertext = Convert.ToBase64String(ciphertext), Tag = Convert.ToBase64String(tag)
            };
            return JsonSerializer.SerializeToUtf8Bytes(envelope, JsonOptions);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public static AccountingData ReadEncryptedBackup(byte[] fileBytes, string passphrase)
    {
        ValidatePassphrase(passphrase);
        if (fileBytes is null || fileBytes.Length == 0 || fileBytes.Length > MaxBackupBytes)
            throw new InvalidDataException("حجم فایل پشتیبان معتبر نیست.");

        BackupEnvelope? envelope;
        try { envelope = JsonSerializer.Deserialize<BackupEnvelope>(fileBytes); }
        catch (JsonException ex) { throw new InvalidDataException("ساختار فایل پشتیبان قابل خواندن نیست.", ex); }

        if (envelope is null || envelope.Format != Format || envelope.Version != 1 ||
            envelope.Cipher != "AES-256-GCM" || envelope.Kdf != "PBKDF2-SHA256" ||
            envelope.Iterations != Iterations)
            throw new InvalidDataException("این فایل، نسخهٔ پشتیبان شناخته‌شدهٔ اشک قلم نیست.");

        byte[] salt, nonce, ciphertext, tag;
        try
        {
            salt = Convert.FromBase64String(envelope.Salt);
            nonce = Convert.FromBase64String(envelope.Nonce);
            ciphertext = Convert.FromBase64String(envelope.Ciphertext);
            tag = Convert.FromBase64String(envelope.Tag);
        }
        catch (FormatException ex) { throw new InvalidDataException("ساختار رمزنگاری پشتیبان ناقص است.", ex); }

        if (salt.Length != SaltLength || nonce.Length != NonceLength || tag.Length != TagLength ||
            ciphertext.Length > MaxBackupBytes)
            throw new InvalidDataException("ابعاد دادهٔ رمزنگاری‌شده معتبر نیست.");

        var key = Rfc2898DeriveBytes.Pbkdf2(passphrase, salt, Iterations, HashAlgorithmName.SHA256, KeyLength);
        var plaintext = new byte[ciphertext.Length];
        try
        {
            using (var aes = new AesGcm(key, TagLength))
                aes.Decrypt(nonce, ciphertext, tag, plaintext, AdditionalData);
            var data = JsonSerializer.Deserialize<AccountingData>(plaintext);
            return AccountingDataValidator.Validate(data);
        }
        catch (CryptographicException ex) { throw new CryptographicException("رمز پشتیبان اشتباه است یا فایل دستکاری شده است.", ex); }
        catch (JsonException ex) { throw new InvalidDataException("محتوای پشتیبان معتبر نیست.", ex); }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private static void ValidatePassphrase(string passphrase)
    {
        if (string.IsNullOrWhiteSpace(passphrase) || passphrase.Trim().Length < 12)
            throw new ArgumentException("رمز پشتیبان باید حداقل ۱۲ نویسه داشته باشد.", nameof(passphrase));
    }
}
