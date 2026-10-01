using System.Globalization;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace Glasspane.Host;

/// <summary>Turns color strings from JS into brushes. Theme keywords stay live across light/dark changes.</summary>
static class Theme
{
    static readonly Dictionary<string, Brush> Cache = new();

    // keyword -> WinUI Color theme resource
    static readonly Dictionary<string, string> Keywords = new(StringComparer.OrdinalIgnoreCase)
    {
        ["accent"] = "SystemAccentColor",
        ["primary"] = "TextFillColorPrimary",
        ["secondary"] = "TextFillColorSecondary",
        ["tertiary"] = "TextFillColorTertiary",
        ["disabled"] = "TextFillColorDisabled",
        ["card"] = "CardBackgroundFillColorDefault",
        ["cardBorder"] = "CardStrokeColorDefault",
        ["surface"] = "LayerFillColorDefault",
        ["control"] = "ControlFillColorDefault",
        ["background"] = "SolidBackgroundFillColorBase",
        ["divider"] = "DividerStrokeColorDefault",
        ["danger"] = "SystemFillColorCritical",
        ["success"] = "SystemFillColorSuccess",
        ["warning"] = "SystemFillColorCaution",
    };

    static readonly Dictionary<string, Color> Named = new(StringComparer.OrdinalIgnoreCase)
    {
        ["red"] = Colors.Crimson, ["orange"] = Colors.Orange, ["yellow"] = Colors.Gold,
        ["green"] = Colors.SeaGreen, ["blue"] = Colors.DodgerBlue, ["purple"] = Colors.MediumPurple,
        ["pink"] = Colors.HotPink, ["teal"] = Colors.Teal, ["gray"] = Colors.Gray, ["grey"] = Colors.Gray,
        ["black"] = Colors.Black, ["white"] = Colors.White,
        ["clear"] = Colors.Transparent, ["transparent"] = Colors.Transparent,
    };

    /// <param name="forText">Text uses the accent variant that stays readable in both themes.</param>
    public static Brush? Brush(string? spec, bool forText = false)
    {
        if (string.IsNullOrWhiteSpace(spec)) return null;
        spec = spec.Trim();
        var cacheKey = forText ? spec + "|text" : spec;
        if (Cache.TryGetValue(cacheKey, out var cached)) return cached;
        Brush? b = null;
        if (Keywords.TryGetValue(spec, out var res))
        {
            // WinUI exposes AccentTextFillColorPrimary only as a brush (there is no
            // AccentTextFillColorPrimary color key), so the generic {ThemeResource <color>} path
            // below cannot reach it. Its definition is
            //     <SolidColorBrush x:Key="AccentTextFillColorPrimaryBrush"
            //                        Color="{ThemeResource SystemAccentColorLight3}" />   (Light)
            //                        Color="{ThemeResource SystemAccentColorDark2}" />    (Dark)
            // Reading that brush out of Application.Current.Resources materialises a copy against
            // the startup theme and freezes it. Binding to the color instead keeps the theme
            // reference inside the brush, so WinUI re-resolves it when the theme changes.
            if (forText && spec.Equals("accent", StringComparison.OrdinalIgnoreCase))
                res = "SystemAccentColorLight3";
            b = (Brush)XamlReader.Load(
                "<SolidColorBrush xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" " +
                $"Color=\"{{ThemeResource {res}}}\"/>");
        }
        else if (ParseColor(spec) is { } c) b = new SolidColorBrush(c);
        if (b != null) Cache[cacheKey] = b;
        return b;
    }

    public static Color? ParseColor(string spec)
    {
        if (Named.TryGetValue(spec, out var n)) return n;
        if (!spec.StartsWith('#')) return null;
        var h = spec[1..];
        if (h.Length is 3 or 4) h = string.Concat(h.Select(ch => new string(ch, 2)));
        if (!uint.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var v)) return null;
        if (h.Length == 6) return Windows.UI.Color.FromArgb(255, (byte)(v >> 16), (byte)(v >> 8), (byte)v);
        if (h.Length == 8) return Windows.UI.Color.FromArgb((byte)(v >> 24), (byte)(v >> 16), (byte)(v >> 8), (byte)v);
        return null;
    }

    public static T Resource<T>(string key) where T : class =>
        (T)Application.Current.Resources[key];
}
