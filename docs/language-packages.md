# Study cores and explanation pairs

Every downloadable package has a language identity, kind, semantic version, license notice and stable entry IDs. Packages contain data only; exercise code stays in the app.

| Package | Contains | Depends on |
|---|---|---|
| `de-core` | German words, grammatical metadata and German examples | — |
| `de-ko` | Korean meanings and translations of German examples | An exact `de-core` version |
| `de-en` | English meanings and translations of German examples | An exact `de-core` version |
| `zh-core` | Chinese words, pronunciation and Chinese examples | — |
| `zh-ko` / `zh-en` | Korean / English explanations | An exact `zh-core` version |

To add another explanation language, publish its pair pack and update the hosted catalog. The selector discovers available pairs from that metadata. Menu translations are bundled separately; when the explanation language has no menu translation yet, menus use English while learning content uses the requested explanation language.

## Version-2 contract

Study packages use `kind: "study"`, `id: "<target>-core"`, `targetLanguage`, `version`, `schemaVersion: 2`, `license` and `entries`. Entries contain `id`, `word`, `partOfSpeech`, optional article/pronunciation and an optional target-language example. Explanation translations must not be embedded in the core.

Explanation packages use `kind: "explanation"`, `id: "<target>-<explanation>"`, `targetLanguage`, `explanationLanguage`, `studyVersion`, their own `version`, `schemaVersion: 2`, `license` and entries with `id`, `meaning` and optional `exampleTranslation`. Every core entry must be covered, including translations for every example.

A catalog descriptor contains the identity/version fields plus URL, exact byte length and SHA-256. Each explanation pair has one preferred release in the catalog. Multiple study-core versions can coexist to support pairs updating at different times. Catalog keys must be unique and each pair must reference an available core. A checksum does not authenticate an untrusted catalog: configure production catalogs on trusted HTTPS hosting.

The app fetches the hosted catalog with a timeout, preserves the last validated catalog for offline use and has a bundled fallback. Adding packages does not require editing the picker. Before shipping native binaries, configure the production endpoint; the development endpoint is `/language-packages/catalog.json`.

## Installation and storage

`loadStudy(manager, catalog, targetLanguage, explanationLanguage)` installs the required core and selected pair, then joins them by stable entry IDs in memory. Only the chosen pair is downloaded; changing explanations reuses the core. Invalid translations are rejected before storing the pair or showing a study view. A successful core download remains reusable if the pair download fails.

`createPackageManager({storage, baseUrl})` exposes `get(id, version)`, `ensure(descriptor, options)` and `install(descriptor, options)`. Matching installed versions work offline. Options include AbortSignal, a progress callback and a pre-install validator. Downloads require HTTPS except on loopback, omit credentials, reject redirects, enforce a 30 MiB limit, and validate size, hash, UTF-8, JSON, identity and content before an atomic write.

The storage adapter implements async `get(id, version)` and atomic `put(package)`. IndexedDB stores independent immutable-version records so a newer core cannot overwrite a version another pair still needs. The old preview's package store is preserved during the database upgrade; its combined bilingual packages are not used as the new independent packs. Learner progress must remain separate and keyed by study language plus stable entry ID, not explanation language.

Browser storage may be evicted by the OS. Native durable storage, explicit package removal and Wi-Fi-only automatic updates are separate work. Selection currently installs missing catalog versions; no background updating runs. Full dataset provenance still needs review: a license field alone does not establish distribution rights.

### Reviewed Sentence Dictation Alternatives

A primary or additional example may declare `listeningAlternatives`, a unique list of up to ten reviewed complete sentences. Dictation accepts the canonical example and these alternatives; it still speaks and displays the canonical example. Retain source and component credits for alternatives under the example provenance. Word/search aliases never generate sentence answers automatically, because joining or substituting a word can change sentence grammar. Saved Review questions retain their original accepted sentences.
