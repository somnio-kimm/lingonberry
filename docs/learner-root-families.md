# Readable English roots and affixes

English → Root Families → Browse now searches the full source inventory rather than a 27-group starter. It includes 5,863 source entries and 7,261 complete English/Korean sense explanations: 1,688 root entries, 2,438 prefix entries, 1,644 suffix entries, 56 infix entries and 37 interfix entries. There are 5,065 distinct primary forms. Homonymous etymologies and meanings remain distinct; these totals are source entries, not a claim of that many unique historical families.

Forms are readable English labels such as ab-, ad-, -ling and aud-. Reconstructed/phonetic labels such as *h₂eng- are rejected by the package schema, not merely hidden with CSS. Variants stay attached to their source root groups. Browse is independent of the 12,356-entry study dictionary and its selected level; a root without a matching study word remains visible.

Use Type to select roots, prefixes, suffixes, infixes or interfixes. Search covers forms, variants, displayed meanings and every supplied related word, including those not currently rendered. Cards and long related-word lists load in small batches. Related words show every matching dictionary entry, including separate parts of speech and senses, with their meanings and learning levels. Each opens its normal word detail. Explicit spelling aliases also link. References without a dictionary entry remain plain words; the app does not invent their meanings or choose an arbitrary sense. Source links remain available per entry. Where no origin or related word is documented, the app does not invent one. Historical origin labels describe the source attribution, not a rule for deriving modern meanings.

Obsolete, archaic, rare, offensive, derogatory, vulgar, nonstandard and other meaningful source usage labels are retained and translated. Internal extraction tags are not shown. Source text and translations have AI-assisted review, not native-speaking lexicographer certification.

Practice remains a separate tab using the explicitly reviewed word-family questions. Importing a reference relationship does not automatically create a scored exercise. Default Meaning Quiz and Word Input remain ordinary vocabulary tests; Confusable Words is removed from Study and new question generation. Existing Review history is preserved.

## Coverage and sources

The Wiktionary scan reads the entire fixed cached English-edition snapshot (10,913,997 source rows), selecting English affix records with letter/hyphen/apostrophe labels and definitions. It is not restricted to current study words. The root reference imports all defined readable rows from the Greek/Latin A–G, H–O and P–Z tables. Five blank table rows received independently checked bilingual supplements; three other blank rows already occur as variants in defined groups and are not duplicated. The complete source hashes, fixed Wikipedia revision URLs, source-line evidence, coverage totals and editorial corrections are stored in `language-packages/sources/exercises/english-morpheme-inventory.json`.

This is complete coverage of the defined readable inventory in those fixed sources, not a universal, final count of every English morpheme. English word formation is productive and sources differ in whether they count variants, scientific combining forms, archaic elements or separate senses. No numerical quota is used to invent additional families.

Review corrected omitted child definitions, origin extraction that mistakenly read the word "English" in an etymology tree as evidence, and specific source errors including mina-/temn-, the shin/skin typo and an incorrect anilino chemical description. Corrections retain their original source text and references in the authoring audit.

## Commercial reuse and independent downloads

Wiktionary and Wikipedia contributors are attributed. Imported glosses, related-word references, and their Korean translations/editorial adaptations are CC BY-SA 4.0, including for commercial distribution; they are not relabelled MIT. Each package's Licence sheet retains the existing dictionary licences and adds Wikipedia attribution. The repository's code licence remains MIT. The authoring JSON is available with the data downloads so adaptations and their source references remain accessible.

English 4.6.0 supplies the inventory in its study core and independent English/Korean explanation downloads. All existing vocabulary entries, examples, curated families, exercise IDs and learner progress remain unchanged. Published earlier package bytes are immutable. The package size ceiling is 64 MiB so the expanded approximately 30 MiB core remains downloadable with size/integrity/schema validation.

## Reproduction

1. `scripts/content/inventory-english-morphemes.py SNAPSHOT.gz --output local-data/morpheme-inventory` scans the complete source without a study-word cap.
2. Save the three attributed root table HTML snapshots in that directory and run `scripts/content/prepare-morpheme-inventory.py`. It preserves full hierarchical sense paths and only uses structured or explicit prose origin evidence.
3. Complete all three ID-bound Korean translation sets, corrections and five supplemental roots. `scripts/content/finalise-morpheme-inventory.py` rejects missing, duplicate or empty explanations and produces the public authoring JSON.
4. The release manifest binds that authoring hash to exact 4.5.0 baselines and the fixed 4.6.0 transition. `node scripts/build-morpheme-inventory.mjs --dry-run` validates; omit `--dry-run` to reproduce the byte-identical immutable release.
5. Run `npm test`, `npm run check` and package-backed browser checks before updating the native content pin.

## Existing iPad installations

Updating the app shell preserves downloaded package versions. English 4.5.0 has only the earlier 27-family reference; English 4.6.0 and 4.7.0 include the 5,863-entry inventory. In **Settings → Language Packages → English**, use **Update** for each installed explanation language. The app updates the shared English core and the selected explanation together without erasing learner progress. Return to **Study → Root Families → Browse**; with an empty Search and Type set to All, the current inventory reports **5,863 Entries · 5,863 Total**. Cards load in batches; Show More Words or Search accesses the remaining entries.

The opt-in native English check updates both EN/KO packages through this same flow, compares the rendered count with the installed core rather than the build's files, searches for the aud family, and restores the prior English study-level preference. It expects the current combined phrase section and rejects retired menu buttons. `verify-morpheme-inventory-browser.mjs` also checks the real packaged inventory in both explanation languages, including pagination, search and root-only coverage.
