# German, Chinese and Japanese entry review

The full review covers every entry's selected meaning, part of speech, reading or grammatical forms, example, English equivalent, Korean equivalent and both sentence translations. Cross-language meanings use concise equivalents; dictionary-style English definitions apply only to English learning through English. Existing German/Chinese/Japanese records are not expanded into the English per-sense card model during this pass.

Reviewers work through immutable `de-input.jsonl`, `zh-input.jsonl` and `ja-input.jsonl` under `local-data/coverage/four-language-review/`. Every input was compared with the current integrity-checked package bytes and every original `sourceDigest` recomputed. `non-english-review-manifest.json` records those bindings and preserves the earlier 240 Chinese and 80 Japanese decisions. These checkpoints do not establish full-list approval.

Use conversation agents for linguistic authoring and review. Local model inference and inference APIs remain disabled. Reading, hashing, parsing dictionaries and running application tests are ordinary tooling, not linguistic generation.

## Checkpoints and approval

Run with the repository's Node 26 toolchain:

```sh
node scripts/audit-language-entry-reviews.mjs
node scripts/audit-language-entry-reviews.mjs --require-complete
node --test tests/language-entry-review.test.mjs
```

Each primary decision binds the exact input, records the fields examined and explains retention or correction. Save atomically and calculate the actual missing-ID set on resumption. Preserve original source metadata and prior decisions. Never fill the journal with heuristic approvals based on field presence.

Every added or inherited additional example needs an explicit `additionalExamplesReviewed` acknowledgement and a matching, nonempty translation in each explanation's `additionalExampleTranslations` array. Put newly authored translations in `proposedEnglishExplanation` and `proposedKoreanExplanation`; a locale-keyed map on the decision itself is not consumed by package assembly.

The shared audit accepts the existing Chinese full-object proposal format and the German/Japanese field-review format. It separates primary review coverage from independently approved corrections and unresolved sources. Changed records require an independent `*-cross-review.jsonl` approval bound to the exact decision digest. Rejections and source findings block completion even when the primary reviewer retained an entry.

External source findings stay in `*-source-findings.jsonl`. An independent closure must cite the exact finding digests and supporting evidence; old approvals cannot hide a new source problem. Unclassified example metadata is an uncertainty, not proof of infringement. Contributor examples, publisher quotations and original new sentences must remain distinguished. Retained ShareAlike material and its translations keep compatible licences, source links and attribution.

Usage-representation findings stay separate from source uncertainties. For example, some official Chinese entries attach different parts of speech to different HSK levels. Preserve every verified official branch and its qualifiers; do not discard a valid meaning merely because the primary example uses another branch. An independent `usageResolution` is required before declaring the representation settled.

The audit verifies coverage and evidence integrity. It cannot itself establish linguistic correctness or native-speaker certification. Do not mark a language complete or publish its revised package until all required entries, correction approvals, source closures and package checks are complete.

## Language-specific checks

- German: check articles, plurals, verb paradigms, cases and idiomatic translations. Preserve genuine Goethe vocabulary matches. Official grammar and communicative inventories can establish basic forms missing from standalone headword extraction; record that evidence separately. A plain article form is not automatically the same sense as a relative pronoun. Unmatched reference vocabulary stays in editorial B2–C2 groups.
- Chinese: preserve official headword, citation pronunciation and level. Verify the example's selected polyphonic reading, contextual pronunciation, neutral tones and English/Korean interpretation. Separate spelling-format edits from linguistic corrections. The renderer accepts reading streams with or without punctuation tokens and gives punctuation no spoken annotation; joined erhua must not shift later readings.
- Japanese: review difficulty for the selected reading and meaning, rather than raw kanji spelling frequency. Check okurigana, transitivity and the grammatical function used in the example. Adjectival uses of na-adjective stems should have concise adjectival equivalents and the learner adjective tag, preserving original source classifications in history. Prefer ordinary Korean vocabulary over literary labels, without removing useful technical precision. JLPT levels are editorial placements, not claims of an official exhaustive word list.

Primary examples are learner content; unreviewed `referenceExamples` remain research evidence. Review any additional examples and their aligned translations explicitly. Staging, publication and native installation are separate steps and must be reported accurately.

Run `node scripts/verify-chinese-reading-review-browser.mjs` to check reviewed punctuation-free and joined-erhua examples in phone/tablet layouts and both themes. It uses isolated browser storage and does not install draft packages into the user's app.
