using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class ApplicationThemeUiRegressionTests
{
    [TestMethod]
    public void DataGridThemeSwitchRestoresReadableLightPaletteAfterDarkMode()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var grid = new DataGrid { AutoGenerateColumns = false };
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

                ApplicationThemeService.Apply(window, "light");
                Assert.AreEqual(Colors.White, ((SolidColorBrush)grid.Background).Color);
                Assert.AreEqual(Color.FromRgb(15, 23, 42), ((SolidColorBrush)grid.Foreground).Color);
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(
                    ((SolidColorBrush)grid.Foreground).Color,
                    ((SolidColorBrush)grid.Background).Color) >= 4.5);
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
}
