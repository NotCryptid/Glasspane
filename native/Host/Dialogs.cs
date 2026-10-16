using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace Glasspane.Host;

/// <summary>Request/response calls from Node into Windows: dialogs, pickers, clipboard, launcher.</summary>
static class Dialogs
{
    // WinUI allows only one ContentDialog open per XamlRoot at a time; queue concurrent alerts per window.
    static readonly ConditionalWeakTable<Window, SemaphoreSlim> DialogLocks = new();

    static readonly HashSet<string> BlockedSchemes = new(StringComparer.OrdinalIgnoreCase)
    {
        "file", "javascript", "vbscript", "data",
    };

    public static async Task<JsonNode?> Invoke(Window window, string method, JsonObject a)
    {
        switch (method)
        {
            case "alert": return await Alert(window, a);
            case "openFile": return await OpenFile(window, a);
            case "saveFile": return await SaveFile(window, a);
            case "pickFolder": return await PickFolder(window);
            case "clipboardRead":
            {
                var view = Clipboard.GetContent();
                return view.Contains(StandardDataFormats.Text) ? await view.GetTextAsync() : null;
            }
            case "clipboardWrite":
            {
                var pkg = new DataPackage();
                pkg.SetText(J.Str(a, "text") ?? "");
                Clipboard.SetContent(pkg);
                Clipboard.Flush();
                return null;
            }
            case "launch":
            {
                var raw = J.Str(a, "uri");
                if (string.IsNullOrWhiteSpace(raw) || !Uri.TryCreate(raw, UriKind.Absolute, out var uri))
                    return false;
                if (BlockedSchemes.Contains(uri.Scheme)) return false;
                return await Windows.System.Launcher.LaunchUriAsync(uri);
            }
            default:
                throw new InvalidOperationException("Unknown request: " + method);
        }
    }

    static async Task<XamlRoot> EnsureXamlRoot(Window window)
    {
        if (window.Content is not FrameworkElement fe)
            throw new InvalidOperationException("Window has no content.");
        if (fe.XamlRoot != null) return fe.XamlRoot;
        var tcs = new TaskCompletionSource<XamlRoot>();
        RoutedEventHandler? handler = null;
        handler = (_, _) =>
        {
            fe.Loaded -= handler;
            if (fe.XamlRoot != null) tcs.TrySetResult(fe.XamlRoot);
        };
        fe.Loaded += handler;
        if (fe.XamlRoot != null)
        {
            fe.Loaded -= handler;
            return fe.XamlRoot;
        }
        return await tcs.Task;
    }

    static async Task<JsonNode?> Alert(Window window, JsonObject a)
    {
        var sem = DialogLocks.GetValue(window, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            var xamlRoot = await EnsureXamlRoot(window);
            var buttons = (a["buttons"] as JsonArray)?.Select(b => b?.GetValue<string>() ?? "OK").ToList() ?? new List<string> { "OK" };
            if (buttons.Count == 0) buttons.Add("OK");
            var dlg = new ContentDialog
            {
                Title = J.Str(a, "title"),
                Content = new TextBlock { Text = J.Str(a, "message") ?? "", TextWrapping = TextWrapping.Wrap },
                XamlRoot = xamlRoot,
            };
            switch (buttons.Count)
            {
                case 1: dlg.CloseButtonText = buttons[0]; break;
                case 2:
                    dlg.PrimaryButtonText = buttons[0]; dlg.CloseButtonText = buttons[1];
                    dlg.DefaultButton = ContentDialogButton.Primary; break;
                default:
                    dlg.PrimaryButtonText = buttons[0]; dlg.SecondaryButtonText = buttons[1]; dlg.CloseButtonText = buttons[2];
                    dlg.DefaultButton = ContentDialogButton.Primary; break;
            }
            var r = await dlg.ShowAsync();
            return r switch
            {
                ContentDialogResult.Primary => 0,
                ContentDialogResult.Secondary => 1,
                _ => Math.Min(buttons.Count, 3) - 1,
            };
        }
        finally
        {
            sem.Release();
        }
    }

    static List<string> Filters(JsonObject a, string fallback, bool allowWildcard)
    {
        var raw = (a["extensions"] as JsonArray)?.Select(e => e?.GetValue<string>()?.Trim() ?? "").Where(s => s.Length > 0).ToList();
        var list = new List<string>();
        if (raw != null)
        {
            foreach (var ext in raw)
            {
                if (ext == "*" || ext == "*.*")
                {
                    if (allowWildcard) list.Add("*");
                }
                else
                {
                    var clean = ext.StartsWith("*.") ? ext[1..] : ext.StartsWith('.') ? ext : "." + ext;
                    if (clean.Length > 1) list.Add(clean);
                }
            }
        }
        if (list.Count == 0) list.Add(fallback);
        return list;
    }

    static async Task<JsonNode?> OpenFile(Window window, JsonObject a)
    {
        var picker = new FileOpenPicker();
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(window));
        foreach (var f in Filters(a, "*", allowWildcard: true)) picker.FileTypeFilter.Add(f);
        if (J.Bool(a, "multiple") == true)
        {
            var files = await picker.PickMultipleFilesAsync();
            return new JsonArray(files.Select(f => (JsonNode)f.Path).ToArray());
        }
        var file = await picker.PickSingleFileAsync();
        return file?.Path;
    }

    static async Task<JsonNode?> SaveFile(Window window, JsonObject a)
    {
        var picker = new FileSavePicker();
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(window));
        picker.FileTypeChoices.Add(J.Str(a, "description") ?? "Files", Filters(a, ".txt", allowWildcard: false));
        if (J.Str(a, "name") is { } name) picker.SuggestedFileName = name;
        var file = await picker.PickSaveFileAsync();
        return file?.Path;
    }

    static async Task<JsonNode?> PickFolder(Window window)
    {
        var picker = new FolderPicker();
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(window));
        picker.FileTypeFilter.Add("*");
        var folder = await picker.PickSingleFolderAsync();
        return folder?.Path;
    }
}
