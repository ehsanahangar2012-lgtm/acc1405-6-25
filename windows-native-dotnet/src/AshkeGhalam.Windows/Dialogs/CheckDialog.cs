using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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

    private static readonly string[] IranianBanks =
    [
        "بانک ملی ایران",
        "بانک سپه",
        "بانک صادرات ایران",
        "بانک ملت",
        "بانک تجارت",
        "بانک مسکن",
        "بانک کشاورزی",
        "بانک رفاه کارگران",
        "پست بانک ایران",
        "بانک توسعه تعاون",
        "بانک توسعه صادرات ایران",
        "بانک صنعت و معدن",
        "بانک اقتصاد نوین",
        "بانک پارسیان",
        "بانک پاسارگاد",
        "بانک کارآفرین",
        "بانک سامان",
        "بانک سرمایه",
        "بانک سینا",
        "بانک شهر",
        "بانک دی",
        "بانک گردشگری",
        "بانک ایران‌زمین",
        "بانک خاورمیانه",
        "بانک قرض‌الحسنه مهر ایران",
        "بانک قرض‌الحسنه رسالت",
        "بانک مشترک ایران و ونزوئلا"
    ];

    private readonly ComboBox _bankName = new()
    {
        Height = 36,
        ItemsSource = IranianBanks,
        IsEditable = true,
        IsTextSearchEnabled = true,
        StaysOpenOnEdit = true
    };
    private readonly TextBox _amount = new()
    {
        Height = 36,
        Padding = new Thickness(10, 5, 10, 5),
        FlowDirection = FlowDirection.LeftToRight,
        HorizontalContentAlignment = HorizontalAlignment.Right
    };
    private readonly PersianDateSelector _dueDate;
    private readonly PersianDateSelector _issueDate;
    private readonly TextBox _sayadId = new() { Height = 36, Padding = new Thickness(10, 5, 10, 5), FlowDirection = FlowDirection.LeftToRight };
    private readonly TextBox _checkNumber = new() { Height = 36, Padding = new Thickness(10, 5, 10, 5), FlowDirection = FlowDirection.LeftToRight };
    private readonly ComboBox _holderName = new()
    {
        Height = 36, Padding = new Thickness(8, 4, 8, 4), IsEditable = true,
        IsTextSearchEnabled = true, StaysOpenOnEdit = true
    };
    private readonly ComboBox _personName = new()
    {
        Height = 36, Padding = new Thickness(8, 4, 8, 4), IsEditable = true,
        IsTextSearchEnabled = true, StaysOpenOnEdit = true,
        DisplayMemberPath = nameof(CustomerRecord.Name)
    };
    private IReadOnlyList<CustomerRecord> _people = [];
    private bool _formattingAmount;
    private readonly TextBox _description = new()
    {
        Height = 90,
        Padding = new Thickness(10, 5, 10, 5),
        AcceptsReturn = true,
        TextWrapping = TextWrapping.Wrap,
        VerticalScrollBarVisibility = ScrollBarVisibility.Auto
    };
    private readonly ComboBox _checkType = new() { Height = 36, DisplayMemberPath = nameof(ChoiceItem.Label), ItemsSource = CheckTypes };
    private readonly ComboBox _status = new() { Height = 36, DisplayMemberPath = nameof(ChoiceItem.Label), ItemsSource = CheckStatuses };
    private readonly CheckBox _highPriority = new() { Content = "این چک در اولویت پیگیری قرار دارد", Margin = new Thickness(0, 12, 0, 0) };
    private readonly CheckRecord? _existing;
    private readonly ScrollViewer _stepHost = new() { VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
    private readonly TextBlock _stepIndicator = new() { FontSize = 12, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 8, 0, 12) };
    private readonly Button _previousButton = new() { Content = "مرحله قبل", MinWidth = 104, Height = 38, Margin = new Thickness(0, 0, 8, 0) };
    private readonly Button _nextButton = new() { Content = "ادامه", MinWidth = 104, Height = 38, IsDefault = true };
    private readonly Button _saveButton = new() { Content = "ذخیره نهایی چک", MinWidth = 138, Height = 38, IsDefault = true, Visibility = Visibility.Collapsed };
    private readonly StackPanel[] _steps;
    private int _currentStep;

    public CheckRecord? Result { get; private set; }

    public CheckDialog(Window owner, CheckRecord? existing = null, IReadOnlyList<CustomerRecord>? people = null)
    {
        _existing = existing;
        _people = people ?? [];
        _dueDate = new PersianDateSelector(existing?.DueDate ?? DateTimeOffset.Now.AddDays(30));
        _issueDate = new PersianDateSelector(existing?.IssueDate, optional: true);

        Owner = owner;
        Title = existing is null ? "ثبت حرفه‌ای چک" : "ویرایش مشخصات چک";
        Width = 650;
        Height = 790;
        MinWidth = 590;
        MinHeight = 680;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");

        _bankName.Text = existing?.BankName ?? "";
        _amount.Text = existing?.Amount.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR")) ?? "";
        _sayadId.Text = existing?.SayadId ?? "";
        _checkNumber.Text = existing?.CheckNumber ?? "";
        _holderName.ItemsSource = _people.Select(person => person.Name).Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.CurrentCultureIgnoreCase).OrderBy(name => name).ToList();
        _holderName.Text = existing?.HolderName ?? "";
        _personName.ItemsSource = _people.Where(person => person.IsCustomer || person.IsSupplier).OrderBy(person => person.Name).ToList();
        _personName.Text = existing?.PersonName ?? "";
        if (existing is not null)
        {
            var linkedPerson = _people.FirstOrDefault(person => person.Id == existing.PersonId)
                ?? _people.FirstOrDefault(person => string.Equals(person.Name, existing.PersonName, StringComparison.CurrentCultureIgnoreCase));
            if (linkedPerson is not null) _personName.SelectedItem = linkedPerson;
        }
        _description.Text = existing?.Description ?? "";
        _checkType.SelectedItem = CheckTypes.First(item => item.Value == (existing?.CheckType ?? "RECEIVED"));
        _status.SelectedItem = CheckStatuses.First(item => item.Value == (existing?.Status ?? "PENDING"));
        _highPriority.IsChecked = existing?.IsHighPriority ?? false;
        _amount.LostFocus += (_, _) => FormatAmount();
        _amount.TextChanged += Amount_TextChanged;
        foreach (var combo in new[] { _bankName, _holderName, _personName, _checkType, _status })
            AttachDropDownOpen(combo);

        var header = new StackPanel();
        header.Children.Add(new TextBlock
        {
            Text = existing is null ? "ثبت چک جدید" : "ویرایش چک",
            FontSize = 24,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42))
        });
        header.Children.Add(new TextBlock
        {
            Text = "فرم مرحله‌ای برای ثبت اطلاعات بانکی، تاریخ‌های شمسی و جزئیات پیگیری.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 5, 0, 0)
        });

        var stepOne = new StackPanel { Margin = new Thickness(2, 4, 2, 12) };
        AddField(stepOne, "نوع چک", _checkType);
        AddField(stepOne, "بانک (از فهرست انتخاب کنید یا نام دیگری بنویسید)", _bankName);
        AddField(stepOne, "مبلغ چک", _amount);
        AddField(stepOne, "تاریخ سررسید شمسی (الزامی)", _dueDate);
        stepOne.Children.Add(new TextBlock
        {
            Text = "با انتخاب سال، ماه و روز، تاریخ شمسی معتبر ساخته می‌شود.",
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            FontSize = 11,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 4, 0, 0)
        });

        var stepTwo = new StackPanel { Margin = new Thickness(2, 4, 2, 12) };
        AddField(stepTwo, "تاریخ صدور شمسی (اختیاری)", _issueDate);
        AddField(stepTwo, "شماره چک", _checkNumber);
        AddField(stepTwo, "شناسه صیادی", _sayadId);
        AddField(stepTwo, "نام دارنده / ذی‌نفع (الزامی)", _holderName);
        AddField(stepTwo, "شخص مرتبط (اختیاری)", _personName);

        var stepThree = new StackPanel { Margin = new Thickness(2, 4, 2, 12) };
        AddField(stepThree, "وضعیت فعلی چک", _status);
        stepThree.Children.Add(_highPriority);
        AddField(stepThree, "توضیحات و یادداشت پیگیری", _description);
        stepThree.Children.Add(new TextBlock
        {
            Text = "وضعیت و سوابق در همین برنامه ذخیره می‌شوند؛ این فرم استعلام آنلاین بانکی یا تأیید وصول انجام نمی‌دهد.",
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            FontSize = 11,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 8, 0, 0)
        });

        _steps = [stepOne, stepTwo, stepThree];

        var footer = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 14, 0, 0)
        };
        _previousButton.Click += (_, _) => ShowStep(_currentStep - 1);
        _nextButton.Click += (_, _) =>
        {
            if (!ValidateCurrentStep()) return;
            ShowStep(_currentStep + 1);
        };
        _saveButton.Click += (_, _) => SaveResult();
        footer.Children.Add(_previousButton);
        footer.Children.Add(_nextButton);
        footer.Children.Add(_saveButton);
        footer.Children.Add(new Button { Content = "انصراف", MinWidth = 90, Height = 38, Margin = new Thickness(8, 0, 0, 0), IsCancel = true });

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(header);
        root.Children.Add(_stepIndicator);
        root.Children.Add(_stepHost);
        root.Children.Add(footer);
        Content = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = root
        };

        ShowStep(0);
    }

    private void ShowStep(int step)
    {
        _currentStep = Math.Clamp(step, 0, _steps.Length - 1);
        _stepHost.Content = _steps[_currentStep];
        _stepIndicator.Text = $"مرحله {_currentStep + 1} از {_steps.Length}  •  " + new[] { "نوع، بانک و مبلغ", "تاریخ و اشخاص", "وضعیت و یادداشت" }[_currentStep];
        _previousButton.IsEnabled = _currentStep > 0;
        _nextButton.Visibility = _currentStep < _steps.Length - 1 ? Visibility.Visible : Visibility.Collapsed;
        _saveButton.Visibility = _currentStep == _steps.Length - 1 ? Visibility.Visible : Visibility.Collapsed;
        _nextButton.IsDefault = _currentStep < _steps.Length - 1;
        _saveButton.IsDefault = _currentStep == _steps.Length - 1;
        _stepHost.ScrollToTop();
    }

    private bool ValidateCurrentStep()
    {
        try
        {
            if (_currentStep == 0)
            {
                if (_bankName.Text.Trim().Length < 2)
                    throw new InvalidOperationException("بانک را از فهرست انتخاب کنید یا نام آن را وارد کنید.");
                if (AccountingRules.Money(PersianNumberParser.ParseDecimal(_amount.Text, "مبلغ چک")) <= 0m)
                    throw new InvalidOperationException("مبلغ چک باید بیشتر از صفر باشد.");
                if (_dueDate.SelectedDate is null)
                    throw new InvalidOperationException("تاریخ سررسید را از انتخاب‌گر شمسی کامل کنید.");
            }
            else if (_currentStep == 1 && _holderName.Text.Trim().Length < 2)
            {
                throw new InvalidOperationException("نام دارنده یا ذی‌نفع را وارد کنید.");
            }
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "تکمیل مرحله", MessageBoxButton.OK, MessageBoxImage.Information);
            return false;
        }
    }

    private void Amount_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (_formattingAmount || !_amount.IsKeyboardFocusWithin) return;
        var current = _amount.Text;
        if (string.IsNullOrWhiteSpace(current)) return;
        var endsWithDecimal = current.EndsWith(".", StringComparison.Ordinal) ||
            current.EndsWith("٫", StringComparison.Ordinal);
        if (!PersianNumberParser.TryParseDecimal(current, out var value)) return;

        var oldCaret = Math.Clamp(_amount.CaretIndex, 0, current.Length);
        var digitsBeforeCaret = current.Take(oldCaret).Count(char.IsDigit);
        var formatted = value.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
        if (endsWithDecimal && !formatted.Contains('٫') && !formatted.Contains('.')) formatted += "٫";
        if (formatted == current) return;

        _formattingAmount = true;
        try
        {
            _amount.Text = formatted;
            var digitCount = 0;
            var caret = formatted.Length;
            for (var i = 0; i < formatted.Length; i++)
            {
                if (char.IsDigit(formatted[i])) digitCount++;
                if (digitCount >= digitsBeforeCaret)
                {
                    caret = Math.Min(formatted.Length, i + 1);
                    break;
                }
            }
            _amount.CaretIndex = caret;
        }
        finally { _formattingAmount = false; }
    }

    private void FormatAmount()
    {
        if (PersianNumberParser.TryParseDecimal(_amount.Text, out var value))
            _amount.Text = value.ToString("#,##0.##", CultureInfo.GetCultureInfo("fa-IR"));
    }

    private static void AttachDropDownOpen(ComboBox combo)
    {
        combo.PreviewMouseLeftButtonDown += (_, _) =>
            combo.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Input,
                new Action(() => { if (combo.IsEnabled && combo.IsVisible) combo.IsDropDownOpen = true; }));
        combo.GotKeyboardFocus += (_, _) =>
            combo.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Input,
                new Action(() => { if (combo.IsEnabled && combo.IsVisible) combo.IsDropDownOpen = true; }));
    }

    private void SaveResult()
    {
        try
        {
            if (!ValidateCurrentStep()) return;
            var bank = _bankName.Text.Trim();
            var holder = _holderName.Text.Trim();
            var amount = AccountingRules.Money(PersianNumberParser.ParseDecimal(_amount.Text, "مبلغ چک"));
            var dueDate = _dueDate.SelectedDate
                ?? throw new InvalidOperationException("تاریخ سررسید را از انتخاب‌گر شمسی کامل کنید.");
            var issueDate = _issueDate.SelectedDate;
            var linkedPerson = _personName.SelectedItem as CustomerRecord;
            if (linkedPerson is not null &&
                !string.Equals(linkedPerson.Name, _personName.Text.Trim(), StringComparison.CurrentCultureIgnoreCase))
                linkedPerson = null;
            var type = _checkType.SelectedItem as ChoiceItem
                ?? throw new InvalidOperationException("نوع چک را انتخاب کنید.");
            var status = _status.SelectedItem as ChoiceItem
                ?? throw new InvalidOperationException("وضعیت چک را انتخاب کنید.");

            if (bank.Length < 2) throw new InvalidOperationException("نام بانک را وارد کنید.");
            if (holder.Length < 2) throw new InvalidOperationException("نام دارنده یا ذی‌نفع را وارد کنید.");
            if (amount <= 0m) throw new InvalidOperationException("مبلغ چک باید بیشتر از صفر باشد.");

            var history = _existing?.History.Select(item => new CheckHistoryRecord
            {
                ChangedAt = item.ChangedAt,
                Status = item.Status,
                Note = item.Note
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
                PersonId = linkedPerson?.Id ?? "",
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

    private static void AddField(Panel root, string label, FrameworkElement field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 8, 0, 4)
        });
        field.Margin = new Thickness(0, 0, 0, 5);
        root.Children.Add(field);
    }

    private sealed class PersianDateSelector : StackPanel
    {
        private static readonly string[] MonthNames =
        [
            "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
            "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
        ];

        private readonly ComboBox _year = new() { MinWidth = 82, Height = 36, Margin = new Thickness(0, 0, 6, 0) };
        private readonly ComboBox _month = new() { MinWidth = 120, Height = 36, Margin = new Thickness(0, 0, 6, 0) };
        private readonly ComboBox _day = new() { MinWidth = 68, Height = 36 };
        private readonly bool _optional;
        private bool _updating;

        public PersianDateSelector(DateTimeOffset? initialDate, bool optional = false)
        {
            Orientation = Orientation.Horizontal;
            FlowDirection = FlowDirection.RightToLeft;
            _optional = optional;
            var calendar = new PersianCalendar();
            var currentYear = calendar.GetYear(DateTime.Now);
            _year.ItemsSource = Enumerable.Range(Math.Max(1300, currentYear - 30), 61).ToList();
            _month.ItemsSource = MonthNames;
            _day.ItemsSource = Enumerable.Range(1, 31).ToList();
            AttachDropDownOpen(_year);
            AttachDropDownOpen(_month);
            AttachDropDownOpen(_day);
            _year.SelectionChanged += (_, _) => RefreshDayChoices();
            _month.SelectionChanged += (_, _) => RefreshDayChoices();
            Children.Add(_year);
            Children.Add(_month);
            Children.Add(_day);

            if (optional)
            {
                var clear = new Button
                {
                    Content = "×",
                    Width = 34,
                    Height = 36,
                    Margin = new Thickness(6, 0, 0, 0),
                    ToolTip = "پاک‌کردن تاریخ"
                };
                clear.Click += (_, _) => Clear();
                Children.Add(clear);
            }

            if (initialDate is DateTimeOffset value)
                SetDate(value);
            else if (!optional)
                SetDate(DateTimeOffset.Now.AddDays(30));
            else
                Clear();
        }

        public DateTimeOffset? SelectedDate
        {
            get
            {
                if (_year.SelectedItem is not int year ||
                    _month.SelectedIndex < 0 ||
                    _day.SelectedItem is not int day)
                    return null;

                try
                {
                    var local = new PersianCalendar().ToDateTime(
                        year, _month.SelectedIndex + 1, day, 0, 0, 0, 0, PersianCalendar.PersianEra);
                    return new DateTimeOffset(local, TimeZoneInfo.Local.GetUtcOffset(local));
                }
                catch (ArgumentOutOfRangeException)
                {
                    return null;
                }
            }
        }

        private void SetDate(DateTimeOffset value)
        {
            var calendar = new PersianCalendar();
            var year = calendar.GetYear(value.DateTime);
            var month = calendar.GetMonth(value.DateTime);
            var day = calendar.GetDayOfMonth(value.DateTime);

            _updating = true;
            var years = (_year.ItemsSource as IEnumerable<int>)?.ToList() ?? [];
            if (!years.Contains(year))
            {
                years.Add(year);
                years.Sort();
                _year.ItemsSource = years;
            }
            _year.SelectedItem = year;
            _month.SelectedIndex = month - 1;
            _updating = false;

            RefreshDayChoices();
            _updating = true;
            _day.SelectedItem = day;
            _updating = false;
        }

        private void Clear()
        {
            _updating = true;
            _year.SelectedIndex = -1;
            _month.SelectedIndex = -1;
            _day.SelectedIndex = -1;
            _updating = false;
        }

        private void RefreshDayChoices()
        {
            if (_updating || _year.SelectedItem is not int year || _month.SelectedIndex < 0)
                return;

            var previousDay = _day.SelectedItem is int day ? day : 1;
            var month = _month.SelectedIndex + 1;
            int days;
            try
            {
                days = new PersianCalendar().GetDaysInMonth(year, month, PersianCalendar.PersianEra);
            }
            catch (ArgumentOutOfRangeException)
            {
                days = month <= 6 ? 31 : month == 12 ? 29 : 30;
            }

            _day.ItemsSource = Enumerable.Range(1, days).ToList();
            _day.SelectedItem = Math.Min(previousDay, days);
        }
    }
}
