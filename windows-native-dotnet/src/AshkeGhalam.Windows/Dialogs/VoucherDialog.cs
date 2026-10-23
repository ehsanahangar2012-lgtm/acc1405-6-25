using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class VoucherDialog : Window
{
    private sealed record Choice(string Value, string Label);
    private sealed record InvoiceChoice(InvoiceRecord? Invoice, string Label);
    private sealed class VoucherLineDraft
    {
        public ProductRecord Product { get; init; } = new();
        public decimal Quantity { get; set; }
        public decimal? Weight { get; init; }
        public string Unit { get; init; } = "";
        public string ShelfLocation { get; init; } = "";
        public string Description { get; init; } = "";
        public string ImageUrl { get; init; } = "";
        public string Label => $"{Product.Name} — {Quantity:#,##0.##} {Product.Unit} — موجودی فعلی: {Product.StockQuantity:#,##0.##}";
    }

    private static readonly Choice[] Types =
    [
        new("IN", "ورود کالا"),
        new("OUT", "خروج کالا"),
        new("RETURN", "برگشت کالا")
    ];

    private static readonly Choice[] MovementTypes =
    [
        new("GOODS_RECEIPT", "رسید ورود کالا (خرید)"),
        new("GOODS_ISSUE", "حواله خروج کالا (فروش)"),
        new("INVENTORY_ADJUSTMENT", "تعدیل موجودی"),
        new("PRODUCTION_CONSUMPTION", "مصرف در تولید"),
        new("PRODUCTION_OUTPUT", "ورودی محصول تولیدشده"),
        new("RETURN_RECEIPT", "رسید برگشت از فروش"),
        new("RETURN_ISSUE", "حواله برگشت از خرید")
    ];

    private readonly IReadOnlyList<CustomerRecord> _people;
    private readonly IReadOnlyList<ProductRecord> _products;
    private readonly IReadOnlyList<InvoiceRecord> _invoices;
    private readonly VoucherRecord? _existing;
    private readonly CompanyProfileRecord? _companyProfile;
    private readonly ComboBox _type = new() { Height = 34, ItemsSource = Types, DisplayMemberPath = nameof(Choice.Label), SelectedIndex = 1 };
    private readonly ComboBox _movementType = new() { Height = 34, ItemsSource = MovementTypes, DisplayMemberPath = nameof(Choice.Label) };
    private readonly ComboBox _person = new() { Height = 34, DisplayMemberPath = nameof(CustomerRecord.Name), MinWidth = 260 };
    private readonly ComboBox _invoice = new() { Height = 34, DisplayMemberPath = nameof(InvoiceChoice.Label), MinWidth = 260 };
    private readonly ComboBox _product = new() { Height = 34, DisplayMemberPath = nameof(ProductRecord.Name), MinWidth = 240 };
    private readonly TextBox _quantity = new() { Height = 32, Width = 110, Text = "1", Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _barcodeScan = new() { Height = 34, MinWidth = 230, Padding = new Thickness(8, 4, 8, 4), FlowDirection = FlowDirection.LeftToRight };
    private readonly TextBox _date = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _returnReason = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _supervisor = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _vehicle = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _receiverPhone = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _notes = new() { Height = 65, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, Padding = new Thickness(8) };
    private readonly ObservableCollection<VoucherLineDraft> _lines = [];
    private readonly ListBox _lineList = new() { Height = 145 };
    private readonly TextBlock _totals = new() { FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 8, 0, 8) };

    public VoucherRecord? Result { get; private set; }

    public VoucherDialog(Window owner, IReadOnlyList<CustomerRecord> people, IReadOnlyList<ProductRecord> products, IReadOnlyList<InvoiceRecord> invoices, VoucherRecord? existing = null, CompanyProfileRecord? companyProfile = null)
    {
        _existing = existing;
        _companyProfile = companyProfile;
        Owner = owner;
        _people = people;
        _products = products;
        _invoices = invoices;
        Title = "ثبت حواله / رسید انبار";
        Width = 720;
        Height = 860;
        MinHeight = 670;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _person.ItemsSource = people;
        _person.SelectedIndex = -1;
        _product.ItemsSource = products;
        _movementType.SelectedItem = MovementTypes[1];
        _date.Text = FormatPersianDate(existing?.Date ?? DateTimeOffset.Now);
        if (existing is not null)
        {
            _type.SelectedItem = Types.FirstOrDefault(type => type.Value == existing.Type);
            _movementType.SelectedItem = MovementTypes.FirstOrDefault(type => type.Value == existing.MovementType);
            _person.SelectedItem = people.FirstOrDefault(person => person.Id == existing.PersonId);
            _returnReason.Text = existing.ReturnReason;
            _supervisor.Text = existing.Supervisor;
            _vehicle.Text = existing.VehicleNumber;
            _receiverPhone.Text = existing.ReceiverPhone;
            _notes.Text = existing.Notes;
            foreach (var line in existing.Items)
            {
                var product = products.FirstOrDefault(item => item.Id == line.ProductId);
                if (product is not null)
                    _lines.Add(new VoucherLineDraft
                    {
                        Product = product, Quantity = line.Quantity, Weight = line.Weight, Unit = line.Unit,
                        ShelfLocation = line.ShelfLocation, Description = line.Description, ImageUrl = line.ImageUrl
                    });
            }
        }
        _lineList.ItemsSource = _lines;
        _lineList.DisplayMemberPath = nameof(VoucherLineDraft.Label);
        _invoice.ItemsSource = new[] { new InvoiceChoice(null, "بدون فاکتور مرتبط") };
        _invoice.SelectedIndex = 0;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = "سند گردش موجودی",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "ثبت حواله، موجودی تجمیعی کالا را در همین نسخهٔ محلی تغییر می‌دهد. انبارهای مجزا و انتقال بین انبارها هنوز فعال نشده‌اند.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });

        AddField(root, "نوع سند", _type);
        AddField(root, "نوع گردش موجودی", _movementType);
        AddField(root, "تاریخ شمسی", _date);
        AddField(root, "شخص مرتبط (اختیاری)", _person);
        AddField(root, "فاکتور مرتبط (اختیاری)", _invoice);

        var lineHeading = new TextBlock { Text = "اقلام سند", FontWeight = FontWeights.Bold, FontSize = 16, Margin = new Thickness(0, 14, 0, 6) };
        root.Children.Add(lineHeading);
        AddField(root, "اسکن بارکد (اسکنر دستی با ارسال Enter)", _barcodeScan);
        var pickRow = new WrapPanel { Margin = new Thickness(0, 4, 0, 6), VerticalAlignment = VerticalAlignment.Center };
        pickRow.Children.Add(_product);
        pickRow.Children.Add(_quantity);
        var addLine = new Button { Content = "افزودن قلم", Height = 34, Padding = new Thickness(12, 4, 12, 4), Margin = new Thickness(8, 0, 0, 0) };
        pickRow.Children.Add(addLine);
        root.Children.Add(pickRow);
        root.Children.Add(_lineList);
        var removeLine = new Button { Content = "حذف قلم انتخاب‌شده", Height = 32, Width = 150, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 6, 0, 0) };
        root.Children.Add(removeLine);
        root.Children.Add(_totals);

        AddField(root, "علت برگشت (در صورت استفاده)", _returnReason);
        AddField(root, "مسئول / سرپرست", _supervisor);
        AddField(root, "شماره خودرو / پلاک", _vehicle);
        AddField(root, "تلفن تحویل‌گیرنده", _receiverPhone);
        AddField(root, "توضیحات سند", _notes);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 18, 0, 0) };
        var preview = new Button { Content = "پیش‌نمایش قبل از ثبت", Width = 155, Height = 38, Margin = new Thickness(0, 0, 8, 0) };
        preview.Click += (_, _) => PreviewDraft();
        buttons.Children.Add(preview);
        var save = new Button { Content = "ثبت حواله و گردش موجودی", Width = 185, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        root.Children.Add(buttons);
        Content = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };

        _person.SelectionChanged += (_, _) => RefreshInvoiceChoices();
        _type.SelectionChanged += (_, _) => SetDefaultMovement();
        _lines.CollectionChanged += (_, _) => RefreshTotals();
        NumericTextBoxFormatter.Attach(_quantity);
        _barcodeScan.PreviewKeyDown += BarcodeScan_PreviewKeyDown;
        addLine.Click += (_, _) => AddLine();
        removeLine.Click += (_, _) =>
        {
            if (_lineList.SelectedItem is VoucherLineDraft line) _lines.Remove(line);
        };
        save.Click += (_, _) => SaveResult();
        if (_existing is null) SetDefaultMovement();
        else _movementType.SelectedItem = MovementTypes.FirstOrDefault(type => type.Value == _existing.MovementType);
        RefreshInvoiceChoices();
        if (_existing is not null)
            _invoice.SelectedItem = _invoice.Items.Cast<InvoiceChoice>()
                .FirstOrDefault(choice => choice.Invoice?.Id == _existing.RelatedInvoiceId) ?? _invoice.Items[0];
        RefreshTotals();
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
            MessageBox.Show(this, $"برای بارکد «{barcode}» کالا پیدا نشد.", "بارکدخوان",
                MessageBoxButton.OK, MessageBoxImage.Information);
            _barcodeScan.SelectAll(); return;
        }
        _product.SelectedItem = product; _quantity.Text = "1"; AddLine();
        _barcodeScan.Clear(); _barcodeScan.Focus();
    }

    private static void FormatNumericField(TextBox field)
    {
        if (!string.IsNullOrWhiteSpace(field.Text) &&
            PersianNumberParser.TryParseDecimal(field.Text, out var value))
            field.Text = NumericTextBoxFormatter.Format(value);
    }

    private void AddLine()
    {
        try
        {
            if (_product.SelectedItem is not ProductRecord product)
                throw new InvalidOperationException("کالایی را انتخاب کنید.");
            var quantity = PersianNumberParser.ParseDecimal(_quantity.Text, "تعداد");
            if (quantity <= 0m) throw new InvalidOperationException("تعداد باید بیشتر از صفر باشد.");
            _lines.Add(new VoucherLineDraft { Product = product, Quantity = quantity });
            _quantity.Text = "1";
            RefreshTotals();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "افزودن قلم", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void SaveResult()
    {
        try
        {
            Result = BuildVoucher();
            DialogResult = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "ثبت حواله", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void PreviewDraft()
    {
        try
        {
            new VoucherPreviewWindow(this, BuildVoucher(), _companyProfile).ShowDialog();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "پیش‌نمایش حواله", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private VoucherRecord BuildVoucher()
    {
        if (_lines.Count == 0) throw new InvalidOperationException("برای ثبت حواله حداقل یک قلم کالا لازم است.");
        var type = _type.SelectedItem as Choice ?? throw new InvalidOperationException("نوع سند را انتخاب کنید.");
        var movement = _movementType.SelectedItem as Choice ?? throw new InvalidOperationException("نوع گردش را انتخاب کنید.");
        var date = ParsePersianDate(_date.Text);
        var person = _person.SelectedItem as CustomerRecord;
        var invoiceChoice = _invoice.SelectedItem as InvoiceChoice;
        if (invoiceChoice?.Invoice is not null && (person is null || invoiceChoice.Invoice.CustomerId != person.Id))
            throw new InvalidOperationException("شخص سند باید با شخص فاکتور مرتبط یکسان باشد.");

        if (type.Value == "RETURN" && movement.Value is not ("RETURN_RECEIPT" or "RETURN_ISSUE"))
            throw new InvalidOperationException("برای برگشت کالا، نوع گردش «رسید برگشت از فروش» یا «حواله برگشت از خرید» را انتخاب کنید.");

        return new VoucherRecord
        {
            Id = _existing?.Id ?? Guid.NewGuid().ToString("N"),
            Number = _existing?.Number ?? 0,
            TrackingCode = _existing?.TrackingCode ?? "",
            Signature = _existing?.Signature ?? "",
            CompanySignature = _existing?.CompanySignature ?? "",
            SupervisorSignature = _existing?.SupervisorSignature ?? "",
            LoadingPhotos = _existing is null ? [] : [.._existing.LoadingPhotos],
            QrCode = _existing?.QrCode ?? "",
            RelatedVoucherId = _existing?.RelatedVoucherId ?? "",
            SourceWarehouseId = _existing?.SourceWarehouseId ?? "",
            DestinationWarehouseId = _existing?.DestinationWarehouseId ?? "",
            WarehouseId = _existing?.WarehouseId ?? "",
            Type = type.Value,
            MovementType = movement.Value,
            Date = date,
            PersonId = person?.Id ?? "",
            PersonName = person?.Name ?? "",
            RelatedInvoiceId = invoiceChoice?.Invoice?.Id ?? "",
            ReturnReason = _returnReason.Text.Trim(),
            Supervisor = _supervisor.Text.Trim(),
            VehicleNumber = _vehicle.Text.Trim(),
            ReceiverPhone = _receiverPhone.Text.Trim(),
            Items = _lines.Select(x => new VoucherItemRecord
            {
                ProductId = x.Product.Id,
                ProductName = x.Product.Name,
                Quantity = x.Quantity,
                Unit = string.IsNullOrWhiteSpace(x.Unit) ? x.Product.Unit : x.Unit,
                Weight = x.Weight ?? x.Product.Weight,
                ShelfLocation = string.IsNullOrWhiteSpace(x.ShelfLocation) ? x.Product.ShelfLocation : x.ShelfLocation,
                Description = string.IsNullOrWhiteSpace(x.Description) ? x.Product.Description : x.Description,
                ImageUrl = string.IsNullOrWhiteSpace(x.ImageUrl) ? x.Product.ImageUrl : x.ImageUrl
            }).ToList(),
            Notes = _notes.Text.Trim(),
            Status = "PENDING"
        };
    }

    private void RefreshInvoiceChoices()
    {
        var person = _person.SelectedItem as CustomerRecord;
        var choices = new List<InvoiceChoice> { new(null, "بدون فاکتور مرتبط") };
        if (person is not null)
            choices.AddRange(_invoices.Where(i => i.CustomerId == person.Id && i.Status != "لغو شده")
                .OrderByDescending(i => i.Number).Select(i => new InvoiceChoice(i, $"فاکتور {i.Number} — {i.CustomerName}")));
        _invoice.ItemsSource = choices;
        _invoice.SelectedIndex = 0;
    }

    private void SetDefaultMovement()
    {
        var type = (_type.SelectedItem as Choice)?.Value;
        var desired = type switch
        {
            "IN" => "GOODS_RECEIPT",
            "OUT" => "GOODS_ISSUE",
            "RETURN" => "RETURN_RECEIPT",
            _ => "GOODS_ISSUE"
        };
        _movementType.SelectedItem = MovementTypes.First(x => x.Value == desired);
    }

    private void RefreshTotals()
    {
        var weight = _lines.Sum(x => x.Quantity * x.Product.Weight.GetValueOrDefault());
        var value = _lines.Sum(x => x.Quantity * (x.Product.BuyPrice ?? x.Product.SellPrice));
        _totals.Text = $"اقلام: {_lines.Count:N0}   •   وزن تخمینی: {weight:#,##0.##}   •   ارزش تخمینی: {value:#,##0.##}";
    }

    private static DateTimeOffset ParsePersianDate(string text)
    {
        var normalized = text.Trim().Replace('-', '/').Replace('.', '/');
        var parts = normalized.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3) throw new InvalidOperationException("تاریخ را به صورت سال/ماه/روز شمسی وارد کنید.");
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
            throw new InvalidOperationException("تاریخ شمسی معتبر نیست.");
        }
    }

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
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
