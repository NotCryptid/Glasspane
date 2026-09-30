using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Glasspane.Host;

interface IKids
{
    int Count { get; }
    UIElement Get(int i);
    void Insert(int i, UIElement e);
    void RemoveAt(int i);
}

sealed class PanelKids(UIElementCollection c) : IKids
{
    public int Count => c.Count;
    public UIElement Get(int i) => c[i];
    public void Insert(int i, UIElement e) => c.Insert(i, e);
    public void RemoveAt(int i) => c.RemoveAt(i);
}

sealed class ItemsKids(ItemCollection c) : IKids
{
    public int Count => c.Count;
    public UIElement Get(int i) => (UIElement)c[i];
    public void Insert(int i, UIElement e) => c.Insert(i, e);
    public void RemoveAt(int i) => c.RemoveAt(i);
}

public sealed partial class Reconciler
{
    void ApplyChildren(UIElement el, string t, JsonObject p, JsonArray? c, Meta m)
    {
        var nodes = c?.Select(n => (JsonObject)n!).ToList() ?? new List<JsonObject>();
        switch (el)
        {
            case Grid g when t is "VStack" or "HStack" or "ZStack":
            {
                var els = ReconcileKids(new PanelKids(g.Children), nodes);
                LayoutStack(g, t, p, nodes, els, m);
                break;
            }
            case ListView lv:
                ReconcileKids(new ItemsKids(lv.Items), nodes);
                break;
            case ScrollViewer sv:
            {
                var next = nodes.Count > 0 ? Reconcile(sv.Content as UIElement, nodes[0]) : null;
                if (!ReferenceEquals(sv.Content, next)) sv.Content = next;
                break;
            }
            case Border b when t == "Card":
            {
                var next = nodes.Count > 0 ? Reconcile(b.Child, nodes[0]) : null;
                if (!ReferenceEquals(b.Child, next)) b.Child = next;
                break;
            }
            case Border nb when t == "Native":
            {
                var next = nodes.Count > 0 ? Reconcile(nb.Child, nodes[0]) : null;
                if (!ReferenceEquals(nb.Child, next)) nb.Child = next;
                break;
            }
            default:
                if (t == "Native") ApplyNativeChildren(el, nodes);
                break;
        }
    }

    List<UIElement> ReconcileKids(IKids kids, List<JsonObject> nodes)
    {
        var old = new List<UIElement>(kids.Count);
        for (int i = 0; i < kids.Count; i++) old.Add(kids.Get(i));

        var byKey = new Dictionary<(string, string), UIElement>();
        foreach (var e in old)
        {
            var om = M(e);
            if (om.Key != null) byKey[(om.Key, om.TypeKey)] = e;
        }

        var claimed = new HashSet<UIElement>();
        var result = new List<UIElement>(nodes.Count);
        for (int i = 0; i < nodes.Count; i++)
        {
            var n = nodes[i];
            var key = J.Str(n, "k");
            var tk = TypeKey(n);
            UIElement? cand = null;
            if (key != null) byKey.TryGetValue((key, tk), out cand);
            else if (i < old.Count && M(old[i]).Key == null) cand = old[i];
            if (cand != null && (claimed.Contains(cand) || M(cand).TypeKey != tk)) cand = null;
            var el = Reconcile(cand, n);
            claimed.Add(el);
            result.Add(el);
        }

        for (int j = kids.Count - 1; j >= 0; j--)
            if (!claimed.Contains(kids.Get(j))) kids.RemoveAt(j);

        for (int i = 0; i < result.Count; i++)
        {
            if (i < kids.Count && ReferenceEquals(kids.Get(i), result[i])) continue;
            for (int j = i + 1; j < kids.Count; j++)
                if (ReferenceEquals(kids.Get(j), result[i])) { kids.RemoveAt(j); break; }
            kids.Insert(i, result[i]);
        }
        return result;
    }

    void LayoutStack(Grid g, string t, JsonObject p, List<JsonObject> nodes, List<UIElement> els, Meta m)
    {
        if (t == "ZStack")
        {
            var za = J.Str(p, "alignment") ?? "center";
            for (int i = 0; i < els.Count; i++)
            {
                var fe = (FrameworkElement)els[i];
                var cp = nodes[i]["p"];
                Grid.SetRow(fe, 0);
                Grid.SetColumn(fe, 0);
                if (!J.Has(cp, "hAlign"))
                    fe.HorizontalAlignment = za.EndsWith("Leading") || za == "leading" ? HorizontalAlignment.Left
                        : za.EndsWith("Trailing") || za == "trailing" ? HorizontalAlignment.Right
                        : HorizontalAlignment.Center;
                if (!J.Has(cp, "vAlign"))
                    fe.VerticalAlignment = za.StartsWith("top") ? VerticalAlignment.Top
                        : za.StartsWith("bottom") ? VerticalAlignment.Bottom
                        : VerticalAlignment.Center;
            }
            return;
        }

        bool h = t == "HStack";
        double spacing = J.Num(p, "spacing") ?? 8;
        string cross = J.Str(p, "alignment") ?? "center";

        var flex = new double[els.Count];
        for (int i = 0; i < els.Count; i++)
        {
            var cp = nodes[i]["p"];
            var f = J.Num(cp, "flex");
            flex[i] = f ?? (J.Str(nodes[i], "t") == "Spacer" ? 1 : 0);
        }

        var sig = (h ? "H" : "V") + string.Join(",", flex);
        if (sig != m.LayoutSig)
        {
            m.LayoutSig = sig;
            g.RowDefinitions.Clear();
            g.ColumnDefinitions.Clear();
            foreach (var f in flex)
            {
                var len = f > 0 ? new GridLength(f, GridUnitType.Star) : GridLength.Auto;
                if (h) g.ColumnDefinitions.Add(new ColumnDefinition { Width = len });
                else g.RowDefinitions.Add(new RowDefinition { Height = len });
            }
        }
        g.RowSpacing = h ? 0 : spacing;
        g.ColumnSpacing = h ? spacing : 0;

        for (int i = 0; i < els.Count; i++)
        {
            var fe = (FrameworkElement)els[i];
            var cp = nodes[i]["p"];
            var ct = J.Str(nodes[i], "t");
            Grid.SetRow(fe, h ? 0 : i);
            Grid.SetColumn(fe, h ? i : 0);

            if (h)
            {
                if (!J.Has(cp, "vAlign")) fe.VerticalAlignment = ct == "Divider" ? VerticalAlignment.Stretch : VAlign(cross) ?? VerticalAlignment.Center;
                if (flex[i] > 0 && !J.Has(cp, "hAlign")) fe.HorizontalAlignment = HorizontalAlignment.Stretch;
                if (ct == "Divider") fe.Width = 1;
            }
            else
            {
                if (!J.Has(cp, "hAlign")) fe.HorizontalAlignment = ct == "Divider" ? HorizontalAlignment.Stretch : HAlign(cross) ?? HorizontalAlignment.Center;
                if (flex[i] > 0 && !J.Has(cp, "vAlign")) fe.VerticalAlignment = VerticalAlignment.Stretch;
                if (ct == "Divider") fe.Height = 1;
            }
        }
    }
}
