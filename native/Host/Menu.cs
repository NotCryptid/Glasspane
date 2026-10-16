using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.System;

namespace Glasspane.Host;

sealed class MenuItemMeta
{
    public string? ClickId;
    public string? Role;
    public string? Accel;
}

/// <summary>Builds and updates the window's MenuBar from the JSON that lib/menu.js produces.</summary>
static class AppMenu
{
    static readonly ConditionalWeakTable<MenuFlyoutItemBase, MenuItemMeta> Metas = new();

    /// <summary>
    /// Updates <paramref name="existing"/> in-place if the menu structure matches, or builds a new
    /// <see cref="MenuBar"/> only when menus/items are added or removed. Avoiding MenuBar teardown
    /// prevents WinUI 3 KeyboardAccelerator registration crashes under rapid state updates.
    /// </summary>
    public static MenuBar? Sync(MenuBar? existing, JsonArray menus, Action<string> emit, Action<string> role)
    {
        var validMenus = menus.OfType<JsonObject>()
            .Where(m => m["items"] is JsonArray kids && kids.Count > 0)
            .ToList();
        if (validMenus.Count == 0) return null;

        if (existing != null && CanSyncBar(existing, validMenus))
        {
            for (int i = 0; i < validMenus.Count; i++)
            {
                var m = validMenus[i];
                var top = existing.Items[i];
                var title = J.Str(m, "label") ?? "";
                if (top.Title != title) top.Title = title;
                var kids = ((JsonArray)m["items"]!).OfType<JsonObject>().ToList();
                SyncItems(top.Items, kids);
            }
            return existing;
        }

        var bar = new MenuBar { HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top };
        foreach (var m in validMenus)
        {
            var kids = ((JsonArray)m["items"]!).OfType<JsonObject>().ToList();
            var top = new MenuBarItem { Title = J.Str(m, "label") ?? "" };
            foreach (var k in kids) top.Items.Add(Item(k, emit, role));
            bar.Items.Add(top);
        }
        return bar;
    }

    static bool CanSyncBar(MenuBar bar, List<JsonObject> menus)
    {
        if (bar.Items.Count != menus.Count) return false;
        for (int i = 0; i < menus.Count; i++)
        {
            var kids = ((JsonArray)menus[i]["items"]!).OfType<JsonObject>().ToList();
            if (!CanSyncItems(bar.Items[i].Items, kids)) return false;
        }
        return true;
    }

    static bool CanSyncItems(IList<MenuFlyoutItemBase> existing, List<JsonObject> specs)
    {
        if (existing.Count != specs.Count) return false;
        for (int i = 0; i < specs.Count; i++)
        {
            var d = specs[i];
            var el = existing[i];
            if (J.Bool(d, "separator") == true)
            {
                if (el is not MenuFlyoutSeparator) return false;
                continue;
            }
            if (d["items"] is JsonArray subKids)
            {
                if (el is not MenuFlyoutSubItem sub) return false;
                if (!CanSyncItems(sub.Items, subKids.OfType<JsonObject>().ToList())) return false;
                continue;
            }
            bool isToggle = J.Bool(d, "checked") != null;
            if (isToggle != (el is ToggleMenuFlyoutItem)) return false;
            if (!isToggle && el is not MenuFlyoutItem) return false;
            var meta = Metas.GetOrCreateValue(el);
            if (meta.Accel != J.Str(d, "accel")) return false;
        }
        return true;
    }

    static void SyncItems(IList<MenuFlyoutItemBase> existing, List<JsonObject> specs)
    {
        for (int i = 0; i < specs.Count; i++)
        {
            var d = specs[i];
            var el = existing[i];
            if (el is MenuFlyoutSeparator) continue;
            var text = J.Str(d, "label") ?? "";
            if (el is MenuFlyoutSubItem sub && d["items"] is JsonArray subKids)
            {
                if (sub.Text != text) sub.Text = text;
                SyncItems(sub.Items, subKids.OfType<JsonObject>().ToList());
                continue;
            }
            if (el is MenuFlyoutItem item)
            {
                if (item.Text != text) item.Text = text;
                if (item is ToggleMenuFlyoutItem toggle && J.Bool(d, "checked") is { } on && toggle.IsChecked != on)
                    toggle.IsChecked = on;
                var meta = Metas.GetOrCreateValue(item);
                meta.Role = J.Str(d, "role");
                meta.ClickId = J.Str(d, "click");
                var enabled = J.Bool(d, "enabled") != false && (meta.Role != null || meta.ClickId != null);
                if (item.IsEnabled != enabled) item.IsEnabled = enabled;
            }
        }
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
        var meta = Metas.GetOrCreateValue(item);
        meta.Role = J.Str(d, "role");
        meta.ClickId = J.Str(d, "click");
        meta.Accel = J.Str(d, "accel");
        item.IsEnabled = J.Bool(d, "enabled") != false && (meta.Role != null || meta.ClickId != null);

        item.Click += (s, _) =>
        {
            var m = Metas.GetOrCreateValue((MenuFlyoutItemBase)s);
            if (m.Role != null) role(m.Role);
            else if (m.ClickId != null) emit(m.ClickId);
        };

        if (meta.Accel is { } accel && Accelerator(accel) is { } ka) item.KeyboardAccelerators.Add(ka);
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
