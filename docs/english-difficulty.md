# English vocabulary difficulty

Every English entry has an explicit editorial difficulty decision tied to its stored English and Korean meaning. The four existing IELTS-labelled groups remain:

| Study Group | Entries | Distinct Headwords |
| --- | ---: | ---: |
| IELTS 1.0–3.5 — basic everyday vocabulary | 3,693 | 3,284 |
| IELTS 4.0–6.5 — general/intermediate vocabulary | 4,146 | 3,896 |
| IELTS 7.0–8.0 — SAT-style academic vocabulary | 3,150 | 3,001 |
| IELTS 8.5–9.0 — GRE-level vocabulary | 1,367 | 1,334 |

Total: 12,356 entries. A headword can have separate senses or parts of speech, sometimes at different levels. The highest group’s minimum of 1,000 counts distinct headwords, not duplicate senses, spelling variants or ordinary inflections. All groups display alphabetically. Root Families now links include, preclude and occlude, with the complete related family visible as context.

The full review covered 11,997 baseline entries individually in three complete partitions, followed by independent checks of expert assignments and conservative calibration. This baseline included 20 original additions to the previous 11,977-entry package. Another 359 genuinely advanced entries were authored and independently reviewed, each with English/Korean meanings and an original example with both explanations. No basic word was promoted to satisfy the count. Beginner, comb, tidy, lamp, oven, passport and rabbit now belong to the lowest group. Lexical familiarity, register and the actual stored sense all matter; rarity or conceptual complexity alone does not determine a level.

These are editorial study bands, not official IELTS/SAT/GRE word lists, native-speaker certification or score equivalence. IELTS assesses vocabulary use as part of performance. SAT Words in Context concerns useful academic vocabulary in context; GRE Verbal Reasoning assesses understanding and reasoning in text. The labels describe the intended vocabulary progression.

## Sources and licensing

New definitions and bilingual examples are original Lingonberry material under MIT. Existing dictionary attribution and licences remain unchanged. Cached Wiktionary senses and selected canonical pages were consulted to verify linguistic facts; no publisher definitions, quotations or preparation lists were copied. The factual-reference audit distinguishes candidate source rows from actual semantic verification. The variants fervour/fervor and enervating/enervate were not counted as additional words. Aggrandise accepts aggrandize as an alias.

- [IELTS vocabulary guidance](https://ielts.org/news-and-insights/how-to-address-vocabulary-in-an-ielts-preparation-course)
- [College Board SAT cognitive report](https://satsuite.collegeboard.org/media/pdf/digital-sat-cognitive-lab-report.pdf)
- [ETS Verbal Reasoning](https://www.ets.org/gre/test-takers/general-test/prepare/content/verbal-reasoning.html)

## Rebuild and validation

Authoring and audit files are under `language-packages/sources/english-difficulty-*`. The compiled review binds all IDs, spellings, parts of speech and English/Korean meanings with a SHA-256 digest. Missing decisions, duplicate decisions, stale meanings or fewer than 1,000 distinct expert words block the build.

Run `node scripts/build-english-difficulty.mjs` to reproduce immutable version 4.2.0 from the published 4.1.0 base, reviewed additions and compiled decisions. Existing IDs and meanings are retained, preserving study progress and valid Review questions. Review filtering uses each word’s updated level. New entries use new stable IDs. Tests cover every entry’s decision, easy-word anchors, the distinct expert count, bilingual additions and saved progress.
