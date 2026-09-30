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
                return await Windows.System.Launcher.LaunchUriAsync(new Uri(J.Str(a, "uri")!));
            default:
                throw new InvalidOperationException("Unknown request: " + method);
        }
    }

    static async Task<JsonNode?> Alert(Window window, JsonObject a)
    {
        var buttons = (a["buttons"] as JsonArray)?.Select(b => b!.GetValue<string>()).ToList() ?? new List<string> { "OK" };
        if (buttons.Count == 0) buttons.Add("OK");
        var dlg = new ContentDialog
        {
            Title = J.Str(a, "title"),
            Content = new TextBlock { Text = J.Str(a, "message") ?? "", TextWrapping = TextWrapping.Wrap },
            XamlRoot = window.Content.XamlRoot,
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

    static List<string> Filters(JsonObject a, string fallback) =>
        (a["extensions"] as JsonArray)?.Select(e => e!.GetValue<string>()).ToList() is { Count: > 0 } l ? l : new() { fallback };

    static async Task<JsonNode?> OpenFile(Window window, JsonObject a)
    {
        var picker = new FileOpenPicker();
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(window));
        foreach (var f in Filters(a, "*")) picker.FileTypeFilter.Add(f);
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
        picker.FileTypeChoices.Add(J.Str(a, "description") ?? "Files", Filters(a, "."));
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
