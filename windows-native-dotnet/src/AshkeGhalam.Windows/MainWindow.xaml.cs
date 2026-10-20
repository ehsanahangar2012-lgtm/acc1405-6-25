using System.Windows;
using System.Windows.Controls;

namespace AshkeGhalam.Windows;

public partial class MainWindow : Window
{
    private static readonly IReadOnlyDictionary<string, (string Title, string Description)> NavigationViews =
        new Dictionary<string, (string Title, string Description)>(StringComparer.Ordinal)
        {
            ["dashboard"] = ("نمای کلی", "این صفحه فعلاً پوستهٔ نمایشی است؛ شاخص‌ها از دادهٔ واقعی خوانده نمی‌شوند."),
            ["invoices"] = ("فاکتورها", "صفحهٔ فاکتور هنوز مهاجرت نکرده است؛ این بخش هیچ عملیات مالی انجام نمی‌دهد."),
            ["customers"] = ("مشتریان", "مدیریت مشتریان و قرارداد API هنوز به نسخهٔ بومی متصل نشده است."),
            ["inventory"] = ("انبار و کالا", "موجودی و گردش کالا تا پیاده‌سازی و آزمون منطق دامنه در دسترس نیست."),
            ["finance"] = ("امور مالی", "قواعد مالی و موتور حسابداری هنوز به این رابط متصل نشده‌اند."),
            ["reports"] = ("گزارش‌ها", "گزارش‌های این نمونه دادهٔ واقعی یا قابل استناد تولید نمی‌کنند."),
            ["cloud"] = ("خدمات ابری", "اتصال امن، لایسنس و مجوزها تا پایان آزمون‌های قراردادی غیرفعال‌اند."),
            ["backup"] = ("پشتیبان‌گیری", "تا پیاده‌سازی و آزمون بازیابی، این پوسته عملیات بک‌آپ واقعی انجام نمی‌دهد."),
            ["settings"] = ("تنظیمات", "تنظیمات محلی و اطلاعات حساس هنوز ذخیره یا تغییر داده نمی‌شوند.")
        };

    public MainWindow()
    {
        InitializeComponent();
    }

    private void Navigation_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not RadioButton { Tag: string key } ||
            !NavigationViews.TryGetValue(key, out var view))
        {
            return;
        }

        PageTitle.Text = view.Title;
        PageSubtitle.Text = $"بخش {view.Title} • نسخهٔ آزمایشی";
        FeatureDescription.Text = view.Description;
    }
}
