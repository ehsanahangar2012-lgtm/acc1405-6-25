using System;

namespace AshkeGhalam.Windows.Models;

public sealed class LoanRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string LoanNumber { get; set; } = "";
    public string LenderName { get; set; } = "";
    public decimal PrincipalAmount { get; set; }
    public decimal AnnualInterestRatePercent { get; set; }
    public DateTimeOffset StartDate { get; set; } = DateTimeOffset.Now;
    public int InstallmentCount { get; set; }
    public decimal RemainingPrincipal { get; set; }
    public string CurrencyCode { get; set; } = "IRR";
    public string FundingAccountCode { get; set; } = "1120";
    public string Status { get; set; } = "ACTIVE";
    public string Notes { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class LoanInstallmentRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string LoanId { get; set; } = "";
    public int InstallmentNumber { get; set; }
    public DateTimeOffset DueDate { get; set; }
    public decimal PrincipalAmount { get; set; }
    public decimal InterestAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTimeOffset? PaidAt { get; set; }
    public string PaymentAccountCode { get; set; } = "";
}

public sealed class CurrencyRateRecord
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Symbol { get; set; } = "";
    /// <summary>How many Iranian rials equal one unit of this currency. Zero means not configured.</summary>
    public decimal RialPerUnit { get; set; }
    public bool IsRateConfigured { get; set; }
    public DateTimeOffset LastUpdated { get; set; } = DateTimeOffset.Now;
}

public sealed class BankAccountRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BankName { get; set; } = "";
    public string AccountNumberMasked { get; set; } = "";
    public string CurrencyCode { get; set; } = "IRR";
    public decimal OpeningBalance { get; set; }
    public bool IsActive { get; set; } = true;
    public string Notes { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class BankTransactionRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BankAccountId { get; set; } = "";
    public DateTimeOffset Date { get; set; } = DateTimeOffset.Now;
    public string Description { get; set; } = "";
    public string Direction { get; set; } = "CREDIT";
    public decimal Amount { get; set; }
    public string Reference { get; set; } = "";
    public string LinkedPaymentId { get; set; } = "";
    public bool IsReconciled { get; set; }
    public string ReconciliationNote { get; set; } = "";
    public DateTimeOffset? ReconciledAt { get; set; }
}
