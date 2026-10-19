> Historical first-edition package specification. The current English app uses [four grouped IELTS ranges without separate exam filters](english-study-levels.md); numeric bands below describe immutable source data only.

# Original starter edition (1.0.0)

The current catalogue now points to [the broad 2.0.0 dictionary preview](multilingual-broad-dictionaries.md). This page records the preserved starter edition.

This first edition adds Japanese (JLPT N5–N1), Korean (TOPIK 1–6), English (IELTS target bands 1.0–9.0), Spanish (DELE A1–C2) and French (DELF A1–B2 / DALF C1–C2). German and Chinese packages are unchanged.

It is a **starter selection, not a complete exam syllabus**: Japanese has 51 entries, Korean 60, English 50, Spanish 60 and French 60. Every entry has an original example, an English definition/meaning and a Korean definition/meaning, plus both example translations. AI-assisted editorial drafts still need independent native-speaker review.

## Installation and study

Open Settings → Language Packages, select the study language, then download English Explanation or Korean Explanation. The shared study core is installed once. Select the study/explanation pair in Settings. Display Language remains independent. Installed packages work offline; device speech requires a suitable locally installed voice.

The five languages use one presentation for Word List, Flashcards, Word Input, Meaning Quiz and word/sentence Dictation. They retain the shared Study / Review / Settings navigation. This edition does not add grammar courses, mock exams or language-specific conjugation exercises. Meaning options use matching parts of speech; very narrow filters may yield no eligible alternatives. Spanish/French noun recall includes the article. Japanese recall accepts the supplied kana reading. Pronunciation playback uses device voices; no external audio is bundled.

Package removal uses the existing confirmed Settings flow, retains progress and reclaims the core when the last explanation is removed. Progress and Review are namespaced per study language. Explanation switching does not delete progress; saved mistakes retain their original question language.

## Levels and sources

Level allocation is editorial. JLPT does not publish a current exhaustive vocabulary list. TOPIK grade names do not make curriculum vocabulary an exhaustive exam list. DELE and DELF/DALF frameworks establish levels, not these precise word memberships. Official links and bilingual caveats are recorded under `language-packages/exam-profiles/`.

IELTS allows half-band target selection. Its 50 entries are grouped into five editorial tiers, with cumulative inclusion from target bands 1.0, 3.0, 5.0, 6.5 and 8.0. A target of 9.0 includes all tiers; it does not represent a distinct official “Band 9 vocabulary”. Shared entries support both Academic and General Training preparation; this is not a dedicated reading or writing syllabus for either variant. No score is predicted or guaranteed.

The broader NIKL/Wiktionary candidate audit was **not admitted into these packages**: reversed bilingual equivalents produced sense mismatches, whole-word frequency confused senses, and neutral generated sentences were not sufficiently useful. No candidate counts are represented as published coverage. Expanding the list requires reviewed sense alignment, natural examples and balanced parts of speech, not just more rows.

## Editing, reproducibility and licence

Edit `language-packages/sources/multilingual/{language}-editorial.tsv`. Its nine tab-separated fields are level, headword, reading (`-` if absent), part of speech (`noun/article` where required), English meaning, Korean meaning, target example, English example and Korean example. Never put tabs or line breaks inside a field. Keep the headword and part of speech stable to retain its generated ID. Homographic extra senses need an explicit sense-ID design before insertion; duplicates are rejected.

Run `node scripts/build-multilingual-packages.mjs`, `npm run shell:sync`, `npm test`, `npm run check`, and `node scripts/verify-multilingual-browser.mjs`. Counts and source hashes are written to `docs/multilingual-vocabulary.json`. Each core and explanation file has its own catalogue size and SHA-256. Rebuild unreleased drafts freely; after release bump the version rather than changing immutable content in place.

The new authored content is CC BY 4.0; code remains MIT. Credit Learn Language contributors and retain the licence link/change notices when redistributing this content. The source TSV and download files remain independently accessible. No third-party exam sentences, textbook prose, NIKL/Wiktionary definitions or recordings are included in the starter release. Exam-source links document the framework only and do not imply endorsement. Existing German/Chinese content licences remain unchanged.
