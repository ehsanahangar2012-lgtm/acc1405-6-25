using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class PaymentDialog : Window
{
    private readonly ComboBox _invoice=new(){MinWidth=350};
    private readonly TextBox _amount=new(){Height=34,Text="0",Padding=new Thickness(8,4,8,4)};
    private readonly ComboBox _method=new(){Height=32,ItemsSource=new[]{"نقدی","کارت‌خوان","واریز بانکی","چک","سایر"},SelectedIndex=0};
    private readonly TextBox _reference=new(){Height=32,Padding=new Thickness(8,4,8,4)};
    public string InvoiceId{get;private set;}="";
    public decimal Amount{get;private set;}
    public string Method{get;private set;}="نقدی";
    public string Reference{get;private set;}="";

    private sealed class InvoiceOption
    {
        public InvoiceRecord Invoice{get;init;}=new();
        public string Label{get;init;}="";
    }

    public PaymentDialog(Window owner,AccountingData data)
    {
        Owner=owner;Title="ثبت دریافت/پرداخت طرف حساب";Width=530;Height=450;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        FlowDirection=FlowDirection.RightToLeft;Background=Brushes.White;ResizeMode=ResizeMode.NoResize;
        _invoice.DisplayMemberPath=nameof(InvoiceOption.Label);
        _invoice.ItemsSource=data.Invoices.Where(i=>i.Status!="لغو شده"&&i.Type!="PROFORMA"&&AccountingRules.RemainingForInvoice(data,i)>0)
            .Select(i=>new InvoiceOption{Invoice=i,Label=$"{i.TypeLabel} {i.DisplayNumber} — {i.CustomerName} — مانده {AccountingRules.RemainingForInvoice(data,i):N2}"}).ToList();
        var root=new StackPanel{Margin=new Thickness(22)};
        root.Children.Add(new TextBlock{Text="ثبت دریافت یا پرداخت",FontSize=20,FontWeight=FontWeights.Bold,Margin=new Thickness(0,0,0,14)});
        Add(root,"سند قطعی و مانده",_invoice);Add(root,"مبلغ تسویه",_amount);Add(root,"روش دریافت / پرداخت",_method);Add(root,"شماره پیگیری / توضیح",_reference);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(0,18,0,0)};
        var ok=new Button{Content="ثبت عملیات نقدی/مالی",Width=110,Height=36,IsDefault=true,Margin=new Thickness(0,0,8,0)};
        buttons.Children.Add(ok);buttons.Children.Add(new Button{Content="انصراف",Width=90,Height=36,IsCancel=true});root.Children.Add(buttons);Content=root;
        if(_invoice.Items.Count>0)_invoice.SelectedIndex=0;
        ok.Click+=(_,_) =>
        {
            try
            {
                if(_invoice.SelectedItem is not InvoiceOption option)throw new InvalidOperationException("سند قطعی دارای مانده‌ای برای انتخاب وجود ندارد.");
                var amount=PersianNumberParser.ParseDecimal(_amount.Text,"مبلغ");
                if(amount<=0)throw new InvalidOperationException("مبلغ باید بیشتر از صفر باشد.");
                InvoiceId=option.Invoice.Id;Amount=AccountingRules.Money(amount);
                Method=_method.SelectedItem?.ToString()??"نقدی";Reference=_reference.Text.Trim();DialogResult=true;
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی عملیات مالی",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private static void Add(Panel root,string label,Control field)
    {
        root.Children.Add(new TextBlock{Text=label,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,7,0,4)});
        root.Children.Add(field);
    }
}
