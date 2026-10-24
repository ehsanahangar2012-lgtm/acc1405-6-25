using System.Threading;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class ApplicationThemeUiRegressionTests
{
    [TestMethod]
    public void GenericButtonsAndTextInputsGetConsistentThemeAwareStyles()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var button = new Button { Content = "ثبت" };
                var input = new TextBox { Text = "نمونه" };
                var root = new StackPanel();
                root.Children.Add(button);
                root.Children.Add(input);
                var window = new Window { Width = 480, Height = 260, Content = root };

                ApplicationThemeService.Apply(window, "dark");
                var darkButtonStyle = button.Style;
                var darkTextBoxStyle = input.Style;
                Assert.AreEqual(typeof(Button), darkButtonStyle.TargetType);
                Assert.AreEqual(typeof(TextBox), darkTextBoxStyle.TargetType);
                Assert.IsTrue(darkTextBoxStyle.Setters.OfType<Setter>()
                    .Any(setter => setter.Property == Control.TemplateProperty));

                ApplicationThemeService.Apply(window, "light");
                Assert.AreNotSame(darkButtonStyle, button.Style);
                Assert.AreNotSame(darkTextBoxStyle, input.Style);
                Assert.AreEqual(typeof(Button), button.Style.TargetType);
                Assert.AreEqual(typeof(TextBox), input.Style.TargetType);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("Shared WPF control styles failed on an STA thread.", failure);
    }

    [TestMethod]
    public void ScrollBarPaletteTracksBothThemesWithoutLosingContrast()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var window = new Window
                {
                    Width = 320,
                    Height = 220,
                    Background = Brushes.White,
                    Content = new ScrollViewer
                    {
                        VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                        Content = new Border { Height = 700, Child = new TextBlock { Text = "محتوای بلند برای پیمایش" } }
                    }
                };

                ApplicationThemeService.Apply(window, "dark");
                Assert.AreEqual(Color.FromRgb(11, 18, 32), ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color);
                Assert.AreEqual(Color.FromRgb(71, 85, 105), ((SolidColorBrush)window.Resources["ScrollThumbBrush"]).Color);
                Assert.AreEqual(Color.FromRgb(20, 184, 166), ((SolidColorBrush)window.Resources["ScrollThumbHoverBrush"]).Color);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Color.FromRgb(241, 245, 249), ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color);
                Assert.AreEqual(Color.FromRgb(203, 213, 225), ((SolidColorBrush)window.Resources["ScrollThumbBrush"]).Color);
                Assert.AreEqual(Color.FromRgb(15, 118, 110), ((SolidColorBrush)window.Resources["ScrollThumbHoverBrush"]).Color);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("ScrollBar palette did not follow the selected application theme.", failure);
    }

    [TestMethod]
    public void EditableComboBoxEditorTracksBothThemePalettes()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var combo = new ComboBox
                {
                    IsEditable = true,
                    ItemsSource = new[] { "شرکت نمونه بسته‌بندی", "تأمین‌کننده نمونه" },
                    SelectedIndex = 0
                };
                var window = new Window
                {
                    Width = 560,
                    Height = 220,
                    Background = Brushes.White,
                    Content = combo
                };

                ApplicationThemeService.Apply(window, "dark");
                var editor = combo.Template.FindName("PART_EditableTextBox", combo) as TextBox;
                Assert.IsNotNull(editor, "The native ComboBox must retain its editable text part for live search.");
                Assert.AreEqual(Color.FromRgb(17, 24, 39), ((SolidColorBrush)editor!.Background).Color);
                Assert.AreEqual(Color.FromRgb(243, 244, 246), ((SolidColorBrush)editor.Foreground).Color);
                Assert.AreEqual(Color.FromRgb(71, 85, 105), ((SolidColorBrush)combo.BorderBrush).Color);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)editor.Background).Color);
                Assert.AreEqual(Color.FromRgb(15, 23, 42), ((SolidColorBrush)editor.Foreground).Color);
                Assert.AreEqual(Color.FromRgb(203, 213, 225), ((SolidColorBrush)combo.BorderBrush).Color);
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(
                    ((SolidColorBrush)editor.Foreground).Color,
                    ((SolidColorBrush)editor.Background).Color) >= 4.5);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("Editable ComboBox theme parts did not follow the selected palette.", failure);
    }

    [TestMethod]
    public void DataGridThemeSwitchRestoresReadableLightPaletteAfterDarkMode()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var grid = new DataGrid { AutoGenerateColumns = false };
                grid.Columns.Add(new DataGridTextColumn
                {
                    Header = "شرح",
                    Binding = new Binding("Description")
                });
                var window = new Window
                {
                    Width = 800,
                    Height = 500,
                    Background = Brushes.White,
                    Content = grid
                };

                ApplicationThemeService.Apply(window, "dark");
                Assert.AreEqual(Color.FromRgb(17, 24, 39), ((SolidColorBrush)grid.Background).Color);
                Assert.AreEqual(Color.FromRgb(243, 244, 246), ((SolidColorBrush)grid.Foreground).Color);
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridRow)], typeof(Style));
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridCell)], typeof(Style));
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridColumnHeader)], typeof(Style));
                AssertGridStateHasReadableContrast(grid);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)grid.Background).Color);
                Assert.AreEqual(Color.FromRgb(15, 23, 42), ((SolidColorBrush)grid.Foreground).Color);
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(
                    ((SolidColorBrush)grid.Foreground).Color,
                    ((SolidColorBrush)grid.Background).Color) >= 4.5);
                AssertGridStateHasReadableContrast(grid);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("DataGrid theme switching failed on an STA thread.", failure);
    }

    [TestMethod]
    public void PersianFormLabelsAndDataGridTextCellsUseConsistentRightAlignment()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var label = new TextBlock { Text = "طرف حساب" };
                var input = new TextBox();
                var form = new StackPanel();
                form.Children.Add(label);
                form.Children.Add(input);

                var grid = new DataGrid { AutoGenerateColumns = false };
                grid.Columns.Add(new DataGridTextColumn
                {
                    Header = "شرح",
                    Binding = new Binding("Description")
                });

                var layout = new StackPanel();
                layout.Children.Add(form);
                layout.Children.Add(grid);
                var window = new Window { Width = 800, Height = 520, Content = layout };

                ApplicationThemeService.Apply(window, "dark");

                Assert.AreEqual(FlowDirection.RightToLeft, label.FlowDirection,
                    "Persian field captions should explicitly retain RTL direction.");
                Assert.AreEqual(TextAlignment.Right, label.TextAlignment,
                    "Persian field captions should align to the right edge of their field.");
                var column = (DataGridTextColumn)grid.Columns[0];
                Assert.IsNotNull(column.ElementStyle);
                Assert.IsTrue(column.ElementStyle!.Setters.OfType<Setter>().Any(
                    setter => setter.Property == TextBlock.TextAlignmentProperty &&
                              Equals(setter.Value, TextAlignment.Right)),
                    "Generated DataGrid text cells should use right-aligned Persian text.");
                Assert.IsTrue(column.ElementStyle.Setters.OfType<Setter>().Any(
                    setter => setter.Property == TextBlock.TextTrimmingProperty &&
                              Equals(setter.Value, TextTrimming.CharacterEllipsis)),
                    "Long table text should truncate cleanly while retaining its full value as a tooltip.");
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("Persian form/table alignment regression failed.", failure);
    }

    [TestMethod]
    public void DarkThemeKeepsInvoiceAndReportPrintPaperWhite()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var document = new FlowDocument
                {
                    Background = Brushes.White,
                    Foreground = Brushes.Black
                };
                document.Blocks.Add(new Paragraph(new Run("محتوای نمونهٔ پیش‌نمایش چاپ")));
                var viewer = new FlowDocumentScrollViewer
                {
                    Document = document,
                    Background = Brushes.White,
                    IsToolBarVisible = false
                };
                var paper = new Border
                {
                    Background = Brushes.White,
                    BorderBrush = Brushes.LightGray,
                    BorderThickness = new Thickness(1),
                    Child = viewer
                };
                var window = new Window
                {
                    Width = 800,
                    Height = 500,
                    Background = Brushes.White,
                    Content = paper
                };

                ApplicationThemeService.Apply(window, "dark");

                Assert.AreEqual(Color.FromRgb(17, 24, 39), ((SolidColorBrush)window.Background).Color);
                Assert.AreEqual(Colors.White, ((SolidColorBrush)paper.Background).Color);
                Assert.AreEqual(Colors.White, ((SolidColorBrush)viewer.Background).Color);
                Assert.AreEqual(Colors.White, ((SolidColorBrush)document.Background).Color);
                Assert.AreEqual(Colors.Black, ((SolidColorBrush)document.Foreground).Color);
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(
                    ((SolidColorBrush)document.Foreground).Color,
                    ((SolidColorBrush)document.Background).Color) >= 4.5);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException("Dark theme changed the printable paper palette.", failure);
    }

    private static void AssertGridStateHasReadableContrast(DataGrid grid)
    {
        var rowStyle = (Style)grid.Resources[typeof(DataGridRow)];
        var rowSelected = rowStyle.Triggers.OfType<Trigger>()
            .Single(trigger => trigger.Property == DataGridRow.IsSelectedProperty);
        AssertContrast(
            ColorOf(rowSelected.Setters, Control.ForegroundProperty),
            ColorOf(rowSelected.Setters, Control.BackgroundProperty),
            "selected row");

        var cellStyle = (Style)grid.Resources[typeof(DataGridCell)];
        var cellSelected = cellStyle.Triggers.OfType<Trigger>()
            .Single(trigger => trigger.Property == DataGridCell.IsSelectedProperty);
        AssertContrast(
            ColorOf(cellSelected.Setters, Control.ForegroundProperty),
            ColorOf(cellSelected.Setters, Control.BackgroundProperty),
            "selected cell");

        var headerStyle = (Style)grid.Resources[typeof(DataGridColumnHeader)];
        AssertContrast(
            ColorOf(headerStyle.Setters, Control.ForegroundProperty),
            ColorOf(headerStyle.Setters, Control.BackgroundProperty),
            "column header");

        var textColumn = grid.Columns.OfType<DataGridTextColumn>().Single();
        var textStyle = textColumn.ElementStyle;
        Assert.IsNotNull(textStyle, "DataGrid text cells should receive the shared text style.");
        var foregroundSetter = textStyle!.Setters.OfType<Setter>()
            .Single(setter => setter.Property == TextBlock.ForegroundProperty);
        Assert.IsInstanceOfType(foregroundSetter.Value, typeof(Binding),
            "Cell text must inherit the current cell foreground so selection remains readable.");
        Assert.AreEqual(typeof(DataGridCell), ((Binding)foregroundSetter.Value).RelativeSource?.AncestorType);
        Assert.IsTrue(textStyle.Setters.OfType<Setter>().Any(setter =>
            setter.Property == TextBlock.TextTrimmingProperty &&
            Equals(setter.Value, TextTrimming.CharacterEllipsis)));
        Assert.IsTrue(textStyle.Setters.OfType<Setter>().Any(setter =>
            setter.Property == FrameworkElement.ToolTipProperty && setter.Value is Binding),
            "Truncated cell values must remain inspectable through a tooltip.");
    }

    private static Color ColorOf(SetterBaseCollection setters, DependencyProperty property)
    {
        var setter = setters.OfType<Setter>().Single(item => item.Property == property);
        return ((SolidColorBrush)setter.Value).Color;
    }

    private static void AssertContrast(Color foreground, Color background, string state)
    {
        Assert.IsTrue(ApplicationThemeService.ContrastRatio(foreground, background) >= 4.5,
            $"{state} foreground/background contrast must be at least 4.5:1.");
    }


    [TestMethod]
    public void NavigationIconsUseKnownMonochromeWindowsGlyphs()
    {
        var converter = new NavigationIconConverter();
        Assert.AreEqual("\uE80F", converter.Convert("dashboard", typeof(string), null!, CultureInfo.InvariantCulture));
        Assert.AreEqual("\uE716", converter.Convert("customers", typeof(string), null!, CultureInfo.InvariantCulture));
        Assert.AreEqual("\uEA18", converter.Convert("security", typeof(string), null!, CultureInfo.InvariantCulture));
        Assert.AreEqual("\uE71D", converter.Convert("unknown-module", typeof(string), null!, CultureInfo.InvariantCulture));
    }

}
