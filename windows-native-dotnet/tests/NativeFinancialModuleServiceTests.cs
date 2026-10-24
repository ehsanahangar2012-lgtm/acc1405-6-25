using System;
using System.Linq;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeFinancialModuleServiceTests
{
    [TestMethod]
    public void CurrencyConversionUsesConfiguredRatesAndFixedRialTomanRatio()
    {
        var data = new AccountingData();
        NativeFinancialModuleService.EnsureDefaults(data);
        NativeFinancialModuleService.SetRate(data, "USD", 900_000m);
        Assert.AreEqual(1_200m, NativeFinancialModuleService.ConvertCurrencyAmount(data, 120m, "IRT", "IRR"));
        Assert.AreEqual(90_000_000m, NativeFinancialModuleService.ConvertCurrencyAmount(data, 100m, "USD", "IRR"));
        Assert.ThrowsException<InvalidOperationException>(() =>
            NativeFinancialModuleService.ConvertCurrencyAmount(data, 10m, "EUR", "IRR"));
    }

    [TestMethod]
    public void LoanCreationBuildsLedgerReceiptAndCompleteAmortization()
    {
        var data = new AccountingData();
        NativeFinancialModuleService.EnsureDefaults(data);
        NativeFinancialModuleService.CreateLoan(data, "بانک نمونه", 1_200_000m, 12m, 12,
            new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), "1120", "وام آزمایشی");
        var loan = data.Loans.Single();
        var installments = data.LoanInstallments.OrderBy(item => item.InstallmentNumber).ToList();
        Assert.AreEqual(12, installments.Count);
        Assert.AreEqual(1_200_000m, installments.Sum(item => item.PrincipalAmount));
        Assert.AreEqual(1_200_000m, loan.RemainingPrincipal);
        Assert.AreEqual(1_200_000m, data.JournalEntries.Single().Amount);
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void PayingLoanInstallmentPostsPrincipalAndInterestAndPreventsDoublePay()
    {
        var data = new AccountingData();
        NativeFinancialModuleService.EnsureDefaults(data);
        var loan = NativeFinancialModuleService.CreateLoan(data, "وام‌دهنده", 120_000m, 12m, 12,
            new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), "1110");
        var installment = data.LoanInstallments.OrderBy(item => item.InstallmentNumber).First();
        NativeFinancialModuleService.PayInstallment(data, installment.Id, "1120");
        Assert.AreEqual("PAID", installment.Status);
        Assert.IsNotNull(installment.PaidAt);
        Assert.AreEqual(110_000m, loan.RemainingPrincipal);
        Assert.AreEqual(3, data.JournalEntries.Count);
        Assert.ThrowsException<InvalidOperationException>(() =>
            NativeFinancialModuleService.PayInstallment(data, installment.Id, "1120"));
        AccountingDataValidator.Validate(data);
    }

    [TestMethod]
    public void BankReconciliationRejectsWrongAmountOrDirection()
    {
        var data = new AccountingData();
        NativeFinancialModuleService.EnsureDefaults(data);
        var customer = new CustomerRecord { Name = "مشتری نمونه", IsCustomer = true, IsSupplier = false, Type = "CUSTOMER" };
        data.Customers.Add(customer);
        var product = new ProductRecord { Name = "کالای نمونه", StockQuantity = 4m, UnitPrice = 100m };
        data.Products.Add(product);
        var invoice = AccountingOperations.CreateInvoice(data, new InvoiceDraft
        {
            CustomerId = customer.Id, Type = "SALE",
            Lines = [new InvoiceLine { ProductId = product.Id, Quantity = 1m, UnitPrice = 100m }]
        });
        var payment = AccountingOperations.RecordPayment(data, invoice.Id, 100m, "نقد", "رسید آزمایشی");
        var account = new BankAccountRecord { BankName = "بانک نمونه", CurrencyCode = "IRR", OpeningBalance = 0m };
        data.BankAccounts.Add(account);
        var wrong = NativeFinancialModuleService.AddBankTransaction(data, account.Id, DateTimeOffset.Now, "واریز مغایر", "DEBIT", 99m);
        Assert.ThrowsException<InvalidOperationException>(() =>
            NativeFinancialModuleService.ReconcileBankTransaction(data, wrong.Id, payment.Id));
        Assert.IsFalse(wrong.IsReconciled);
    }
}
