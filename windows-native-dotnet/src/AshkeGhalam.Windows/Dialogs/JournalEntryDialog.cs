using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class JournalEntryDialog : Window
{
    private sealed record Choice(string Value, string Label);

    private readonly TextBox _date = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _description = new() { Height = 62, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, Padding = new Thickness(8) };
    private readonly TextBox _amount = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _fiscalYear = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _referenceId = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly TextBox _referenceType = new() { Height = 34, Padding = new Thickness(8, 4, 8, 4) };
    private readonly ComboBox _debit = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsEditable = true, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
    private readonly ComboBox _credit = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsEditable = true, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300 };
    private readonly ComboBox _documentType = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false };
    private IReadOnlyList<Choice> _accountChoices = [];
    private bool _refreshingCreditChoices;

    public AccountingEntryRecord? Result { get; private set; }

    public JournalEntryDialog(Window owner, IReadOnlyList<ChartOfAccountRecord> accounts)
    {
        Owner = owner;
        NumericTextBoxFormatter.Attach(_amount);
        Title = "ثبت سند حسابداری دوبل";
        Width = 610;
        Height = 690;
        MinHeight = 480;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        var choices = accounts.Where(a => a.IsActive)
            .OrderBy(a => a.Code, StringComparer.OrdinalIgnoreCase)
            .Select(a => new Choice(a.Id, $"{a.Code} — {a.Name}"))
            .ToList();
        _accountChoices = choices;
        _debit.ItemsSource = choices;
        _credit.ItemsSource = choices;
        if (choices.Count > 0) _debit.SelectedIndex = 0;
        if (choices.Count > 1) _credit.SelectedIndex = 1;
        _documentType.ItemsSource = new[]
        {
            new Choice("OPERATIONAL", "سند عملیاتی"),
            new Choice("OPENING", "سند افتتاحیه"),
            new Choice("CLOSING", "سند اختتامیه"),
            new Choice("ADJUSTMENT", "سند اصلاحی")
        };
        _documentType.SelectedIndex = 0;
        _debit.SelectionChanged += (_, _) => RefreshCreditChoices();
        RefreshCreditChoices();

        var calendar = new PersianCalendar();
        var now = DateTime.Now;
        _date.Text = $"{calendar.GetYear(now):0000}/{calendar.GetMonth(now):00}/{calendar.GetDayOfMonth(now):00}";
        _fiscalYear.Text = calendar.GetYear(now).ToString(CultureInfo.InvariantCulture);
        _amount.Text = "0";

        var scroll = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = "سند دوطرفه — ثبت بدهکار و بستانکار",
            FontSize = 21,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "در این مدل هر سند شامل یک بدهکار و یک بستانکار با مبلغ برابر است. اسناد پس از ثبت حذف یا ویرایش نمی‌شوند؛ اصلاح را با سند جدید انجام دهید.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 14)
        });

        AddField(root, "تاریخ شمسی یا میلادی (سال/ماه/روز)", _date);
        AddField(root, "شرح سند", _description);
        AddField(root, "حساب بدهکار", _debit);
        AddField(root, "حساب بستانکار", _credit);
        AddField(root, "مبلغ", _amount);
        AddField(root, "نوع سند", _documentType);
        AddField(root, "سال مالی (اختیاری)", _fiscalYear);
        AddField(root, "شناسه مرجع (اختیاری)", _referenceId);
        AddField(root, "نوع مرجع (اختیاری)", _referenceType);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var save = new Button { Content = "ثبت قطعی سند", Width = 135, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        scroll.Content = root;
        Grid.SetRow(scroll, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(scroll);
        layout.Children.Add(buttons);
        Content = layout;

        save.Click += (_, _) =>
        {
            try
            {
                var debitId = (_debit.SelectedItem as Choice)?.Value ?? throw new InvalidOperationException("حساب بدهکار را انتخاب کنید.");
                var creditId = (_credit.SelectedItem as Choice)?.Value ?? throw new InvalidOperationException("حساب بستانکار را انتخاب کنید.");
                if (debitId == creditId) throw new InvalidOperationException("حساب بدهکار و بستانکار نمی‌توانند یکسان باشند.");
                var amount = PersianNumberParser.ParseDecimal(_amount.Text, "مبلغ");
                if (amount <= 0m) throw new InvalidOperationException("مبلغ سند باید بیشتر از صفر باشد.");
                var description = _description.Text.Trim();
                if (description.Length < 2) throw new InvalidOperationException("شرح سند را وارد کنید.");

                Result = new AccountingEntryRecord
                {
                    Date = NativeLedgerService.NormalizeAndValidateDate(_date.Text),
                    Description = description,
                    DebitAccountId = debitId,
                    CreditAccountId = creditId,
                    Amount = AccountingRules.Money(amount),
                    DocumentType = (_documentType.SelectedItem as Choice)?.Value ?? "OPERATIONAL",
                    FiscalYear = _fiscalYear.Text.Trim(),
                    ReferenceId = _referenceId.Text.Trim(),
                    ReferenceType = _referenceType.Text.Trim(),
                    Status = "DRAFT"
                };
                DialogResult = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "بررسی سند حسابداری", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        };
    }

    private void RefreshCreditChoices()
    {
        if (_refreshingCreditChoices) return;
        var debitId = (_debit.SelectedItem as Choice)?.Value;
        var previousCreditId = (_credit.SelectedItem as Choice)?.Value;
        var allowed = _accountChoices.Where(choice => !string.Equals(choice.Value, debitId, StringComparison.Ordinal)).ToList();
        _refreshingCreditChoices = true;
        _credit.ItemsSource = allowed;
        _credit.SelectedItem = allowed.FirstOrDefault(choice => choice.Value == previousCreditId)
            ?? allowed.FirstOrDefault();
        _refreshingCreditChoices = false;
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock { Text = label, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 7, 0, 4) });
        field.Margin = new Thickness(0, 0, 0, 3);
        root.Children.Add(field);
    }
}
