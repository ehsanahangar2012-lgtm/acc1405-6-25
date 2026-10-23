using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class KardexWindow : Window
{
    private sealed record KardexRow(string Date, string Movement, string Document, string Description, decimal Incoming, decimal Outgoing, decimal Balance);
    public KardexWindow(Window owner, ProductRecord product, IReadOnlyList<InventoryMovementRecord> movements,
        IReadOnlyList<InvoiceRecord> invoices, IReadOnlyList<VoucherRecord> vouchers)
    {
        Owner = owner; Title = $"کارتکس کالا — {product.Name}";
        Width = 1120; Height = 720; MinWidth = 800; MinHeight = 520;
        WindowStartupLocation = WindowStartupLocation.CenterOwner; FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
        var history = movements.Where(item => item.ProductId == product.Id).OrderBy(item => item.Date).ThenBy(item => item.Timestamp).ToList();
        var balance = product.StockQuantity - history.Sum(item => item.SignedQuantity);
        var rows = new List<KardexRow> { new("—", "ماندهٔ ابتدای گردش", "—", "موجودی پایه استخراج‌شده از سوابق ذخیره‌شده", 0m, 0m, balance) };
        foreach (var movement in history)
        {
            balance += movement.SignedQuantity;
            var reference = string.IsNullOrWhiteSpace(movement.ReferenceId) ? movement.VoucherId : movement.ReferenceId;
            var document = movement.ReferenceType == "INVOICE"
                ? invoices.FirstOrDefault(item => item.Id == reference)?.DisplayNumber ?? reference
                : vouchers.FirstOrDefault(item => item.Id == reference)?.TrackingCode ?? reference;
            rows.Add(new KardexRow(FormatPersianDate(movement.Date), MovementLabel(movement.MovementType), document, movement.Description,
                Math.Max(0m, movement.SignedQuantity), Math.Abs(Math.Min(0m, movement.SignedQuantity)), balance));
        }
        var root = new DockPanel { Margin = new Thickness(16) };
        var header = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
        header.Children.Add(new TextBlock { Text = "کارتکس / گردش ریز موجودی کالا", FontSize = 23, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)) });
        header.Children.Add(new TextBlock { Text = $"کالا: {product.Name}    کد: {product.Code}    سریال: {product.SerialNumber}    موجودی فعلی: {product.StockQuantity.ToString("N2", CultureInfo.GetCultureInfo("fa-IR"))} {product.Unit}", FontSize = 12, Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)), Margin = new Thickness(0, 5, 0, 0) });
        DockPanel.SetDock(header, Dock.Top); root.Children.Add(header);
        var close = new Button { Content = "بستن کارتکس", Width = 110, Height = 36, Margin = new Thickness(0, 12, 0, 0), IsCancel = true };
        DockPanel.SetDock(close, Dock.Bottom); root.Children.Add(close);
        var grid = new DataGrid { ItemsSource = rows, AutoGenerateColumns = false, IsReadOnly = true, CanUserSortColumns = true,
            HeadersVisibility = DataGridHeadersVisibility.Column, GridLinesVisibility = DataGridGridLinesVisibility.Horizontal, RowHeight = 34,
            ColumnHeaderHeight = 40, Background = Brushes.White, BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
            FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn") };
        grid.Columns.Add(new DataGridTextColumn { Header = "تاریخ", Binding = new Binding(nameof(KardexRow.Date)), Width = 100 });
        grid.Columns.Add(new DataGridTextColumn { Header = "نوع گردش", Binding = new Binding(nameof(KardexRow.Movement)), Width = 150 });
        grid.Columns.Add(new DataGridTextColumn { Header = "سند مرجع", Binding = new Binding(nameof(KardexRow.Document)), Width = 170 });
        grid.Columns.Add(new DataGridTextColumn { Header = "شرح", Binding = new Binding(nameof(KardexRow.Description)), Width = new DataGridLength(1, DataGridLengthUnitType.Star) });
        grid.Columns.Add(new DataGridTextColumn { Header = "ورودی", Binding = new Binding(nameof(KardexRow.Incoming)) { StringFormat = "N2" }, Width = 100 });
        grid.Columns.Add(new DataGridTextColumn { Header = "خروجی", Binding = new Binding(nameof(KardexRow.Outgoing)) { StringFormat = "N2" }, Width = 100 });
        grid.Columns.Add(new DataGridTextColumn { Header = "مانده", Binding = new Binding(nameof(KardexRow.Balance)) { StringFormat = "N2" }, Width = 115 });
        root.Children.Add(grid); Content = root;
    }
    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}", calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }
    private static string MovementLabel(string value) => value switch
    {
        "GOODS_RECEIPT" => "رسید ورود کالا", "GOODS_ISSUE" => "حواله خروج کالا", "INVENTORY_ADJUSTMENT" => "تعدیل موجودی",
        "PRODUCTION_CONSUMPTION" => "مصرف تولید", "PRODUCTION_OUTPUT" => "خروجی تولید", "RETURN_RECEIPT" => "برگشت از فروش",
        "RETURN_ISSUE" => "برگشت از خرید", "INTERNAL_TRANSFER" => "انتقال بین انبار", _ => value
    };
}
