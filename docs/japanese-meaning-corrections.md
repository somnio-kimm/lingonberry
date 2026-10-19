# Japanese meaning corrections — edition 4.0.0

Japanese study content and the Japanese → English and Japanese → Korean explanation packages now use version 4.0.0.

## Review result

Every one of the 12,027 entries was reviewed for Japanese headword, reading, part of speech, English meaning and Korean meaning. All 2,027 existing bilingual primary examples were also checked.

| Resolution | Entries |
|---|---:|
| Original entry retained | 9,070 |
| Same-concept correction | 2,891 |
| Replacement concept with a new ID | 66 |
| Removed without replacement | 0 |
| Unresolved decisions | 0 |

The result retains **12,027 active entries**, with complete English and Korean meanings. **Seven primary examples** were repaired; all other primary sentences and translations remain unchanged. This edition does not fill the 10,000 entries that still lack a primary example. Separately labelled source-reference sentences are not covered by the primary-example review and are cleared where a changed word, reading, part of speech or concept makes their previous binding unsafe.

Representative fixes include the speaker-gender restrictions wrongly attached to お兄さん and お姉さん, the referent of ご主人, スピン definitions disagreeing between English and Korean, field hockey using a ball rather than a puck, and reading errors such as 中ほど → なかほど and 鸛 → こうのとり. Valid uncommon readings were preserved, including 須臾/しばらく and 蓮葉/はすは. Usage labels distinguish offensive, dated and extended senses where required.

JLPT N5–N1 assignments are unchanged. These are editorial study levels; this review is not certification of official JLPT vocabulary membership or difficulty calibration. The linguistic review is AI-assisted source adjudication; native-speaker certification remains pending.

## Evidence and licences

The [review manifest](../language-packages/sources/meaning-reviews/ja-3.0.0/manifest.json) binds the review to exact original package hashes. The [decision ledgers](../language-packages/sources/meaning-corrections/ja-4.0.0/) cover every entry, and their digest matches the compiler’s source-validation report. The verifier checked **3,066 source references**, including selected dictionary senses and explicitly bound character-reading metadata. A separate reviewer cross-checked the final 1,000 entries and all seven repaired examples; identified issues were resolved before compilation.

Wiktionary contributor definitions and NIKL dictionary material retain their original attribution and source identifiers. Covered dictionary adaptations use CC BY-SA 4.0; original NIKL text retains CC BY-SA 2.0 KR. Repaired original usage sentences and their translations are Lingonberry contributor text under CC BY 4.0. Earlier notices remain in each package. App code remains MIT.

One definition-only supplemental record from Japanese Wiktionary **ます**, revision **2365629**, supports the measuring-vessel sense and the 斗 spelling. Its real API snapshot hash, article history, extracted-row digest and modification note are retained. Publisher quotations, images and audio were excluded; the raw API response is not committed.

Some ambiguous readings and specialist facts were independently checked against publisher dictionaries, Kanjipedia, NHS, JSPN and UNODC references. Those links appear as factual checks, not as freely licensed copied definitions. No protected publisher definitions or examples were imported from those references.

## Learner progress and authoring records

Same-concept corrections retain stable IDs and word status. The 66 different replacement concepts receive new IDs and do not inherit mastery. Stored history is preserved, while stale target or distractor snapshots are excluded from active Review and retests. New questions carry the corrected core version.

Three existing Japanese authoring records and two corresponding correction records reference superseded concepts. They remain unchanged and are explicitly bound to the original 3.0.0 core and their record hashes in [ja-retirements.json](../language-packages/sources/examples/ja-retirements.json). They are not silently applied to new meanings. Existing queued generation jobs need reconciliation with corrected English/Japanese identities before a future resume. This task did not resume global generation.

## Rebuild and verification

```sh
python3 scripts/content/verify-english-correction-sources.py \
  --language ja \
  --review language-packages/sources/meaning-reviews/ja-3.0.0/entries.jsonl \
  --directory language-packages/sources/meaning-corrections/ja-4.0.0 \
  --report /tmp/japanese-source-validation.json
node scripts/build-english-corrections.mjs --language ja \
  --directory language-packages/sources/meaning-corrections/ja-4.0.0
npm test
npm run check
node scripts/verify-meaning-corrections-browser.mjs --japanese
node scripts/verify-multilingual-browser.mjs
```

The existing English command names remain available; their implementation now shares the correction compiler and verifier with Japanese. Rechecking source rows requires the licensed local cache. Rebuilding packages uses the committed, digest-bound records and their matching validation report. `--publish` adds immutable package files and updates the catalogues; it refuses different bytes at an existing version.

Regression tests cover complete review/translation coverage, unchanged original packages, exact reproducibility, preserved levels/readings, source-proof rejection, example focus and progress migration. The browser upgrade check installs Japanese 3.0.0, seeds old history, updates both pairs through Settings and tests offline use. Debug iPad checks use `--verify-japanese-corrections`, with `--verify-offline-packages` for installed-data-only checks; the test driver is absent from Release builds.

Validation at publication: 274 automated tests and the project/shell checks passed. The Japanese upgrade browser test passed both EN/KO updates, history preservation and offline use; all seven multilingual browser regression checks passed.
