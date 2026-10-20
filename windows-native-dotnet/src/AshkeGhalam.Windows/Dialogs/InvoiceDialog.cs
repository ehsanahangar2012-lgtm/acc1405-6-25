using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class InvoiceDialog : Window
{
    private readonly ComboBox _customer=new(){DisplayMemberPath=nameof(CustomerRecord.Name),MinWidth=240};
    private readonly ComboBox _product=new(){DisplayMemberPath=nameof(ProductRecord.Name),MinWidth=240};
    private readonly TextBox _quantity=new(){Text="1",Width=90};
    private readonly TextBox _price=new(){Width=140};
    private readonly TextBox _tax=new(){Text="0",Width=90};
    private readonly TextBox _notes=new(){Height=48,AcceptsReturn=true,TextWrapping=TextWrapping.Wrap};
    private readonly ObservableCollection<InvoiceLine> _lines=[];
    private readonly ListBox _lineList=new(){Height=150};
    public InvoiceDraft? Result{get;private set;}

    public InvoiceDialog(Window owner,IReadOnlyList<CustomerRecord> customers,IReadOnlyList<ProductRecord> products)
    {
        Owner=owner;Title="صدور فاکتور فروش";Width=720;Height=720;MinHeight=660;
        WindowStartupLocation=WindowStartupLocation.CenterOwner;FlowDirection=FlowDirection.RightToLeft;
        Background=Brushes.White;ResizeMode=ResizeMode.CanResize;
        var root=new DockPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text="صدور فاکتور",FontSize=22,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,18)});
        DockPanel.SetDock(root.Children[^1],Dock.Top);

        var body=new StackPanel();
        AddField(body,"مشتری",_customer);_customer.ItemsSource=customers;
        AddField(body,"کالا",_product);_product.ItemsSource=products.Where(p=>p.StockQuantity>0).ToList();
        var row=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(0,8,0,8)};
        row.Children.Add(new TextBlock{Text="تعداد",VerticalAlignment=VerticalAlignment.Center,Margin=new Thickness(0,0,8,0)});
        row.Children.Add(_quantity);
        row.Children.Add(new TextBlock{Text="قیمت واحد",VerticalAlignment=VerticalAlignment.Center,Margin=new Thickness(18,0,8,0)});
        row.Children.Add(_price);
        var addLine=new Button{Content="افزودن قلم",Height=32,Padding=new Thickness(12,3,12,3),Margin=new Thickness(12,0,0,0)};
        row.Children.Add(addLine);body.Children.Add(row);
        body.Children.Add(new TextBlock{Text="اقلام فاکتور",FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,8,0,5)});
        _lineList.ItemsSource=_lines.Select(ToText).ToList();body.Children.Add(_lineList);
        var remove=new Button{Content="حذف قلم انتخاب‌شده",Width=150,Height=30,HorizontalAlignment=HorizontalAlignment.Left,Margin=new Thickness(0,6,0,8)};
        body.Children.Add(remove);
        AddField(body,"نرخ مالیات درصد (در صورت عدم شمول صفر)",_tax);AddField(body,"توضیحات",_notes);
        var total=new TextBlock{FontSize=14,FontWeight=FontWeights.Bold,Margin=new Thickness(0,8,0,8)};
        body.Children.Add(total);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Left,Margin=new Thickness(0,12,0,0)};
        var save=new Button{Content="ثبت نهایی فاکتور",Width=145,Height=38,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(save);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=38,IsCancel=true});
        body.Children.Add(buttons);
        var scroller=new ScrollViewer{Content=body,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};
        root.Children.Add(scroller);Content=root;
        _product.SelectionChanged+=(_,_)=>{if(_product.SelectedItem is ProductRecord p)_price.Text=p.UnitPrice.ToString("0.##",System.Globalization.CultureInfo.InvariantCulture);};
        addLine.Click+=(_,_) =>
        {
            try
            {
                if(_product.SelectedItem is not ProductRecord p)throw new InvalidOperationException("یک کالا انتخاب کنید.");
                var qty=PersianNumberParser.ParseDecimal(_quantity.Text,"تعداد");
                var price=PersianNumberParser.ParseDecimal(_price.Text,"قیمت واحد");
                if(qty<=0||price<0)throw new InvalidOperationException("تعداد باید مثبت و قیمت غیرمنفی باشد.");
                var already=_lines.Where(l=>l.ProductId==p.Id).Sum(l=>l.Quantity);
                if(already+qty>p.StockQuantity)throw new InvalidOperationException($"موجودی کافی نیست؛ موجودی فعلی: {p.StockQuantity:N2}");
                _lines.Add(new InvoiceLine{ProductId=p.Id,ProductName=p.Name,Quantity=qty,UnitPrice=AccountingRules.Money(price),LineTotal=AccountingRules.Money(qty*price)});
                RefreshLines(total);
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی قلم فاکتور",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
        remove.Click+=(_,_)=>{if(_lineList.SelectedIndex>=0){var idx=_lineList.SelectedIndex;_lines.RemoveAt(idx);RefreshLines(total);}};
        _tax.TextChanged+=(_,_)=>RefreshLines(total);
        save.Click+=(_,_) =>
        {
            try
            {
                if(_customer.SelectedItem is not CustomerRecord customer)throw new InvalidOperationException("یک مشتری انتخاب کنید.");
                if(_lines.Count==0)throw new InvalidOperationException("حداقل یک قلم به فاکتور اضافه کنید.");
                var tax=PersianNumberParser.ParseDecimal(_tax.Text,"درصد مالیات");
                if(tax<0||tax>100)throw new InvalidOperationException("درصد مالیات باید بین صفر تا صد باشد.");
                Result=new InvoiceDraft{CustomerId=customer.Id,TaxRatePercent=tax,Notes=_notes.Text.Trim(),Lines=_lines.Select(l=>new InvoiceLine
                {ProductId=l.ProductId,ProductName=l.ProductName,Quantity=l.Quantity,UnitPrice=l.UnitPrice,LineTotal=l.LineTotal}).ToList()};
                DialogResult=true;
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی فاکتور",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
        if(_customer.Items.Count>0)_customer.SelectedIndex=0;
        if(_product.Items.Count>0)_product.SelectedIndex=0;
        RefreshLines(total);
    }

    private void RefreshLines(TextBlock total)
    {
        _lineList.ItemsSource=null;_lineList.ItemsSource=_lines.Select(ToText).ToList();
        var subtotal=AccountingRules.Money(_lines.Sum(l=>l.LineTotal));
        var tax=PersianNumberParser.TryParseDecimal(_tax.Text,out var rate)&&rate>=0&&rate<=100?AccountingRules.CalculateTax(subtotal,rate):0m;
        total.Text=$"جمع: {subtotal:N2}    مالیات: {tax:N2}    کل: {subtotal+tax:N2}";
    }

    private static string ToText(InvoiceLine l)=>$"{l.ProductName}  |  {l.Quantity:N2} × {l.UnitPrice:N2} = {l.LineTotal:N2}";
    private static void AddField(Panel root,string label,Control field)
    {
        root.Children.Add(new TextBlock{Text=label,FontSize=12,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,7,0,4)});
        field.Margin=new Thickness(0,0,0,4);root.Children.Add(field);
    }
}
