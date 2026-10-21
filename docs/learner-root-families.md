# Learner roots, prefixes and suffixes

English → Root Families has separate Browse and Practice tabs. Confusable Words is a different Study feature: similar spelling does not prove shared ancestry. Meaning Quiz and Word Input remain ordinary vocabulary tests.

Browse starts with all 27 curated groups, including aud, ex-, two different in- prefixes, -less, -logist and clud / clus. Each group has a simple Latin, Greek or Old English origin label, an original English/Korean meaning and related dictionary words. Type and search filters work across the whole set. Selected Study Level restricts the browser when wanted; Practice always follows the selected level and ordinary study filters.

The set contains 92 member links to 82 distinct existing vocabulary entries across all four English study bands. It replaces the advanced historical-source browser, not the dictionary. It is a reviewed starter selection, not an etymological analysis of every English word. Origin identifies the historical element, including later English formations and transmission through another language; it does not claim every modern word was borrowed directly from that language.

Practice asks for a related word matching its existing dictionary meaning, using the element and origin as clues. Choices come from same-part-of-speech members with distinct displayed meanings; a group with too few choices can still offer typing. A clue that already contains the complete answer is withheld. Historical relationships are not a formula for deriving a modern meaning. Defaults and confusable-word questions are unchanged.

## Content and licences

`language-packages/sources/exercises/learner-word-families.json` contains the original short English/Korean element glosses, exact dictionary IDs and factual reference links. No publisher definitions, examples or etymology prose are reproduced. This original selection and gloss text is MIT; related dictionary definitions retain their existing source licences and provenance. Review is AI-assisted and has not been certified by a native-speaking lexicographer.

The immutable English 4.5.0 core and independent English/Korean explanations preserve all 12,356 vocabulary records and existing collocations/confusables. Previously published snapshots stay unchanged. The old advanced historical table remains in archived editions and editorial source files; the current learner browser uses only curated groups.

## Rebuilding

`learner-word-families-release.json` records the reviewed source hash, source permalink commit, baseline hashes and fixed version transition. Run `node scripts/build-learner-families.mjs --dry-run` to validate; omit `--dry-run` to reproduce the identical release. The writer rejects differing existing release bytes.

The release test checks source integrity, stable vocabulary, separate bilingual glosses, preserved confusables and absence of technical proto-root forms. Package-backed browser checks exercise the separate screens, root search, grading, offline reuse and matching phone/tablet layouts.
