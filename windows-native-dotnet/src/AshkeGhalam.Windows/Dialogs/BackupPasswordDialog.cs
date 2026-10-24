using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class BackupPasswordDialog : Window
{
    private readonly PasswordBox _password = new();
    private readonly PasswordBox? _confirmation;

    public string Passphrase => _password.Password;

    public BackupPasswordDialog(Window owner, string title, bool confirmPassword)
    {
        Owner = owner;
        Title = title;
        Width = 440;
        Height = confirmPassword ? 340 : 290;
        MinHeight = 250;
        MinWidth = 400;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = Brushes.White;

        var root = new StackPanel { Margin = new Thickness(14) };
        var heroContent = new StackPanel();
        heroContent.Children.Add(new TextBlock
        {
            Text = "حفاظت از داده‌های پشتیبان",
            FontSize = 19,
            FontWeight = FontWeights.Bold,
            Foreground = PaletteBrush("#F8FAFC")
        });
        heroContent.Children.Add(new TextBlock
        {
            Text = confirmPassword
                ? "یک عبارت عبور منحصربه‌فرد انتخاب کنید و آن را در مکانی امن نگه دارید."
                : "برای بازیابی داده‌ها، همان رمزی را وارد کنید که هنگام ساخت این فایل استفاده شد.",
            FontSize = 12,
            Foreground = PaletteBrush("#CBD5E1"),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 5, 0, 0)
        });
        root.Children.Add(new Border
        {
            Background = PaletteBrush("#0F172A"),
            BorderBrush = PaletteBrush("#334155"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(16),
            Margin = new Thickness(0, 0, 0, 12),
            Child = heroContent
        });

        var credentials = new StackPanel();
        credentials.Children.Add(new TextBlock
        {
            Text = "رمز پشتیبان (حداقل ۱۲ نویسه)",
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 6)
        });
        _password.Padding = new Thickness(9, 6, 9, 6);
        _password.MinHeight = 38;
        credentials.Children.Add(_password);

        if (confirmPassword)
        {
            var confirmationLabel = new TextBlock
            {
                Text = "تکرار رمز",
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 12, 0, 6)
            };
            credentials.Children.Add(confirmationLabel);
            _confirmation = new PasswordBox { MinHeight = 38, Padding = new Thickness(9, 6, 9, 6) };
            credentials.Children.Add(_confirmation);
        }
        root.Children.Add(CreateSectionCard(
            "عبارت عبور",
            "برای امنیت بیشتر از رمزهای تکراری یا قابل حدس استفاده نکنید.",
            credentials));

        root.Children.Add(new Border
        {
            Background = PaletteBrush("#FFF7ED"),
            BorderBrush = PaletteBrush("#FED7AA"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(10),
            Margin = new Thickness(0, 0, 0, 8),
            Child = new TextBlock
            {
                Text = "هشدار: بدون رمز درست، فایل پشتیبان قابل رمزگشایی نیست. رمز را جدا از فایل نگهداری کنید.",
                Foreground = PaletteBrush("#7C2D12"),
                FontSize = 12,
                TextWrapping = TextWrapping.Wrap
            }
        });

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(14, 8, 14, 14)
        };
        var ok = new Button
        {
            Content = "تأیید",
            Width = 110,
            Height = 40,
            IsDefault = true,
            Margin = new Thickness(0, 0, 8, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
        };
        var cancel = new Button { Content = "انصراف", Width = 95, Height = 40, IsCancel = true };
        buttons.Children.Add(ok);
        buttons.Children.Add(cancel);
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;
        ok.Click += (_, _) =>
        {
            if (_password.Password.Trim().Length < 12)
            {
                MessageBox.Show(this, "رمز پشتیبان باید حداقل ۱۲ نویسه داشته باشد.", "رمز نامعتبر", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (_confirmation is not null && !string.Equals(_password.Password, _confirmation.Password, StringComparison.Ordinal))
            {
                MessageBox.Show(this, "رمز و تکرار آن یکسان نیستند.", "بررسی رمز", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            DialogResult = true;
        };
        buttons.Children.Add(ok);
        buttons.Children.Add(cancel);
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;
        Loaded += (_, _) => _password.Focus();
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
