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
        Height = confirmPassword ? 300 : 250;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.NoResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = Brushes.White;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = confirmPassword ? "برای حفاظت از فایل پشتیبان، رمز قوی انتخاب کنید." : "رمز فایل پشتیبان را وارد کنید.",
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 15)
        });
        root.Children.Add(new TextBlock { Text = "رمز پشتیبان (حداقل ۱۲ نویسه)", Margin = new Thickness(0, 0, 0, 6) });
        _password.Padding = new Thickness(8, 4, 8, 4);
        _password.Height = 34;
        root.Children.Add(_password);

        if (confirmPassword)
        {
            root.Children.Add(new TextBlock { Text = "تکرار رمز", Margin = new Thickness(0, 12, 0, 6) });
            _confirmation = new PasswordBox { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
            root.Children.Add(_confirmation);
        }

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 18, 0, 0) };
        var ok = new Button { Content = "تأیید", Width = 90, Height = 34, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        var cancel = new Button { Content = "انصراف", Width = 90, Height = 34, IsCancel = true };
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
        root.Children.Add(buttons);
        Content = root;
        Loaded += (_, _) => _password.Focus();
    }
}
