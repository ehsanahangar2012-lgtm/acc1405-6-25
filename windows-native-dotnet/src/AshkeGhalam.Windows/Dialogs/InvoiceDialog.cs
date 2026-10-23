using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoiceDialog : Window
{
    private sealed record Choice(string Value, string Label);
    private readonly List<CustomerRecord> _people;
    private readonly List<ProductRecord> _products;
    private readonly IReadOnlyList<InvoiceRecord> _invoices;
    private readonly Func<Window, CustomerRecord?>? _quickAddCustomer;
    private readonly Func<Window, ProductRecord?>? _quickAddProduct;
    private readonly string _defaultInvoiceTheme;
    private readonly bool _showInvoiceQr;
    private readonly CompanyProfileRecord? _companyProfile;
    private readonly string _defaultInvoicePrefix;
    private readonly decimal _defaultTaxRatePercent;
    private readonly string _currencyLabel;
    private readonly string _invoiceFooter;
    private readonly InvoiceRecord? _existingInvoice;
    private readonly TextBox _barcodeScan = new() { Height = 34, MinWidth = 240, Padding = new Thickness(8, 4, 8, 4), FlowDirection = FlowDirection.LeftToRight };
    private readonly CheckBox _taxIsAmount = new() { Content = "مالیات مبلغی است (خاموش: درصد از جمع کالاها)", IsChecked = true, Margin = new Thickness(0, 6, 0, 0) };

    private readonly ComboBox _type = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), ItemsSource = new[]
    {
        new Choice("SALE", "فاکتور فروش"),
        new Choice("PURCHASE", "فاکتور خرید"),
        new Choice("PROFORMA", "پیش‌فاکتور")
    }, SelectedIndex = 0 };
    private readonly ComboBox _person = new() { Height = 34, DisplayMemberPath = nameof(CustomerRecord.Name), MinWidth = 250 };
    private readonly ComboBox _product = new() { Height = 34, DisplayMemberPath = nameof(ProductRecord.Name), MinWidth = 240 };
    private readonly TextBox _quantity = new() { Height = 32, Width = 90, Text = "1", Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _price = new() { Height = 32, Width = 130, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _lineDescription = new() { Height = 32, Width = 180, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _date = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _dueDate = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
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
    private readonly ListBox _lineList = new() { Height = 155 };
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
        InvoiceRecord? existingInvoice = null)
    {
        Owner = owner;
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
        _existingInvoice = existingInvoice;
        _taxIsAmount.IsChecked = _defaultTaxRatePercent == 0m;
        _tax.Text = _taxIsAmount.IsChecked == true
            ? "0"
            : _defaultTaxRatePercent.ToString("0.##", CultureInfo.InvariantCulture);
        Title = existingInvoice is null ? "ثبت فاکتور / پیش‌فاکتور" : "ویرایش پیش‌فاکتور";
        Width = 760;
        Height = 900;
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
        _lineList.ItemsSource = _lines;
        // A ListBox can show a readable projection while keeping actual InvoiceLine values in the collection.
        _lineList.ItemsSource = _lines.Select(ToText).ToList();
        _product.ItemsSource = _products;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = "صدور سند مالی",
            FontSize = 24,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 4)
        });
        root.Children.Add(new TextBlock
        {
            Text = "سه نوع سند نسخهٔ اصلی پشتیبانی می‌شود: فروش موجودی را کم می‌کند، خرید موجودی را زیاد می‌کند و پیش‌فاکتور تا زمان تبدیل به فروش اثری بر موجودی ندارد.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });
        AddField(root, "نوع سند", _type);
        root.Children.Add(_numberPreview);
        AddField(root, "طرف حساب (مشتری یا تأمین‌کننده بر اساس نوع سند)", _person);
        var addPersonInline = new Button
        {
            Content = "＋ ثبت شخص جدید بدون بستن فاکتور",
            Height = 32,
            HorizontalAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(12, 4, 12, 4),
            Margin = new Thickness(0, 3, 0, 8)
        };
        addPersonInline.Click += (_, _) => AddPersonInline();
        root.Children.Add(addPersonInline);

        var dates = new Grid { Margin = new Thickness(0, 2, 0, 0) };
        dates.ColumnDefinitions.Add(new ColumnDefinition());
        dates.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
        dates.ColumnDefinitions.Add(new ColumnDefinition());
        var datePanel = new StackPanel();
        AddField(datePanel, "تاریخ صدور شمسی", _date);
        Grid.SetColumn(datePanel, 0);
        var duePanel = new StackPanel();
        AddField(duePanel, "تاریخ سررسید شمسی (اختیاری)", _dueDate);
        Grid.SetColumn(duePanel, 2);
        dates.Children.Add(datePanel);
        var dateSpacer = new Border();
        Grid.SetColumn(dateSpacer, 1);
        dates.Children.Add(dateSpacer);
        dates.Children.Add(duePanel);
        root.Children.Add(dates);

        root.Children.Add(new TextBlock { Text = "اقلام سند", FontSize = 16, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 12, 0, 4) });
        AddField(root, "اسکن بارکد (اسکنر دستی با ارسال Enter)", _barcodeScan);
        AddField(root, "کالا", _product);
        var addProductInline = new Button
        {
            Content = "＋ ثبت کالای جدید بدون بستن فاکتور",
            Height = 32,
            HorizontalAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(12, 4, 12, 4),
            Margin = new Thickness(0, 3, 0, 8)
        };
        addProductInline.Click += (_, _) => AddProductInline();
        root.Children.Add(addProductInline);

        var lineRow = new WrapPanel { Margin = new Thickness(0, 2, 0, 4), VerticalAlignment = VerticalAlignment.Center };
        lineRow.Children.Add(_quantity);
        lineRow.Children.Add(_price);
        lineRow.Children.Add(_lineDescription);
        var addLine = new Button { Content = "افزودن قلم", Height = 32, Padding = new Thickness(12, 4, 12, 4), Margin = new Thickness(8, 0, 0, 0) };
        lineRow.Children.Add(addLine);
        root.Children.Add(lineRow);
        root.Children.Add(new TextBlock
        {
            Text = "ترتیب ستون‌ها: تعداد، قیمت واحد، شرح قلم (اختیاری)",
            FontSize = 11,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            Margin = new Thickness(0, 0, 0, 4)
        });
        root.Children.Add(_lineList);
        var remove = new Button { Content = "حذف قلم انتخاب‌شده", Width = 150, Height = 30, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 6, 0, 5) };
        root.Children.Add(remove);

        var pricing = new Grid { Margin = new Thickness(0, 4, 0, 0) };
        pricing.ColumnDefinitions.Add(new ColumnDefinition());
        pricing.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
        pricing.ColumnDefinitions.Add(new ColumnDefinition());
        var discountPanel = new StackPanel();
        AddField(discountPanel, "تخفیف (مبلغ)", _discount);
        Grid.SetColumn(discountPanel, 0);
        var taxPanel = new StackPanel();
        AddField(taxPanel, "مالیات (مبلغ یا درصد بر اساس گزینهٔ زیر)", _tax);
        taxPanel.Children.Add(_taxIsAmount);
        Grid.SetColumn(taxPanel, 2);
        pricing.Children.Add(discountPanel);
        var pricingSpacer = new Border();
        Grid.SetColumn(pricingSpacer, 1);
        pricing.Children.Add(pricingSpacer);
        pricing.Children.Add(taxPanel);
        root.Children.Add(pricing);
        root.Children.Add(_totals);
        AddField(root, "دریافت/پرداخت نقدی هنگام صدور", _cashAmount);
        AddField(root, "شرح فاکتور / متن چاپ", _description);
        AddField(root, "یادداشت داخلی", _notes);

        var logistics = new Grid { Margin = new Thickness(0, 2, 0, 0) };
        logistics.ColumnDefinitions.Add(new ColumnDefinition());
        logistics.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
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
        root.Children.Add(logistics);
        AddField(root, "شماره پلاک / خودرو", _vehiclePlate);
        AddField(root, "شناسه مالیاتی ۲۲ نویسه (اختیاری)", _taxId);
        root.Children.Add(_showPreviousBalance);

        var buttons = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 14, 0, 0) };
        var preview = new Button { Content = "پیش‌نمایش قبل از ذخیره", MinWidth = 175, Height = 38, Margin = new Thickness(0, 0, 8, 8) };
        preview.Click += (_, _) => PreviewDraft();
        buttons.Children.Add(preview);
        var save = new Button { Content = "ذخیره سند", Width = 125, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 8) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true, Margin = new Thickness(0, 0, 0, 8) });
        root.Children.Add(buttons);
        Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };

        foreach (var field in new[] { _quantity, _price, _discount, _tax, _cashAmount })
            field.LostFocus += (_, _) => FormatNumericField(field);
        _barcodeScan.PreviewKeyDown += BarcodeScan_PreviewKeyDown;

        _type.SelectionChanged += (_, _) =>
        {
            RefreshPeople();
            ApplyDefaultPrice();
            RepriceLines();
            RefreshNumberPreview();
            RefreshTotals();
        };
        _person.SelectionChanged += (_, _) => RefreshTotals();
        _product.SelectionChanged += (_, _) => ApplyDefaultPrice();
        _discount.TextChanged += (_, _) => RefreshTotals();
        _tax.TextChanged += (_, _) => RefreshTotals();
        _taxIsAmount.Checked += (_, _) => RefreshTotals();
        _taxIsAmount.Unchecked += (_, _) => RefreshTotals();
        _cashAmount.TextChanged += (_, _) => RefreshTotals();
        addLine.Click += (_, _) => AddLine();
        remove.Click += (_, _) =>
        {
            if (_lineList.SelectedIndex >= 0)
            {
                _lines.RemoveAt(_lineList.SelectedIndex);
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

        _product.ItemsSource = null;
        _product.ItemsSource = _products;
        _product.SelectedItem = _product.Items.Cast<ProductRecord>().FirstOrDefault(product => product.Id == created.Id);
        ApplyDefaultPrice();
    }

    private string CurrentType => (_type.SelectedItem as Choice)?.Value ?? "SALE";

    private void RefreshPeople()
    {
        var previousId = (_person.SelectedItem as CustomerRecord)?.Id;
        var candidates = CurrentType == "PURCHASE"
            ? _people.Where(p => p.IsSupplier).ToList()
            : _people.Where(p => p.IsCustomer).ToList();
        _person.ItemsSource = candidates;
        var previous = candidates.FindIndex(p => p.Id == previousId);
        _person.SelectedIndex = previous >= 0 ? previous : (candidates.Count > 0 ? 0 : -1);
        _numberPreview.Text = BuildNumberPreview(CurrentType);
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
        if (!string.IsNullOrWhiteSpace(field.Text) &&
            PersianNumberParser.TryParseDecimal(field.Text, out var value))
            field.Text = value.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"));
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
                var alreadyInInvoice = _lines.Where(l => l.ProductId == product.Id).Sum(l => l.Quantity);
                var available = product.StockQuantity - product.ReservedStock;
                if (alreadyInInvoice + quantity > available)
                    throw new InvalidOperationException($"موجودی آزاد کافی نیست؛ موجودی آزاد فعلی: {available:N2}");
            }
            var buyPrice = AccountingRules.Money(product.BuyPrice ?? 0m);
            _lines.Add(new InvoiceLine
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
                EntryOrder = _lines.Count + 1
            });
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
        _lineList.ItemsSource = null;
        _lineList.ItemsSource = _lines.Select(ToText).ToList();
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
        var taxLabel = isTaxAmount ? "مالیات مبلغی" : $"مالیات ({taxInput:N2}٪)";
        _totals.Text = $"جمع کالاها: {subtotal:N2} {_currencyLabel}   |   تخفیف: {discount:N2} {_currencyLabel}   |   {taxLabel}: {tax:N2} {_currencyLabel}\nمبلغ نهایی: {total:N2} {_currencyLabel}   |   نقدی: {cash:N2} {_currencyLabel}   |   مانده پس از نقدی: {remaining:N2} {_currencyLabel}";
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
            new InvoicePreviewWindow(this, draft, _people, _invoices, _defaultInvoiceTheme, _showInvoiceQr, _companyProfile, _currencyLabel, _invoiceFooter).ShowDialog();
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

    private static DateTimeOffset ParsePersianDate(string text, string fieldName)
    {
        var normalized = text.Trim().Replace('-', '/').Replace('.', '/');
        var parts = normalized.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3)
            throw new InvalidOperationException(fieldName + " را به صورت سال/ماه/روز شمسی وارد کنید.");
        try
        {
            var year = checked((int)PersianNumberParser.ParseDecimal(parts[0], "سال"));
            var month = checked((int)PersianNumberParser.ParseDecimal(parts[1], "ماه"));
            var day = checked((int)PersianNumberParser.ParseDecimal(parts[2], "روز"));
            var calendar = new PersianCalendar();
            var local = calendar.ToDateTime(year, month, day, 0, 0, 0, 0, PersianCalendar.PersianEra);
            return new DateTimeOffset(local, TimeZoneInfo.Local.GetUtcOffset(local));
        }
        catch (ArgumentOutOfRangeException)
        {
            throw new InvalidOperationException(fieldName + " شمسی معتبر نیست.");
        }
    }

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private static string ToText(InvoiceLine line) =>
        $"{line.EntryOrder:N0}. {line.ProductName} | {line.Quantity:N2} × {line.UnitPrice:N2} = {line.LineTotal:N2}" +
        (string.IsNullOrWhiteSpace(line.Description) ? "" : $" | {line.Description}");

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
