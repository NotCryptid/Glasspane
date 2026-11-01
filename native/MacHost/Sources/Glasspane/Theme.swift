import SwiftUI
import AppKit

/// Turns color strings from JS into SwiftUI colors. Keywords map to dynamic system colors, so
/// they follow light and dark mode.
enum Theme {
    static func color(_ spec: String?) -> Color? {
        guard let spec = spec?.trimmingCharacters(in: .whitespaces), !spec.isEmpty else { return nil }
        switch spec.lowercased() {
        case "accent": return Color.accentColor
        case "primary": return Color(nsColor: .labelColor)
        case "secondary": return Color(nsColor: .secondaryLabelColor)
        case "tertiary": return Color(nsColor: .tertiaryLabelColor)
        case "disabled": return Color(nsColor: .disabledControlTextColor)
        case "card": return Color(nsColor: .controlBackgroundColor)
        case "cardborder", "divider": return Color(nsColor: .separatorColor)
        case "surface": return Color(nsColor: .underPageBackgroundColor)
        case "control": return Color(nsColor: .controlColor)
        case "background": return Color(nsColor: .windowBackgroundColor)
        case "danger", "red": return Color(nsColor: .systemRed)
        case "success", "green": return Color(nsColor: .systemGreen)
        case "warning", "orange": return Color(nsColor: .systemOrange)
        case "yellow": return Color(nsColor: .systemYellow)
        case "blue": return Color(nsColor: .systemBlue)
        case "purple": return Color(nsColor: .systemPurple)
        case "pink": return Color(nsColor: .systemPink)
        case "teal": return Color(nsColor: .systemTeal)
        case "gray", "grey": return Color(nsColor: .systemGray)
        case "black": return Color.black
        case "white": return Color.white
        case "clear", "transparent": return Color.clear
        default: return hex(spec)
        }
    }

    /// `#RGB`, `#ARGB`, `#RRGGBB` or `#AARRGGBB`, matching the Windows host.
    static func hex(_ spec: String) -> Color? {
        guard spec.hasPrefix("#") else { return nil }
        var h = String(spec.dropFirst())
        if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count == 6 || h.count == 8, let v = UInt32(h, radix: 16) else { return nil }
        let hasAlpha = h.count == 8
        let a = hasAlpha ? Double((v >> 24) & 255) / 255 : 1
        let r = Double((v >> 16) & 255) / 255
        let g = Double((v >> 8) & 255) / 255
        let b = Double(v & 255) / 255
        return Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    /// `"#RRGGBB"`, or `"#AARRGGBB"` when the color is translucent, matching the Windows host.
    static func hexString(_ color: Color) -> String {
        guard let c = NSColor(color).usingColorSpace(.sRGB) else { return "#000000" }
        func byte(_ v: CGFloat) -> Int { Int((v * 255).rounded()) }
        let rgb = String(format: "%02X%02X%02X", byte(c.redComponent), byte(c.greenComponent), byte(c.blueComponent))
        return c.alphaComponent < 0.999 ? String(format: "#%02X", byte(c.alphaComponent)) + rgb : "#" + rgb
    }

    /// A color string, or a `LinearGradient` object from JS, as something a view can be filled with.
    static func shapeStyle(_ spec: Any?) -> AnyShapeStyle? {
        if let s = spec as? String { return color(s).map { AnyShapeStyle($0) } }
        guard let g = (spec as? JSONDict)?["gradient"] as? JSONDict, let raw = g["stops"] as? [JSONDict] else { return nil }
        let stops = raw.compactMap { d -> Gradient.Stop? in
            guard let c = color(d["color"] as? String) else { return nil }
            return Gradient.Stop(color: c, location: CGFloat(doubleValue(d["at"]) ?? 0))
        }
        func point(_ any: Any?) -> UnitPoint {
            let a: [Double] = (any as? [Any])?.map { doubleValue($0) ?? 0 } ?? [0.5, 0]
            return UnitPoint(x: a.count > 0 ? a[0] : 0.5, y: a.count > 1 ? a[1] : 0)
        }
        guard stops.count >= 2 else { return nil }
        return AnyShapeStyle(LinearGradient(stops: stops, startPoint: point(g["start"]), endPoint: point(g["end"])))
    }
}
