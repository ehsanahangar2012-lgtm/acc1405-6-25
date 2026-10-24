using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

/// <summary>
/// Printable local report for a received or issued check. It is not a bank instrument or proof of settlement.
/// </summary>
public sealed class CheckPreviewWindow : Window
{
    private readonly FlowDocument _document;

    public CheckPreviewWindow(Window owner, CheckRecord check, CompanyProfileRecord? company, string? currency = "RIAL")
    {
        ArgumentNullException.ThrowIfNull(check);
        var moneyUnit = string.Equals(currency, "TOMAN", StringComparison.OrdinalIgnoreCase) ? "تومان" : "ریال";
        Owner = owner;
        Title = $"پیش‌نمایش سند چک — {check.CheckNumber}";
        Width = 880;
        Height = 760;
        MinWidth = 680;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var muted = new SolidColorBrush(Color.FromRgb(71, 85, 105));
        var accent = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var soft = new SolidColorBrush(Color.FromRgb(240, 253, 250));
        _document = new FlowDocument
        {
            PagePadding = new Thickness(34),
            FontFamily = FontFamily,
            FontSize = 12,
            FlowDirection = FlowDirection.RightToLeft,
            Background = Brushes.White,
            Foreground = ink,
            ColumnWidth = 680
        };

        var companyName = string.IsNullOrWhiteSpace(company?.LegalName) ? company?.Name ?? "اشک قلم" : company.LegalName;
        var header = new Grid { Width = 650, FlowDirection = FlowDirection.RightToLeft };
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var heading = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        heading.Children.Add(new TextBlock
        {
            Text = check.CheckType == "ISSUED" ? "سند چک پرداختی" : "سند چک دریافتی",
            FontSize = 23,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            TextWrapping = TextWrapping.Wrap
        });
        heading.Children.Add(new TextBlock
        {
            Text = companyName,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 4, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        heading.Children.Add(new TextBlock
        {
            Text = $"تاریخ تهیه گزارش: {FormatDate(DateTimeOffset.Now)}",
            FontSize = 10,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 6, 0, 0)
        });
        header.Children.Add(heading);
        var logo = CreateImage(company?.LogoDataBase64, 88, 70);
        if (logo is not null)
        {
            Grid.SetColumn(logo, 1);
            header.Children.Add(logo);
        }
        _document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = 680,
            Background = accent,
            BorderBrush = accent,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(14),
            Margin = new Thickness(0, 0, 0, 16),
            Child = header
        }));

        var summary = new StackPanel { Width = 650 };
        summary.Children.Add(new TextBlock
        {
            Text = "این برگه، گزارش چاپی اطلاعات ثبت‌شده در برنامه است و جایگزین اصل چک یا رسید رسمی بانک نیست.",
            FontSize = 10,
            Foreground = muted,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });
        summary.Children.Add(MakeAmountCard(check.Amount.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")) + " " + moneyUnit, accent, soft));
        summary.Children.Add(MakePair("بانک", check.BankName, "شماره چک", string.IsNullOrWhiteSpace(check.CheckNumber) ? "—" : check.CheckNumber, accent, soft, ink));
        summary.Children.Add(MakePair("شناسه صیادی", string.IsNullOrWhiteSpace(check.SayadId) ? "—" : check.SayadId,
            "نوع چک", check.CheckType == "ISSUED" ? "پرداختی / صادره" : "دریافتی", accent, soft, ink));
        summary.Children.Add(MakePair("دارنده / ذی‌نفع", check.HolderName, "شخص مرتبط", string.IsNullOrWhiteSpace(check.PersonName) ? "—" : check.PersonName, accent, soft, ink));
        summary.Children.Add(MakePair("تاریخ صدور", check.IssueDate is DateTimeOffset issue ? FormatDate(issue) : "—",
            "تاریخ سررسید", FormatDate(check.DueDate), accent, soft, ink));
        summary.Children.Add(MakePair("وضعیت", StatusLabel(check.Status), "اولویت پیگیری", check.IsHighPriority ? "بالا" : "عادی", accent, soft, ink));
        if (!string.IsNullOrWhiteSpace(check.Description))
            summary.Children.Add(new Border
            {
                Background = soft, BorderBrush = accent, BorderThickness = new Thickness(0, 0, 4, 0),
                CornerRadius = new CornerRadius(6), Padding = new Thickness(12), Margin = new Thickness(0, 0, 0, 8),
                Child = new StackPanel
                {
                    Children =
                    {
                        new TextBlock { Text = "توضیحات", Foreground = accent, FontWeight = FontWeights.Bold },
                        new TextBlock { Text = check.Description, Foreground = ink, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0) }
                    }
                }
            });
        summary.Children.Add(new TextBlock
        {
            Text = "سوابق وضعیت",
            FontSize = 15,
            FontWeight = FontWeights.Bold,
            Foreground = ink,
            Margin = new Thickness(0, 12, 0, 8)
        });
        foreach (var history in (check.History ?? []).OrderBy(item => item.ChangedAt))
        {
            summary.Children.Add(new TextBlock
            {
                Text = $"{FormatDate(history.ChangedAt)}   •   {StatusLabel(history.Status)}   •   {history.Note}",
                FontSize = 10,
                Foreground = muted,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 6)
            });
        }
        var checkImage = CreateImage(check.ImageDataBase64, 480, 300, check.ImagePath);
        if (checkImage is not null)
        {
            summary.Children.Add(new TextBlock
            {
                Text = "تصویر پیوست چک",
                FontSize = 15,
                FontWeight = FontWeights.Bold,
                Foreground = ink,
                Margin = new Thickness(0, 14, 0, 8)
            });
            summary.Children.Add(new Border
            {
                Background = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(8),
                Margin = new Thickness(0, 0, 0, 10),
                Child = checkImage
            });
        }
        _document.Blocks.Add(new BlockUIContainer(summary));
        PrintBrandingService.AppendWebsiteFooter(_document, 650);

        var root = new Grid { Margin = new Thickness(14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        var toolbar = new DockPanel { LastChildFill = false, Margin = new Thickness(0, 0, 0, 10) };
        toolbar.Children.Add(new TextBlock
        {
            Text = "پیش‌نمایش و چاپ سند چک",
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            Foreground = ink,
            VerticalAlignment = VerticalAlignment.Center
        });
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        var print = new Button { Content = "🖨 چاپ / انتخاب چاپگر", MinWidth = 160, Height = 38, Margin = new Thickness(0, 0, 8, 0), Background = accent, Foreground = Brushes.White };
        print.Click += Print_Click;
        actions.Children.Add(print);
        actions.Children.Add(new Button { Content = "بستن", MinWidth = 90, Height = 38, IsCancel = true });
        DockPanel.SetDock(actions, Dock.Left);
        toolbar.Children.Add(actions);

        var viewer = new FlowDocumentScrollViewer
        {
            Document = _document,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            IsToolBarVisible = true,
            Background = Brushes.White,
            Padding = new Thickness(12)
        };
        var paper = new Border
        {
            Background = Brushes.White,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(8),
            Child = viewer
        };
        root.Children.Add(toolbar);
        Grid.SetRow(paper, 1);
        root.Children.Add(paper);
        Content = root;
    }

    private static Border MakeAmountCard(string amount, Brush accent, Brush soft) => new()
    {
        Background = soft,
        BorderBrush = accent,
        BorderThickness = new Thickness(1),
        CornerRadius = new CornerRadius(8),
        Padding = new Thickness(14),
        Margin = new Thickness(0, 0, 0, 10),
        Child = new StackPanel
        {
            Children =
            {
                new TextBlock { Text = "مبلغ چک", Foreground = accent, FontWeight = FontWeights.SemiBold, FontSize = 11 },
                new TextBlock { Text = amount, Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)), FontSize = 24, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 5, 0, 0) }
            }
        }
    };

    private static Border MakePair(string label1, string value1, string label2, string value2, Brush accent, Brush soft, Brush ink)
    {
        var grid = new Grid { Margin = new Thickness(0, 0, 0, 8), FlowDirection = FlowDirection.RightToLeft };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.Children.Add(MakeItem(label1, value1, accent, soft, ink));
        var second = MakeItem(label2, value2, accent, soft, ink);
        Grid.SetColumn(second, 1);
        grid.Children.Add(second);
        return new Border { Child = grid, Width = 650 };
    }

    private static Border MakeItem(string label, string value, Brush accent, Brush soft, Brush ink)
    {
        var stack = new StackPanel();
        stack.Children.Add(new TextBlock { Text = label, Foreground = accent, FontWeight = FontWeights.SemiBold, FontSize = 10 });
        stack.Children.Add(new TextBlock { Text = value, Foreground = ink, FontSize = 12, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0) });
        return new Border { Background = soft, BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Padding = new Thickness(10), Margin = new Thickness(0, 0, 6, 0), Child = stack };
    }

    private static Image? CreateImage(string? encoded, double width, double height, string? path = null)
    {
        if (string.IsNullOrWhiteSpace(encoded) && (string.IsNullOrWhiteSpace(path) || !File.Exists(path))) return null;
        try
        {
            var bytes = !string.IsNullOrWhiteSpace(encoded) ? Convert.FromBase64String(encoded) : File.ReadAllBytes(path!);
            using var stream = new MemoryStream(bytes);
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream;
            bitmap.DecodePixelWidth = (int)(width * 2);
            bitmap.EndInit();
            bitmap.Freeze();
            return new Image { Source = bitmap, Width = width, Height = height, Stretch = Stretch.Uniform, SnapsToDevicePixels = true };
        }
        catch { return null; }
    }

    private static string StatusLabel(string status) => status switch
    {
        "PENDING" => "در انتظار",
        "DEPOSITED" => "واگذار به بانک",
        "PASSED" => "پاس‌شده",
        "BOUNCED" => "برگشتی",
        "TRANSFERRED" => "واگذار / خرج‌شده",
        "CASHED" => "وصول‌شده",
        "RETURNED" => "عودت‌شده",
        _ => status
    };

    private static string FormatDate(DateTimeOffset date)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(date.DateTime), calendar.GetMonth(date.DateTime), calendar.GetDayOfMonth(date.DateTime));
    }

    private void Print_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new PrintDialog();
            if (dialog.ShowDialog() == true)
                dialog.PrintDocument(((IDocumentPaginatorSource)_document).DocumentPaginator, Title);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ سند چک", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }
}
