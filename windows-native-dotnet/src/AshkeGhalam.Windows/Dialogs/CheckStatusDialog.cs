using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class CheckStatusDialog : Window
{
    private sealed record StatusItem(string Value, string Label);

    private static readonly StatusItem[] Statuses =
    [
        new("PENDING", "در انتظار"),
        new("DEPOSITED", "واگذار به بانک"),
        new("PASSED", "پاس‌شده"),
        new("BOUNCED", "برگشتی"),
        new("TRANSFERRED", "واگذار شده"),
        new("CASHED", "وصول‌شده"),
        new("RETURNED", "عودت‌شده")
    ];

    private readonly ComboBox _status = new() { Height = 34, DisplayMemberPath = nameof(StatusItem.Label), ItemsSource = Statuses };
    private readonly TextBox _note = new() { Height = 72, Padding = new Thickness(8), AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };

    public string SelectedStatus { get; private set; } = "PENDING";
    public string Note { get; private set; } = "";

    public CheckStatusDialog(Window owner, string currentStatus)
    {
        Owner = owner;
        Title = "تغییر وضعیت چک";
        Width = 430;
        Height = 390;
        MinHeight = 320;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = Brushes.White;
        _status.SelectedItem = Statuses.FirstOrDefault(s => s.Value == currentStatus) ?? Statuses[0];

        var root = new StackPanel { Margin = new Thickness(14) };
        var statusSection = new StackPanel();
        statusSection.Children.Add(new TextBlock
        {
            Text = "وضعیت ثبت‌شدهٔ جدید",
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 5)
        });
        _status.MinHeight = 38;
        statusSection.Children.Add(_status);
        root.Children.Add(CreateSectionCard(
            "وضعیت چک",
            "وضعیت را مطابق آخرین رویداد واقعی چک انتخاب کنید.",
            statusSection));

        var noteSection = new StackPanel();
        noteSection.Children.Add(new TextBlock
        {
            Text = "یادداشت سابقه (اختیاری)",
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 5)
        });
        _note.MinHeight = 78;
        noteSection.Children.Add(_note);
        root.Children.Add(CreateSectionCard(
            "شرح تغییر",
            "یادداشت برای ثبت دلیل تغییر یا اقدام پیگیری استفاده می‌شود.",
            noteSection));

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(14, 8, 14, 14) };
        var save = new Button
        {
            Content = "ثبت وضعیت",
            Width = 130,
            Height = 40,
            IsDefault = true,
            Margin = new Thickness(0, 0, 8, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
        };
        actions.Children.Add(save);
        actions.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 40, IsCancel = true });
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(actions, 1);
        layout.Children.Add(body);
        layout.Children.Add(actions);
        Content = layout;

        save.Click += (_, _) =>
        {
            if (_status.SelectedItem is not StatusItem selected)
            {
                MessageBox.Show(this, "وضعیت را انتخاب کنید.", "بررسی اطلاعات", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            SelectedStatus = selected.Value;
            Note = _note.Text.Trim();
            DialogResult = true;
        };
    }
    private static Border CreateSectionCard(string title, string hint, UIElement content)
    {
        var body = new StackPanel();
        body.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 15,
            FontWeight = FontWeights.Bold,
            Foreground = PaletteBrush("#0F766E")
        });
        body.Children.Add(new TextBlock
        {
            Text = hint,
            FontSize = 11,
            Foreground = PaletteBrush("#64748B"),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 4, 0, 10)
        });
        body.Children.Add(content);
        return new Border
        {
            Background = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#E2E8F0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(14),
            Margin = new Thickness(0, 0, 0, 12),
            Child = body
        };
    }

    private static SolidColorBrush PaletteBrush(string value) =>
        new((Color)ColorConverter.ConvertFromString(value)!);

}
