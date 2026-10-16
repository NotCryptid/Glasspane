using System.Text.Json.Nodes;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.UI.Text;

namespace Glasspane.Host;

public sealed partial class Reconciler
{
    static void Set(DependencyObject d, DependencyProperty? dp, object? v)
    {
        if (dp == null) return;
        if (v == null) d.ClearValue(dp); else d.SetValue(dp, v);
    }

    static Thickness? Thick(JsonNode? n)
    {
        if (n is JsonValue v && v.TryGetValue<double>(out var d)) return new Thickness(d);
        if (n is JsonArray a && a.Count == 4)
            return new Thickness(a[0]!.GetValue<double>(), a[1]!.GetValue<double>(), a[2]!.GetValue<double>(), a[3]!.GetValue<double>());
        return null;
    }

    static HorizontalAlignment? HAlign(string? s) => s switch
    {
        "start" or "leading" => HorizontalAlignment.Left,
        "center" => HorizontalAlignment.Center,
        "end" or "trailing" => HorizontalAlignment.Right,
        "stretch" or "fill" => HorizontalAlignment.Stretch,
        _ => null,
    };

    static VerticalAlignment? VAlign(string? s) => s switch
    {
        "start" or "top" => VerticalAlignment.Top,
        "center" => VerticalAlignment.Center,
        "end" or "bottom" => VerticalAlignment.Bottom,
        "stretch" or "fill" => VerticalAlignment.Stretch,
        _ => null,
    };

    // Properties that live on different base classes depending on the element.
    static DependencyProperty? PaddingDp(object e) => e switch
    {
        Control => Control.PaddingProperty, Grid => Grid.PaddingProperty,
        Border => Border.PaddingProperty, TextBlock => TextBlock.PaddingProperty, _ => null,
    };
    static DependencyProperty? BackgroundDp(object e) => e switch
    {
        Control => Control.BackgroundProperty, Grid => Panel.BackgroundProperty,
        Border => Border.BackgroundProperty, _ => null,
    };
    static DependencyProperty? CornerDp(object e) => e switch
    {
        Control => Control.CornerRadiusProperty, Grid => Grid.CornerRadiusProperty,
        Border => Border.CornerRadiusProperty, _ => null,
    };
    static DependencyProperty? BorderBrushDp(object e) => e switch
    {
        Control => Control.BorderBrushProperty, Grid => Grid.BorderBrushProperty,
        Border => Border.BorderBrushProperty, _ => null,
    };
    static DependencyProperty? BorderThicknessDp(object e) => e switch
    {
        Control => Control.BorderThicknessProperty, Grid => Grid.BorderThicknessProperty,
        Border => Border.BorderThicknessProperty, _ => null,
    };

    // Extended Windows 11 Segoe Fluent Icons not present in the legacy WinUI Symbol enum.
    static readonly Dictionary<string, char> FluentGlyphs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Heart"] = '\uEB51',
        ["HeartFill"] = '\uEB52',
        ["Palette"] = '\uE790',
        ["Color"] = '\uE790',
        ["Moon"] = '\uE708',
        ["Sun"] = '\uE706',
        ["Sparkles"] = '\uE708',
        ["Lock"] = '\uE72E',
        ["Unlock"] = '\uE785',
        ["Bell"] = '\uEA8F',
        ["Info"] = '\uE946',
        ["Warning"] = '\uE7BA',
        ["Error"] = '\uEA39',
        ["ChevronLeft"] = '\uE76B',
        ["ChevronRight"] = '\uE76C',
        ["ChevronUp"] = '\uE70E',
        ["ChevronDown"] = '\uE70D',
        ["Checkmark"] = '\uE73E',
        ["Close"] = '\uE711',
        ["Search"] = '\uE721',
        ["Eye"] = '\uE7B3',
        ["EyeOff"] = '\uED1A',
        ["Sliders"] = '\uE713',
        ["Grid"] = '\uE80A',
        ["Sidebar"] = '\uE700',
        ["Code"] = '\uE943',
        ["Terminal"] = '\uE756',
        ["Bug"] = '\uEBE8',
        ["Wifi"] = '\uE701',
        ["Bluetooth"] = '\uE702',
        ["Battery"] = '\uE83F',
        ["Power"] = '\uE7E8',
        ["Shield"] = '\uEA18',
    };

    static string? ResolveGlyph(string? icon)
    {
        if (string.IsNullOrEmpty(icon)) return null;
        if (FluentGlyphs.TryGetValue(icon, out var ch)) return ch.ToString();
        if (Enum.TryParse<Symbol>(icon, true, out var sym)) return ((char)sym).ToString();
        if (icon.Length == 1) return icon;
        return null;
    }

    static FontIcon? UpdateIcon(FontIcon? existing, string? icon, double? fontSize = null, Brush? foreground = null)
    {
        var glyph = ResolveGlyph(icon);
        if (glyph == null) return null;
        var fi = existing ?? new FontIcon();
        if (fi.Glyph != glyph) fi.Glyph = glyph;
        var size = fontSize ?? 16;
        if (fi.FontSize != size) fi.FontSize = size;
        if (foreground != null) fi.Foreground = foreground;
        else fi.ClearValue(IconElement.ForegroundProperty);
        return fi;
    }

    // WinUI's CornerRadius clamps X and Y radii independently, turning large radii (like glass(100)
    // on a search pill) into an ellipse instead of a capsule. Clamping to half the smaller dimension
    // produces circular end-caps like SwiftUI and CSS.
    static void ApplyCornerRadius(FrameworkElement fe, double? cr)
    {
        var dp = CornerDp(fe);
        if (dp == null) return;
        if (cr == null)
        {
            if (fe.ReadLocalValue(dp) != DependencyProperty.UnsetValue) fe.ClearValue(dp);
            return;
        }
        var r = cr.Value;
        if (fe.ActualWidth > 0 && fe.ActualHeight > 0)
            r = Math.Min(r, Math.Min(fe.ActualWidth, fe.ActualHeight) / 2.0);
        var next = new CornerRadius(r);
        if (fe.GetValue(dp) is CornerRadius cur && cur == next) return;
        fe.SetValue(dp, next);
    }

    void ApplyProps(UIElement el, string t, JsonObject p, Meta m)
    {
        var fe = (FrameworkElement)el;
        ApplyCommon(fe, p, m);
        DependencyObject styleTarget = el;

        switch (t)
        {
            case "Text":
            {
                var tb = (TextBlock)((Border)el).Child;
                styleTarget = tb;
                tb.Text = J.Str(p, "text") ?? "";
                var lines = (int)(J.Num(p, "lineLimit") ?? 0);
                tb.MaxLines = lines;
                tb.TextTrimming = lines > 0 ? TextTrimming.CharacterEllipsis : TextTrimming.None;
                tb.TextWrapping = lines == 1 || J.Bool(p, "wrap") == false ? TextWrapping.NoWrap : TextWrapping.Wrap;
                tb.IsTextSelectionEnabled = J.Bool(p, "selectable") ?? false;
                tb.TextAlignment = J.Str(p, "textAlign") switch
                {
                    "center" => TextAlignment.Center,
                    "end" or "trailing" => TextAlignment.Right,
                    _ => TextAlignment.Left,
                };
                break;
            }
            case "Button":
                ApplyButton((Button)el, p);
                break;
            case "TextField": case "TextEditor":
            {
                var tb = (TextBox)el;
                tb.PlaceholderText = J.Str(p, "placeholder") ?? "";
                tb.Header = J.Str(p, "label");
                tb.IsReadOnly = J.Bool(p, "readOnly") ?? false;
                if (J.Str(p, "style") == "plain")
                {
                    var clear = new SolidColorBrush(Microsoft.UI.Colors.Transparent);
                    if (!J.Has(p, "background")) tb.Background = clear;
                    if (!J.Has(p, "border")) tb.BorderThickness = new Thickness(0);
                    if (!J.Has(p, "padding")) tb.Padding = new Thickness(0);
                    tb.MinHeight = 0;
                    tb.MinWidth = 0;
                    tb.VerticalAlignment = VerticalAlignment.Center;
                    tb.VerticalContentAlignment = VerticalAlignment.Center;
                    tb.Resources["TextControlBackground"] = clear;
                    tb.Resources["TextControlBackgroundPointerOver"] = clear;
                    tb.Resources["TextControlBackgroundFocused"] = clear;
                    tb.Resources["TextControlBorderBrush"] = clear;
                    tb.Resources["TextControlBorderBrushPointerOver"] = clear;
                    tb.Resources["TextControlBorderBrushFocused"] = clear;
                    tb.Resources["TextControlBorderThemeThickness"] = new Thickness(0);
                    tb.Resources["TextControlBorderThemeThicknessFocused"] = new Thickness(0);
                }
                break;
            }
            case "SecureField":
            {
                var pb = (PasswordBox)el;
                pb.PlaceholderText = J.Str(p, "placeholder") ?? "";
                pb.Header = J.Str(p, "label");
                break;
            }
            case "Toggle":
            {
                var ts = (ToggleSwitch)el;
                ts.OnContent = ts.OffContent = J.Str(p, "label");
                break;
            }
            case "Checkbox":
                ((CheckBox)el).Content = J.Str(p, "label");
                break;
            case "Slider":
            {
                var s = (Slider)el;
                s.Header = J.Str(p, "label");
                s.Minimum = J.Num(p, "min") ?? 0;
                s.Maximum = J.Num(p, "max") ?? 100;
                s.StepFrequency = J.Num(p, "step") ?? 1;
                break;
            }
            case "Picker":
            {
                var c = (ComboBox)el;
                c.Header = J.Str(p, "label");
                c.PlaceholderText = J.Str(p, "placeholder") ?? "";
                var opts = p["options"] as JsonArray;
                var sig = opts?.ToJsonString() ?? "[]";
                if (sig != m.PickerSig)
                {
                    m.PickerSig = sig;
                    c.Items.Clear();
                    if (opts != null) foreach (var o in opts) c.Items.Add(o?.GetValue<string>() ?? "");
                }
                break;
            }
            case "Stepper":
            {
                var n = (NumberBox)el;
                n.Header = J.Str(p, "label");
                n.Minimum = J.Num(p, "min") ?? double.MinValue;
                n.Maximum = J.Num(p, "max") ?? double.MaxValue;
                n.SmallChange = J.Num(p, "step") ?? 1;
                break;
            }
            case "ProgressView":
            {
                var v = J.Num(p, "value");
                if (el is ProgressBar pbar) { pbar.IsIndeterminate = v == null; if (v != null) pbar.Value = v.Value; }
                else if (el is ProgressRing ring) { ring.IsIndeterminate = v == null; if (v != null) ring.Value = v.Value * 100; ring.IsActive = true; }
                break;
            }
            case "Image":
                ApplyImage((Image)el, p);
                break;
            case "Icon":
            {
                var border = (Border)el;
                var icon = J.Str(p, "name");
                var fg = Theme.Brush(J.Str(p, "foreground"), forText: true);
                var nextIcon = UpdateIcon(border.Child as FontIcon, icon, J.Num(p, "fontSize"), fg);
                if (!ReferenceEquals(border.Child, nextIcon)) border.Child = nextIcon;
                break;
            }
            case "Divider":
            {
                var b = (Border)el;
                b.Background = Theme.Brush(J.Str(p, "color") ?? "divider");
                break;
            }
            case "ScrollView":
            {
                var sv = (ScrollViewer)el;
                var axis = J.Str(p, "axis") ?? "vertical";
                sv.VerticalScrollBarVisibility = axis is "vertical" or "both" ? ScrollBarVisibility.Auto : ScrollBarVisibility.Disabled;
                sv.HorizontalScrollBarVisibility = axis is "horizontal" or "both" ? ScrollBarVisibility.Auto : ScrollBarVisibility.Disabled;
                break;
            }
            case "Card":
            {
                var b = (Border)el;
                if (!J.Has(p, "padding")) b.Padding = new Thickness(16);
                if (!J.Has(p, "cornerRadius")) b.CornerRadius = new CornerRadius(8);
                if (!J.Has(p, "background")) b.Background = Theme.Brush("card");
                if (!J.Has(p, "border")) { b.BorderBrush = Theme.Brush("cardBorder"); b.BorderThickness = new Thickness(1); }
                break;
            }
            case "Native":
                ApplyNativeProps(el, p, m);
                break;
        }
        ApplyTextStyle(styleTarget, p);
    }

    void ApplyCommon(FrameworkElement fe, JsonObject p, Meta m)
    {
        Set(fe, FrameworkElement.WidthProperty, J.Num(p, "width"));
        Set(fe, FrameworkElement.HeightProperty, J.Num(p, "height"));
        Set(fe, FrameworkElement.MinWidthProperty, J.Num(p, "minWidth"));
        Set(fe, FrameworkElement.MinHeightProperty, J.Num(p, "minHeight"));
        Set(fe, FrameworkElement.MaxWidthProperty, J.Num(p, "maxWidth"));
        Set(fe, FrameworkElement.MaxHeightProperty, J.Num(p, "maxHeight"));
        Set(fe, FrameworkElement.MarginProperty, Thick(p["margin"]));
        Set(fe, FrameworkElement.HorizontalAlignmentProperty, HAlign(J.Str(p, "hAlign")));
        Set(fe, FrameworkElement.VerticalAlignmentProperty, VAlign(J.Str(p, "vAlign")));
        Set(fe, UIElement.OpacityProperty, J.Num(p, "opacity"));
        Set(fe, UIElement.VisibilityProperty, J.Bool(p, "hidden") == true ? Visibility.Collapsed : null);
        if (fe is Control) Set(fe, Control.IsEnabledProperty, J.Bool(p, "disabled") == true ? false : null);
        ToolTipService.SetToolTip(fe, J.Str(p, "tooltip"));

        Set(fe, PaddingDp(fe), Thick(p["padding"]));
        // `glass` is a translucent surface with a hairline edge here; macOS draws Liquid Glass.
        var glass = J.Num(p, "glass");
        var bg = Theme.Brush(J.Str(p, "background")) ?? (glass != null ? Theme.Glass() : (m.Events.ContainsKey("tap") ? new SolidColorBrush(Microsoft.UI.Colors.Transparent) : null));
        Set(fe, BackgroundDp(fe), bg);
        var cr = J.Num(p, "cornerRadius") ?? glass;
        m.CornerRadius = cr;
        ApplyCornerRadius(fe, cr);
        if (cr > 20 && !m.WiredSize)
        {
            m.WiredSize = true;
            fe.SizeChanged += (s, _) =>
            {
                var elem = (FrameworkElement)s;
                ApplyCornerRadius(elem, M(elem).CornerRadius);
            };
        }
        if (p["border"] is JsonObject b)
        {
            Set(fe, BorderBrushDp(fe), Theme.Brush(J.Str(b, "color") ?? "divider"));
            Set(fe, BorderThicknessDp(fe), new Thickness(J.Num(b, "width") ?? 1));
        }
        else if (glass != null)
        {
            Set(fe, BorderBrushDp(fe), Theme.Brush("cardBorder"));
            Set(fe, BorderThicknessDp(fe), new Thickness(1));
        }
        else
        {
            Set(fe, BorderBrushDp(fe), null);
            Set(fe, BorderThicknessDp(fe), null);
        }
    }

    static readonly Dictionary<string, FontFamily> FontCache = new(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<Uri, BitmapImage> ImageCache = new();

    static FontFamily GetFontFamily(string name)
    {
        if (!FontCache.TryGetValue(name, out var ff))
        {
            ff = new FontFamily(name);
            FontCache[name] = ff;
        }
        return ff;
    }

    static void ApplyTextStyle(DependencyObject target, JsonObject p)
    {
        var brush = Theme.Brush(J.Str(p, "foreground"), forText: true);
        object? weight = J.Num(p, "fontWeight") is { } w ? new FontWeight { Weight = (ushort)w } : null;
        object? style = J.Bool(p, "italic") == true ? Windows.UI.Text.FontStyle.Italic : null;
        object? family = J.Str(p, "fontFamily") is { } f ? GetFontFamily(f) : null;
        var size = J.Num(p, "fontSize");
        switch (target)
        {
            case Control:
                Set(target, Control.FontSizeProperty, size);
                Set(target, Control.FontWeightProperty, weight);
                Set(target, Control.FontStyleProperty, style);
                Set(target, Control.FontFamilyProperty, family);
                Set(target, Control.ForegroundProperty, brush);
                break;
            case TextBlock:
                Set(target, TextBlock.FontSizeProperty, size);
                Set(target, TextBlock.FontWeightProperty, weight);
                Set(target, TextBlock.FontStyleProperty, style);
                Set(target, TextBlock.FontFamilyProperty, family);
                Set(target, TextBlock.ForegroundProperty, brush);
                break;
        }
    }

    static void ApplyButton(Button b, JsonObject p)
    {
        var text = J.Str(p, "text");
        var icon = J.Str(p, "icon");
        var fontSize = J.Num(p, "fontSize") ?? 14;
        var hasIcon = !string.IsNullOrEmpty(ResolveGlyph(icon));
        var hasText = !string.IsNullOrEmpty(text);

        if (hasIcon && hasText)
        {
            if (b.Content is StackPanel existingRow && existingRow.Children.Count == 2
                && existingRow.Children[0] is FontIcon existingFi && existingRow.Children[1] is TextBlock existingTb)
            {
                UpdateIcon(existingFi, icon, fontSize);
                if (existingTb.Text != text) existingTb.Text = text!;
            }
            else
            {
                var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
                row.Children.Add(UpdateIcon(null, icon, fontSize)!);
                row.Children.Add(new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Center });
                b.Content = row;
            }
        }
        else if (hasIcon)
        {
            b.Content = UpdateIcon(b.Content as FontIcon, icon, fontSize);
        }
        else
        {
            if (!Equals(b.Content, text)) b.Content = text;
        }

        // Icon buttons would otherwise be nameless to screen readers.
        Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(b,
            hasText ? text : J.Str(p, "tooltip") ?? icon ?? "");

        var accent = J.Str(p, "style") == "accent";
        var accentStyle = accent ? (Style)Application.Current.Resources["AccentButtonStyle"] : null;
        if (accent && !ReferenceEquals(b.Style, accentStyle)) b.Style = accentStyle;
        else if (!accent && b.ReadLocalValue(FrameworkElement.StyleProperty) != DependencyProperty.UnsetValue)
            b.ClearValue(FrameworkElement.StyleProperty);
    }

    static void ApplyImage(Image img, JsonObject p)
    {
        var src = J.Str(p, "source");
        if (src == null) img.Source = null;
        else if (Uri.TryCreate(src, UriKind.Absolute, out var uri))
        {
            if (!ImageCache.TryGetValue(uri, out var bmp))
            {
                bmp = new BitmapImage(uri);
                ImageCache[uri] = bmp;
            }
            if (!ReferenceEquals(img.Source, bmp)) img.Source = bmp;
        }
        img.Stretch = J.Str(p, "fit") switch
        {
            "fill" => Stretch.Fill, "cover" => Stretch.UniformToFill, "none" => Stretch.None, _ => Stretch.Uniform,
        };
    }

    /// <summary>Controlled values are only written when they differ from what the control already shows.</summary>
    void ApplyValue(UIElement el, string t, JsonObject p)
    {
        switch (el)
        {
            case TextBox tb when J.Str(p, "text") is { } s && tb.Text != s:
                tb.Text = s; break;
            case PasswordBox pb when J.Str(p, "text") is { } s && pb.Password != s:
                pb.Password = s; break;
            case ToggleSwitch ts when J.Bool(p, "value") is { } v && ts.IsOn != v:
                ts.IsOn = v; break;
            case CheckBox cb when J.Bool(p, "value") is { } v && cb.IsChecked != v:
                cb.IsChecked = v; break;
            case Slider sl when J.Num(p, "value") is { } v && sl.Value != v:
                sl.Value = v; break;
            case ComboBox c when J.Num(p, "selected") is { } i && c.SelectedIndex != (int)i:
                c.SelectedIndex = (int)i; break;
            case NumberBox nb when J.Num(p, "value") is { } v && nb.Value != v:
                nb.Value = v; break;
            case ListView lv when J.Num(p, "selected") is { } i && lv.SelectedIndex != (int)i:
                lv.SelectedIndex = (int)i; break;
        }
    }
}
