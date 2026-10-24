using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class PersianDatePickerWindow : Window
{
    private static readonly string[] Months =
    ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
    private static readonly string[] Weekdays = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
    private readonly PersianCalendar _calendar = new();
    private readonly ComboBox _year = new() { MinWidth = 100, Height = 36 };
    private readonly ComboBox _month = new() { MinWidth = 140, Height = 36, Margin = new Thickness(8,0,0,0) };
    private readonly UniformGrid _days = new() { Columns = 7 };
    private readonly bool _optional;
    private int _y, _m;
    private bool _changing;

    public DateTimeOffset? SelectedDate { get; private set; }

    public PersianDatePickerWindow(Window? owner, DateTimeOffset? initialDate = null, bool optional = false)
    {
        Owner = owner; _optional = optional;
        var initial = initialDate?.DateTime ?? DateTime.Now;
        _y = _calendar.GetYear(initial); _m = _calendar.GetMonth(initial);
        SelectedDate = initialDate;
        Title = "انتخاب تاریخ شمسی"; Width = 430; SizeToContent = SizeToContent.Height;
        WindowStartupLocation = owner is null ? WindowStartupLocation.CenterScreen : WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.NoResize; ShowInTaskbar = false;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(248,250,252));

        var root = new StackPanel { Margin = new Thickness(18) };
        root.Children.Add(new TextBlock { Text = "تقویم شمسی", FontSize = 22, FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15,23,42)), Margin = new Thickness(0,0,0,4) });
        root.Children.Add(new TextBlock { Text = "روز موردنظر را انتخاب کنید؛ امروز، فردا و دیروز هم در دسترس‌اند.",
            FontSize = 11, Foreground = new SolidColorBrush(Color.FromRgb(71,85,105)), Margin = new Thickness(0,0,0,12) });

        var nav = new Grid { Margin = new Thickness(0,0,0,10) };
        nav.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        nav.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1,GridUnitType.Star) });
        nav.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var prev = new Button { Content = "‹", Width = 40, Height = 36 };
        prev.Click += (_,_) => MoveMonth(-1);
        Grid.SetColumn(prev,0); nav.Children.Add(prev);
        var selectors = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        var currentYear = _calendar.GetYear(DateTime.Now);
        var years = Enumerable.Range(Math.Max(1,currentYear-35),66).ToList();
        if (!years.Contains(_y)) { years.Add(_y); years.Sort(); }
        _year.ItemsSource = years; _month.ItemsSource = Months;
        _year.SelectedItem = _y; _month.SelectedIndex = _m-1;
        _year.SelectionChanged += (_,_) => UpdateFromSelectors();
        _month.SelectionChanged += (_,_) => UpdateFromSelectors();
        selectors.Children.Add(_year); selectors.Children.Add(_month);
        Grid.SetColumn(selectors,1); nav.Children.Add(selectors);
        var next = new Button { Content = "›", Width = 40, Height = 36 };
        next.Click += (_,_) => MoveMonth(1);
        Grid.SetColumn(next,2); nav.Children.Add(next);
        root.Children.Add(nav);

        var weekdays = new UniformGrid { Columns = 7, Margin = new Thickness(0,0,0,5) };
        foreach (var day in Weekdays) weekdays.Children.Add(new TextBlock
        {
            Text = day, FontSize = 9, FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(71,85,105)), TextAlignment = TextAlignment.Center
        });
        root.Children.Add(weekdays);
        root.Children.Add(_days);

        var quick = new UniformGrid { Columns = 3, Margin = new Thickness(0,10,0,12) };
        AddQuick(quick,"امروز",0); AddQuick(quick,"فردا",1); AddQuick(quick,"دیروز",-1);
        root.Children.Add(quick);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left };
        if (optional)
        {
            var clear = new Button { Content = "پاک‌کردن تاریخ", Height = 36, Margin = new Thickness(0,0,8,0) };
            clear.Click += (_,_) => { SelectedDate = null; DialogResult = true; };
            actions.Children.Add(clear);
        }
        actions.Children.Add(new Button { Content = "انصراف", Height = 36, MinWidth = 90, IsCancel = true });
        root.Children.Add(actions); Content = root; RenderDays();
    }

    private void AddQuick(Panel panel, string label, int offset)
    {
        var b = new Button { Content = label, Height = 34, Margin = new Thickness(3,0,3,0) };
        b.Click += (_,_) => Pick(DateTime.Today.AddDays(offset));
        panel.Children.Add(b);
    }

    private void Pick(DateTime date)
    {
        var local = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
        SelectedDate = new DateTimeOffset(local, TimeZoneInfo.Local.GetUtcOffset(local));
        DialogResult = true;
    }

    private void UpdateFromSelectors()
    {
        if (_changing || _year.SelectedItem is not int year || _month.SelectedIndex < 0) return;
        _y = year; _m = _month.SelectedIndex + 1; RenderDays();
    }

    private void MoveMonth(int delta)
    {
        _m += delta;
        if (_m < 1) { _m = 12; _y--; }
        if (_m > 12) { _m = 1; _y++; }
        if (_y < 1) { _y = 1; _m = 1; }
        _changing = true;
        var years = (_year.ItemsSource as IEnumerable<int>)?.ToList() ?? [];
        if (!years.Contains(_y)) { years.Add(_y); years.Sort(); _year.ItemsSource = years; }
        _year.SelectedItem = _y; _month.SelectedIndex = _m - 1;
        _changing = false; RenderDays();
    }

    private void RenderDays()
    {
        _days.Children.Clear();
        DateTime first;
        int count;
        try
        {
            first = _calendar.ToDateTime(_y,_m,1,0,0,0,0,PersianCalendar.PersianEra);
            count = _calendar.GetDaysInMonth(_y,_m,PersianCalendar.PersianEra);
        }
        catch (ArgumentOutOfRangeException) { return; }

        var offset = ((int)first.DayOfWeek + 1) % 7;
        for (var i=0;i<offset;i++) _days.Children.Add(new Border { Height=36, Margin=new Thickness(2) });
        for (var day=1;day<=count;day++)
        {
            var selected = SelectedDate is DateTimeOffset current &&
                _calendar.GetYear(current.DateTime)==_y && _calendar.GetMonth(current.DateTime)==_m &&
                _calendar.GetDayOfMonth(current.DateTime)==day;
            var b = new Button
            {
                Content = day.ToString(CultureInfo.GetCultureInfo("fa-IR")), Tag = day,
                Height = 36, Margin = new Thickness(2), Padding = new Thickness(0),
                Background = selected ? new SolidColorBrush(Color.FromRgb(15,118,110)) : Brushes.White,
                Foreground = selected ? Brushes.White : new SolidColorBrush(Color.FromRgb(15,23,42)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(203,213,225)),
                FontWeight = selected ? FontWeights.Bold : FontWeights.Normal
            };
            b.Click += (_,_) =>
            {
                var local = _calendar.ToDateTime(_y,_m,(int)b.Tag,0,0,0,0,PersianCalendar.PersianEra);
                Pick(local);
            };
            _days.Children.Add(b);
        }
    }
}
