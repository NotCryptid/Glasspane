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

public sealed class HostApp : Application, IXamlMetadataProvider
{
    // A code-only app has no generated metadata provider; WinUI's control resources need one.
    readonly Microsoft.UI.Xaml.XamlTypeInfo.XamlControlsXamlMetaDataProvider _metadata = new();
    public IXamlType GetXamlType(Type type) => _metadata.GetXamlType(type);
    public IXamlType GetXamlType(string fullName) => _metadata.GetXamlType(fullName);
    public XmlnsDefinition[] GetXmlnsDefinitions() => _metadata.GetXmlnsDefinitions();

    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);

    readonly DispatcherQueue _ui = DispatcherQueue.GetForCurrentThread();
    readonly Reconciler _reconciler;
    Window? _window;
    Grid? _root;
    bool _shown;
    long _sent, _acked;
    string? _lastBackdrop, _lastSize, _lastIcon;

    public HostApp()
    {

        _reconciler = new Reconciler((id, value) =>
        {
            _sent++;
            var msg = new JsonObject { ["type"] = "event", ["id"] = id, ["seq"] = _sent };
            if (value != null) msg["value"] = value.DeepClone();
            Bridge.Send(msg);
        });

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
        _window = new Window();
        _root = (Grid)XamlReader.Load(
            "<Grid xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" " +
            "Background=\"Transparent\"/>");
        _window.Content = _root;
        _window.Closed += (_, _) =>
        {
            Bridge.Send(new JsonObject { ["type"] = "closed" });
            Environment.Exit(0);
        };
        Bridge.Start(_ui, Launch.Script, Launch.Args, Handle);
    }

    void Handle(JsonObject msg)
    {
        switch (J.Str(msg, "type"))
        {
            case "hello": Bridge.Send(new JsonObject { ["type"] = "ready" }); break;
            case "render": Render(msg); break;
            case "request": _ = HandleRequest(msg); break;
            case "quit": _window?.Close(); Environment.Exit(0); break;
        }
    }

    void Render(JsonObject msg)
    {
        _acked = (long)(J.Num(msg, "ack") ?? 0);
        _reconciler.HoldInputs = _acked < _sent;
        try
        {
            if (msg["window"] is JsonObject w) ApplyWindow(w);
            if (msg["root"] is JsonObject tree)
            {
                var next = _reconciler.Reconcile(_root!.Children.FirstOrDefault(), tree);
                if (!ReferenceEquals(_root.Children.FirstOrDefault(), next))
                {
                    _root.Children.Clear();
                    _root.Children.Add(next);
                }
            }
        }
        catch (Exception e)
        {
            Bridge.Log("render failed: " + e);
            Bridge.Send(new JsonObject { ["type"] = "error", ["message"] = e.Message });
        }
        if (!_shown) { _shown = true; _window!.Activate(); }
    }

    void ApplyWindow(JsonObject w)
    {
        var win = _window!;
        if (J.Str(w, "title") is { } title && win.Title != title) win.Title = title;

        var size = $"{J.Num(w, "width")}x{J.Num(w, "height")}";
        if (size != _lastSize && J.Num(w, "width") is { } width && J.Num(w, "height") is { } height)
        {
            _lastSize = size;
            var hwnd = WindowNative.GetWindowHandle(win);
            var scale = GetDpiForWindow(hwnd) / 96.0;
            var aw = win.AppWindow;
            aw.Resize(new Windows.Graphics.SizeInt32((int)(width * scale), (int)(height * scale)));
            if (!_shown)
            {
                var area = DisplayArea.GetFromWindowId(aw.Id, DisplayAreaFallback.Nearest).WorkArea;
                aw.Move(new Windows.Graphics.PointInt32(
                    area.X + (area.Width - (int)(width * scale)) / 2,
                    area.Y + (area.Height - (int)(height * scale)) / 2));
            }
        }

        var icon = J.Str(w, "icon");
        if (icon != _lastIcon)
        {
            _lastIcon = icon;
            try { if (icon != null) win.AppWindow.SetIcon(icon); }
            catch (Exception e) { Bridge.Log("icon failed: " + e.Message); }
        }

        _root!.RequestedTheme = J.Str(w, "theme") switch
        {
            "dark" => ElementTheme.Dark, "light" => ElementTheme.Light, _ => ElementTheme.Default,
        };

        var backdrop = J.Str(w, "backdrop") ?? "mica";
        if (backdrop != _lastBackdrop)
        {
            _lastBackdrop = backdrop;
            win.SystemBackdrop = backdrop switch
            {
                "mica" => new MicaBackdrop(),
                "micaAlt" => new MicaBackdrop { Kind = Microsoft.UI.Composition.SystemBackdrops.MicaKind.BaseAlt },
                "acrylic" => new DesktopAcrylicBackdrop(),
                _ => null,
            };
            _root!.Background = backdrop == "none"
                ? (Brush)XamlReader.Load("<SolidColorBrush xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" Color=\"{ThemeResource SolidBackgroundFillColorBase}\"/>")
                : null;
        }
    }

    async Task HandleRequest(JsonObject msg)
    {
        var id = msg["id"]?.DeepClone();
        var reply = new JsonObject { ["type"] = "response", ["id"] = id };
        try
        {
            reply["result"] = await Dialogs.Invoke(_window!, J.Str(msg, "method") ?? "", msg["args"] as JsonObject ?? new JsonObject());
        }
        catch (Exception e)
        {
            reply["error"] = e.Message;
        }
        Bridge.Send(reply);
    }
}
