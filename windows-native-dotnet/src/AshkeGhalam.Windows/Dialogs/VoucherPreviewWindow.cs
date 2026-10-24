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

public sealed class VoucherPreviewWindow : Window
{
    private readonly FlowDocument _document;
    private readonly VoucherRecord _voucher;
    public VoucherPreviewWindow(Window owner, VoucherRecord voucher, CompanyProfileRecord? company)
    {
        _voucher = voucher ?? throw new ArgumentNullException(nameof(voucher));
        Owner = owner; Title = voucher.Number > 0
            ? $"پیش‌نمایش حواله {voucher.Number:N0}"
            : "پیش‌نمایش حواله پیش از ثبت";
        Width = 1000; Height = 800; MinWidth = 760; MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));
        _document = BuildDocument(voucher, company);
        var root = new Grid { Margin = new Thickness(14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0, 0, 0, 10) };
        toolbar.Children.Add(new TextBlock { Text = $"پیش‌نمایش حوالهٔ {voucher.Number:N0}", FontSize = 22,
            FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)), VerticalAlignment = VerticalAlignment.Center });
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var print = new Button { Content = "چاپ حواله", MinWidth = 110, Height = 36, Margin = new Thickness(0, 0, 8, 0) };
        print.Click += Print_Click; buttons.Children.Add(print);
        buttons.Children.Add(new Button { Content = "بستن", MinWidth = 90, Height = 36, IsCancel = true });
        DockPanel.SetDock(buttons, Dock.Left); toolbar.Children.Add(buttons);
        var paper = new Border
        {
            Background = Brushes.White, BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(10), Padding = new Thickness(8),
            Child = new FlowDocumentScrollViewer { Document = _document, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, IsToolBarVisible = true, Background = Brushes.White, Padding = new Thickness(12) }
        };
        Grid.SetRow(paper, 1); root.Children.Add(toolbar); root.Children.Add(paper); Content = root;
    }

    private static FlowDocument BuildDocument(VoucherRecord voucher, CompanyProfileRecord? company)
    {
        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var soft = new SolidColorBrush(Color.FromRgb(231, 248, 244));
        var ink = new SolidColorBrush(Color.FromRgb(30, 41, 59));
        var document = new FlowDocument { FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"), FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft, PagePadding = new Thickness(28), ColumnWidth = 760,
            Background = Brushes.White, Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59)) };
        var numberLabel = voucher.Number > 0 ? voucher.Number.ToString("N0", CultureInfo.GetCultureInfo("fa-IR")) : "پس از ثبت تعیین می‌شود";
        var trackingLabel = string.IsNullOrWhiteSpace(voucher.TrackingCode) ? "پس از ثبت تولید می‌شود" : voucher.TrackingCode;
        var companyName = string.IsNullOrWhiteSpace(company?.LegalName) ? company?.Name ?? "اشک قلم" : company.LegalName;

        var headerGrid = new Grid { Width = 624, FlowDirection = FlowDirection.RightToLeft };
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var headerText = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 14, 0) };
        headerText.Children.Add(new TextBlock
        {
            Text = "حواله / رسید انبار",
            FontSize = 25,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            TextWrapping = TextWrapping.Wrap
        });
        headerText.Children.Add(new TextBlock
        {
            Text = companyName,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 3, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        headerText.Children.Add(new TextBlock
        {
            Text = $"شماره سند: {numberLabel}   •   کد پیگیری: {trackingLabel}",
            FontSize = 10,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 7, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        Grid.SetColumn(headerText, 0);
        headerGrid.Children.Add(headerText);
        var logo = CreateImage(company?.LogoDataBase64, 92, 72);
        if (logo is not null)
        {
            logo.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(logo, 1);
            headerGrid.Children.Add(logo);
        }
        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 660,
            Background = accent,
            BorderBrush = accent,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Padding = new Thickness(18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = headerGrid
        }));

        if (company is not null &&
            (!string.IsNullOrWhiteSpace(company.Phone) ||
             !string.IsNullOrWhiteSpace(company.Address) ||
             !string.IsNullOrWhiteSpace(company.NationalId) ||
             !string.IsNullOrWhiteSpace(company.TaxId)))
        {
            var companyFacts = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            var contact = string.Join("   •   ", new[]
            {
                string.IsNullOrWhiteSpace(company.Branch) ? "" : "شعبه: " + company.Branch,
                string.IsNullOrWhiteSpace(company.Phone) ? "" : "تلفن: " + company.Phone,
                string.IsNullOrWhiteSpace(company.Address) ? "" : "نشانی: " + company.Address
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
            if (!string.IsNullOrWhiteSpace(contact))
                companyFacts.Children.Add(new TextBlock { Text = contact, FontSize = 10, Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59)), TextWrapping = TextWrapping.Wrap });
            var ids = string.Join("   •   ", new[]
            {
                string.IsNullOrWhiteSpace(company.NationalId) ? "" : "شناسه ملی: " + company.NationalId,
                string.IsNullOrWhiteSpace(company.TaxId) ? "" : "شناسه مالیاتی: " + company.TaxId
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
            if (!string.IsNullOrWhiteSpace(ids))
                companyFacts.Children.Add(new TextBlock { Text = ids, FontSize = 9, Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)), Margin = new Thickness(0, 3, 0, 0), TextWrapping = TextWrapping.Wrap });
            document.Blocks.Add(new BlockUIContainer(new Border
            {
                Width = 660, Background = soft, BorderBrush = accent,
                BorderThickness = new Thickness(0, 0, 4, 0), CornerRadius = new CornerRadius(8),
                Padding = new Thickness(12), Margin = new Thickness(0, 0, 0, 12), Child = companyFacts
            }));
        }

        Border InfoCard(string label, string value, double minWidth = 190)
        {
            var stack = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
            stack.Children.Add(new TextBlock { Text = label, FontSize = 9, FontWeight = FontWeights.SemiBold, Foreground = accent });
            stack.Children.Add(new TextBlock { Text = string.IsNullOrWhiteSpace(value) ? "—" : value,
                FontSize = 11, FontWeight = FontWeights.SemiBold, Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 0) });
            return new Border { MinWidth = minWidth, MaxWidth = 310, Background = soft,
                BorderBrush = new SolidColorBrush(Color.FromRgb(220, 226, 234)), BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8), Padding = new Thickness(10), Margin = new Thickness(0, 0, 8, 8), Child = stack };
        }

        var facts = new WrapPanel { Width = 660, FlowDirection = FlowDirection.RightToLeft, Margin = new Thickness(0, 0, 0, 10) };
        facts.Children.Add(InfoCard("تاریخ شمسی", FormatPersianDate(voucher.Date), 140));
        facts.Children.Add(InfoCard("وضعیت سند", StatusLabel(voucher.Status), 140));
        facts.Children.Add(InfoCard("نوع سند", TypeLabel(voucher.Type), 160));
        facts.Children.Add(InfoCard("نوع گردش", MovementLabel(voucher.MovementType), 190));
        facts.Children.Add(InfoCard("طرف حساب", voucher.PersonName, 220));
        facts.Children.Add(InfoCard("فاکتور مرتبط", voucher.RelatedInvoiceId, 220));
        if (!string.IsNullOrWhiteSpace(voucher.VehicleNumber) || !string.IsNullOrWhiteSpace(voucher.Supervisor) || !string.IsNullOrWhiteSpace(voucher.ReceiverPhone))
            facts.Children.Add(InfoCard("حمل و تحویل", $"خودرو: {voucher.VehicleNumber}   •   مسئول: {voucher.Supervisor}   •   تلفن: {voucher.ReceiverPhone}", 300));
        if (!string.IsNullOrWhiteSpace(voucher.ReturnReason))
            facts.Children.Add(InfoCard("علت برگشت", voucher.ReturnReason, 300));
        if (!string.IsNullOrWhiteSpace(voucher.Notes))
            facts.Children.Add(InfoCard("توضیحات", voucher.Notes, 300));
        document.Blocks.Add(new BlockUIContainer(facts));

        var table = new Table { CellSpacing = 0, Margin = new Thickness(0, 2, 0, 10) };
        for (var i = 0; i < 4; i++) table.Columns.Add(new TableColumn { Width = new GridLength(1, GridUnitType.Star) });
        var group = new TableRowGroup();
        var header = new TableRow();
        foreach (var label in new[] { "نام کالا", "مقدار", "واحد", "شرح / قفسه" })
            header.Cells.Add(new TableCell(new Paragraph(new Run(label))) { FontWeight = FontWeights.Bold, Background = soft,
                Foreground = accent, Padding = new Thickness(7), BorderBrush = accent, BorderThickness = new Thickness(0.5) });
        group.Rows.Add(header);
        var voucherRowIndex = 0;
        foreach (var item in voucher.Items)
        {
            var row = new TableRow();
            var background = voucherRowIndex % 2 == 0 ? Brushes.White : soft;
            var nameCell = new TableCell
            {
                Padding = new Thickness(6), Background = background,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(0.5)
            };
            nameCell.Blocks.Add(new BlockUIContainer(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(item.ProductName) ? "—" : item.ProductName,
                FontWeight = FontWeights.SemiBold, FontSize = 9.5, TextWrapping = TextWrapping.Wrap, Foreground = ink
            }));
            row.Cells.Add(nameCell);

            row.Cells.Add(new TableCell(new Paragraph(new Run(item.Quantity.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")))) { Margin = new Thickness(0), TextAlignment = TextAlignment.Right })
            {
                Padding = new Thickness(6), Background = background,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(0.5), FontSize = 9
            });
            row.Cells.Add(new TableCell(new Paragraph(new Run(string.IsNullOrWhiteSpace(item.Unit) ? "—" : item.Unit)) { Margin = new Thickness(0), TextAlignment = TextAlignment.Right })
            {
                Padding = new Thickness(6), Background = background,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(0.5), FontSize = 9
            });

            var description = string.Join(" / ", new[] { item.Description, item.ShelfLocation }
                .Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value.Trim()));
            var descriptionCell = new TableCell
            {
                Padding = new Thickness(6), Background = background,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(0.5), FontSize = 9
            };
            if (!string.IsNullOrWhiteSpace(description))
                descriptionCell.Blocks.Add(new BlockUIContainer(new Border
                {
                    Background = soft, BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                    BorderThickness = new Thickness(0.7), CornerRadius = new CornerRadius(3),
                    Padding = new Thickness(4, 3, 4, 3),
                    Child = new TextBlock { Text = description, TextWrapping = TextWrapping.Wrap, FontSize = 8.5, Foreground = ink }
                }));
            else
                descriptionCell.Blocks.Add(new Paragraph(new Run("—")) { Margin = new Thickness(0) });
            row.Cells.Add(descriptionCell);
            voucherRowIndex++;
            group.Rows.Add(row);
        }
        table.RowGroups.Add(group);
        document.Blocks.Add(table);
        var totals = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
        totals.Children.Add(new TextBlock { Text = $"جمع تعداد اقلام: {voucher.Items.Sum(item => item.Quantity).ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}",
            FontSize = 13, FontWeight = FontWeights.Bold, Foreground = accent, Margin = new Thickness(0, 0, 0, 5) });
        totals.Children.Add(new TextBlock { Text = $"وزن تخمینی: {voucher.TotalWeight.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}    •    ارزش تخمینی: {voucher.EstimatedValue.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}",
            FontSize = 12, FontWeight = FontWeights.SemiBold, Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59)), TextWrapping = TextWrapping.Wrap });
        document.Blocks.Add(new BlockUIContainer(new Border { Width = 660, Background = soft, BorderBrush = accent,
            BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(10), Padding = new Thickness(14),
            Margin = new Thickness(0, 14, 0, 4), Child = totals }));
        try
        {
            var payload = string.IsNullOrWhiteSpace(voucher.QrCode)
                ? $"ASHKEGHALAM|VOUCHER|{voucher.TrackingCode}|DATE|{FormatPersianDate(voucher.Date)}|ITEMS|{voucher.Items.Count}|QTY|{voucher.Items.Sum(item => item.Quantity).ToString(CultureInfo.InvariantCulture)}"
                : voucher.QrCode;
            var qr = CreateQrImage(payload);
            document.Blocks.Add(new BlockUIContainer(new StackPanel { HorizontalAlignment = HorizontalAlignment.Center,
                Children = { qr, new TextBlock { Text = "QR حواله / کد پیگیری", TextAlignment = TextAlignment.Center, FontSize = 9 } } }));
        }
        catch (Exception) { document.Blocks.Add(new Paragraph(new Run("تولید QR این حواله انجام نشد.")) { Foreground = Brushes.DarkRed }); }

        var marks = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center,
            FlowDirection = FlowDirection.RightToLeft, Margin = new Thickness(0, 18, 0, 4) };
        var signature = CreateImage(company?.SignatureDataBase64, 125, 58);
        if (signature is not null) marks.Children.Add(new StackPanel { Margin = new Thickness(12, 0, 12, 0),
            Children = { signature, new TextBlock { Text = "امضای شرکت", FontSize = 9, TextAlignment = TextAlignment.Center } } });
        var stamp = CreateImage(company?.StampDataBase64, 80, 80);
        if (stamp is not null) marks.Children.Add(new StackPanel { Margin = new Thickness(12, 0, 12, 0),
            Children = { stamp, new TextBlock { Text = "مهر شرکت", FontSize = 9, TextAlignment = TextAlignment.Center } } });
        if (marks.Children.Count > 0) document.Blocks.Add(new BlockUIContainer(marks));
        document.Blocks.Add(new Paragraph(new Run("تحویل‌دهنده: ................................     تحویل‌گیرنده: ................................     تأیید مسئول: ................................"))
        { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 20, 0, 0) });
        PrintBrandingService.AppendWebsiteFooter(document, 660);
        return document;
    }

    private static Image? CreateImage(string? encoded, double width, double height)
    {
        if (string.IsNullOrWhiteSpace(encoded)) return null;
        try { using var stream = new MemoryStream(Convert.FromBase64String(encoded));
            var bitmap = new BitmapImage(); bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream; bitmap.DecodePixelWidth = (int)Math.Max(width * 2, 100); bitmap.EndInit(); bitmap.Freeze();
            return new Image { Source = bitmap, Width = width, Height = height, Stretch = Stretch.Uniform }; }
        catch { return null; }
    }
    private static Image CreateQrImage(string payload)
    {
        using var generator = new QRCodeGenerator(); using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        using var stream = new MemoryStream(new PngByteQRCode(data).GetGraphic(6));
        var bitmap = new BitmapImage(); bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad;
        bitmap.StreamSource = stream; bitmap.EndInit(); bitmap.Freeze();
        return new Image { Source = bitmap, Width = 122, Height = 122, Stretch = Stretch.Uniform };
    }
    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}", calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }
    private static string TypeLabel(string value) => value switch { "IN" => "ورود کالا", "OUT" => "خروج کالا", "RETURN" => "برگشت کالا", _ => value };
    private static string MovementLabel(string value) => value switch
    {
        "GOODS_RECEIPT" => "رسید ورود کالا", "GOODS_ISSUE" => "حواله خروج کالا", "INVENTORY_ADJUSTMENT" => "تعدیل موجودی",
        "PRODUCTION_CONSUMPTION" => "مصرف تولید", "PRODUCTION_OUTPUT" => "خروجی تولید", "RETURN_RECEIPT" => "برگشت از فروش", "RETURN_ISSUE" => "برگشت از خرید", _ => value
    };
    private static string StatusLabel(string value) => value switch { "PENDING" => "در انتظار", "IN_TRANSIT" => "در مسیر", "DELIVERED" => "تحویل‌شده", _ => value };
    private void Print_Click(object sender, RoutedEventArgs e)
    {
        try { var dialog = new PrintDialog(); if (dialog.ShowDialog() != true) return;
            dialog.PrintDocument(((IDocumentPaginatorSource)_document).DocumentPaginator, $"AshkeGhalam-Voucher-{_voucher.Number}"); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "چاپ حواله", MessageBoxButton.OK, MessageBoxImage.Error); }
    }
}
