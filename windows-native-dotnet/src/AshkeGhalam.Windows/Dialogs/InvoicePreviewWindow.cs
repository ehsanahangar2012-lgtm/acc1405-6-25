using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoicePreviewWindow : Window
{
    private readonly InvoiceRecord _invoice;
    private readonly FlowDocument _document;

    public InvoicePreviewWindow(Window owner, InvoiceRecord invoice)
    {
        _invoice = invoice ?? throw new ArgumentNullException(nameof(invoice));
        Owner = owner;
        Title = $"پیش‌نمایش {invoice.TypeLabel} — {invoice.DisplayNumber}";
        Width = 1080;
        Height = 820;
        MinWidth = 760;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        _document = BuildDocument(invoice);
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
        paper.Child = viewer;
        Grid.SetRow(paper, 1);
        root.Children.Add(toolbar);
        root.Children.Add(paper);
        Content = root;
    }

    private static FlowDocument BuildDocument(InvoiceRecord invoice)
    {
        var document = new FlowDocument
        {
            FontFamily = new FontFamily("Segoe UI"),
            FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft,
            PagePadding = new Thickness(36),
            ColumnWidth = 760,
            Background = Brushes.White
        };

        document.Blocks.Add(new Paragraph(new Run($"اشک قلم — {invoice.TypeLabel}"))
        {
            FontSize = 25,
            FontWeight = FontWeights.Bold,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 18)
        });

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
            document.Blocks.Add(new Paragraph(new Run($"شناسه مالیاتی: {invoice.TaxId}")) { TextAlignment = TextAlignment.Right });
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
                Background = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                Padding = new Thickness(7),
                BorderBrush = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
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
            TextAlignment = TextAlignment.Left,
            Margin = new Thickness(0, 8, 0, 0)
        });
        document.Blocks.Add(new Paragraph(new Run(
            $"نقدی ثبت‌شده: {invoice.CashAmount.ToString("N2", CultureInfo.CurrentCulture)}    مبلغ چک: {invoice.CheckAmount.ToString("N2", CultureInfo.CurrentCulture)}"))
        { TextAlignment = TextAlignment.Left });
        document.Blocks.Add(new Paragraph(new Run($"وضعیت سند: {invoice.Status}"))
        { TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 14, 0, 0) });

        return document;
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
