using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Microsoft.Win32;
using AshkeGhalam.Windows.Dialogs;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows;

public partial class MainWindow : Window
{
    private readonly LocalDataStore _store = new();
    private readonly NativeLicenseStore _licenseStore = new();
    private readonly ServerLicenseClient _licenseClient = new();
    private AccountingData _data = new();
    private VerifiedLicensePayload? _sessionEntitlements;
    private string _sessionLicenseFailure = "";
    private bool _canWrite;
    private bool _uiReady;
    private readonly Dictionary<string, int> _gridPages = new(StringComparer.Ordinal);
    private string _startupAccountingWarning = "";
    private static bool _textBoxSelectAllHandlersRegistered;
    private const string FooterNoteNoReturns = "کالای فروخته‌شده پس گرفته نمی‌شود.";
    private const string FooterNotePaymentTerms = "لطفاً هنگام پرداخت شماره فاکتور را ذکر کنید.";
    private const string FooterNoteDeliveryTerms = "تحویل طبق توافق طرفین انجام می‌شود.";

    public MainWindow()
    {
        InitializeComponent();
        if (!_textBoxSelectAllHandlersRegistered)
        {
            EventManager.RegisterClassHandler(typeof(TextBox), UIElement.GotKeyboardFocusEvent,
                new KeyboardFocusChangedEventHandler(TextBox_GotKeyboardFocus), true);
            EventManager.RegisterClassHandler(typeof(TextBox), UIElement.PreviewMouseLeftButtonDownEvent,
                new MouseButtonEventHandler(TextBox_PreviewMouseLeftButtonDown), true);
            _textBoxSelectAllHandlersRegistered = true;
        }
        _uiReady = true;
        Loaded += MainWindow_Loaded;
        StateChanged += (_, _) => UpdateWindowStateButton();
    }

    private void WindowMinimize_Click(object sender, RoutedEventArgs e) =>
        WindowState = WindowState.Minimized;

    private void WindowMaximize_Click(object sender, RoutedEventArgs e) => ToggleWindowState();

    private void WindowClose_Click(object sender, RoutedEventArgs e) => Close();

    private void ToggleWindowState()
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        UpdateWindowStateButton();
    }

    private void UpdateWindowStateButton()
    {
        if (FindName("WindowMaximizeButton") is Button button)
        {
            button.Content = WindowState == WindowState.Maximized ? "❐" : "□";
            button.ToolTip = WindowState == WindowState.Maximized ? "بازگردانی پنجره" : "تمام‌صفحه";
        }
    }

    private void WindowHeader_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        DependencyObject? current = e.OriginalSource as DependencyObject;
        while (current is not null && !ReferenceEquals(current, WindowHeader))
        {
            if (current is Button) return;
            current = current is Visual ? VisualTreeHelper.GetParent(current) : LogicalTreeHelper.GetParent(current);
        }

        if (e.ClickCount == 2)
        {
            ToggleWindowState();
            e.Handled = true;
            return;
        }

        if (WindowState == WindowState.Normal)
        {
            try { DragMove(); } catch (InvalidOperationException) { }
            e.Handled = true;
        }
    }

    private void ApplicationThemeSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_uiReady || !IsLoaded || ApplicationThemeSelector.SelectedItem is not ComboBoxItem selected)
            return;
        ApplicationThemeService.Apply(this, selected.Tag?.ToString());
    }

    private static void TextBox_GotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (sender is TextBox box && !box.AcceptsReturn)
            box.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(box.SelectAll));
    }

    private static void TextBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (sender is TextBox box && !box.AcceptsReturn && box.IsKeyboardFocusWithin)
        {
            box.SelectAll();
            e.Handled = true;
        }
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var loaded = _store.Load();
            _data = loaded;
            EnsureConfigurationDefaults();
            if (CompanyWorkspaceService.EnsureInitialized(_data))
                _store.Save(_data);

            // Safely reconcile legacy operational records on a clone. If the account chart
            // has a conflict, preserve all loaded business data and report the accounting issue.
            try
            {
                var reconciled = loaded.DeepCopy();
                var oldAccountCount = reconciled.LedgerAccounts.Count;
                var oldJournalCount = reconciled.JournalEntries.Count;
                NativeOperationalPostingService.Reconcile(reconciled);
                if (reconciled.LedgerAccounts.Count != oldAccountCount ||
                    reconciled.JournalEntries.Count != oldJournalCount)
                {
                    AccountingDataValidator.Validate(reconciled);
                    _store.Save(reconciled);
                    _data = reconciled;
                    _startupAccountingWarning = "ثبت خودکار اسناد عملیاتی در دفتر روزنامه تکمیل شد.";
                }
            }
            catch (Exception accountingEx)
            {
                _data = loaded;
                _startupAccountingWarning = "تطبیق حسابداری خودکار انجام نشد: " + accountingEx.Message;
            }

            _canWrite = true;
            StorageStatus.Text = "ذخیره‌سازی محلی آماده";
            FooterStatus.Text = string.IsNullOrWhiteSpace(_startupAccountingWarning)
                ? "ذخیره‌سازی خودکار روی این رایانه فعال است؛ پشتیبان رمزگذاری‌شده تهیه کنید."
                : _startupAccountingWarning;
            RefreshAll();
            RefreshLicensePanel();
            ApplicationThemeService.Apply(this, _data.Preferences.ApplicationTheme);
            _ = RefreshSavedLicenseOnlineAsync();
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
        if (e.OriginalSource != MainTabs) return;
        RefreshAll();
        if (MainTabs.SelectedIndex == 16) RefreshLicensePanel();

        // The selected-content-only TabControl template realizes one page at a time.
        // Reapply the current palette after WPF has created the newly selected page.
        var theme = _data.Preferences?.ApplicationTheme ?? "light";
        ApplicationThemeService.Apply(this, theme);
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (IsLoaded)
                ApplicationThemeService.Apply(this, _data.Preferences?.ApplicationTheme ?? "light");
        }));
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
            var previousCompanyId = _data.ActiveCompanyId;
            mutation(next);
            CompanyWorkspaceService.SwitchIfRequested(next, previousCompanyId, next.ActiveCompanyId);
            NativeOperationalPostingService.Reconcile(next);
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

    private void GridSearch_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (!_uiReady || sender is not FrameworkElement { Tag: string key }) return;
        _gridPages[key] = 1;
        RefreshPagedGrid(key);
    }

    private void GridPageSize_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_uiReady || sender is not FrameworkElement { Tag: string key }) return;
        _gridPages[key] = 1;
        RefreshPagedGrid(key);
    }

    private void GridPreviousPage_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: string key }) return;
        _gridPages[key] = Math.Max(1, _gridPages.GetValueOrDefault(key, 1) - 1);
        RefreshPagedGrid(key);
    }

    private void GridNextPage_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: string key }) return;
        _gridPages[key] = _gridPages.GetValueOrDefault(key, 1) + 1;
        RefreshPagedGrid(key);
    }

    private string GridSearchText(string key) => key switch
    {
        "customers" => CustomersSearchBox.Text,
        "products" => ProductsSearchBox.Text,
        "invoices" => InvoicesSearchBox.Text,
        "payments" => PaymentsSearchBox.Text,
        "expenses" => ExpensesSearchBox.Text,
        _ => ""
    };

    private int GridPageSize(string key)
    {
        var controlName = key switch
        {
            "customers" => "CustomersPageSize",
            "products" => "ProductsPageSize",
            "invoices" => "InvoicesPageSize",
            "payments" => "PaymentsPageSize",
            "expenses" => "ExpensesPageSize",
            _ => ""
        };
        if (FindName(controlName) is ComboBox combo &&
            combo.SelectedItem is ComboBoxItem item &&
            int.TryParse(item.Tag?.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var size) &&
            size is 100 or 250 or 500)
            return size;
        return 100;
    }

    private static bool MatchesSearch(string query, params string?[] values) =>
        string.IsNullOrWhiteSpace(query) ||
        values.Any(value => (value ?? "").Contains(query, StringComparison.CurrentCultureIgnoreCase));

    private void BindPagedGrid<T>(string key, DataGrid grid, List<T> filteredItems)
    {
        var pageSize = GridPageSize(key);
        var pageCount = Math.Max(1, (filteredItems.Count + pageSize - 1) / pageSize);
        var requestedPage = _gridPages.GetValueOrDefault(key, 1);
        var page = Math.Clamp(requestedPage, 1, pageCount);
        _gridPages[key] = page;

        grid.ItemsSource = null;
        grid.ItemsSource = filteredItems.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var stem = key switch
        {
            "customers" => "Customers",
            "products" => "Products",
            "invoices" => "Invoices",
            "payments" => "Payments",
            "expenses" => "Expenses",
            _ => ""
        };
        if (FindName(stem + "PageInfo") is TextBlock info)
            info.Text = $"صفحه {page:N0} از {pageCount:N0}  •  {filteredItems.Count:N0} ردیف";
        if (FindName(stem + "PreviousPage") is Button previous)
            previous.IsEnabled = page > 1;
        if (FindName(stem + "NextPage") is Button next)
            next.IsEnabled = page < pageCount;
    }

    private void RefreshPagedGrid(string key)
    {
        var query = GridSearchText(key).Trim();
        switch (key)
        {
            case "customers":
                BindPagedGrid(key, CustomersGrid, _data.Customers
                    .Where(c => MatchesSearch(query, c.Code, c.Name, c.Type, c.Category, c.Phone,
                        c.Email, c.NationalId, c.Address, c.Notes))
                    .OrderBy(c => c.Name).ToList());
                break;
            case "products":
                BindPagedGrid(key, ProductsGrid, _data.Products
                    .Where(p => MatchesSearch(query, p.Name, p.Code, p.Barcode, p.SerialNumber, p.Unit,
                        p.CategoryPath, p.ShelfLocation, p.Description, p.ImageUrl))
                    .OrderBy(p => p.Name).ToList());
                break;
            case "invoices":
                BindPagedGrid(key, InvoicesGrid, _data.Invoices
                    .Where(i => MatchesSearch(query, i.DisplayNumber, i.Number.ToString(CultureInfo.InvariantCulture),
                        i.TrackingCode, i.CustomerName, i.Description, i.Status, i.TypeLabel))
                    .OrderByDescending(i => i.Number).ToList());
                break;
            case "payments":
                BindPagedGrid(key, PaymentsGrid, _data.Payments
                    .Where(p => MatchesSearch(query, p.InvoiceNumber.ToString(CultureInfo.InvariantCulture),
                        p.CustomerName, p.Method, p.Reference, p.Amount.ToString(CultureInfo.CurrentCulture)))
                    .OrderByDescending(p => p.CreatedAt).ToList());
                break;
            case "expenses":
                BindPagedGrid(key, ExpensesGrid, _data.Expenses
                    .Where(expense => MatchesSearch(query, expense.Title, expense.Category, expense.Notes,
                        expense.Amount.ToString(CultureInfo.CurrentCulture)))
                    .OrderByDescending(expense => expense.CreatedAt).ToList());
                break;
        }
    }

    private void RefreshAll()
    {
        RefreshPagedGrid("customers");
        RefreshPagedGrid("products");
        RefreshPagedGrid("invoices");
        RefreshPagedGrid("payments");
        RefreshPagedGrid("expenses");
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

        var activeInvoices = _data.Invoices.Where(i => i.Status != "لغو شده").ToList();
        var salesInvoices = activeInvoices.Where(i => i.Type == "SALE").ToList();
        var purchaseInvoices = activeInvoices.Where(i => i.Type == "PURCHASE").ToList();
        var salesIds = salesInvoices.Select(i => i.Id).ToHashSet(StringComparer.Ordinal);
        var purchaseIds = purchaseInvoices.Select(i => i.Id).ToHashSet(StringComparer.Ordinal);
        var sales = salesInvoices.Sum(i => i.Total);
        var purchases = purchaseInvoices.Sum(i => i.Total);
        var paid = _data.Payments.Sum(p => p.Amount);
        var salesReceipts = _data.Payments.Where(p => salesIds.Contains(p.InvoiceId)).Sum(p => p.Amount);
        var purchasePayments = _data.Payments.Where(p => purchaseIds.Contains(p.InvoiceId)).Sum(p => p.Amount);
        var receivables = salesInvoices.Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var payables = purchaseInvoices.Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var expenses = _data.Expenses.Sum(x => x.Amount);
        CustomerCount.Text = _data.Customers.Count.ToString("N0", CultureInfo.CurrentCulture);
        ProductCount.Text = _data.Products.Count.ToString("N0", CultureInfo.CurrentCulture);
        InvoiceCount.Text = _data.Invoices.Count(i => i.Status != "لغو شده").ToString("N0", CultureInfo.CurrentCulture);
        SalesTotal.Text = sales.ToString("N2", CultureInfo.CurrentCulture);
        PurchasesTotal.Text = purchases.ToString("N2", CultureInfo.CurrentCulture);
        PaymentsTotal.Text = paid.ToString("N2", CultureInfo.CurrentCulture);
        ReceivablesTotal.Text = receivables.ToString("N2", CultureInfo.CurrentCulture);
        PayablesTotal.Text = payables.ToString("N2", CultureInfo.CurrentCulture);
        ExpensesTotal.Text = expenses.ToString("N2", CultureInfo.CurrentCulture);
        ReportSales.Text = sales.ToString("N2", CultureInfo.CurrentCulture);
        ReportPurchases.Text = purchases.ToString("N2", CultureInfo.CurrentCulture);
        ReportPayments.Text = paid.ToString("N2", CultureInfo.CurrentCulture);
        ReportReceivables.Text = receivables.ToString("N2", CultureInfo.CurrentCulture);
        ReportPayables.Text = payables.ToString("N2", CultureInfo.CurrentCulture);
        ReportExpenses.Text = expenses.ToString("N2", CultureInfo.CurrentCulture);
        ReportCash.Text = (salesReceipts - purchasePayments - expenses).ToString("N2", CultureInfo.CurrentCulture);
        RefreshLedger();
        RefreshFinancialReports();
        RefreshDueCalendar();
        RefreshCashFlowForecast();
        RefreshAccountingConfigurationPanels();
        RefreshKardexModule();
    }

    private void RefreshLedger()
    {
        var accountById = _data.LedgerAccounts.ToDictionary(a => a.Id, a => a);
        LedgerAccountsGrid.ItemsSource = null;
        LedgerAccountsGrid.ItemsSource = _data.LedgerAccounts
            .OrderBy(a => a.Code, StringComparer.OrdinalIgnoreCase)
            .Select(a => new LedgerAccountGridRow(
                a.Id, a.Code, a.Name, AccountTypeLabel(a.Type), AccountLevelLabel(a.Level),
                string.IsNullOrWhiteSpace(a.ParentId) ? "—" :
                    accountById.TryGetValue(a.ParentId, out var parent) ? $"{parent.Code} — {parent.Name}" : "والد نامشخص",
                a.IsActive))
            .ToList();

        LedgerEntriesGrid.ItemsSource = null;
        LedgerEntriesGrid.ItemsSource = _data.JournalEntries
            .OrderByDescending(j => j.Number)
            .Select(j => new JournalEntryGridRow(
                j.Number.ToString("D4", CultureInfo.InvariantCulture), j.Date, j.Description,
                accountById.TryGetValue(j.DebitAccountId, out var debit) ? $"{debit.Code} — {debit.Name}" : "حساب حذف‌شده",
                accountById.TryGetValue(j.CreditAccountId, out var credit) ? $"{credit.Code} — {credit.Name}" : "حساب حذف‌شده",
                j.Amount, DocumentTypeLabel(j.DocumentType), JournalStatusLabel(j.Status)))
            .ToList();

        TrialBalanceGrid.ItemsSource = null;
        TrialBalanceGrid.ItemsSource = NativeLedgerService.GetTrialBalance(_data)
            .Select(line => new TrialBalanceGridRow(
                line.Code, line.Name, AccountTypeLabel(line.Type), line.Debit, line.Credit, line.Balance))
            .ToList();

        var posted = _data.JournalEntries.Where(j => j.Status is "POSTED" or "APPROVED").ToList();
        var totalDebit = posted.Sum(j => j.Amount);
        var totalCredit = posted.Sum(j => j.Amount);
        LedgerSummary.Text =
            $"سرفصل‌ها: {_data.LedgerAccounts.Count:N0}  •  اسناد قطعی: {posted.Count:N0}  •  " +
            $"جمع بدهکار: {totalDebit:N2}  •  جمع بستانکار: {totalCredit:N2}";
    }

    private void SeedLedgerAccounts_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (_data.LedgerAccounts.Count > 0)
        {
            MessageBox.Show(this, "در حال حاضر سرفصل حساب وجود دارد؛ عملیات ایجاد سرفصل پایه فقط برای دفتر خالی مجاز است.",
                "کدینگ حساب‌ها", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        if (MessageBox.Show(this, "۱۶ سرفصل اصلی پیشنهادی ایجاد شود؟ این عملیات فقط کدینگ حساب‌های محلی را اضافه می‌کند و از نسخهٔ اصلی واردات انجام نمی‌دهد.",
            "ایجاد کدینگ پایه", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
            return;
        Commit(NativeLedgerService.SeedDefaultChart, "سرفصل‌های پایه ایجاد شد");
    }

    private void AddLedgerAccount_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var dialog = new LedgerAccountDialog(this, _data.LedgerAccounts);
        if (dialog.ShowDialog() != true || dialog.Result is not ChartOfAccountRecord draft) return;
        Commit(data => NativeLedgerService.AddAccount(
            data, draft.Code, draft.Name, draft.Type, draft.Level, draft.ParentId), "سرفصل حساب اضافه شد");
    }

    private void AddJournalEntry_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
        var activeAccounts = _data.LedgerAccounts.Where(a => a.IsActive).ToList();
        if (activeAccounts.Count < 2)
        {
            MessageBox.Show(this, "ابتدا حداقل دو حساب فعال داشته باشید. می‌توانید از «ایجاد سرفصل‌های پایه» شروع کنید.",
                "کدینگ حساب‌ها ناقص است", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var dialog = new JournalEntryDialog(this, activeAccounts);
        if (dialog.ShowDialog() != true || dialog.Result is not AccountingEntryRecord draft) return;
        Commit(data => { NativeLedgerService.PostEntry(data, draft); },
            "سند حسابداری ثبت قطعی شد");
    }

    private void ExportJournalEntries_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("journal-entries.csv",
            new[] { "DocumentNumber", "Date", "Description", "DebitAccountCode", "DebitAccountName",
                "CreditAccountCode", "CreditAccountName", "Amount", "DocumentType", "FiscalYear", "Status",
                "ReferenceType", "ReferenceId", "CreatedAt" },
            _data.JournalEntries.OrderBy(j => j.Number).Select(j =>
            {
                var debit = _data.LedgerAccounts.SingleOrDefault(a => a.Id == j.DebitAccountId);
                var credit = _data.LedgerAccounts.SingleOrDefault(a => a.Id == j.CreditAccountId);
                return new[]
                {
                    j.Number.ToString(CultureInfo.InvariantCulture), j.Date, j.Description,
                    debit?.Code ?? "", debit?.Name ?? "", credit?.Code ?? "", credit?.Name ?? "",
                    j.Amount.ToString(CultureInfo.InvariantCulture), j.DocumentType, j.FiscalYear, j.Status,
                    j.ReferenceType, j.ReferenceId, j.CreatedAt.ToString("O", CultureInfo.InvariantCulture)
                };
            }));

    private void ExportTrialBalance_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("trial-balance.csv",
            new[] { "AccountCode", "AccountName", "AccountType", "Debit", "Credit", "DebitMinusCredit" },
            NativeLedgerService.GetTrialBalance(_data).Select(line => new[]
            {
                line.Code, line.Name, line.Type,
                line.Debit.ToString(CultureInfo.InvariantCulture),
                line.Credit.ToString(CultureInfo.InvariantCulture),
                line.Balance.ToString(CultureInfo.InvariantCulture)
            }));

    private void RefreshFinancialReports_Click(object sender, RoutedEventArgs e) =>
        RefreshFinancialReports();

    private void RefreshFinancialReports()
    {
        var report = FinancialReportsService.Build(_data);
        static string Money(decimal value) => value.ToString("N2", CultureInfo.CurrentCulture);

        FinancialRevenue.Text = Money(report.Revenue);
        FinancialCostOfSales.Text = Money(report.CostOfSales);
        FinancialGrossProfit.Text = Money(report.GrossProfit);
        FinancialOperatingExpenses.Text = Money(report.OperatingExpenses);
        FinancialNetProfit.Text = Money(report.NetProfit);
        FinancialAssets.Text = Money(report.Assets);
        FinancialLiabilities.Text = Money(report.Liabilities);
        FinancialEquity.Text = Money(report.Equity);
        FinancialCashInflows.Text = Money(report.CashInflows);
        FinancialCashOutflows.Text = Money(report.CashOutflows);
        FinancialNetCashChange.Text = Money(report.NetCashChange);
        FinancialCashBalance.Text = Money(report.CashBalance);
        FinancialBalanceIntegrity.Text = Math.Abs(report.BalanceSheetDifference) < 0.01m
            ? "کنترل تراز حسابداری برقرار است؛ اختلاف دارایی با بدهی + حقوق مالکانه + سود/زیان دوره: ۰"
            : $"هشدار کنترل تراز: اختلاف دارایی با بدهی + حقوق مالکانه + سود/زیان برابر {Money(report.BalanceSheetDifference)} است. کدینگ و اسناد دفتر روزنامه را بررسی کنید.";

        FinancialAccountsGrid.ItemsSource = null;
        FinancialAccountsGrid.ItemsSource = report.Accounts
            .Select(line => new TrialBalanceGridRow(
                line.Code, line.Name, AccountTypeLabel(line.Type), line.Debit, line.Credit, line.Balance))
            .ToList();
    }

    private void RefreshDueCalendar_Click(object sender, RoutedEventArgs e) =>
        RefreshDueCalendar();

    private void RefreshDueCalendar()
    {
        var items = DueCalendarService.GetItems(_data);
        var rows = items.Select(item => new DueCalendarGridRow(
            FormatPersianDate(item.DueDate),
            item.Kind,
            item.DocumentNumber,
            item.Contact,
            item.Amount,
            item.Status,
            item.DaysFromDue < 0
                ? $"{-item.DaysFromDue:N0} روز معوق"
                : item.DaysFromDue == 0 ? "امروز" : $"{item.DaysFromDue:N0} روز مانده",
            item.DaysFromDue < 0 ? "معوق"
                : item.DaysFromDue == 0 ? "امروز"
                : item.DaysFromDue <= 3 ? "فوری"
                : item.DaysFromDue <= 7 ? "نزدیک" : "آینده"))
            .ToList();

        DueCalendarGrid.ItemsSource = null;
        DueCalendarGrid.ItemsSource = rows;
        var overdue = items.Where(item => item.DaysFromDue < 0).ToList();
        DueCalendarSummary.Text =
            $"تعداد تعهدها: {items.Count:N0}  •  موارد معوق: {overdue.Count:N0}  •  " +
            $"مبلغ معوق: {overdue.Sum(item => item.Amount).ToString("N2", CultureInfo.CurrentCulture)}";
    }

    private void RefreshCashFlowForecast_Click(object sender, RoutedEventArgs e) =>
        RefreshCashFlowForecast();

    private int SelectedCashFlowHorizonDays()
    {
        if (CashFlowHorizonCombo.SelectedItem is ComboBoxItem item &&
            int.TryParse(item.Tag?.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var days) &&
            days is 30 or 60 or 90)
            return days;
        return 30;
    }

    private void RefreshCashFlowForecast()
    {
        var forecast = CashFlowForecastService.Build(_data, SelectedCashFlowHorizonDays());
        static string Money(decimal value) => value.ToString("N2", CultureInfo.CurrentCulture);

        CashFlowOpeningBalance.Text = Money(forecast.OpeningBalance);
        CashFlowExpectedInflows.Text = Money(forecast.TotalExpectedInflows);
        CashFlowExpectedOutflows.Text = Money(forecast.TotalExpectedOutflows);
        CashFlowProjectedClosingBalance.Text = Money(forecast.ProjectedClosingBalance);
        CashFlowProjectedClosingBalance.Foreground = forecast.ProjectedClosingBalance < 0m
            ? new SolidColorBrush(Color.FromRgb(185, 28, 28))
            : new SolidColorBrush(Color.FromRgb(15, 118, 110));

        var overdueCount = forecast.Movements.Count(movement => movement.IsOverdue);
        CashFlowStatusSummary.Text =
            $"افق {forecast.HorizonDays:N0} روزه • تعهدهای لحاظ‌شده: {forecast.Movements.Count:N0} • " +
            $"سررسیدگذشته: {overdueCount:N0} • " +
            (forecast.ProjectedClosingBalance < 0m ? "هشدار: احتمال کسری وجه" : "مانده پیش‌بینی‌شده مثبت است");

        CashFlowProjectionGrid.ItemsSource = null;
        CashFlowProjectionGrid.ItemsSource = forecast.Projection.Select(line =>
            new CashFlowProjectionGridRow(
                FormatPersianDate(line.Date),
                line.ExpectedInflows,
                line.ExpectedOutflows,
                line.NetChange,
                line.ProjectedBalance,
                line.MovementCount,
                line.OverdueCount)).ToList();

        CashFlowMovementsGrid.ItemsSource = null;
        CashFlowMovementsGrid.ItemsSource = forecast.Movements.Select(movement =>
            new CashFlowMovementGridRow(
                FormatPersianDate(movement.Date),
                movement.Direction,
                movement.Kind,
                movement.DocumentNumber,
                movement.Counterparty,
                movement.Amount,
                movement.Status,
                movement.IsOverdue
                    ? $"{-movement.DaysFromDue:N0} روز معوق"
                    : movement.DaysFromDue == 0
                        ? "امروز"
                        : $"{movement.DaysFromDue:N0} روز مانده",
                movement.ReferenceType,
                movement.ReferenceId)).ToList();
    }

    private void ExportCashFlowForecast_Click(object sender, RoutedEventArgs e)
    {
        var forecast = CashFlowForecastService.Build(_data, SelectedCashFlowHorizonDays());
        var rows = new List<string[]>
        {
            new[]
            {
                "SUMMARY", "", "", "", "", "",
                forecast.OpeningBalance.ToString(CultureInfo.InvariantCulture),
                forecast.TotalExpectedInflows.ToString(CultureInfo.InvariantCulture),
                forecast.TotalExpectedOutflows.ToString(CultureInfo.InvariantCulture),
                forecast.ProjectedClosingBalance.ToString(CultureInfo.InvariantCulture),
                forecast.HorizonDays.ToString(CultureInfo.InvariantCulture), "", "", "", ""
            }
        };

        rows.AddRange(forecast.Projection.Select(line => new[]
        {
            "DAILY", FormatPersianDate(line.Date), "", "", "", "",
            "", line.ExpectedInflows.ToString(CultureInfo.InvariantCulture),
            line.ExpectedOutflows.ToString(CultureInfo.InvariantCulture),
            line.ProjectedBalance.ToString(CultureInfo.InvariantCulture),
            line.MovementCount.ToString(CultureInfo.InvariantCulture),
            line.OverdueCount.ToString(CultureInfo.InvariantCulture), "", "", ""
        }));

        rows.AddRange(forecast.Movements.Select(movement => new[]
        {
            "MOVEMENT", FormatPersianDate(movement.Date), movement.Direction, movement.Kind,
            movement.DocumentNumber, movement.Counterparty, movement.Amount.ToString(CultureInfo.InvariantCulture),
            "", "", "", "", movement.IsOverdue ? "OVERDUE" : movement.Status,
            movement.DaysFromDue.ToString(CultureInfo.InvariantCulture),
            movement.ReferenceType, movement.ReferenceId
        }));

        ExportCsv("cashflow-forecast.csv",
            new[] { "RowType", "Date", "Direction", "Kind", "DocumentNumber", "Counterparty",
                "Amount", "ExpectedInflows", "ExpectedOutflows", "ProjectedBalance", "MovementCount",
                "OverdueCountOrStatus", "DaysFromDue", "ReferenceType", "ReferenceId" },
            rows);
    }

    private void ExportDueCalendar_Click(object sender, RoutedEventArgs e)
    {
        var items = DueCalendarService.GetItems(_data);
        ExportCsv("due-calendar.csv",
            new[] { "DueDate", "Kind", "DocumentNumber", "Contact", "Amount", "Status", "DaysFromDue", "ReferenceType", "ReferenceId" },
            items.Select(item => new[]
            {
                FormatPersianDate(item.DueDate),
                item.Kind,
                item.DocumentNumber,
                item.Contact,
                item.Amount.ToString(CultureInfo.InvariantCulture),
                item.Status,
                item.DaysFromDue.ToString(CultureInfo.InvariantCulture),
                item.ReferenceType,
                item.ReferenceId
            }));
    }

    private void ExportFinancialReports_Click(object sender, RoutedEventArgs e)
    {
        var report = FinancialReportsService.Build(_data);
        var summaryRows = new (string Label, decimal Value)[]
        {
            ("درآمد کل", report.Revenue),
            ("بهای تمام‌شده", report.CostOfSales),
            ("سود ناخالص", report.GrossProfit),
            ("هزینه‌های عملیاتی", report.OperatingExpenses),
            ("سود/زیان خالص", report.NetProfit),
            ("دارایی‌ها", report.Assets),
            ("بدهی‌ها", report.Liabilities),
            ("حقوق مالکانه", report.Equity),
            ("ورودی نقد و بانک", report.CashInflows),
            ("خروجی نقد و بانک", report.CashOutflows),
            ("تغییر خالص نقد", report.NetCashChange),
            ("مانده نقد و بانک", report.CashBalance),
            ("اختلاف کنترل تراز", report.BalanceSheetDifference)
        }.Select(item => new[]
        {
            "SUMMARY", "", item.Label, "", "", "", item.Value.ToString(CultureInfo.InvariantCulture)
        });

        var accountRows = report.Accounts.Select(account => new[]
        {
            "ACCOUNT", account.Code, account.Name, account.Type,
            account.Debit.ToString(CultureInfo.InvariantCulture),
            account.Credit.ToString(CultureInfo.InvariantCulture),
            account.Balance.ToString(CultureInfo.InvariantCulture)
        });

        ExportCsv("advanced-financial-report.csv",
            new[] { "RowType", "AccountCode", "AccountNameOrMetric", "AccountType", "Debit", "Credit", "BalanceOrValue" },
            summaryRows.Concat(accountRows));
    }

    private static string AccountTypeLabel(string type) => type switch
    {
        "ASSET" => "دارایی", "LIABILITY" => "بدهی", "EQUITY" => "حقوق مالکانه",
        "REVENUE" => "درآمد", "EXPENSE" => "هزینه", _ => type
    };

    private static string AccountLevelLabel(string level) => level switch
    {
        "MAIN" => "کل / اصلی", "SUB" => "معین", "DETAIL" => "تفصیلی", _ => level
    };

    private static string DocumentTypeLabel(string type) => type switch
    {
        "OPERATIONAL" => "عملیاتی", "OPENING" => "افتتاحیه", "CLOSING" => "اختتامیه",
        "ADJUSTMENT" => "اصلاحی", _ => type
    };

    private static string JournalStatusLabel(string status) => status switch
    {
        "DRAFT" => "پیش‌نویس", "APPROVED" => "تأییدشده", "POSTED" => "ثبت قطعی", _ => status
    };

    private sealed record LedgerAccountGridRow(
        string Id, string Code, string Name, string TypeLabel, string LevelLabel, string ParentName, bool IsActive);

    private sealed record JournalEntryGridRow(
        string DisplayNumber, string Date, string Description, string DebitAccount, string CreditAccount,
        decimal Amount, string DocumentTypeLabel, string StatusLabel);

    private sealed record CashFlowProjectionGridRow(
        string Date, decimal Inflows, decimal Outflows, decimal NetChange,
        decimal ProjectedBalance, int MovementCount, int OverdueCount);

    private sealed record CashFlowMovementGridRow(
        string Date, string Direction, string Kind, string DocumentNumber, string Counterparty,
        decimal Amount, string Status, string DueStatus, string ReferenceType, string ReferenceId);

    private sealed record DueCalendarGridRow(
        string DueDate, string Kind, string DocumentNumber, string Contact,
        decimal Amount, string Status, string Days, string Priority);

    private sealed record TrialBalanceGridRow(
        string Code, string Name, string TypeLabel, decimal Debit, decimal Credit, decimal Balance);

    private void RefreshLicensePanel()
    {
        try
        {
            LicenseHardwareId.Text = HardwareIdentityService.GetHardwareId();
        }
        catch
        {
            LicenseHardwareId.Text = "";
            LicenseStatusText.Text = "شناسه دستگاه خوانده نشد؛ برای حفظ امنیت، وضعیت مجوز نامشخص است.";
            LicensePlanText.Text = "طرح: —";
            LicenseQuotaText.Text = "سهمیه: —";
            LicenseFeaturesText.Text = "امکانات: —";
            return;
        }

        try
        {
            var state = _licenseStore.Load();
            if (state is null)
            {
                LicenseStatusText.Text = "هیچ رسید لایسنس در این حساب ویندوز ذخیره نشده است. برای فعال‌سازی، اتصال آنلاین لازم است.";
                LicensePlanText.Text = "طرح: —";
                LicenseQuotaText.Text = "سهمیه: —";
                LicenseFeaturesText.Text = "امکانات: —";
                return;
            }

            if (!string.Equals(state.HardwareId, LicenseHardwareId.Text, StringComparison.OrdinalIgnoreCase))
            {
                LicenseStatusText.Text = "رسید ذخیره‌شده متعلق به شناسه دستگاه دیگری است. مجوز این دستگاه تأیید نشده است.";
                LicensePlanText.Text = "طرح: —";
                LicenseQuotaText.Text = "سهمیه: —";
                LicenseFeaturesText.Text = "امکانات: —";
                return;
            }

            var sessionPayload = _sessionEntitlements;
            if (sessionPayload is not null && sessionPayload.ExpiresAt <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            {
                _sessionEntitlements = null;
                sessionPayload = null;
                _sessionLicenseFailure = "رسید لایسنس منقضی شده است؛ بررسی آنلاین مجدد لازم است.";
            }

            if (sessionPayload is not null)
            {
                LicenseStatusText.Text =
                    $"تأیید آنلاین در همین نشست موفق است؛ زمان تأیید: {state.VerifiedAtUtc.ToLocalTime():yyyy/MM/dd HH:mm}. " +
                    "سقف‌های فعلی برای عملیات ثبت جدید اعمال می‌شوند.";
            }
            else
            {
                LicenseStatusText.Text =
                    $"رسید ذخیره‌شدهٔ قبلی: {state.VerifiedAtUtc.ToLocalTime():yyyy/MM/dd HH:mm}. این رسید در نشست فعلی فعال نیست." +
                    (string.IsNullOrWhiteSpace(_sessionLicenseFailure) ? " برای فعال‌سازی مجدد، بررسی آنلاین انجام دهید." : " " + _sessionLicenseFailure);
            }

            var displayedPayload = sessionPayload ?? state.Payload;
            var companyName = string.IsNullOrWhiteSpace(state.CompanyName)
                ? (displayedPayload.CompanyName ?? "ثبت نشده") : state.CompanyName;
            LicensePlanText.Text =
                $"{(sessionPayload is null ? "آخرین طرح ذخیره‌شده (غیرفعال)" : "طرح تأییدشده در این نشست")}: {displayedPayload.Plan}  •  شرکت: {companyName}  •  انقضا: {(displayedPayload.IsUnlimited ? "نامحدود" : displayedPayload.ExpireDate)}";
            var limits = NativeLicenseQuotaService.GetLimits(sessionPayload);
            LicenseQuotaText.Text =
                $"سقف فعلی عملیات ثبت جدید — مشتریان: {QuotaLabel(limits.MaxCustomers)}  •  اسناد: {QuotaLabel(limits.MaxDocuments)}  •  کاربران: {QuotaLabel(displayedPayload.MaxUsers)}";
            LicenseFeaturesText.Text =
                "امکانات درج‌شده در رسید: " +
                (displayedPayload.Features.Count == 0 ? "در رسید ذکر نشده" : string.Join("، ", displayedPayload.Features.Take(30))) +
                (displayedPayload.Features.Count > 30 ? "، ..." : "");
        }
        catch (Exception)
        {
            LicenseStatusText.Text = "فایل وضعیت لایسنس محلی قابل رمزگشایی یا اعتبارسنجی نیست. هیچ مجوزی فعال فرض نمی‌شود؛ اتصال آنلاین را دوباره انجام دهید.";
            LicensePlanText.Text = "طرح: —";
            LicenseQuotaText.Text = "سهمیه: —";
            LicenseFeaturesText.Text = "امکانات: —";
        }
    }

    private static string QuotaLabel(int limit) => limit switch
    {
        -1 => "نامحدود",
        >= 0 => limit.ToString("N0", CultureInfo.CurrentCulture),
        _ => "نامعتبر"
    };

    private void CopyHardwareId_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(LicenseHardwareId.Text))
                throw new InvalidOperationException("شناسه دستگاه آماده نیست.");
            Clipboard.SetText(LicenseHardwareId.Text);
            FooterStatus.Text = "شناسه سخت‌افزاری این رایانه کپی شد.";
        }
        catch
        {
            MessageBox.Show(this, "شناسه دستگاه قابل کپی نیست.", "شناسه دستگاه", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void VerifyLicense_Click(object sender, RoutedEventArgs e)
    {
        NativeLicenseState? existing = null;
        try { existing = _licenseStore.Load(); }
        catch (Exception)
        {
            if (MessageBox.Show(this,
                    "فایل لایسنس قبلی خوانده نشد. می‌توانید دوباره با سرور تأیید کنید؛ پس از تأیید موفق، فایل رمزگذاری‌شده جایگزین می‌شود. ادامه می‌دهید؟",
                    "وضعیت لایسنس محلی", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
                return;
        }

        LicenseActivationDialog dialog;
        try { dialog = new LicenseActivationDialog(this, existing); }
        catch (Exception ex)
        {
            MessageBox.Show(this, "پنجره فعال‌سازی باز نشد. " + ex.Message, "فعال‌سازی لایسنس", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        if (dialog.ShowDialog() != true || dialog.VerifiedState is not NativeLicenseState verified)
            return;

        try
        {
            _licenseStore.Save(verified);
            _sessionEntitlements = verified.Payload;
            _sessionLicenseFailure = "";
            RefreshLicensePanel();
            FooterStatus.Text = "رسید امضاشدهٔ لایسنس پس از تأیید آنلاین، رمزگذاری و ذخیره شد. اعمال سهمیه در همهٔ ماژول‌ها هنوز کامل نیست.";
            MessageBox.Show(this,
                "رسید لایسنس با سرور و امضای RSA-SHA256 تأیید و برای حساب جاری ویندوز ذخیره شد. این تغییر هنوز به معنی اعمال کامل سقف‌ها و مجوزهای لایسنس در تمام ماژول‌های نسخهٔ بومی نیست.",
                "تأیید سرور انجام شد", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "لایسنس آنلاین تأیید شد اما ذخیره امن وضعیت آن انجام نشد. دوباره تلاش کنید. " + ex.Message,
                "خطا در ذخیره امن", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async Task RefreshSavedLicenseOnlineAsync()
    {
        NativeLicenseState? saved;
        try { saved = _licenseStore.Load(); }
        catch
        {
            _sessionEntitlements = null;
            _sessionLicenseFailure = "فایل لایسنس محلی قابل خواندن نیست؛ نسخهٔ پایه با سقف محدود باقی می‌ماند.";
            RefreshLicensePanel();
            return;
        }
        if (saved is null) return;

        try
        {
            var currentHardwareId = HardwareIdentityService.GetHardwareId();
            if (!string.Equals(saved.HardwareId, currentHardwareId, StringComparison.OrdinalIgnoreCase))
            {
                _sessionEntitlements = null;
                _sessionLicenseFailure = "لایسنس ذخیره‌شده به شناسه دستگاه دیگری متصل است؛ بررسی آنلاین این دستگاه لازم است.";
                RefreshLicensePanel();
                return;
            }

            // Do not trust a DPAPI-protected cached receipt as proof of current server status.
            // Re-check the fixed server asynchronously after the window appears, without blocking UI.
            var result = await _licenseClient.VerifyAsync(saved.LicenseKey, saved.WorkspaceId, currentHardwareId);
            if (!result.Success || result.License is null)
            {
                _sessionEntitlements = null;
                _sessionLicenseFailure = result.Message + " نسخهٔ پایه با سقف محدود فعال می‌ماند.";
                RefreshLicensePanel();
                return;
            }

            var current = result.License;
            var refreshed = new NativeLicenseState
            {
                LicenseKey = saved.LicenseKey,
                WorkspaceId = saved.WorkspaceId,
                HardwareId = currentHardwareId,
                CompanyName = string.IsNullOrWhiteSpace(saved.CompanyName)
                    ? current.Payload.CompanyName ?? ""
                    : saved.CompanyName,
                Payload = current.Payload,
                Receipt = current.Receipt,
                VerifiedAtUtc = DateTimeOffset.UtcNow
            };
            _licenseStore.Save(refreshed);
            _sessionEntitlements = current.Payload;
            _sessionLicenseFailure = "";
            RefreshLicensePanel();
            FooterStatus.Text = "لایسنس در این نشست مجدداً توسط سرور تأیید شد.";
        }
        catch
        {
            _sessionEntitlements = null;
            _sessionLicenseFailure = "بررسی مجدد سرور انجام نشد؛ نسخهٔ پایه با سقف محدود فعال می‌ماند.";
            RefreshLicensePanel();
        }
    }

    private bool ConfirmCanAddCustomer()
    {
        var decision = NativeLicenseQuotaService.CanAddCustomer(_data, GetLiveSessionEntitlements());
        if (decision.Allowed) return true;
        MessageBox.Show(this, decision.Message, "سقف استفاده از نسخه", MessageBoxButton.OK, MessageBoxImage.Information);
        return false;
    }

    private bool ConfirmCanAddDocument()
    {
        var decision = NativeLicenseQuotaService.CanAddDocument(_data, GetLiveSessionEntitlements());
        if (decision.Allowed) return true;
        MessageBox.Show(this, decision.Message, "سقف استفاده از نسخه", MessageBoxButton.OK, MessageBoxImage.Information);
        return false;
    }

    private VerifiedLicensePayload? GetLiveSessionEntitlements()
    {
        if (_sessionEntitlements is null)
            return null;
        if (_sessionEntitlements.ExpiresAt <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
        {
            _sessionEntitlements = null;
            _sessionLicenseFailure = "رسید لایسنس منقضی شده است؛ برای ادامه لایسنس را آنلاین بررسی کنید.";
            RefreshLicensePanel();
            return null;
        }
        return _sessionEntitlements;
    }

    private static string NextCode(IEnumerable<string> existingCodes, string prefix)
    {
        var used = existingCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var max = 0;
        foreach (var code in used)
        {
            if (!code.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                continue;
            var suffix = code[prefix.Length..];
            if (int.TryParse(suffix, NumberStyles.None, CultureInfo.InvariantCulture, out var number))
                max = Math.Max(max, number);
        }

        var candidateNumber = checked(max + 1);
        while (used.Contains(prefix + candidateNumber.ToString("D5", CultureInfo.InvariantCulture)))
            candidateNumber = checked(candidateNumber + 1);

        return prefix + candidateNumber.ToString("D5", CultureInfo.InvariantCulture);
    }

    private CustomerRecord? AddCustomerInline(Window dialogOwner)
    {
        if (!_canWrite)
        {
            MessageBox.Show(dialogOwner, "ذخیره‌سازی محلی آماده نیست؛ ابتدا از یک فایل پشتیبان معتبر بازیابی کنید.",
                "ذخیره‌سازی غیرفعال", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }

        var decision = NativeLicenseQuotaService.CanAddCustomer(_data, GetLiveSessionEntitlements());
        if (!decision.Allowed)
        {
            MessageBox.Show(dialogOwner, decision.Message, "سقف استفاده از نسخه", MessageBoxButton.OK, MessageBoxImage.Information);
            return null;
        }

        var suggestedCode = NextCode(_data.Customers.Select(person => person.Code), "CUS-");
        var dialog = new CustomerDialog(dialogOwner, suggestedCode: suggestedCode);
        if (dialog.ShowDialog() != true || dialog.Result is not CustomerRecord customer)
            return null;

        try
        {
            var next = _data.DeepCopy();
            if (!string.IsNullOrWhiteSpace(customer.Code) &&
                next.Customers.Any(person => string.Equals(person.Code, customer.Code, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("کد شخص تکراری است.");
            next.Customers.Add(customer);
            NativeOperationalPostingService.Reconcile(next);
            AccountingDataValidator.Validate(next);
            _store.Save(next);
            _data = next;
            RefreshAll();
            FooterStatus.Text = "پرونده شخص از داخل فرم فاکتور ذخیره شد • " + DateTime.Now.ToString("HH:mm:ss");
            return customer;
        }
        catch (Exception ex)
        {
            MessageBox.Show(dialogOwner, ex.Message, "ذخیره شخص انجام نشد", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }
    }

    private ProductRecord? AddProductInline(Window dialogOwner)
    {
        if (!_canWrite)
        {
            MessageBox.Show(dialogOwner, "ذخیره‌سازی محلی آماده نیست؛ ابتدا از یک فایل پشتیبان معتبر بازیابی کنید.",
                "ذخیره‌سازی غیرفعال", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }

        var suggestedCode = NextCode(_data.Products.Select(product => product.Code), "SKU-");
        var dialog = new ProductDialog(dialogOwner, suggestedCode: suggestedCode);
        if (dialog.ShowDialog() != true || dialog.Result is not ProductRecord product)
            return null;

        try
        {
            var next = _data.DeepCopy();
            if (!string.IsNullOrWhiteSpace(product.Sku) &&
                next.Products.Any(item => string.Equals(item.Sku, product.Sku, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("کد کالای تکراری مجاز نیست.");
            next.Products.Add(product);
            NativeOperationalPostingService.Reconcile(next);
            AccountingDataValidator.Validate(next);
            _store.Save(next);
            _data = next;
            RefreshAll();
            FooterStatus.Text = "کالا از داخل فرم فاکتور ذخیره شد • " + DateTime.Now.ToString("HH:mm:ss");
            return product;
        }
        catch (Exception ex)
        {
            MessageBox.Show(dialogOwner, ex.Message, "ذخیره کالا انجام نشد", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }
    }

    private void AddCustomer_Click(object sender, RoutedEventArgs e) => AddPersonQuick(defaultSupplier: false);

    private void AddSupplier_Click(object sender, RoutedEventArgs e) => AddPersonQuick(defaultSupplier: true);

    private void AddPersonQuick(bool defaultSupplier)
    {
        if (!RequireWritable() || !ConfirmCanAddCustomer()) return;
        var suggestedCode = NextCode(_data.Customers.Select(person => person.Code), "CUS-");
        var dialog = new CustomerDialog(this, suggestedCode: suggestedCode, defaultSupplier: defaultSupplier);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord customer)
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(customer.Code) &&
                    data.Customers.Any(person => string.Equals(person.Code, customer.Code, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد شخص تکراری است.");
                data.Customers.Add(customer);
            }, defaultSupplier ? "پرونده تأمین‌کننده ذخیره شد" : "پرونده شخص ذخیره شد");
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
        var suggestedCode = NextCode(_data.Products.Select(product => product.Code), "SKU-");
        var dialog = new ProductDialog(this, suggestedCode: suggestedCode);
        if (dialog.ShowDialog() == true && dialog.Result is ProductRecord product)
            Commit(data =>
            {
                if (!string.IsNullOrWhiteSpace(product.Sku) && data.Products.Any(p => string.Equals(p.Sku, product.Sku, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("کد کالای تکراری مجاز نیست.");
                if (!string.IsNullOrWhiteSpace(product.Barcode) && data.Products.Any(p => string.Equals(p.Barcode, product.Barcode, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("بارکد کالا تکراری است.");
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
                if (!string.IsNullOrWhiteSpace(changed.Barcode) && data.Products.Any(p => p.Id != changed.Id && string.Equals(p.Barcode, changed.Barcode, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("بارکد کالا تکراری است.");
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

    private sealed record KardexModuleRow(string Date, string Movement, string Document, string Description, decimal Incoming, decimal Outgoing, decimal Balance);

    private void RefreshKardexModule()
    {
        var selectedId = (KardexModuleProductSelector.SelectedItem as ProductRecord)?.Id;
        var products = _data.Products.OrderBy(product => product.Name).ToList();
        KardexModuleProductSelector.ItemsSource = null;
        KardexModuleProductSelector.ItemsSource = products;
        if (!string.IsNullOrWhiteSpace(selectedId))
            KardexModuleProductSelector.SelectedItem = products.FirstOrDefault(product => product.Id == selectedId);
        if (KardexModuleProductSelector.SelectedItem is null && products.Count > 0)
            KardexModuleProductSelector.SelectedIndex = 0;
        RefreshKardexModuleGrid();
    }

    private void KardexModuleProductSelector_SelectionChanged(object sender, SelectionChangedEventArgs e) =>
        RefreshKardexModuleGrid();

    private void RefreshKardexModuleGrid()
    {
        if (KardexModuleProductSelector.SelectedItem is not ProductRecord product)
        {
            KardexModuleSummary.Text = "برای مشاهدهٔ گردش، ابتدا یک کالا ثبت و انتخاب کنید.";
            KardexModuleGrid.ItemsSource = null;
            return;
        }

        var history = _data.InventoryMovements.Where(item => item.ProductId == product.Id)
            .OrderBy(item => item.Date).ThenBy(item => item.Timestamp).ToList();
        var balance = product.StockQuantity - history.Sum(item => item.SignedQuantity);
        var rows = new List<KardexModuleRow>
        {
            new("—", "ماندهٔ ابتدای گردش", "—", "موجودی پایه استخراج‌شده از سوابق ذخیره‌شده", 0m, 0m, balance)
        };
        foreach (var movement in history)
        {
            balance += movement.SignedQuantity;
            var reference = string.IsNullOrWhiteSpace(movement.ReferenceId) ? movement.VoucherId : movement.ReferenceId;
            var document = movement.ReferenceType == "INVOICE"
                ? _data.Invoices.FirstOrDefault(item => item.Id == reference)?.DisplayNumber ?? reference
                : _data.Vouchers.FirstOrDefault(item => item.Id == reference)?.TrackingCode ?? reference;
            rows.Add(new KardexModuleRow(FormatPersianDate(movement.Date), KardexMovementLabel(movement.MovementType),
                document, movement.Description, Math.Max(0m, movement.SignedQuantity),
                Math.Abs(Math.Min(0m, movement.SignedQuantity)), balance));
        }
        KardexModuleSummary.Text = $"کالا: {product.Name}   |   کد: {product.Code}   |   موجودی فعلی: {product.StockQuantity.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))} {product.Unit}";
        KardexModuleGrid.ItemsSource = rows;
    }

    private void ShowKardexFromModule_Click(object sender, RoutedEventArgs e)
    {
        if (KardexModuleProductSelector.SelectedItem is not ProductRecord product)
        {
            MessageBox.Show(this, "ابتدا یک کالا را انتخاب کنید.", "کارتکس کالا", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        new KardexWindow(this, product, _data.InventoryMovements, _data.Invoices, _data.Vouchers).ShowDialog();
    }

    private static string KardexMovementLabel(string value) => value switch
    {
        "GOODS_RECEIPT" => "رسید ورود کالا", "GOODS_ISSUE" => "حواله خروج کالا", "INVENTORY_ADJUSTMENT" => "تعدیل موجودی",
        "PRODUCTION_CONSUMPTION" => "مصرف تولید", "PRODUCTION_OUTPUT" => "خروجی تولید", "RETURN_RECEIPT" => "برگشت از فروش",
        "RETURN_ISSUE" => "برگشت از خرید", "INTERNAL_TRANSFER" => "انتقال بین انبار", _ => value
    };

    private void ShowKardex_Click(object sender, RoutedEventArgs e)
    {
        if (ProductsGrid.SelectedItem is not ProductRecord product)
        {
            MessageBox.Show(this, "ابتدا کالا را از جدول انتخاب کنید.", "کارتکس کالا",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        new KardexWindow(this, product, _data.InventoryMovements, _data.Invoices, _data.Vouchers).ShowDialog();
    }

    private void ProductsBarcodeSearchBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        e.Handled = true;
        var barcode = ProductsBarcodeSearchBox.Text.Trim();
        if (barcode.Length == 0) return;
        var product = _data.Products.FirstOrDefault(item =>
            string.Equals(item.Barcode, barcode, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.Code, barcode, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.SerialNumber, barcode, StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            FooterStatus.Text = $"بارکد «{barcode}» با هیچ کد کالا یا شماره سریالی تطبیق نداشت.";
            ProductsBarcodeSearchBox.SelectAll();
            return;
        }
        ProductsSearchBox.Text = product.Code;
        ProductsGrid.SelectedItem = product;
        ProductsGrid.ScrollIntoView(product);
        FooterStatus.Text = $"کالای «{product.Name}» از طریق بارکدخوان انتخاب شد.";
        ProductsBarcodeSearchBox.Clear();
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
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
        var dialog = new InvoiceDialog(
            this, _data.Customers, _data.Products, _data.Invoices,
            AddCustomerInline, AddProductInline,
            _data.Preferences.InvoiceTheme, _data.Preferences.ShowInvoiceQr, ActiveCompanyProfile(),
            _data.Preferences.SalesInvoicePrefix, _data.Preferences.DefaultTaxRatePercent,
            _data.Preferences.Currency, ConfiguredInvoiceFooter());
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
        if (MessageBox.Show(this, $"سند {invoice.DisplayNumber} لغو و اثر موجودی آن برگردانده شود؟ فقط سند صادرشدهٔ بدون تسویه قابل لغو است.",
            "تأیید لغو سند", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data => AccountingOperations.CancelInvoice(data, invoice.Id), "سند لغو و اثر موجودی آن برگشت داده شد");
    }

    private void EditInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (InvoicesGrid.SelectedItem is not InvoiceRecord invoice)
        {
            MessageBox.Show(this, "ابتدا یک فاکتور را از جدول انتخاب کنید.", "ویرایش سند",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        // Preserve financial history: documents with received payments, checks or manually-linked
        // journal entries must use a reversal/adjustment flow instead of direct editing.
        var hasPayments = _data.Payments.Any(payment => payment.InvoiceId == invoice.Id);
        var hasChecks = _data.Checks.Any(check => check.RelatedInvoiceId == invoice.Id);
        var hasManualLedgerEntries = _data.JournalEntries.Any(entry =>
            string.Equals(entry.ReferenceId, invoice.Id, StringComparison.Ordinal) &&
            !entry.ReferenceType.StartsWith("AUTO_INVOICE_", StringComparison.Ordinal) &&
            !entry.ReferenceType.StartsWith("AUTO_REVERSAL_", StringComparison.Ordinal));

        if (invoice.Status == "لغو شده" || hasPayments || invoice.CheckAmount > 0m ||
            hasChecks || hasManualLedgerEntries)
        {
            MessageBox.Show(this,
                "این فاکتور سابقهٔ دریافت/پرداخت، چک یا سند دستی دفترکل دارد یا لغو شده است. برای حفظ تاریخچه باید از سند اصلاحی/برگشت استفاده شود؛ ویرایش مستقیم انجام نشد.",
                "ویرایش ایمن محدود شد", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var dialog = new InvoiceDialog(
            this, _data.Customers, _data.Products, _data.Invoices,
            AddCustomerInline, AddProductInline, _data.Preferences.InvoiceTheme,
            _data.Preferences.ShowInvoiceQr, ActiveCompanyProfile(),
            _data.Preferences.SalesInvoicePrefix, _data.Preferences.DefaultTaxRatePercent,
            _data.Preferences.Currency, ConfiguredInvoiceFooter(), invoice);
        if (dialog.ShowDialog() != true || dialog.Result is not InvoiceDraft draft) return;

        Commit(data =>
        {
            var existing = data.Invoices.SingleOrDefault(item => item.Id == invoice.Id)
                ?? throw new InvalidOperationException("فاکتور پیدا نشد.");
            if (existing.Status == "لغو شده" ||
                data.Payments.Any(payment => payment.InvoiceId == existing.Id) ||
                existing.CheckAmount > 0m ||
                data.Checks.Any(check => check.RelatedInvoiceId == existing.Id) ||
                data.JournalEntries.Any(entry =>
                    string.Equals(entry.ReferenceId, existing.Id, StringComparison.Ordinal) &&
                    !entry.ReferenceType.StartsWith("AUTO_INVOICE_", StringComparison.Ordinal) &&
                    !entry.ReferenceType.StartsWith("AUTO_REVERSAL_", StringComparison.Ordinal)))
                throw new InvalidOperationException("وضعیت مالی فاکتور تغییر کرده است؛ ویرایش لغو شد.");

            var oldId = existing.Id;
            var oldNumber = existing.Number;
            var oldPrefix = existing.Prefix;
            var oldTrackingCode = existing.TrackingCode;

            // Restore old stock effect within Commit's cloned transaction before applying the edited lines.
            foreach (var line in existing.Lines)
            {
                var product = data.Products.SingleOrDefault(item => item.Id == line.ProductId)
                    ?? throw new InvalidOperationException($"کالای «{line.ProductName}» پیدا نشد؛ ویرایش برای حفظ موجودی لغو شد.");
                if (existing.Type == "SALE") product.StockQuantity += line.Quantity;
                else if (existing.Type == "PURCHASE") product.StockQuantity -= line.Quantity;
            }

            data.InventoryMovements.RemoveAll(movement =>
                string.Equals(movement.ReferenceId, oldId, StringComparison.Ordinal) &&
                string.Equals(movement.ReferenceType, "INVOICE", StringComparison.Ordinal));
            data.Invoices.Remove(existing);

            var replacementInvoice = AccountingOperations.CreateInvoice(data, draft);
            var generatedId = replacementInvoice.Id;
            replacementInvoice.Id = oldId;
            replacementInvoice.Number = oldNumber;
            replacementInvoice.Prefix = oldPrefix;
            replacementInvoice.TrackingCode = oldTrackingCode;
            data.NextInvoiceNumber = Math.Max(data.NextInvoiceNumber, oldNumber + 1);

            // CreateInvoice generates references using its initial ID; remap them atomically to the preserved ID.
            foreach (var movement in data.InventoryMovements.Where(item =>
                string.Equals(item.ReferenceId, generatedId, StringComparison.Ordinal) &&
                string.Equals(item.ReferenceType, "INVOICE", StringComparison.Ordinal)))
            {
                movement.ReferenceId = oldId;
                movement.Description = $"{replacementInvoice.TypeLabel} {replacementInvoice.DisplayNumber} — {movement.Description}";
            }

            foreach (var payment in data.Payments.Where(item => string.Equals(item.InvoiceId, generatedId, StringComparison.Ordinal)))
            {
                payment.InvoiceId = oldId;
                payment.InvoiceNumber = oldNumber;
            }
        }, "فاکتور ویرایش شد؛ شماره و کد پیگیری حفظ شد و موجودی/ثبت خودکار حسابداری بازسازی شد.");
    }

    private void DeleteInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (InvoicesGrid.SelectedItem is not InvoiceRecord invoice)
        {
            MessageBox.Show(this, "ابتدا یک سند را از جدول فاکتورها انتخاب کنید.", "حذف سند",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        // Physical deletion is limited to a proforma with no downstream financial or ledger links.
        // Posted sales/purchases must be cancelled/reversed instead of silently removed.
        var hasPayments = _data.Payments.Any(payment => payment.InvoiceId == invoice.Id);
        var hasChecks = _data.Checks.Any(check => check.RelatedInvoiceId == invoice.Id);
        var hasLedgerEntries = _data.JournalEntries.Any(entry =>
            string.Equals(entry.ReferenceId, invoice.Id, StringComparison.Ordinal));
        if (invoice.Type != "PROFORMA" || invoice.Status == "لغو شده" ||
            hasPayments || hasChecks || hasLedgerEntries)
        {
            MessageBox.Show(this,
                "حذف فیزیکی فقط برای پیش‌فاکتورِ بدون دریافت، چک یا سند دفترکل مجاز است. برای فاکتور قطعی/دارای سابقه از عملیات لغو یا سند اصلاحی استفاده کنید تا تاریخچه و موجودی حفظ شود.",
                "حذف ایمن محدود شد", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        if (MessageBox.Show(this, $"پیش‌فاکتور {invoice.DisplayNumber} برای همیشه حذف شود؟",
            "تأیید حذف پیش‌فاکتور", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
            return;

        Commit(data =>
        {
            var current = data.Invoices.SingleOrDefault(item => item.Id == invoice.Id)
                ?? throw new InvalidOperationException("سند دیگر وجود ندارد.");
            if (current.Type != "PROFORMA" || current.Status == "لغو شده" ||
                data.Payments.Any(payment => payment.InvoiceId == current.Id) ||
                data.Checks.Any(check => check.RelatedInvoiceId == current.Id) ||
                data.JournalEntries.Any(entry => string.Equals(entry.ReferenceId, current.Id, StringComparison.Ordinal)))
                throw new InvalidOperationException("سابقهٔ مالی سند تغییر کرده است؛ حذف انجام نشد.");
            data.Invoices.Remove(current);
        }, "پیش‌فاکتور بدون سابقهٔ مالی حذف شد.");
    }

    private void InvoicesGrid_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (InvoicesGrid.SelectedItem is InvoiceRecord)
            PreviewInvoice_Click(sender, e);
    }

    private void PreviewInvoice_Click(object sender, RoutedEventArgs e)
    {
        var invoice = InvoicesGrid.SelectedItem as InvoiceRecord
            ?? RecentInvoicesGrid.SelectedItem as InvoiceRecord;
        if (invoice is null)
        {
            MessageBox.Show(this, "ابتدا یک فاکتور را در جدول «فاکتورها» یا «آخرین اسناد» انتخاب کنید.",
                "پیش‌نمایش فاکتور", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        OpenInvoicePreview(invoice);
    }

    private void PrintInvoice_Click(object sender, RoutedEventArgs e)
    {
        var invoice = InvoicesGrid.SelectedItem as InvoiceRecord;
        if (invoice is null)
        {
            MessageBox.Show(this, "یک فاکتور را انتخاب کنید.", "چاپ فاکتور",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        // Preview and print share the same theme and QR output.
        OpenInvoicePreview(invoice);
    }

    private static string InvoicePreviewErrorLogPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AshkeGhalam", "WindowsNative", "invoice-preview-error.log");

    private static void WriteInvoicePreviewError(Exception exception)
    {
        try
        {
            var directory = Path.GetDirectoryName(InvoicePreviewErrorLogPath);
            if (!string.IsNullOrWhiteSpace(directory))
                Directory.CreateDirectory(directory);
            File.AppendAllText(InvoicePreviewErrorLogPath,
                $"[{DateTimeOffset.Now:O}] Invoice preview error{Environment.NewLine}{exception}{Environment.NewLine}{new string('-', 72)}{Environment.NewLine}",
                new UTF8Encoding(false));
        }
        catch
        {
            // Diagnostic failures must not trigger a second UI failure.
        }
    }

    private void OpenInvoicePreview(InvoiceRecord invoice)
    {
        InvoicePreviewWindow? preview = null;
        DispatcherUnhandledExceptionEventHandler? dispatcherHandler = null;
        try
        {
            preview = new InvoicePreviewWindow(this, invoice, _data.Preferences.InvoiceTheme,
                _data.Preferences.ShowInvoiceQr, ActiveCompanyProfile(),
                _data.Preferences.Currency, ConfiguredInvoiceFooter());

            dispatcherHandler = (_, args) =>
            {
                // Contain an exception raised while WPF renders the modal preview instead
                // of terminating the entire accounting application.
                if (preview is null)
                    return;

                var exception = args.Exception;
                args.Handled = true;
                WriteInvoicePreviewError(exception);
                preview.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
                {
                    try { preview.Close(); } catch { }
                    MessageBox.Show(this,
                        $"پیش‌نمایش فاکتور باز نشد و برای جلوگیری از بسته‌شدن حسابداری متوقف شد.\n{exception.Message}\n\nگزارش فنی: {InvoicePreviewErrorLogPath}",
                        "خطا در پیش‌نمایش فاکتور", MessageBoxButton.OK, MessageBoxImage.Error);
                }));
            };

            Application.Current.DispatcherUnhandledException += dispatcherHandler;
            preview.ShowDialog();
        }
        catch (Exception exception)
        {
            WriteInvoicePreviewError(exception);
            MessageBox.Show(this,
                $"پیش‌نمایش فاکتور باز نشد.\n{exception.Message}\n\nگزارش فنی: {InvoicePreviewErrorLogPath}",
                "خطا در پیش‌نمایش فاکتور", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            if (dispatcherHandler is not null)
                Application.Current.DispatcherUnhandledException -= dispatcherHandler;
        }
    }

    private void PreviewPaymentReceipt_Click(object sender, RoutedEventArgs e)
    {
        if (PaymentsGrid.SelectedItem is not PaymentRecord payment)
        {
            MessageBox.Show(this, "ابتدا یک دریافت یا پرداخت را از جدول انتخاب کنید.",
                "پیش‌نمایش رسید", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var invoice = _data.Invoices.FirstOrDefault(item => item.Id == payment.InvoiceId);
        if (invoice is null)
        {
            MessageBox.Show(this, "فاکتور مرجع این عملیات پیدا نشد؛ رسید بدون مرجع قابل نمایش نیست.",
                "پیش‌نمایش رسید", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        new PaymentReceiptPreviewWindow(this, payment, invoice, ActiveCompanyProfile(), _data.Preferences.Currency).ShowDialog();
    }

    private void AddPayment_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType(null);

    private void AddReceipt_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType("SALE");

    private void AddSupplierPayment_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType("PURCHASE");

    private void AddPaymentForInvoiceType(string? invoiceTypeFilter)
    {
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
        var dialog = new PaymentDialog(this, _data, invoiceTypeFilter);
        if (dialog.ShowDialog() == true)
        {
            var message = invoiceTypeFilter switch
            {
                "SALE" => "دریافت از مشتری ثبت شد",
                "PURCHASE" => "پرداخت به تأمین‌کننده ثبت شد",
                _ => "عملیات دریافت/پرداخت ثبت شد"
            };
            Commit(data => AccountingOperations.RecordPayment(data, dialog.InvoiceId, dialog.Amount, dialog.Method, dialog.Reference), message);
        }
    }

    private void EditExpense_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (ExpensesGrid.SelectedItem is not ExpenseRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک هزینه را از جدول انتخاب کنید.", "ویرایش هزینه", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        if (_data.JournalEntries.Any(entry => entry.ReferenceId == selected.Id && entry.ReferenceType != "AUTO_EXPENSE"))
        {
            MessageBox.Show(this, "برای این هزینه سند دستی دفترکل ثبت شده است؛ ویرایش مستقیم برای حفظ سابقه مالی مسدود شد.",
                "ویرایش ایمن هزینه", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var dialog = new ExpenseDialog(this, selected);
        if (dialog.ShowDialog() != true) return;
        Commit(data =>
        {
            var current = data.Expenses.SingleOrDefault(item => item.Id == selected.Id)
                ?? throw new InvalidOperationException("هزینه پیدا نشد.");
            if (data.JournalEntries.Any(entry => entry.ReferenceId == current.Id && entry.ReferenceType != "AUTO_EXPENSE"))
                throw new InvalidOperationException("برای این هزینه سند دستی دفترکل ثبت شده؛ ویرایش انجام نشد.");
            current.Title = dialog.ExpenseTitle;
            current.Category = dialog.Category;
            current.Amount = dialog.Amount;
            current.Notes = dialog.Notes;
            data.JournalEntries.RemoveAll(entry => entry.ReferenceId == current.Id && entry.ReferenceType == "AUTO_EXPENSE");
        }, "هزینه ویرایش شد و ثبت خودکار دفترکل بازسازی شد.");
    }

    private void DeleteExpense_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (ExpensesGrid.SelectedItem is not ExpenseRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک هزینه را از جدول انتخاب کنید.", "حذف هزینه", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        if (_data.JournalEntries.Any(entry => entry.ReferenceId == selected.Id && entry.ReferenceType != "AUTO_EXPENSE"))
        {
            MessageBox.Show(this, "برای این هزینه سند دستی دفترکل ثبت شده است؛ ابتدا سند اصلاحی ثبت کنید.",
                "حذف ایمن هزینه", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (MessageBox.Show(this, $"هزینه «{selected.Title}» با مبلغ {selected.Amount:N2} حذف شود؟",
            "تأیید حذف هزینه", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data =>
        {
            var current = data.Expenses.SingleOrDefault(item => item.Id == selected.Id)
                ?? throw new InvalidOperationException("هزینه پیدا نشد.");
            if (data.JournalEntries.Any(entry => entry.ReferenceId == current.Id && entry.ReferenceType != "AUTO_EXPENSE"))
                throw new InvalidOperationException("برای این هزینه سند دستی دفترکل ثبت شده؛ حذف انجام نشد.");
            data.JournalEntries.RemoveAll(entry => entry.ReferenceId == current.Id && entry.ReferenceType == "AUTO_EXPENSE");
            data.Expenses.Remove(current);
        }, "هزینه حذف شد و ثبت خودکار دفترکل آن اصلاح شد.");
    }

    private void EditPayment_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (PaymentsGrid.SelectedItem is not PaymentRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک دریافت/پرداخت را از جدول انتخاب کنید.", "ویرایش دریافت/پرداخت",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        if (_data.JournalEntries.Any(entry => entry.ReferenceId == selected.Id && entry.ReferenceType != "AUTO_PAYMENT"))
        {
            MessageBox.Show(this, "برای این عملیات سند دستی دفترکل وجود دارد؛ ویرایش مستقیم برای حفظ سابقه مالی مسدود شد.",
                "ویرایش ایمن دریافت/پرداخت", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        var dialog = new PaymentDialog(this, _data, existingPayment: selected);
        if (dialog.ShowDialog() != true) return;
        Commit(data =>
        {
            var current = data.Payments.SingleOrDefault(item => item.Id == selected.Id)
                ?? throw new InvalidOperationException("دریافت/پرداخت پیدا نشد.");
            if (data.JournalEntries.Any(entry => entry.ReferenceId == current.Id && entry.ReferenceType != "AUTO_PAYMENT"))
                throw new InvalidOperationException("برای این عملیات سند دستی دفترکل ثبت شده؛ ویرایش انجام نشد.");
            if (current.Method == "چک" && data.Checks.Any(check => check.RelatedInvoiceId == current.InvoiceId))
                throw new InvalidOperationException("این عملیات به چک‌های ثبت‌شده مرتبط است؛ برای جلوگیری از ناهماهنگی، ابتدا چک مرتبط را تعیین تکلیف کنید.");

            RemovePaymentWithAutomaticPosting(data, current);
            var replacement = AccountingOperations.RecordPayment(data, dialog.InvoiceId, dialog.Amount, dialog.Method, dialog.Reference);
            replacement.Id = current.Id;
            replacement.CreatedAt = current.CreatedAt;
        }, "دریافت/پرداخت ویرایش شد؛ مانده‌ها و دفترکل خودکار بازسازی شدند.");
    }

    private void DeletePayment_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (PaymentsGrid.SelectedItem is not PaymentRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک دریافت/پرداخت را از جدول انتخاب کنید.", "حذف دریافت/پرداخت",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        if (_data.JournalEntries.Any(entry => entry.ReferenceId == selected.Id && entry.ReferenceType != "AUTO_PAYMENT"))
        {
            MessageBox.Show(this, "برای این عملیات سند دستی دفترکل وجود دارد؛ ابتدا سند اصلاحی ثبت کنید.",
                "حذف ایمن دریافت/پرداخت", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (selected.Method == "چک" && _data.Checks.Any(check => check.RelatedInvoiceId == selected.InvoiceId))
        {
            MessageBox.Show(this, "این عملیات به چک‌های ثبت‌شده مرتبط است؛ ابتدا چک مرتبط را تعیین تکلیف کنید.",
                "حذف ایمن دریافت/پرداخت", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (MessageBox.Show(this, $"عملیات {selected.Amount:N2} مربوط به فاکتور {selected.InvoiceNumber} حذف شود؟",
            "تأیید حذف دریافت/پرداخت", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        Commit(data =>
        {
            var current = data.Payments.SingleOrDefault(item => item.Id == selected.Id)
                ?? throw new InvalidOperationException("دریافت/پرداخت پیدا نشد.");
            if (data.JournalEntries.Any(entry => entry.ReferenceId == current.Id && entry.ReferenceType != "AUTO_PAYMENT"))
                throw new InvalidOperationException("برای این عملیات سند دستی دفترکل ثبت شده؛ حذف انجام نشد.");
            if (current.Method == "چک" && data.Checks.Any(check => check.RelatedInvoiceId == current.InvoiceId))
                throw new InvalidOperationException("چک مرتبط وجود دارد؛ حذف انجام نشد.");
            RemovePaymentWithAutomaticPosting(data, current);
        }, "دریافت/پرداخت حذف شد؛ مانده و دفترکل خودکار اصلاح شدند.");
    }

    private static void RemovePaymentWithAutomaticPosting(AccountingData data, PaymentRecord payment)
    {
        var invoice = data.Invoices.SingleOrDefault(item => item.Id == payment.InvoiceId)
            ?? throw new InvalidOperationException("فاکتور مرتبط با این دریافت/پرداخت پیدا نشد.");
        if (payment.Method == "نقدی")
            invoice.CashAmount = AccountingRules.Money(Math.Max(0m, invoice.CashAmount - payment.Amount));
        else if (payment.Method == "چک")
            invoice.CheckAmount = AccountingRules.Money(Math.Max(0m, invoice.CheckAmount - payment.Amount));

        data.Payments.RemoveAll(item => item.Id == payment.Id);
        data.JournalEntries.RemoveAll(entry => entry.ReferenceId == payment.Id && entry.ReferenceType == "AUTO_PAYMENT");
        if (invoice.Status == "تسویه شده" && AccountingRules.RemainingForInvoice(data, invoice) > 0m)
            invoice.Status = "ثبت شده";
    }

    private void AddExpense_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
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

    private void ShowPersonKardex_Click(object sender, RoutedEventArgs e)
    {
        if (CustomersGrid.SelectedItem is not CustomerRecord person)
        {
            MessageBox.Show(this, "ابتدا یک شخص را از جدول انتخاب کنید.", "کاردکس اشخاص",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        new PersonKardexWindow(this, person, _data).ShowDialog();
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

    private void ExportPayments_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("payments.csv",
            new[] { "InvoiceId", "InvoiceNumber", "CustomerName", "Amount", "Method", "Reference", "CreatedAt" },
            _data.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => new[]
            {
                payment.InvoiceId,
                payment.InvoiceNumber.ToString(CultureInfo.InvariantCulture),
                payment.CustomerName,
                payment.Amount.ToString(CultureInfo.InvariantCulture),
                payment.Method,
                payment.Reference,
                payment.CreatedAt.ToString("O", CultureInfo.InvariantCulture)
            }));

    private void ExportExpenses_Click(object sender, RoutedEventArgs e) =>
        ExportCsv("expenses.csv",
            new[] { "Id", "Title", "Category", "Amount", "Notes", "CreatedAt" },
            _data.Expenses.OrderByDescending(expense => expense.CreatedAt).Select(expense => new[]
            {
                expense.Id,
                expense.Title,
                expense.Category,
                expense.Amount.ToString(CultureInfo.InvariantCulture),
                expense.Notes,
                expense.CreatedAt.ToString("O", CultureInfo.InvariantCulture)
            }));

    private void ExportReport_Click(object sender, RoutedEventArgs e)
    {
        var activeInvoices = _data.Invoices.Where(i => i.Status != "لغو شده").ToList();
        var salesInvoices = activeInvoices.Where(i => i.Type == "SALE").ToList();
        var purchaseInvoices = activeInvoices.Where(i => i.Type == "PURCHASE").ToList();
        var salesIds = salesInvoices.Select(i => i.Id).ToHashSet(StringComparer.Ordinal);
        var purchaseIds = purchaseInvoices.Select(i => i.Id).ToHashSet(StringComparer.Ordinal);
        var sales = salesInvoices.Sum(i => i.Total);
        var purchases = purchaseInvoices.Sum(i => i.Total);
        var receivables = salesInvoices.Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var payables = purchaseInvoices.Sum(i => AccountingRules.RemainingForInvoice(_data, i));
        var paid = _data.Payments.Sum(p => p.Amount);
        var salesReceipts = _data.Payments.Where(p => salesIds.Contains(p.InvoiceId)).Sum(p => p.Amount);
        var purchasePayments = _data.Payments.Where(p => purchaseIds.Contains(p.InvoiceId)).Sum(p => p.Amount);
        var expenses = _data.Expenses.Sum(i => i.Amount);
        ExportCsv("summary-report.csv", new[] { "Metric", "Value" }, new[]
        {
            new[] { "Sales", sales.ToString(CultureInfo.InvariantCulture) },
            new[] { "Purchases", purchases.ToString(CultureInfo.InvariantCulture) },
            new[] { "AllSettlements", paid.ToString(CultureInfo.InvariantCulture) },
            new[] { "SalesReceipts", salesReceipts.ToString(CultureInfo.InvariantCulture) },
            new[] { "PurchasePayments", purchasePayments.ToString(CultureInfo.InvariantCulture) },
            new[] { "SalesReceivables", receivables.ToString(CultureInfo.InvariantCulture) },
            new[] { "PurchasePayables", payables.ToString(CultureInfo.InvariantCulture) },
            new[] { "Expenses", expenses.ToString(CultureInfo.InvariantCulture) },
            new[] { "SimpleNetCashFlow", (salesReceipts - purchasePayments - expenses).ToString(CultureInfo.InvariantCulture) }
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
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
        if (_data.Products.Count == 0)
        { MessageBox.Show(this, "برای ثبت حواله ابتدا کالا ثبت کنید.", "پیش‌نیاز حواله", MessageBoxButton.OK, MessageBoxImage.Information); return; }
        var dialog = new VoucherDialog(this, _data.Customers, _data.Products, _data.Invoices, companyProfile: ActiveCompanyProfile());
        if (dialog.ShowDialog() == true && dialog.Result is VoucherRecord voucher)
            Commit(data => AccountingOperations.CreateVoucher(data, voucher), "حواله ثبت و گردش موجودی به‌صورت اتمی ذخیره شد");
    }

    private void PreviewVoucher_Click(object sender, RoutedEventArgs e)
    {
        if (FindName("VouchersGrid") is not DataGrid grid || grid.SelectedItem is not VoucherGridRow row)
        {
            MessageBox.Show(this, "ابتدا یک حواله را از جدول انتخاب کنید.", "پیش‌نمایش حواله",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        new VoucherPreviewWindow(this, row.Record, ActiveCompanyProfile()).ShowDialog();
    }

    private void VouchersGrid_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (FindName("VouchersGrid") is DataGrid grid && grid.SelectedItem is VoucherGridRow)
            PreviewVoucher_Click(sender, e);
    }

    private void EditVoucher_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("VouchersGrid") is not DataGrid grid || grid.SelectedItem is not VoucherGridRow row)
        {
            MessageBox.Show(this, "ابتدا حواله را انتخاب کنید.");
            return;
        }
        if (row.Record.Status != "PENDING")
        {
            MessageBox.Show(this, "فقط حوالهٔ در انتظار و هنوز تحویل‌نشده قابل ویرایش است.",
                "ویرایش حواله", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        var dialog = new VoucherDialog(this, _data.Customers, _data.Products, _data.Invoices, row.Record, ActiveCompanyProfile());
        if (dialog.ShowDialog() != true || dialog.Result is not VoucherRecord changed) return;
        Commit(data =>
        {
            var current = data.Vouchers.SingleOrDefault(item => item.Id == row.Record.Id)
                ?? throw new InvalidOperationException("حواله پیدا نشد.");
            if (current.Status != "PENDING")
                throw new InvalidOperationException("وضعیت حواله تغییر کرده است؛ ویرایش انجام نشد.");
            var number = current.Number;
            var trackingCode = current.TrackingCode;
            AccountingOperations.DeleteVoucher(data, current.Id);
            var replacement = AccountingOperations.CreateVoucher(data, changed);
            replacement.Number = number;
            replacement.TrackingCode = trackingCode;
            foreach (var movement in data.InventoryMovements.Where(item => item.VoucherId == replacement.Id))
                movement.Description = $"حواله {number} — {trackingCode}";
        }, "حواله ویرایش و اثر موجودی آن به‌صورت اتمی بازسازی شد");
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
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
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

    private void EnsureConfigurationDefaults()
    {
        _data.Companies ??= [];
        if (_data.Companies.Count == 0)
            _data.Companies.Add(new CompanyProfileRecord());

        if (string.IsNullOrWhiteSpace(_data.ActiveCompanyId) ||
            !_data.Companies.Any(company => company.Id == _data.ActiveCompanyId))
            _data.ActiveCompanyId = _data.Companies[0].Id;

        _data.Preferences ??= new AccountingPreferences();
        _data.Preferences.CustomInvoiceFootnoteOptions ??= [];
        _data.Preferences.SelectedInvoiceFootnotes ??= [];
        _data.MoadianSettings ??= new MoadianSettingsRecord();
        _data.ServerConnection ??= new ServerConnectionSettings();

        // Populate missing unit snapshots on older locally saved invoices without changing amounts.
        foreach (var invoice in _data.Invoices ?? [])
        {
            invoice.Lines ??= [];
            foreach (var line in invoice.Lines)
            {
                if (string.IsNullOrWhiteSpace(line.Unit))
                    line.Unit = _data.Products.FirstOrDefault(product => product.Id == line.ProductId)?.Unit ?? "عدد";
            }
        }
    }

    private CompanyProfileRecord? ActiveCompanyProfile()
    {
        EnsureConfigurationDefaults();
        return _data.Companies.FirstOrDefault(company => company.Id == _data.ActiveCompanyId);
    }

    private void PopulateCompanyProfile(CompanyProfileRecord? company)
    {
        if (company is null) return;
        CompanyProfileName.Text = company.Name;
        CompanyLegalName.Text = company.LegalName;
        CompanyNationalId.Text = company.NationalId;
        CompanyTaxId.Text = company.TaxId;
        CompanyProfilePhone.Text = company.Phone;
        CompanyProfileBranch.Text = company.Branch;
        CompanyProfileAddress.Text = company.Address;
    }

    private void RefreshAccountingConfigurationPanels()
    {
        EnsureConfigurationDefaults();

        CompanyProfileSelector.ItemsSource = null;
        CompanyProfileSelector.ItemsSource = _data.Companies;
        CompanyProfileSelector.SelectedValuePath = nameof(CompanyProfileRecord.Id);
        CompanyProfileSelector.SelectedValue = _data.ActiveCompanyId;
        PopulateCompanyProfile(CompanyProfileSelector.SelectedItem as CompanyProfileRecord);

        SettingsFooterNoReturns.IsChecked = (_data.Preferences.SelectedInvoiceFootnotes ?? []).Contains(FooterNoteNoReturns, StringComparer.Ordinal);
        SettingsFooterPaymentTerms.IsChecked = (_data.Preferences.SelectedInvoiceFootnotes ?? []).Contains(FooterNotePaymentTerms, StringComparer.Ordinal);
        SettingsFooterDeliveryTerms.IsChecked = (_data.Preferences.SelectedInvoiceFootnotes ?? []).Contains(FooterNoteDeliveryTerms, StringComparer.Ordinal);

        ApplicationThemeSelector.SelectedItem = ApplicationThemeSelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), ApplicationThemeService.Normalize(_data.Preferences.ApplicationTheme), StringComparison.Ordinal))
            ?? ApplicationThemeSelector.Items.OfType<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), "light", StringComparison.Ordinal));
        InvoiceThemeSelector.SelectedItem = InvoiceThemeSelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), _data.Preferences.InvoiceTheme, StringComparison.Ordinal))
            ?? InvoiceThemeSelector.Items.OfType<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), "modern", StringComparison.Ordinal));
        SettingsCurrencySelector.SelectedItem = SettingsCurrencySelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), _data.Preferences.Currency, StringComparison.Ordinal))
            ?? SettingsCurrencySelector.Items.OfType<ComboBoxItem>().FirstOrDefault();
        SettingsTaxRate.Text = _data.Preferences.DefaultTaxRatePercent.ToString(CultureInfo.InvariantCulture);
        SettingsInvoicePrefix.Text = _data.Preferences.SalesInvoicePrefix;
        SettingsShowInvoiceQr.IsChecked = _data.Preferences.ShowInvoiceQr;
        SettingsInvoiceFooter.Text = _data.Preferences.InvoiceFooter;
        SettingsCustomFootnoteOptions.Text = string.Join(Environment.NewLine, _data.Preferences.CustomInvoiceFootnoteOptions ?? []);
        RefreshCustomInvoiceFootnoteChoices(_data.Preferences.CustomInvoiceFootnoteOptions, _data.Preferences.SelectedInvoiceFootnotes);

        MoadianTaxpayerId.Text = _data.MoadianSettings.TaxpayerId;
        MoadianApiBaseUrl.Text = _data.MoadianSettings.ApiBaseUrl;
        MoadianEnvironmentSelector.SelectedItem = MoadianEnvironmentSelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), _data.MoadianSettings.Environment, StringComparison.Ordinal))
            ?? MoadianEnvironmentSelector.Items.OfType<ComboBoxItem>().FirstOrDefault();
        MoadianIsConfigured.IsChecked = _data.MoadianSettings.IsConfigured;

        ServerBaseUrl.Text = _data.ServerConnection.BaseUrl;
        ServerWorkspaceId.Text = _data.ServerConnection.WorkspaceId;
        ServerSyncModeSelector.SelectedItem = ServerSyncModeSelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), _data.ServerConnection.SyncMode, StringComparison.Ordinal))
            ?? ServerSyncModeSelector.Items.OfType<ComboBoxItem>().FirstOrDefault();
    }

    private static List<string> ParseCustomInvoiceFootnoteOptions(string? text) =>
        (text ?? "").Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(note => !string.IsNullOrWhiteSpace(note))
            .Distinct(StringComparer.Ordinal)
            .Take(50)
            .ToList();

    private void RefreshCustomInvoiceFootnoteChoices(IEnumerable<string>? options = null, IEnumerable<string>? selectedNotes = null)
    {
        var entries = (options ?? ParseCustomInvoiceFootnoteOptions(SettingsCustomFootnoteOptions.Text))
            .Where(note => !string.IsNullOrWhiteSpace(note))
            .Distinct(StringComparer.Ordinal)
            .Take(50)
            .ToList();
        var selected = (selectedNotes ?? _data.Preferences.SelectedInvoiceFootnotes ?? [])
            .ToHashSet(StringComparer.Ordinal);

        CustomInvoiceFootnoteSelector.ItemsSource = null;
        CustomInvoiceFootnoteSelector.ItemsSource = entries;
        foreach (var note in entries.Where(selected.Contains))
            CustomInvoiceFootnoteSelector.SelectedItems.Add(note);
    }

    private void LoadCustomInvoiceFootnotes_Click(object sender, RoutedEventArgs e)
    {
        var selected = GetSelectedInvoiceFootnotes();
        var options = ParseCustomInvoiceFootnoteOptions(SettingsCustomFootnoteOptions.Text);
        RefreshCustomInvoiceFootnoteChoices(options, selected);
        FooterStatus.Text = $"گزینه‌های پانویس به‌روزرسانی شد: {options.Count:N0} مورد. برای درج، موارد دلخواه را انتخاب و تنظیمات را ذخیره کنید.";
    }

    private void CompanyProfileSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_uiReady || CompanyProfileSelector.SelectedItem is not CompanyProfileRecord selected) return;
        PopulateCompanyProfile(selected);
    }

    private void AddCompanyProfile_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var name = CompanyProfileName.Text.Trim();
        if (name.Length < 2)
        {
            MessageBox.Show(this, "برای شرکت جدید نام قابل نمایش وارد کنید.", "پروفایل شرکت",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var profile = new CompanyProfileRecord
        {
            Name = name,
            LegalName = CompanyLegalName.Text.Trim(),
            NationalId = CompanyNationalId.Text.Trim(),
            TaxId = CompanyTaxId.Text.Trim(),
            Phone = CompanyProfilePhone.Text.Trim(),
            Branch = string.IsNullOrWhiteSpace(CompanyProfileBranch.Text) ? "مرکزی" : CompanyProfileBranch.Text.Trim(),
            Address = CompanyProfileAddress.Text.Trim()
        };
        Commit(data =>
        {
            data.Companies ??= [];
            if (data.Companies.Any(company => string.Equals(company.Name.Trim(), profile.Name, StringComparison.OrdinalIgnoreCase) &&
                                                string.Equals(company.Branch.Trim(), profile.Branch, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("شرکتی با همین نام و شعبه از قبل وجود دارد.");
            data.Companies.Add(profile);
            data.ActiveCompanyId = profile.Id;
        }, "پروفایل شرکت اضافه شد؛ جداسازی مستقل دفترکل هنوز تکمیل نشده است.");
    }

    private void ActivateCompanyProfile_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CompanyProfileSelector.SelectedItem is not CompanyProfileRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک پروفایل شرکت انتخاب کنید.");
            return;
        }
        Commit(data =>
        {
            if (!data.Companies.Any(company => company.Id == selected.Id))
                throw new InvalidOperationException("پروفایل انتخاب‌شده پیدا نشد.");
            data.ActiveCompanyId = selected.Id;
        }, "پروفایل شرکت فعال برای سربرگ فاکتور انتخاب شد.");
    }

    private void ChooseCompanyImage_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CompanyProfileSelector.SelectedItem is not CompanyProfileRecord selected)
        {
            MessageBox.Show(this, "ابتدا یک پروفایل شرکت را انتخاب کنید.");
            return;
        }
        var property = (sender as FrameworkElement)?.Tag?.ToString();
        if (property is not ("LogoDataBase64" or "StampDataBase64" or "SignatureDataBase64")) return;
        var picker = new OpenFileDialog
        {
            Title = "انتخاب تصویر شرکت", Filter = "تصویر PNG یا JPEG|*.png;*.jpg;*.jpeg",
            CheckFileExists = true, Multiselect = false
        };
        if (picker.ShowDialog() != true) return;
        try
        {
            var info = new FileInfo(picker.FileName);
            if (info.Length <= 0 || info.Length > 2 * 1024 * 1024)
                throw new InvalidDataException("حجم تصویر باید کمتر از ۲ مگابایت باشد.");
            var bytes = File.ReadAllBytes(picker.FileName);
            using (var stream = new MemoryStream(bytes))
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = stream; bitmap.EndInit();
                if (bitmap.PixelWidth < 1 || bitmap.PixelHeight < 1 || bitmap.PixelWidth > 5000 || bitmap.PixelHeight > 5000)
                    throw new InvalidDataException("ابعاد تصویر معتبر نیست یا بیش از حد بزرگ است.");
                bitmap.Freeze();
            }
            var encoded = Convert.ToBase64String(bytes);
            Commit(data =>
            {
                var company = data.Companies.SingleOrDefault(item => item.Id == selected.Id)
                    ?? throw new InvalidOperationException("پروفایل شرکت پیدا نشد.");
                switch (property)
                {
                    case "LogoDataBase64": company.LogoDataBase64 = encoded; break;
                    case "StampDataBase64": company.StampDataBase64 = encoded; break;
                    case "SignatureDataBase64": company.SignatureDataBase64 = encoded; break;
                }
            }, property switch
            {
                "LogoDataBase64" => "لوگوی شرکت ذخیره شد.",
                "StampDataBase64" => "تصویر مهر شرکت ذخیره شد.",
                _ => "تصویر امضای شرکت ذخیره شد."
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "ثبت تصویر شرکت", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void SaveCompanyProfile_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CompanyProfileSelector.SelectedItem is not CompanyProfileRecord selected)
        {
            MessageBox.Show(this, "برای ذخیره ابتدا پروفایل شرکت را انتخاب کنید.");
            return;
        }
        var name = CompanyProfileName.Text.Trim();
        if (name.Length < 2)
        {
            MessageBox.Show(this, "نام شرکت باید دست‌کم دو نویسه باشد.");
            return;
        }
        Commit(data =>
        {
            var company = data.Companies.FirstOrDefault(item => item.Id == selected.Id)
                ?? throw new InvalidOperationException("پروفایل شرکت پیدا نشد.");
            company.Name = name;
            company.LegalName = CompanyLegalName.Text.Trim();
            company.NationalId = CompanyNationalId.Text.Trim();
            company.TaxId = CompanyTaxId.Text.Trim();
            company.Phone = CompanyProfilePhone.Text.Trim();
            company.Branch = string.IsNullOrWhiteSpace(CompanyProfileBranch.Text) ? "مرکزی" : CompanyProfileBranch.Text.Trim();
            company.Address = CompanyProfileAddress.Text.Trim();
        }, "مشخصات پروفایل شرکت ذخیره شد.");
    }

    private List<string> GetSelectedInvoiceFootnotes()
    {
        var selected = new List<string>();
        if (SettingsFooterNoReturns.IsChecked == true) selected.Add(FooterNoteNoReturns);
        if (SettingsFooterPaymentTerms.IsChecked == true) selected.Add(FooterNotePaymentTerms);
        if (SettingsFooterDeliveryTerms.IsChecked == true) selected.Add(FooterNoteDeliveryTerms);
        selected.AddRange(CustomInvoiceFootnoteSelector.SelectedItems.Cast<object>().OfType<string>());
        return selected.Where(note => !string.IsNullOrWhiteSpace(note))
            .Distinct(StringComparer.Ordinal).ToList();
    }

    private string ConfiguredInvoiceFooter()
    {
        var notes = (_data.Preferences.SelectedInvoiceFootnotes ?? [])
            .Where(note => !string.IsNullOrWhiteSpace(note)).ToList();
        notes.AddRange((_data.Preferences.InvoiceFooter ?? "")
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(note => !string.IsNullOrWhiteSpace(note)));
        return string.Join(Environment.NewLine, notes.Distinct(StringComparer.Ordinal));
    }

    private void SaveAccountingPreferences_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        decimal taxRate;
        try { taxRate = PersianNumberParser.ParseDecimal(SettingsTaxRate.Text, "نرخ مالیات"); }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "تنظیمات حسابداری", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (taxRate < 0m || taxRate > 100m)
        {
            MessageBox.Show(this, "نرخ مالیات باید بین صفر تا ۱۰۰ درصد باشد.");
            return;
        }
        var theme = (InvoiceThemeSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "modern";
        var applicationTheme = ApplicationThemeService.Normalize((ApplicationThemeSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString());
        var currency = (SettingsCurrencySelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "RIAL";
        Commit(data =>
        {
            data.Preferences = new AccountingPreferences
            {
                InvoiceTheme = theme,
                ApplicationTheme = applicationTheme,
                ShowInvoiceQr = SettingsShowInvoiceQr.IsChecked == true,
                Currency = currency,
                DefaultTaxRatePercent = taxRate,
                SalesInvoicePrefix = string.IsNullOrWhiteSpace(SettingsInvoicePrefix.Text) ? "INV-" : SettingsInvoicePrefix.Text.Trim(),
                InvoiceFooter = SettingsInvoiceFooter.Text.Trim(),
                SelectedInvoiceFootnotes = GetSelectedInvoiceFootnotes(),
                CustomInvoiceFootnoteOptions = ParseCustomInvoiceFootnoteOptions(SettingsCustomFootnoteOptions.Text)
            };
        }, "تنظیمات حسابداری ذخیره شد؛ تم رابط کاربری اعمال شد.");
        ApplicationThemeService.Apply(this, _data.Preferences.ApplicationTheme);
    }

    private void SaveMoadianSettings_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var apiBase = MoadianApiBaseUrl.Text.Trim();
        if (!string.IsNullOrWhiteSpace(apiBase))
        {
            try { apiBase = ApiEndpointPolicy.ValidateBaseAddress(apiBase).ToString(); }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "نشانی API مؤدیان", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
        }
        var environment = (MoadianEnvironmentSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "Sandbox";
        Commit(data =>
        {
            data.MoadianSettings = new MoadianSettingsRecord
            {
                TaxpayerId = MoadianTaxpayerId.Text.Trim(),
                Environment = environment,
                ApiBaseUrl = apiBase,
                IsConfigured = MoadianIsConfigured.IsChecked == true
            };
        }, "پروفایل محلی مؤدی ذخیره شد؛ ارسال رسمی هنوز فعال نیست.");
    }

    private void BuildMoadianPayload_Click(object sender, RoutedEventArgs e)
    {
        var invoice = InvoicesGrid.SelectedItem as InvoiceRecord
            ?? _data.Invoices.LastOrDefault(item => item.Type == "SALE" && item.Status != "لغو شده");
        if (invoice is null)
        {
            MessageBox.Show(this, "برای ساخت JSON نمونه ابتدا یک فاکتور فروش ثبت و انتخاب کنید.");
            return;
        }

        var payload = new
        {
            previewOnly = true,
            submitted = false,
            environment = _data.MoadianSettings.Environment,
            taxpayerId = _data.MoadianSettings.TaxpayerId,
            company = ActiveCompanyProfile()?.LegalName,
            invoice = new
            {
                number = invoice.Number,
                trackingCode = invoice.TrackingCode,
                date = FormatPersianDate(invoice.CreatedAt),
                customer = invoice.CustomerName,
                total = invoice.Total,
                discount = invoice.Discount,
                tax = invoice.TaxAmount,
                items = invoice.Lines.Select(line => new
                {
                    product = line.ProductName,
                    quantity = line.Quantity,
                    unitPrice = line.UnitPrice,
                    lineTotal = line.LineTotal
                }).ToList()
            },
            note = "این JSON نمونه برای بازبینی رابط است؛ قالب رسمی و ارسال API پیاده‌سازی نشده است."
        };
        MoadianPayloadPreview.Text = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        FooterStatus.Text = "JSON نمونه ساخته شد؛ هیچ درخواستی به سامانهٔ مؤدیان ارسال نشده است.";
    }

    private void SaveServerConnection_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        Uri baseAddress;
        try { baseAddress = ApiEndpointPolicy.ValidateBaseAddress(ServerBaseUrl.Text); }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "نشانی سرور", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        var syncMode = (ServerSyncModeSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "manual";
        Commit(data =>
        {
            data.ServerConnection = new ServerConnectionSettings
            {
                BaseUrl = baseAddress.ToString(),
                WorkspaceId = ServerWorkspaceId.Text.Trim(),
                SyncMode = syncMode
            };
        }, "تنظیمات اتصال امن ذخیره شد؛ همگام‌سازی داده‌های مالی هنوز غیرفعال است.");
    }

    private void ValidateServerConnection_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var baseAddress = ApiEndpointPolicy.ValidateBaseAddress(ServerBaseUrl.Text);
            ServerConnectionStatusText.Text = "نشانی HTTPS معتبر: " + baseAddress.Host + "؛ API یا همگام‌سازی ارسال/آزمون نشد.";
            FooterStatus.Text = "فقط قالب نشانی سرور اعتبارسنجی شد؛ هیچ دادهٔ حسابداری ارسال نشده است.";
        }
        catch (Exception ex)
        {
            ServerConnectionStatusText.Text = "نشانی نامعتبر: " + ex.Message;
            MessageBox.Show(this, ex.Message, "اعتبارسنجی نشانی HTTPS", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    // Native navigation mirrors the existing Ashke Ghalam sidebar. Unported pages are
    // deliberately marked as pending instead of being represented by fake functionality.
    private sealed record NativeModuleLink(string Title, string Group, string OriginalRoute, int? NativeTabIndex);

    private static readonly IReadOnlyDictionary<string, NativeModuleLink> NativeModuleLinks =
        new Dictionary<string, NativeModuleLink>(StringComparer.Ordinal)
        {
            ["dashboard"] = new("پیشخوان", "منوی اصلی", "/", 0),
            ["invoices"] = new("فاکتورها", "منوی اصلی", "/invoices", 3),
            ["inventory"] = new("انبارداری", "منوی اصلی", "/inventory", 2),
            ["kardex"] = new("کارتکس کالا", "عملیات محلی موجود", "/inventory/kardex", 21),
            ["checks"] = new("مدیریت چک", "منوی اصلی", "/checks", 10),
            ["vouchers"] = new("حواله‌های انبار", "عملیات محلی موجود", "/inventory (حواله‌های انبار)", 11),
            ["finance"] = new("امور مالی", "منوی اصلی", "/finance", 12),
            ["customers"] = new("اشخاص", "منوی اصلی", "/customers", 1),
            ["companies"] = new("چندشرکتی و مشخصات شرکت", "تنظیمات حسابداری", "/settings/companies", 18),
            ["reports"] = new("گزارشات عمومی", "گزارشات و تحلیل", "/reports", 6),
            ["users"] = new("کاربران و سطح دسترسی", "تنظیمات و سیستم", "/users", null),
            ["payments"] = new("دریافت‌ها", "عملیات محلی موجود", "بخش دریافت‌های نسخه بومی", 4),
            ["expenses"] = new("هزینه‌ها", "عملیات محلی موجود", "بخش هزینه‌های نسخه بومی", 5),
            ["backup"] = new("پشتیبان‌گیری محلی", "عملیات محلی موجود", "پشتیبان محلی نسخه بومی", 9),
            ["projects"] = new("پروژه‌ها", "مدیریت کسب‌وکار", "/projects", null),
            ["contracts"] = new("قراردادها", "مدیریت کسب‌وکار", "/contracts", null),
            ["assets"] = new("دارایی‌های ثابت", "مدیریت کسب‌وکار", "/assets", null),
            ["budget"] = new("بودجه‌بندی", "مدیریت کسب‌وکار", "/budget", null),
            ["marketing"] = new("بازاریابی و سئو", "مدیریت کسب‌وکار", "/marketing", null),
            ["import-center"] = new("مرکز واردات اسناد", "مدیریت کسب‌وکار", "/import-center", null),
            ["accounting"] = new("حسابداری دوبل", "حسابداری پیشرفته", "/accounting", 12),
            ["cashflow-predictor"] = new("پیش‌بینی جریان نقدینگی", "حسابداری پیشرفته", "/cashflow-predictor", 17),
            ["cashflow"] = new("جریان نقدینگی", "حسابداری پیشرفته", "/cashflow", 17),
            ["tax"] = new("مدیریت مالیات", "حسابداری پیشرفته", "/tax", 19),
            ["loans"] = new("وام‌ها", "حسابداری پیشرفته", "/loans", null),
            ["due-calendar"] = new("تقویم سررسید و اقساط", "حسابداری پیشرفته", "/due-calendar", 8),
            ["bank-reconciliation"] = new("تطبیق بانکی", "حسابداری پیشرفته", "/bank-reconciliation", null),
            ["currency"] = new("مدیریت چندارزی", "حسابداری پیشرفته", "/currency", null),
            ["workflow-rules"] = new("قواعد گردش مالی", "حسابداری پیشرفته", "/workflow-rules", null),
            ["financial-reports"] = new("گزارشات مالی پیشرفته", "گزارشات و تحلیل", "/financial-reports", 7),
            ["ai-assistant"] = new("دستیار هوشمند مالی", "گزارشات و تحلیل", "/ai-assistant", null),
            ["signature-dashboard"] = new("داشبورد امضا", "امضای دیجیتال", "/signature-dashboard", null),
            ["signature-management"] = new("مدیریت امضا", "امضای دیجیتال", "/signature-management", null),
            ["moadian"] = new("سامانه مؤدیان مالیاتی", "حسابداری پیشرفته", "/moadian", 19),
            ["pos-terminal"] = new("کارتخوان بانکی", "خدمات تجاری و ابری", "/pos-terminal", null),
            ["cloud-vault"] = new("پشتیبان ابری", "خدمات تجاری و ابری", "/cloud-vault", null),
            ["sms-center"] = new("پنل پیامک هوشمند", "خدمات تجاری و ابری", "/sms-center", null),
            ["multi-user-lan"] = new("شبکه محلی چندکاربره", "خدمات تجاری و ابری", "/multi-user-lan", null),
            ["client-broadcast"] = new("اطلاعیه‌ها", "خدمات تجاری و ابری", "/client-broadcast", null),
            ["activation"] = new("اتصال سرور و فعال‌سازی لایسنس", "ارتباط با سرور", "/install-android (فقط اتصال/فعال‌سازی کلاینت)", 16),
            ["server"] = new("ارتباط با سرور اصلی", "تنظیمات حسابداری", "/data-sync", 20),
            ["mobile-catalog"] = new("کاتالوگ ویزیتوری همراه", "خدمات تجاری و ابری", "/mobile-catalog", null),
            ["catalog"] = new("کاتالوگ محصول", "خدمات تجاری و ابری", "/catalog", null),
            ["support-sla"] = new("پشتیبانی و تمدید", "خدمات تجاری و ابری", "/support-sla", null),
            ["fiscal-year"] = new("سال مالی", "تنظیمات و سیستم", "/fiscal-year", null),
            ["security"] = new("امنیت داده‌ها", "تنظیمات و سیستم", "/security", null),
            ["data-sync"] = new("همگام‌سازی داده‌ها", "ارتباط با سرور اصلی", "/data-sync", 20),
            ["advanced-settings"] = new("تنظیمات پیشرفته", "تنظیمات حسابداری", "/advanced-settings", 18),
            ["settings"] = new("تنظیمات حسابداری", "تنظیمات حسابداری", "/settings", 18),
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
