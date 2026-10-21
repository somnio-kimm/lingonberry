# Collocations in every study language

The first shared edition contains 66 original collocations: English 9, German 10, Spanish 10, French 10, Japanese 8, Korean 9 and Chinese 10. Every current study-level filter has at least one linked example. Levels follow the existing headword IDs; they do not certify the grammar or sentence difficulty. This is a starter set of verbal collocations, not full dictionary coverage.

## Where to find them

- Word List shows a phrase preview below the word meaning. Search matches the phrase and its explanation as well as the headword.
- Open the word block to see Collocations / 연어: phrase, its own meaning, an original usage example and the example translation. Both phrase and example can be spoken using the existing device voice.
- Meaning Quiz → Exercise Type → Collocations tests phrase meanings. Options are meanings of the same phrase type.
- Word Input → Exercise Type → Collocations asks for the studied collocation in dictionary form, with a headword cue. Reviewed alternative expressions are accepted. The phrase audio stays out of typing questions before submission.
- Mistakes use the existing Review and mixed retest stores. Package updates preserve the original word IDs and learner progress.

German and Chinese use their existing vocabulary controls, input/IME handling, feedback and Review paths. The other languages generate their collocation questions through the existing shared custom-exercise renderer. Word details use one shared collocation section renderer in all seven languages.

## Data and licences

`language-packages/sources/exercises/collocations.json` is the authoring source. All glosses, usage sentences and translations in this set are original Lingonberry text under MIT; no publisher exercise bank, dictionary definition or source example sentence is reproduced. The underlying dictionaries retain their original attribution and licences unchanged. Common lexical combinations are factual material. The independent AI-assisted review checked every row and corrected eight findings; this is not fluent-speaker certification.

Study cores contain only phrase/example/accepted-answer data. Independently downloaded explanation packs contain the phrase meaning, example translation and meaning options. Korean study offers English explanation; the other study languages offer English and Korean. No same-language Korean explanation package is added.

`collocations-review.json` binds the reviewed rows to hashes. `collocations-release.json` records the exact immutable baseline versions and source-package hashes. `node scripts/build-collocation-packages.mjs` deterministically rebuilds the new release; `--dry-run` validates without writing. Existing published bytes cannot be overwritten.
