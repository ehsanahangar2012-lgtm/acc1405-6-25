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
    private readonly IReadOnlyList<CustomerRecord> _knownPeople;

    public CustomerRecord? Result { get; private set; }

    public CustomerDialog(
        Window owner,
        CustomerRecord? existing = null,
        string suggestedCode = "",
        bool defaultSupplier = false,
        IReadOnlyList<CustomerRecord>? knownPeople = null)
    {
        _existing = existing;
        _knownPeople = knownPeople?.ToList() ?? (existing is null ? [] : [existing]);
        Owner = owner;
        Title = existing is null ? "ثبت شخص جدید" : "ویرایش پرونده شخص";
        Width = 565;
        Height = 735;
        MinHeight = 600;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
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

        var root = new StackPanel { Margin = new Thickness(16) };

        var identityPrimary = new StackPanel();
        AddField(identityPrimary, "کد شخص (پیشنهادی؛ باید یکتا باشد)", _code);
        AddField(identityPrimary, "نام شخص / نام شرکت (الزامی)", _name);
        var identitySecondary = new StackPanel();
        AddField(identitySecondary, "گروه / دسته‌بندی", _category);
        root.Children.Add(CreateSectionCard(
            "۱. مشخصات پایه",
            "کد و نامی که در فاکتورها، رسیدها و گزارش‌ها نمایش داده می‌شود",
            CreateTwoColumnGrid(identityPrimary, identitySecondary)));

        var rolesSection = new StackPanel();
        rolesSection.Children.Add(new TextBlock
        {
            Text = "یک شخص می‌تواند مشتری، تأمین‌کننده یا هر دو نقش را داشته باشد. این انتخاب تعیین می‌کند در کدام اسناد قابل انتخاب باشد.",
            FontSize = 12,
            Foreground = PaletteBrush("#475569"),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 8)
        });
        _isCustomer.Margin = new Thickness(0, 3, 0, 3);
        _isSupplier.Margin = new Thickness(0, 3, 0, 3);
        rolesSection.Children.Add(_isCustomer);
        rolesSection.Children.Add(_isSupplier);
        root.Children.Add(CreateSectionCard("۲. نقش حسابداری", "تعیین نقش‌های فعال این پرونده", rolesSection));

        var contactPrimary = new StackPanel();
        AddField(contactPrimary, "شماره تماس", _phone);
        AddField(contactPrimary, "ایمیل", _email);
        var contactSecondary = new StackPanel();
        AddField(contactSecondary, "شناسه ملی", _nationalId);
        AddField(contactSecondary, "نشانی", _address);
        root.Children.Add(CreateSectionCard(
            "۳. اطلاعات تماس",
            "اطلاعات اختیاری برای شناسایی و ارتباط با طرف حساب",
            CreateTwoColumnGrid(contactPrimary, contactSecondary)));

        var notesSection = new StackPanel();
        AddField(notesSection, "یادداشت پرونده", _notes);
        var savedBalance = existing?.Balance ?? 0m;
        notesSection.Children.Add(new Border
        {
            Background = PaletteBrush("#F1F5F9"),
            BorderBrush = PaletteBrush("#CBD5E1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(11, 8, 11, 8),
            Margin = new Thickness(0, 8, 0, 0),
            Child = new TextBlock
            {
                Text = "ماندهٔ ذخیره‌شده: " + savedBalance.ToString("N2", CultureInfo.CurrentCulture) +
                    " — ماندهٔ دفتر مالی از این فرم قابل تغییر نیست.",
                FontSize = 12,
                Foreground = PaletteBrush("#334155"),
                TextWrapping = TextWrapping.Wrap
            }
        });
        root.Children.Add(CreateSectionCard("۴. یادداشت و مانده", "یادداشت داخلی و اطلاعات صرفاً نمایشی حساب", notesSection));

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
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E"),
            IsDefault = true
        };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, IsCancel = true });
        var layout = new Grid { Margin = new Thickness(0) };
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        buttons.Margin = new Thickness(22, 10, 22, 18);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;

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

        try
        {
            RecordIdentityValidationService.EnsureUniquePersonCode(_knownPeople, _code.Text, _existing?.Id);
        }
        catch (InvalidOperationException ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی کد شخص", MessageBoxButton.OK, MessageBoxImage.Warning);
            _code.Focus();
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

    private static SolidColorBrush PaletteBrush(string value) =>
        new((Color)ColorConverter.ConvertFromString(value)!);

    private static Grid CreateTwoColumnGrid(UIElement first, UIElement second)
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(first, 0);
        Grid.SetColumn(second, 2);
        grid.Children.Add(first);
        var spacer = new Border { Width = 14 };
        Grid.SetColumn(spacer, 1);
        grid.Children.Add(spacer);
        grid.Children.Add(second);
        return grid;
    }

    private static Border CreateSectionCard(string title, string subtitle, UIElement content)
    {
        var heading = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
        heading.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 16,
            FontWeight = FontWeights.Bold,
            Foreground = PaletteBrush("#0F766E")
        });
        heading.Children.Add(new TextBlock
        {
            Text = subtitle,
            FontSize = 11,
            Foreground = PaletteBrush("#64748B"),
            Margin = new Thickness(0, 3, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        var body = new StackPanel();
        body.Children.Add(heading);
        body.Children.Add(content);
        return new Border
        {
            Background = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#CBD5E1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(15),
            Margin = new Thickness(0, 0, 0, 12),
            Child = body
        };
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
