using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.System;

namespace Glasspane.Host;

/// <summary>Builds the window's MenuBar from the JSON that lib/menu.js produces.</summary>
static class AppMenu
{
    /// <param name="emit">Sends a click back to JS by handler id.</param>
    /// <param name="role">Runs a standard item (Copy, Minimize, ...).</param>
    public static MenuBar? Build(JsonArray menus, Action<string> emit, Action<string> role)
    {
        var bar = new MenuBar { HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top };
        foreach (var m in menus.OfType<JsonObject>())
        {
            if (m["items"] is not JsonArray kids || kids.Count == 0) continue;
            var top = new MenuBarItem { Title = J.Str(m, "label") ?? "" };
            foreach (var k in kids.OfType<JsonObject>()) top.Items.Add(Item(k, emit, role));
            bar.Items.Add(top);
        }
        return bar.Items.Count > 0 ? bar : null;
    }

    static MenuFlyoutItemBase Item(JsonObject d, Action<string> emit, Action<string> role)
    {
        if (J.Bool(d, "separator") == true) return new MenuFlyoutSeparator();
        var text = J.Str(d, "label") ?? "";

        if (d["items"] is JsonArray kids)
        {
            var sub = new MenuFlyoutSubItem { Text = text };
            foreach (var k in kids.OfType<JsonObject>()) sub.Items.Add(Item(k, emit, role));
            return sub;
        }

        MenuFlyoutItem item = J.Bool(d, "checked") is { } on
            ? new ToggleMenuFlyoutItem { Text = text, IsChecked = on }
            : new MenuFlyoutItem { Text = text };
        item.IsEnabled = J.Bool(d, "enabled") != false;

        if (J.Str(d, "role") is { } r) item.Click += (_, _) => role(r);
        else if (J.Str(d, "click") is { } id) item.Click += (_, _) => emit(id);
        else item.IsEnabled = false;

        if (J.Str(d, "accel") is { } accel && Accelerator(accel) is { } ka) item.KeyboardAccelerators.Add(ka);
        return item;
    }

    /// <summary>"CmdOrCtrl+Shift+N" and friends. Cmd means Ctrl on Windows.</summary>
    static KeyboardAccelerator? Accelerator(string spec)
    {
        var mods = VirtualKeyModifiers.None;
        string? key = null;
        foreach (var part in spec.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            switch (part.ToLowerInvariant())
            {
                case "cmd" or "command" or "meta" or "cmdorctrl" or "commandorcontrol" or "ctrl" or "control": mods |= VirtualKeyModifiers.Control; break;
                case "alt" or "option": mods |= VirtualKeyModifiers.Menu; break;
                case "shift": mods |= VirtualKeyModifiers.Shift; break;
                default: key = part; break;
            }
        }
        if (key == null || VirtualKeyFor(key) is not { } vk) return null;
        return new KeyboardAccelerator { Key = vk, Modifiers = mods };
    }

    static VirtualKey? VirtualKeyFor(string key)
    {
        if (key.Length == 1)
        {
            var c = char.ToUpperInvariant(key[0]);
            if (c is >= 'A' and <= 'Z') return VirtualKey.A + (c - 'A');
            if (c is >= '0' and <= '9') return VirtualKey.Number0 + (c - '0');
        }
        if (key.Length is 2 or 3 && (key[0] is 'F' or 'f') && int.TryParse(key.AsSpan(1), out var n) && n is >= 1 and <= 12)
            return VirtualKey.F1 + (n - 1);
        return key.ToLowerInvariant() switch
        {
            "backspace" => VirtualKey.Back, "delete" => VirtualKey.Delete, "enter" or "return" => VirtualKey.Enter,
            "esc" or "escape" => VirtualKey.Escape, "space" => VirtualKey.Space, "tab" => VirtualKey.Tab,
            "up" => VirtualKey.Up, "down" => VirtualKey.Down, "left" => VirtualKey.Left, "right" => VirtualKey.Right,
            _ => null,
        };
    }
}
