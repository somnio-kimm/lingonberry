# English linguistic review

This review covers the 12,016 entries in the English study core 3.0.0 and the matching English and Korean explanation packages. The fields are the headword, part of speech, English meaning, Korean meaning and consistency with any existing primary example. It is separate from a completeness, licence or package-integrity audit.

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
