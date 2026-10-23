using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class CheckDialog : Window
{
    private sealed record ChoiceItem(string Value, string Label);

    private static readonly ChoiceItem[] CheckTypes =
    [
        new("RECEIVED", "چک دریافتی"),
        new("ISSUED", "چک پرداختی")
    ];

    private static readonly ChoiceItem[] CheckStatuses =
    [
        new("PENDING", "در انتظار"),
        new("DEPOSITED", "واگذار به بانک"),
        new("PASSED", "پاس‌شده"),
        new("BOUNCED", "برگشتی"),
        new("TRANSFERRED", "واگذار شده"),
        new("CASHED", "وصول‌شده"),
        new("RETURNED", "عودت‌شده")
    ];

    private readonly TextBox _bankName = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _amount = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _dueDate = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _issueDate = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _sayadId = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _checkNumber = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _holderName = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _personName = new() { Height = 32, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _description = new() { Height = 72, Padding = new Thickness(8, 4, 8, 4), AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
    private readonly ComboBox _checkType = new() { Height = 32, DisplayMemberPath = nameof(ChoiceItem.Label), ItemsSource = CheckTypes };
    private readonly ComboBox _status = new() { Height = 32, DisplayMemberPath = nameof(ChoiceItem.Label), ItemsSource = CheckStatuses };
    private readonly CheckBox _highPriority = new() { Content = "این چک در اولویت پیگیری قرار دارد", Margin = new Thickness(0, 10, 0, 0) };
    private readonly CheckRecord? _existing;

    public CheckRecord? Result { get; private set; }

    public CheckDialog(Window owner, CheckRecord? existing = null)
    {
        _existing = existing;
        Owner = owner;
        Title = existing is null ? "ثبت چک جدید" : "ویرایش مشخصات چک";
        Width = 590;
        Height = 760;
        MinHeight = 620;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _bankName.Text = existing?.BankName ?? "";
        _amount.Text = existing?.Amount.ToString("0.##", CultureInfo.InvariantCulture) ?? "";
        _dueDate.Text = FormatPersianDate(existing?.DueDate ?? DateTimeOffset.Now.Date.AddDays(30));
        _issueDate.Text = existing?.IssueDate is DateTimeOffset issue ? FormatPersianDate(issue) : "";
        _sayadId.Text = existing?.SayadId ?? "";
        _checkNumber.Text = existing?.CheckNumber ?? "";
        _holderName.Text = existing?.HolderName ?? "";
        _personName.Text = existing?.PersonName ?? "";
        _description.Text = existing?.Description ?? "";
        _checkType.SelectedItem = CheckTypes.First(x => x.Value == (existing?.CheckType ?? "RECEIVED"));
        _status.SelectedItem = CheckStatuses.First(x => x.Value == (existing?.Status ?? "PENDING"));
        _highPriority.IsChecked = existing?.IsHighPriority ?? false;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = existing is null ? "اطلاعات چک" : "ویرایش اطلاعات چک",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 15)
        });
        root.Children.Add(new TextBlock
        {
            Text = "تاریخ‌ها به شمسی وارد شوند؛ این فرم فقط ثبت محلی است و وضعیت بانک را آنلاین استعلام نمی‌کند.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });

        AddField(root, "نوع چک", _checkType);
        AddField(root, "نام بانک (الزامی)", _bankName);
        AddField(root, "مبلغ (الزامی)", _amount);
        AddField(root, "تاریخ سررسید شمسی (الزامی؛ مثال: ۱۴۰۵/۰۸/۰۱)", _dueDate);
        AddField(root, "تاریخ صدور شمسی (اختیاری)", _issueDate);
        AddField(root, "شناسه صیادی", _sayadId);
        AddField(root, "شماره چک", _checkNumber);
        AddField(root, "نام دارنده / ذی‌نفع (الزامی)", _holderName);
        AddField(root, "شخص مرتبط (اختیاری)", _personName);
        AddField(root, "وضعیت ثبت‌شده", _status);
        AddField(root, "توضیحات", _description);
        root.Children.Add(_highPriority);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 18, 0, 0)
        };
        var save = new Button
        {
            Content = existing is null ? "ذخیره چک" : "ثبت تغییرات",
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
        try
        {
            var bank = _bankName.Text.Trim();
            var holder = _holderName.Text.Trim();
            if (bank.Length < 2) throw new InvalidOperationException("نام بانک را وارد کنید.");
            if (holder.Length < 2) throw new InvalidOperationException("نام دارنده یا ذی‌نفع را وارد کنید.");

            var amount = AccountingRules.Money(PersianNumberParser.ParseDecimal(_amount.Text, "مبلغ چک"));
            if (amount <= 0m) throw new InvalidOperationException("مبلغ چک باید بیشتر از صفر باشد.");

            var dueDate = ParsePersianDate(_dueDate.Text, "تاریخ سررسید");
            DateTimeOffset? issueDate = string.IsNullOrWhiteSpace(_issueDate.Text)
                ? null
                : ParsePersianDate(_issueDate.Text, "تاریخ صدور");

            var type = _checkType.SelectedItem as ChoiceItem
                ?? throw new InvalidOperationException("نوع چک را انتخاب کنید.");
            var status = _status.SelectedItem as ChoiceItem
                ?? throw new InvalidOperationException("وضعیت چک را انتخاب کنید.");

            var history = _existing?.History.Select(h => new CheckHistoryRecord
            {
                ChangedAt = h.ChangedAt,
                Status = h.Status,
                Note = h.Note
            }).ToList() ?? [];

            var oldStatus = _existing?.Status ?? "";
            if (_existing is null || !string.Equals(oldStatus, status.Value, StringComparison.Ordinal))
                history.Add(new CheckHistoryRecord
                {
                    ChangedAt = DateTimeOffset.Now,
                    Status = status.Value,
                    Note = _existing is null ? "ثبت اولیه در نسخهٔ بومی ویندوز" : "تغییر وضعیت از فرم ویرایش"
                });

            Result = new CheckRecord
            {
                Id = _existing?.Id ?? Guid.NewGuid().ToString("N"),
                BankName = bank,
                Amount = amount,
                DueDate = dueDate,
                IssueDate = issueDate,
                Status = status.Value,
                SayadId = _sayadId.Text.Trim(),
                CheckNumber = _checkNumber.Text.Trim(),
                HolderName = holder,
                PersonId = _existing?.PersonId ?? "",
                PersonName = _personName.Text.Trim(),
                RelatedInvoiceId = _existing?.RelatedInvoiceId ?? "",
                ImagePath = _existing?.ImagePath ?? "",
                IsHighPriority = _highPriority.IsChecked == true,
                Description = _description.Text.Trim(),
                CheckType = type.Value,
                CreatedAt = _existing?.CreatedAt ?? DateTimeOffset.Now,
                History = history
            };
            DialogResult = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی اطلاعات چک", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static DateTimeOffset ParsePersianDate(string value, string fieldName)
    {
        var normalized = value.Trim().Replace('-', '/').Replace('.', '/');
        var parts = normalized.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3)
            throw new InvalidOperationException(fieldName + " را به‌صورت سال/ماه/روز شمسی وارد کنید.");

        var year = checked((int)PersianNumberParser.ParseDecimal(parts[0], fieldName));
        var month = checked((int)PersianNumberParser.ParseDecimal(parts[1], fieldName));
        var day = checked((int)PersianNumberParser.ParseDecimal(parts[2], fieldName));
        try
        {
            var calendar = new PersianCalendar();
            var local = calendar.ToDateTime(year, month, day, 0, 0, 0, 0, PersianCalendar.PersianEra);
            return new DateTimeOffset(local, TimeZoneInfo.Local.GetUtcOffset(local));
        }
        catch (ArgumentOutOfRangeException)
        {
            throw new InvalidOperationException(fieldName + " معتبر نیست.");
        }
    }

    private static string FormatPersianDate(DateTimeOffset value)
    {
        var calendar = new PersianCalendar();
        return string.Format(CultureInfo.InvariantCulture, "{0:0000}/{1:00}/{2:00}",
            calendar.GetYear(value.DateTime), calendar.GetMonth(value.DateTime), calendar.GetDayOfMonth(value.DateTime));
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 7, 0, 4)
        });
        field.Margin = new Thickness(0, 0, 0, 7);
        root.Children.Add(field);
    }
}
