// MYRAA Pointer Overlay — Swift helper (Phase 5)
// A small macOS menu-bar app that provides the always-on-top pointer cursor
// for MYRAA. Pairs with the MYRAA backend over HTTP + WebSocket.
//
// Build: swiftc -o MYRAA-Pointer pointer_overlay.swift
// Run:   ./MYRAA-Pointer
//
// Security: receives only 10-minute single-use pairing secrets; the real
// OpenAI/Gemini key never leaves the MYRAA backend.

import Foundation
import AppKit
import Network

// MARK: - Configuration

struct Config {
    static let host = "127.0.0.1"
    static let port = 3000
    static let secretTTLSeconds = 600
}

// MARK: - Pairing

struct PairingResponse: Codable {
    let pairingId: String
    let secret: String
    let expiresAt: String
}

func mintSecret(deviceId: String, completion: @escaping (PairingResponse?) -> Void) {
    let url = URL(string: "http://\(Config.host):\(Config.port)/api/pairing/secret")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONEncoder().encode(["deviceId": deviceId])

    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data,
              let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let pairing = try? JSONDecoder().decode(PairingResponse.self, from: data) else {
            completion(nil)
            return
        }
        completion(pairing)
    }.resume()
}

// MARK: - Pointer Overlay Window

class PointerOverlay: NSWindow {
    var avatarView: NSImageView!
    var bubbleView: NSTextField!
    var followMode = true

    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 400),
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.level = .floating
        self.backgroundColor = .clear
        self.isOpaque = false
        self.ignoresMouseEvents = true
        self.collectionBehavior = [.canJoinAllSpaces, .stationary]

        // Avatar (MYRAA character indicator)
        avatarView = NSImageView(frame: NSRect(x: 0, y: 0, width: 120, height: 120))
        avatarView.image = NSImage(systemName: "hand.point.up.left.fill")
        avatarView.image?.isTemplate = true
        avatarView.contentTintColor = .systemBlue
        self.contentView?.addSubview(avatarView)

        // Speech bubble
        bubbleView = NSTextField(labelWithString: "")
        bubbleView.frame = NSRect(x: 130, y: 20, width: 260, height: 80)
        bubbleView.textColor = .white
        bubbleView.backgroundColor = NSColor(calibratedWhite: 0.1, alpha: 0.92)
        bubbleView.wantsLayer = true
        bubbleView.layer?.cornerRadius = 12
        bubbleView.isHidden = true
        self.contentView?.addSubview(bubbleView)
    }

    func pointAt(gridX: Int, gridY: Int) {
        let screenWidth = NSScreen.main?.frame.width ?? 1920
        let screenHeight = NSScreen.main?.frame.height ?? 1080
        let x = CGFloat(gridX) / 1000.0 * screenWidth
        let y = CGFloat(gridY) / 1000.0 * screenHeight

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            self.animator().setFrameOrigin(NSPoint(x: x - 60, y: y - 60))
        }

        // Brief highlight
        avatarView.alphaValue = 0.5
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.avatarView.alphaValue = 1.0
        }
    }

    func showBubble(_ text: String) {
        bubbleView.stringValue = text
        bubbleView.isHidden = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
            self.bubbleView.isHidden = true
        }
    }
}

// MARK: - Menu Bar Controller

class PointerController: NSObject {
    var statusItem: NSStatusItem!
    var overlay: PointerOverlay!
    var pairingId: String?

    override init() {
        super.init()
        setupMenuBar()
        setupOverlay()
    }

    func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemName: "hand.point.up.left")

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Pair Phone", action: #selector(pairPhone), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Follow Mouse: On", action: #selector(toggleFollow), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Stop Session", action: #selector(stopSession), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: ""))
        statusItem.menu = menu
    }

    func setupOverlay() {
        overlay = PointerOverlay()
        overlay.orderFrontRegardless()
    }

    @objc func pairPhone() {
        mintSecret(deviceId: "mac-overlay") { pairing in
            guard let pairing = pairing else { return }
            self.pairingId = pairing.pairingId
            // Present pairing code to user via notification
            let notification = NSUserNotification()
            notification.title = "MYRAA Pairing"
            notification.informativeText = "Code: \(pairing.secret.prefix(8))... expires in 10 min"
            NSUserNotificationCenter.default.deliver(notification)
        }
    }

    @objc func toggleFollow() {
        overlay.followMode.toggle()
    }

    @objc func stopSession() {
        guard let pairingId = pairingId else { return }
        let url = URL(string: "http://\(Config.host):\(Config.port)/api/pointer/session/stop")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["id": pairingId])
        URLSession.shared.dataTask(with: request).resume()
        self.pairingId = nil
    }

    @objc func quit() {
        NSApp.terminate(nil)
    }
}

// MARK: - Entry Point

let controller = PointerController()
NSApp.setActivationPolicy(.accessory)
NSApp.run()
