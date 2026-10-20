using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class ProductDialog : Window
{
    private readonly TextBox _name = new();
    private readonly TextBox _sku = new();
    private readonly TextBox _unit = new() { Text = "عدد" };
    private readonly TextBox _quantity = new() { Text = "0" };
    private readonly TextBox _price = new() { Text = "0" };
    private readonly ProductRecord? _existing;
    public ProductRecord? Result { get; private set; }

    public ProductDialog(Window owner, ProductRecord? existing = null)
    {
        _existing=existing; Owner=owner;
        Title=existing is null ? "ثبت کالا و موجودی اولیه" : "ویرایش کالا";
        Width=460; Height=520; WindowStartupLocation=WindowStartupLocation.CenterOwner;
        ResizeMode=ResizeMode.NoResize; FlowDirection=FlowDirection.RightToLeft; Background=Brushes.White;
        _name.Text=existing?.Name??""; _sku.Text=existing?.Sku??""; _unit.Text=existing?.Unit??"عدد";
        _quantity.Text=(existing?.StockQuantity??0m).ToString("0.##",System.Globalization.CultureInfo.InvariantCulture);
        _price.Text=(existing?.UnitPrice??0m).ToString("0.##",System.Globalization.CultureInfo.InvariantCulture);
        _quantity.IsEnabled=existing is null;
        var root=new StackPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text=existing is null?"کالا و انبار":"مشخصات کالا",FontSize=20,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,14)});
        Add(root,"نام کالا (الزامی)",_name); Add(root,"کد کالا / SKU",_sku); Add(root,"واحد (مثلاً عدد، کیلوگرم)",_unit);
        Add(root,existing is null?"موجودی اولیه":"موجودی فعلی (برای تغییر از «ورود موجودی» استفاده کنید)",_quantity);
        Add(root,"قیمت واحد فروش (واحد پول را در تمام رکوردها ثابت نگه دارید)",_price);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Left,Margin=new Thickness(0,12,0,0)};
        var save=new Button{Content=existing is null?"ذخیره کالا":"ثبت تغییرات",Width=110,Height=36,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(save);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=36,IsCancel=true});root.Children.Add(buttons);Content=root;
        save.Click+=(_,_) =>
        {
            try
            {
                var name=_name.Text.Trim();var quantity=PersianNumberParser.ParseDecimal(_quantity.Text,"موجودی");var price=PersianNumberParser.ParseDecimal(_price.Text,"قیمت واحد");
                if(name.Length<2||quantity<0||price<0)throw new InvalidOperationException("نام کالا باید حداقل دو نویسه باشد و مقدارها نمی‌توانند منفی باشند.");
                Result=new ProductRecord{Id=_existing?.Id??Guid.NewGuid().ToString("N"),Name=name,Sku=_sku.Text.Trim(),
                    Unit=string.IsNullOrWhiteSpace(_unit.Text)?"عدد":_unit.Text.Trim(),StockQuantity=_existing?.StockQuantity??quantity,
                    UnitPrice=AccountingRules.Money(price),CreatedAt=_existing?.CreatedAt??DateTimeOffset.Now};
                DialogResult=true;
            }catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی اطلاعات",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private static void Add(Panel root,string label,TextBox box)
    {
        root.Children.Add(new TextBlock{Text=label,FontSize=12,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,5,0,4)});
        box.Height=32;box.Padding=new Thickness(8,5,8,5);root.Children.Add(box);
    }
}
