# Reviewed English editions

Include useful everyday, professional, academic and literary meanings through GRE-level usage. Do not turn every historical, obsolete, regional or narrowly technical dictionary branch into a card. A valid source establishes that a meaning exists; a separate relevance judgement establishes whether it belongs in study content. See [meaning style](meaning-style.md).

Distinct useful meanings have independent stable IDs, levels and examples. Ordinary applications of one meaning, such as a season ticket for journeys or events, normally share a coherent definition. Genuine spelling variants and equivalent paraphrases share one canonical sense; an unrelated homonym never inherits its progress.

## Review and build

Conversation agents author and independently review the JSONL journals under `local-data/coverage/four-language-review/english-sense-plan/`. Local model inference and inference APIs are disabled. Preserve source snapshots, original candidate hashes, authorship, corrections and previous decisions.

Run with the repository's Node 26 toolchain:

```sh
node scripts/audit-english-independent-review.mjs
node scripts/audit-english-reviewed-examples.mjs
node scripts/build-reviewed-english.mjs
node scripts/build-reviewed-english.mjs --write
node scripts/verify-reviewed-english-browser.mjs
```

The builder requires a complete audit and the exact SHA-256-bound effective review snapshot. It validates equal English/Korean entry inventories, examples for every retained meaning, duplicate examples across different senses, individual levels, current references and actual serialised download sizes. It never bypasses the 64 MiB package limit.

`--write` stages immutable study and explanation payloads plus an integrity-checked SQLite export in `local-data/coverage/reviewed-english-release/`, inside the Google Drive checkout. It does not change installed or hosted catalogues. The export records the release version and review snapshot hash. Keep staging, publication and device installation as separate verified steps.

## Examples and practice

Preserve exact source attribution for licensed usage examples and the corresponding translation licence. New original examples use CC BY 4.0. Unknown source declarations, unreviewed quotations and incompatible licences fail the build; they are never relabelled as original content. Wiktionary adaptations retain their contributor credit, source URL, change notices and ShareAlike licence.

The verified English form cache can locate an unambiguous attested inflection. Ambiguous cases require an explicit editor-approved span bound to the exact sentence. An unresolved span remains a dictionary example; the compiler does not invent a blank or rewrite licensed wording.

Discontinuous expressions use reviewer-approved `gapFill` descriptors with one input per blank. Intervening objects remain visible. Their examples set `clozeEligible:false` to prevent an ordinary contiguous Cloze question; their explicit gap exercises remain available. A previous practice restriction can be lifted only by a separate approval bound to the current sense, exact gaps and original eligibility, allowing the full sentence in Scramble.

Root-family references contain only active word-list words or explicitly verified search aliases. Empty root groups and retired English countability metadata are removed. Review commentary and source evidence stay in the editorial journals rather than inflating learner downloads.

The authoring and full-source audit commands require the retained local review workspace; private research snapshots and superseded drafts are deliberately excluded from the public repository. Public payloads retain their individual source credits and the release report records the exact reviewed snapshot hash. The downloaded release can be verified independently with the public package/schema checks.
