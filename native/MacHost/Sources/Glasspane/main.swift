import AppKit

// Writing to a node that already exited must not kill the host.
signal(SIGPIPE, SIG_IGN)

let application = NSApplication.shared
let host = HostApp()
application.delegate = host
application.setActivationPolicy(.regular)
application.run()
