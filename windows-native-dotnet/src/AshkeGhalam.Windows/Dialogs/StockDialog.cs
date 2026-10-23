using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class StockDialog:Window
{
    private readonly ComboBox _product = new() { DisplayMemberPath = nameof(ProductRecord.Name), MinWidth = 260, Height = 34, IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 280 };
    private readonly TextBlock _stockHint = new() { Margin = new Thickness(0, 6, 0, 4), TextWrapping = TextWrapping.Wrap };
    private readonly TextBox _quantity=new(){Text="1",Height=34,Padding=new Thickness(8,4,8,4)};
    public string ProductId{get;private set;}="";
    public decimal Quantity{get;private set;}

    public StockDialog(Window owner,IReadOnlyList<ProductRecord> products)
    {
        Owner = owner; Title = "افزایش موجودی کالا"; Width = 500; Height = 360; MinWidth = 420; MinHeight = 280; WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;FontFamily=new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");Background = Brushes.White; ResizeMode = ResizeMode.CanResize;
        NumericTextBoxFormatter.Attach(_quantity);
        _product.ItemsSource = products.OrderBy(product => product.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
        if (_product.Items.Count > 0) _product.SelectedIndex = 0;
        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock { Text = "ورود موجودی", FontSize = 20, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 12) });
        root.Children.Add(new TextBlock { Text = "کالا (نام کالا را تایپ کنید تا سریع‌تر پیدا شود)", Margin = new Thickness(0, 6, 0, 4) });
        root.Children.Add(_product);
        root.Children.Add(_stockHint);
        root.Children.Add(new TextBlock { Text = "مقدار افزایش", Margin = new Thickness(0, 12, 0, 4) });
        root.Children.Add(_quantity);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var ok = new Button { Content = "ثبت موجودی", Width = 120, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
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
        _product.SelectionChanged += (_, _) => RefreshStockHint();
        RefreshStockHint();
        ok.Click+=(_,_) =>
        {
            try
            {
                if(_product.SelectedItem is not ProductRecord product)throw new InvalidOperationException("کالا انتخاب نشده است.");
                var qty=PersianNumberParser.ParseDecimal(_quantity.Text,"مقدار افزایش");
                if(qty<=0)throw new InvalidOperationException("مقدار افزایش باید مثبت باشد.");
                ProductId=product.Id;Quantity=qty;DialogResult=true;
            }catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی موجودی",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private void RefreshStockHint()
    {
        if (_product.SelectedItem is ProductRecord product)
            _stockHint.Text = $"موجودی فعلی: {NumericTextBoxFormatter.Format(product.StockQuantity)} {product.Unit}  •  افزایش فقط به موجودی همین کالا اضافه می‌شود.";
        else
            _stockHint.Text = "ابتدا یک کالا انتخاب کنید.";
    }

    private static void FormatNumericField(TextBox field)
    {
        if (string.IsNullOrWhiteSpace(field.Text)) return;
        try { field.Text = NumericTextBoxFormatter.Format(PersianNumberParser.ParseDecimal(field.Text, "مقدار")); }
        catch (InvalidOperationException) { }
    }
}
