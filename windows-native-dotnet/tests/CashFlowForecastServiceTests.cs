using System.Linq;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class CashFlowForecastServiceTests
{
    [TestMethod]
    public void ForecastReconcilesOpeningCashOutstandingInvoicesAndIndependentChecks()
    {
        var asOf = new DateTimeOffset(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);

        var cash = data.LedgerAccounts.Single(account => account.Code == "1110");
        var equity = data.LedgerAccounts.Single(account => account.Code == "3000");
        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = "1405/07/01",
            Description = "مانده افتتاحیه آزمون",
            DebitAccountId = cash.Id,
            CreditAccountId = equity.Id,
            Amount = 2000m,
            DocumentType = "OPERATIONAL",
            Status = "POSTED"
        });

        var sale = new InvoiceRecord
        {
            Id = "cashflow-sale-open",
            Number = 3001,
            Type = "SALE",
            CustomerName = "مشتری فروش",
            Subtotal = 1000m,
            Total = 1000m,
            DueDate = asOf.AddDays(2),
            CreatedAt = asOf.AddDays(-4),
            Status = "صادر شده"
        };
        var overdueSale = new InvoiceRecord
        {
            Id = "cashflow-sale-overdue",
            Number = 3002,
            Type = "SALE",
            CustomerName = "مشتری معوق",
            Subtotal = 100m,
            Total = 100m,
            DueDate = asOf.AddDays(-3),
            CreatedAt = asOf.AddDays(-12),
            Status = "صادر شده"
        };
        var purchase = new InvoiceRecord
        {
            Id = "cashflow-purchase-open",
            Number = 3003,
            Type = "PURCHASE",
            CustomerName = "تأمین‌کننده",
            Subtotal = 500m,
            Total = 500m,
            DueDate = asOf.AddDays(5),
            CreatedAt = asOf.AddDays(-2),
            Status = "ثبت‌شده"
        };
        var paidSale = new InvoiceRecord
        {
            Id = "cashflow-sale-paid",
            Number = 3004,
            Type = "SALE",
            CustomerName = "مشتری تسویه",
            Subtotal = 250m,
            Total = 250m,
            DueDate = asOf.AddDays(1),
            CreatedAt = asOf.AddDays(-5),
            Status = "صادر شده"
        };
        var proforma = new InvoiceRecord
        {
            Id = "cashflow-proforma",
            Number = 3005,
            Type = "PROFORMA",
            CustomerName = "پیش‌فاکتور",
            Total = 450m,
            DueDate = asOf.AddDays(1),
            CreatedAt = asOf,
            Status = "پیش‌فاکتور"
        };
        var cancelled = new InvoiceRecord
        {
            Id = "cashflow-sale-cancelled",
            Number = 3006,
            Type = "SALE",
            CustomerName = "لغوشده",
            Total = 120m,
            DueDate = asOf.AddDays(1),
            CreatedAt = asOf,
            Status = "لغو شده"
        };

        data.Invoices.AddRange([sale, overdueSale, purchase, paidSale, proforma, cancelled]);
        data.Payments.Add(new PaymentRecord
        {
            Id = "cashflow-sale-payment",
            InvoiceId = sale.Id,
            CustomerName = sale.CustomerName,
            Amount = 200m,
            Method = "نقدی",
            CreatedAt = asOf.AddDays(-1)
        });
        data.Payments.Add(new PaymentRecord
        {
            Id = "cashflow-paid-payment",
            InvoiceId = paidSale.Id,
            CustomerName = paidSale.CustomerName,
            Amount = 250m,
            Method = "نقدی",
            CreatedAt = asOf
        });

        data.Checks.Add(new CheckRecord
        {
            Id = "cashflow-linked-check",
            CheckType = "RECEIVED",
            CheckNumber = "LINKED-1",
            RelatedInvoiceId = sale.Id,
            PersonName = sale.CustomerName,
            Amount = 200m,
            Status = "PENDING",
            DueDate = asOf.AddDays(3),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "cashflow-independent-receipt",
            CheckType = "RECEIVED",
            CheckNumber = "RECV-1",
            PersonName = "مشتری چک",
            Amount = 100m,
            Status = "PENDING",
            DueDate = asOf.AddDays(3),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "cashflow-independent-issue",
            CheckType = "ISSUED",
            CheckNumber = "ISSUE-1",
            PersonName = "ذی‌نفع",
            Amount = 150m,
            Status = "PENDING",
            DueDate = asOf.AddDays(10),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "cashflow-already-cashed",
            CheckType = "RECEIVED",
            CheckNumber = "CASHED-1",
            Amount = 90m,
            Status = "CASHED",
            DueDate = asOf.AddDays(4),
            CreatedAt = asOf
        });

        var forecast = CashFlowForecastService.Build(data, 30, asOf);

        Assert.AreEqual(2000m, forecast.OpeningBalance);
        Assert.AreEqual(1000m, forecast.TotalExpectedInflows,
            "Open sale balance, overdue sale and independent received check are included.");
        Assert.AreEqual(650m, forecast.TotalExpectedOutflows,
            "Open purchase and independent issued check are included.");
        Assert.AreEqual(2350m, forecast.ProjectedClosingBalance);
        Assert.AreEqual(5, forecast.Movements.Count,
            "Paid/proforma/cancelled invoices, a linked check and a cashed check are excluded.");
        Assert.AreEqual("cashflow-sale-overdue", forecast.Movements[0].ReferenceId);
        Assert.IsTrue(forecast.Movements[0].IsOverdue);
        Assert.AreEqual(asOf.Date, forecast.Movements[0].Date.Date);

        var today = forecast.Projection.Single(line => line.Date.Date == asOf.Date);
        Assert.AreEqual(100m, today.ExpectedInflows);
        Assert.AreEqual(1, today.OverdueCount);
        Assert.AreEqual(2100m, today.ProjectedBalance);

        Assert.AreEqual(800m, forecast.Movements.Single(m => m.ReferenceId == sale.Id).Amount);
        Assert.IsFalse(forecast.Movements.Any(m => m.ReferenceId == "cashflow-linked-check"));
    }

    [TestMethod]
    public void ForecastRejectsUnsupportedHorizon()
    {
        Assert.ThrowsException<ArgumentOutOfRangeException>(() =>
            CashFlowForecastService.Build(new AccountingData(), 45));
    }
}
