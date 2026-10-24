using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class EndToEndWorkflowTests
{
    [TestMethod]
    public void SaleReceiptKardexAndLedgerStayConsistentAndRejectOverpayment()
    {
        var customer = new CustomerRecord
        {
            Id = "workflow-customer-1",
            Code = "CUS-WF-001",
            Name = "مشتری آزمون گردش کامل",
            Phone = "09120000001",
            Type = "CUSTOMER",
            IsCustomer = true,
            IsSupplier = false
        };
        var product = new ProductRecord
        {
            Id = "workflow-product-1",
            Name = "کالای آزمون گردش کامل",
            Sku = "SKU-WF-001",
            Unit = "عدد",
            StockQuantity = 10m,
            BuyPrice = 30m,
            UnitPrice = 100m
        };
        var data = new AccountingData
        {
            Customers = [customer],
            Products = [product],
            NextInvoiceNumber = 1
        };
        NativeLedgerService.SeedDefaultChart(data);

        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = customer.Id,
            Type = "SALE",
            TaxRatePercent = 10m,
            Lines =
            [
                new InvoiceLine
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Unit = product.Unit,
                    Quantity = 2m,
                    BuyPrice = 30m,
                    UnitPrice = 100m,
                    LineTotal = 200m
                }
            ]
        });

        Assert.AreEqual(220m, invoice.Total, "The invoice should include 10% tax.");
        Assert.AreEqual(8m, product.StockQuantity, "Sale posting should decrease available stock by two.");
        Assert.AreEqual(1, data.InventoryMovements.Count);
        Assert.AreEqual(-2m, data.InventoryMovements[0].SignedQuantity);

        var payment = AccountingOperations.RecordPayment(data, invoice.Id, 80m, "نقدی", "WF-RECEIPT-001");
        Assert.AreEqual(80m, payment.Amount);
        Assert.AreEqual(140m, AccountingRules.RemainingForInvoice(data, invoice));

        Assert.ThrowsException<InvalidOperationException>(() =>
            AccountingOperations.RecordPayment(data, invoice.Id, 141m, "نقدی", "WF-OVERPAYMENT"));
        Assert.AreEqual(1, data.Payments.Count, "A rejected overpayment must not create a second payment.");
        Assert.AreEqual(140m, AccountingRules.RemainingForInvoice(data, invoice));
        AccountingDataValidator.Validate(data);

        var report = PersonKardexService.GetReport(data, customer);
        Assert.AreEqual(220m, report.TotalDebit, "The sales invoice should appear once on the debit side.");
        Assert.AreEqual(80m, report.TotalCredit, "The linked receipt should appear once on the credit side.");
        Assert.AreEqual(140m, report.ClosingBalance);

        NativeOperationalPostingService.Reconcile(data);
        var firstJournalCount = data.JournalEntries.Count;
        Assert.IsTrue(firstJournalCount > 0, "The completed workflow should create the configured automatic ledger postings.");
        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(firstJournalCount, data.JournalEntries.Count,
            "Running reconciliation again must not duplicate ledger postings.");

        var trialBalance = NativeLedgerService.GetTrialBalance(data);
        Assert.AreEqual(trialBalance.Sum(row => row.Debit), trialBalance.Sum(row => row.Credit),
            "The generated ledger must remain balanced after sale and receipt.");
        AccountingDataValidator.Validate(data);
    }
}
