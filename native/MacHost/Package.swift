// swift-tools-version:5.9
import PackageDescription

// The macOS host: a SwiftUI renderer for the same JSON protocol the WinUI host speaks.
let package = Package(
    name: "Glasspane",
    platforms: [.macOS("27.0")],
    targets: [
        .executableTarget(name: "Glasspane", path: "Sources/Glasspane"),
    ],
    swiftLanguageVersions: [.v5]
)
