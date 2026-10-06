import SwiftUI
import AppKit

// MARK: - Layout helpers

enum Fill { case none, width, both }

func hAlignment(_ s: String?) -> HorizontalAlignment {
    switch s {
    case "leading", "start": return .leading
    case "trailing", "end": return .trailing
    default: return .center
    }
}

func vAlignment(_ s: String?) -> VerticalAlignment {
    switch s {
    case "top", "start": return .top
    case "bottom", "end": return .bottom
    default: return .center
    }
}

func textAlignment(_ s: String?) -> TextAlignment {
    switch s {
    case "center": return .center
    case "end", "trailing": return .trailing
    default: return .leading
    }
}

func zAlignment(_ s: String?) -> Alignment {
    let a = s ?? "center"
    let h: HorizontalAlignment = a.hasSuffix("Leading") || a == "leading" ? .leading
        : a.hasSuffix("Trailing") || a == "trailing" ? .trailing : .center
    let v: VerticalAlignment = a.hasPrefix("top") ? .top : a.hasPrefix("bottom") ? .bottom : .center
    return Alignment(horizontal: h, vertical: v)
}

extension View {
    @ViewBuilder
    func ifLet<T, V: View>(_ value: T?, @ViewBuilder _ transform: (Self, T) -> V) -> some View {
        if let value = value { transform(self, value) } else { self }
    }
}

// MARK: - Fonts

func fontWeight(_ w: Double?) -> Font.Weight {
    guard let w = w else { return .regular }
    switch w {
    case ..<150: return .thin
    case ..<250: return .ultraLight
    case ..<350: return .light
    case ..<450: return .regular
    case ..<550: return .medium
    case ..<650: return .semibold
    case ..<750: return .bold
    case ..<850: return .heavy
    default: return .black
    }
}

/// The font the node's text props describe, or nil when it sets none.
func textFont(_ n: VNode) -> Font? {
    let size = n.num("fontSize"), weight = n.num("fontWeight"), family = n.str("fontFamily")
    if size == nil && weight == nil && family == nil && n.bool("italic") != true { return nil }
    let s = CGFloat(size ?? 13)
    let w = fontWeight(weight)
    var font: Font
    if let fam = family {
        let l = fam.lowercased()
        // Windows font names do not exist on the Mac; the mono ones map to the system mono font.
        if ["mono", "consolas", "courier", "menlo", "monaco"].contains(where: { l.contains($0) }) {
            font = .system(size: s, weight: w, design: .monospaced)
        } else {
            font = Font.custom(fam, size: s).weight(w)
        }
    } else {
        font = .system(size: s, weight: w)
    }
    if n.bool("italic") == true { font = font.italic() }
    return font
}

// MARK: - Shared modifiers

struct Common: ViewModifier {
    let n: VNode

    private var alignment: Alignment {
        return Alignment(horizontal: hAlignment(n.str("hAlign")), vertical: vAlignment(n.str("vAlign")))
    }

    func body(content: Content) -> some View {
        let stretchW = n.str("hAlign") != nil && n.str("hAlign") != "center"
        let stretchH = n.str("vAlign") != nil && n.str("vAlign") != "center"
        let maxW: CGFloat? = n.cg("maxWidth") ?? (stretchW ? CGFloat.infinity : nil)
        let maxH: CGFloat? = n.cg("maxHeight") ?? (stretchH ? CGFloat.infinity : nil)
        let flexible = maxW != nil || maxH != nil || n.has("minWidth") || n.has("minHeight")
        let border = n.props["border"] as? JSONDict

        return content
            .ifLet(textFont(n)) { $0.font($1) }
            .ifLet(Theme.color(n.str("foreground"))) { $0.foregroundColor($1) }
            .ifLet(n.insets("padding")) { $0.padding($1) }
            .frame(width: n.cg("width"), height: n.cg("height"))
            .ifLet(flexible ? true : nil) { v, _ in
                v.frame(minWidth: n.cg("minWidth"), maxWidth: maxW,
                        minHeight: n.cg("minHeight"), maxHeight: maxH, alignment: alignment)
            }
            .ifLet(n.cg("glass")) { $0.glassEffect(.regular, in: RoundedRectangle(cornerRadius: $1)) }
            .ifLet(Theme.color(n.str("background"))) { $0.background($1) }
            .ifLet(n.cg("cornerRadius")) { $0.clipShape(RoundedRectangle(cornerRadius: $1)) }
            .ifLet(border) { v, b in
                v.overlay(
                    RoundedRectangle(cornerRadius: n.cg("cornerRadius") ?? 0)
                        .stroke(Theme.color(b["color"] as? String ?? "divider") ?? Color.gray,
                                lineWidth: CGFloat(doubleValue(b["width"]) ?? 1))
                )
            }
            .ifLet(n.insets("margin")) { $0.padding($1) }
            .ifLet(n.num("opacity")) { $0.opacity($1) }
            .disabled(n.bool("disabled") == true)
            .ifLet(n.str("tooltip")) { $0.help($1) }
    }
}

extension View {
    func gp(_ n: VNode) -> some View { modifier(Common(n: n)) }
}

// MARK: - Backdrop

struct Backdrop: NSViewRepresentable {
    let kind: String

    func makeNSView(context: Context) -> NSVisualEffectView {
        let v = NSVisualEffectView()
        v.blendingMode = .behindWindow
        v.state = .active
        return v
    }

    func updateNSView(_ v: NSVisualEffectView, context: Context) {
        switch kind {
        case "micaAlt": v.material = .sidebar
        case "acrylic": v.material = .hudWindow
        default: v.material = .underWindowBackground
        }
    }
}

struct RootView: View {
    @ObservedObject var model: WindowModel

    var body: some View {
        ZStack {
            if model.backdrop == "none" {
                Color(nsColor: .windowBackgroundColor)
            } else {
                Backdrop(kind: model.backdrop)
            }
            if let root = model.root {
                NodeView(node: root, fill: .both)
            }
        }
        .environmentObject(model)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ifLet(model.fullSize ? true : nil) { v, _ in v.ignoresSafeArea() }
    }
}

// MARK: - Nodes

private struct Kid: Identifiable {
    let id: String
    let node: VNode
}

private let iconNames: [String: String] = [
    "add": "plus", "delete": "trash", "save": "square.and.arrow.down", "edit": "pencil",
    "cancel": "xmark", "clear": "xmark", "accept": "checkmark", "back": "chevron.left",
    "forward": "chevron.right", "up": "chevron.up", "down": "chevron.down", "refresh": "arrow.clockwise",
    "home": "house", "setting": "gearshape", "find": "magnifyingglass", "copy": "doc.on.doc",
    "folder": "folder", "share": "square.and.arrow.up", "mail": "envelope", "play": "play.fill",
    "pause": "pause.fill", "stop": "stop.fill", "help": "questionmark.circle",
    "download": "arrow.down.circle", "upload": "arrow.up.circle", "zoom": "plus.magnifyingglass",
]

/// Windows `Symbol` names map to the nearest SF Symbol; anything else is passed through as an SF Symbol name.
private func symbol(_ name: String) -> String { iconNames[name.lowercased()] ?? name }

private var imageCache: [URL: NSImage] = [:]

struct NodeView: View {
    let node: VNode
    var fill: Fill = .none
    @EnvironmentObject var model: WindowModel

    /// Views with built-in styling get their defaults here, so `Common` treats them like any other.
    private var eff: VNode {
        guard node.type == "Card" else { return node }
        return node.with(defaults: [
            "padding": 16.0, "cornerRadius": 8.0, "background": "card",
            "border": ["color": "cardBorder", "width": 1.0] as JSONDict,
        ])
    }

    var body: some View {
        if node.bool("hidden") == true {
            EmptyView()
        } else if node.type == "Spacer" {
            Spacer(minLength: node.cg("minHeight") ?? node.cg("minWidth"))
        } else {
            filled(tappable(content.gp(eff)))
        }
    }

    // ---- fill and tap

    private var fillAlignment: Alignment {
        switch node.type {
        case "VStack": return Alignment(horizontal: hAlignment(node.str("alignment")), vertical: .top)
        case "HStack": return Alignment(horizontal: .leading, vertical: vAlignment(node.str("alignment")))
        case "ZStack": return zAlignment(node.str("alignment"))
        default: return .topLeading
        }
    }

    /// WinUI stretches a lone child to its parent, which is how a root VStack spans the window.
    @ViewBuilder private func filled<C: View>(_ v: C) -> some View {
        if fill == .none {
            v
        } else {
            v.frame(maxWidth: .infinity, maxHeight: fill == .both ? CGFloat.infinity : nil, alignment: fillAlignment)
        }
    }

    @ViewBuilder private func tappable<C: View>(_ v: C) -> some View {
        if let id = node.events["tap"] {
            v.contentShape(Rectangle()).onTapGesture { model.emit(id) }
        } else {
            v
        }
    }

    // ---- children

    private var items: [Kid] {
        node.children.enumerated().map { i, c in Kid(id: c.key.map { "k:" + $0 } ?? "i:\(i)", node: c) }
    }

    /// `horizontal` is nil outside a stack. Inside one, a child with `flex` takes the leftover space.
    @ViewBuilder private func kids(horizontal: Bool?) -> some View {
        ForEach(items) { item in
            if let h = horizontal, (item.node.num("flex") ?? 0) > 0, item.node.type != "Spacer" {
                NodeView(node: item.node)
                    .frame(maxWidth: h ? CGFloat.infinity : nil, maxHeight: h ? nil : CGFloat.infinity)
            } else {
                NodeView(node: item.node)
            }
        }
    }

    // ---- bindings

    /// A value the user can change. It reads Node's last value, except while an edit is still in
    /// flight, and writes by emitting the control's event.
    private func binding<T>(_ prop: String, event: String = "change", _ fallback: T, _ cast: @escaping (Any) -> T?) -> Binding<T> {
        let handler = node.events[event]
        return Binding<T>(
            get: {
                if model.hold, let h = handler, let v = model.overrides[h], let t = cast(v) { return t }
                if let raw = node.props[prop], let t = cast(raw) { return t }
                return fallback
            },
            set: { value in
                guard let h = handler else { return }
                model.overrides[h] = value
                model.emit(h, value)
            }
        )
    }

    private func number(_ any: Any) -> Double? { doubleValue(any) }
    private func flag(_ any: Any) -> Bool? { (any as? NSNumber)?.boolValue }
    private func string(_ any: Any) -> String? { any as? String }
    private func integer(_ any: Any) -> Int? { intValue(any) }

    // ---- content

    @ViewBuilder private var content: some View {
        switch node.type {
        case "VStack":
            VStack(alignment: hAlignment(node.str("alignment")), spacing: node.cg("spacing") ?? 8) { kids(horizontal: false) }
        case "HStack":
            HStack(alignment: vAlignment(node.str("alignment")), spacing: node.cg("spacing") ?? 8) { kids(horizontal: true) }
        case "ZStack":
            ZStack(alignment: zAlignment(node.str("alignment"))) { kids(horizontal: nil) }
        case "ScrollView": scroll
        case "Card":
            if let c = node.children.first { NodeView(node: c, fill: .width) }
        case "List": list
        case "Text": text
        case "Button": button
        case "TextField": textInput(secure: false)
        case "SecureField": textInput(secure: true)
        case "TextEditor": textEditor
        case "Toggle": Toggle(node.str("label") ?? "", isOn: binding("value", false, flag)).toggleStyle(.switch)
        case "Checkbox": Toggle(node.str("label") ?? "", isOn: binding("value", false, flag)).toggleStyle(.checkbox)
        case "Slider": slider
        case "Stepper": stepper
        case "Picker": picker
        case "ProgressView": progress
        case "Image": image
        case "Icon": Image(systemName: symbol(node.str("name") ?? ""))
        case "Divider": Divider()
        case "Native": native
        default: EmptyView()
        }
    }

    @ViewBuilder private func labeled<C: View>(@ViewBuilder _ inner: () -> C) -> some View {
        if let l = node.str("label"), !l.isEmpty {
            VStack(alignment: .leading, spacing: 4) { Text(verbatim: l); inner() }
        } else {
            inner()
        }
    }

    // ---- containers

    private var scrollAxes: Axis.Set {
        switch node.str("axis") {
        case "horizontal": return .horizontal
        case "both": return [.horizontal, .vertical]
        default: return .vertical
        }
    }

    @ViewBuilder private var scroll: some View {
        ScrollView(scrollAxes) {
            if let c = node.children.first {
                NodeView(node: c, fill: scrollAxes == .vertical ? .width : .none)
            }
        }
    }

    @ViewBuilder private var list: some View {
        let selection = Binding<Int?>(
            get: {
                let h = node.events["select"]
                var i = Int(node.num("selected") ?? -1)
                if model.hold, let h = h, let v = model.overrides[h], let o = intValue(v) { i = o }
                return i >= 0 ? i : nil
            },
            set: { value in
                guard let h = node.events["select"] else { return }
                model.overrides[h] = value ?? -1
                model.emit(h, value ?? -1)
            }
        )
        List(selection: selection) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                NodeView(node: item.node).tag(index)
            }
        }
    }

    // ---- content views

    @ViewBuilder private var text: some View {
        let align = textAlignment(node.str("textAlign"))
        let limit: Int? = { let n = Int(node.num("lineLimit") ?? 0); return n > 0 ? n : nil }()
        let t = Text(verbatim: node.str("text") ?? "")
            .multilineTextAlignment(align)
            .lineLimit(limit)
            .fixedSize(horizontal: false, vertical: true)
        if node.bool("selectable") == true { t.textSelection(.enabled) } else { t }
    }

    @ViewBuilder private var button: some View {
        let action = { if let id = node.events["click"] { model.emit(id) } }
        let label = node.str("text") ?? ""
        let icon = node.str("icon").map(symbol)
        let b = Button(action: action) {
            if let icon = icon, !label.isEmpty { Label(label, systemImage: icon) }
            else if let icon = icon { Image(systemName: icon) }
            else { Text(verbatim: label) }
        }
        if node.str("style") == "accent" { b.buttonStyle(.borderedProminent) } else { b.buttonStyle(.bordered) }
    }

    @ViewBuilder private func textInput(secure: Bool) -> some View {
        let b = binding("text", "", string)
        let placeholder = node.str("placeholder") ?? ""
        let submit = { if let id = node.events["submit"] { model.emit(id, b.wrappedValue) } }
        labeled {
            if node.bool("readOnly") == true {
                Text(verbatim: b.wrappedValue)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(nsColor: .separatorColor)))
            } else if secure {
                SecureField(placeholder, text: b).textFieldStyle(.roundedBorder).onSubmit(submit)
            } else {
                if node.str("style") == "plain" {
                    TextField(placeholder, text: b).textFieldStyle(.plain).onSubmit(submit)
                } else {
                    TextField(placeholder, text: b).textFieldStyle(.roundedBorder).onSubmit(submit)
                }
            }
        }
    }

    @ViewBuilder private var textEditor: some View {
        labeled {
            TextEditor(text: binding("text", "", string))
                .font(.body)
                .frame(minHeight: 100)
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(nsColor: .separatorColor)))
        }
    }

    @ViewBuilder private var slider: some View {
        let lo = node.num("min") ?? 0
        let hi = max(node.num("max") ?? 100, lo + 0.000001)
        let step = node.num("step") ?? 1
        let raw = binding("value", lo, number)
        // A stepped Slider draws a tick per step on current macOS; snap the value instead.
        let value = Binding<Double>(get: { raw.wrappedValue }, set: { v in
            raw.wrappedValue = step > 0 ? min(hi, lo + ((v - lo) / step).rounded() * step) : v
        })
        labeled { Slider(value: value, in: lo...hi) }
    }

    @ViewBuilder private var stepper: some View {
        let lo = node.num("min") ?? -1e12
        let hi = max(node.num("max") ?? 1e12, lo)
        let value = binding("value", 0.0, number)
        let label = node.str("label").map { $0 + ": " } ?? ""
        Stepper(value: value, in: lo...hi, step: node.num("step") ?? 1) {
            Text(verbatim: label + String(format: "%g", value.wrappedValue))
        }
    }

    @ViewBuilder private var picker: some View {
        let options = node.props["options"] as? [String] ?? []
        let selection = binding("selected", -1, integer)
        labeled {
            Picker("", selection: selection) {
                if selection.wrappedValue < 0 || selection.wrappedValue >= options.count {
                    Text(verbatim: node.str("placeholder") ?? "").tag(selection.wrappedValue)
                }
                ForEach(Array(options.enumerated()), id: \.offset) { i, o in Text(verbatim: o).tag(i) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
        }
    }

    @ViewBuilder private var progress: some View {
        let ring = node.str("style") == "ring"
        if let v = node.num("value") {
            let p = min(max(v, 0), 1)
            if ring { ProgressView(value: p, total: 1).progressViewStyle(.circular) }
            else { ProgressView(value: p, total: 1).progressViewStyle(.linear) }
        } else {
            if ring { ProgressView().progressViewStyle(.circular) }
            else { ProgressView().progressViewStyle(.linear) }
        }
    }

    @ViewBuilder private func fitted(_ img: Image) -> some View {
        switch node.str("fit") {
        case "fill": img.resizable()
        // Size from the container, not the image: a wide picture must not widen its parent.
        case "cover": Color.clear.overlay(img.resizable().scaledToFill()).clipped()
        case "none": img
        default: img.resizable().scaledToFit()
        }
    }

    @ViewBuilder private var image: some View {
        if let s = node.str("source"), let url = URL(string: s) {
            if url.isFileURL {
                if let ns = cachedImage(url) { fitted(Image(nsImage: ns)) }
            } else if url.scheme == "http" || url.scheme == "https" {
                AsyncImage(url: url) { phase in
                    if let img = phase.image { fitted(img) }
                    else if phase.error != nil { Image(systemName: "photo").foregroundColor(.secondary) }
                    else { ProgressView() }
                }
            }
        }
    }

    private func cachedImage(_ url: URL) -> NSImage? {
        if let hit = imageCache[url] { return hit }
        guard let img = NSImage(contentsOf: url) else { return nil }
        imageCache[url] = img
        return img
    }

    /// `Native` names a WinUI control, which has no equivalent here. Its children still render.
    @ViewBuilder private var native: some View {
        if node.children.isEmpty {
            Text(verbatim: "\(node.str("type") ?? "Native") is a WinUI control and is not available on macOS.")
                .font(.caption)
                .foregroundColor(.secondary)
        } else {
            VStack(alignment: .leading, spacing: 8) { kids(horizontal: false) }
        }
    }
}
