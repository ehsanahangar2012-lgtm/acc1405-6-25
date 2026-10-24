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
}
