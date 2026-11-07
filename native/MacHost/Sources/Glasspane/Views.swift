import SwiftUI
import AppKit
import AVKit
import WebKit

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

    /// Where the content sits in a frame that stretches. WinUI lays a stretched stack's children out
    /// from its alignment and from the top, so a stretched VStack does not center what it holds.
    private var alignment: Alignment {
        var h = hAlignment(n.str("hAlign"))
        var v = vAlignment(n.str("vAlign"))
        if n.str("hAlign") == "stretch" && n.type == "VStack" { h = hAlignment(n.str("alignment")) }
        if n.str("vAlign") == "stretch" { v = .top }
        return Alignment(horizontal: h, vertical: v)
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
            .ifLet(n.props["foreground"] is JSONDict ? Theme.shapeStyle(n.props["foreground"]) : nil) { $0.foregroundStyle($1) }
            .ifLet(n.insets("padding")) { $0.padding($1) }
            // A Button sizes its label instead, so the system draws every style around the same box.
            .frame(width: n.type == "Button" ? nil : n.cg("width"), height: n.type == "Button" ? nil : n.cg("height"))
            .ifLet(flexible ? true : nil) { v, _ in
                v.frame(minWidth: n.cg("minWidth"), maxWidth: maxW,
                        minHeight: n.cg("minHeight"), maxHeight: maxH, alignment: alignment)
            }
            .ifLet(n.cg("glass")) { $0.glassEffect(.regular, in: RoundedRectangle(cornerRadius: $1)) }
            .ifLet(Theme.color(n.str("background"))) { $0.background($1) }
            .ifLet(n.props["background"] is JSONDict ? Theme.shapeStyle(n.props["background"]) : nil) { $0.background($1) }
            .ifLet(n.cg("cornerRadius")) { $0.clipShape(RoundedRectangle(cornerRadius: $1)) }
            .ifLet(border) { v, b in
                v.overlay(
                    RoundedRectangle(cornerRadius: n.cg("cornerRadius") ?? 0)
                        .stroke(Theme.color(b["color"] as? String ?? "divider") ?? Color.gray,
                                lineWidth: CGFloat(doubleValue(b["width"]) ?? 1))
                )
            }
            .ifLet(n.num("opacity")) { $0.opacity($1) }
            .disabled(n.bool("disabled") == true)
            .ifLet(n.str("tooltip")) { $0.help($1) }
    }
}

/// Modifiers with a counterpart on both platforms that sit outside the box `Common` draws:
/// transforms, margin (which a transform must not include), stacking, hit testing, accessibility
/// and text decoration.
struct Extras: ViewModifier {
    let n: VNode

    func body(content: Content) -> some View {
        content
            .ifLet(n.has("scaleX") || n.has("scaleY") ? CGSize(width: n.cg("scaleX") ?? 1, height: n.cg("scaleY") ?? 1) : nil) { $0.scaleEffect($1) }
            .ifLet(n.num("rotation")) { $0.rotationEffect(.degrees($1)) }
            .ifLet(n.has("offsetX") || n.has("offsetY") ? CGSize(width: n.cg("offsetX") ?? 0, height: n.cg("offsetY") ?? 0) : nil) { $0.offset(x: $1.width, y: $1.height) }
            .ifLet(n.insets("margin")) { $0.padding($1) }
            .ifLet(n.num("zIndex")) { $0.zIndex($1) }
            .allowsHitTesting(n.bool("hitTesting") != false)
            .ifLet(n.str("a11yLabel")) { $0.accessibilityLabel($1) }
            .ifLet(n.str("a11yHint")) { $0.accessibilityHint($1) }
            .ifLet(n.bool("underline")) { $0.underline($1) }
            .ifLet(n.bool("strikethrough")) { $0.strikethrough($1) }
            .ifLet(n.cg("tracking")) { $0.tracking($1) }
    }
}

extension View {
    func gp(_ n: VNode) -> some View { modifier(Common(n: n)).modifier(Extras(n: n)) }
}

/// "CmdOrCtrl+Shift+N" as SwiftUI wants it. Cmd and Ctrl both mean Command here, as in the menu bar.
func keyShortcut(_ spec: String?) -> (KeyEquivalent, EventModifiers)? {
    guard let spec = spec else { return nil }
    var mods: EventModifiers = []
    var key = ""
    for part in spec.split(separator: "+", omittingEmptySubsequences: true).map(String.init) {
        switch part.lowercased() {
        case "cmd", "command", "meta", "cmdorctrl", "commandorcontrol": mods.insert(.command)
        case "ctrl", "control": mods.insert(.control)
        case "alt", "option": mods.insert(.option)
        case "shift": mods.insert(.shift)
        default: key = part
        }
    }
    let special: [String: KeyEquivalent] = [
        "enter": .return, "return": .return, "esc": .escape, "escape": .escape, "space": .space, "tab": .tab,
        "delete": .deleteForward, "backspace": .delete, "up": .upArrow, "down": .downArrow, "left": .leftArrow, "right": .rightArrow,
    ]
    if let k = special[key.lowercased()] { return (k, mods) }
    guard key.count == 1, let c = key.lowercased().first else { return nil }
    return (KeyEquivalent(c), mods)
}

// MARK: - Menus, popovers and sheets

/// The entries of a `Menu` or `contextMenu`: MenuItem, Divider and nested Menu nodes.
struct MenuEntries: View {
    let items: [VNode]
    @EnvironmentObject var model: WindowModel

    var body: some View {
        ForEach(Array(items.enumerated()), id: \.offset) { _, it in entry(it) }
    }

    @ViewBuilder private func entry(_ it: VNode) -> some View {
        switch it.type {
        case "Divider": Divider()
        case "Menu": Menu { MenuEntries(items: it.children) } label: { titled(it) }
        case "MenuItem": item(it)
        default: EmptyView()
        }
    }

    @ViewBuilder private func titled(_ it: VNode) -> some View {
        let label = it.str("text") ?? ""
        if let icon = it.str("icon") { Label(label, systemImage: symbol(icon)) } else { Text(verbatim: label) }
    }

    @ViewBuilder private func item(_ it: VNode) -> some View {
        let action = { if let id = it.events["click"] { model.emit(id) } }
        if it.has("checked") {
            Toggle(isOn: Binding(get: { it.bool("checked") == true }, set: { _ in action() })) { titled(it) }
                .disabled(it.bool("disabled") == true)
        } else {
            Button(action: action) { titled(it) }
                .ifLet(keyShortcut(it.str("shortcut"))) { $0.keyboardShortcut($1.0, modifiers: $1.1) }
                .disabled(it.bool("disabled") == true)
        }
    }
}

private func edge(_ s: String?) -> Edge {
    switch s {
    case "top": return .top
    case "leading", "left": return .leading
    case "trailing", "right": return .trailing
    default: return .bottom
    }
}

/// Hover, double tap, context menu, popover and sheet.
struct Attachments: ViewModifier {
    let node: VNode
    @EnvironmentObject var model: WindowModel

    /// Open while the node says so. A dismissal is remembered until Node acknowledges it, so the
    /// panel does not reopen from a render that was already in flight.
    private func open(_ prop: String, _ event: String) -> Binding<Bool> {
        Binding<Bool>(
            get: {
                if model.hold, let h = node.events[event], let v = model.overrides[h] as? Bool { return v }
                return node.bool(prop) == true
            },
            set: { value in
                guard let h = node.events[event] else { return }
                model.overrides[h] = value
                model.emit(h, value)
            }
        )
    }

    func body(content: Content) -> some View {
        content
            .ifLet(node.events["doubleTap"]) { v, id in v.contentShape(Rectangle()).onTapGesture(count: 2) { model.emit(id) } }
            .ifLet(node.events["hover"]) { v, id in v.onHover { model.emit(id, $0) } }
            .ifLet(node.overlays["contextMenu"]) { v, items in v.contextMenu { MenuEntries(items: items) } }
            .ifLet(node.overlays["popover"]?.first) { v, panel in
                v.popover(isPresented: open("popoverOpen", "popoverDismiss"), arrowEdge: edge(node.str("popoverEdge"))) {
                    NodeView(node: panel).environmentObject(model)
                }
            }
            .ifLet(node.overlays["sheet"]?.first) { v, panel in
                v.sheet(isPresented: open("sheetOpen", "sheetDismiss")) {
                    NodeView(node: panel).environmentObject(model)
                }
            }
    }
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
    /// A DisclosureGroup nobody controls remembers its own state.
    @State private var disclosed = false

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
            filled(tappable(content.gp(eff)).modifier(Attachments(node: node)))
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
        // These have no size of their own, so without a frame they collapse to nothing in a stack.
        case "WebView":
            WebPane(url: node.str("url"), html: node.str("html"))
                .frame(minWidth: 100, maxWidth: .infinity, minHeight: 100, maxHeight: .infinity)
        case "VideoPlayer":
            if let s = node.str("source"), let url = URL(string: s) {
                VideoPane(url: url, autoplay: node.bool("autoplay") == true).id(url)
                    .frame(minWidth: 100, maxWidth: .infinity, minHeight: 100, maxHeight: .infinity)
            }
        case "Label": label
        case "Link": link
        case "DatePicker": datePicker
        case "ColorPicker": colorPicker
        case "SearchField": searchField
        case "DisclosureGroup": disclosure
        case "TabView": tabs
        case "SplitView": split
        case "Menu": menu
        case "Grid": grid
        case "Rectangle": shape(Rectangle())
        case "RoundedRectangle": shape(RoundedRectangle(cornerRadius: node.cg("radius") ?? 8))
        case "Circle": shape(Circle())
        case "Ellipse": shape(Ellipse())
        case "Capsule": shape(Capsule())
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
        if node.bool("plain") == true {
            // A lazy column: rows are built as they scroll in and cannot be selected.
            List {
                ForEach(items, id: \.id) { item in
                    NodeView(node: item.node).listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
        } else {
            List(selection: selection) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    NodeView(node: item.node).tag(index)
                }
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
        let style = node.str("style")
        // `width` and `height` size the whole button, as on Windows, so take off the padding the
        // bordered styles add around their label.
        let inset = style == "plain" ? CGSize.zero : CGSize(width: 24, height: 8)
        let b = Button(role: style == "destructive" ? .destructive : nil, action: action) {
            Group {
                if let icon = icon, !label.isEmpty { Label(label, systemImage: icon) }
                // An icon-only button is at least a line of text tall, whatever its glyph's own height is.
                else if let icon = icon {
                    Label(node.str("tooltip") ?? icon, systemImage: icon).labelStyle(.iconOnly)
                        .frame(minWidth: 18, minHeight: 16)
                }
                else { Text(verbatim: label) }
            }
            .frame(width: node.cg("width").map { max($0 - inset.width, 0) }, height: node.cg("height").map { max($0 - inset.height, 0) })
            .contentShape(Rectangle())
        }
        .ifLet(keyShortcut(node.str("shortcut"))) { $0.keyboardShortcut($1.0, modifiers: $1.1) }
        .ifLet(label.isEmpty ? (node.str("tooltip") ?? node.str("icon")) : nil) { $0.accessibilityLabel($1) }
        .ifLet(style == "destructive" ? Theme.color("danger") : nil) { $0.foregroundColor($1) }
        switch style {
        case "accent": b.buttonStyle(.borderedProminent)
        case "plain": b.buttonStyle(.borderless)
        default: b.buttonStyle(.bordered)
        }
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
        let style = node.str("style")
        let picker = Picker("", selection: selection) {
            if style != "segmented" && style != "radio" && (selection.wrappedValue < 0 || selection.wrappedValue >= options.count) {
                Text(verbatim: node.str("placeholder") ?? "").tag(selection.wrappedValue)
            }
            ForEach(Array(options.enumerated()), id: \.offset) { i, o in Text(verbatim: o).tag(i) }
        }
        .labelsHidden()
        labeled {
            switch style {
            case "segmented": picker.pickerStyle(.segmented)
            case "radio": picker.pickerStyle(.radioGroup)
            default: picker.pickerStyle(.menu)
            }
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

    // ---- views with a WinUI counterpart

    @ViewBuilder private var label: some View {
        let text = node.str("text") ?? ""
        if let icon = node.str("icon") { Label(text, systemImage: symbol(icon)) } else { Text(verbatim: text) }
    }

    @ViewBuilder private var link: some View {
        if let s = node.str("url"), let url = URL(string: s) { Link(node.str("text") ?? s, destination: url) }
        else { Text(verbatim: node.str("text") ?? "") }
    }

    @ViewBuilder private var datePicker: some View {
        let ms = binding("value", Date().timeIntervalSince1970 * 1000, number)
        let date = Binding<Date>(
            get: { Date(timeIntervalSince1970: ms.wrappedValue / 1000) },
            set: { ms.wrappedValue = ($0.timeIntervalSince1970 * 1000).rounded() }
        )
        let lo = node.num("min").map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date.distantPast
        let hi = node.num("max").map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date.distantFuture
        DatePicker(node.str("label") ?? "", selection: date, in: lo...hi,
                   displayedComponents: node.str("mode") == "time" ? .hourAndMinute : .date)
    }

    @ViewBuilder private var colorPicker: some View {
        let hex = binding("value", "#000000", string)
        let color = Binding<Color>(
            get: { Theme.color(hex.wrappedValue) ?? .black },
            set: { hex.wrappedValue = Theme.hexString($0) }
        )
        ColorPicker(node.str("label") ?? "", selection: color, supportsOpacity: node.bool("alpha") == true)
    }

    @ViewBuilder private var searchField: some View {
        let b = binding("text", "", string)
        let submit = { if let id = node.events["submit"] { model.emit(id, b.wrappedValue) } }
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField(node.str("placeholder") ?? "Search", text: b).textFieldStyle(.plain).onSubmit(submit)
            if !b.wrappedValue.isEmpty {
                Button { b.wrappedValue = "" } label: { Image(systemName: "xmark.circle.fill").foregroundColor(.secondary) }
                    .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(nsColor: .controlBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
    }

    @ViewBuilder private var disclosure: some View {
        let expanded: Binding<Bool> = node.has("expanded") ? binding("expanded", false, flag) : $disclosed
        DisclosureGroup(node.str("label") ?? "", isExpanded: expanded) {
            if let c = node.children.first { NodeView(node: c, fill: .width) }
        }
    }

    @ViewBuilder private var tabs: some View {
        let selection = binding("selected", 0, integer)
        TabView(selection: selection) {
            ForEach(Array(node.children.enumerated()), id: \.offset) { i, tab in
                Group {
                    if let c = tab.children.first { NodeView(node: c, fill: .both) }
                }
                .tabItem {
                    if let icon = tab.str("icon") { Label(tab.str("text") ?? "", systemImage: symbol(icon)) }
                    else { Text(verbatim: tab.str("text") ?? "") }
                }
                .tag(i)
            }
        }
    }

    @ViewBuilder private var split: some View {
        if node.children.count >= 2 {
            NavigationSplitView {
                NodeView(node: node.children[0], fill: .both)
                    .navigationSplitViewColumnWidth(node.cg("sidebarWidth") ?? 240)
            } detail: {
                NodeView(node: node.children[1], fill: .both)
            }
        }
    }

    @ViewBuilder private var menu: some View {
        let text = node.str("text") ?? ""
        Menu {
            MenuEntries(items: node.children)
        } label: {
            if let icon = node.str("icon"), !text.isEmpty { Label(text, systemImage: symbol(icon)) }
            else if let icon = node.str("icon") { Image(systemName: symbol(icon)) }
            else { Text(verbatim: text) }
        }
        .menuStyle(.button)
    }

    @ViewBuilder private var grid: some View {
        let counts = (node.props["rows"] as? [Any])?.compactMap { intValue($0) } ?? []
        let rows: [[VNode]] = {
            var out: [[VNode]] = []
            var at = 0
            for n in counts {
                out.append(Array(node.children[min(at, node.children.count)..<min(at + n, node.children.count)]))
                at += n
            }
            return out
        }()
        Grid(horizontalSpacing: node.cg("hSpacing") ?? 8, verticalSpacing: node.cg("vSpacing") ?? 8) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, cells in
                GridRow {
                    ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in gridCell(cell) }
                }
            }
        }
    }

    /// A cell that asks for `hAlign` or `vAlign` is placed in its column, not stretched to fill the
    /// whole grid, which is how an Auto column behaves on Windows.
    @ViewBuilder private func gridCell(_ cell: VNode) -> some View {
        let h = cell.str("hAlign"), v = cell.str("vAlign")
        let anchorX: CGFloat? = h == "leading" || h == "start" ? 0 : h == "trailing" || h == "end" ? 1 : nil
        let anchorY: CGFloat? = v == "top" || v == "start" ? 0 : v == "bottom" || v == "end" ? 1 : nil
        NodeView(node: cell.without(anchorX != nil ? "hAlign" : nil, anchorY != nil ? "vAlign" : nil))
            .gridCellAnchor(UnitPoint(x: anchorX ?? 0.5, y: anchorY ?? 0.5))
    }

    @ViewBuilder private func shape<S: Shape>(_ s: S) -> some View {
        let outline = node.props["stroke"] as? JSONDict
        s.fill(Theme.shapeStyle(node.props["foreground"]) ?? AnyShapeStyle(Color.primary))
            .ifLet(outline) { v, o in
                v.overlay(s.stroke(Theme.color(o["color"] as? String ?? "primary") ?? Color.primary,
                                   lineWidth: CGFloat(doubleValue(o["width"]) ?? 1)))
            }
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


// MARK: - Web and video

/// A web page from a URL or from HTML. It only reloads when the source changes.
struct WebPane: NSViewRepresentable {
    let url: String?
    let html: String?

    final class Coordinator { var loaded: String? }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView { WKWebView() }

    func updateNSView(_ view: WKWebView, context: Context) {
        let sig = url.map { "u:" + $0 } ?? "h:" + (html ?? "")
        guard context.coordinator.loaded != sig else { return }
        context.coordinator.loaded = sig
        if let s = url, let u = URL(string: s) {
            if u.isFileURL { view.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent()) }
            else { view.load(URLRequest(url: u)) }
        } else if let h = html {
            view.loadHTMLString(h, baseURL: nil)
        }
    }
}

/// A video with transport controls. The caller gives it `.id(url)` so a new source gets a new player.
/// This wraps AVPlayerView directly: SwiftUI's VideoPlayer aborts at runtime when it cannot load
/// that class's metadata.
struct VideoPane: NSViewRepresentable {
    let url: URL
    let autoplay: Bool

    func makeNSView(context: Context) -> AVPlayerView {
        let view = AVPlayerView()
        let player = AVPlayer(url: url)
        view.player = player
        view.controlsStyle = .inline
        if autoplay { player.play() }
        return view
    }

    func updateNSView(_ view: AVPlayerView, context: Context) {}

    static func dismantleNSView(_ view: AVPlayerView, coordinator: ()) { view.player?.pause() }
}
