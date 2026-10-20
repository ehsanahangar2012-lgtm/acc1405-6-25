using System.Security.Cryptography;
using System.Text;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class AccountingBehaviorTests
{
    [TestMethod]
    public void TaxAndTotalAreRoundedToTwoDecimalsAwayFromZero()
    {
        Assert.AreEqual(100.00m, AccountingRules.CalculateTax(1000m, 10m));
        Assert.AreEqual(1100.00m, AccountingRules.CalculateTotal(1000m, 10m));
        Assert.AreEqual(0.01m, AccountingRules.CalculateTax(0.05m, 10m));
    }

    [TestMethod]
    public void RejectsTaxRateAboveOneHundredPercent()
    {
        Assert.ThrowsException<ArgumentOutOfRangeException>(()=>AccountingRules.CalculateTotal(100m,101m));
    }

    [TestMethod]
    public void PersianAndArabicDigitsAreParsed()
    {
        Assert.AreEqual(12345.67m,PersianNumberParser.ParseDecimal("۱۲٬۳۴۵٫۶۷","test"));
        Assert.AreEqual(789m,PersianNumberParser.ParseDecimal("٧٨٩","test"));
    }

    [TestMethod]
    public void InvoiceCreationUpdatesStockAndTotals()
    {
        var data=CreateSampleData(includeInvoice:false);
        var invoice=AccountingOperations.CreateInvoice(data,new InvoiceDraft{
            CustomerId=data.Customers[0].Id,TaxRatePercent=10m,Notes="نمونه",
            Lines=[new InvoiceLine{ProductId=data.Products[0].Id,ProductName=data.Products[0].Name,Quantity=2m,UnitPrice=100m,LineTotal=200m}]
        });
        Assert.AreEqual(1,invoice.Number);
        Assert.AreEqual(220m,invoice.Total);
        Assert.AreEqual(8m,data.Products[0].StockQuantity);
        Assert.AreEqual(2,data.NextInvoiceNumber);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void InvoiceRejectsInsufficientStockWithoutMutatingData()
    {
        var data=CreateSampleData(includeInvoice:false);
        Assert.ThrowsException<InvalidOperationException>(()=>AccountingOperations.CreateInvoice(data,new InvoiceDraft{
            CustomerId=data.Customers[0].Id,TaxRatePercent=0m,
            Lines=[new InvoiceLine{ProductId=data.Products[0].Id,ProductName=data.Products[0].Name,Quantity=99m,UnitPrice=10m,LineTotal=990m}]
        }));
        Assert.AreEqual(10m,data.Products[0].StockQuantity);
        Assert.AreEqual(0,data.Invoices.Count);
        Assert.AreEqual(1,data.NextInvoiceNumber);
    }

    [TestMethod]
    public void PartialAndFullPaymentsUpdateRemainingBalance()
    {
        var data=CreateSampleData(includeInvoice:true);
        var invoice=data.Invoices[0];
        AccountingOperations.RecordPayment(data,invoice.Id,400m,"نقدی","");
        Assert.AreEqual(700m,AccountingRules.RemainingForInvoice(data,invoice));
        AccountingOperations.RecordPayment(data,invoice.Id,700m,"واریز بانکی","REF-1");
        Assert.AreEqual("تسویه شده",invoice.Status);
        Assert.AreEqual(0m,AccountingRules.RemainingForInvoice(data,invoice));
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void EncryptedBackupRoundTripsDataAndHidesNames()
    {
        var data=CreateSampleData(includeInvoice:true);
        var bytes=BackupFileService.CreateEncryptedBackup(data,"sample-test-passphrase-2026");
        var restored=BackupFileService.ReadEncryptedBackup(bytes,"sample-test-passphrase-2026");
        Assert.AreEqual(1,restored.Customers.Count);
        Assert.AreEqual(1,restored.Products.Count);
        Assert.AreEqual(1,restored.Invoices.Count);
        Assert.AreEqual(1100m,restored.Invoices[0].Total);
        Assert.IsFalse(Encoding.UTF8.GetString(bytes).Contains("مشتری آزمایشی",StringComparison.Ordinal));
    }

    [TestMethod]
    public void WrongBackupPasswordIsRejected()
    {
        var bytes=BackupFileService.CreateEncryptedBackup(CreateSampleData(includeInvoice:true),"sample-test-passphrase-2026");
        Assert.ThrowsException<CryptographicException>(()=>BackupFileService.ReadEncryptedBackup(bytes,"another-wrong-passphrase"));
    }

    [TestMethod]
    public void LocalStoreRoundTripsProtectedDataForCurrentWindowsUser()
    {
        var folder=Path.Combine(Path.GetTempPath(),"AshkGhalamTests",Guid.NewGuid().ToString("N"));
        var path=Path.Combine(folder,"accounting-data.dat");
        try
        {
            var store=new LocalDataStore(path);
            store.Save(CreateSampleData(includeInvoice:true));
            var restored=store.Load();
            Assert.AreEqual(1,restored.Customers.Count);
            Assert.AreEqual(1,restored.Invoices.Count);
            Assert.IsFalse(Encoding.UTF8.GetString(File.ReadAllBytes(path)).Contains("مشتری آزمایشی",StringComparison.Ordinal));
        }
        finally{if(Directory.Exists(folder))Directory.Delete(folder,true);}
    }

    private static AccountingData CreateSampleData(bool includeInvoice)
    {
        var customer=new CustomerRecord{Id="customer-test-1",Name="مشتری آزمایشی",Phone="09120000000",Address="تهران"};
        var product=new ProductRecord{Id="product-test-1",Name="کالای آزمایشی",Sku="SKU-1",Unit="عدد",StockQuantity=10m,UnitPrice=100m};
        var data=new AccountingData{Customers=[customer],Products=[product],NextInvoiceNumber=1};
        if(includeInvoice)
            AccountingOperations.CreateInvoice(data,new InvoiceDraft{CustomerId=customer.Id,TaxRatePercent=10m,
                Lines=[new InvoiceLine{ProductId=product.Id,ProductName=product.Name,Quantity=10m,UnitPrice=100m,LineTotal=1000m}]});
        return data;
    }
}
