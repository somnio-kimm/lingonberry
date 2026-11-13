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

`lexicon-flashcard-view.js` owns the two card faces, controls and event cleanup. Card order, index and flip state remain in the presentation. The derived order is reconciled when the eligible set grows or shrinks, including status changes made from another section.
