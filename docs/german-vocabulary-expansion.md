# German vocabulary expansion

Version 3 expands the archived 2,000-entry German study corpus to 11,288 entries (11,283 distinct headwords), with 11,291 translated examples. A1: 780; A2: 672; B1: 1,568; B2: 662; C1: 2,007; C2: 5,599. Chinese 2.0.0 and the immutable German 2.0.0 files remain unchanged. Existing German IDs and examples are preserved; newly assigned levels do not change progress keys.

The app displays four groups: **GZ A1**, **GZ A2**, **GZ B1**, and **GZ B2-C2**.
The combined upper group contains all 8,268 former B2/C1/C2 entries, ordered
alphabetically by headword. It is additional study vocabulary, not an official
Goethe upper-level word list. The original package levels and saved attempt
records remain intact; older B2/C1/C2 selections open the combined group, and
Review filters group those records together. No “Estimated” text is shown in
the labels.

## Study bands

A1, A2 and B1 use the earliest matching **official adult Goethe word list**. `language-packages/sources/goethe-headword-evidence.json` records PDF URLs, SHA-256 hashes, page numbers and normalised printed headwords. Only factual headword evidence is redistributed. The PDFs and their example sentences are not included.

This is an automated, bounded headword extraction plus editorial corrections. Counts represent matched lexemes, not Goethe's published lexical-unit totals. Productive families and every possible inflected form are not claimed to be exhaustive. In particular, A2/B1 conjugation continuation lines must not become independent study words; A1 separately printed adjectives such as *geöffnet* remain entries.

Outside those lists, entries use **editorial frequency tiers** from wordfreq 3.1.1: B2 at Zipf 4 or higher, C1 at 3 or higher, C2 below 3. These are provisional organisation bands, not official CEFR assessments. Frequency alone cannot establish a word's learning difficulty. Technical terms, regional words and expressions are retained with their source labels.

## Examples and translations

Archived examples are preserved. Suitable non-quotation Wiktionary usage examples are collected with source article and contributor-history URLs. Examples with quotation references are excluded. Original sentences fill gaps, including cases where an existing example cannot be translated reliably. Neutral context frames are deliberately simple, especially for specialist nouns; they do not imply that every noun is equally common or suitable for every exam.

New sentences and translations are AI-assisted editorial drafts. Short glossary translations are edited separately from example translations to avoid cross-sense errors such as *Schild* → “plate” → “접시”. Ambiguous non-official Korean matches are excluded. Additional advanced non-noun entries without an edited bilingual example are deferred. Official-list alignments receive an additional sense check, with corrections stored in editable source files. Native-speaker review remains pending and is recorded in package metadata. Automated completeness tests do not certify fluency.

Nouns use known case paradigms in generated sentences. Where a case form is missing, generation uses a nominative topic sentence rather than guessing weak-noun endings. Display forms use the definite-article nominative when available, while `dictionaryLemma` retains the reference headword. Documented article alternatives are accepted in word recall, article questions and saved review questions.

## Licensing and commercial distribution

Imported and adapted Wiktionary content, new CC BY-SA examples and frequency annotations retain **CC BY-SA 4.0** attribution and change notices. The original archived MIT material retains its own notice. App code remains MIT. Credits include Wiktionary contributors, Kaikki/Wiktextract, Robyn Speer, SUBTLEX authors and the upstream frequency-data sources.

Commercial distribution is permitted by these licences, subject to their conditions. Keep the data and its editable source available separately without app-store restrictions, retain attribution, identify modifications and license shared adaptations under CC BY-SA 4.0. See `language-packages/credits/GERMAN-3.0.0.txt` and the full licence texts. This is an editorial preview, not a language-reviewed store release. No Goethe endorsement is implied.

## Rebuild

Run commands from the repository root. Use an isolated Python environment; the app does not contain a translation model or depend on Python. The archive argument points to the retired monorepo data snapshot, not a moving online repository.

1. Obtain the three official PDFs and run `pdftotext -bbox-layout` to create matching `A1.html`, `A2.html`, `B1.html` in a private cache. Keep the PDFs outside Git.
2. `python scripts/content/extract-goethe-headwords.py CACHE ARCHIVE`
3. `python scripts/content/select-german-reference.py CACHE ARCHIVE`
4. Install `wordfreq==3.1.1` in the build environment, then run `python scripts/content/prepare-german-content.py CACHE`.
5. Translation drafts may be prepared with `python scripts/content/translate-german-examples.py CACHE LOCAL_MODEL_DIRECTORY`. It uses a locally downloaded Qwen3-4B-Instruct-2507 MLX conversion, no remote inference. Review outputs, preserve the exact source-text guard, and save approved-for-preview records to `language-packages/sources/german-example-translations.json`. A cached draft is not native-speaker approval.
6. `node scripts/build-german-package.mjs CACHE`
7. `npm run shell:sync`, `npm test`, `npm run check` and the relevant browser checks.

Curated source examples, original examples, glossary corrections and generation code are committed under `language-packages/sources/` and `scripts/content/`. Raw Wiktionary dumps and model weights stay outside the repository. The build writes separate German core, English and Korean packages, computes byte lengths and SHA-256 hashes, validates coverage, and updates both catalogues. It refuses stale translation caches. Never overwrite a published package version; use a new version for later corrections.
