using System.IO;

namespace AshkeGhalam.Windows.Models;

public sealed class AccountingData
{
    public int SchemaVersion { get; set; } = 1;
    public int NextInvoiceNumber { get; set; } = 1;
    public int NextVoucherNumber { get; set; } = 1;
    public List<CustomerRecord> Customers { get; set; } = [];
    public List<ProductRecord> Products { get; set; } = [];
    public List<InvoiceRecord> Invoices { get; set; } = [];
    public List<PaymentRecord> Payments { get; set; } = [];
    public List<ExpenseRecord> Expenses { get; set; } = [];
    public List<CheckRecord> Checks { get; set; } = [];
    public List<VoucherRecord> Vouchers { get; set; } = [];
    public List<InventoryMovementRecord> InventoryMovements { get; set; } = [];

    public AccountingData DeepCopy() => new()
    {
        SchemaVersion = SchemaVersion,
        NextInvoiceNumber = NextInvoiceNumber,
        NextVoucherNumber = NextVoucherNumber,
        Customers = Customers.Select(c => new CustomerRecord
        {
            Id=c.Id, Code=c.Code, Name=c.Name, Phone=c.Phone, Email=c.Email, Balance=c.Balance,
            Category=c.Category, Type=c.Type, IsCustomer=c.IsCustomer, IsSupplier=c.IsSupplier,
            Address=c.Address, NationalId=c.NationalId, Notes=c.Notes, CreatedAt=c.CreatedAt
        }).ToList(),
        Products = Products.Select(p => new ProductRecord
        {
            Id=p.Id, Name=p.Name, Sku=p.Sku, Unit=p.Unit, StockQuantity=p.StockQuantity, UnitPrice=p.UnitPrice,
            SerialNumber=p.SerialNumber, BuyPrice=p.BuyPrice, ReservedStock=p.ReservedStock, MinStock=p.MinStock,
            Weight=p.Weight, ShelfLocation=p.ShelfLocation, Category=p.Category, SubCategory=p.SubCategory,
            SubSubCategory=p.SubSubCategory, CategoryPath=p.CategoryPath, Description=p.Description, ImageUrl=p.ImageUrl,
            CreatedAt=p.CreatedAt
        }).ToList(),
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
        { Id=e.Id, Title=e.Title, Category=e.Category, Amount=e.Amount, Notes=e.Notes, CreatedAt=e.CreatedAt }).ToList(),
        Checks = Checks.Select(c => new CheckRecord
        {
            Id=c.Id, BankName=c.BankName, Amount=c.Amount, DueDate=c.DueDate, IssueDate=c.IssueDate,
            Status=c.Status, SayadId=c.SayadId, CheckNumber=c.CheckNumber, HolderName=c.HolderName,
            PersonId=c.PersonId, PersonName=c.PersonName, RelatedInvoiceId=c.RelatedInvoiceId,
            ImagePath=c.ImagePath, IsHighPriority=c.IsHighPriority, Description=c.Description,
            CheckType=c.CheckType, CreatedAt=c.CreatedAt,
            History=c.History.Select(h => new CheckHistoryRecord { ChangedAt=h.ChangedAt, Status=h.Status, Note=h.Note }).ToList()
        }).ToList(),
        Vouchers = Vouchers.Select(v => new VoucherRecord
        {
            Id=v.Id, Number=v.Number, TrackingCode=v.TrackingCode, Date=v.Date, Type=v.Type,
            PersonId=v.PersonId, PersonName=v.PersonName, RelatedInvoiceId=v.RelatedInvoiceId,
            RelatedVoucherId=v.RelatedVoucherId, ReturnReason=v.ReturnReason, Supervisor=v.Supervisor,
            VehicleNumber=v.VehicleNumber, ReceiverPhone=v.ReceiverPhone, TotalWeight=v.TotalWeight,
            EstimatedValue=v.EstimatedValue, Signature=v.Signature, CompanySignature=v.CompanySignature,
            SupervisorSignature=v.SupervisorSignature, LoadingPhotos=[..v.LoadingPhotos], Notes=v.Notes,
            Status=v.Status, DeliveryTime=v.DeliveryTime, QrCode=v.QrCode, MovementType=v.MovementType,
            SourceWarehouseId=v.SourceWarehouseId, DestinationWarehouseId=v.DestinationWarehouseId,
            WarehouseId=v.WarehouseId, Items=v.Items.Select(i => new VoucherItemRecord
            {
                ProductId=i.ProductId, ProductName=i.ProductName, Quantity=i.Quantity, Unit=i.Unit,
                Weight=i.Weight, ShelfLocation=i.ShelfLocation, Description=i.Description, ImageUrl=i.ImageUrl
            }).ToList()
        }).ToList(),
        InventoryMovements = InventoryMovements.Select(m => new InventoryMovementRecord
        {
            Id=m.Id, ProductId=m.ProductId, VoucherId=m.VoucherId, MovementType=m.MovementType,
            SignedQuantity=m.SignedQuantity, Date=m.Date, ReferenceType=m.ReferenceType,
            Description=m.Description, Timestamp=m.Timestamp
        }).ToList()
    };
}

public sealed class CustomerRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    // Preserved for future ledger parity; the native register does not let users edit a balance directly.
    public decimal Balance { get; set; }
    public string Category { get; set; } = "عمومی";
    public string Type { get; set; } = "CUSTOMER";
    public bool IsCustomer { get; set; } = true;
    public bool IsSupplier { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string RoleLabel => (IsCustomer, IsSupplier) switch
    {
        (true, true) => "مشتری و تأمین‌کننده",
        (true, false) => "مشتری",
        (false, true) => "تأمین‌کننده",
        _ => "بدون نقش"
    };
    public string Address { get; set; } = "";
    public string NationalId { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class ProductRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    // Compatibility fields retained for existing local WPF data.
    public string Sku { get; set; } = "";
    public string Unit { get; set; } = "عدد";
    public decimal StockQuantity { get; set; }
    public decimal UnitPrice { get; set; }

    // Fields aligned with the real application Product model.
    public string SerialNumber { get; set; } = "";
    public decimal? BuyPrice { get; set; }
    public decimal ReservedStock { get; set; }
    public decimal? MinStock { get; set; }
    public decimal? Weight { get; set; }
    public string ShelfLocation { get; set; } = "";
    public string Category { get; set; } = "";
    public string SubCategory { get; set; } = "";
    public string SubSubCategory { get; set; } = "";
    public string CategoryPath { get; set; } = "";
    public string Description { get; set; } = "";
    public string ImageUrl { get; set; } = "";

    [System.Text.Json.Serialization.JsonIgnore]
    public string Code { get => Sku; set => Sku = value; }

    [System.Text.Json.Serialization.JsonIgnore]
    public decimal SellPrice { get => UnitPrice; set => UnitPrice = value; }

    [System.Text.Json.Serialization.JsonIgnore]
    public decimal Stock { get => StockQuantity; set => StockQuantity = value; }

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

public sealed class CheckRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BankName { get; set; } = "";
    public decimal Amount { get; set; }
    public DateTimeOffset DueDate { get; set; } = DateTimeOffset.Today.AddDays(30);
    public DateTimeOffset? IssueDate { get; set; }
    // Internal values mirror the source application; display labels remain Persian.
    public string Status { get; set; } = "PENDING";
    public string SayadId { get; set; } = "";
    public string CheckNumber { get; set; } = "";
    public string HolderName { get; set; } = "";
    public string PersonId { get; set; } = "";
    public string PersonName { get; set; } = "";
    public string RelatedInvoiceId { get; set; } = "";
    public string ImagePath { get; set; } = "";
    public bool IsHighPriority { get; set; }
    public string Description { get; set; } = "";
    public string CheckType { get; set; } = "RECEIVED";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public List<CheckHistoryRecord> History { get; set; } = [];
}

public sealed class CheckHistoryRecord
{
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.Now;
    public string Status { get; set; } = "PENDING";
    public string Note { get; set; } = "";
}

public sealed class VoucherItemRecord
{
    public string ProductId { get; set; } = "";
    public string ProductName { get; set; } = "";
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "عدد";
    public decimal? Weight { get; set; }
    public string ShelfLocation { get; set; } = "";
    public string Description { get; set; } = "";
    public string ImageUrl { get; set; } = "";
}

public sealed class VoucherRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int Number { get; set; }
    public string TrackingCode { get; set; } = "";
    public DateTimeOffset Date { get; set; } = DateTimeOffset.Now;
    public string Type { get; set; } = "OUT";
    public string PersonId { get; set; } = "";
    public string PersonName { get; set; } = "";
    public string RelatedInvoiceId { get; set; } = "";
    public string RelatedVoucherId { get; set; } = "";
    public string ReturnReason { get; set; } = "";
    public string Supervisor { get; set; } = "";
    public string VehicleNumber { get; set; } = "";
    public string ReceiverPhone { get; set; } = "";
    public List<VoucherItemRecord> Items { get; set; } = [];
    public decimal TotalWeight { get; set; }
    public decimal EstimatedValue { get; set; }
    public string Signature { get; set; } = "";
    public string CompanySignature { get; set; } = "";
    public string SupervisorSignature { get; set; } = "";
    public List<string> LoadingPhotos { get; set; } = [];
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "PENDING";
    public DateTimeOffset? DeliveryTime { get; set; }
    public string QrCode { get; set; } = "";
    public string MovementType { get; set; } = "GOODS_ISSUE";
    public string SourceWarehouseId { get; set; } = "";
    public string DestinationWarehouseId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
}

public sealed class InventoryMovementRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ProductId { get; set; } = "";
    public string VoucherId { get; set; } = "";
    public string MovementType { get; set; } = "";
    public decimal SignedQuantity { get; set; }
    public DateTimeOffset Date { get; set; } = DateTimeOffset.Now;
    public string ReferenceType { get; set; } = "VOUCHER";
    public string Description { get; set; } = "";
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
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
        if (!customer.IsCustomer)
            throw new InvalidOperationException("برای صدور فاکتور فروش، شخص باید با نوع مشتری ثبت شده باشد.");
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
            var unitPrice = AccountingRules.Money(item.UnitPrice);
            var line = new InvoiceLine
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Quantity = item.Quantity,
                UnitPrice = unitPrice,
                LineTotal = AccountingRules.Money(item.Quantity * unitPrice)
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

    public static VoucherRecord CreateVoucher(AccountingData data, VoucherRecord draft)
    {
        if (draft.Items is null || draft.Items.Count == 0)
            throw new InvalidOperationException("برای حواله حداقل یک قلم کالا لازم است.");
        var validTypes = new[] { "IN", "OUT", "RETURN" };
        if (!validTypes.Contains(draft.Type, StringComparer.Ordinal))
            throw new InvalidOperationException("نوع حواله معتبر نیست.");
        var validMovementTypes = new[] { "GOODS_RECEIPT", "GOODS_ISSUE", "INVENTORY_ADJUSTMENT", "PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "RETURN_RECEIPT", "RETURN_ISSUE" };
        if (string.Equals(draft.MovementType, "INTERNAL_TRANSFER", StringComparison.Ordinal))
            throw new InvalidOperationException("انتقال بین دو انبار تا زمان تکمیل دفتر موجودی تفکیک‌شدهٔ انبارها قابل ثبت نیست.");
        if (!validMovementTypes.Contains(draft.MovementType, StringComparer.Ordinal))
            throw new InvalidOperationException("نوع گردش موجودی معتبر نیست یا هنوز پشتیبانی نمی‌شود.");
        var returnMovement = draft.MovementType is "RETURN_RECEIPT" or "RETURN_ISSUE";
        if ((draft.Type == "RETURN") != returnMovement)
            throw new InvalidOperationException("نوع سند برگشت باید با نوع گردش «برگشت از فروش/خرید» سازگار باشد.");
        if (draft.Type == "IN" && (draft.MovementType is "GOODS_ISSUE" or "PRODUCTION_CONSUMPTION"))
            throw new InvalidOperationException("نوع گردش خروج با سند ورود سازگار نیست.");
        if (draft.Type == "OUT" && (draft.MovementType is "GOODS_RECEIPT" or "PRODUCTION_OUTPUT"))
            throw new InvalidOperationException("نوع گردش ورود با سند خروج سازگار نیست.");
        if (!string.IsNullOrWhiteSpace(draft.PersonId) && !data.Customers.Any(p => p.Id == draft.PersonId))
            throw new InvalidOperationException("شخص مرتبط با حواله پیدا نشد.");
        if (!string.IsNullOrWhiteSpace(draft.RelatedInvoiceId) && !data.Invoices.Any(i => i.Id == draft.RelatedInvoiceId))
            throw new InvalidOperationException("فاکتور مرتبط با حواله پیدا نشد.");
        var resolved = new List<(ProductRecord Product, VoucherItemRecord Item, decimal Delta)>();
        foreach (var group in draft.Items.GroupBy(i => i.ProductId, StringComparer.Ordinal))
        {
            var product = data.Products.SingleOrDefault(p => p.Id == group.Key)
                ?? throw new InvalidOperationException("یکی از کالاهای حواله پیدا نشد.");
            if (group.Any(i => i.Quantity <= 0m))
                throw new InvalidOperationException("تعداد هر قلم باید بیشتر از صفر باشد.");
            var resultingStock = product.StockQuantity + group.Sum(i => VoucherStockDelta(draft.Type, draft.MovementType, i.Quantity));
            if (resultingStock < 0m)
                throw new InvalidOperationException($"موجودی کالای «{product.Name}» برای این حواله کافی نیست. موجودی فعلی: {product.StockQuantity:N2}");
            foreach (var line in group)
            {
                resolved.Add((product, new VoucherItemRecord
                {
                    ProductId = product.Id, ProductName = product.Name, Quantity = line.Quantity,
                    Unit = string.IsNullOrWhiteSpace(line.Unit) ? product.Unit : line.Unit,
                    Weight = line.Weight ?? product.Weight,
                    ShelfLocation = string.IsNullOrWhiteSpace(line.ShelfLocation) ? product.ShelfLocation : line.ShelfLocation,
                    Description = line.Description, ImageUrl = string.IsNullOrWhiteSpace(line.ImageUrl) ? product.ImageUrl : line.ImageUrl
                }, VoucherStockDelta(draft.Type, draft.MovementType, line.Quantity)));
            }
        }

        var created = new VoucherRecord
        {
            Id = string.IsNullOrWhiteSpace(draft.Id) ? Guid.NewGuid().ToString("N") : draft.Id,
            Number = data.NextVoucherNumber,
            TrackingCode = $"VCH-{DateTime.Now:yyyyMMdd}-{data.NextVoucherNumber:D6}",
            Date = draft.Date == default ? DateTimeOffset.Now : draft.Date,
            Type = draft.Type, PersonId = draft.PersonId,
            PersonName = string.IsNullOrWhiteSpace(draft.PersonId) ? draft.PersonName : data.Customers.Single(p => p.Id == draft.PersonId).Name,
            RelatedInvoiceId = draft.RelatedInvoiceId, RelatedVoucherId = draft.RelatedVoucherId, ReturnReason = draft.ReturnReason,
            Supervisor = draft.Supervisor, VehicleNumber = draft.VehicleNumber, ReceiverPhone = draft.ReceiverPhone,
            Items = resolved.Select(x => x.Item).ToList(),
            TotalWeight = AccountingRules.Money(resolved.Sum(x => x.Item.Weight.GetValueOrDefault() * x.Item.Quantity)),
            EstimatedValue = AccountingRules.Money(resolved.Sum(x => x.Item.Quantity * (x.Product.BuyPrice ?? x.Product.SellPrice))),
            Signature = draft.Signature, CompanySignature = draft.CompanySignature, SupervisorSignature = draft.SupervisorSignature,
            LoadingPhotos = [..draft.LoadingPhotos], Notes = draft.Notes, Status = "PENDING", QrCode = draft.QrCode,
            MovementType = draft.MovementType, SourceWarehouseId = draft.SourceWarehouseId,
            DestinationWarehouseId = draft.DestinationWarehouseId, WarehouseId = draft.WarehouseId
        };

        // All lines are validated before stock changes so a failed voucher never partially mutates inventory.
        foreach (var entry in resolved)
        {
            entry.Product.StockQuantity += entry.Delta;
            data.InventoryMovements.Add(new InventoryMovementRecord
            {
                ProductId = entry.Product.Id, VoucherId = created.Id, MovementType = created.MovementType,
                SignedQuantity = entry.Delta, Date = created.Date, ReferenceType = "VOUCHER",
                Description = $"حواله {created.Number} — {created.TrackingCode}"
            });
        }
        data.Vouchers.Add(created);
        data.NextVoucherNumber++;
        return created;
    }

    public static void DeleteVoucher(AccountingData data, string voucherId)
    {
        var voucher = data.Vouchers.SingleOrDefault(v => v.Id == voucherId)
            ?? throw new InvalidOperationException("حواله پیدا نشد.");
        var reversed = new List<(ProductRecord Product, decimal Delta)>();
        foreach (var group in voucher.Items.GroupBy(i => i.ProductId, StringComparer.Ordinal))
        {
            var product = data.Products.SingleOrDefault(p => p.Id == group.Key)
                ?? throw new InvalidOperationException("یکی از کالاهای این حواله برای برگشت موجودی پیدا نشد.");
            var reverseDelta = group.Sum(item => -VoucherStockDelta(voucher.Type, voucher.MovementType, item.Quantity));
            if (product.StockQuantity + reverseDelta < 0m)
                throw new InvalidOperationException($"حذف حواله، موجودی کالای «{product.Name}» را منفی می‌کند؛ حذف انجام نشد.");
            reversed.Add((product, reverseDelta));
        }
        foreach (var entry in reversed)
        {
            entry.Product.StockQuantity += entry.Delta;
        }
        data.InventoryMovements.RemoveAll(m => m.VoucherId == voucher.Id);
        data.Vouchers.Remove(voucher);
    }

    public static void ChangeVoucherStatus(AccountingData data, string voucherId, string status)
    {
        var voucher = data.Vouchers.SingleOrDefault(v => v.Id == voucherId)
            ?? throw new InvalidOperationException("حواله پیدا نشد.");
        if (!new[] { "PENDING", "IN_TRANSIT", "DELIVERED" }.Contains(status, StringComparer.Ordinal))
            throw new InvalidOperationException("وضعیت تحویل حواله معتبر نیست.");
        voucher.Status = status;
        voucher.DeliveryTime = status == "DELIVERED" ? DateTimeOffset.Now : null;
    }

    public static decimal VoucherStockDelta(string type, string movementType, decimal quantity)
    {
        if (quantity < 0m) throw new ArgumentOutOfRangeException(nameof(quantity), "مقدار حواله نباید منفی باشد.");
        if (type == "IN") return quantity;
        if (type == "OUT") return -quantity;
        if (type == "RETURN") return movementType == "RETURN_RECEIPT" ? quantity : -quantity;
        throw new InvalidOperationException("نوع حواله برای محاسبه موجودی معتبر نیست.");
    }

    public static void CancelInvoice(AccountingData data, string invoiceId)
    {
        var invoice = data.Invoices.SingleOrDefault(i => i.Id == invoiceId)
            ?? throw new InvalidOperationException("فاکتور پیدا نشد.");
        if (invoice.Status != "صادر شده")
            throw new InvalidOperationException("فقط فاکتور صادرشدهٔ تسویه‌نشده قابل لغو است.");
        if (AccountingRules.PaidForInvoice(data, invoice.Id) != 0m)
            throw new InvalidOperationException("برای فاکتور دارای دریافت، لغو مستقیم مجاز نیست.");

        // Validate all products before changing any stock to keep cancellation atomic.
        var products = invoice.Lines.Select(line => new
        {
            Line = line,
            Product = data.Products.SingleOrDefault(product => product.Id == line.ProductId)
        }).ToList();
        if (products.Any(item => item.Product is null))
            throw new InvalidOperationException("یکی از کالاهای این فاکتور برای برگشت موجودی پیدا نشد.");
        foreach (var item in products)
            item.Product!.StockQuantity += item.Line.Quantity;

        invoice.Status = "لغو شده";
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
            data.Payments is null || data.Expenses is null || data.Checks is null ||
            data.Vouchers is null || data.InventoryMovements is null ||
            data.Customers.Count > 100_000 || data.Products.Count > 100_000 ||
            data.Invoices.Count > 500_000 || data.Payments.Count > 1_000_000 ||
            data.Expenses.Count > 1_000_000 || data.Checks.Count > 1_000_000 ||
            data.Vouchers.Count > 1_000_000 || data.InventoryMovements.Count > 2_000_000)
            throw new InvalidDataException("ساختار یا اندازهٔ دادهٔ حسابداری معتبر نیست.");

        var customerIds = UniqueIds(data.Customers.Select(c => c?.Id), "شخص");
        var personCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in data.Customers)
        {
            if (c is null || string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length < 2 ||
                (!c.IsCustomer && !c.IsSupplier) ||
                !new[] { "CUSTOMER", "VENDOR" }.Contains(c.Type, StringComparer.Ordinal))
                throw new InvalidDataException("رکورد شخص ناقص یا نامعتبر است.");
            if (!string.IsNullOrWhiteSpace(c.Code) && !personCodes.Add(c.Code.Trim()))
                throw new InvalidDataException("کد شخص تکراری در داده‌ها وجود دارد.");
            if (c.Balance != AccountingRules.Money(c.Balance))
                throw new InvalidDataException("ماندهٔ ثبت‌شدهٔ شخص با دقت مالی معتبر سازگار نیست.");
        }

        var productIds = UniqueIds(data.Products.Select(p => p?.Id), "کالا");
        var skuValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in data.Products)
        {
            if (p is null || string.IsNullOrWhiteSpace(p.Name) || p.Name.Trim().Length < 2 ||
                p.StockQuantity < 0m || p.UnitPrice < 0m || p.ReservedStock < 0m ||
                (p.BuyPrice.HasValue && p.BuyPrice.Value < 0m) ||
                (p.MinStock.HasValue && p.MinStock.Value < 0m) ||
                (p.Weight.HasValue && p.Weight.Value < 0m))
                throw new InvalidDataException("رکورد کالا ناقص یا نامعتبر است.");
            if (!string.IsNullOrWhiteSpace(p.Sku) && !skuValues.Add(p.Sku.Trim()))
                throw new InvalidDataException("کد کالای تکراری در داده‌ها وجود دارد.");
        }

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
            if (paid > invoice.Total || (invoice.Status == "تسویه شده" && paid != invoice.Total) ||
                (invoice.Status == "لغو شده" && paid != 0m))
                throw new InvalidDataException("مبالغ دریافتی با وضعیت فاکتور سازگار نیست.");
        }

        UniqueIds(data.Expenses.Select(e => e?.Id), "هزینه");
        foreach (var expense in data.Expenses)
            if (expense is null || string.IsNullOrWhiteSpace(expense.Title) ||
                expense.Amount <= 0m || expense.Amount != AccountingRules.Money(expense.Amount))
                throw new InvalidDataException("رکورد هزینه ناقص یا نامعتبر است.");

        UniqueIds(data.Checks.Select(c => c?.Id), "چک");
        var validCheckStatuses = new[] { "PENDING", "DEPOSITED", "PASSED", "BOUNCED", "TRANSFERRED", "CASHED", "RETURNED" };
        var validCheckTypes = new[] { "RECEIVED", "ISSUED" };
        var sayadIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var check in data.Checks)
        {
            if (check is null || string.IsNullOrWhiteSpace(check.BankName) ||
                string.IsNullOrWhiteSpace(check.HolderName) || check.Amount <= 0m ||
                check.Amount != AccountingRules.Money(check.Amount) ||
                !validCheckStatuses.Contains(check.Status, StringComparer.Ordinal) ||
                !validCheckTypes.Contains(check.CheckType, StringComparer.Ordinal) ||
                check.DueDate == default || check.History is null || check.History.Count > 10_000 ||
                check.History.Any(h => h is null || !validCheckStatuses.Contains(h.Status, StringComparer.Ordinal)))
                throw new InvalidDataException("رکورد چک ناقص یا نامعتبر است.");
            if (!string.IsNullOrWhiteSpace(check.SayadId) && !sayadIds.Add(check.SayadId.Trim()))
                throw new InvalidDataException("شناسهٔ صیادی تکراری در سوابق چک وجود دارد.");
            if (!string.IsNullOrWhiteSpace(check.RelatedInvoiceId) && !invoiceIds.Contains(check.RelatedInvoiceId))
                throw new InvalidDataException("چک به فاکتور ناموجود پیوند داده شده است.");
        }

        var voucherIds = UniqueIds(data.Vouchers.Select(v => v?.Id), "حواله");
        var voucherNumbers = new HashSet<int>();
        var trackingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var validVoucherTypes = new[] { "IN", "OUT", "RETURN" };
        var validMovementTypes = new[] { "GOODS_RECEIPT", "GOODS_ISSUE", "INVENTORY_ADJUSTMENT", "PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "RETURN_RECEIPT", "RETURN_ISSUE" };
        var validVoucherStatuses = new[] { "PENDING", "IN_TRANSIT", "DELIVERED" };
        foreach (var voucher in data.Vouchers)
        {
            if (voucher is null || voucher.Number < 1 || !voucherNumbers.Add(voucher.Number) ||
                string.IsNullOrWhiteSpace(voucher.TrackingCode) || !trackingCodes.Add(voucher.TrackingCode.Trim()) ||
                !validVoucherTypes.Contains(voucher.Type, StringComparer.Ordinal) ||
                !validMovementTypes.Contains(voucher.MovementType, StringComparer.Ordinal) ||
                !validVoucherStatuses.Contains(voucher.Status, StringComparer.Ordinal) ||
                voucher.Date == default || voucher.TotalWeight < 0m || voucher.EstimatedValue < 0m ||
                voucher.Items is null || voucher.Items.Count == 0 || voucher.Items.Count > 100_000 ||
                voucher.LoadingPhotos is null ||
                voucher.Items.Any(i => i is null || string.IsNullOrWhiteSpace(i.ProductId) || string.IsNullOrWhiteSpace(i.ProductName) || i.Quantity <= 0m || (i.Weight.HasValue && i.Weight.Value < 0m)))
                throw new InvalidDataException("حواله ناقص یا نامعتبر است.");
            var isReturnMovement = voucher.MovementType is "RETURN_RECEIPT" or "RETURN_ISSUE";
            if ((voucher.Type == "RETURN") != isReturnMovement ||
                (voucher.Type == "IN" && (voucher.MovementType is "GOODS_ISSUE" or "PRODUCTION_CONSUMPTION")) ||
                (voucher.Type == "OUT" && (voucher.MovementType is "GOODS_RECEIPT" or "PRODUCTION_OUTPUT")))
                throw new InvalidDataException("نوع گردش موجودی با نوع حواله سازگار نیست.");
            if (!string.IsNullOrWhiteSpace(voucher.PersonId) && !customerIds.Contains(voucher.PersonId))
                throw new InvalidDataException("شخص مرتبط با حواله وجود ندارد.");
            if (!string.IsNullOrWhiteSpace(voucher.RelatedInvoiceId) && !invoiceIds.Contains(voucher.RelatedInvoiceId))
                throw new InvalidDataException("فاکتور مرتبط با حواله وجود ندارد.");
            if (!string.IsNullOrWhiteSpace(voucher.RelatedVoucherId) && !voucherIds.Contains(voucher.RelatedVoucherId))
                throw new InvalidDataException("حوالهٔ مرتبط در داده‌ها وجود ندارد.");
            if (voucher.Items.Any(i => !productIds.Contains(i.ProductId)))
                throw new InvalidDataException("یکی از کالاهای حواله در فهرست کالاها وجود ندارد.");
        }
        if (data.NextVoucherNumber < 1 || (voucherNumbers.Count > 0 && data.NextVoucherNumber <= voucherNumbers.Max()))
            throw new InvalidDataException("شمارندهٔ شماره حواله معتبر نیست.");

        UniqueIds(data.InventoryMovements.Select(m => m?.Id), "گردش موجودی");
        var validLedgerMovementTypes = new[] { "GOODS_RECEIPT", "GOODS_ISSUE", "INTERNAL_TRANSFER", "INVENTORY_ADJUSTMENT", "PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "RETURN_RECEIPT", "RETURN_ISSUE" };
        foreach (var movement in data.InventoryMovements)
            if (movement is null || !productIds.Contains(movement.ProductId) || !data.Vouchers.Any(v => v.Id == movement.VoucherId) ||
                !validLedgerMovementTypes.Contains(movement.MovementType, StringComparer.Ordinal) || movement.SignedQuantity == 0m || movement.Date == default)
                throw new InvalidDataException("گردش موجودی ناقص یا ناسازگار است.");

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
