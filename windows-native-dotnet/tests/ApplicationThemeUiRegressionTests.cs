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
                Assert.AreEqual(TextAlignment.Right, input.TextAlignment,
                    "Native Persian text fields should stay right aligned after theme application.");
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
                Assert.AreEqual(Color.FromRgb(13, 24, 39), ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color);
                var darkThumb = ((SolidColorBrush)window.Resources["ScrollThumbBrush"]).Color;
Assert.AreEqual(Color.FromRgb(127, 150, 170), darkThumb);
Assert.IsTrue(ApplicationThemeService.ContrastRatio(
    ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color, darkThumb) >= 3.0,
    "Dark-theme scrollbar thumb must have at least 3:1 visual contrast.");
                Assert.AreEqual(Color.FromRgb(96, 215, 196), ((SolidColorBrush)window.Resources["ScrollThumbHoverBrush"]).Color);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Color.FromRgb(234, 240, 243), ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color);
                var lightThumb = ((SolidColorBrush)window.Resources["ScrollThumbBrush"]).Color;
Assert.AreEqual(Color.FromRgb(83, 107, 125), lightThumb);
Assert.IsTrue(ApplicationThemeService.ContrastRatio(
    ((SolidColorBrush)window.Resources["ScrollTrackBrush"]).Color, lightThumb) >= 3.0,
    "Light-theme scrollbar thumb must have at least 3:1 visual contrast.");
                Assert.AreEqual(Color.FromRgb(11, 124, 114), ((SolidColorBrush)window.Resources["ScrollThumbHoverBrush"]).Color);
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
                Assert.AreEqual(TextAlignment.Right, editor!.TextAlignment,
                    "Editable dropdown search text must remain right aligned.");
                Assert.AreEqual(FlowDirection.RightToLeft, editor.FlowDirection,
                    "Editable dropdown search must use Persian RTL direction.");
                Assert.IsInstanceOfType(combo.Resources[typeof(ComboBoxItem)], typeof(Style),
                    "The dropdown item style must be available on the ComboBox itself for isolated Popup resource lookup.");
                Assert.AreEqual(Color.FromRgb(20, 35, 56),
                    ((SolidColorBrush)combo.Resources["ComboDropDownSurfaceBrush"]).Color,
                    "Popup surface should use the current dark palette.");
                Assert.AreEqual(Color.FromRgb(20, 35, 56), ((SolidColorBrush)editor!.Background).Color);
                Assert.AreEqual(Color.FromRgb(245, 248, 251), ((SolidColorBrush)editor.Foreground).Color);
                Assert.AreEqual(Color.FromRgb(58, 82, 106), ((SolidColorBrush)combo.BorderBrush).Color);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)editor.Background).Color);
                Assert.AreEqual(Color.FromRgb(23, 45, 61), ((SolidColorBrush)editor.Foreground).Color);
                Assert.AreEqual(Color.FromRgb(213, 224, 230), ((SolidColorBrush)combo.BorderBrush).Color);
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
                grid.Columns.Add(new DataGridTextColumn
                {
                    Header = "ماندهٔ ذخیره‌شده*",
                    Binding = new Binding("Balance")
                });
                var window = new Window
                {
                    Width = 800,
                    Height = 500,
                    Background = Brushes.White,
                    Content = grid
                };

                ApplicationThemeService.Apply(window, "dark");
                Assert.AreEqual(Color.FromRgb(20, 35, 56), ((SolidColorBrush)grid.Background).Color);
                Assert.AreEqual(Color.FromRgb(245, 248, 251), ((SolidColorBrush)grid.Foreground).Color);
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridRow)], typeof(Style));
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridCell)], typeof(Style));
                Assert.IsInstanceOfType(grid.Resources[typeof(DataGridColumnHeader)], typeof(Style));
                Assert.IsTrue(grid.Columns[0].MinWidth >= 84d);
                Assert.IsTrue(grid.Columns[1].MinWidth >= 140d,
                    "Long Persian column headings must reserve enough width instead of collapsing into clipped glyphs.");
                grid.Columns.Add(new DataGridTextColumn { Header = "نام / شرکت", Binding = new Binding("Name") });
                grid.Columns.Add(new DataGridTextColumn { Header = "نقش", Binding = new Binding("RoleLabel") });
                grid.Columns.Add(new DataGridTextColumn { Header = "تلفن", Binding = new Binding("Phone") });
                ApplicationThemeService.Apply(window, "dark");
                Assert.IsTrue(grid.Columns[2].MinWidth >= 170d,
                    "Entity names need a useful minimum width even when their header is short.");
                Assert.IsTrue(grid.Columns[3].MinWidth >= 118d,
                    "Role labels must not collapse to the width of a short heading.");
                Assert.IsTrue(grid.Columns[4].MinWidth >= 130d,
                    "Phone numbers must remain comfortably readable in narrow tables.");
                Assert.IsTrue(grid.ColumnHeaderHeight >= 48d,
                    "Wrapped column headings need enough vertical space in both themes.");
                AssertGridStateHasReadableContrast(grid);

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)grid.Background).Color);
                Assert.AreEqual(Color.FromRgb(23, 45, 61), ((SolidColorBrush)grid.Foreground).Color);
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

                Assert.AreEqual(Color.FromRgb(13, 24, 39), ((SolidColorBrush)window.Background).Color);
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
            throw new AssertFailedException("Dark theme changed the printable paper palette: " + failure.Message, failure);
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

        var textColumn = grid.Columns.OfType<DataGridTextColumn>().FirstOrDefault();
        Assert.IsNotNull(textColumn, "DataGrid must have at least one text column.");
        var textStyle = textColumn!.ElementStyle;
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

    [TestMethod]
    public void InvoiceHeroKeepsWhiteTypographyVisibleOnGradientInBothThemes()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var title = new TextBlock
                {
                    Text = "صدور فاکتور | اشک قلم",
                    Foreground = Brushes.White,
                    FontSize = 24,
                    FontWeight = FontWeights.Bold
                };
                var hero = new Border
                {
                    Background = new LinearGradientBrush(
                        Color.FromRgb(10, 25, 47),
                        Color.FromRgb(15, 118, 110),
                        new Point(1, 0),
                        new Point(0, 1)),
                    Child = title,
                    Padding = new Thickness(18)
                };
                var window = new Window { Width = 620, Height = 180, Content = hero };

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)title.Foreground).Color,
                    "The authored white title on a branded gradient must not be remapped to dark ink in light mode.");
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(Colors.White, Color.FromRgb(10, 25, 47)) >= 4.5);
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(Colors.White, Color.FromRgb(15, 118, 110)) >= 4.5);

                ApplicationThemeService.Apply(window, "dark");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)title.Foreground).Color,
                    "The branded gradient title should remain white in dark mode too.");
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
            throw new AssertFailedException("Invoice hero typography did not preserve contrast on its gradient surface.", failure);
    }

    [TestMethod]
    public void TextOnCardsKeepsReadableContrastAfterBackgroundChangesInBothThemes()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var text = new TextBlock
                {
                    Text = "مشخصات فاکتور",
                    Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42))
                };
                var card = new Border
                {
                    Background = Brushes.White,
                    BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    Padding = new Thickness(14),
                    Child = text
                };
                var window = new Window
                {
                    Width = 520,
                    Height = 260,
                    Background = new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                    Content = card
                };

                ApplicationThemeService.Apply(window, "dark");
                var darkBackground = ((SolidColorBrush)card.Background).Color;
                var darkForeground = ((SolidColorBrush)text.Foreground).Color;
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(darkForeground, darkBackground) >= 4.5,
                    $"Dark card text contrast must be at least 4.5:1; got {ApplicationThemeService.ContrastRatio(darkForeground, darkBackground):0.00}:1.");
                Assert.AreEqual(Color.FromRgb(20, 35, 56), darkBackground);

                ApplicationThemeService.Apply(window, "light");
                var lightBackground = ((SolidColorBrush)card.Background).Color;
                var lightForeground = ((SolidColorBrush)text.Foreground).Color;
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(lightForeground, lightBackground) >= 4.5,
                    $"Light card text contrast must be at least 4.5:1; got {ApplicationThemeService.ContrastRatio(lightForeground, lightBackground):0.00}:1.");
                Assert.AreEqual(Colors.White, lightBackground);
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
            throw new AssertFailedException("Card text did not preserve contrast in both themes.", failure);
    }

}
