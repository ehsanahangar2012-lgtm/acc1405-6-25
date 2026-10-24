using System.Globalization;
using System.Windows.Data;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Maps native modules to monochrome Segoe MDL2 Assets glyphs so the right-hand
/// navigation has a consistent icon family instead of OS-dependent emoji rendering.
/// </summary>
public sealed class NavigationIconConverter : IValueConverter
{
    private static readonly IReadOnlyDictionary<string, string> Glyphs =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["dashboard"] = "\\uE80F",          // Home
            ["invoices"] = "\\uE8A5",           // Document
            ["inventory"] = "\\uE8B7",          // Folder
            ["kardex"] = "\\uE9D2",             // AreaChart
            ["checks"] = "\\uE8FB",             // Accept
            ["finance"] = "\\uE8EF",            // Calculator
            ["customers"] = "\\uE716",          // People
            ["reports"] = "\\uE9D2",             // AreaChart
            ["payments"] = "\\uE8FB",            // Accept
            ["expenses"] = "\\uE8EF",            // Calculator
            ["backup"] = "\\uE78C",              // SaveLocal
            ["vouchers"] = "\\uE8A5",             // Document
            ["accounting"] = "\\uE8EF",          // Calculator
            ["cashflow-predictor"] = "\\uE9D2",  // AreaChart
            ["tax"] = "\\uE9F9",                 // ReportDocument
            ["loans"] = "\\uE8EF",               // Calculator
            ["due-calendar"] = "\\uE787",        // Calendar
            ["bank-reconciliation"] = "\\uE8FB", // Accept
            ["currency"] = "\\uE8EC",             // Tag
            ["workflow-rules"] = "\\uE713",      // Setting
            ["financial-reports"] = "\\uE9D2",   // AreaChart
            ["companies"] = "\\uE77B",            // Contact
            ["server"] = "\\uE774",              // Globe
            ["fiscal-year"] = "\\uE787",         // Calendar
            ["security"] = "\\uEA18",            // Shield
            ["about"] = "\\uE946",               // Info
            ["guide"] = "\\uE897",               // Help
            ["advanced-settings"] = "\\uE713"    // Setting
        };

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) =>
        value is string module && Glyphs.TryGetValue(module, out var glyph)
            ? glyph
            : "\\uE71D"; // AllApps fallback

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException("Navigation icon glyphs are display-only.");
}
