using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using QRCoder;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoicePreviewWindow : Window
{
    private readonly InvoiceRecord _invoice;
    private readonly CompanyProfileRecord? _company;
    private readonly bool _showQr;
    private readonly string _currencyLabel;
    private readonly string _invoiceFooter;
    private FlowDocument _document;
    private FlowDocumentScrollViewer _viewer = null!;
    private string _theme = "modern";

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
        CompanyProfileRecord? company = null,
        string? currencyCode = "RIAL",
        string? invoiceFooter = null)
        : this(owner, BuildDraftPreview(draft, people, invoices), defaultTheme, showQr, company, currencyCode, invoiceFooter)
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
            Unit = line.Unit,
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
            InvoiceFooter = draft.InvoiceFooter,
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
        CompanyProfileRecord? company = null,
        string? currencyCode = "RIAL",
        string? invoiceFooter = null)
    {
        _invoice = invoice ?? throw new ArgumentNullException(nameof(invoice));
        _company = company;
        _showQr = showQr;
        _currencyLabel = currencyCode?.Trim().ToUpperInvariant() switch
        {
            "TOMAN" => "تومان",
            "RIAL" or "" or null => "ریال",
            _ => currencyCode.Trim()
        };
        _invoiceFooter = !string.IsNullOrWhiteSpace(invoice.InvoiceFooter) ? invoice.InvoiceFooter : invoiceFooter ?? "";
        _theme = InvoiceThemes.Any(option => string.Equals(option.Key, defaultTheme, StringComparison.Ordinal))
            ? defaultTheme!
            : "modern";
        Owner = owner;
        Title = $"پیش‌نمایش {invoice.TypeLabel} — {invoice.DisplayNumber}";
        Width = 1080;
        Height = 820;
        MinWidth = 760;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = CreatePersianFontFamily();
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        _document = BuildDocument(invoice, _theme, _showQr, _company, _currencyLabel, _invoiceFooter);
        var root = new Grid { Margin = new Thickness(14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0) };
        var title = new StackPanel { Orientation = Orientation.Vertical };
        title.Children.Add(new TextBlock
        {
            Text = $"پیش‌نمایش فاکتور {invoice.DisplayNumber}",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252))
        });
        title.Children.Add(new TextBlock
        {
            Text = "این صفحه قبل از چاپ، شماره سند، طرف حساب، اقلام، تخفیف، مالیات و جمع نهایی را نشان می‌دهد.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
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
            _document = BuildDocument(_invoice, _theme, _showQr, _company, _currencyLabel, _invoiceFooter);
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
            IsToolBarVisible = false,
            Background = Brushes.White,
            Padding = new Thickness(12)
        };
        _viewer = viewer;
        paper.Child = viewer;
        buttons.Children.Insert(1, PreviewChromeService.CreateZoomControls(viewer, () => _document.PageWidth));
        var toolbarFrame = PreviewChromeService.CreateToolbarFrame(toolbar);
        Grid.SetRow(toolbarFrame, 0);
        Grid.SetRow(paper, 1);
        root.Children.Add(toolbarFrame);
        root.Children.Add(paper);
        Content = root;
    }

    private static FontFamily CreatePersianFontFamily()
    {
        // Prefer the font embedded as a WPF Resource. A local installation is not required.
        // If a manually checked-out source tree is missing the asset, use a safe system font
        // rather than allowing font resolution to take down the invoice preview.
        try
        {
            var embedded = new FontFamily(new Uri("pack://application:,,,/"), "./Assets/Fonts/#Vazirmatn");
            if (embedded.GetTypefaces().Any())
                return embedded;
        }
        catch
        {
            // Continue to the installed-family fallback.
        }

        try
        {
            var installed = new FontFamily("Vazirmatn");
            if (installed.GetTypefaces().Any())
                return installed;
        }
        catch
        {
            // Segoe UI is present on supported Windows desktop installations.
        }

        return new FontFamily("Segoe UI");
    }

    private static InvoicePalette GetPalette(string theme) => theme switch
    {
        "official" => new(Color.FromRgb(51, 65, 85), Color.FromRgb(241, 245, 249), Color.FromRgb(15, 23, 42)),
        "premium" => new(Color.FromRgb(120, 90, 31), Color.FromRgb(248, 241, 223), Color.FromRgb(41, 37, 36)), // 5.68:1 contrast on the invoice's soft surface
        "thermal" => new(Color.FromRgb(17, 24, 39), Color.FromRgb(243, 244, 246), Color.FromRgb(17, 24, 39)),
        "minimal" => new(Color.FromRgb(100, 116, 139), Color.FromRgb(248, 250, 252), Color.FromRgb(30, 41, 59)),
        "classic" => new(Color.FromRgb(30, 64, 175), Color.FromRgb(239, 246, 255), Color.FromRgb(30, 41, 59)),
        "smart" => new(Color.FromRgb(3, 105, 161), Color.FromRgb(224, 242, 254), Color.FromRgb(12, 45, 72)),
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
        CompanyProfileRecord? company,
        string currencyLabel,
        string invoiceFooter)
    {
        var palette = GetPalette(theme);
        var invoiceLines = invoice.Lines ?? [];
        string BothCurrencies(decimal amount)
        {
            var primary = amount.ToString("#,##0.##", CultureInfo.InvariantCulture);
            var otherAmount = string.Equals(currencyLabel, "تومان", StringComparison.Ordinal) ? amount * 10m : amount / 10m;
            var otherCurrency = string.Equals(currencyLabel, "تومان", StringComparison.Ordinal) ? "ریال" : "تومان";
            return $"{primary} {currencyLabel}{Environment.NewLine}{otherAmount.ToString("#,##0.##", CultureInfo.InvariantCulture)} {otherCurrency}";
        }
        var accent = new SolidColorBrush(palette.Accent);
        var soft = new SolidColorBrush(palette.Soft);
        var ink = new SolidColorBrush(palette.Ink);
        accent.Freeze();
        soft.Freeze();
        ink.Freeze();

        var document = new FlowDocument
        {
            FontFamily = CreatePersianFontFamily(),
            FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft,
            PageWidth = 794,
            PageHeight = 1123,
            PagePadding = new Thickness(32),
            ColumnWidth = 730,
            Background = Brushes.White,
            Foreground = ink
        };

        var companyName = company is null
            ? "اشک قلم"
            : string.IsNullOrWhiteSpace(company.LegalName) ? company.Name : company.LegalName;
        var headerBackground = theme switch
        {
            "premium" => Color.FromRgb(41, 37, 36),
            "official" or "thermal" or "minimal" or "persian" => palette.Soft,
            _ => palette.Accent
        };
        var headerForeground = theme is "official" or "thermal" or "minimal" or "persian"
            ? palette.Ink
            : Colors.White;
        var roundHeader = theme is not ("official" or "thermal" or "minimal");
        var headerLayout = new Grid
        {
            Width = 624,
            FlowDirection = FlowDirection.RightToLeft
        };
        headerLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        headerLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var headerText = new StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 14, 0)
        };
        headerText.Children.Add(new TextBlock
        {
            Text = invoice.TypeLabel,
            FontSize = theme == "thermal" ? 20 : 26,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(headerForeground),
            TextWrapping = TextWrapping.Wrap
        });
        headerText.Children.Add(new TextBlock
        {
            Text = companyName,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(headerForeground),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 3, 0, 0)
        });
        headerText.Children.Add(new TextBlock
        {
            Text = $"شماره {invoice.DisplayNumber}   •   تاریخ {FormatDate(invoice.CreatedAt)}",
            FontSize = 10,
            Foreground = new SolidColorBrush(headerForeground),
            Margin = new Thickness(0, 7, 0, 0)
        });
        Grid.SetColumn(headerText, 0);
        headerLayout.Children.Add(headerText);

        var logoImage = CreateCompanyImage(company?.LogoDataBase64, 94, 72);
        if (logoImage is not null)
        {
            logoImage.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(logoImage, 1);
            headerLayout.Children.Add(logoImage);
        }

        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 660,
            Background = new SolidColorBrush(headerBackground),
            BorderBrush = accent,
            BorderThickness = new Thickness(theme == "minimal" ? 0 : 1),
            CornerRadius = new CornerRadius(roundHeader ? 14 : 2),
            Padding = new Thickness(theme == "thermal" ? 12 : 18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = headerLayout
        }));

        var detailsColumn = new StackPanel
        {
            FlowDirection = FlowDirection.RightToLeft,
            Width = showQr ? 520 : 660
        };

        if (company is not null &&
            (!string.IsNullOrWhiteSpace(company.Address) ||
             !string.IsNullOrWhiteSpace(company.Phone) ||
             !string.IsNullOrWhiteSpace(company.NationalId) ||
             !string.IsNullOrWhiteSpace(company.TaxId)))
        {
            var identity = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            var contact = string.Join("   •   ", new[]
            {
                string.IsNullOrWhiteSpace(company.Branch) ? "" : "شعبه: " + company.Branch,
                string.IsNullOrWhiteSpace(company.Phone) ? "" : "تلفن: " + company.Phone,
                string.IsNullOrWhiteSpace(company.Address) ? "" : "نشانی: " + company.Address
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
            if (!string.IsNullOrWhiteSpace(contact))
                identity.Children.Add(new TextBlock
                {
                    Text = contact, FontSize = 10, Foreground = ink,
                    TextWrapping = TextWrapping.Wrap
                });
            var identifiers = string.Join("   •   ", new[]
            {
                string.IsNullOrWhiteSpace(company.NationalId) ? "" : "شناسه ملی: " + company.NationalId,
                string.IsNullOrWhiteSpace(company.TaxId) ? "" : "شناسه مالیاتی: " + company.TaxId
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
            if (!string.IsNullOrWhiteSpace(identifiers))
                identity.Children.Add(new TextBlock
                {
                    Text = identifiers, FontSize = 9, Foreground = ink,
                    TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0)
                });
            detailsColumn.Children.Add(new Border
            {
                Background = soft,
                BorderBrush = accent,
                BorderThickness = new Thickness(0, 0, 4, 0),
                CornerRadius = new CornerRadius(theme == "official" ? 2 : 8),
                Padding = new Thickness(10),
                Margin = new Thickness(0, 0, 0, 8),
                Child = identity
            });
        }

        Border MakeInfoCard(string label, string value, double minWidth = 160)
        {
            var stack = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            stack.Children.Add(new TextBlock
            {
                Text = label, FontSize = 9, Foreground = accent,
                FontWeight = FontWeights.SemiBold
            });
            stack.Children.Add(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(value) ? "—" : value,
                FontSize = 11, Foreground = ink, FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 0)
            });
            return new Border
            {
                MinWidth = minWidth,
                MaxWidth = 270,
                Background = soft,
                BorderBrush = new SolidColorBrush(Color.FromRgb(220, 226, 234)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(theme == "official" ? 2 : 8),
                Padding = new Thickness(8),
                Margin = new Thickness(0, 0, 6, 6),
                Child = stack
            };
        }

        var invoiceFacts = new WrapPanel
        {
            FlowDirection = FlowDirection.RightToLeft,
            Width = showQr ? 520 : 660,
            Margin = new Thickness(0)
        };
        invoiceFacts.Children.Add(MakeInfoCard("طرف حساب", invoice.CustomerName, 210));
        invoiceFacts.Children.Add(MakeInfoCard("کد پیگیری", invoice.TrackingCode, 165));
        if (invoice.DueDate is DateTimeOffset dueDate)
            invoiceFacts.Children.Add(MakeInfoCard("سررسید شمسی", FormatDate(dueDate), 145));
        if (!string.IsNullOrWhiteSpace(invoice.TaxId))
            invoiceFacts.Children.Add(MakeInfoCard("شناسه مالیاتی فاکتور", invoice.TaxId, 175));
        if (!string.IsNullOrWhiteSpace(invoice.DriverName) ||
            !string.IsNullOrWhiteSpace(invoice.VehiclePlate) ||
            !string.IsNullOrWhiteSpace(invoice.DriverPhone))
            invoiceFacts.Children.Add(MakeInfoCard("حمل و تحویل",
                $"راننده: {invoice.DriverName}   •   تلفن: {invoice.DriverPhone}   •   خودرو: {invoice.VehiclePlate}", 230));
        if (!string.IsNullOrWhiteSpace(invoice.Description))
            invoiceFacts.Children.Add(MakeInfoCard("شرح سند", invoice.Description, 230));
        if (!string.IsNullOrWhiteSpace(invoice.Notes))
            invoiceFacts.Children.Add(MakeInfoCard("یادداشت", invoice.Notes, 230));
        detailsColumn.Children.Add(invoiceFacts);

        var invoiceTopLayout = new Grid
        {
            Width = 660,
            FlowDirection = FlowDirection.LeftToRight,
            Margin = new Thickness(0, 0, 0, 10)
        };
        if (showQr)
        {
            invoiceTopLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(128) });
            invoiceTopLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            try
            {
                var qrCompanyName = company?.Name ?? "اشک قلم";
                var payload = $"ASHKEGHALAM|INVOICE|{invoice.TrackingCode}|DATE|{FormatDate(invoice.CreatedAt)}|TOTAL|{invoice.Total.ToString(CultureInfo.InvariantCulture)}|CURRENCY|{currencyLabel}|CUSTOMER|{invoice.CustomerName}|COMPANY|{qrCompanyName}";
                var qrCard = new Border
                {
                    Width = 120,
                    BorderBrush = accent,
                    BorderThickness = new Thickness(1),
                    Background = soft,
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(5),
                    Margin = new Thickness(0, 0, 8, 0),
                    HorizontalAlignment = HorizontalAlignment.Left,
                    VerticalAlignment = VerticalAlignment.Top,
                    Child = new StackPanel
                    {
                        HorizontalAlignment = HorizontalAlignment.Center,
                        Children =
                        {
                            CreateQrImage(payload),
                            new TextBlock
                            {
                                Text = "QR فاکتور",
                                FontSize = 8,
                                Foreground = ink,
                                TextAlignment = TextAlignment.Center,
                                TextWrapping = TextWrapping.Wrap,
                                Margin = new Thickness(0, 3, 0, 0)
                            }
                        }
                    }
                };
                Grid.SetColumn(qrCard, 0);
                invoiceTopLayout.Children.Add(qrCard);
            }
            catch (Exception qrError)
            {
                var qrErrorCard = new Border
                {
                    Width = 120,
                    Background = soft,
                    BorderBrush = accent,
                    BorderThickness = new Thickness(1),
                    Padding = new Thickness(6),
                    Child = new TextBlock
                    {
                        Text = "QR ساخته نشد: " + qrError.Message,
                        FontSize = 8,
                        Foreground = Brushes.DarkRed,
                        TextWrapping = TextWrapping.Wrap
                    }
                };
                Grid.SetColumn(qrErrorCard, 0);
                invoiceTopLayout.Children.Add(qrErrorCard);
            }
        }
        else
        {
            invoiceTopLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        }

        Grid.SetColumn(detailsColumn, showQr ? 1 : 0);
        invoiceTopLayout.Children.Add(detailsColumn);
        document.Blocks.Add(new BlockUIContainer(invoiceTopLayout));

        var table = new Table { CellSpacing = 0, Margin = new Thickness(0, 2, 0, 10) };
        table.Columns.Add(new TableColumn { Width = new GridLength(5, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.2, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.2, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.6, GridUnitType.Star) });
        table.Columns.Add(new TableColumn { Width = new GridLength(1.8, GridUnitType.Star) });

        var headerGroup = new TableRowGroup();
        var bodyGroup = new TableRowGroup();
        var header = new TableRow();
        foreach (var label in new[] { "کالا / شرح قلم", "تعداد", "واحد", "قیمت واحد (ریال / تومان)", "جمع (ریال / تومان)" })
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
        headerGroup.Rows.Add(header);
        table.RowGroups.Add(headerGroup);

        var invoiceRowIndex = 0;
        foreach (var line in invoiceLines)
        {
            var row = new TableRow();
            var itemPanel = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            itemPanel.Children.Add(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(line.ProductName) ? "—" : line.ProductName,
                FontWeight = FontWeights.SemiBold, FontSize = 9.5,
                TextWrapping = TextWrapping.Wrap, Foreground = ink
            });
            if (!string.IsNullOrWhiteSpace(line.Description))
            {
                itemPanel.Children.Add(new Border
                {
                    Background = soft,
                    BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                    BorderThickness = new Thickness(0.7),
                    CornerRadius = new CornerRadius(3),
                    Padding = new Thickness(4, 3, 4, 3),
                    Margin = new Thickness(0, 4, 0, 0),
                    Child = new TextBlock
                    {
                        Text = line.Description.Trim(), FontSize = 8.5,
                        TextWrapping = TextWrapping.Wrap, Foreground = ink
                    }
                });
            }
            var background = invoiceRowIndex % 2 == 0 ? Brushes.White : soft;
            var itemCell = new TableCell
            {
                Padding = new Thickness(6), Background = background,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                BorderThickness = new Thickness(0.5), FontSize = 9
            };
            itemCell.Blocks.Add(new BlockUIContainer(itemPanel));
            row.Cells.Add(itemCell);

            var values = new[]
            {
                line.Quantity.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")),
                string.IsNullOrWhiteSpace(line.Unit) ? "—" : line.Unit,
                BothCurrencies(line.UnitPrice),
                BothCurrencies(line.LineTotal)
            };
            for (var valueIndex = 0; valueIndex < values.Length; valueIndex++)
            {
                var value = values[valueIndex];
                var numeric = valueIndex is 0 or 2 or 3;
                var paragraph = new Paragraph(new Run(value))
                {
                    Margin = new Thickness(0),
                    TextAlignment = TextAlignment.Right,
                    FlowDirection = numeric ? FlowDirection.LeftToRight : FlowDirection.RightToLeft
                };
                row.Cells.Add(new TableCell(paragraph)
                {
                    Padding = new Thickness(theme == "thermal" ? 4 : 6),
                    Background = background,
                    BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                    BorderThickness = new Thickness(0.5),
                    FontSize = 8.5
                });
            }

            bodyGroup.Rows.Add(row);
            invoiceRowIndex++;
        }

        if (invoiceLines.Count == 0)
        {
            bodyGroup.Rows.Add(new TableRow
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

        table.RowGroups.Add(bodyGroup);
        document.Blocks.Add(table);
        var taxLabel = invoice.TaxIsAmount
            ? "مالیات"
            : $"مالیات ({invoice.TaxRatePercent.ToString("#,##0.##", CultureInfo.CurrentCulture)}%)";
        Grid MakeAmountRow(string label, string amount, bool emphasize = false)
        {
            var row = new Grid { FlowDirection = FlowDirection.RightToLeft, Margin = new Thickness(0, 3, 0, 3) };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            var labelText = new TextBlock
            {
                Text = label,
                FontSize = emphasize ? 14 : 11,
                FontWeight = emphasize ? FontWeights.Bold : FontWeights.Normal,
                Foreground = ink,
                VerticalAlignment = VerticalAlignment.Center
            };
            var amountText = new TextBlock
            {
                Text = amount,
                FontSize = emphasize ? 20 : 11,
                FontWeight = emphasize ? FontWeights.Bold : FontWeights.SemiBold,
                Foreground = emphasize ? accent : ink,
                TextAlignment = TextAlignment.Left,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(labelText, 0);
            Grid.SetColumn(amountText, 1);
            row.Children.Add(labelText);
            row.Children.Add(amountText);
            return row;
        }

        var totalsStack = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
        totalsStack.Children.Add(MakeAmountRow("جمع کالاها", BothCurrencies(invoice.Subtotal)));
        totalsStack.Children.Add(MakeAmountRow("تخفیف", BothCurrencies(invoice.Discount)));
        totalsStack.Children.Add(MakeAmountRow(taxLabel, BothCurrencies(invoice.TaxAmount)));
        totalsStack.Children.Add(new Border
        {
            Height = 1, Background = accent, Opacity = 0.65,
            Margin = new Thickness(0, 8, 0, 8)
        });
        totalsStack.Children.Add(MakeAmountRow("مبلغ نهایی قابل پرداخت (ریال و تومان)",
            BothCurrencies(invoice.Total), emphasize: true));
        totalsStack.Children.Add(MakeAmountRow("تسویهٔ اولیه — نقدی", BothCurrencies(invoice.CashAmount)));
        totalsStack.Children.Add(MakeAmountRow("تسویهٔ اولیه — چک", BothCurrencies(invoice.CheckAmount)));
        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 660,
            Background = soft,
            BorderBrush = accent,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(theme == "official" || theme == "thermal" ? 2 : 12),
            Padding = new Thickness(16),
            Margin = new Thickness(0, 16, 0, 6),
            Child = totalsStack
        }));
        document.Blocks.Add(new Paragraph(new Run($"وضعیت سند: {invoice.Status}"))
        { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 14, 0, 0) });

        if (!string.IsNullOrWhiteSpace(invoiceFooter))
        {
            foreach (var note in invoiceFooter
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(note => !string.IsNullOrWhiteSpace(note))
                .Distinct(StringComparer.Ordinal))
            {
                document.Blocks.Add(new Paragraph(new Run("• " + note))
                {
                    Foreground = Brushes.DimGray,
                    FontSize = 10,
                    Margin = new Thickness(0, 2, 0, 2),
                    TextAlignment = TextAlignment.Right
                });
            }
        }

        var brandMarks = new StackPanel
        {
            Orientation = Orientation.Horizontal, FlowDirection = FlowDirection.RightToLeft,
            HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 12, 0, 2)
        };
        var companySignature = CreateCompanyImage(company?.SignatureDataBase64, 125, 58);
        if (companySignature is not null)
            brandMarks.Children.Add(new StackPanel
            {
                Margin = new Thickness(12, 0, 12, 0),
                Children = { companySignature, new TextBlock { Text = "امضای شرکت", FontSize = 9, TextAlignment = TextAlignment.Center } }
            });
        var companyStamp = CreateCompanyImage(company?.StampDataBase64, 80, 80);
        if (companyStamp is not null)
            brandMarks.Children.Add(new StackPanel
            {
                Margin = new Thickness(12, 0, 12, 0),
                Children = { companyStamp, new TextBlock { Text = "مهر شرکت", FontSize = 9, TextAlignment = TextAlignment.Center } }
            });
        if (brandMarks.Children.Count > 0)
            document.Blocks.Add(new BlockUIContainer(brandMarks));

        document.Blocks.Add(new Paragraph(new Run(
            "امضای صادرکننده: ................................       تحویل‌گیرنده: ................................       مهر و امضا: ................................"))
        {
            TextAlignment = TextAlignment.Right,
            Margin = new Thickness(0, 34, 0, 0),
            Padding = new Thickness(0, 12, 0, 12)
        });

        PrintBrandingService.AppendWebsiteFooter(document, 660);
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

    private static Image? CreateCompanyImage(string? encoded, double width, double height)
    {
        if (string.IsNullOrWhiteSpace(encoded)) return null;
        try
        {
            var bytes = Convert.FromBase64String(encoded);
            using var stream = new MemoryStream(bytes);
            var bitmap = new BitmapImage();
            bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream; bitmap.DecodePixelWidth = (int)Math.Max(width * 2, 100);
            bitmap.EndInit(); bitmap.Freeze();
            return new Image { Source = bitmap, Width = width, Height = height, Stretch = Stretch.Uniform };
        }
        catch { return null; }
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
