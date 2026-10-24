using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Gives searchable person selectors the same compact two-line presentation without changing
/// the underlying records or the search values used by financial workflows.
/// </summary>
public static class PartyComboBoxPresentationService
{
    public static void ApplyPersonItemTemplate(ComboBox combo)
    {
        ArgumentNullException.ThrowIfNull(combo);
        combo.DisplayMemberPath = string.Empty;
        TextSearch.SetTextPath(combo, nameof(CustomerRecord.Name));
        combo.ItemTemplate = CreatePersonTemplate();
        combo.MaxDropDownHeight = Math.Max(combo.MaxDropDownHeight, 300);
        combo.MinHeight = Math.Max(combo.MinHeight, 36);
    }

    private static DataTemplate CreatePersonTemplate()
    {
        var root = new FrameworkElementFactory(typeof(StackPanel));
        root.SetValue(StackPanel.OrientationProperty, Orientation.Vertical);
        root.SetValue(FrameworkElement.MarginProperty, new Thickness(1, 3, 1, 3));

        var name = new FrameworkElementFactory(typeof(TextBlock));
        name.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Name)));
        name.SetValue(TextBlock.FontSizeProperty, 13d);
        name.SetValue(TextBlock.FontWeightProperty, FontWeights.SemiBold);
        root.AppendChild(name);

        var details = new FrameworkElementFactory(typeof(StackPanel));
        details.SetValue(StackPanel.OrientationProperty, Orientation.Horizontal);

        var code = new FrameworkElementFactory(typeof(TextBlock));
        code.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Code))
        {
            StringFormat = "کد: {0}"
        });
        code.SetValue(TextBlock.FontSizeProperty, 11d);
        code.SetValue(UIElement.OpacityProperty, 0.9d);
        details.AppendChild(code);

        var separator = new FrameworkElementFactory(typeof(TextBlock));
        separator.SetValue(TextBlock.TextProperty, "  •  ");
        separator.SetValue(TextBlock.FontSizeProperty, 11d);
        details.AppendChild(separator);

        var phone = new FrameworkElementFactory(typeof(TextBlock));
        phone.SetBinding(TextBlock.TextProperty, new Binding(nameof(CustomerRecord.Phone))
        {
            StringFormat = "تلفن: {0}"
        });
        phone.SetValue(TextBlock.FontSizeProperty, 11d);
        phone.SetValue(UIElement.OpacityProperty, 0.9d);
        details.AppendChild(phone);

        root.AppendChild(details);
        return new DataTemplate(typeof(CustomerRecord)) { VisualTree = root };
    }
}
