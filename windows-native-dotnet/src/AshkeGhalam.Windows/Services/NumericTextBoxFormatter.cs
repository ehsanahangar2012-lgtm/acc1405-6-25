using System.Globalization;
using System.Runtime.CompilerServices;
using System.Windows.Controls;

namespace AshkeGhalam.Windows.Services;

/// <summary>Live numeric entry formatting with thousands grouping and optional fractional digits.</summary>
public static class NumericTextBoxFormatter
{
    private static readonly ConditionalWeakTable<TextBox, FormatState> States = new();
    private static readonly CultureInfo DisplayCulture = CreateDisplayCulture();
    private const string DecimalCharacters = "./٫";

    private sealed class FormatState
    {
        public bool Formatting { get; set; }
    }

    private static CultureInfo CreateDisplayCulture()
    {
        var culture = (CultureInfo)CultureInfo.GetCultureInfo("fa-IR").Clone();
        culture.NumberFormat.NumberGroupSeparator = ",";
        culture.NumberFormat.NumberDecimalSeparator = "/";
        return culture;
    }

    public static string Format(decimal value) =>
        value.ToString("#,##0.############################", DisplayCulture);

    public static void Attach(TextBox textBox)
    {
        ArgumentNullException.ThrowIfNull(textBox);
        if (States.TryGetValue(textBox, out _)) return;
        var state = new FormatState();
        States.Add(textBox, state);
        textBox.TextChanged += (_, _) => FormatLive(textBox, state);
        textBox.LostKeyboardFocus += (_, _) => Normalize(textBox, state);
    }

    private static void FormatLive(TextBox field, FormatState state)
    {
        if (state.Formatting || !field.IsKeyboardFocusWithin || string.IsNullOrWhiteSpace(field.Text)) return;
        var current = field.Text;
        if (!PersianNumberParser.TryParseDecimal(current, out var value)) return;

        var caretIndex = Math.Clamp(field.CaretIndex, 0, current.Length);
        var prefix = current[..caretIndex];
        var decimalIndexInPrefix = prefix.IndexOfAny(DecimalCharacters.ToCharArray());
        var integerDigitsBeforeCaret = (decimalIndexInPrefix >= 0 ? prefix[..decimalIndexInPrefix] : prefix).Count(char.IsDigit);
        var fractionalDigitsBeforeCaret = decimalIndexInPrefix >= 0
            ? prefix[(decimalIndexInPrefix + 1)..].Count(char.IsDigit)
            : 0;
        var endsWithDecimal = DecimalCharacters.Contains(current[^1]);
        var formatted = Format(value);
        if (endsWithDecimal && !formatted.Contains('/')) formatted += "/";
        if (formatted == current) return;

        state.Formatting = true;
        try
        {
            field.Text = formatted;
            var formattedDecimalIndex = formatted.IndexOf('/');
            if (decimalIndexInPrefix >= 0)
            {
                if (formattedDecimalIndex < 0) formattedDecimalIndex = formatted.Length;
                if (fractionalDigitsBeforeCaret == 0)
                    field.CaretIndex = Math.Min(formatted.Length, formattedDecimalIndex + 1);
                else
                {
                    var seen = 0;
                    var newCaret = formattedDecimalIndex + 1;
                    for (var index = formattedDecimalIndex + 1; index < formatted.Length; index++)
                    {
                        if (char.IsDigit(formatted[index])) seen++;
                        newCaret = index + 1;
                        if (seen >= fractionalDigitsBeforeCaret) break;
                    }
                    field.CaretIndex = Math.Clamp(newCaret, 0, formatted.Length);
                }
            }
            else if (integerDigitsBeforeCaret == 0)
                field.CaretIndex = 0;
            else
            {
                var seen = 0;
                var newCaret = formatted.Length;
                for (var index = 0; index < formatted.Length; index++)
                {
                    if (!char.IsDigit(formatted[index])) continue;
                    seen++;
                    if (seen >= integerDigitsBeforeCaret)
                    {
                        newCaret = index + 1;
                        break;
                    }
                }
                field.CaretIndex = Math.Clamp(newCaret, 0, formatted.Length);
            }
        }
        finally { state.Formatting = false; }
    }

    private static void Normalize(TextBox field, FormatState state)
    {
        if (state.Formatting || string.IsNullOrWhiteSpace(field.Text) ||
            !PersianNumberParser.TryParseDecimal(field.Text, out var value)) return;
        var formatted = Format(value);
        if (formatted == field.Text) return;
        state.Formatting = true;
        try
        {
            field.Text = formatted;
            field.CaretIndex = formatted.Length;
        }
        finally { state.Formatting = false; }
    }
}