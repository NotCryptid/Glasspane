import SwiftUI

typealias JSONDict = [String: Any]

func intValue(_ any: Any?) -> Int? { (any as? NSNumber)?.intValue }
func doubleValue(_ any: Any?) -> Double? { (any as? NSNumber)?.doubleValue }

/// One node of the view tree Node sends: `{ t, k?, p?, e?, c? }`.
struct VNode {
    var type: String
    var key: String?
    var props: JSONDict
    var events: [String: String]
    var children: [VNode]

    init(_ raw: JSONDict) {
        type = raw["t"] as? String ?? "Text"
        key = raw["k"] as? String
        props = raw["p"] as? JSONDict ?? [:]
        events = raw["e"] as? [String: String] ?? [:]
        children = (raw["c"] as? [JSONDict] ?? []).map { VNode($0) }
    }

    func str(_ k: String) -> String? { props[k] as? String }
    func num(_ k: String) -> Double? { doubleValue(props[k]) }
    func cg(_ k: String) -> CGFloat? { num(k).map { CGFloat($0) } }
    func bool(_ k: String) -> Bool? { (props[k] as? NSNumber)?.boolValue }
    func has(_ k: String) -> Bool { props[k] != nil && !(props[k] is NSNull) }

    /// A number, or `[left, top, right, bottom]`, as used by `padding` and `margin`.
    func insets(_ k: String) -> EdgeInsets? {
        if let n = num(k) { return EdgeInsets(top: n, leading: n, bottom: n, trailing: n) }
        if let a = props[k] as? [Any], a.count == 4 {
            let v = a.map { doubleValue($0) ?? 0 }
            return EdgeInsets(top: v[1], leading: v[0], bottom: v[3], trailing: v[2])
        }
        return nil
    }

    /// Fills in props the node did not set, for views with built-in styling (Card).
    func with(defaults: JSONDict) -> VNode {
        var copy = self
        for (k, v) in defaults where copy.props[k] == nil { copy.props[k] = v }
        return copy
    }
}
