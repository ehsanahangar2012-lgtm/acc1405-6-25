using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

/// <summary>A branded, printable local receipt for a recorded invoice settlement.</summary>
public sealed class PaymentReceiptPreviewWindow : Window
{
    private readonly FlowDocument _document;
    private readonly PaymentRecord _payment;

    public PaymentReceiptPreviewWindow(
        Window owner,
        PaymentRecord payment,
        InvoiceRecord invoice,
        CompanyProfileRecord? company,
        string? currencyCode = "RIAL",
        IReadOnlyList<CheckRecord>? relatedChecks = null)
    {
        _payment = payment ?? throw new ArgumentNullException(nameof(payment));
        ArgumentNullException.ThrowIfNull(invoice);
        Owner = owner;
        Title = $"پیش‌نمایش رسید — {invoice.DisplayNumber}";
        Width = 940;
        Height = 760;
        MinWidth = 700;
        MinHeight = 520;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var currency = currencyCode?.Trim().ToUpperInvariant() switch
        {
            "TOMAN" => "تومان",
            "RIAL" or "" or null => "ریال",
            _ => currencyCode.Trim()
        };
        _document = BuildDocument(payment, invoice, company, currency, relatedChecks ?? Array.Empty<CheckRecord>());

        var root = new Grid { Margin = new Thickness(16) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0, 0, 0, 12) };
        var titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titleStack.Children.Add(new TextBlock
        {
            Text = "رسید دریافت / پرداخت",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42))
        });
        titleStack.Children.Add(new TextBlock
        {
            Text = "قالب چاپی اختصاصی برای ثبت داخلی تسویهٔ فاکتور",
            FontSize = 11,
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            Margin = new Thickness(0, 4, 0, 0)
        });
        toolbar.Children.Add(titleStack);

        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var print = new Button
        {
            Content = "چاپ رسید",
            MinWidth = 110,
            Height = 38,
            Background = new SolidColorBrush(Color.FromRgb(15, 118, 110)),
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 8, 0)
        };
        print.Click += Print_Click;
        actions.Children.Add(print);
        actions.Children.Add(new Button { Content = "بستن", MinWidth = 88, Height = 38, IsCancel = true });
        DockPanel.SetDock(actions, Dock.Left);
        toolbar.Children.Add(actions);

        var paper = new Border
        {
            Background = Brushes.White,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(10),
            Child = new FlowDocumentScrollViewer
            {
                Document = _document,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
                IsToolBarVisible = true,
                Background = Brushes.White,
                Padding = new Thickness(12)
            }
        };
        Grid.SetRow(paper, 1);
        root.Children.Add(toolbar);
        root.Children.Add(paper);
        Content = root;
    }

    private static FlowDocument BuildDocument(
        PaymentRecord payment,
        InvoiceRecord invoice,
        CompanyProfileRecord? company,
        string currency,
        IReadOnlyList<CheckRecord> relatedChecks)
    {
        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var soft = new SolidColorBrush(Color.FromRgb(231, 248, 244));
        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var muted = new SolidColorBrush(Color.FromRgb(71, 85, 105));
        var companyName = string.IsNullOrWhiteSpace(company?.LegalName) ? company?.Name ?? "اشک قلم" : company.LegalName;

        var document = new FlowDocument
        {
            FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"),
            FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft,
            PagePadding = new Thickness(30),
            ColumnWidth = 720,
            Background = Brushes.White,
            Foreground = ink
        };

        var receiptNumber = !string.IsNullOrWhiteSpace(payment.Reference)
            ? payment.Reference.Trim()
            : $"RCPT-{payment.CreatedAt:yyyyMMdd-HHmm}";
        var headerGrid = new Grid { Width = 604, FlowDirection = FlowDirection.RightToLeft };
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var headerText = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 12, 0) };
        headerText.Children.Add(new TextBlock { Text = payment.Method == "چک" ? "رسید ثبت چک" : "رسید تسویهٔ مالی",
            FontSize = 24, FontWeight = FontWeights.Bold, Foreground = Brushes.White, TextWrapping = TextWrapping.Wrap });
        headerText.Children.Add(new TextBlock { Text = companyName, FontSize = 14, FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White, Margin = new Thickness(0, 3, 0, 0), TextWrapping = TextWrapping.Wrap });
        headerText.Children.Add(new TextBlock { Text = $"رسید: {receiptNumber}   •   تاریخ: {FormatPersianDate(payment.CreatedAt)}",
            FontSize = 10, Foreground = Brushes.White, Margin = new Thickness(0, 7, 0, 0), TextWrapping = TextWrapping.Wrap });
        Grid.SetColumn(headerText, 0);
        headerGrid.Children.Add(headerText);
        if (!string.IsNullOrWhiteSpace(company?.LogoDataBase64))
        {
            var logo = CreateCompanyImage(company.LogoDataBase64, 84, 68);
            if (logo is not null)
            {
                logo.VerticalAlignment = VerticalAlignment.Center;
                Grid.SetColumn(logo, 1);
                headerGrid.Children.Add(logo);
            }
        }
        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 640, Background = accent, BorderBrush = accent, BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14), Padding = new Thickness(18), Margin = new Thickness(0, 0, 0, 14),
            Child = headerGrid
        }));

        if (company is not null && (!string.IsNullOrWhiteSpace(company.Phone) || !string.IsNullOrWhiteSpace(company.Address)))
        {
            var companyInfo = string.Join("   •   ", new[]
            {
                string.IsNullOrWhiteSpace(company.Branch) ? "" : "شعبه: " + company.Branch,
                string.IsNullOrWhiteSpace(company.Phone) ? "" : "تلفن: " + company.Phone,
                string.IsNullOrWhiteSpace(company.Address) ? "" : "نشانی: " + company.Address
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
            document.Blocks.Add(new BlockUIContainer(new Border
            {
                Width = 640, Background = soft, BorderBrush = accent, BorderThickness = new Thickness(0, 0, 4, 0),
                CornerRadius = new CornerRadius(8), Padding = new Thickness(12), Margin = new Thickness(0, 0, 0, 14),
                Child = new TextBlock { Text = companyInfo, FontSize = 10, Foreground = ink, TextWrapping = TextWrapping.Wrap }
            }));
        }

        Border InfoCard(string label, string value, double minWidth = 190)
        {
            var stack = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            stack.Children.Add(new TextBlock { Text = label, FontSize = 9, FontWeight = FontWeights.SemiBold, Foreground = accent });
            stack.Children.Add(new TextBlock { Text = string.IsNullOrWhiteSpace(value) ? "—" : value, FontSize = 11,
                FontWeight = FontWeights.SemiBold, Foreground = ink, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 0) });
            return new Border { MinWidth = minWidth, MaxWidth = 310, Background = soft, BorderBrush = new SolidColorBrush(Color.FromRgb(220, 226, 234)),
                BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(8), Padding = new Thickness(10), Margin = new Thickness(0, 0, 8, 8), Child = stack };
        }

        var facts = new WrapPanel { Width = 640, FlowDirection = FlowDirection.RightToLeft, Margin = new Thickness(0, 0, 0, 14) };
        facts.Children.Add(InfoCard("طرف حساب", invoice.CustomerName, 240));
        facts.Children.Add(InfoCard("شماره فاکتور مرجع", invoice.DisplayNumber, 160));
        facts.Children.Add(InfoCard("روش تسویه", payment.Method, 150));
        facts.Children.Add(InfoCard("شماره / مرجع عملیات", receiptNumber, 220));
        facts.Children.Add(InfoCard("تاریخ فاکتور", FormatPersianDate(invoice.CreatedAt), 160));
        if (invoice.DueDate is DateTimeOffset dueDate)
            facts.Children.Add(InfoCard("سررسید فاکتور", FormatPersianDate(dueDate), 160));
        document.Blocks.Add(new BlockUIContainer(facts));

        var amountPanel = new StackPanel { FlowDirection = FlowDirection.RightToLeft, HorizontalAlignment = HorizontalAlignment.Stretch };
        amountPanel.Children.Add(new TextBlock { Text = "مبلغ ثبت‌شده در رسید", FontSize = 11, Foreground = muted, TextAlignment = TextAlignment.Center });
        amountPanel.Children.Add(new TextBlock { Text = $"{payment.Amount.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))} {currency}",
            FontSize = 30, FontWeight = FontWeights.Bold, Foreground = accent, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 5, 0, 3) });
        amountPanel.Children.Add(new TextBlock { Text = payment.Method == "چک"
                ? "ثبت محلی چک؛ این رسید به‌تنهایی تأیید یا وصول بانکی را اثبات نمی‌کند."
                : "رسید داخلی سامانهٔ حسابداری اشک قلم",
            FontSize = 9, Foreground = muted, TextAlignment = TextAlignment.Center, TextWrapping = TextWrapping.Wrap });
        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 640, Background = soft, BorderBrush = accent, BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14), Padding = new Thickness(18), Margin = new Thickness(0, 0, 0, 16), Child = amountPanel
        }));

        if (!string.IsNullOrWhiteSpace(payment.Reference) && !string.Equals(payment.Reference, receiptNumber, StringComparison.Ordinal))
            document.Blocks.Add(new Paragraph(new Run("توضیحات / شماره پیگیری: " + payment.Reference))
            { Foreground = ink, Margin = new Thickness(0, 0, 0, 10) });

        document.Blocks.Add(new Paragraph(new Run(
            $"وضعیت فاکتور: {invoice.Status}    •    مبلغ کل فاکتور: {invoice.Total.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))} {currency}"))
        { Foreground = muted, TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 0, 0, 20) });

        document.Blocks.Add(new Paragraph(new Run(
            "ثبت‌کننده: ....................................       تحویل‌دهنده / پرداخت‌کننده: ....................................       مهر و امضا: ...................................."))
        { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 24, 0, 0), Padding = new Thickness(0, 12, 0, 12) });

        document.Blocks.Add(new Paragraph(new Run("این رسید بر مبنای عملیات محلی ثبت‌شده در نسخهٔ بومی تهیه شده است."))
        { FontSize = 9, Foreground = muted, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 20, 0, 0) });

        foreach (var check in relatedChecks.Where(item =>
                     !string.IsNullOrWhiteSpace(item.ImageDataBase64) ||
                     !string.IsNullOrWhiteSpace(item.ImagePath)))
        {
            var image = CreateCompanyImage(check.ImageDataBase64, 460, 280, check.ImagePath);
            if (image is null) continue;
            var attachment = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            attachment.Children.Add(new TextBlock
            {
                Text = $"تصویر چک پیوست — شماره {check.CheckNumber}، بانک {check.BankName}، مبلغ {NumericTextBoxFormatter.Format(check.Amount)} {currency}",
                FontSize = 11, FontWeight = FontWeights.SemiBold, Foreground = ink,
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8)
            });
            attachment.Children.Add(new Border
            {
                Background = Brushes.White, BorderBrush = accent, BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8), Padding = new Thickness(8), Child = image
            });
            document.Blocks.Add(new BlockUIContainer(new Border
            {
                Width = 640, Background = soft, BorderBrush = accent, BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8), Padding = new Thickness(12), Margin = new Thickness(0, 0, 0, 14),
                Child = attachment
            }));
        }
        return document;
    }

    private static Image? CreateCompanyImage(string? encoded, double width, double height, string? filePath = null)
    {
        if (string.IsNullOrWhiteSpace(encoded) && (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))) return null;
        try
        {
            var bytes = !string.IsNullOrWhiteSpace(encoded) ? Convert.FromBase64String(encoded) : File.ReadAllBytes(filePath!);
            using var stream = new MemoryStream(bytes);
            var bitmap = new System.Windows.Media.Imaging.BitmapImage();
            bitmap.BeginInit(); bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream; bitmap.DecodePixelWidth = (int)Math.Max(width * 2, 100); bitmap.EndInit(); bitmap.Freeze();
            return new Image { Source = bitmap, Width = width, Height = height, Stretch = Stretch.Uniform };
        }
        catch { return null; }
    }

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private void Print_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new PrintDialog();
            if (dialog.ShowDialog() == true)
                dialog.PrintDocument(((IDocumentPaginatorSource)_document).DocumentPaginator, $"AshkeGhalam-Receipt-{_payment.Id}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ رسید", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}
