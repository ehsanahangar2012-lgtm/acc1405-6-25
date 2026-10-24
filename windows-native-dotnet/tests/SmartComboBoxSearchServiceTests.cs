using System.Windows;
using System.Windows.Input;
using System.Threading;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class SmartComboBoxSearchServiceTests
{
    [TestMethod]
    public void MatchesSearchAcrossNameCodeAndPhoneWithoutCaseSensitivity()
    {
        var values = new string?[] { "شرکت نمونه", "CuSt-104", "+98 912 000 0000", null };

        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(values, "cust-1"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(values, "نمونه"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(values, "912 000"));
    }

    [TestMethod]
    public void TrimsSearchQueryAndIgnoresBlankValues()
    {
        var values = new string?[] { null, "", "   ", "کالای بسته‌بندی" };

        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(values, "  بسته‌بندی  "));
        Assert.IsFalse(SmartComboBoxSearchService.MatchesSearch(values, "مشتری"));
    }

    [TestMethod]
    public void EmptySearchShowsAllChoicesEvenWhenSomeFieldsAreMissing()
    {
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { null, "", "کالای نمونه" }, ""));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(
            Array.Empty<string?>(), "  "));
    }

    [TestMethod]
    public void SearchRequiresAMatchingSearchableValue()
    {
        Assert.IsFalse(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { null, "کد-۱۲۰" }, "کد-۱۲۱"));
    }

    [TestMethod]
    public void SearchNormalizesPersianArabicLettersDigitsAndZeroWidthSpacing()
    {
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { "مشتري كالا ۱۲۳" }, "مشتری کالا ١٢٣"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { "جعبه‌سازی" }, "جعبه سازی"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { "كد ٤٥٦" }, "کد 456"));
        Assert.IsFalse(SmartComboBoxSearchService.MatchesSearch(
            new string?[] { "مشتری کالا 123" }, "مشتری کالا 124"));
    }

    [TestMethod]
    public void NormalizeSearchTextTrimsAndCollapsesWhitespaceWithoutChangingStoredValues()
    {
        Assert.AreEqual("کالا جعبه", SmartComboBoxSearchService.NormalizeSearchText("  كالا\u200c   جعبه  "));
        Assert.AreEqual("کد 123", SmartComboBoxSearchService.NormalizeSearchText("کد ۱۲۳"));
        Assert.AreEqual("", SmartComboBoxSearchService.NormalizeSearchText(" \u200c "));
    }

    [TestMethod]
    public void EditablePartySelectorFiltersByCodeAndKeepsTheSelectedDomainRecord()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            Window? window = null;
            try
            {
                var selectedParty = new AshkeGhalam.Windows.Models.CustomerRecord
                {
                    Id = "search-selected-party",
                    Code = "CUS-0042",
                    Name = "شرکت بسته‌بندی نمونه",
                    Phone = "09120000042",
                    IsCustomer = true,
                    Type = "CUSTOMER"
                };
                var otherParty = new AshkeGhalam.Windows.Models.CustomerRecord
                {
                    Id = "search-other-party",
                    Code = "CUS-0100",
                    Name = "فروشگاه دیگر",
                    Phone = "09120000100",
                    IsCustomer = true,
                    Type = "CUSTOMER"
                };

                var combo = new System.Windows.Controls.ComboBox
                {
                    Width = 440,
                    IsEditable = true,
                    MinHeight = 38
                };
                SmartComboBoxSearchService.SetItems(
                    combo,
                    new[] { selectedParty, otherParty },
                    party => new[] { party.Name, party.Code, party.Phone, party.Email });
                PartyComboBoxPresentationService.ApplyPersonItemTemplate(combo);

                window = new System.Windows.Window
                {
                    Title = "آزمون جست‌وجوی طرف حساب",
                    Width = 540,
                    Height = 240,
                    WindowStartupLocation = System.Windows.WindowStartupLocation.CenterScreen,
                    Content = new System.Windows.Controls.StackPanel
                    {
                        Margin = new System.Windows.Thickness(18),
                        Children = { combo }
                    }
                };
                window.Show();
                window.Activate();
                ApplicationThemeService.Apply(window, "dark");
                combo.ApplyTemplate();
                window.Dispatcher.Invoke(
                    System.Windows.Threading.DispatcherPriority.Render,
                    new Action(window.UpdateLayout));

                var editor = combo.Template.FindName("PART_EditableTextBox", combo) as System.Windows.Controls.TextBox;
                Assert.IsNotNull(editor, "The themed searchable ComboBox must retain PART_EditableTextBox.");
                Assert.AreEqual(2, combo.Items.Count, "The empty search should show all parties.");

                combo.Focus();
                Keyboard.Focus(editor!);
                window.Dispatcher.Invoke(
                    System.Windows.Threading.DispatcherPriority.Input,
                    new Action(() => { }));
                Assert.IsTrue(combo.IsKeyboardFocusWithin,
                    "Typing must begin with focus inside the real ComboBox editor.");

                editor!.Text = "CUS-0042";
                window.Dispatcher.Invoke(
                    System.Windows.Threading.DispatcherPriority.Background,
                    new Action(() => { }));
                Assert.IsTrue(combo.IsDropDownOpen,
                    "Typing a query should open the suggestions list.");
                Assert.AreEqual(1, combo.Items.Count,
                    "Code search should filter out non-matching parties.");
                Assert.AreSame(selectedParty, combo.Items[0],
                    "Filtering must keep the original CustomerRecord as the item.");

                combo.SelectedItem = selectedParty;
                Assert.AreSame(selectedParty, combo.SelectedItem,
                    "The selected value must remain the original domain record, not its display text.");
                Assert.AreEqual(2, combo.Items.Count,
                    "Selecting a party should clear the filter so the next search starts from all parties.");
            }
            catch (Exception ex)
            {
                failure = ex;
            }
            finally
            {
                if (window is not null)
                {
                    try { window.Close(); } catch (InvalidOperationException) { }
                }
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException($"Editable party search/selection integration failed: {failure}", failure);
    }

}
