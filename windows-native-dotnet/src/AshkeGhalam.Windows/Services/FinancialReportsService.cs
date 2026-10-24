using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record FinancialAccountLine(
    string Code, string Name, string Type, decimal Debit, decimal Credit, decimal Balance);

public sealed record FinancialReportSnapshot(
    decimal Revenue,
    decimal CostOfSales,
    decimal GrossProfit,
    decimal OperatingExpenses,
    decimal NetProfit,
    decimal Assets,
    decimal Liabilities,
    decimal Equity,
    decimal CashInflows,
    decimal CashOutflows,
    decimal NetCashChange,
    decimal CashBalance,
    decimal BalanceSheetDifference,
    IReadOnlyList<FinancialAccountLine> Accounts);

/// <summary>
/// Derived statements based only on posted/approved native journal entries.
/// A zero balance difference is a mathematical control, not a certification of source-app parity.
/// </summary>
public static class FinancialReportsService
{
    private static readonly HashSet<string> CashAndBankCodes = new(StringComparer.Ordinal)
    {
        "1110", "1120"
    };

    public static FinancialReportSnapshot Build(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        var trialBalance = NativeLedgerService.GetTrialBalance(data);
        var accounts = trialBalance.Select(line => new FinancialAccountLine(
            line.Code, line.Name, line.Type, line.Debit, line.Credit, line.Balance)).ToList();

        var revenue = accounts.Where(a => a.Type == "REVENUE").Sum(a => a.Credit - a.Debit);
        var costOfSales = accounts.Where(a => a.Code == "5000").Sum(a => a.Debit - a.Credit);
        var operatingExpenses = accounts
            .Where(a => a.Type == "EXPENSE" && a.Code != "5000")
            .Sum(a => a.Debit - a.Credit);
        var grossProfit = revenue - costOfSales;
        var netProfit = grossProfit - operatingExpenses;

        var assets = accounts.Where(a => a.Type == "ASSET").Sum(a => a.Balance);
        var liabilities = accounts.Where(a => a.Type == "LIABILITY").Sum(a => -a.Balance);
        var equity = accounts.Where(a => a.Type == "EQUITY").Sum(a => -a.Balance);
        var cashBalance = accounts.Where(a => CashAndBankCodes.Contains(a.Code)).Sum(a => a.Balance);

        var accountById = data.LedgerAccounts.ToDictionary(a => a.Id, a => a, StringComparer.Ordinal);
        var posted = data.JournalEntries.Where(e => e.Status is "POSTED" or "APPROVED").ToList();
        decimal inflows = 0m;
        decimal outflows = 0m;
        foreach (var entry in posted)
        {
            var debitIsCash = accountById.TryGetValue(entry.DebitAccountId, out var debitAccount) &&
                CashAndBankCodes.Contains(debitAccount.Code);
            var creditIsCash = accountById.TryGetValue(entry.CreditAccountId, out var creditAccount) &&
                CashAndBankCodes.Contains(creditAccount.Code);

            if (debitIsCash && !creditIsCash)
                inflows += entry.Amount;
            else if (creditIsCash && !debitIsCash)
                outflows += entry.Amount;
        }

        return new FinancialReportSnapshot(
            revenue,
            costOfSales,
            grossProfit,
            operatingExpenses,
            netProfit,
            assets,
            liabilities,
            equity,
            inflows,
            outflows,
            inflows - outflows,
            cashBalance,
            assets - (liabilities + equity + netProfit),
            accounts);
    }
}
