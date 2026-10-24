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
        _category.Text = existing?.Category ?? "";
        _subCategory.Text = existing?.SubCategory ?? "";
        _subSubCategory.Text = existing?.SubSubCategory ?? "";
        _categoryPath.Text = existing?.CategoryPath ?? "";
        _category.LostKeyboardFocus += (_, _) => RefreshSubCategoryChoices();
        _category.SelectionChanged += (_, _) => { if (!_updatingCategoryChoices) RefreshSubCategoryChoices(); };
        _subCategory.LostKeyboardFocus += (_, _) => RefreshSubSubCategoryChoices();
        _subCategory.SelectionChanged += (_, _) => { if (!_updatingCategoryChoices) RefreshSubSubCategoryChoices(); };
        _description.Text = existing?.Description ?? "";
        _imageUrl.Text = existing?.ImageUrl ?? "";
        _quantity.IsEnabled = existing is null;

        var root = new StackPanel { Margin = new Thickness(16) };
        root.Children.Add(new Border
        {
            Background = PaletteBrush("#ECFDF5"),
            BorderBrush = PaletteBrush("#A7F3D0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(11, 9, 11, 9),
            Margin = new Thickness(0, 0, 0, 14),
            Child = new TextBlock
            {
                Text = "موجودی کالای ثبت‌شده را با «ورود موجودی» یا حواله تغییر دهید؛ ویرایش پرونده موجودی رزروشده را تغییر نمی‌دهد.",
                FontSize = 12,
                Foreground = PaletteBrush("#065F46"),
                TextWrapping = TextWrapping.Wrap
            }
        });

        var identityPrimary = new StackPanel();
        Add(identityPrimary, "نام کالا (الزامی)", _name);
        Add(identityPrimary, "کد کالا (پیشنهادی؛ باید یکتا باشد)", _code);
        Add(identityPrimary, "واحد شمارش", _unit);
        var identitySecondary = new StackPanel();
        Add(identitySecondary, "شماره سریال", _serialNumber);
        Add(identitySecondary, "بارکد کالا", _barcode);
        Add(identitySecondary, "محل قرارگیری در انبار / قفسه", _shelfLocation);
        root.Children.Add(CreateSectionCard(
            "۱. مشخصات و شناسایی کالا",
            "نام، کد داخلی، بارکد و اطلاعات شناسایی",
            CreateTwoColumnGrid(identityPrimary, identitySecondary)));

        foreach (var numericField in new[] { _quantity, _buyPrice, _sellPrice, _minStock, _weight })
            NumericTextBoxFormatter.Attach(numericField);
        var stockPrimary = new StackPanel();
        Add(stockPrimary, existing is null ? "موجودی اولیه" : "موجودی فعلی (فقط‌خواندنی در این فرم)", _quantity);
        Add(stockPrimary, "موجودی رزروشده (فقط‌خواندنی)", _reserved);
        Add(stockPrimary, "حداقل موجودی", _minStock);
        var stockSecondary = new StackPanel();
        Add(stockSecondary, "قیمت خرید (اختیاری)", _buyPrice);
        Add(stockSecondary, "قیمت فروش", _sellPrice);
        Add(stockSecondary, "وزن (اختیاری)", _weight);
        root.Children.Add(CreateSectionCard(
            "۲. موجودی و قیمت‌گذاری",
            "مقادیر منفی پذیرفته نمی‌شوند؛ موجودی رزروشده از گردش اسناد محاسبه می‌شود.",
            CreateTwoColumnGrid(stockPrimary, stockSecondary)));

        var categoryPrimary = new StackPanel();
        Add(categoryPrimary, "دسته‌بندی اصلی", _category);
        Add(categoryPrimary, "زیرگروه", _subCategory);
        var categorySecondary = new StackPanel();
        Add(categorySecondary, "زیرگروه سطح دوم", _subSubCategory);
        Add(categorySecondary, "مسیر کامل دسته‌بندی (اختیاری)", _categoryPath);
        root.Children.Add(CreateSectionCard(
            "۳. دسته‌بندی و انبار",
            "پیشنهادهای دسته‌بندی از کالاهای موجود گرفته می‌شوند و قابل ویرایش هستند.",
            CreateTwoColumnGrid(categoryPrimary, categorySecondary)));

        var detailSection = new StackPanel();
        Add(detailSection, "توضیحات کالا", _description);
        Add(detailSection, "مسیر تصویر یا URL تصویر (اختیاری)", _imageUrl);
        root.Children.Add(CreateSectionCard(
            "۴. توضیحات و تصویر",
            "اطلاعات کمکی برای شناسایی کالا و نمایش در اسناد",
            detailSection));

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
            Margin = new Thickness(0, 0, 8, 0),
            Background = PaletteBrush("#0F766E"),
            Foreground = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#0F766E")
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

            RecordIdentityValidationService.EnsureUniqueProductCode(_knownProducts, _code.Text, _existing?.Id);
            RecordIdentityValidationService.EnsureUniqueProductBarcode(_knownProducts, _barcode.Text, _existing?.Id);

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

    private static SolidColorBrush PaletteBrush(string value) =>
        new((Color)ColorConverter.ConvertFromString(value)!);

    private static Grid CreateTwoColumnGrid(UIElement first, UIElement second)
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(first, 0);
        Grid.SetColumn(second, 2);
        grid.Children.Add(first);
        var spacer = new Border { Width = 14 };
        Grid.SetColumn(spacer, 1);
        grid.Children.Add(spacer);
        grid.Children.Add(second);
        return grid;
    }

    private static Border CreateSectionCard(string title, string subtitle, UIElement content)
    {
        var heading = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
        heading.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 16,
            FontWeight = FontWeights.Bold,
            Foreground = PaletteBrush("#0F766E")
        });
        heading.Children.Add(new TextBlock
        {
            Text = subtitle,
            FontSize = 11,
            Foreground = PaletteBrush("#64748B"),
            Margin = new Thickness(0, 3, 0, 0),
            TextWrapping = TextWrapping.Wrap
        });
        var body = new StackPanel();
        body.Children.Add(heading);
        body.Children.Add(content);
        return new Border
        {
            Background = PaletteBrush("#FFFFFF"),
            BorderBrush = PaletteBrush("#CBD5E1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(15),
            Margin = new Thickness(0, 0, 0, 12),
            Child = body
        };
    }

    private static void Add(Panel root, string label, Control box)
    {
        root.Children.Add(new TextBlock
        {
            Text = label,
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
            Margin = new Thickness(0, 6, 0, 4)
        });
        box.Height = box is TextBox textBox && textBox.AcceptsReturn ? 62 : 34;
        box.Margin = new Thickness(0, 0, 0, 5);
        box.Padding = new Thickness(8, 5, 8, 5);
        root.Children.Add(box);
    }
}
