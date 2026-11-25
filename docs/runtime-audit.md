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

## 23 November 2026 sharing pass

The current pass retains plain modules and the component/adapter boundary. The shipped JavaScript inventory has 163 modules and 624697 bytes (before: 160 modules / 636492 bytes). Counts exclude the generated service worker, native web copies, dependencies, private authoring proofs and immutable source/content archives. More shared modules do not mean more copies of application state.

| Repeated responsibility | Current owner | Adapter responsibilities retained |
| --- | --- | --- |
| Word Input / Meaning Quiz rendering and lifecycle | `vocabulary-view.js` | Grading, article/reading markup, filtered inventories, source revisions and existing saved-answer formats |
| Cloze / Scramble question, options, tools and actions | `lexicon-sentence-view.js` | German inflections, Mandarin target/pinyin preparation, Japanese ruby, original questions and grading |
| Object-based Scramble tile projection | `projectScrambleTiles` | Original tokens/punctuation and the history format |
| Study tile and level markup | `study-menu-view.js` | Available routes, translation, level policy and asynchronous HSK loading |
| Word List search/input/pager/row lifecycle | `lexicon-wordlist-view.js` | Matching rules, English sense grouping, status filters and dictionary controls |
| Review card header/word/meaning/answer hierarchy | `review-card-view.js` | History filtering, answer fragments, stored readings, noun extras and retest/removal keys |

Flashcard and Dictation screens, download/storage/settings components and the keyboard/IME primitives remain shared. A mounted vocabulary screen owns only its current filtered pool and releases its input/audio/events on unmount. The generic presenter uses one practice cleanup slot. The combined English Cloze cache now releases both answer-mode preparations when its installed study is replaced/closed, alongside the sentence cache.

Removed after call-site review: unused emoji/colour entries in generic exercise/menu metadata, a retired exercise-selector filter/binding, and old inline-option/reset-control CSS that no active renderer emits. Shared sentence and choice geometry replaced the legacy/inline declarations. Shuffle consumers import `random.js` directly; compatibility exports still point to that single implementation. No content, licence, learner-ID or stored-progress migration is included.

`node scripts/audit-runtime-structure.mjs` reports exact whole-module clones, relative import resolution, entry-point reachability and conservative zero-reference named-import candidates. The current report has no findings in those categories. Fixture tests cover named, side-effect and dynamic import references without executing inspected code. This supplements manual flow/DOM/style review; it does not prove that every possible repeated algorithm or dynamic CSS branch is dead. Historical validators/readers and source archives remain where they preserve existing downloads, saved questions and attribution.

Remaining deliberate boundaries: German grammar/article policy, Chinese pronunciation/SRS policy, Japanese reading/form policy, language-specific dictionary details and legacy history projection. These are supplied to shared screens instead of being merged into one flag-heavy store/controller. Further removal should follow an actual unconsumed responsibility and its regressions.

Validation after this pass:996 unit tests and the JavaScript/JSON/offline-shell checks pass. The browser regressions cover all four released languages, original Review/retests, grouped English senses, initial filters, IME and keyboard actions, old German inflections/punctuation, Chinese pinyin, Japanese ruby and the common design. The native update script also passes its browser extraction check. A queued-result focus race is covered explicitly; Dictation correct-input tests use canonical written words rather than assuming a spoken kana reading is the required spelling.

## 25 November 2026 presentation audit

Reviewed the Study menu, Word List, Flashcards, Word Input, Meaning Quiz, Cloze, Scramble, Dictation, Review, Retest, Settings and package flows against their shared renderers. The shipped JavaScript audit measured 640,340 bytes across 169 modules, compared with 645,441 bytes across 167 modules at the start of this pass.

| Repeated responsibility | Shared owner |
| --- | --- |
| Word-detail markup, focus, audio controls and quiz Next handoff | `dictionary-sheet.js` |
| Review filter panel, row opening, deletion confirmation and Retest activation | `study-components.js` and `lexicon-review-view.js` |
| Retest completion and tally of recorded results | `lexicon-review-view.js` and `retest-results.js` |
| Applying changes to the language runtimes’ Settings mirrors | `app-settings.js` |

Specialist exercise rules, pronunciation markup, saved-answer formats and progress storage stay with the language that owns them. The import audit found zero exact duplicate modules, missing relative imports, unreachable modules or unused named-import candidates.
