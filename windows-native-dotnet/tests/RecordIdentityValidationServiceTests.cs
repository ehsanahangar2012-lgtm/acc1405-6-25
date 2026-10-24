using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class RecordIdentityValidationServiceTests
{
    [TestMethod]
    public void PersonCodeRejectsCaseInsensitiveDuplicatesAndAllowsCurrentRecordDuringEdit()
    {
        var people = new[]
        {
            new CustomerRecord { Id = "person-1", Code = "CUS-001", Name = "شخص اول" },
            new CustomerRecord { Id = "person-2", Code = "CUS-002", Name = "شخص دوم" }
        };

        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniquePersonCode(people, " cus-001 "));
        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniquePersonCode(people, "CUS-001", "person-2"));

        RecordIdentityValidationService.EnsureUniquePersonCode(people, "cus-001", "person-1");
        RecordIdentityValidationService.EnsureUniquePersonCode(people, "   ");
    }

    [TestMethod]
    public void ProductCodeRejectsDuplicatesAndAllowsEditingTheSameRecord()
    {
        var products = new[]
        {
            new ProductRecord { Id = "product-1", Code = "SKU-001", Name = "کالای اول" },
            new ProductRecord { Id = "product-2", Code = "SKU-002", Name = "کالای دوم" }
        };

        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniqueProductCode(products, " sku-001 "));
        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniqueProductCode(products, "SKU-001", "product-2"));

        RecordIdentityValidationService.EnsureUniqueProductCode(products, "sku-001", "product-1");
        RecordIdentityValidationService.EnsureUniqueProductCode(products, "");
    }

    [TestMethod]
    public void ProductBarcodeRejectsDuplicateAndAllowsCurrentRecordDuringEdit()
    {
        var products = new[]
        {
            new ProductRecord { Id = "product-1", Barcode = "ABC-100" },
            new ProductRecord { Id = "product-2", Barcode = "ABC-200" }
        };

        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniqueProductBarcode(products, " abc-100 "));
        Assert.ThrowsException<InvalidOperationException>(() =>
            RecordIdentityValidationService.EnsureUniqueProductBarcode(products, "ABC-100", "product-2"));

        RecordIdentityValidationService.EnsureUniqueProductBarcode(products, "abc-100", "product-1");
        RecordIdentityValidationService.EnsureUniqueProductBarcode(products, null);
    }
}
