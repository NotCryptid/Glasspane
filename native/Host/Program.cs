using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace Glasspane.Host;

public static class Launch
{
    public static string Script = "";
    public static string[] Args = Array.Empty<string>();
}

public static class Program
{
    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    [STAThread]
    public static void Main(string[] args)
    {
        // Windows 11 24H2 is build 26100. The manifest cannot express a build number, so check here.
        if (Environment.OSVersion.Version.Build < 26100)
        {
            MessageBoxW(IntPtr.Zero, "This app needs Windows 11 24H2 (build 26100) or newer.", "Unsupported Windows version", 0x10);
            Environment.Exit(1);
        }
        if (args.Length == 0)
        {
            // Packaged app: `glasspane pack` writes glasspane.json next to the exe.
            var cfg = Path.Combine(AppContext.BaseDirectory, "glasspane.json");
            var main = File.Exists(cfg)
                ? System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(cfg))?["main"]?.GetValue<string>()
                : null;
            if (main == null)
            {
                Console.Error.WriteLine("usage: Glasspane <script.js> [args...]");
                Environment.Exit(2);
            }
            Launch.Script = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, main));
            Launch.Args = Array.Empty<string>();
        }
        else
        {
            Launch.Script = Path.GetFullPath(args[0]);
            Launch.Args = args.Skip(1).ToArray();
        }
        WinRT.ComWrappersSupport.InitializeComWrappers();
        Application.Start(_ =>
        {
            var ctx = new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(ctx);
            new HostApp();
        });
    }
}
