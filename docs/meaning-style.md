# Vocabulary meaning style

Use concise, sense-appropriate equivalents when Study Language differs from Explanation Language. Japanese 車 becomes **자동차 / car**, 猫 becomes **고양이 / cat**, and 食べる becomes **먹다 / eat**. Use ordinary words or short phrases, with a few synonyms where useful. Keep a brief qualifier when needed for sense, register, grammar, a cultural term or an outdated/offensive expression.

English → English uses dictionary-style definitions. Do not replace an English word's English definition with that same word. Other same-language explanation packs are not currently offered.

This rule applies to the shared meaning field, so Word List, word details, Flashcards, Meaning Quiz, Word Input, Review meanings and sense clues use the same content. Example sentences and their translations remain complete sentences. Display Language remains independent of Explanation Language.

## Source and release process

The broad import used NIKL definition fields even where the same entry/sense had a short equivalent. `scripts/content/concise-translations.mjs` selects the Korean source headword or English translated-equivalent field only when the existing definition and source entry/sense still match. It also recognises the previously applied British spelling variants. A corrected definition does not revert to a different old source sense.

Japanese exceptions are explicit bilingual editorial records bound to the existing word and both original meanings. English source glosses must come from the selected English Wiktionary evidence and match the existing meaning's opening equivalent; a Japanese gloss or a literal bird sense cannot replace a figurative person sense. An explicit short equivalent before a definition may be retained. Do not shorten by character count, ellipsis, selecting a random dictionary sense or truncating an unstructured definition.

Run `node scripts/build-concise-translations.mjs --dry-run` to inspect changes and `node scripts/build-concise-translations.mjs` to reproduce the edition from its hash-bound inputs. Published package bytes are immutable. Each explanation has its own version and retains the existing compatible study-core version; explanation updates do not require a core download or progress reset. The English → English, German and Chinese payloads are unchanged by this edition.

Inputs, the per-entry change ledger, counts and source notices are under `language-packages/sources/concise-translations/`. Existing examples, translations, word IDs, levels, grammatical facts and licence attribution are preserved. Archived explanation packages retain the prior definitions. Saved question snapshots keep their original wording; new questions and Review headword meanings use the installed concise meanings. Editorial review is AI-assisted; native-speaker certification remains pending. Concision does not establish exhaustive exam membership or certify the entire corpus's linguistic accuracy.

## Natural Korean corrections for Japanese

Prefer familiar Korean over literary dictionary labels or isolated bound forms: 明日 **명일 → 내일**, 作 **작 → 작품**, 祖父 **조부 → 할아버지**, 空欄 **공란 → 빈칸**. Check the selected Japanese sense and example before changing a short gloss: 歯 in the comb example means **빗살**, not human teeth. Keep ordinary Sino-Korean terms such as 학교 and precise technical names. Keep legitimate short words such as 눈 and 손; length alone is not an error.

The Japanese → Korean 4.6.0 edition contains 771 corrections. Its source-bound inputs, decisions, review policy, counts and original credits are under `language-packages/sources/meaning-style/ja-ko-4.6.0/`. This is a targeted editorial correction, with full-list screening for short or literary labels. The report distinguishes 2,530 individually assessed entries from 9,497 screened unchanged entries. `completeDecisionCoverage` confirms a bound decision for every entry; it does not certify that every retained sense received a linguistic review. There were no independent reviewers in this pass; native-speaker certification remains pending.

Audit with `node scripts/review-korean-meanings.mjs audit DIRECTORY`. Rebuild with `node scripts/review-korean-meanings.mjs build DIRECTORY OUTPUT 4.6.0`, where `DIRECTORY` is the archived source folder above (or the local authoring workspace). Changed decisions require a reason and a matching source digest. If independent review is required by the manifest, only approvals for the exact decision count, and unresolved findings block publication. Existing core, English meanings, all 12,027 examples and Korean sentence translations are preserved; install the Korean explanation update through Settings → Language Packages.
