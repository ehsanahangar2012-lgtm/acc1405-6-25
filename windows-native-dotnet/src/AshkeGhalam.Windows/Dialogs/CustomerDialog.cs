using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class CustomerDialog : Window
{
    private readonly TextBox _name = new();
    private readonly TextBox _phone = new();
    private readonly TextBox _address = new();
    public CustomerRecord? Result { get; private set; }

    public CustomerDialog(Window owner)
    {
        Owner=owner; Title="ثبت مشتری جدید"; Width=450; Height=405;
        WindowStartupLocation=WindowStartupLocation.CenterOwner; ResizeMode=ResizeMode.NoResize;
        FlowDirection=FlowDirection.RightToLeft; Background=Brushes.White;
        var root=new StackPanel { Margin=new Thickness(22) };
        root.Children.Add(new TextBlock { Text="اطلاعات مشتری", FontSize=20, FontWeight=FontWeights.Bold,
            Foreground=new SolidColorBrush(Color.FromRgb(15,23,42)), Margin=new Thickness(0,0,0,18) });
        AddField(root,"نام / نام شرکت (الزامی)",_name);
        AddField(root,"شماره تماس",_phone);
        AddField(root,"نشانی",_address);
        var buttons=new StackPanel { Orientation=Orientation.Horizontal, HorizontalAlignment=HorizontalAlignment.Left, Margin=new Thickness(0,18,0,0) };
        var save=new Button { Content="ذخیره مشتری", Width=120, Height=36, Margin=new Thickness(0,0,8,0), IsDefault=true };
        var cancel=new Button { Content="انصراف", Width=90, Height=36, IsCancel=true };
        save.Click+=(_,_) =>
        {
            var name=_name.Text.Trim();
            if(name.Length<2){MessageBox.Show(this,"نام مشتری باید حداقل دو نویسه باشد.","بررسی اطلاعات",MessageBoxButton.OK,MessageBoxImage.Warning);_name.Focus();return;}
            Result=new CustomerRecord{Name=name,Phone=_phone.Text.Trim(),Address=_address.Text.Trim(),CreatedAt=DateTimeOffset.Now};
            DialogResult=true;
        };
        buttons.Children.Add(save); buttons.Children.Add(cancel); root.Children.Add(buttons); Content=root;
    }

    private static void AddField(Panel root,string label,TextBox field)
    {
        root.Children.Add(new TextBlock{Text=label,FontSize=12,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,4,0,5)});
        field.Height=32; field.Margin=new Thickness(0,0,0,9); field.Padding=new Thickness(8,5,8,5);
        root.Children.Add(field);
    }
}
