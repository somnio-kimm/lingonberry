# Wiktionary source reuse

Wiktionary is a source for all seven study languages and explanation languages.
Reuse suitable source definitions and usage examples before generating absent
fields. Reuse is a draft-producing step, not a declaration that a dictionary
sense, example or translation has passed language review.

The pipeline has three small components:

1. `wiktionary-sources.py` streams the seven pinned edition archives into a
   separate SQLite catalogue. It retains exact matching headwords, raw rows,
   senses, examples, readings, source lines, SHA-256 identities and licence
   records. It reads the generation queue without changing it. Compressed dumps
   are never expanded to large intermediate JSONL files.
2. `match-wiktionary.py` matches the current selected sense using exact lemma,
   part of speech, compatible reading and a unique complete gloss in the
   explanation language. An explicit snapshot/row/sense identity can also bind
   a reviewed selection. Token overlap, matching spelling, a translation-table
   equivalent, or a character appearing inside a word does not establish sense
   equivalence. Ambiguous matches remain held.
3. `reuse-wiktionary.py` audits the catalogue against missing queue fields. With
   `--apply`, it creates immutable source-bound replacement jobs and saves
   unreviewed drafts. Existing entries, accepted text and saved draft results
   remain unchanged. A native example and its available source translations
   are imported atomically. Model inference is never started by this command.

The seven **editions** are separate from the seven **study languages**. For
example, Korean words in English Wiktionary have English glosses; the Korean
edition can have Korean explanations for foreign words. Sentence translation
fields follow their edition language. Deprecated English `english` fields are
also recognised. Translation tables contain lexical equivalents, not full
sentence translations or automatically suitable learner definitions.

## Run the source pass

Use the repository root and an existing queue. Raw source paths are relative to
that root and recorded in `language-packages/sources/wiktionary-source-manifest.json`.
The manifest pins the actual compressed bytes. Unknown historical dump dates and
extractor revisions remain explicitly unknown. To reproduce a missing archive,
download its recorded URL and verify its hash; mutable upstream URLs may now
serve a different version, which requires a newly audited manifest.

```sh
python3 scripts/content/wiktionary-sources.py \
  --queue "$CONTENT_QUEUE" \
  --manifest language-packages/sources/wiktionary-source-manifest.json \
  --root . --output local-data/sources/wiktionary/sources.sqlite

python3 scripts/content/reuse-wiktionary.py \
  --queue "$CONTENT_QUEUE" \
  --catalog local-data/sources/wiktionary/sources.sqlite \
  --report local-data/sources/wiktionary/reuse-audit.json

# After inspecting the audit and preserving a consistent queue backup:
python3 scripts/content/reuse-wiktionary.py \
  --queue "$CONTENT_QUEUE" \
  --catalog local-data/sources/wiktionary/sources.sqlite \
  --report local-data/sources/wiktionary/reuse-applied.json --apply
```

`--replace` explicitly rebuilds a catalogue atomically. A hash mismatch leaves
an existing catalogue intact. A repeated import skips already completed fields.
The optional `--include-single-sense-candidates` flag on the audit/import command
also retrieves a source sense when it is the only eligible sense for that exact
lemma, part of speech and reading in an edition. This handles different wording
between dictionaries without pretending it proves semantic equivalence. Such
drafts explicitly retain `selected-sense-equivalence-unverified` alignment and
must pass the same independent meaning review before use. Multiple possible
senses remain held, and an existing licensed definition candidate takes priority
over this weaker retrieval method. Without the flag, matching stays exact.

Editorial source exclusions are recorded in
`language-packages/sources/wiktionary-review-exclusions.json`, bound to the exact
entry digest and source snapshot/row/sense. This keeps an observed mismatch out
of subsequent imports without rewriting entry evidence or discarding saved
drafts. The first audit excluded the adverb *raw* source sense that conflicted
with the existing uncooked-food meaning. Spot checks are not full-corpus review.

Repair jobs marked as requiring generation or revision are preserved. Each
import retains the original entry/sentence digest and adds a separately bound
source candidate; it does not rewrite the whole entry evidence and invalidate
unrelated saved work.

The ordinary worker can consume a bound source candidate without loading a
model. After the source pass, only remaining pending fields require generation
or source/editorial review. Some pending meanings already contain licensed NIKL
candidates; those still use the existing source import path. A held Wiktionary
candidate does not count as a completed field or prove that no reusable example
exists. English self-explanations are supported; other self-explanation pairs
are excluded, preserving the 43-pair policy.

## Example and sense checks

English-edition usage examples must be explicitly classified as `example`,
without reference or quotation evidence. The other edition extractors commonly
omit this classification, so their examples are retained as source evidence but
held for rights verification. No absence of a reference is treated as proof of
authorship. Quoted books, news, historical attestations, media and externally
credited passages are excluded from automatic reuse.

Examples must have plausible sentence shape and language/script, and a focus
span verified against the headword or a recorded inflection. Raw code-point
spans are converted to JavaScript UTF-16 offsets. These structural checks do not
certify grammar, naturalness, difficulty or translation accuracy. Exact-gloss
matching deliberately leaves many cross-edition senses unresolved; a missing
French definition cannot be inferred from English token overlap.

Imported candidates go through separate digest-bound field review and the
existing complete-entry release gates. A source import never marks itself as
native-speaker reviewed and never publishes or changes installed packages.
Model generation remains governed by the user's pause/resume decision.

## Observed import on 17 October 2026

The [full inventory report](wiktionary-reuse-2026-10-17.json) records the audit of
all 76,385 entries. The seven source editions provided 360,240 matching raw
records and 430,775 example candidates. The import added 20,159 definition
drafts, 1,190 native-example drafts and 676 exact source sentence translations.
All 10,018 earlier results and all entry digests were preserved; SQLite integrity
and every new candidate/output binding were verified.

These 22,025 additions are unapproved source drafts. Most were retrieved from a
unique eligible sense, which still needs semantic checking. There are 41,923
native examples and 683,123 total text fields still missing, including deferred
translations of those missing examples. Models remain paused and no packages
were published. The standalone local Drive-folder snapshot is
`local-data/generation/content-wiktionary-2026-10-17.sqlite`; its verification
metadata is beside it. Local saving does not establish that Drive has completed
its cloud upload.

## Attribution and commercial distribution

The applicable Wiktionary text is reused under **CC BY-SA 4.0**. Preserve the
individual source article and contributor-history URL, edition contributors,
licence URL, snapshot hash, source row and sense identity. Sentences retain their
source text; joined parent/child gloss context and converted focus offsets are
recorded as modifications. Translations and edits derived from it retain the
source attribution and share-alike terms, with modification notices. They must
not be relabelled as unrelated original MIT or CC BY material.

The materialiser retains these records for imported fields and their generated
adaptations. The companion notice is
`language-packages/credits/WIKTIONARY-SOURCE-REUSE.txt`; the full CC BY-SA 4.0
text is already in `language-packages/credits/CC-BY-SA-4.0.txt`. Include both
notices and per-field credits in any release using this import. Existing NIKL,
Tatoeba and original content retain their own applicable notices.

Commercial reuse does not require a Wiktionary licence fee, but conditions
still apply. The app's independently written code has its own MIT licence.
Covered data and adaptations must remain reusable under their licence; do not
apply incompatible app terms or effective technological restrictions to them.
Providing a separate unrestricted data download is useful but does not by itself
certify compliance of the App Store distribution. No store distribution or
release compliance certification is performed by this local draft import.

Primary references:

- [Wikimedia Terms of Use, section 7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Wiktionary copyright guidance](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- [Kaikki raw edition downloads](https://kaikki.org/dictionary/rawdata.html)
