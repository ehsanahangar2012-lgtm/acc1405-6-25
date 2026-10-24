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
    private readonly Button _verify = new()
    {
        Content = "تأیید آنلاین لایسنس",
        Width = 175,
        Height = 40,
        Background = new SolidColorBrush(Color.FromRgb(15, 118, 110)),
        Foreground = Brushes.White,
        BorderBrush = new SolidColorBrush(Color.FromRgb(15, 118, 110))
    };
    private readonly Button _copy = new() { Content = "کپی شناسه دستگاه", Width = 135, Height = 38, Margin = new Thickness(0, 0, 8, 0) };
    private readonly ServerLicenseClient _client = new();

    public NativeLicenseState? VerifiedState { get; private set; }

    public LicenseActivationDialog(Window owner, NativeLicenseState? existing = null)
    {
        Owner = owner;
        Title = "اتصال سرور و فعال‌سازی لایسنس اشک قلم";
        Width = 600;
        Height = 680;
        MinHeight = 480;
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

        var root = new StackPanel { Margin = new Thickness(14) };
        root.Children.Add(new Border
        {
            Background = PaletteBrush("#F0FDFA"),
            BorderBrush = PaletteBrush("#99F6E4"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(12),
            Margin = new Thickness(0, 0, 0, 12),
            Child = new TextBlock
            {
                Text = "درخواست فعال‌سازی از طریق HTTPS انجام می‌شود. لایسنس فقط پس از تأیید سرور و اعتبارسنجی رسید RSA-SHA256 پذیرفته می‌شود؛ کلید خصوصی در این برنامه نگهداری نمی‌شود.",
                FontSize = 12,
                Foreground = PaletteBrush("#115E59"),
                TextWrapping = TextWrapping.Wrap
            }
        });

        var licenseSection = new StackPanel();
        AddField(licenseSection, "شناسه فضای کاری (Workspace ID)", _workspace);
        AddField(licenseSection, "کلید لایسنس", _licenseKey);
        AddField(licenseSection, "نام شرکت (نمایشی؛ اختیاری)", _company);
        root.Children.Add(CreateSectionCard(
            "۱. مشخصات لایسنس",
            "شناسه فضای کاری و کلید معتبر را از مرجع رسمی دریافت کنید.",
            licenseSection));

        var deviceSection = new StackPanel();
        AddField(deviceSection, "شناسه سخت‌افزاری این رایانه", _hardwareId);
        root.Children.Add(CreateSectionCard(
            "۲. اتصال دستگاه",
            "شناسه سخت‌افزاری به کلید و فضای کاری متصل است؛ فقط در صورت نیاز آن را کپی کنید.",
            deviceSection));

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 8, 22, 8) };
        actions.Children.Add(_copy);
        actions.Children.Add(_verify);
        actions.Children.Add(new Button { Content = "بستن", Width = 80, Height = 38, Margin = new Thickness(8, 0, 0, 0), IsCancel = true });
        root.Children.Add(new Border
        {
            Background = PaletteBrush("#F8FAFC"),
            BorderBrush = PaletteBrush("#CBD5E1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(10),
            Margin = new Thickness(0, 0, 0, 8),
            Child = new TextBlock
            {
                Text = "وضعیت تأییدشده با DPAPI برای حساب جاری Windows رمزگذاری می‌شود. این پنجره به‌تنهایی اثبات‌کنندهٔ فعال بودن همهٔ ماژول‌ها نیست.",
                FontSize = 11,
                Foreground = PaletteBrush("#334155"),
                TextWrapping = TextWrapping.Wrap
            }
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
