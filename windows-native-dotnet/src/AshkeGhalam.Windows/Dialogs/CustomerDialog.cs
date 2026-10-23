using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class CustomerDialog : Window
{
    private readonly TextBox _code = new();
    private readonly TextBox _name = new();
    private readonly TextBox _phone = new();
    private readonly TextBox _email = new();
    private readonly TextBox _category = new();
    private readonly TextBox _nationalId = new();
    private readonly TextBox _address = new();
    private readonly TextBox _notes = new() { Height = 65, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
    private readonly CheckBox _isCustomer = new() { Content = "مشتری (امکان صدور فاکتور فروش)", Margin = new Thickness(0, 5, 0, 0) };
    private readonly CheckBox _isSupplier = new() { Content = "تأمین‌کننده", Margin = new Thickness(0, 5, 0, 0) };
    private readonly CustomerRecord? _existing;

    public CustomerRecord? Result { get; private set; }

    public CustomerDialog(
        Window owner,
        CustomerRecord? existing = null,
        string suggestedCode = "",
        bool defaultSupplier = false)
    {
        _existing = existing;
        Owner = owner;
        Title = existing is null ? "ثبت شخص جدید" : "ویرایش پرونده شخص";
        Width = 565;
        Height = 735;
        MinHeight = 600;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _code.Text = existing?.Code ?? suggestedCode;
        _name.Text = existing?.Name ?? "";
        _phone.Text = existing?.Phone ?? "";
        _email.Text = existing?.Email ?? "";
        _category.Text = existing?.Category ?? "عمومی";
        _nationalId.Text = existing?.NationalId ?? "";
        _address.Text = existing?.Address ?? "";
        _notes.Text = existing?.Notes ?? "";
        _isCustomer.IsChecked = existing?.IsCustomer ?? !defaultSupplier;
        _isSupplier.IsChecked = existing?.IsSupplier ?? defaultSupplier;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = existing is null ? "پرونده شخص / مشتری / تأمین‌کننده" : "ویرایش پرونده شخص",
            FontSize = 21,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "فیلدها از مدل اشخاص نسخهٔ اصلی اقتباس شده‌اند. ماندهٔ حساب باید از دفتر مالی محاسبه شود و در این فرم قابل دست‌کاری نیست.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });

        AddField(root, "کد شخص (خودکار پیشنهاد شده؛ قابل ویرایش و باید یکتا باشد)", _code);
        AddField(root, "نام شخص / نام شرکت (الزامی)", _name);
        AddField(root, "گروه / دسته‌بندی", _category);
        root.Children.Add(_isCustomer);
        root.Children.Add(_isSupplier);
        AddField(root, "شماره تماس", _phone);
        AddField(root, "ایمیل", _email);
        AddField(root, "شناسه ملی", _nationalId);
        AddField(root, "نشانی", _address);
        AddField(root, "یادداشت پرونده", _notes);

        var savedBalance = existing?.Balance ?? 0m;
        root.Children.Add(new TextBlock
        {
            Text = "ماندهٔ ذخیره‌شده: " + savedBalance.ToString("N2", CultureInfo.CurrentCulture) + " (این فرم ماندهٔ دفتر حساب را تغییر نمی‌دهد.)",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            Margin = new Thickness(0, 7, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 18, 0, 0)
        };
        var save = new Button
        {
            Content = existing is null ? "ذخیره شخص" : "ثبت تغییرات",
            Width = 120,
            Height = 36,
            Margin = new Thickness(0, 0, 8, 0),
            IsDefault = true
        };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, IsCancel = true });
        root.Children.Add(buttons);

        Content = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = root
        };

        save.Click += (_, _) => SaveResult();
    }

    private void SaveResult()
    {
        var name = _name.Text.Trim();
        var isCustomer = _isCustomer.IsChecked == true;
        var isSupplier = _isSupplier.IsChecked == true;
        if (name.Length < 2)
        {
            MessageBox.Show(this, "نام شخص باید حداقل دو نویسه باشد.", "بررسی اطلاعات", MessageBoxButton.OK, MessageBoxImage.Warning);
            _name.Focus();
            return;
        }
        if (!isCustomer && !isSupplier)
        {
            MessageBox.Show(this, "شخص باید دست‌کم یکی از نقش‌های مشتری یا تأمین‌کننده را داشته باشد.", "بررسی اطلاعات", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        Result = new CustomerRecord
        {
            Id = _existing?.Id ?? Guid.NewGuid().ToString("N"),
            Code = _code.Text.Trim(),
            Name = name,
            Phone = _phone.Text.Trim(),
            Email = _email.Text.Trim(),
            Category = string.IsNullOrWhiteSpace(_category.Text) ? "عمومی" : _category.Text.Trim(),
            Type = isSupplier && !isCustomer ? "VENDOR" : "CUSTOMER",
            IsCustomer = isCustomer,
            IsSupplier = isSupplier,
            Address = _address.Text.Trim(),
            NationalId = _nationalId.Text.Trim(),
            Notes = _notes.Text.Trim(),
            Balance = _existing?.Balance ?? 0m,
            CreatedAt = _existing?.CreatedAt ?? DateTimeOffset.Now
        };
        DialogResult = true;
    }

    private static void AddField(Panel root, string label, TextBox field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 6, 0, 4)
        });
        field.Height = field.AcceptsReturn ? 65 : 32;
        field.Margin = new Thickness(0, 0, 0, 4);
        field.Padding = new Thickness(8, 5, 8, 5);
        root.Children.Add(field);
    }
}
