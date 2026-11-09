# Lingonberry

One offline language-learning app with separately downloadable study content and explanation packs.

Choose a Study Language and Explanation Language in Settings. Download or remove explanations through Language Packages; shared study content is reused automatically. Installed content works offline. The interface follows the selected explanation language, with English as the fallback. Package updates are managed in Settings; automatic Wi-Fi-only update scheduling remains pending.

Chinese, German, Japanese, Korean, English, Spanish and French are available. English/Korean explanation coverage varies by study language; only complete offered pairs appear in the package manager. English also offers English self-explanations. The other same-language explanation pairs are omitted.

## Study

The shared sections are Word List, Flashcards, Meaning Quiz, Word Input, Cloze, Sentence Scramble and Dictation, in that order. Dictation has Word and Sentence modes and uses device speech. Search stays inside the selected level.

English expressions are dictionary entries and participate in Meaning Quiz and Cloze. Authored discontinuous phrases use one input per blank, preserving intervening objects. Root Families shows only related words available in the installed Word List. Chinese has one Pronunciation section with Pinyin Input and Tone Selection. German offers Article Selection and Form Input; Japanese offers Word Reading and Okurigana. Language-specific exercises retain the shared German/Chinese design.

## Current Content

The English 7.0.0 edition contains **40,710 sense entries**, covering **20,603 single-word headwords** and **10,247 multiword headwords**. Every retained sense has its own level, English definition, concise Korean meaning, example and Korean sentence translation. Different useful meanings can therefore appear as separate Word List rows and Flashcards at different levels.

The four English groups are editorial IELTS-style difficulty bands: 1.0–3.5, 4.0–6.5, 7.0–8.0 and 8.5–9.0. They are not official IELTS/SAT/GRE vocabulary lists. The inventory favours useful everyday, professional, academic and literary uses through GRE-level usage; minor obsolete branches and duplicate cards were excluded or consolidated. See the [release report](language-packages/sources/english-reviewed/7.0.0/report.json) and [review process](docs/english-content-review.md).

German 3.2.0 has 11,293 entries, Chinese 2.2.0 has 11,003 and Japanese 4.5.0 has 12,032, with compatible English/Korean explanation packs. Their full entry-by-entry review is ongoing; the current release does not include its unfinished proposals. German A1–B1 uses matched Goethe material, with editorial B2–C2 groups. Chinese retains official syllabus identities/levels. Japanese JLPT placements are editorial. Reviews are AI-assisted; native-speaker certification remains pending. See [multilingual review](docs/multilingual-content-review.md), [meaning style](docs/meaning-style.md) and [source migration](docs/vocabulary-migration.md).

## Development

Use Node.js 26.11.1+ and npm 12.2.0+:

```sh
npm ci
npm run check
npm test
npm start
```

The local preview opens at http://127.0.0.1:4188. For browser verification, install Chromium with `npx playwright install chromium`, then run `npm run verify:browser`. Verify the published English payloads with `node scripts/verify-reviewed-english-browser.mjs --published`.

After changing bundled files, run `npm run shell:sync`. See [contribution rules](CONTRIBUTING.md), [runtime structure](docs/code-structure.md), [shared design](docs/study-design.md) and [iOS wrapper](mobile/README.md). The repository builds one app; language packages contain validated data rather than executable feature code.

Learner progress is namespaced by study language and stable IDs. Genuine equivalent identities can migrate; corrected or incompatible saved questions are invalidated without erasing unrelated study data. Downloads validate identity, schema, byte length and SHA-256 before atomic installation. Failed downloads preserve usable installed content.

## Sources and Licensing

Code is MIT-licensed. Imported definitions, examples and adaptations retain their own per-record licences and credits; the app's Licence view combines study and explanation notices. Original editorial text, Wiktionary adaptations, NIKL sources and other datasets are distinguished. Private research quotation caches and unfinished drafts are excluded from the public release. See [licensing](LICENSE), [source reports](docs/multilingual-broad-dictionaries.md) and [example authoring](docs/example-authoring.md).

Support development through [PayPal](https://paypal.me/somnio97). Use Send Bug Report in Settings for reproducible reports and device/app information.
