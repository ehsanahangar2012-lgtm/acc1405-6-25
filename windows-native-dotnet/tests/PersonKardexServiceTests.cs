using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class PersonKardexServiceTests
{
    [TestMethod]
    public void LedgerCalculatesDebitCreditAndExcludesInformationalVouchersFromBalance()
    {
        var person = new CustomerRecord { Id = "person-1", Name = "مشتری آزمایش" };
        var sale = new InvoiceRecord
        {
            Id = "sale-1", Number = 1, Prefix = "INV-", Type = "SALE", CustomerId = person.Id,
            CustomerName = person.Name, Total = 100m, Status = "صادر شده",
            CreatedAt = DateTimeOffset.Now.AddDays(-4)
        };
        var purchase = new InvoiceRecord
        {
            Id = "purchase-1", Number = 2, Prefix = "PUR-", Type = "PURCHASE", CustomerId = person.Id,
            CustomerName = person.Name, Total = 40m, Status = "صادر شده",
            CreatedAt = DateTimeOffset.Now.AddDays(-3)
        };
        var data = new AccountingData
        {
            Customers = [person],
            Invoices = [sale, purchase],
            Payments =
            [
                new PaymentRecord { Id = "sale-payment", InvoiceId = sale.Id, InvoiceNumber = sale.Number, CustomerName = person.Name, Amount = 30m, Method = "نقدی", CreatedAt = DateTimeOffset.Now.AddDays(-2) },
                new PaymentRecord { Id = "purchase-payment", InvoiceId = purchase.Id, InvoiceNumber = purchase.Number, CustomerName = person.Name, Amount = 10m, Method = "نقدی", CreatedAt = DateTimeOffset.Now.AddDays(-1) }
            ],
            Checks =
            [
                new CheckRecord { Id = "received-check", PersonId = person.Id, CheckType = "RECEIVED", Amount = 5m, CheckNumber = "R-1", DueDate = DateTimeOffset.Now.AddDays(1) },
                new CheckRecord { Id = "issued-check", PersonId = person.Id, CheckType = "ISSUED", Amount = 2m, CheckNumber = "I-1", DueDate = DateTimeOffset.Now.AddDays(2) },
                new CheckRecord { Id = "invoice-check", PersonId = person.Id, RelatedInvoiceId = sale.Id, CheckType = "RECEIVED", Amount = 100m, CheckNumber = "DUPLICATE", DueDate = DateTimeOffset.Now.AddDays(2) }
            ],
            Vouchers =
            [
                new VoucherRecord { Id = "voucher-1", Number = 8, TrackingCode = "V-0008", PersonId = person.Id, PersonName = person.Name, Type = "OUT", Date = DateTimeOffset.Now, Items = [new VoucherItemRecord { ProductName = "کالا", Quantity = 1m, Unit = "عدد" }] }
            ]
        };

        var report = PersonKardexService.GetReport(data, person);

        Assert.AreEqual(112m, report.TotalDebit, "Sale invoice + supplier payment + independent issued check.");
        Assert.AreEqual(75m, report.TotalCredit, "Purchase invoice + sale receipt + independent received check.");
        Assert.AreEqual(37m, report.ClosingBalance);
        Assert.AreEqual(2, report.CheckCount, "Invoice-linked checks must not be counted a second time.");
        Assert.AreEqual(1, report.VoucherCount);
        Assert.IsTrue(report.Rows.Any(row => row.Type == "حوالهٔ انبار" && row.IsInformational));
    }

    [TestMethod]
    public void JalaliDateFilterCarriesEarlierBalanceIntoOpeningRow()
    {
        var person = new CustomerRecord { Id = "person-2", Name = "مشتری دوره‌ای" };
        var invoiceDate = DateTimeOffset.Now.AddDays(-10);
        var paymentDate = DateTimeOffset.Now.AddDays(-1);
        var data = new AccountingData
        {
            Customers = [person],
            Invoices =
            [
                new InvoiceRecord
                {
                    Id = "sale-2", Number = 22, Prefix = "INV-", Type = "SALE", CustomerId = person.Id,
                    CustomerName = person.Name, Total = 100m, Status = "صادر شده", CreatedAt = invoiceDate
                }
            ],
            Payments =
            [
                new PaymentRecord { Id = "payment-2", InvoiceId = "sale-2", InvoiceNumber = 22, CustomerName = person.Name, Amount = 20m, Method = "نقدی", CreatedAt = paymentDate }
            ]
        };
        var from = PersonKardexService.FormatJalaliDate(DateTimeOffset.Now.AddDays(-2));
        var to = PersonKardexService.FormatJalaliDate(DateTimeOffset.Now);

        var report = PersonKardexService.GetReport(data, person, from, to);

        Assert.AreEqual(100m, report.OpeningBalance);
        Assert.AreEqual(0m, report.TotalDebit);
        Assert.AreEqual(20m, report.TotalCredit);
        Assert.AreEqual(80m, report.ClosingBalance);
        Assert.AreEqual("ماندهٔ اول دوره", report.Rows[0].Type);
        Assert.AreEqual(2, report.Rows.Count);
    }

    [TestMethod]
    public void JalaliDateParserAcceptsPersianArabicAndAsciiDigits()
    {
        var persian = PersonKardexService.ParseJalaliDate("۱۴۰۵/۰۱/۰۱", "از تاریخ");
        var arabic = PersonKardexService.ParseJalaliDate("١٤٠٥/٠١/٠١", "از تاریخ");
        var ascii = PersonKardexService.ParseJalaliDate("1405/01/01", "از تاریخ");

        Assert.AreEqual(ascii, persian);
        Assert.AreEqual(ascii, arabic);
        Assert.ThrowsException<FormatException>(() => PersonKardexService.ParseJalaliDate("۱۴۰۵/۱۳/۰۱", "از تاریخ"));
    }
}
