using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

/// <summary>Paginated, printable preview of a complete person ledger report.</summary>
public sealed class PersonKardexPrintPreviewWindow : Window
{
    private readonly FlowDocument _document;
    private readonly string _personCode;

    public PersonKardexPrintPreviewWindow(Window owner, CustomerRecord person, PersonKardexReport report, string? currencyCode = "RIAL")
    {
        ArgumentNullException.ThrowIfNull(person);
        ArgumentNullException.ThrowIfNull(report);
        _personCode = person.Code;
        var currency = string.Equals(currencyCode, "TOMAN", StringComparison.OrdinalIgnoreCase) ? "تومان" : "ریال";
        Owner = owner;
        Title = $"پیش‌نمایش چاپ کاردکس اشخاص — {person.Name}";
        Width = 1060; Height = 780; MinWidth = 760; MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var muted = new SolidColorBrush(Color.FromRgb(71, 85, 105));
        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        _document = new FlowDocument
        {
            FontFamily = FontFamily, FontSize = 10, FlowDirection = FlowDirection.RightToLeft,
            Background = Brushes.White, Foreground = ink, PagePadding = new Thickness(28),
            PageWidth = 794, PageHeight = 1123, ColumnWidth = 738
        };
        _document.Blocks.Add(new Paragraph(new Run("کاردکس مالی اشخاص"))
        {
            FontSize = 22, FontWeight = FontWeights.Bold, Foreground = accent,
            TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 0, 0, 5)
        });
        _document.Blocks.Add(new Paragraph(new Run($"شخص: {person.Name}    •    کد: {person.Code}    •    گزارش در {FormatDate(DateTimeOffset.Now)}"))
        {
            FontSize = 10, Foreground = muted, TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 14)
        });
        var balanceType = report.ClosingBalance > 0m ? "بدهکار" : report.ClosingBalance < 0m ? "بستانکار" : "تسویه";
        _document.Blocks.Add(new Paragraph(new Run(
            $"ماندهٔ افتتاحیه: {NumericTextBoxFormatter.Format(report.OpeningBalance)} {currency}    •    " +
            $"جمع بدهکار: {NumericTextBoxFormatter.Format(report.TotalDebit)} {currency}    •    " +
            $"جمع بستانکار: {NumericTextBoxFormatter.Format(report.TotalCredit)} {currency}    •    " +
            $"ماندهٔ نهایی: {NumericTextBoxFormatter.Format(Math.Abs(report.ClosingBalance))} {currency} ({balanceType})"))
        {
            FontSize = 10, FontWeight = FontWeights.SemiBold, Foreground = ink,
            TextAlignment = TextAlignment.Right, Margin = new Thickness(0, 0, 0, 14)
        });

        var table = new Table { CellSpacing = 0 };
        foreach (var width in new[] { 1.0, 1.0, 1.0, 2.2, 1.1, 1.1, 1.1 })
            table.Columns.Add(new TableColumn { Width = new GridLength(width, GridUnitType.Star) });
        var headerGroup = new TableRowGroup();
        var headerRow = new TableRow { Background = accent, Foreground = Brushes.White, FontWeight = FontWeights.Bold };
        foreach (var label in new[] { "تاریخ", "نوع", "شماره", "شرح", "بدهکار", "بستانکار", "مانده" })
            headerRow.Cells.Add(CreateCell(label, Brushes.White, accent, true));
        headerGroup.Rows.Add(headerRow);
        table.RowGroups.Add(headerGroup);
        var body = new TableRowGroup();
        foreach (var entry in report.Rows)
        {
            var background = body.Rows.Count % 2 == 0 ? Brushes.White : new SolidColorBrush(Color.FromRgb(248, 250, 252));
            var row = new TableRow();
            var values = new[]
            {
                entry.Date, entry.Type, entry.Reference, entry.Description,
                NumericTextBoxFormatter.Format(entry.Debit), NumericTextBoxFormatter.Format(entry.Credit),
                NumericTextBoxFormatter.Format(entry.Balance)
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
        var toolbar = new StackPanel { Orientation = Orientation.Vertical, Margin = new Thickness(0) };
        toolbar.Children.Add(new TextBlock
        {
            Text = "پیش‌نمایش چاپ کاردکس اشخاص", FontSize = 20, FontWeight = FontWeights.Bold,
            Foreground = Brushes.White, VerticalAlignment = VerticalAlignment.Center
        });
        var actions = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 8, 0, 0) };
        var print = new Button { Content = "🖨 چاپ گزارش", MinWidth = 130, Height = 38, Margin = new Thickness(0, 0, 8, 0), Background = accent, Foreground = Brushes.White };
        print.Click += Print_Click;
        actions.Children.Add(print);
        DocumentExportService.AddSaveButtons(actions, this, () => _document, $"AshkeGhalam-PersonKardex-{_personCode}");
        actions.Children.Add(new Button { Content = "بستن", MinWidth = 90, Height = 38, IsCancel = true });
        toolbar.Children.Add(actions);
        var toolbarFrame = PreviewChromeService.CreateToolbarFrame(toolbar);
        Grid.SetRow(toolbarFrame, 0);
        root.Children.Add(toolbarFrame);
        var viewer = new FlowDocumentScrollViewer
        {
            Document = _document, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, IsToolBarVisible = false
        };
        actions.Children.Insert(0, PreviewChromeService.CreateZoomControls(viewer, () => _document.PageWidth));
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
            Foreground = foreground, Background = background, Padding = new Thickness(7, 5, 7, 5),
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(0, 0, 0.5, 0.5), FontSize = header ? 9 : 8.5
        };
    }

    private static string FormatDate(DateTimeOffset value)
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
                dialog.PrintDocument(((IDocumentPaginatorSource)_document).DocumentPaginator, $"AshkeGhalam-PersonKardex-{_personCode}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ کاردکس اشخاص", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}