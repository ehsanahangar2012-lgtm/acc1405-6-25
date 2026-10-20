using System.Net;
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
    private bool _disposed;

    public HttpsApiClient(Uri baseAddress, TimeSpan? timeout = null)
    {
        var validatedAddress = ApiEndpointPolicy.ValidateBaseAddress(baseAddress);
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        _httpClient = new HttpClient(handler, disposeHandler: true)
        {
            BaseAddress = validatedAddress,
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

        if (request.RequestUri is null || request.RequestUri.IsAbsoluteUri)
        {
            throw new ArgumentException("Only relative API paths are allowed.", nameof(request));
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

        if (!string.Equals(
                response.RequestMessage?.RequestUri?.Scheme,
                Uri.UriSchemeHttps,
                StringComparison.OrdinalIgnoreCase))
        {
            response.Dispose();
            throw new HttpRequestException("The API response did not remain on HTTPS.");
        }

        return response;
    }

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
