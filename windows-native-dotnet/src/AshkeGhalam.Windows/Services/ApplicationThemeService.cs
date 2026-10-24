using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Threading;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Applies consistent light/dark palettes to native WPF controls. Printable FlowDocument
/// content is deliberately excluded: the toolbar/window may change theme, but invoice,
/// receipt and ledger paper must keep their own print palette and readable table cells.
/// DataGrid row/cell states are supplied by theme-specific styles so virtualization,
/// hover and selection cannot reintroduce low-contrast XAML trigger colors.
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
    private sealed class GridThemeState { public bool IsDark { get; set; } }
    private static readonly ConditionalWeakTable<DataGrid, GridThemeState> GridThemeStates = new();

    public static string Normalize(string? theme) =>
        string.Equals(theme, DarkTheme, StringComparison.OrdinalIgnoreCase) ? DarkTheme : LightTheme;

    /// <summary>Resolve the palette for pop-up windows from the owning window's current surface.</summary>
    public static string DetectTheme(Window? reference)
    {
        var background = (reference?.Background as SolidColorBrush)?.Color;
        return DetectThemeFromBackground(background);
    }

    /// <summary>A pure brightness-based resolver so dark/light palette selection can be unit-tested.</summary>
    public static string DetectThemeFromBackground(Color? background) =>
        background is Color color && Brightness(color) < 0.32 ? DarkTheme : LightTheme;

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
        var isDark = Normalize(theme) == DarkTheme;
        var elements = EnumerateTree(window).ToList();

        // Always restore a control's original values before deriving the requested palette.
        // This is important when toggling dark -> light and for elements first seen later.
        foreach (var element in elements)
        {
            var snapshot = OriginalValues.GetValue(element, CaptureOriginalValues);
            RestoreOriginalValues(element, snapshot);
        }

        // Explicit styles also theme popup choices, which are hosted in WPF Popup trees and
        // therefore do not reliably appear in the main window's visual-tree enumeration.
        window.Resources[typeof(ComboBoxItem)] = CreateChoiceItemStyle(isDark, isListItem: false);
        window.Resources[typeof(ListBoxItem)] = CreateChoiceItemStyle(isDark, isListItem: true);

        foreach (var element in elements)
            ApplyThemeValues(element, isDark);

        foreach (var grid in elements.OfType<DataGrid>())
            ConfigureDataGridTheme(grid, isDark);
    }

    private static void ConfigureDataGridTheme(DataGrid grid, bool isDark)
    {
        var state = GridThemeStates.GetValue(grid, _ => new GridThemeState());
        state.IsDark = isDark;
        var surface = Brush(isDark ? "#111827" : "#FFFFFF");
        var alternate = Brush(isDark ? "#1F2937" : "#F8FAFC");
        var text = Brush(isDark ? "#F3F4F6" : "#0F172A");
        var muted = Brush(isDark ? "#CBD5E1" : "#334155");
        var border = Brush(isDark ? "#475569" : "#CBD5E1");
        var headerSurface = Brush(isDark ? "#0B1220" : "#E2E8F0");
        var selected = Brush(isDark ? "#115E59" : "#CCFBF1");
        var selectedText = Brush(isDark ? "#FFFFFF" : "#134E4A");
        var hover = Brush(isDark ? "#273447" : "#F0FDFA");

        grid.Background = surface;
        grid.Foreground = text;
        grid.RowBackground = surface;
        grid.AlternatingRowBackground = alternate;
        grid.HorizontalGridLinesBrush = border;
        grid.VerticalGridLinesBrush = border;
        grid.GridLinesVisibility = DataGridGridLinesVisibility.Horizontal;

        // Do not mutate realized rows/cells directly. Theme-specific styles stay in effect
        // for virtualized rows and retain working hover/selection states.
        var rowStyle = new Style(typeof(DataGridRow));
        rowStyle.Setters.Add(new Setter(FrameworkElement.MinHeightProperty, 36d));
        rowStyle.Setters.Add(new Setter(Control.BackgroundProperty, surface));
        rowStyle.Setters.Add(new Setter(Control.ForegroundProperty, text));
        rowStyle.Setters.Add(new Setter(Control.BorderBrushProperty, border));
        rowStyle.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(0, 0, 0, 1)));
        rowStyle.Triggers.Add(new Trigger
        {
            Property = ItemsControl.AlternationIndexProperty, Value = 1,
            Setters = { new Setter(Control.BackgroundProperty, alternate) }
        });
        rowStyle.Triggers.Add(new Trigger
        {
            Property = UIElement.IsMouseOverProperty, Value = true,
            Setters = { new Setter(Control.BackgroundProperty, hover) }
        });
        rowStyle.Triggers.Add(new Trigger
        {
            Property = DataGridRow.IsSelectedProperty, Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, selected),
                new Setter(Control.ForegroundProperty, selectedText)
            }
        });

        var cellStyle = new Style(typeof(DataGridCell));
        cellStyle.Setters.Add(new Setter(Control.BackgroundProperty, Brushes.Transparent));
        cellStyle.Setters.Add(new Setter(Control.ForegroundProperty, text));
        cellStyle.Setters.Add(new Setter(Control.BorderBrushProperty, border));
        cellStyle.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(0, 0, 0, 1)));
        cellStyle.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(9, 5, 9, 5)));
        cellStyle.Setters.Add(new Setter(Control.VerticalContentAlignmentProperty, VerticalAlignment.Center));
        cellStyle.Triggers.Add(new Trigger
        {
            Property = DataGridCell.IsSelectedProperty, Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, selected),
                new Setter(Control.ForegroundProperty, selectedText)
            }
        });

        var headerStyle = new Style(typeof(DataGridColumnHeader));
        headerStyle.Setters.Add(new Setter(Control.BackgroundProperty, headerSurface));
        headerStyle.Setters.Add(new Setter(Control.ForegroundProperty, muted));
        headerStyle.Setters.Add(new Setter(Control.BorderBrushProperty, border));
        headerStyle.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(0, 0, 1, 1)));
        headerStyle.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(9, 7, 9, 7)));
        headerStyle.Setters.Add(new Setter(Control.FontWeightProperty, FontWeights.Bold));
        headerStyle.Setters.Add(new Setter(Control.HorizontalContentAlignmentProperty, HorizontalAlignment.Center));
        headerStyle.Setters.Add(new Setter(FrameworkElement.MinHeightProperty, 40d));

        grid.Resources[typeof(DataGridRow)] = rowStyle;
        grid.Resources[typeof(DataGridCell)] = cellStyle;
        grid.Resources[typeof(DataGridColumnHeader)] = headerStyle;

        // Implicit styles are cached on already-realized virtualized elements, so assign
        // the freshly selected style to the rows/cells currently on screen as well.
        foreach (var element in EnumerateTree(grid))
        {
            switch (element)
            {
                case DataGridRow row: row.Style = rowStyle; break;
                case DataGridCell cell: cell.Style = cellStyle; break;
                case DataGridColumnHeader header: header.Style = headerStyle; break;
            }
        }
    }

    private static Style CreateChoiceItemStyle(bool isDark, bool isListItem)
    {
        var style = new Style(isListItem ? typeof(ListBoxItem) : typeof(ComboBoxItem));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brush(isDark ? "#111827" : "#FFFFFF")));
        style.Setters.Add(new Setter(Control.ForegroundProperty, Brush(isDark ? "#F3F4F6" : "#0F172A")));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(9, 6, 9, 6)));
        style.Setters.Add(new Setter(FrameworkElement.MinHeightProperty, 32d));
        return style;
    }

    private static SolidColorBrush Brush(string value) => new((Color)ColorConverter.ConvertFromString(value)!);

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
        if (element is TextBox)
        {
            // These were set locally in dark mode but were not previously included in the
            // snapshot, leaving a pale caret/selection after switching back to light mode.
            yield return TextBox.CaretBrushProperty;
            yield return TextBox.SelectionBrushProperty;
        }
        if (element is DataGrid)
        {
            // Preserve the full DataGrid palette so toggling dark -> light restores defaults.
            yield return DataGrid.RowBackgroundProperty;
            yield return DataGrid.AlternatingRowBackgroundProperty;
            yield return DataGrid.HorizontalGridLinesBrushProperty;
            yield return DataGrid.VerticalGridLinesBrushProperty;
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

    private static void ApplyThemeValues(DependencyObject element, bool isDark)
    {
        // Keep the document viewport itself neutral as well as its document children:
        // remapping FlowDocumentScrollViewer.Background tints the white paper and makes
        // printed table ink/row fills look broken. Only the surrounding preview chrome themes.
        // Grid rows/cells/headers use styles so local values cannot defeat hover/selection.
        if (element is FlowDocumentScrollViewer or FlowDocument or TextElement or
            DataGridRow or DataGridCell or DataGridColumnHeader)
            return;

        foreach (var property in GetBrushProperties(element))
        {
            if (element.GetValue(property) is not SolidColorBrush brush || brush.Color.A == 0)
                continue;

            Color? mapped = property == Control.ForegroundProperty ||
                            property == Window.ForegroundProperty ||
                            property == TextBlock.ForegroundProperty ||
                            property == TextElement.ForegroundProperty
                ? MapForeground(brush.Color, isDark, FindNearestBackground(element))
                : property == Control.BorderBrushProperty || property == Border.BorderBrushProperty
                    ? MapBorder(brush.Color, isDark)
                    : MapBackgroundForTheme(brush.Color, isDark);

            if (mapped is null || mapped.Value == brush.Color)
                continue;

            var replacement = new SolidColorBrush(mapped.Value) { Opacity = brush.Opacity };
            if (replacement.CanFreeze) replacement.Freeze();
            element.SetValue(property, replacement);
        }

        if (element is Control control && element is (TextBox or ComboBox or PasswordBox or DatePicker or ListBox))
        {
            control.Background = Brush(isDark ? "#111827" : "#FFFFFF");
            control.Foreground = Brush(isDark ? "#F3F4F6" : "#0F172A");
            control.BorderBrush = Brush(isDark ? "#475569" : "#CBD5E1");
        }

        if (element is TextBox input)
        {
            input.CaretBrush = Brush(isDark ? "#F3F4F6" : "#0F172A");
            input.SelectionBrush = Brush(isDark ? "#115E59" : "#99F6E4");
        }

        if (element is DataGrid grid)
        {
            grid.Background = Brush(isDark ? "#111827" : "#FFFFFF");
            grid.Foreground = Brush(isDark ? "#F3F4F6" : "#0F172A");
        }
    }

    private static Color? FindNearestBackground(DependencyObject element)
    {
        var current = element;
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        for (var depth = 0; current is not null && depth < 20 && visited.Add(current); depth++)
        {
            SolidColorBrush? brush = current switch
            {
                Window window => window.Background as SolidColorBrush,
                Control control => control.Background as SolidColorBrush,
                Border border => border.Background as SolidColorBrush,
                Panel panel => panel.Background as SolidColorBrush,
                _ => null
            };
            if (brush is not null && brush.Color.A > 0)
                return brush.Color;

            DependencyObject? parent = null;
            try
            {
                if (current is Visual or System.Windows.Media.Media3D.Visual3D)
                    parent = VisualTreeHelper.GetParent(current);
            }
            catch (InvalidOperationException) { }
            parent ??= LogicalTreeHelper.GetParent(current);
            current = parent!;
        }
        return null;
    }

    private static Color? MapBackgroundForTheme(Color color, bool isDark)
    {
        var brightness = Brightness(color);
        if (!isDark)
        {
            // Keep deliberate dark brand/navigation surfaces. Normalize pale neutral
            // surfaces so the light theme has a clean white paper/card hierarchy.
            if (Saturation(color) < 0.12)
            {
                if (brightness < 0.28) return color;
                if (brightness > 0.94) return Colors.White;
                if (brightness > 0.80) return Color.FromRgb(248, 250, 252);
                if (brightness > 0.65) return Color.FromRgb(226, 232, 240);
            }
            return color;
        }

        if (brightness < 0.32)
            return color;

        if (Saturation(color) < 0.12)
        {
            if (brightness > 0.97) return Color.FromRgb(17, 24, 39);
            if (brightness > 0.91) return Color.FromRgb(11, 18, 32);
            if (brightness > 0.82) return Color.FromRgb(31, 41, 55);
            return Color.FromRgb(39, 52, 71);
        }

        // Saturated semantic surfaces must be darkened in dark mode to maintain readable
        // contrast with light text and prevent pale success/warning fills from glowing.
        return Color.FromRgb(
            (byte)Math.Clamp((int)(color.R * 0.36), 18, 86),
            (byte)Math.Clamp((int)(color.G * 0.36), 20, 90),
            (byte)Math.Clamp((int)(color.B * 0.36), 22, 96));
    }

    private static Color? MapBorder(Color color, bool isDark)
    {
        if (isDark)
            return Saturation(color) > 0.35
                ? Color.FromRgb(13, 148, 136)
                : Color.FromRgb(71, 85, 105);
        return Color.FromRgb(203, 213, 225);
    }

    private static Color LightenSemanticColor(Color color, double amount = 0.56) =>
        Color.FromRgb(
            (byte)Math.Clamp((int)Math.Round(color.R + (255 - color.R) * amount), 0, 255),
            (byte)Math.Clamp((int)Math.Round(color.G + (255 - color.G) * amount), 0, 255),
            (byte)Math.Clamp((int)Math.Round(color.B + (255 - color.B) * amount), 0, 255));

    private static Color? MapForeground(Color color, bool isDark, Color? background)
    {
        var fgBrightness = Brightness(color);
        var bgBrightness = background is Color bg ? Brightness(bg) : (isDark ? 0.08 : 0.97);

        if (isDark)
        {
            if (fgBrightness > 0.84) return color;
            if (Saturation(color) > 0.45) return LightenSemanticColor(color);
            return fgBrightness < 0.42
                ? Color.FromRgb(243, 244, 246)
                : Color.FromRgb(203, 213, 225);
        }

        // White text cannot remain white on a light card after dark -> light switching.
        if (fgBrightness > 0.84)
        {
            if (bgBrightness < 0.42) return Colors.White;
            return Color.FromRgb(15, 23, 42);
        }

        // Dark text on a retained dark brand surface must be lifted, not left invisible.
        if (bgBrightness < 0.28)
        {
            if (Saturation(color) > 0.4) return LightenSemanticColor(color);
            return Color.FromRgb(243, 244, 246);
        }

        // Strengthen muted slate text on light surfaces; preserve strongly saturated
        // semantic colors (warning/error/success) rather than flattening their meaning.
        if (bgBrightness > 0.75 && fgBrightness < 0.52 && Saturation(color) < 0.42)
            return Color.FromRgb(51, 65, 85);
        return color;
    }

    /// <summary>Pure contrast resolver used by UI regression tests.</summary>
    public static Color ResolveReadableForeground(Color foreground, Color background, string? theme) =>
        MapForeground(foreground, Normalize(theme) == DarkTheme, background) ?? foreground;

    /// <summary>WCAG contrast ratio helper for regression tests.</summary>
    public static double ContrastRatio(Color first, Color second)
    {
        static double Luminance(Color c)
        {
            static double Linear(byte value)
            {
                var channel = value / 255.0;
                return channel <= 0.04045 ? channel / 12.92 : Math.Pow((channel + 0.055) / 1.055, 2.4);
            }
            return 0.2126 * Linear(c.R) + 0.7152 * Linear(c.G) + 0.0722 * Linear(c.B);
        }

        var a = Luminance(first);
        var b = Luminance(second);
        return (Math.Max(a, b) + 0.05) / (Math.Min(a, b) + 0.05);
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

            // FlowDocumentScrollViewer is the viewport for a print-paper document. Its
            // child visual tree is deliberately not recolored; only the surrounding
            // preview chrome/toolbar follows the app theme. This prevents white paper,
            // printed table cells, and their independent ink palette from being remapped.
            if (current is FlowDocumentScrollViewer or FlowDocument or TextElement)
                continue;

            try
            {
                foreach (var child in LogicalTreeHelper.GetChildren(current).OfType<DependencyObject>())
                {
                    if (child is FlowDocumentScrollViewer or FlowDocument or TextElement)
                        continue;
                    stack.Push(child);
                }
            }
            catch (InvalidOperationException) { }

            if (current is Visual or System.Windows.Media.Media3D.Visual3D)
            {
                try
                {
                    for (var index = 0; index < VisualTreeHelper.GetChildrenCount(current); index++)
                    {
                        var child = VisualTreeHelper.GetChild(current, index);
                        if (child is FlowDocumentScrollViewer or FlowDocument or TextElement)
                            continue;
                        stack.Push(child);
                    }
                }
                catch (InvalidOperationException) { }
            }
        }
    }
}
