using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Microsoft.UI.Dispatching;

namespace Glasspane.Host;

/// <summary>
/// Runs a stock Node.js executable as a child process and exchanges newline-delimited JSON with
/// it over stdin/stdout. Node stays a separate process, so any current release works and the
/// embedding API's version ceiling does not apply.
/// </summary>
public static class Bridge
{
    static Process? _node;
    static DispatcherQueue? _ui;
    static Action<JsonObject>? _onMessage;
    static readonly Channel<string> Outbound = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });

    public static void Log(string text)
    {
        try { Console.Error.WriteLine("[host] " + text); } catch { }
    }

    /// <summary>Starts Node with `script` and routes the messages it writes to `onMessage` on the UI thread.</summary>
    public static void Start(DispatcherQueue ui, string script, string[] scriptArgs, Action<JsonObject> onMessage)
    {
        var exe = NodePath();
        var psi = new ProcessStartInfo
        {
            FileName = exe,
            WorkingDirectory = Path.GetDirectoryName(script)!,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding = Encoding.UTF8,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        // Tells the app it was started by the host, so it does not relaunch itself.
        psi.Environment["GLASSPANE_HOSTED"] = "1";
        psi.ArgumentList.Add(script);
        foreach (var a in scriptArgs) psi.ArgumentList.Add(a);

        _ui = ui;
        _onMessage = onMessage;
        _node = Process.Start(psi) ?? throw new InvalidOperationException("Could not start Node: " + exe);

        _ = Task.Run(async () =>
        {
            try
            {
                var stdin = _node.StandardInput;
                await foreach (var line in Outbound.Reader.ReadAllAsync())
                {
                    if (_node.HasExited) break;
                    await stdin.WriteAsync(line);
                    if (!Outbound.Reader.TryPeek(out _)) await stdin.FlushAsync();
                }
            }
            catch (Exception e) { Log("send failed: " + e.Message); }
        });

        // stdout carries framed JSON only; anything a script prints must go to stderr so it cannot
        // corrupt the protocol. Console output is forwarded to the parent's stderr.
        _node.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) Dispatch(e.Data);
        };
        _node.ErrorDataReceived += (_, e) => { if (e.Data != null) try { Console.Error.WriteLine(e.Data); } catch { } };
        _node.BeginOutputReadLine();
        _node.BeginErrorReadLine();
        _node.EnableRaisingEvents = true;
        _node.Exited += (_, _) =>
        {
            Log("node exited");
            // The app called process.exit(), or the script threw at startup. Either way, stop.
            Environment.Exit(0);
        };
    }

    /// <summary>Finds a Node executable: GLASSPANE_NODE, then the host folder, then PATH.</summary>
    static string NodePath()
    {
        foreach (var candidate in new[]
        {
            Environment.GetEnvironmentVariable("GLASSPANE_NODE"),
            Path.Combine(AppContext.BaseDirectory, "node.exe"),
        })
        {
            if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate)) return candidate!;
        }
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in path.Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(dir)) continue;
            var exe = Path.Combine(dir.Trim(), "node.exe");
            if (File.Exists(exe)) return exe;
        }
        throw new FileNotFoundException(
            "Could not find node.exe. Install Node.js, or set GLASSPANE_NODE to its full path.");
    }

    static readonly object RenderLock = new();
    static readonly Dictionary<long, JsonObject> PendingRenders = new();

    static void Dispatch(string line)
    {
        JsonObject? msg;
        try { msg = JsonNode.Parse(line) as JsonObject; }
        catch (Exception e) { Log("bad message: " + e.Message); return; }
        var ui = _ui;
        if (msg == null || ui == null) return;

        if (J.Str(msg, "type") == "render")
        {
            var winId = (long)(J.Num(msg, "window") ?? 0);
            bool shouldEnqueue;
            lock (RenderLock)
            {
                shouldEnqueue = !PendingRenders.ContainsKey(winId);
                PendingRenders[winId] = msg;
            }
            if (!shouldEnqueue) return;
            ui.TryEnqueue(() =>
            {
                JsonObject? latest;
                lock (RenderLock)
                {
                    if (!PendingRenders.Remove(winId, out latest)) return;
                }
                try { _onMessage?.Invoke(latest); }
                catch (Exception e) { Log("handler error: " + e); }
            });
            return;
        }

        ui.TryEnqueue(() =>
        {
            try { _onMessage?.Invoke(msg); }
            catch (Exception e) { Log("handler error: " + e); }
        });
    }

    /// <summary>Delivers a message to the Node side without blocking the UI thread.</summary>
    public static void Send(JsonObject msg)
    {
        var node = _node;
        if (node == null || node.HasExited) return;
        Outbound.Writer.TryWrite(msg.ToJsonString() + "\n");
    }
}
