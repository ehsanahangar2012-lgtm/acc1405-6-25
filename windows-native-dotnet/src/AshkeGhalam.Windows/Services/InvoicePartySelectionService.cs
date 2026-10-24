using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Supplies invoice party choices and stays compatible with older local data where role flags
/// may be absent but the legacy Type field still identifies a customer or supplier.
/// </summary>
public static class InvoicePartySelectionService
{
    public static IReadOnlyList<CustomerRecord> GetSelectableParties(
        IEnumerable<CustomerRecord>? people,
        string? invoiceType)
    {
        var isPurchase = string.Equals(invoiceType, "PURCHASE", StringComparison.OrdinalIgnoreCase);
        return (people ?? Enumerable.Empty<CustomerRecord>())
            .Where(person => person is not null &&
                !string.IsNullOrWhiteSpace(person.Name) &&
                (isPurchase ? HasSupplierRole(person) : HasCustomerRole(person)))
            .OrderBy(person => person.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }

    public static bool HasCustomerRole(CustomerRecord person)
    {
        ArgumentNullException.ThrowIfNull(person);
        var type = (person.Type ?? "").Trim();
        return person.IsCustomer ||
            type.Equals("CUSTOMER", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("CLIENT", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("BOTH", StringComparison.OrdinalIgnoreCase);
    }

    public static bool HasSupplierRole(CustomerRecord person)
    {
        ArgumentNullException.ThrowIfNull(person);
        var type = (person.Type ?? "").Trim();
        return person.IsSupplier ||
            type.Equals("VENDOR", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("SUPPLIER", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("BOTH", StringComparison.OrdinalIgnoreCase);
    }
}
