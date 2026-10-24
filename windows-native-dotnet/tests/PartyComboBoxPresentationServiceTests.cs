using System.Threading;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class PartyComboBoxPresentationServiceTests
{
    [TestMethod]
    public void PersonTemplateCanBeAppliedWithoutReplacingTheSelectedRecord()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var person = new CustomerRecord
                {
                    Id = "party-template-test",
                    Name = "شرکت آزمایشی",
                    Code = "CUS-0042",
                    Phone = "09120000042"
                };
                var combo = new ComboBox { IsEditable = true };

                SmartComboBoxSearchService.SetItems(combo, new[] { person },
                    value => new[] { value.Name, value.Code, value.Phone, value.Email });
                PartyComboBoxPresentationService.ApplyPersonItemTemplate(combo);
                combo.SelectedItem = person;

                Assert.IsNotNull(combo.ItemTemplate);
                Assert.AreEqual(string.Empty, combo.DisplayMemberPath);
                Assert.AreEqual(nameof(CustomerRecord.Name), TextSearch.GetTextPath(combo));
                Assert.AreSame(person, combo.SelectedItem);
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
            throw new AssertFailedException("Person ComboBox template failed on an STA thread.", failure);
    }
}
