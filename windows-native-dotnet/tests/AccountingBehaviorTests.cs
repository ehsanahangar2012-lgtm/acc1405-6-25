using System.IO;
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
    public void InvoiceLinesUseRoundedUnitPriceForConsistentTotals()
    {
        var data = CreateSampleData(includeInvoice: false);
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id,
            TaxRatePercent = 0m,
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 3m, UnitPrice = 1.555m, LineTotal = 4.68m }]
        });
        Assert.AreEqual(1.56m, invoice.Lines[0].UnitPrice);
        Assert.AreEqual(4.68m, invoice.Subtotal);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void RejectsDuplicateProductSkuInStoredData()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Products.Add(new ProductRecord { Id = "product-test-2", Name = "کالای دوم", Sku = "sku-1", StockQuantity = 1m, UnitPrice = 10m });
        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
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
    public void StandardDecimalAndThousandsSeparatorsAreParsedAndSlashIsRejected()
    {
        Assert.AreEqual(123456.75m, PersianNumberParser.ParseDecimal("۱۲۳٬۴۵۶.۷۵", "مبلغ"));
        Assert.AreEqual(123456.75m, PersianNumberParser.ParseDecimal("۱۲۳٬۴۵۶٫۷۵", "مبلغ"));
        Assert.ThrowsException<InvalidOperationException>(() => PersianNumberParser.ParseDecimal("۱۲۳٬۴۵۶/۷۵", "مبلغ"));
        Assert.ThrowsException<InvalidOperationException>(() => PersianNumberParser.ParseDecimal("100/00", "مبلغ"));
    }

    [TestMethod]
    public void NumericFormatterOmitsZeroDecimalsAndKeepsUsefulFractions()
    {
        var whole = NumericTextBoxFormatter.Format(100m);
        Assert.IsFalse(whole.Contains('/'));
        Assert.IsFalse(whole.Contains('.'));
        Assert.AreEqual("100", NumericTextBoxFormatter.Format(100m));
        Assert.AreEqual("100.5", NumericTextBoxFormatter.Format(100.50m));
        Assert.AreEqual("1,234.5", NumericTextBoxFormatter.Format(1234.50m));
    }

    [TestMethod]
    public void BatchCheckTransferPreservesImagesAndAuditTrail()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Checks =
        [
            new CheckRecord { Id = "check-a", CheckType = "RECEIVED", Status = "PENDING", Amount = 100m, CheckNumber = "A-1", ImageDataBase64 = "base64-a" },
            new CheckRecord { Id = "check-b", CheckType = "RECEIVED", Status = "DEPOSITED", Amount = 250m, CheckNumber = "B-2", ImageDataBase64 = "base64-b" }
        ];
        var result = CheckTransferService.TransferToPerson(data, ["check-a", "check-b"], "تأمین‌کننده", "customer-test-1", "پرداخت بدهی");
        Assert.AreEqual(2, result.Count);
        Assert.AreEqual(350m, result.TotalAmount);
        Assert.AreEqual(2, data.Checks.Count(check => check.Status == "TRANSFERRED"));
        var outgoing = data.Checks.Where(check => check.CheckType == "ISSUED").ToList();
        Assert.AreEqual(2, outgoing.Count);
        Assert.AreEqual("base64-a", outgoing.Single(check => check.CheckNumber == "A-1").ImageDataBase64);
        Assert.AreEqual("base64-b", outgoing.Single(check => check.CheckNumber == "B-2").ImageDataBase64);
        Assert.IsTrue(data.Checks.Where(check => check.Status == "TRANSFERRED").All(check => check.History.Any(history => history.Status == "TRANSFERRED")));
    }

    [TestMethod]
    public void BatchCheckTransferRejectsIneligibleSelectionWithoutPartialMutation()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Checks =
        [
            new CheckRecord { Id = "check-good", CheckType = "RECEIVED", Status = "PENDING", Amount = 100m },
            new CheckRecord { Id = "check-cashed", CheckType = "RECEIVED", Status = "CASHED", Amount = 200m }
        ];
        Assert.ThrowsException<InvalidOperationException>(() =>
            CheckTransferService.TransferToPerson(data, ["check-good", "check-cashed"], "تأمین‌کننده", null, ""));
        Assert.AreEqual("PENDING", data.Checks.Single(check => check.Id == "check-good").Status);
        Assert.AreEqual(2, data.Checks.Count);
    }

    [TestMethod]
    public void InvoiceCreationUpdatesStockAndTotals()
    {
        var data=CreateSampleData(includeInvoice:false);
        var invoice=AccountingOperations.CreateInvoice(data,new InvoiceDraft{
            CustomerId=data.Customers[0].Id,TaxRatePercent=10m,Notes="نمونه",
            Lines=[new InvoiceLine{ProductId=data.Products[0].Id,ProductName=data.Products[0].Name,Quantity=2m,UnitPrice=100m,LineTotal=200m}]
        });
        Assert.AreEqual(1001,invoice.Number);
        Assert.AreEqual(220m,invoice.Total);
        Assert.AreEqual(8m,data.Products[0].StockQuantity);
        Assert.AreEqual(1002,data.NextInvoiceNumber);
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
    public void CancellingUnpaidInvoiceRestoresInventory()
    {
        var data = CreateSampleData(includeInvoice: true);
        var invoice = data.Invoices[0];
        Assert.AreEqual(0m, data.Products[0].StockQuantity);
        AccountingOperations.CancelInvoice(data, invoice.Id);
        Assert.AreEqual("لغو شده", invoice.Status);
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void CancellingAnInvoiceWithPaymentIsRejected()
    {
        var data = CreateSampleData(includeInvoice: true);
        var invoice = data.Invoices[0];
        AccountingOperations.RecordPayment(data, invoice.Id, 10m, "نقدی", "");
        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.CancelInvoice(data, invoice.Id));
        Assert.AreEqual(0m, data.Products[0].StockQuantity);
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

    [TestMethod]
    public void NativeCheckRecordDeepCopyPreservesHistory()
    {
        var check = new CheckRecord
        {
            Id = "check-test-1",
            BankName = "ملی",
            Amount = 250.50m,
            DueDate = new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.FromHours(3.5)),
            Status = "PENDING",
            SayadId = "1234567890123456",
            HolderName = "شرکت نمونه",
            CheckType = "RECEIVED",
            ImageDataBase64 = "encoded-cheque-image",
            History = [new CheckHistoryRecord { Status = "PENDING", Note = "ثبت اولیه" }]
        };
        var data = new AccountingData { Checks = [check] };
        var copy = data.DeepCopy();

        Assert.AreEqual(1, copy.Checks.Count);
        Assert.AreNotSame(check, copy.Checks[0]);
        Assert.AreNotSame(check.History[0], copy.Checks[0].History[0]);
        Assert.AreEqual("1234567890123456", copy.Checks[0].SayadId);
        Assert.AreEqual("ثبت اولیه", copy.Checks[0].History[0].Note);
        Assert.AreEqual("encoded-cheque-image", copy.Checks[0].ImageDataBase64);
        AccountingDataValidator.Validate(copy);
    }

    [TestMethod]
    public void CheckImageAndPaymentLinkSurviveDeepCopy()
    {
        var data = CreateSampleData(includeInvoice: true);
        var invoice = data.Invoices.Single();
        var payment = AccountingOperations.RecordPayment(data, invoice.Id, 100m, "چک", "پیوند تصویر");
        data.Checks.Add(new CheckRecord
        {
            Id = "linked-check",
            BankName = "ملی",
            Amount = payment.Amount,
            DueDate = DateTimeOffset.Now.AddDays(15),
            Status = "PENDING",
            HolderName = invoice.CustomerName,
            RelatedInvoiceId = invoice.Id,
            RelatedPaymentId = payment.Id,
            ImageDataBase64 = "encoded-receipt-image",
            CheckType = invoice.Type == "SALE" ? "RECEIVED" : "ISSUED",
            History = [new CheckHistoryRecord { Status = "PENDING", Note = "ثبت همراه دریافت" }]
        });

        var copy = data.DeepCopy();
        var copiedCheck = copy.Checks.Single(check => check.Id == "linked-check");
        Assert.AreEqual(payment.Id, copiedCheck.RelatedPaymentId);
        Assert.AreEqual("encoded-receipt-image", copiedCheck.ImageDataBase64);
        AccountingDataValidator.Validate(copy);
    }

    [TestMethod]
    public void RejectsChequePaymentLinkWhenAmountsDoNotMatch()
    {
        var data = CreateSampleData(includeInvoice: true);
        var invoice = data.Invoices.Single();
        var payment = AccountingOperations.RecordPayment(data, invoice.Id, 100m, "چک", "پیوند نامعتبر");
        data.Checks.Add(new CheckRecord
        {
            Id = "mismatched-check",
            BankName = "ملی",
            Amount = 99m,
            DueDate = DateTimeOffset.Now.AddDays(15),
            Status = "PENDING",
            HolderName = invoice.CustomerName,
            RelatedInvoiceId = invoice.Id,
            RelatedPaymentId = payment.Id,
            CheckType = "RECEIVED",
            History = [new CheckHistoryRecord { Status = "PENDING", Note = "آزمون" }]
        });
        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
    }

    [TestMethod]
    public void RejectsDuplicateCheckSayadIdentifiers()
    {
        var dueDate = new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.FromHours(3.5));
        var data = new AccountingData
        {
            Checks =
            [
                new CheckRecord { Id = "check-test-1", BankName = "ملی", HolderName = "شرکت اول", Amount = 100m, DueDate = dueDate, SayadId = "ABC123", History = [new CheckHistoryRecord()] },
                new CheckRecord { Id = "check-test-2", BankName = "ملت", HolderName = "شرکت دوم", Amount = 200m, DueDate = dueDate, SayadId = "abc123", History = [new CheckHistoryRecord()] }
            ]
        };

        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
    }

    [TestMethod]
    public void RejectsUnknownCheckStatus()
    {
        var data = new AccountingData
        {
            Checks = [new CheckRecord { Id = "check-test-1", BankName = "ملی", HolderName = "شرکت نمونه", Amount = 100m, DueDate = DateTimeOffset.Now.AddDays(10), Status = "BANK_CONFIRMED" }]
        };

        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
    }

    [TestMethod]
    public void NativePersonRecordDeepCopyPreservesRolesAndIdentityFields()
    {
        var person = new CustomerRecord
        {
            Id = "person-test-1", Code = "P-100", Name = "شخص آزمایشی", Phone = "09120000000",
            Email = "person@example.test", Balance = -125.50m, Category = "فروش", Type = "CUSTOMER",
            IsCustomer = true, IsSupplier = true, NationalId = "1234567890", Address = "نشانی آزمون", Notes = "یادداشت",
        };
        var clone = new AccountingData { Customers = [person] }.DeepCopy();
        var copied = clone.Customers[0];

        Assert.AreNotSame(person, copied);
        Assert.AreEqual("P-100", copied.Code);
        Assert.AreEqual("person@example.test", copied.Email);
        Assert.AreEqual(-125.50m, copied.Balance);
        Assert.IsTrue(copied.IsCustomer);
        Assert.IsTrue(copied.IsSupplier);
        Assert.AreEqual("1234567890", copied.NationalId);
        Assert.AreEqual("مشتری و تأمین‌کننده", copied.RoleLabel);
        AccountingDataValidator.Validate(clone);
    }

    [TestMethod]
    public void RejectsDuplicatePersonCodesIgnoringCase()
    {
        var data = new AccountingData
        {
            Customers =
            [
                new CustomerRecord { Id = "person-test-1", Code = "P-100", Name = "شخص اول" },
                new CustomerRecord { Id = "person-test-2", Code = "p-100", Name = "شخص دوم" }
            ]
        };

        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
    }

    [TestMethod]
    public void SaleInvoiceCannotUseSupplierOnlyRecord()
    {
        var data = new AccountingData
        {
            Customers = [new CustomerRecord { Id = "supplier-1", Name = "تأمین‌کننده", Type = "VENDOR", IsCustomer = false, IsSupplier = true }],
            Products = [new ProductRecord { Id = "product-1", Name = "کالا", Sku = "SKU-1", StockQuantity = 10m, UnitPrice = 10m }]
        };

        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = "supplier-1", TaxRatePercent = 0m,
            Lines = [new InvoiceLine { ProductId = "product-1", ProductName = "کالا", Quantity = 1m, UnitPrice = 10m, LineTotal = 10m }]
        }));
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual(0, data.Invoices.Count);
    }

    [TestMethod]
    public void NativeProductRecordDeepCopyPreservesSourceFields()
    {
        var product = new ProductRecord
        {
            Id = "product-source-1", Name = "جعبه نمونه", Code = "BOX-01", SerialNumber = "SN-01",
            Unit = "عدد", StockQuantity = 25m, ReservedStock = 3m, MinStock = 5m,
            BuyPrice = 120m, SellPrice = 250m, Weight = 0.4m, ShelfLocation = "قفسه A-2",
            Category = "بسته‌بندی", SubCategory = "کارتن", SubSubCategory = "سه‌لایه",
            CategoryPath = "بسته‌بندی / کارتن / سه‌لایه", Description = "آزمون", ImageUrl = "C:/products/box.png"
        };
        var clone = new AccountingData { Products = [product] }.DeepCopy();
        var copied = clone.Products[0];

        Assert.AreNotSame(product, copied);
        Assert.AreEqual("BOX-01", copied.Code);
        Assert.AreEqual(25m, copied.Stock);
        Assert.AreEqual(3m, copied.ReservedStock);
        Assert.AreEqual(120m, copied.BuyPrice);
        Assert.AreEqual(250m, copied.SellPrice);
        Assert.AreEqual("بسته‌بندی / کارتن / سه‌لایه", copied.CategoryPath);
        Assert.AreEqual("C:/products/box.png", copied.ImageUrl);
        AccountingDataValidator.Validate(clone);
    }

    [TestMethod]
    public void CreateInventoryVoucherUpdatesStockAndRecordsMovement()
    {
        var data = CreateSampleData(includeInvoice: false);
        var product = data.Products[0];
        var voucher = AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "OUT", MovementType = "GOODS_ISSUE",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 3.5m, Unit = product.Unit }]
        });

        Assert.AreEqual(1, voucher.Number);
        Assert.AreEqual(2, data.NextVoucherNumber);
        Assert.AreEqual(6.5m, product.StockQuantity);
        Assert.AreEqual(1, data.Vouchers.Count);
        Assert.AreEqual(-3.5m, data.InventoryMovements.Single().SignedQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void InventoryVoucherRejectsInsufficientStockWithoutPartialMutation()
    {
        var data = CreateSampleData(includeInvoice: false);
        var product = data.Products[0];
        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "OUT", MovementType = "GOODS_ISSUE",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 11m, Unit = product.Unit }]
        }));

        Assert.AreEqual(10m, product.StockQuantity);
        Assert.AreEqual(0, data.Vouchers.Count);
        Assert.AreEqual(0, data.InventoryMovements.Count);
        Assert.AreEqual(1, data.NextVoucherNumber);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void InventoryReturnReceiptAndPurchaseReturnUseOppositeStockDirections()
    {
        var data = CreateSampleData(includeInvoice: false);
        var product = data.Products[0];
        AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "RETURN", MovementType = "RETURN_RECEIPT",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 2m, Unit = product.Unit }]
        });
        Assert.AreEqual(12m, product.StockQuantity);

        AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "RETURN", MovementType = "RETURN_ISSUE",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 3m, Unit = product.Unit }]
        });
        Assert.AreEqual(9m, product.StockQuantity);
        Assert.AreEqual(2, data.InventoryMovements.Count);
        Assert.AreEqual(2m, data.InventoryMovements[0].SignedQuantity);
        Assert.AreEqual(-3m, data.InventoryMovements[1].SignedQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void DeletingInventoryVoucherReversesItsStockAndMovementRecords()
    {
        var data = CreateSampleData(includeInvoice: false);
        var product = data.Products[0];
        var voucher = AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "IN", MovementType = "GOODS_RECEIPT",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 5m, Unit = product.Unit }]
        });
        Assert.AreEqual(15m, product.StockQuantity);

        AccountingOperations.DeleteVoucher(data, voucher.Id);
        Assert.AreEqual(10m, product.StockQuantity);
        Assert.AreEqual(0, data.Vouchers.Count);
        Assert.AreEqual(0, data.InventoryMovements.Count);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void RejectsInternalTransferUntilWarehouseBalancesExist()
    {
        var data = CreateSampleData(includeInvoice: false);
        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "OUT", MovementType = "INTERNAL_TRANSFER",
            Items = [new VoucherItemRecord { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 1m, Unit = data.Products[0].Unit }]
        }));
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual(0, data.Vouchers.Count);
    }

    [TestMethod]
    public void InventoryVoucherDeepCopyPreservesLineAndMovementHistory()
    {
        var data = CreateSampleData(includeInvoice: false);
        var product = data.Products[0];
        var voucher = AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "IN", MovementType = "GOODS_RECEIPT", PersonName = "تأمین‌کننده آزمایشی",
            Items = [new VoucherItemRecord { ProductId = product.Id, ProductName = product.Name, Quantity = 2m, Unit = product.Unit, Weight = 0.3m, ShelfLocation = "A-1", Description = "بسته سالم" }]
        });
        var copy = data.DeepCopy();

        Assert.AreNotSame(voucher, copy.Vouchers.Single());
        Assert.AreNotSame(voucher.Items[0], copy.Vouchers.Single().Items[0]);
        Assert.AreEqual("تأمین‌کننده آزمایشی", copy.Vouchers.Single().PersonName);
        Assert.AreEqual("A-1", copy.Vouchers.Single().Items[0].ShelfLocation);
        Assert.AreEqual(2m, copy.InventoryMovements.Single().SignedQuantity);
        AccountingDataValidator.Validate(copy);
    }

    [TestMethod]
    public void InventoryVoucherStatusProgressionRecordsDeliveryTime()
    {
        var data = CreateSampleData(includeInvoice: false);
        var voucher = AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "OUT", MovementType = "GOODS_ISSUE",
            Items = [new VoucherItemRecord { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 1m }]
        });

        AccountingOperations.ChangeVoucherStatus(data, voucher.Id, "IN_TRANSIT");
        Assert.AreEqual("IN_TRANSIT", voucher.Status);
        Assert.IsNull(voucher.DeliveryTime);
        AccountingOperations.ChangeVoucherStatus(data, voucher.Id, "DELIVERED");
        Assert.AreEqual("DELIVERED", voucher.Status);
        Assert.IsNotNull(voucher.DeliveryTime);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void RejectsVoucherWithIncompatibleReturnMovementWhenValidatingStoredData()
    {
        var data = CreateSampleData(includeInvoice: false);
        var voucher = AccountingOperations.CreateVoucher(data, new VoucherRecord
        {
            Type = "IN", MovementType = "GOODS_RECEIPT",
            Items = [new VoucherItemRecord { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 1m }]
        });
        voucher.MovementType = "RETURN_RECEIPT";
        Assert.ThrowsException<InvalidDataException>(() => AccountingDataValidator.Validate(data));
    }

    [TestMethod]
    public void SaleInvoiceSupportsSourcePricingAndFlatTax()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Products[0].BuyPrice = 40m;
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id, Type = "SALE", TaxIsAmount = true, TaxAmount = 12m,
            Discount = 25m, CashAmount = 30m,
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 2m, BuyPrice = 40m, UnitPrice = 100m, LineTotal = 200m, Profit = 120m, EntryOrder = 1 }]
        });

        Assert.AreEqual(1001, invoice.Number);
        Assert.AreEqual("INV-", invoice.Prefix);
        Assert.AreEqual(200m, invoice.Subtotal);
        Assert.AreEqual(25m, invoice.Discount);
        Assert.AreEqual(12m, invoice.TaxAmount);
        Assert.AreEqual(187m, invoice.Total);
        Assert.AreEqual(8m, data.Products[0].StockQuantity);
        Assert.AreEqual(30m, invoice.CashAmount);
        Assert.AreEqual(30m, AccountingRules.PaidForInvoice(data, invoice.Id));
        Assert.AreEqual("INVOICE", data.InventoryMovements.Single().ReferenceType);
        Assert.AreEqual(-2m, data.InventoryMovements.Single().SignedQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void PurchaseInvoiceIncreasesStockAndUsesPurchaseSequence()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Customers[0].IsCustomer = false;
        data.Customers[0].IsSupplier = true;
        data.Customers[0].Type = "VENDOR";
        data.Products[0].BuyPrice = 55m;
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id, Type = "PURCHASE",
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 3m, BuyPrice = 55m, UnitPrice = 55m, LineTotal = 165m }]
        });

        Assert.AreEqual(3001, invoice.Number);
        Assert.AreEqual("PUR-", invoice.Prefix);
        Assert.AreEqual(13m, data.Products[0].StockQuantity);
        Assert.AreEqual(3m, data.InventoryMovements.Single().SignedQuantity);
        Assert.AreEqual("GOODS_RECEIPT", data.InventoryMovements.Single().MovementType);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void ProformaDoesNotChangeStockUntilConvertedToSale()
    {
        var data = CreateSampleData(includeInvoice: false);
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id, Type = "PROFORMA",
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 2m, UnitPrice = 100m, LineTotal = 200m }]
        });
        Assert.AreEqual(2001, invoice.Number);
        Assert.AreEqual("PRO-", invoice.Prefix);
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual(0, data.InventoryMovements.Count);
        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.RecordPayment(data, invoice.Id, 1m, "نقدی", ""));

        AccountingOperations.ConvertProformaToSale(data, invoice.Id);
        Assert.AreEqual("SALE", invoice.Type);
        Assert.AreEqual(8m, data.Products[0].StockQuantity);
        Assert.AreEqual(-2m, data.InventoryMovements.Single().SignedQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void SaleCannotConsumeReservedStock()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Products[0].ReservedStock = 9m;
        Assert.ThrowsException<InvalidOperationException>(() => AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id, Type = "SALE",
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 2m, UnitPrice = 100m, LineTotal = 200m }]
        }));
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual(0, data.Invoices.Count);
        Assert.AreEqual(0, data.InventoryMovements.Count);
    }

    [TestMethod]
    public void PurchaseCancellationReversesStockAndRecordsMovement()
    {
        var data = CreateSampleData(includeInvoice: false);
        data.Customers[0].IsCustomer = false;
        data.Customers[0].IsSupplier = true;
        data.Customers[0].Type = "VENDOR";
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = data.Customers[0].Id, Type = "PURCHASE",
            Lines = [new InvoiceLine { ProductId = data.Products[0].Id, ProductName = data.Products[0].Name, Quantity = 3m, UnitPrice = 20m, LineTotal = 60m }]
        });
        Assert.AreEqual(13m, data.Products[0].StockQuantity);
        AccountingOperations.CancelInvoice(data, invoice.Id);
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual("لغو شده", invoice.Status);
        Assert.AreEqual(2, data.InventoryMovements.Count);
        Assert.AreEqual(3m, data.InventoryMovements[0].SignedQuantity);
        Assert.AreEqual(-3m, data.InventoryMovements[1].SignedQuantity);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void SaleCancellationAddsAuditableStockReversal()
    {
        var data = CreateSampleData(includeInvoice: true);
        var invoice = data.Invoices.Single();
        AccountingOperations.CancelInvoice(data, invoice.Id);
        Assert.AreEqual(10m, data.Products[0].StockQuantity);
        Assert.AreEqual(2, data.InventoryMovements.Count);
        Assert.AreEqual(-10m, data.InventoryMovements[0].SignedQuantity);
        Assert.AreEqual(10m, data.InventoryMovements[1].SignedQuantity);
        AccountingDataValidator.Validate(data);
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
