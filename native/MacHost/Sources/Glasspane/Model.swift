import SwiftUI

/// What one window shows. SwiftUI re-renders whenever `root` changes.
final class WindowModel: ObservableObject {
    let id: Int
    private let send: (JSONDict) -> Void

    @Published var root: VNode?
    @Published var backdrop = "mica"
    /// The content runs under a hidden title bar, so it must ignore the title bar's safe area.
    @Published var fullSize = false
    /// Values the user typed that Node has not acknowledged yet. Without these, a render that was
    /// already in flight would put the old text back under the caret.
    @Published var overrides: [String: Any] = [:]

    var hold = false
    private var sent = 0

    init(id: Int, send: @escaping (JSONDict) -> Void) {
        self.id = id
        self.send = send
    }

    func emit(_ handler: String, _ value: Any? = nil) {
        sent += 1
        var msg: JSONDict = ["type": "event", "window": id, "id": handler, "seq": sent]
        if let value = value { msg["value"] = value }
        send(msg)
    }

    func apply(root: VNode, ack: Int, backdrop: String) {
        hold = ack < sent
        if !hold && !overrides.isEmpty { overrides.removeAll() }
        if self.backdrop != backdrop { self.backdrop = backdrop }
        self.root = root
    }
}
