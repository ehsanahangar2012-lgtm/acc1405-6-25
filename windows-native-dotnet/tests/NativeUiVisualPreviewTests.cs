using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
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
        var currentStage = "initialization";
        var thread = new Thread(() =>
        {
            try
            {
                currentStage = "WPF application resources";
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
                    ShowInTaskbar = false,
                    WindowStyle = WindowStyle.ToolWindow,
                    ShowActivated = false
                };
                // WPF validates that an Owner has been shown at least once before another
                // Window may set Owner; the capture itself remains off-screen/in-memory.
                owner.Show();

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
                    currentStage = $"dashboard ({theme})";
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
                    // Keep visual-tree creation realistic but avoid reading/writing any user's
                    // accounting file or starting background services in this visual-only test.
                    var startupMethod = typeof(MainWindow).GetMethod(
                        "MainWindow_Loaded", BindingFlags.Instance | BindingFlags.NonPublic);
                    if (startupMethod is not null)
                    {
                        var startupHandler = (RoutedEventHandler)Delegate.CreateDelegate(
                            typeof(RoutedEventHandler), dashboard, startupMethod);
                        dashboard.Loaded -= startupHandler;
                    }
                    dashboard.Show();
                    ApplicationThemeService.Apply(dashboard, theme);
                    var navigationSelection = typeof(MainWindow).GetMethod(
                        "UpdateNavigationSelection", BindingFlags.Instance | BindingFlags.NonPublic);
                    if (navigationSelection is null)
                        throw new InvalidOperationException("MainWindow navigation-theme method was not found.");
                    navigationSelection.Invoke(dashboard, new object?[] { "dashboard", theme });
                    dashboard.Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Render,
                        new Action(dashboard.UpdateLayout));
                    SaveContent(dashboard, outputDirectory, $"dashboard-{theme}.png");
                    dashboard.Close();

                    currentStage = $"person form ({theme})";
                    var personDialog = new CustomerDialog(owner, suggestedCode: "CUS-1002");
                    CaptureVisibleWindow(personDialog, theme, outputDirectory, $"person-form-{theme}.png");

                    currentStage = $"invoice form ({theme})";
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
                    CaptureVisibleWindow(invoiceDialog, theme, outputDirectory, $"invoice-form-{theme}.png");

                    currentStage = $"voucher form ({theme})";
                    var voucherDialog = new VoucherDialog(
                        owner, people, products, invoices, companyProfile: company);
                    CaptureVisibleWindow(voucherDialog, theme, outputDirectory, $"voucher-form-{theme}.png");

                    currentStage = $"invoice print preview ({theme})";
                    var preview = new InvoicePreviewWindow(
                        owner, invoice, defaultTheme: "modern", showQr: false,
                        company: company, currencyCode: "RIAL");
                    CaptureVisibleWindow(preview, theme, outputDirectory, $"invoice-print-preview-{theme}.png");
                }

                owner.Close();
                var capturedImages = Directory.GetFiles(outputDirectory, "*.png");
                Assert.AreEqual(10, capturedImages.Length, "Expected dashboard, person, invoice, voucher and print-preview captures for both themes.");
            }
            catch (Exception ex)
            {
                failure = new InvalidOperationException($"Visual capture failed at stage: {currentStage}.", ex);
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException($"Native WPF screenshot capture failed: {failure}", failure);
    }

    private static void CaptureVisibleWindow(Window window, string theme, string folder, string fileName)
    {
        window.Show();
        try
        {
            // Apply after Show so ComboBox, DatePicker and content presenter templates are
            // already instantiated; this matches the application's Loaded-time theme path.
            ApplicationThemeService.Apply(window, theme);
            window.Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Render,
                new Action(window.UpdateLayout));
            SaveContent(window, folder, fileName);
        }
        finally
        {
            window.Hide();
            window.Close();
        }
    }

    private static void SetText(Window window, string name, string value)
    {
        if (window.FindName(name) is TextBlock text)
            text.Text = value;
    }

    private static void SaveContent(Window window, string folder, string fileName)
    {
        if (window.Content is not FrameworkElement content)
            throw new InvalidOperationException($"{window.GetType().Name} has no renderable content.");

        Visual visual;
        double measuredWidth;
        double measuredHeight;
        if (window.IsLoaded)
        {
            // Render the Window root rather than re-arranging its RTL content in isolation.
            // Re-measuring Window.Content after Show can mirror FlowDirection a second time
            // and produce review images that do not match the live desktop layout.
            window.Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Render,
                new Action(window.UpdateLayout));
            visual = window;
            measuredWidth = window.ActualWidth;
            measuredHeight = window.ActualHeight;
        }
        else
        {
            measuredWidth = window.Width;
            measuredHeight = window.Height;
            var size = new Size(measuredWidth, measuredHeight);
            content.Measure(size);
            content.Arrange(new Rect(0, 0, measuredWidth, measuredHeight));
            content.UpdateLayout();
            visual = content;
        }

        var width = Math.Clamp((int)Math.Ceiling(measuredWidth), 520, 1600);
        var height = Math.Clamp((int)Math.Ceiling(measuredHeight), 420, 1200);
        var bitmap = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var stream = File.Create(Path.Combine(folder, fileName));
        encoder.Save(stream);
    }
}
