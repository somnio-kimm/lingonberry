# Dictionary-backed practice

Japanese and English use the same bundled question renderer, device keyboard, filters, grading, feedback and Review store as the other vocabulary modes. The downloaded core contains bounded, validated facts; it cannot supply executable code. The independently downloaded explanation package still supplies vocabulary meanings and original contextual exercise guidance.

## Japanese

- Word readings use the selected dictionary pronunciation, explicit reviewed alternatives and an ambiguity exclusion policy. Unresolved homographs are withheld rather than accepting unrelated senses. Kana-only words do not need kanji-reading exercises.
- Kanji/okurigana boundary questions are generated only for a contiguous kanji group followed by a matching kana suffix. They separately ask for the kanji reading portion or the written ending. They never guess how a multi-kanji group divides internally.
- On’yomi/kun’yomi use KANJIDIC2's `ja_on`/`ja_kun` attributes. The prompt explicitly asks for a listed character reading, not the reading necessarily used in the linked word. All listed readings are accepted. Kun-reading answers include the ending after a dot; dots/hyphens are omitted in input, while long vowels are preserved. Nanori and search codes are excluded.
- Plain-form transformations use source-attested paradigms and individually reviewed class bridges. Kana and written alternatives are accepted. Full causative/causative-passive prompts explicitly request the uncontracted form. Lexical exceptions are withheld by the source compiler; a generic table is not treated as proof that every voice/potential form is a natural learner target.
- Particles, counters, transitivity and confusable kanji use original contextual questions. Their presence at every level is not an exhaustive question bank for every entry.

## English

- Countability prompts normally ask about recorded dictionary uses. A separately reviewed selected-sense fact instead displays the study meaning and asks about that meaning. Mixed plural-only/countable/uncountable evidence is not flattened into a misleading single answer.
- Historical source families preserve explicit source-language ancestry and distinguish homonymous reconstructed roots. Ambiguous same-POS English etymologies are withheld unless safely aligned. Family membership is reference material, not automatic word segmentation or a formula for a modern meaning. Original root questions remain separately curated.
- Collocations, phrasal verbs, verb patterns and confusables use contextual original exercises. Source relations without a disambiguated question and bilingual guidance remain audit candidates; an audit candidate is not a ready exercise.

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
