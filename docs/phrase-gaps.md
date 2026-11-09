# Separated Phrase Gaps

English expression headwords are included in **Meaning Quiz**. Their authored sentence gaps are included in **Cloze**, which offers **Selection** and **Typing** using the shared sentence-card design. Typing provides a separate device-keyboard input for each blank, and Selection checks on tap. Saved expression mistakes keep their question snapshots and retest grading. English Verb Patterns remains retired.

For example, `Please ___ it ___ before you forget.` accepts `write` and `down` in separate fields. Enter moves to the next empty field. Submit becomes available only when every field is filled and IME composition has finished. After checking, each blank contains the corrected expression, with incorrect input crossed out beneath it. Next resets every input. Review keeps the original sentence, submitted parts and a snapshot suitable for mixed retests.

The English 4.7.0 release adds 18 authored scenarios (10 phrasal-verb, eight collocation), each with Selection and Typing versions: 36 exercise records with English and Korean contexts and explanations. They cover separable noun/pronoun objects and fixed multi-part patterns, including `put up with` and `do away with`; these are explicitly authored, not inferred from arbitrary phrase text. Approved whole-pattern alternatives remain aligned: `subjected … to` and `put … under` are accepted, but `subjected … under` is not. Coverage is representative, not every vocabulary entry. Levels follow stable anchor entries and do not certify sentence difficulty.

## Data and maintenance

- `language-packages/sources/exercises/phrase-gaps.json`: original MIT questions, contextual clues, alternatives, distractors and bilingual explanations. Publisher references record factual grammar checks; no exercise-bank sentences or definitions are copied.
- `scripts/build-phrase-gap-packages.mjs`: reproducible release from SHA-256-pinned 4.6.0 baselines. Existing entries, roots, exercises and progress IDs remain unchanged. Published snapshots remain immutable.
- Core rows contain only prompt structure and answers: `gapFill.parts`, aligned `answers` and optional aligned `alternatives`. Explanation packages separately contain `instruction`, `context` and `explanation`. Validation prevents translation rows overriding the core structure.
- `phrase-gaps.js` owns answer matching; `phrase-gap-view.js` owns escaped inline markup. The language-neutral renderer, shared device-keyboard binder and existing progress store own screen behaviour. Downloaded content supplies no executable code.

Run `npm test`, `npm run check`, `node scripts/verify-phrase-gaps-browser.mjs` and the existing shared-design checks. The gap browser check exercises real packages in EN/KO, phone/tablet widths and light/dark themes, partial submission, Enter navigation, approved alternatives, per-slot feedback, instant choice grading, Review/retest and historical question handling. Run `node scripts/verify-merged-expressions-browser.mjs` for the current default-section routing, shared Cloze controls, separate blanks and retests.
