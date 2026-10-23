using System;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Threading;

namespace AshkeGhalam.Windows;

public partial class App : Application
{
    private static readonly object LogGate = new();

    public App()
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
    }

    private static string DiagnosticLogPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AshkeGhalam", "WindowsNative", "startup-error.log");

    private static void WriteFatalLog(string source, Exception? exception)
    {
        try
        {
            var folder = Path.GetDirectoryName(DiagnosticLogPath);
            if (!string.IsNullOrWhiteSpace(folder))
                Directory.CreateDirectory(folder);
            var detail = exception?.ToString() ?? "No exception details were supplied.";
            lock (LogGate)
            {
                File.AppendAllText(DiagnosticLogPath,
                    $"[{DateTimeOffset.Now:O}] {source}{Environment.NewLine}{detail}{Environment.NewLine}{new string('-', 72)}{Environment.NewLine}",
                    new UTF8Encoding(false));
            }
        }
        catch
        {
            // A diagnostic failure must never mask the original application exception.
        }
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        WriteFatalLog("WPF DispatcherUnhandledException", e.Exception);
    }

    private void OnDomainUnhandledException(object? sender, UnhandledExceptionEventArgs e)
    {
        WriteFatalLog("AppDomain UnhandledException; terminating=" + e.IsTerminating, e.ExceptionObject as Exception);
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        WriteFatalLog("TaskScheduler UnobservedTaskException", e.Exception);
    }
}
