using System.Linq;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class FinancialReportsServiceTests
{
    [TestMethod]
    public void FinancialStatementsReconcileWithPostedJournalAndCashMovement()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);

        Post(data, "1130", "4110", 1000m, "ثبت درآمد فروش");
        Post(data, "5000", "1160", 300m, "ثبت بهای تمام‌شده");
        Post(data, "1110", "1130", 200m, "دریافت نقدی مشتری");
        Post(data, "5200", "1110", 50m, "پرداخت هزینه عملیاتی");

        // This draft must not affect any financial statement.
        data.JournalEntries.Add(new AccountingEntryRecord
        {
            Date = "1405/07/01",
            Description = "سند پیش‌نویس",
            DebitAccountId = data.LedgerAccounts.Single(a => a.Code == "1110").Id,
            CreditAccountId = data.LedgerAccounts.Single(a => a.Code == "4110").Id,
            Amount = 9999m,
            DocumentType = "OPERATIONAL",
            Status = "DRAFT"
        });

        var report = FinancialReportsService.Build(data);

        Assert.AreEqual(1000m, report.Revenue);
        Assert.AreEqual(300m, report.CostOfSales);
        Assert.AreEqual(700m, report.GrossProfit);
        Assert.AreEqual(50m, report.OperatingExpenses);
        Assert.AreEqual(650m, report.NetProfit);
        Assert.AreEqual(650m, report.Assets);
        Assert.AreEqual(0m, report.Liabilities);
        Assert.AreEqual(0m, report.Equity);
        Assert.AreEqual(200m, report.CashInflows);
        Assert.AreEqual(50m, report.CashOutflows);
        Assert.AreEqual(150m, report.NetCashChange);
        Assert.AreEqual(150m, report.CashBalance);
        Assert.AreEqual(0m, report.BalanceSheetDifference);
        Assert.AreEqual(16, report.Accounts.Count);
    }

    private static void Post(AccountingData data, string debitCode, string creditCode, decimal amount, string description)
    {
        var debit = data.LedgerAccounts.Single(a => a.Code == debitCode);
        var credit = data.LedgerAccounts.Single(a => a.Code == creditCode);
        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = "1405/07/01",
            Description = description,
            DebitAccountId = debit.Id,
            CreditAccountId = credit.Id,
            Amount = amount,
            ReferenceType = "TEST",
            ReferenceId = description,
            DocumentType = "OPERATIONAL",
            Status = "POSTED"
        });
    }
}
