import AppKit

/// Runs a closure when its menu item is chosen. Menu items hold their target weakly, so the window keeps these alive.
final class MenuAction: NSObject, NSMenuItemValidation {
    let run: () -> Void
    let enabled: Bool
    init(enabled: Bool, run: @escaping () -> Void) { self.enabled = enabled; self.run = run }
    @objc func fire(_ sender: Any?) { run() }
    func validateMenuItem(_ item: NSMenuItem) -> Bool { enabled }
}

/// Builds the menu bar from the JSON that `lib/menu.js` produces.
@MainActor
enum AppMenu {
    /// `menus` nil gives the default Edit and Window menus; otherwise the app's own, after the app menu.
    static func build(menus: [JSONDict]?, emit: @escaping (String) -> Void, keep: inout [MenuAction]) -> NSMenu {
        let name = (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String) ?? ProcessInfo.processInfo.processName
        let main = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About \(name)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide \(name)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit \(name)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        add(appMenu, titled: name, to: main)

        let list = menus ?? defaults
        var windowMenu: NSMenu?
        var helpMenu: NSMenu?
        for m in list {
            let title = m["label"] as? String ?? ""
            let menu = NSMenu(title: title)
            menu.autoenablesItems = true
            for d in m["items"] as? [JSONDict] ?? [] { menu.addItem(item(d, emit: emit, keep: &keep)) }
            add(menu, titled: title, to: main)
            if m["help"] as? Bool == true { helpMenu = menu }
            else if title == "Window" { windowMenu = menu }
        }
        NSApp.windowsMenu = windowMenu
        NSApp.helpMenu = helpMenu
        return main
    }

    private static let defaults: [JSONDict] = [
        ["label": "Edit", "items": [
            ["label": "Undo", "role": "undo", "accel": "Cmd+Z"], ["label": "Redo", "role": "redo", "accel": "Cmd+Shift+Z"],
            ["separator": true],
            ["label": "Cut", "role": "cut", "accel": "Cmd+X"], ["label": "Copy", "role": "copy", "accel": "Cmd+C"],
            ["label": "Paste", "role": "paste", "accel": "Cmd+V"], ["label": "Select All", "role": "selectAll", "accel": "Cmd+A"],
        ] as [JSONDict]],
        ["label": "Window", "items": [
            ["label": "Minimize", "role": "minimize", "accel": "Cmd+M"], ["label": "Close", "role": "close", "accel": "Cmd+W"],
        ] as [JSONDict]],
    ]

    private static func add(_ submenu: NSMenu, titled title: String, to menu: NSMenu) {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = submenu
        menu.addItem(item)
    }

    private static func item(_ d: JSONDict, emit: @escaping (String) -> Void, keep: inout [MenuAction]) -> NSMenuItem {
        if d["separator"] as? Bool == true { return .separator() }
        let title = d["label"] as? String ?? ""
        let it = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        if let accel = d["accel"] as? String { applyAccelerator(accel, to: it) }
        if d["checked"] as? Bool == true { it.state = .on }

        if let kids = d["items"] as? [JSONDict] {
            let sub = NSMenu(title: title)
            for k in kids { sub.addItem(item(k, emit: emit, keep: &keep)) }
            it.submenu = sub
        } else if let role = d["role"] as? String, let sel = selector(for: role) {
            it.action = sel // no target: the responder chain decides, so Copy greys out with nothing selected
        } else if let id = d["click"] as? String {
            let action = MenuAction(enabled: d["enabled"] as? Bool ?? true) { emit(id) }
            keep.append(action)
            it.target = action
            it.action = #selector(MenuAction.fire(_:))
        } else {
            it.isEnabled = false
        }
        return it
    }

    private static func selector(for role: String) -> Selector? {
        switch role {
        case "undo": return Selector(("undo:"))
        case "redo": return Selector(("redo:"))
        case "cut": return #selector(NSText.cut(_:))
        case "copy": return #selector(NSText.copy(_:))
        case "paste": return #selector(NSText.paste(_:))
        case "selectAll": return #selector(NSText.selectAll(_:))
        case "minimize": return #selector(NSWindow.performMiniaturize(_:))
        case "zoom": return #selector(NSWindow.performZoom(_:))
        case "fullscreen": return #selector(NSWindow.toggleFullScreen(_:))
        case "close": return #selector(NSWindow.performClose(_:))
        case "quit": return #selector(NSApplication.terminate(_:))
        default: return nil
        }
    }

    /// "CmdOrCtrl+Shift+N" and friends. Cmd and Ctrl both mean Command here, as the Mac has no other main modifier.
    private static func applyAccelerator(_ spec: String, to item: NSMenuItem) {
        var mask: NSEvent.ModifierFlags = []
        var key = ""
        for part in spec.split(separator: "+", omittingEmptySubsequences: true).map(String.init) {
            switch part.lowercased() {
            case "cmd", "command", "meta", "cmdorctrl", "commandorcontrol": mask.insert(.command)
            case "ctrl", "control": mask.insert(.control)
            case "alt", "option": mask.insert(.option)
            case "shift": mask.insert(.shift)
            default: key = part
            }
        }
        // A spec such as "Ctrl+Cmd+F" asks for both, so only treat plain "Ctrl+X" as Command-less control.
        let special: [String: String] = [
            "backspace": "\u{8}", "delete": "\u{7F}", "enter": "\r", "return": "\r", "esc": "\u{1B}", "escape": "\u{1B}",
            "space": " ", "tab": "\t", "up": String(UnicodeScalar(NSUpArrowFunctionKey)!), "down": String(UnicodeScalar(NSDownArrowFunctionKey)!),
            "left": String(UnicodeScalar(NSLeftArrowFunctionKey)!), "right": String(UnicodeScalar(NSRightArrowFunctionKey)!),
        ]
        if let s = special[key.lowercased()] { key = s }
        else if key.count >= 2, key.lowercased().hasPrefix("f"), let n = Int(key.dropFirst()), (1...12).contains(n) {
            key = String(UnicodeScalar(NSF1FunctionKey + n - 1)!)
        } else { key = key.lowercased() }
        item.keyEquivalent = key
        item.keyEquivalentModifierMask = mask
    }
}
