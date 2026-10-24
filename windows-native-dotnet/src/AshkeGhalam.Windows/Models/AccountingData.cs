using System.IO;

namespace AshkeGhalam.Windows.Models;

public sealed class AccountingData
{
    public int SchemaVersion { get; set; } = 1;
    public int NextInvoiceNumber { get; set; } = 1;
    public int NextVoucherNumber { get; set; } = 1;
    public int NextJournalNumber { get; set; } = 1;
    public List<CustomerRecord> Customers { get; set; } = [];
    public List<ProductRecord> Products { get; set; } = [];
    public List<InvoiceRecord> Invoices { get; set; } = [];
    public List<PaymentRecord> Payments { get; set; } = [];
    public List<ExpenseRecord> Expenses { get; set; } = [];
    public List<CheckRecord> Checks { get; set; } = [];
    public List<VoucherRecord> Vouchers { get; set; } = [];
    public List<InventoryMovementRecord> InventoryMovements { get; set; } = [];
    // These collections are optional in old local files; initializers keep old schema-v1 data readable.
    public List<ChartOfAccountRecord> LedgerAccounts { get; set; } = [];
    public List<AccountingEntryRecord> JournalEntries { get; set; } = [];

    // Optional persisted configuration; initializers preserve compatibility with old schema-v1 files.
    public List<CompanyProfileRecord> Companies { get; set; } = [];
    public string ActiveCompanyId { get; set; } = "";
    public AccountingPreferences Preferences { get; set; } = new();
    public MoadianSettingsRecord MoadianSettings { get; set; } = new();
    public ServerConnectionSettings ServerConnection { get; set; } = new();

    public AccountingData DeepCopy() => new()
    {
        SchemaVersion = SchemaVersion,
        NextInvoiceNumber = NextInvoiceNumber,
        NextVoucherNumber = NextVoucherNumber,
        NextJournalNumber = NextJournalNumber,
        Companies = (Companies ?? []).Select(c => new CompanyProfileRecord
        {
            Id = c.Id, Name = c.Name, LegalName = c.LegalName, NationalId = c.NationalId,
            TaxId = c.TaxId, Phone = c.Phone, Address = c.Address, Branch = c.Branch,
            LogoDataBase64 = c.LogoDataBase64, StampDataBase64 = c.StampDataBase64,
            SignatureDataBase64 = c.SignatureDataBase64,
            WorkspaceDataJson = c.WorkspaceDataJson ?? ""
        }).ToList(),
        ActiveCompanyId = ActiveCompanyId,
        Preferences = new AccountingPreferences
        {
            InvoiceTheme = Preferences?.InvoiceTheme ?? "modern",
            ShowInvoiceQr = Preferences?.ShowInvoiceQr ?? true,
            Currency = Preferences?.Currency ?? "RIAL",
            DefaultTaxRatePercent = Preferences?.DefaultTaxRatePercent ?? 0m,
            SalesInvoicePrefix = Preferences?.SalesInvoicePrefix ?? "INV-",
            InvoiceFooter = Preferences?.InvoiceFooter ?? "",
            ApplicationTheme = Preferences?.ApplicationTheme ?? "light",
            SelectedInvoiceFootnotes = [..(Preferences?.SelectedInvoiceFootnotes ?? [])],
            CustomInvoiceFootnoteOptions = [..(Preferences?.CustomInvoiceFootnoteOptions ?? [])],
            ActiveFiscalYear = Preferences?.ActiveFiscalYear ?? "",
            FiscalYearStartDate = Preferences?.FiscalYearStartDate ?? "",
            FiscalYearEndDate = Preferences?.FiscalYearEndDate ?? ""
        },
        MoadianSettings = new MoadianSettingsRecord
        {
            TaxpayerId = MoadianSettings?.TaxpayerId ?? "",
            Environment = MoadianSettings?.Environment ?? "Sandbox",
            ApiBaseUrl = MoadianSettings?.ApiBaseUrl ?? "",
            IsConfigured = MoadianSettings?.IsConfigured ?? false
        },
        ServerConnection = new ServerConnectionSettings
        {
            BaseUrl = ServerConnection?.BaseUrl ?? "https://acc.ashkghalam.ir/",
            WorkspaceId = ServerConnection?.WorkspaceId ?? "",
            SyncMode = ServerConnection?.SyncMode ?? "manual"
        },
        Customers = Customers.Select(c => new CustomerRecord
        {
            Id=c.Id, Code=c.Code, Name=c.Name, Phone=c.Phone, Email=c.Email, Balance=c.Balance,
            Category=c.Category, Type=c.Type, IsCustomer=c.IsCustomer, IsSupplier=c.IsSupplier,
            Address=c.Address, NationalId=c.NationalId, Notes=c.Notes, CreatedAt=c.CreatedAt
        }).ToList(),
        Products = Products.Select(p => new ProductRecord
        {
            Id=p.Id, Name=p.Name, Sku=p.Sku, Unit=p.Unit, StockQuantity=p.StockQuantity, UnitPrice=p.UnitPrice,
            SerialNumber=p.SerialNumber, Barcode=p.Barcode, BuyPrice=p.BuyPrice, ReservedStock=p.ReservedStock, MinStock=p.MinStock,
            Weight=p.Weight, ShelfLocation=p.ShelfLocation, Category=p.Category, SubCategory=p.SubCategory,
            SubSubCategory=p.SubSubCategory, CategoryPath=p.CategoryPath, Description=p.Description, ImageUrl=p.ImageUrl,
            CreatedAt=p.CreatedAt
        }).ToList(),
        Invoices = Invoices.Select(i => new InvoiceRecord
        {
            Id=i.Id, Number=i.Number, Type=i.Type, Prefix=i.Prefix, TrackingCode=i.TrackingCode,
            CustomerId=i.CustomerId, CustomerName=i.CustomerName, Description=i.Description,
            Lines=i.Lines.Select(l => new InvoiceLine
            {
                ProductId=l.ProductId, ProductName=l.ProductName, SerialNumber=l.SerialNumber,
                Quantity=l.Quantity, BuyPrice=l.BuyPrice, UnitPrice=l.UnitPrice, Profit=l.Profit,
                LineTotal=l.LineTotal, Description=l.Description, EntryOrder=l.EntryOrder
            }).ToList(),
            Subtotal=i.Subtotal, TaxRatePercent=i.TaxRatePercent, TaxAmount=i.TaxAmount, TaxIsAmount=i.TaxIsAmount,
            Discount=i.Discount, Total=i.Total, CashAmount=i.CashAmount, CheckAmount=i.CheckAmount,
            CreatedAt=i.CreatedAt, DueDate=i.DueDate, Notes=i.Notes, Status=i.Status,
            DriverName=i.DriverName, DriverPhone=i.DriverPhone, VehiclePlate=i.VehiclePlate,
            TaxId=i.TaxId, ShowPreviousBalance=i.ShowPreviousBalance
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
            RelatedPaymentId=c.RelatedPaymentId, ImagePath=c.ImagePath, ImageDataBase64=c.ImageDataBase64,
            IsHighPriority=c.IsHighPriority, Description=c.Description,
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
            Id=m.Id, ProductId=m.ProductId, VoucherId=m.VoucherId, ReferenceId=m.ReferenceId,
            MovementType=m.MovementType, SignedQuantity=m.SignedQuantity, Date=m.Date,
            ReferenceType=m.ReferenceType, Description=m.Description, Timestamp=m.Timestamp
        }).ToList(),
        LedgerAccounts = LedgerAccounts.Select(a => new ChartOfAccountRecord
        {
            Id=a.Id, Code=a.Code, Name=a.Name, Type=a.Type, Level=a.Level, ParentId=a.ParentId, IsActive=a.IsActive
        }).ToList(),
        JournalEntries = JournalEntries.Select(j => new AccountingEntryRecord
        {
            Id=j.Id, Number=j.Number, Date=j.Date, Description=j.Description, DebitAccountId=j.DebitAccountId,
            CreditAccountId=j.CreditAccountId, Amount=j.Amount, ReferenceId=j.ReferenceId, ReferenceType=j.ReferenceType,
            DocumentType=j.DocumentType, FiscalYear=j.FiscalYear, Status=j.Status, CreatedAt=j.CreatedAt
        }).ToList()
    };
}

public sealed class CompanyProfileRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "شرکت چاپ و کارتن‌سازی اشک قلم";
    public string LegalName { get; set; } = "شرکت چاپ و کارتن‌سازی اشک قلم";
    public string NationalId { get; set; } = "";
    public string TaxId { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Branch { get; set; } = "مرکزی";
    public string LogoDataBase64 { get; set; } = "";
    public string StampDataBase64 { get; set; } = "";
    public string SignatureDataBase64 { get; set; } = "";
    /// <summary>
    /// Per-company snapshot of operational data, serialized as an opaque JSON string to keep
    /// the global company registry out of each nested workspace.
    /// </summary>
    public string WorkspaceDataJson { get; set; } = "";
}

public sealed class AccountingPreferences
{
    public string InvoiceTheme { get; set; } = "modern";
    /// <summary>Overall application palette; invoice paper templates keep their own independent themes.</summary>
    public string ApplicationTheme { get; set; } = "light";
    public bool ShowInvoiceQr { get; set; } = true;
    public string Currency { get; set; } = "RIAL";
    public decimal DefaultTaxRatePercent { get; set; }
    public string SalesInvoicePrefix { get; set; } = "INV-";
    public string InvoiceFooter { get; set; } = "";
    public List<string> SelectedInvoiceFootnotes { get; set; } = [];
    // Custom, selectable footer options configured by the user (one phrase per option).
    public List<string> CustomInvoiceFootnoteOptions { get; set; } = [];
    public string ActiveFiscalYear { get; set; } = "";
    public string FiscalYearStartDate { get; set; } = "";
    public string FiscalYearEndDate { get; set; } = "";
}

public sealed class MoadianSettingsRecord
{
    public string TaxpayerId { get; set; } = "";
    public string Environment { get; set; } = "Sandbox";
    public string ApiBaseUrl { get; set; } = "";
    public bool IsConfigured { get; set; }
}

public sealed class ServerConnectionSettings
{
    public string BaseUrl { get; set; } = "https://acc.ashkghalam.ir/";
    public string WorkspaceId { get; set; } = "";
    public string SyncMode { get; set; } = "manual";
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
    public string Barcode { get; set; } = "";
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
    public string Unit { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal BuyPrice { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Profit { get; set; }
    public decimal LineTotal { get; set; }
    public string Description { get; set; } = "";
    public int EntryOrder { get; set; }
}

public sealed class InvoiceRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int Number { get; set; }
    public string Type { get; set; } = "SALE";
    public string Prefix { get; set; } = "INV-";
    public string TrackingCode { get; set; } = "";
    public string CustomerId { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Description { get; set; } = "";
    public List<InvoiceLine> Lines { get; set; } = [];
    public decimal Subtotal { get; set; }
    // Percentage-tax fields are retained for old WPF data.
    public decimal TaxRatePercent { get; set; }
    public decimal TaxAmount { get; set; }
    public bool TaxIsAmount { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal CashAmount { get; set; }
    public decimal CheckAmount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset? DueDate { get; set; }
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "صادر شده";
    public string DriverName { get; set; } = "";
    public string DriverPhone { get; set; } = "";
    public string VehiclePlate { get; set; } = "";
    public string TaxId { get; set; } = "";
    public bool ShowPreviousBalance { get; set; } = true;

    [System.Text.Json.Serialization.JsonIgnore]
    public string TypeLabel => Type switch
    {
        "SALE" => "فروش",
        "PURCHASE" => "خرید",
        "PROFORMA" => "پیش‌فاکتور",
        _ => Type
    };

    [System.Text.Json.Serialization.JsonIgnore]
    public string DisplayNumber => (Prefix ?? "") + Number.ToString("D4", System.Globalization.CultureInfo.InvariantCulture);
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

public sealed class ChartOfAccountRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    // Values mirror types-financial.ts: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE.
    public string Type { get; set; } = "ASSET";
    // MAIN, SUB, DETAIL; ParentId is empty only for a top-level account.
    public string Level { get; set; } = "MAIN";
    public string ParentId { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class AccountingEntryRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int Number { get; set; }
    public string Date { get; set; } = "";
    public string Description { get; set; } = "";
    public string DebitAccountId { get; set; } = "";
    public string CreditAccountId { get; set; } = "";
    public decimal Amount { get; set; }
    public string ReferenceId { get; set; } = "";
    public string ReferenceType { get; set; } = "";
    public string DocumentType { get; set; } = "OPERATIONAL";
    public string FiscalYear { get; set; } = "";
    public string Status { get; set; } = "DRAFT";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class CheckRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BankName { get; set; } = "";
    public decimal Amount { get; set; }
    public DateTimeOffset DueDate { get; set; } = DateTimeOffset.Now.AddDays(30);
    public DateTimeOffset? IssueDate { get; set; }
    // Internal values mirror the source application; display labels remain Persian.
    public string Status { get; set; } = "PENDING";
    public string SayadId { get; set; } = "";
    public string CheckNumber { get; set; } = "";
    public string HolderName { get; set; } = "";
    public string PersonId { get; set; } = "";
    public string PersonName { get; set; } = "";
    public string RelatedInvoiceId { get; set; } = "";
    // Stable link to the exact settlement record; blank for independent and legacy checks.
    public string RelatedPaymentId { get; set; } = "";
    public string ImagePath { get; set; } = "";
    // Optimized cheque photo stored inside the encrypted local dataset and its backups.
    public string ImageDataBase64 { get; set; } = "";
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
    public string ReferenceId { get; set; } = "";
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
    public string Type { get; init; } = "SALE";
    public string Prefix { get; init; } = "";
    public DateTimeOffset Date { get; init; } = DateTimeOffset.Now;
    public DateTimeOffset? DueDate { get; init; }
    public decimal TaxRatePercent { get; init; }
    public decimal TaxAmount { get; init; }
    public bool TaxIsAmount { get; init; }
    public decimal Discount { get; init; }
    public decimal CashAmount { get; init; }
    public string Description { get; init; } = "";
    public string Notes { get; init; } = "";
    public string DriverName { get; init; } = "";
    public string DriverPhone { get; init; } = "";
    public string VehiclePlate { get; init; } = "";
    public string TaxId { get; init; } = "";
    public bool ShowPreviousBalance { get; init; } = true;
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
        if (draft.Lines is null || draft.Lines.Count == 0)
            throw new InvalidOperationException("برای فاکتور حداقل یک قلم کالا لازم است.");
        if (!new[] { "SALE", "PURCHASE", "PROFORMA" }.Contains(draft.Type, StringComparer.Ordinal))
            throw new InvalidOperationException("نوع سند فروش، خرید یا پیش‌فاکتور را انتخاب کنید.");

        var person = data.Customers.SingleOrDefault(c => c.Id == draft.CustomerId)
            ?? throw new InvalidOperationException("طرف حساب انتخاب‌شده پیدا نشد.");
        if (draft.Type == "PURCHASE" && !person.IsSupplier)
            throw new InvalidOperationException("برای فاکتور خرید، طرف حساب باید نقش تأمین‌کننده داشته باشد.");
        if ((draft.Type is "SALE" or "PROFORMA") && !person.IsCustomer)
            throw new InvalidOperationException("برای فاکتور فروش یا پیش‌فاکتور، طرف حساب باید نقش مشتری داشته باشد.");
        if (draft.TaxRatePercent < 0m || draft.TaxRatePercent > 100m)
            throw new InvalidOperationException("نرخ مالیات باید بین صفر تا صد باشد.");

        var discount = AccountingRules.Money(draft.Discount);
        if (discount < 0m || draft.CashAmount < 0m || draft.TaxAmount < 0m)
            throw new InvalidOperationException("تخفیف، مالیات و مبلغ نقدی نمی‌توانند منفی باشند.");
        if (draft.Type == "PROFORMA" && draft.CashAmount > 0m)
            throw new InvalidOperationException("پیش‌فاکتور سند غیرقطعی است؛ دریافت را پس از تبدیل به فروش ثبت کنید.");
        if (draft.TaxIsAmount && draft.TaxRatePercent != 0m)
            throw new InvalidOperationException("مالیات مبلغی و نرخ درصدی را در یک سند هم‌زمان وارد نکنید.");

        foreach (var group in draft.Lines.GroupBy(line => line.ProductId, StringComparer.Ordinal))
        {
            var product = data.Products.SingleOrDefault(p => p.Id == group.Key)
                ?? throw new InvalidOperationException("یکی از کالاهای فاکتور پیدا نشد.");
            var requiredQuantity = group.Sum(line => line.Quantity);
            if (requiredQuantity <= 0m)
                throw new InvalidOperationException("تعداد ردیف‌های فاکتور معتبر نیست.");
            if (draft.Type == "SALE")
            {
                var available = product.StockQuantity - product.ReservedStock;
                if (available < requiredQuantity)
                    throw new InvalidOperationException($"موجودی آزاد کالای «{product.Name}» کافی نیست. آزاد: {available:N2}");
            }
        }

        var resolved = new List<(ProductRecord Product, InvoiceLine Line)>();
        foreach (var item in draft.Lines)
        {
            var product = data.Products.SingleOrDefault(p => p.Id == item.ProductId)
                ?? throw new InvalidOperationException("یکی از کالاهای فاکتور پیدا نشد.");
            if (item.Quantity <= 0m || item.UnitPrice < 0m || item.BuyPrice < 0m)
                throw new InvalidOperationException("تعداد باید مثبت و قیمت‌ها نمی‌توانند منفی باشند.");
            var unitPrice = AccountingRules.Money(item.UnitPrice);
            var buyPrice = AccountingRules.Money(item.BuyPrice);
            var line = new InvoiceLine
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Unit = string.IsNullOrWhiteSpace(item.Unit) ? product.Unit : item.Unit.Trim(),
                SerialNumber = string.IsNullOrWhiteSpace(item.SerialNumber) ? product.SerialNumber : item.SerialNumber.Trim(),
                Quantity = item.Quantity,
                BuyPrice = buyPrice,
                UnitPrice = unitPrice,
                Profit = draft.Type == "SALE" ? AccountingRules.Money((unitPrice - buyPrice) * item.Quantity) : 0m,
                LineTotal = AccountingRules.Money(item.Quantity * unitPrice),
                Description = item.Description.Trim(),
                EntryOrder = item.EntryOrder
            };
            resolved.Add((product, line));
        }

        var subtotal = AccountingRules.Money(resolved.Sum(x => x.Line.LineTotal));
        if (discount > subtotal)
            throw new InvalidOperationException("تخفیف از جمع کالاها بیشتر است.");
        var taxAmount = draft.TaxIsAmount
            ? AccountingRules.Money(draft.TaxAmount)
            : AccountingRules.CalculateTax(subtotal, draft.TaxRatePercent);
        var total = AccountingRules.Money(subtotal - discount + taxAmount);
        if (draft.CashAmount > total)
            throw new InvalidOperationException("مبلغ نقدی اولیه از مبلغ نهایی سند بیشتر است.");

        var floor = draft.Type switch { "SALE" => 1000, "PROFORMA" => 2000, "PURCHASE" => 3000, _ => 0 };
        var number = data.Invoices.Where(i => i.Type == draft.Type).Select(i => i.Number).DefaultIfEmpty(floor).Max() + 1;
        while (data.Invoices.Any(i => i.Number == number)) number++;
        var prefix = !string.IsNullOrWhiteSpace(draft.Prefix) ? draft.Prefix.Trim() : draft.Type switch
        {
            "SALE" => "INV-",
            "PURCHASE" => "PUR-",
            "PROFORMA" => "PRO-",
            _ => "INV-"
        };
        var createdAt = draft.Date == default ? DateTimeOffset.Now : draft.Date;
        var description = string.IsNullOrWhiteSpace(draft.Description)
            ? string.Join("، ", resolved.Select(x => x.Line.ProductName).Distinct())
            : draft.Description.Trim();

        var invoice = new InvoiceRecord
        {
            Number = number,
            Type = draft.Type,
            Prefix = prefix,
            TrackingCode = $"{prefix}{number:D4}-{createdAt:yyyyMMdd}",
            CustomerId = person.Id,
            CustomerName = person.Name,
            Description = description,
            Lines = resolved.Select(x => x.Line).ToList(),
            Subtotal = subtotal,
            TaxRatePercent = draft.TaxIsAmount ? 0m : draft.TaxRatePercent,
            TaxAmount = taxAmount,
            TaxIsAmount = draft.TaxIsAmount,
            Discount = discount,
            Total = total,
            CashAmount = AccountingRules.Money(draft.CashAmount),
            CheckAmount = 0m,
            CreatedAt = createdAt,
            DueDate = draft.DueDate,
            Notes = draft.Notes.Trim(),
            DriverName = draft.DriverName.Trim(),
            DriverPhone = draft.DriverPhone.Trim(),
            VehiclePlate = draft.VehiclePlate.Trim(),
            TaxId = draft.TaxId.Trim(),
            ShowPreviousBalance = draft.ShowPreviousBalance,
            Status = "صادر شده"
        };

        // Sales reduce stock; purchases increase stock; proformas are non-posting until conversion.
        if (draft.Type == "SALE")
            foreach (var entry in resolved) entry.Product.StockQuantity -= entry.Line.Quantity;
        else if (draft.Type == "PURCHASE")
            foreach (var entry in resolved) entry.Product.StockQuantity += entry.Line.Quantity;

        data.Invoices.Add(invoice);
        data.NextInvoiceNumber = Math.Max(data.NextInvoiceNumber, number + 1);
        if (draft.Type is "SALE" or "PURCHASE")
        {
            foreach (var entry in resolved)
            {
                var isSale = draft.Type == "SALE";
                data.InventoryMovements.Add(new InventoryMovementRecord
                {
                    ProductId = entry.Product.Id,
                    ReferenceId = invoice.Id,
                    MovementType = isSale ? "GOODS_ISSUE" : "GOODS_RECEIPT",
                    SignedQuantity = isSale ? -entry.Line.Quantity : entry.Line.Quantity,
                    Date = createdAt,
                    ReferenceType = "INVOICE",
                    Description = $"{invoice.TypeLabel} {invoice.DisplayNumber} — {entry.Line.ProductName}"
                });
            }
        }
        if (invoice.CashAmount > 0m)
        {
            data.Payments.Add(new PaymentRecord
            {
                InvoiceId = invoice.Id,
                InvoiceNumber = invoice.Number,
                CustomerName = invoice.CustomerName,
                Amount = invoice.CashAmount,
                Method = "نقدی",
                Reference = draft.Type == "PURCHASE" ? "پرداخت نقدی هنگام ثبت فاکتور خرید" : "دریافت نقدی هنگام ثبت فاکتور",
                CreatedAt = DateTimeOffset.Now
            });
            if (AccountingRules.RemainingForInvoice(data, invoice) == 0m)
                invoice.Status = "تسویه شده";
        }
        return invoice;
    }

    public static InvoiceRecord ConvertProformaToSale(AccountingData data, string invoiceId)
    {
        var invoice = data.Invoices.SingleOrDefault(i => i.Id == invoiceId)
            ?? throw new InvalidOperationException("پیش‌فاکتور پیدا نشد.");
        if (invoice.Type != "PROFORMA")
            throw new InvalidOperationException("فقط پیش‌فاکتور را می‌توان به فاکتور فروش تبدیل کرد.");
        if (invoice.Status != "صادر شده")
            throw new InvalidOperationException("وضعیت این پیش‌فاکتور برای تبدیل معتبر نیست.");
        var person = data.Customers.SingleOrDefault(c => c.Id == invoice.CustomerId)
            ?? throw new InvalidOperationException("مشتری پیش‌فاکتور پیدا نشد.");
        if (!person.IsCustomer)
            throw new InvalidOperationException("طرف حساب دیگر نقش مشتری ندارد.");

        var requirements = invoice.Lines.GroupBy(l => l.ProductId, StringComparer.Ordinal)
            .Select(g => new
            {
                Product = data.Products.SingleOrDefault(p => p.Id == g.Key),
                Quantity = g.Sum(l => l.Quantity)
            }).ToList();
        if (requirements.Any(x => x.Product is null))
            throw new InvalidOperationException("یکی از کالاهای پیش‌فاکتور دیگر موجود نیست.");
        foreach (var item in requirements)
        {
            var available = item.Product!.StockQuantity - item.Product.ReservedStock;
            if (available < item.Quantity)
                throw new InvalidOperationException($"موجودی آزاد کالای «{item.Product.Name}» برای تبدیل کافی نیست. آزاد: {available:N2}");
        }
        foreach (var item in requirements)
        {
            item.Product!.StockQuantity -= item.Quantity;
            data.InventoryMovements.Add(new InventoryMovementRecord
            {
                ProductId = item.Product.Id,
                ReferenceId = invoice.Id,
                MovementType = "GOODS_ISSUE",
                SignedQuantity = -item.Quantity,
                Date = DateTimeOffset.Now,
                ReferenceType = "INVOICE",
                Description = $"تبدیل پیش‌فاکتور {invoice.DisplayNumber} به فروش"
            });
        }
        invoice.Type = "SALE";
        // Preserve the original number/tracking history just like the source app's type update.
        return invoice;
    }

    public static PaymentRecord RecordPayment(AccountingData data, string invoiceId, decimal amount, string method, string reference)
    {
        var invoice = data.Invoices.SingleOrDefault(i => i.Id == invoiceId)
            ?? throw new InvalidOperationException("فاکتور پیدا نشد.");
        if (invoice.Status == "لغو شده")
            throw new InvalidOperationException("برای فاکتور لغوشده نمی‌توان دریافت/پرداخت ثبت کرد.");
        if (invoice.Type == "PROFORMA")
            throw new InvalidOperationException("پیش‌فاکتور سند قطعی نیست؛ ابتدا آن را به فاکتور فروش تبدیل کنید.");
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
        if (string.Equals(payment.Method, "نقدی", StringComparison.Ordinal))
            invoice.CashAmount = AccountingRules.Money(invoice.CashAmount + payment.Amount);
        else if (string.Equals(payment.Method, "چک", StringComparison.Ordinal))
            invoice.CheckAmount = AccountingRules.Money(invoice.CheckAmount + payment.Amount);
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
            var delta = group.Sum(i => VoucherStockDelta(draft.Type, draft.MovementType, i.Quantity));
            var resultingStock = product.StockQuantity + delta;
            if (resultingStock < 0m || (delta < 0m && resultingStock < product.ReservedStock))
                throw new InvalidOperationException($"موجودی آزاد کالای «{product.Name}» برای این حواله کافی نیست. موجودی: {product.StockQuantity:N2}، رزروشده: {product.ReservedStock:N2}");
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
                ProductId = entry.Product.Id, VoucherId = created.Id, ReferenceId = created.Id,
                MovementType = created.MovementType, SignedQuantity = entry.Delta, Date = created.Date, ReferenceType = "VOUCHER",
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
        data.InventoryMovements.RemoveAll(m => m.VoucherId == voucher.Id || (m.ReferenceType == "VOUCHER" && m.ReferenceId == voucher.Id));
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
            ?? throw new InvalidOperationException("سند پیدا نشد.");
        if (invoice.Status != "صادر شده")
            throw new InvalidOperationException("فقط سند صادرشدهٔ تسویه‌نشده قابل لغو است.");
        if (AccountingRules.PaidForInvoice(data, invoice.Id) != 0m)
            throw new InvalidOperationException("برای سند دارای دریافت/پرداخت، لغو مستقیم مجاز نیست.");

        var products = invoice.Lines.GroupBy(line => line.ProductId, StringComparer.Ordinal)
            .Select(group => new
            {
                Product = data.Products.SingleOrDefault(p => p.Id == group.Key),
                Quantity = group.Sum(line => line.Quantity)
            }).ToList();
        if (invoice.Type != "PROFORMA" && products.Any(item => item.Product is null))
            throw new InvalidOperationException("یکی از کالاهای این سند برای برگشت گردش موجودی پیدا نشد.");
        if (invoice.Type == "PURCHASE" && products.Any(item => item.Product!.StockQuantity - item.Product.ReservedStock < item.Quantity))
            throw new InvalidOperationException("موجودی خرید قبلاً مصرف یا رزرو شده است؛ ابتدا سند برگشت/تعدیل را بررسی کنید.");

        if (invoice.Type == "SALE")
        {
            foreach (var item in products)
            {
                item.Product!.StockQuantity += item.Quantity;
                data.InventoryMovements.Add(new InventoryMovementRecord
                {
                    ProductId = item.Product.Id, ReferenceId = invoice.Id, MovementType = "GOODS_RECEIPT",
                    SignedQuantity = item.Quantity, Date = DateTimeOffset.Now, ReferenceType = "INVOICE",
                    Description = $"برگشت موجودی ناشی از لغو فروش {invoice.DisplayNumber}"
                });
            }
        }
        else if (invoice.Type == "PURCHASE")
        {
            foreach (var item in products)
            {
                item.Product!.StockQuantity -= item.Quantity;
                data.InventoryMovements.Add(new InventoryMovementRecord
                {
                    ProductId = item.Product.Id, ReferenceId = invoice.Id, MovementType = "GOODS_ISSUE",
                    SignedQuantity = -item.Quantity, Date = DateTimeOffset.Now, ReferenceType = "INVOICE",
                    Description = $"برگشت موجودی ناشی از لغو خرید {invoice.DisplayNumber}"
                });
            }
        }
        // A proforma has no inventory posting to reverse.
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
            data.LedgerAccounts is null || data.JournalEntries is null ||
            data.Customers.Count > 100_000 || data.Products.Count > 100_000 ||
            data.Invoices.Count > 500_000 || data.Payments.Count > 1_000_000 ||
            data.Expenses.Count > 1_000_000 || data.Checks.Count > 1_000_000 ||
            data.Vouchers.Count > 1_000_000 || data.InventoryMovements.Count > 2_000_000 ||
            data.LedgerAccounts.Count > 100_000 || data.JournalEntries.Count > 1_000_000)
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
        var barcodeValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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
            if (!string.IsNullOrWhiteSpace(p.Barcode) && !barcodeValues.Add(p.Barcode.Trim()))
                throw new InvalidDataException("بارکد تکراری در داده‌ها وجود دارد.");
        }

        var invoiceIds = UniqueIds(data.Invoices.Select(i => i?.Id), "فاکتور");
        var invoiceNumbers = new HashSet<int>();
        var validInvoiceTypes = new[] { "SALE", "PURCHASE", "PROFORMA" };
        foreach (var invoice in data.Invoices)
        {
            if (invoice is null || invoice.Lines is null || invoice.Lines.Count == 0 || invoice.Lines.Any(line => line is null))
                throw new InvalidDataException("فاکتور فاقد اقلام معتبر است.");

            if (invoice.Number < 1 || !invoiceNumbers.Add(invoice.Number) ||
                !validInvoiceTypes.Contains(invoice.Type, StringComparer.Ordinal) ||
                !customerIds.Contains(invoice.CustomerId) || string.IsNullOrWhiteSpace(invoice.CustomerName) ||
                invoice.TaxRatePercent < 0m || invoice.TaxRatePercent > 100m ||
                invoice.Subtotal < 0m || invoice.TaxAmount < 0m || invoice.Discount < 0m ||
                invoice.Discount > invoice.Subtotal ||
                invoice.Total != AccountingRules.Money(invoice.Subtotal - invoice.Discount + invoice.TaxAmount) ||
                (!invoice.TaxIsAmount && invoice.TaxAmount != AccountingRules.CalculateTax(invoice.Subtotal, invoice.TaxRatePercent)) ||
                (invoice.TaxIsAmount && invoice.TaxRatePercent != 0m) ||
                invoice.CashAmount < 0m || invoice.CheckAmount < 0m ||
                invoice.CashAmount + invoice.CheckAmount > invoice.Total ||
                invoice.Subtotal != AccountingRules.Money(invoice.Lines.Sum(line => line.LineTotal)) ||
                invoice.Lines.Any(line => string.IsNullOrWhiteSpace(line.ProductId) ||
                    string.IsNullOrWhiteSpace(line.ProductName) || line.Quantity <= 0m ||
                    line.BuyPrice < 0m || line.UnitPrice < 0m ||
                    line.Profit != AccountingRules.Money(line.Profit) ||
                    line.LineTotal != AccountingRules.Money(line.Quantity * line.UnitPrice)) ||
                !new[] { "صادر شده", "تسویه شده", "لغو شده" }.Contains(invoice.Status, StringComparer.Ordinal))
                throw new InvalidDataException("فاکتور ناقص یا ناسازگار است.");
            if (invoice.Type == "PROFORMA" && (invoice.CashAmount > 0m || invoice.CheckAmount > 0m))
                throw new InvalidDataException("پیش‌فاکتور نباید دریافت/پرداخت قطعی داشته باشد.");
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
                (invoice.Status == "لغو شده" && paid != 0m) ||
                (invoice.Type == "PROFORMA" && paid != 0m))
                throw new InvalidDataException("مبالغ دریافت/پرداخت با وضعیت سند سازگار نیست.");
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
            if (!string.IsNullOrWhiteSpace(check.RelatedPaymentId))
            {
                var payment = data.Payments.SingleOrDefault(item => item.Id == check.RelatedPaymentId);
                var linkedInvoice = payment is null
                    ? null
                    : data.Invoices.SingleOrDefault(item => item.Id == payment.InvoiceId);
                var expectedType = linkedInvoice?.Type == "SALE" ? "RECEIVED" : "ISSUED";
                if (payment is null || linkedInvoice is null ||
                    !string.Equals(payment.Method, "چک", StringComparison.Ordinal) ||
                    !string.Equals(payment.InvoiceId, check.RelatedInvoiceId, StringComparison.Ordinal) ||
                    payment.Amount != check.Amount ||
                    !string.Equals(check.CheckType, expectedType, StringComparison.Ordinal))
                    throw new InvalidDataException("پیوند چک با دریافت/پرداخت معتبر نیست.");
            }
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
        {
            if (movement is null || !productIds.Contains(movement.ProductId) ||
                !validLedgerMovementTypes.Contains(movement.MovementType, StringComparer.Ordinal) ||
                movement.SignedQuantity == 0m || movement.Date == default ||
                !new[] { "VOUCHER", "INVOICE" }.Contains(movement.ReferenceType, StringComparer.Ordinal))
                throw new InvalidDataException("گردش موجودی ناقص یا ناسازگار است.");
            var referenceId = string.IsNullOrWhiteSpace(movement.ReferenceId) ? movement.VoucherId : movement.ReferenceId;
            var referenceExists = movement.ReferenceType == "VOUCHER"
                ? data.Vouchers.Any(v => v.Id == referenceId)
                : invoiceIds.Contains(referenceId);
            if (!referenceExists)
                throw new InvalidDataException("سند مرجع گردش موجودی پیدا نشد.");
        }

        // Native parity increment: validate chart-of-accounts and the source app's single-line
        // double-entry records. A posted item always debits and credits the exact same amount.
        var accountIds = UniqueIds(data.LedgerAccounts.Select(a => a?.Id), "سرفصل حساب");
        var accountCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var accountTypes = new[] { "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE" };
        var accountLevels = new[] { "MAIN", "SUB", "DETAIL" };
        foreach (var account in data.LedgerAccounts)
        {
            if (account is null || string.IsNullOrWhiteSpace(account.Code) || string.IsNullOrWhiteSpace(account.Name) ||
                !accountTypes.Contains(account.Type, StringComparer.Ordinal) ||
                !accountLevels.Contains(account.Level, StringComparer.Ordinal))
                throw new InvalidDataException("سرفصل حساب ناقص یا نامعتبر است.");
            if (!accountCodes.Add(account.Code.Trim()))
                throw new InvalidDataException("کد سرفصل حساب تکراری است.");
            if (account.Level == "MAIN" && !string.IsNullOrWhiteSpace(account.ParentId))
                throw new InvalidDataException("حساب اصلی نباید والد داشته باشد.");
            if (account.Level != "MAIN")
            {
                var parent = data.LedgerAccounts.SingleOrDefault(a => a.Id == account.ParentId);
                var expectedParentLevel = account.Level == "SUB" ? "MAIN" : "SUB";
                if (parent is null || parent.Id == account.Id || parent.Level != expectedParentLevel)
                    throw new InvalidDataException("والد سرفصل باید از سطح بلافصل بالاتر انتخاب شود.");
            }
        }

        UniqueIds(data.JournalEntries.Select(j => j?.Id), "سند حسابداری");
        var journalNumbers = new HashSet<int>();
        var allowedDocumentTypes = new[] { "OPERATIONAL", "OPENING", "CLOSING", "ADJUSTMENT" };
        var allowedJournalStatuses = new[] { "DRAFT", "APPROVED", "POSTED" };
        foreach (var entry in data.JournalEntries)
        {
            if (entry is null || entry.Number <= 0 || string.IsNullOrWhiteSpace(entry.Date) ||
                string.IsNullOrWhiteSpace(entry.Description) || entry.Description.Trim().Length < 2 ||
                !accountIds.Contains(entry.DebitAccountId) || !accountIds.Contains(entry.CreditAccountId) ||
                entry.DebitAccountId == entry.CreditAccountId || entry.Amount <= 0m ||
                entry.Amount != AccountingRules.Money(entry.Amount) ||
                !allowedDocumentTypes.Contains(entry.DocumentType, StringComparer.Ordinal) ||
                !allowedJournalStatuses.Contains(entry.Status, StringComparer.Ordinal))
                throw new InvalidDataException("سند حسابداری دوبل ناقص یا نامعتبر است.");
            if (!journalNumbers.Add(entry.Number))
                throw new InvalidDataException("شماره سند حسابداری تکراری است.");
            if (entry.CreatedAt == default)
                throw new InvalidDataException("زمان ثبت سند حسابداری معتبر نیست.");
        }
        if (data.NextJournalNumber < 1 || data.NextJournalNumber <= data.JournalEntries.Select(j => j.Number).DefaultIfEmpty(0).Max())
            throw new InvalidDataException("شمارندهٔ شماره سند حسابداری نامعتبر است.");

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
