using System;
using System.Security.Cryptography;
using System.Text;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class BackupFileServiceTests
{
    private const string ValidPassphrase = "Secur3-AshkeGhalam-Backup!";

    [TestMethod]
    public void EncryptedBackupRoundTripRestoresBusinessRecords()
    {
        var data = CreateSampleData();

        var encrypted = BackupFileService.CreateEncryptedBackup(data, ValidPassphrase);
        var restored = BackupFileService.ReadEncryptedBackup(encrypted, ValidPassphrase);

        Assert.AreEqual(1, restored.Customers.Count);
        Assert.AreEqual("شرکت نمونهٔ پشتیبان", restored.Customers[0].Name);
        Assert.AreEqual("CUS-BACKUP-001", restored.Customers[0].Code);
        Assert.AreEqual(1, restored.Products.Count);
        Assert.AreEqual("SKU-BACKUP-001", restored.Products[0].Sku);
        Assert.AreEqual(7m, restored.Products[0].StockQuantity);
        Assert.AreEqual(2m, restored.Products[0].ReservedStock);
    }

    [TestMethod]
    public void EncryptedBackupRejectsWrongPasswordAndModifiedCiphertext()
    {
        var encrypted = BackupFileService.CreateEncryptedBackup(CreateSampleData(), ValidPassphrase);

        Assert.ThrowsException<CryptographicException>(() =>
            BackupFileService.ReadEncryptedBackup(encrypted, "Another-Password-That-Is-Wrong"));

        var json = Encoding.UTF8.GetString(encrypted);
        const string marker = "\"Ciphertext\": \"";
        var valueStart = json.IndexOf(marker, StringComparison.Ordinal);
        Assert.IsTrue(valueStart >= 0, "The encrypted envelope must expose the expected ciphertext field.");
        valueStart += marker.Length;
        Assert.IsTrue(valueStart < json.Length, "Ciphertext must not be empty.");
        var changed = json[valueStart] == 'A' ? 'B' : 'A';
        var tamperedJson = json[..valueStart] + changed + json[(valueStart + 1)..];

        Assert.ThrowsException<CryptographicException>(() =>
            BackupFileService.ReadEncryptedBackup(Encoding.UTF8.GetBytes(tamperedJson), ValidPassphrase));
    }

    [TestMethod]
    public void EncryptedBackupRequiresAtLeastTwelvePassphraseCharacters()
    {
        Assert.ThrowsException<ArgumentException>(() =>
            BackupFileService.CreateEncryptedBackup(CreateSampleData(), "too-short"));
        Assert.ThrowsException<ArgumentException>(() =>
            BackupFileService.ReadEncryptedBackup([1, 2, 3], "too-short"));
    }

    private static AccountingData CreateSampleData() => new()
    {
        Customers =
        [
            new CustomerRecord
            {
                Id = "backup-customer-1",
                Code = "CUS-BACKUP-001",
                Name = "شرکت نمونهٔ پشتیبان",
                Phone = "09120000002",
                Type = "CUSTOMER",
                IsCustomer = true,
                IsSupplier = false
            }
        ],
        Products =
        [
            new ProductRecord
            {
                Id = "backup-product-1",
                Name = "کالای نمونهٔ پشتیبان",
                Sku = "SKU-BACKUP-001",
                Unit = "عدد",
                StockQuantity = 7m,
                ReservedStock = 2m,
                BuyPrice = 20m,
                UnitPrice = 35m
            }
        ],
        NextInvoiceNumber = 1
    };
}
