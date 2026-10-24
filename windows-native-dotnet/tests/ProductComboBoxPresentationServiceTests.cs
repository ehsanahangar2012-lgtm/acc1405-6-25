using System.Threading;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class ProductComboBoxPresentationServiceTests
{
    [TestMethod]
    public void ProductTemplateShowsDomainRecordsAndPreservesSelectedItem()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var product = new ProductRecord
                {
                    Id = "product-template-test",
                    Name = "کالای آزمایشی",
                    Code = "SKU-0042",
                    Barcode = "6260000042001",
                    StockQuantity = 14.5m,
                    Unit = "عدد"
                };
                var combo = new ComboBox { IsEditable = true };

                SmartComboBoxSearchService.SetItems(combo, new[] { product },
                    value => new[] { value.Name, value.Code, value.Barcode, value.SerialNumber });
                ProductComboBoxPresentationService.ApplyProductItemTemplate(combo);
                combo.SelectedItem = product;

                Assert.IsNotNull(combo.ItemTemplate);
                Assert.AreEqual(string.Empty, combo.DisplayMemberPath);
                Assert.AreEqual(nameof(ProductRecord.Name), TextSearch.GetTextPath(combo));
                Assert.AreSame(product, combo.SelectedItem);
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
            throw new AssertFailedException("Product ComboBox template failed on an STA thread.", failure);
    }
}
