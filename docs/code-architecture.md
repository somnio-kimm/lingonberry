# Code ownership and design

The archived apps provided the required visual design, but copying their dependency graphs duplicated runtime services and Settings. The unified application uses composition rather than an inheritance hierarchy: the app owns navigation and package installation; language adapters supply learning rules and persistent study state.

## Shared runtime

`web/js/shared/` owns device speech, diagnostics and the report form, app links/version, immutable review snapshots, lazy screen loading, batched word-list rendering and the listening renderer. Consumers import these modules directly; there are no duplicate compatibility copies under each language.

The listening renderer accepts `answerCorrect` from its caller. It handles playback, text entry and feedback; it does not select a language's grading rules. Speech now has one playback coordinator, so changing study language cannot leave two independent speech controllers active.

`web/js/packages/` owns validated downloadable data and IndexedDB. It never imports a view. Study cores and explanation packs remain separately versioned, and progress remains outside package storage. Package selection uses installed-only resolution; only Settings can initiate a download.

`web/languages/` owns language-specific exercise generation, input policy and existing progress formats. Equal filenames alone do not justify consolidation: German and Chinese wrong-answer stores have different history semantics, and pinyin and German inflection require different rules.

## Offline shell

Run `npm run shell:sync` after changing anything in `web/`. The inventory is generated from bundled files and its cache ID is derived from their contents. Downloadable language data stays outside `web/`. `npm run check` and the architecture tests reject stale inventories or broken module references.

## Guardrails

- Shared modules cannot import a language implementation.
- Preserve stored keys and review snapshots during structural changes.
- Keep the archived CSS and language-specific exercise markup as the visual baseline. Consolidating styles requires proving cascade and layout equivalence; removing similar-looking rules blindly would recreate the earlier design regression.
- Prefer small functions with explicit dependencies. A global service locator, event bus, class hierarchy or new UI framework would add indirection without solving the duplicated ownership.

## Exercise strategies

`shared/vocabulary.js` owns pool indexing, synonym groups, same-part-of-speech distractors and question validation. German supplies article-aware answer construction and grading; Chinese supplies character recall and its own cloze eligibility. `shared/vocabulary-review.js` owns the review presentation, with German article requirements passed explicitly.

`shared/listening.js` owns dictation question construction and snapshot validation. Each language supplies its speech locale, spoken word, accepted spellings and normaliser. Mandarin homophone indexing and pinyin keys live only under Chinese; German no longer imports Mandarin logic. Existing question IDs and saved field names remain stable.

## Host-owned screens and adapters

`shared/settings-view.js` is the only Settings implementation. `shared/interface-text.js` owns app-level English/Korean strings, while language i18n modules retain exercise terminology. Package management and licence actions are passed directly into the view; there is no mutation observer patching another renderer's DOM. The old Settings copies, unused corpus-licence sheets, obsolete version.json updater and orphaned theme modules are removed.

`presentation/index.js` registers executable language adapters and the layout identifiers needed by their archived CSS. `presentation/german.js` and `presentation/chinese.js` translate installed data into existing views and expose a small Settings port: values, change, reset, haptic feedback and diagnostic context. The app never needs to know a language's storage keys. Reset affects the selected language, preserves other languages and installed packages, and keeps interface preferences.

To add Korean, English or Japanese as a study language, add its content adapter and exercise policies, register its presentation, and add compatible data packages. To add an explanation language, add package data; do not fork the UI. To add a display language, provide the app/exercise translations and register it in the display-language list. These are three separate concerns.

## Deliberately retained differences

The Chinese SRS and wrong-answer history and the German quiz history remain separate adapters. They are not duplicates: they encode different progression and historical grading contracts. A future shared persistence migration should be a separate, versioned data migration with recovery tests. Likewise, language CSS remains intact alongside the existing shared theme; this refactor changes ownership and execution, not the approved visual layout.

Architecture tests ensure every bundled JavaScript module is reachable, all relative imports resolve, shared modules do not depend on language implementations, and the service worker covers the current source. Exercise-policy tests protect noun articles, same-part-of-speech choices, Chinese cloze eligibility and dictation homophones. Browser checks cover both language routes, Settings actions, offline package use and listening progression with deterministic test speech; that mock is not evidence of native audio quality.


## App-wide settings

Appearance, Display Language, Haptic Feedback and Auto-Remove from Review are owned by the host's `learn-language.preferences.v1` record. `shared/app-settings.js` supplies validation, defaults and the initial legacy migration. All cached adapters receive the same settings after a change and before a screen is rendered; their existing storage fields are compatibility mirrors for exercise logic. Study levels, word status, saved mistakes and progress remain language-specific.

Haptic feedback defaults off, including when older language records inherited the former on default. An explicit app-wide on/off choice persists through language switches and restarts. If no shared Review-removal choice exists yet, migration retains the currently selected language's choice once; subsequent switches never read another language's old choice back into global Settings. Erasing a language's study data keeps shared settings.

Run `node scripts/verify-shared-settings-browser.mjs` to check all seven languages, explanation switches, reloads, haptic on/off behaviour and progress/level retention on phone/tablet in light/dark themes. The DEBUG-only native `--verify-shared-settings` check compares all installed languages and restores the original study/explanation selection without submitting answers or toggling Review removal.
