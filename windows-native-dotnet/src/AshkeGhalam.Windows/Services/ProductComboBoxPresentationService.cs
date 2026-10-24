using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Consistent searchable product option layout: identity, barcode and current stock.
/// It displays live record values rather than copying them into a separate lookup model.
/// </summary>
public static class ProductComboBoxPresentationService
{
    public static void ApplyProductItemTemplate(ComboBox combo)
    {
        ArgumentNullException.ThrowIfNull(combo);
        combo.DisplayMemberPath = string.Empty;
        TextSearch.SetTextPath(combo, nameof(ProductRecord.Name));
        combo.ItemTemplate = CreateProductTemplate();
        combo.MaxDropDownHeight = Math.Max(combo.MaxDropDownHeight, 300);
        combo.MinHeight = Math.Max(combo.MinHeight, 36);
    }

    private static DataTemplate CreateProductTemplate()
    {
        var root = new FrameworkElementFactory(typeof(StackPanel));
        root.SetValue(StackPanel.OrientationProperty, Orientation.Vertical);
        root.SetValue(FrameworkElement.MarginProperty, new Thickness(1, 3, 1, 3));

        var name = new FrameworkElementFactory(typeof(TextBlock));
        name.SetBinding(TextBlock.TextProperty, new Binding(nameof(ProductRecord.Name)));
        name.SetValue(TextBlock.FontSizeProperty, 13d);
        name.SetValue(TextBlock.FontWeightProperty, FontWeights.SemiBold);
        root.AppendChild(name);

        var identity = new FrameworkElementFactory(typeof(StackPanel));
        identity.SetValue(StackPanel.OrientationProperty, Orientation.Horizontal);

        var code = new FrameworkElementFactory(typeof(TextBlock));
        code.SetBinding(TextBlock.TextProperty, new Binding(nameof(ProductRecord.Code))
        {
            StringFormat = "کد: {0}"
        });
        code.SetValue(TextBlock.FontSizeProperty, 11d);
        identity.AppendChild(code);

        var separator = new FrameworkElementFactory(typeof(TextBlock));
        separator.SetValue(TextBlock.TextProperty, "  •  ");
        separator.SetValue(TextBlock.FontSizeProperty, 11d);
        identity.AppendChild(separator);

        var barcode = new FrameworkElementFactory(typeof(TextBlock));
        barcode.SetBinding(TextBlock.TextProperty, new Binding(nameof(ProductRecord.Barcode))
        {
            StringFormat = "بارکد: {0}"
        });
        barcode.SetValue(TextBlock.FontSizeProperty, 11d);
        identity.AppendChild(barcode);
        root.AppendChild(identity);

        var stock = new FrameworkElementFactory(typeof(TextBlock));
        stock.SetBinding(TextBlock.TextProperty, new MultiBinding
        {
            StringFormat = "موجودی فعلی: {0:#,##0.##} {1}",
            Bindings =
            {
                new Binding(nameof(ProductRecord.StockQuantity)),
                new Binding(nameof(ProductRecord.Unit))
            }
        });
        stock.SetValue(TextBlock.FontSizeProperty, 11d);
        stock.SetValue(FrameworkElement.MarginProperty, new Thickness(0, 1, 0, 0));
        root.AppendChild(stock);

        return new DataTemplate(typeof(ProductRecord)) { VisualTree = root };
    }
}
