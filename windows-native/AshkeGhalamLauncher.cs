using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace AshkeGhalam {
    static class Program {
        [STAThread]
        static void Main() {
            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string distIndex = Path.Combine(baseDir, "dist", "index.html");
                if (!File.Exists(distIndex)) {
                    distIndex = Path.Combine(baseDir, "index.html");
                }

                // ایزولاسیون کامل دیتابیس در AppData برای استقلال داده‌ها
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AshkeGhalam");
                Directory.CreateDirectory(appData);
                Directory.CreateDirectory(Path.Combine(appData, "Backups"));

                // یافتن موتور بومی Edge WebView2 Evergreen
                string edgePath = "";
                string p86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
                string p64 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

                string[] candidates = new string[] {
                    Path.Combine(p86, "Microsoft\\Edge\\Application\\msedge.exe"),
                    Path.Combine(p64, "Microsoft\\Edge\\Application\\msedge.exe"),
                    Path.Combine(localApp, "Microsoft\\Edge\\Application\\msedge.exe")
                };

                foreach (var c in candidates) {
                    if (File.Exists(c)) { edgePath = c; break; }
                }

                if (!string.IsNullOrEmpty(edgePath) && File.Exists(distIndex)) {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = edgePath;
                    psi.Arguments = "--app=\"file:///" + distIndex.Replace('\\', '/') + "\" --user-data-dir=\"" + appData + "\" --window-size=1280,850 --enable-gpu-rasterization --in-process-gpu";
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                } else if (File.Exists(distIndex)) {
                    Process.Start(new ProcessStartInfo { FileName = distIndex, UseShellExecute = true });
                } else {
                    MessageBox.Show("فایل اجرایی dist\\index.html یافت نشد. لطفاً Make-Setup.bat را اجرا کنید.", "اشک قلم", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            } catch (Exception ex) {
                MessageBox.Show("خطا در راه‌اندازی اشک قلم: " + ex.Message, "اشک قلم", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
