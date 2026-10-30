# Example authoring and explanation coverage

Keep released study cores and explanation files immutable. New example editions reuse stable word IDs so package updates preserve progress. Code stays bundled; these files contain data only.

Each language owns three sidecars in `language-packages/sources/examples/`: `LANG-authored.jsonl`, `LANG-corrections.jsonl` and `LANG-review-notes.json`. An authored row has a stable `id`, native `text`, English `en`, Korean `ko`, optional additional `translations`, optional `meaningDe`, a literal `focus` span and provenance. All seven language texts are useful for the requested matrix, even though non-English self-explanation downloads are excluded. A repeated focus needs an explicit zero-based start offset.

Original examples are specific usage sentences under CC BY 4.0. Corrections to licensed dictionary senses are marked as adaptations under CC BY-SA 4.0. Source-derived examples must carry their source URL, author and reusable licence. Raw model output remains outside published packages until editorial checking; native-speaker review is separately recorded and remains pending. A commercial-use licence does not establish translation quality or store-distribution compliance.

Run the coverage audit with an optional local NIKL sense export:

```sh
node scripts/audit-explanation-coverage.mjs /tmp/language-coverage /path/to/nikl-senses.json
```

The report covers all 43 eligible pairs. `packageComplete` means all word meanings and translations of the examples currently present are available. `fullExampleCoverage` additionally requires a primary example for every entry. Neither flag means native-speaker review. Licensed definitions found through source sense IDs are reported as candidates, never counted as finished extra-language translations. Corrections invalidate source-sense reuse until their replacement meanings are supplied.

Build a new preview edition outside the repository first:

```sh
node scripts/build-authored-examples.mjs /tmp/example-edition 3.0.0 ja es fr
```

The compiler rejects duplicate/unknown IDs, missing corrected meanings, incomplete explanation translations, unsupported licences and unreviewed machine records. It does not automatically create extra-language downloads from partial sidecars or source candidates. A corrected sense requires a matched replacement example. Previous source examples tied to that corrected sense are removed from the new edition, while the original immutable edition and provenance remain available.

Inspect the generated packages and build report, run schema and browser checks, then copy the new files and catalogue into a small content PR. Regenerate the shell manifest after changing the bundled catalogue. Retain the exact authoring/correction records whose hashes appear in the build report. Never replace a package file with different bytes under the same version.

## Japanese missing-example completion

Use a separate completion workspace with the current core/English/Korean package SHA-256 values in `manifest.json`, the complete missing-entry inputs and `ownership.json`. Numbered author batches contain Japanese sentences, English/Korean translations, explicit UTF-16 focus offsets and reusable provenance. Review every row against its current selected sense, grammatical role, naturalness and all three texts. A different author records `pass`, `revise` or `uncertain` with exact record/source-binding hashes. Native-speaker certification remains pending.

```sh
node scripts/audit-reviewed-examples.mjs local-data/japanese-example-completion/2026-10-30
node scripts/audit-reviewed-examples.mjs local-data/japanese-example-completion/2026-10-30 --require-complete
```

The audit reports drafted, independently reviewed, missing, stale and unresolved records separately. It writes `audit.json` inside that local workspace; it neither publishes packages nor resumes the old generation queue. Only closed numbered batches are collected. A revised sentence or translation needs a fresh independent review. The completion gate refuses stale source senses, self-review, hidden coverage gaps or open findings. Hashes verify which text was reviewed; they cannot establish linguistic correctness by themselves.

Use `compileReviewedExamples` for this completion, passing the reviewed records and current inputs explicitly. It requires full reviewed coverage, fills only missing primary examples, preserves current words and meanings, and never reapplies the historical correction sidecars. Source-derived records retain their own creator, licence and change notices rather than being relabelled as original app content. Keep the original reviewed drafts and their hashes with the eventual immutable edition so its editorial checks can be reproduced.
