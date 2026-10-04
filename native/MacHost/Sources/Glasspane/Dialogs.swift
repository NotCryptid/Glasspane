import AppKit
import UniformTypeIdentifiers

/// Request/response calls from Node into macOS: dialogs, pickers, clipboard, launcher.
@MainActor
enum Dialogs {
    static func invoke(window: NSWindow, method: String, args a: JSONDict) async throws -> Any {
        switch method {
        case "alert": return await alert(window, a)
        case "openFile": return await openFile(window, a)
        case "saveFile": return await saveFile(window, a)
        case "pickFolder": return await pickFolder(window)
        case "clipboardRead": return NSPasteboard.general.string(forType: .string) ?? NSNull()
        case "clipboardWrite":
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(a["text"] as? String ?? "", forType: .string)
            return NSNull()
        case "launch":
            guard let s = a["uri"] as? String, let url = URL(string: s) else { return false }
            return NSWorkspace.shared.open(url)
        default:
            throw HostError("Unknown request: " + method)
        }
    }

    /// Resolves with the index of the button pressed, as the Windows host does.
    private static func alert(_ window: NSWindow, _ a: JSONDict) async -> Int {
        var buttons = (a["buttons"] as? [String]) ?? []
        if buttons.isEmpty { buttons = ["OK"] }
        let title = a["title"] as? String ?? ""
        let message = a["message"] as? String ?? ""
        let alert = NSAlert()
        if title.isEmpty {
            alert.messageText = message
        } else {
            alert.messageText = title
            alert.informativeText = message
        }
        for b in buttons.prefix(3) { alert.addButton(withTitle: b) }
        let response = await alert.beginSheetModal(for: window)
        let index = response.rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
        return max(0, min(index, min(buttons.count, 3) - 1))
    }

    /// `['.png', '*']` to content types. A wildcard means no filter.
    private static func types(_ a: JSONDict) -> [UTType] {
        let exts = a["extensions"] as? [String] ?? []
        if exts.contains(where: { $0.contains("*") }) { return [] }
        return exts.compactMap { UTType(filenameExtension: $0.trimmingCharacters(in: CharacterSet(charactersIn: "."))) }
    }

    private static func openFile(_ window: NSWindow, _ a: JSONDict) async -> Any {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        let multiple = (a["multiple"] as? NSNumber)?.boolValue ?? false
        panel.allowsMultipleSelection = multiple
        let t = types(a)
        if !t.isEmpty { panel.allowedContentTypes = t }
        guard await panel.beginSheetModal(for: window) == .OK else { return multiple ? [String]() : NSNull() }
        return multiple ? panel.urls.map { $0.path } : (panel.url?.path ?? NSNull())
    }

    private static func saveFile(_ window: NSWindow, _ a: JSONDict) async -> Any {
        let panel = NSSavePanel()
        if let name = a["name"] as? String { panel.nameFieldStringValue = name }
        let t = types(a)
        if !t.isEmpty { panel.allowedContentTypes = t }
        guard await panel.beginSheetModal(for: window) == .OK else { return NSNull() }
        return panel.url?.path ?? NSNull()
    }

    private static func pickFolder(_ window: NSWindow) async -> Any {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        guard await panel.beginSheetModal(for: window) == .OK else { return NSNull() }
        return panel.url?.path ?? NSNull()
    }
}
