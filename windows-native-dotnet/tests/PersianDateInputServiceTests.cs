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

}
