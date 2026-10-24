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

        state.IsUpdating = true;
        state.Query = "";
        state.View.Refresh();
        state.IsUpdating = false;
    }

    private static void EditableTextChanged(object sender, TextChangedEventArgs e)
    {
        // Only filter genuine edits in the ComboBox's own editable text box. WPF may raise
        // the text change just before or just after it commits a popup selection, so process
        // the latest edit at Background priority and discard stale queued edits.
        if (sender is not ComboBox combo || !States.TryGetValue(combo, out var state) ||
            state.IsUpdating || e.OriginalSource is not TextBox editBox) return;

        var text = editBox.Text ?? combo.Text ?? "";
        var selectionStart = editBox.SelectionStart;
        var selectionLength = editBox.SelectionLength;
        var editVersion = ++state.EditVersion;

        combo.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (state.IsUpdating || editVersion != state.EditVersion) return;
            var currentEditor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
            var currentText = currentEditor?.Text ?? combo.Text ?? "";

            // If WPF has just committed a selected record, keep that domain object rather
            // than letting the selected label trigger another filter and clear the selection.
            if (combo.SelectedItem is object selected && IsExactValue(state, selected, currentText))
            {
                state.IsUpdating = true;
                state.Query = "";
                state.View.Refresh();
                state.IsUpdating = false;
                return;
            }

            var caret = currentEditor?.SelectionStart ?? selectionStart;
            var selection = currentEditor?.SelectionLength ?? selectionLength;
            state.IsUpdating = true;
            combo.SelectedItem = null;
            state.Query = currentText.Trim();
            state.View.Refresh();
            combo.Text = currentText;
            state.IsUpdating = false;

            if (state.Query.Length == 0) return;
            combo.IsDropDownOpen = true;
            currentEditor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
            if (currentEditor is not null)
            {
                currentEditor.SelectionStart = Math.Clamp(caret, 0, currentText.Length);
                currentEditor.SelectionLength = Math.Clamp(selection, 0, currentText.Length - currentEditor.SelectionStart);
            }
        }));
    }

    private static bool IsExactValue(SearchState state, object item, string text) =>
        !string.IsNullOrWhiteSpace(text) &&
        state.SearchValues(item).Any(value => !string.IsNullOrWhiteSpace(value) &&
            string.Equals(value.Trim(), text.Trim(), StringComparison.CurrentCultureIgnoreCase));
}
