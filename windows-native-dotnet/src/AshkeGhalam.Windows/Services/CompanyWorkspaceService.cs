using System.IO;
using System.Text.Json;
using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Keeps the active desktop workspace compatible with existing AccountingData consumers while
/// storing a separate serialized dataset for every company. Legacy unpartitioned data is assigned
/// to the currently active company exactly once; other existing company profiles start empty.
/// </summary>
public static class CompanyWorkspaceService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static bool EnsureInitialized(AccountingData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        data.Companies ??= [];
        if (data.Companies.Count == 0)
            return false;

        if (string.IsNullOrWhiteSpace(data.ActiveCompanyId) ||
            data.Companies.All(company => company.Id != data.ActiveCompanyId))
            data.ActiveCompanyId = data.Companies[0].Id;

        var changed = false;
        foreach (var company in data.Companies)
        {
            if (!string.IsNullOrWhiteSpace(company.WorkspaceDataJson))
                continue;

            // Preserve the old single-company dataset with its existing active owner. Do not
            // silently copy those customer, invoice, stock or ledger rows into other companies.
            var workspace = string.Equals(company.Id, data.ActiveCompanyId, StringComparison.Ordinal)
                ? data
                : CreateEmptyWorkspace(data);
            company.WorkspaceDataJson = SerializeWorkspace(workspace);
            changed = true;
        }

        return changed;
    }

    /// <summary>Returns true when the active company changed and its operational collections were swapped.</summary>
    public static bool SwitchIfRequested(AccountingData data, string? previousCompanyId, string? requestedCompanyId)
    {
        ArgumentNullException.ThrowIfNull(data);
        if (string.IsNullOrWhiteSpace(requestedCompanyId) ||
            string.Equals(previousCompanyId, requestedCompanyId, StringComparison.Ordinal))
            return false;

        var target = data.Companies.FirstOrDefault(company => company.Id == requestedCompanyId)
            ?? throw new InvalidOperationException("پروفایل شرکت مقصد پیدا نشد.");

        var previous = data.Companies.FirstOrDefault(company => company.Id == previousCompanyId);
        if (previous is not null)
            previous.WorkspaceDataJson = SerializeWorkspace(data);

        AccountingData targetWorkspace;
        if (string.IsNullOrWhiteSpace(target.WorkspaceDataJson))
        {
            targetWorkspace = CreateEmptyWorkspace(data);
            target.WorkspaceDataJson = SerializeWorkspace(targetWorkspace);
        }
        else
        {
            targetWorkspace = DeserializeWorkspace(target.WorkspaceDataJson);
        }

        RestoreWorkspace(data, targetWorkspace);
        data.ActiveCompanyId = target.Id;
        return true;
    }

    public static string SerializeWorkspace(AccountingData data)
    {
        var snapshot = data.DeepCopy();
        snapshot.Companies = [];
        snapshot.ActiveCompanyId = "";
        return JsonSerializer.Serialize(snapshot, JsonOptions);
    }

    public static AccountingData DeserializeWorkspace(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw new InvalidDataException("دادهٔ فضای کاری شرکت خالی است.");

        var workspace = JsonSerializer.Deserialize<AccountingData>(json, JsonOptions)
            ?? throw new InvalidDataException("دادهٔ فضای کاری شرکت قابل خواندن نیست.");
        if (workspace.SchemaVersion != 1)
            throw new InvalidDataException("نسخهٔ ساختار فضای کاری شرکت پشتیبانی نمی‌شود.");
        workspace.Companies = [];
        workspace.ActiveCompanyId = "";
        EnsureWorkspaceCollections(workspace);
        return workspace;
    }

    private static AccountingData CreateEmptyWorkspace(AccountingData seed)
    {
        var currentPreferences = seed.Preferences ?? new AccountingPreferences();
        return new AccountingData
        {
            SchemaVersion = seed.SchemaVersion,
            NextInvoiceNumber = 1,
            NextVoucherNumber = 1,
            NextJournalNumber = 1,
            Preferences = new AccountingPreferences
            {
                InvoiceTheme = currentPreferences.InvoiceTheme,
                ApplicationTheme = currentPreferences.ApplicationTheme,
                ShowInvoiceQr = currentPreferences.ShowInvoiceQr,
                Currency = currentPreferences.Currency,
                DefaultTaxRatePercent = currentPreferences.DefaultTaxRatePercent,
                SalesInvoicePrefix = currentPreferences.SalesInvoicePrefix,
                InvoiceFooter = currentPreferences.InvoiceFooter,
                SelectedInvoiceFootnotes = [.. (currentPreferences.SelectedInvoiceFootnotes ?? [])],
                CustomInvoiceFootnoteOptions = [.. (currentPreferences.CustomInvoiceFootnoteOptions ?? [])]
            },
            MoadianSettings = new MoadianSettingsRecord
            {
                TaxpayerId = seed.MoadianSettings?.TaxpayerId ?? "",
                Environment = seed.MoadianSettings?.Environment ?? "Sandbox",
                ApiBaseUrl = seed.MoadianSettings?.ApiBaseUrl ?? "",
                IsConfigured = seed.MoadianSettings?.IsConfigured ?? false
            },
            ServerConnection = new ServerConnectionSettings
            {
                BaseUrl = seed.ServerConnection?.BaseUrl ?? "https://acc.ashkghalam.ir/",
                WorkspaceId = seed.ServerConnection?.WorkspaceId ?? "",
                SyncMode = seed.ServerConnection?.SyncMode ?? "manual"
            }
        };
    }

    private static void RestoreWorkspace(AccountingData target, AccountingData workspace)
    {
        EnsureWorkspaceCollections(workspace);
        target.SchemaVersion = workspace.SchemaVersion;
        target.NextInvoiceNumber = Math.Max(1, workspace.NextInvoiceNumber);
        target.NextVoucherNumber = Math.Max(1, workspace.NextVoucherNumber);
        target.NextJournalNumber = Math.Max(1, workspace.NextJournalNumber);
        target.Customers = workspace.Customers;
        target.Products = workspace.Products;
        target.Invoices = workspace.Invoices;
        target.Payments = workspace.Payments;
        target.Expenses = workspace.Expenses;
        target.Checks = workspace.Checks;
        target.Vouchers = workspace.Vouchers;
        target.InventoryMovements = workspace.InventoryMovements;
        target.LedgerAccounts = workspace.LedgerAccounts;
        target.JournalEntries = workspace.JournalEntries;
        target.Preferences = workspace.Preferences;
        target.MoadianSettings = workspace.MoadianSettings;
        target.ServerConnection = workspace.ServerConnection;
    }

    private static void EnsureWorkspaceCollections(AccountingData workspace)
    {
        workspace.Customers ??= [];
        workspace.Products ??= [];
        workspace.Invoices ??= [];
        workspace.Payments ??= [];
        workspace.Expenses ??= [];
        workspace.Checks ??= [];
        workspace.Vouchers ??= [];
        workspace.InventoryMovements ??= [];
        workspace.LedgerAccounts ??= [];
        workspace.JournalEntries ??= [];
        workspace.Preferences ??= new AccountingPreferences();
        workspace.MoadianSettings ??= new MoadianSettingsRecord();
        workspace.ServerConnection ??= new ServerConnectionSettings();
    }
}
