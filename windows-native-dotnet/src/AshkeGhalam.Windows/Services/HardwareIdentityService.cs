using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace AshkeGhalam.Windows.Services;

/// <summary>
/// Port of Electron's computeDesktopHardwareId() algorithm. No generic/fake identifier is
/// returned on failure, because a guessed HWID can bind a real license to the wrong device.
/// </summary>
public static class HardwareIdentityService
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MemoryStatusEx
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhysicalMemory;
        public ulong AvailablePhysicalMemory;
        public ulong TotalPageFile;
        public ulong AvailablePageFile;
        public ulong TotalVirtual;
        public ulong AvailableVirtual;
        public ulong AvailableExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);

    public static string GetHardwareId()
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("شناسه سخت‌افزاری لایسنس فقط برای نسخه بومی ویندوز تعریف شده است.");

        var cpuModel = GetCpuModel();
        var hostname = Environment.MachineName;
        const string platform = "win32";
        var arch = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.X86 => "x86",
            Architecture.Arm64 => "arm64",
            Architecture.Arm => "arm",
            _ => throw new InvalidOperationException("معماری پردازنده برای شناسه دستگاه پشتیبانی نمی‌شود.")
        };
        var totalMem = GetTotalMemoryGigabytes();
        var mac = GetFirstExternalMac();

        var raw = $"ASHK-DEVICE:{hostname}|{cpuModel}|{platform}|{arch}|{totalMem}GB|{mac}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
        return $"ASHK-HWID-{hash[..4]}-{hash.Substring(4, 4)}-{hash.Substring(8, 4)}-{hash.Substring(12, 4)}";
    }

    private static string GetCpuModel()
    {
        try
        {
            var value = Registry.GetValue(
                @"HKEY_LOCAL_MACHINE\HARDWARE\DESCRIPTION\System\CentralProcessor\0",
                "ProcessorNameString", null);
            var model = Convert.ToString(value)?.Trim();
            return string.IsNullOrWhiteSpace(model) ? "UNKNOWN_CPU" : model;
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException)
        {
            throw new InvalidOperationException("خواندن مشخصات پردازنده برای شناسه دستگاه ممکن نشد.", ex);
        }
    }

    private static long GetTotalMemoryGigabytes()
    {
        var status = new MemoryStatusEx { Length = (uint)Marshal.SizeOf<MemoryStatusEx>() };
        if (!GlobalMemoryStatusEx(ref status) || status.TotalPhysicalMemory == 0)
            throw new InvalidOperationException("خواندن مقدار حافظه فیزیکی دستگاه برای شناسه لایسنس ممکن نشد.");
        // Matches Node.js Math.round(os.totalmem() / (1024 ** 3)).
        return (long)Math.Floor(status.TotalPhysicalMemory / Math.Pow(1024d, 3d) + 0.5d);
    }

    private static string GetFirstExternalMac()
    {
        foreach (var network in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (network.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                continue;
            var bytes = network.GetPhysicalAddress().GetAddressBytes();
            if (bytes.Length == 0)
                continue;
            var mac = string.Join(":", bytes.Select(b => b.ToString("X2", System.Globalization.CultureInfo.InvariantCulture)));
            if (mac != "00:00:00:00:00:00")
                return mac;
        }
        // Electron's implementation permits an empty MAC if no external interface is found.
        return string.Empty;
    }
}
