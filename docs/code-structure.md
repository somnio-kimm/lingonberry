# Runtime responsibilities

The app uses plain modules with data/model functions separated from view/event code. A small feature does not need a new framework, generic controller hierarchy or a second application state store.

- `web/js/packages/`: validate downloaded data, compatible explanation sets, licences and source identity; assemble installed content. Downloaded packages never provide executable code.
- `web/js/presentation/`: adapt installed words and coordinate existing Study/Review routes, progress and quiz lifecycle.
- `web/js/shared/*-model.js`: feature data preparation and query operations. Keep these free of DOM access, local storage and presentation strings so filtering, ambiguity rules and pagination can be tested directly.
- `web/js/shared/*-view.js`: markup and view-owned events. Reuse `study-components.js`, `study-theme.css` and the shared design reference. Return cleanup for pagers and event handlers.
- Feature text belongs outside HTML/event code. Ordinary shared labels use `lexicon-text.js`; the root inventory's source-language labels, usage labels and count formatting live in `morpheme-text.js`.

## Root inventory example

`createMorphemeModel(rows,words)` prepares the search index and an ambiguity-safe dictionary lookup once when the installed explanation data changes. The presentation reuses it while switching tabs or refreshing the screen. The view asks the model for filtered rows or a bounded related-word page; it does not rebuild source relationships, infer dictionary senses or calculate pagination inline.

`MORPHEME_PAGING` names rendering thresholds in one place. These limits control DOM size, not content coverage. Inventory totals come from loaded data; neither the UI nor the native verification assumes a fixed published count.

The view uses named card, word, result and event functions. Filtering keeps the existing search field and keyboard focus. Cleanup disconnects the incremental pager and clears view-owned handlers. Downloaded data, stable IDs, defaults and progress remain unchanged by this refactor.

## Extending or simplifying code

Follow the existing feature boundary first. Extract a model when it owns a real reusable data rule; extract a view when it owns a complete screen or component lifecycle. Do not create a wrapper merely to rename one call, duplicate a second source of truth, or combine unrelated features into a universal configuration object.

The multilingual presentation still coordinates several established screens and the German/Chinese renderers retain their existing adapters. Further extraction should follow one screen or responsibility at a time with its existing tests, rather than replacing all language flows in one refactor.
