# Collocations

Collocations practice is active for English, Korean, Spanish and French. English expression headwords use Meaning Quiz, and authored expression sentence gaps use Cloze with Selection and Typing. German and Chinese no longer expose its Study route, fresh questions, Word List previews, word-detail sections or phrase-only search terms. Existing saved collocation mistakes remain available in Review and retests; source packages and learner history are preserved. Japanese Collocations practice was retired earlier.

The historical first shared edition contains 66 original collocations: English 9, German 10, Spanish 10, French 10, Japanese 8, Korean 9 and Chinese 10. Every current study-level filter has at least one linked example. Levels follow the existing headword IDs; they do not certify the grammar or sentence difficulty. This is a starter set of verbal collocations, not full dictionary coverage.

## Where to find them

The following standalone Collocations routes apply to Korean, Spanish and French. English uses the default sections described above.

- Word List shows a phrase preview below the word meaning. Search matches the phrase and its explanation as well as the headword.
- Open the word block to see Collocations / 연어: phrase, its own meaning, an original usage example and the example translation. Both phrase and example can be spoken using the existing device voice.
- Study → Collocations → Selection tests phrase meanings. Options are meanings of the same phrase type.
- Study → Collocations → Typing asks for the studied collocation in dictionary form, with a headword cue. Reviewed alternative expressions are accepted. The phrase audio stays out of typing questions before submission.
- Mistakes use the existing Review and mixed retest stores. Package updates preserve the original word IDs and learner progress.

Active languages generate collocation questions through the shared custom-exercise renderer. German and Chinese retain their vocabulary input/IME, grading and feedback paths for historical collocation retests, without a standalone practice entry point. Presentation projections omit retired collocation data without modifying downloaded packages. Word details continue to use the shared collocation renderer.

Default Meaning Quiz and Word Input remain ordinary vocabulary tests. Specialist features have separate Study buttons. Choice answers check on tap; typing uses Submit. English-with-English explanations omit the example translation.

## Data and licences

`language-packages/sources/exercises/collocations.json` is the authoring source. All glosses, usage sentences and translations in this set are original Lingonberry text under MIT; no publisher exercise bank, dictionary definition or source example sentence is reproduced. The underlying dictionaries retain their original attribution and licences unchanged. Common lexical combinations are factual material. The independent AI-assisted review checked every row and corrected eight findings; this is not fluent-speaker certification.

Study cores contain only phrase/example/accepted-answer data. Independently downloaded explanation packs contain the phrase meaning, example translation and meaning options. Korean study offers English explanation; the other study languages offer English and Korean. No same-language Korean explanation package is added.

`collocations-review.json` binds the reviewed rows to hashes. `collocations-release.json` records the exact immutable baseline versions and source-package hashes. `node scripts/build-collocation-packages.mjs` deterministically rebuilds the new release; `--dry-run` validates without writing. Existing published bytes cannot be overwritten.
