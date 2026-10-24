using System.Globalization;
using System.IO;
using System.ComponentModel;
using System.Security.Cryptography;
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
    private string _activeNavigationKey = "dashboard";
    // Holds the live theme choice until preferences are saved or the application is restarted.
    private string? _themePreviewOverride;
    private bool _gridMenusConfigured;
    private bool _allowClose;
    private readonly DispatcherTimer _automaticBackupTimer = new() { Interval = TimeSpan.FromMinutes(1) };
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
        Closing += MainWindow_Closing;
        Loaded += (_, _) => Dispatcher.BeginInvoke(DispatcherPriority.Loaded,
            new Action(() => PersianDateInputService.AttachNamedDateFields(this)));
        StateChanged += (_, _) => UpdateWindowStateButton();
        PreviewKeyDown += MainWindow_PreviewKeyDown;
        _automaticBackupTimer.Tick += AutomaticBackupTimer_Tick;
        NumericTextBoxFormatter.Attach(CurrencyConvertAmount);
    }

    private void WindowMinimize_Click(object sender, RoutedEventArgs e) =>
        WindowState = WindowState.Minimized;

    private void WindowMaximize_Click(object sender, RoutedEventArgs e) => ToggleWindowState();

    private void WindowClose_Click(object sender, RoutedEventArgs e) => Close();

    private void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (_allowClose || !_canWrite) return;
        var askBeforeExit = true;
        try { askBeforeExit = AutomaticBackupService.LoadSettings().PromptOnExit; }
        catch { /* Fail safe: still ask if local backup settings cannot be read. */ }
        if (!askBeforeExit) return;
        e.Cancel = true;
        var choice = MessageBox.Show(this,
            "پیش از خروج یک پشتیبان رمزگذاری‌شده بسازید؟\nبله: ذخیرهٔ پشتیبان و سپس خروج\nخیر: خروج بدون پشتیبان\nلغو: بازگشت به برنامه",
            "یادآوری پشتیبان‌گیری", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (choice == MessageBoxResult.Cancel) return;
        if (choice == MessageBoxResult.Yes &&
            !CreateManualBackupFromDialog("پشتیبان پیش از خروج", "AshkeGhalam-ExitBackup"))
            return;
        _allowClose = true;
        Close();
    }

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
        _themePreviewOverride = ApplicationThemeService.Normalize(selected.Tag?.ToString());
        ApplicationThemeService.Apply(this, _themePreviewOverride);
        UpdateNavigationSelection(_activeNavigationKey, _themePreviewOverride);
        ApplyContextMenuTheme();
    }

    private string CurrentApplicationTheme =>
        ApplicationThemeService.Normalize(_themePreviewOverride ?? _data.Preferences?.ApplicationTheme);

    private void ApplyCurrentThemeTo(Window dialog) =>
        ApplicationThemeService.ApplyWhenLoaded(dialog, CurrentApplicationTheme);

    private void ApplyMainWindowTheme()
    {
        var theme = CurrentApplicationTheme;
        ApplicationThemeService.Apply(this, theme);
        UpdateNavigationSelection(_activeNavigationKey, theme);
        ApplyContextMenuTheme();
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
            var checkImagesChanged = ProtectedCheckImageStore.Synchronize(_data.Checks);
            var companyConfigurationChanged = CompanyWorkspaceService.EnsureInitialized(_data);
            if (checkImagesChanged || companyConfigurationChanged)
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
            ApplyMainWindowTheme();
            // Always land on the usable dashboard instead of an empty hidden-tab shell.
            NavigateModule_Click(NavigationDashboardButton, new RoutedEventArgs());
            ConfigureGridContextMenus();
            RefreshFiscalYearPage();
            RefreshSecurityStatus();
            RefreshAutoBackupControls();
            ApplyCurrencyLabels();
            _automaticBackupTimer.Start();
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
        ApplyMainWindowTheme();
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (IsLoaded)
                ApplyMainWindowTheme();
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
            ProtectedCheckImageStore.Synchronize(next.Checks);
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
        SalesTotal.Text = sales.ToString("#,##0.##", CultureInfo.CurrentCulture);
        PurchasesTotal.Text = purchases.ToString("#,##0.##", CultureInfo.CurrentCulture);
        PaymentsTotal.Text = paid.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReceivablesTotal.Text = receivables.ToString("#,##0.##", CultureInfo.CurrentCulture);
        PayablesTotal.Text = payables.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ExpensesTotal.Text = expenses.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportSales.Text = sales.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportPurchases.Text = purchases.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportPayments.Text = paid.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportReceivables.Text = receivables.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportPayables.Text = payables.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportExpenses.Text = expenses.ToString("#,##0.##", CultureInfo.CurrentCulture);
        ReportCash.Text = (salesReceipts - purchasePayments - expenses).ToString("#,##0.##", CultureInfo.CurrentCulture);
        RefreshLedger();
        RefreshFinancialReports();
        RefreshDueCalendar();
        RefreshCashFlowForecast();
        RefreshAccountingConfigurationPanels();
        RefreshKardexModule();
        RefreshNativeFinancialModules();
        ApplyCurrencyLabels();
        RefreshFiscalYearLedger();
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
            $"جمع بدهکار: {totalDebit:#,##0.##}  •  جمع بستانکار: {totalCredit:#,##0.##}";
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
        ApplyCurrentThemeTo(dialog);
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
        ApplyCurrentThemeTo(dialog);
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
        static string Money(decimal value) => value.ToString("#,##0.##", CultureInfo.CurrentCulture);

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
            $"مبلغ معوق: {overdue.Sum(item => item.Amount).ToString("#,##0.##", CultureInfo.CurrentCulture)}";
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
        static string Money(decimal value) => value.ToString("#,##0.##", CultureInfo.CurrentCulture);

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

    private sealed record CurrencySelectorRow(string Code, string Label);
    private sealed record CurrencyRateGridRow(CurrencyRateRecord Record, string Code, string Name, string Symbol, decimal RialPerUnit, string RateStatus, string LastUpdatedLabel);
    private sealed record LoanGridRow(LoanRecord Record, string LoanNumber, string LenderName, decimal PrincipalAmount, decimal RemainingPrincipal, decimal AnnualInterestRatePercent, int InstallmentCount, string StartDateLabel, string CurrencyCode, string StatusLabel);
    private sealed record LoanInstallmentGridRow(LoanInstallmentRecord Record, string LoanNumber, int Number, string DueDateLabel, decimal PrincipalAmount, decimal InterestAmount, decimal TotalAmount, string StatusLabel, string PaidDateLabel);
    private sealed record BankAccountGridRow(BankAccountRecord Record, string BankName, string AccountNumberMasked, string CurrencyName, decimal OpeningBalance, decimal Balance, string StatusLabel);
    private sealed record BankTransactionGridRow(BankTransactionRecord Record, string DateLabel, string AccountName, string Description, string DirectionLabel, decimal Amount, string MovementLabel, string StatusLabel, string ReconciliationNote)
    {
        public string Reference => Record.Reference;
    }
    private sealed record BankAccountOption(string Id, string Label);
    private sealed record BankPaymentOption(string Id, string Label);
    private sealed record WorkflowRuleGridRow(string Rule, string Status, string Detail);

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

    private bool ConfirmCanAddDocuments(int additionalDocuments)
    {
        var decision = NativeLicenseQuotaService.CanAddDocuments(_data, GetLiveSessionEntitlements(), additionalDocuments);
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
        var dialog = new CustomerDialog(dialogOwner, suggestedCode: suggestedCode, knownPeople: _data.Customers);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true || dialog.Result is not CustomerRecord customer)
            return null;

        try
        {
            var next = _data.DeepCopy();
            RecordIdentityValidationService.EnsureUniquePersonCode(next.Customers, customer.Code);
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
        var dialog = new ProductDialog(dialogOwner, suggestedCode: suggestedCode, knownProducts: _data.Products);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true || dialog.Result is not ProductRecord product)
            return null;

        try
        {
            var next = _data.DeepCopy();
            RecordIdentityValidationService.EnsureUniqueProductCode(next.Products, product.Code);
            RecordIdentityValidationService.EnsureUniqueProductBarcode(next.Products, product.Barcode);
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
        var codePrefix = defaultSupplier ? "SUP-" : "CUS-";
        var suggestedCode = NextCode(_data.Customers.Select(person => person.Code), codePrefix);
        var dialog = new CustomerDialog(this, suggestedCode: suggestedCode, defaultSupplier: defaultSupplier, knownPeople: _data.Customers);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord customer)
            Commit(data =>
            {
                RecordIdentityValidationService.EnsureUniquePersonCode(data.Customers, customer.Code);
                data.Customers.Add(customer);
            }, defaultSupplier ? "پرونده تأمین‌کننده ذخیره شد" : "پرونده شخص ذخیره شد");
    }

    private void EditCustomer_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CustomersGrid.SelectedItem is not CustomerRecord selected) { MessageBox.Show(this, "یک مشتری را انتخاب کنید."); return; }
        var dialog = new CustomerDialog(this, selected, knownPeople: _data.Customers);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true && dialog.Result is CustomerRecord changed)
            Commit(data =>
            {
                RecordIdentityValidationService.EnsureUniquePersonCode(data.Customers, changed.Code, changed.Id);
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
        var dialog = new ProductDialog(this, suggestedCode: suggestedCode, knownProducts: _data.Products);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true && dialog.Result is ProductRecord product)
            Commit(data =>
            {
                RecordIdentityValidationService.EnsureUniqueProductCode(data.Products, product.Code);
                RecordIdentityValidationService.EnsureUniqueProductBarcode(data.Products, product.Barcode);
                data.Products.Add(product);
            }, "کالا و موجودی اولیه ذخیره شد");
    }

    private void EditProduct_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (ProductsGrid.SelectedItem is not ProductRecord selected) { MessageBox.Show(this, "یک کالا را انتخاب کنید."); return; }
        var dialog = new ProductDialog(this, selected, knownProducts: _data.Products);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true && dialog.Result is ProductRecord changed)
            Commit(data =>
            {
                RecordIdentityValidationService.EnsureUniqueProductCode(data.Products, changed.Code, changed.Id);
                RecordIdentityValidationService.EnsureUniqueProductBarcode(data.Products, changed.Barcode, changed.Id);
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
        KardexModuleSummary.Text = $"کالا: {product.Name}   |   کد: {product.Code}   |   موجودی فعلی: {product.StockQuantity.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))} {product.Unit}";
        KardexModuleGrid.ItemsSource = rows;
    }

    private void ShowKardexFromModule_Click(object sender, RoutedEventArgs e)
    {
        if (KardexModuleProductSelector.SelectedItem is not ProductRecord product)
        {
            MessageBox.Show(this, "ابتدا یک کالا را انتخاب کنید.", "کارتکس کالا", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var window = new KardexWindow(this, product, _data.InventoryMovements, _data.Invoices, _data.Vouchers);
        ApplyCurrentThemeTo(window);
        window.ShowDialog();
    }

    private void PrintKardexModule_Click(object sender, RoutedEventArgs e)
    {
        if (KardexModuleProductSelector.SelectedItem is not ProductRecord product ||
            KardexModuleGrid.ItemsSource is not IEnumerable<KardexModuleRow> source)
        {
            MessageBox.Show(this, "ابتدا یک کالا را انتخاب کنید تا گردش آن آمادهٔ چاپ شود.",
                "چاپ کارتکس", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var rows = source.ToList();
        if (rows.Count == 0)
        {
            MessageBox.Show(this, "برای کالای انتخاب‌شده ردیفی برای چاپ وجود ندارد.",
                "چاپ کارتکس", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var document = new FlowDocument
        {
            FlowDirection = FlowDirection.RightToLeft,
            FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"),
            FontSize = 9,
            PagePadding = new Thickness(28),
            ColumnWidth = 740,
            PageWidth = 816,
            PageHeight = 1056
        };
        var title = new Paragraph(new Run("کارتکس کالا و گردش موجودی"))
        {
            FontSize = 19,
            FontWeight = FontWeights.Bold,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 8)
        };
        document.Blocks.Add(title);
        document.Blocks.Add(new Paragraph(new Run(
            $"کالا: {product.Name}   •   کد: {product.Code}   •   واحد: {product.Unit}   •   موجودی ثبت‌شده: {product.StockQuantity.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}"))
        {
            FontSize = 11, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 5)
        });
        document.Blocks.Add(new Paragraph(new Run(
            $"شرکت: {ActiveCompanyProfile()?.Name ?? "اشک قلم"}   •   تاریخ چاپ: {FormatPersianDate(DateTimeOffset.Now)}   •   تعداد ردیف: {rows.Count:N0}"))
        {
            FontSize = 9, Margin = new Thickness(0, 0, 0, 10)
        });

        var table = new Table { CellSpacing = 0 };
        foreach (var width in new[] { 66d, 86d, 72d, 190d, 78d, 78d, 90d })
            table.Columns.Add(new TableColumn { Width = new GridLength(width) });

        var headerGroup = new TableRowGroup();
        var header = new TableRow();
        foreach (var heading in new[] { "تاریخ", "نوع گردش", "سند مرجع", "شرح", "ورودی", "خروجی", "مانده" })
            header.Cells.Add(CreateKardexPrintCell(heading, true));
        headerGroup.Rows.Add(header);
        table.RowGroups.Add(headerGroup);

        var body = new TableRowGroup();
        foreach (var row in rows)
        {
            var values = new[]
            {
                row.Date, row.Movement, row.Document, row.Description,
                row.Incoming.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")),
                row.Outgoing.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")),
                row.Balance.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))
            };
            var tableRow = new TableRow();
            foreach (var value in values)
                tableRow.Cells.Add(CreateKardexPrintCell(string.IsNullOrWhiteSpace(value) ? "—" : value, false));
            body.Rows.Add(tableRow);
        }
        table.RowGroups.Add(body);
        document.Blocks.Add(table);
        PrintBrandingService.AppendWebsiteFooter(document, 740);

        var dialog = new PrintDialog();
        if (dialog.ShowDialog() != true) return;
        try
        {
            var pageWidth = Math.Max(560, dialog.PrintableAreaWidth);
            var pageHeight = Math.Max(720, dialog.PrintableAreaHeight);
            document.PageWidth = pageWidth;
            document.PageHeight = pageHeight;
            document.ColumnWidth = Math.Max(500, pageWidth - document.PagePadding.Left - document.PagePadding.Right);
            dialog.PrintDocument(((IDocumentPaginatorSource)document).DocumentPaginator,
                $"AshkeGhalam-Kardex-{product.Code}-{DateTime.Now:yyyyMMdd-HHmm}");
            FooterStatus.Text = "کارتکس برای چاپ ارسال شد.";
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ کارتکس", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static TableCell CreateKardexPrintCell(string value, bool isHeader)
    {
        var cell = new TableCell(new Paragraph(new Run(value))
        {
            Margin = new Thickness(0),
            FontWeight = isHeader ? FontWeights.Bold : FontWeights.Normal,
            FontSize = isHeader ? 9 : 8,
            TextAlignment = TextAlignment.Right
        })
        {
            Padding = new Thickness(4, 5, 4, 5),
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(0.5),
            Background = isHeader
                ? new SolidColorBrush(Color.FromRgb(15, 118, 110))
                : Brushes.White,
            Foreground = isHeader ? Brushes.White : new SolidColorBrush(Color.FromRgb(15, 23, 42))
        };
        return cell;
    }

    private void ExportKardexModule_Click(object sender, RoutedEventArgs e)
    {
        if (KardexModuleProductSelector.SelectedItem is not ProductRecord product ||
            KardexModuleGrid.ItemsSource is not IEnumerable<KardexModuleRow> source)
        {
            MessageBox.Show(this, "ابتدا یک کالا را انتخاب کنید.", "خروجی کارتکس",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var rows = source.ToList();
        ExportCsv($"Kardex-{product.Code}-{DateTime.Now:yyyyMMdd}.csv",
            new[] { "DateJalali", "Movement", "Document", "Description", "Incoming", "Outgoing", "Balance", "Unit" },
            rows.Select(row => new[]
            {
                row.Date, row.Movement, row.Document, row.Description,
                row.Incoming.ToString(CultureInfo.InvariantCulture),
                row.Outgoing.ToString(CultureInfo.InvariantCulture),
                row.Balance.ToString(CultureInfo.InvariantCulture), product.Unit
            }));
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
        ApplyCurrentThemeTo(dialog);
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
            _data.Preferences.Currency, ConfiguredInvoiceFooter(),
            footerTemplates: InvoiceFootnoteTemplates(),
            accountingDataProvider: () => _data);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true && dialog.Result is InvoiceDraft draft)
        {
            var message = draft.Type switch
            {
                "PURCHASE" => "فاکتور خرید ثبت و موجودی به‌روزرسانی شد",
                "PROFORMA" => "پیش‌فاکتور ثبت شد؛ موجودی هنوز تغییر نکرده است",
                _ => "فاکتور فروش ثبت و موجودی به‌روزرسانی شد"
            };
            Commit(data =>
            {
                AccountingOperations.CreateInvoice(data, draft);
                StoreInvoiceFootnoteTemplate(data, dialog);
            }, message);
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
            _data.Preferences.Currency, ConfiguredInvoiceFooter(), invoice,
            footerTemplates: InvoiceFootnoteTemplates(),
            accountingDataProvider: () => _data);
        ApplyCurrentThemeTo(dialog);
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
            StoreInvoiceFootnoteTemplate(data, dialog);

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
        if (sender is not DataGrid grid ||
            e.OriginalSource is not DependencyObject original ||
            FindVisualAncestor<DataGridRow>(original) is null ||
            grid.SelectedItem is not InvoiceRecord)
            return;

        OpenGridContextMenu(grid);
        e.Handled = true;
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

        var relatedChecks = new List<CheckRecord>();
        if (string.Equals(payment.Method, "چک", StringComparison.Ordinal))
        {
            // New records use a stable payment ID. Fall back to the old invoice/amount
            // heuristic only for legacy checks created before this link existed.
            relatedChecks = _data.Checks.Where(check =>
                string.Equals(check.RelatedPaymentId, payment.Id, StringComparison.Ordinal)).ToList();
            if (relatedChecks.Count == 0)
            {
                relatedChecks = _data.Checks.Where(check =>
                    string.IsNullOrWhiteSpace(check.RelatedPaymentId) &&
                    string.Equals(check.RelatedInvoiceId, invoice.Id, StringComparison.Ordinal) &&
                    check.Amount == payment.Amount &&
                    string.Equals(check.CheckType, invoice.Type == "SALE" ? "RECEIVED" : "ISSUED", StringComparison.Ordinal)).ToList();
            }
        }
        new PaymentReceiptPreviewWindow(this, payment, invoice, ActiveCompanyProfile(),
            _data.Preferences.Currency, relatedChecks).ShowDialog();
    }

    private void AddPayment_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType(null);

    private void AddReceipt_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType("SALE");

    private void AddSupplierPayment_Click(object sender, RoutedEventArgs e) => AddPaymentForInvoiceType("PURCHASE");

    private void AddPaymentForInvoiceType(string? invoiceTypeFilter)
    {
        if (!RequireWritable() || !ConfirmCanAddDocument()) return;
        var dialog = new PaymentDialog(this, _data, invoiceTypeFilter, currencyCode: _data.Preferences.Currency);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true) return;

        CheckRecord? paymentCheck = null;
        if (string.Equals(dialog.Method, "چک", StringComparison.Ordinal))
        {
            // A check payment creates both a payment and a check record.
            if (!ConfirmCanAddDocuments(2)) return;
            var invoice = _data.Invoices.FirstOrDefault(item => item.Id == dialog.InvoiceId);
            if (invoice is null)
            {
                MessageBox.Show(this, "فاکتور مرجع دریافت/پرداخت پیدا نشد؛ چک مرتبط ثبت نشد.",
                    "ثبت سند چک", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var checkType = invoice.Type == "SALE" ? "RECEIVED" : "ISSUED";
            var checkDialog = new CheckDialog(this, null, _data.Customers, _data.Preferences.Currency,
                dialog.Amount, checkType, invoice.Id, invoice.CustomerId, invoice.CustomerName);
            ApplyCurrentThemeTo(checkDialog);
            if (checkDialog.ShowDialog() != true || checkDialog.Result is not CheckRecord createdCheck)
                return;
            if (createdCheck.Amount != dialog.Amount)
            {
                MessageBox.Show(this,
                    $"مبلغ چک ({FormatMoney(createdCheck.Amount)}) باید دقیقاً با مبلغ دریافت/پرداخت ({FormatMoney(dialog.Amount)}) برابر باشد.",
                    "تطبیق مبلغ چک", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            paymentCheck = createdCheck;
        }

        var message = invoiceTypeFilter switch
        {
            "SALE" => paymentCheck is null ? "دریافت از مشتری ثبت شد" : "دریافت از مشتری و سند چک دریافتی ثبت شد",
            "PURCHASE" => paymentCheck is null ? "پرداخت به تأمین‌کننده ثبت شد" : "پرداخت به تأمین‌کننده و سند چک پرداختی ثبت شد",
            _ => paymentCheck is null ? "عملیات دریافت/پرداخت ثبت شد" : "عملیات دریافت/پرداخت و سند چک ثبت شد"
        };
        Commit(data =>
        {
            var recordedPayment = AccountingOperations.RecordPayment(
                data, dialog.InvoiceId, dialog.Amount, dialog.Method, dialog.Reference);
            if (paymentCheck is not null)
            {
                if (!string.IsNullOrWhiteSpace(paymentCheck.SayadId) &&
                    data.Checks.Any(check => string.Equals(check.SayadId, paymentCheck.SayadId, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("شناسهٔ صیادی تکراری است.");
                paymentCheck.RelatedPaymentId = recordedPayment.Id;
                paymentCheck.RelatedInvoiceId = recordedPayment.InvoiceId;
                data.Checks.Add(paymentCheck);
            }
        }, message);
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

        var dialog = new ExpenseDialog(this, selected, _data.Expenses.Select(expense => expense.Category));
        ApplyCurrentThemeTo(dialog);
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
        if (MessageBox.Show(this, $"هزینه «{selected.Title}» با مبلغ {selected.Amount:#,##0.##} حذف شود؟",
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
        var dialog = new PaymentDialog(this, _data, existingPayment: selected, currencyCode: _data.Preferences.Currency);
        ApplyCurrentThemeTo(dialog);
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
        if (MessageBox.Show(this, $"عملیات {selected.Amount:#,##0.##} مربوط به فاکتور {selected.InvoiceNumber} حذف شود؟",
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
        var dialog = new ExpenseDialog(this, knownCategories: _data.Expenses.Select(expense => expense.Category));
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() == true)
            Commit(data => AccountingOperations.AddExpense(data, dialog.ExpenseTitle, dialog.Category, dialog.Amount, dialog.Notes), "هزینه ثبت شد");
    }

    private void CreateBackup_Click(object sender, RoutedEventArgs e) =>
        CreateManualBackupFromDialog("ساخت پشتیبان رمزگذاری‌شده", "AshkeGhalam-Backup");

    private bool CreateManualBackupFromDialog(string title, string fileNamePrefix)
    {
        var passwordDialog = new BackupPasswordDialog(this, title, confirmPassword: true);
        ApplyCurrentThemeTo(passwordDialog);
        if (passwordDialog.ShowDialog() != true) return false;
        var picker = new SaveFileDialog
        {
            Title = "انتخاب محل ذخیرهٔ فایل پشتیبان",
            Filter = "پشتیبان رمزگذاری‌شده اشک قلم (*.ashkbackup)|*.ashkbackup",
            AddExtension = true,
            DefaultExt = ".ashkbackup",
            InitialDirectory = Directory.Exists(AutomaticBackupService.BackupDirectory)
                ? AutomaticBackupService.BackupDirectory : AutomaticBackupService.DefaultBackupDirectory,
            FileName = $"{fileNamePrefix}-{DateTime.Now:yyyyMMdd-HHmmss}.ashkbackup"
        };
        if (picker.ShowDialog() != true) return false;
        try
        {
            var bytes = BackupFileService.CreateEncryptedBackup(_data, passwordDialog.Passphrase);
            try
            {
                using var stream = new FileStream(picker.FileName, FileMode.Create, FileAccess.Write,
                    FileShare.None, 64 * 1024, FileOptions.WriteThrough);
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(flushToDisk: true);
            }
            finally { CryptographicOperations.ZeroMemory(bytes); }

            FooterStatus.Text = "پشتیبان رمزگذاری‌شده ذخیره شد: " + picker.FileName;
            MessageBox.Show(this, "فایل پشتیبان رمزگذاری شد؛ رمز آن را جداگانه و امن نگه دارید.",
                "پشتیبان موفق", MessageBoxButton.OK, MessageBoxImage.Information);
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "خطا در پشتیبان‌گیری", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    private void RestoreBackup_Click(object sender, RoutedEventArgs e)
    {
        var picker = new OpenFileDialog
        {
            InitialDirectory = Directory.Exists(AutomaticBackupService.BackupDirectory)
                ? AutomaticBackupService.BackupDirectory : AutomaticBackupService.DefaultBackupDirectory,
            Title = "انتخاب فایل پشتیبان",
            Filter = "Ashke Ghalam encrypted backup (*.ashkbackup)|*.ashkbackup|All files (*.*)|*.*",
            CheckFileExists = true
        };
        if (picker.ShowDialog() != true) return;
        var dialog = new BackupPasswordDialog(this, "رمز فایل پشتیبان", confirmPassword: false);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true) return;

        try
        {
            var restored = BackupFileService.ReadEncryptedBackup(File.ReadAllBytes(picker.FileName), dialog.Passphrase);
            var choice = MessageBox.Show(this,
                $"پشتیبان رمزگشایی و اعتبارسنجی شد: {restored.Customers.Count:N0} شخص، {restored.Products.Count:N0} کالا، " +
                $"{restored.Invoices.Count:N0} فاکتور و {restored.Checks.Count:N0} چک.\n\nاطلاعات محلی با این پشتیبان جایگزین شود؟",
                "تأیید بازیابی پشتیبان", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (choice != MessageBoxResult.Yes) return;

            if (_canWrite)
            {
                var backupCurrent = MessageBox.Show(this,
                    "پیش از جایگزینی، از اطلاعات فعلی یک پشتیبان مستقل تهیه شود؟\nبله: پشتیبان و سپس بازیابی\nخیر: بازیابی بدون پشتیبان فعلی\nلغو: انصراف",
                    "حفاظت از اطلاعات فعلی", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
                if (backupCurrent == MessageBoxResult.Cancel) return;
                if (backupCurrent == MessageBoxResult.Yes &&
                    !CreateManualBackupFromDialog("پشتیبان پیش از بازیابی", "AshkeGhalam-BeforeRestore"))
                    return;
            }

            // Store the self-contained dataset before updating the optional image mirror.
            _store.Save(restored);
            var imageWarning = "";
            try
            {
                if (ProtectedCheckImageStore.Synchronize(restored.Checks))
                    _store.Save(restored);
            }
            catch (Exception imageEx)
            {
                imageWarning = "\n\nهشدار: کپی جداگانهٔ محافظت‌شدهٔ بعضی تصاویر چک ساخته نشد؛ دادهٔ تصویر داخل پایگاه محلی حفظ شده است. " + imageEx.Message;
            }

            _data = restored;
            _canWrite = true;
            _startupAccountingWarning = "";
            StorageStatus.Text = "ذخیره‌سازی محلی آماده";
            RefreshAll();
            RefreshFiscalYearPage();
            RefreshSecurityStatus();
            RefreshAutoBackupControls();
            ApplyMainWindowTheme();
            FooterStatus.Text = imageWarning.Length == 0
                ? "بازیابی پشتیبان با موفقیت انجام شد."
                : "بازیابی انجام شد؛ کپی جداگانهٔ بعضی تصاویر نیازمند بررسی است.";
            MessageBox.Show(this, "بازیابی انجام شد." + imageWarning,
                imageWarning.Length == 0 ? "بازیابی موفق" : "بازیابی با هشدار",
                MessageBoxButton.OK, imageWarning.Length == 0 ? MessageBoxImage.Information : MessageBoxImage.Warning);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "بازیابی انجام نشد: " + ex.Message, "خطا در بازیابی",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ShowPersonKardex_Click(object sender, RoutedEventArgs e)
    {
        if (CustomersGrid.SelectedItem is not CustomerRecord person)
        {
            MessageBox.Show(this, "ابتدا یک شخص را از جدول انتخاب کنید.", "کاردکس اشخاص",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var window = new PersonKardexWindow(this, person, _data);
        ApplyCurrentThemeTo(window);
        window.ShowDialog();
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


    private void PrintSystemReports_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var report = FinancialReportsService.Build(_data);
            var cashFlow = CashFlowForecastService.Build(_data, SelectedCashFlowHorizonDays());
            var activeInvoices = _data.Invoices.Where(invoice => invoice.Status != "لغو شده").ToList();
            var sales = activeInvoices.Where(invoice => invoice.Type == "SALE").Sum(invoice => invoice.Total);
            var purchases = activeInvoices.Where(invoice => invoice.Type == "PURCHASE").Sum(invoice => invoice.Total);
            var receipts = _data.Payments.Where(payment => _data.Invoices.Any(invoice =>
                invoice.Id == payment.InvoiceId && invoice.Type == "SALE")).Sum(payment => payment.Amount);
            var supplierPayments = _data.Payments.Where(payment => _data.Invoices.Any(invoice =>
                invoice.Id == payment.InvoiceId && invoice.Type == "PURCHASE")).Sum(payment => payment.Amount);
            var expenses = _data.Expenses.Sum(expense => expense.Amount);
            var unit = CurrencyUnitLabel();
            string Money(decimal value) => value.ToString("#,##0.##", CultureInfo.InvariantCulture) + " " + unit;

            var document = new FlowDocument
            {
                FlowDirection = FlowDirection.RightToLeft,
                PagePadding = new Thickness(42),
                FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"),
                FontSize = 12,
                ColumnWidth = 720
            };
            document.Blocks.Add(new Paragraph(new Run(ActiveCompanyProfile()?.LegalName ?? "اشک قلم"))
            {
                FontSize = 18, FontWeight = FontWeights.Bold,
                TextAlignment = TextAlignment.Right, Margin = new Thickness(0,0,0,8)
            });
            document.Blocks.Add(new Paragraph(new Run("گزارش جامع حسابداری"))
            {
                FontSize = 22, FontWeight = FontWeights.Bold,
                TextAlignment = TextAlignment.Right
            });
            document.Blocks.Add(new Paragraph(new Run(
                $"تاریخ تهیه: {FormatPersianDate(DateTimeOffset.Now)}    •    واحد اصلی ثبت: {unit}"))
            {
                TextAlignment = TextAlignment.Right, Margin = new Thickness(0,0,0,14)
            });

            void AddSection(string title, IEnumerable<(string Label, string Value)> rows)
            {
                document.Blocks.Add(new Paragraph(new Run(title))
                {
                    FontSize = 15, FontWeight = FontWeights.Bold,
                    TextAlignment = TextAlignment.Right, Margin = new Thickness(0,12,0,6)
                });
                var table = new Table { CellSpacing = 0, FlowDirection = FlowDirection.RightToLeft };
                table.Columns.Add(new TableColumn { Width = new GridLength(2, GridUnitType.Star) });
                table.Columns.Add(new TableColumn { Width = new GridLength(3, GridUnitType.Star) });
                var group = new TableRowGroup();
                var header = new TableRow();
                foreach (var label in new[] { "عنوان", "مقدار" })
                    header.Cells.Add(new TableCell(new Paragraph(new Run(label)))
                    {
                        Background = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                        FontWeight = FontWeights.Bold,
                        Padding = new Thickness(7),
                        BorderBrush = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                        BorderThickness = new Thickness(0.5)
                    });
                group.Rows.Add(header);
                var rowNumber = 0;
                foreach (var row in rows)
                {
                    var tableRow = new TableRow();
                    foreach (var value in new[] { row.Label, row.Value })
                        tableRow.Cells.Add(new TableCell(new Paragraph(new Run(value)))
                        {
                            Background = rowNumber++ % 4 < 2 ? Brushes.White : new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                            Padding = new Thickness(7),
                            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                            BorderThickness = new Thickness(0.5)
                        });
                    group.Rows.Add(tableRow);
                }
                table.RowGroups.Add(group);
                document.Blocks.Add(table);
            }

            AddSection("گزارش خلاصه", new (string Label, string Value)[]
            {
                ("فروش ثبت‌شده", Money(sales)),
                ("خرید ثبت‌شده", Money(purchases)),
                ("دریافت بابت فروش", Money(receipts)),
                ("پرداخت بابت خرید", Money(supplierPayments)),
                ("هزینه‌ها", Money(expenses)),
                ("مطالبات فروش", Money(activeInvoices.Where(invoice => invoice.Type == "SALE").Sum(invoice => AccountingRules.RemainingForInvoice(_data, invoice)))),
                ("پرداختنی خرید", Money(activeInvoices.Where(invoice => invoice.Type == "PURCHASE").Sum(invoice => AccountingRules.RemainingForInvoice(_data, invoice))))
            });
            AddSection("گزارش مالی دفتر", new (string Label, string Value)[]
            {
                ("درآمد ثبت‌شده", Money(report.Revenue)),
                ("بهای تمام‌شده", Money(report.CostOfSales)),
                ("سود ناخالص", Money(report.GrossProfit)),
                ("هزینه‌های عملیاتی", Money(report.OperatingExpenses)),
                ("سود / زیان خالص", Money(report.NetProfit)),
                ("دارایی‌ها", Money(report.Assets)),
                ("بدهی‌ها", Money(report.Liabilities)),
                ("حقوق مالکانه", Money(report.Equity)),
                ("کنترل اختلاف تراز", Money(report.BalanceSheetDifference))
            });
            AddSection("پیش‌بینی جریان نقدینگی", new (string Label, string Value)[]
            {
                ("مانده آغازین", Money(cashFlow.OpeningBalance)),
                ("ورودی پیش‌بینی‌شده", Money(cashFlow.TotalExpectedInflows)),
                ("خروجی پیش‌بینی‌شده", Money(cashFlow.TotalExpectedOutflows)),
                ("مانده پایان پیش‌بینی", Money(cashFlow.ProjectedClosingBalance)),
                ("افق پیش‌بینی", $"{cashFlow.HorizonDays} روز")
            });
            document.Blocks.Add(new Paragraph(new Run(
                "این گزارش از داده‌های محلی ثبت‌شده ساخته شده است؛ تأیید صحت حساب‌ها و اسناد بر عهدهٔ کاربر است."))
            {
                FontSize = 9, Foreground = Brushes.DimGray,
                TextAlignment = TextAlignment.Right, Margin = new Thickness(0,16,0,0)
            });
            PrintBrandingService.AppendWebsiteFooter(document, 720);

            var printDialog = new PrintDialog();
            if (printDialog.ShowDialog() != true) return;
            document.PageWidth = printDialog.PrintableAreaWidth;
            document.PageHeight = printDialog.PrintableAreaHeight;
            document.ColumnWidth = Math.Max(100, document.PageWidth - document.PagePadding.Left - document.PagePadding.Right);
            printDialog.PrintDocument(((IDocumentPaginatorSource)document).DocumentPaginator, "گزارش جامع حسابداری اشک قلم");
            FooterStatus.Text = "گزارش برای چاپ ارسال شد.";
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ گزارش", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }


    private static void AddFinancialField(Panel panel, string label, Control control)
    {
        var field = new StackPanel { Margin = new Thickness(0, 0, 0, 10) };
        field.Children.Add(new TextBlock
        {
            Text = label, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 0, 0, 5)
        });
        control.MinHeight = Math.Max(control.MinHeight, 34);
        field.Children.Add(control);
        panel.Children.Add(field);
    }

    private void RefreshNativeFinancialModules()
    {
        NativeFinancialModuleService.EnsureDefaults(_data);
        CurrencyRatesGrid.ItemsSource = null;
        CurrencyRatesGrid.ItemsSource = _data.CurrencyRates
            .OrderBy(rate => rate.Code is "IRR" or "IRT" ? 0 : 1)
            .ThenBy(rate => rate.Code, StringComparer.Ordinal)
            .Select(rate => new CurrencyRateGridRow(rate, rate.Code, rate.Name, rate.Symbol, rate.RialPerUnit,
                rate.IsRateConfigured ? "نرخ ثبت شده" : "نیازمند ثبت نرخ",
                rate.LastUpdated == DateTimeOffset.MinValue ? "ثبت نشده" : FormatPersianDate(rate.LastUpdated)))
            .ToList();

        FromCurrencySelector.ItemsSource = null;
        FromCurrencySelector.ItemsSource = _data.CurrencyRates
            .Select(rate => new CurrencySelectorRow(rate.Code, $"{rate.Name} ({rate.Code})")).ToList();
        FromCurrencySelector.DisplayMemberPath = nameof(CurrencySelectorRow.Label);
        FromCurrencySelector.SelectedValuePath = nameof(CurrencySelectorRow.Code);
        if (FromCurrencySelector.SelectedValue is null)
            FromCurrencySelector.SelectedValue = NativeFinancialModuleService.BaseCurrencyCode(_data);

        ToCurrencySelector.ItemsSource = null;
        ToCurrencySelector.ItemsSource = _data.CurrencyRates
            .Select(rate => new CurrencySelectorRow(rate.Code, $"{rate.Name} ({rate.Code})")).ToList();
        ToCurrencySelector.DisplayMemberPath = nameof(CurrencySelectorRow.Label);
        ToCurrencySelector.SelectedValuePath = nameof(CurrencySelectorRow.Code);
        if (ToCurrencySelector.SelectedValue is null)
            ToCurrencySelector.SelectedValue = string.Equals(_data.Preferences.Currency, "TOMAN", StringComparison.Ordinal)
                ? "IRR" : "IRT";
        CurrencyBaseStatus.Text = $"واحد اصلی ثبت: {CurrencyUnitLabel()} • نرخ ریال/تومان ثابت است؛ نرخ ارزهای دیگر فقط پس از ثبت نرخ معتبر استفاده می‌شود.";

        LoansGrid.ItemsSource = null;
        LoansGrid.ItemsSource = _data.Loans.OrderByDescending(loan => loan.StartDate)
            .Select(loan => new LoanGridRow(loan, loan.LoanNumber, loan.LenderName, loan.PrincipalAmount,
                loan.RemainingPrincipal, loan.AnnualInterestRatePercent, loan.InstallmentCount,
                FormatPersianDate(loan.StartDate), loan.CurrencyCode,
                loan.Status == "PAID" ? "تسویه‌شده" : loan.Status == "CANCELLED" ? "لغو" : "فعال")).ToList();
        LoanInstallmentsGrid.ItemsSource = null;
        LoanInstallmentsGrid.ItemsSource = _data.LoanInstallments
            .OrderBy(item => item.Status == "PENDING" ? 0 : 1).ThenBy(item => item.DueDate)
            .ThenBy(item => item.InstallmentNumber)
            .Select(item => new LoanInstallmentGridRow(item,
                _data.Loans.FirstOrDefault(loan => loan.Id == item.LoanId)?.LoanNumber ?? "—",
                item.InstallmentNumber, FormatPersianDate(item.DueDate), item.PrincipalAmount,
                item.InterestAmount, item.TotalAmount,
                item.Status == "PAID" ? "پرداخت شده" : item.Status == "CANCELLED" ? "لغو" : "در انتظار",
                item.PaidAt is DateTimeOffset paidAt ? FormatPersianDate(paidAt) : "—")).ToList();
        LoanSummaryText.Text = $"وام‌ها: {_data.Loans.Count:N0} • اقساط پرداخت‌نشده: {_data.LoanInstallments.Count(item => item.Status == "PENDING"):N0} • ماندهٔ اصل وام فعال: {FormatMoney(_data.Loans.Where(loan => loan.Status == "ACTIVE").Sum(loan => loan.RemainingPrincipal))}";

        BankAccountsGrid.ItemsSource = null;
        BankAccountsGrid.ItemsSource = _data.BankAccounts.OrderBy(account => account.BankName, StringComparer.Ordinal)
            .Select(account => new BankAccountGridRow(account, account.BankName, account.AccountNumberMasked,
                _data.CurrencyRates.FirstOrDefault(rate => rate.Code == account.CurrencyCode)?.Name ?? account.CurrencyCode,
                account.OpeningBalance, NativeFinancialModuleService.BankAccountBalance(_data, account),
                account.IsActive ? "فعال" : "غیرفعال")).ToList();
        BankTransactionsGrid.ItemsSource = null;
        BankTransactionsGrid.ItemsSource = _data.BankTransactions.OrderByDescending(transaction => transaction.Date)
            .Select(transaction => new BankTransactionGridRow(transaction, FormatPersianDate(transaction.Date),
                _data.BankAccounts.FirstOrDefault(account => account.Id == transaction.BankAccountId)?.BankName ?? "حساب حذف‌شده",
                transaction.Description, transaction.Direction == "CREDIT" ? "واریز" : "برداشت",
                transaction.Amount, transaction.Direction == "CREDIT" ? "ورودی" : "خروجی",
                transaction.IsReconciled ? "بررسی/تطبیق‌شده" : "تطبیق‌نشده", transaction.ReconciliationNote)).ToList();

        WorkflowRulesGrid.ItemsSource = new[]
        {
            new WorkflowRuleGridRow("کنترل موجودی آزاد هنگام ثبت فروش", "فعال", "فروش با موجودی ناکافی رد می‌شود."),
            new WorkflowRuleGridRow("جلوگیری از تسویهٔ بیش از مانده", "فعال", "مبلغ دریافت/پرداخت از ماندهٔ فاکتور تجاوز نمی‌کند."),
            new WorkflowRuleGridRow("حفاظت تاریخچهٔ اسناد مالی", "فعال", "فاکتور دارای پرداخت، چک یا سند دفتر مستقیم ویرایش نمی‌شود."),
            new WorkflowRuleGridRow("اعتبارسنجی چک صیادی", "فعال", "شناسهٔ صیادی تکراری و پیوند ناسازگار رد می‌شود."),
            new WorkflowRuleGridRow("تراز سند دفتر", "فعال", "هر ثبت دوبل، مبلغ مساوی در بدهکار و بستانکار دارد."),
            new WorkflowRuleGridRow("تطبیق بانکی", "فعال", "تطبیق خودکار مبلغ و جهت ورود/خروج را بررسی می‌کند.")
        };
        FinancialRulesStatus.Text = "۶ قاعدهٔ عملیاتی هنگام ثبت و اعتبارسنجی داده‌ها اعمال می‌شوند.";
    }

    private void AddCurrencyRate_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var codeBox = new TextBox { Text = "XXX", FlowDirection = FlowDirection.LeftToRight, MaxLength = 6 };
        var nameBox = new TextBox();
        var symbolBox = new TextBox { FlowDirection = FlowDirection.LeftToRight, MaxLength = 8 };
        var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
        form.Children.Add(new TextBlock { Text = "افزودن ارز", FontSize = 21, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,12) });
        AddFinancialField(form, "کد انگلیسی ارز (۳ تا ۶ نویسه)", codeBox);
        AddFinancialField(form, "نام ارز", nameBox);
        AddFinancialField(form, "نماد ارز", symbolBox);
        form.Children.Add(new TextBlock
        {
            Text = "نرخ ارز جدید خالی می‌ماند تا نرخ معتبر آن را وارد کنید؛ نرخ بازار به‌صورت فرضی تولید نمی‌شود.",
            TextWrapping = TextWrapping.Wrap, Foreground = new SolidColorBrush(Color.FromRgb(146,64,14)), Margin = new Thickness(0,0,0,12)
        });
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var save = new Button { Content = "افزودن ارز", MinWidth = 120, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
        var cancel = new Button { Content = "انصراف", MinWidth = 100, IsCancel = true };
        actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
        var window = new Window { Owner = this, Title = "افزودن ارز", Width = 450, Height = 380, MinWidth = 420,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, ResizeMode = ResizeMode.CanResize,
            FlowDirection = FlowDirection.RightToLeft, Content = form, Background = Brushes.White };
        ApplyCurrentThemeTo(window);
        save.Click += (_, _) =>
        {
            var code = codeBox.Text.Trim().ToUpperInvariant();
            if (code.Length is < 3 or > 6 || !code.All(char.IsAsciiLetterOrDigit) || nameBox.Text.Trim().Length < 2)
            {
                MessageBox.Show(window, "کد انگلیسی ارز و نام معتبر وارد کنید.", "ارز نامعتبر", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            try
            {
                Commit(data =>
                {
                    if (data.CurrencyRates.Any(rate => string.Equals(rate.Code, code, StringComparison.OrdinalIgnoreCase)))
                        throw new InvalidOperationException("این کد ارز از قبل وجود دارد.");
                    data.CurrencyRates.Add(new CurrencyRateRecord
                    {
                        Code = code, Name = nameBox.Text.Trim(), Symbol = symbolBox.Text.Trim(),
                        RialPerUnit = 0m, IsRateConfigured = false, LastUpdated = DateTimeOffset.MinValue
                    });
                }, "ارز جدید اضافه شد؛ نرخ معتبر آن را جداگانه ثبت کنید.");
                window.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(window, ex.Message, "افزودن ارز", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        window.ShowDialog();
    }

    private void UpdateCurrencyRate_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (CurrencyRatesGrid.SelectedItem is not CurrencyRateGridRow selected)
        {
            MessageBox.Show(this, "ابتدا یک ارز را از جدول انتخاب کنید.");
            return;
        }
        if (selected.Record.Code is "IRR" or "IRT")
        {
            MessageBox.Show(this, "نسبت ریال و تومان ثابت است: هر تومان برابر ۱۰ ریال.", "نرخ ثابت", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var rateBox = new TextBox
        {
            Text = selected.Record.IsRateConfigured ? selected.Record.RialPerUnit.ToString(CultureInfo.InvariantCulture) : "",
            FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right
        };
        NumericTextBoxFormatter.Attach(rateBox);
        var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
        form.Children.Add(new TextBlock { Text = $"ثبت نرخ «{selected.Record.Name}»", FontSize = 20, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,10) });
        AddFinancialField(form, "چند ریال برابر یک واحد از این ارز است؟", rateBox);
        form.Children.Add(new TextBlock { Text = "نرخ را از منبع معتبر وارد کنید؛ برنامه آن را حدسی تعیین نمی‌کند.", TextWrapping = TextWrapping.Wrap, Foreground = new SolidColorBrush(Color.FromRgb(100,116,139)), Margin = new Thickness(0,0,0,14) });
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var save = new Button { Content = "ذخیره نرخ", MinWidth = 110, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
        var cancel = new Button { Content = "انصراف", MinWidth = 90, IsCancel = true };
        actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
        var window = new Window { Owner = this, Title = "ثبت نرخ ارز", Width = 440, Height = 300,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, ResizeMode = ResizeMode.CanResize,
            FlowDirection = FlowDirection.RightToLeft, Content = form, Background = Brushes.White };
        ApplyCurrentThemeTo(window);
        save.Click += (_, _) =>
        {
            try
            {
                var rate = PersianNumberParser.ParseDecimal(rateBox.Text, "نرخ ارز");
                var probe = _data.DeepCopy();
                NativeFinancialModuleService.SetRate(probe, selected.Record.Code, rate);
                AccountingDataValidator.Validate(probe);
                Commit(data => NativeFinancialModuleService.SetRate(data, selected.Record.Code, rate), $"نرخ {selected.Record.Code} ذخیره شد.");
                window.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(window, ex.Message, "نرخ ارز", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        window.ShowDialog();
    }

    private void ConvertCurrency_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var amount = PersianNumberParser.ParseDecimal(CurrencyConvertAmount.Text, "مبلغ");
            var from = FromCurrencySelector.SelectedValue?.ToString() ?? "";
            var to = ToCurrencySelector.SelectedValue?.ToString() ?? "";
            var converted = NativeFinancialModuleService.ConvertCurrencyAmount(_data, amount, from, to);
            var targetName = _data.CurrencyRates.FirstOrDefault(rate => rate.Code == to)?.Name ?? to;
            CurrencyConvertedAmount.Text = $"{converted.ToString("#,##0.####", CultureInfo.InvariantCulture)} {targetName}";
            CurrencyConvertedAmount.FlowDirection = FlowDirection.LeftToRight;
            FooterStatus.Text = $"تبدیل ارز {from} به {to} بر اساس نرخ ثبت‌شده محاسبه شد.";
        }
        catch (Exception ex)
        {
            CurrencyConvertedAmount.Text = "قابل محاسبه نیست";
            MessageBox.Show(this, ex.Message, "تبدیل ارز", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void AddLoan_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var lender = new TextBox();
        var principal = new TextBox { Text = "1000000", FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        var interest = new TextBox { Text = "0", FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        var count = new TextBox { Text = "12", FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        var start = new TextBox { Text = FormatPersianDate(DateTimeOffset.Now), FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        PersianDateInputService.Attach(start);
        var notes = new TextBox { MinHeight = 56, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
        var funding = new ComboBox { MinWidth = 200 };
        funding.Items.Add(new ComboBoxItem { Content = "واریز به بانک", Tag = "1120" });
        funding.Items.Add(new ComboBoxItem { Content = "واریز به صندوق", Tag = "1110" });
        funding.SelectedIndex = 0;
        NumericTextBoxFormatter.Attach(principal);
        NumericTextBoxFormatter.Attach(interest);
        NumericTextBoxFormatter.Attach(count);
        var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
        form.Children.Add(new TextBlock { Text = "ثبت وام جدید", FontSize = 22, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,12) });
        AddFinancialField(form, "نام وام‌دهنده", lender);
        AddFinancialField(form, $"اصل وام ({CurrencyUnitLabel()})", principal);
        AddFinancialField(form, "نرخ بهرهٔ سالانه (درصد)", interest);
        AddFinancialField(form, "تعداد اقساط ماهانه", count);
        AddFinancialField(form, "تاریخ شروع شمسی (سال/ماه/روز)", start);
        AddFinancialField(form, "حساب دریافت وام", funding);
        AddFinancialField(form, "توضیحات", notes);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var save = new Button { Content = "ثبت و ایجاد اقساط", MinWidth = 160, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
        var cancel = new Button { Content = "انصراف", MinWidth = 90, IsCancel = true };
        actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
        var window = new Window { Owner = this, Title = "وام جدید", Width = 520, Height = 650, MinWidth = 480, MinHeight = 520,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, ResizeMode = ResizeMode.CanResize,
            FlowDirection = FlowDirection.RightToLeft, Content = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = form },
            Background = Brushes.White };
        ApplyCurrentThemeTo(window);
        save.Click += (_, _) =>
        {
            try
            {
                var principalValue = PersianNumberParser.ParseDecimal(principal.Text, "اصل وام");
                var interestValue = PersianNumberParser.ParseDecimal(interest.Text, "بهرهٔ سالانه");
                var installmentCountValue = PersianNumberParser.ParseDecimal(count.Text, "تعداد اقساط");
                if (installmentCountValue != decimal.Truncate(installmentCountValue) ||
                    installmentCountValue > int.MaxValue)
                    throw new InvalidOperationException("تعداد اقساط باید عدد صحیح باشد.");
                var countValue = decimal.ToInt32(installmentCountValue);
                var startDate = NativeFinancialModuleService.ParsePersianDate(start.Text);
                var startValue = new DateTimeOffset(startDate, TimeZoneInfo.Local.GetUtcOffset(startDate));
                var fundingCode = (funding.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "1120";
                var probe = _data.DeepCopy();
                NativeFinancialModuleService.CreateLoan(probe, lender.Text, principalValue, interestValue, countValue, startValue, fundingCode, notes.Text);
                AccountingDataValidator.Validate(probe);
                Commit(data => NativeFinancialModuleService.CreateLoan(data, lender.Text, principalValue, interestValue, countValue, startValue, fundingCode, notes.Text),
                    "وام ثبت شد؛ برنامهٔ اقساط و سند دریافت وام ایجاد شدند.");
                window.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(window, ex.Message, "ثبت وام", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        window.ShowDialog();
    }

    private void PayLoanInstallment_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (LoanInstallmentsGrid.SelectedItem is not LoanInstallmentGridRow selected)
        {
            MessageBox.Show(this, "ابتدا یک قسط را انتخاب کنید.");
            return;
        }
        if (selected.Record.Status != "PENDING")
        {
            MessageBox.Show(this, "فقط قسط در انتظار قابل تسویه است.");
            return;
        }
        var account = (LoanPaymentAccountSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "1120";
        if (MessageBox.Show(this,
            $"قسط {selected.Number} وام {selected.LoanNumber} به مبلغ {FormatMoney(selected.TotalAmount)} از حساب {(account == "1120" ? "بانک" : "صندوق")} پرداخت شود؟",
            "تأیید بازپرداخت", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        Commit(data => NativeFinancialModuleService.PayInstallment(data, selected.Record.Id, account),
            "قسط پرداخت شد و سند اصل/بهره در دفتر ثبت شد.");
    }

    private void AddBankAccount_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var bankName = new TextBox();
        var number = new TextBox { FlowDirection = FlowDirection.LeftToRight, MaxLength = 34 };
        var currency = new ComboBox
        {
            ItemsSource = _data.CurrencyRates, DisplayMemberPath = nameof(CurrencyRateRecord.Name),
            SelectedValuePath = nameof(CurrencyRateRecord.Code), MinWidth = 220
        };
        currency.SelectedValue = NativeFinancialModuleService.BaseCurrencyCode(_data);
        var opening = new TextBox { Text = "0", FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        var notes = new TextBox();
        NumericTextBoxFormatter.Attach(opening);
        var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
        form.Children.Add(new TextBlock { Text = "افزودن حساب بانکی", FontSize = 22, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,12) });
        AddFinancialField(form, "نام بانک / مؤسسه", bankName);
        AddFinancialField(form, "شماره حساب (فقط چهار رقم آخر در فهرست نشان داده می‌شود)", number);
        AddFinancialField(form, "ارز حساب", currency);
        AddFinancialField(form, $"مانده افتتاحیه ({CurrencyUnitLabel()})", opening);
        AddFinancialField(form, "توضیحات", notes);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var save = new Button { Content = "ذخیره حساب", MinWidth = 120, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
        var cancel = new Button { Content = "انصراف", MinWidth = 90, IsCancel = true };
        actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
        var window = new Window { Owner=this, Title="حساب بانکی جدید", Width=500, Height=470,
            WindowStartupLocation=WindowStartupLocation.CenterOwner, ResizeMode=ResizeMode.CanResize,
            FlowDirection=FlowDirection.RightToLeft, Content=form, Background=Brushes.White };
        ApplyCurrentThemeTo(window);
        save.Click += (_, _) =>
        {
            try
            {
                var code = currency.SelectedValue?.ToString() ?? "";
                var digits = new string(number.Text.Where(char.IsAsciiDigit).ToArray());
                var lastFour = digits.Length > 4 ? digits[^4..] : digits;
                var openingValue = PersianNumberParser.ParseDecimal(opening.Text, "مانده افتتاحیه");
                if (bankName.Text.Trim().Length < 2 || code.Length == 0 || openingValue < 0m)
                    throw new InvalidOperationException("نام بانک، ارز و ماندهٔ افتتاحیه را بررسی کنید.");
                Commit(data => data.BankAccounts.Add(new BankAccountRecord
                {
                    BankName=bankName.Text.Trim(), AccountNumberMasked=lastFour, CurrencyCode=code,
                    OpeningBalance=AccountingRules.Money(openingValue), IsActive=true, Notes=notes.Text.Trim()
                }), "حساب بانکی ذخیره شد.");
                window.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(window, ex.Message, "حساب بانکی", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        window.ShowDialog();
    }

    private void AddBankTransaction_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var activeAccounts = _data.BankAccounts.Where(account => account.IsActive).ToList();
        if (activeAccounts.Count == 0)
        {
            MessageBox.Show(this, "ابتدا یک حساب بانکی ثبت کنید.");
            return;
        }
        var selector = new ComboBox
        {
            ItemsSource = activeAccounts.Select(account => new BankAccountOption(account.Id,
                $"{account.BankName} •••• {account.AccountNumberMasked} ({account.CurrencyCode})")).ToList(),
            DisplayMemberPath = nameof(BankAccountOption.Label), SelectedValuePath = nameof(BankAccountOption.Id),
            MinWidth = 280, SelectedIndex = 0
        };
        var date = new TextBox { Text = FormatPersianDate(DateTimeOffset.Now), FlowDirection = FlowDirection.LeftToRight };
        PersianDateInputService.Attach(date);
        var description = new TextBox();
        var direction = new ComboBox();
        direction.Items.Add(new ComboBoxItem { Content = "واریز / ورودی", Tag = "CREDIT" });
        direction.Items.Add(new ComboBoxItem { Content = "برداشت / خروجی", Tag = "DEBIT" });
        direction.SelectedIndex = 0;
        var amount = new TextBox { Text = "0", FlowDirection = FlowDirection.LeftToRight, HorizontalContentAlignment = HorizontalAlignment.Right };
        var reference = new TextBox { FlowDirection = FlowDirection.LeftToRight };
        NumericTextBoxFormatter.Attach(amount);
        var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
        form.Children.Add(new TextBlock { Text = "ثبت گردش صورت‌حساب بانک", FontSize = 22, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,12) });
        AddFinancialField(form, "حساب بانکی", selector);
        AddFinancialField(form, "تاریخ شمسی", date);
        AddFinancialField(form, "شرح تراکنش", description);
        AddFinancialField(form, "جهت گردش", direction);
        AddFinancialField(form, $"مبلغ ({CurrencyUnitLabel()})", amount);
        AddFinancialField(form, "شماره پیگیری / مرجع", reference);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var save = new Button { Content = "ثبت تراکنش", MinWidth = 120, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
        var cancel = new Button { Content = "انصراف", MinWidth = 90, IsCancel = true };
        actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
        var window = new Window { Owner=this, Title="تراکنش بانکی", Width=520, Height=560,
            WindowStartupLocation=WindowStartupLocation.CenterOwner, ResizeMode=ResizeMode.CanResize,
            FlowDirection=FlowDirection.RightToLeft, Content=new ScrollViewer { VerticalScrollBarVisibility=ScrollBarVisibility.Auto, Content=form },
            Background=Brushes.White };
        ApplyCurrentThemeTo(window);
        save.Click += (_, _) =>
        {
            try
            {
                var accountId = selector.SelectedValue?.ToString() ?? "";
                var amountValue = PersianNumberParser.ParseDecimal(amount.Text, "مبلغ");
                var dateValue = NativeFinancialModuleService.ParsePersianDate(date.Text);
                var offsetDate = new DateTimeOffset(dateValue, TimeZoneInfo.Local.GetUtcOffset(dateValue));
                var directionValue = (direction.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "CREDIT";
                var probe = _data.DeepCopy();
                NativeFinancialModuleService.AddBankTransaction(probe, accountId, offsetDate, description.Text, directionValue, amountValue, reference.Text);
                AccountingDataValidator.Validate(probe);
                Commit(data => NativeFinancialModuleService.AddBankTransaction(data, accountId, offsetDate, description.Text, directionValue, amountValue, reference.Text),
                    "گردش صورت‌حساب ثبت شد؛ اکنون می‌توانید آن را تطبیق دهید.");
                window.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(window, ex.Message, "تراکنش بانکی", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        window.ShowDialog();
    }

    private void ReconcileBankTransaction_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (BankTransactionsGrid.SelectedItem is not BankTransactionGridRow selected)
        {
            MessageBox.Show(this, "ابتدا یک تراکنش بانکی انتخاب کنید.");
            return;
        }
        if (selected.Record.IsReconciled)
        {
            MessageBox.Show(this, "این تراکنش قبلاً بررسی یا تطبیق شده است.");
            return;
        }
        var account = _data.BankAccounts.FirstOrDefault(item => item.Id == selected.Record.BankAccountId);
        var baseCode = NativeFinancialModuleService.BaseCurrencyCode(_data);
        var options = account?.CurrencyCode == baseCode
            ? _data.Payments
                .Where(payment => payment.Amount == selected.Record.Amount &&
                    !_data.BankTransactions.Any(transaction => transaction.Id != selected.Record.Id && transaction.LinkedPaymentId == payment.Id))
                .Select(payment => new { Payment = payment, Invoice = _data.Invoices.FirstOrDefault(invoice => invoice.Id == payment.InvoiceId) })
                .Where(pair => pair.Invoice is not null &&
                    ((selected.Record.Direction == "CREDIT" && pair.Invoice.Type == "SALE") ||
                     (selected.Record.Direction == "DEBIT" && pair.Invoice.Type == "PURCHASE")))
                .Select(pair => new BankPaymentOption(pair.Payment.Id,
                    $"{pair.Invoice!.DisplayNumber} • {pair.Invoice.CustomerName} • {pair.Payment.Amount.ToString("#,##0.##", CultureInfo.InvariantCulture)} {CurrencyUnitLabel()} • {pair.Payment.Method}"))
                .ToList()
            : [];

        if (options.Count == 0)
        {
            var note = new TextBox { MinHeight = 42, Padding = new Thickness(8), TextWrapping = TextWrapping.Wrap };
            var form = new StackPanel { Margin = new Thickness(22), FlowDirection = FlowDirection.RightToLeft };
            form.Children.Add(new TextBlock { Text = "بررسی دستی گردش", FontSize = 20, FontWeight = FontWeights.Bold, Margin = new Thickness(0,0,0,10) });
            form.Children.Add(new TextBlock { Text = "تطبیق خودکار دقیق پیدا نشد. پس از بررسی صورت‌حساب، شماره مرجع یا دلیل بررسی را وارد کنید.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0,0,0,10) });
            AddFinancialField(form, "مرجع / توضیح بررسی", note);
            var save = new Button { Content = "ثبت بررسی دستی", MinWidth = 130, Background = new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground = Brushes.White };
            var cancel = new Button { Content = "انصراف", MinWidth = 90, IsCancel = true };
            var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
            actions.Children.Add(save); actions.Children.Add(cancel); form.Children.Add(actions);
            var window = new Window { Owner=this, Title="تطبیق بانکی", Width=480, Height=300,
                WindowStartupLocation=WindowStartupLocation.CenterOwner, ResizeMode=ResizeMode.CanResize,
                FlowDirection=FlowDirection.RightToLeft, Content=form, Background=Brushes.White };
            ApplyCurrentThemeTo(window);
            save.Click += (_, _) =>
            {
                try
                {
                    Commit(data => NativeFinancialModuleService.MarkBankTransactionReviewed(data, selected.Record.Id, note.Text),
                        "تراکنش با یادداشت بررسی دستی علامت‌گذاری شد.");
                    window.DialogResult = true;
                }
                catch (Exception ex) { MessageBox.Show(window, ex.Message, "تطبیق بانکی", MessageBoxButton.OK, MessageBoxImage.Warning); }
            };
            window.ShowDialog();
            return;
        }

        var selector = new ComboBox { ItemsSource=options, DisplayMemberPath=nameof(BankPaymentOption.Label),
            SelectedValuePath=nameof(BankPaymentOption.Id), MinWidth=380, SelectedIndex=0 };
        var body = new StackPanel { Margin=new Thickness(22), FlowDirection=FlowDirection.RightToLeft };
        body.Children.Add(new TextBlock { Text="تطبیق تراکنش با سند مالی", FontSize=20, FontWeight=FontWeights.Bold, Margin=new Thickness(0,0,0,10) });
        body.Children.Add(new TextBlock { Text="فقط سندهای هم‌مبلغ و دارای جهت ورود/خروج سازگار نمایش داده می‌شوند.", TextWrapping=TextWrapping.Wrap, Margin=new Thickness(0,0,0,10) });
        AddFinancialField(body, "دریافت/پرداخت متناظر", selector);
        var confirm = new Button { Content="تأیید تطبیق", MinWidth=120, Background=new SolidColorBrush(Color.FromRgb(15,118,110)), Foreground=Brushes.White };
        var cancel2 = new Button { Content="انصراف", MinWidth=90, IsCancel=true };
        var actions2 = new StackPanel { Orientation=Orientation.Horizontal, HorizontalAlignment=HorizontalAlignment.Left };
        actions2.Children.Add(confirm); actions2.Children.Add(cancel2); body.Children.Add(actions2);
        var dialog = new Window { Owner=this, Title="تطبیق بانکی", Width=580, Height=300, MinWidth=500,
            WindowStartupLocation=WindowStartupLocation.CenterOwner, ResizeMode=ResizeMode.CanResize,
            FlowDirection=FlowDirection.RightToLeft, Content=body, Background=Brushes.White };
        ApplyCurrentThemeTo(dialog);
        confirm.Click += (_, _) =>
        {
            try
            {
                var paymentId = selector.SelectedValue?.ToString() ?? "";
                Commit(data => NativeFinancialModuleService.ReconcileBankTransaction(data, selected.Record.Id, paymentId),
                    "تراکنش بانکی با سند مالی تطبیق شد.");
                dialog.DialogResult = true;
            }
            catch (Exception ex) { MessageBox.Show(dialog, ex.Message, "تطبیق بانکی", MessageBoxButton.OK, MessageBoxImage.Warning); }
        };
        dialog.ShowDialog();
    }

    private void ValidateFinancialRules_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            AccountingDataValidator.Validate(_data.DeepCopy());
            var candidate = _data.DeepCopy();
            NativeOperationalPostingService.Reconcile(candidate);
            AccountingDataValidator.Validate(candidate);
            var added = Math.Max(0, candidate.JournalEntries.Count - _data.JournalEntries.Count);
            FinancialRulesStatus.Text = $"اعتبارسنجی موفق • {_data.Invoices.Count:N0} فاکتور • {_data.Checks.Count:N0} چک • {_data.JournalEntries.Count:N0} سند دفتر • {added:N0} سند عملیاتی قابل بازسازی";
            MessageBox.Show(this, FinancialRulesStatus.Text, "بررسی قواعد گردش مالی", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            FinancialRulesStatus.Text = "خطای اعتبارسنجی: " + ex.Message;
            MessageBox.Show(this, ex.Message, "قواعد گردش مالی", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void RebuildAutomaticLedgerEntries_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        Commit(_ => { }, "قواعد گردش مالی اعمال شدند؛ اسناد عملیاتی خودکار بازسازی و داده‌ها اعتبارسنجی شدند.");
    }

    private void ExportMoadianPayload_Click(object sender, RoutedEventArgs e)
    {
        MoadianPayloadPreview.Text = "";
        BuildMoadianPayload_Click(this, new RoutedEventArgs());
        if (string.IsNullOrWhiteSpace(MoadianPayloadPreview.Text)) return;
        var picker = new SaveFileDialog
        {
            Title = "ذخیرهٔ JSON آماده‌سازی مؤدیان",
            Filter = "JSON (*.json)|*.json",
            AddExtension = true, DefaultExt = ".json",
            FileName = $"Moadian-Payload-{DateTime.Now:yyyyMMdd-HHmmss}.json"
        };
        if (picker.ShowDialog() != true) return;
        try
        {
            File.WriteAllText(picker.FileName, MoadianPayloadPreview.Text, Encoding.UTF8);
            FooterStatus.Text = "JSON نمونه ذخیره شد؛ این فایل به سازمان ارسال نشده است.";
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "ذخیره JSON", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

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
        ApplyCurrentThemeTo(dialog);
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
        ApplyCurrentThemeTo(dialog);
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
                v.PersonName, v.RelatedInvoiceId, string.Join("؛ ", v.Items.Select(i => $"{i.ProductName} ({i.Quantity:#,##0.##} {i.Unit})")),
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
        var dialog = new CheckDialog(this, null, _data.Customers, _data.Preferences.Currency);
        ApplyCurrentThemeTo(dialog);
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
        var dialog = new CheckDialog(this, selected, _data.Customers, _data.Preferences.Currency);
        ApplyCurrentThemeTo(dialog);
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

    private void PreviewCheck_Click(object sender, RoutedEventArgs e)
    {
        if (ChecksGrid.SelectedItem is not CheckGridRow selectedRow)
        {
            MessageBox.Show(this, "ابتدا یک چک را انتخاب کنید.", "پیش‌نمایش سند چک",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        new CheckPreviewWindow(this, selectedRow.Record, ActiveCompanyProfile(), _data.Preferences.Currency).ShowDialog();
    }

    private void SpendCheck_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var receivedChecks = ChecksGrid.SelectedItems.OfType<CheckGridRow>()
            .Select(row => row.Record).DistinctBy(check => check.Id).ToList();
        if (receivedChecks.Count == 0 && ChecksGrid.SelectedItem is CheckGridRow selectedRow)
            receivedChecks.Add(selectedRow.Record);
        if (receivedChecks.Count == 0)
        {
            MessageBox.Show(this, "یک یا چند چک را با Ctrl/Shift از جدول انتخاب کنید.", "واگذاری چک",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        var ineligible = receivedChecks.Where(check =>
            check.CheckType != "RECEIVED" || check.Status is not ("PENDING" or "DEPOSITED")).ToList();
        if (ineligible.Count > 0)
        {
            MessageBox.Show(this,
                $"واگذاری گروهی انجام نشد. تمام چک‌های انتخابی باید دریافتی و در وضعیت «در انتظار» یا «واگذار به بانک» باشند. تعداد نامعتبر: {ineligible.Count}",
                "وضعیت چک‌ها", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (!ConfirmCanAddDocuments(receivedChecks.Count)) return;
        var payeeChoices = InvoicePartySelectionService.GetAllSelectableParties(_data.Customers);
        var payee = new ComboBox
        {
            IsEditable = true, IsTextSearchEnabled = false, StaysOpenOnEdit = true,
            DisplayMemberPath = nameof(CustomerRecord.Name),
            MinWidth = 330, Height = 36,
            ToolTip = "نام، کد، تلفن یا ایمیل شخص را جست‌وجو کنید."
        };
        SmartComboBoxSearchService.SetItems(payee, payeeChoices,
            person => new[] { person.Name, person.Code, person.Phone, person.Email });
        var note = new TextBox { MinWidth = 330, Height = 72, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
        var totalAmount = receivedChecks.Sum(check => check.Amount);
        var dialog = new Window
        {
            Owner = this, Title = "خرج / واگذاری گروهی چک‌های دریافتی",
            Width = 520, Height = 450, MinWidth = 450, WindowStartupLocation = WindowStartupLocation.CenterOwner,
            FlowDirection = FlowDirection.RightToLeft, ResizeMode = ResizeMode.NoResize,
            FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"),
            Background = new SolidColorBrush(Color.FromRgb(248, 250, 252))
        };
        var form = new StackPanel { Margin = new Thickness(22) };
        form.Children.Add(new TextBlock
        {
            Text = $"تعداد چک: {receivedChecks.Count:N0}\nجمع مبلغ: {NumericTextBoxFormatter.Format(totalAmount)} {CurrencyUnitLabel()}",
            FontSize = 17, FontWeight = FontWeights.Bold, TextWrapping = TextWrapping.Wrap,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)), Margin = new Thickness(0, 0, 0, 12)
        });
        AddLabeledControl(form, "دارنده / ذی‌نفع جدید برای همهٔ چک‌های انتخابی", payee);
        form.Children.Add(new TextBlock
        {
            Text = "نام، کد یا تلفن را جست‌وجو و نتیجه را انتخاب کنید؛ برای شخص ثبت‌نشده نام را دستی وارد کنید.",
            FontSize = 11, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8)
        });
        AddLabeledControl(form, "شرح خرج / علت واگذاری", note);
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 14, 0, 0) };
        var confirm = new Button { Content = $"ثبت واگذاری {receivedChecks.Count:N0} چک", Width = 170, Height = 36, IsDefault = true, Background = new SolidColorBrush(Color.FromRgb(15, 118, 110)), Foreground = Brushes.White };
        confirm.Click += (_, _) =>
        {
            if (string.IsNullOrWhiteSpace(payee.Text) || payee.Text.Trim().Length < 2)
            {
                MessageBox.Show(dialog, "نام دارنده / ذی‌نفع جدید را وارد کنید.");
                return;
            }
            dialog.DialogResult = true;
        };
        buttons.Children.Add(confirm);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, Margin = new Thickness(8, 0, 0, 0), IsCancel = true });
        form.Children.Add(buttons);
        dialog.Content = form;
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true) return;
        var selectedPayee = payee.SelectedItem as CustomerRecord;
        if (selectedPayee is not null &&
            !string.Equals(selectedPayee.Name, payee.Text.Trim(), StringComparison.CurrentCultureIgnoreCase))
            selectedPayee = null;
        var ids = receivedChecks.Select(check => check.Id).ToArray();
        Commit(data => CheckTransferService.TransferToPerson(data, ids, payee.Text.Trim(), selectedPayee?.Id, note.Text.Trim()),
            $"{receivedChecks.Count:N0} چک به مبلغ {NumericTextBoxFormatter.Format(totalAmount)} {CurrencyUnitLabel()} واگذار شد؛ سوابق و تصاویر حفظ شدند.");
    }

    private static void AddLabeledControl(Panel root, string label, FrameworkElement field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 7, 0, 4)
        });
        root.Children.Add(field);
    }

    private void ChangeCheckStatus_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        if (FindName("ChecksGrid") is not DataGrid grid || grid.SelectedItem is not CheckGridRow selectedRow)
        { MessageBox.Show(this, "ابتدا یک چک را انتخاب کنید."); return; }
        var selected = selectedRow.Record;
        var dialog = new CheckStatusDialog(this, selected.Status);
        ApplyCurrentThemeTo(dialog);
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
        var jalaliYear = new PersianCalendar().GetYear(DateTime.Now).ToString(CultureInfo.InvariantCulture);
        if (string.IsNullOrWhiteSpace(_data.Preferences.ActiveFiscalYear))
            _data.Preferences.ActiveFiscalYear = jalaliYear;
        if (string.IsNullOrWhiteSpace(_data.Preferences.FiscalYearStartDate))
            _data.Preferences.FiscalYearStartDate = _data.Preferences.ActiveFiscalYear + "/01/01";
        if (string.IsNullOrWhiteSpace(_data.Preferences.FiscalYearEndDate))
        {
            var year = int.TryParse(_data.Preferences.ActiveFiscalYear, out var parsedYear) ? parsedYear : int.Parse(jalaliYear, CultureInfo.InvariantCulture);
            var finalDay = new PersianCalendar().GetDaysInMonth(year, 12);
            _data.Preferences.FiscalYearEndDate = string.Format(CultureInfo.InvariantCulture, "{0:0000}/12/{1:00}", year, finalDay);
        }
        _data.MoadianSettings ??= new MoadianSettingsRecord();
        _data.ServerConnection ??= new ServerConnectionSettings();
        NativeFinancialModuleService.EnsureDefaults(_data);

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

        var themeSelection = ApplicationThemeService.Normalize(_themePreviewOverride ?? _data.Preferences.ApplicationTheme);
        ApplicationThemeSelector.SelectedItem = ApplicationThemeSelector.Items.OfType<ComboBoxItem>()
            .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), themeSelection, StringComparison.Ordinal))
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

    private IReadOnlyList<string> InvoiceFootnoteTemplates()
    {
        var lines = new List<string>
        {
            FooterNoteNoReturns, FooterNotePaymentTerms, FooterNoteDeliveryTerms
        };
        lines.AddRange(_data.Preferences?.CustomInvoiceFootnoteOptions ?? []);
        lines.AddRange((_data.Preferences?.InvoiceFooter ?? "").Split(
            new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return lines.Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()).Distinct(StringComparer.Ordinal).ToList();
    }

    private static void StoreInvoiceFootnoteTemplate(AccountingData data, InvoiceDialog dialog)
    {
        if (!dialog.SaveFooterAsTemplate || string.IsNullOrWhiteSpace(dialog.FooterTemplateToSave)) return;
        data.Preferences.CustomInvoiceFootnoteOptions ??= [];
        var template = dialog.FooterTemplateToSave.Trim();
        if (!data.Preferences.CustomInvoiceFootnoteOptions.Contains(template, StringComparer.Ordinal))
            data.Preferences.CustomInvoiceFootnoteOptions.Add(template);
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
        _themePreviewOverride = applicationTheme;
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
                CustomInvoiceFootnoteOptions = ParseCustomInvoiceFootnoteOptions(SettingsCustomFootnoteOptions.Text),
                ActiveFiscalYear = data.Preferences.ActiveFiscalYear,
                FiscalYearStartDate = data.Preferences.FiscalYearStartDate,
                FiscalYearEndDate = data.Preferences.FiscalYearEndDate
            };
        }, "تنظیمات حسابداری ذخیره شد؛ تم رابط کاربری اعمال شد.");
        ApplyMainWindowTheme();
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
        }, "تنظیمات اتصال امن ذخیره شد. همگام‌سازی دستی در همین صفحه در دسترس است.");
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


    private sealed record GridMenuAction(string Label, RoutedEventHandler Handler);

    private void ConfigureGridContextMenus()
    {
        if (_gridMenusConfigured) return;
        _gridMenusConfigured = true;

        AttachGridContextMenu(InvoicesGrid,
            new GridMenuAction("👁 پیش‌نمایش", PreviewInvoice_Click),
            new GridMenuAction("🖨 چاپ سند", PrintInvoice_Click),
            new GridMenuAction("✏️ ویرایش", EditInvoice_Click),
            new GridMenuAction("💳 ثبت دریافت / پرداخت", AddPayment_Click),
            new GridMenuAction("↩ لغو سند", CancelInvoice_Click),
            new GridMenuAction("🗑 حذف پیش‌فاکتور", DeleteInvoice_Click));

        AttachGridContextMenu(ChecksGrid,
            new GridMenuAction("👁 نمایش / 🖨 چاپ چک", PreviewCheck_Click),
            new GridMenuAction("✏️ ویرایش چک", EditCheck_Click),
            new GridMenuAction("↗ خرج / واگذاری چک دریافتی", SpendCheck_Click),
            new GridMenuAction("🔄 تغییر وضعیت و سابقه", ChangeCheckStatus_Click),
            new GridMenuAction("🗑 حذف چک مجاز", DeleteCheck_Click));

        AttachGridContextMenu(PaymentsGrid,
            new GridMenuAction("👁 نمایش / 🖨 چاپ رسید", PreviewPaymentReceipt_Click),
            new GridMenuAction("✏️ ویرایش دریافت / پرداخت", EditPayment_Click),
            new GridMenuAction("🗑 حذف دریافت / پرداخت", DeletePayment_Click));

        AttachGridContextMenu(ExpensesGrid,
            new GridMenuAction("✏️ ویرایش هزینه", EditExpense_Click),
            new GridMenuAction("🗑 حذف هزینه", DeleteExpense_Click));

        AttachGridContextMenu(CustomersGrid,
            new GridMenuAction("✏️ ویرایش شخص", EditCustomer_Click),
            new GridMenuAction("📒 کارتکس / گردش حساب", ShowPersonKardex_Click),
            new GridMenuAction("🗑 حذف شخص", DeleteCustomer_Click));

        AttachGridContextMenu(ProductsGrid,
            new GridMenuAction("📊 کارتکس کالا / چاپ", ShowKardex_Click),
            new GridMenuAction("✏️ ویرایش کالا", EditProduct_Click),
            new GridMenuAction("🗑 حذف کالا", DeleteProduct_Click));

        AttachGridContextMenu(VouchersGrid,
            new GridMenuAction("👁 نمایش / 🖨 چاپ حواله", PreviewVoucher_Click),
            new GridMenuAction("✏️ ویرایش حواله", EditVoucher_Click),
            new GridMenuAction("🔄 تغییر وضعیت حواله", AdvanceVoucherStatus_Click),
            new GridMenuAction("🗑 حذف حواله", DeleteVoucher_Click));

        AttachGridContextMenu(RecentInvoicesGrid,
            new GridMenuAction("👁 پیش‌نمایش فاکتور", PreviewInvoice_Click));

        // InvoicesGrid already has a named XAML double-click handler; other tables are wired here.
        foreach (var grid in new[] { ChecksGrid, PaymentsGrid, ExpensesGrid, CustomersGrid, ProductsGrid, VouchersGrid, RecentInvoicesGrid })
            grid.MouseDoubleClick += Grid_MouseDoubleClickToOpenMenu;
        ApplyContextMenuTheme();
    }

    private void AttachGridContextMenu(DataGrid grid, params GridMenuAction[] actions)
    {
        var menu = new ContextMenu
        {
            Placement = System.Windows.Controls.Primitives.PlacementMode.MousePoint,
            StaysOpen = false
        };
        foreach (var action in actions)
        {
            var item = new MenuItem { Header = action.Label, Padding = new Thickness(10, 7, 16, 7), FontSize = 13 };
            item.Click += (_, _) =>
            {
                menu.IsOpen = false;
                action.Handler(this, new RoutedEventArgs());
            };
            menu.Items.Add(item);
        }
        grid.ContextMenu = menu;
        grid.ContextMenuOpening += (_, _) => ApplyContextMenuTheme(menu);
    }

    private void Grid_MouseDoubleClickToOpenMenu(object sender, MouseButtonEventArgs e)
    {
        if (sender is not DataGrid grid) return;
        if (e.OriginalSource is not DependencyObject original || FindVisualAncestor<DataGridRow>(original) is null)
            return;
        OpenGridContextMenu(grid);
        e.Handled = true;
    }

    private static T? FindVisualAncestor<T>(DependencyObject? current) where T : DependencyObject
    {
        while (current is not null)
        {
            if (current is T match) return match;
            current = current is Visual || current is System.Windows.Media.Media3D.Visual3D
                ? VisualTreeHelper.GetParent(current)
                : LogicalTreeHelper.GetParent(current);
        }
        return null;
    }

    private void OpenGridContextMenu(DataGrid grid)
    {
        if (grid.ContextMenu is not ContextMenu menu) return;
        menu.PlacementTarget = grid;
        menu.Placement = System.Windows.Controls.Primitives.PlacementMode.MousePoint;
        ApplyContextMenuTheme(menu);
        menu.IsOpen = true;
    }

    private void ApplyContextMenuTheme()
    {
        foreach (var grid in new[] { InvoicesGrid, ChecksGrid, PaymentsGrid, ExpensesGrid, CustomersGrid, ProductsGrid, VouchersGrid, RecentInvoicesGrid })
            if (grid.ContextMenu is ContextMenu menu) ApplyContextMenuTheme(menu);
    }

    private void ApplyContextMenuTheme(ContextMenu menu)
    {
        var dark = ApplicationThemeService.Normalize(_data.Preferences?.ApplicationTheme) == "dark";
        menu.Background = new SolidColorBrush(dark ? Color.FromRgb(17, 24, 39) : Color.FromRgb(255, 255, 255));
        menu.BorderBrush = new SolidColorBrush(dark ? Color.FromRgb(71, 85, 105) : Color.FromRgb(203, 213, 225));
        menu.Foreground = new SolidColorBrush(dark ? Color.FromRgb(241, 245, 249) : Color.FromRgb(15, 23, 42));
        foreach (var item in menu.Items.OfType<MenuItem>())
        {
            item.Foreground = menu.Foreground;
            item.Background = menu.Background;
        }
    }

    private void MainWindow_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        var modifiers = Keyboard.Modifiers;
        if (modifiers == ModifierKeys.Control && e.Key == Key.N)
        {
            AddInvoice_Click(this, new RoutedEventArgs());
            e.Handled = true;
            return;
        }
        if (modifiers == (ModifierKeys.Control | ModifierKeys.Shift) && e.Key == Key.C)
        {
            AddCheck_Click(this, new RoutedEventArgs());
            e.Handled = true;
            return;
        }
        if (modifiers == ModifierKeys.Control && e.Key == Key.B)
        {
            CreateBackup_Click(this, new RoutedEventArgs());
            e.Handled = true;
            return;
        }
        if (modifiers == ModifierKeys.Control && e.Key == Key.P)
        {
            switch (MainTabs.SelectedIndex)
            {
                case 3: PrintInvoice_Click(this, new RoutedEventArgs()); break;
                case 10: PreviewCheck_Click(this, new RoutedEventArgs()); break;
                case 4: PreviewPaymentReceipt_Click(this, new RoutedEventArgs()); break;
                case 11: PreviewVoucher_Click(this, new RoutedEventArgs()); break;
                default: PreviewInvoice_Click(this, new RoutedEventArgs()); break;
            }
            e.Handled = true;
            return;
        }
        if (modifiers == ModifierKeys.Control)
        {
            var tabIndex = e.Key switch
            {
                Key.D1 or Key.NumPad1 => 0,
                Key.D2 or Key.NumPad2 => 1,
                Key.D3 or Key.NumPad3 => 2,
                Key.D4 or Key.NumPad4 => 3,
                Key.D5 or Key.NumPad5 => 4,
                Key.D6 or Key.NumPad6 => 5,
                _ => -1
            };
            if (tabIndex >= 0)
            {
                if (MainTabs is not null && MigrationPanel is not null)
                {
                    MigrationPanel.Visibility = Visibility.Collapsed;
                    MainTabs.Visibility = Visibility.Visible;
                    MainTabs.SelectedIndex = tabIndex;
                }
                e.Handled = true;
            }
        }
    }

    private string CurrencyUnitLabel() =>
        string.Equals(_data.Preferences?.Currency, "TOMAN", StringComparison.OrdinalIgnoreCase) ? "تومان" : "ریال";

    private string FormatMoney(decimal value) =>
        value.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")) + " " + CurrencyUnitLabel();

    private void ApplyCurrencyLabels()
    {
        if (MainTabs is null) return;
        var moneyHeadersByGrid = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal)
        {
            ["RecentInvoicesGrid"] = new(["مبلغ کل"], StringComparer.Ordinal),
            ["CustomersGrid"] = new(["ماندهٔ ذخیره‌شده*"], StringComparer.Ordinal),
            ["ProductsGrid"] = new(["قیمت خرید", "قیمت فروش"], StringComparer.Ordinal),
            ["InvoicesGrid"] = new(["جمع کالاها", "تخفیف", "مالیات", "مبلغ نهایی", "نقدی", "چک"], StringComparer.Ordinal),
            ["PaymentsGrid"] = new(["مبلغ تسویه"], StringComparer.Ordinal),
            ["ExpensesGrid"] = new(["مبلغ"], StringComparer.Ordinal),
            ["FinancialAccountsGrid"] = new(["بدهکار", "بستانکار", "مانده (بدهکار - بستانکار)"], StringComparer.Ordinal),
            ["DueCalendarGrid"] = new(["مبلغ باز"], StringComparer.Ordinal),
            ["ChecksGrid"] = new(["مبلغ"], StringComparer.Ordinal),
            ["VouchersGrid"] = new(["ارزش تخمینی"], StringComparer.Ordinal),
            ["LedgerEntriesGrid"] = new(["مبلغ"], StringComparer.Ordinal),
            ["TrialBalanceGrid"] = new(["گردش بدهکار", "گردش بستانکار", "مانده (بدهکار منهای بستانکار)"], StringComparer.Ordinal),
            ["CashFlowProjectionGrid"] = new(["ورودی", "خروجی", "تغییر خالص", "مانده پس از رخدادها"], StringComparer.Ordinal),
            ["CashFlowMovementsGrid"] = new(["مبلغ"], StringComparer.Ordinal),
            ["FiscalYearLedgerGrid"] = new(["مبلغ"], StringComparer.Ordinal)
        };
        var unit = CurrencyUnitLabel();
        foreach (var pair in moneyHeadersByGrid)
        {
            if (FindName(pair.Key) is not DataGrid grid) continue;
            foreach (var column in grid.Columns)
            {
                if (column.Header is not string header) continue;
                var normalized = header.Replace(" (ریال)", "", StringComparison.Ordinal)
                    .Replace(" (تومان)", "", StringComparison.Ordinal);
                if (pair.Value.Contains(normalized))
                    column.Header = normalized + " (" + unit + ")";
            }
        }
        foreach (var label in new[] { "SalesTotal", "PurchasesTotal", "PaymentsTotal", "ReceivablesTotal", "PayablesTotal", "ExpensesTotal",
                                      "ReportSales", "ReportPurchases", "ReportPayments", "ReportReceivables", "ReportPayables", "ReportExpenses", "ReportCash" })
        {
            if (FindName(label) is not TextBlock block || !decimal.TryParse(block.Text.Replace(",", "").Replace("٬", ""), NumberStyles.Number, CultureInfo.CurrentCulture, out var value))
                continue;
            block.Text = FormatMoney(value);
        }
    }

    private void RefreshFiscalYearPage()
    {
        if (FiscalYearSelector is null) return;
        var calendar = new PersianCalendar();
        var currentYear = calendar.GetYear(DateTime.Now);
        var years = Enumerable.Range(Math.Max(1300, currentYear - 8), 17)
            .Select(year => year.ToString(CultureInfo.InvariantCulture))
            .Concat(_data.JournalEntries.Select(entry => entry.FiscalYear))
            .Append(_data.Preferences.ActiveFiscalYear)
            .Where(year => int.TryParse(year, out _))
            .Distinct(StringComparer.Ordinal)
            .OrderByDescending(year => int.Parse(year, CultureInfo.InvariantCulture))
            .ToList();
        FiscalYearSelector.ItemsSource = years;
        FiscalYearSelector.SelectedItem = _data.Preferences.ActiveFiscalYear;
        FiscalYearStartDate.Text = _data.Preferences.FiscalYearStartDate;
        FiscalYearEndDate.Text = _data.Preferences.FiscalYearEndDate;
        RefreshFiscalYearLedger();
    }

    private void FiscalYearSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_uiReady || FiscalYearSelector.SelectedItem is not string year || !int.TryParse(year, out var yearNumber))
            return;
        var calendar = new PersianCalendar();
        var lastDay = calendar.GetDaysInMonth(yearNumber, 12);
        FiscalYearStartDate.Text = year + "/01/01";
        FiscalYearEndDate.Text = string.Format(CultureInfo.InvariantCulture, "{0:0000}/12/{1:00}", yearNumber, lastDay);
        RefreshFiscalYearLedger();
    }

    private void RefreshFiscalYearLedger()
    {
        if (FiscalYearLedgerGrid is null || FiscalYearSelector is null) return;
        var year = FiscalYearSelector.SelectedItem?.ToString() ?? _data.Preferences?.ActiveFiscalYear ?? "";
        FiscalYearLedgerGrid.ItemsSource = _data.JournalEntries
            .Where(entry => string.Equals(
                string.IsNullOrWhiteSpace(entry.FiscalYear) ? entry.Date.Split('/').FirstOrDefault() ?? "" : entry.FiscalYear,
                year, StringComparison.Ordinal))
            .OrderByDescending(entry => entry.Number)
            .Select(entry => new
            {
                entry.Date,
                entry.Description,
                FiscalYear = string.IsNullOrWhiteSpace(entry.FiscalYear) ? entry.Date.Split('/').FirstOrDefault() ?? "" : entry.FiscalYear,
                entry.Amount,
                entry.Status
            }).ToList();
        if (FiscalYearStatus is not null)
            FiscalYearStatus.Text = $"سال انتخابی {year} • تعداد اسناد دفتر: {FiscalYearLedgerGrid.Items.Count:N0} • جمع مبالغ: {FormatMoney(_data.JournalEntries.Where(entry => string.Equals(entry.FiscalYear, year, StringComparison.Ordinal)).Sum(entry => entry.Amount))}";
    }

    private void SaveFiscalYear_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var year = FiscalYearSelector.SelectedItem?.ToString() ?? "";
        if (!int.TryParse(year, out var yearNumber) || yearNumber is < 1300 or > 1500)
        {
            MessageBox.Show(this, "سال مالی شمسی معتبر انتخاب کنید.", "سال مالی", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        try
        {
            var start = ParseFiscalDate(FiscalYearStartDate.Text);
            var end = ParseFiscalDate(FiscalYearEndDate.Text);
            if (start > end) throw new InvalidOperationException("تاریخ شروع باید پیش از تاریخ پایان باشد.");
            if (new PersianCalendar().GetYear(start) != yearNumber || new PersianCalendar().GetYear(end) != yearNumber)
                throw new InvalidOperationException("سال تاریخ شروع و پایان باید با سال انتخابی یکسان باشد.");
            Commit(data =>
            {
                data.Preferences.ActiveFiscalYear = year;
                data.Preferences.FiscalYearStartDate = FormatPersianDate(new DateTimeOffset(start, TimeZoneInfo.Local.GetUtcOffset(start)));
                data.Preferences.FiscalYearEndDate = FormatPersianDate(new DateTimeOffset(end, TimeZoneInfo.Local.GetUtcOffset(end)));
            }, "سال مالی فعال و بازهٔ شمسی ذخیره شد.");
            RefreshFiscalYearLedger();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی سال مالی", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static DateTime ParseFiscalDate(string input)
    {
        var normalized = NativeLedgerService.NormalizeAndValidateDate(input);
        var parts = normalized.Split('/');
        var year = int.Parse(parts[0], CultureInfo.InvariantCulture);
        if (year is < 1300 or > 1500)
            throw new InvalidOperationException("تاریخ سال مالی باید شمسی باشد؛ نمونه: ۱۴۰۵/۰۱/۰۱.");
        return new PersianCalendar().ToDateTime(
            year, int.Parse(parts[1], CultureInfo.InvariantCulture), int.Parse(parts[2], CultureInfo.InvariantCulture),
            0, 0, 0, 0, PersianCalendar.PersianEra);
    }

    private void RefreshSecurityStatus()
    {
        if (SecurityStatusText is null) return;
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AshkeGhalam", "WindowsNative", "accounting-data.dat");
        SecurityStatusText.Text = $"حفاظت فایل: رمزگذاری DPAPI ویندوز برای کاربر فعلی\n" +
            $"فایل داده: {(File.Exists(path) ? "موجود" : "با نخستین ذخیره ساخته می‌شود")}\n" +
            $"اشخاص: {_data.Customers.Count:N0} • کالاها: {_data.Products.Count:N0} • اسناد: {_data.Invoices.Count:N0} • شرکت‌ها: {_data.Companies.Count:N0}";
    }

    private void AuditLocalData_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var loaded = AccountingDataValidator.Validate(_store.Load());
            var companiesWithImages = loaded.Companies.Count(company =>
                !string.IsNullOrWhiteSpace(company.LogoDataBase64) ||
                !string.IsNullOrWhiteSpace(company.StampDataBase64) ||
                !string.IsNullOrWhiteSpace(company.SignatureDataBase64));
            MessageBox.Show(this,
                $"اعتبارسنجی دادهٔ رمزگذاری‌شده موفق بود.\nاشخاص: {loaded.Customers.Count:N0}\nکالاها: {loaded.Products.Count:N0}\nفاکتورها: {loaded.Invoices.Count:N0}\nدریافت / پرداخت: {loaded.Payments.Count:N0}\nچک‌ها: {loaded.Checks.Count:N0}\nشرکت‌ها: {loaded.Companies.Count:N0}\nشرکت‌های دارای لوگو / مهر / امضا: {companiesWithImages:N0}\nاسناد دفتر: {loaded.JournalEntries.Count:N0}",
                "بررسی سلامت داده‌ها", MessageBoxButton.OK, MessageBoxImage.Information);
            RefreshSecurityStatus();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی سلامت داده‌ها", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }


    private void ResetAllAccountingData_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var backupChoice = MessageBox.Show(this,
            "این عملیات تمام داده‌های حسابداری محلی، از جمله اشخاص، کالاها، فاکتورها، دریافت‌ها، هزینه‌ها، چک‌ها و دفتر را پاک می‌کند.\nآیا قبل از پاک‌سازی پشتیبان رمزگذاری‌شده بسازیم؟\nبله: تهیهٔ پشتیبان\nخیر: پاک‌سازی بدون پشتیبان\nلغو: انصراف",
            "پاک‌سازی کامل داده‌ها", MessageBoxButton.YesNoCancel, MessageBoxImage.Warning);
        if (backupChoice == MessageBoxResult.Cancel) return;
        if (backupChoice == MessageBoxResult.Yes &&
            !CreateManualBackupFromDialog("پشتیبان قبل از پاک‌سازی", "AshkeGhalam-BeforeReset"))
            return;

        var phraseBox = new TextBox
        {
            MinWidth = 310, Height = 36, Padding = new Thickness(8),
            FlowDirection = FlowDirection.RightToLeft
        };
        var confirmButton = new Button
        {
            Content = "تأیید پاک‌سازی نهایی", Height = 36, MinWidth = 170,
            Background = new SolidColorBrush(Color.FromRgb(185, 28, 28)),
            Foreground = Brushes.White, Margin = new Thickness(0, 12, 0, 0)
        };
        var confirmWindow = new Window
        {
            Owner = this, Title = "تأیید دوم پاک‌سازی",
            Width = 440, Height = 210, MinWidth = 420,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            ResizeMode = ResizeMode.NoResize, FlowDirection = FlowDirection.RightToLeft,
            Content = new StackPanel
            {
                Margin = new Thickness(22),
                Children =
                {
                    new TextBlock { Text = "برای پاک‌سازی، عبارت «پاکسازی کامل» را عیناً وارد کنید.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0,0,0,10) },
                    phraseBox, confirmButton
                }
            }
        };
        ApplyCurrentThemeTo(confirmWindow);
        confirmButton.Click += (_, _) =>
        {
            if (!string.Equals(phraseBox.Text.Trim(), "پاکسازی کامل", StringComparison.Ordinal))
            {
                MessageBox.Show(confirmWindow, "عبارت تأیید درست نیست.", "تأیید پاک‌سازی",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            confirmWindow.DialogResult = true;
        };
        if (confirmWindow.ShowDialog() != true) return;

        try
        {
            var fresh = new AccountingData();
            var freshCompany = new CompanyProfileRecord { Name = "شرکت جدید", LegalName = "شرکت جدید" };
            fresh.Companies = [freshCompany];
            fresh.ActiveCompanyId = freshCompany.Id;
            CompanyWorkspaceService.EnsureInitialized(fresh);
            _store.Save(fresh);
            ProtectedCheckImageStore.ClearAll();
            _data = fresh;
            _startupAccountingWarning = "";
            _canWrite = true;
            RefreshAll();
            RefreshFiscalYearPage();
            RefreshSecurityStatus();
            RefreshAutoBackupControls();
            ApplyMainWindowTheme();
            FooterStatus.Text = "پاک‌سازی انجام شد؛ فضای کاری محلی کاملاً خالی و آمادهٔ شروع است.";
            MessageBox.Show(this,
                "داده‌های محلی پاک شدند. لایسنس ذخیره‌شده، خود برنامه و فایل‌های پشتیبان حذف نشدند؛ نسخهٔ سرور نیز تغییری نکرده است.",
                "پاک‌سازی انجام شد", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "پاک‌سازی انجام نشد: " + ex.Message, "خطا",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void SyncAccountingData_Click(object sender, RoutedEventArgs e)
    {
        if (!RequireWritable()) return;
        var requestedMode = (ServerSyncModeSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "manual";
        if (string.Equals(requestedMode, "disabled", StringComparison.OrdinalIgnoreCase))
        {
            ServerConnectionStatusText.Text = "همگام‌سازی در تنظیمات غیرفعال است؛ گزینهٔ «دستی» را انتخاب و ذخیره کنید.";
            MessageBox.Show(this, ServerConnectionStatusText.Text, "همگام‌سازی غیرفعال است",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        try
        {
            var license = await LoadFreshSyncLicenseAsync();
            if (license is null) return;
            var settings = GetLiveServerConnectionSettings(license);
            var sync = new NativeAccountingSyncService();
            ServerConnectionStatusText.Text = "در حال دریافت نسخهٔ سرور و بررسی تعارض…";
            var remote = await sync.DownloadAsync(settings, license);

            if (remote is null)
            {
                var uploadInitial = MessageBox.Show(this,
                    "برای این فضای کاری هنوز تصویر دادهٔ حسابداری وجود ندارد. نسخهٔ محلی بارگذاری شود؟",
                    "شروع همگام‌سازی", MessageBoxButton.YesNo, MessageBoxImage.Question);
                if (uploadInitial != MessageBoxResult.Yes) return;
                await sync.UploadAsync(settings, license, _data);
                ServerConnectionStatusText.Text = "نسخهٔ اولیهٔ محلی روی فضای کاری تأییدشده ذخیره شد.";
                FooterStatus.Text = "همگام‌سازی اولیه تکمیل شد.";
                return;
            }

            var localJson = JsonSerializer.Serialize(_data);
            var remoteJson = JsonSerializer.Serialize(remote);
            if (string.Equals(localJson, remoteJson, StringComparison.Ordinal))
            {
                ServerConnectionStatusText.Text = "نسخهٔ محلی و سرور یکسان هستند.";
                FooterStatus.Text = "داده‌ها با سرور همگام هستند.";
                return;
            }

            var choice = MessageBox.Show(this,
                $"نسخهٔ محلی و سرور متفاوت‌اند.\nمحلی: {_data.Customers.Count:N0} شخص، {_data.Invoices.Count:N0} فاکتور، {_data.Products.Count:N0} کالا\nسرور: {remote.Customers.Count:N0} شخص، {remote.Invoices.Count:N0} فاکتور، {remote.Products.Count:N0} کالا\n\nبله: نسخهٔ محلی به سرور ارسال شود\nخیر: نسخهٔ سرور جایگزین محلی شود\nلغو: بدون تغییر خارج شو",
                "حل تعارض همگام‌سازی", MessageBoxButton.YesNoCancel, MessageBoxImage.Warning);
            if (choice == MessageBoxResult.Cancel) return;

            if (!CreateManualBackupFromDialog(
                    choice == MessageBoxResult.Yes ? "پشتیبان قبل از ارسال به سرور" : "پشتیبان قبل از دریافت از سرور",
                    choice == MessageBoxResult.Yes ? "AshkeGhalam-BeforeCloudUpload" : "AshkeGhalam-BeforeCloudDownload"))
                return;

            if (choice == MessageBoxResult.Yes)
            {
                await sync.UploadAsync(settings, license, _data);
                ServerConnectionStatusText.Text = "نسخهٔ محلی، با انتخاب شما، روی سرور ذخیره شد.";
                FooterStatus.Text = "ارسال فضای کاری به سرور تکمیل شد.";
            }
            else
            {
                _store.Save(remote);
                ProtectedCheckImageStore.Synchronize(remote.Checks);
                _data = remote;
                RefreshAll();
                RefreshLicensePanel();
                RefreshAutoBackupControls();
                ApplyMainWindowTheme();
                ServerConnectionStatusText.Text = "نسخهٔ سرور با پشتیبان‌گیری قبلی جایگزین نسخهٔ محلی شد.";
                FooterStatus.Text = "داده‌ها از فضای کاری تأییدشده دریافت شدند.";
            }
        }
        catch (Exception ex)
        {
            ServerConnectionStatusText.Text = "همگام‌سازی ناموفق: " + ex.Message;
            MessageBox.Show(this, ex.Message, "همگام‌سازی حسابداری", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void OpenDataFolder_Click(object sender, RoutedEventArgs e)
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AshkeGhalam", "WindowsNative");
        try
        {
            Directory.CreateDirectory(folder);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("explorer.exe", "\"" + folder + "\"") { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "پوشهٔ داده‌ها", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void CheckLocalDataIntegrity_Click(object sender, RoutedEventArgs e)
    {
        if (!_canWrite)
        {
            MessageBox.Show(this,
                "فایل دادهٔ اصلی قابل استفاده شناخته نشده است؛ برای جلوگیری از نتیجهٔ گمراه‌کننده، سلامت فایل روی دیسک تأیید نشده. از فایل پشتیبان معتبر بازیابی کنید.",
                "بررسی سلامت داده", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        try
        {
            var checkedData = AccountingDataValidator.Validate(_data.DeepCopy());
            var imageCount = checkedData.Checks.Count(check =>
                !string.IsNullOrWhiteSpace(check.ImageDataBase64) || !string.IsNullOrWhiteSpace(check.ImagePath));
            var summary =
                $"اعتبار ساختار داده: تأیید شد\nشرکت‌ها: {checkedData.Companies.Count:N0}\nاشخاص: {checkedData.Customers.Count:N0}\n" +
                $"کالاها: {checkedData.Products.Count:N0}\nفاکتورها: {checkedData.Invoices.Count:N0}\n" +
                $"دریافت/پرداخت: {checkedData.Payments.Count:N0}\nچک‌ها: {checkedData.Checks.Count:N0} (تصویر/مسیر: {imageCount:N0})\n" +
                $"اسناد دفتر: {checkedData.JournalEntries.Count:N0}\nپوشهٔ پشتیبان: {AutomaticBackupService.BackupDirectory}";
            MessageBox.Show(this, summary, "سلامت داده‌های محلی", MessageBoxButton.OK, MessageBoxImage.Information);
            FooterStatus.Text = "اعتبار ساختاری داده‌های محلی بررسی شد.";
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "اعتبارسنجی داده انجام نشد: " + ex.Message, "خطای سلامت داده",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void AdvancedOpenTab_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: string header } || string.IsNullOrWhiteSpace(header))
            return;
        var target = MainTabs.Items.OfType<TabItem>().FirstOrDefault(tab =>
            string.Equals(tab.Header?.ToString(), header, StringComparison.Ordinal));
        if (target is null)
        {
            MessageBox.Show(this, "صفحهٔ مقصد در نسخهٔ بومی موجود نیست.", "دسترسی به صفحه",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        MainTabs.Visibility = Visibility.Visible;
        MigrationPanel.Visibility = Visibility.Collapsed;
        MainTabs.SelectedItem = target;
        var route = NativeTabHeaders.FirstOrDefault(pair =>
            string.Equals(pair.Value, header, StringComparison.Ordinal)).Key;
        if (!string.IsNullOrWhiteSpace(route)) UpdateNavigationSelection(route);
        if (FindName("CurrentModuleText") is TextBlock current) current.Text = header + " • نسخهٔ بومی";
        if (header == "معرفی نرم‌افزار") RefreshAboutCompanyPage();
        FooterStatus.Text = "صفحهٔ «" + header + "» باز شد.";
    }

    private static BitmapImage? DecodeCompanyLogo(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return null;
        try
        {
            var bytes = Convert.FromBase64String(base64);
            if (bytes.Length == 0 || bytes.Length > 2 * 1024 * 1024) return null;
            using var stream = new MemoryStream(bytes);
            var image = new BitmapImage();
            image.BeginInit();
            image.CacheOption = BitmapCacheOption.OnLoad;
            image.DecodePixelWidth = 264;
            image.StreamSource = stream;
            image.EndInit();
            if (image.PixelWidth < 1 || image.PixelHeight < 1 || image.PixelWidth > 5000 || image.PixelHeight > 5000)
                return null;
            image.Freeze();
            return image;
        }
        catch (FormatException) { return null; }
        catch (InvalidDataException) { return null; }
        catch (IOException) { return null; }
        catch (NotSupportedException) { return null; }
        catch (ArgumentException) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    private void RefreshAboutCompanyPage()
    {
        var company = ActiveCompanyProfile();
        static string RegisteredValue(string? value) =>
            string.IsNullOrWhiteSpace(value) ? "در تنظیمات شرکت ثبت نشده" : value.Trim();

        AboutCompanyLegalName.Text = RegisteredValue(
            string.IsNullOrWhiteSpace(company?.LegalName) ? company?.Name : company.LegalName);
        AboutCompanyBranch.Text = RegisteredValue(company?.Branch);
        AboutCompanyPhone.Text = RegisteredValue(company?.Phone);
        AboutCompanyNationalId.Text = RegisteredValue(company?.NationalId);
        AboutCompanyTaxId.Text = RegisteredValue(company?.TaxId);
        AboutCompanyAddress.Text = RegisteredValue(company?.Address);

        AboutCompanyLogo.Source = DecodeCompanyLogo(company?.LogoDataBase64);
        AboutCompanyLogoFrame.Visibility = AboutCompanyLogo.Source is null ? Visibility.Collapsed : Visibility.Visible;

        var version = typeof(MainWindow).Assembly.GetName().Version;
        AboutVersionText.Text = "نسخهٔ " + (version?.ToString(3) ?? "نامشخص");
    }

    private void GuideSearch_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (GuideSearchResultText is null || GuideSearchBox is null) return;
        var query = GuideSearchBox.Text.Trim().Replace('\u200c', ' ');
        var sections = new[]
        {
            GuideSetupSection, GuideInvoiceSection, GuideVoucherSection,
            GuidePaymentSection, GuideReportsSection, GuideBackupSection,
            GuideDebitCreditSection, GuideProfitCashSection, GuideTroubleshootingSection
        };
        var visibleCount = 0;
        foreach (var section in sections)
        {
            var matches = query.Length == 0 || GuideContentContains(section, query);
            section.Visibility = matches ? Visibility.Visible : Visibility.Collapsed;
            if (matches) visibleCount++;
        }

        GuideSearchResultText.Text = query.Length == 0
            ? "نمایش همهٔ موضوعات"
            : visibleCount == 0
                ? "نتیجه‌ای پیدا نشد"
                : string.Format(CultureInfo.GetCultureInfo("fa-IR"), "موضوع‌های مرتبط: {0:N0}", visibleCount);
    }

    private static bool GuideContentContains(DependencyObject root, string query)
    {
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        var stack = new Stack<DependencyObject>();
        stack.Push(root);
        while (stack.Count > 0)
        {
            var current = stack.Pop();
            if (!visited.Add(current)) continue;

            var text = current switch
            {
                TextBlock block => block.Text,
                TextBox box => box.Text,
                HeaderedContentControl header => header.Header?.ToString(),
                ContentControl control => control.Content?.ToString(),
                _ => null
            };
            if (!string.IsNullOrEmpty(text) &&
                text.Replace('\u200c', ' ').Contains(query, StringComparison.CurrentCultureIgnoreCase))
                return true;

            try
            {
                foreach (var child in LogicalTreeHelper.GetChildren(current).OfType<DependencyObject>())
                    stack.Push(child);
            }
            catch (InvalidOperationException) { }

            if (current is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try
                {
                    for (var index = 0; index < VisualTreeHelper.GetChildrenCount(current); index++)
                        stack.Push(VisualTreeHelper.GetChild(current, index));
                }
                catch (InvalidOperationException) { }
            }
        }
        return false;
    }

    private void OpenCompanyWebsite_Click(object sender, RoutedEventArgs e)
    {
        // Intentionally restrict shell launches to the company's known HTTPS origin.
        const string target = "https://ashkghalam.ir/";
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(target) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "بازکردن وب‌سایت انجام نشد: " + ex.Message, "وب‌سایت اشک قلم",
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private async Task<NativeLicenseState?> LoadFreshSyncLicenseAsync()
    {
        NativeLicenseState? license;
        try { license = _licenseStore.Load(); }
        catch (Exception ex)
        {
            ServerConnectionStatusText.Text = "فایل لایسنس محلی معتبر نیست: " + ex.Message;
            MessageBox.Show(this, "وضعیت لایسنس قابل خواندن نیست. از دکمهٔ فعال‌سازی، لایسنس را دوباره با سرور بررسی کنید.",
                "لایسنس مورد نیاز", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }

        if (license is null)
        {
            ServerConnectionStatusText.Text = "برای همگام‌سازی، لایسنس ابتدا باید با سرور تأیید شود.";
            if (MessageBox.Show(this, "لایسنس تأییدشده‌ای ذخیره نشده است. پنجرهٔ فعال‌سازی لایسنس باز شود؟",
                    "فعال‌سازی لازم است", MessageBoxButton.YesNo, MessageBoxImage.Information) == MessageBoxResult.Yes)
                VerifyLicense_Click(this, new RoutedEventArgs());
            return null;
        }

        try
        {
            var hardwareId = HardwareIdentityService.GetHardwareId();
            if (!string.Equals(hardwareId, license.HardwareId, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("شناسهٔ سخت‌افزاری با لایسنس ذخیره‌شده برابر نیست؛ ابتدا لایسنس را دوباره در همین دستگاه فعال کنید.");

            var verified = await _licenseClient.VerifyAsync(license.LicenseKey, license.WorkspaceId, hardwareId);
            if (!verified.Success || verified.License is null)
                throw new InvalidOperationException("سرور لایسنس را تأیید نکرد: " + verified.Message);

            license.Payload = verified.License.Payload;
            license.Receipt = verified.License.Receipt;
            license.VerifiedAtUtc = DateTimeOffset.UtcNow;
            _licenseStore.Save(license);
            _sessionEntitlements = license.Payload;
            _sessionLicenseFailure = "";
            RefreshLicensePanel();
            return license;
        }
        catch (Exception ex)
        {
            ServerConnectionStatusText.Text = "احراز هویت همگام‌سازی انجام نشد: " + ex.Message;
            MessageBox.Show(this, ex.Message, "تأیید دسترسی همگام‌سازی",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }
    }

    private ServerConnectionSettings GetLiveServerConnectionSettings(NativeLicenseState license) => new()
    {
        BaseUrl = ServerBaseUrl.Text.Trim(),
        WorkspaceId = string.IsNullOrWhiteSpace(ServerWorkspaceId.Text)
            ? license.WorkspaceId : ServerWorkspaceId.Text.Trim(),
        SyncMode = (ServerSyncModeSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "manual"
    };

    private async void TestServerStorage_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var license = await LoadFreshSyncLicenseAsync();
            if (license is null) return;
            ServerConnectionStatusText.Text = "در حال آزمون واقعی API ذخیره‌سازی با مجوز این فضای کاری…";
            var remote = await new NativeAccountingSyncService()
                .DownloadAsync(GetLiveServerConnectionSettings(license), license);
            if (remote is null)
            {
                ServerConnectionStatusText.Text = "اتصال API و مجوز تأیید شد؛ هنوز تصویر داده‌ای برای این فضای کاری ذخیره نشده است.";
                FooterStatus.Text = "آزمون واقعی اتصال سرور موفق بود؛ داده‌ای از سرور جایگزین نشد.";
                MessageBox.Show(this, ServerConnectionStatusText.Text, "آزمون اتصال موفق",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            ServerConnectionStatusText.Text =
                $"اتصال API موفق • اشخاص {remote.Customers.Count:N0} • کالاها {remote.Products.Count:N0} • فاکتورها {remote.Invoices.Count:N0}";
            FooterStatus.Text = "اتصال فضای کاری آزمون شد؛ داده‌های محلی تغییری نکردند.";
            MessageBox.Show(this, ServerConnectionStatusText.Text + "\nهیچ داده‌ای دریافت یا جایگزین نشد.",
                "آزمون اتصال موفق", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            ServerConnectionStatusText.Text = "آزمون واقعی اتصال شکست خورد: " + ex.Message;
            MessageBox.Show(this, ex.Message, "آزمون API سرور", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void ChooseAutoBackupFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var picker = new OpenFolderDialog
            {
                Title = "انتخاب پوشهٔ پشتیبان‌گیری خودکار",
                InitialDirectory = AutomaticBackupService.BackupDirectory,
                Multiselect = false
            };
            if (picker.ShowDialog(this) != true) return;
            AutomaticBackupService.SetBackupDirectory(picker.FolderName);
            RefreshAutoBackupControls();
            FooterStatus.Text = "مسیر پشتیبان خودکار ذخیره شد.";
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "انتخاب پوشهٔ پشتیبان", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void OpenBackupFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Directory.CreateDirectory(AutomaticBackupService.BackupDirectory);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("explorer.exe", "\"" + AutomaticBackupService.BackupDirectory + "\"") { UseShellExecute = true });
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "پوشهٔ پشتیبان‌ها", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

    private void OpenAdvancedBackup_Click(object sender, RoutedEventArgs e)
    {
        if (FindName("NavigationRoot") is DependencyObject root)
        {
            var target = FindVisualButtonByTag(root, "advanced-settings");
            if (target is not null) NavigateModule_Click(target, new RoutedEventArgs());
        }
    }

    private static Button? FindVisualButtonByTag(DependencyObject root, string tag)
    {
        if (root is Button button && string.Equals(button.Tag?.ToString(), tag, StringComparison.Ordinal))
            return button;
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var result = FindVisualButtonByTag(VisualTreeHelper.GetChild(root, i), tag);
            if (result is not null) return result;
        }
        return null;
    }

    private void RefreshAutoBackupControls()
    {
        if (AutoBackupEnabled is null) return;
        try
        {
            var settings = AutomaticBackupService.LoadSettings();
            AutoBackupEnabled.IsChecked = settings.Enabled;
            AutoBackupIntervalSelector.SelectedItem = AutoBackupIntervalSelector.Items.OfType<ComboBoxItem>()
                .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), settings.IntervalHours.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))
                ?? AutoBackupIntervalSelector.Items.OfType<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), "24", StringComparison.Ordinal));
            AutoBackupRetentionSelector.SelectedItem = AutoBackupRetentionSelector.Items.OfType<ComboBoxItem>()
                .FirstOrDefault(item => string.Equals(item.Tag?.ToString(), settings.RetentionCount.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))
                ?? AutoBackupRetentionSelector.Items.OfType<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), "20", StringComparison.Ordinal));
            AskBackupOnExit.IsChecked = settings.PromptOnExit;
            AutoBackupPathText.Text = AutomaticBackupService.BackupDirectory;
            AutoBackupStatusText.Text = settings.Enabled
                ? $"فعال • هر {settings.IntervalHours:N0} ساعت • نگهداری حداکثر {settings.RetentionCount:N0} فایل • آخرین پشتیبان: {(settings.LastBackupUtc is DateTimeOffset last ? FormatPersianDate(last.ToLocalTime()) : "هنوز ساخته نشده")}"
                : "غیرفعال • برای فعال‌سازی ابتدا رمز پشتیبان را تعیین و زمان‌بندی را ذخیره کنید.";
        }
        catch (Exception ex)
        {
            AutoBackupStatusText.Text = "خطا در تنظیمات پشتیبان خودکار: " + ex.Message;
            AutoBackupPathText.Text = AutomaticBackupService.BackupDirectory;
        }
    }

    private void SetAutoBackupPassword_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new BackupPasswordDialog(this, "تنظیم رمز پشتیبان خودکار", confirmPassword: true);
        ApplyCurrentThemeTo(dialog);
        if (dialog.ShowDialog() != true) return;
        try
        {
            AutomaticBackupService.SetPassphrase(dialog.Passphrase);
            RefreshAutoBackupControls();
            AutoBackupStatusText.Text = "رمز با DPAPI ویندوز برای حساب کاربری فعلی حفاظت شد؛ زمان‌بندی را ذخیره کنید.";
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "رمز پشتیبان خودکار", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

    private void SaveAutoBackupSettings_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var enabled = AutoBackupEnabled.IsChecked == true;
            var interval = int.TryParse((AutoBackupIntervalSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString(), out var parsed)
                ? parsed : 24;
            var retention = int.TryParse((AutoBackupRetentionSelector.SelectedItem as ComboBoxItem)?.Tag?.ToString(), out var parsedRetention)
                ? parsedRetention : 20;
            var promptOnExit = AskBackupOnExit.IsChecked != false;
            if (enabled && !AutomaticBackupService.HasConfiguredPassphrase())
            {
                var passwordDialog = new BackupPasswordDialog(this, "تنظیم رمز پشتیبان خودکار", confirmPassword: true);
                ApplyCurrentThemeTo(passwordDialog);
                if (passwordDialog.ShowDialog() != true) return;
                AutomaticBackupService.SetPassphrase(passwordDialog.Passphrase);
            }
            AutomaticBackupService.SaveSettings(enabled, interval, retention, promptOnExit);
            RefreshAutoBackupControls();
            if (enabled)
            {
                var path = AutomaticBackupService.CreateBackupNow(_data);
                AutoBackupStatusText.Text = "زمان‌بندی ذخیره شد؛ پشتیبان اولیه ساخته شد: " + Path.GetFileName(path);
                FooterStatus.Text = "پشتیبان خودکار فعال شد؛ نگهداری حداکثر ۲۰ فایل.";
            }
            else
            {
                AutoBackupStatusText.Text = "زمان‌بندی پشتیبان خودکار غیرفعال شد؛ فایل‌های قبلی دست‌نخورده باقی ماندند.";
            }
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "تنظیم پشتیبان خودکار", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

    private void CreateAutomaticBackupNow_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (!AutomaticBackupService.HasConfiguredPassphrase())
            {
                var dialog = new BackupPasswordDialog(this, "تنظیم رمز پشتیبان خودکار", confirmPassword: true);
                ApplyCurrentThemeTo(dialog);
                if (dialog.ShowDialog() != true) return;
                AutomaticBackupService.SetPassphrase(dialog.Passphrase);
            }
            var path = AutomaticBackupService.CreateBackupNow(_data);
            RefreshAutoBackupControls();
            AutoBackupStatusText.Text = "پشتیبان رمزگذاری‌شده ساخته شد: " + Path.GetFileName(path);
            FooterStatus.Text = "پشتیبان خودکار به‌صورت دستی اجرا شد.";
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "پشتیبان‌گیری خودکار", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private void AutomaticBackupTimer_Tick(object? sender, EventArgs e)
    {
        if (!_canWrite) return;
        try
        {
            var path = AutomaticBackupService.TryCreateDueBackup(_data);
            if (path is not null)
            {
                AutoBackupStatusText.Text = "پشتیبان زمان‌بندی‌شده ساخته شد: " + Path.GetFileName(path);
                FooterStatus.Text = "پشتیبان خودکار ذخیره شد؛ فایل‌های قدیمی مازاد بر ۲۰ مورد پاک‌سازی شدند.";
            }
        }
        catch (Exception ex)
        {
            AutoBackupStatusText.Text = "خطای پشتیبان زمان‌بندی‌شده: " + ex.Message;
            FooterStatus.Text = "پشتیبان خودکار موفق نبود؛ دادهٔ اصلی تغییری نکرد.";
        }
    }

    // Native navigation mirrors the existing Ashke Ghalam sidebar. Unported pages are
    // deliberately marked as pending instead of being represented by fake functionality.
    private sealed record NativeModuleLink(string Title, string Group, string OriginalRoute);

    private static readonly IReadOnlyDictionary<string, NativeModuleLink> NativeModuleLinks =
        new Dictionary<string, NativeModuleLink>(StringComparer.Ordinal)
        {
            ["dashboard"] = new("پیشخوان", "منوی اصلی", "/"),
            ["about"] = new("معرفی نرم‌افزار", "اطلاعات و آموزش", "/about"),
            ["guide"] = new("راهنمای حسابداری", "اطلاعات و آموزش", "/help"),
            ["invoices"] = new("فاکتورها", "منوی اصلی", "/invoices"),
            ["inventory"] = new("انبارداری", "منوی اصلی", "/inventory"),
            ["kardex"] = new("کارتکس کالا", "عملیات محلی موجود", "/inventory/kardex"),
            ["checks"] = new("مدیریت چک", "منوی اصلی", "/checks"),
            ["vouchers"] = new("حواله‌های انبار", "عملیات محلی موجود", "/inventory (حواله‌های انبار)"),
            ["finance"] = new("امور مالی", "منوی اصلی", "/finance"),
            ["customers"] = new("اشخاص", "منوی اصلی", "/customers"),
            ["companies"] = new("چندشرکتی و مشخصات شرکت", "تنظیمات حسابداری", "/settings/companies"),
            ["reports"] = new("گزارشات عمومی", "گزارشات و تحلیل", "/reports"),
            ["users"] = new("کاربران و سطح دسترسی", "تنظیمات و سیستم", "/users"),
            ["payments"] = new("دریافت‌ها", "عملیات محلی موجود", "بخش دریافت‌های نسخه بومی"),
            ["expenses"] = new("هزینه‌ها", "عملیات محلی موجود", "بخش هزینه‌های نسخه بومی"),
            ["backup"] = new("پشتیبان‌گیری محلی", "عملیات محلی موجود", "پشتیبان محلی نسخه بومی"),
            ["projects"] = new("پروژه‌ها", "مدیریت کسب‌وکار", "/projects"),
            ["contracts"] = new("قراردادها", "مدیریت کسب‌وکار", "/contracts"),
            ["assets"] = new("دارایی‌های ثابت", "مدیریت کسب‌وکار", "/assets"),
            ["budget"] = new("بودجه‌بندی", "مدیریت کسب‌وکار", "/budget"),
            ["marketing"] = new("بازاریابی و سئو", "مدیریت کسب‌وکار", "/marketing"),
            ["import-center"] = new("مرکز واردات اسناد", "مدیریت کسب‌وکار", "/import-center"),
            ["accounting"] = new("حسابداری دوبل", "حسابداری پیشرفته", "/accounting"),
            ["cashflow-predictor"] = new("جریان نقدینگی و پیش‌بینی", "حسابداری پیشرفته", "/cashflow-predictor"),
            ["tax"] = new("مدیریت مالیات", "حسابداری پیشرفته", "/tax"),
            ["loans"] = new("وام‌ها", "حسابداری پیشرفته", "/loans"),
            ["due-calendar"] = new("تقویم سررسید و اقساط", "حسابداری پیشرفته", "/due-calendar"),
            ["bank-reconciliation"] = new("تطبیق بانکی", "حسابداری پیشرفته", "/bank-reconciliation"),
            ["currency"] = new("مدیریت چندارزی", "حسابداری پیشرفته", "/currency"),
            ["workflow-rules"] = new("قواعد گردش مالی", "حسابداری پیشرفته", "/workflow-rules"),
            ["financial-reports"] = new("گزارشات مالی پیشرفته", "گزارشات و تحلیل", "/financial-reports"),
            ["ai-assistant"] = new("دستیار هوشمند مالی", "گزارشات و تحلیل", "/ai-assistant"),
            ["signature-dashboard"] = new("داشبورد امضا", "امضای دیجیتال", "/signature-dashboard"),
            ["signature-management"] = new("مدیریت امضا", "امضای دیجیتال", "/signature-management"),
            ["moadian"] = new("سامانه مؤدیان مالیاتی", "حسابداری پیشرفته", "/moadian"),
            ["pos-terminal"] = new("کارتخوان بانکی", "خدمات تجاری و ابری", "/pos-terminal"),
            ["cloud-vault"] = new("پشتیبان ابری", "خدمات تجاری و ابری", "/cloud-vault"),
            ["sms-center"] = new("پنل پیامک هوشمند", "خدمات تجاری و ابری", "/sms-center"),
            ["multi-user-lan"] = new("شبکه محلی چندکاربره", "خدمات تجاری و ابری", "/multi-user-lan"),
            ["client-broadcast"] = new("اطلاعیه‌ها", "خدمات تجاری و ابری", "/client-broadcast"),
            ["activation"] = new("اتصال سرور و فعال‌سازی لایسنس", "ارتباط با سرور", "/install-android (فقط اتصال/فعال‌سازی کلاینت)"),
            ["server"] = new("ارتباط و همگام‌سازی سرور", "تنظیمات حسابداری", "/data-sync"),
            ["mobile-catalog"] = new("کاتالوگ ویزیتوری همراه", "خدمات تجاری و ابری", "/mobile-catalog"),
            ["catalog"] = new("کاتالوگ محصول", "خدمات تجاری و ابری", "/catalog"),
            ["support-sla"] = new("پشتیبانی و تمدید", "خدمات تجاری و ابری", "/support-sla"),
            ["fiscal-year"] = new("سال مالی", "تنظیمات و سیستم", "/fiscal-year"),
            ["security"] = new("امنیت داده‌ها", "تنظیمات و سیستم", "/security"),
            ["advanced-settings"] = new("تنظیمات پیشرفته", "تنظیمات برنامه", "/advanced-settings"),
            ["settings"] = new("تنظیمات حسابداری", "تنظیمات حسابداری", "/settings"),
            ["help"] = new("آموزش و راهنما", "تنظیمات و سیستم", "/help"),
            ["updates"] = new("مرکز به‌روزرسانی", "تنظیمات و سیستم", "/updates")
        };

    // Resolve destinations by stable TabItem headers, not hard-coded numeric indexes.
    // A module that has no true native counterpart remains in the migration panel instead
    // of opening an unrelated page with a similar-sounding title.
    private static readonly IReadOnlyDictionary<string, string> NativeTabHeaders =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["dashboard"] = "نمای کلی",
            ["invoices"] = "فاکتورهای فروش/خرید",
            ["inventory"] = "کالا و انبار",
            ["kardex"] = "کارتکس کالا",
            ["checks"] = "مدیریت چک",
            ["finance"] = "امور مالی",
            ["vouchers"] = "حواله‌های انبار",
            ["customers"] = "مشتریان",
            ["companies"] = "تنظیمات و شرکت‌ها",
            ["reports"] = "گزارش‌ها",
            ["payments"] = "دریافت‌ها",
            ["expenses"] = "هزینه‌ها",
            ["backup"] = "پشتیبان‌گیری",
            ["accounting"] = "حسابداری دوبل",
            ["cashflow-predictor"] = "پیش‌بینی نقدینگی",
            ["loans"] = "وام‌ها و اقساط",
            ["currency"] = "مدیریت چندارزی",
            ["bank-reconciliation"] = "تطبیق بانکی",
            ["workflow-rules"] = "قواعد گردش مالی",
            ["tax"] = "سامانهٔ مؤدیان",
            ["due-calendar"] = "تقویم سررسیدها",
            ["financial-reports"] = "گزارش مالی پیشرفته",
            ["moadian"] = "سامانهٔ مؤدیان",
            ["activation"] = "اتصال و لایسنس",
            ["server"] = "اتصال به سرور اصلی",
            ["fiscal-year"] = "سال مالی",
            ["security"] = "امنیت داده‌ها",
            ["advanced-settings"] = "تنظیمات پیشرفته",
            ["settings"] = "تنظیمات و شرکت‌ها",
            ["about"] = "معرفی نرم‌افزار",
            ["guide"] = "راهنمای حسابداری",
            ["help"] = "راهنمای حسابداری"
        };

    private Button? FindNavigationButton(string route)
    {
        if (string.Equals(route, "dashboard", StringComparison.Ordinal) &&
            FindName("NavigationDashboardButton") is Button dashboard)
            return dashboard;

        if (FindName("NavigationRoot") is not DependencyObject root)
            return null;

        var pending = new Stack<DependencyObject>();
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        pending.Push(root);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (!visited.Add(current))
                continue;

            if (current is Button button &&
                string.Equals(button.Tag?.ToString(), route, StringComparison.Ordinal))
                return button;

            try
            {
                foreach (var child in LogicalTreeHelper.GetChildren(current).OfType<DependencyObject>())
                    pending.Push(child);
            }
            catch (InvalidOperationException) { }

            if (current is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try
                {
                    for (var index = 0; index < VisualTreeHelper.GetChildrenCount(current); index++)
                        pending.Push(VisualTreeHelper.GetChild(current, index));
                }
                catch (InvalidOperationException) { }
            }
        }

        return null;
    }

    private void FinanceShortcut_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: string header }) return;

        // Finance-center shortcuts use the same route as the sidebar to keep the active
        // item, module title, status text, and destination synchronized.
        var route = NativeTabHeaders.FirstOrDefault(pair =>
            string.Equals(pair.Value, header, StringComparison.Ordinal)).Key;
        if (!string.IsNullOrWhiteSpace(route) && FindNavigationButton(route) is Button navigationButton)
        {
            NavigateModule_Click(navigationButton, e);
            return;
        }

        var target = MainTabs.Items.OfType<TabItem>().FirstOrDefault(tab =>
            string.Equals(tab.Header?.ToString(), header, StringComparison.Ordinal));
        if (target is null) return;
        MainTabs.Visibility = Visibility.Visible;
        MigrationPanel.Visibility = Visibility.Collapsed;
        MainTabs.SelectedItem = target;
    }

    private void NavigateModule_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement source || source.Tag is not string key ||
            !NativeModuleLinks.TryGetValue(key, out var module))
            return;

        UpdateNavigationSelection(key);

        var tabs = FindName("MainTabs") as TabControl;
        var migrationPanel = FindName("MigrationPanel") as Border;
        var targetHeader = NativeTabHeaders.GetValueOrDefault(key);
        var targetTab = targetHeader is null || tabs is null
            ? null
            : tabs.Items.OfType<TabItem>().FirstOrDefault(tab =>
                string.Equals(tab.Header?.ToString(), targetHeader, StringComparison.Ordinal));

        if (FindName("CurrentModuleText") is TextBlock currentModule)
            currentModule.Text = module.Title + (targetTab is not null ? " • نسخهٔ بومی" : " • در حال مهاجرت");

        if (targetTab is not null && tabs is not null && migrationPanel is not null)
        {
            migrationPanel.Visibility = Visibility.Collapsed;
            tabs.Visibility = Visibility.Visible;
            tabs.SelectedItem = targetTab;
            if (key == "about") RefreshAboutCompanyPage();

            // Company profile and accounting preferences share one page; advanced settings
            // is its own tab, so it is never scrolled into a different page by index.
            if (key is "companies" or "settings")
            {
                Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
                {
                    if (!IsLoaded) return;
                    AccountingSettingsScrollViewer.UpdateLayout();
                    if (key == "companies")
                    {
                        AccountingSettingsScrollViewer.ScrollToHome();
                        CompanyProfileSelector.BringIntoView();
                    }
                    else
                    {
                        AccountingSettingsScrollViewer.ScrollToHome();
                        SettingsTaxRate.BringIntoView();
                    }
                }));
            }

            if (FindName("FooterStatus") is TextBlock footer)
                footer.Text = "بخش بومی فعال: " + module.Title + "؛ قابلیت‌های هنوز منتقل‌نشده جداگانه مشخص هستند.";
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

    private void UpdateNavigationSelection(string activeKey, string? themeOverride = null)
    {
        _activeNavigationKey = activeKey;
        if (FindName("NavigationRoot") is not DependencyObject root) return;
        var isDark = ApplicationThemeService.Normalize(themeOverride ?? _data.Preferences?.ApplicationTheme) == "dark";
        var pending = new Stack<DependencyObject>();
        pending.Push(root);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (current is Button button && button.Tag is string key && NativeModuleLinks.ContainsKey(key))
            {
                var isActive = string.Equals(key, activeKey, StringComparison.Ordinal);
                // The sidebar is intentionally a stable dark navigation surface in both themes;
                // only the active route and fine border tone change with the active state/theme.
                button.Background = isActive
                    ? new SolidColorBrush(Color.FromRgb(15, 118, 110))
                    : new SolidColorBrush(Color.FromRgb(31, 41, 55));
                button.Foreground = isActive
                    ? Brushes.White
                    : new SolidColorBrush(Color.FromRgb(241, 245, 249));
                button.BorderBrush = new SolidColorBrush(isDark
                    ? Color.FromRgb(71, 85, 105)
                    : Color.FromRgb(51, 65, 85));
                button.BorderThickness = new Thickness(1);
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
