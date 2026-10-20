using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class ProductDialog : Window
{
    private readonly TextBox _name=new();
    private readonly TextBox _sku=new();
    private readonly TextBox _unit=new(){Text="عدد"};
    private readonly TextBox _quantity=new(){Text="0"};
    private readonly TextBox _price=new(){Text="0"};
    public ProductRecord? Result{get;private set;}

    public ProductDialog(Window owner)
    {
        Owner=owner;Title="ثبت کالا و موجودی اولیه";Width=460;Height=520;
        WindowStartupLocation=WindowStartupLocation.CenterOwner;ResizeMode=ResizeMode.NoResize;
        FlowDirection=FlowDirection.RightToLeft;Background=Brushes.White;
        var root=new StackPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text="کالا و انبار",FontSize=20,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,14)});
        Add(root,"نام کالا (الزامی)",_name);Add(root,"کد کالا / SKU",_sku);Add(root,"واحد (مثلاً عدد، کیلوگرم)",_unit);
        Add(root,"موجودی اولیه",_quantity);Add(root,"قیمت واحد فروش (ریال یا واحد پول ثبت‌شده)",_price);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Left,Margin=new Thickness(0,12,0,0)};
        var save=new Button{Content="ذخیره کالا",Width=110,Height=36,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(save);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=36,IsCancel=true});root.Children.Add(buttons);Content=root;
        save.Click+=(_,_) =>
        {
            try
            {
                var name=_name.Text.Trim();var quantity=PersianNumberParser.ParseDecimal(_quantity.Text,"موجودی");var price=PersianNumberParser.ParseDecimal(_price.Text,"قیمت واحد");
                if(name.Length<2||quantity<0||price<0)throw new InvalidOperationException("نام کالا باید حداقل دو نویسه باشد و مقدارها نمی‌توانند منفی باشند.");
                Result=new ProductRecord{Name=name,Sku=_sku.Text.Trim(),Unit=string.IsNullOrWhiteSpace(_unit.Text)?"عدد":_unit.Text.Trim(),StockQuantity=quantity,UnitPrice=AccountingRules.Money(price)};
                DialogResult=true;
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی اطلاعات",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private static void Add(Panel root,string label,TextBox box)
    {
        root.Children.Add(new TextBlock{Text=label,FontSize=12,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,5,0,4)});
        box.Height=32;box.Padding=new Thickness(8,5,8,5);root.Children.Add(box);
    }
}
