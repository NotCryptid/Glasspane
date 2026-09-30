using System.Linq.Expressions;
using System.Reflection;
using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace Glasspane.Host;

/// <summary>
/// Escape hatch: any WinUI control can be created by type name, have its properties set
/// by name and its events forwarded to Node, without the host knowing about it in advance.
/// </summary>
public sealed partial class Reconciler
{
    static Type ResolveType(string? name)
    {
        if (string.IsNullOrEmpty(name)) throw new InvalidOperationException("Native view needs a type name.");
        var candidates = name.Contains('.')
            ? new[] { name }
            : new[] { "Microsoft.UI.Xaml.Controls." + name, "Microsoft.UI.Xaml.Shapes." + name, "Microsoft.UI.Xaml.Controls.Primitives." + name };
        foreach (var c in candidates)
        {
            var t = Type.GetType(c + ", Microsoft.WinUI") ?? Type.GetType(c);
            if (t != null) return t;
        }
        throw new InvalidOperationException($"Unknown WinUI type '{name}'.");
    }

    static UIElement CreateNative(string? typeName)
    {
        var t = ResolveType(typeName);
        return (UIElement)(Activator.CreateInstance(t) ?? throw new InvalidOperationException("Cannot construct " + t));
    }

    void ApplyNativeProps(UIElement el, JsonObject p, Meta m)
    {
        if (p["props"] is not JsonObject props) return;
        var prev = m.Props?["props"] as JsonObject;
        var type = el.GetType();
        foreach (var (name, value) in props)
        {
            if (prev != null && prev.ContainsKey(name) && JsonNode.DeepEquals(prev[name], value)) continue;
            var pi = type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
            if (pi == null || !pi.CanWrite) throw new InvalidOperationException($"{type.Name} has no writable property '{name}'.");
            pi.SetValue(el, ConvertTo(value, pi.PropertyType));
        }
    }


    static object? ConvertTo(JsonNode? n, Type target)
    {
        if (n == null) return null;
        target = Nullable.GetUnderlyingType(target) ?? target;
        if (target == typeof(string)) return n is JsonValue sv && sv.TryGetValue<string>(out var s) ? s : n.ToJsonString();
        if (target == typeof(bool)) return n.GetValue<bool>();
        if (target == typeof(double)) return n.GetValue<double>();
        if (target == typeof(float)) return n.GetValue<float>();
        if (target == typeof(int)) return (int)n.GetValue<double>();
        if (target == typeof(long)) return (long)n.GetValue<double>();
        if (target.IsEnum) return n is JsonValue ev && ev.TryGetValue<string>(out var es)
            ? Enum.Parse(target, es, true) : Enum.ToObject(target, (int)n.GetValue<double>());
        if (target == typeof(Thickness)) return Thick(n) ?? default(Thickness);
        if (target == typeof(CornerRadius)) return new CornerRadius(n.GetValue<double>());
        if (target == typeof(GridLength)) return n is JsonValue gv && gv.TryGetValue<string>(out var gs) && gs == "auto"
            ? GridLength.Auto : new GridLength(n.GetValue<double>());
        if (target == typeof(Uri)) return new Uri(n.GetValue<string>());
        if (typeof(Brush).IsAssignableFrom(target)) return Theme.Brush(n.GetValue<string>());
        if (target == typeof(Windows.UI.Color)) return Theme.ParseColor(n.GetValue<string>()) ?? default(Windows.UI.Color);
        if (target == typeof(object))
            return n is JsonValue ov
                ? (ov.TryGetValue<string>(out var os) ? os : ov.TryGetValue<bool>(out var ob) ? ob : ov.GetValue<double>())
                : n.ToJsonString();
        throw new InvalidOperationException("Cannot convert JSON to " + target.Name);
    }

    void ApplyNativeChildren(UIElement el, List<JsonObject> nodes)
    {
        switch (el)
        {
            case Panel panel:
                ReconcileKids(new PanelKids(panel.Children), nodes);
                break;
            case ItemsControl items:
                ReconcileKids(new ItemsKids(items.Items), nodes);
                break;
            case ContentControl cc when nodes.Count > 0:
            {
                var next = Reconcile(cc.Content as UIElement, nodes[0]);
                if (!ReferenceEquals(cc.Content, next)) cc.Content = next;
                break;
            }
        }
    }

    void WireNativeEvents(UIElement el, string t, Meta m)
    {
        if (t != "Native") return;
        foreach (var name in m.Events.Keys)
        {
            if (!m.WiredNative.Add(name)) continue;
            var ev = el.GetType().GetEvent(name, BindingFlags.Public | BindingFlags.Instance)
                ?? throw new InvalidOperationException($"{el.GetType().Name} has no event '{name}'.");
            var invoke = ev.EventHandlerType!.GetMethod("Invoke")!;
            var ps = invoke.GetParameters().Select(x => Expression.Parameter(x.ParameterType, x.Name)).ToArray();
            var call = Expression.Call(Expression.Constant(this), typeof(Reconciler).GetMethod(nameof(NativeFire), BindingFlags.NonPublic | BindingFlags.Instance)!,
                Expression.Constant(el, typeof(UIElement)), Expression.Constant(name));
            ev.AddEventHandler(el, Expression.Lambda(ev.EventHandlerType, call, ps).Compile());
        }
    }

    static readonly string[] ValueProps = { "Text", "Password", "IsOn", "IsChecked", "Value", "SelectedIndex", "IsExpanded", "SelectedDate", "Date" };

    void NativeFire(UIElement el, string name)
    {
        JsonNode? payload = null;
        var type = el.GetType();
        foreach (var vp in ValueProps)
        {
            var pi = type.GetProperty(vp, BindingFlags.Public | BindingFlags.Instance);
            if (pi == null) continue;
            var v = pi.GetValue(el);
            payload = v switch
            {
                string s => s, bool b => b, double d => d, int i => i, null => null, _ => v.ToString(),
            };
            break;
        }
        Fire(el, name, payload);
    }
}
