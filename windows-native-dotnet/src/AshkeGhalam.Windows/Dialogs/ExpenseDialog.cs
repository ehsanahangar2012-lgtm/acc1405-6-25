using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class ExpenseDialog : Window
{
    private readonly TextBox _title=new();
    private readonly ComboBox _category = new() { IsEditable = true, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, StaysOpenOnEdit = true, Height = 34, MaxDropDownHeight = 280 };
    private readonly TextBox _amount=new(){Text="0"};
    private readonly TextBox _notes=new(){Height=52,AcceptsReturn=true,TextWrapping=TextWrapping.Wrap};
    public string ExpenseTitle{get;private set;}="";
    public string Category{get;private set;}="عمومی";
    public decimal Amount{get;private set;}
    public string Notes{get;private set;}="";

    public ExpenseDialog(Window owner, ExpenseRecord? existing = null, IEnumerable<string>? knownCategories = null)
    {
        Owner = owner; Title = existing is null ? "ثبت هزینه" : "ویرایش هزینه"; Width = 520; Height = 520; MinHeight = 390; MinWidth = 450; WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;FontFamily=new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");Background=Brushes.White;ResizeMode=ResizeMode.CanResize;
        NumericTextBoxFormatter.Attach(_amount);
        if (existing is not null)
        {
            _title.Text = existing.Title;
            _category.Text = existing.Category;
            _amount.Text = NumericTextBoxFormatter.Format(existing.Amount);
            _notes.Text = existing.Notes;
        }
        _category.ItemsSource = (knownCategories ?? Enumerable.Empty<string>())
            .Append(existing?.Category ?? "")
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(value => value, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        _category.Text = existing?.Category ?? "عمومی";

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock { Text = existing is null ? "هزینهٔ جدید" : "ویرایش مشخصات هزینه", FontSize = 20, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 14) });
        Add(root, "عنوان هزینه", _title);
        Add(root, "دسته‌بندی (انتخاب قبلی یا ورود دستهٔ جدید)", _category);
        Add(root, "مبلغ", _amount);
        Add(root, "توضیحات", _notes);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var ok = new Button { Content = existing is null ? "ثبت هزینه" : "ذخیره تغییرات", Width = 135, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        buttons.Children.Add(ok);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 38, IsCancel = true });
        var layout = new Grid();
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;
        ok.Click+=(_,_) =>
        {
            try
            {
                if(_title.Text.Trim().Length<2)throw new InvalidOperationException("عنوان هزینه را وارد کنید.");
                var amount=PersianNumberParser.ParseDecimal(_amount.Text,"مبلغ");
                if(amount<=0)throw new InvalidOperationException("مبلغ باید بیشتر از صفر باشد.");
                ExpenseTitle=_title.Text.Trim();Category=string.IsNullOrWhiteSpace(_category.Text)?"عمومی":_category.Text.Trim();
                Amount=AccountingRules.Money(amount);Notes=_notes.Text.Trim();DialogResult=true;
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی هزینه",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private static void FormatNumericField(TextBox field)
    {
        if (string.IsNullOrWhiteSpace(field.Text)) return;
        try { field.Text = PersianNumberParser.ParseDecimal(field.Text, "مبلغ").ToString("#,##0.##", System.Globalization.CultureInfo.GetCultureInfo("fa-IR")); }
        catch (InvalidOperationException) { }
    }

    private static void Add(Panel root,string label,Control field)
    {
        root.Children.Add(new TextBlock{Text=label,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,7,0,4)});
        field.Margin=new Thickness(0,0,0,3);root.Children.Add(field);
    }
}
