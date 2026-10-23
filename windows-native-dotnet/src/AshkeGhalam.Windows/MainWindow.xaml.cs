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
        if (FindName("ChecksGrid") is DataGrid checksGrid)
        {
            checksGrid.ItemsSource = null;
            checksGrid.ItemsSource = _data.Checks.OrderBy(c => c.DueDate).ThenByDescending(c => c.CreatedAt)
                .Select(c => new CheckGridRow(c, CheckTypeLabel(c.CheckType), c.HolderName, c.BankName, c.Amount,
                    c.SayadId, c.CheckNumber, FormatPersianDate(c.DueDate),
                    c.IssueDate is DateTimeOffset issue ? FormatPersianDate(issue) : "—",
                    CheckStatusLabel(c.Status), c.IsHighPriority ? "اولویت‌دار" : "عادی", c.PersonName))
                .ToList();
        }
        if (FindName("VouchersGrid") is DataGrid vouchersGrid)
        {
            vouchersGrid.ItemsSource = null;
            vouchersGrid.ItemsSource = _data.Vouchers.OrderByDescending(v => v.Number)
                .Select(v => new VoucherGridRow(v, v.Number, v.TrackingCode, VoucherTypeLabel(v.Type),
                    FormatPersianDate(v.Date), v.PersonName, v.Items.Count,
                    v.Items.Sum(i => i.Quantity), v.EstimatedValue, VoucherStatusLabel(v.Status),
                    VoucherMovementTypeLabel(v.MovementType), v.Notes))
                .ToList();
        }
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
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(customer.Code) &&
                    data.Customers.Any(p => string.Equals(p.Code, customer.Code, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد شخص تکراری است.");
                data.Customers.Add(customer);
            }, "پرونده شخص ذخیره شد");
    }

    private void EditCustomer_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CustomersGrid.SelectedItem is not CustomerRecord selected) { MessageBox.Show(this, "یک مشتری را انتخاب کنید."); return; }
        var dialog = new CustomerDialog(this, selected);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord changed)
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(changed.Code) &&
                    data.Customers.Any(p => p.Id != changed.Id && string.Equals(p.Code, changed.Code, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد شخص تکراری است.");
                var index = data.Customers.FindIndex(c => c.Id == changed.Id);
                if (index < 0) throw new InvalidOperationException("شخص پیدا نشد.");
                data.Customers[index] = changed;
                // Invoice/payment names remain historical snapshots.
            }, "پرونده شخص به‌روزرسانی شد");
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
        if (_data.Invoices.Any(i => i.Lines.Any(l => l.ProductId == selected.Id)) ||
            _data.Vouchers.Any(v => v.Items.Any(item => item.ProductId == selected.Id)) ||
            _data.InventoryMovements.Any(m => m.ProductId == selected.Id))
        {
            MessageBox.Show(this, "این کالا در سوابق فاکتور یا گردش انبار وجود دارد؛ برای حفظ زنجیرهٔ مالی و انبارداری، حذف آن مجاز نیست.", "حذف کالا", MessageBoxButton.OK, MessageBoxImage.Warning);
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
            MessageBox.Show(this, "برای ثبت فاکتور/پیش‌فاکتور ابتدا طرف حساب و کالا ثبت کنید.",
                "پیش‌نیاز سند", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var dialog = new InvoiceDialog(this, _data.Customers, _data.Products, _data.Invoices);
        if (dialog.ShowDialog() == true && dialog.Result is InvoiceDraft draft)
        {
            var message = draft.Type switch
            {
                "PURCHASE" => "فاکتور خرید ثبت و موجودی به‌روزرسانی شد",
                "PROFORMA" => "پیش‌فاکتور ثبت شد؛ موجودی هنوز تغییر نکرده است",
                _ => "فاکتور فروش ثبت و موجودی به‌روزرسانی شد"
            };
            Commit(data => AccountingOperations.CreateInvoice(data, draft), message);
            MainTabs.SelectedIndex = 3;
        }
    }

    private void ConvertProformaToSale_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (InvoicesGrid.SelectedItem is not InvoiceRecord invoice)
        { MessageBox.Show(this, "یک پیش‌فاکتور را انتخاب کنید."); return; }
        if (invoice.Type != "PROFORMA")
        { MessageBox.Show(this, "سند انتخابی پیش‌فاکتور نیست."); return; }
        if (MessageBox.Show(this,
            $"پیش‌فاکتور {invoice.DisplayNumber} به فروش قطعی تبدیل و موجودی اقلام کاهش داده شود؟\nپیش از تأیید، موجودی آزاد همهٔ اقلام کنترل می‌شود.",
            "تبدیل پیش‌فاکتور به فروش", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        Commit(data => AccountingOperations.ConvertProformaToSale(data, invoice.Id),
            "پیش‌فاکتور به فروش تبدیل شد و موجودی کاهش یافت");
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
            doc.Blocks.Add(new Paragraph(new Run($"اشک قلم — {invoice.TypeLabel}"))
            {
                FontSize = 22, FontWeight = FontWeights.Bold, TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 20)
            });
            doc.Blocks.Add(new Paragraph(new Run($"شماره سند: {invoice.DisplayNumber}     کد پیگیری: {invoice.TrackingCode}     تاریخ: {invoice.CreatedAt.ToLocalTime():yyyy/MM/dd HH:mm}"))
            { TextAlignment = TextAlignment.Right });
            doc.Blocks.Add(new Paragraph(new Run($"طرف حساب: {invoice.CustomerName}")) { TextAlignment = TextAlignment.Right });
            if (invoice.DueDate is DateTimeOffset dueDate)
                doc.Blocks.Add(new Paragraph(new Run($"سررسید: {dueDate.ToLocalTime():yyyy/MM/dd}")) { TextAlignment = TextAlignment.Right });
            if (!string.IsNullOrWhiteSpace(invoice.DriverName) || !string.IsNullOrWhiteSpace(invoice.VehiclePlate))
                doc.Blocks.Add(new Paragraph(new Run($"راننده: {invoice.DriverName}   تلفن: {invoice.DriverPhone}   خودرو: {invoice.VehiclePlate}")) { TextAlignment = TextAlignment.Right });
            if (!string.IsNullOrWhiteSpace(invoice.TaxId))
                doc.Blocks.Add(new Paragraph(new Run($"شناسه مالیاتی: {invoice.TaxId}")) { TextAlignment = TextAlignment.Right });
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
            doc.Blocks.Add(new Paragraph(new Run($"جمع کالاها: {invoice.Subtotal:N2}")) { TextAlignment = TextAlignment.Left, Margin = new Thickness(0, 18, 0, 0) });
            doc.Blocks.Add(new Paragraph(new Run($"تخفیف: {invoice.Discount:N2}")) { TextAlignment = TextAlignment.Left });
            doc.Blocks.Add(new Paragraph(new Run($"{(invoice.TaxIsAmount ? "مالیات" : $"مالیات ({invoice.TaxRatePercent:N2}%)")}: {invoice.TaxAmount:N2}")) { TextAlignment = TextAlignment.Left });
            doc.Blocks.Add(new Paragraph(new Run($"مبلغ نهایی: {invoice.Total:N2}")) { FontSize = 17, FontWeight = FontWeights.Bold, TextAlignment = TextAlignment.Left });
            doc.Blocks.Add(new Paragraph(new Run($"نقدی ثبت‌شده: {invoice.CashAmount:N2}    مبلغ چک: {invoice.CheckAmount:N2}")) { TextAlignment = TextAlignment.Left });
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
        ExportCsv("persons.csv", new[] { "Id", "Code", "Name", "Type", "IsCustomer", "IsSupplier", "Category", "Phone", "Email", "NationalId", "Address", "Notes", "Balance", "CreatedAt" },
            _data.Customers.Select(p => new[]
            {
                p.Id, p.Code, p.Name, p.Type, p.IsCustomer.ToString(), p.IsSupplier.ToString(), p.Category,
                p.Phone, p.Email, p.NationalId, p.Address, p.Notes,
                p.Balance.ToString(CultureInfo.InvariantCulture), p.CreatedAt.ToString("O")
            }));

    private void ExportProducts_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("products.csv", new[] { "Id", "Name", "Code", "SerialNumber", "Unit", "StockQuantity", "ReservedStock", "MinStock", "BuyPrice", "SellPrice", "Weight", "ShelfLocation", "Category", "SubCategory", "SubSubCategory", "CategoryPath", "Description", "ImageUrl", "CreatedAt" },
            _data.Products.Select(p => new[]
            {
                p.Id, p.Name, p.Code, p.SerialNumber, p.Unit,
                p.StockQuantity.ToString(CultureInfo.InvariantCulture), p.ReservedStock.ToString(CultureInfo.InvariantCulture),
                p.MinStock?.ToString(CultureInfo.InvariantCulture) ?? "", p.BuyPrice?.ToString(CultureInfo.InvariantCulture) ?? "",
                p.SellPrice.ToString(CultureInfo.InvariantCulture), p.Weight?.ToString(CultureInfo.InvariantCulture) ?? "",
                p.ShelfLocation, p.Category, p.SubCategory, p.SubSubCategory, p.CategoryPath, p.Description, p.ImageUrl, p.CreatedAt.ToString("O")
            }));

    private void ExportInvoices_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("invoices.csv", new[] { "Type", "Prefix", "Number", "TrackingCode", "PersonName", "Description", "Subtotal", "Discount", "TaxIsAmount", "TaxRatePercent", "TaxAmount", "Total", "CashAmount", "CheckAmount", "DueDate", "DriverName", "DriverPhone", "VehiclePlate", "TaxId", "Status", "CreatedAt", "Notes" },
            _data.Invoices.Select(i => new[]
            {
                i.Type, i.Prefix, i.Number.ToString(CultureInfo.InvariantCulture), i.TrackingCode, i.CustomerName, i.Description,
                i.Subtotal.ToString(CultureInfo.InvariantCulture), i.Discount.ToString(CultureInfo.InvariantCulture), i.TaxIsAmount.ToString(),
                i.TaxRatePercent.ToString(CultureInfo.InvariantCulture), i.TaxAmount.ToString(CultureInfo.InvariantCulture),
                i.Total.ToString(CultureInfo.InvariantCulture), i.CashAmount.ToString(CultureInfo.InvariantCulture),
                i.CheckAmount.ToString(CultureInfo.InvariantCulture), i.DueDate?.ToString("O") ?? "",
                i.DriverName, i.DriverPhone, i.VehiclePlate, i.TaxId, i.Status, i.CreatedAt.ToString("O"), i.Notes
            }));

    private void ExportReport_Click(object sender, RoutedEventArgs e)
    {
        var sales = _data.Invoices.Where(i => i.Status != "لغو شده" && i.Type == "SALE").Sum(i => i.Total);
        var purchases = _data.Invoices.Where(i => i.Status != "لغو شده" && i.Type == "PURCHASE").Sum(i => i.Total);
        var receivables = _data.Invoices.Where(i => i.Status != "لغو شده" && i.Type == "SALE").Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var payables = _data.Invoices.Where(i => i.Status != "لغو شده" && i.Type == "PURCHASE").Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var paid = _data.Payments.Sum(p => p.Amount);
        var expenses = _data.Expenses.Sum(i => i.Amount);
        ExportCsv("summary-report.csv", new[] { "Metric", "Value" }, new[]
        {
            new[] { "Sales", sales.ToString(CultureInfo.InvariantCulture) },
            new[] { "Purchases", purchases.ToString(CultureInfo.InvariantCulture) },
            new[] { "AllPayments", paid.ToString(CultureInfo.InvariantCulture) },
            new[] { "SalesReceivables", receivables.ToString(CultureInfo.InvariantCulture) },
            new[] { "PurchasePayables", payables.ToString(CultureInfo.InvariantCulture) },
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

    private void AddVoucher_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (_data.Products.Count == 0)
        { MessageBox.Show(this, "برای ثبت حواله ابتدا کالا ثبت کنید.", "پیش‌نیاز حواله", MessageBoxButton.OK, MessageBoxImage.Information); return; }
        var dialog = new VoucherDialog(this, _data.Customers, _data.Products, _data.Invoices);
        if (dialog.ShowDialog() == true && dialog.Result is VoucherRecord voucher)
            Commit(data => AccountingOperations.CreateVoucher(data, voucher), "حواله ثبت و گردش موجودی به‌صورت اتمی ذخیره شد");
    }

    private void AdvanceVoucherStatus_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("VouchersGrid") is not DataGrid grid || grid.SelectedItem is not VoucherGridRow row)
        { MessageBox.Show(this, "ابتدا یک حواله را انتخاب کنید."); return; }
        var current = row.Record.Status;
        var next = current switch { "PENDING" => "IN_TRANSIT", "IN_TRANSIT" => "DELIVERED", _ => "" };
        if (string.IsNullOrEmpty(next)) { MessageBox.Show(this, "این حواله تحویل نهایی شده است."); return; }
        var message = next == "IN_TRANSIT" ? "وضعیت حواله به «در مسیر» تغییر کند؟" : "تحویل حواله تأیید و زمان تحویل ثبت شود؟";
        if (MessageBox.Show(this, message, "تغییر وضعیت حواله", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        Commit(data => AccountingOperations.ChangeVoucherStatus(data, row.Record.Id, next),
            next == "DELIVERED" ? "تحویل حواله ثبت شد" : "حواله به وضعیت در مسیر تغییر کرد");
    }

    private void DeleteVoucher_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("VouchersGrid") is not DataGrid grid || grid.SelectedItem is not VoucherGridRow row)
        { MessageBox.Show(this, "ابتدا یک حواله را انتخاب کنید."); return; }
        if (row.Record.Status != "PENDING")
        { MessageBox.Show(this, "برای جلوگیری از حذف سند در مسیر یا تحویل‌شده، فقط حوالهٔ در انتظار قابل حذف است.", "حذف محدود شده", MessageBoxButton.OK, MessageBoxImage.Warning); return; }
        if (MessageBox.Show(this, $"حواله شماره {row.Record.Number} حذف و اثر موجودی آن برگشت داده شود؟", "تأیید حذف", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data => AccountingOperations.DeleteVoucher(data, row.Record.Id), "حواله حذف و گردش موجودی آن برگشت داده شد");
    }

    private void ExportVouchers_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("inventory-vouchers.csv", new[] { "Number", "TrackingCode", "Date", "Type", "MovementType", "PersonName", "RelatedInvoiceId", "Items", "TotalWeight", "EstimatedValue", "Status", "VehicleNumber", "Supervisor", "ReceiverPhone", "ReturnReason", "Notes" },
            _data.Vouchers.OrderBy(v => v.Number).Select(v => new[]
            {
                v.Number.ToString(CultureInfo.InvariantCulture), v.TrackingCode, FormatPersianDate(v.Date), v.Type, v.MovementType,
                v.PersonName, v.RelatedInvoiceId, string.Join("؛ ", v.Items.Select(i => $"{i.ProductName} ({i.Quantity:N2} {i.Unit})")),
                v.TotalWeight.ToString(CultureInfo.InvariantCulture), v.EstimatedValue.ToString(CultureInfo.InvariantCulture),
                VoucherStatusLabel(v.Status), v.VehicleNumber, v.Supervisor, v.ReceiverPhone, v.ReturnReason, v.Notes
            }));

    private static string VoucherTypeLabel(string type) => type switch
    { "IN" => "ورود کالا", "OUT" => "خروج کالا", "RETURN" => "برگشت کالا", _ => type };

    private static string VoucherStatusLabel(string status) => status switch
    { "PENDING" => "در انتظار", "IN_TRANSIT" => "در مسیر", "DELIVERED" => "تحویل‌شده", _ => status };

    private static string VoucherMovementTypeLabel(string type) => type switch
    {
        "GOODS_RECEIPT" => "رسید خرید", "GOODS_ISSUE" => "حواله فروش",
        "INVENTORY_ADJUSTMENT" => "تعدیل موجودی", "PRODUCTION_CONSUMPTION" => "مصرف تولید",
        "PRODUCTION_OUTPUT" => "خروجی تولید", "RETURN_RECEIPT" => "برگشت از فروش",
        "RETURN_ISSUE" => "برگشت از خرید", "INTERNAL_TRANSFER" => "انتقال انبار", _ => type
    };

    private sealed record VoucherGridRow(VoucherRecord Record, int Number, string TrackingCode, string TypeLabel,
        string DateLabel, string PersonName, int ItemCount, decimal QuantityTotal, decimal EstimatedValue,
        string StatusLabel, string MovementTypeLabel, string Notes);

    private void AddCheck_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new CheckDialog(this);
        if (dialog.ShowDialog() != true || dialog.Result is not CheckRecord check) return;
        Commit(data =>
        {
            if (!string.IsNullOrWhiteSpace(check.SayadId) && data.Checks.Any(x => string.Equals(x.SayadId, check.SayadId, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("شناسهٔ صیادی تکراری است.");
            data.Checks.Add(check);
        }, "چک ثبت شد؛ وضعیت آن فقط به‌صورت محلی ثبت شده است");
    }

    private void EditCheck_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("ChecksGrid") is not DataGrid grid || grid.SelectedItem is not CheckGridRow selectedRow)
        { MessageBox.Show(this, "یک چک را انتخاب کنید."); return; }
        var selected = selectedRow.Record;
        var dialog = new CheckDialog(this, selected);
        if (dialog.ShowDialog() != true || dialog.Result is not CheckRecord changed) return;
        Commit(data =>
        {
            if (!string.IsNullOrWhiteSpace(changed.SayadId) && data.Checks.Any(x => x.Id != changed.Id && string.Equals(x.SayadId, changed.SayadId, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("شناسهٔ صیادی تکراری است.");
            var index = data.Checks.FindIndex(x => x.Id == changed.Id);
            if (index < 0) throw new InvalidOperationException("چک پیدا نشد.");
            data.Checks[index] = changed;
        }, "مشخصات چک به‌روزرسانی شد");
    }

    private void ChangeCheckStatus_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("ChecksGrid") is not DataGrid grid || grid.SelectedItem is not CheckGridRow selectedRow)
        { MessageBox.Show(this, "ابتدا یک چک را انتخاب کنید."); return; }
        var selected = selectedRow.Record;
        var dialog = new CheckStatusDialog(this, selected.Status);
        if (dialog.ShowDialog() != true) return;
        if (string.Equals(selected.Status, dialog.SelectedStatus, StringComparison.Ordinal))
        { MessageBox.Show(this, "وضعیت انتخاب‌شده با وضعیت فعلی تفاوتی ندارد."); return; }
        Commit(data =>
        {
            var check = data.Checks.SingleOrDefault(x => x.Id == selected.Id)
                ?? throw new InvalidOperationException("چک پیدا نشد.");
            check.Status = dialog.SelectedStatus;
            check.History.Add(new CheckHistoryRecord { ChangedAt = DateTimeOffset.Now, Status = dialog.SelectedStatus, Note = dialog.Note });
        }, "وضعیت چک در سوابق محلی ثبت شد؛ هیچ استعلام بانکی انجام نشده است");
    }

    private void DeleteCheck_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("ChecksGrid") is not DataGrid grid || grid.SelectedItem is not CheckGridRow selectedRow)
        { MessageBox.Show(this, "یک چک را انتخاب کنید."); return; }
        var selected = selectedRow.Record;
        if (!string.IsNullOrWhiteSpace(selected.RelatedInvoiceId) || selected.Status != "PENDING")
        {
            MessageBox.Show(this, "برای حفظ سابقهٔ مالی، فقط چکِ در انتظار و بدون پیوند فاکتور قابل حذف است. چک‌های دیگر را با وضعیت مناسب نگه دارید.",
                "حذف چک مجاز نیست", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (MessageBox.Show(this, "چک انتخابی حذف شود؟", "تأیید حذف", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data => data.Checks.RemoveAll(x => x.Id == selected.Id), "چک حذف شد");
    }

    private void ExportChecks_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("checks.csv", new[] { "CheckType", "HolderName", "BankName", "Amount", "SayadId", "CheckNumber", "DueDate", "IssueDate", "Status", "PersonName", "Description" },
            _data.Checks.Select(check => new[]
            {
                CheckTypeLabel(check.CheckType), check.HolderName, check.BankName,
                check.Amount.ToString(CultureInfo.InvariantCulture), check.SayadId, check.CheckNumber,
                FormatPersianDate(check.DueDate), check.IssueDate is DateTimeOffset issue ? FormatPersianDate(issue) : "",
                CheckStatusLabel(check.Status), check.PersonName, check.Description
            }));

    private static string CheckStatusLabel(string status) => status switch
    {
        "PENDING" => "در انتظار",
        "DEPOSITED" => "واگذار به بانک",
        "PASSED" => "پاس‌شده",
        "BOUNCED" => "برگشتی",
        "TRANSFERRED" => "واگذار شده",
        "CASHED" => "وصول‌شده",
        "RETURNED" => "عودت‌شده",
        _ => status
    };

    private static string CheckTypeLabel(string type) => type switch
    {
        "RECEIVED" => "دریافتی",
        "ISSUED" => "پرداختی",
        _ => type
    };

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private sealed record CheckGridRow(
        CheckRecord Record, string TypeLabel, string HolderName, string BankName, decimal Amount,
        string SayadId, string CheckNumber, string DueDateLabel, string IssueDateLabel,
        string StatusLabel, string PriorityLabel, string PersonName);

    // Native navigation mirrors the existing Ashke Ghalam sidebar. Unported pages are
    // deliberately marked as pending instead of being represented by fake functionality.
    private sealed record NativeModuleLink(string Title, string Group, string OriginalRoute, int? NativeTabIndex);

    private static readonly IReadOnlyDictionary<string, NativeModuleLink> NativeModuleLinks =
        new Dictionary<string, NativeModuleLink>(StringComparer.Ordinal)
        {
            ["dashboard"] = new("پیشخوان", "منوی اصلی", "/", 0),
            ["invoices"] = new("فاکتورها", "منوی اصلی", "/invoices", 3),
            ["inventory"] = new("انبارداری", "منوی اصلی", "/inventory", 2),
            ["checks"] = new("مدیریت چک", "منوی اصلی", "/checks", 8),
            ["vouchers"] = new("حواله‌های انبار", "عملیات محلی موجود", "/inventory (حواله‌های انبار)", 9),
            ["finance"] = new("امور مالی", "منوی اصلی", "/finance", null),
            ["customers"] = new("اشخاص", "منوی اصلی", "/customers", 1),
            ["reports"] = new("گزارشات عمومی", "گزارشات و تحلیل", "/reports", 6),
            ["users"] = new("کاربران و سطح دسترسی", "تنظیمات و سیستم", "/users", null),
            ["payments"] = new("دریافت‌ها", "عملیات محلی موجود", "بخش دریافت‌های نسخه بومی", 4),
            ["expenses"] = new("هزینه‌ها", "عملیات محلی موجود", "بخش هزینه‌های نسخه بومی", 5),
            ["backup"] = new("پشتیبان‌گیری محلی", "عملیات محلی موجود", "پشتیبان محلی نسخه بومی", 7),
            ["projects"] = new("پروژه‌ها", "مدیریت کسب‌وکار", "/projects", null),
            ["contracts"] = new("قراردادها", "مدیریت کسب‌وکار", "/contracts", null),
            ["assets"] = new("دارایی‌های ثابت", "مدیریت کسب‌وکار", "/assets", null),
            ["budget"] = new("بودجه‌بندی", "مدیریت کسب‌وکار", "/budget", null),
            ["marketing"] = new("بازاریابی و سئو", "مدیریت کسب‌وکار", "/marketing", null),
            ["import-center"] = new("مرکز واردات اسناد", "مدیریت کسب‌وکار", "/import-center", null),
            ["accounting"] = new("حسابداری دوبل", "حسابداری پیشرفته", "/accounting", null),
            ["cashflow-predictor"] = new("پیش‌بینی جریان نقدینگی", "حسابداری پیشرفته", "/cashflow-predictor", null),
            ["cashflow"] = new("جریان نقدینگی", "حسابداری پیشرفته", "/cashflow", null),
            ["tax"] = new("مدیریت مالیات", "حسابداری پیشرفته", "/tax", null),
            ["loans"] = new("وام‌ها", "حسابداری پیشرفته", "/loans", null),
            ["due-calendar"] = new("تقویم سررسید و اقساط", "حسابداری پیشرفته", "/due-calendar", null),
            ["bank-reconciliation"] = new("تطبیق بانکی", "حسابداری پیشرفته", "/bank-reconciliation", null),
            ["currency"] = new("مدیریت چندارزی", "حسابداری پیشرفته", "/currency", null),
            ["workflow-rules"] = new("قواعد گردش مالی", "حسابداری پیشرفته", "/workflow-rules", null),
            ["financial-reports"] = new("گزارشات مالی پیشرفته", "گزارشات و تحلیل", "/financial-reports", null),
            ["ai-assistant"] = new("دستیار هوشمند مالی", "گزارشات و تحلیل", "/ai-assistant", null),
            ["signature-dashboard"] = new("داشبورد امضا", "امضای دیجیتال", "/signature-dashboard", null),
            ["signature-management"] = new("مدیریت امضا", "امضای دیجیتال", "/signature-management", null),
            ["moadian"] = new("سامانه مؤدیان مالیاتی", "خدمات تجاری و ابری", "/moadian", null),
            ["pos-terminal"] = new("کارتخوان بانکی", "خدمات تجاری و ابری", "/pos-terminal", null),
            ["cloud-vault"] = new("پشتیبان ابری", "خدمات تجاری و ابری", "/cloud-vault", null),
            ["sms-center"] = new("پنل پیامک هوشمند", "خدمات تجاری و ابری", "/sms-center", null),
            ["multi-user-lan"] = new("شبکه محلی چندکاربره", "خدمات تجاری و ابری", "/multi-user-lan", null),
            ["client-broadcast"] = new("اطلاعیه‌ها", "خدمات تجاری و ابری", "/client-broadcast", null),
            ["activation"] = new("اتصال سرور و فعال‌سازی لایسنس", "خدمات تجاری و ابری", "/install-android (فقط اتصال/فعال‌سازی کلاینت)", null),
            ["mobile-catalog"] = new("کاتالوگ ویزیتوری همراه", "خدمات تجاری و ابری", "/mobile-catalog", null),
            ["catalog"] = new("کاتالوگ محصول", "خدمات تجاری و ابری", "/catalog", null),
            ["support-sla"] = new("پشتیبانی و تمدید", "خدمات تجاری و ابری", "/support-sla", null),
            ["fiscal-year"] = new("سال مالی", "تنظیمات و سیستم", "/fiscal-year", null),
            ["security"] = new("امنیت داده‌ها", "تنظیمات و سیستم", "/security", null),
            ["data-sync"] = new("همگام‌سازی داده‌ها", "تنظیمات و سیستم", "/data-sync", null),
            ["advanced-settings"] = new("تنظیمات پیشرفته", "تنظیمات و سیستم", "/advanced-settings", null),
            ["settings"] = new("تنظیمات عمومی", "تنظیمات و سیستم", "/settings", null),
            ["help"] = new("آموزش و راهنما", "تنظیمات و سیستم", "/help", null),
            ["updates"] = new("مرکز به‌روزرسانی", "تنظیمات و سیستم", "/updates", null)
        };

    private void NavigateModule_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement source || source.Tag is not string key ||
            !NativeModuleLinks.TryGetValue(key, out var module))
            return;

        UpdateNavigationSelection(key);

        // Resolve controls by name so this handler can be committed before the new XAML shell.
        if (FindName("CurrentModuleText") is TextBlock currentModule)
            currentModule.Text = module.Title + (module.NativeTabIndex.HasValue ? " • نسخهٔ بومی" : " • در حال مهاجرت");

        var tabs = FindName("MainTabs") as TabControl;
        var migrationPanel = FindName("MigrationPanel") as Border;
        if (module.NativeTabIndex is int nativeTabIndex && tabs is not null && migrationPanel is not null)
        {
            migrationPanel.Visibility = Visibility.Collapsed;
            tabs.Visibility = Visibility.Visible;
            tabs.SelectedIndex = nativeTabIndex;
            if (FindName("FooterStatus") is TextBlock footer)
                footer.Text = "بخش بومی فعال: " + module.Title + "؛ دامنهٔ امکانات این صفحه هنوز باید با نسخهٔ اصلی تطبیق داده شود.";
            return;
        }

        if (tabs is not null) tabs.Visibility = Visibility.Collapsed;
        if (migrationPanel is not null) migrationPanel.Visibility = Visibility.Visible;
        if (FindName("MigrationPageTitle") is TextBlock pageTitle) pageTitle.Text = module.Title;
        if (FindName("MigrationPageGroup") is TextBlock pageGroup)
            pageGroup.Text = "گروه: " + module.Group + "   •   مسیر نسخهٔ اصلی: " + module.OriginalRoute;
        if (FindName("MigrationPageState") is TextBlock pageState)
            pageState.Text = "وضعیت: هنوز به‌صورت بومی پیاده‌سازی و با نسخهٔ اصلی آزمون تطبیقی نشده است.";
        if (FindName("FooterStatus") is TextBlock migrationFooter)
            migrationFooter.Text = "این بخش هنوز برای استفادهٔ عملی آماده نیست؛ نسخهٔ فعلی وب/اندروید/الکترون دست‌نخورده باقی می‌ماند.";
    }

    private void UpdateNavigationSelection(string activeKey)
    {
        if (FindName("NavigationRoot") is not DependencyObject root) return;
        var pending = new Stack<DependencyObject>();
        pending.Push(root);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (current is Button button && button.Tag is string key && NativeModuleLinks.ContainsKey(key))
            {
                button.Background = string.Equals(key, activeKey, StringComparison.Ordinal)
                    ? new SolidColorBrush(Color.FromRgb(15, 118, 110))
                    : new SolidColorBrush(Color.FromRgb(23, 32, 51));
                button.Foreground = Brushes.WhiteSmoke;
            }
            if (current is not Visual) continue;
            for (var i = 0; i < VisualTreeHelper.GetChildrenCount(current); i++)
                pending.Push(VisualTreeHelper.GetChild(current, i));
        }
    }

    private void ReturnToDashboard_Click(object sender, RoutedEventArgs e)
    {
        if (FindName("NavigationDashboardButton") is Button dashboardButton)
            NavigateModule_Click(dashboardButton, e);
    }

}
