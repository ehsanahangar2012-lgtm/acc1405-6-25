using System.Runtime.CompilerServices;
using System.Text;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
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
        }

        state.IsUpdating = true;
        var values = items.Where(item => item is not null).Cast<object>().ToList();
        state.SearchValues = item => item is T typed
            ? searchableValues(typed) ?? Enumerable.Empty<string?>()
            : Enumerable.Empty<string?>();
        state.Query = "";
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

    private static void EditableTextChanged(object sender, TextChangedEventArgs e)
    {
        if (sender is not ComboBox combo || !States.TryGetValue(combo, out var state) ||
            state.IsUpdating || e.OriginalSource is not TextBox editBox) return;

        // Defer filtering until WPF has finished the current keyboard/mouse transaction.
        // In particular, ComboBox writes the chosen item's display text while committing a
        // popup click. Filtering synchronously at that moment used to cancel the selection.
        var selectionStart = editBox.SelectionStart;
        var selectionLength = editBox.SelectionLength;
        var editVersion = ++state.EditVersion;

        combo.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!States.TryGetValue(combo, out var current) ||
                !ReferenceEquals(current, state) || current.IsUpdating ||
                editVersion != current.EditVersion)
                return;

            var editor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
            var text = editor?.Text ?? combo.Text ?? "";

            // Keep the selected record when WPF has just populated its primary display text.
            // The explicit TextSearch path is required because this selector has a rich
            // ItemTemplate (name/code/phone) but its editable text must remain the name only.
            if (combo.SelectedItem is object selected && IsSelectionText(combo, current, selected, text))
            {
                current.Query = "";
                current.IsUpdating = true;
                try { current.View.Refresh(); }
                finally { current.IsUpdating = false; }
                return;
            }

            var caret = editor?.SelectionStart ?? selectionStart;
            var selection = editor?.SelectionLength ?? selectionLength;
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
                editor.SelectionLength = Math.Clamp(selection, 0, text.Length - editor.SelectionStart);
            }
        }));
    }

    private static bool IsSelectionText(ComboBox combo, SearchState state, object selected, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

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

    private static bool IsExactValue(SearchState state, object item, string text) =>
        !string.IsNullOrWhiteSpace(text) && IsSelectionTextCore(state, item, text);

    private static bool IsSelectionTextCore(SearchState state, object item, string text) =>
        state.SearchValues(item).Any(value => !string.IsNullOrWhiteSpace(value) &&
            string.Equals(NormalizeSearchText(value), NormalizeSearchText(text), StringComparison.Ordinal));
}
