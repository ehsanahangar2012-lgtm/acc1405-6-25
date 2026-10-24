namespace AshkeGhalam.Windows.Services;

/// <summary>Single source of truth for compatible inventory movement choices on vouchers.</summary>
public static class VoucherMovementPolicy
{
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> Allowed =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["IN"] = Array.AsReadOnly(new[] { "GOODS_RECEIPT", "INVENTORY_ADJUSTMENT", "PRODUCTION_OUTPUT" }),
            ["OUT"] = Array.AsReadOnly(new[] { "GOODS_ISSUE", "INVENTORY_ADJUSTMENT", "PRODUCTION_CONSUMPTION" }),
            ["RETURN"] = Array.AsReadOnly(new[] { "RETURN_RECEIPT", "RETURN_ISSUE" })
        };

    public static IReadOnlyList<string> GetAllowedMovementTypes(string? documentType) =>
        documentType is not null && Allowed.TryGetValue(documentType, out var values)
            ? values
            : Array.Empty<string>();

    public static string GetDefaultMovementType(string? documentType) => documentType switch
    {
        "IN" => "GOODS_RECEIPT",
        "OUT" => "GOODS_ISSUE",
        "RETURN" => "RETURN_RECEIPT",
        _ => string.Empty
    };

    public static bool IsAllowed(string? documentType, string? movementType) =>
        !string.IsNullOrWhiteSpace(movementType) &&
        GetAllowedMovementTypes(documentType).Contains(movementType, StringComparer.Ordinal);
}
