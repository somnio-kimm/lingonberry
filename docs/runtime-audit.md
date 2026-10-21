# Whole-source sharing and cleanup audit — 21 October 2026

The audit inventories authored runtime, build/content scripts, tests and native app sources, then follows imports/references and manually reviews repeated behaviours and unused candidates. It does not treat identifier search alone as proof that a function can be deleted.

Scope after this pass: 287 source files — 125 JavaScript, 119 MJS, 34 Python, 3 native Swift, 5 CSS and the web entry HTML. The web runtime contains 124 JS modules. Generated native web copies, dependencies, Git history, private source caches and immutable data snapshots are excluded from clone counts. Exact whole-module byte clones: zero. The architecture tests also verify that every shipped module is reachable and that shared runtime modules do not import language views.

## Changes made

| Finding | Resolution |
| --- | --- |
| Three versions of outstanding-mistake arithmetic | `mistake-balance.js` owns repayment/increment/skip rules. German dismissal/review flags and Chinese initial-record semantics stay in their adapters. The generic store uses the same policy. |
| Repeated device-keyboard and IME event code | `typing-answer.js` owns input/composition/Enter handling, enabled state and listener cleanup. Used by German/Chinese vocabulary, German forms, shared dictation and generic exercises. Audio readiness remains an explicit gate. |
| Four copies of Fisher–Yates | `random.js` supplies nonmutating shuffle and random selection, with seeded RNG injection. Existing adapter exports remain compatible. |
| Retired mixed-default exercise selectors and counting helpers | Removed. The active source-row selector now selects within one specialist feature and avoids repeats. Defaults remain vocabulary-only. |
| Removed countability exercise generator and superseded historical-root projection | Removed runtime code; source validators, archived packages and attribution remain. Tests for retired UI code were replaced/removed while source-schema boundary tests remain. |
| Unused SRS/session updates, old quiz result/colour helpers and checkpoint summary | Removed after confirming no runtime/build/script callers. Active review scheduling and statistics remain. |
| Repeated repository URL in language metadata | Reuse `app-config.js`. |
| Saved questions from removed modes could crash Review | Safe title resolution retains historical Review and retesting without reintroducing the removed Study section. Browser regression covers both UI languages. |
| Main browser menu test predated standalone collocations | Corrected the explicit expected menus; the restored main German/Chinese suite passes. |

## Parts already shared and retained

Package download/integrity/schema validation and atomic installation, independent explanation assembly, vocabulary and sentence engines, device speech, shared dictation rendering, source-aware Review helpers, package/settings UI, design tokens/components and the generic presentation for five languages already have shared implementations. Versioned content builders use the common immutable package writer; language-specific extraction/review rules remain separate.

German noun articles/forms and Mandarin pinyin, character readings, homophones and answer normalisation are different policies. Their storage/history adapters also interpret different existing formats. Combining them into one flag-heavy store or renderer would hide these distinctions and risk progress compatibility. Shared mechanics now sit below those policies.

## Boundaries and remaining maintainability work

The multilingual presentation remains the largest coordinator (about 40 KiB), with several screen templates in one module. It is a remaining coupling hotspot, not a finding that every line is duplicate or unused. A later extraction should move one complete screen/state responsibility with its regression tests rather than splitting template fragments into generic wrappers. Likewise, legacy CSS intentionally has shared overrides; selector names assembled at runtime prevent a simple text search from proving that all unmatched selectors are dead.

Public helpers used by build/content tools or by meaningful unit tests were not removed merely because no other browser module imports their name. No unused module was found in the shipped import graph. This audit and the tests establish the reviewed boundaries and concrete removals; they are not a proof that no future duplication or unreachable branch can exist.

## Validation

- 358 active unit tests and JavaScript/JSON/offline-shell checks pass. The count removes five tests for retired helpers/UI and adds regression tests for shared policies and random utilities.
- Main German/Chinese browser suite: download/update/removal, audio-first dictation, routes, Settings, offline reuse and failure recovery pass.
- Five-language suite: explanation sets, keyboard/IME, grading, Review/retests, level filters and offline/removal behaviour pass.
- All-seven-language collocation tests and 28 Japanese/English specialist/locale paths pass; source-selection cleanup preserves the active filtering contract.
- Retired-mode Review/retest regression passes in both UI languages; removed section stays absent from Study.
- Eight German/Chinese shared-design contracts pass at phone/tablet widths in light/dark themes.

Shared policies have focused unit tests for their failure cases. A lower line count or a higher test count is not treated as evidence of better architecture on its own.
