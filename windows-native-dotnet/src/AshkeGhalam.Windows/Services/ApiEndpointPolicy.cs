namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Validates API origins before a network client is created. HTTPS and ordinary
/// operating-system TLS validation are required; no certificate bypass is offered.
/// </summary>
public static class ApiEndpointPolicy
{
    public static Uri TrustedLicenseAuthority { get; } = new("https://acc.ashkghalam.ir/");

    public static Uri ValidateBaseAddress(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("A valid absolute HTTPS API URL is required.", nameof(value));
        }

        return ValidateBaseAddress(uri);
    }

    public static Uri ValidateBaseAddress(Uri? uri)
    {
        if (uri is null ||
            !uri.IsAbsoluteUri ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment))
        {
            throw new ArgumentException(
                "API base address must be an absolute HTTPS URI without embedded credentials, query, or fragment.",
                nameof(uri));
        }

        var builder = new UriBuilder(uri)
        {
            Path = uri.AbsolutePath.EndsWith("/", StringComparison.Ordinal)
                ? uri.AbsolutePath
                : uri.AbsolutePath + "/"
        };

        return builder.Uri;
    }
}
