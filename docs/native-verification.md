# Native installed-package verification

The DEBUG-only `--update-installed-language-packages` launch flag updates only already-installed language/explanation pairs through Settings → Language Packages. It uses the normal validated, atomic download path and the current bundled immutable catalogue. Uninstalled explanation languages are not added. Explanation and study-core versions are checked independently.

The check restores the original Study/Explanation selection and returns to Study. It does not submit answers or erase learner history. While this opt-in foreground check runs, the app temporarily disables automatic screen locking; completion/error restores the normal idle timer. Normal app launches and Release builds do not run the check.

Results report each pair's previous/current version. Japanese English/Korean pairs additionally check concise 車 meanings and full primary-example/translation coverage; German/Chinese check that the retired Collocations Study route is absent.

Launch the signed DEBUG app on a connected, unlocked device with `xcrun devicectl device process launch --device <device> --terminate-existing --console com.somnio.learnlanguage -- --update-installed-language-packages`. Capture `NATIVE_PACKAGE_QA_RESULT` / `NATIVE_PACKAGE_QA_ERROR`. Disconnecting the console may terminate the test app; relaunch normally when finished.

Run `node scripts/verify-installed-updates-browser.mjs` to execute the exact embedded native check against old installed Japanese packages. It checks explanation-only updates, current-version reuse, exclusion of uninstalled languages, original preference restoration and unchanged stored progress. The same command body is extracted from the Swift DEBUG block, so the browser test does not maintain another copy.
