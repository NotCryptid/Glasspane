import Foundation

struct HostError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

/// Runs a stock Node.js as a child process and exchanges newline-delimited JSON with it over
/// stdin/stdout, exactly as the Windows host does.
final class Bridge {
    var onMessage: (JSONDict) -> Void = { _ in }

    private var stdinHandle: FileHandle?
    private var buffer = Data()
    private let writeQueue = DispatchQueue(label: "glasspane.bridge.write")

    func start(script: String, args: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: try Bridge.nodePath())
        process.arguments = [script] + args
        process.currentDirectoryURL = URL(fileURLWithPath: script).deletingLastPathComponent()
        var env = ProcessInfo.processInfo.environment
        // Tells the app it was started by the host, so it does not relaunch itself.
        env["GLASSPANE_HOSTED"] = "1"
        process.environment = env

        let input = Pipe(), output = Pipe(), errors = Pipe()
        process.standardInput = input
        process.standardOutput = output
        process.standardError = errors
        stdinHandle = input.fileHandleForWriting

        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            self?.ingest(data)
        }
        // stdout is the protocol; console output arrives on stderr and goes to our own.
        errors.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            FileHandle.standardError.write(data)
        }
        // The app called process.exit(), or the script threw at startup. Either way, stop.
        process.terminationHandler = { _ in DispatchQueue.main.async { exit(0) } }
        try process.run()
    }

    /// A message can arrive split across reads, so hold the tail until its newline shows up.
    private func ingest(_ data: Data) {
        buffer.append(data)
        while let nl = buffer.firstIndex(of: 0x0A) {
            let line = buffer.subdata(in: buffer.startIndex..<nl)
            buffer.removeSubrange(buffer.startIndex...nl)
            if line.isEmpty { continue }
            guard let obj = try? JSONSerialization.jsonObject(with: line) as? JSONDict else {
                Bridge.log("bad message from node")
                continue
            }
            DispatchQueue.main.async { [weak self] in self?.onMessage(obj) }
        }
    }

    func send(_ msg: JSONDict) {
        guard let handle = stdinHandle, JSONSerialization.isValidJSONObject(msg),
              var data = try? JSONSerialization.data(withJSONObject: msg) else { return }
        data.append(0x0A)
        writeQueue.async {
            do { try handle.write(contentsOf: data) }
            catch { Bridge.log("send failed: \(error.localizedDescription)") }
        }
    }

    static func log(_ text: String) {
        FileHandle.standardError.write(Data(("[host] " + text + "\n").utf8))
    }

    /// GLASSPANE_NODE, then a node bundled with the app, then PATH. Apps launched from Finder get
    /// a minimal PATH, so the usual install locations are checked too.
    static func nodePath() throws -> String {
        let env = ProcessInfo.processInfo.environment
        var candidates: [String] = []
        if let explicit = env["GLASSPANE_NODE"] { candidates.append(explicit) }
        if let dir = Bundle.main.executableURL?.deletingLastPathComponent() {
            candidates.append(dir.appendingPathComponent("node").path)
        }
        if let res = Bundle.main.resourcePath { candidates.append(res + "/node") }
        for dir in (env["PATH"] ?? "").split(separator: ":") { candidates.append(dir + "/node") }
        candidates += ["/opt/homebrew/bin/node", "/usr/local/bin/node"]
        for c in candidates where !c.isEmpty && FileManager.default.isExecutableFile(atPath: c) { return c }
        throw HostError("Could not find node. Install Node.js, or set GLASSPANE_NODE to its full path.")
    }
}
