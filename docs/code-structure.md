# Runtime responsibilities

The app uses plain modules with data/model functions separated from view/event code. A small feature does not need a new framework, generic controller hierarchy or a second application state store.

- `web/js/packages/`: validate downloaded data, compatible explanation sets, licences and source identity; assemble installed content. Downloaded packages never provide executable code.
- `web/js/presentation/`: adapt installed words and coordinate existing Study/Review routes, progress and quiz lifecycle.
- `web/js/shared/*-model.js`: feature data preparation and query operations. Keep these free of DOM access, local storage and presentation strings so filtering, ambiguity rules and pagination can be tested directly.
- `web/js/shared/*-view.js`: markup and view-owned events. Reuse `study-components.js`, `study-theme.css` and the shared design reference. Return cleanup for pagers and event handlers.
- Feature text belongs outside HTML/event code. Ordinary shared labels use `lexicon-text.js`; the root inventory's source-language labels, usage labels and count formatting live in `morpheme-text.js`.

## Shared mechanics

- `typing-answer.js`: one device-keyboard/IME lifecycle with explicit readiness and active-view gates.
- `mistake-balance.js`: outstanding-mistake arithmetic; adapters retain their own history formats.
- `random.js`: one nonmutating shuffle and random selection implementation.
- `vocabulary-spellings.js`: one normalised lemma/hanzi and curated-alias identity for vocabulary questions and German Cloze; reference forms remain separate.

The [whole-source audit](runtime-audit.md) records concrete removals, intentional language boundaries and remaining coupling hotspots.

## Root inventory example

`createMorphemeModel(rows,words)` prepares the search index and an ambiguity-safe dictionary lookup once when the installed explanation data changes. The presentation reuses it while switching tabs or refreshing the screen. The view asks the model for filtered rows or a bounded related-word page; it does not rebuild source relationships, infer dictionary senses or calculate pagination inline.

`MORPHEME_PAGING` names rendering thresholds in one place. These limits control DOM size, not content coverage. Inventory totals come from loaded data; neither the UI nor the native verification assumes a fixed published count.

The view uses named card, word, result and event functions. Filtering keeps the existing search field and keyboard focus. Cleanup disconnects the incremental pager and clears view-owned handlers. Downloaded data, stable IDs, defaults and progress remain unchanged by this refactor.

## Extending or simplifying code

Follow the existing feature boundary first. Extract a model when it owns a real reusable data rule; extract a view when it owns a complete screen or component lifecycle. Do not create a wrapper merely to rename one call, duplicate a second source of truth, or combine unrelated features into a universal configuration object.

The multilingual presentation still coordinates several established screens and the German/Chinese renderers retain their existing adapters. Further extraction should follow one screen or responsibility at a time with its existing tests, rather than replacing all language flows in one refactor.

Dictation has one shared screen renderer (`listening-view.js`) and common display copy (`listening-text.js`) for all study languages. The generic presentation supplies filtering, progress and retest hooks rather than its own listening markup. `japanese-furigana.js` owns the installed reading/form index and escaped ruby projection; it does not alter question answers, packages or learner IDs. Listening cleanup is idempotent and owned by the mounted screen.

`shared/word-status-migration.js` owns one-time manual marker transfer for explicitly equivalent content IDs. German applies it when setting installed Review content; the additional-language store reuses it through its existing migration method. Each store retains its own persistence and answer history.

German `core/verb-persons.js` is the small data-policy boundary for person eligibility, shared by package validation and grammar-question generation/validation. No view owns or infers lexical restrictions. Run `verify-german-verb-persons-browser.mjs` for fresh and persisted questions across all seven tenses.

## Sentence preparation cache

The shared sentence engine keeps only the most recent immutable word set for each of Cloze and Scramble. It compares ordered word-object identities and explanation language, so fresh filtered arrays can reuse preparation while changed filters, order or installed content rebuild safely. Draws still create new choices, focus objects, token arrays and shuffled pools. The presentation clears both caches when replacing or releasing installed study content; caches never own progress or persisted question snapshots.

## Additional-language progress persistence

The production shell injects `lexicon-storage.js` into the additional-language presentation and waits for its `ready()` barrier. IndexedDB keeps profile metadata, word markers and wrong-answer records separately. `progress-journal.js` durably records small pending operations in localStorage before asynchronous commits; revisions protect updates that arrive during a write. Startup replays unfinished operations before showing history. Legacy records are imported without rewriting their snapshots, then their old storage key becomes a small preference marker. New records use the shared compact question snapshot; selected examples, readings, sense IDs, levels and grading fields remain self-contained.

The store owns in-memory state and mistake arithmetic; the journal owns recovery/queueing; the backend owns atomic IndexedDB operations. Correct answers that change no progress cause no write. Reset clears the profile markers and history atomically while retaining preferences. The synchronous injected-storage mode remains available for isolated tests and legacy fixtures, rather than introducing a second live production state owner.

## Package metadata index

Package database version3 stores small metadata rows beside immutable payloads. The version2 upgrade builds that index once in the upgrade transaction. Installation, replacement and removal update both stores in one transaction; a metadata failure rolls back the payload change as well. Listing installed languages reads only metadata. `shared/indexed-database.js` owns connection retries, blocked upgrades, version-change cleanup and committed result delivery for package and progress backends. Schema upgrades and language policies remain in their owning modules. Transaction callbacks enqueue requests synchronously; asynchronous work happens outside the transaction callback.

`lexicon-wordlist-view.js` owns Word List markup, delegated row/speaker keyboard actions, search-field events and pager cleanup. The presentation still owns query/filter state and supplies dictionary/reading projection callbacks. Only results are rerendered while typing, keeping the search input and device-keyboard focus stable.

`flashcard-session.js` owns fixed-round ordering and reconciliation. `flashcard-study.js` shares scope changes, set sizing, repeat and flip state across the presenters. The language adapters supply eligible words, progress writes, readings and audio. `lexicon-flashcard-view.js` owns the two card faces, controls and event cleanup.

Progress load failures keep Settings available for retry or another language, but erasure is bound to the selected hydrated runtime, never the fallback renderer. Unknown/unreadable legacy state cannot initialise an empty canonical profile; an existing canonical profile remains recoverable even if its old marker is damaged.

`lexicon-review-view.js` owns Review markup, row actions, deletion confirmation and event cleanup. The presenter supplies filtered row models and keeps eligibility, historical-answer projection, filters and retest queues. Returning the view cleanup prevents stale handlers after navigation.

Native DEBUG checks live in `NativePackageVerification.swift`; the app controller only manages WebView injection, readiness and completion. Release excludes the verification helper. See `native-verification.md` for the opt-in checks and migration evidence.

The German progress store retains historical course records and retest readers, but no longer exposes the unused course-only stage, draft, hint, check, listened, transcript, recording, beginRun and retry writers. Runtime call-site and dynamic-access audits found no consumers. This removes obsolete write paths, not learner data.

The German sentence stylesheet keeps a single global tools/options/tiles block. Exact repeated selectors and declarations were removed only from the earlier copy; later cascade overrides and language-specific reading rules remain in place.

`meaning-distractors.js` owns bounded random candidate sampling and visible-format balancing for the shared Meaning Quiz. Prepared rows retain exact definitions and spelling/meaning exclusion keys. Sampling visits independent positions without copying the complete pool for every question, prefers comparable lengths and avoids a unique initial against an otherwise matching set. Sparse pools can use fewer choices. No saved snapshot is regenerated.

## Shared default vocabulary screen

`vocabulary-view.js` owns Word Input/Meaning Quiz markup, question/feedback/input state, IME binding, hint/result display, bounded current-filter pool reuse and teardown for every language. German/Chinese modules are adapters; the generic presentation delegates defaults and keeps only specialist exercise rendering. A single mounted practice cleanup now covers both vocabulary and Dictation.

Adapters supply word filters, pool/grading policies, reading/article markup, speech and history writes. The shared screen passes both the selected option ID and its displayed text: generic history keeps IDs while existing German/Chinese history keeps displayed answers. Saved question IDs, snapshots and the exact selected example stay intact. Filters may remain presenter-owned through the existing bind callback; no second persistent state store is introduced.

## Shared sentence presentation

`lexicon-sentence-view.js` now renders Cloze and Scramble for all four released languages: tools, translation target, options, answer/pool cards and action placement have one implementation and one set of semantic control attributes. German inflection/choice construction and Chinese character/pinyin preparation stay in their adapters. Japanese ruby and separated typing gaps retain their existing policies.

Legacy adapters project their original questions into a temporary view model and still save/grade the original question. `projectScrambleTiles` maps existing chosen/pool objects to view indices without rewriting stored tokens, punctuation or IDs. The shared renderer returns cleanup; adapters release old handlers before redraw and unmount. The generic presenter reuses its single practice cleanup slot. Regression selectors now target shared controls rather than language-specific button IDs.

## Study menu components

`study-menu-view.js` owns menu tiles and level-choice markup, escaping, icons and selected-state accessibility. Adapters provide translated available routes and level labels; they retain navigation and level-selection policy. Mandarin asynchronous level loading and its overlay are unchanged. The two existing route/selector variants remain data conventions, not separate renderers. Wide labels use the existing responsive layout.

Word List now delegates from German/Chinese as well as the generic presenter. The shared view coalesces result updates, owns IME/search focus, initial selection, pager redraw and event cleanup. Adapters retain German matching, Chinese pinyin matching, grouped English senses, status filters and dictionary controls. Current query and initial survive internal redraws; a new mount starts from its supplied state.

`review-card-view.js` renders the common exercise/POS/level header, mistake balance, deletion control, word/meaning block and answer separator for every Review format. Outer card event keys, filtering, queues and language-specific answer fragments remain adapter-owned. German adjective noun blocks and Chinese stored syllables pass through the same hierarchy without rewriting history. Plain labels/meanings are escaped; reading and answer HTML comes only from bundled renderers.

`clearCombinedClozeCache(engine)` pairs with the sentence-engine reset on study replacement/release, so old English content is not retained by the combined expression/ordinary-sentence preparation. Other engines keep their own active rotations. Runtime structure can be re-audited with `node scripts/audit-runtime-structure.mjs`; the normal architecture tests also enforce graph and shared-layer boundaries.
