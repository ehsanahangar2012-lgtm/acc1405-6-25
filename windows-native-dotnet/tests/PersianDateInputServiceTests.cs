using System;
using System.Globalization;
using System.Windows.Media;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class PersianDateInputServiceTests
{
    [TestMethod]
    public void ParsesPersianDigitsAndNormalizesSingleDigitParts()
    {
        Assert.IsTrue(PersianDateInputService.TryParse("۱۴۰۵/۷/۲",out var value));
        Assert.AreEqual("1405/07/02",PersianDateInputService.Format(value));
    }

    [TestMethod]
    public void ParsesArabicIndicDigitsAndAlternativeSeparators()
    {
        Assert.IsTrue(PersianDateInputService.TryParse("١٤٠٥-٠٧-٠٢",out var value));
        Assert.AreEqual("1405/07/02",PersianDateInputService.Format(value));
    }

    [TestMethod]
    public void ParsesTodayTomorrowAndYesterday()
    {
        Assert.IsTrue(PersianDateInputService.TryParse("امروز",out var today));
        Assert.AreEqual(DateTime.Today,today.LocalDateTime.Date);
        Assert.IsTrue(PersianDateInputService.TryParse("فردا",out var tomorrow));
        Assert.AreEqual(DateTime.Today.AddDays(1),tomorrow.LocalDateTime.Date);
        Assert.IsTrue(PersianDateInputService.TryParse("دیروز",out var yesterday));
        Assert.AreEqual(DateTime.Today.AddDays(-1),yesterday.LocalDateTime.Date);
    }

    [TestMethod]
    public void SupportsIsoAndCompactDates()
    {
        Assert.IsTrue(PersianDateInputService.TryParse("2026-10-24",out var iso));
        var calendar=new PersianCalendar(); var date=new DateTime(2026,10,24);
        Assert.AreEqual($"{calendar.GetYear(date):0000}/{calendar.GetMonth(date):00}/{calendar.GetDayOfMonth(date):00}",PersianDateInputService.Format(iso));
        Assert.IsTrue(PersianDateInputService.TryParse("14050702",out var compact));
        Assert.AreEqual("1405/07/02",PersianDateInputService.Format(compact));
    }

    [TestMethod]
    public void RejectsInvalidDatesWithFieldName()
    {
        Assert.IsFalse(PersianDateInputService.TryParse("۱۴۰۵/۱۳/۴۰",out _));
        var error=Assert.ThrowsException<InvalidOperationException>(()=>PersianDateInputService.Parse("bad","تاریخ فاکتور"));
        StringAssert.Contains(error.Message,"تاریخ فاکتور");
    }

    [TestMethod]
    public void ParsesZwnjRelativeDatesAndCompactPersianDigits()
    {
        Assert.IsTrue(PersianDateInputService.TryParse("  پس‌فردا  ", out var afterTomorrow));
        Assert.AreEqual(DateTime.Today.AddDays(2), afterTomorrow.LocalDateTime.Date);

        Assert.IsTrue(PersianDateInputService.TryParse("۱۴۰۵۰۷۰۲", out var compact));
        Assert.AreEqual("1405/07/02", PersianDateInputService.Format(compact));
    }

    [TestMethod]
    public void RejectsImpossiblePersianAndGregorianDates()
    {
        Assert.IsFalse(PersianDateInputService.TryParse("۱۴۰۵/۱۳/۰۱", out _));
        Assert.IsFalse(PersianDateInputService.TryParse("2026/02/30", out _));
        Assert.IsFalse(PersianDateInputService.TryParse("1405/00/01", out _));
    }

    [TestMethod]
    public void ThemeDetectionUsesOwnerBackgroundBrightness()
    {
        Assert.AreEqual("dark", ApplicationThemeService.DetectThemeFromBackground(Color.FromRgb(11, 18, 32)));
        Assert.AreEqual("light", ApplicationThemeService.DetectThemeFromBackground(Color.FromRgb(241, 245, 249)));
        Assert.AreEqual("light", ApplicationThemeService.DetectThemeFromBackground(null));
    }

    [TestMethod]
    public void ThemeForegroundResolutionMaintainsReadableContrast()
    {
        var darkSurface = Color.FromRgb(17, 24, 39);
        var darkText = ApplicationThemeService.ResolveReadableForeground(
            Color.FromRgb(15, 23, 42), darkSurface, "dark");
        Assert.IsTrue(ApplicationThemeService.ContrastRatio(darkText, darkSurface) >= 4.5,
            "Dark mode body text must meet WCAG AA contrast against the dark surface.");

        var lightSurface = Colors.White;
        var lightText = ApplicationThemeService.ResolveReadableForeground(
            Colors.White, lightSurface, "light");
        Assert.IsTrue(ApplicationThemeService.ContrastRatio(lightText, lightSurface) >= 4.5,
            "Light mode must not leave white text on a white surface.");

        var accentSurface = Color.FromRgb(15, 118, 110);
        var accentText = ApplicationThemeService.ResolveReadableForeground(
            Colors.White, accentSurface, "light");
        Assert.IsTrue(ApplicationThemeService.ContrastRatio(accentText, accentSurface) >= 4.5,
            "Branded accent buttons must retain readable foreground text.");

        var warningInk = Color.FromRgb(154, 52, 18);
        var warningText = ApplicationThemeService.ResolveReadableForeground(
            warningInk, darkSurface, "dark");
        Assert.IsTrue(ApplicationThemeService.ContrastRatio(warningText, darkSurface) >= 4.5,
            "Semantic warning/error colors should lighten without losing contrast.");
    }


    [TestMethod]
    public void InvoicePartySelectionSupportsLegacyRoleTypeAndBothRoles()
    {
        var legacyCustomer = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "legacy-customer", Name = "مشتری قدیمی", Type = "CUSTOMER",
            IsCustomer = false, IsSupplier = false
        };
        var legacySupplier = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "legacy-supplier", Name = "تأمین‌کننده قدیمی", Type = "VENDOR",
            IsCustomer = false, IsSupplier = false
        };
        var dualRole = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "dual", Name = "طرف حساب مشترک", Type = "CUSTOMER",
            IsCustomer = true, IsSupplier = true
        };

        var saleParties = InvoicePartySelectionService.GetSelectableParties(
            new[] { legacyCustomer, legacySupplier, dualRole }, "SALE");
        var purchaseParties = InvoicePartySelectionService.GetSelectableParties(
            new[] { legacyCustomer, legacySupplier, dualRole }, "PURCHASE");

        CollectionAssert.AreEquivalent(new[] { "legacy-customer", "dual" }, saleParties.Select(p => p.Id).ToArray());
        CollectionAssert.AreEquivalent(new[] { "legacy-supplier", "dual" }, purchaseParties.Select(p => p.Id).ToArray());
    }

    [TestMethod]
    public void ThemeForegroundResolutionMeetsWcagForMutedAndSemanticColors()
    {
        var lightSurfaces = new[] { Colors.White, Color.FromRgb(248, 250, 252), Color.FromRgb(226, 232, 240) };
        var darkSurfaces = new[] { Color.FromRgb(17, 24, 39), Color.FromRgb(31, 41, 55), Color.FromRgb(15, 118, 110) };
        var requestedForegrounds = new[] {
            Color.FromRgb(148, 163, 184), Color.FromRgb(100, 116, 139),
            Color.FromRgb(220, 38, 38), Color.FromRgb(22, 163, 74), Colors.White
        };

        foreach (var surface in lightSurfaces)
            foreach (var foreground in requestedForegrounds)
            {
                var resolved = ApplicationThemeService.ResolveReadableForeground(foreground, surface, "light");
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(resolved, surface) >= 4.5,
                    $"Light-theme contrast must be readable for foreground {foreground} on {surface}.");
            }

        foreach (var surface in darkSurfaces)
            foreach (var foreground in requestedForegrounds)
            {
                var resolved = ApplicationThemeService.ResolveReadableForeground(foreground, surface, "dark");
                Assert.IsTrue(ApplicationThemeService.ContrastRatio(resolved, surface) >= 4.5,
                    $"Dark-theme contrast must be readable for foreground {foreground} on {surface}.");
            }
    }


    [TestMethod]
    public void AllPartyChoicesIncludeLegacyTypeOnlyRecords()
    {
        var legacyCustomer = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "legacy-customer", Name = "مشتری قدیمی", Type = "CUSTOMER",
            IsCustomer = false, IsSupplier = false
        };
        var legacySupplier = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "legacy-supplier", Name = "تأمین‌کننده قدیمی", Type = "VENDOR",
            IsCustomer = false, IsSupplier = false
        };
        var noRole = new AshkeGhalam.Windows.Models.CustomerRecord
        {
            Id = "none", Name = "بدون نقش", Type = "", IsCustomer = false, IsSupplier = false
        };

        var all = InvoicePartySelectionService.GetAllSelectableParties(new[] { legacyCustomer, legacySupplier, noRole });
        CollectionAssert.AreEquivalent(new[] { "legacy-customer", "legacy-supplier" }, all.Select(person => person.Id).ToArray());
    }

    [TestMethod]
    public void SmartComboBoxSearchMatchesNamesCodesPhonesAndEmptyQueries()
    {
        var fields = new string?[] { "شرکت نمونه", "CUS-104", "09121234567", null };
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(fields, "شرکت"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(fields, "cus-10"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(fields, "0912"));
        Assert.IsTrue(SmartComboBoxSearchService.MatchesSearch(fields, "   "));
        Assert.IsFalse(SmartComboBoxSearchService.MatchesSearch(fields, "VEND-"));
    }

}
