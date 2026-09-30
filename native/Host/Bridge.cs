using System.Text.Json.Nodes;
using Microsoft.JavaScript.NodeApi;
using Microsoft.JavaScript.NodeApi.Runtime;
using Microsoft.UI.Dispatching;

namespace Glasspane.Host;

/// <summary>
/// Runs Node.js inside this process (libnode on its own thread) and passes JSON strings between
/// the JS runtime and the UI thread in memory. No pipes, no child process.
/// </summary>
public static class Bridge
{
    static NodeEmbeddingPlatform? _platform;
    static NodeEmbeddingThreadRuntime? _runtime;
    static JSReference? _bridgeRef;


    public static void Log(string text)
    {
        try { Console.Error.WriteLine(text); } catch { }
    }

    /// <summary>Starts Node and runs <paramref name="script"/>. Messages from JS are marshalled onto the UI thread.</summary>
    public static void Start(DispatcherQueue ui, string script, string[] scriptArgs, Action<JsonObject> onMessage)
    {
        var libnode = Path.Combine(AppContext.BaseDirectory, "libnode.dll");
        _platform = new NodeEmbeddingPlatform(new NodeEmbeddingPlatformSettings
        {
            LibNodePath = libnode,
            Args = new[] { "node" },
        });
        var dir = Path.GetDirectoryName(script)!;
        _runtime = _platform.CreateThreadRuntime(dir, new NodeEmbeddingRuntimeSettings
        {
            // `require` is not defined for embedded main scripts; give user code a normal one.
            MainScript = "globalThis.require = require('module').createRequire(process.cwd() + '/');",
        });
        _runtime.Run(() =>
        {
            var bridge = JSValue.CreateObject();
            bridge["send"] = JSValue.CreateFunction("send", args =>
            {
                JsonObject? msg = null;
                try { msg = JsonNode.Parse((string)args[0]) as JsonObject; }
                catch (Exception e) { Log("bad message: " + e.Message); }
                if (msg != null)
                    ui.TryEnqueue(() =>
                    {
                        try { onMessage(msg); }
                        catch (Exception e) { Log("handler error: " + e); }
                    });
                return JSValue.Undefined;
            });
            var global = JSValue.Global;
            global["__glasspane"] = bridge;
            _bridgeRef = new JSReference(bridge);

            var argv = new JSArray();
            foreach (var a in new[] { "node", script }.Concat(scriptArgs)) argv.Add(a);
            var proc = global["process"];
            proc["argv"] = argv;
        });
        _runtime.Post(() =>
        {
            try
            {
                ((JSFunction)JSValue.Global["require"]).Call(JSValue.Undefined, script);
            }
            catch (Exception e)
            {
                Log(e.Message);
                Environment.Exit(1);
            }
        });
    }

    /// <summary>Delivers a message to the JS side (thread-safe).</summary>
    public static void Send(JsonObject msg)
    {
        var json = msg.ToJsonString();
        _runtime?.Post(() =>
        {
            var receive = _bridgeRef!.GetValue()["receive"];
            if (receive.IsFunction()) ((JSFunction)receive).Call(JSValue.Undefined, json);
        });
    }
}
