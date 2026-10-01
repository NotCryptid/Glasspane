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
    [STAThread]
    public static void Main(string[] args)
    {
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
