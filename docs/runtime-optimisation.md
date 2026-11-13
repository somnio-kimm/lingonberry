# Runtime optimisation

The November 2026 pass keeps the existing German/Chinese design, dictionary sense IDs, package versions and learner records. It changes runtime work and ownership boundaries.

| Area | Change | Boundary |
| --- | --- | --- |
| Sentence questions | Reuse tokenisers and the last immutable word set per Cloze/Scramble mode | Fresh choices and detached question snapshots; clear on content replacement |
| Additional-language progress | Separate IndexedDB profile, word-status and saved-question rows, with a small durable recovery journal | Import legacy snapshots verbatim; await hydration; preserve failed writes for replay |
| Installed packages | Read a small metadata index instead of deserialising every payload | Atomic metadata/payload changes; migration never rewrites payloads |
| Screens and native checks | Separate Word List, Flashcards and Review views; move native DEBUG scripts out of the app controller | Presenter owns study state and question policy; Release excludes native QA |
| Unused code | Remove nine uncalled German course writers and 16 exact duplicate sentence CSS rules | Preserve historical data/readers and later cascade overrides |

## Measurement

A seeded Mac benchmark used the real English vocabulary with identical selected questions before and after caching. For the largest 18,042-word set, Scramble preparation/selection had a 223.8 ms median before the change, 83.5 ms for the first new preparation and 0.148 ms for repeated draws. This measures question preparation on this Mac, not total screen time or iPad performance. Caches hold at most one pool per sentence mode.

## Verification

- 823 unit tests and project/shell-asset checks passed.
- Actual IndexedDB browser checks cover legacy progress import, interrupted-write replay, profile isolation, failed-open retry, protected erasure, package index migration and atomic rollback.
- Real-package screen checks cover English/Japanese, English/Korean, phone/tablet and light/dark, including saved retests and confirmed deletion; specialist Review is checked against the German/Chinese geometry.
- Shared design and Cloze checks cover underline alignment, touch targets, keyboard/IME input and existing card/filter/detail layouts across the four languages.
- Debug and unsigned Release builds compile; the Release executable excludes the opt-in QA scripts.
- Language-package payloads and the pinned content source remain unchanged.

Native delivery uses build19 of the existing app identifier, installed in place without uninstalling or resetting data. The signed-device offline/package and progress-migration results are recorded in [delivery issue291](https://github.com/somnio-kimm/lingonberry/issues/291). See [native verification](native-verification.md) for the exact checks and evidence limits.
