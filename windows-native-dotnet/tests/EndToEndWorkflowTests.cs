using System.Reflection;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Dialogs;
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
        AssertInvoicePreviewContainsSavedWorkflowData(invoice, customer, product);
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
    private static void AssertInvoicePreviewContainsSavedWorkflowData(
        InvoiceRecord invoice, CustomerRecord customer, ProductRecord product)
    {
        Exception? failure = null;
        var previewTitle = string.Empty;
        var previewText = string.Empty;
        const string companyName = "شرکت آزمون گردش سرتاسری";

        var thread = new Thread(() =>
        {
            Window? owner = null;
            InvoicePreviewWindow? preview = null;
            try
            {
                owner = new Window
                {
                    Width = 1000,
                    Height = 700,
                    Background = Brushes.White,
                    ShowInTaskbar = false,
                    WindowStyle = WindowStyle.ToolWindow
                };
                owner.Show();

                var company = new CompanyProfileRecord
                {
                    Name = companyName,
                    LegalName = companyName,
                    Phone = "021-55500000",
                    Address = "نشانی آزمون گردش سرتاسری"
                };
                preview = new InvoicePreviewWindow(
                    owner, invoice, defaultTheme: "modern", showQr: false,
                    company: company, currencyCode: "RIAL");
                previewTitle = preview.Title;

                // The preview is a real WPF FlowDocument assembled by InvoicePreviewWindow.
                // Read the constructed document on its owning STA thread without printing or
                // touching any user files/printer settings.
                var field = typeof(InvoicePreviewWindow).GetField(
                    "_document", BindingFlags.Instance | BindingFlags.NonPublic);
                if (field?.GetValue(preview) is not FlowDocument document)
                    throw new AssertFailedException("Invoice preview did not construct its printable FlowDocument.");
                previewText = CollectPreviewText(document);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
            finally
            {
                preview?.Close();
                owner?.Close();
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        if (failure is not null)
            throw new AssertFailedException("Saved invoice could not be represented in its WPF print preview.", failure);

        StringAssert.Contains(previewTitle, invoice.DisplayNumber,
            "Preview title must identify the saved invoice number.");
        StringAssert.Contains(previewText, companyName,
            "The printable invoice must show the selected company profile.");
        StringAssert.Contains(previewText, customer.Name,
            "The printable invoice must show the selected customer.");
        StringAssert.Contains(previewText, product.Name,
            "The printable invoice must show the saved product line.");
        StringAssert.Contains(previewText, invoice.Total.ToString(System.Globalization.CultureInfo.InvariantCulture),
            "The printable invoice must show the final total from the saved invoice.");
    }

    private static string CollectPreviewText(FlowDocument document)
    {
        var values = new List<string>();
        var visited = new HashSet<DependencyObject>();
        var pending = new Stack<DependencyObject>();
        pending.Push(document);

        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (!visited.Add(current))
                continue;

            if (current is TextBlock textBlock && !string.IsNullOrWhiteSpace(textBlock.Text))
                values.Add(textBlock.Text);
            else if (current is Run run && !string.IsNullOrWhiteSpace(run.Text))
                values.Add(run.Text);

            // BlockUIContainer is how the print layout embeds its company header, item row,
            // information cards and totals; explicitly follow that child as well as WPF's
            // logical/visual tree so the test sees the same printable content.
            if (current is BlockUIContainer { Child: DependencyObject child })
                pending.Push(child);
            if (current is Table table)
                foreach (var group in table.RowGroups) pending.Push(group);
            if (current is TableRowGroup rowGroup)
                foreach (var tableRow in rowGroup.Rows) pending.Push(tableRow);
            if (current is TableRow tableRowItem)
                foreach (var cell in tableRowItem.Cells) pending.Push(cell);
            if (current is TableCell cellContent)
                foreach (var block in cellContent.Blocks) pending.Push(block);

            try
            {
                foreach (var childElement in LogicalTreeHelper.GetChildren(current).OfType<DependencyObject>())
                    pending.Push(childElement);
            }
            catch (InvalidOperationException) { }

            if (current is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try
                {
                    for (var i = 0; i < VisualTreeHelper.GetChildrenCount(current); i++)
                        pending.Push(VisualTreeHelper.GetChild(current, i));
                }
                catch (InvalidOperationException) { }
            }
        }

        return string.Join("\\n", values);
    }

}
