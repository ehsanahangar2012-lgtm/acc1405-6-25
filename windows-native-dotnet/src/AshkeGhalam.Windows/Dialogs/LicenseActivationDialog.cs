using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class LicenseActivationDialog : Window
{
    private readonly TextBox _workspace = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly PasswordBox _licenseKey = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _company = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _hardwareId = new() { Height = 58, Padding = new Thickness(8), IsReadOnly = true, TextWrapping = TextWrapping.Wrap };
    private readonly TextBlock _status = new() { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 0), Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)) };
    private readonly Button _verify = new() { Content = "تأیید آنلاین لایسنس", Width = 170, Height = 38 };
    private readonly Button _copy = new() { Content = "کپی شناسه دستگاه", Width = 135, Height = 38, Margin = new Thickness(0, 0, 8, 0) };
    private readonly ServerLicenseClient _client = new();

    public NativeLicenseState? VerifiedState { get; private set; }

    public LicenseActivationDialog(Window owner, NativeLicenseState? existing = null)
    {
        Owner = owner;
        Title = "اتصال سرور و فعال‌سازی لایسنس اشک قلم";
        Width = 600;
        Height = 650;
        MinHeight = 600;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _workspace.Text = existing?.WorkspaceId ?? "";
        _licenseKey.Password = existing?.LicenseKey ?? "";
        _company.Text = existing?.CompanyName ?? "";
        try { _hardwareId.Text = HardwareIdentityService.GetHardwareId(); }
        catch (Exception ex)
        {
            _hardwareId.Text = "";
            _status.Text = ex.Message;
            _status.Foreground = Brushes.Firebrick;
            _verify.IsEnabled = false;
        }

        var root = new StackPanel { Margin = new Thickness(24) };
        root.Children.Add(new TextBlock
        {
            Text = "فعال‌سازی با مرجع رسمی لایسنس",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "کلید و شناسه فضای کاری مستقیماً به سرور HTTPS ارسال می‌شوند. لایسنس فقط وقتی تأیید می‌شود که سرور فعال بودن آن را اعلام کند و رسید RSA-SHA256 با کلید عمومی سرور معتبر باشد. کلید خصوصی داخل این برنامه نیست.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 14)
        });

        AddField(root, "شناسه فضای کاری (Workspace ID)", _workspace);
        AddField(root, "کلید لایسنس", _licenseKey);
        AddField(root, "نام شرکت (نمایشی؛ اختیاری)", _company);
        AddField(root, "شناسه سخت‌افزاری این رایانه", _hardwareId);

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 8, 22, 8) };
        actions.Children.Add(_copy);
        actions.Children.Add(_verify);
        actions.Children.Add(new Button { Content = "بستن", Width = 80, Height = 38, Margin = new Thickness(8, 0, 0, 0), IsCancel = true });
        root.Children.Add(new TextBlock
        {
            Text = "وضعیت ذخیره‌شده به‌صورت رمزگذاری‌شده با DPAPI برای حساب جاری Windows نگهداری می‌شود. این پنجره به‌تنهایی جایگزین مهاجرت سهمیه‌ها و کنترل دسترسی همهٔ ماژول‌ها نیست.",
            FontSize = 11,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 20, 0, 0)
        });

        var footer = new StackPanel();
        footer.Children.Add(actions);
        footer.Children.Add(_status);
        footer.Margin = new Thickness(22, 4, 22, 16);

        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(footer, 1);
        layout.Children.Add(body);
        layout.Children.Add(footer);
        Content = layout;

        _copy.Click += (_, _) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_hardwareId.Text)) throw new InvalidOperationException("شناسه دستگاه آماده نیست.");
                Clipboard.SetText(_hardwareId.Text);
                _status.Text = "شناسه دستگاه کپی شد.";
                _status.Foreground = new SolidColorBrush(Color.FromRgb(15, 118, 110));
            }
            catch
            {
                _status.Text = "کپی شناسه دستگاه انجام نشد.";
                _status.Foreground = Brushes.Firebrick;
            }
        };

        _verify.Click += async (_, _) =>
        {
            if (_verify.IsEnabled is false || string.IsNullOrWhiteSpace(_hardwareId.Text))
                return;
            var key = _licenseKey.Password.Trim();
            var workspaceId = _workspace.Text.Trim();
            if (key.Length == 0 || workspaceId.Length == 0)
            {
                _status.Text = "شناسه فضای کاری و کلید لایسنس را وارد کنید.";
                _status.Foreground = Brushes.Firebrick;
                return;
            }

            _verify.IsEnabled = false;
            _copy.IsEnabled = false;
            _status.Text = "در حال اتصال امن و بررسی رسید امضاشده...";
            _status.Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105));
            try
            {
                var result = await _client.VerifyAsync(key, workspaceId, _hardwareId.Text);
                if (!result.Success || result.License is null)
                {
                    _status.Text = result.Message;
                    _status.Foreground = Brushes.Firebrick;
                    return;
                }

                VerifiedState = new NativeLicenseState
                {
                    LicenseKey = key,
                    WorkspaceId = workspaceId,
                    HardwareId = _hardwareId.Text,
                    CompanyName = string.IsNullOrWhiteSpace(_company.Text)
                        ? result.License.Payload.CompanyName
                        : _company.Text.Trim(),
                    Payload = result.License.Payload,
                    Receipt = result.License.Receipt,
                    VerifiedAtUtc = DateTimeOffset.UtcNow
                };
                _status.Text = $"لایسنس تأیید شد • طرح: {result.License.Payload.Plan} • پایان: {result.License.Payload.ExpireDate}";
                _status.Foreground = new SolidColorBrush(Color.FromRgb(15, 118, 110));
                DialogResult = true;
            }
            catch
            {
                _status.Text = "تأیید لایسنس کامل نشد. کلید یا اطلاعات حساس در گزارش خطا ذخیره نشده است.";
                _status.Foreground = Brushes.Firebrick;
            }
            finally
            {
                _verify.IsEnabled = true;
                _copy.IsEnabled = true;
            }
        };
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 9, 0, 4),
            Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59))
        });
        field.Margin = new Thickness(0, 0, 0, 3);
        root.Children.Add(field);
    }
}
