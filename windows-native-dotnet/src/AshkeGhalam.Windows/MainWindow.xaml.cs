using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Win32;
using AshkeGhalam.Windows.Dialogs;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows;

public partial class MainWindow : Window
{
    private readonly LocalDataStore _store = new();
    private AccountingData _data = new();
    private bool _canWrite;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            _data = _store.Load();
            _canWrite = true;
            StorageStatus.Text = "ذخیره‌سازی محلی آماده";
            FooterStatus.Text = "ذخیره‌سازی خودکار روی این رایانه فعال است؛ پشتیبان رمزگذاری‌شده تهیه کنید.";
            RefreshAll();
        }
        catch (Exception ex)
        {
            _data = new AccountingData();
            _canWrite = false;
            StorageStatus.Text = "دادهٔ محلی نیاز به بازیابی دارد";
            FooterStatus.Text = "برای جلوگیری از بازنویسی فایل ناسالم، ثبت تغییرات غیرفعال است.";
            RefreshAll();
            MessageBox.Show(this, ex.Message, "خطا در خواندن دادهٔ محلی", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void MainTabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (e.OriginalSource == MainTabs) RefreshAll();
    }

    private bool RequireWritable()
    {
        if (_canWrite) return true;
        MessageBox.Show(this, "ذخیره‌سازی محلی آماده نیست. از یک فایل پشتیبان معتبر بازیابی کنید؛ فایل فعلی بدون بررسی بازنویسی نمی‌شود.",
            "ذخیره‌سازی غیرفعال", MessageBoxButton.OK, MessageBoxImage.Warning);
        return false;
    }

    private void Commit(Action<AccountingData> mutation, string successMessage)
    {
        if (!RequireWritable()) return;
        try
        {
            var next = _data.DeepCopy();
            mutation(next);
            AccountingDataValidator.Validate(next);
            _store.Save(next);
            _data = next;
            RefreshAll();
            FooterStatus.Text = successMessage + " • " + DateTime.Now.ToString("HH:mm:ss");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "عملیات انجام نشد", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void RefreshAll()
    {
        CustomersGrid.ItemsSource = null;
        CustomersGrid.ItemsSource = _data.Customers.OrderBy(c => c.Name).ToList();
        ProductsGrid.ItemsSource = null;
        ProductsGrid.ItemsSource = _data.Products.OrderBy(p => p.Name).ToList();
        InvoicesGrid.ItemsSource = null;
        InvoicesGrid.ItemsSource = _data.Invoices.OrderByDescending(i => i.Number).ToList();
        PaymentsGrid.ItemsSource = null;
        PaymentsGrid.ItemsSource = _data.Payments.OrderByDescending(p => p.CreatedAt).ToList();
        ExpensesGrid.ItemsSource = null;
        ExpensesGrid.ItemsSource = _data.Expenses.OrderByDescending(x => x.CreatedAt).ToList();
        RecentInvoicesGrid.ItemsSource = null;
        RecentInvoicesGrid.ItemsSource = _data.Invoices.OrderByDescending(i => i.Number).Take(10).ToList();

        var sales = _data.Invoices.Where(i => i.Status != "لغو شده").Sum(i => i.Total);
        var paid = _data.Payments.Sum(p => p.Amount);
        var receivables = _data.Invoices.Where(i => i.Status != "لغو شده").Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var expenses = _data.Expenses.Sum(x => x.Amount);
        CustomerCount.Text = _data.Customers.Count.ToString("N0", CultureInfo.CurrentCulture);
        ProductCount.Text = _data.Products.Count.ToString("N0", CultureInfo.CurrentCulture);
        InvoiceCount.Text = _data.Invoices.Count(i => i.Status != "لغو شده").ToString("N0", CultureInfo.CurrentCulture);
        SalesTotal.Text = sales.ToString("N2", CultureInfo.CurrentCulture);
        PaymentsTotal.Text = paid.ToString("N2", CultureInfo.CurrentCulture);
        ReceivablesTotal.Text = receivables.ToString("N2", CultureInfo.CurrentCulture);
        ExpensesTotal.Text = expenses.ToString("N2", CultureInfo.CurrentCulture);
        ReportSales.Text = sales.ToString("N2", CultureInfo.CurrentCulture);
        ReportPayments.Text = paid.ToString("N2", CultureInfo.CurrentCulture);
        ReportReceivables.Text = receivables.ToString("N2", CultureInfo.CurrentCulture);
        ReportExpenses.Text = expenses.ToString("N2", CultureInfo.CurrentCulture);
        ReportCash.Text = (paid - expenses).ToString("N2", CultureInfo.CurrentCulture);
    }

    private void AddCustomer_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new CustomerDialog(this);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord customer)
            Commit(data => data.Customers.Add(customer), "مشتری ذخیره شد");
    }

    private void EditCustomer_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CustomersGrid.SelectedItem is not CustomerRecord selected) { MessageBox.Show(this, "یک مشتری را انتخاب کنید."); return; }
        var dialog = new CustomerDialog(this, selected);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord changed)
            Commit(data =>
            {
                var index = data.Customers.FindIndex(c => c.Id == changed.Id);
                if (index < 0) throw new InvalidOperationException("مشتری پیدا نشد.");
                data.Customers[index] = changed;
                // Invoice/payment names remain historical snapshots.
            }, "مشخصات مشتری به‌روزرسانی شد");
    }

    private void DeleteCustomer_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CustomersGrid.SelectedItem is not CustomerRecord selected) { MessageBox.Show(this, "یک مشتری را انتخاب کنید."); return; }
        if (_data.Invoices.Any(i => i.CustomerId == selected.Id))
        {
            MessageBox.Show(this, "این مشتری سابقهٔ فاکتور دارد؛ برای حفظ سوابق مالی، حذف آن مجاز نیست.", "حذف مشتری", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (MessageBox.Show(this, $"مشتری «{selected.Name}» حذف شود؟", "تأیید حذف", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        Commit(data => data.Customers.RemoveAll(c => c.Id == selected.Id), "مشتری حذف شد");
    }

    private void AddProduct_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new ProductDialog(this);
        if (dialog.ShowDialog() == true && dialog.Result is ProductRecord product)
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(product.Sku) && data.Products.Any(p => string.Equals(p.Sku, product.Sku, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد کالای تکراری مجاز نیست.");
                data.Products.Add(product);
            }, "کالا و موجودی اولیه ذخیره شد");
    }

    private void EditProduct_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (ProductsGrid.SelectedItem is not ProductRecord selected) { MessageBox.Show(this, "یک کالا را انتخاب کنید."); return; }
        var dialog = new ProductDialog(this, selected);
        if (dialog.ShowDialog() == true && dialog.Result is ProductRecord changed)
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(changed.Sku) && data.Products.Any(p => p.Id != changed.Id && string.Equals(p.Sku, changed.Sku, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد کالای تکراری مجاز نیست.");
                var index = data.Products.FindIndex(p => p.Id == changed.Id);
                if (index < 0) throw new InvalidOperationException("کالا پیدا نشد.");
                data.Products[index] = changed;
            }, "مشخصات کالا به‌روزرسانی شد");
    }

    private void DeleteProduct_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (ProductsGrid.SelectedItem is not ProductRecord selected) { MessageBox.Show(this, "یک کالا را انتخاب کنید."); return; }
        if (_data.Invoices.Any(i => i.Lines.Any(l => l.ProductId == selected.Id)))
        {
            MessageBox.Show(this, "این کالا در سوابق فاکتور وجود دارد؛ برای حفظ سوابق، حذف آن مجاز نیست.", "حذف کالا", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (selected.StockQuantity != 0m)
        {
            MessageBox.Show(this, "برای حفظ کنترل موجودی، حذف کالای دارای موجودی مجاز نیست.", "حذف کالا", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (MessageBox.Show(this, $"کالای «{selected.Name}» حذف شود؟", "تأیید حذف", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        Commit(data => data.Products.RemoveAll(p => p.Id == selected.Id), "کالا حذف شد");
    }

    private void AddStock_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (_data.Products.Count == 0) { MessageBox.Show(this, "ابتدا یک کالا ثبت کنید."); return; }
        var dialog = new StockDialog(this, _data.Products);
        if (dialog.ShowDialog() == true)
            Commit(data => AccountingOperations.AddStock(data, dialog.ProductId, dialog.Quantity), "موجودی کالا افزایش یافت");
    }

    private void AddInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (_data.Customers.Count == 0 || _data.Products.Count == 0)
        {
            MessageBox.Show(this, "برای صدور فاکتور، ابتدا حداقل یک مشتری و یک کالا ثبت کنید.",
                "پیش‌نیاز فاکتور", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var dialog = new InvoiceDialog(this, _data.Customers, _data.Products);
        if (dialog.ShowDialog() == true && dialog.Result is InvoiceDraft draft)
        {
            Commit(data => AccountingOperations.CreateInvoice(data, draft), "فاکتور ثبت شد و موجودی کالا به‌روزرسانی شد");
            MainTabs.SelectedIndex = 3;
        }
    }

    private void CancelInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (InvoicesGrid.SelectedItem is not InvoiceRecord invoice) { MessageBox.Show(this, "یک فاکتور را انتخاب کنید."); return; }
        if (MessageBox.Show(this, $"فاکتور شماره {invoice.Number} لغو و موجودی اقلام برگشت داده شود؟ فقط فاکتور بدون دریافت قابل لغو است.",
            "تأیید لغو فاکتور", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data => AccountingOperations.CancelInvoice(data, invoice.Id), "فاکتور لغو و موجودی برگشت داده شد");
    }

    private void PrintInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (InvoicesGrid.SelectedItem is not InvoiceRecord invoice) { MessageBox.Show(this, "یک فاکتور را انتخاب کنید."); return; }
        try
        {
            var printDialog = new PrintDialog();
            if (printDialog.ShowDialog() != true) return;
            var doc = new FlowDocument
            {
                FontFamily = new FontFamily("Segoe UI"),
                FontSize = 12,
                FlowDirection = FlowDirection.RightToLeft,
                PagePadding = new Thickness(45),
                ColumnWidth = 720
            };
            doc.Blocks.Add(new Paragraph(new Run("اشک قلم — فاکتور فروش"))
            {
                FontSize = 22, FontWeight = FontWeights.Bold, TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 20)
            });
            doc.Blocks.Add(new Paragraph(new Run($"شماره فاکتور: {invoice.Number}     تاریخ: {invoice.CreatedAt.ToLocalTime():yyyy/MM/dd HH:mm}"))
            { TextAlignment = TextAlignment.Right });
            doc.Blocks.Add(new Paragraph(new Run($"مشتری: {invoice.CustomerName}")) { TextAlignment = TextAlignment.Right });
            if (!string.IsNullOrWhiteSpace(invoice.Notes))
                doc.Blocks.Add(new Paragraph(new Run($"توضیحات: {invoice.Notes}")) { TextAlignment = TextAlignment.Right });

            var table = new Table { CellSpacing = 0 };
            table.Columns.Add(new TableColumn { Width = new GridLength(4, GridUnitType.Star) });
            table.Columns.Add(new TableColumn { Width = new GridLength(1, GridUnitType.Star) });
            table.Columns.Add(new TableColumn { Width = new GridLength(2, GridUnitType.Star) });
            table.Columns.Add(new TableColumn { Width = new GridLength(2, GridUnitType.Star) });
            var group = new TableRowGroup();
            var heading = new TableRow();
            foreach (var label in new[] { "شرح کالا", "تعداد", "قیمت واحد", "جمع" })
                heading.Cells.Add(new TableCell(new Paragraph(new Run(label)))
                { FontWeight = FontWeights.Bold, Padding = new Thickness(6), BorderBrush = Brushes.Gray, BorderThickness = new Thickness(0.4) });
            group.Rows.Add(heading);
            foreach (var line in invoice.Lines)
            {
                var row = new TableRow();
                foreach (var value in new[] { line.ProductName, line.Quantity.ToString("N2"), line.UnitPrice.ToString("N2"), line.LineTotal.ToString("N2") })
                    row.Cells.Add(new TableCell(new Paragraph(new Run(value)))
                    { Padding = new Thickness(6), BorderBrush = Brushes.Gray, BorderThickness = new Thickness(0.4) });
                group.Rows.Add(row);
            }
            table.RowGroups.Add(group);
            doc.Blocks.Add(table);
            doc.Blocks.Add(new Paragraph(new Run($"جمع: {invoice.Subtotal:N2}")) { TextAlignment = TextAlignment.Left, Margin = new Thickness(0, 18, 0, 0) });
            doc.Blocks.Add(new Paragraph(new Run($"مالیات ({invoice.TaxRatePercent:N2}%): {invoice.TaxAmount:N2}")) { TextAlignment = TextAlignment.Left });
            doc.Blocks.Add(new Paragraph(new Run($"مبلغ نهایی: {invoice.Total:N2}")) { FontSize = 17, FontWeight = FontWeights.Bold, TextAlignment = TextAlignment.Left });
            doc.Blocks.Add(new Paragraph(new Run($"وضعیت: {invoice.Status}")) { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 18, 0, 0) });
            printDialog.PrintDocument(((IDocumentPaginatorSource)doc).DocumentPaginator, $"AshkeGhalam-Invoice-{invoice.Number}");
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "چاپ فاکتور", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private void AddPayment_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new PaymentDialog(this, _data);
        if (dialog.ShowDialog() == true)
            Commit(data => AccountingOperations.RecordPayment(data, dialog.InvoiceId, dialog.Amount, dialog.Method, dialog.Reference), "دریافت ثبت شد");
    }

    private void AddExpense_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new ExpenseDialog(this);
        if (dialog.ShowDialog() == true)
            Commit(data => AccountingOperations.AddExpense(data, dialog.ExpenseTitle, dialog.Category, dialog.Amount, dialog.Notes), "هزینه ثبت شد");
    }

    private void CreateBackup_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new BackupPasswordDialog(this, "ساخت پشتیبان رمزگذاری‌شده", confirmPassword: true);
        if (dialog.ShowDialog() != true) return;
        var picker = new SaveFileDialog
        {
            Title = "ذخیره فایل پشتیبان",
            Filter = "Ashke Ghalam encrypted backup (*.ashkbackup)|*.ashkbackup",
            AddExtension = true,
            DefaultExt = ".ashkbackup",
            FileName = $"AshkeGhalam-Backup-{DateTime.Now:yyyyMMdd-HHmmss}.ashkbackup"
        };
        if (picker.ShowDialog() != true) return;
        try
        {
            var bytes = BackupFileService.CreateEncryptedBackup(_data, dialog.Passphrase);
            File.WriteAllBytes(picker.FileName, bytes);
            FooterStatus.Text = "پشتیبان رمزگذاری‌شده ذخیره شد: " + picker.FileName;
            MessageBox.Show(this, "فایل پشتیبان رمزگذاری و ذخیره شد. رمز آن را جداگانه و امن نگه دارید.",
                "پشتیبان موفق", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "خطا در پشتیبان‌گیری", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private void RestoreBackup_Click(object sender, RoutedEventArgs e)
    {
        var picker = new OpenFileDialog
        {
            Title = "انتخاب فایل پشتیبان",
            Filter = "Ashke Ghalam encrypted backup (*.ashkbackup)|*.ashkbackup|All files (*.*)|*.*",
            CheckFileExists = true
        };
        if (picker.ShowDialog() != true) return;
        var dialog = new BackupPasswordDialog(this, "رمز فایل پشتیبان", confirmPassword: false);
        if (dialog.ShowDialog() != true) return;
        try
        {
            var restored = BackupFileService.ReadEncryptedBackup(File.ReadAllBytes(picker.FileName), dialog.Passphrase);
            var choice = MessageBox.Show(this,
                $"پشتیبان معتبر است: {restored.Customers.Count} مشتری، {restored.Products.Count} کالا و {restored.Invoices.Count} فاکتور.\nاطلاعات فعلی با این پشتیبان جایگزین شود؟",
                "تأیید بازیابی", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (choice != MessageBoxResult.Yes) return;
            _store.Save(restored);
            _data = restored;
            _canWrite = true;
            StorageStatus.Text = "ذخیره‌سازی محلی آماده";
            RefreshAll();
            FooterStatus.Text = "بازیابی پشتیبان با موفقیت انجام شد.";
            MessageBox.Show(this, "بازیابی انجام شد.", "موفق", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "بازیابی انجام نشد", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private void ExportCustomers_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("customers.csv", new[] { "Id", "Name", "Phone", "Address", "CreatedAt" },
            _data.Customers.Select(c => new[] { c.Id, c.Name, c.Phone, c.Address, c.CreatedAt.ToString("O") }));

    private void ExportProducts_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("products.csv", new[] { "Id", "Name", "Sku", "Unit", "StockQuantity", "UnitPrice" },
            _data.Products.Select(p => new[] { p.Id, p.Name, p.Sku, p.Unit, p.StockQuantity.ToString(CultureInfo.InvariantCulture), p.UnitPrice.ToString(CultureInfo.InvariantCulture) }));

    private void ExportInvoices_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("invoices.csv", new[] { "Number", "CustomerName", "Description", "Subtotal", "TaxRatePercent", "TaxAmount", "Total", "Status", "CreatedAt" },
            _data.Invoices.Select(i => new[] { i.Number.ToString(CultureInfo.InvariantCulture), i.CustomerName, i.Description,
                i.Subtotal.ToString(CultureInfo.InvariantCulture), i.TaxRatePercent.ToString(CultureInfo.InvariantCulture),
                i.TaxAmount.ToString(CultureInfo.InvariantCulture), i.Total.ToString(CultureInfo.InvariantCulture), i.Status, i.CreatedAt.ToString("O") }));

    private void ExportReport_Click(object sender, RoutedEventArgs e)
    {
        var sales = _data.Invoices.Where(i => i.Status != "لغو شده").Sum(i => i.Total);
        var paid = _data.Payments.Sum(p => p.Amount);
        var remaining = _data.Invoices.Where(i => i.Status != "لغو شده").Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var expenses = _data.Expenses.Sum(i => i.Amount);
        ExportCsv("summary-report.csv", new[] { "Metric", "Value" }, new[]
        {
            new[] { "Sales", sales.ToString(CultureInfo.InvariantCulture) },
            new[] { "Payments", paid.ToString(CultureInfo.InvariantCulture) },
            new[] { "Receivables", remaining.ToString(CultureInfo.InvariantCulture) },
            new[] { "Expenses", expenses.ToString(CultureInfo.InvariantCulture) },
            new[] { "NetCashFlow", (paid - expenses).ToString(CultureInfo.InvariantCulture) }
        });
    }

    private void ExportCsv(string fileName, IEnumerable<string> headers, IEnumerable<string[]> rows)
    {
        var picker = new SaveFileDialog { Title = "ذخیره خروجی CSV", Filter = "CSV UTF-8 (*.csv)|*.csv",
            AddExtension = true, DefaultExt = ".csv", FileName = fileName };
        if (picker.ShowDialog() != true) return;
        try
        {
            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", headers.Select(CsvEscape)));
            foreach (var row in rows) sb.AppendLine(string.Join(",", row.Select(CsvEscape)));
            File.WriteAllText(picker.FileName, "\uFEFF" + sb, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            FooterStatus.Text = $"خروجی ذخیره شد: {picker.FileName}";
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "خطا در خروجی", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private static string CsvEscape(string? value) => "\"" + (value ?? "").Replace("\"", "\"\"") + "\"";
}
