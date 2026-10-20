using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class ExpenseDialog : Window
{
    private readonly TextBox _title=new();
    private readonly TextBox _category=new(){Text="عمومی"};
    private readonly TextBox _amount=new(){Text="0"};
    private readonly TextBox _notes=new(){Height=52,AcceptsReturn=true,TextWrapping=TextWrapping.Wrap};
    public string ExpenseTitle{get;private set;}="";
    public string Category{get;private set;}="عمومی";
    public decimal Amount{get;private set;}
    public string Notes{get;private set;}="";

    public ExpenseDialog(Window owner)
    {
        Owner=owner;Title="ثبت هزینه";Width=450;Height=460;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;Background=Brushes.White;ResizeMode=ResizeMode.NoResize;
        var root=new StackPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text="هزینهٔ جدید",FontSize=20,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,14)});
        Add(root,"عنوان هزینه",_title);Add(root,"دسته‌بندی",_category);Add(root,"مبلغ",_amount);Add(root,"توضیحات",_notes);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(0,18,0,0)};
        var ok=new Button{Content="ثبت هزینه",Width=110,Height=36,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(ok);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=36,IsCancel=true});root.Children.Add(buttons);Content=root;
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

    private static void Add(Panel root,string label,Control field)
    {
        root.Children.Add(new TextBlock{Text=label,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,7,0,4)});
        field.Margin=new Thickness(0,0,0,3);root.Children.Add(field);
    }
}
