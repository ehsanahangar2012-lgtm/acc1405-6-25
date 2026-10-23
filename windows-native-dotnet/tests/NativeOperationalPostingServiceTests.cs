using System.Linq;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeOperationalPostingServiceTests
{
    [TestMethod]
    public void SalePostsRevenueTaxCostAndReceiptExactlyOnce()
    {
        var data = CreateData();
        var now = DateTimeOffset.Now;
        data.Invoices.Add(new InvoiceRecord
        {
            Id = "invoice-sale-1",
            Number = 1001,
            Prefix = "INV-",
            Type = "SALE",
            CustomerId = "customer-1",
            CustomerName = "مشتری آزمون",
            Description = "فروش آزمایشی",
            Lines = [new InvoiceLine
            {
                ProductId = "product-1",
                ProductName = "کالای آزمون",
                Quantity = 2m,
                BuyPrice = 30m,
                UnitPrice = 100m,
                Profit = 140m,
                LineTotal = 200m
            }],
            Subtotal = 200m,
            TaxRatePercent = 10m,
            TaxAmount = 20m,
            Discount = 0m,
            Total = 220m,
            CashAmount = 50m,
            CreatedAt = now,
            Status = "صادر شده"
        });
        data.Payments.Add(new PaymentRecord
        {
            Id = "payment-sale-1",
            InvoiceId = "invoice-sale-1",
            InvoiceNumber = 1001,
            CustomerName = "مشتری آزمون",
            Amount = 50m,
            Method = "نقدی",
            CreatedAt = now
        });

        NativeOperationalPostingService.Reconcile(data);
        var firstCount = data.JournalEntries.Count;
        NativeOperationalPostingService.Reconcile(data);

        Assert.AreEqual(4, firstCount, "Sale should post revenue, tax, cost of sales, and its receipt.");
        Assert.AreEqual(firstCount, data.JournalEntries.Count, "Reconciliation must be idempotent.");
        Assert.AreEqual(200m, data.JournalEntries.Single(e => e.ReferenceType == "AUTO_INVOICE_SALE_REVENUE").Amount);
        Assert.AreEqual(20m, data.JournalEntries.Single(e => e.ReferenceType == "AUTO_INVOICE_SALE_TAX").Amount);
        Assert.AreEqual(60m, data.JournalEntries.Single(e => e.ReferenceType == "AUTO_INVOICE_SALE_COGS").Amount);
        Assert.AreEqual(50m, data.JournalEntries.Single(e => e.ReferenceType == "AUTO_PAYMENT").Amount);

        var balance = NativeLedgerService.GetTrialBalance(data);
        Assert.AreEqual(balance.Sum(x => x.Debit), balance.Sum(x => x.Credit),
            "Total debits and credits in the generated ledger must remain equal.");
    }

    [TestMethod]
    public void CancelledSaleCreatesOneReversalPerAutomaticInvoicePosting()
    {
        var data = CreateData();
        data.Invoices.Add(new InvoiceRecord
        {
            Id = "invoice-cancel-1",
            Number = 1002,
            Prefix = "INV-",
            Type = "SALE",
            CustomerId = "customer-1",
            CustomerName = "مشتری آزمون",
            Description = "فروش برای برگشت",
            Lines = [new InvoiceLine
            {
                ProductId = "product-1",
                ProductName = "کالای آزمون",
                Quantity = 1m,
                BuyPrice = 30m,
                UnitPrice = 100m,
                Profit = 70m,
                LineTotal = 100m
            }],
            Subtotal = 100m,
            Total = 100m,
            CreatedAt = DateTimeOffset.Now,
            Status = "صادر شده"
        });

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(2, data.JournalEntries.Count, "Revenue and cost entries are created; zero tax is omitted.");
        data.Invoices[0].Status = "لغو شده";

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(4, data.JournalEntries.Count, "Cancellation must append reversals, not delete the audit trail.");
        Assert.AreEqual(2, data.JournalEntries.Count(e => e.ReferenceType.StartsWith("AUTO_REVERSAL_")));
        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(4, data.JournalEntries.Count, "A repeated reconciliation must not create duplicate reversals.");

        var balance = NativeLedgerService.GetTrialBalance(data);
        Assert.IsTrue(balance.All(x => x.Debit == x.Credit),
            "Each source/reversal pair should net to zero for each touched account.");
    }

    [TestMethod]
    public void ExpensesPostToAppropriateExpenseAndCashAccounts()
    {
        var data = CreateData();
        data.Expenses.Add(new ExpenseRecord
        {
            Id = "expense-rent-1",
            Title = "اجاره کارگاه",
            Category = "اجاره",
            Amount = 125m,
            Notes = "",
            CreatedAt = DateTimeOffset.Now
        });

        NativeOperationalPostingService.Reconcile(data);

        var entry = data.JournalEntries.Single();
        Assert.AreEqual("AUTO_EXPENSE", entry.ReferenceType);
        Assert.AreEqual("هزینه: اجاره کارگاه", entry.Description);
        Assert.AreEqual(125m, entry.Amount);
        Assert.AreEqual("5200", data.LedgerAccounts.Single(a => a.Id == entry.DebitAccountId).Code);
        Assert.AreEqual("1110", data.LedgerAccounts.Single(a => a.Id == entry.CreditAccountId).Code);
    }

    private static AccountingData CreateData()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);
        data.Customers.Add(new CustomerRecord
        {
            Id = "customer-1",
            Code = "C-1",
            Name = "مشتری آزمون",
            Type = "CUSTOMER",
            IsCustomer = true,
            IsSupplier = false
        });
        data.Products.Add(new ProductRecord
        {
            Id = "product-1",
            Name = "کالای آزمون",
            Sku = "SKU-1",
            StockQuantity = 10m,
            UnitPrice = 100m,
            BuyPrice = 30m
        });
        return data;
    }
}
