namespace AshkeGhalam.Windows.Models;

public sealed class AccountingData
{
    public int SchemaVersion { get; set; } = 1;
    public int NextInvoiceNumber { get; set; } = 1;
    public List<CustomerRecord> Customers { get; set; } = [];
    public List<ProductRecord> Products { get; set; } = [];
    public List<InvoiceRecord> Invoices { get; set; } = [];
    public List<PaymentRecord> Payments { get; set; } = [];
    public List<ExpenseRecord> Expenses { get; set; } = [];

    public AccountingData DeepCopy() => new()
    {
        SchemaVersion = SchemaVersion,
        NextInvoiceNumber = NextInvoiceNumber,
        Customers = Customers.Select(c => new CustomerRecord
        { Id=c.Id, Name=c.Name, Phone=c.Phone, Address=c.Address, CreatedAt=c.CreatedAt }).ToList(),
        Products = Products.Select(p => new ProductRecord
        { Id=p.Id, Name=p.Name, Sku=p.Sku, Unit=p.Unit, StockQuantity=p.StockQuantity, UnitPrice=p.UnitPrice, CreatedAt=p.CreatedAt }).ToList(),
        Invoices = Invoices.Select(i => new InvoiceRecord
        {
            Id=i.Id, Number=i.Number, CustomerId=i.CustomerId, CustomerName=i.CustomerName,
            Description=i.Description, Lines=i.Lines.Select(l => new InvoiceLine
            { ProductId=l.ProductId, ProductName=l.ProductName, Quantity=l.Quantity, UnitPrice=l.UnitPrice, LineTotal=l.LineTotal }).ToList(),
            Subtotal=i.Subtotal, TaxRatePercent=i.TaxRatePercent, TaxAmount=i.TaxAmount,
            Total=i.Total, CreatedAt=i.CreatedAt, Notes=i.Notes, Status=i.Status
        }).ToList(),
        Payments = Payments.Select(p => new PaymentRecord
        { Id=p.Id, InvoiceId=p.InvoiceId, InvoiceNumber=p.InvoiceNumber, CustomerName=p.CustomerName, Amount=p.Amount, Method=p.Method, Reference=p.Reference, CreatedAt=p.CreatedAt }).ToList(),
        Expenses = Expenses.Select(e => new ExpenseRecord
        { Id=e.Id, Title=e.Title, Category=e.Category, Amount=e.Amount, Notes=e.Notes, CreatedAt=e.CreatedAt }).ToList()
    };
}

public sealed class CustomerRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class ProductRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string Sku { get; set; } = "";
    public string Unit { get; set; } = "عدد";
    public decimal StockQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class InvoiceLine
{
    public string ProductId { get; set; } = "";
    public string ProductName { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

public sealed class InvoiceRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int Number { get; set; }
    public string CustomerId { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Description { get; set; } = "";
    public List<InvoiceLine> Lines { get; set; } = [];
    public decimal Subtotal { get; set; }
    public decimal TaxRatePercent { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "صادر شده";
}

public sealed class PaymentRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string InvoiceId { get; set; } = "";
    public int InvoiceNumber { get; set; }
    public string CustomerName { get; set; } = "";
    public decimal Amount { get; set; }
    public string Method { get; set; } = "نقدی";
    public string Reference { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class ExpenseRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public string Category { get; set; } = "عمومی";
    public decimal Amount { get; set; }
    public string Notes { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class InvoiceDraft
{
    public string CustomerId { get; init; } = "";
    public decimal TaxRatePercent { get; init; }
    public string Notes { get; init; } = "";
    public List<InvoiceLine> Lines { get; init; } = [];
}

public static class AccountingRules
{
    public static decimal Money(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal CalculateTax(decimal subtotal, decimal taxRatePercent)
    {
        if (subtotal < 0m)
            throw new ArgumentOutOfRangeException(nameof(subtotal), "مبلغ نمی‌تواند منفی باشد.");
        if (taxRatePercent < 0m || taxRatePercent > 100m)
            throw new ArgumentOutOfRangeException(nameof(taxRatePercent), "درصد مالیات باید بین صفر تا صد باشد.");
        return Money(subtotal * taxRatePercent / 100m);
    }

    public static decimal CalculateTotal(decimal subtotal, decimal taxRatePercent) =>
        Money(subtotal + CalculateTax(subtotal, taxRatePercent));

    public static decimal PaidForInvoice(AccountingData data, string invoiceId) =>
        data.Payments.Where(p => p.InvoiceId == invoiceId).Sum(p => p.Amount);

    public static decimal RemainingForInvoice(AccountingData data, InvoiceRecord invoice) =>
        Math.Max(0m, invoice.Total - PaidForInvoice(data, invoice.Id));
}

public static class AccountingOperations
{
    public static InvoiceRecord CreateInvoice(AccountingData data, InvoiceDraft draft)
    {
        if (draft.Lines.Count == 0)
            throw new InvalidOperationException("برای فاکتور حداقل یک قلم کالا لازم است.");
        var customer = data.Customers.SingleOrDefault(c => c.Id == draft.CustomerId)
            ?? throw new InvalidOperationException("مشتری انتخاب‌شده پیدا نشد.");
        if (draft.TaxRatePercent < 0m || draft.TaxRatePercent > 100m)
            throw new InvalidOperationException("درصد مالیات باید بین صفر تا صد باشد.");

        foreach (var group in draft.Lines.GroupBy(line => line.ProductId, StringComparer.Ordinal))
        {
            var product = data.Products.SingleOrDefault(p => p.Id == group.Key)
                ?? throw new InvalidOperationException("یکی از کالاهای فاکتور پیدا نشد.");
            var requiredQuantity = group.Sum(line => line.Quantity);
            if (requiredQuantity <= 0m || product.StockQuantity < requiredQuantity)
                throw new InvalidOperationException($"موجودی کالای «{product.Name}» کافی نیست. موجودی: {product.StockQuantity:N2}");
        }

        var resolved = new List<(ProductRecord Product, InvoiceLine Line)>();
        foreach (var item in draft.Lines)
        {
            var product = data.Products.SingleOrDefault(p => p.Id == item.ProductId)
                ?? throw new InvalidOperationException("یکی از کالاهای فاکتور پیدا نشد.");
            if (item.Quantity <= 0m || item.UnitPrice < 0m)
                throw new InvalidOperationException("تعداد باید مثبت و قیمت نمی‌تواند منفی باشد.");
            var line = new InvoiceLine
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Quantity = item.Quantity,
                UnitPrice = AccountingRules.Money(item.UnitPrice),
                LineTotal = AccountingRules.Money(item.Quantity * item.UnitPrice)
            };
            resolved.Add((product, line));
        }

        var subtotal = AccountingRules.Money(resolved.Sum(x => x.Line.LineTotal));
        var invoice = new InvoiceRecord
        {
            Number = data.NextInvoiceNumber,
            CustomerId = customer.Id,
            CustomerName = customer.Name,
            Description = string.Join("، ", resolved.Select(x => x.Line.ProductName).Distinct()),
            Lines = resolved.Select(x => x.Line).ToList(),
            Subtotal = subtotal,
            TaxRatePercent = draft.TaxRatePercent,
            TaxAmount = AccountingRules.CalculateTax(subtotal, draft.TaxRatePercent),
            Total = AccountingRules.CalculateTotal(subtotal, draft.TaxRatePercent),
            Notes = draft.Notes.Trim(),
            Status = "صادر شده",
            CreatedAt = DateTimeOffset.Now
        };

        // Mutations happen only after all lines and stock levels have been validated.
        foreach (var entry in resolved)
            entry.Product.StockQuantity -= entry.Line.Quantity;
        data.Invoices.Add(invoice);
        data.NextInvoiceNumber++;
        return invoice;
    }

    public static PaymentRecord RecordPayment(AccountingData data, string invoiceId, decimal amount, string method, string reference)
    {
        var invoice = data.Invoices.SingleOrDefault(i => i.Id == invoiceId)
            ?? throw new InvalidOperationException("فاکتور پیدا نشد.");
        if (invoice.Status == "لغو شده")
            throw new InvalidOperationException("برای فاکتور لغوشده نمی‌توان دریافت ثبت کرد.");
        if (amount <= 0m)
            throw new InvalidOperationException("مبلغ دریافت باید بیشتر از صفر باشد.");
        amount = AccountingRules.Money(amount);
        var remaining = AccountingRules.RemainingForInvoice(data, invoice);
        if (amount > remaining)
            throw new InvalidOperationException($"مبلغ از مانده فاکتور بیشتر است. مانده: {remaining:N2}");

        var payment = new PaymentRecord
        {
            InvoiceId = invoice.Id,
            InvoiceNumber = invoice.Number,
            CustomerName = invoice.CustomerName,
            Amount = amount,
            Method = string.IsNullOrWhiteSpace(method) ? "نقدی" : method.Trim(),
            Reference = reference.Trim(),
            CreatedAt = DateTimeOffset.Now
        };
        data.Payments.Add(payment);
        if (AccountingRules.RemainingForInvoice(data, invoice) == 0m)
            invoice.Status = "تسویه شده";
        return payment;
    }

    public static ExpenseRecord AddExpense(AccountingData data, string title, string category, decimal amount, string notes)
    {
        if (string.IsNullOrWhiteSpace(title) || amount <= 0m)
            throw new InvalidOperationException("عنوان هزینه و مبلغ مثبت الزامی است.");
        var item = new ExpenseRecord
        {
            Title = title.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "عمومی" : category.Trim(),
            Amount = AccountingRules.Money(amount),
            Notes = notes.Trim(),
            CreatedAt = DateTimeOffset.Now
        };
        data.Expenses.Add(item);
        return item;
    }

    public static void AddStock(AccountingData data, string productId, decimal quantity)
    {
        var product = data.Products.SingleOrDefault(p => p.Id == productId)
            ?? throw new InvalidOperationException("کالا پیدا نشد.");
        if (quantity <= 0m)
            throw new InvalidOperationException("مقدار افزایش موجودی باید مثبت باشد.");
        product.StockQuantity += quantity;
    }
}

public static class AccountingDataValidator
{
    public static AccountingData Validate(AccountingData? data)
    {
        if (data is null)
            throw new InvalidDataException("دادهٔ حسابداری خالی یا نامعتبر است.");
        if (data.SchemaVersion != 1)
            throw new InvalidDataException("نسخهٔ ساختار داده پشتیبانی نمی‌شود.");
        if (data.Customers is null || data.Products is null || data.Invoices is null ||
            data.Payments is null || data.Expenses is null ||
            data.Customers.Count > 100_000 || data.Products.Count > 100_000 ||
            data.Invoices.Count > 500_000 || data.Payments.Count > 1_000_000 ||
            data.Expenses.Count > 1_000_000)
            throw new InvalidDataException("ساختار یا اندازهٔ دادهٔ حسابداری معتبر نیست.");

        var customerIds = UniqueIds(data.Customers.Select(c => c?.Id), "مشتری");
        foreach (var c in data.Customers)
            if (c is null || string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length < 2)
                throw new InvalidDataException("رکورد مشتری ناقص است.");

        var productIds = UniqueIds(data.Products.Select(p => p?.Id), "کالا");
        foreach (var p in data.Products)
            if (p is null || string.IsNullOrWhiteSpace(p.Name) || p.Name.Trim().Length < 2 ||
                p.StockQuantity < 0m || p.UnitPrice < 0m)
                throw new InvalidDataException("رکورد کالا ناقص یا نامعتبر است.");

        var invoiceIds = UniqueIds(data.Invoices.Select(i => i?.Id), "فاکتور");
        var invoiceNumbers = new HashSet<int>();
        foreach (var invoice in data.Invoices)
        {
            if (invoice is null || invoice.Lines is null || invoice.Lines.Count == 0 || invoice.Lines.Any(line => line is null))
                throw new InvalidDataException("فاکتور فاقد اقلام معتبر است.");

            if (invoice.Number < 1 || !invoiceNumbers.Add(invoice.Number) ||
                !customerIds.Contains(invoice.CustomerId) || string.IsNullOrWhiteSpace(invoice.CustomerName) ||
                invoice.TaxRatePercent < 0m || invoice.TaxRatePercent > 100m || invoice.Subtotal < 0m ||
                invoice.TaxAmount != AccountingRules.CalculateTax(invoice.Subtotal, invoice.TaxRatePercent) ||
                invoice.Total != AccountingRules.CalculateTotal(invoice.Subtotal, invoice.TaxRatePercent) ||
                invoice.Subtotal != AccountingRules.Money(invoice.Lines.Sum(line => line.LineTotal)) ||
                invoice.Lines.Any(line => string.IsNullOrWhiteSpace(line.ProductId) ||
                    string.IsNullOrWhiteSpace(line.ProductName) || line.Quantity <= 0m || line.UnitPrice < 0m ||
                    line.LineTotal != AccountingRules.Money(line.Quantity * line.UnitPrice)) ||
                !new[] { "صادر شده", "تسویه شده", "لغو شده" }.Contains(invoice.Status, StringComparer.Ordinal))
                throw new InvalidDataException("فاکتور ناقص یا ناسازگار است.");
        }

        if (data.NextInvoiceNumber < 1 || (invoiceNumbers.Count > 0 && data.NextInvoiceNumber <= invoiceNumbers.Max()))
            throw new InvalidDataException("شمارندهٔ شماره فاکتور معتبر نیست.");

        UniqueIds(data.Payments.Select(p => p?.Id), "دریافت");
        foreach (var payment in data.Payments)
        {
            if (payment is null || !invoiceIds.Contains(payment.InvoiceId) ||
                payment.Amount <= 0m || payment.Amount != AccountingRules.Money(payment.Amount) ||
                string.IsNullOrWhiteSpace(payment.Method))
                throw new InvalidDataException("رکورد دریافت ناقص یا نامعتبر است.");
        }

        foreach (var invoice in data.Invoices)
        {
            var paid = AccountingRules.PaidForInvoice(data, invoice.Id);
            if (paid > invoice.Total || (invoice.Status == "تسویه شده" && paid != invoice.Total))
                throw new InvalidDataException("مبالغ دریافتی با وضعیت فاکتور سازگار نیست.");
        }

        UniqueIds(data.Expenses.Select(e => e?.Id), "هزینه");
        foreach (var expense in data.Expenses)
            if (expense is null || string.IsNullOrWhiteSpace(expense.Title) ||
                expense.Amount <= 0m || expense.Amount != AccountingRules.Money(expense.Amount))
                throw new InvalidDataException("رکورد هزینه ناقص یا نامعتبر است.");

        return data;
    }

    private static HashSet<string> UniqueIds(IEnumerable<string?> values, string type)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in values)
            if (string.IsNullOrWhiteSpace(id) || !result.Add(id))
                throw new InvalidDataException($"شناسهٔ {type} خالی یا تکراری است.");
        return result;
    }
}
