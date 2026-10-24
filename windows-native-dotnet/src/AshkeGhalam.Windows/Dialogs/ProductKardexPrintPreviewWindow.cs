using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed record ProductKardexPrintRow(
    string Date, string Movement, string Document, string Description,
    decimal Incoming, decimal Outgoing, decimal Balance);

/// <summary>Paginated print preview for inventory movements of one product.</summary>
public sealed class ProductKardexPrintPreviewWindow : Window
{
    private readonly FlowDocument _document;
    private readonly string _productCode;

    public ProductKardexPrintPreviewWindow(
        Window owner,
        ProductRecord product,
        IReadOnlyList<ProductKardexPrintRow> rows,
        decimal openingBalance)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(rows);

        _productCode = product.Code;
        Owner = owner;
        Title = $"پیش‌نمایش چاپ کاردکس کالا — {product.Name}";
        Width = 1060;
        Height = 780;
        MinWidth = 760;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var muted = new SolidColorBrush(Color.FromRgb(71, 85, 105));
        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var soft = new SolidColorBrush(Color.FromRgb(248, 250, 252));
        var culture = CultureInfo.GetCultureInfo("fa-IR");
        var totalIncoming = rows.Sum(row => row.Incoming);
        var totalOutgoing = rows.Sum(row => row.Outgoing);

        _document = new FlowDocument
        {
            FontFamily = FontFamily,
            FontSize = 10,
            FlowDirection = FlowDirection.RightToLeft,
            Background = Brushes.White,
            Foreground = ink,
            PagePadding = new Thickness(28),
            PageWidth = 794,
            PageHeight = 1123,
            ColumnWidth = 738
        };
        _document.Blocks.Add(new Paragraph(new Run("کارتکس و گردش موجودی کالا"))
        {
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = accent,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 5)
        });
        var identity = $"کالا: {product.Name}    •    کد: {product.Code}";
        if (!string.IsNullOrWhiteSpace(product.SerialNumber))
            identity += $"    •    سریال: {product.SerialNumber}";
        _document.Blocks.Add(new Paragraph(new Run(identity))
        {
            FontSize = 10,
            Foreground = muted,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 12)
        });
        _document.Blocks.Add(new Paragraph(new Run(
            $"تاریخ گزارش: {FormatPersianDate(DateTimeOffset.Now)}    •    " +
            $"موجودی فعلی: {NumericTextBoxFormatter.Format(product.StockQuantity)} {product.Unit}    •    " +
            $"ماندهٔ ابتدای گردش: {NumericTextBoxFormatter.Format(openingBalance)} {product.Unit}"))
        {
            FontSize = 10,
            FontWeight = FontWeights.SemiBold,
            Foreground = ink,
            TextAlignment = TextAlignment.Right,
            Margin = new Thickness(0, 0, 0, 5)
        });
        _document.Blocks.Add(new Paragraph(new Run(
            $"مجموع ورود: {NumericTextBoxFormatter.Format(totalIncoming)} {product.Unit}    •    " +
            $"مجموع خروج: {NumericTextBoxFormatter.Format(totalOutgoing)} {product.Unit}    •    " +
            $"ردیف‌های گزارش: {rows.Count.ToString("N0", culture)}"))
        {
            FontSize = 9,
            Foreground = muted,
            TextAlignment = TextAlignment.Right,
            Margin = new Thickness(0, 0, 0, 12)
        });

        var table = new Table { CellSpacing = 0, Margin = new Thickness(0, 2, 0, 8) };
        foreach (var width in new[] { 1.0, 1.25, 1.2, 2.5, 1.05, 1.05, 1.15 })
            table.Columns.Add(new TableColumn { Width = new GridLength(width, GridUnitType.Star) });

        var headerGroup = new TableRowGroup();
        var header = new TableRow
        {
            Background = accent,
            Foreground = Brushes.White,
            FontWeight = FontWeights.Bold
        };
        foreach (var label in new[] { "تاریخ", "نوع گردش", "سند مرجع", "شرح گردش", "ورودی", "خروجی", "مانده" })
            header.Cells.Add(CreateCell(label, Brushes.White, accent, true));
        headerGroup.Rows.Add(header);
        table.RowGroups.Add(headerGroup);

        var body = new TableRowGroup();
        foreach (var rowData in rows)
        {
            var alternate = body.Rows.Count % 2 == 1;
            var background = alternate ? soft : Brushes.White;
            var row = new TableRow();
            var values = new[]
            {
                rowData.Date, rowData.Movement, rowData.Document, rowData.Description,
                NumericTextBoxFormatter.Format(rowData.Incoming),
                NumericTextBoxFormatter.Format(rowData.Outgoing),
                NumericTextBoxFormatter.Format(rowData.Balance)
            };
            for (var index = 0; index < values.Length; index++)
                row.Cells.Add(CreateCell(values[index], ink, background, false, numeric: index >= 4));
            body.Rows.Add(row);
        }
        table.RowGroups.Add(body);
        _document.Blocks.Add(table);
        PrintBrandingService.AppendWebsiteFooter(_document, 738);

        var root = new Grid { Margin = new Thickness(14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0) };
        toolbar.Children.Add(new TextBlock
        {
            Text = "پیش‌نمایش چاپ کاردکس کالا",
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            VerticalAlignment = VerticalAlignment.Center
        });
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left
        };
        var print = new Button
        {
            Content = "چاپ گزارش",
            MinWidth = 130,
            Height = 38,
            Margin = new Thickness(0, 0, 8, 0),
            Background = accent,
            Foreground = Brushes.White
        };
        print.Click += Print_Click;
        actions.Children.Add(print);
        actions.Children.Add(new Button { Content = "بستن", MinWidth = 90, Height = 38, IsCancel = true });
        DockPanel.SetDock(actions, Dock.Left);
        toolbar.Children.Add(actions);
        var toolbarFrame = PreviewChromeService.CreateToolbarFrame(toolbar);
        Grid.SetRow(toolbarFrame, 0);
        root.Children.Add(toolbarFrame);

        var viewer = new FlowDocumentScrollViewer
        {
            Document = _document,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            IsToolBarVisible = false,
            Background = Brushes.White,
            Padding = new Thickness(12)
        };
        Grid.SetRow(viewer, 1);
        root.Children.Add(viewer);
        Content = root;
    }

    private static TableCell CreateCell(string text, Brush foreground, Brush background, bool header, bool numeric = false)
    {
        var paragraph = new Paragraph(new Run(text))
        {
            Margin = new Thickness(0),
            TextAlignment = TextAlignment.Right,
            FlowDirection = numeric ? FlowDirection.LeftToRight : FlowDirection.RightToLeft
        };
        return new TableCell(paragraph)
        {
            Foreground = foreground,
            Background = background,
            Padding = new Thickness(7, 5, 7, 5),
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(0, 0, 0.5, 0.5),
            FontSize = header ? 9 : 8.5
        };
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
                dialog.PrintDocument(((IDocumentPaginatorSource)_document).DocumentPaginator,
                    $"AshkeGhalam-ProductKardex-{_productCode}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ کاردکس کالا", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}
