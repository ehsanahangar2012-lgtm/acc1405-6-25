using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class StockDialog:Window
{
    private readonly ComboBox _product=new(){DisplayMemberPath=nameof(ProductRecord.Name),MinWidth=260};
    private readonly TextBox _quantity=new(){Text="1",Height=34,Padding=new Thickness(8,4,8,4)};
    public string ProductId{get;private set;}="";
    public decimal Quantity{get;private set;}

    public StockDialog(Window owner,IReadOnlyList<ProductRecord> products)
    {
        Owner=owner;Title="افزایش موجودی کالا";Width=450;Height=300;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;Background=Brushes.White;ResizeMode=ResizeMode.NoResize;
        _product.ItemsSource=products.ToList();if(_product.Items.Count>0)_product.SelectedIndex=0;
        var root=new StackPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text="ورود موجودی",FontSize=20,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,14)});
        root.Children.Add(new TextBlock{Text="کالا",Margin=new Thickness(0,6,0,4)});root.Children.Add(_product);
        root.Children.Add(new TextBlock{Text="مقدار افزایش",Margin=new Thickness(0,12,0,4)});root.Children.Add(_quantity);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(0,18,0,0)};
        var ok=new Button{Content="ثبت موجودی",Width=110,Height=36,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(ok);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=36,IsCancel=true});root.Children.Add(buttons);Content=root;
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
}
