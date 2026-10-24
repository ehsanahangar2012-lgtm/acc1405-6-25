using System.IO;
using System.Printing;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Win32;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Adds consistent file-export actions to printable native documents. PDF output uses
/// Windows' Microsoft Print to PDF queue, without a browser or separate PDF runtime.
/// </summary>
public static class DocumentExportService
{
    public static void AddSaveButtons(
        Panel actions,
        Window owner,
        Func<FlowDocument> documentFactory,
        string defaultFileStem)
    {
        ArgumentNullException.ThrowIfNull(actions);
        ArgumentNullException.ThrowIfNull(owner);
        ArgumentNullException.ThrowIfNull(documentFactory);

        actions.Children.Add(CreateButton(
            "ذخیره فایل",
            "ذخیره نسخهٔ قالب‌بندی‌شدهٔ قابل ویرایش (RTF)",
            Color.FromRgb(51, 65, 85),
            () => SaveAsRtf(owner, documentFactory(), defaultFileStem)));

        actions.Children.Add(CreateButton(
            "ذخیره PDF",
            "تولید PDF از نسخهٔ چاپی همین سند",
            Color.FromRgb(15, 118, 110),
            () => SaveAsPdf(owner, documentFactory(), defaultFileStem)));
    }

    private static Button CreateButton(string caption, string tooltip, Color background, Action onClick)
    {
        var button = new Button
        {
            Content = caption,
            ToolTip = tooltip,
            MinWidth = 112,
            Height = 38,
            Padding = new Thickness(14, 6, 14, 6),
            Margin = new Thickness(0, 0, 8, 0),
            Background = new SolidColorBrush(background),
            Foreground = Brushes.White,
            BorderBrush = new SolidColorBrush(background),
            BorderThickness = new Thickness(1),
            FontWeight = FontWeights.SemiBold,
            Cursor = System.Windows.Input.Cursors.Hand
        };
        button.Click += (_, _) => onClick();
        return button;
    }

    private static void SaveAsRtf(Window owner, FlowDocument document, string defaultFileStem)
    {
        try
        {
            var dialog = new SaveFileDialog
            {
                Title = "ذخیرهٔ سند اشک قلم",
                FileName = MakeSafeFileName(defaultFileStem) + ".rtf",
                Filter = "سند قابل ویرایش RTF (*.rtf)|*.rtf",
                DefaultExt = ".rtf",
                AddExtension = true,
                OverwritePrompt = true
            };
            if (dialog.ShowDialog(owner) != true) return;

            using var stream = new FileStream(dialog.FileName, FileMode.Create, FileAccess.Write, FileShare.None);
            new TextRange(document.ContentStart, document.ContentEnd).Save(stream, DataFormats.Rtf);
            MessageBox.Show(owner, "فایل ذخیره شد:\n" + dialog.FileName,
                "ذخیرهٔ سند", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(owner, "ذخیرهٔ فایل انجام نشد.\n" + ex.Message,
                "خطا در ذخیره", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static void SaveAsPdf(Window owner, FlowDocument document, string defaultFileStem)
    {
        try
        {
            using var server = new LocalPrintServer();
            PrintQueue? pdfQueue = null;
            foreach (PrintQueue queue in server.GetPrintQueues())
            {
                if (queue.Name.Contains("Microsoft Print to PDF", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(queue.Name, "Print to PDF", StringComparison.OrdinalIgnoreCase))
                {
                    pdfQueue = queue;
                    break;
                }
                queue.Dispose();
            }

            if (pdfQueue is null)
            {
                MessageBox.Show(owner,
                    "چاپگر «Microsoft Print to PDF» در ویندوز نصب یا فعال نیست. آن را از Windows Features فعال کنید و دوباره ذخیرهٔ PDF را بزنید.",
                    "چاپگر PDF در دسترس نیست", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            using (pdfQueue)
            {
                var dialog = new PrintDialog { PrintQueue = pdfQueue };
                dialog.PrintDocument(
                    ((IDocumentPaginatorSource)document).DocumentPaginator,
                    MakeSafeFileName(defaultFileStem));
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(owner,
                "تولید PDF انجام نشد. وجود چاپگر Windows «Microsoft Print to PDF» را بررسی کنید.\n" + ex.Message,
                "خطا در خروجی PDF", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static string MakeSafeFileName(string? value)
    {
        var text = string.IsNullOrWhiteSpace(value) ? "AshkeGhalam-document" : value.Trim();
        foreach (var invalid in Path.GetInvalidFileNameChars())
            text = text.Replace(invalid, '-');
        text = text.Trim(' ', '.', '-');
        return string.IsNullOrWhiteSpace(text) ? "AshkeGhalam-document" : text;
    }
}
