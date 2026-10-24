using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NativeAccountingSyncServiceTests
{
    private const string WorkspaceId = "client_test_01";
    private const string WorkspaceToken = "TEST-WORKSPACE-TOKEN-9182";
    private const string HardwareId = "ASHK-HWID-1111-2222-3333-4444";
    private static readonly Uri BaseAddress = new("https://acc.ashkghalam.ir/");

    [TestMethod]
    public async Task DownloadUsesStorageLoadContractAndTreatsMissingSnapshotAsEmpty()
    {
        var handler = new RecordingStorageHandler(request =>
        {
            if (request.Uri.AbsolutePath == "/storage.php")
                return new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("not found") };

            Assert.AreEqual("/host-backend/storage.php", request.Uri.AbsolutePath);
            using var json = JsonDocument.Parse(request.Body);
            Assert.AreEqual("load", json.RootElement.GetProperty("action").GetString());
            Assert.AreEqual(NativeAccountingSyncService.SnapshotKey, json.RootElement.GetProperty("key").GetString());
            Assert.IsFalse(json.RootElement.TryGetProperty("table", out _));
            Assert.AreEqual(WorkspaceId, request.Headers["X-Workspace-ID"]);
            Assert.AreEqual(WorkspaceToken, request.Headers["X-Workspace-Token"]);
            Assert.AreEqual(HardwareId, request.Headers["X-Device-HWID"]);
            return JsonResponse(new { success = false, workspace = WorkspaceId });
        });

        var sync = new NativeAccountingSyncService(_ => handler);
        var data = await sync.DownloadAsync(Settings(), License());

        Assert.IsNull(data);
        Assert.AreEqual(2, handler.Requests.Count);
        Assert.AreEqual("/storage.php", handler.Requests[0].Uri.AbsolutePath);
        Assert.AreEqual("/host-backend/storage.php", handler.Requests[1].Uri.AbsolutePath);
    }

    [TestMethod]
    public async Task UploadUsesStringValueAndServerWorkspaceEnvelope()
    {
        var handler = new RecordingStorageHandler(request =>
        {
            if (request.Uri.AbsolutePath == "/storage.php")
                return new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("not found") };

            using var json = JsonDocument.Parse(request.Body);
            var root = json.RootElement;
            Assert.AreEqual("save", root.GetProperty("action").GetString());
            Assert.AreEqual(NativeAccountingSyncService.SnapshotKey, root.GetProperty("key").GetString());
            Assert.AreEqual(JsonValueKind.String, root.GetProperty("value").ValueKind);
            Assert.IsFalse(root.TryGetProperty("data", out _));
            using var envelope = JsonDocument.Parse(root.GetProperty("value").GetString()!);
            Assert.AreEqual(WorkspaceId, envelope.RootElement.GetProperty("workspaceId").GetString());
            Assert.AreEqual(JsonValueKind.Object, envelope.RootElement.GetProperty("snapshot").ValueKind);
            Assert.AreEqual(WorkspaceId, request.Headers["X-Workspace-ID"]);
            Assert.AreEqual(WorkspaceToken, request.Headers["X-Workspace-Token"]);
            Assert.AreEqual(HardwareId, request.Headers["X-Device-HWID"]);
            return JsonResponse(new { success = true, workspace = WorkspaceId });
        });

        var data = CleanAccountingData();
        var sync = new NativeAccountingSyncService(_ => handler);
        await sync.UploadAsync(Settings(), License(), data);
        Assert.AreEqual(2, handler.Requests.Count);
    }

    [TestMethod]
    public async Task DownloadDeserializesStringEnvelopeAndRejectsDifferentWorkspace()
    {
        var data = CleanAccountingData();
        var envelope = JsonSerializer.Serialize(new
        {
            workspaceId = WorkspaceId,
            schemaVersion = data.SchemaVersion,
            updatedAtUtc = DateTimeOffset.UtcNow,
            snapshot = data
        });
        var handler = new RecordingStorageHandler(_ =>
            JsonResponse(new { success = true, data = envelope, workspace = WorkspaceId }));
        var sync = new NativeAccountingSyncService(_ => handler);
        var downloaded = await sync.DownloadAsync(Settings(), License());

        Assert.IsNotNull(downloaded);
        Assert.AreEqual(data.CurrencyRates.Count, downloaded.CurrencyRates.Count);

        var invalidEnvelope = JsonSerializer.Serialize(new
        {
            workspaceId = "another_workspace",
            schemaVersion = data.SchemaVersion,
            updatedAtUtc = DateTimeOffset.UtcNow,
            snapshot = data
        });
        var invalidHandler = new RecordingStorageHandler(_ =>
            JsonResponse(new { success = true, data = invalidEnvelope, workspace = WorkspaceId }));
        var invalidSync = new NativeAccountingSyncService(_ => invalidHandler);
        await Assert.ThrowsExceptionAsync<InvalidDataException>(
            () => invalidSync.DownloadAsync(Settings(), License()));
    }

    [TestMethod]
    public async Task SyncRejectsUntrustedHostAndMismatchedWorkspaceBeforeNetwork()
    {
        var handler = new RecordingStorageHandler(_ => JsonResponse(new { success = true, workspace = WorkspaceId }));
        var sync = new NativeAccountingSyncService(_ => handler);

        await Assert.ThrowsExceptionAsync<InvalidOperationException>(() =>
            sync.DownloadAsync(new ServerConnectionSettings { BaseUrl = "https://not-ashkghalam.example/" }, License()));
        await Assert.ThrowsExceptionAsync<InvalidOperationException>(() =>
            sync.DownloadAsync(new ServerConnectionSettings
            {
                BaseUrl = BaseAddress.ToString(), WorkspaceId = "other_workspace"
            }, License()));

        Assert.AreEqual(0, handler.Requests.Count);
    }

    private static ServerConnectionSettings Settings() => new()
    {
        BaseUrl = BaseAddress.ToString(),
        WorkspaceId = WorkspaceId,
        SyncMode = "manual"
    };

    private static NativeLicenseState License() => new()
    {
        LicenseKey = WorkspaceToken,
        WorkspaceId = WorkspaceId,
        HardwareId = HardwareId
    };

    private static AccountingData CleanAccountingData()
    {
        var data = new AccountingData();
        NativeFinancialModuleService.EnsureDefaults(data);
        AccountingDataValidator.Validate(data);
        return data;
    }

    private static HttpResponseMessage JsonResponse<T>(T payload) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
    };

    private sealed class RecordingStorageHandler : HttpMessageHandler
    {
        private readonly Func<RequestSnapshot, HttpResponseMessage> _responder;
        public List<RequestSnapshot> Requests { get; } = [];

        public RecordingStorageHandler(Func<RequestSnapshot, HttpResponseMessage> responder) =>
            _responder = responder;

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var header in request.Headers) headers[header.Key] = string.Join(",", header.Value);

            var snapshot = new RequestSnapshot(request.Method, request.RequestUri!, body, headers);
            Requests.Add(snapshot);
            var response = _responder(snapshot);
            response.RequestMessage = request;
            return response;
        }
    }

    private sealed record RequestSnapshot(
        HttpMethod Method, Uri Uri, string Body, IReadOnlyDictionary<string, string> Headers);
}
