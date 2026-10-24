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
    private readonly ComboBox _type = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false };
    private readonly ComboBox _level = new() { Height = 34, DisplayMemberPath = nameof(Choice.Label), IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false };
    private readonly ComboBox _parent = new()
    {
        Height = 36, DisplayMemberPath = nameof(Choice.Label), IsEditable = true, StaysOpenOnEdit = true,
        IsTextSearchEnabled = false, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 320,
        ToolTip = "کد یا عنوان حساب والد را جست‌وجو و از نتایج انتخاب کنید."
    };
    private IReadOnlyList<ChartOfAccountRecord> _accounts = [];

    public ChartOfAccountRecord? Result { get; private set; }

    public LedgerAccountDialog(Window owner, IReadOnlyList<ChartOfAccountRecord> accounts)
    {
        Owner = owner;
        Title = "افزودن سرفصل حساب";
        Width = 510;
        Height = 560;
        MinHeight = 420;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _accounts = accounts;
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
        RefreshParentChoices();
        _type.SelectionChanged += (_, _) => RefreshParentChoices();
        _level.SelectionChanged += (_, _) => RefreshParentChoices();

        var root = new StackPanel { Margin = new Thickness(16) };
        var identitySection = new StackPanel();
        AddField(identitySection, "کد حساب (الزامی)", _code);
        AddField(identitySection, "عنوان حساب (الزامی)", _name);
        root.Children.Add(CreateSectionCard(
            "۱. هویت سرفصل",
            "کد باید یکتا باشد و عنوان، ساختار حساب را روشن کند.",
            identitySection));

        var classificationSection = new StackPanel();
        AddField(classificationSection, "نوع حساب", _type);
        AddField(classificationSection, "سطح حساب", _level);
        AddField(classificationSection, "حساب والد (برای معین/تفصیلی الزامی)", _parent);
        root.Children.Add(CreateSectionCard(
            "۲. ساختار کدینگ",
            "حساب‌های معین به حساب کل و حساب‌های تفصیلی به حساب معین متصل می‌شوند.",
            classificationSection));

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var save = new Button
        {
            Content = "ثبت سرفصل",
            Width = 135,
            Height = 40,
            IsDefault = true,
            Margin = new Thickness(0, 0, 8, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
        };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var scroll = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(scroll, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(scroll);
        layout.Children.Add(buttons);
        Content = layout;

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

    private void RefreshParentChoices()
    {
        var type = (_type.SelectedItem as Choice)?.Value;
        var level = (_level.SelectedItem as Choice)?.Value;
        var previousParentId = (_parent.SelectedItem as Choice)?.Value ?? "";
        var allowedParentLevel = level switch
        {
            "SUB" => "MAIN",
            "DETAIL" => "SUB",
            _ => ""
        };

        var choices = new List<Choice> { new("", "بدون والد (حساب کل)") };
        if (!string.IsNullOrWhiteSpace(allowedParentLevel))
        {
            choices.AddRange(_accounts
                .Where(account => account.IsActive &&
                    string.Equals(account.Type, type, StringComparison.Ordinal) &&
                    string.Equals(account.Level, allowedParentLevel, StringComparison.Ordinal))
                .OrderBy(account => account.Code, StringComparer.OrdinalIgnoreCase)
                .Select(account => new Choice(account.Id, $"{account.Code} — {account.Name}")));
        }

        SmartComboBoxSearchService.SetItems(_parent, choices, choice => new[] { choice.Label });
        TextSearch.SetTextPath(_parent, nameof(Choice.Label));
        _parent.SelectedItem = choices.FirstOrDefault(choice => choice.Value == previousParentId)
            ?? choices[0];
        _parent.IsEnabled = level != "MAIN";
    }

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock { Text = label, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 7, 0, 4) });
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
