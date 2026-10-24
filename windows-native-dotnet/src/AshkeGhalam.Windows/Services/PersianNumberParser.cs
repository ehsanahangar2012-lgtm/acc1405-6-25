using System.Globalization;
using System.Text;

namespace AshkeGhalam.Windows.Services;

public static class PersianNumberParser
{
    public static bool TryParseDecimal(string? input, out decimal value)
    {
        value = 0m;
        if (string.IsNullOrWhiteSpace(input)) return false;
        var normalized = new StringBuilder(input.Length);
        foreach (var c in input.Trim())
        {
            if (c >= '۰' && c <= '۹') normalized.Append((char)('0' + c - '۰'));
            else if (c >= '٠' && c <= '٩') normalized.Append((char)('0' + c - '٠'));
            else if (c == '٬' || c == '،' || c == ',') continue;
            else if (c == '٫') normalized.Append('.');
            else if (c == '/') return false;
            else normalized.Append(c);
        }
        var text = normalized.ToString().Replace(" ", "");
        return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out value) ||
               decimal.TryParse(text, NumberStyles.Number, CultureInfo.CurrentCulture, out value);
    }

    public static decimal ParseDecimal(string? input, string label)
    {
        if (!TryParseDecimal(input, out var value))
            throw new InvalidOperationException($"مقدار «{label}» معتبر نیست.");
        return value;
    }
}
