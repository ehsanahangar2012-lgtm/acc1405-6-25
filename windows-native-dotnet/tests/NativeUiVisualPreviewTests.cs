using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using AshkeGhalam.Windows.Dialogs;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

/// <summary>
/// Produces in-memory renders of the real WPF pages in CI, so UI changes can be reviewed
/// as images rather than inferred from compilation alone. These are layout captures, not
/// a substitute for interactive mouse/keyboard and physical-printer testing.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class NativeUiVisualPreviewTests
{
    [TestMethod]
    public void CaptureCoreNativeScreensForVisualReviewWhenEnabled()
    {
        var outputDirectory = Environment.GetEnvironmentVariable("ASHKGHALAM_UI_CAPTURE_DIR");
        if (string.IsNullOrWhiteSpace(outputDirectory))
            return;

        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var app = Application.Current as App;
                if (app is null)
                {
                    app = new App();
                    app.InitializeComponent();
                }

                Directory.CreateDirectory(outputDirectory);
                var owner = new Window
                {
                    Width = 1280,
                    Height = 800,
                    Background = Brushes.White,
                    ShowInTaskbar = false
                };

                var person = new CustomerRecord
                {
                    Id = "ui-person-001",
                    Code = "CUS-1001",
                    Name = "شرکت نمونه بسته‌بندی",
                    Phone = "021-55501234",
                    Email = "info@example.test",
                    IsCustomer = true,
                    IsSupplier = true,
                    Type = "BOTH"
                };
                var product = new ProductRecord
                {
                    Id = "ui-product-001",
                    Sku = "BOX-1001",
                    Name = "کارتن سه‌لایه نمونه",
                    Barcode = "6260001001001",
                    Unit = "عدد",
                    StockQuantity = 240,
                    UnitPrice = 85000,
                    BuyPrice = 61000,
                    MinStock = 20,
                    Category = "بسته‌بندی"
                };
                var invoice = new InvoiceRecord
                {
                    Id = "ui-invoice-001",
                    Number = 1025,
                    Prefix = "INV-",
                    Type = "SALE",
                    CustomerId = person.Id,
                    CustomerName = person.Name,
                    CreatedAt = new DateTimeOffset(2026, 10, 24, 0, 0, 0, TimeZoneInfo.Local.GetUtcOffset(DateTime.Today)),
                    Lines =
                    [
                        new InvoiceLine
                        {
                            ProductId = product.Id,
                            ProductName = product.Name,
                            Unit = product.Unit,
                            Quantity = 12,
                            UnitPrice = product.UnitPrice,
                            LineTotal = 12 * product.UnitPrice,
                            Description = "چاپ اختصاصی؛ تحویل مرحله‌ای"
                        }
                    ],
                    Subtotal = 12 * product.UnitPrice,
                    Total = 12 * product.UnitPrice,
                    Status = "صادر شده",
                    Notes = "یادداشت نمونه برای بازبینی ظاهر سند"
                };
                var people = new List<CustomerRecord> { person };
                var products = new List<ProductRecord> { product };
                var invoices = new List<InvoiceRecord> { invoice };
                var company = new CompanyProfileRecord
                {
                    Name = "شرکت چاپ و کارتن‌سازی اشک قلم",
                    LegalName = "شرکت چاپ و کارتن‌سازی اشک قلم",
                    Phone = "051-00000000",
                    Address = "مشهد — نشانی نمونه برای پیش‌نمایش"
                };

                foreach (var theme in new[] { "light", "dark" })
                {
                    var dashboard = new MainWindow();
                    SetText(dashboard, "CurrentModuleText", "پیشخوان • تصویر بازبینی رابط");
                    SetText(dashboard, "StorageStatus", "ذخیره‌سازی محلی آماده");
                    SetText(dashboard, "CustomerCount", "۱۲۸");
                    SetText(dashboard, "ProductCount", "۸۶۴");
                    SetText(dashboard, "InvoiceCount", "۲٬۴۱۹");
                    SetText(dashboard, "SalesTotal", "۱۲٬۴۸۰٬۰۰۰");
                    SetText(dashboard, "PurchasesTotal", "۸٬۲۱۰٬۰۰۰");
                    SetText(dashboard, "PaymentsTotal", "۹٬۴۰۰٬۰۰۰");
                    SetText(dashboard, "ReceivablesTotal", "۳٬۰۸۰٬۰۰۰");
                    SetText(dashboard, "PayablesTotal", "۱٬۶۲۰٬۰۰۰");
                    SetText(dashboard, "ExpensesTotal", "۶۳۰٬۰۰۰");
                    ApplicationThemeService.Apply(dashboard, theme);
                    SaveContent(dashboard, outputDirectory, $"dashboard-{theme}.png");

                    var personDialog = new CustomerDialog(owner, suggestedCode: "CUS-1002");
                    ApplicationThemeService.Apply(personDialog, theme);
                    SaveContent(personDialog, outputDirectory, $"person-form-{theme}.png");

                    var invoiceDialog = new InvoiceDialog(
                        owner, people, products, invoices,
                        defaultInvoiceTheme: "modern",
                        showInvoiceQr: true,
                        companyProfile: company,
                        currencyCode: "RIAL",
                        accountingDataProvider: () => new AccountingData
                        {
                            Customers = people,
                            Products = products,
                            Invoices = invoices
                        });
                    ApplicationThemeService.Apply(invoiceDialog, theme);
                    SaveContent(invoiceDialog, outputDirectory, $"invoice-form-{theme}.png");

                    var voucherDialog = new VoucherDialog(
                        owner, people, products, invoices, companyProfile: company);
                    ApplicationThemeService.Apply(voucherDialog, theme);
                    SaveContent(voucherDialog, outputDirectory, $"voucher-form-{theme}.png");

                    var preview = new InvoicePreviewWindow(
                        owner, invoice, defaultTheme: "modern", showQr: false,
                        company: company, currencyCode: "RIAL");
                    ApplicationThemeService.Apply(preview, theme);
                    SaveContent(preview, outputDirectory, $"invoice-print-preview-{theme}.png");
                }

                owner.Close();
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("Native WPF screenshot capture failed.", failure);
    }

    private static void SetText(Window window, string name, string value)
    {
        if (window.FindName(name) is TextBlock text)
            text.Text = value;
    }

    private static void SaveContent(Window window, string folder, string fileName)
    {
        var width = Math.Clamp((int)Math.Ceiling(window.Width), 520, 1600);
        var height = Math.Clamp((int)Math.Ceiling(window.Height), 420, 1200);
        if (window.Content is not FrameworkElement content)
            throw new InvalidOperationException($"{window.GetType().Name} has no renderable content.");

        var size = new Size(width, height);
        content.Measure(size);
        content.Arrange(new Rect(0, 0, width, height));
        content.UpdateLayout();

        var bitmap = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(content);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var stream = File.Create(Path.Combine(folder, fileName));
        encoder.Save(stream);
    }
}
