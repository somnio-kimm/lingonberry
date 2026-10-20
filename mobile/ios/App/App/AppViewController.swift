import Capacitor
import WebKit

// Opt-in simulator smoke checks; no test code is compiled into release builds.
class AppViewController: CAPBridgeViewController {
    #if DEBUG
    private var verificationStarted = false
    override func capacitorDidLoad() {
        if ProcessInfo.processInfo.arguments.contains("--verify-offline-packages") {
            let script = """
            const originalFetch = window.fetch;
            window.fetch = (input, options) => {
              const url = new URL(input.url || input, location.href);
              if (url.protocol === 'https:' || url.protocol === 'http:') return Promise.reject(new Error('Native offline test'));
              return originalFetch(input, options);
            };
            """
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let arguments = ProcessInfo.processInfo.arguments
        guard !verificationStarted && (arguments.contains("--verify-language-packages") || arguments.contains("--verify-offline-packages") || arguments.contains("--verify-english-corrections") || arguments.contains("--verify-japanese-corrections")) else { return }
        verificationStarted = true
        verifyPackages(attempt: 0)
    }
    private func verifyPackages(attempt: Int) {
        webView?.evaluateJavaScript("Boolean(document.documentElement.dataset.catalogState === 'ready')") { [weak self] value, _ in
            guard let self = self else { return }
            guard value as? Bool == true else {
                if attempt < 50 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.verifyPackages(attempt: attempt + 1) } }
                else { print("NATIVE_PACKAGE_QA_ERROR app did not become ready") }
                return
            }
            self.webView?.callAsyncJavaScript("""
                const wait = async predicate => {
                  const deadline = Date.now() + 45000;
                  while (!predicate()) {
                    if (!document.querySelector('#retry').hidden) throw new Error(document.querySelector('#status').textContent);
                    if (Date.now() > deadline) throw new Error('Timed out waiting for native study view');
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                };
                const select = (id, value) => {
                  const element = document.getElementById(id);element.value = value;
                  element.dispatchEvent(new Event('change', {bubbles:true}));
                };
                if (!window.crypto?.subtle) throw new Error('Web Crypto is unavailable in the native WebView');
                const pairs = [];
                const checks = japanese ? [['ja','en','ja-lex-7985a44e7b819ef6641a','in what manner'],['ja','ko','ja-lex-7985a44e7b819ef6641a','어떻게']] : english ? [['en','en','en-lex-d2e8946b4935cf8fc6d1','angular momentum'],['en','ko','en-lex-d2e8946b4935cf8fc6d1','각운동량']] : [['de','ko','de-noun-abend-editorial-main','저녁'],['de','en','de-noun-abend-editorial-main','evening'],['zh','en','hsk1_1','to love; to like deeply'],['zh','ko','hsk1_1','사랑하다; 좋아하다']];
                for (const [target, explanation, entryId, meaning] of checks) {
                  document.querySelector('[data-tab=settings]').click();
                  await wait(() => document.querySelector('#manage-packages'));
                  if (!offline) {
                    document.querySelector('#manage-packages').click();
                    await wait(() => document.querySelector(`[data-language=${target}]`));
                    document.querySelector(`[data-language=${target}]`).click();
                    await wait(() => document.querySelector(`[data-explanation=${explanation}]`));
                    const missing = document.querySelector(`[data-explanation="${explanation}"] .download-package`);
                    if (missing) {missing.click();await wait(() => document.querySelector(`[data-package="${target}-${explanation}"]`) && !document.querySelector(`[data-explanation="${explanation}"] .download-package`));}
                    document.querySelector('[data-tab=settings]').click();
                  }
                  await wait(() => document.querySelector('#target'));
                  select('target',target);
                  await wait(() => document.querySelector(`#explanation option[value=${explanation}]`));
                  select('explanation',explanation);
                  await wait(() => document.querySelector('#package-status').dataset.state === 'ready');
                  document.querySelector('[data-tab=home]').click();
                  await wait(() => document.querySelector('[data-route=wordlist],[data-quiz=wordlist]'));
                  if (english || japanese) {const level=japanese?'N5':'IELTS 4.0–6.5';document.querySelector(`[data-level="${level}"]`).click();await wait(() => document.querySelector('[data-route=wordlist]'));}
                  document.querySelector('[data-route=wordlist],[data-quiz=wordlist]').click();
                  if (english || japanese) {
                    await wait(() => document.querySelector('#search-input'));
                    const input=document.querySelector('#search-input');input.value=japanese?'どう':'spin';input.dispatchEvent(new Event('input',{bubbles:true}));
                    await wait(() => document.querySelector(`.wl-row[data-word="${entryId}"] .wl-meaning`)?.textContent.includes(meaning));
                  } else await wait(() => document.querySelector(`.wl-row[data-id="${entryId}"] .wl-meaning`)?.textContent === meaning);
                  pairs.push(target + '-' + explanation);
                }
                const result = {passed:true,pairs,origin:location.origin,wordCount:document.querySelectorAll('.wl-row').length,locale:document.documentElement.lang};
                if (english || japanese) return JSON.stringify(result);
                document.querySelector('[data-tab=settings]').click();
                await wait(() => document.querySelector('#target'));
                select('target','');
                await wait(() => document.querySelector('#explanation'));
                select('explanation','');
                await wait(() => document.querySelector('#target option:checked') && document.querySelector('#explanation option:checked'));
                result.placeholders = [document.querySelector('#target option:checked').textContent,document.querySelector('#explanation option:checked').textContent];
                return JSON.stringify(result);
                """, arguments: ["offline":ProcessInfo.processInfo.arguments.contains("--verify-offline-packages"),"english":ProcessInfo.processInfo.arguments.contains("--verify-english-corrections"),"japanese":ProcessInfo.processInfo.arguments.contains("--verify-japanese-corrections")], in: nil, in: .page) { result in
                    switch result {
                    case .success(let value): print("NATIVE_PACKAGE_QA_RESULT \(value)")
                    case .failure(let error): print("NATIVE_PACKAGE_QA_ERROR \(error)")
                    }
                }
        }
    }
    #endif
}
