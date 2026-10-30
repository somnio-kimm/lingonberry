# Lingonberry

One offline-first language-learning app with downloadable study-language packages.

Choose a **study language** (Chinese, German, Japanese, Korean, English, Spanish or French) and an independent **explanation language** (English or Korean initially). Study cores and explanation pairs are separate downloads: for example, German core + German → Korean. Download German → English separately to switch explanations. Chinese works the same way, and installed pairs remain available offline.

Use this folder as the sole active project. Retired source and history are preserved only in ignored recovery backups; see [workspace layout and generation data](docs/workspace.md). Chinese and German content and exercises have been migrated. Every language offers Word List, Flashcards, Meaning Quiz, Word Input, Cloze, Sentence Scramble and Dictation (Word and Sentence), in that order. Shared [collocations](docs/collocations.md) appear in Word List/details and a separate Collocations screen with Selection and Typing modes for all seven languages. Language-specific exercises follow these shared defaults. English [Root Families](docs/learner-root-families.md) browses the full readable source inventory with 5,863 entries and complete English/Korean meanings; Confusable Words is no longer offered as a Study section. See [shared study modes](docs/shared-sentence-practice.md).

## Development

Use Node.js 26.11.1 or newer and npm 12.2.0 or newer:

```bash
npm ci
npm run check
npm test
npm start
```

See [architecture](docs/architecture.md) and [contribution rules](CONTRIBUTING.md). Changes are reviewed through small issue-linked PRs; `main` is the integration branch.

The local preview opens at `http://127.0.0.1:4188`. In **Settings → Language Packages**, open a study language and use Download or Remove for explanations; the required study content is managed automatically. Choose a downloaded study/explanation pair in the same Settings card, then return to Study. Selection and app restart never download missing packages. The archived study screens are restored; German 3.0.0 contains 11,288 entries (11,283 distinct headwords); Chinese 2.0.0 retains 11,000 entries. Both have separate English/Korean explanations and translated examples. German A1–B1 follows matched official Goethe adult headwords; B2–C2 uses provisional editorial frequency tiers. See [German expansion](docs/german-vocabulary-expansion.md) and [the archived migration](docs/vocabulary-migration.md) for provenance, counts and pending native-speaker review. Automatic Wi-Fi update scheduling remains pending. See [package management](docs/downloaded-packages.md). An iPhone simulator wrapper is documented in [mobile/README.md](mobile/README.md).

For browser checks, run `npx playwright install chromium` and `npm run verify:browser`.

## Code Structure

Shared runtime, Settings and exercise engines live in `web/js/shared/`. Language adapters in `web/js/presentation/` connect those services to the Chinese and German exercise policies and existing progress stores. Downloadable package storage stays in `web/js/packages/`. See [code ownership and design](docs/code-architecture.md) for the boundaries and extension guide.

After editing bundled files, run `npm run shell:sync`, then `npm run check`, `npm test` and `npm run verify:browser`. The checks catch stale offline-cache inventories, broken imports and unreachable modules.

## Additional Language Dictionaries

The 3.0.0 editorial preview contains 54,097 entries across Japanese JLPT N5–N1, Korean TOPIK 1–6, English IELTS study groups (1.0–3.5, 4.0–6.5, 7.0–8.0 and 8.5–9.0), Spanish DELE A1–C2 and French DELF/DALF A1–C2. The eligible English/Korean explanation pairs are available, with English explanations only for Korean study. English uses four discrete editorial study groups and ordinary topic filters, with no exam filters; see [English level assignments](docs/english-study-levels.md). The 281 original examples plus 5,786 newly authored examples provide 6,067 entries with complete usage examples; 48,030 entries still need one. Native-speaker review remains pending. Source sentences without translations are labelled separately and do not enter sentence quizzes. See [counts, sources, licences and remaining work](docs/multilingual-broad-dictionaries.md). Run `node scripts/verify-multilingual-browser.mjs` for browser checks.

[English 4.0.0](docs/english-meaning-corrections.md) resolves all 4,347 findings from the earlier linguistic review and provides 11,977 active entries with English/Korean meanings. Source evidence, retired/replacement identities and original versions are preserved. This is AI-assisted source adjudication; native-speaker certification remains pending.

[Japanese 4.0.0](docs/japanese-meaning-corrections.md) reviews all 12,027 entries and their English/Korean meanings, applies 2,891 corrections and 66 explicit concept replacements, and repairs seven of the 2,027 existing bilingual examples. JLPT levels and learner history are preserved; native-speaker certification remains pending.

Japanese 4.2 extends source-backed character readings to all 2,575 kanji in the dictionary and plain-form practice to all 1,402 verbs/adjectives. English 4.3 adds broad noun countability and searchable historical-source families. Both include additional original exercises across every study level, while contextual grammar and collocation banks remain curated. See [dictionary-backed practice, licensing and coverage](docs/dictionary-practice.md) for the distinction between supported entries and remaining editorial gaps.

The requested [explanation matrix](docs/explanation-matrix.md) has 43 pairs: every other supported language, plus English → English. Thirteen pairs currently have complete downloadable packages; the other 30 require further translation work. Partial extra-language texts are retained in authoring records without being offered as complete downloads. See [example authoring and coverage](docs/example-authoring.md).

UI development follows the [shared German/Chinese design reference](docs/study-design.md), reusable components and browser parity checks.
