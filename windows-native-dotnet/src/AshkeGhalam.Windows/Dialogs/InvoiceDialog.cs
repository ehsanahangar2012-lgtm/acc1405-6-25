using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoiceDialog : Window
{
    private sealed record Choice(string Value, string Label);
    private readonly IReadOnlyList<CustomerRecord> _people;
    private readonly IReadOnlyList<ProductRecord> _products;
    private readonly IReadOnlyList<InvoiceRecord> _invoices;

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
        IReadOnlyList<InvoiceRecord> invoices)
    {
        Owner = owner;
        _people = people;
        _products = products;
        _invoices = invoices;
        Title = "ثبت فاکتور / پیش‌فاکتور";
        Width = 760;
        Height = 900;
        MinHeight = 680;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
        ResizeMode = ResizeMode.CanResize;

        _date.Text = FormatPersianDate(DateTimeOffset.Now);
        _lineList.ItemsSource = _lines;
        // A ListBox can show a readable projection while keeping actual InvoiceLine values in the collection.
        _lineList.ItemsSource = _lines.Select(ToText).ToList();
        _product.ItemsSource = products;

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
        dates.Children.Add(new Border());
        dates.Children.Add(duePanel);
        root.Children.Add(dates);

        root.Children.Add(new TextBlock { Text = "اقلام سند", FontSize = 16, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 12, 0, 4) });
        AddField(root, "کالا", _product);
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
        AddField(taxPanel, "مالیات (مبلغ)", _tax);
        Grid.SetColumn(taxPanel, 2);
        pricing.Children.Add(discountPanel);
        pricing.Children.Add(new Border());
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
        logistics.Children.Add(new Border());
        logistics.Children.Add(phonePanel);
        root.Children.Add(logistics);
        AddField(root, "شماره پلاک / خودرو", _vehiclePlate);
        AddField(root, "شناسه مالیاتی ۲۲ نویسه (اختیاری)", _taxId);
        root.Children.Add(_showPreviousBalance);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 14, 0, 0) };
        var save = new Button { Content = "ذخیره سند", Width = 125, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        root.Children.Add(buttons);
        Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };

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

        _type.SelectedIndex = 0;
        RefreshPeople();
        if (_product.Items.Count > 0) _product.SelectedIndex = 0;
        RefreshNumberPreview();
        RefreshLines();
        RefreshTotals();
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
        var discount = PersianNumberParser.TryParseDecimal(_discount.Text, out var d) && d >= 0m ? d : 0m;
        var tax = PersianNumberParser.TryParseDecimal(_tax.Text, out var t) && t >= 0m ? t : 0m;
        var cash = PersianNumberParser.TryParseDecimal(_cashAmount.Text, out var c) && c >= 0m ? c : 0m;
        var total = AccountingRules.Money(subtotal - discount + tax);
        var remaining = total - cash;
        _totals.Text = $"جمع کالاها: {subtotal:N2}   |   تخفیف: {discount:N2}   |   مالیات: {tax:N2}\nمبلغ نهایی: {total:N2}   |   نقدی: {cash:N2}   |   مانده پس از نقدی: {remaining:N2}";
    }

    private void RefreshNumberPreview() => _numberPreview.Text = BuildNumberPreview(CurrentType);

    private string BuildNumberPreview(string type)
    {
        var floor = type switch { "SALE" => 1000, "PROFORMA" => 2000, "PURCHASE" => 3000, _ => 0 };
        var prefix = type switch { "SALE" => "INV-", "PURCHASE" => "PUR-", "PROFORMA" => "PRO-", _ => "" };
        var number = _invoices.Where(i => i.Type == type).Select(i => i.Number).DefaultIfEmpty(floor).Max() + 1;
        return $"شماره پیشنهادی: {prefix}{number:D4}  •  طرف حساب: {(type == "PURCHASE" ? "تأمین‌کننده" : "مشتری")}";
    }

    private void SaveResult()
    {
        try
        {
            if (_person.SelectedItem is not CustomerRecord person)
                throw new InvalidOperationException(CurrentType == "PURCHASE"
                    ? "ابتدا یک تأمین‌کننده ثبت یا انتخاب کنید."
                    : "ابتدا یک مشتری ثبت یا انتخاب کنید.");
            if (_lines.Count == 0)
                throw new InvalidOperationException("حداقل یک قلم به سند اضافه کنید.");

            var discount = AccountingRules.Money(PersianNumberParser.ParseDecimal(_discount.Text, "تخفیف"));
            var tax = AccountingRules.Money(PersianNumberParser.ParseDecimal(_tax.Text, "مالیات"));
            var cash = AccountingRules.Money(PersianNumberParser.ParseDecimal(_cashAmount.Text, "مبلغ نقدی"));
            var subtotal = AccountingRules.Money(_lines.Sum(l => l.LineTotal));
            if (discount < 0m || discount > subtotal)
                throw new InvalidOperationException("تخفیف باید بین صفر و جمع کالاها باشد.");
            if (tax < 0m || cash < 0m || cash > subtotal - discount + tax)
                throw new InvalidOperationException("مالیات یا مبلغ نقدی معتبر نیست.");
            if (CurrentType == "PROFORMA" && cash > 0m)
                throw new InvalidOperationException("برای پیش‌فاکتور دریافت نقدی ثبت نکنید؛ ابتدا آن را به فروش تبدیل کنید.");
            var taxId = _taxId.Text.Trim();
            if (taxId.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(taxId, "^[A-Za-z0-9]{22}$"))
                throw new InvalidOperationException("شناسه مالیاتی، در صورت ورود، باید دقیقاً ۲۲ حرف یا رقم انگلیسی باشد.");

            var date = ParsePersianDate(_date.Text, "تاریخ صدور");
            DateTimeOffset? due = string.IsNullOrWhiteSpace(_dueDate.Text) ? null : ParsePersianDate(_dueDate.Text, "تاریخ سررسید");
            Result = new InvoiceDraft
            {
                CustomerId = person.Id,
                Type = CurrentType,
                Prefix = CurrentType switch { "SALE" => "INV-", "PURCHASE" => "PUR-", "PROFORMA" => "PRO-", _ => "INV-" },
                Date = date,
                DueDate = due,
                TaxRatePercent = 0m,
                TaxAmount = tax,
                TaxIsAmount = true,
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
                    ProductId = line.ProductId, ProductName = line.ProductName, SerialNumber = line.SerialNumber,
                    Quantity = line.Quantity, BuyPrice = line.BuyPrice, UnitPrice = line.UnitPrice, Profit = line.Profit,
                    LineTotal = line.LineTotal, Description = line.Description, EntryOrder = line.EntryOrder
                }).ToList()
            };
            DialogResult = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی سند", MessageBoxButton.OK, MessageBoxImage.Warning);
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
