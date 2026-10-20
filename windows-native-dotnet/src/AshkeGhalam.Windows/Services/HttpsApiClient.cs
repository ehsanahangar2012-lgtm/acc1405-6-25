using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Transport foundation only. Endpoint-specific DTOs, authentication, license
/// verification, retry and idempotency policies follow after server contracts
/// have been tested.
/// </summary>
public sealed class HttpsApiClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly Uri _baseAddress;
    private bool _disposed;

    public HttpsApiClient(Uri baseAddress, TimeSpan? timeout = null)
    {
        _baseAddress = ApiEndpointPolicy.ValidateBaseAddress(baseAddress);
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        _httpClient = new HttpClient(handler, disposeHandler: true)
        {
            BaseAddress = _baseAddress,
            Timeout = timeout ?? TimeSpan.FromSeconds(20)
        };
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(request);

        var requestUri = request.RequestUri;
        if (requestUri is null ||
            requestUri.IsAbsoluteUri ||
            requestUri.OriginalString.StartsWith("//", StringComparison.Ordinal) ||
            requestUri.OriginalString.Contains('\\') ||
            !Uri.TryCreate(_baseAddress, requestUri, out var resolvedUri) ||
            !HasSameOrigin(_baseAddress, resolvedUri))
        {
            throw new ArgumentException("Only same-origin relative HTTPS API paths are allowed.", nameof(request));
        }

        var response = await _httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);

        var statusCode = (int)response.StatusCode;
        if (statusCode >= 300 && statusCode < 400)
        {
            response.Dispose();
            throw new HttpRequestException("API redirects are disabled by client policy.");
        }

        if (response.RequestMessage?.RequestUri is not Uri finalUri ||
            !HasSameOrigin(_baseAddress, finalUri))
        {
            response.Dispose();
            throw new HttpRequestException("The API response did not remain on its configured HTTPS origin.");
        }

        return response;
    }

    private static bool HasSameOrigin(Uri expected, Uri actual) =>
        string.Equals(expected.Scheme, actual.Scheme, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(expected.Host, actual.Host, StringComparison.OrdinalIgnoreCase) &&
        expected.Port == actual.Port &&
        string.Equals(actual.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _httpClient.Dispose();
        _disposed = true;
    }
}
