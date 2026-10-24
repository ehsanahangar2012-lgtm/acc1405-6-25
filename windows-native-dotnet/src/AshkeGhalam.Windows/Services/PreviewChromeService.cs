using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace AshkeGhalam.Windows.Services;

/// <summary>Shared branded chrome for native print-preview windows.</summary>
public static class PreviewChromeService
{
    public static Border CreateToolbarFrame(UIElement toolbar)
    {
        ArgumentNullException.ThrowIfNull(toolbar);
        return new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(12),
            Margin = new Thickness(0, 0, 0, 10),
            Child = toolbar
        };
    }
}
