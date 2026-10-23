using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using QRCoder;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoicePreviewWindow : Window
{
    private readonly InvoiceRecord _invoice;
    private readonly CompanyProfileRecord? _company;
    private readonly bool _showQr;
    private FlowDocument _document;
    private FlowDocumentScrollViewer _viewer = null!;
    private string _theme = "smart";

    private sealed record ThemeOption(string Key, string Label);
    private sealed record InvoicePalette(Color Accent, Color Soft, Color Ink);

    private static readonly ThemeOption[] InvoiceThemes =
    [
        new("modern", "شرکتی مدرن"),
        new("official", "رسمی و اداری"),
        new("premium", "لوکس / مدیریتی"),
        new("thermal", "حرارتی"),
        new("minimal", "مینیمال"),
        new("classic", "کلاسیک"),
        new("smart", "هوشمند"),
        new("colorful", "رنگی"),
        new("industrial", "صنعتی"),
        new("creative", "خلاقانه"),
        new("persian", "ایرانی")
    ];

    public InvoicePreviewWindow(
        Window owner,
        InvoiceDraft draft,
        IReadOnlyList<CustomerRecord> people,
        IReadOnlyList<InvoiceRecord> invoices,
        string? defaultTheme = null,
        bool showQr = true,
        CompanyProfileRecord? company = null)
        : this(owner, BuildDraftPreview(draft, people, invoices), defaultTheme, showQr, company)
    {
    }

    private static InvoiceRecord BuildDraftPreview(
        InvoiceDraft draft,
        IReadOnlyList<CustomerRecord> people,
        IReadOnlyList<InvoiceRecord> invoices)
    {
        ArgumentNullException.ThrowIfNull(draft);
        var person = people.SingleOrDefault(candidate => candidate.Id == draft.CustomerId)
            ?? throw new InvalidOperationException("طرف حساب پیش‌نمایش پیدا نشد.");

        var floor = draft.Type switch { "SALE" => 1000, "PROFORMA" => 2000, "PURCHASE" => 3000, _ => 0 };
        var number = invoices.Where(invoice => invoice.Type == draft.Type)
            .Select(invoice => invoice.Number).DefaultIfEmpty(floor).Max() + 1;
        while (invoices.Any(invoice => invoice.Number == number)) number++;

        var prefix = !string.IsNullOrWhiteSpace(draft.Prefix) ? draft.Prefix.Trim() : draft.Type switch
        {
            "SALE" => "INV-", "PURCHASE" => "PUR-", "PROFORMA" => "PRO-", _ => "INV-"
        };
        var createdAt = draft.Date == default ? DateTimeOffset.Now : draft.Date;
        var lines = draft.Lines.Select(line => new InvoiceLine
        {
            ProductId = line.ProductId,
            ProductName = line.ProductName,
            SerialNumber = line.SerialNumber,
            Quantity = line.Quantity,
            BuyPrice = AccountingRules.Money(line.BuyPrice),
            UnitPrice = AccountingRules.Money(line.UnitPrice),
            Profit = draft.Type == "SALE"
                ? AccountingRules.Money((line.UnitPrice - line.BuyPrice) * line.Quantity)
                : 0m,
            LineTotal = AccountingRules.Money(line.Quantity * line.UnitPrice),
            Description = line.Description,
            EntryOrder = line.EntryOrder
        }).ToList();
        var subtotal = AccountingRules.Money(lines.Sum(line => line.LineTotal));
        var discount = AccountingRules.Money(draft.Discount);
        var taxAmount = draft.TaxIsAmount
            ? AccountingRules.Money(draft.TaxAmount)
            : AccountingRules.CalculateTax(subtotal, draft.TaxRatePercent);
        var total = AccountingRules.Money(subtotal - discount + taxAmount);
        var description = string.IsNullOrWhiteSpace(draft.Description)
            ? string.Join("، ", lines.Select(line => line.ProductName).Distinct())
            : draft.Description.Trim();

        return new InvoiceRecord
        {
            Number = number,
            Type = draft.Type,
            Prefix = prefix,
            TrackingCode = $"{prefix}{number:D4}-{createdAt:yyyyMMdd}",
            CustomerId = person.Id,
            CustomerName = person.Name,
            Description = description,
            Lines = lines,
            Subtotal = subtotal,
            TaxRatePercent = draft.TaxIsAmount ? 0m : draft.TaxRatePercent,
            TaxAmount = taxAmount,
            TaxIsAmount = draft.TaxIsAmount,
            Discount = discount,
            Total = total,
            CashAmount = AccountingRules.Money(draft.CashAmount),
            CheckAmount = 0m,
            CreatedAt = createdAt,
            DueDate = draft.DueDate,
            Notes = draft.Notes,
            DriverName = draft.DriverName,
            DriverPhone = draft.DriverPhone,
            VehiclePlate = draft.VehiclePlate,
            TaxId = draft.TaxId,
            ShowPreviousBalance = draft.ShowPreviousBalance,
            Status = "پیش‌نمایش — ذخیره نشده"
        };
    }

    public InvoicePreviewWindow(
        Window owner,
        InvoiceRecord invoice,
        string? defaultTheme = null,
        bool showQr = true,
        CompanyProfileRecord? company = null)
    {
        _invoice = invoice ?? throw new ArgumentNullException(nameof(invoice));
        _company = company;
        _showQr = showQr;
        _theme = InvoiceThemes.Any(option => string.Equals(option.Key, defaultTheme, StringComparison.Ordinal))
            ? defaultTheme!
            : "smart";
        Owner = owner;
        Title = $"پیش‌نمایش {invoice.TypeLabel} — {invoice.DisplayNumber}";
        Width = 1080;
        Height = 820;
        MinWidth = 760;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        _document = BuildDocument(invoice, _theme, _showQr, _company);
        var root = new Grid { Margin = new Thickness(14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0, 0, 0, 10) };
        var title = new StackPanel { Orientation = Orientation.Vertical };
        title.Children.Add(new TextBlock
        {
            Text = $"پیش‌نمایش فاکتور {invoice.DisplayNumber}",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42))
        });
        title.Children.Add(new TextBlock
        {
            Text = "این صفحه قبل از چاپ، شماره سند، طرف حساب، اقلام، تخفیف، مالیات و جمع نهایی را نشان می‌دهد.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 4, 0, 0)
        });
        toolbar.Children.Add(title);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left
        };
        var themeSelector = new ComboBox
        {
            ItemsSource = InvoiceThemes,
            DisplayMemberPath = nameof(ThemeOption.Label),
            SelectedValuePath = nameof(ThemeOption.Key),
            SelectedValue = _theme,
            Width = 155,
            Height = 38,
            Margin = new Thickness(0, 0, 8, 0),
            VerticalContentAlignment = VerticalAlignment.Center,
            ToolTip = "قالب رنگ و چیدمان پیش‌نمایش"
        };
        themeSelector.SelectionChanged += (_, _) =>
        {
            if (themeSelector.SelectedValue is not string selected || selected == _theme) return;
            _theme = selected;
            _document = BuildDocument(_invoice, _theme, _showQr, _company);
            if (_viewer is not null) _viewer.Document = _document;
        };
        buttons.Children.Add(themeSelector);
        var print = new Button
        {
            Content = "چاپ / انتخاب چاپگر",
            MinWidth = 150,
            Height = 38,
            Background = new SolidColorBrush(Color.FromRgb(15, 118, 110)),
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 8, 0)
        };
        print.Click += Print_Click;
        buttons.Children.Add(print);
        buttons.Children.Add(new Button
        {
            Content = "بستن پیش‌نمایش",
            MinWidth = 120,
            Height = 38,
            IsCancel = true
        });
        DockPanel.SetDock(buttons, Dock.Left);
        toolbar.Children.Add(buttons);

        var paper = new Border
        {
            Background = Brushes.White,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(8)
        };
        var viewer = new FlowDocumentScrollViewer
        {
            Document = _document,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            IsToolBarVisible = true,
            Background = Brushes.White,
            Padding = new Thickness(12)
        };
        _viewer = viewer;
        paper.Child = viewer;
        Grid.SetRow(paper, 1);
        root.Children.Add(toolbar);
        root.Children.Add(paper);
        Content = root;
    }

    private static InvoicePalette GetPalette(string theme) => theme switch
    {
        "official" => new(Color.FromRgb(51, 65, 85), Color.FromRgb(241, 245, 249), Color.FromRgb(15, 23, 42)),
        "premium" => new(Color.FromRgb(139, 106, 37), Color.FromRgb(248, 241, 223), Color.FromRgb(41, 37, 36)),
        "thermal" => new(Color.FromRgb(17, 24, 39), Color.FromRgb(243, 244, 246), Color.FromRgb(17, 24, 39)),
        "minimal" => new(Color.FromRgb(100, 116, 139), Color.FromRgb(248, 250, 252), Color.FromRgb(30, 41, 59)),
        "classic" => new(Color.FromRgb(30, 64, 175), Color.FromRgb(239, 246, 255), Color.FromRgb(30, 41, 59)),
        "colorful" => new(Color.FromRgb(124, 58, 237), Color.FromRgb(245, 243, 255), Color.FromRgb(30, 27, 75)),
        "industrial" => new(Color.FromRgb(55, 65, 81), Color.FromRgb(243, 244, 246), Color.FromRgb(31, 41, 55)),
        "creative" => new(Color.FromRgb(3, 105, 161), Color.FromRgb(224, 242, 254), Color.FromRgb(12, 74, 110)),
        "persian" => new(Color.FromRgb(154, 52, 18), Color.FromRgb(255, 247, 237), Color.FromRgb(67, 20, 7)),
        _ => new(Color.FromRgb(15, 118, 110), Color.FromRgb(231, 248, 244), Color.FromRgb(15, 23, 42))
    };

    private static FlowDocument BuildDocument(
        InvoiceRecord invoice,
        string theme,
        bool showQr,
        CompanyProfileRecord? company)
    {
        var palette = GetPalette(theme);
        var accent = new SolidColorBrush(palette.Accent);
        var soft = new SolidColorBrush(palette.Soft);
        var ink = new SolidColorBrush(palette.Ink);
        accent.Freeze();
        soft.Freeze();
        ink.Freeze();

        var document = new FlowDocument
        {
            FontFamily = new FontFamily("Segoe UI"),
            FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft,
            PagePadding = new Thickness(36),
            ColumnWidth = 760,
            Background = Brushes.White,
            Foreground = ink
        };

        document.Blocks.Add(new Paragraph(new Run($"اشک قلم — {invoice.TypeLabel}"))
        {
            FontSize = 25,
            FontWeight = FontWeights.Bold,
            Foreground = accent,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 18)
        });

        if (company is not null)
        {
            var companyName = string.IsNullOrWhiteSpace(company.LegalName) ? company.Name : company.LegalName;
            document.Blocks.Add(new Paragraph(new Run(
                $"{companyName}   •   شعبه: {company.Branch}   •   تلفن: {company.Phone}"))
            {
                Foreground = accent,
                FontSize = 10,
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, -6, 0, 14)
            });
            if (!string.IsNullOrWhiteSpace(company.Address) ||
                !string.IsNullOrWhiteSpace(company.NationalId) ||
                !string.IsNullOrWhiteSpace(company.TaxId))
            {
                document.Blocks.Add(new Paragraph(new Run(
                    $"نشانی: {company.Address}   •   شناسه ملی: {company.NationalId}   •   شناسه مالیاتی: {company.TaxId}"))
                {
                    Foreground = Brushes.DimGray,
                    FontSize = 9,
                    TextAlignment = TextAlignment.Center
                });
            }
        }

        document.Blocks.Add(new Paragraph(new Run(
            $"شماره سند: {invoice.DisplayNumber}     کد پیگیری: {invoice.TrackingCode}     تاریخ: {FormatDate(invoice.CreatedAt)}"))
        { TextAlignment = TextAlignment.Right });

        document.Blocks.Add(new Paragraph(new Run($"طرف حساب: {invoice.CustomerName}"))
        { TextAlignment = TextAlignment.Right });

        if (invoice.DueDate is DateTimeOffset dueDate)
            document.Blocks.Add(new Paragraph(new Run($"سررسید: {FormatDate(dueDate)}")) { TextAlignment = TextAlignment.Right });

        if (!string.IsNullOrWhiteSpace(invoice.DriverName) ||
            !string.IsNullOrWhiteSpace(invoice.VehiclePlate) ||
            !string.IsNullOrWhiteSpace(invoice.DriverPhone))
        {
            document.Blocks.Add(new Paragraph(new Run(
                $"راننده: {invoice.DriverName}   تلفن: {invoice.DriverPhone}   خودرو: {invoice.VehiclePlate}"))
            { TextAlignment = TextAlignment.Right });
        }

        if (!string.IsNullOrWhiteSpace(invoice.TaxId))
            document.Blocks.Add(new Paragraph(new Run($"شناسه مالیاتی فاکتور: {invoice.TaxId}")) { TextAlignment = TextAlignment.Right });
        if (!string.IsNullOrWhiteSpace(invoice.Description))
            document.Blocks.Add(new Paragraph(new Run($"شرح: {invoice.Description}")) { TextAlignment = TextAlignment.Right });
        if (!string.IsNullOrWhiteSpace(invoice.Notes))
            document.Blocks.Add(new Paragraph(new Run($"یادداشت: {invoice.Notes}")) { TextAlignment = TextAlignment.Right });

        var table = new Table { CellSpacing = 0 };
        table.Columns.Add(new TableColumn { Width = new GridLength(5, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.2, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.2, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.6, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.8, GridUnitType.Star) });

        var group = new TableRowGroup();
        var header = new TableRow();
        foreach (var label in new[] { "کالا / شرح قلم", "تعداد", "واحد", "قیمت واحد", "جمع" })
        {
            header.Cells.Add(new TableCell(new Paragraph(new Run(label)))
            {
                FontWeight = FontWeights.Bold,
                Background = soft,
                Foreground = accent,
                Padding = new Thickness(7),
                BorderBrush = accent,
                BorderThickness = new Thickness(0.5)
            });
        }
        group.Rows.Add(header);

        foreach (var line in invoice.Lines)
        {
            var row = new TableRow();
            var values = new[]
            {
                string.IsNullOrWhiteSpace(line.Description) ? line.ProductName : $"{line.ProductName}\n{line.Description}",
                line.Quantity.ToString("N2", CultureInfo.CurrentCulture),
                "—",
                line.UnitPrice.ToString("N2", CultureInfo.CurrentCulture),
                line.LineTotal.ToString("N2", CultureInfo.CurrentCulture)
            };

            foreach (var value in values)
            {
                row.Cells.Add(new TableCell(new Paragraph(new Run(value)))
                {
                    Padding = new Thickness(7),
                    BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                    BorderThickness = new Thickness(0.5)
                });
            }
            group.Rows.Add(row);
        }

        if (invoice.Lines.Count == 0)
        {
            group.Rows.Add(new TableRow
            {
                Cells =
                {
                    new TableCell(new Paragraph(new Run("برای این سند قلم کالا ثبت نشده است.")))
                    {
                        ColumnSpan = 5,
                        Padding = new Thickness(8),
                        BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                        BorderThickness = new Thickness(0.5)
                    }
                }
            });
        }

        table.RowGroups.Add(group);
        document.Blocks.Add(table);
        document.Blocks.Add(new Paragraph(new Run($"جمع کالاها: {invoice.Subtotal.ToString("N2", CultureInfo.CurrentCulture)}"))
        { TextAlignment = TextAlignment.Left, Margin = new Thickness(0, 18, 0, 0) });
        document.Blocks.Add(new Paragraph(new Run($"تخفیف: {invoice.Discount.ToString("N2", CultureInfo.CurrentCulture)}"))
        { TextAlignment = TextAlignment.Left });
        var taxLabel = invoice.TaxIsAmount
            ? "مالیات"
            : $"مالیات ({invoice.TaxRatePercent.ToString("N2", CultureInfo.CurrentCulture)}%)";
        document.Blocks.Add(new Paragraph(new Run($"{taxLabel}: {invoice.TaxAmount.ToString("N2", CultureInfo.CurrentCulture)}"))
        { TextAlignment = TextAlignment.Left });
        document.Blocks.Add(new Paragraph(new Run($"مبلغ نهایی: {invoice.Total.ToString("N2", CultureInfo.CurrentCulture)}"))
        {
            FontSize = 19,
            FontWeight = FontWeights.Bold,
            Foreground = accent,
            TextAlignment = TextAlignment.Left,
            Margin = new Thickness(0, 8, 0, 0)
        });
        document.Blocks.Add(new Paragraph(new Run(
            $"نقدی ثبت‌شده: {invoice.CashAmount.ToString("N2", CultureInfo.CurrentCulture)}    مبلغ چک: {invoice.CheckAmount.ToString("N2", CultureInfo.CurrentCulture)}"))
        { TextAlignment = TextAlignment.Left });
        document.Blocks.Add(new Paragraph(new Run($"وضعیت سند: {invoice.Status}"))
        { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 14, 0, 0) });

        if (showQr)
        {
            try
            {
                var companyName = company?.Name ?? "اشک قلم";
                var payload = $"ASHKEGHALAM|INVOICE|{invoice.TrackingCode}|DATE|{FormatDate(invoice.CreatedAt)}|TOTAL|{invoice.Total.ToString(CultureInfo.InvariantCulture)}|CUSTOMER|{invoice.CustomerName}|COMPANY|{companyName}";
                var qr = CreateQrImage(payload);
                var qrCard = new Border
                {
                    BorderBrush = accent,
                    BorderThickness = new Thickness(1),
                    Background = soft,
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(10),
                    Margin = new Thickness(0, 18, 0, 6),
                    HorizontalAlignment = HorizontalAlignment.Left,
                    Child = new StackPanel
                    {
                        HorizontalAlignment = HorizontalAlignment.Center,
                        Children =
                        {
                            qr,
                            new TextBlock
                            {
                                Text = "QR فاکتور — کد پیگیری و مبلغ",
                                FontSize = 9,
                                Foreground = ink,
                                TextAlignment = TextAlignment.Center,
                                Margin = new Thickness(0, 6, 0, 0)
                            }
                        }
                    }
                };
                document.Blocks.Add(new BlockUIContainer(qrCard));
            }
            catch (Exception qrError)
            {
                document.Blocks.Add(new Paragraph(new Run("تولید QR این سند انجام نشد: " + qrError.Message))
                {
                    Foreground = Brushes.DarkRed,
                    Margin = new Thickness(0, 8, 0, 8)
                });
            }
        }

        document.Blocks.Add(new Paragraph(new Run(
            "امضای صادرکننده: ................................       تحویل‌گیرنده: ................................       مهر و امضا: ................................"))
        {
            TextAlignment = TextAlignment.Right,
            Margin = new Thickness(0, 34, 0, 0),
            Padding = new Thickness(0, 12, 0, 12)
        });

        return document;
    }

    private static Image CreateQrImage(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var bytes = new PngByteQRCode(data).GetGraphic(6);
        using var stream = new MemoryStream(bytes);
        var bitmap = new BitmapImage();
        bitmap.BeginInit();
        bitmap.CacheOption = BitmapCacheOption.OnLoad;
        bitmap.StreamSource = stream;
        bitmap.EndInit();
        bitmap.Freeze();
        return new Image
        {
            Source = bitmap,
            Width = 108,
            Height = 108,
            Stretch = Stretch.Uniform,
            SnapsToDevicePixels = true
        };
    }

    private void Print_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var printDialog = new PrintDialog();
            if (printDialog.ShowDialog() != true)
                return;
            printDialog.PrintDocument(
                ((IDocumentPaginatorSource)_document).DocumentPaginator,
                $"AshkeGhalam-Invoice-{_invoice.Number}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ فاکتور", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static string FormatDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        var date = value.LocalDateTime;
        return $"{calendar.GetYear(date):0000}/{calendar.GetMonth(date):00}/{calendar.GetDayOfMonth(date):00}";
    }
}
