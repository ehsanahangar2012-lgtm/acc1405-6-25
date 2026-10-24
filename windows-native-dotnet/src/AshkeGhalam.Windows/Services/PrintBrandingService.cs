using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace AshkeGhalam.Windows.Services;

public static class PrintBrandingService
{
    public const string Website = "ashkghalam.ir";

    public static void AppendWebsiteFooter(FlowDocument document, double width = 660)
    {
        ArgumentNullException.ThrowIfNull(document);
        document.Blocks.Add(new BlockUIContainer(new Border
        {
            Width = width,
            Background = Brushes.Transparent,
            BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
            BorderThickness = new Thickness(0, 0.7, 0, 0),
            Padding = new Thickness(0, 5, 0, 0),
            Margin = new Thickness(0, 18, 0, 0),
            Child = new TextBlock
            {
                Text = Website,
                FlowDirection = FlowDirection.LeftToRight,
                FontSize = 6.5,
                Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center
            }
        }));
    }
}
