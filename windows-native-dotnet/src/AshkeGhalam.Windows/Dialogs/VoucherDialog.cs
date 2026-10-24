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
    private readonly ComboBox _type = new() { Height = 34, ItemsSource = Types, DisplayMemberPath = nameof(Choice.Label), SelectedIndex = 1, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false };
    private readonly ComboBox _movementType = new() { Height = 34, ItemsSource = MovementTypes, DisplayMemberPath = nameof(Choice.Label), IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
    private readonly ComboBox _person = new() { Height = 34, DisplayMemberPath = nameof(CustomerRecord.Name), MinWidth = 260, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
    private readonly ComboBox _invoice = new() { Height = 34, DisplayMemberPath = nameof(InvoiceChoice.Label), MinWidth = 260, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
    private readonly ComboBox _product = new() { Height = 34, DisplayMemberPath = nameof(ProductRecord.Name), MinWidth = 240, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
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

        var root = new StackPanel { Margin = new Thickness(16) };
        root.Children.Add(new Border
        {
            Background = PaletteBrush("#ECFDF5"),
            BorderBrush = PaletteBrush("#A7F3D0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(12),
            Margin = new Thickness(0, 0, 0, 14),
            Child = new TextBlock
            {
                Text = "ثبت این سند بر موجودی تجمیعی همین نسخهٔ محلی اثر می‌گذارد؛ پیش از ثبت، نوع گردش و اقلام را کنترل کنید.",
                Foreground = PaletteBrush("#065F46"),
                FontSize = 12,
                TextWrapping = TextWrapping.Wrap
            }
        });

        var documentGrid = new Grid { Margin = new Thickness(0, 2, 0, 0) };
        documentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        documentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        documentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var documentPrimary = new StackPanel();
        AddField(documentPrimary, "نوع سند", _type);
        AddField(documentPrimary, "نوع گردش موجودی", _movementType);
        AddDateField(documentPrimary, "تاریخ شمسی", _date, optional: false);
        var documentSecondary = new StackPanel();
        AddField(documentSecondary, "شخص مرتبط (اختیاری)", _person);
        AddField(documentSecondary, "فاکتور مرتبط (اختیاری)", _invoice);
        Grid.SetColumn(documentPrimary, 0);
        Grid.SetColumn(documentSecondary, 2);
        documentGrid.Children.Add(documentPrimary);
        var documentSpacer = new Border { Width = 14 };
        Grid.SetColumn(documentSpacer, 1);
        documentGrid.Children.Add(documentSpacer);
        documentGrid.Children.Add(documentSecondary);
        root.Children.Add(CreateSectionCard(
            "۱. مشخصات سند",
            "نوع برگه، جهت گردش کالا، تاریخ و طرف حساب مرتبط",
            documentGrid));

        var itemsSection = new StackPanel();
        AddField(itemsSection, "بارکدخوان (پس از اسکن، کلید Enter)", _barcodeScan);
        var pickRow = new WrapPanel { Margin = new Thickness(0, 4, 0, 8), VerticalAlignment = VerticalAlignment.Bottom };
        _product.MinWidth = 235;
        _product.Margin = new Thickness(0, 0, 8, 0);
        _quantity.MinWidth = 100;
        _quantity.Margin = new Thickness(0, 0, 8, 0);
        pickRow.Children.Add(_product);
        pickRow.Children.Add(_quantity);
        var addLine = new Button
        {
            Content = "＋ افزودن قلم",
            Height = 38,
            MinWidth = 132,
            Padding = new Thickness(12, 5, 12, 5),
            Margin = new Thickness(0, 0, 0, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
        };
        pickRow.Children.Add(addLine);
        itemsSection.Children.Add(pickRow);
        itemsSection.Children.Add(new TextBlock
        {
            Text = "اقلام افزوده‌شده؛ برای حذف، ابتدا یک ردیف را انتخاب کنید.",
            FontSize = 11,
            Foreground = PaletteBrush("#64748B"),
            Margin = new Thickness(0, 2, 0, 6),
            TextWrapping = TextWrapping.Wrap
        });
        _lineList.MinHeight = 110;
        _lineList.Margin = new Thickness(0, 0, 0, 4);
        itemsSection.Children.Add(_lineList);
        var removeLine = new Button
        {
            Content = "حذف قلم انتخاب‌شده",
            Height = 36,
            MinWidth = 150,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 6, 0, 0)
        };
        itemsSection.Children.Add(removeLine);
        itemsSection.Children.Add(new Border
        {
            Background = PaletteBrush("#F0FDFA"),
            BorderBrush = PaletteBrush("#99F6E4"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10, 8, 10, 8),
            Margin = new Thickness(0, 10, 0, 0),
            Child = _totals
        });
        root.Children.Add(CreateSectionCard(
            "۲. اقلام انبار",
            "بارکد یا کالا را انتخاب کنید؛ تعداد، فهرست اقلام و ارزش تخمینی در همین بخش دیده می‌شود.",
            itemsSection));

        var detailsGrid = new Grid();
        detailsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        detailsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        detailsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var detailsPrimary = new StackPanel();
        AddField(detailsPrimary, "علت برگشت (در صورت استفاده)", _returnReason);
        AddField(detailsPrimary, "مسئول / سرپرست", _supervisor);
        var detailsSecondary = new StackPanel();
        AddField(detailsSecondary, "شماره خودرو / پلاک", _vehicle);
        AddField(detailsSecondary, "تلفن تحویل‌گیرنده", _receiverPhone);
        Grid.SetColumn(detailsPrimary, 0);
        Grid.SetColumn(detailsSecondary, 2);
        detailsGrid.Children.Add(detailsPrimary);
        var detailsSpacer = new Border { Width = 14 };
        Grid.SetColumn(detailsSpacer, 1);
        detailsGrid.Children.Add(detailsSpacer);
        detailsGrid.Children.Add(detailsSecondary);
        var detailsSection = new StackPanel();
        detailsSection.Children.Add(detailsGrid);
        AddField(detailsSection, "توضیحات سند", _notes);
        root.Children.Add(CreateSectionCard(
            "۳. اطلاعات تکمیلی",
            "اطلاعات تحویل و توضیحات اختیاری سند",
            detailsSection));

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(22, 10, 22, 18) };
        var preview = new Button { Content = "پیش‌نمایش قبل از ثبت", Width = 155, Height = 38, Margin = new Thickness(0, 0, 8, 0) };
        preview.Click += (_, _) => PreviewDraft();
        buttons.Children.Add(preview);
        var save = new Button { Content = "ثبت حواله و گردش موجودی", Width = 185, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;

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

    private static DateTimeOffset ParsePersianDate(string text) =>
        PersianDateInputService.Parse(text, "تاریخ حواله");

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private static SolidColorBrush PaletteBrush(string value) =>
        new((Color)ColorConverter.ConvertFromString(value)!);

    private static Border CreateSectionCard(string title, string subtitle, UIElement content)
    {
        var heading = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
        heading.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 16,
            FontWeight = FontWeights.Bold,
            Foreground = PaletteBrush("#0F766E")
        });
        heading.Children.Add(new TextBlock
        {
            Text = subtitle,
            FontSize = 11,
            Foreground = PaletteBrush("#64748B"),
            Margin = new Thickness(0, 3, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        var body = new StackPanel();
        body.Children.Add(heading);
        body.Children.Add(content);
        return new Border
        {
            Background = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#CBD5E1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(15),
            Margin = new Thickness(0, 0, 0, 12),
            Child = body
        };
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
