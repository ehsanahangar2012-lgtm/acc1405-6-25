using System.Linq;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class DueCalendarServiceTests
{
    [TestMethod]
    public void DueCalendarIncludesOpenDatedInvoicesAndUnresolvedChecksOnly()
    {
        var asOf = new DateTimeOffset(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);
        var data = new AccountingData();

        var overdueSale = new InvoiceRecord
        {
            Id = "due-sale-1",
            Number = 2001,
            Type = "SALE",
            CustomerName = "مشتری معوق",
            Subtotal = 100m,
            Total = 100m,
            DueDate = asOf.AddDays(-3),
            CreatedAt = asOf.AddDays(-10),
            Status = "صادر شده"
        };
        var futurePurchase = new InvoiceRecord
        {
            Id = "due-purchase-1",
            Number = 2002,
            Type = "PURCHASE",
            CustomerName = "تأمین‌کننده",
            Subtotal = 150m,
            Total = 150m,
            DueDate = asOf.AddDays(7),
            CreatedAt = asOf.AddDays(-2),
            Status = "ثبت‌شده"
        };
        var paidSale = new InvoiceRecord
        {
            Id = "due-sale-paid",
            Number = 2003,
            Type = "SALE",
            CustomerName = "مشتری تسویه",
            Subtotal = 70m,
            Total = 70m,
            DueDate = asOf.AddDays(-1),
            CreatedAt = asOf.AddDays(-8),
            Status = "صادر شده"
        };
        var proforma = new InvoiceRecord
        {
            Id = "due-proforma",
            Number = 2004,
            Type = "PROFORMA",
            CustomerName = "پیش‌فاکتور",
            Total = 40m,
            DueDate = asOf,
            CreatedAt = asOf,
            Status = "پیش‌فاکتور"
        };
        var cancelled = new InvoiceRecord
        {
            Id = "due-cancelled",
            Number = 2005,
            Type = "SALE",
            CustomerName = "لغوشده",
            Total = 25m,
            DueDate = asOf.AddDays(-1),
            CreatedAt = asOf,
            Status = "لغو شده"
        };
        data.Invoices.AddRange([overdueSale, futurePurchase, paidSale, proforma, cancelled]);
        data.Payments.Add(new PaymentRecord
        {
            Id = "due-payment-paid",
            InvoiceId = paidSale.Id,
            Amount = 70m,
            CustomerName = paidSale.CustomerName,
            CreatedAt = asOf
        });

        data.Checks.Add(new CheckRecord
        {
            Id = "due-check-received",
            CheckType = "RECEIVED",
            CheckNumber = "CHK-1",
            PersonName = "مشتری چک",
            Amount = 50m,
            Status = "PENDING",
            DueDate = asOf.AddDays(1),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "due-check-issued",
            CheckType = "ISSUED",
            CheckNumber = "CHK-2",
            PersonName = "ذی‌نفع چک",
            Amount = 80m,
            Status = "PENDING",
            DueDate = asOf.AddDays(-2),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "due-check-returned",
            CheckType = "RECEIVED",
            CheckNumber = "CHK-3",
            Amount = 30m,
            Status = "RETURNED",
            DueDate = asOf.AddDays(-1),
            CreatedAt = asOf
        });
        data.Checks.Add(new CheckRecord
        {
            Id = "due-check-cashed",
            CheckType = "RECEIVED",
            CheckNumber = "CHK-4",
            Amount = 20m,
            Status = "CASHED",
            DueDate = asOf.AddDays(-1),
            CreatedAt = asOf
        });

        var items = DueCalendarService.GetItems(data, asOf);

        Assert.AreEqual(5, items.Count);
        Assert.AreEqual("due-sale-1", items[0].ReferenceId);
        Assert.AreEqual(-3, items[0].DaysFromDue);
        Assert.AreEqual(100m, items[0].Amount);
        Assert.IsTrue(items.Any(item => item.ReferenceId == "due-purchase-1" && item.DaysFromDue == 7));
        Assert.IsTrue(items.Any(item => item.ReferenceId == "due-check-received" && item.DaysFromDue == 1));
        Assert.IsTrue(items.Any(item => item.ReferenceId == "due-check-returned" && item.Status.Contains("پیگیری")));
        Assert.IsFalse(items.Any(item => item.ReferenceId is "due-sale-paid" or "due-proforma" or "due-cancelled" or "due-check-cashed"));
    }
}
