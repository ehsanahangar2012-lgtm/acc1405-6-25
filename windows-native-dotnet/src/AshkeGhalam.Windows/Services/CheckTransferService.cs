using AshkeGhalam.Windows.Models;

namespace AshkeGhalam.Windows.Services;

public sealed record CheckTransferSummary(int Count, decimal TotalAmount);

/// <summary>
/// Transfers a validated group of received cheques to one payee.
/// All checks are validated before any status/history mutation is performed.
/// </summary>
public static class CheckTransferService
{
    public static CheckTransferSummary TransferToPerson(
        AccountingData data,
        IEnumerable<string> checkIds,
        string payeeName,
        string? payeePersonId,
        string? note)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(checkIds);

        var ids = checkIds.Where(id => !string.IsNullOrWhiteSpace(id)).ToHashSet(StringComparer.Ordinal);
        if (ids.Count == 0)
            throw new InvalidOperationException("حداقل یک چک را برای واگذاری انتخاب کنید.");

        payeeName = payeeName?.Trim() ?? "";
        if (payeeName.Length < 2)
            throw new InvalidOperationException("نام دارنده / ذی‌نفع جدید را وارد کنید.");

        var originals = data.Checks.Where(check => ids.Contains(check.Id)).ToList();
        if (originals.Count != ids.Count)
            throw new InvalidOperationException("یک یا چند چک انتخاب‌شده پیدا نشدند؛ جدول را تازه‌سازی کنید.");

        if (originals.Any(check =>
            check.CheckType != "RECEIVED" || check.Status is not ("PENDING" or "DEPOSITED")))
            throw new InvalidOperationException("واگذاری گروهی لغو شد؛ همهٔ چک‌ها باید دریافتی و در وضعیت «در انتظار» یا «واگذار به بانک» باشند.");

        var now = DateTimeOffset.Now;
        var noteText = note?.Trim() ?? "";
        var total = originals.Sum(check => check.Amount);
        var linkedChecks = originals.Select(original => new CheckRecord
        {
            BankName = original.BankName,
            Amount = original.Amount,
            DueDate = original.DueDate,
            IssueDate = original.IssueDate,
            Status = "PENDING",
            SayadId = "",
            CheckNumber = original.CheckNumber,
            HolderName = payeeName,
            PersonId = payeePersonId ?? "",
            PersonName = payeeName,
            RelatedInvoiceId = original.RelatedInvoiceId,
            ImagePath = original.ImagePath,
            ImageDataBase64 = original.ImageDataBase64,
            IsHighPriority = original.IsHighPriority,
            Description = $"خرج از چک دریافتی {original.CheckNumber} (شناسهٔ اصلی: {original.SayadId}). {noteText}".Trim(),
            CheckType = "ISSUED",
            CreatedAt = now,
            History =
            [
                new CheckHistoryRecord
                {
                    ChangedAt = now,
                    Status = "PENDING",
                    Note = $"ثبت واگذاری چک دریافتی {original.CheckNumber} به نام {payeeName}"
                }
            ]
        }).ToList();

        foreach (var original in originals)
        {
            original.Status = "TRANSFERRED";
            original.History ??= [];
            original.History.Add(new CheckHistoryRecord
            {
                ChangedAt = now,
                Status = "TRANSFERRED",
                Note = $"خرج / واگذاری به {payeeName}: {noteText}".Trim()
            });
        }
        data.Checks.AddRange(linkedChecks);
        return new CheckTransferSummary(originals.Count, total);
    }
}