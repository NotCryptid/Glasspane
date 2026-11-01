using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;
using Shapes = Microsoft.UI.Xaml.Shapes;

namespace Glasspane.Host;

sealed class ListKids(IList<object> l) : IKids
{
    public int Count => l.Count;
    public UIElement Get(int i) => (UIElement)l[i];
    public void Insert(int i, UIElement e) => l.Insert(i, e);
    public void RemoveAt(int i) => l.RemoveAt(i);
}

/// <summary>
/// Views that SwiftUI and WinUI both have: Label, Link, DatePicker, ColorPicker, SearchField, DisclosureGroup,
/// TabView, SplitView, Menu, Grid, shapes, and the popover, sheet and context menu that hang off any view.
/// </summary>
public sealed partial class Reconciler
{
    // ---------------------------------------------------------------- creation

    static UIElement? CreateShared(string? t, JsonNode? p)
    {
        switch (t)
        {
            case "Grid": return new Grid();
            case "Label": return new Border();
            case "Link": return new HyperlinkButton();
            case "DatePicker": return J.Str(p, "mode") == "time" ? new TimePicker() : new CalendarDatePicker();
            case "ColorPicker": return new ColorPicker { IsMoreButtonVisible = false };
            case "SearchField": return new AutoSuggestBox { QueryIcon = new SymbolIcon(Symbol.Find) };
            case "DisclosureGroup": return new Expander { HorizontalContentAlignment = HorizontalAlignment.Stretch };
            case "Tab": return new TabViewItem { IsClosable = false };
            case "TabView":
                return new TabView
                {
                    IsAddTabButtonVisible = false,
                    CanReorderTabs = false,
                    CanDragTabs = false,
                    TabWidthMode = TabViewWidthMode.SizeToContent,
                    CloseButtonOverlayMode = TabViewCloseButtonOverlayMode.Auto,
                };
            case "SplitView": return new SplitView { DisplayMode = SplitViewDisplayMode.Inline, IsPaneOpen = true };
            case "Menu": return new DropDownButton { Flyout = new MenuFlyout() };
            case "Rectangle": case "RoundedRectangle": case "Capsule": return new Shapes.Rectangle();
            case "Circle": case "Ellipse": return new Shapes.Ellipse();
        }
        return null;
    }

    static UIElement CreatePicker(JsonNode? p) => J.Str(p, "style") switch
    {
        "radio" => new RadioButtons(),
        "segmented" => new SelectorBar(),
        _ => new ComboBox(),
    };

    // ---------------------------------------------------------------- events

    void WireShared(UIElement el)
    {
        switch (el)
        {
            case CalendarDatePicker cdp:
                cdp.DateChanged += (_, e) => { if (e.NewDate is { } d) Fire(cdp, "change", DateToMs(cdp, d)); };
                break;
            case TimePicker tp:
                tp.TimeChanged += (_, e) => Fire(tp, "change", TimeToMs(tp, e.NewTime));
                break;
            case ColorPicker cp:
                cp.ColorChanged += (_, e) => Fire(cp, "change", Hex(e.NewColor));
                break;
            case AutoSuggestBox asb:
                asb.TextChanged += (s, e) => { if (e.Reason == AutoSuggestionBoxTextChangeReason.UserInput) Fire(asb, "change", s.Text); };
                asb.QuerySubmitted += (s, _) => Fire(asb, "submit", s.Text);
                break;
            case Expander ex:
                ex.Expanding += (_, _) => Fire(ex, "change", true);
                ex.Collapsed += (_, _) => Fire(ex, "change", false);
                break;
            case TabView tv:
                tv.SelectionChanged += (_, _) => { if (tv.SelectedIndex >= 0) Fire(tv, "change", tv.SelectedIndex); };
                break;
            case RadioButtons rb:
                rb.SelectionChanged += (_, _) => { if (rb.SelectedIndex >= 0) Fire(rb, "change", rb.SelectedIndex); };
                break;
            case SelectorBar sb:
                sb.SelectionChanged += (s, _) =>
                {
                    var i = s.Items.IndexOf(s.SelectedItem);
                    if (i >= 0) Fire(sb, "change", i);
                };
                break;
        }
    }

    static string Hex(Windows.UI.Color c) =>
        c.A == 255 ? $"#{c.R:X2}{c.G:X2}{c.B:X2}" : $"#{c.A:X2}{c.R:X2}{c.G:X2}{c.B:X2}";

    // A date picked in the UI keeps the time of day the bound value already had, and the other way round.
    DateTimeOffset Previous(UIElement el) =>
        DateTimeOffset.FromUnixTimeMilliseconds((long)(J.Num(M(el).Props, "value") ?? DateTimeOffset.Now.ToUnixTimeMilliseconds())).ToLocalTime();

    long DateToMs(UIElement el, DateTimeOffset picked)
    {
        var prev = Previous(el);
        var local = new DateTime(picked.Year, picked.Month, picked.Day, prev.Hour, prev.Minute, prev.Second, prev.Millisecond, DateTimeKind.Local);
        return new DateTimeOffset(local).ToUnixTimeMilliseconds();
    }

    long TimeToMs(UIElement el, TimeSpan time)
    {
        var prev = Previous(el);
        var local = new DateTime(prev.Year, prev.Month, prev.Day, time.Hours, time.Minutes, 0, DateTimeKind.Local);
        return new DateTimeOffset(local).ToUnixTimeMilliseconds();
    }

    // ---------------------------------------------------------------- props

    /// <summary>Returns the element text styling applies to, or null when the view is not one of ours.</summary>
    DependencyObject? ApplySharedProps(UIElement el, string t, JsonObject p, Meta m)
    {
        switch (t)
        {
            case "Label":
            {
                var border = (Border)el;
                if (border.Child is not StackPanel row)
                {
                    row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
                    row.Children.Add(new TextBlock { VerticalAlignment = VerticalAlignment.Center, TextWrapping = TextWrapping.Wrap });
                    border.Child = row;
                }
                var tb = (TextBlock)row.Children[^1];
                tb.Text = J.Str(p, "text") ?? "";
                var current = row.Children.Count == 2 ? row.Children[0] as FontIcon : null;
                var next = UpdateIcon(current, J.Str(p, "icon"), J.Num(p, "fontSize") ?? 14, Theme.BrushFrom(p["foreground"], forText: true));
                if (next == null && current != null) row.Children.RemoveAt(0);
                else if (next != null && current == null) row.Children.Insert(0, next);
                return tb;
            }
            case "Link":
            {
                var h = (HyperlinkButton)el;
                h.Content = J.Str(p, "text");
                var url = J.Str(p, "url");
                h.NavigateUri = url != null && Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri : null;
                return el;
            }
            case "DatePicker":
            {
                var header = J.Str(p, "label");
                if (el is CalendarDatePicker cdp)
                {
                    cdp.Header = header;
                    if (J.Num(p, "min") is { } lo) cdp.MinDate = DateTimeOffset.FromUnixTimeMilliseconds((long)lo).ToLocalTime();
                    if (J.Num(p, "max") is { } hi) cdp.MaxDate = DateTimeOffset.FromUnixTimeMilliseconds((long)hi).ToLocalTime();
                }
                else if (el is TimePicker tp) tp.Header = header;
                return el;
            }
            case "ColorPicker":
                ((ColorPicker)el).IsAlphaEnabled = J.Bool(p, "alpha") ?? false;
                return el;
            case "SearchField":
            {
                var a = (AutoSuggestBox)el;
                a.PlaceholderText = J.Str(p, "placeholder") ?? "Search";
                return el;
            }
            case "DisclosureGroup":
                ((Expander)el).Header = J.Str(p, "label");
                return el;
            case "Tab":
            {
                var ti = (TabViewItem)el;
                ti.Header = J.Str(p, "text");
                var glyph = ResolveGlyph(J.Str(p, "icon"));
                ti.IconSource = glyph == null ? null : new FontIconSource { Glyph = glyph };
                return el;
            }
            case "SplitView":
                ((SplitView)el).OpenPaneLength = J.Num(p, "sidebarWidth") ?? 240;
                return el;
            case "Menu":
                ApplyButton((DropDownButton)el, p, m);
                return el;
            case "Rectangle": case "RoundedRectangle": case "Capsule": case "Circle": case "Ellipse":
                ApplyShape((Shapes.Shape)el, t, p, m);
                return el;
            case "Picker":
                ApplyPicker(el, p, m);
                return el;
        }
        return null;
    }

    void ApplyPicker(UIElement el, JsonObject p, Meta m)
    {
        var opts = p["options"] as JsonArray;
        var sig = opts?.ToJsonString() ?? "[]";
        var changed = sig != m.PickerSig;
        m.PickerSig = sig;
        var labels = opts?.Select(o => o?.GetValue<string>() ?? "").ToList() ?? new List<string>();
        switch (el)
        {
            case ComboBox c:
                c.Header = J.Str(p, "label");
                c.PlaceholderText = J.Str(p, "placeholder") ?? "";
                if (changed) { c.Items.Clear(); foreach (var l in labels) c.Items.Add(l); }
                break;
            case RadioButtons rb:
                rb.Header = J.Str(p, "label");
                if (changed) { rb.Items.Clear(); foreach (var l in labels) rb.Items.Add(l); }
                break;
            case SelectorBar sb:
                if (changed) { sb.Items.Clear(); foreach (var l in labels) sb.Items.Add(new SelectorBarItem { Text = l }); }
                break;
        }
    }

    void ApplyShape(Shapes.Shape shape, string t, JsonObject p, Meta m)
    {
        shape.Stretch = Stretch.Fill;
        shape.Fill = Theme.BrushFrom(p["foreground"]) ?? Theme.Brush("primary", forText: true);
        if (p["stroke"] is JsonObject s)
        {
            shape.Stroke = Theme.Brush(J.Str(s, "color") ?? "primary", forText: true);
            shape.StrokeThickness = J.Num(s, "width") ?? 1;
        }
        else
        {
            shape.Stroke = null;
            shape.StrokeThickness = 0;
        }
        if (shape is Shapes.Rectangle rect)
        {
            if (t == "RoundedRectangle") rect.RadiusX = rect.RadiusY = J.Num(p, "radius") ?? 8;
            else if (t == "Capsule" && !m.WiredShapeSize)
            {
                m.WiredShapeSize = true;
                rect.SizeChanged += (_, e) => rect.RadiusX = rect.RadiusY = Math.Min(e.NewSize.Width, e.NewSize.Height) / 2;
            }
        }
    }

    static void ApplyTransforms(FrameworkElement fe, JsonObject p)
    {
        var any = J.Has(p, "offsetX") || J.Has(p, "offsetY") || J.Has(p, "rotation") || J.Has(p, "scaleX") || J.Has(p, "scaleY");
        if (!any)
        {
            if (fe.RenderTransform != null) fe.RenderTransform = null;
        }
        else
        {
            // Scale, rotate, then translate: the same order SwiftUI applies them in.
            fe.RenderTransformOrigin = new Point(0.5, 0.5);
            fe.RenderTransform = new CompositeTransform
            {
                ScaleX = J.Num(p, "scaleX") ?? 1,
                ScaleY = J.Num(p, "scaleY") ?? 1,
                Rotation = J.Num(p, "rotation") ?? 0,
                TranslateX = J.Num(p, "offsetX") ?? 0,
                TranslateY = J.Num(p, "offsetY") ?? 0,
            };
        }
        Canvas.SetZIndex(fe, (int)(J.Num(p, "zIndex") ?? 0));
        fe.IsHitTestVisible = J.Bool(p, "hitTesting") != false;
        var label = J.Str(p, "a11yLabel");
        if (label != null) AutomationProperties.SetName(fe, label);
        AutomationProperties.SetHelpText(fe, J.Str(p, "a11yHint") ?? "");
    }

    // ---------------------------------------------------------------- values

    void ApplySharedValue(UIElement el, string t, JsonObject p)
    {
        switch (el)
        {
            case CalendarDatePicker cdp when J.Num(p, "value") is { } v:
            {
                var d = DateTimeOffset.FromUnixTimeMilliseconds((long)v).ToLocalTime();
                if (cdp.Date?.Date != d.Date) cdp.Date = d;
                break;
            }
            case TimePicker tp when J.Num(p, "value") is { } v:
            {
                var d = DateTimeOffset.FromUnixTimeMilliseconds((long)v).ToLocalTime();
                var time = new TimeSpan(d.Hour, d.Minute, 0);
                if (tp.Time != time) tp.Time = time;
                break;
            }
            case ColorPicker cp when J.Str(p, "value") is { } s && Theme.ParseColor(s) is { } c && cp.Color != c:
                cp.Color = c;
                break;
            case AutoSuggestBox asb when J.Str(p, "text") is { } s && asb.Text != s:
                asb.Text = s;
                break;
            case Expander ex when t == "DisclosureGroup" && J.Bool(p, "expanded") is { } on && ex.IsExpanded != on:
                ex.IsExpanded = on;
                break;
            case RadioButtons rb when J.Num(p, "selected") is { } i && rb.SelectedIndex != (int)i:
                rb.SelectedIndex = (int)i;
                break;
            case SelectorBar sb when J.Num(p, "selected") is { } i && i >= 0 && i < sb.Items.Count && sb.SelectedItem != sb.Items[(int)i]:
                sb.SelectedItem = sb.Items[(int)i];
                break;
        }
    }

    // ---------------------------------------------------------------- children

    bool ApplySharedChildren(UIElement el, string t, JsonObject p, List<JsonObject> nodes, Meta m)
    {
        switch (el)
        {
            case Grid g when t == "Grid":
                LayoutGrid(g, p, nodes, ReconcileKids(new PanelKids(g.Children), nodes), m);
                return true;
            case TabView tv when t == "TabView":
            {
                ReconcileKids(new ListKids(tv.TabItems), nodes);
                if (!HoldInputs && J.Num(p, "selected") is { } i && i >= 0 && i < tv.TabItems.Count && tv.SelectedIndex != (int)i)
                    tv.SelectedIndex = (int)i;
                return true;
            }
            case TabViewItem ti when t == "Tab":
            {
                var next = nodes.Count > 0 ? Reconcile(ti.Content as UIElement, nodes[0]) : null;
                if (!ReferenceEquals(ti.Content, next)) ti.Content = next;
                return true;
            }
            case Expander ex when t == "DisclosureGroup":
            {
                var next = nodes.Count > 0 ? Reconcile(ex.Content as UIElement, nodes[0]) : null;
                if (!ReferenceEquals(ex.Content, next)) ex.Content = next;
                return true;
            }
            case SplitView sv when t == "SplitView":
            {
                var pane = nodes.Count > 0 ? Reconcile(sv.Pane, nodes[0]) : null;
                var content = nodes.Count > 1 ? Reconcile(sv.Content as UIElement, nodes[1]) : null;
                if (!ReferenceEquals(sv.Pane, pane)) sv.Pane = pane;
                if (!ReferenceEquals(sv.Content, content)) sv.Content = content;
                return true;
            }
            case DropDownButton dd when t == "Menu":
            {
                var sig = new JsonArray(nodes.Select(n => (JsonNode?)JsonNode.Parse(n.ToJsonString())).ToArray()).ToJsonString();
                if (sig != m.MenuSig && dd.Flyout is MenuFlyout mf)
                {
                    m.MenuSig = sig;
                    mf.Items.Clear();
                    BuildMenu(mf.Items, nodes);
                }
                return true;
            }
        }
        return false;
    }

    void LayoutGrid(Grid g, JsonObject p, List<JsonObject> nodes, List<UIElement> els, Meta m)
    {
        var counts = (p["rows"] as JsonArray)?.Select(n => (int)(n?.GetValue<double>() ?? 0)).ToList() ?? new List<int>();
        var cols = counts.Count == 0 ? 0 : counts.Max();
        var sig = string.Join(",", counts);
        if (sig != m.LayoutSig)
        {
            m.LayoutSig = sig;
            g.RowDefinitions.Clear();
            g.ColumnDefinitions.Clear();
            foreach (var _ in counts) g.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            for (int c = 0; c < cols; c++) g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        }
        g.ColumnSpacing = J.Num(p, "hSpacing") ?? 8;
        g.RowSpacing = J.Num(p, "vSpacing") ?? 8;

        int at = 0;
        for (int r = 0; r < counts.Count; r++)
            for (int c = 0; c < counts[r] && at < els.Count; c++, at++)
            {
                var fe = (FrameworkElement)els[at];
                var cp = nodes[at]["p"];
                Grid.SetRow(fe, r);
                Grid.SetColumn(fe, c);
                // A cell is centered in its slot, as in SwiftUI's Grid, unless it asks otherwise.
                if (!J.Has(cp, "hAlign")) fe.HorizontalAlignment = HorizontalAlignment.Center;
                if (!J.Has(cp, "vAlign")) fe.VerticalAlignment = VerticalAlignment.Center;
            }
    }

    // ---------------------------------------------------------------- menus

    void BuildMenu(IList<MenuFlyoutItemBase> into, IEnumerable<JsonObject> nodes)
    {
        foreach (var n in nodes)
        {
            var t = J.Str(n, "t");
            var p = n["p"] as JsonObject ?? new JsonObject();
            if (t == "Divider") { into.Add(new MenuFlyoutSeparator()); continue; }
            var text = J.Str(p, "text") ?? "";
            var glyph = ResolveGlyph(J.Str(p, "icon"));
            var enabled = J.Bool(p, "disabled") != true;

            if (t == "Menu")
            {
                var sub = new MenuFlyoutSubItem { Text = text, IsEnabled = enabled };
                if (glyph != null) sub.Icon = new FontIcon { Glyph = glyph };
                BuildMenu(sub.Items, (n["c"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>());
                into.Add(sub);
            }
            else if (t == "MenuItem")
            {
                MenuFlyoutItem item = J.Bool(p, "checked") is { } on
                    ? new ToggleMenuFlyoutItem { Text = text, IsChecked = on }
                    : new MenuFlyoutItem { Text = text };
                if (glyph != null) item.Icon = new FontIcon { Glyph = glyph };
                item.IsEnabled = enabled;
                var id = J.Str(n["e"], "click");
                if (id != null) item.Click += (_, _) => _emit(id, null);
                if (J.Str(p, "shortcut") is { } spec && AppMenu.Accelerator(spec) is { } ka) item.KeyboardAccelerators.Add(ka);
                into.Add(item);
            }
        }
    }

    // ---------------------------------------------------------------- context menu, popover, sheet

    void ApplyOverlays(UIElement el, JsonObject node, JsonObject p, Meta m)
    {
        var fe = (FrameworkElement)el;
        var o = node["o"] as JsonObject;

        if (o?["contextMenu"] is JsonArray cm)
        {
            var sig = cm.ToJsonString();
            if (sig != m.ContextSig)
            {
                m.ContextSig = sig;
                var flyout = new MenuFlyout();
                BuildMenu(flyout.Items, cm.OfType<JsonObject>());
                fe.ContextFlyout = flyout;
            }
        }
        else if (m.ContextSig != null)
        {
            m.ContextSig = null;
            fe.ContextFlyout = null;
        }

        if (o?["popover"] is JsonObject panel)
        {
            if (J.Bool(p, "popoverOpen") == true)
            {
                if (m.Popover == null)
                {
                    var flyout = new Flyout();
                    flyout.Closed += (_, _) =>
                    {
                        if (m.HostClosing) { m.HostClosing = false; return; }
                        Fire(fe, "popoverDismiss", false);
                    };
                    m.Popover = flyout;
                }
                m.Popover.Placement = J.Str(p, "popoverEdge") switch
                {
                    "top" => FlyoutPlacementMode.Top,
                    "leading" or "left" => FlyoutPlacementMode.Left,
                    "trailing" or "right" => FlyoutPlacementMode.Right,
                    _ => FlyoutPlacementMode.Bottom,
                };
                m.Popover.Content = Reconcile(m.Popover.Content, panel);
                if (!m.Popover.IsOpen && fe.XamlRoot != null) m.Popover.ShowAt(fe);
            }
            else if (m.Popover is { IsOpen: true } open)
            {
                m.HostClosing = true;
                open.Hide();
            }
        }

        if (o?["sheet"] is JsonObject sheet && J.Bool(p, "sheetOpen") == true)
        {
            if (m.Dialog == null && fe.XamlRoot != null)
            {
                var dlg = new ContentDialog { XamlRoot = fe.XamlRoot, Content = Reconcile(null, sheet) };
                m.Dialog = dlg;
                dlg.Closed += (_, _) =>
                {
                    if (!ReferenceEquals(m.Dialog, dlg)) return;
                    m.Dialog = null;
                    Fire(fe, "sheetDismiss", false);
                };
                try { _ = dlg.ShowAsync(); } catch { m.Dialog = null; }
            }
            else if (m.Dialog != null)
            {
                m.Dialog.Content = Reconcile(m.Dialog.Content as UIElement, sheet);
            }
        }
        else if (m.Dialog != null)
        {
            var d = m.Dialog;
            m.Dialog = null;
            d.Hide();
        }
    }
}
