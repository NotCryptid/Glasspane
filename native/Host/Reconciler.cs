using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.UI.Text;

namespace Glasspane.Host;

sealed class Meta
{
    public string TypeKey = "";
    public string? Key;
    public JsonObject? Props;
    public Dictionary<string, string> Events = new();
    public bool Updating;
    public string LayoutSig = "";
    public HashSet<string> WiredNative = new();
    public string? PickerSig;
}

/// <summary>
/// Turns the JSON view tree sent by Node into WinUI elements, reusing existing elements where
/// the type and key match so focus, scroll position and animations survive re-renders.
/// </summary>
public sealed partial class Reconciler
{
    static readonly ConditionalWeakTable<UIElement, Meta> Metas = new();
    readonly Action<string, JsonNode?> _emit;

    /// <summary>True while Node has not yet processed every event we sent. Input values are not overwritten then.</summary>
    public bool HoldInputs { get; set; }

    public Reconciler(Action<string, JsonNode?> emit) => _emit = emit;

    static Meta M(UIElement el) => Metas.GetOrCreateValue(el);

    static string TypeKey(JsonObject node)
    {
        var t = J.Str(node, "t") ?? "Text";
        var p = node["p"];
        return t switch
        {
            "Native" => "Native:" + J.Str(p, "type"),
            "ProgressView" => "ProgressView:" + (J.Str(p, "style") ?? "bar"),
            _ => t,
        };
    }

    // ---------------------------------------------------------------- reconcile

    public UIElement Reconcile(UIElement? existing, JsonObject node)
    {
        var tk = TypeKey(node);
        UIElement el = existing != null && M(existing).TypeKey == tk ? existing : Create(tk, node);
        var m = M(el);
        m.Key = J.Str(node, "k");
        m.Events = new();
        if (node["e"] is JsonObject ev)
            foreach (var (k, v) in ev)
                if (v is JsonValue jv && jv.TryGetValue<string>(out var id)) m.Events[k] = id;

        var t = J.Str(node, "t") ?? "Text";
        var p = node["p"] as JsonObject ?? new JsonObject();
        m.Updating = true;
        try
        {
            if (m.Props == null || !JsonNode.DeepEquals(m.Props, p)) ApplyProps(el, t, p, m);
            if (!HoldInputs) ApplyValue(el, t, p);
            ApplyChildren(el, t, p, node["c"] as JsonArray, m);
            m.Props = p;
        }
        finally { m.Updating = false; }
        WireNativeEvents(el, t, m);
        return el;
    }

    UIElement Create(string tk, JsonObject node)
    {
        UIElement el;
        var t = J.Str(node, "t");
        switch (t)
        {
            case "VStack": case "HStack": case "ZStack": el = new Grid(); break;
            case "Spacer": el = new Border(); break;
            case "Divider": el = new Border(); break;
            case "ScrollView": el = new ScrollViewer(); break;
            case "Card": el = new Border(); break;
            case "List": el = new ListView(); break;
            case "Text": el = new Border { Child = new TextBlock { TextWrapping = TextWrapping.Wrap } }; break;
            case "Button": el = new Button(); break;
            case "TextField": el = new TextBox(); break;
            case "TextEditor": el = new TextBox { AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 100 }; break;
            case "SecureField": el = new PasswordBox(); break;
            case "Toggle": el = new ToggleSwitch(); break;
            case "Checkbox": el = new CheckBox(); break;
            case "Slider": el = new Slider(); break;
            case "Picker": el = new ComboBox(); break;
            case "Stepper": el = new NumberBox { SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Inline }; break;
            case "ProgressView":
                el = J.Str(node["p"], "style") == "ring" ? new ProgressRing() : new ProgressBar { Maximum = 1 };
                break;
            case "Image": el = new Image(); break;
            case "Native": el = CreateNative(J.Str(node["p"], "type")); break;
            default: throw new InvalidOperationException("Unknown view type: " + t);
        }
        M(el).TypeKey = tk;
        Wire(el, t!);
        return el;
    }

    // ---------------------------------------------------------------- events

    void Fire(UIElement el, string evt, JsonNode? value)
    {
        var m = M(el);
        if (m.Updating) return;
        if (m.Events.TryGetValue(evt, out var id)) _emit(id, value);
    }

    void Wire(UIElement el, string t)
    {
        switch (el)
        {
            case Button b: b.Click += (_, _) => Fire(b, "click", null); break;
            case TextBox tb:
                tb.TextChanged += (_, _) => Fire(tb, "change", tb.Text);
                tb.KeyDown += (_, e) =>
                {
                    if (e.Key == Windows.System.VirtualKey.Enter && !tb.AcceptsReturn) Fire(tb, "submit", tb.Text);
                };
                break;
            case PasswordBox pb: pb.PasswordChanged += (_, _) => Fire(pb, "change", pb.Password); break;
            case ToggleSwitch ts: ts.Toggled += (_, _) => Fire(ts, "change", ts.IsOn); break;
            case CheckBox cb:
                cb.Checked += (_, _) => Fire(cb, "change", true);
                cb.Unchecked += (_, _) => Fire(cb, "change", false);
                break;
            case Slider s: s.ValueChanged += (_, e) => Fire(s, "change", e.NewValue); break;
            case ComboBox cmb:
                cmb.SelectionChanged += (_, _) => { if (cmb.SelectedIndex >= 0) Fire(cmb, "change", cmb.SelectedIndex); };
                break;
            case NumberBox nb:
                nb.ValueChanged += (_, e) => { if (!double.IsNaN(e.NewValue)) Fire(nb, "change", e.NewValue); };
                break;
            case ListView lv: lv.SelectionChanged += (_, _) => Fire(lv, "select", lv.SelectedIndex); break;
        }
        if (t is "VStack" or "HStack" or "ZStack" or "Card" or "Text" or "Image")
        {
            var fe = (FrameworkElement)el;
            fe.Tapped += (_, e) =>
            {
                if (M(el).Events.ContainsKey("tap")) { Fire(el, "tap", null); e.Handled = true; }
            };
        }
    }
}
