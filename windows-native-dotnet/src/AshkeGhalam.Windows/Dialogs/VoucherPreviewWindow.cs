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

public sealed class VoucherPreviewWindow : Window
{
    private readonly FlowDocument _document;
    private readonly VoucherRecord _voucher;
    public VoucherPreviewWindow(Window owner, VoucherRecord voucher, CompanyProfileRecord? company)
    {
        _voucher = voucher ?? throw new ArgumentNullException(nameof(voucher));
        Owner = owner; Title = $"پیش‌نمایش حواله {voucher.Number:N0}";
        Width = 1000; Height = 800; MinWidth = 760; MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("Vazirmatn, Tahoma, Segoe UI");
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
        var document = new FlowDocument { FontFamily = new FontFamily("Vazirmatn, Tahoma, Segoe UI"), FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft, PagePadding = new Thickness(28), ColumnWidth = 760,
            Background = Brushes.White, Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59)) };
        var logo = CreateImage(company?.LogoDataBase64, 112, 82);
        if (logo is not null) document.Blocks.Add(new BlockUIContainer(new Border { Child = logo, HorizontalAlignment = HorizontalAlignment.Center,
            Padding = new Thickness(4), Margin = new Thickness(0, 0, 0, 8) }));
        document.Blocks.Add(new Paragraph(new Run(string.IsNullOrWhiteSpace(company?.LegalName) ? company?.Name ?? "اشک قلم" : company.LegalName))
        { FontSize = 22, FontWeight = FontWeights.Bold, Foreground = accent, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 0, 0, 4) });
        document.Blocks.Add(new Paragraph(new Run($"حواله / رسید انبار — شماره {voucher.Number:N0}"))
        { FontSize = 17, FontWeight = FontWeights.Bold, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 0, 0, 10) });
        document.Blocks.Add(new Paragraph(new Run($"کد پیگیری: {voucher.TrackingCode}    تاریخ: {FormatPersianDate(voucher.Date)}    وضعیت: {StatusLabel(voucher.Status)}")) { TextAlignment = TextAlignment.Right });
        document.Blocks.Add(new Paragraph(new Run($"نوع سند: {TypeLabel(voucher.Type)}    نوع گردش: {MovementLabel(voucher.MovementType)}")) { TextAlignment = TextAlignment.Right });
        document.Blocks.Add(new Paragraph(new Run($"طرف حساب: {(string.IsNullOrWhiteSpace(voucher.PersonName) ? "—" : voucher.PersonName)}    فاکتور مرتبط: {(string.IsNullOrWhiteSpace(voucher.RelatedInvoiceId) ? "—" : voucher.RelatedInvoiceId)}")) { TextAlignment = TextAlignment.Right });
        if (!string.IsNullOrWhiteSpace(voucher.VehicleNumber) || !string.IsNullOrWhiteSpace(voucher.Supervisor) || !string.IsNullOrWhiteSpace(voucher.ReceiverPhone))
            document.Blocks.Add(new Paragraph(new Run($"خودرو: {voucher.VehicleNumber}    مسئول: {voucher.Supervisor}    تلفن: {voucher.ReceiverPhone}")) { TextAlignment = TextAlignment.Right });
        if (!string.IsNullOrWhiteSpace(voucher.ReturnReason)) document.Blocks.Add(new Paragraph(new Run($"علت برگشت: {voucher.ReturnReason}")) { TextAlignment = TextAlignment.Right });
        if (!string.IsNullOrWhiteSpace(voucher.Notes)) document.Blocks.Add(new Paragraph(new Run($"توضیحات: {voucher.Notes}")) { TextAlignment = TextAlignment.Right });

        var table = new Table { CellSpacing = 0 };
        for (var i = 0; i < 4; i++) table.Columns.Add(new TableColumn { Width = new GridLength(1, GridUnitType.Star) });
        var group = new TableRowGroup();
        var header = new TableRow();
        foreach (var label in new[] { "نام کالا", "مقدار", "واحد", "شرح / قفسه" })
            header.Cells.Add(new TableCell(new Paragraph(new Run(label))) { FontWeight = FontWeights.Bold, Background = soft,
                Foreground = accent, Padding = new Thickness(7), BorderBrush = accent, BorderThickness = new Thickness(0.5) });
        group.Rows.Add(header);
        foreach (var item in voucher.Items)
        {
            var row = new TableRow();
            var values = new[] { item.ProductName, item.Quantity.ToString("N2", CultureInfo.GetCultureInfo("fa-IR")), item.Unit,
                string.Join(" / ", new[] { item.Description, item.ShelfLocation }.Where(value => !string.IsNullOrWhiteSpace(value))) };
            foreach (var value in values)
                row.Cells.Add(new TableCell(new Paragraph(new Run(value))) { Padding = new Thickness(7),
                    BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(0.5) });
            group.Rows.Add(row);
        }
        table.RowGroups.Add(group); document.Blocks.Add(table);
        document.Blocks.Add(new Paragraph(new Run($"جمع تعداد: {voucher.Items.Sum(item => item.Quantity).ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))}    وزن تخمینی: {voucher.TotalWeight.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))}    ارزش تخمینی: {voucher.EstimatedValue.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))}"))
        { FontSize = 14, FontWeight = FontWeights.Bold, Foreground = accent, TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 14, 0, 4) });
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
