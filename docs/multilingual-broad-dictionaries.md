# Broad multilingual dictionaries — editorial preview

Version 2.0.0 established the broad dictionaries; version 3.0.0 adds original examples and explicit sense/reading corrections. Eligible English/Korean explanation packages are available; Korean study offers English explanations only. Study-level selectors remain populated; English now uses four grouped IELTS ranges instead of individual half-band targets. A headword can have different entries for different parts of speech; entry totals and distinct headwords are reported separately.

| Language | Entries | Distinct Headwords | Complete Bilingual Examples | Source Sentences |
|---|---:|---:|---:|---:|
| Japanese | 12,027 | 11,992 | 2,027 | 2,017 |
| Korean | 12,026 | 11,738 | 90 | 23,726 |
| English | 12,016 | 10,721 | 139 | 2,606 |
| Spanish | 9,092 | 9,009 | 1,819 | 864 |
| French | 8,936 | 8,825 | 1,992 | 1,415 |

## What is complete and what remains

Broad vocabulary import, bilingual meanings, preserved starter content, downloadable packages, English topic filters and progress isolation are implemented. This is not a completed exam syllabus or a linguistically approved store release. Native-speaker review is pending, and most words still lack a complete bilingual usage example.

The 281 original examples and 5,786 newly authored examples provide 6,067 entries with complete examples. Another 48,030 entries remain without a primary usage example. All new rows have structural/focus checks; independent AI editorial review covered 479 rows (120 each in Japanese/Spanish/French, all 89 English and all 30 Korean rows). This is not a native-speaker review or full-corpus approval. Licensed native source sentences are shown separately as Source Examples; missing translations say Translation Under Review. Their presence does not count as complete bilingual example coverage. Cloze, Sentence Scramble and Sentence Dictation only use complete examples; Cloze also requires a valid target span. Word Dictation, typed recall, meaning choices, Word List and Flashcards can use the broader dictionary. No generic repeated “Today we discuss X” sentence is inserted to fill gaps.

The next content work is sense/level review, translating useful native examples, and writing specific original examples for words without a suitable source sentence. The [example-edition report](example-editions.json) records the exact outstanding counts, immutable source versions and authoring hashes. The original import report remains the 2.0.0 baseline. Spanish/French have fewer admitted words because ambiguous senses, noun genders and French aspiration could not be established sufficiently; they are not padded to hit a round number.

## English levels and topics

English uses IELTS 1.0–3.5, 4.0–6.5, 7.0–8.0 and 8.5–9.0 with exact group filtering, plus All. There are no exam-focus controls or Academic/General Training badges. Topic filters remain available for education, research, environment, health, technology, economy, society, work, housing, travel, everyday services, relationships, culture and communication. Topic tags are editorial heuristics and need review.

The app adapts existing packages without replacing their immutable payloads or changing progress IDs. See [English study levels](english-study-levels.md) for assignment rules, counts and selection migration.

## Sources and editorial policy

NIKL Korean Learners’ Dictionary supplies linked Korean and English definitions and target-language equivalents. The Korean text has explicit source entry/sense identifiers. For Japanese, Spanish and French, target equivalents are checked against Wiktionary lexical senses before admission. English equivalents come directly from NIKL’s English side; Wiktionary confirms the part of speech. Source examples with inadequate sense alignment are not displayed. Same-language English definitions that merely repeat the headword are excluded.

Korean selection prioritises NIKL curriculum headwords so token frequencies do not eliminate dictionary-form verbs and adjectives. Curriculum matches are headword-level evidence, not certification of a homograph sense or TOPIK exam membership. Other level assignments use editorial frequency tiers; frequency can conflate senses and must not be presented as an official level. Starter assignments override imported assignments, preserving IDs and examples.

French/Spanish noun articles use lexical gender/number facts and elision/stressed-a handling. Unresolved French h/y onsets are deferred. Japanese readings are retained unless a documented correction fixes the selected reading and accepted aliases. Automated source alignment is imperfect; sense and reading corrections are made explicit rather than treating imported metadata as native-reviewed. English headwords prefer British spelling and retain source spellings as accepted aliases; imported quoted source examples retain their source spelling. No multimedia or quotation-type Wiktionary examples are imported.

## Rebuild

Use an external cache, Python with `wordfreq==3.1.1`, and the repository Node toolchain. Source hashes and pinned URLs are in `language-packages/sources/multilingual/broad-source-manifest.json`. Download the eleven NIKL XML files using their recorded names, the NIKL curriculum spreadsheet as `nikl-curriculum.xlsx`, and supply the matching English Wiktionary gzip snapshot. Its exact original dump date is unknown; the existing cached file is identified by its full SHA-256 rather than an invented date.

```sh
python scripts/content/extract-nikl-multilingual.py CACHE
python scripts/content/select-multilingual-candidates.py CACHE
python scripts/content/collect-multilingual-facts.py CACHE ENGLISH_EXTRACT_GZ
python scripts/content/prepare-multilingual-dictionaries.py CACHE
node scripts/build-broad-multilingual-packages.mjs CACHE
npm run shell:sync
npm test
npm run check
node scripts/verify-multilingual-browser.mjs
```

The builder rejects prepared-source hashes that differ from the manifest. Changes to source selection require an explicit manifest update and review, followed by a new package version once released. The raw export, local cache and model weights are not committed. Language packages are data only and each remains below the 30 MiB installation limit. The old 1.0.0 files remain available; installed old pairs continue working until a compatible explicit update completes. Removal retains progress.

## Licence and release status

See `language-packages/credits/MULTILINGUAL-2.0.0.txt` and per-entry source metadata. NIKL source text retains CC BY-SA 2.0 KR; covered adaptations use the later same-elements CC BY-SA 4.0 option. Wiktionary text and wordfreq data are CC BY-SA 4.0, curriculum evidence is KOGL Type 1, and original starters remain CC BY 4.0. App code remains MIT. Downloads and licence notices remain available independently without DRM. These licences permit commercial use subject to their conditions; this draft does not certify compliance of a future store distribution or completion of language review.

## Example edition rebuild

Use the new-edition compiler described in [example authoring](example-authoring.md). Keep 1.0.0 and 2.0.0 payloads unchanged. New original sentences and translations are CC BY 4.0; covered dictionary corrections remain CC BY-SA 4.0. Extra-language translations are staged for the [43-pair matrix](explanation-matrix.md), and missing meanings or translations prevent new pairs from being offered.
