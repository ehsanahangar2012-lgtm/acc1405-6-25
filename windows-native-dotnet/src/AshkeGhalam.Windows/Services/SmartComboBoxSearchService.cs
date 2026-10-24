using System.Runtime.CompilerServices;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using System.Windows.Threading;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Enables searchable, type-to-filter choices while preserving ComboBox.SelectedItem as the
/// original domain record. The caller provides every safe field that may be searched.
/// </summary>
public static class SmartComboBoxSearchService
{
    private sealed class SearchState
    {
        public Func<object, IEnumerable<string?>> SearchValues { get; set; } = _ => [];
        public ListCollectionView View { get; set; } = new(new List<object>());
        public string Query { get; set; } = "";
        public bool IsUpdating { get; set; }
        public int EditVersion { get; set; }
        public bool IgnoreNextTextChangeAfterSelection { get; set; }
    }

    private static readonly ConditionalWeakTable<ComboBox, SearchState> States = new();

    public static void SetItems<T>(ComboBox combo, IEnumerable<T> items, Func<T, IEnumerable<string?>> searchableValues)
    {
        ArgumentNullException.ThrowIfNull(combo);
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(searchableValues);

        if (!States.TryGetValue(combo, out var state))
        {
            state = new SearchState();
            States.Add(combo, state);
            combo.AddHandler(TextBoxBase.TextChangedEvent, new TextChangedEventHandler(EditableTextChanged), true);
            combo.SelectionChanged += SelectionChanged;
            combo.PreviewTextInput += PreviewTextInput;
            combo.PreviewKeyDown += PreviewKeyDown;
            combo.AddHandler(UIElement.PreviewMouseLeftButtonDownEvent, new MouseButtonEventHandler(ComboPreviewMouseLeftButtonDown), true);
            combo.Loaded += (_, _) => AttachEditableEditorClickHandler(combo);
        }

        state.IsUpdating = true;
        var values = items.Where(item => item is not null).Cast<object>().ToList();
        state.SearchValues = item => item is T typed
            ? searchableValues(typed) ?? Enumerable.Empty<string?>()
            : Enumerable.Empty<string?>();
        state.Query = "";
        state.IgnoreNextTextChangeAfterSelection = false;
        state.View = new ListCollectionView(values);
        state.View.Filter = item => item is not null && MatchesSearch(state.SearchValues(item), state.Query);
        combo.IsEditable = true;
        combo.IsReadOnly = false;
        combo.IsTextSearchEnabled = false;
        combo.StaysOpenOnEdit = true;
        combo.ItemsSource = state.View;
        combo.SelectedItem = null;
        combo.Text = "";
        state.IsUpdating = false;
        combo.ApplyTemplate();
        AttachEditableEditorClickHandler(combo);
    }

    /// <summary>A pure search predicate shared by the live filter and regression tests.</summary>
    public static bool MatchesSearch(IEnumerable<string?> searchableValues, string? query)
    {
        ArgumentNullException.ThrowIfNull(searchableValues);
        var term = NormalizeSearchText(query);
        if (term.Length == 0) return true;

        return searchableValues.Any(value =>
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            return NormalizeSearchText(value).Contains(term, StringComparison.CurrentCultureIgnoreCase);
        });
    }

    /// <summary>
    /// Normalizes common Persian/Arabic keyboard variants so a user can find a record even
    /// when names were imported with Arabic Yeh/Kaf, Persian digits, or zero-width spacing.
    /// The stored value and displayed record are never rewritten.
    /// </summary>
    public static string NormalizeSearchText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";

        var source = value.Normalize(NormalizationForm.FormKC);
        var result = new StringBuilder(source.Length);
        var previousWasSpace = true;
        foreach (var character in source)
        {
            if (char.IsWhiteSpace(character) || character is '\u200c' or '\u200d' or '\u00a0')
            {
                if (!previousWasSpace)
                {
                    result.Append(' ');
                    previousWasSpace = true;
                }
                continue;
            }

            // Harakat are presentation-only for this lookup; leave stored strings untouched.
            if (character is >= '\u064b' and <= '\u065f' or '\u0670')
                continue;

            var normalized = character switch
            {
                'ي' or 'ى' => 'ی',
                'ك' => 'ک',
                >= '۰' and <= '۹' => (char)('0' + character - '۰'),
                >= '٠' and <= '٩' => (char)('0' + character - '٠'),
                _ => character
            };
            result.Append(normalized);
            previousWasSpace = false;
        }

        return result.ToString().Trim();
    }

    private static void SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (sender is not ComboBox combo || !States.TryGetValue(combo, out var state) ||
            state.IsUpdating || combo.SelectedItem is null) return;

        // Do not refresh the view during WPF's selection commit. Doing so immediately can
        // remove/recreate the clicked ComboBoxItem before the editable text box has received
        // its selected display text, making mouse selection appear to do nothing.
        state.Query = "";
        state.IgnoreNextTextChangeAfterSelection = true;
        var selectionVersion = ++state.EditVersion;
        combo.Dispatcher.BeginInvoke(DispatcherPriority.DataBind, new Action(() =>
        {
            if (!States.TryGetValue(combo, out var current) ||
                !ReferenceEquals(current, state) || current.IsUpdating ||
                selectionVersion != current.EditVersion)
                return;

            current.IsUpdating = true;
            try { current.View.Refresh(); }
            finally { current.IsUpdating = false; }
        }));
    }

    private static void PreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        if (sender is ComboBox combo)
            BeginNewQueryIfAChoiceWasCommitted(combo);
    }

    private static readonly ConditionalWeakTable<TextBox, object> EditableEditorClickHandlers = new();

    private static void AttachEditableEditorClickHandler(ComboBox combo)
    {
        if (combo.Template.FindName("PART_EditableTextBox", combo) is not TextBox editor ||
            EditableEditorClickHandlers.TryGetValue(editor, out _))
            return;

        // ComboBox's editable textbox is a distinct visual child. Attach directly to the part
        // so clicks on typed text open the list even when WPF marks the parent's routed event handled.
        editor.PreviewMouseLeftButtonDown += (_, _) =>
        {
            if (!combo.IsEnabled || combo.Items.Count == 0)
                return;

            combo.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                if (!combo.IsLoaded || !combo.IsEnabled)
                    return;

                combo.IsDropDownOpen = true;
                editor.Focus();
                editor.CaretIndex = editor.Text.Length;
            }));
        };
        EditableEditorClickHandlers.Add(editor, new object());
    }

    private static void ComboPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (sender is not ComboBox combo || !combo.IsEnabled || combo.Items.Count == 0)
            return;

        // Leave the arrow toggle's own native open/close behavior intact.
        DependencyObject? current = e.OriginalSource as DependencyObject;
        for (var depth = 0; current is not null && depth < 32; depth++)
        {
            if (current is ToggleButton)
                return;
            if (ReferenceEquals(current, combo))
                break;

            DependencyObject? parent = null;
            try
            {
                if (current is Visual or Visual3D)
                    parent = VisualTreeHelper.GetParent(current);
            }
            catch (InvalidOperationException) { }
            parent ??= LogicalTreeHelper.GetParent(current);
            current = parent;
        }

        // Open after WPF finishes its pointer/focus transaction; a synchronous assignment can
        // be reversed by the ComboBox's own mouse handling.
        combo.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (!combo.IsLoaded || !combo.IsEnabled)
                return;

            combo.Focus();
            combo.IsDropDownOpen = true;
            if (combo.Template.FindName("PART_EditableTextBox", combo) is TextBox editor)
            {
                editor.Focus();
                editor.CaretIndex = editor.Text.Length;
            }
        }));
    }

    private static void PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (sender is not ComboBox combo) return;

        var paste = (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control && e.Key == Key.V;
        if (e.Key is Key.Back or Key.Delete || paste)
            BeginNewQueryIfAChoiceWasCommitted(combo);
    }

    private static void BeginNewQueryIfAChoiceWasCommitted(ComboBox combo)
    {
        if (!States.TryGetValue(combo, out var state) ||
            state.IsUpdating || combo.SelectedItem is null)
            return;

        var editor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
        state.IgnoreNextTextChangeAfterSelection = false;
        state.IsUpdating = true;
        try
        {
            combo.SelectedItem = null;
            state.Query = "";
            state.View.Refresh();
            combo.Text = "";
            editor?.Clear();
        }
        finally
        {
            state.IsUpdating = false;
        }

        combo.IsDropDownOpen = true;
    }

    private static void EditableTextChanged(object sender, TextChangedEventArgs e)
    {
        if (sender is not ComboBox combo || !States.TryGetValue(combo, out var state) ||
            state.IsUpdating || e.OriginalSource is not TextBox editBox)
            return;

        // Defer until WPF completes the current key/click transaction. A mouse selection
        // updates both SelectedItem and editable text; a real new query either clears the
        // selection in PreviewTextInput or is detected by the non-matching text below.
        var editVersion = ++state.EditVersion;
        var selectionStart = editBox.SelectionStart;
        var selectionLength = editBox.SelectionLength;

        combo.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!States.TryGetValue(combo, out var current) ||
                !ReferenceEquals(current, state) || current.IsUpdating ||
                editVersion != current.EditVersion)
                return;

            var editor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
            var text = editor?.Text ?? combo.Text ?? "";

            // Keep a committed record when WPF delivers the selected display text late.
            // Any actual new query that differs from the selected name drops the old record.
            if (combo.SelectedItem is object selected && IsSelectionText(combo, current, selected, text))
            {
                current.Query = "";
                current.IsUpdating = true;
                try { current.View.Refresh(); }
                finally { current.IsUpdating = false; }
                return;
            }

            var caret = editor?.SelectionStart ?? selectionStart;
            var length = editor?.SelectionLength ?? selectionLength;
            current.IsUpdating = true;
            try
            {
                combo.SelectedItem = null;
                current.Query = NormalizeSearchText(text);
                current.View.Refresh();
                combo.Text = text;
            }
            finally
            {
                current.IsUpdating = false;
            }

            if (current.Query.Length == 0) return;
            combo.IsDropDownOpen = true;
            editor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
            if (editor is not null)
            {
                editor.SelectionStart = Math.Clamp(caret, 0, text.Length);
                editor.SelectionLength = Math.Clamp(length, 0, text.Length - editor.SelectionStart);
            }
        }));
    }

    private static bool IsSelectionText(ComboBox combo, SearchState state, object selected, string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var textPath = TextSearch.GetTextPath(combo);
        if (!string.IsNullOrWhiteSpace(textPath))
        {
            var property = selected.GetType().GetProperty(textPath);
            var primaryText = property?.GetValue(selected)?.ToString();
            if (!string.IsNullOrWhiteSpace(primaryText) &&
                string.Equals(NormalizeSearchText(primaryText), NormalizeSearchText(text), StringComparison.Ordinal))
                return true;
        }

        return state.SearchValues(selected).Any(value => !string.IsNullOrWhiteSpace(value) &&
            string.Equals(NormalizeSearchText(value), NormalizeSearchText(text), StringComparison.Ordinal));
    }

}
