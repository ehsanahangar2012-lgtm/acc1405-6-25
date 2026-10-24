using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Data;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoiceDialog : Window
{
    private sealed record Choice(string Value, string Label);
    private readonly List<CustomerRecord> _people;
    private readonly List<ProductRecord> _products;
    private readonly IReadOnlyList<InvoiceRecord> _invoices;
    private readonly Func<AccountingData>? _accountingDataProvider;
    private readonly Func<Window, CustomerRecord?>? _quickAddCustomer;
    private readonly Func<Window, ProductRecord?>? _quickAddProduct;
    private readonly string _defaultInvoiceTheme;
    private readonly bool _showInvoiceQr;
    private readonly CompanyProfileRecord? _companyProfile;
    private readonly string _defaultInvoicePrefix;
    private readonly decimal _defaultTaxRatePercent;
    private readonly string _currencyLabel;
    private readonly string _invoiceFooter;
    private readonly IReadOnlyList<string> _footerTemplates;
    private readonly TextBox _invoiceFooterText = new() { Height = 72, Padding = new Thickness(8), AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
    private readonly ComboBox _footerTemplateSelector = new() { Height = 34, MinWidth = 260, IsTextSearchEnabled = true };
    private readonly CheckBox _saveFooterAsTemplate = new() { Content = "ذخیرهٔ این متن به‌عنوان الگوی آماده", Margin = new Thickness(0, 5, 0, 8) };
    public bool SaveFooterAsTemplate { get; private set; }
    public string FooterTemplateToSave { get; private set; } = "";
    private readonly InvoiceRecord? _existingInvoice;
    private readonly TextBox _barcodeScan = new() { Height = 34, MinWidth = 240, Padding = new Thickness(8, 4, 8, 4), FlowDirection = FlowDirection.LeftToRight };
    private readonly CheckBox _taxIsAmount = new() { Content = "مالیات مبلغی است (خاموش: درصد از جمع کالاها)", IsChecked = true, Margin = new Thickness(0, 6, 0, 0) };

    private readonly ComboBox _type = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, ItemsSource = new[]
    {
        new Choice("SALE", "فاکتور فروش"),
        new Choice("PURCHASE", "فاکتور خرید"),
        new Choice("PROFORMA", "پیش‌فاکتور")
    }, SelectedIndex = 0 };
    private readonly ComboBox _person = new() { Height = 48, MinWidth = 250, Tag = "نام، کد یا تلفن را جست‌وجو کنید…", IsEditable = true, StaysOpenOnEdit = true, IsTextSearchEnabled = false, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 320, ToolTip = "برای دیدن فهرست، فلش کنار کادر را بزنید؛ نام، کد یا تلفن را جست‌وجو کرده و روی نتیجه کلیک کنید." };
    private readonly TextBlock _partyHint = new() { FontSize = 11, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(2, 0, 2, 8) };
    private readonly ComboBox _product = new() { Height = 34, DisplayMemberPath = nameof(ProductRecord.Name), MinWidth = 240, IsEditable = true, StaysOpenOnEdit = true, IsTextSearchEnabled = false, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300, ToolTip = "نام، کد، بارکد یا سریال کالا را تایپ کنید و از نتایج انتخاب کنید." };
    private readonly TextBox _quantity = new() { Height = 32, Width = 90, Text = "1", Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _price = new() { Height = 32, Width = 130, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _lineDescription = new()
    {
        Height = 38, Width = 230, Padding = new Thickness(8, 4, 8, 4),
        AcceptsReturn = true, TextWrapping = TextWrapping.Wrap,
        ToolTip = "شرح تکمیلی این قلم؛ در فاکتور چاپی داخل کادر جداگانه نمایش داده می‌شود."
    };
    private readonly TextBox _date = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4), ToolTip = "تاریخ شمسی با قالب سال/ماه/روز؛ نمونه: ۱۴۰۵/۰۷/۰۲" };
    private readonly TextBox _dueDate = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4), ToolTip = "تاریخ سررسید شمسی با قالب سال/ماه/روز؛ خالی گذاشتن مجاز است" };
    private readonly TextBox _discount = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4), Text = "0" };
    private readonly TextBox _tax = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4), Text = "0" };
    private readonly TextBox _cashAmount = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4), Text = "0" };
    private readonly TextBox _description = new() { Height = 52, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, Padding = new Thickness(8) };
    private readonly TextBox _notes = new() { Height = 52, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, Padding = new Thickness(8) };
    private readonly TextBox _driverName = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _driverPhone = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _vehiclePlate = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _taxId = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly CheckBox _showPreviousBalance = new() { Content = "نمایش مانده قبلی طرف حساب", IsChecked = true, Margin = new Thickness(0, 8, 0, 8) };
    private readonly ObservableCollection<InvoiceLine> _lines = [];
    private readonly DataGrid _lineList = new()
    {
        Height = 190, MinWidth = 400, AutoGenerateColumns = false, CanUserAddRows = false,
        IsReadOnly = true, SelectionUnit = DataGridSelectionUnit.FullRow, HeadersVisibility = DataGridHeadersVisibility.Column,
        RowHeaderWidth = 0, CanUserResizeColumns = true, CanUserSortColumns = true,
        HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, VerticalScrollBarVisibility = ScrollBarVisibility.Auto
    };
    private readonly Button _addLineButton = new()
    {
        Content = "افزودن قلم", Height = 32, Padding = new Thickness(12, 4, 12, 4), Margin = new Thickness(8, 0, 0, 0)
    };
    private int _editingLineIndex = -1;
    private readonly TextBlock _numberPreview = new() { FontSize = 13, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(15, 118, 110)), Margin = new Thickness(0, 8, 0, 12) };
    private readonly TextBlock _totals = new() { FontSize = 14, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 6) };

    public InvoiceDraft? Result { get; private set; }

    public InvoiceDialog(
        Window owner,
        IReadOnlyList<CustomerRecord> people,
        IReadOnlyList<ProductRecord> products,
        IReadOnlyList<InvoiceRecord> invoices,
        Func<Window, CustomerRecord?>? quickAddCustomer = null,
        Func<Window, ProductRecord?>? quickAddProduct = null,
        string? defaultInvoiceTheme = null,
        bool showInvoiceQr = true,
        CompanyProfileRecord? companyProfile = null,
        string? defaultInvoicePrefix = null,
        decimal defaultTaxRatePercent = 0m,
        string? currencyCode = "RIAL",
        string? invoiceFooter = null,
        InvoiceRecord? existingInvoice = null,
        IReadOnlyList<string>? footerTemplates = null,
        Func<AccountingData>? accountingDataProvider = null)
    {
        Owner = owner;
        _accountingDataProvider = accountingDataProvider;
        _people = people.ToList();
        _products = products.ToList();
        _invoices = invoices;
        _quickAddCustomer = quickAddCustomer;
        _quickAddProduct = quickAddProduct;
        _defaultInvoiceTheme = defaultInvoiceTheme ?? "modern";
        _showInvoiceQr = showInvoiceQr;
        _companyProfile = companyProfile;
        _defaultInvoicePrefix = string.IsNullOrWhiteSpace(defaultInvoicePrefix) ? "INV-" : defaultInvoicePrefix.Trim();
        _defaultTaxRatePercent = defaultTaxRatePercent is >= 0m and <= 100m ? defaultTaxRatePercent : 0m;
        _currencyLabel = currencyCode?.Trim().ToUpperInvariant() switch
        {
            "TOMAN" => "تومان",
            "RIAL" or "" or null => "ریال",
            _ => currencyCode.Trim()
        };
        _invoiceFooter = invoiceFooter ?? "";
        _footerTemplates = (footerTemplates ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()).Distinct(StringComparer.Ordinal).ToList();
        SmartComboBoxSearchService.SetItems(_footerTemplateSelector, _footerTemplates, value => new[] { value });
        _person.ItemTemplate = CreatePartyTemplate();
        TextSearch.SetTextPath(_person, nameof(CustomerRecord.Name));
        _invoiceFooterText.Text = !string.IsNullOrWhiteSpace(existingInvoice?.InvoiceFooter)
            ? existingInvoice.InvoiceFooter : _invoiceFooter;
        _existingInvoice = existingInvoice;
        _taxIsAmount.IsChecked = _defaultTaxRatePercent == 0m;
        _tax.Text = _taxIsAmount.IsChecked == true
            ? "0"
            : _defaultTaxRatePercent.ToString("0.##", CultureInfo.InvariantCulture);
        Title = existingInvoice is null ? "ثبت فاکتور / پیش‌فاکتور" : "ویرایش پیش‌فاکتور";
        Width = 1060;
        Height = 900;
        MinWidth = 900;
        MinHeight = 680;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
        ResizeMode = ResizeMode.CanResize;

        _date.Text = FormatPersianDate(existingInvoice?.CreatedAt ?? DateTimeOffset.Now);
        if (existingInvoice is not null)
        {
            _dueDate.Text = existingInvoice.DueDate is DateTimeOffset due ? FormatPersianDate(due) : "";
            _discount.Text = existingInvoice.Discount.ToString(CultureInfo.InvariantCulture);
            _taxIsAmount.IsChecked = existingInvoice.TaxIsAmount;
            _tax.Text = (existingInvoice.TaxIsAmount ? existingInvoice.TaxAmount : existingInvoice.TaxRatePercent).ToString(CultureInfo.InvariantCulture);
            _cashAmount.Text = existingInvoice.CashAmount.ToString(CultureInfo.InvariantCulture);
            _description.Text = existingInvoice.Description;
            _notes.Text = existingInvoice.Notes;
            _driverName.Text = existingInvoice.DriverName;
            _driverPhone.Text = existingInvoice.DriverPhone;
            _vehiclePlate.Text = existingInvoice.VehiclePlate;
            _taxId.Text = existingInvoice.TaxId;
            _showPreviousBalance.IsChecked = existingInvoice.ShowPreviousBalance;
        }
        foreach (var numericField in new[] { _quantity, _price, _discount, _tax, _cashAmount })
            NumericTextBoxFormatter.Attach(numericField);
        ConfigureLineGrid();
        _lineList.ItemsSource = _lines;
        SmartComboBoxSearchService.SetItems(_product, _products, product => new[] { product.Name, product.Code, product.Barcode, product.SerialNumber });
        ProductComboBoxPresentationService.ApplyProductItemTemplate(_product);

        var root = new StackPanel { Margin = new Thickness(18) };
        root.Children.Add(CreateInvoiceHero());

        // Keep party/date selection beside the live financial summary; line items and
        // logistics remain full-width below so the form uses desktop space efficiently.
        var topSections = new Grid { Margin = new Thickness(0, 0, 0, 2) };
        topSections.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        topSections.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        topSections.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        root.Children.Add(topSections);

        var documentSection = new StackPanel();
        AddField(documentSection, "نوع سند", _type);
        documentSection.Children.Add(_numberPreview);
        AddField(documentSection, "مشتری / تأمین‌کننده", _person);
        documentSection.Children.Add(_partyHint);
        var addPersonInline = new Button
        {
            Content = "＋ ثبت شخص جدید بدون بستن فاکتور",
            Height = 36, HorizontalAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(14, 6, 14, 6), Margin = new Thickness(0, 3, 0, 8)
        };
        addPersonInline.Click += (_, _) => AddPersonInline();
        documentSection.Children.Add(addPersonInline);

        var dates = new Grid { Margin = new Thickness(0, 4, 0, 0) };
        dates.ColumnDefinitions.Add(new ColumnDefinition());
        dates.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        dates.ColumnDefinitions.Add(new ColumnDefinition());
        var datePanel = new StackPanel();
        AddDateField(datePanel, "تاریخ صدور شمسی", _date, optional: false);
        Grid.SetColumn(datePanel, 0);
        var duePanel = new StackPanel();
        AddDateField(duePanel, "تاریخ سررسید شمسی (اختیاری)", _dueDate, optional: true);
        Grid.SetColumn(duePanel, 2);
        dates.Children.Add(datePanel);
        var dateSpacer = new Border();
        Grid.SetColumn(dateSpacer, 1);
        dates.Children.Add(dateSpacer);
        dates.Children.Add(duePanel);
        documentSection.Children.Add(dates);
        var documentCard = CreateSectionCard("مشخصات فاکتور", "نوع سند، طرف حساب و تاریخ‌های مرتبط", documentSection);
        Grid.SetColumn(documentCard, 0);
        topSections.Children.Add(documentCard);

        var itemsSection = new StackPanel();
        AddField(itemsSection, "بارکدخوان (پس از اسکن، کلید Enter)", _barcodeScan);
        AddField(itemsSection, "کالا", _product);
        var addProductInline = new Button
        {
            Content = "＋ ثبت کالای جدید بدون بستن فاکتور",
            Height = 36, HorizontalAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(14, 6, 14, 6), Margin = new Thickness(0, 3, 0, 10)
        };
        addProductInline.Click += (_, _) => AddProductInline();
        itemsSection.Children.Add(addProductInline);

        var lineRow = new WrapPanel { Margin = new Thickness(0, 2, 0, 4), VerticalAlignment = VerticalAlignment.Bottom };
        var quantityPanel = new StackPanel { Width = 100, Margin = new Thickness(0, 0, 8, 0) };
        AddField(quantityPanel, "تعداد", _quantity);
        var pricePanel = new StackPanel { Width = 138, Margin = new Thickness(0, 0, 8, 0) };
        AddField(pricePanel, "قیمت واحد", _price);
        var descriptionPanel = new StackPanel { Width = 238, Margin = new Thickness(0, 0, 8, 0) };
        AddField(descriptionPanel, "شرح قلم (اختیاری)", _lineDescription);
        lineRow.Children.Add(quantityPanel);
        lineRow.Children.Add(pricePanel);
        lineRow.Children.Add(descriptionPanel);
        _addLineButton.MinWidth = 120;
        _addLineButton.Height = 36;
        lineRow.Children.Add(_addLineButton);
        itemsSection.Children.Add(lineRow);
        itemsSection.Children.Add(new TextBlock
        {
            Text = "قلم انتخاب‌شده را می‌توانید ویرایش یا حذف کنید؛ جمع هر ردیف به‌صورت خودکار محاسبه می‌شود.",
            FontSize = 11, Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            Margin = new Thickness(0, 0, 0, 6), TextWrapping = TextWrapping.Wrap
        });
        itemsSection.Children.Add(_lineList);
        var rowActions = new WrapPanel { Margin = new Thickness(0, 8, 0, 2) };
        var editLine = new Button { Content = "ویرایش ردیف انتخاب‌شده", MinWidth = 165, Height = 36, Margin = new Thickness(0, 0, 8, 0) };
        editLine.Click += (_, _) => BeginEditLine();
        rowActions.Children.Add(editLine);
        var remove = new Button { Content = "حذف قلم انتخاب‌شده", MinWidth = 150, Height = 36 };
        rowActions.Children.Add(remove);
        itemsSection.Children.Add(rowActions);
        root.Children.Add(CreateSectionCard("اقلام فاکتور", "جست‌وجوی کالا، افزودن ردیف و اصلاح اقلام", itemsSection));

        var pricingSection = new StackPanel();
        var pricing = new Grid { Margin = new Thickness(0, 4, 0, 0) };
        pricing.ColumnDefinitions.Add(new ColumnDefinition());
        pricing.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        pricing.ColumnDefinitions.Add(new ColumnDefinition());
        var discountPanel = new StackPanel();
        AddField(discountPanel, "تخفیف (مبلغ)", _discount);
        Grid.SetColumn(discountPanel, 0);
        var taxPanel = new StackPanel();
        AddField(taxPanel, "مالیات (مبلغ یا درصد)", _tax);
        taxPanel.Children.Add(_taxIsAmount);
        Grid.SetColumn(taxPanel, 2);
        pricing.Children.Add(discountPanel);
        var pricingSpacer = new Border();
        Grid.SetColumn(pricingSpacer, 1);
        pricing.Children.Add(pricingSpacer);
        pricing.Children.Add(taxPanel);
        pricingSection.Children.Add(pricing);
        pricingSection.Children.Add(_totals);
        AddField(pricingSection, "دریافت/پرداخت نقدی هنگام صدور", _cashAmount);
        var pricingCard = CreateSectionCard("جمع‌بندی مالی", "تخفیف، مالیات و مانده سند به‌صورت خودکار محاسبه می‌شوند", pricingSection);
        Grid.SetColumn(pricingCard, 2);
        topSections.Children.Add(pricingCard);

        var extraSection = new StackPanel();
        AddField(extraSection, "شرح فاکتور / متن چاپ", _description);
        AddField(extraSection, "یادداشت داخلی (در چاپ درج نمی‌شود)", _notes);
        extraSection.Children.Add(new TextBlock
        {
            Text = "پانویس قابل انتخاب برای چاپ فاکتور",
            FontWeight = FontWeights.SemiBold, FontSize = 13,
            Margin = new Thickness(0, 12, 0, 5)
        });
        var footerTemplateRow = new WrapPanel { Margin = new Thickness(0, 0, 0, 5) };
        footerTemplateRow.Children.Add(_footerTemplateSelector);
        var insertFooterTemplate = new Button
        {
            Content = "درج الگو", MinWidth = 100, Height = 36,
            Margin = new Thickness(8, 0, 0, 0)
        };
        insertFooterTemplate.Click += (_, _) =>
        {
            if (_footerTemplateSelector.SelectedItem is not string template || string.IsNullOrWhiteSpace(template)) return;
            var existingLines = _invoiceFooterText.Text.Split(
                new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (!existingLines.Contains(template, StringComparer.Ordinal))
                _invoiceFooterText.Text = string.IsNullOrWhiteSpace(_invoiceFooterText.Text)
                    ? template : _invoiceFooterText.Text.TrimEnd() + Environment.NewLine + template;
        };
        footerTemplateRow.Children.Add(insertFooterTemplate);
        extraSection.Children.Add(footerTemplateRow);
        AddField(extraSection, "زیرنویس دلخواه (فقط روی همین فاکتور چاپ می‌شود)", _invoiceFooterText);
        extraSection.Children.Add(_saveFooterAsTemplate);

        var logistics = new Grid { Margin = new Thickness(0, 2, 0, 0) };
        logistics.ColumnDefinitions.Add(new ColumnDefinition());
        logistics.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        logistics.ColumnDefinitions.Add(new ColumnDefinition());
        var driverPanel = new StackPanel();
        AddField(driverPanel, "نام راننده", _driverName);
        Grid.SetColumn(driverPanel, 0);
        var phonePanel = new StackPanel();
        AddField(phonePanel, "تلفن راننده", _driverPhone);
        Grid.SetColumn(phonePanel, 2);
        logistics.Children.Add(driverPanel);
        var logisticsSpacer = new Border();
        Grid.SetColumn(logisticsSpacer, 1);
        logistics.Children.Add(logisticsSpacer);
        logistics.Children.Add(phonePanel);
        extraSection.Children.Add(logistics);
        AddField(extraSection, "شماره پلاک / خودرو", _vehiclePlate);
        AddField(extraSection, "شناسه مالیاتی ۲۲ نویسه (اختیاری)", _taxId);
        extraSection.Children.Add(_showPreviousBalance);
        root.Children.Add(CreateSectionCard("اطلاعات تکمیلی و چاپ", "یادداشت‌ها، اطلاعات ارسال و گزینه‌های چاپ", extraSection));

        var buttons = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 14, 0, 0) };
        var preview = new Button { Content = "پیش‌نمایش قبل از ذخیره", MinWidth = 175, Height = 38, Margin = new Thickness(0, 0, 8, 8) };
        preview.Click += (_, _) => PreviewDraft();
        buttons.Children.Add(preview);
        var save = new Button { Content = "ذخیره سند", Width = 125, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 8) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true, Margin = new Thickness(0, 0, 0, 8) });
        var layout = new Grid { Margin = new Thickness(0) };
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        buttons.Margin = new Thickness(22, 10, 22, 18);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;

        foreach (var field in new[] { _quantity, _price, _discount, _tax, _cashAmount })
            NumericTextBoxFormatter.Attach(field);
        _barcodeScan.PreviewKeyDown += BarcodeScan_PreviewKeyDown;

        _type.SelectionChanged += (_, _) =>
        {
            RefreshPeople();
            ApplyDefaultPrice();
            RepriceLines();
            RefreshNumberPreview();
            RefreshTotals();
        };
        _person.SelectionChanged += (_, _) => { RefreshTotals(); UpdatePartyHint(); };
        _person.DropDownClosed += (_, _) => UpdatePartyHint();
        _person.AddHandler(TextBoxBase.TextChangedEvent,
            new TextChangedEventHandler((_, _) => UpdatePartyHint()), handledEventsToo: true);
        _product.SelectionChanged += (_, _) => ApplyDefaultPrice();
        _discount.TextChanged += (_, _) => RefreshTotals();
        _tax.TextChanged += (_, _) => RefreshTotals();
        _taxIsAmount.Checked += (_, _) => RefreshTotals();
        _taxIsAmount.Unchecked += (_, _) => RefreshTotals();
        _cashAmount.TextChanged += (_, _) => RefreshTotals();
        _addLineButton.Click += (_, _) => AddLine();
        remove.Click += (_, _) =>
        {
            if (_lineList.SelectedIndex >= 0)
            {
                var removedIndex = _lineList.SelectedIndex;
                _lines.RemoveAt(removedIndex);
                if (_editingLineIndex == removedIndex) ResetLineEditor();
                else if (_editingLineIndex > removedIndex) _editingLineIndex--;
                RefreshLines();
                RefreshTotals();
            }
        };
        save.Click += (_, _) => SaveResult();

        _type.SelectedItem = _type.Items.Cast<Choice>()
            .FirstOrDefault(choice => choice.Value == (_existingInvoice?.Type ?? "SALE")) ?? _type.Items[0];
        RefreshPeople();
        if (_existingInvoice is not null)
        {
            // Preserve document type while editing so inventory and posting reversal stay coherent.
            _type.IsEnabled = false;
            _person.SelectedItem = _person.Items.Cast<CustomerRecord>()
                .FirstOrDefault(person => person.Id == _existingInvoice.CustomerId);
            foreach (var line in _existingInvoice.Lines)
                _lines.Add(new InvoiceLine
                {
                    ProductId = line.ProductId, ProductName = line.ProductName,
                    Unit = string.IsNullOrWhiteSpace(line.Unit) ? _products.FirstOrDefault(product => product.Id == line.ProductId)?.Unit ?? "عدد" : line.Unit,
                    SerialNumber = line.SerialNumber, Quantity = line.Quantity, BuyPrice = line.BuyPrice, UnitPrice = line.UnitPrice, Profit = line.Profit,
                    LineTotal = line.LineTotal, Description = line.Description, EntryOrder = line.EntryOrder
                });
        }
        if (_product.Items.Count > 0) _product.SelectedIndex = 0;
        RefreshNumberPreview();
        RefreshLines();
        RefreshTotals();
    }

    private void AddPersonInline()
    {
        if (_quickAddCustomer is null)
        {
            MessageBox.Show(this, "ثبت سریع شخص در این فرم آماده نیست.", "ثبت شخص", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var created = _quickAddCustomer(this);
        if (created is null) return;
        if (_people.All(person => person.Id != created.Id))
            _people.Add(created);

        RefreshPeople();
        var visible = _person.Items.Cast<CustomerRecord>().FirstOrDefault(person => person.Id == created.Id);
        if (visible is not null)
            _person.SelectedItem = visible;
        else
            MessageBox.Show(this,
                CurrentType == "PURCHASE"
                    ? "شخص ثبت شد؛ برای انتخاب در فاکتور خرید باید نقش تأمین‌کننده برای او فعال باشد."
                    : "شخص ثبت شد؛ برای انتخاب در فاکتور فروش باید نقش مشتری برای او فعال باشد.",
                "نقش طرف حساب", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void AddProductInline()
    {
        if (_quickAddProduct is null)
        {
            MessageBox.Show(this, "ثبت سریع کالا در این فرم آماده نیست.", "ثبت کالا", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var created = _quickAddProduct(this);
        if (created is null) return;
        if (_products.All(product => product.Id != created.Id))
            _products.Add(created);

        SmartComboBoxSearchService.SetItems(_product, _products,
            product => new[] { product.Name, product.Code, product.Barcode, product.SerialNumber });
        _product.SelectedItem = _product.Items.Cast<ProductRecord>().FirstOrDefault(product => product.Id == created.Id);
        ApplyDefaultPrice();
    }

    private string CurrentType => (_type.SelectedItem as Choice)?.Value ?? "SALE";

    private void RefreshPeople()
    {
        var previousId = (_person.SelectedItem as CustomerRecord)?.Id;
        var candidates = InvoicePartySelectionService.GetSelectableParties(_people, CurrentType);
        SmartComboBoxSearchService.SetItems(_person, candidates,
            person => new[] { person.Name, person.Code, person.Phone, person.Email });
        var previous = candidates.ToList().FindIndex(person => person.Id == previousId);
        // Never attach the first customer to a new invoice implicitly. The user must
        // explicitly select a filtered result; an edit preserves its current valid party.
        _person.SelectedIndex = previous >= 0 ? previous : -1;
        if (previous < 0) _person.Text = "";
        _person.IsEnabled = candidates.Count > 0;
        _numberPreview.Text = BuildNumberPreview(CurrentType);
        UpdatePartyHint();
    }

    private void UpdatePartyHint()
    {
        _partyHint.ToolTip = null;
        if (_person.SelectedItem is CustomerRecord person)
        {
            var details = string.IsNullOrWhiteSpace(person.Phone) ? "" : $" • تلفن: {person.Phone}";
            var balance = BuildPartyBalanceDisplay(person);
            _partyHint.Text = $"طرف حساب انتخاب‌شده: {person.Name}  |  کد: {person.Code}{details}  |  {balance}";
            ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(15, 118, 110));
            return;
        }

        var query = _person.Text?.Trim() ?? "";
        if (query.Length > 0)
        {
            if (_person.IsDropDownOpen)
            {
                _partyHint.Text = "برای ثبت طرف حساب، یکی از نتایج فهرست را انتخاب کنید؛ تایپ متن به‌تنهایی انتخاب محسوب نمی‌شود.";
                ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(15, 118, 110));
            }
            else if (_person.Items.Count > 0)
            {
                _partyHint.Text = $"برای «{query}» {_person.Items.Count:N0} نتیجه موجود است؛ فهرست را باز کنید و یک مورد را انتخاب کنید.";
                ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(15, 118, 110));
            }
            else
            {
                _partyHint.Text = $"موردی با عبارت «{query}» پیدا نشد؛ نام، کد یا تلفن را بررسی کنید.";
                ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(185, 28, 28));
            }
            return;
        }

        if (_person.Items.Count > 0)
        {
            _partyHint.Text = "برای جست‌وجو، نام، کد یا تلفن را تایپ کنید و یک نتیجه را انتخاب کنید.";
            ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(15, 118, 110));
            return;
        }

        _partyHint.Text = CurrentType == "PURCHASE"
            ? "تأمین‌کننده‌ای با نقش فعال پیدا نشد؛ شخص جدید ثبت کنید یا نقش تأمین‌کننده را در پروندهٔ او فعال کنید."
            : "مشتری‌ای با نقش فعال پیدا نشد؛ شخص جدید ثبت کنید یا نقش مشتری را در پروندهٔ او فعال کنید.";
        ApplicationThemeService.SetReadableForeground(_partyHint, Color.FromRgb(185, 28, 28));
    }

    private string BuildPartyBalanceDisplay(CustomerRecord person)
    {
        var data = _accountingDataProvider?.Invoke();
        if (data is null)
            return "ماندهٔ دفتر: در دسترس نیست";

        try
        {
            // Read the live ledger-derived report, not CustomerRecord.Balance, which is a
            // preserved legacy snapshot and may not reflect current invoices and settlements.
            var balance = PersonKardexService.GetReport(data, person).ClosingBalance;
            var side = balance > 0m ? "بدهکار" : balance < 0m ? "بستانکار" : "تسویه";
            var amount = Math.Abs(balance).ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
            return $"ماندهٔ دفتر: {amount} {_currencyLabel} ({side})";
        }
        catch (Exception ex)
        {
            _partyHint.ToolTip = "ماندهٔ دفتر در این لحظه محاسبه نشد: " + ex.Message;
            return "ماندهٔ دفتر: قابل محاسبه نیست";
        }
    }

    private void ApplyDefaultPrice()
    {
        if (_product.SelectedItem is not ProductRecord product) return;
        var price = CurrentType == "SALE" ? product.SellPrice : (product.BuyPrice ?? 0m);
        _price.Text = price.ToString("0.##", CultureInfo.InvariantCulture);
    }

    private void BarcodeScan_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        e.Handled = true;
        var barcode = _barcodeScan.Text.Trim();
        if (barcode.Length == 0) return;
        var product = _products.FirstOrDefault(item =>
            string.Equals(item.Barcode, barcode, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.Code, barcode, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.SerialNumber, barcode, StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            MessageBox.Show(this, $"برای بارکد «{barcode}» کالایی پیدا نشد.", "بارکدخوان",
                MessageBoxButton.OK, MessageBoxImage.Information);
            _barcodeScan.SelectAll();
            return;
        }
        _product.SelectedItem = product;
        ApplyDefaultPrice();
        _quantity.Text = "1";
        AddLine();
        _barcodeScan.Clear();
        _barcodeScan.Focus();
    }

    private static void FormatNumericField(TextBox field)
    {
        // Group thousands but do not force trailing decimal zeros such as 2.00.
        if (!string.IsNullOrWhiteSpace(field.Text) &&
            PersianNumberParser.TryParseDecimal(field.Text, out var value))
            field.Text = NumericTextBoxFormatter.Format(value);
    }

    private void ConfigureLineGrid()
    {
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "کالا", Binding = new Binding(nameof(InvoiceLine.ProductName)),
            Width = new DataGridLength(2.2, DataGridLengthUnitType.Star), MinWidth = 90
        });
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "تعداد", Binding = new Binding(nameof(InvoiceLine.Quantity)) { StringFormat = "{0:#,##0.##}" },
            Width = new DataGridLength(0.8, DataGridLengthUnitType.Star), MinWidth = 55
        });
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "واحد", Binding = new Binding(nameof(InvoiceLine.Unit)),
            Width = new DataGridLength(0.75, DataGridLengthUnitType.Star), MinWidth = 50
        });
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "قیمت واحد", Binding = new Binding(nameof(InvoiceLine.UnitPrice)) { StringFormat = "{0:#,##0.##}" },
            Width = new DataGridLength(1.2, DataGridLengthUnitType.Star), MinWidth = 70
        });
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "جمع", Binding = new Binding(nameof(InvoiceLine.LineTotal)) { StringFormat = "{0:#,##0.##}" },
            Width = new DataGridLength(1.2, DataGridLengthUnitType.Star), MinWidth = 70
        });
        _lineList.Columns.Add(new DataGridTextColumn
        {
            Header = "شرح", Binding = new Binding(nameof(InvoiceLine.Description)),
            Width = new DataGridLength(1.5, DataGridLengthUnitType.Star), MinWidth = 65
        });
    }

    private void BeginEditLine()
    {
        if (_lineList.SelectedItem is not InvoiceLine line)
        {
            MessageBox.Show(this, "ابتدا ردیف موردنظر را در جدول انتخاب کنید.", "ویرایش قلم",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        _editingLineIndex = _lines.IndexOf(line);
        _product.SelectedItem = _products.FirstOrDefault(product => product.Id == line.ProductId);
        _quantity.Text = line.Quantity.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
        _price.Text = line.UnitPrice.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
        _lineDescription.Text = line.Description;
        _addLineButton.Content = "اعمال تغییرات ردیف";
        _quantity.Focus();
    }

    private void ResetLineEditor()
    {
        _editingLineIndex = -1;
        _addLineButton.Content = "افزودن قلم";
        _quantity.Text = "1";
        _lineDescription.Clear();
        ApplyDefaultPrice();
    }

    private void AddLine()
    {
        try
        {
            if (_product.SelectedItem is not ProductRecord product)
                throw new InvalidOperationException("یک کالا انتخاب کنید.");
            var quantity = PersianNumberParser.ParseDecimal(_quantity.Text, "تعداد");
            var price = AccountingRules.Money(PersianNumberParser.ParseDecimal(_price.Text, "قیمت واحد"));
            if (quantity <= 0m || price < 0m)
                throw new InvalidOperationException("تعداد باید مثبت و قیمت واحد نمی‌تواند منفی باشد.");
            if (CurrentType == "SALE")
            {
                var alreadyInInvoice = _lines
                    .Where((line, index) => index != _editingLineIndex && line.ProductId == product.Id)
                    .Sum(line => line.Quantity);
                var available = product.StockQuantity - product.ReservedStock;
                // When editing a posted sale, temporarily account for its existing stock-out.
                if (_existingInvoice?.Type == "SALE")
                    available += _existingInvoice.Lines.Where(line => line.ProductId == product.Id).Sum(line => line.Quantity);
                if (alreadyInInvoice + quantity > available)
                    throw new InvalidOperationException($"موجودی آزاد کافی نیست؛ موجودی آزاد پس از درنظرگرفتن سند انتخابی: {available:#,##0.##}");
            }
            var buyPrice = AccountingRules.Money(product.BuyPrice ?? 0m);
            var entryOrder = _editingLineIndex >= 0 && _editingLineIndex < _lines.Count
                ? _lines[_editingLineIndex].EntryOrder
                : _lines.Count + 1;
            var updatedLine = new InvoiceLine
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Unit = product.Unit,
                SerialNumber = product.SerialNumber,
                Quantity = quantity,
                BuyPrice = buyPrice,
                UnitPrice = price,
                Profit = CurrentType == "SALE" ? AccountingRules.Money((price - buyPrice) * quantity) : 0m,
                LineTotal = AccountingRules.Money(quantity * price),
                Description = _lineDescription.Text.Trim(),
                EntryOrder = entryOrder
            };

            if (_editingLineIndex >= 0 && _editingLineIndex < _lines.Count)
                _lines[_editingLineIndex] = updatedLine;
            else
                _lines.Add(updatedLine);

            _editingLineIndex = -1;
            _addLineButton.Content = "افزودن قلم";
            _quantity.Text = "1";
            _lineDescription.Clear();
            RefreshLines();
            RefreshTotals();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی قلم سند", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void RepriceLines()
    {
        for (var i = 0; i < _lines.Count; i++)
        {
            var line = _lines[i];
            var product = _products.FirstOrDefault(p => p.Id == line.ProductId);
            if (product is null) continue;
            var buyPrice = AccountingRules.Money(product.BuyPrice ?? 0m);
            var unitPrice = AccountingRules.Money(CurrentType == "SALE" ? product.SellPrice : (product.BuyPrice ?? 0m));
            _lines[i] = new InvoiceLine
            {
                ProductId = line.ProductId,
                ProductName = product.Name,
                Unit = product.Unit,
                SerialNumber = product.SerialNumber,
                Quantity = line.Quantity,
                BuyPrice = buyPrice,
                UnitPrice = unitPrice,
                Profit = CurrentType == "SALE" ? AccountingRules.Money((unitPrice - buyPrice) * line.Quantity) : 0m,
                LineTotal = AccountingRules.Money(unitPrice * line.Quantity),
                Description = line.Description,
                EntryOrder = line.EntryOrder
            };
        }
        RefreshLines();
    }

    private void RefreshLines()
    {
        for (var index = 0; index < _lines.Count; index++)
            _lines[index].EntryOrder = index + 1;
        if (!ReferenceEquals(_lineList.ItemsSource, _lines))
            _lineList.ItemsSource = _lines;
        _lineList.Items.Refresh();
    }

    private void RefreshTotals()
    {
        var subtotal = AccountingRules.Money(_lines.Sum(l => l.LineTotal));
        var discount = TryParseAmount(_discount.Text, out var d) && d >= 0m ? d : 0m;
        var taxInput = TryParseAmount(_tax.Text, out var parsedTax) && parsedTax >= 0m ? parsedTax : 0m;
        var isTaxAmount = _taxIsAmount.IsChecked == true;
        var taxInputValid = isTaxAmount || taxInput <= 100m;
        var tax = taxInputValid
            ? (isTaxAmount ? taxInput : AccountingRules.CalculateTax(subtotal, taxInput))
            : 0m;
        var cash = TryParseAmount(_cashAmount.Text, out var c) && c >= 0m ? c : 0m;
        var total = AccountingRules.Money(subtotal - discount + tax);
        var remaining = total - cash;
        var taxLabel = isTaxAmount ? "مالیات مبلغی" : $"مالیات ({taxInput:#,##0.##}٪)";
        _totals.Text = $"جمع کالاها: {subtotal:#,##0.##} {_currencyLabel}   |   تخفیف: {discount:#,##0.##} {_currencyLabel}   |   {taxLabel}: {tax:#,##0.##} {_currencyLabel}\nمبلغ نهایی: {total:#,##0.##} {_currencyLabel}   |   نقدی: {cash:#,##0.##} {_currencyLabel}   |   مانده پس از نقدی: {remaining:#,##0.##} {_currencyLabel}";
    }

    private void RefreshNumberPreview() => _numberPreview.Text = BuildNumberPreview(CurrentType);

    private string BuildNumberPreview(string type)
    {
        if (_existingInvoice is not null)
            return $"شماره سند: {_existingInvoice.DisplayNumber}  •  در ویرایش، شماره و کد پیگیری حفظ می‌شود.";
        var floor = type switch { "SALE" => 1000, "PROFORMA" => 2000, "PURCHASE" => 3000, _ => 0 };
        var prefix = type switch { "SALE" => _defaultInvoicePrefix, "PURCHASE" => "PUR-", "PROFORMA" => "PRO-", _ => "" };
        var number = _invoices.Where(i => i.Type == type).Select(i => i.Number).DefaultIfEmpty(floor).Max() + 1;
        return $"شماره پیشنهادی: {prefix}{number:D4}  •  طرف حساب: {(type == "PURCHASE" ? "تأمین‌کننده" : "مشتری")}";
    }

    private InvoiceDraft BuildDraft()
    {
        if (_person.SelectedItem is not CustomerRecord person)
            throw new InvalidOperationException(CurrentType == "PURCHASE"
                ? "ابتدا یک تأمین‌کننده ثبت یا انتخاب کنید."
                : "ابتدا یک مشتری ثبت یا انتخاب کنید.");
        if (_lines.Count == 0)
            throw new InvalidOperationException("حداقل یک قلم به سند اضافه کنید.");

        var discount = AccountingRules.Money(PersianNumberParser.ParseDecimal(_discount.Text, "تخفیف"));
        var taxInput = AccountingRules.Money(PersianNumberParser.ParseDecimal(_tax.Text, "مالیات"));
        var taxIsAmount = _taxIsAmount.IsChecked == true;
        var taxRatePercent = taxIsAmount ? 0m : taxInput;
        var tax = taxIsAmount ? taxInput : AccountingRules.CalculateTax(_lines.Sum(l => l.LineTotal), taxInput);
        var cash = AccountingRules.Money(PersianNumberParser.ParseDecimal(_cashAmount.Text, "مبلغ نقدی"));
        var subtotal = AccountingRules.Money(_lines.Sum(l => l.LineTotal));
        if (discount < 0m || discount > subtotal)
            throw new InvalidOperationException("تخفیف باید بین صفر و جمع کالاها باشد.");
        if (taxInput < 0m || (!taxIsAmount && taxInput > 100m) || tax < 0m || cash < 0m || cash > subtotal - discount + tax)
            throw new InvalidOperationException("نرخ/مبلغ مالیات یا مبلغ نقدی معتبر نیست.");
        if (CurrentType == "PROFORMA" && cash > 0m)
            throw new InvalidOperationException("برای پیش‌فاکتور دریافت نقدی ثبت نکنید؛ ابتدا آن را به فروش تبدیل کنید.");
        var taxId = _taxId.Text.Trim();
        if (taxId.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(taxId, "^[A-Za-z0-9]{22}$"))
            throw new InvalidOperationException("شناسه مالیاتی، در صورت ورود، باید دقیقاً ۲۲ حرف یا رقم انگلیسی باشد.");

        var date = ParsePersianDate(_date.Text, "تاریخ صدور");
        DateTimeOffset? due = string.IsNullOrWhiteSpace(_dueDate.Text) ? null : ParsePersianDate(_dueDate.Text, "تاریخ سررسید");
        return new InvoiceDraft
        {
            CustomerId = person.Id,
            Type = CurrentType,
            Prefix = CurrentType switch { "SALE" => _defaultInvoicePrefix, "PURCHASE" => "PUR-", "PROFORMA" => "PRO-", _ => "INV-" },
            Date = date,
            DueDate = due,
            TaxRatePercent = taxRatePercent,
            TaxAmount = taxIsAmount ? taxInput : 0m,
            TaxIsAmount = taxIsAmount,
            Discount = discount,
            CashAmount = cash,
            Description = _description.Text.Trim(),
            Notes = _notes.Text.Trim(),
            InvoiceFooter = _invoiceFooterText.Text.Trim(),
            DriverName = _driverName.Text.Trim(),
            DriverPhone = _driverPhone.Text.Trim(),
            VehiclePlate = _vehiclePlate.Text.Trim(),
            TaxId = taxId,
            ShowPreviousBalance = _showPreviousBalance.IsChecked == true,
            Lines = _lines.Select(line => new InvoiceLine
            {
                ProductId = line.ProductId, ProductName = line.ProductName,
                Unit = string.IsNullOrWhiteSpace(line.Unit) ? _products.FirstOrDefault(product => product.Id == line.ProductId)?.Unit ?? "عدد" : line.Unit,
                SerialNumber = line.SerialNumber, Quantity = line.Quantity, BuyPrice = line.BuyPrice, UnitPrice = line.UnitPrice, Profit = line.Profit,
                LineTotal = line.LineTotal, Description = line.Description, EntryOrder = line.EntryOrder
            }).ToList()
        };
    }

    private void SaveResult()
    {
        try
        {
            Result = BuildDraft();
            SaveFooterAsTemplate = _saveFooterAsTemplate.IsChecked == true &&
                !string.IsNullOrWhiteSpace(_invoiceFooterText.Text);
            FooterTemplateToSave = SaveFooterAsTemplate ? _invoiceFooterText.Text.Trim() : "";
            DialogResult = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی سند", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void PreviewDraft()
    {
        try
        {
            var draft = BuildDraft();
            new InvoicePreviewWindow(this, draft, _people, _invoices, _defaultInvoiceTheme, _showInvoiceQr, _companyProfile, _currencyLabel, draft.InvoiceFooter).ShowDialog();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی پیش‌نمایش", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static bool TryParseAmount(string text, out decimal value)
    {
        try
        {
            value = PersianNumberParser.ParseDecimal(text, "مبلغ");
            return true;
        }
        catch (Exception)
        {
            value = 0m;
            return false;
        }
    }

    private static DateTimeOffset ParsePersianDate(string text, string fieldName) =>
        PersianDateInputService.Parse(text, fieldName);

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private static string ToText(InvoiceLine line) =>
        $"{line.EntryOrder:N0}. {line.ProductName} | {line.Quantity:#,##0.##} × {line.UnitPrice:#,##0.##} = {line.LineTotal:#,##0.##}" +
        (string.IsNullOrWhiteSpace(line.Description) ? "" : $" | {line.Description}");

    private static Border CreateInvoiceHero()
    {
        var content = new StackPanel();
        content.Children.Add(new TextBlock
        {
            Text = "صدور فاکتور | اشک قلم",
            FontSize = 22, FontWeight = FontWeights.Bold,
            Foreground = Brushes.White, Margin = new Thickness(0, 0, 0, 4)
        });
        content.Children.Add(new TextBlock
        {
            Text = "ثبت هوشمند طرف حساب، تاریخ شمسی، کالا و مبالغ در یک فرم یکپارچه",
            FontSize = 12, Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            TextWrapping = TextWrapping.Wrap
        });
        return new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(15),
            Padding = new Thickness(20), Margin = new Thickness(0, 0, 0, 14),
            Child = content
        };
    }

    private static Border CreateSectionCard(string title, string subtitle, UIElement content)
    {
        var panel = new StackPanel();
        panel.Children.Add(new TextBlock
        {
            Text = title, FontSize = 16, FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 3)
        });
        panel.Children.Add(new TextBlock
        {
            Text = subtitle, FontSize = 11,
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 12)
        });
        panel.Children.Add(new Border
        {
            Height = 1, Background = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
            Margin = new Thickness(0, 0, 0, 12)
        });
        panel.Children.Add(content);
        return new Border
        {
            Background = Brushes.White,
            BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Padding = new Thickness(18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = panel
        };
    }

    private static DataTemplate CreatePartyTemplate()
    {
        var panel = new FrameworkElementFactory(typeof(StackPanel));
        panel.SetValue(StackPanel.MarginProperty, new Thickness(2, 4, 2, 4));
        var name = new FrameworkElementFactory(typeof(TextBlock));
        name.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Name)));
        name.SetValue(TextBlock.FontWeightProperty, FontWeights.SemiBold);
        var details = new FrameworkElementFactory(typeof(TextBlock));
        details.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Code))
        {
            StringFormat = "کد: {0}"
        });
        details.SetValue(TextBlock.FontSizeProperty, 11d);
        details.SetValue(TextBlock.FontWeightProperty, FontWeights.Medium);

        var phone = new FrameworkElementFactory(typeof(TextBlock));
        phone.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Phone))
        {
            StringFormat = "تلفن: {0}"
        });
        phone.SetValue(TextBlock.FontSizeProperty, 10d);
        phone.SetValue(TextBlock.OpacityProperty, 0.88d);
        phone.SetValue(TextBlock.TextTrimmingProperty, TextTrimming.CharacterEllipsis);

        // Inherit the theme-aware ComboBoxItem foreground so party details remain readable
        // in both themes. The selected party's live ledger balance is shown below the field.
        panel.AppendChild(name);
        panel.AppendChild(details);
        panel.AppendChild(phone);
        return new DataTemplate(typeof(CustomerRecord)) { VisualTree = panel };
    }

    private static void AddDateField(Panel root, string label, TextBox field, bool optional)
    {
        root.Children.Add(new TextBlock
        {
            Text = label, FontSize = 12, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 7, 0, 4)
        });
        field.Margin = new Thickness(0, 0, 0, 4);
        root.Children.Add(PersianDateInputService.CreateDateField(field, optional));
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 7, 0, 4)
        });
        field.Margin = new Thickness(0, 0, 0, 4);
        root.Children.Add(field);
    }

}
