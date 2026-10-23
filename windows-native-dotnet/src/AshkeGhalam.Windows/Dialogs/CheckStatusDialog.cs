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
        Height = 300;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.NoResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = Brushes.White;
        _status.SelectedItem = Statuses.FirstOrDefault(s => s.Value == currentStatus) ?? Statuses[0];

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock { Text = "وضعیت ثبت‌شدهٔ جدید", FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 5) });
        root.Children.Add(_status);
        root.Children.Add(new TextBlock { Text = "یادداشت سابقه (اختیاری)", FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 14, 0, 5) });
        root.Children.Add(_note);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 16, 0, 0) };
        var save = new Button { Content = "ثبت وضعیت", Width = 110, Height = 36, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        actions.Children.Add(save);
        actions.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, IsCancel = true });
        root.Children.Add(actions);
        Content = root;

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
}
