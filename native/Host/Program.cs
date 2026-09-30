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
            Console.Error.WriteLine("usage: Glasspane <script.js> [args...]");
            Environment.Exit(2);
        }
        Launch.Script = Path.GetFullPath(args[0]);
        Launch.Args = args.Skip(1).ToArray();
        WinRT.ComWrappersSupport.InitializeComWrappers();
        Application.Start(_ =>
        {
            var ctx = new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(ctx);
            new HostApp();
        });
    }
}
