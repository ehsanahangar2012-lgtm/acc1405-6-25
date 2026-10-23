using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeLedgerServiceTests
{
    [TestMethod]
    public void SeedDefaultChartCreatesDistinctMainAccounts()
    {
        var data = new AccountingData();

        NativeLedgerService.SeedDefaultChart(data);
        AccountingDataValidator.Validate(data);

        Assert.AreEqual(16, data.LedgerAccounts.Count);
        Assert.AreEqual(data.LedgerAccounts.Count, data.LedgerAccounts.Select(a => a.Code).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.IsTrue(data.LedgerAccounts.All(a => a.Level == "MAIN" && a.IsActive));
    }

    [TestMethod]
    public void AddAccountRejectsDuplicateCodesAndInvalidParentLevel()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);

        Assert.ThrowsException<InvalidOperationException>(() =>
            NativeLedgerService.AddAccount(data, "1000", "صندوق تکراری", "ASSET", "MAIN", null));

        var mainAsset = data.LedgerAccounts.Single(a => a.Code == "1000");
        var liabilityDetail = new ChartOfAccountRecord
        {
            Code = "2001", Name = "زیرحساب نامعتبر", Type = "LIABILITY", Level = "DETAIL", ParentId = mainAsset.Id
        };
        Assert.ThrowsException<InvalidOperationException>(() =>
            NativeLedgerService.AddAccount(data, liabilityDetail.Code, liabilityDetail.Name,
                liabilityDetail.Type, liabilityDetail.Level, liabilityDetail.ParentId));

        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void PostingCreatesBalancedImmutableEntryAndUpdatesTrialBalance()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);
        var cash = data.LedgerAccounts.Single(a => a.Code == "1000");
        var sales = data.LedgerAccounts.Single(a => a.Code == "4000");
        var draft = new AccountingEntryRecord
        {
            Date = "۱۴۰۵/۰۷/۰۱",
            Description = "ثبت فروش آزمایشی",
            DebitAccountId = cash.Id,
            CreditAccountId = sales.Id,
            Amount = 123456.78m,
            DocumentType = "OPERATIONAL",
            FiscalYear = "1405",
            Status = "DRAFT"
        };

        var posted = NativeLedgerService.PostEntry(data, draft);
        AccountingDataValidator.Validate(data);

        Assert.AreEqual(1, posted.Number);
        Assert.AreEqual("POSTED", posted.Status);
        Assert.AreEqual("1405/07/01", posted.Date);
        Assert.AreEqual(2, data.NextJournalNumber);

        var balance = NativeLedgerService.GetTrialBalance(data);
        Assert.AreEqual(123456.78m, balance.Single(a => a.AccountId == cash.Id).Debit);
        Assert.AreEqual(0m, balance.Single(a => a.AccountId == cash.Id).Credit);
        Assert.AreEqual(123456.78m, balance.Single(a => a.AccountId == sales.Id).Credit);
        Assert.AreEqual(0m, balance.Single(a => a.AccountId == sales.Id).Debit);
    }

    [TestMethod]
    public void PostingRejectsSameAccountNonPositiveAmountAndInvalidJalaliDate()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);
        var account = data.LedgerAccounts[0];
        var other = data.LedgerAccounts[1];

        var invalidSameAccount = new AccountingEntryRecord
        {
            Date = "1405/07/01", Description = "سند نامعتبر",
            DebitAccountId = account.Id, CreditAccountId = account.Id, Amount = 10m
        };
        Assert.ThrowsException<InvalidOperationException>(() => NativeLedgerService.PostEntry(data, invalidSameAccount));

        var invalidAmount = new AccountingEntryRecord
        {
            Date = "1405/07/01", Description = "سند نامعتبر",
            DebitAccountId = account.Id, CreditAccountId = other.Id, Amount = 0m
        };
        Assert.ThrowsException<InvalidOperationException>(() => NativeLedgerService.PostEntry(data, invalidAmount));

        Assert.ThrowsException<InvalidOperationException>(() => NativeLedgerService.NormalizeAndValidateDate("1405/12/31"));
        Assert.ThrowsException<InvalidOperationException>(() => NativeLedgerService.NormalizeAndValidateDate("۱۴۰۵/۱۳/۰۱"));
    }

    [TestMethod]
    public void DeepCopyPreservesLedgerAccountsEntriesAndCounter()
    {
        var data = new AccountingData();
        NativeLedgerService.SeedDefaultChart(data);
        var debit = data.LedgerAccounts.Single(a => a.Code == "1000");
        var credit = data.LedgerAccounts.Single(a => a.Code == "4000");
        NativeLedgerService.PostEntry(data, new AccountingEntryRecord
        {
            Date = "1405/07/01", Description = "سند آزمایشی", DebitAccountId = debit.Id,
            CreditAccountId = credit.Id, Amount = 500m, DocumentType = "ADJUSTMENT"
        });

        var clone = data.DeepCopy();

        Assert.AreEqual(data.LedgerAccounts.Count, clone.LedgerAccounts.Count);
        Assert.AreEqual(1, clone.JournalEntries.Count);
        Assert.AreEqual(data.JournalEntries[0].Id, clone.JournalEntries[0].Id);
        Assert.AreEqual(2, clone.NextJournalNumber);
        clone.JournalEntries[0].Description = "ویرایش در کپی";
        Assert.AreNotEqual(clone.JournalEntries[0].Description, data.JournalEntries[0].Description);
    }
}
