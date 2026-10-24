using System;
using System.IO;
using System.Linq;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class AutomaticBackupServiceTests
{
    [TestMethod]
    public void RetentionRemovesOldestAutomaticFilesAndPreservesManualBackups()
    {
        var directory = Path.Combine(Path.GetTempPath(), "AshkeGhalam-Backup-Retention-Test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var origin = DateTime.UtcNow.AddDays(-30);
            for (var i = 0; i < 23; i++)
            {
                var path = Path.Combine(directory, $"AshkeGhalam-AutoBackup-1405-01-{i + 1:00}-120000.ashkbackup");
                File.WriteAllText(path, "test fixture");
                File.SetLastWriteTimeUtc(path, origin.AddHours(i));
            }

            var manual = Path.Combine(directory, "AshkeGhalam-Backup-manual.ashkbackup");
            File.WriteAllText(manual, "manual backup");

            var removed = AutomaticBackupService.PruneOldAutomaticBackups(directory, 20);

            Assert.AreEqual(3, removed);
            var automatic = Directory.GetFiles(directory, "AshkeGhalam-AutoBackup-*.ashkbackup");
            Assert.AreEqual(20, automatic.Length);
            Assert.IsTrue(File.Exists(manual), "Manually created backup files must never be removed by automatic retention.");
            Assert.IsTrue(File.Exists(Path.Combine(directory, "AshkeGhalam-AutoBackup-1405-01-23-120000.ashkbackup")),
                "The most recent automatic backup should remain.");
            Assert.IsFalse(File.Exists(Path.Combine(directory, "AshkeGhalam-AutoBackup-1405-01-01-120000.ashkbackup")),
                "The oldest automatic backup should be removed first.");
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }

    [TestMethod]
    public void RetentionHonorsSmallerConfiguredLimitWithoutDeletingOtherFiles()
    {
        var directory = Path.Combine(Path.GetTempPath(), "AshkeGhalam-Backup-Retention-Test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var origin = DateTime.UtcNow.AddDays(-3);
            for (var i = 0; i < 5; i++)
            {
                var path = Path.Combine(directory, $"AshkeGhalam-AutoBackup-1405-02-{i + 1:00}-120000.ashkbackup");
                File.WriteAllText(path, "test fixture");
                File.SetLastWriteTimeUtc(path, origin.AddHours(i));
            }
            var unrelated = Path.Combine(directory, "notes.txt");
            File.WriteAllText(unrelated, "preserve");

            var removed = AutomaticBackupService.PruneOldAutomaticBackups(directory, 2);

            Assert.AreEqual(3, removed);
            Assert.AreEqual(2, Directory.GetFiles(directory, "AshkeGhalam-AutoBackup-*.ashkbackup").Length);
            Assert.IsTrue(File.Exists(unrelated));
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }
}
