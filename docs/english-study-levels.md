# English study groups

English 4.8.0 provides four editorial study groups. Word List, Flashcards, Meaning Quiz, Word Input, Cloze, Sentence Scramble, Dictation and Review share the selected group; entries are alphabetical within it. There is no All study level and no separate Academic/General Training exam filter. English uses British English speech and retains topic filters.

| Study group | Current entries | Purpose |
| --- | ---: | --- |
| IELTS 1.0–3.5 | 3,854 | Basic everyday meanings and foundational grammar words |
| IELTS 4.0–6.5 | 4,623 | General intermediate meanings, including the remaining common-word baseline |
| IELTS 7.0–8.0 | 2,902 | Advanced academic and specialised meanings |
| IELTS 8.5–9.0 | 1,366 | Precision vocabulary, including 1,333 distinct GRE-level headwords |

These are editorial learning groups, not official IELTS vocabulary lists or predictions of exam scores. Stored meanings determine placement; a frequent spelling may also have a less common sense in a higher group. [Common-word coverage](english-common-coverage.md) records how every NGSL 1.2 headword and supplementary day/month/number headword is available in the first two groups while retaining specialised entries.

The earlier 4.2.0 difficulty review classified the then-current 12,356 entries. The 4.8.0 expansion adds 389 bilingual entries and moves 249 individually bound general senses; its separate source ledger documents those changes. More than 1,000 distinct precision headwords remain at the top. Existing definitions, examples, attribution and stable IDs are preserved. Not every existing dictionary entry has a complete example, and editorial review is not native-speaking lexicographer certification.

## Existing downloads and progress

Update English explanations in **Settings → Language Packages → English** to get the 4.8.0 content. Installing a new shell preserves downloaded package versions. Core and explanation packages update together without erasing progress; published old snapshots remain immutable.

`web/js/shared/english-levels.js` still adapts historic five-tier payloads to these four groups. Old entry levels 1.0, 3.0, 5.0, 6.5 and 8.0 named editorial tiers rather than independently assessed IELTS scores. Saved target scores migrate to their containing range; invalid or former All selections use the introductory group. Review uses a current entry's group where available and adapts old snapshots when necessary.
