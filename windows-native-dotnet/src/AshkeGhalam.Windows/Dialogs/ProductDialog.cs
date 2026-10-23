using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Dialogs;

public sealed class ProductDialog : Window
{
    private readonly TextBox _name = new();
    private readonly TextBox _code = new();
    private readonly TextBox _serialNumber = new();
    private readonly TextBox _barcode = new();
    private readonly TextBox _unit = new() { Text = "عدد" };
    private readonly TextBox _quantity = new() { Text = "0" };
    private readonly TextBox _reserved = new() { IsReadOnly = true, Background = new SolidColorBrush(Color.FromRgb(241, 245, 249)) };
    private readonly TextBox _minStock = new();
    private readonly TextBox _buyPrice = new();
    private readonly TextBox _sellPrice = new() { Text = "0" };
    private readonly TextBox _weight = new();
    private readonly TextBox _shelfLocation = new();
    private readonly ComboBox _category = new() { IsEditable = true, IsTextSearchEnabled = true, StaysOpenOnEdit = true, Height = 34 };
    private readonly ComboBox _subCategory = new() { IsEditable = true, IsTextSearchEnabled = true, StaysOpenOnEdit = true, Height = 34 };
    private readonly ComboBox _subSubCategory = new() { IsEditable = true, IsTextSearchEnabled = true, StaysOpenOnEdit = true, Height = 34 };
    private readonly ComboBox _categoryPath = new() { IsEditable = true, IsTextSearchEnabled = true, StaysOpenOnEdit = true, Height = 34 };
    private readonly List<ProductRecord> _knownProducts;
    private bool _updatingCategoryChoices;
    private readonly TextBox _description = new() { Height = 62, AcceptsReturn = true, TextWrapping = TextWrapping.Wrap };
    private readonly TextBox _imageUrl = new();
    private readonly ProductRecord? _existing;

    public ProductRecord? Result { get; private set; }

    public ProductDialog(Window owner, ProductRecord? existing = null, string suggestedCode = "", IReadOnlyList<ProductRecord>? knownProducts = null)
    {
        _existing = existing;
        _knownProducts = knownProducts?.ToList() ?? (existing is null ? [] : [existing]);
        Owner = owner;
        Title = existing is null ? "ثبت کالا و موجودی اولیه" : "ویرایش پرونده کالا";
        Width = 620;
        Height = 820;
        MinHeight = 650;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ResizeMode = ResizeMode.CanResize;
        FlowDirection = FlowDirection.RightToLeft;
        FontFamily = new System.Windows.Media.FontFamily("pack://application:,,,/Assets/Fonts/#Vazirmatn");
        Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));

        _name.Text = existing?.Name ?? "";
        _code.Text = existing?.Code ?? suggestedCode;
        _serialNumber.Text = existing?.SerialNumber ?? "";
        _barcode.Text = existing?.Barcode ?? "";
        _unit.Text = existing?.Unit ?? "عدد";
        _quantity.Text = NumericTextBoxFormatter.Format(existing?.StockQuantity ?? 0m);
        _reserved.Text = NumericTextBoxFormatter.Format(existing?.ReservedStock ?? 0m);
        _minStock.Text = existing?.MinStock is decimal minStock ? NumericTextBoxFormatter.Format(minStock) : "";
        _buyPrice.Text = existing?.BuyPrice is decimal buyPrice ? NumericTextBoxFormatter.Format(buyPrice) : "";
        _sellPrice.Text = NumericTextBoxFormatter.Format(existing?.SellPrice ?? existing?.UnitPrice ?? 0m);
        _weight.Text = existing?.Weight is decimal weight ? NumericTextBoxFormatter.Format(weight) : "";
        _shelfLocation.Text = existing?.ShelfLocation ?? "";
        _category.Text = existing?.Category ?? "";
        _subCategory.Text = existing?.SubCategory ?? "";
        _subSubCategory.Text = existing?.SubSubCategory ?? "";
        _categoryPath.Text = existing?.CategoryPath ?? "";
        SetChoices(_category, _knownProducts.Select(product => product.Category));
        SetChoices(_subCategory, _knownProducts.Select(product => product.SubCategory));
        SetChoices(_subSubCategory, _knownProducts.Select(product => product.SubSubCategory));
        SetChoices(_categoryPath, _knownProducts.Select(product => product.CategoryPath));
        _category.LostKeyboardFocus += (_, _) => RefreshSubCategoryChoices();
        _category.SelectionChanged += (_, _) => { if (!_updatingCategoryChoices) RefreshSubCategoryChoices(); };
        _subCategory.LostKeyboardFocus += (_, _) => RefreshSubSubCategoryChoices();
        _subCategory.SelectionChanged += (_, _) => { if (!_updatingCategoryChoices) RefreshSubSubCategoryChoices(); };
        _description.Text = existing?.Description ?? "";
        _imageUrl.Text = existing?.ImageUrl ?? "";
        _quantity.IsEnabled = existing is null;

        var root = new StackPanel { Margin = new Thickness(22) };
        root.Children.Add(new TextBlock
        {
            Text = existing is null ? "پرونده کالا و انبار" : "ویرایش پرونده کالا",
            FontSize = 22,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
            Margin = new Thickness(0, 0, 0, 8)
        });
        root.Children.Add(new TextBlock
        {
            Text = "فیلدهای کالا مطابق مدل نسخهٔ اصلی گسترش یافته‌اند. تغییر موجودی با عملیات مستقل «ورود موجودی» انجام می‌شود؛ موجودی رزروشده در این فرم قابل تغییر نیست.",
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });

        Add(root, "نام کالا (الزامی)", _name);
        Add(root, "کد کالا (خودکار پیشنهاد شده؛ قابل ویرایش و باید یکتا باشد)", _code);
        Add(root, "شماره سریال اختصاصی کالا", _serialNumber);
        Add(root, "بارکد کالا (برای اسکنر دستی)", _barcode);
        Add(root, "واحد (مثلاً عدد، کیلوگرم، متر)", _unit);
        Add(root, existing is null ? "موجودی اولیه" : "موجودی فعلی (فقط از «ورود موجودی» تغییر می‌کند)", _quantity);
        Add(root, "موجودی رزروشده (فقط‌خواندنی)", _reserved);
        Add(root, "حداقل موجودی (اختیاری)", _minStock);
        Add(root, "قیمت خرید (اختیاری)", _buyPrice);
        Add(root, "قیمت فروش", _sellPrice);
        foreach (var numericField in new[] { _quantity, _buyPrice, _sellPrice, _minStock, _weight })
            NumericTextBoxFormatter.Attach(numericField);
        Add(root, "وزن (اختیاری)", _weight);
        Add(root, "محل قرارگیری در انبار / قفسه", _shelfLocation);
        Add(root, "دسته‌بندی اصلی", _category);
        Add(root, "زیرگروه", _subCategory);
        Add(root, "زیرگروه سطح دوم", _subSubCategory);
        Add(root, "مسیر کامل دسته‌بندی (اختیاری)", _categoryPath);
        Add(root, "توضیحات کالا", _description);
        Add(root, "مسیر تصویر یا URL تصویر (اختیاری)", _imageUrl);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 16, 0, 0)
        };
        var save = new Button
        {
            Content = existing is null ? "ذخیره کالا" : "ثبت تغییرات",
            Width = 120,
            Height = 36,
            IsDefault = true,
            Margin = new Thickness(0, 0, 8, 0)
        };
        buttons.Children.Add(save);
        buttons.Children.Add(new Button { Content = "انصراف", Width = 90, Height = 36, IsCancel = true });
        var layout = new Grid { Margin = new Thickness(0) };
        layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var body = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Content = root };
        Grid.SetRow(body, 0);
        Grid.SetRow(buttons, 1);
        buttons.Margin = new Thickness(22, 10, 22, 18);
        layout.Children.Add(body);
        layout.Children.Add(buttons);
        Content = layout;

        save.Click += (_, _) => SaveResult();
    }

    private static void SetChoices(ComboBox combo, IEnumerable<string?> values)
    {
        combo.ItemsSource = values.Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(value => value, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private void RefreshSubCategoryChoices()
    {
        var category = _category.Text.Trim();
        var current = _subCategory.Text;
        _updatingCategoryChoices = true;
        SetChoices(_subCategory, _knownProducts
            .Where(product => string.IsNullOrWhiteSpace(category) ||
                string.Equals(product.Category, category, StringComparison.CurrentCultureIgnoreCase))
            .Select(product => product.SubCategory));
        _subCategory.Text = current;
        _updatingCategoryChoices = false;
        RefreshSubSubCategoryChoices();
    }

    private void RefreshSubSubCategoryChoices()
    {
        var category = _category.Text.Trim();
        var subCategory = _subCategory.Text.Trim();
        var current = _subSubCategory.Text;
        _updatingCategoryChoices = true;
        SetChoices(_subSubCategory, _knownProducts
            .Where(product => (string.IsNullOrWhiteSpace(category) ||
                    string.Equals(product.Category, category, StringComparison.CurrentCultureIgnoreCase)) &&
                (string.IsNullOrWhiteSpace(subCategory) ||
                    string.Equals(product.SubCategory, subCategory, StringComparison.CurrentCultureIgnoreCase)))
            .Select(product => product.SubSubCategory));
        _subSubCategory.Text = current;
        _updatingCategoryChoices = false;
    }

    private void SaveResult()
    {
        try
        {
            var name = _name.Text.Trim();
            var quantity = PersianNumberParser.ParseDecimal(_quantity.Text, "موجودی");
            var sellPrice = AccountingRules.Money(PersianNumberParser.ParseDecimal(_sellPrice.Text, "قیمت فروش"));
            var reserved = _existing?.ReservedStock ?? 0m;
            var minStock = ParseOptional(_minStock.Text, "حداقل موجودی");
            var buyPrice = ParseOptional(_buyPrice.Text, "قیمت خرید");
            var weight = ParseOptional(_weight.Text, "وزن");

            if (name.Length < 2)
                throw new InvalidOperationException("نام کالا باید حداقل دو نویسه باشد.");
            if (quantity < 0m || sellPrice < 0m || reserved < 0m ||
                (minStock.HasValue && minStock.Value < 0m) ||
                (buyPrice.HasValue && buyPrice.Value < 0m) ||
                (weight.HasValue && weight.Value < 0m))
                throw new InvalidOperationException("موجودی، وزن و قیمت‌ها نمی‌توانند منفی باشند.");

            var category = _category.Text.Trim();
            var subCategory = _subCategory.Text.Trim();
            var subSubCategory = _subSubCategory.Text.Trim();
            var categoryPath = _categoryPath.Text.Trim();
            if (string.IsNullOrWhiteSpace(categoryPath))
                categoryPath = string.Join(" / ", new[] { category, subCategory, subSubCategory }.Where(v => !string.IsNullOrWhiteSpace(v)));

            Result = new ProductRecord
            {
                Id = _existing?.Id ?? Guid.NewGuid().ToString("N"),
                Name = name,
                Code = _code.Text.Trim(),
                SerialNumber = _serialNumber.Text.Trim(),
                Barcode = _barcode.Text.Trim(),
                Unit = string.IsNullOrWhiteSpace(_unit.Text) ? "عدد" : _unit.Text.Trim(),
                StockQuantity = _existing?.StockQuantity ?? quantity,
                ReservedStock = reserved,
                MinStock = minStock,
                BuyPrice = buyPrice,
                SellPrice = sellPrice,
                Weight = weight,
                ShelfLocation = _shelfLocation.Text.Trim(),
                Category = category,
                SubCategory = subCategory,
                SubSubCategory = subSubCategory,
                CategoryPath = categoryPath,
                Description = _description.Text.Trim(),
                ImageUrl = _imageUrl.Text.Trim(),
                CreatedAt = _existing?.CreatedAt ?? DateTimeOffset.Now
            };
            DialogResult = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "بررسی اطلاعات کالا", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static void FormatNumericField(TextBox field)
    {
        if (string.IsNullOrWhiteSpace(field.Text)) return;
        try { field.Text = NumericTextBoxFormatter.Format(PersianNumberParser.ParseDecimal(field.Text, "عدد")); }
        catch (InvalidOperationException) { }
    }

    private static decimal? ParseOptional(string text, string label) =>
        string.IsNullOrWhiteSpace(text) ? null : AccountingRules.Money(PersianNumberParser.ParseDecimal(text, label));

    private static void Add(Panel root, string label, TextBox box)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 6, 0, 4)
        });
        box.Height = box.AcceptsReturn ? 62 : 32;
        box.Margin = new Thickness(0, 0, 0, 5);
        box.Padding = new Thickness(8, 5, 8, 5);
        root.Children.Add(box);
    }
}
