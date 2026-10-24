using System.Globalization;
using System.Runtime.CompilerServices;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using AshkeGhalam.Windows.Dialogs;

namespace AshkeGhalam.Windows.Services;

public static class PersianDateInputService
{
    private sealed class State { public bool Optional { get; set; } public bool Formatting { get; set; } }
    private static readonly ConditionalWeakTable<TextBox, State> Inputs = new();

    public static string Format(DateTimeOffset value)
    {
        var c = new PersianCalendar(); var d = value.LocalDateTime;
        return string.Format(CultureInfo.InvariantCulture,"{0:0000}/{1:00}/{2:00}",c.GetYear(d),c.GetMonth(d),c.GetDayOfMonth(d));
    }

    public static DateTimeOffset Parse(string? text, string fieldName = "تاریخ")
    {
        if (TryParse(text,out var parsed)) return parsed;
        throw new InvalidOperationException($"{fieldName} معتبر نیست. تاریخ شمسی را به‌شکل سال/ماه/روز وارد کنید یا از تقویم کمک بگیرید؛ «امروز»، «فردا» و «دیروز» هم پذیرفته می‌شوند.");
    }

    public static bool TryParse(string? text, out DateTimeOffset result)
    {
        result = default;
        if (string.IsNullOrWhiteSpace(text)) return false;
        var normalized = NormalizeDigits(text).Trim().Replace('\u200c',' ').Replace('\\','/').Replace('-','/').Replace('.','/');
        var phrase = string.Concat(normalized.Where(ch => !char.IsWhiteSpace(ch)));
        var offset = phrase switch { "امروز"=>0, "فردا"=>1, "پسفردا"=>2, "دیروز"=>-1, "پریروز"=>-2, _=>int.MinValue };
        if (offset != int.MinValue)
        {
            var today=DateTime.Today.AddDays(offset);
            result=new DateTimeOffset(today,TimeZoneInfo.Local.GetUtcOffset(today)); return true;
        }

        var digits = new string(normalized.Where(char.IsAsciiDigit).ToArray());
        if (!normalized.Contains('/') && digits.Length==8)
            normalized=digits[..4]+"/"+digits.Substring(4,2)+"/"+digits.Substring(6,2);
        var p=normalized.Split('/',StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries);
        if (p.Length!=3 || !int.TryParse(p[0],NumberStyles.None,CultureInfo.InvariantCulture,out var y) ||
            !int.TryParse(p[1],NumberStyles.None,CultureInfo.InvariantCulture,out var m) ||
            !int.TryParse(p[2],NumberStyles.None,CultureInfo.InvariantCulture,out var d)) return false;
        try
        {
            DateTime local;
            if (y is >=1300 and <=1500) local=new PersianCalendar().ToDateTime(y,m,d,0,0,0,0,PersianCalendar.PersianEra);
            else if (y is >=1900 and <=2200) local=new DateTime(y,m,d,0,0,0,DateTimeKind.Unspecified);
            else return false;
            result=new DateTimeOffset(local,TimeZoneInfo.Local.GetUtcOffset(local)); return true;
        }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (OverflowException) { return false; }
    }

    public static DockPanel CreateDateField(TextBox input, bool optional=false)
    {
        Attach(input,optional);
        input.FlowDirection=FlowDirection.LeftToRight;
        input.HorizontalContentAlignment=HorizontalAlignment.Right;
        input.ToolTip=string.IsNullOrWhiteSpace(input.ToolTip?.ToString())
            ? "تاریخ شمسی. با دکمهٔ تقویم یا Ctrl+Space انتخاب کنید؛ امروز، فردا و دیروز هم پذیرفته می‌شوند."
            : input.ToolTip;
        var button=new Button
        {
            Content="▦", Width=40, Height=Math.Max(32,input.Height), Margin=new Thickness(6,0,0,4),
            ToolTip="تقویم شمسی (Ctrl+Space)", FontSize=16,
            Background=new SolidColorBrush(Color.FromRgb(236,253,250)),
            Foreground=new SolidColorBrush(Color.FromRgb(15,118,110)),
            BorderBrush=new SolidColorBrush(Color.FromRgb(153,246,228))
        };
        button.Click+=(_,_)=>OpenPicker(input);
        var row=new DockPanel { FlowDirection=FlowDirection.RightToLeft, LastChildFill=true };
        DockPanel.SetDock(button,Dock.Right); row.Children.Add(button); row.Children.Add(input);
        return row;
    }

    public static void Attach(TextBox input, bool optional=false)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (Inputs.TryGetValue(input,out var existing)) { existing.Optional=optional; return; }
        var state=new State { Optional=optional }; Inputs.Add(input,state);
        input.FlowDirection=FlowDirection.LeftToRight; input.HorizontalContentAlignment=HorizontalAlignment.Right;
        if (string.IsNullOrWhiteSpace(input.ToolTip?.ToString()))
            input.ToolTip = "تاریخ شمسی؛ با Ctrl+Space یا F4 تقویم را باز کنید. امروز، فردا و دیروز هم پذیرفته می‌شوند.";
        var menu=new ContextMenu();
        AddMenu(menu,"امروز",()=>SetRelative(input,0)); AddMenu(menu,"فردا",()=>SetRelative(input,1)); AddMenu(menu,"دیروز",()=>SetRelative(input,-1));
        menu.Items.Add(new Separator()); AddMenu(menu,"انتخاب از تقویم شمسی…",()=>OpenPicker(input));
        if(optional) AddMenu(menu,"پاک‌کردن تاریخ",()=>input.Clear());
        input.ContextMenu=menu;
        input.PreviewKeyDown+=(_,e)=>
        {
            if((e.Key==Key.Space&&(Keyboard.Modifiers&ModifierKeys.Control)==ModifierKeys.Control)||e.Key==Key.F4)
            { e.Handled=true; OpenPicker(input); }
        };
        input.LostKeyboardFocus+=(_,_) =>
        {
            if(state.Formatting||string.IsNullOrWhiteSpace(input.Text)||!TryParse(input.Text,out var value))return;
            var canonical=Format(value); if(canonical==input.Text)return;
            state.Formatting=true; try { input.Text=canonical; } finally { state.Formatting=false; }
        };
    }

    /// <summary>
    /// Adds the Persian calendar affordance to form inputs that follow a visible date label.
    /// This covers hand-built dialogs whose text boxes don't carry XAML names.
    /// Existing explicit date-field configuration always wins.
    /// </summary>
    public static void AttachDateFieldsByLabels(DependencyObject root)
    {
        ArgumentNullException.ThrowIfNull(root);
        foreach (var panel in EnumerateTree(root).OfType<Panel>())
        {
            for (var index = 0; index + 1 < panel.Children.Count; index++)
            {
                if (panel.Children[index] is not TextBlock label ||
                    string.IsNullOrWhiteSpace(label.Text) ||
                    !label.Text.Contains("تاریخ", StringComparison.CurrentCultureIgnoreCase))
                    continue;

                var candidates = EnumerateTree(panel.Children[index + 1]).OfType<TextBox>().Distinct().ToList();
                if (candidates.Count != 1)
                    continue;

                var input = candidates[0];
                if (Inputs.TryGetValue(input, out _))
                    continue;

                Attach(input, label.Text.Contains("اختیاری", StringComparison.CurrentCultureIgnoreCase));
            }
        }
    }

    private static IEnumerable<DependencyObject> EnumerateTree(DependencyObject root)
    {
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        var stack = new Stack<DependencyObject>();
        stack.Push(root);
        while (stack.Count > 0)
        {
            var current = stack.Pop();
            if (!visited.Add(current))
                continue;

            yield return current;
            try
            {
                foreach (var child in LogicalTreeHelper.GetChildren(current).OfType<DependencyObject>())
                    stack.Push(child);
            }
            catch (InvalidOperationException) { }

            if (current is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try
                {
                    for (var index = 0; index < VisualTreeHelper.GetChildrenCount(current); index++)
                        stack.Push(VisualTreeHelper.GetChild(current, index));
                }
                catch (InvalidOperationException) { }
            }
        }
    }

    public static void AttachNamedDateFields(DependencyObject root)
    {
        var visited=new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        var stack=new Stack<DependencyObject>(); stack.Push(root);
        while(stack.Count>0)
        {
            var node=stack.Pop(); if(!visited.Add(node))continue;
            if(node is TextBox tb && node is FrameworkElement fe)
            {
                var name=fe.Name??"";
                var match=name.Contains("Date",StringComparison.OrdinalIgnoreCase)||
                    name.Contains("Due",StringComparison.OrdinalIgnoreCase)||name.Contains("Issue",StringComparison.OrdinalIgnoreCase)||
                    (name.Contains("FiscalYear",StringComparison.OrdinalIgnoreCase)&&(name.Contains("Start",StringComparison.OrdinalIgnoreCase)||name.Contains("End",StringComparison.OrdinalIgnoreCase)));
                if(match) Attach(tb,name.Contains("Due",StringComparison.OrdinalIgnoreCase)||name.Contains("Issue",StringComparison.OrdinalIgnoreCase));
            }
            try { foreach(var child in LogicalTreeHelper.GetChildren(node).OfType<DependencyObject>())stack.Push(child); }
            catch(InvalidOperationException){}
            if(node is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try { for(var i=0;i<VisualTreeHelper.GetChildrenCount(node);i++)stack.Push(VisualTreeHelper.GetChild(node,i)); }
                catch(InvalidOperationException){}
            }
        }
    }

    private static void SetRelative(TextBox input,int offset)
    {
        var date=DateTime.Today.AddDays(offset);
        input.Text=Format(new DateTimeOffset(date,TimeZoneInfo.Local.GetUtcOffset(date)));
    }

    private static void OpenPicker(TextBox input)
    {
        var owner=Window.GetWindow(input);
        var initial=TryParse(input.Text,out var value)?value:DateTimeOffset.Now;
        var state=Inputs.TryGetValue(input,out var existing)?existing:new State();
        var picker=new PersianDatePickerWindow(owner,initial,state.Optional);
        ApplicationThemeService.ApplyWhenLoaded(picker, ApplicationThemeService.DetectTheme(owner));
        if(picker.ShowDialog()!=true)return;
        input.Text=picker.SelectedDate is DateTimeOffset chosen?Format(chosen):"";
        input.Focus(); input.CaretIndex=input.Text.Length;
    }

    private static void AddMenu(ItemsControl menu,string label,Action action)
    {
        var item=new MenuItem{Header=label}; item.Click+=(_,_)=>action(); menu.Items.Add(item);
    }

    private static string NormalizeDigits(string text)
    {
        var result=new StringBuilder(text.Length);
        foreach(var c in text)
        {
            if(c is >= '۰' and <= '۹') result.Append((char)('0'+c-'۰'));
            else if(c is >= '٠' and <= '٩') result.Append((char)('0'+c-'٠'));
            else result.Append(c);
        }
        return result.ToString();
    }
}
