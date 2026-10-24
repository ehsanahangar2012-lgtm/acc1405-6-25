using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using Microsoft.Win32;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class PersonKardexWindow : Window
{
    private readonly CustomerRecord _person;
    private readonly AccountingData _data;
    private readonly DataGrid _grid;
    private readonly TextBox _fromDate;
    private readonly TextBox _toDate;
    private readonly TextBlock _summary;
    private readonly TextBlock _status;
    private PersonKardexReport? _report;

    public PersonKardexWindow(Window owner, CustomerRecord person, AccountingData data)
    {
        _person = person ?? throw new ArgumentNullException(nameof(person));
        _data = data ?? throw new ArgumentNullException(nameof(data));
        Owner = owner;
        Title = $"کاردکس اشخاص — {person.Name}";
        Width = 1160;
        Height = 780;
        MinWidth = 900;
        MinHeight = 590;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));

        var root = new Grid { Margin = new Thickness(18) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var brand = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        var ink = new SolidColorBrush(Color.FromRgb(15, 23, 42));
        var soft = new SolidColorBrush(Color.FromRgb(231, 248, 244));
        var heading = new StackPanel { FlowDirection = FlowDirection.RightToLeft };
        heading.Children.Add(new TextBlock
        {
            Text = $"کاردکس مالی اشخاص  /  {_person.Name}",
            FontSize = 23,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            TextWrapping = TextWrapping.Wrap
        });
        heading.Children.Add(new TextBlock
        {
            Text = $"کد شخص: {_person.Code}   •   نقش: {_person.RoleLabel}   •   تلفن: {_person.Phone}",
            FontSize = 12,
            Foreground = Brushes.White,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 5, 0, 0)
        });
        root.Children.Add(new Border
        {
            Background = brand,
            BorderBrush = brand,
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(18),
            Margin = new Thickness(0, 0, 0, 12),
            Child = heading
        });

        var filter = new WrapPanel { Margin = new Thickness(0, 0, 0, 10), VerticalAlignment = VerticalAlignment.Center };
        filter.Children.Add(new TextBlock { Text = "از تاریخ شمسی", VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 6, 0) });
        _fromDate = new TextBox { Width = 124, Height = 34, Padding = new Thickness(8, 4, 8, 4), ToolTip = "نمونه: ۱۴۰۵/۰۱/۰۱", Margin = new Thickness(0, 0, 12, 0) };
        filter.Children.Add(PersianDateInputService.CreateDateField(_fromDate, optional: true));
        filter.Children.Add(new TextBlock { Text = "تا تاریخ شمسی", VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 6, 0) });
        _toDate = new TextBox { Width = 124, Height = 34, Padding = new Thickness(8, 4, 8, 4), ToolTip = "نمونه: ۱۴۰۵/۱۲/۲۹", Margin = new Thickness(0, 0, 12, 0) };
        filter.Children.Add(PersianDateInputService.CreateDateField(_toDate, optional: true));
        filter.Children.Add(MakeButton("اعمال فیلتر", ApplyFilter_Click, primary: true));
        filter.Children.Add(MakeButton("پاک‌کردن تاریخ", ClearFilter_Click));
        filter.Children.Add(MakeButton("پیش‌نمایش فاکتور انتخابی", OpenSelectedInvoice_Click));
        filter.Children.Add(MakeButton("خروجی CSV", ExportCsv_Click));
        filter.Children.Add(MakeButton("پیش‌نمایش چاپ گزارش", PreviewPrint_Click, primary: true));
        Grid.SetRow(filter, 1);
        root.Children.Add(filter);

        _summary = new TextBlock
        {
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            Foreground = ink,
            Padding = new Thickness(12, 10, 12, 10)
        };
        Grid.SetRow(_summary, 2);
        root.Children.Add(new Border
        {
            Background = soft,
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Margin = new Thickness(0, 0, 0, 10),
            Child = _summary
        });

        _grid = new DataGrid
        {
            AutoGenerateColumns = false,
            IsReadOnly = true,
            CanUserAddRows = false,
            CanUserDeleteRows = false,
            SelectionUnit = DataGridSelectionUnit.FullRow,
            SelectionMode = DataGridSelectionMode.Single,
            HeadersVisibility = DataGridHeadersVisibility.Column,
            GridLinesVisibility = DataGridGridLinesVisibility.Horizontal,
            RowHeight = 34,
            ColumnHeaderHeight = 40,
            Background = Brushes.White,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)),
            BorderThickness = new Thickness(1),
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        _grid.Columns.Add(new DataGridTextColumn { Header = "تاریخ شمسی", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Date)), Width = 105 });
        _grid.Columns.Add(new DataGridTextColumn { Header = "نوع سند", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Type)), Width = 125 });
        _grid.Columns.Add(new DataGridTextColumn { Header = "شماره / مرجع", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Reference)), Width = 150 });
        _grid.Columns.Add(new DataGridTextColumn { Header = "شرح گردش", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Description)), Width = new DataGridLength(1, DataGridLengthUnitType.Star) });
        var numericCellStyle = CreateNumericCellStyle();
        _grid.Columns.Add(new DataGridTextColumn { Header = "بدهکار", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Debit)) { StringFormat = "#,##0.##" }, ElementStyle = numericCellStyle, Width = 115 });
        _grid.Columns.Add(new DataGridTextColumn { Header = "بستانکار", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Credit)) { StringFormat = "#,##0.##" }, ElementStyle = numericCellStyle, Width = 115 });
        _grid.Columns.Add(new DataGridTextColumn { Header = "مانده", Binding = new System.Windows.Data.Binding(nameof(PersonKardexEntry.Balance)) { StringFormat = "#,##0.##" }, ElementStyle = numericCellStyle, Width = 125 });
        _grid.AlternationCount = 2;
        _grid.RowBackground = Brushes.White;
        _grid.AlternatingRowBackground = soft;
        var headerStyle = new Style(typeof(DataGridColumnHeader));
        headerStyle.Setters.Add(new Setter(Control.BackgroundProperty, brand));
        headerStyle.Setters.Add(new Setter(Control.ForegroundProperty, Brushes.White));
        headerStyle.Setters.Add(new Setter(Control.FontWeightProperty, FontWeights.Bold));
        headerStyle.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(8, 6, 8, 6)));
        _grid.ColumnHeaderStyle = headerStyle;
        Grid.SetRow(_grid, 3);
        root.Children.Add(_grid);

        var footer = new DockPanel { Margin = new Thickness(0, 10, 0, 0), LastChildFill = true };
        _status = new TextBlock
        {
            Text = "حواله‌های انبار در کاردکس نمایش داده می‌شوند اما ماندهٔ مالی را تغییر نمی‌دهند.",
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            VerticalAlignment = VerticalAlignment.Center,
            TextWrapping = TextWrapping.Wrap
        };
        footer.Children.Add(_status);
        var close = MakeButton("بستن", (_, _) => Close());
        DockPanel.SetDock(close, Dock.Left);
        footer.Children.Add(close);
        Grid.SetRow(footer, 4);
        root.Children.Add(footer);
        Content = root;

        Loaded += (_, _) => ReloadReport();
    }

    private static Style CreateNumericCellStyle()
    {
        var style = new Style(typeof(TextBlock));
        style.Setters.Add(new Setter(FrameworkElement.FlowDirectionProperty, FlowDirection.LeftToRight));
        style.Setters.Add(new Setter(TextBlock.TextAlignmentProperty, TextAlignment.Right));
        style.Setters.Add(new Setter(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Stretch));
        return style;
    }

    private Button MakeButton(string label, RoutedEventHandler handler, bool primary = false)
    {
        var button = new Button
        {
            Content = label,
            MinHeight = 34,
            MinWidth = 92,
            Padding = new Thickness(10, 5, 10, 5),
            Margin = new Thickness(0, 0, 8, 6),
            Cursor = System.Windows.Input.Cursors.Hand,
            Background = primary
                ? new SolidColorBrush(Color.FromRgb(15, 118, 110))
                : Brushes.White,
            Foreground = primary ? Brushes.White : new SolidColorBrush(Color.FromRgb(30, 41, 59)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225))
        };
        button.Click += handler;
        return button;
    }

    private void ApplyFilter_Click(object sender, RoutedEventArgs e) => ReloadReport();

    private void ClearFilter_Click(object sender, RoutedEventArgs e)
    {
        _fromDate.Clear();
        _toDate.Clear();
        ReloadReport();
    }

    private void ReloadReport()
    {
        try
        {
            _report = PersonKardexService.GetReport(_data, _person, _fromDate.Text, _toDate.Text);
            _grid.ItemsSource = null;
            _grid.ItemsSource = _report.Rows;
            var balanceType = _report.ClosingBalance > 0m ? "بدهکار" :
                _report.ClosingBalance < 0m ? "بستانکار" : "تسویه";
            var balance = Math.Abs(_report.ClosingBalance).ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
            _summary.Text =
                $"جمع بدهکار دوره: {_report.TotalDebit.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}    " +
                $"جمع بستانکار دوره: {_report.TotalCredit.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"))}    " +
                $"مانده نهایی: {balance} {balanceType}    " +
                $"فاکتور: {_report.InvoiceCount:N0} • دریافت/پرداخت: {_report.PaymentCount:N0} • چک مستقل: {_report.CheckCount:N0} • حواله: {_report.VoucherCount:N0}";
            _status.Text = "ماندهٔ مثبت یعنی بدهکاری طرف حساب به شرکت؛ ماندهٔ منفی یعنی بستانکاری شرکت به طرف حساب. حواله، غیرمالی است.";
        }
        catch (Exception ex)
        {
            _report = null;
            _grid.ItemsSource = null;
            _summary.Text = "فیلتر تاریخ اعمال نشد.";
            _status.Text = ex.Message;
            MessageBox.Show(this, ex.Message, "فیلتر کاردکس اشخاص", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void OpenSelectedInvoice_Click(object sender, RoutedEventArgs e)
    {
        if (_grid.SelectedItem is not PersonKardexEntry selected || selected.Type != "فاکتور")
        {
            MessageBox.Show(this, "برای مشاهدهٔ پیش‌نمایش، ردیف یک فاکتور را انتخاب کنید.",
                "کاردکس اشخاص", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var invoice = _data.Invoices.FirstOrDefault(item =>
            item.CustomerId == _person.Id && string.Equals(item.DisplayNumber, selected.Reference, StringComparison.Ordinal));
        if (invoice is null)
        {
            MessageBox.Show(this, "فاکتور مرجع پیدا نشد.", "کاردکس اشخاص", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var company = _data.Companies.FirstOrDefault(item => item.Id == _data.ActiveCompanyId);
        var footer = string.Join(Environment.NewLine,
            (_data.Preferences.SelectedInvoiceFootnotes ?? [])
                .Concat((_data.Preferences.InvoiceFooter ?? "")
                    .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .Where(note => !string.IsNullOrWhiteSpace(note))
                .Distinct(StringComparer.Ordinal));
        new InvoicePreviewWindow(this, invoice, _data.Preferences.InvoiceTheme,
            _data.Preferences.ShowInvoiceQr, company, _data.Preferences.Currency, footer).ShowDialog();
    }

    private void ExportCsv_Click(object sender, RoutedEventArgs e)
    {
        if (_report is null)
        {
            MessageBox.Show(this, "ابتدا گزارش معتبر تهیه کنید.");
            return;
        }

        var dialog = new SaveFileDialog
        {
            Title = "ذخیره کاردکس اشخاص",
            FileName = $"کاردکس-{_person.Code}.csv",
            Filter = "CSV UTF-8 (*.csv)|*.csv",
            AddExtension = true,
            DefaultExt = ".csv"
        };
        if (dialog.ShowDialog(this) != true)
            return;

        try
        {
            static string Csv(string value) => "\"" + value.Replace("\"", "\"\"") + "\"";
            var builder = new StringBuilder();
            builder.AppendLine(string.Join(",", new[] { "Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance" }));
            foreach (var row in _report.Rows)
            {
                builder.AppendLine(string.Join(",", new[]
                {
                    Csv(row.Date), Csv(row.Type), Csv(row.Reference), Csv(row.Description),
                    row.Debit.ToString(CultureInfo.InvariantCulture),
                    row.Credit.ToString(CultureInfo.InvariantCulture),
                    row.Balance.ToString(CultureInfo.InvariantCulture)
                }));
            }
            File.WriteAllText(dialog.FileName, builder.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
            _status.Text = "خروجی CSV کاردکس ذخیره شد.";
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "خروجی کاردکس", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void PreviewPrint_Click(object sender, RoutedEventArgs e)
    {
        if (_report is null) ReloadReport();
        if (_report is null) return;
        var window = new PersonKardexPrintPreviewWindow(this, _person, _report, _data.Preferences.Currency);
        ApplicationThemeService.ApplyWhenLoaded(window, _data.Preferences.ApplicationTheme);
        window.ShowDialog();
    }

    private void Print_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new PrintDialog();
            if (dialog.ShowDialog() == true)
                dialog.PrintVisual(_grid, $"AshkeGhalam-PersonKardex-{_person.Code}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "چاپ کاردکس", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}
