# English primary-example completion

English 5.0.0 provides primary examples and Korean sentence translations for **all 12,745 study entries**. It fills all 11,838 missing entries after independent AI editorial review; the original 907 examples and every word, meaning, level and grammatical tag remain unchanged. English self-explanation keeps its definitions and hides the redundant English sentence translation. No native-speaker certification is claimed.

The [completion report](../language-packages/sources/examples/editions/5.0.0/en-completion-report.json), original authoring records, current and historical review decisions, exact source bindings and attribution notice accompany the immutable packages. The full gate reports 11,838 current independent passes, zero missing/unreviewed entries and zero unresolved findings. Historical stale reviews remain as evidence and do not count as approvals.

Pre-existing Korean **word-gloss** mismatches discovered during this work are tracked separately in [issue #142](https://github.com/somnio-kimm/lingonberry/issues/142). The example sentences translate the selected English senses; this example edition preserves the original word meanings.

A standalone English-only SQLite snapshot is saved locally inside the Google Drive project at `local-data/generation/english-examples-completed-5.0.0.sqlite`. It includes all 12,745 current vocabulary records, both explanations, source package hashes, authoring records and review evidence; its SQLite integrity check passed. The historical multilingual generation queue is separate.

The source English core 4.8.0 has 12,745 entries, with 907 primary examples and 11,838 missing. The matching source explanations are English 4.8.0 and Korean 4.9.0. A source-reference fallback exists for only 2,018 entries and does not establish complete bilingual sentence coverage. The previous meaning and vocabulary expansions did not complete these missing examples.

The completion workspace is `local-data/english-example-completion/2026-11-02`. Its manifest pins all three package hashes, identifies English as the target and assigns every missing stable entry to exactly one author shard. Reused contributor examples and existing app-authored English/Korean sentences are candidates until checked against the current English sense and grammatical role. Source concept IDs and matching spellings are retrieval aids, not semantic approval. Unsuitable examples are replaced with concrete original British English usage sentences and faithful Korean translations.

Each closed batch contains a literal UTF-16 focus span and credited reusable provenance. Original examples use CC BY 4.0. Reused material retains its source licence, creators, source identities and change notices; source-derived translations retain the applicable share-alike terms. Third-party quotations are excluded. Independent reviewers read each bound sentence/translation against its selected sense and POS, recording exact text/source hashes. Edits invalidate older reviews, unresolved findings block release, and native-speaker certification remains pending.

```sh
node scripts/audit-reviewed-examples.mjs local-data/english-example-completion/2026-11-02
node scripts/audit-reviewed-examples.mjs local-data/english-example-completion/2026-11-02 --require-complete
node scripts/build-reviewed-examples.mjs local-data/english-example-completion/2026-11-02 /tmp/english-examples-5.0.0 5.0.0
```

The builder refuses partial or unreviewed work. A complete preview fills only missing examples and their sentence translations, preserving the original 907 examples, words, meanings, levels, POS, stable progress IDs and unrelated exercise data. English self-translation equals the English sentence in the data; the app continues to hide that redundant translation. Korean explanations include the translated sentence. Explanation-specific source credits from newer meaning editions are retained alongside the core notices.

After inspecting the preview and its full coverage report, publish immutable payloads plus the original author/review/binding ledgers. Validate the new catalogue descriptors, run `npm test`, `npm run check` and `node scripts/verify-english-examples-browser.mjs`. That browser check audits every assembled word, then checks Word List details and Flashcards in all four study bands on phone/tablet, in both themes and independent English/Korean display/explanation combinations. It also checks that the primary examples feed the standard sentence engine.

Pin the public content commit in `mobile/content-source.json` before building the iPad update. Update installed English explanation packages through Settings → Language Packages → English; both explanations must bind the same new core. The DEBUG-only `--verify-english-examples` check reads all installed English entries and their displayed examples without writing progress or changing preferences. The old generation queue remains separate from this scoped authoring task.
