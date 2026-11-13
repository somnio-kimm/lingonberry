import Capacitor
import WebKit
import UIKit

// Opt-in native smoke checks; no test code is compiled into release builds.
class AppViewController: CAPBridgeViewController {
    #if DEBUG
    private var verificationStarted = false
    override func capacitorDidLoad() {
        if ProcessInfo.processInfo.arguments.contains("--update-installed-language-packages") {
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: NativePackageVerification.progressCaptureScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        if ProcessInfo.processInfo.arguments.contains("--verify-offline-packages") {
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: NativePackageVerification.offlineScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let arguments = ProcessInfo.processInfo.arguments
        guard !verificationStarted && NativePackageVerification.isRequested(arguments) else { return }
        verificationStarted = true
        UIApplication.shared.isIdleTimerDisabled = true
        if arguments.contains("--update-installed-language-packages") {
            let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
            let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
            print("NATIVE_RELEASE_APP_INFO version=\(version) build=\(build)")
        }
        verifyPackages(attempt: 0)
    }
    private func verifyPackages(attempt: Int) {
        webView?.evaluateJavaScript("Boolean(document.documentElement.dataset.catalogState === 'ready')") { [weak self] value, _ in
            guard let self = self else { return }
            guard value as? Bool == true else {
                if attempt < 150 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.verifyPackages(attempt: attempt + 1) } }
                else { UIApplication.shared.isIdleTimerDisabled = false; print("NATIVE_PACKAGE_QA_ERROR app did not become ready") }
                return
            }
            self.webView?.callAsyncJavaScript(NativePackageVerification.script, arguments: NativePackageVerification.arguments(for: ProcessInfo.processInfo.arguments), in: nil, in: .page) { result in
                UIApplication.shared.isIdleTimerDisabled = false
                switch result {
                case .success(let value): print("NATIVE_PACKAGE_QA_RESULT \(value)")
                case .failure(let error): print("NATIVE_PACKAGE_QA_ERROR \(error)")
                }
            }
        }
    }
    #endif
}
