using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace AshkeGhalam.Windows.Services;

/// <summary>Shared branded chrome and readable zoom controls for native print-preview windows.</summary>
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

    /// <summary>
    /// Adds common zoom controls. Fit-to-width recalculates on resize; manual zoom remains fixed.
    /// </summary>
    public static StackPanel CreateZoomControls(FlowDocumentScrollViewer viewer, Func<double> documentWidth)
    {
        ArgumentNullException.ThrowIfNull(viewer);
        ArgumentNullException.ThrowIfNull(documentWidth);
        viewer.MinZoom = 40;
        viewer.MaxZoom = 200;
        viewer.ZoomIncrement = 10;

        var controls = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            FlowDirection = FlowDirection.LeftToRight,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 8, 0)
        };
        var label = new TextBlock
        {
            Text = $"{viewer.Zoom:0}%",
            Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            TextAlignment = TextAlignment.Center,
            MinWidth = 44,
            Margin = new Thickness(4, 0, 4, 0)
        };
        var fitToWidth = false;
        void RefreshLabel() => label.Text = $"{viewer.Zoom:0}%";
        void FitWidth()
        {
            var pageWidth = documentWidth();
            if (!double.IsFinite(pageWidth) || pageWidth <= 0) pageWidth = 794;
            var availableWidth = viewer.ActualWidth - 64;
            if (availableWidth <= 0) return;
            viewer.Zoom = Math.Clamp(availableWidth / pageWidth * 100d, viewer.MinZoom, Math.Min(150, viewer.MaxZoom));
            RefreshLabel();
        }
        Button MakeButton(string caption, string tooltip, bool accent = false) => new()
        {
            Content = caption, ToolTip = tooltip,
            Width = accent ? 84 : 32, Height = 32, MinHeight = 32,
            Padding = new Thickness(4, 2, 4, 2), Margin = new Thickness(2, 0, 2, 0),
            Background = new SolidColorBrush(accent ? Color.FromRgb(15, 118, 110) : Color.FromRgb(31, 41, 55)),
            Foreground = Brushes.White, BorderBrush = new SolidColorBrush(Color.FromRgb(71, 85, 105)),
            BorderThickness = new Thickness(1), FontSize = 12, FontWeight = FontWeights.SemiBold
        };
        var decrease = MakeButton("−", "کوچک‌نمایی");
        decrease.Click += (_, _) => { fitToWidth = false; viewer.Zoom = Math.Max(viewer.MinZoom, viewer.Zoom - viewer.ZoomIncrement); RefreshLabel(); };
        var increase = MakeButton("+", "بزرگ‌نمایی");
        increase.Click += (_, _) => { fitToWidth = false; viewer.Zoom = Math.Min(viewer.MaxZoom, viewer.Zoom + viewer.ZoomIncrement); RefreshLabel(); };
        var fit = MakeButton("تناسب عرض", "تنظیم بزرگ‌نمایی برای عرض صفحه", accent: true);
        fit.Click += (_, _) => { fitToWidth = true; FitWidth(); };
        viewer.SizeChanged += (_, _) => { if (fitToWidth) FitWidth(); };
        viewer.Loaded += (_, _) => { if (fitToWidth) FitWidth(); RefreshLabel(); };
        controls.Children.Add(decrease);
        controls.Children.Add(label);
        controls.Children.Add(increase);
        controls.Children.Add(fit);
        return controls;
    }
}
