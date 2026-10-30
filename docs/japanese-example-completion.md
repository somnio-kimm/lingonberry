# Japanese 4.4.0 example completion

All **12,027 current Japanese entries** now have a primary example and complete English/Korean example translations. This edition fills the **10,000 missing entries** while preserving the existing 2,027 examples, every stable ID, current meanings and study levels.

| Study Level | Entries With Complete Examples |
|---|---:|
| N5 | 603 |
| N4 | 907 |
| N3 | 1,504 |
| N2 | 3,007 |
| N1 | 6,006 |
| Total | 12,027 |

These are the app's existing editorial JLPT groups, not official exhaustive exam-word lists. Each newly published triplet has an independent AI editorial pass bound to its exact record and original source sense. Review checked lexical sense, grammatical role, intended focus, naturalness, participants, quantities, tense, register and translation fidelity. Generic topic-learning filler was replaced with concrete usage. Native-speaker certification remains pending.

## Explicit Equivalent Corrections

Review found six Japanese surfaces that did not express their existing concepts. English/Korean meanings, IDs, part of speech and levels remain unchanged; the original sources and factual evidence are retained in each correction record.

| Earlier Surface | Corrected Surface | Retained Concept |
|---|---|---|
| 趣向 | 嗜好 | Personal taste or preference |
| 球場 | 競技場 | A general sports stadium |
| 再犯 | 再犯者 | A repeat offender, a person |
| 貨車 | 貨物自動車 | A goods-carrying motor vehicle |
| 山犬 | ドール | The dhole, *Cuon alpinus* |
| 公休 | 祝日 | A state-designated public holiday |

Obsolete questions involving these entries are excluded from active Review/retests through the shared version policy. Stored history and word progress are preserved.

## Attribution And Reproducibility

The new set contains **9,999 app-authored examples** under CC BY 4.0 and **one explicitly attributed Wiktionary usage example/adaptation** under CC BY-SA 4.0. The latter retains English Wiktionary contributor credit, the exact entry/history URLs and a change notice; its English/Korean translations are covered by the recorded share-alike licence. Existing NIKL, Wiktionary, EDRDG and other component notices remain intact. Original source quotations were not added by this completion.

The versioned [source directory](../language-packages/sources/examples/editions/4.4.0/) contains the exact authoring records, independent review ledger, original sense bindings, author ownership, licence notice and completion report. The report binds those artifacts and the archived input packages by byte size and SHA-256. A changed record needs a fresh pass; an unchanged finding requires an explicit, explained resolution. Native review is reported separately from AI editorial coverage.

Run `node --test tests/japanese-example-completion.test.mjs` to verify all release artifacts, reproduce the entries from the archived inputs, preserve existing examples/meanings and check corrected-question invalidation. General authoring and native download-check commands are documented in [Example Authoring](example-authoring.md). Older released files remain immutable.
