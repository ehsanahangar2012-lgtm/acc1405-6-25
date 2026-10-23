using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Threading;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Applies a high-contrast dark palette to the existing WPF visual tree while preserving
/// each control's original local values so the user can switch back to the light palette.
/// Invoice paper previews remain white and use their independent print-template palette.
/// </summary>
public static class ApplicationThemeService
{
    private const string LightTheme = "light";
    private const string DarkTheme = "dark";

    private sealed class Snapshot
    {
        public Dictionary<DependencyProperty, object?> LocalValues { get; } = [];
    }

    private static readonly ConditionalWeakTable<DependencyObject, Snapshot> OriginalValues = new();

    public static string Normalize(string? theme) =>
        string.Equals(theme, DarkTheme, StringComparison.OrdinalIgnoreCase) ? DarkTheme : LightTheme;

    public static void ApplyWhenLoaded(Window window, string? theme)
    {
        ArgumentNullException.ThrowIfNull(window);
        if (window.IsLoaded)
        {
            window.Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => Apply(window, theme)));
            return;
        }

        RoutedEventHandler? loaded = null;
        loaded = (_, _) =>
        {
            window.Loaded -= loaded;
            window.Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => Apply(window, theme)));
        };
        window.Loaded += loaded;
    }

    public static void Apply(Window window, string? theme)
    {
        ArgumentNullException.ThrowIfNull(window);
        var elements = EnumerateTree(window).ToList();

        foreach (var element in elements)
        {
            var snapshot = OriginalValues.GetValue(element, CaptureOriginalValues);
            RestoreOriginalValues(element, snapshot);
        }

        if (Normalize(theme) == LightTheme)
            return;

        foreach (var element in elements)
            ApplyDarkValues(element);
    }

    private static Snapshot CaptureOriginalValues(DependencyObject element)
    {
        var snapshot = new Snapshot();
        foreach (var property in GetBrushProperties(element))
            snapshot.LocalValues[property] = element.ReadLocalValue(property);
        return snapshot;
    }

    private static IEnumerable<DependencyProperty> GetBrushProperties(DependencyObject element)
    {
        // Window is not a Control in WPF. Without its BackgroundProperty, the outer shell
        // stayed light even while the selected page had switched to the dark palette.
        if (element is Window)
        {
            yield return Window.BackgroundProperty;
            yield return Window.ForegroundProperty;
        }

        if (element is Control)
        {
            yield return Control.BackgroundProperty;
            yield return Control.ForegroundProperty;
            yield return Control.BorderBrushProperty;
        }
        if (element is TextBlock)
            yield return TextBlock.ForegroundProperty;
        if (element is TextElement)
            yield return TextElement.ForegroundProperty;
        if (element is Border)
        {
            yield return Border.BackgroundProperty;
            yield return Border.BorderBrushProperty;
        }
        if (element is Panel)
            yield return Panel.BackgroundProperty;
    }

    private static void RestoreOriginalValues(DependencyObject element, Snapshot snapshot)
    {
        foreach (var pair in snapshot.LocalValues)
        {
            if (ReferenceEquals(pair.Value, DependencyProperty.UnsetValue))
                element.ClearValue(pair.Key);
            else
                element.SetValue(pair.Key, pair.Value);
        }
    }

    private static void ApplyDarkValues(DependencyObject element)
    {
        foreach (var property in GetBrushProperties(element))
        {
            if (element.GetValue(property) is not SolidColorBrush brush || brush.Color.A == 0)
                continue;

            Color? mapped = property == Control.ForegroundProperty ||
                            property == Window.ForegroundProperty ||
                            property == TextBlock.ForegroundProperty ||
                            property == TextElement.ForegroundProperty
                ? MapForeground(brush.Color)
                : property == Control.BorderBrushProperty || property == Border.BorderBrushProperty
                    ? MapBorder(brush.Color)
                    : MapBackground(brush.Color);

            if (mapped is null || mapped.Value == brush.Color)
                continue;

            var replacement = new SolidColorBrush(mapped.Value) { Opacity = brush.Opacity };
            if (replacement.CanFreeze) replacement.Freeze();
            element.SetValue(property, replacement);
        }

        var darkSurface = new SolidColorBrush(Color.FromRgb(17, 24, 39));
        var darkerSurface = new SolidColorBrush(Color.FromRgb(11, 18, 32));
        var lightText = new SolidColorBrush(Color.FromRgb(229, 231, 235));
        var outline = new SolidColorBrush(Color.FromRgb(75, 85, 99));
        var alternateRow = new SolidColorBrush(Color.FromRgb(31, 41, 55));

        if (element is Control control && element is (TextBox or ComboBox or PasswordBox or DatePicker or ListBox))
        {
            control.Background = darkSurface;
            control.Foreground = lightText;
            control.BorderBrush = outline;
        }
        if (element is TextBox input)
        {
            input.CaretBrush = lightText;
            input.SelectionBrush = new SolidColorBrush(Color.FromRgb(15, 118, 110));
        }
        if (element is ComboBoxItem or ListBoxItem)
        {
            ((Control)element).Background = darkSurface;
            ((Control)element).Foreground = lightText;
        }
        if (element is DataGrid grid)
        {
            grid.Background = darkSurface;
            grid.Foreground = lightText;
            grid.RowBackground = darkSurface;
            grid.AlternatingRowBackground = alternateRow;
            grid.GridLinesVisibility = DataGridGridLinesVisibility.Horizontal;
            grid.HorizontalGridLinesBrush = outline;
            grid.VerticalGridLinesBrush = outline;
        }
        if (element is DataGridCell cell)
        {
            cell.Background = darkSurface;
            cell.Foreground = lightText;
            cell.BorderBrush = outline;
        }
        if (element is DataGridRow row)
        {
            row.Background = darkSurface;
            row.Foreground = lightText;
        }
        if (element is DataGridColumnHeader header)
        {
            header.Background = darkerSurface;
            header.Foreground = lightText;
            header.BorderBrush = outline;
        }
    }

    private static Color? MapBackground(Color color)
    {
        var brightness = Brightness(color);
        if (brightness < 0.32)
            return color; // Already a dark surface.

        // Neutral pages, cards, and input surfaces become predictable dark layers.
        if (Saturation(color) < 0.12)
        {
            if (brightness > 0.97) return Color.FromRgb(17, 24, 39);    // #111827
            if (brightness > 0.91) return Color.FromRgb(11, 18, 32);    // #0B1220
            if (brightness > 0.82) return Color.FromRgb(31, 41, 55);    // #1F2937
            return Color.FromRgb(39, 52, 71);                           // #273447
        }

        // Bright semantic fills (warning, success, info, selected and hover surfaces)
        // must be darkened too; otherwise light-colored text can land on a pale card.
        return Color.FromRgb(
            (byte)Math.Clamp((int)(color.R * 0.36), 18, 86),
            (byte)Math.Clamp((int)(color.G * 0.36), 20, 90),
            (byte)Math.Clamp((int)(color.B * 0.36), 22, 96));
    }

    private static Color? MapBorder(Color color)
    {
        return Brightness(color) > 0.48
            ? Color.FromRgb(65, 81, 106)
            : color;
    }

    private static Color? MapForeground(Color color)
    {
        if (Brightness(color) > 0.84)
            return color; // Keep white and pale text on dark navigation/buttons.

        // Make dark headings, body text, muted labels and semantic warning text readable
        // on the new dark surfaces rather than blindly preserving low-luminance colors.
        if (Brightness(color) < 0.42)
            return Color.FromRgb(229, 231, 235); // #E5E7EB
        return Color.FromRgb(203, 213, 225);     // #CBD5E1
    }

    private static double Brightness(Color color) =>
        (0.2126 * color.R + 0.7152 * color.G + 0.0722 * color.B) / 255.0;

    private static double Saturation(Color color)
    {
        var max = Math.Max(color.R, Math.Max(color.G, color.B));
        var min = Math.Min(color.R, Math.Min(color.G, color.B));
        return max == 0 ? 0 : (max - min) / (double)max;
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
}
