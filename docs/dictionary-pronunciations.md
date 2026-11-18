# Dictionary pronunciation supplement

English 7.1.0 and German 4.1.0 add supplied textual IPA for optional Word Dictation hints. Chinese pinyin and Japanese kana retain their existing supplied readings. No speech files, local inference, APIs or generated phonetic transcriptions are used.

The import reads existing cached Wiktionary extracts, matches exact headwords and normalised parts of speech, prefers British English and broad transcriptions, and rejects ambiguous equally ranked readings. Historical, inflected and explicitly mismatching POS readings are excluded. A heteronym such as verb *lead* is not assigned an arbitrary pronunciation when the source contains both /liːd/ and /lɛd/. Unavailable hints stay unavailable.

The editions retain all original entry IDs, levels, meanings and example translations. English adds 11,899 readings (11,902 / 40,713 entries total); German adds 8,564 (8,564 / 11,286). Counts include distinct sense records and expressions, so they are not unique-headword coverage or a claim that every sense pronunciation has human certification. English dictionary/Flashcard headings retain their existing plain typography; Dictation explicitly reveals the clue.

Source ledger: [dictionary-pronunciations-20261118.json](../language-packages/sources/dictionary-pronunciations-20261118.json). Each selected record retains the article and contributor-history URL, IPA and source tags. The source metadata retains creator credits, exact cached-file hashes and the known snapshot-date limitation. An entry's `pronunciationSource.record` is the zero-based index into this ledger; the core binds it by SHA-256. This avoids duplicating the same attribution paragraph thousands of times and keeps validated packs below their existing64MiB cap.

English and German Wiktionary contributors retain CC BY-SA4.0 rights. Selection/adaptation notices and credits appear in the pack Licence notice; full terms remain in [CC-BY-SA-4.0.txt](../language-packages/credits/CC-BY-SA-4.0.txt). Editable selected data is separately available without app-store restrictions. Original examples and other components retain their previous individual licences; app code remains MIT. No dictionary-provider endorsement is implied.

Reproduce from the recorded local source caches:

```sh
python3 scripts/content/import-dictionary-pronunciations.py --self-test
python3 scripts/content/import-dictionary-pronunciations.py
node scripts/build-dictionary-pronunciations.mjs
```

The builder validates complete explanation pairs, unchanged IDs and all non-pronunciation entry fields, then writes immutable versioned payloads before their integrity-bound catalogue descriptors. It refuses to overwrite a different immutable payload. Automated tests check the ledger bindings and that every meaning/example translation remains unchanged.
