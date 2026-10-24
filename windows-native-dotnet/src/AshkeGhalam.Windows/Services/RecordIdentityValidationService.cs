using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Shared identity checks for both the editor forms and the final data commit.
/// UI validation improves feedback; commit validation remains the authoritative guard.
/// </summary>
public static class RecordIdentityValidationService
{
    public static void EnsureUniquePersonCode(
        IEnumerable<CustomerRecord> people,
        string? code,
        string? currentPersonId = null)
    {
        ArgumentNullException.ThrowIfNull(people);
        var candidate = code?.Trim();
        if (string.IsNullOrWhiteSpace(candidate))
            return;

        if (people.Any(person =>
                !string.Equals(person.Id, currentPersonId, StringComparison.Ordinal) &&
                string.Equals(person.Code?.Trim(), candidate, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("کد شخص تکراری است.");
    }

    public static void EnsureUniqueProductCode(
        IEnumerable<ProductRecord> products,
        string? code,
        string? currentProductId = null)
    {
        ArgumentNullException.ThrowIfNull(products);
        var candidate = code?.Trim();
        if (string.IsNullOrWhiteSpace(candidate))
            return;

        if (products.Any(product =>
                !string.Equals(product.Id, currentProductId, StringComparison.Ordinal) &&
                string.Equals(product.Code?.Trim(), candidate, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("کد کالای تکراری مجاز نیست.");
    }

    public static void EnsureUniqueProductBarcode(
        IEnumerable<ProductRecord> products,
        string? barcode,
        string? currentProductId = null)
    {
        ArgumentNullException.ThrowIfNull(products);
        var candidate = barcode?.Trim();
        if (string.IsNullOrWhiteSpace(candidate))
            return;

        if (products.Any(product =>
                !string.Equals(product.Id, currentProductId, StringComparison.Ordinal) &&
                string.Equals(product.Barcode?.Trim(), candidate, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("بارکد کالا تکراری است.");
    }
}
