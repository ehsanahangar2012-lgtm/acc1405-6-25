using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class ApiEndpointPolicyTests
{
    [TestMethod]
    public void AcceptsHttpsAndNormalizesTrailingSlash()
    {
        var result = ApiEndpointPolicy.ValidateBaseAddress("https://acc.ashkghalam.ir");
        Assert.AreEqual("https://acc.ashkghalam.ir/", result.AbsoluteUri);
    }

    [TestMethod]
    public void TrustedLicenseAuthorityUsesConfiguredProductionOrigin()
    {
        Assert.AreEqual("https://acc.ashkghalam.ir/", ApiEndpointPolicy.TrustedLicenseAuthority.AbsoluteUri);
    }

    [DataTestMethod]
    [DataRow("http://acc.ashkghalam.ir")]
    [DataRow("file:///C:/private")]
    [DataRow("https://user:secret@acc.ashkghalam.ir")]
    [DataRow("https://acc.ashkghalam.ir/?token=secret")]
    [DataRow("https://acc.ashkghalam.ir/#fragment")]
    public void RejectsInsecureOrAmbiguousEndpoints(string endpoint)
    {
        Assert.ThrowsException<ArgumentException>(() => ApiEndpointPolicy.ValidateBaseAddress(endpoint));
    }

    [TestMethod]
    public void RejectsMissingEndpoint()
    {
        Assert.ThrowsException<ArgumentException>(() => ApiEndpointPolicy.ValidateBaseAddress((string?)null));
        Assert.ThrowsException<ArgumentException>(() => ApiEndpointPolicy.ValidateBaseAddress("  "));
    }

    [TestMethod]
    public async Task RejectsAbsoluteRequestUri()
    {
        using var client = new HttpsApiClient(new Uri("https://acc.ashkghalam.ir/"));
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("https://example.com/steal", UriKind.Absolute));
        await Assert.ThrowsExceptionAsync<ArgumentException>(() => client.SendAsync(request));
    }

    [TestMethod]
    public async Task RejectsNetworkPathReference()
    {
        using var client = new HttpsApiClient(new Uri("https://acc.ashkghalam.ir/"));
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("//example.com/path", UriKind.Relative));
        await Assert.ThrowsExceptionAsync<ArgumentException>(() => client.SendAsync(request));
    }
}
