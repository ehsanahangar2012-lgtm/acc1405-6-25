using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class StockDialog:Window
{
    private readonly ComboBox _product = new()
    {
        DisplayMemberPath = nameof(ProductRecord.Name),
        MinWidth = 260,
        Height = 36,
        IsEditable = true,
        StaysOpenOnEdit = true,
        IsTextSearchEnabled = false,
        IsTextSearchCaseSensitive = false,
        MaxDropDownHeight = 320,
        ToolTip = "نام، کد، بارکد یا شماره سریال کالا را جست‌وجو کنید و سپس نتیجه را انتخاب کنید."
    };
    private readonly TextBlock _stockHint = new() { Margin = new Thickness(0, 6, 0, 4), TextWrapping = TextWrapping.Wrap };
    private readonly TextBox _quantity=new(){Text="1",Height=34,Padding=new Thickness(8,4,8,4)};
    public string ProductId{get;private set;}="";
    public decimal Quantity{get;private set;}

    public StockDialog(Window owner,IReadOnlyList<ProductRecord> products)
    {
        Owner = owner; Title = "افزایش موجودی کالا"; Width = 500; Height = 360; MinWidth = 420; MinHeight = 280; WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;FontFamily=new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");Background = Brushes.White; ResizeMode = ResizeMode.CanResize;
        NumericTextBoxFormatter.Attach(_quantity);
        var productChoices = products.OrderBy(product => product.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
        SmartComboBoxSearchService.SetItems(_product, productChoices,
            product => new[] { product.Name, product.Code, product.Barcode, product.SerialNumber });
        ProductComboBoxPresentationService.ApplyProductItemTemplate(_product);
        if (_product.Items.Count > 0) _product.SelectedIndex = 0;
        var root = new StackPanel { Margin = new Thickness(16) };
        var productSection = new StackPanel();
        AddField(productSection, "کالا (نام را تایپ کنید تا سریع‌تر پیدا شود)", _product);
        _stockHint.Margin = new Thickness(0);
        _stockHint.TextWrapping = TextWrapping.Wrap;
        productSection.Children.Add(new Border
        {
            Background = PaletteBrush("#F0FDFA"),
            BorderBrush = PaletteBrush("#99F6E4"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10, 8, 10, 8),
            Margin = new Thickness(0, 8, 0, 0),
            Child = _stockHint
        });
        root.Children.Add(CreateSectionCard(
            "۱. انتخاب کالا",
            "کالایی را که قرار است موجودی آن افزایش یابد انتخاب کنید.",
            productSection));

        var quantitySection = new StackPanel();
        AddField(quantitySection, "مقدار افزایش", _quantity);
        root.Children.Add(CreateSectionCard(
            "۲. مقدار ورود",
            "مقدار باید بزرگ‌تر از صفر باشد؛ موجودی فعلی در بالا نمایش داده می‌شود.",
            quantitySection));

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var ok = new Button
        {
            Content = "ثبت موجودی",
            Width = 130,
            Height = 40,
            IsDefault = true,
            Margin = new Thickness(0, 0, 8, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
        };
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

    private static void AddField(Panel root, string label, Control field)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontWeight = FontWeights.SemiBold,
            FontSize = 12,
            Margin = new Thickness(0, 7, 0, 4),
            TextWrapping = TextWrapping.Wrap
        });
        field.Margin = new Thickness(0, 0, 0, 4);
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

    private static void FormatNumericField(TextBox field)
    {
        if (string.IsNullOrWhiteSpace(field.Text)) return;
        try { field.Text = NumericTextBoxFormatter.Format(PersianNumberParser.ParseDecimal(field.Text, "مقدار")); }
        catch (InvalidOperationException) { }
    }
}
