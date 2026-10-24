using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Data;
using System.Windows.Input;
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
    private sealed class GridThemeState
    {
        public bool IsDark { get; set; }
        public Dictionary<DataGridTextColumn, Style?> OriginalTextStyles { get; } = [];
    }
    private static readonly ConditionalWeakTable<DataGrid, GridThemeState> GridThemeStates = new();
    private static readonly ConditionalWeakTable<ScrollViewer, FormCardState> FormCards = new();
    private sealed class ThemeManagedStyleState { }
    private static readonly ConditionalWeakTable<Button, ThemeManagedStyleState> ThemeManagedButtons = new();
    private static readonly ConditionalWeakTable<TextBox, ThemeManagedStyleState> ThemeManagedTextBoxes = new();
    private const string DialogChromeResourceKey = "AshkeGhalam.DialogChromeApplied";

    private sealed class FormCardState { }

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
        ApplyDialogPresentation(window);
        PersianDateInputService.AttachDateFieldsByLabels(window);
        NumericTextBoxFormatter.AttachNumericFieldsByLabels(window);
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
        window.Resources["ComboDropDownSurfaceBrush"] = Brush(isDark ? "#111827" : "#FFFFFF");
        window.Resources["ComboDropDownBorderBrush"] = Brush(isDark ? "#475569" : "#CBD5E1");
        window.Resources["ReadOnlySurfaceBrush"] = Brush(isDark ? "#1F2937" : "#F1F5F9");

        // Establish control templates before theme mapping, so the newly applied
        // style brushes are remapped on the very first dark-theme pass as well.
        PolishControls(window, elements, isDark);

        foreach (var element in elements)
            ApplyThemeValues(element, isDark);

        // Editable ComboBoxes create their inner text editor and drop-down visual tree
        // lazily. Synchronize those parts after palette mapping so their first rendered
        // frame uses the same contrast as the owning ComboBox in either theme.
        foreach (var combo in elements.OfType<ComboBox>())
            ConfigureComboBoxTheme(combo, isDark);

        foreach (var grid in elements.OfType<DataGrid>())
            ConfigureDataGridTheme(grid, isDark);
    }


    /// <summary>
    /// Gives native data-entry windows a consistent branded title band and a contained form surface.
    /// Print/preview windows and the already-designed invoice editor are intentionally left alone.
    /// </summary>
    private static void ApplyDialogPresentation(Window window)
    {
        var name = window.GetType().Name;
        if (name is "MainWindow" or "InvoiceDialog" or "PersianDatePickerWindow" or "BackupPasswordDialog" or
            "CheckDialog" or "KardexWindow" or "PersonKardexWindow" ||
            name.Contains("Preview", StringComparison.OrdinalIgnoreCase) ||
            window.Resources.Contains(DialogChromeResourceKey))
            return;

        var elements = EnumerateTree(window).ToList();
        if (elements.OfType<FlowDocumentScrollViewer>().Any())
            return;
        if (!elements.Any(element => element is TextBox or ComboBox or PasswordBox or DataGrid or ListBox or DatePicker))
            return;
        if (window.Content is not UIElement originalContent)
            return;

        DecorateScrollableFormCard(originalContent);
        var chrome = new DockPanel
        {
            LastChildFill = true,
            FlowDirection = FlowDirection.RightToLeft,
            Background = Brush("#F4F7FB")
        };
        var header = CreateDialogHeader(window.Title);
        DockPanel.SetDock(header, Dock.Top);
        chrome.Children.Add(header);

        // Detach before re-parenting the existing root. The form controls and their events stay intact.
        window.Content = null;
        chrome.Children.Add(originalContent);
        window.Content = chrome;
        window.Resources[DialogChromeResourceKey] = true;
    }

    private static void DecorateScrollableFormCard(UIElement content)
    {
        var scroll = EnumerateTree(content).OfType<ScrollViewer>()
            .FirstOrDefault(candidate => candidate.Content is StackPanel);
        if (scroll?.Content is not StackPanel formRoot || FormCards.TryGetValue(scroll, out _))
            return;

        formRoot.Margin = new Thickness(0);
        scroll.Content = null;
        scroll.Content = new Border
        {
            Background = Brush("#FFFFFF"),
            BorderBrush = Brush("#E2E8F0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            Padding = new Thickness(18),
            Margin = new Thickness(14),
            Child = formRoot
        };
        FormCards.Add(scroll, new FormCardState());
    }

    private static Border CreateDialogHeader(string? title)
    {
        var headerGrid = new Grid { FlowDirection = FlowDirection.RightToLeft };
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var accent = new Border
        {
            Width = 4,
            Height = 38,
            VerticalAlignment = VerticalAlignment.Center,
            CornerRadius = new CornerRadius(3),
            Background = Brush("#14B8A6")
        };
        Grid.SetColumn(accent, 0);
        headerGrid.Children.Add(accent);

        var titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titleStack.Children.Add(new TextBlock
        {
            Text = "اشک قلم",
            FontSize = 17,
            FontWeight = FontWeights.Bold,
            Foreground = Brush("#F8FAFC")
        });
        titleStack.Children.Add(new TextBlock
        {
            Text = string.IsNullOrWhiteSpace(title) ? "نسخهٔ بومی ویندوز • مدیریت مالی" : title + "  •  نسخهٔ بومی ویندوز",
            FontSize = 10,
            Foreground = Brush("#CBD5E1"),
            Margin = new Thickness(0, 2, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        Grid.SetColumn(titleStack, 2);
        headerGrid.Children.Add(titleStack);

        var chip = new Border
        {
            Background = Brush("#1F2937"),
            BorderBrush = Brush("#475569"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(10, 6, 10, 6),
            VerticalAlignment = VerticalAlignment.Center,
            Child = new TextBlock
            {
                Text = "فرم عملیاتی",
                Foreground = Brush("#F1F5F9"),
                FontSize = 10,
                FontWeight = FontWeights.SemiBold
            }
        };
        Grid.SetColumn(chip, 3);
        headerGrid.Children.Add(chip);

        return new Border
        {
            Background = Brush("#0F172A"),
            BorderBrush = Brush("#334155"),
            BorderThickness = new Thickness(0, 0, 0, 1),
            Padding = new Thickness(18, 11, 18, 11),
            Child = headerGrid
        };
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

        // DataGridTextColumn creates new TextBlocks as rows are virtualized. Give each
        // generated cell a stable ellipsis tooltip and bind its ink to its DataGridCell,
        // so newly-created cells keep the correct dark/light and selected-row foreground.
        foreach (var column in grid.Columns.OfType<DataGridTextColumn>())
        {
            if (!state.OriginalTextStyles.ContainsKey(column))
                state.OriginalTextStyles[column] = column.ElementStyle;

            var baseStyle = state.OriginalTextStyles[column];
            var cellTextStyle = baseStyle is null
                ? new Style(typeof(TextBlock))
                : new Style(typeof(TextBlock), baseStyle);
            cellTextStyle.Setters.Add(new Setter(TextBlock.ForegroundProperty, new Binding(nameof(Control.Foreground))
            {
                RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor, typeof(DataGridCell), 1)
            }));
            cellTextStyle.Setters.Add(new Setter(TextBlock.TextTrimmingProperty, TextTrimming.CharacterEllipsis));
            cellTextStyle.Setters.Add(new Setter(TextBlock.TextWrappingProperty, TextWrapping.NoWrap));
            cellTextStyle.Setters.Add(new Setter(TextBlock.TextAlignmentProperty, TextAlignment.Right));
            cellTextStyle.Setters.Add(new Setter(TextBlock.VerticalAlignmentProperty, VerticalAlignment.Center));
            cellTextStyle.Setters.Add(new Setter(FrameworkElement.ToolTipProperty, new Binding(nameof(TextBlock.Text))
            {
                RelativeSource = new RelativeSource(RelativeSourceMode.Self)
            }));
            column.ElementStyle = cellTextStyle;
        }

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
                case DataGridRow row:
                    row.Style = rowStyle;
                    break;
                case DataGridCell cell:
                    cell.Style = cellStyle;
                    break;
                case DataGridColumnHeader header:
                    header.Style = headerStyle;
                    BindGridHeaderTextForeground(header);
                    break;
            }
        }

        // Header content is created from strings after the first visual-tree theme pass.
        // Re-evaluate its ink only after the actual light/dark header surface is installed.
    }

    private static void BindGridHeaderTextForeground(DataGridColumnHeader header)
    {
        foreach (var textBlock in EnumerateTree(header).OfType<TextBlock>())
        {
            // Keep an original-value snapshot before installing the local binding, so a
            // newly realized header can safely restore its source values on the next theme pass.
            OriginalValues.GetValue(textBlock, CaptureOriginalValues);
            BindingOperations.SetBinding(textBlock, TextBlock.ForegroundProperty, new Binding(nameof(Control.Foreground))
            {
                RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor, typeof(DataGridColumnHeader), 1)
            });
        }
    }

    private static Style CreateCalendarStyle(bool isDark)
    {
        var surface = Brush(isDark ? "#111827" : "#FFFFFF");
        var text = Brush(isDark ? "#F3F4F6" : "#0F172A");
        var border = Brush(isDark ? "#475569" : "#CBD5E1");
        var style = new Style(typeof(Calendar));
        style.Setters.Add(new Setter(Control.BackgroundProperty, surface));
        style.Setters.Add(new Setter(Control.ForegroundProperty, text));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, border));
        style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
        style.Resources[typeof(CalendarDayButton)] = CreateCalendarDayButtonStyle(isDark);
        style.Resources[typeof(CalendarButton)] = CreateCalendarNavigationButtonStyle(isDark);
        return style;
    }

    private static Style CreateCalendarDayButtonStyle(bool isDark)
    {
        var style = new Style(typeof(CalendarDayButton));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.ForegroundProperty, Brush(isDark ? "#F3F4F6" : "#0F172A")));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(3)));
        style.Setters.Add(new Setter(FrameworkElement.MarginProperty, new Thickness(1)));
        style.Triggers.Add(new Trigger
        {
            Property = UIElement.IsMouseOverProperty,
            Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, Brush(isDark ? "#273447" : "#F0FDFA")),
                new Setter(Control.BorderBrushProperty, Brush(isDark ? "#0D9488" : "#99F6E4"))
            }
        });
        style.Triggers.Add(new Trigger
        {
            Property = CalendarDayButton.IsSelectedProperty,
            Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, Brush(isDark ? "#115E59" : "#0F766E")),
                new Setter(Control.ForegroundProperty, Brushes.White),
                new Setter(Control.BorderBrushProperty, Brush("#14B8A6"))
            }
        });
        style.Triggers.Add(new Trigger
        {
            Property = CalendarDayButton.IsTodayProperty,
            Value = true,
            Setters = { new Setter(Control.BorderBrushProperty, Brush("#14B8A6")) }
        });
        return style;
    }

    private static Style CreateCalendarNavigationButtonStyle(bool isDark)
    {
        var style = new Style(typeof(CalendarButton));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.ForegroundProperty, Brush(isDark ? "#F3F4F6" : "#0F172A")));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(4, 2, 4, 2)));
        style.Triggers.Add(new Trigger
        {
            Property = UIElement.IsMouseOverProperty,
            Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, Brush(isDark ? "#273447" : "#F0FDFA")),
                new Setter(Control.BorderBrushProperty, Brush(isDark ? "#0D9488" : "#99F6E4"))
            }
        });
        return style;
    }

    private static void ConfigureComboBoxTheme(ComboBox combo, bool isDark)
    {
        combo.ApplyTemplate();

        var surface = Brush(isDark ? "#111827" : "#FFFFFF");
        var foreground = Brush(isDark ? "#F3F4F6" : "#0F172A");
        var border = Brush(isDark ? "#475569" : "#CBD5E1");
        combo.Background = surface;
        combo.Foreground = foreground;
        combo.BorderBrush = border;
        combo.BorderThickness = new Thickness(1);

        if (combo.Template.FindName("PART_EditableTextBox", combo) is TextBox editor)
        {
            editor.Background = surface;
            editor.Foreground = foreground;
            editor.BorderBrush = border;
            editor.BorderThickness = new Thickness(0);
            editor.Padding = new Thickness(0);
            editor.CaretBrush = foreground;
            editor.SelectionBrush = Brush(isDark ? "#115E59" : "#99F6E4");
        }

        // Most WPF default templates name their arrow button "ToggleButton". The fallback
        // search keeps this robust for framework templates that use another internal name.
        var toggle = combo.Template.FindName("ToggleButton", combo) as ToggleButton
            ?? EnumerateTree(combo).OfType<ToggleButton>().FirstOrDefault();
        if (toggle is not null)
        {
            toggle.Background = surface;
            toggle.Foreground = foreground;
            toggle.BorderBrush = border;
        }

        if (combo.Template.FindName("PART_Popup", combo) is Popup popup)
        {
            foreach (var popupBorder in EnumerateTree(popup).OfType<Border>())
            {
                if (!string.Equals(popupBorder.Name, "DropDownBorder", StringComparison.Ordinal) &&
                    !string.Equals(popupBorder.Name, "PopupBorder", StringComparison.Ordinal))
                    continue;
                popupBorder.Background = Brush(isDark ? "#111827" : "#FFFFFF");
                popupBorder.BorderBrush = border;
            }
        }
    }

    private static Style CreateChoiceItemStyle(bool isDark, bool isListItem)
    {
        var style = new Style(isListItem ? typeof(ListBoxItem) : typeof(ComboBoxItem));
        var surface = Brush(isDark ? "#111827" : "#FFFFFF");
        var text = Brush(isDark ? "#F3F4F6" : "#0F172A");
        var hover = Brush(isDark ? "#273447" : "#F0FDFA");
        var selected = Brush(isDark ? "#115E59" : "#0F766E");

        style.Setters.Add(new Setter(Control.BackgroundProperty, surface));
        style.Setters.Add(new Setter(Control.ForegroundProperty, text));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(9, 6, 9, 6)));
        style.Setters.Add(new Setter(FrameworkElement.MinHeightProperty, 32d));
        style.Setters.Add(new Setter(Control.HorizontalContentAlignmentProperty, HorizontalAlignment.Stretch));
        style.Triggers.Add(new Trigger
        {
            Property = UIElement.IsMouseOverProperty,
            Value = true,
            Setters = { new Setter(Control.BackgroundProperty, hover) }
        });
        style.Triggers.Add(new Trigger
        {
            Property = isListItem ? ListBoxItem.IsSelectedProperty : ComboBoxItem.IsHighlightedProperty,
            Value = true,
            Setters =
            {
                new Setter(Control.BackgroundProperty, selected),
                new Setter(Control.ForegroundProperty, Brushes.White)
            }
        });
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
        // The Border directly hosting a document viewport is the paper frame, not application chrome.
        // Keep its white surface intact when the user switches the surrounding preview to dark mode.
        if (element is Border paperFrame && paperFrame.Child is FlowDocumentScrollViewer)
            return;

        if (element is FlowDocumentScrollViewer or FlowDocument or TextElement or
            DataGridRow or DataGridCell or DataGridColumnHeader)
            return;

        foreach (var property in GetBrushProperties(element))
        {
            // Text inside a DataGrid cell/header follows the hosting control's Foreground
            // through bindings. A local theme color here would take precedence over that
            // binding and leave stale ink after hover/selection or a theme change.
            if (element is TextBlock &&
                property == TextBlock.ForegroundProperty &&
                IsDataGridCellOrHeaderText(element))
                continue;

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

    private static bool IsDataGridCellOrHeaderText(DependencyObject element)
    {
        DependencyObject? current = element;
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        for (var depth = 0; current is not null && depth < 40 && visited.Add(current); depth++)
        {
            if (current is DataGridCell or DataGridColumnHeader)
                return true;
            if (current is DataGrid)
                return false;

            DependencyObject? parent = null;
            try
            {
                if (current is Visual or System.Windows.Media.Media3D.Visual3D)
                    parent = VisualTreeHelper.GetParent(current);
            }
            catch (InvalidOperationException) { }
            parent ??= LogicalTreeHelper.GetParent(current);
            current = parent;
        }
        return false;
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

    private static Color EnsureReadableContrast(Color foreground, Color background, double minimumRatio = 4.5)
    {
        if (ContrastRatio(foreground, background) >= minimumRatio)
            return foreground;

        var light = Colors.White;
        var dark = Color.FromRgb(15, 23, 42);
        var target = ContrastRatio(light, background) >= ContrastRatio(dark, background) ? light : dark;
        for (var step = 1; step <= 20; step++)
        {
            var amount = step / 20d;
            var candidate = Color.FromRgb(
                (byte)Math.Clamp((int)Math.Round(foreground.R + (target.R - foreground.R) * amount), 0, 255),
                (byte)Math.Clamp((int)Math.Round(foreground.G + (target.G - foreground.G) * amount), 0, 255),
                (byte)Math.Clamp((int)Math.Round(foreground.B + (target.B - foreground.B) * amount), 0, 255));
            if (ContrastRatio(candidate, background) >= minimumRatio)
                return candidate;
        }
        return target;
    }

    private static Color? MapForeground(Color color, bool isDark, Color? background)
    {
        var surface = background ?? (isDark ? Color.FromRgb(17, 24, 39) : Colors.White);
        Color preferred;

        if (isDark)
        {
            preferred = Saturation(color) > 0.45
                ? LightenSemanticColor(color, 0.58)
                : Brightness(color) > 0.78
                    ? color
                    : Color.FromRgb(226, 232, 240);
        }
        else if (Brightness(surface) < 0.28)
        {
            preferred = Saturation(color) > 0.4
                ? LightenSemanticColor(color, 0.56)
                : Color.FromRgb(248, 250, 252);
        }
        else if (Brightness(color) > 0.84)
        {
            preferred = Color.FromRgb(15, 23, 42);
        }
        else if (Brightness(color) > 0.52 && Saturation(color) < 0.42)
        {
            preferred = Color.FromRgb(51, 65, 85);
        }
        else
        {
            preferred = color;
        }

        // Determine the final ink from WCAG relative-luminance contrast, not brightness alone.
        return EnsureReadableContrast(preferred, surface);
    }

    private static void PolishControls(Window window, IReadOnlyCollection<DependencyObject> elements, bool isDark)
    {
        if (window.GetType().Name != "MainWindow")
            PolishFormLabels(elements);

        // Apply one native interaction language to the main shell and every modal form.
        // Explicitly styled controls (such as the custom sidebar) retain their own design.
        var buttonStyle = CreateModernButtonStyle(isDark);
        var textBoxStyle = CreateModernTextBoxStyle(isDark);
        window.Resources[typeof(Button)] = buttonStyle;
        window.Resources[typeof(TextBox)] = textBoxStyle;

        foreach (var button in elements.OfType<Button>())
        {
            // Do not replace implementation parts of the DatePicker/Calendar/ComboBox templates.
            if (button.GetType() != typeof(Button) ||
                HasVisualOrLogicalAncestor(button, typeof(ComboBox), typeof(DatePicker), typeof(Calendar), typeof(DataGrid)))
                continue;

            if (ThemeManagedButtons.TryGetValue(button, out _))
                button.Style = buttonStyle;
            else if (button.ReadLocalValue(FrameworkElement.StyleProperty) == DependencyProperty.UnsetValue)
            {
                ThemeManagedButtons.Add(button, new ThemeManagedStyleState());
                button.Style = buttonStyle;
            }

            button.MinHeight = Math.Max(button.MinHeight, 36);
            button.FontSize = Math.Max(button.FontSize, 12);
            if (button.Padding.Left < 8)
                button.Padding = new Thickness(12, 7, 12, 7);
        }

        foreach (var input in elements.OfType<TextBox>())
        {
            // An editable ComboBox owns a named PART_EditableTextBox. Re-templating that
            // child as an ordinary entry field can break search and selection.
            if (HasVisualOrLogicalAncestor(input, typeof(ComboBox), typeof(DataGrid)))
                continue;

            if (ThemeManagedTextBoxes.TryGetValue(input, out _))
                input.Style = textBoxStyle;
            else if (input.ReadLocalValue(FrameworkElement.StyleProperty) == DependencyProperty.UnsetValue)
            {
                ThemeManagedTextBoxes.Add(input, new ThemeManagedStyleState());
                input.Style = textBoxStyle;
            }

            input.FontSize = Math.Max(input.FontSize, 13);
            input.MinHeight = Math.Max(input.MinHeight, input.AcceptsReturn ? 52 : 36);
            input.BorderThickness = new Thickness(1);
            if (!input.AcceptsReturn)
                input.VerticalContentAlignment = VerticalAlignment.Center;
            if (input.Padding.Left < 6)
                input.Padding = new Thickness(9, 6, 9, 6);
        }

        foreach (var password in elements.OfType<PasswordBox>())
        {
            password.FontSize = Math.Max(password.FontSize, 13);
            password.MinHeight = Math.Max(password.MinHeight, 36);
            password.BorderThickness = new Thickness(1);
            password.Padding = new Thickness(9, 6, 9, 6);
        }

        foreach (var combo in elements.OfType<ComboBox>())
        {
            combo.FontSize = Math.Max(combo.FontSize, 13);
            combo.MinHeight = Math.Max(combo.MinHeight, 36);
            combo.BorderThickness = new Thickness(1);
            combo.Padding = new Thickness(9, 5, 9, 5);
            combo.MaxDropDownHeight = Math.Max(combo.MaxDropDownHeight, 280);
        }

        foreach (var check in elements.OfType<CheckBox>())
        {
            check.FontSize = Math.Max(check.FontSize, 12);
            check.VerticalContentAlignment = VerticalAlignment.Center;
            check.Padding = new Thickness(Math.Max(3, check.Padding.Left), 4, Math.Max(3, check.Padding.Right), 4);
        }

        foreach (var list in elements.OfType<ListBox>())
        {
            list.FontSize = Math.Max(list.FontSize, 12);
            list.BorderThickness = new Thickness(1);
            list.Padding = new Thickness(4);
        }

        foreach (var datePicker in elements.OfType<DatePicker>())
        {
            datePicker.FontSize = Math.Max(datePicker.FontSize, 13);
            datePicker.MinHeight = Math.Max(datePicker.MinHeight, 36);
            datePicker.BorderThickness = new Thickness(1);
            // DatePicker calendar content lives inside a Popup and is not reliably part of
            // the owning window visual tree. A theme-specific CalendarStyle keeps the popup
            // readable even before it has ever been opened.
            datePicker.CalendarStyle = CreateCalendarStyle(isDark);
        }

        foreach (var grid in elements.OfType<DataGrid>())
        {
            grid.FontSize = Math.Max(grid.FontSize, 12);
            grid.RowHeight = Math.Max(grid.RowHeight, 38);
            grid.ColumnHeaderHeight = Math.Max(grid.ColumnHeaderHeight, 42);
            grid.AlternationCount = Math.Max(grid.AlternationCount, 2);
            grid.HeadersVisibility = DataGridHeadersVisibility.Column;
            grid.GridLinesVisibility = DataGridGridLinesVisibility.Horizontal;
            grid.CanUserResizeRows = false;
            grid.SnapsToDevicePixels = true;
        }
    }


    private static bool HasVisualOrLogicalAncestor(DependencyObject element, params Type[] ancestorTypes)
    {
        var current = element;
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        while (current is not null && visited.Add(current))
        {
            DependencyObject? parent = null;
            try
            {
                if (current is Visual or System.Windows.Media.Media3D.Visual3D)
                    parent = VisualTreeHelper.GetParent(current);
            }
            catch (InvalidOperationException) { }
            parent ??= LogicalTreeHelper.GetParent(current);
            if (parent is null)
                return false;
            if (ancestorTypes.Any(type => type.IsInstanceOfType(parent)))
                return true;
            current = parent;
        }
        return false;
    }

    private static void PolishFormLabels(IReadOnlyCollection<DependencyObject> elements)
    {
        foreach (var panel in elements.OfType<StackPanel>())
        {
            for (var index = 0; index + 1 < panel.Children.Count; index++)
            {
                if (panel.Children[index] is not TextBlock label ||
                    panel.Children[index + 1] is not Control ||
                    string.IsNullOrWhiteSpace(label.Text))
                    continue;

                label.FontSize = Math.Clamp(label.FontSize, 12, 13);
                label.FontWeight = FontWeights.SemiBold;
                label.FlowDirection = FlowDirection.RightToLeft;
                label.TextAlignment = TextAlignment.Right;
                label.Margin = new Thickness(0, Math.Max(6, label.Margin.Top), 0, 4);
                label.TextWrapping = TextWrapping.Wrap;
            }
        }
    }

    private static Style CreateModernButtonStyle(bool isDark)
    {
        var style = new Style(typeof(Button));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(12, 7, 12, 7)));
        style.Setters.Add(new Setter(Control.MinHeightProperty, 36d));
        style.Setters.Add(new Setter(Control.FontSizeProperty, 13d));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brush(isDark ? "#1F2937" : "#FFFFFF")));
        style.Setters.Add(new Setter(Control.ForegroundProperty, Brush(isDark ? "#F3F4F6" : "#0F766E")));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, Brush(isDark ? "#475569" : "#CBD5E1")));
        style.Setters.Add(new Setter(Control.FontWeightProperty, FontWeights.SemiBold));
        style.Setters.Add(new Setter(FrameworkElement.CursorProperty, Cursors.Hand));
        style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));

        var template = new ControlTemplate(typeof(Button));
        var surface = new FrameworkElementFactory(typeof(Border), "Surface");
        surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(8));
        surface.SetBinding(Border.BackgroundProperty, new Binding(nameof(Control.Background))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.BorderBrushProperty, new Binding(nameof(Control.BorderBrush))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.BorderThicknessProperty, new Binding(nameof(Control.BorderThickness))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.PaddingProperty, new Binding(nameof(Control.Padding))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        var presenter = new FrameworkElementFactory(typeof(ContentPresenter));
        presenter.SetBinding(ContentPresenter.ContentProperty, new Binding(nameof(ContentControl.Content))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        presenter.SetBinding(ContentPresenter.ContentTemplateProperty, new Binding(nameof(ContentControl.ContentTemplate))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        // ContentPresenter does not reliably inherit Button.Foreground for plain string
        // content in this programmatic template. Bind the text brush explicitly so
        // brand, danger and secondary buttons preserve readable local foreground colors.
        presenter.SetBinding(TextElement.ForegroundProperty, new Binding(nameof(Control.Foreground))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.AppendChild(presenter);
        template.VisualTree = surface;
        template.Triggers.Add(new Trigger
        {
            Property = Button.IsKeyboardFocusedProperty, Value = true,
            Setters =
            {
                new Setter(Border.BorderBrushProperty, Brush(isDark ? "#2DD4BF" : "#0F766E"), "Surface"),
                new Setter(Border.BorderThicknessProperty, new Thickness(1.5), "Surface")
            }
        });
        template.Triggers.Add(new Trigger
        {
            Property = Button.IsMouseOverProperty, Value = true,
            Setters = { new Setter(UIElement.OpacityProperty, 0.92, "Surface") }
        });
        template.Triggers.Add(new Trigger
        {
            Property = Button.IsPressedProperty, Value = true,
            Setters = { new Setter(UIElement.OpacityProperty, 0.82, "Surface") }
        });
        template.Triggers.Add(new Trigger
        {
            Property = Button.IsEnabledProperty, Value = false,
            Setters = { new Setter(UIElement.OpacityProperty, 0.45, "Surface") }
        });
        style.Setters.Add(new Setter(Control.TemplateProperty, template));
        return style;
    }

    private static Style CreateModernTextBoxStyle(bool isDark)
    {
        var style = new Style(typeof(TextBox));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brush(isDark ? "#111827" : "#FFFFFF")));
        style.Setters.Add(new Setter(Control.ForegroundProperty, Brush(isDark ? "#F3F4F6" : "#0F172A")));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, Brush(isDark ? "#475569" : "#CBD5E1")));
        style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(9, 6, 9, 6)));
        style.Setters.Add(new Setter(Control.MinHeightProperty, 36d));
        style.Setters.Add(new Setter(Control.FontSizeProperty, 13d));
        style.Setters.Add(new Setter(Control.VerticalContentAlignmentProperty, VerticalAlignment.Center));

        var template = new ControlTemplate(typeof(TextBox));
        var surface = new FrameworkElementFactory(typeof(Border), "Surface");
        surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(7));
        surface.SetBinding(Border.BackgroundProperty, new Binding(nameof(Control.Background))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.BorderBrushProperty, new Binding(nameof(Control.BorderBrush))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.BorderThicknessProperty, new Binding(nameof(Control.BorderThickness))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });
        surface.SetBinding(Border.PaddingProperty, new Binding(nameof(Control.Padding))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent)
        });

        var contentHost = new FrameworkElementFactory(typeof(ScrollViewer), "PART_ContentHost");
        contentHost.SetValue(ScrollViewer.HorizontalScrollBarVisibilityProperty, ScrollBarVisibility.Hidden);
        contentHost.SetValue(ScrollViewer.VerticalScrollBarVisibilityProperty, ScrollBarVisibility.Hidden);
        contentHost.SetValue(ScrollViewer.FocusableProperty, false);
        surface.AppendChild(contentHost);
        template.VisualTree = surface;
        template.Triggers.Add(new Trigger
        {
            Property = UIElement.IsKeyboardFocusedProperty,
            Value = true,
            Setters =
            {
                new Setter(Border.BorderBrushProperty, Brush(isDark ? "#2DD4BF" : "#0F766E"), "Surface"),
                new Setter(Border.BorderThicknessProperty, new Thickness(1.5), "Surface")
            }
        });
        template.Triggers.Add(new Trigger
        {
            Property = UIElement.IsEnabledProperty,
            Value = false,
            Setters = { new Setter(UIElement.OpacityProperty, 0.65, "Surface") }
        });
        style.Setters.Add(new Setter(Control.TemplateProperty, template));
        return style;
    }

    /// <summary>
    /// Applies a WCAG-readable foreground to live status text using the nearest actual
    /// surface in the current visual/logical tree. Intended for status labels whose text
    /// and semantic color are updated after the window's initial theme pass.
    /// </summary>
    public static void SetReadableForeground(TextBlock target, Color preferredForeground, string? theme = null)
    {
        ArgumentNullException.ThrowIfNull(target);
        var activeTheme = Normalize(theme ?? DetectTheme(Window.GetWindow(target)));
        var isDark = activeTheme == DarkTheme;
        var background = FindNearestBackground(target) ??
            (isDark ? Color.FromRgb(17, 24, 39) : Colors.White);
        var readable = MapForeground(preferredForeground, isDark, background) ?? preferredForeground;
        target.Foreground = new SolidColorBrush(EnsureReadableContrast(readable, background));
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
