# Dictionary-backed practice

Japanese and English use the same bundled question renderer, device keyboard, filters, grading, feedback and Review store as the other vocabulary modes. The downloaded core contains bounded, validated facts; it cannot supply executable code. The independently downloaded explanation package still supplies vocabulary meanings and original contextual exercise guidance.

## Japanese

- Word readings use the selected dictionary pronunciation, explicit reviewed alternatives and an ambiguity exclusion policy. Unresolved homographs are withheld rather than accepting unrelated senses. Kana-only words do not need kanji-reading exercises.
- Kanji/okurigana boundary questions are generated only for a contiguous kanji group followed by a matching kana suffix. They separately ask for the kanji reading portion or the written ending. They never guess how a multi-kanji group divides internally.
- On’yomi/kun’yomi use KANJIDIC2's `ja_on`/`ja_kun` attributes. The prompt explicitly asks for a listed character reading, not the reading necessarily used in the linked word. All listed readings are accepted. Kun-reading answers include the ending after a dot; dots/hyphens are omitted in input, while long vowels are preserved. Nanori and search codes are excluded.
- Plain-form transformations use source-attested paradigms and individually reviewed class bridges. Kana and written alternatives are accepted. Full causative/causative-passive prompts explicitly request the uncontracted form. Lexical exceptions are withheld by the source compiler; a generic table is not treated as proof that every voice/potential form is a natural learner target.
- Particles, counters, transitivity and confusable kanji use original contextual questions. Their presence at every level is not an exhaustive question bank for every entry.

## English

- Articles and Countability is no longer offered as a test. Old package data remains readable so installed downloads and saved progress are compatible.
- Root Families presents familiar roots, prefixes and suffixes with a short origin label, English/Korean meaning and related dictionary words. Browse includes all curated families; Practice follows the selected study level. Confusable Words remains a separate feature: spelling similarity alone does not establish a common root. The advanced historical-source audit remains an editorial reference, not the learner browser.
- Collocations, phrasal verbs, verb patterns and confusables use contextual original exercises. Source relations without a disambiguated question and bilingual guidance remain audit candidates; an audit candidate is not a ready exercise.

## Study screens

Meaning Quiz and Word Input contain only ordinary vocabulary. Each specialist category has its own Study button, with Selection/Typing switches where both are available. Choices check immediately when tapped, following German and Chinese; typing uses Submit. Japanese answer gaps use single underlines. English-with-English explanations keep word definitions but omit example-sentence translations.

## Sources and commercial reuse

KANJIDIC2 readings are credited to James William Breen and the Electronic Dictionary Research and Development Group under CC BY-SA 4.0. Documentation: https://www.edrdg.org/wiki/KANJIDIC_Project.html ; licence: https://www.edrdg.org/edrdg/licence.html . The exact downloaded snapshot hash is retained in the release notice. The app's Licence sheet includes persistent project and licence links. Only character literals and reading fields are imported.

Imported Wiktionary facts retain contributor attribution, CC BY-SA 4.0 and article links; contributor history is accessible through each source article. Existing NIKL and other dictionary licences remain unchanged. Original authored exercise prompts and bilingual explanations are MIT. The code's MIT licence does not replace the imported content licences. No publisher exercise banks, attributed quotations, audio or logos are imported.

## Reproduction and release

1. Preserve the approved source audits under `local-data/feature-coverage-ja` and `local-data/feature-coverage-en`. These include selected source rows, provenance hashes and explicit withheld decisions; they are not shipped as learner questions.
2. Run the language-specific `scripts/content/build-*-practice-data.py` compilers and the English historical-source compiler. They reject changed or invalid audit inputs rather than silently broadening approval.
3. Download an official KANJIDIC2 snapshot, then run `scripts/content/import-kanjidic-practice.py XML.gz CORE.json OUTPUT.json`. The importer reads a strict field allowlist.
4. Run `scripts/build-dictionary-practice.mjs --language ja` / `en`. It produces immutable new study/explanation packages, integrity-bound catalogues and per-entry practice coverage. Published bytes cannot be overwritten.
5. Run unit, package-backed browser and native online/offline checks before pointing the mobile content source at the pushed immutable commit.

The coverage ledgers distinguish actual exercise categories from the default vocabulary modes. Empty specialised coverage is not a claim that a word has no linguistic relationships. The source audits retain unresolved/context-dependent cases for later editorial review. These datasets have computational validation and AI-assisted linguistic review, not native-speaker certification.

## Release verification — 20 October 2026

Japanese 4.2 retains 12,027 entries and generates 61,162 questions. Its source-backed metadata includes all 2,575 corpus kanji and all 1,402 verb/adjective entries (11,953 form groups; 51 lexical feature groups deliberately excluded). English 4.3 retains 12,356 entries, provides 7,612 countability records and 611 historical-source families covering 2,294 entry IDs. Fifteen noun cases remain withheld from countability grading; their exact reasons are recorded in `language-packages/sources/exercises/en-countability-review.json`.

Validation passed: 328 unit tests, JavaScript/JSON/offline-shell checks, 32 package-backed category/locale browser paths, root-search keyboard focus, concealed answers, grading and offline reuse. The broader five-language browser suite also passed download/removal, keyboard/IME, default quizzes, Review and retests.

The installed iPhone 18 Pro Max / iOS 27.0 simulator passed Japanese and English native checks online and with HTTP/HTTPS fetches blocked, each using both English and Korean explanation packages. Native checks verified broad package data rather than only starter menus: 7,147 Japanese Form Input questions at N1 and 665 English Articles and Countability questions at the highest IELTS study group. The app was relaunched normally and its Study screen visually verified in Device Hub.
