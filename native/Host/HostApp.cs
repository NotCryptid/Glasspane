using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using WinRT.Interop;

namespace Glasspane.Host;

/// <summary>One native window plus the reconciler that keeps its control tree in sync.</summary>
sealed class HostWindow
{
    public Window Window = null!;
    public Grid Root = null!;
    public Reconciler Reconciler = null!;
    public bool Shown;
    public long Sent, Acked;
    public string? LastBackdrop, LastSize, LastIcon;
}

public sealed class HostApp : Application, IXamlMetadataProvider
{
    // A code-only app has no generated metadata provider; WinUI's control resources need one.
    readonly Microsoft.UI.Xaml.XamlTypeInfo.XamlControlsXamlMetaDataProvider _metadata = new();
    public IXamlType GetXamlType(Type type) => _metadata.GetXamlType(type);
    public IXamlType GetXamlType(string fullName) => _metadata.GetXamlType(fullName);
    public XmlnsDefinition[] GetXmlnsDefinitions() => _metadata.GetXmlnsDefinitions();

    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);

    readonly DispatcherQueue _ui = DispatcherQueue.GetForCurrentThread();
    readonly Dictionary<long, HostWindow> _windows = new();

    public HostApp()
    {
        UnhandledException += (_, e) =>
        {
            Bridge.Log("unhandled: " + e.Exception);
            Bridge.Send(new JsonObject { ["type"] = "error", ["message"] = e.Exception.Message });
            e.Handled = true;
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        Resources.MergedDictionaries.Add(new XamlControlsResources());
        Bridge.Start(_ui, Launch.Script, Launch.Args, Handle);
    }

    static long Id(JsonObject msg) => (long)(J.Num(msg, "window") ?? 0);

    void Handle(JsonObject msg)
    {
        switch (J.Str(msg, "type"))
        {
            case "hello":
            {
                var id = Id(msg);
                if (!_windows.ContainsKey(id)) CreateWindow(id);
                Bridge.Send(new JsonObject { ["type"] = "ready", ["window"] = id });
                break;
            }
            case "render": Render(msg); break;
            case "request": _ = HandleRequest(msg); break;
            case "close": CloseWindow(Id(msg)); break;
            case "quit": Environment.Exit(0); break;
        }
    }

    void CreateWindow(long id)
    {
        var hw = new HostWindow();
        hw.Window = new Window();
        hw.Root = (Grid)XamlReader.Load(
            "<Grid xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" " +
            "Background=\"Transparent\"/>");
        hw.Window.Content = hw.Root;
        // Events are namespaced by window id in JS, but routing explicitly keeps the mapping explicit.
        hw.Reconciler = new Reconciler((handlerId, value) =>
        {
            hw.Sent++;
            var msg = new JsonObject { ["type"] = "event", ["window"] = id, ["id"] = handlerId, ["seq"] = hw.Sent };
            if (value != null) msg["value"] = value.DeepClone();
            Bridge.Send(msg);
        });
        hw.Window.Closed += (_, _) =>
        {
            _windows.Remove(id);
            Bridge.Send(new JsonObject { ["type"] = "closed", ["window"] = id });
            // Keep running while other windows are open; JS exits when the last one closes.
        };
        // The host owns focus, so `system.*` without a window follows the window the user is in.
        hw.Window.Activated += (_, e) =>
        {
            if (e.WindowActivationState != WindowActivationState.Deactivated)
                Bridge.Send(new JsonObject { ["type"] = "focus", ["window"] = id });
        };
        _windows[id] = hw;
    }

    void CloseWindow(long id)
    {
        if (_windows.Remove(id, out var hw)) hw.Window.Close();
    }

    void Render(JsonObject msg)
    {
        var id = Id(msg);
        if (!_windows.TryGetValue(id, out var hw)) { CreateWindow(id); hw = _windows[id]; }
        hw.Acked = (long)(J.Num(msg, "ack") ?? 0);
        hw.Reconciler.HoldInputs = hw.Acked < hw.Sent;
        try
        {
            if (msg["config"] is JsonObject w) ApplyWindow(hw, w);
            if (msg["root"] is JsonObject tree)
            {
                var next = hw.Reconciler.Reconcile(hw.Root.Children.FirstOrDefault(), tree);
                if (!ReferenceEquals(hw.Root.Children.FirstOrDefault(), next))
                {
                    hw.Root.Children.Clear();
                    hw.Root.Children.Add(next);
                }
            }
        }
        catch (Exception e)
        {
            Bridge.Log("render failed: " + e);
            Bridge.Send(new JsonObject { ["type"] = "error", ["window"] = id, ["message"] = e.Message });
        }
        if (!hw.Shown) { hw.Shown = true; hw.Window.Activate(); }
    }

    void ApplyWindow(HostWindow hw, JsonObject w)
    {
        var win = hw.Window;
        if (J.Str(w, "title") is { } title && win.Title != title) win.Title = title;

        var size = $"{J.Num(w, "width")}x{J.Num(w, "height")}";
        if (size != hw.LastSize && J.Num(w, "width") is { } width && J.Num(w, "height") is { } height)
        {
            hw.LastSize = size;
            var hwnd = WindowNative.GetWindowHandle(win);
            var scale = GetDpiForWindow(hwnd) / 96.0;
            var aw = win.AppWindow;
            aw.Resize(new Windows.Graphics.SizeInt32((int)(width * scale), (int)(height * scale)));
            if (!hw.Shown)
            {
                var area = DisplayArea.GetFromWindowId(aw.Id, DisplayAreaFallback.Nearest).WorkArea;
                aw.Move(new Windows.Graphics.PointInt32(
                    area.X + (area.Width - (int)(width * scale)) / 2,
                    area.Y + (area.Height - (int)(height * scale)) / 2));
            }
        }

        var icon = J.Str(w, "icon");
        if (icon != hw.LastIcon)
        {
            hw.LastIcon = icon;
            try { if (icon != null) win.AppWindow.SetIcon(icon); }
            catch (Exception e) { Bridge.Log("icon failed: " + e.Message); }
        }

        hw.Root.RequestedTheme = J.Str(w, "theme") switch
        {
            "dark" => ElementTheme.Dark, "light" => ElementTheme.Light, _ => ElementTheme.Default,
        };

        var backdrop = J.Str(w, "backdrop") ?? "mica";
        if (backdrop != hw.LastBackdrop)
        {
            hw.LastBackdrop = backdrop;
            win.SystemBackdrop = backdrop switch
            {
                "mica" => new MicaBackdrop(),
                "micaAlt" => new MicaBackdrop { Kind = Microsoft.UI.Composition.SystemBackdrops.MicaKind.BaseAlt },
                "acrylic" => new DesktopAcrylicBackdrop(),
                _ => null,
            };
            hw.Root.Background = backdrop == "none"
                ? (Brush)XamlReader.Load("<SolidColorBrush xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" Color=\"{ThemeResource SolidBackgroundFillColorBase}\"/>")
                : null;
        }
    }

    async Task HandleRequest(JsonObject msg)
    {
        var id = msg["id"]?.DeepClone();
        var window = Id(msg);
        var reply = new JsonObject { ["type"] = "response", ["window"] = window, ["id"] = id };
        try
        {
            // Dialogs and pickers must be parented to the window that asked for them.
            if (!_windows.TryGetValue(window, out var hw)) throw new InvalidOperationException("Unknown window.");
            reply["result"] = await Dialogs.Invoke(hw.Window, J.Str(msg, "method") ?? "", msg["args"] as JsonObject ?? new JsonObject());
        }
        catch (Exception e)
        {
            reply["error"] = e.Message;
        }
        Bridge.Send(reply);
    }
}
