# English linguistic review

> Historical review of English 3.0.0. Its findings are now resolved in the [4.0.0 correction edition](english-meaning-corrections.md); the original review records remain unchanged.

This review covers the 12,016 entries in the English study core 3.0.0 and the matching English and Korean explanation packages. The fields are the headword, part of speech, English meaning, Korean meaning and consistency with any existing primary example. It is separate from a completeness, licence or package-integrity audit.

## Results — 19 October 2026

All **12,016 entries** received an entry-by-entry AI linguistic review of their English and Korean meanings. All **139 existing primary examples** were checked for consistency. There are no additional examples in this package.

| Disposition | Entries |
|---|---:|
| No issue flagged in this pass | 7,669 |
| Correction proposed | 1,993 |
| Unresolved source, sense or usage concern | 2,354 |
| Not reviewed | 0 |

**4,347 entries need follow-up. The current English package is not linguistically approved for release.** The review contains 224 quarantine recommendations and one explicit duplicate-reconciliation action. These are not automatic deletions. Some unresolved records also contain partial wording proposals; none are approved for publication by the validator.

Representative findings:

| Entry | Finding | Next step |
|---|---|---|
| spin — noun | English describes hairspray; Korean selects particle spin | Proposed bilingual physics definition, corroborated against Wiktionary |
| he — pronoun | Definition explains Korean pronoun morphology | Replace the transferred grammatical explanation |
| blacksmith — noun | Both definitions describe a workshop, not a person | Reconcile the selected source concept |
| petal — noun | Definition describes a counting unit for leaves | Review proposed flower-part definition and source binding |
| arc — noun | Definition describes a parabola | Reconcile the mathematical sense |
| legislature — noun | Definition describes legislation as an activity | Reconcile institution versus activity |
| when / many | Duplicate concepts under separate IDs | Reconcile quiz selection while preserving history |

Source checks also prevented inappropriate removals: the common-noun sense of **excellency** and the narrower **polygyny** sense of **polygamy** are attested in the licensed Wiktionary snapshot. Rarity alone is not an error.

The complete [per-entry ledger](../language-packages/sources/meaning-reviews/en-3.0.0/entries.jsonl), [manifest and source hashes](../language-packages/sources/meaning-reviews/en-3.0.0/manifest.json), and [14 independent source checks](../language-packages/sources/meaning-reviews/en-3.0.0/independent-source-checks.jsonl) are retained in the repository. Every finding includes its original meanings, proposed changes where available, rationale and original source provenance.

This pass covers English study meanings, not the other study languages, IELTS level calibration, audio pronunciation or the 2,606 separately displayed source-reference examples. Those examples do not have complete bilingual translations and retain their existing review status. No claim of full-app linguistic certification is made.

## Method

Three AI reviewers inspect disjoint entry ranges. Every disposition is bound to a canonical SHA-256 digest of the exact source entry and meanings. The lead reviewer checks selected accepted entries and proposed findings against the licensed Wiktionary snapshot and returns disagreements for reconsideration. This is an AI-assisted linguistic review, not a fluent-speaker certification or a claim that every error has been eliminated.

The review distinguishes:

- `accepted`: no linguistic issue identified in the review pass; not an independent publication approval.
- `correction-proposed`: an issue and a candidate amendment are recorded for adjudication.
- `unresolved`: a sense, headword, source alignment or usage concern remains. A quarantine recommendation is a proposal, not a deletion from the app.

Narrow but legitimate senses are retained. A word is not rejected merely because a different sense is more frequent. Korean-specific honorifics, morphology and cultural restrictions must not be copied onto an English equivalent without evidence that they apply in English. Quoted source text remains unchanged; proposed learner-facing definitions use British English.

## Source and progress safety

Published package payloads are immutable. This review does not alter installed word lists, progress, Review records or the paused generation queue. Proposed text is not automatically compiled into packages.

A correction that changes the selected concept needs source reconciliation before release. An invalid English equivalent should not silently become a different word or sense under an existing progress ID. Future remediation must explicitly handle entry retirement, replacement IDs and historical question snapshots.

Original NIKL source text retains CC BY-SA 2.0 KR, Wiktionary text CC BY-SA 4.0, and authored starter material CC BY 4.0. Proposed adaptations of licensed definitions retain attribution and CC BY-SA 4.0. The source packages and `language-packages/credits/MULTILINGUAL-2.0.0.txt` retain the full licence chain. Exact snapshot and article-history references are kept for independent source checks.

## Reproduce coverage validation

```sh
node scripts/content/english-meaning-review.mjs local-data/review/english-2026-10-19
node scripts/content/english-meaning-review.mjs local-data/review/english-2026-10-19 --require-complete
```

The validator rejects duplicate IDs, changed source content, missing reasons, invalid proposals and incomplete coverage when completion is required. It does not infer linguistic accuracy from successful validation. Export requires complete coverage:

```sh
node scripts/content/english-meaning-review.mjs local-data/review/english-2026-10-19 --export language-packages/sources/meaning-reviews/en-3.0.0
```
