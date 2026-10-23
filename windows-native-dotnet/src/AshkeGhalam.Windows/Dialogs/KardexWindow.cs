using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using Microsoft.Win32;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class KardexWindow : Window
{
    private sealed record KardexRow(string Date, string Movement, string Document, string Description, decimal Incoming, decimal Outgoing, decimal Balance);

    public KardexWindow(Window owner, ProductRecord product, IReadOnlyList<InventoryMovementRecord> movements,
        IReadOnlyList<InvoiceRecord> invoices, IReadOnlyList<VoucherRecord> vouchers)
    {
        Owner = owner;
        Title = $"کارتکس کالا — {product.Name}";
        Width = 1160;
        Height = 760;
        MinWidth = 860;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var history = movements.Where(item => item.ProductId == product.Id)
            .OrderBy(item => item.Date).ThenBy(item => item.Timestamp).ToList();
        var openingBalance = product.StockQuantity - history.Sum(item => item.SignedQuantity);
        var balance = openingBalance;
        var rows = new List<KardexRow>
        {
            new("—", "ماندهٔ ابتدای گردش", "—", "موجودی پایه استخراج‌شده از سوابق ذخیره‌شده", 0m, 0m, balance)
        };
        foreach (var movement in history)
        {
            balance += movement.SignedQuantity;
            var reference = string.IsNullOrWhiteSpace(movement.ReferenceId) ? movement.VoucherId : movement.ReferenceId;
            var document = movement.ReferenceType == "INVOICE"
                ? invoices.FirstOrDefault(item => item.Id == reference)?.DisplayNumber ?? reference
                : vouchers.FirstOrDefault(item => item.Id == reference)?.TrackingCode ?? reference;
            rows.Add(new KardexRow(FormatPersianDate(movement.Date), MovementLabel(movement.MovementType), document,
                movement.Description, Math.Max(0m, movement.SignedQuantity),
                Math.Abs(Math.Min(0m, movement.SignedQuantity)), balance));
        }

        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var soft = new SolidColorBrush(Color.FromRgb(231, 248, 244));
        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var muted = new SolidColorBrush(Color.FromRgb(71, 85, 105));

        var root = new DockPanel { Margin = new Thickness(16), LastChildFill = true };
        var headerContent = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
        headerContent.Children.Add(new TextBlock
        {
            Text = "کارتکس / گردش ریز موجودی کالا",
            FontSize = 23,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White
        });
        headerContent.Children.Add(new TextBlock
        {
            Text = $"{product.Name}   •   کد: {product.Code}   •   سریال: {product.SerialNumber}",
            FontSize = 12,
            Foreground = Brushes.White,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 5, 0, 0)
        });
        DockPanel.SetDock(new Border
        {
            Background = accent,
            BorderBrush = accent,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = headerContent
        }, Dock.Top);
        var hero = new Border
        {
            Background = accent,
            BorderBrush = accent,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = headerContent
        };
        DockPanel.SetDock(hero, Dock.Top);
        root.Children.Add(hero);

        var summary = new WrapPanel { FlowDirection = FlowDirection.RightToLeft, Margin = new Thickness(0, 0, 0, 10) };
        AddMetric(summary, "موجودی فعلی", $"{product.StockQuantity.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))} {product.Unit}", accent, ink, soft);
        AddMetric(summary, "ورودی ثبت‌شده", history.Where(item => item.SignedQuantity > 0).Sum(item => item.SignedQuantity).ToString("N2", CultureInfo.GetCultureInfo("fa-IR")), accent, ink, soft);
        AddMetric(summary, "خروجی ثبت‌شده", Math.Abs(history.Where(item => item.SignedQuantity < 0).Sum(item => item.SignedQuantity)).ToString("N2", CultureInfo.GetCultureInfo("fa-IR")), accent, ink, soft);
        AddMetric(summary, "ردیف‌های گردش", history.Count.ToString("N0", CultureInfo.GetCultureInfo("fa-IR")), accent, ink, soft);
        DockPanel.SetDock(summary, Dock.Top);
        root.Children.Add(summary);

        var grid = new DataGrid
        {
            ItemsSource = rows,
            AutoGenerateColumns = false,
            IsReadOnly = true,
            CanUserSortColumns = true,
            CanUserResizeColumns = true,
            HeadersVisibility = DataGridHeadersVisibility.Column,
            GridLinesVisibility = DataGridGridLinesVisibility.Horizontal,
            RowHeight = 36,
            ColumnHeaderHeight = 42,
            AlternationCount = 2,
            RowBackground = Brushes.White,
            AlternatingRowBackground = soft,
            Background = Brushes.White,
            Foreground = ink,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn"),
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        grid.Columns.Add(new DataGridTextColumn { Header = "تاریخ شمسی", Binding = new Binding(nameof(KardexRow.Date)), Width = 115 });
        grid.Columns.Add(new DataGridTextColumn { Header = "نوع گردش", Binding = new Binding(nameof(KardexRow.Movement)), Width = 160 });
        grid.Columns.Add(new DataGridTextColumn { Header = "سند مرجع", Binding = new Binding(nameof(KardexRow.Document)), Width = 170 });
        grid.Columns.Add(new DataGridTextColumn { Header = "شرح گردش", Binding = new Binding(nameof(KardexRow.Description)), Width = new DataGridLength(1, DataGridLengthUnitType.Star) });
        grid.Columns.Add(new DataGridTextColumn { Header = "ورودی", Binding = new Binding(nameof(KardexRow.Incoming)) { StringFormat = "N2" }, Width = 110 });
        grid.Columns.Add(new DataGridTextColumn { Header = "خروجی", Binding = new Binding(nameof(KardexRow.Outgoing)) { StringFormat = "N2" }, Width = 110 });
        grid.Columns.Add(new DataGridTextColumn { Header = "مانده", Binding = new Binding(nameof(KardexRow.Balance)) { StringFormat = "N2" }, Width = 120 });

        var headerStyle = new Style(typeof(DataGridColumnHeader));
        headerStyle.Setters.Add(new Setter(Control.BackgroundProperty, accent));
        headerStyle.Setters.Add(new Setter(Control.ForegroundProperty, Brushes.White));
        headerStyle.Setters.Add(new Setter(Control.FontWeightProperty, FontWeights.Bold));
        headerStyle.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(8, 6, 8, 6)));
        grid.ColumnHeaderStyle = headerStyle;

        var footer = new DockPanel { Margin = new Thickness(0, 12, 0, 0), LastChildFill = true };
        var note = new TextBlock
        {
            Text = $"ماندهٔ ابتدای گردش: {openingBalance.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))} {product.Unit}   •   ردیف «ماندهٔ ابتدای گردش» محاسبهٔ پایه از موجودی فعلی و مجموع حرکات ذخیره‌شده است.",
            FontSize = 10,
            Foreground = muted,
            TextWrapping = TextWrapping.Wrap,
            VerticalAlignment = VerticalAlignment.Center
        };
        footer.Children.Add(note);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var print = new Button { Content = "چاپ کارتکس", MinWidth = 100, Height = 36, Margin = new Thickness(0, 0, 8, 0), Background = accent, Foreground = Brushes.White };
        print.Click += (_, _) =>
        {
            try
            {
                var dialog = new PrintDialog();
                if (dialog.ShowDialog() == true)
                    dialog.PrintVisual(grid, $"AshkeGhalam-ProductKardex-{product.Code}");
            }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "چاپ کارتکس", MessageBoxButton.OK, MessageBoxImage.Error); }
        };
        actions.Children.Add(print);
        var export = new Button { Content = "خروجی CSV", MinWidth = 100, Height = 36, Margin = new Thickness(0, 0, 8, 0) };
        export.Click += (_, _) => ExportRows(rows, product);
        actions.Children.Add(export);
        actions.Children.Add(new Button { Content = "بستن", MinWidth = 82, Height = 36, IsCancel = true });
        DockPanel.SetDock(actions, Dock.Left);
        footer.Children.Add(actions);
        DockPanel.SetDock(footer, Dock.Bottom);
        root.Children.Add(footer);

        root.Children.Add(grid);
        Content = root;
    }

    private static void AddMetric(Panel parent, string label, string value, Brush accent, Brush ink, Brush soft)
    {
        var stack = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
        stack.Children.Add(new TextBlock { Text = label, FontSize = 10, Foreground = accent, FontWeight = FontWeights.SemiBold });
        stack.Children.Add(new TextBlock { Text = value, FontSize = 15, Foreground = ink, FontWeight = FontWeights.Bold, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0) });
        parent.Children.Add(new Border
        {
            MinWidth = 135,
            MaxWidth = 260,
            Background = soft,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10),
            Margin = new Thickness(0, 0, 8, 8),
            Child = stack
        });
    }

    private static void ExportRows(IReadOnlyList<KardexRow> rows, ProductRecord product)
    {
        var dialog = new SaveFileDialog
        {
            Title = "ذخیره کاردکس کالا",
            FileName = $"کاردکس-{product.Code}.csv",
            Filter = "CSV UTF-8 (*.csv)|*.csv",
            AddExtension = true,
            DefaultExt = ".csv"
        };
        if (dialog.ShowDialog() != true) return;
        try
        {
            static string Csv(string value) => "\"" + value.Replace("\"", "\"\"") + "\"";
            var builder = new StringBuilder();
            builder.AppendLine("Date,Movement,Document,Description,Incoming,Outgoing,Balance");
            foreach (var row in rows)
                builder.AppendLine(string.Join(",", new[]
                {
                    Csv(row.Date), Csv(row.Movement), Csv(row.Document), Csv(row.Description),
                    row.Incoming.ToString(CultureInfo.InvariantCulture),
                    row.Outgoing.ToString(CultureInfo.InvariantCulture),
                    row.Balance.ToString(CultureInfo.InvariantCulture)
                }));
            File.WriteAllText(dialog.FileName, builder.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        }
        catch (Exception ex) { MessageBox.Show(ex.Message, "خروجی کاردکس", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}", calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private static string MovementLabel(string value) => value switch
    {
        "GOODS_RECEIPT" => "رسید ورود کالا",
        "GOODS_ISSUE" => "حواله خروج کالا",
        "INVENTORY_ADJUSTMENT" => "تعدیل موجودی",
        "PRODUCTION_CONSUMPTION" => "مصرف تولید",
        "PRODUCTION_OUTPUT" => "خروجی تولید",
        "RETURN_RECEIPT" => "برگشت از فروش",
        "RETURN_ISSUE" => "برگشت از خرید",
        "INTERNAL_TRANSFER" => "انتقال بین انبار",
        _ => value
    };
}
