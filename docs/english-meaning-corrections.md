# English meaning corrections — edition 4.0.0

English study content and its English/Korean explanation packages now use version 4.0.0. The four IELTS study groups remain editorial vocabulary groups; they do not certify test scores.

## Result

All 4,347 findings from the [3.0.0 linguistic review](english-linguistic-review.md) have a source-adjudicated resolution:

| Resolution | Entries |
|---|---:|
| Same-concept correction | 3,762 |
| Supported replacement sense, with a new ID | 450 |
| Original meaning retained after source verification | 96 |
| Invalid or duplicate entry retired | 39 |
| Unresolved decisions | 0 |

The new edition contains **11,977 active entries**, with complete English and Korean meanings. All **139 existing bilingual primary examples** remain unchanged. It retains 2,543 separately labelled source-reference examples; references attached to changed words, parts of speech or replacement concepts are not carried over without review. No new example-generation job was started.

| Study group | Entries |
|---|---:|
| IELTS 1.0–3.5 | 1,979 |
| IELTS 4.0–6.5 | 2,489 |
| IELTS 7.0–8.0 | 3,005 |
| IELTS 8.5–9.0 | 4,504 |

Examples of repaired meanings include particle **spin**, **blacksmith** as a person, **petal** as a flower part, mathematical **arc**, and **legislature** as a law-making institution. British spellings and valid spelling aliases are retained. Uncommon but supported senses were checked rather than removed merely for being uncommon.

This is an AI-assisted, source-adjudicated correction edition. Native-speaker certification remains pending; resolving this review does not establish that no further linguistic errors exist.

## Sources and licence

The [correction records](../language-packages/sources/meaning-corrections/en-4.0.0/) retain exact source snapshots, row digests, sense ordinals, glosses, article URLs, contributor-history URLs and reasons. The [source validation report](../language-packages/sources/meaning-corrections/en-4.0.0/source-validation.json) verifies all 4,347 decisions and 4,409 source references against the local licensed snapshots and supplemental source records.

English, Japanese, French and Korean Wiktionary evidence is used where applicable, with source-edition contributor attribution. Wiktionary text and covered adaptations retain CC BY-SA 4.0; original NIKL text retains CC BY-SA 2.0 KR. The package notices preserve the earlier licence chain and credit the contributors used in this edition. Contributor-authored definitions are distinguished from third-party quotations; quotations and audio were not imported. Existing primary examples retain their original CC BY 4.0 provenance.

Three supplemental definition-only records are preserved with real MediaWiki revisions: `rumor` noun/verb (93658478) and `surrogate mother` (92060956). The cached raw responses were not copied into the published dataset. Other source gaps were resolved with available licensed dictionary evidence; no failed network request is represented as a successful lookup.

## Progress and saved questions

Same-concept edits retain their entry IDs and word status. A different selected concept receives a new ID; mastery does not transfer to that new meaning. Retired equivalent duplicates can transfer the stronger existing word status to their surviving entry once. That migration does not override a later learner reset.

Old saved questions using corrected targets or distractors are excluded from active Review and retests. Stored historical records remain intact. New questions carry the content version, and corrected questions get a separate review-count key. This prevents an old incorrectly worded question from reappearing or contributing its count to a corrected one. Meaning corrections bump the study core as well as the explanation packages so this version boundary is explicit.

One pre-existing unpublished `when` example uses a retired duplicate ID. It remains preserved in the authoring file with a digest-bound [retirement record](../language-packages/sources/examples/en-retirements.json), linked to the surviving entry for a future additional-example merge. It is not silently substituted for the surviving primary example.

The all-language generation queue remains paused. Its English jobs and unpublished drafts need reconciliation with the new package identities before a future generation resume; this change does not silently rewrite that queue.

## Build and validation

```sh
python3 scripts/content/verify-english-correction-sources.py
node scripts/build-english-corrections.mjs --directory language-packages/sources/meaning-corrections/en-4.0.0
npm test
npm run check
node scripts/verify-english-corrections-browser.mjs
node scripts/verify-multilingual-browser.mjs
node scripts/verify-browser.mjs
```

The source verifier requires the original local source cache. Rebuilding from committed adjudication records requires their matching source-validation digest. `--publish` writes a new immutable edition and updates the catalogues; it refuses to overwrite different existing package bytes. Previous package versions remain available in the repository.

The upgrade browser check installs the old English edition, seeds representative old history, updates both explanation packages through Settings, verifies both meaning displays, checks preserved history and fresh mastery for replacement concepts, and tests both pairs offline. Debug-only native verification is available with `--verify-english-corrections`; adding `--verify-offline-packages` checks the installed pairs without network fetches. Release builds contain no native test driver.
