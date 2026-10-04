import AppKit
import SwiftUI

/// One native window plus the model that feeds its SwiftUI tree.
@MainActor
final class HostWindow: NSObject, NSWindowDelegate {
    let id: Int
    let window: NSWindow
    let model: WindowModel
    weak var app: HostApp?
    var shown = false
    var lastSize = ""
    var lastIcon: String?

    init(id: Int, app: HostApp) {
        self.id = id
        self.app = app
        model = WindowModel(id: id) { [weak app] msg in app?.bridge.send(msg) }
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 640),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        super.init()
        window.isReleasedWhenClosed = false
        window.delegate = self
        let hosting = NSHostingView(rootView: RootView(model: model))
        // The window's size comes from the app's config, not from whatever the content measures.
        hosting.sizingOptions = []
        window.contentView = hosting
        window.contentMinSize = NSSize(width: 200, height: 120)
    }

    func windowWillClose(_ notification: Notification) { app?.windowClosed(id) }

    // The host owns focus, so `system.*` without a window follows the window the user is in.
    func windowDidBecomeKey(_ notification: Notification) {
        app?.bridge.send(["type": "focus", "window": id])
    }
}

final class HostApp: NSObject, NSApplicationDelegate {
    let bridge = Bridge()
    private var windows: [Int: HostWindow] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        NSApp.activate(ignoringOtherApps: true)
        guard let launch = Launch.resolve() else {
            Bridge.log("usage: Glasspane <script.js> [args...]")
            exit(2)
        }
        bridge.onMessage = { [weak self] msg in self?.handle(msg) }
        do {
            try bridge.start(script: launch.script, args: launch.args)
        } catch {
            Bridge.log("\(error)")
            let alert = NSAlert()
            alert.messageText = "Could not start the app"
            alert.informativeText = "\(error)"
            alert.runModal()
            exit(1)
        }
    }

    // The JS side exits the process when the last window closes.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func windowClosed(_ id: Int) {
        guard windows.removeValue(forKey: id) != nil else { return }
        bridge.send(["type": "closed", "window": id])
    }

    // MARK: messages

    private func handle(_ msg: JSONDict) {
        let id = intValue(msg["window"]) ?? 0
        switch msg["type"] as? String {
        case "hello":
            if windows[id] == nil { createWindow(id) }
            bridge.send(["type": "ready", "window": id])
        case "render": render(msg)
        case "request": handleRequest(msg)
        case "close":
            if let hw = windows[id] { hw.window.close() }
        case "quit": exit(0)
        default: break
        }
    }

    private func createWindow(_ id: Int) {
        windows[id] = HostWindow(id: id, app: self)
    }

    private func render(_ msg: JSONDict) {
        let id = intValue(msg["window"]) ?? 0
        if windows[id] == nil { createWindow(id) }
        guard let hw = windows[id], let tree = msg["root"] as? JSONDict else { return }
        let config = msg["config"] as? JSONDict ?? [:]
        hw.model.apply(root: VNode(tree), ack: intValue(msg["ack"]) ?? 0,
                       backdrop: config["backdrop"] as? String ?? "mica")
        applyWindow(hw, config)
        if !hw.shown {
            hw.shown = true
            hw.window.makeKeyAndOrderFront(nil)
        }
    }

    private func applyWindow(_ hw: HostWindow, _ c: JSONDict) {
        let w = hw.window
        if let title = c["title"] as? String, w.title != title { w.title = title }

        let width = doubleValue(c["width"]), height = doubleValue(c["height"])
        let size = "\(width ?? 0)x\(height ?? 0)"
        if size != hw.lastSize, let wd = width, let ht = height {
            hw.lastSize = size
            w.setContentSize(NSSize(width: wd, height: ht))
            if !hw.shown { w.center() }
        }

        switch c["theme"] as? String {
        case "dark": w.appearance = NSAppearance(named: .darkAqua)
        case "light": w.appearance = NSAppearance(named: .aqua)
        default: w.appearance = nil
        }

        // A Mac window has no icon of its own; the app icon is what the Dock shows.
        if let icon = c["icon"] as? String, icon != hw.lastIcon {
            hw.lastIcon = icon
            if let img = NSImage(contentsOfFile: icon) { NSApp.applicationIconImage = img }
            else { Bridge.log("could not load icon: " + icon) }
        }
    }

    private func handleRequest(_ msg: JSONDict) {
        let wid = intValue(msg["window"]) ?? 0
        let method = msg["method"] as? String ?? ""
        let args = msg["args"] as? JSONDict ?? [:]
        var reply: JSONDict = ["type": "response", "window": wid, "id": msg["id"] ?? NSNull()]
        Task {
            do {
                guard let hw = self.windows[wid] else { throw HostError("Unknown window.") }
                reply["result"] = try await Dialogs.invoke(window: hw.window, method: method, args: args)
            } catch {
                reply["error"] = "\(error)"
            }
            self.bridge.send(reply)
        }
    }

    // MARK: menu

    /// Without an Edit menu, Cmd+C and Cmd+V do nothing in text fields.
    private func buildMenu() {
        let name = (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String) ?? ProcessInfo.processInfo.processName
        let main = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About \(name)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide \(name)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit \(name)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        add(appMenu, to: main)

        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        add(edit, to: main)

        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        add(windowMenu, to: main)
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = main
    }

    private func add(_ submenu: NSMenu, to menu: NSMenu) {
        let item = NSMenuItem()
        item.submenu = submenu
        menu.addItem(item)
    }
}

/// Which script to run: the first argument, or `glasspane.json` next to the app when packaged.
enum Launch {
    struct Target { let script: String; let args: [String] }

    static func resolve() -> Target? {
        let args = CommandLine.arguments.dropFirst().filter { !$0.hasPrefix("-psn") }
        if let first = args.first {
            return Target(script: URL(fileURLWithPath: first).standardizedFileURL.path, args: Array(args.dropFirst()))
        }
        var dirs: [String] = []
        if let res = Bundle.main.resourcePath { dirs.append(res) }
        if let exe = Bundle.main.executableURL { dirs.append(exe.deletingLastPathComponent().path) }
        for dir in dirs {
            let cfg = URL(fileURLWithPath: dir).appendingPathComponent("glasspane.json")
            guard let data = try? Data(contentsOf: cfg),
                  let json = try? JSONSerialization.jsonObject(with: data) as? JSONDict,
                  let main = json["main"] as? String else { continue }
            let script = URL(fileURLWithPath: dir).appendingPathComponent(main).standardizedFileURL.path
            return Target(script: script, args: [])
        }
        return nil
    }
}
