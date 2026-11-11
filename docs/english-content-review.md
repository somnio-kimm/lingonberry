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

For a separately reviewed follow-up, preserve the previous finalized snapshot and audit. Prepare a new complete audit, exact snapshot, overlap audit and current practice approvals, then select them with a private JSON build configuration:

```json
{
  "schemaVersion": 1,
  "version": "7.0.1",
  "audit": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/independent-audit.json",
  "snapshot": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/independent-effective-finalized.jsonl",
  "overlapAudit": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/retained-example-overlap-audit.json",
  "focusDecisions": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/example-focus-decisions.jsonl",
  "gapDecisions": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/gap-fill-decisions.jsonl",
  "gapApprovals": "local-data/coverage/four-language-review/english-sense-plan/followup-20261111-01/gap-practice-approvals.jsonl",
  "stage": "local-data/coverage/reviewed-english-7.0.1/"
}
```

All paths resolve from the repository root; absolute local file paths also work. Save this example as `local-data/english-build.json`, preview with `node scripts/build-reviewed-english.mjs --config local-data/english-build.json`, and add `--write` to stage packages and the database. Configuration alone never enables writes. Output must remain under `local-data/`; public staging paths, unknown fields, malformed values and remote URLs are rejected. An explicitly selected gap-decision file must exist; only the default optional gap file may be absent.

Input selection grants no review approval. The existing snapshot hash, overlap, source-licence, sense, practice-binding and package-size checks still run. Do not rerun a writer that overwrites the old finalized journal to prepare a follow-up; retain the old records and bind the new decisions independently.

## Examples and practice

Preserve exact source attribution for licensed usage examples and the corresponding translation licence. New original examples use CC BY 4.0. Unknown source declarations, unreviewed quotations and incompatible licences fail the build; they are never relabelled as original content. Wiktionary adaptations retain their contributor credit, source URL, change notices and ShareAlike licence.

The verified English form cache can locate an unambiguous attested inflection. Ambiguous cases require an explicit editor-approved span bound to the exact sentence. An unresolved span remains a dictionary example; the compiler does not invent a blank or rewrite licensed wording.

Discontinuous expressions use reviewer-approved `gapFill` descriptors with one input per blank. Intervening objects remain visible. Their examples set `clozeEligible:false` to prevent an ordinary contiguous Cloze question; their explicit gap exercises remain available. A previous practice restriction can be lifted only by a separate approval bound to the current sense, exact gaps and original eligibility, allowing the full sentence in Scramble.

Additional gap reviews can use the optional `gap-fill-decisions.jsonl` beside the existing `example-focus-decisions.jsonl`. Each record contains `id`, `exampleTextDigest`, `gapFill`, `reviewer` and `reason`. For example, the sentence “The teacher told him off.” uses `parts:["The teacher "," him ","."]` and `answers:["told","off"]`. The descriptor must reconstruct the unchanged sentence exactly; it does not create a spelling alias or require editing the completed meaning, level or source review.

Every separate gap decision also needs a record in `gap-practice-approvals.jsonl`, bound with `englishGapPracticeDigest(review, decision.gapFill)`. Missing approval, stale sentence or sense bindings, duplicate IDs, invalid gaps and conflicts with embedded review gaps fail the build. An absent optional decision file means no additional decisions; malformed files still fail. Existing embedded gap reviews retain their original binding.

Root-family references contain only active word-list words or explicitly verified search aliases. Empty root groups and retired English countability metadata are removed. Review commentary and source evidence stay in the editorial journals rather than inflating learner downloads.

The authoring and full-source audit commands require the retained local review workspace; private research snapshots and superseded drafts are deliberately excluded from the public repository. Public payloads retain their individual source credits and the release report records the exact reviewed snapshot hash. The downloaded release can be verified independently with the public package/schema checks.
