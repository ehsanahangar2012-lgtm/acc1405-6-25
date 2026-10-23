using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class LedgerAccountDialog : Window
{
    private sealed record Choice(string Value, string Label);

    private readonly TextBox _code = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _name = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly ComboBox _type = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label) };
    private readonly ComboBox _level = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label) };
    private readonly ComboBox _parent = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label) };

    public ChartOfAccountRecord? Result { get; private set; }

    public LedgerAccountDialog(Window owner, IReadOnlyList<ChartOfAccountRecord> accounts)
    {
        Owner = owner;
        Title = "افزودن سرفصل حساب";
        Width = 510;
        Height = 520;
        MinHeight = 500;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.NoResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _type.ItemsSource = new[]
        {
            new Choice("ASSET", "دارایی"),
            new Choice("LIABILITY", "بدهی"),
            new Choice("EQUITY", "حقوق مالکانه"),
            new Choice("REVENUE", "درآمد"),
            new Choice("EXPENSE", "هزینه")
        };
        _type.SelectedIndex = 0;
        _level.ItemsSource = new[]
        {
            new Choice("MAIN", "کل / اصلی"),
            new Choice("SUB", "معین"),
            new Choice("DETAIL", "تفصیلی")
        };
        _level.SelectedIndex = 0;
        _parent.ItemsSource = new[] { new Choice("", "بدون والد (حساب کل)") }
            .Concat(accounts.OrderBy(a => a.Code, StringComparer.OrdinalIgnoreCase)
                .Select(a => new Choice(a.Id, $"{a.Code} — {a.Name}")))
            .ToList();
        _parent.SelectedIndex = 0;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = "سرفصل جدید در کدینگ حساب‌ها",
            FontSize = 21,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "ساختار نوع و سطح حساب مطابق مدل ChartOfAccount نسخهٔ اصلی است. کد هر سرفصل باید یکتا باشد.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });

        AddField(root, "کد حساب (الزامی)", _code);
        AddField(root, "عنوان حساب (الزامی)", _name);
        AddField(root, "نوع حساب", _type);
        AddField(root, "سطح حساب", _level);
        AddField(root, "حساب والد (برای معین/تفصیلی الزامی)", _parent);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 20, 0, 0) };
        var save = new Button { Content = "ثبت سرفصل", Width = 115, Height = 36, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, IsCancel = true });
        root.Children.Add(buttons);
        Content = root;

        save.Click += (_, _) =>
        {
            try
            {
                var type = (_type.SelectedItem as Choice)?.Value ?? throw new InvalidOperationException("نوع حساب را انتخاب کنید.");
                var level = (_level.SelectedItem as Choice)?.Value ?? throw new InvalidOperationException("سطح حساب را انتخاب کنید.");
                var parentId = (_parent.SelectedItem as Choice)?.Value ?? "";
                if (level != "MAIN" && string.IsNullOrWhiteSpace(parentId))
                    throw new InvalidOperationException("برای حساب معین یا تفصیلی، حساب والد را انتخاب کنید.");
                if (level == "MAIN") parentId = "";
                Result = new ChartOfAccountRecord
                {
                    Code = _code.Text.Trim(),
                    Name = _name.Text.Trim(),
                    Type = type,
                    Level = level,
                    ParentId = parentId,
                    IsActive = true
                };
                if (Result.Code.Length is < 2 or > 32) throw new InvalidOperationException("کد حساب باید بین ۲ تا ۳۲ نویسه باشد.");
                if (Result.Name.Length is < 2 or > 160) throw new InvalidOperationException("عنوان حساب باید بین ۲ تا ۱۶۰ نویسه باشد.");
                DialogResult = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "بررسی سرفصل حساب", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        };
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock { Text = label, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 7, 0, 4) });
        field.Margin = new Thickness(0, 0, 0, 3);
        root.Children.Add(field);
    }
}
