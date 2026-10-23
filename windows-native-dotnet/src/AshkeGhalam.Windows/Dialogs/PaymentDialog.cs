using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class PaymentDialog : Window
{
    private readonly ComboBox _customer = new()
    {
        Height = 34, MinWidth = 280, DisplayMemberPath = nameof(CustomerRecord.Name),
        IsTextSearchEnabled = true, IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300
    };
    private readonly ComboBox _invoice = new()
    {
        Height = 34, MinWidth = 350, IsTextSearchEnabled = true,
        IsTextSearchCaseSensitive = false, MaxDropDownHeight = 300
    };
    private readonly TextBlock _remainingHint = new()
    {
        Margin = new Thickness(0, 5, 0, 4), TextWrapping = TextWrapping.Wrap,
        Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(71, 85, 105))
    };
    private readonly TextBox _amount=new(){Height=34,Text="0",Padding=new Thickness(8,4,8,4)};
    private readonly ComboBox _method=new(){Height=32,ItemsSource=new[]{"نقدی","کارت‌خوان","واریز بانکی","چک","سایر"},SelectedIndex=0,IsTextSearchEnabled=true,IsTextSearchCaseSensitive=false};
    private readonly TextBox _reference=new(){Height=32,Padding=new Thickness(8,4,8,4)};
    private readonly AccountingData _data;
    private readonly string? _invoiceTypeFilter;
    private readonly PaymentRecord? _existingPayment;
    private readonly List<InvoiceRecord> _eligibleInvoices = [];
    public string InvoiceId{get;private set;}="";
    public decimal Amount{get;private set;}
    public string Method{get;private set;}="نقدی";
    public string Reference{get;private set;}="";
    private readonly string _currencyLabel;

    private sealed class InvoiceOption
    {
        public InvoiceRecord Invoice{get;init;}=new();
        public string Label{get;init;}="";
    }

    public PaymentDialog(Window owner, AccountingData data, string? invoiceTypeFilter = null, PaymentRecord? existingPayment = null, string? currencyCode = "RIAL")
    {
        var title = existingPayment is not null ? "ویرایش دریافت/پرداخت" : invoiceTypeFilter switch
        {
            "SALE" => "ثبت دریافت از مشتری",
            "PURCHASE" => "ثبت پرداخت به تأمین‌کننده",
            _ => "ثبت دریافت/پرداخت طرف حساب"
        };
        _currencyLabel = string.Equals(currencyCode, "TOMAN", StringComparison.OrdinalIgnoreCase) ? "تومان" : "ریال";
        _data = data;
        _invoiceTypeFilter = invoiceTypeFilter;
        _existingPayment = existingPayment;
        Owner = owner;
        Title = title;
        Width = 590;
        Height = 540;
        MinHeight = 430;
        MinWidth = 520;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = Brushes.White;
        ResizeMode = ResizeMode.CanResize;
        NumericTextBoxFormatter.Attach(_amount);

        var existingInvoice = data.Invoices.FirstOrDefault(invoice => invoice.Id == existingPayment?.InvoiceId);
        _eligibleInvoices.AddRange(data.Invoices.Where(invoice =>
            invoice.Status != "لغو شده" && invoice.Type != "PROFORMA" &&
            (string.IsNullOrWhiteSpace(invoiceTypeFilter) || invoice.Type == invoiceTypeFilter) &&
            (AccountingRules.RemainingForInvoice(data, invoice) > 0 || invoice.Id == existingPayment?.InvoiceId)));

        var customerChoices = data.Customers.Where(person =>
                _eligibleInvoices.Any(invoice => invoice.CustomerId == person.Id) ||
                (existingInvoice is not null && existingInvoice.CustomerId == person.Id))
            .OrderBy(person => person.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        _customer.ItemsSource = customerChoices;
        _customer.SelectedItem = customerChoices.FirstOrDefault(person => person.Id == existingInvoice?.CustomerId)
            ?? customerChoices.FirstOrDefault();

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock { Text = title, FontSize = 20, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 12) });
        if (_eligibleInvoices.Count == 0)
        {
            root.Children.Add(new TextBlock
            {
                Text = invoiceTypeFilter == "SALE"
                    ? "فاکتور فروش قطعی و دارای مانده برای دریافت پیدا نشد."
                    : invoiceTypeFilter == "PURCHASE"
                        ? "فاکتور خرید قطعی و دارای مانده برای پرداخت پیدا نشد."
                        : "فاکتور قطعی دارای مانده برای تسویه پیدا نشد.",
                TextWrapping = TextWrapping.Wrap,
                Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(153, 27, 27)),
                Margin = new Thickness(0, 0, 0, 8)
            });
        }

        Add(root, "طرف حساب", _customer);
        Add(root, "فاکتور قطعی (بر اساس طرف حساب)", _invoice);
        root.Children.Add(_remainingHint);
        Add(root, $"مبلغ تسویه ({_currencyLabel})", _amount);
        Add(root, "روش دریافت / پرداخت", _method);
        Add(root, "شماره پیگیری / توضیح", _reference);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 10, 22, 18) };
        var ok = new Button { Content = existingPayment is null ? "ثبت عملیات نقدی/مالی" : "ذخیره تغییرات", Width = 150, Height = 38, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
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

        _customer.SelectionChanged += (_, _) => RefreshInvoiceChoices();
        _invoice.SelectionChanged += (_, _) => RefreshRemainingHint();
        RefreshInvoiceChoices();

        if (existingPayment is not null)
        {
            _amount.Text = NumericTextBoxFormatter.Format(existingPayment.Amount);
            _reference.Text = existingPayment.Reference;
            var methods = _method.Items.Cast<string>().ToList();
            if (!methods.Contains(existingPayment.Method, StringComparer.Ordinal)) methods.Add(existingPayment.Method);
            _method.ItemsSource = methods;
            _method.SelectedItem = existingPayment.Method;
        }
        ok.Click+=(_,_) =>
        {
            try
            {
                if(_invoice.SelectedItem is not InvoiceOption option)throw new InvalidOperationException("سند قطعی دارای مانده‌ای برای انتخاب وجود ندارد.");
                var amount=AccountingRules.Money(PersianNumberParser.ParseDecimal(_amount.Text,"مبلغ"));
                if(amount<=0)throw new InvalidOperationException("مبلغ باید بیشتر از صفر باشد.");
                var available = AccountingRules.RemainingForInvoice(data, option.Invoice);
                if (existingPayment?.InvoiceId == option.Invoice.Id) available = AccountingRules.Money(available + existingPayment.Amount);
                if (amount > available) throw new InvalidOperationException($"مبلغ از ماندهٔ قابل تسویه بیشتر است. ماندهٔ مجاز: {available:N2}");
                InvoiceId=option.Invoice.Id;Amount=amount;
                Method=_method.SelectedItem?.ToString()??"نقدی";Reference=_reference.Text.Trim();DialogResult=true;
            }
            catch(Exception ex){MessageBox.Show(this,ex.Message,"بررسی عملیات مالی",MessageBoxButton.OK,MessageBoxImage.Warning);}
        };
    }

    private void RefreshInvoiceChoices()
    {
        var person = _customer.SelectedItem as CustomerRecord;
        var previousInvoiceId = (_invoice.SelectedItem as InvoiceOption)?.Invoice.Id;
        var options = _eligibleInvoices
            .Where(invoice => person is not null && invoice.CustomerId == person.Id)
            .OrderByDescending(invoice => invoice.Number)
            .Select(invoice => new InvoiceOption
            {
                Invoice = invoice,
                Label = $"{invoice.TypeLabel} {invoice.DisplayNumber} — {invoice.CustomerName} — مانده {RemainingAmount(invoice):N2} {_currencyLabel}"
            })
            .ToList();

        _invoice.ItemsSource = options;
        _invoice.SelectedItem = options.FirstOrDefault(option => option.Invoice.Id == previousInvoiceId)
            ?? options.FirstOrDefault(option => option.Invoice.Id == _existingPayment?.InvoiceId)
            ?? options.FirstOrDefault();
        if (_existingPayment is null && _invoice.SelectedItem is InvoiceOption selected)
            _amount.Text = NumericTextBoxFormatter.Format(RemainingAmount(selected.Invoice));
        RefreshRemainingHint();
    }

    private decimal RemainingAmount(InvoiceRecord invoice)
    {
        var remaining = AccountingRules.RemainingForInvoice(_data, invoice);
        if (_existingPayment?.InvoiceId == invoice.Id)
            remaining = AccountingRules.Money(remaining + _existingPayment.Amount);
        return Math.Max(0m, remaining);
    }

    private void RefreshRemainingHint()
    {
        if (_invoice.SelectedItem is InvoiceOption option)
            _remainingHint.Text = $"ماندهٔ مجاز این فاکتور: {RemainingAmount(option.Invoice):N2} {_currencyLabel}. مبلغ دلخواه را می‌توانید کمتر وارد کنید.";
        else
            _remainingHint.Text = "برای طرف حساب انتخاب‌شده، فاکتور قطعیِ دارای مانده‌ای وجود ندارد.";
    }

    private static void FormatNumericField(TextBox field)
    {
        if (string.IsNullOrWhiteSpace(field.Text)) return;
        try { field.Text = NumericTextBoxFormatter.Format(PersianNumberParser.ParseDecimal(field.Text, "مبلغ")); }
        catch (InvalidOperationException) { }
    }

    private static void Add(Panel root,string label,Control field)
    {
        root.Children.Add(new TextBlock{Text=label,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,7,0,4)});
        root.Children.Add(field);
    }
}
