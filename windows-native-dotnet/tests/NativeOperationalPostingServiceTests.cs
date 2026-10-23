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

        data.Payments.Add(new PaymentRecord
        {
            Id = "payment-cancel-1",
            InvoiceId = "invoice-cancel-1",
            InvoiceNumber = 1002,
            CustomerName = "مشتری آزمون",
            Amount = 20m,
            Method = "نقدی",
            CreatedAt = DateTimeOffset.Now
        });

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(3, data.JournalEntries.Count, "Revenue, cost and receipt are created; zero tax is omitted.");
        data.Invoices[0].Status = "لغو شده";

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(6, data.JournalEntries.Count, "Cancellation reverses the invoice and its linked receipt without deleting history.");
        Assert.AreEqual(3, data.JournalEntries.Count(e => e.ReferenceType.StartsWith("AUTO_REVERSAL_")));
        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(6, data.JournalEntries.Count, "A repeated reconciliation must not create duplicate reversals.");

        var balance = NativeLedgerService.GetTrialBalance(data);
        Assert.IsTrue(balance.All(x => x.Debit == x.Credit),
            "Each source/reversal pair should net to zero for each touched account.");
    }

    [TestMethod]
    public void EditedInvoiceAppendsReversalAndRepostsCurrentAmountExactlyOnce()
    {
        var data = CreateData();
        data.Invoices.Add(new InvoiceRecord
        {
            Id = "invoice-edited-1",
            Number = 1003,
            Prefix = "INV-",
            Type = "SALE",
            CustomerId = "customer-1",
            CustomerName = "مشتری آزمون",
            Description = "فروش اصلاح‌شونده",
            Lines = [new InvoiceLine
            {
                ProductId = "product-1", ProductName = "کالای آزمون",
                Quantity = 1m, BuyPrice = 30m, UnitPrice = 100m, Profit = 70m, LineTotal = 100m
            }],
            Subtotal = 100m,
            Total = 100m,
            CreatedAt = DateTimeOffset.Now,
            Status = "صادر شده"
        });

        NativeOperationalPostingService.Reconcile(data);
        data.Invoices[0].Subtotal = 150m;
        data.Invoices[0].Lines[0].UnitPrice = 150m;
        data.Invoices[0].Lines[0].LineTotal = 150m;
        NativeOperationalPostingService.Reconcile(data);
        var countAfterEdit = data.JournalEntries.Count;
        NativeOperationalPostingService.Reconcile(data);

        Assert.AreEqual(4, countAfterEdit, "Changed revenue and cost are reversed and current revenue/cost are posted.");
        Assert.AreEqual(countAfterEdit, data.JournalEntries.Count, "Repeat reconciliation remains idempotent.");
        var activeRevenue = data.JournalEntries.Single(e => e.ReferenceType == "AUTO_INVOICE_SALE_REVENUE" &&
            !data.JournalEntries.Any(r => r.ReferenceType == "AUTO_REVERSAL_" + e.Id));
        var activeCogs = data.JournalEntries.Single(e => e.ReferenceType == "AUTO_INVOICE_SALE_COGS" &&
            !data.JournalEntries.Any(r => r.ReferenceType == "AUTO_REVERSAL_" + e.Id));
        Assert.AreEqual(150m, activeRevenue.Amount);
        Assert.AreEqual(30m, activeCogs.Amount, "Changing the selling price must not alter the recorded purchase cost.");
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

    [TestMethod]
    public void ReceivedCheckDepositAndCashoutReversePreviousStatusPosting()
    {
        var data = CreateData();
        var check = new CheckRecord
        {
            Id = "check-transition-1",
            CheckType = "RECEIVED",
            CheckNumber = "123456",
            BankName = "بانک آزمون",
            Amount = 500m,
            Status = "DEPOSITED",
            CreatedAt = DateTimeOffset.Now,
            History = [new CheckHistoryRecord
            {
                Status = "DEPOSITED",
                ChangedAt = DateTimeOffset.Now,
                Note = "واگذاری به بانک"
            }]
        };
        data.Checks.Add(check);

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(1, data.JournalEntries.Count);
        var transit = data.JournalEntries.Single();
        Assert.AreEqual("1150", data.LedgerAccounts.Single(a => a.Id == transit.DebitAccountId).Code);
        Assert.AreEqual("1140", data.LedgerAccounts.Single(a => a.Id == transit.CreditAccountId).Code);

        check.Status = "CASHED";
        check.History.Add(new CheckHistoryRecord
        {
            Status = "CASHED",
            ChangedAt = DateTimeOffset.Now,
            Note = "وصول چک"
        });
        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(3, data.JournalEntries.Count, "The prior status entry is reversed before cashout is posted.");

        NativeOperationalPostingService.Reconcile(data);
        Assert.AreEqual(3, data.JournalEntries.Count, "Repeated check reconciliation must be idempotent.");
        var active = data.JournalEntries.Single(e => e.ReferenceType == "AUTO_CHECK_STATUS" &&
            !data.JournalEntries.Any(r => r.ReferenceType == "AUTO_REVERSAL_" + e.Id));
        Assert.AreEqual("1120", data.LedgerAccounts.Single(a => a.Id == active.DebitAccountId).Code);
        Assert.AreEqual("1150", data.LedgerAccounts.Single(a => a.Id == active.CreditAccountId).Code);
        Assert.AreEqual(500m, active.Amount);
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
