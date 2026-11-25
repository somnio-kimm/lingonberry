# Shared Study Design Reference

Use this reference for every new or changed feature in every study language. The shared November2026 refresh is the visual baseline for all four released languages. German article treatment and Chinese/Japanese readings remain language policies; surfaces, typography, controls, navigation and feedback share one design.

## Source of truth

- `web/study-theme.css`: semantic colours, theme behaviour, geometry tokens and shared component classes. Put reusable visual rules here.
- `web/js/shared/study-components.js`: escaped HTML primitives for search, quiz headers, segmented choices and reference-card headings. Reuse these rather than copying their markup or inline styles.
- `web/js/shared/word-rows.js`: incremental list rendering and cleanup.
- `web/js/shared/exercise-view.js`: language-specific exercise content inside the shared quiz presentation.
- German/Chinese renderers demonstrate the established Study, Word List, Flashcards, Review and quiz structure. Their stylesheets provide legacy base rules; new features must not depend on a new independent palette or change a base rule in only one language.
- `web/style.css`: host and package/settings layout; shared text-control sizing belongs in the theme.
- `web/lexicon.css`: language/content-specific text handling only. Shared card/control geometry belongs in the shared theme.

## Visual contract

| Element | Shared convention |
| --- | --- |
| Page | Existing host header and bottom navigation; 16px content gutter, maximum content width 920px |
| Light / dark | Light beige / dark grey, using `--bg`; system theme remains supported |
| Card | `.panel` / `.card`: 16px padding, 12px radius, 0.5px border, 16px section spacing |
| Section title | `.section-title`: 15px, weight 600, blue |
| List word / reference form | 24px, weight 700, main text colour; no faded or blue replacement word colour |
| List meaning / origin | 13px, secondary text colour |
| Word row | `.wl-list.wl-list--wordlist` and `.word-row-window`; established row padding/radius and 2px gap |
| Search | `renderStudySearch`: 17px text, no inherited input margins, existing search card wrapper, device keyboard |
| Reference group | `.panel.study-reference-card` plus `renderStudyReferenceHeading`; related words use normal Word List rows |
| Primary action | 14px, at least 44px high, 12px radius; Submit above smaller Skip, in normal content flow |
| Secondary action | `.btn-small` / `.text-button`: 14px, 32px minimum height, 8px radius |
| Segmented choices | `renderStudyTabs`: 14px text, equal widths, 44px minimum height; Selection left, Typing right when both are offered |
| Flashcards / word details | Keep established 36px flashcard words / 48px detail words; fixed readable surface with direct actions below; do not replace with reference-card sizes |
| Badges | Learning level pastel green; part of speech pastel orange; exercise type pastel blue |
| Feedback | Correct pastel green; wrong pastel red, with the existing correction treatment and animation |

Use the `--study-*` geometry tokens and semantic colours from the theme, not copied literal values. Keep special language colour meanings (German articles, for example) in their existing shared rules.

## Reusable recipes

```js
import {
  renderStudySearch,
  renderStudyTabs,
  renderStudyReferenceHeading,
} from './study-components.js';

const search = renderStudySearch({id:'feature-search', value:query, label:t('Search')});
const modes = renderStudyTabs({
  label:t('Answer Mode'),
  options:[{value:'choice',label:t('Selection')},{value:'input',label:t('Typing')}],
  selected:answerMode,
  attribute:'data-answer-mode',
});
const heading = renderStudyReferenceHeading({word:'ab-',origin:'Latin'});
```

These helpers escape visible text and values. Event handlers remain owned by the feature; downloaded content must never supply executable markup or handler code. Give each control an accessible label, use buttons for actions and preserve keyboard focus while filtering.

Reference-card structure:

```html
<section class="panel study-reference-card">
  <!-- renderStudyReferenceHeading(...) -->
  <ol class="study-reference-meanings"><li>Meaning</li></ol>
  <div class="study-reference-words">
    <h3 class="study-reference-words-title">Related Words</h3>
    <div class="wl-list wl-list--wordlist">
      <div class="word-row-window"><!-- normal .wl-row elements --></div>
    </div>
  </div>
</section>
```

Root Families shows related words directly. Search sits above the shared Filters disclosure with horizontally scrolling Type tags. The inventory total is omitted from the screen. Keep bounded Show More paging for long lists. Omit per-card/member source links from this study screen; retain the installed provenance and Settings Licence credits.

For a paged collection of reference cards, give the pager host `.study-reference-list` and use `mountWordRows`. This removes per-card bottom margins inside the grid so spacing does not double.

Do not style a nested word list through a broad descendant selector: the outer reference-card pager has 16px gaps; the nested Word List retains 2px gaps. Keep list pagination and source/usage information separate from the word meaning.

## Interaction and language contract

- Dictation uses `renderStudyQuizHeader` followed immediately by `renderStudyTabs` with `variant:'listening'`, then Filters, then the question. Word is left and Sentence is right. All languages reuse these renderers; do not put a separate compact switch below Filters. Saved-question retests omit the mode switch.
- Quiz headers show the title alone. Word-choice answers check on tap and then show Next. Do not add Submit to selection questions. Typing uses Submit and the device keyboard; Chinese pinyin input retains its dedicated keyboard.
- Submit, Skip and Next stay at the end of content, above the navigation by normal page flow. Do not make them floating overlays.
- Meaning Quiz and Cloze quiz cards omit the speaker. Word List details continue to offer audio. Meaning Quiz and Word Input remain vocabulary-only. Put specialist features in their own Study sections unless the user explicitly asks to merge them.
- German/Chinese Collocations is retired: omit the Study route, fresh questions and Word List/detail/search references through the shared capability policy and presentation projection. Retain stored question snapshots and the standard vocabulary feedback path for historical retests.
- Use a single underline for a missing answer, never an empty bracket pair. Chinese readings remain aligned above characters; do not add pinyin space to other languages unnecessarily.
- Reuse existing localisation keys, button labels and icons. Search says only Search / 검색. The interface follows the selected Explanation Language and falls back to English when unset or unsupported. Never show another explanation language as a fabricated fallback.
- Reuse standard Review hierarchy and stored question snapshots; do not invent feature-specific Review cards or erase existing progress.

## Required validation for UI work

Run `npm test`, `npm run check`, then the relevant browser checks:

```sh
node scripts/verify-study-design-browser.mjs
node scripts/verify-dictation-design-browser.mjs
node scripts/verify-dictation-screen-browser.mjs
node scripts/verify-design-parity-browser.mjs
node scripts/verify-practice-design-browser.mjs
```

The first is the reusable design contract: German/Chinese base styles, shared search/tabs/reference cards/word rows, light and dark themes, phone and tablet widths. The other checks use real downloaded data for established screens and specialist exercises. Inspect screenshots for changed screens as well as checking measurements. Add a representative case for a new shared component or feature; a new screen must not become its own untested visual standard.

## Separated phrase gaps

Use `renderPhraseGapSentence` through `renderExercisePrompt` for explicitly authored nonadjacent blanks. Each typing blank uses a transparent device-keyboard input inside a 44px minimum implicit label target. Keep the input line height at 1.25 and its underline beside the sentence baseline; extra tap padding belongs to the label, not to the text input. Set border-box sizing explicitly so German and Chinese styles produce the same geometry. Keep inputs within the existing question card, retain shared Submit/Skip/Next flow and use `bindTypingAnswers` for all-field readiness, Enter navigation and IME handling. Selection still checks on tap. Keep each red typed mistake on the sentence baseline and annotate it with the green correction above. Correct gaps show the accepted fill inline. Apply translucent red or green behind the relevant text and checked choice. Do not create a second answer box below the sentence. See [Separated Phrase Gaps](phrase-gaps.md) and `verify-phrase-gaps-browser.mjs` for the reference behaviour and responsive checks.

The Dictation contract measures actual downloaded-package screens in all four released study languages, English/Korean display, phone/tablet widths and both themes. It compares selector position, size, spacing and button styles directly with German, checks title → selector → Filters order, mode changes and the audio gate, and saves screenshots. The opt-in native `--verify-dictation-design` check compares German, Chinese, English and Japanese controls on-device without downloading packages or recording study answers.

## Complete Dictation screen

Every language must use `web/js/shared/listening-view.js` for the entire Dictation screen, not just its header and tabs. German and Chinese remain the baselines. Adapters provide question/answer policies, data filters, labels, stored-answer recording and optional reading markup; they must not duplicate the speaker/card/answer/action HTML.

The question card uses `.card.panel.listening-question`. Its top row contains the standard 44px `.word-listen` speaker on the right. The blank device-keyboard textarea sits inside `.vocab-answer-cell`, with one compact row for both Word and Sentence, followed by Hint. Submit/Skip and Next stay below the card in the existing action bars. Unchecked answer inputs use a neutral accessible name. Show the wrong-answer label and crossed-out input only after an incorrect submission; correct submissions show one green transcript without a duplicate answer row. This applies to Word, Sentence and saved retests in every study/display language. Audio must finish before submission, and stale playback must not unlock a new question. The speaker shows the number of completed plays and stops at three. The learner may still submit an answer after the third play or choose Give Up to record a mistake. Filter changes preserve Word/Sentence mode. Saved-question retests omit mode controls/filters, keep original question IDs and use the same answer/feedback body.

English follows the German layout, including typed correction, crossed-out wrong input and the green correct answer. English explanation of English sentences must not duplicate the complete answer as a translation or reveal it through a hint; its hint uses the anchor word's meaning instead. Hints/translations use the selected explanation's content and language, independently of Display Language. All adapters use `listening-text.js` for consistent English/Korean labels.

Japanese follows the Chinese answer-reading hierarchy after checking. `japanese-furigana.js` renders known whole-word readings above kanji groups, keeping written kana endings outside ruby. Sentence annotation uses exact installed dictionary words and verified forms; standard polite stems are derived only where the stored negative paradigm identifies the class. It matches complete segmented spans, preserves punctuation, and leaves unknown or ambiguous non-anchor readings plain. It does not infer per-kanji readings from on/kun lists or show answers/furigana before checking. Existing source licences/attribution remain in the installed packages; no external service or new language-data download is needed.

Run `node scripts/verify-dictation-screen-browser.mjs` as well as the control-order contract. It compares full front-card/speaker/textarea/hint/action geometry with German (English and the other generic languages) or Chinese (Japanese), across both modes, EN/KO display, phone/tablet and light/dark. It also checks hint content, audio gating, correction, English self-translation suppression, saved retest balances and dictionary-backed Japanese feedback. Inspect the screenshots under `/private/tmp/dictation-screen`. The opt-in native Dictation check verifies both full-screen modes for German/Chinese/English/Japanese and Japanese ruby without submitting real study answers.

## Non-Dictation screen parity

English follows German; Japanese follows Chinese. Reuse the baseline `.vocab-question`, `.vocab-prompt`, `.vocab-answer-cell`, `.vocab-choice`, `.sentence-question`, `.cloze-options`, `.scramble-answer` and `.scramble-pool` structures and styles. Do not add a second minimum card height, outer card margin, input font or selection-button style for the generic languages. Text can wrap naturally; equal geometry means equal gutters, padding, control dimensions and spacing, rather than forcing translations of different lengths into a fixed height.

Cloze checks a choice immediately and shows Next. After grading, tapping the question opens the Word List sheet for its target word and provides Next there too. Sentence Scramble keeps question, chosen answer and remaining tiles in three cards, with Reset followed by Submit/Skip. Checked answers retain those cards. Japanese offers a reading switch above the sentence, with known furigana above kanji and a reading above the blank where its exact lexical reading is known. Its Word List, example and Flashcard readings use the same installed dictionary projection as Dictation; unknown readings remain plain. English never displays an English sentence translation as a duplicate answer.

Review uses the established heading with Delete All on the right, combined collapsible filters, full-width Retest, standard tags, 32px headword, 16px meaning and separated answer rows. Additional language-specific filters remain inside the filter block. Delete All still asks for confirmation; matching and mistake balances remain owned by the presentation/store. Retest completion uses the shared `.retest-complete` block and summary.

Run `node scripts/verify-study-screen-parity-browser.mjs` for real-package comparisons of Word List, details, Flashcards, Meaning Quiz, Word Input, Cloze and Sentence Scramble in English/German and Japanese/Chinese, at phone/tablet widths, EN/KO display and light/dark themes. Content-dependent heights may differ. It also exercises immediate Cloze checking, Scramble Reset and overflow, and saves screenshots under `/private/tmp/study-screen-parity`. Use the multilingual lifecycle and specialist checks for Review/retests, package handling and language-specific content.


## Japanese example reading space

Word-detail and Flashcard examples use the browser’s native ruby layout. Restore `display:revert` on `ruby` and `rt`, because WebKit and Chromium expose different native display values. Override the legacy flex-column ruby rules for Japanese examples: kanji and unannotated kana must share a baseline, and readings occupy their own space above the original text. A 2.4 line height and 4px top clearance reserve room for the first annotation and for wrapped rows. Keep written kana endings outside the ruby group and preserve punctuation and original sentence text. The example audio button is a sibling in the existing second grid column, never inside the text line.

Run `node scripts/verify-japanese-furigana-browser.mjs` for real Word List/Flashcard examples plus short mixed-kanji/kana and long wrapped fixtures, at phone/tablet widths, light/dark and EN/KO explanations. It measures character baselines and actual glyph ink bounds to catch reading overlap without confusing font-box descenders with visible collisions. Screenshots and measurements are under `/private/tmp/japanese-furigana-layout`. The DEBUG-only `--verify-japanese-furigana` native check repeats baseline/clearance tests in the iPad WebView without changing language selection or recording answers.


## Japanese Okurigana spelling

Kanji and Okurigana keeps the standard Selection/Typing controls, filters, question card and action bars. Its prompt is a full kana reading, such as ひさしい; the response is the full written word 久しい. Selection presents endings of the same kanji, including 久い as a distractor for this example, and checks on tap. Typing uses the device keyboard and Submit; a kana-only answer does not satisfy the written-word question. Keep the written answer and boundary segments hidden until checking. After checking, retain the single blue kanji / green kana breakdown row and the standard answer correction and Next action, without additional explanation prose. The same breakdown-only treatment applies to saved Review cards and retests. The selected explanation meaning can provide a sense clue.

Prepare these questions once with the installed spelling index. Recognised dictionary spellings and matching KANJIDIC2 kun-reading boundaries are accepted and excluded from distractors. New spelling question IDs keep old partial-reading/ending Review snapshots unchanged. Run `verify-okurigana-spelling-browser.mjs` for the actual 久しい entry, both answer modes, IME, corrections, Review/retest and offline use across phone/tablet, themes and EN/KO. The DEBUG native `--verify-japanese-okurigana` check reads installed Japanese pairs and validates the same example and 行う / 行なう without recording answers or changing study selection.


## Japanese reading targets and Korean labels

Use 한자 읽기 for Word Reading and 오쿠리가나 for Kanji and Okurigana when Display Language is Korean. Word Reading presents a single sentence with `.study-reading-target` under the complete target word; use the shared blue token, a 2px single underline and the existing text colour. Do not repeat a separate headword or show furigana before checking. A word without a suitable exact-match example appears once by itself, underlined, with its dictionary reading unchanged. Existing bracket markers and duplicate-heading snapshots are normalised for display without mutating the saved question.

A curated reading exercise may provide `readingFocus: {start, text}` for an explicitly reviewed inflected target. The UTF-16 offset and exact text must match the original prompt, before trimming or legacy-marker normalisation. Supply its reviewed kana answer and accepted readings explicitly; the app does not derive inflected readings or add aliases. Preparation, the quiz and saved Review retain that sentence, target and translation. Invalid or stale explicit spans are rejected by package validation and withheld from fresh questions and retests, without deleting stored history or substituting a bare lemma with the inflected answer. Automatic questions without an explicit curated target keep the conservative lemma fallback. Run `verify-curated-reading-focus-browser.mjs` for Selection/Typing, saved Review/retest and malformed snapshots in EN/KO, phone/tablet and both themes.

Exercise screens use the question prompt and answer controls without standalone visible instruction lines in any display language. Saved cards use the compact Review detail renderer. `verify-reading-target-browser.mjs` covers curated/generated/standalone questions, single-target markup, computed underline colour, both answer modes and mixed display/explanation locales on phone/tablet in light/dark themes.

Word Reading checks retain the answer colours, correction and Next action, without an extra explanation or reading-segment block beneath the question. This applies to Selection, Typing and Review retests; other exercise explanations and saved Review details remain available.

Word Reading Selection samples fresh, distinct distractors for each new question from the complete verified reading pool matching the target word’s part of speech. The prepared pool is cached; no 128-reading limit or word-ID-based fixed selection is used. For an underlined kanji spelling with trailing hiragana, every choice keeps that visible ending, including in curated inflections. Verified same-POS readings with the exact ending come first. Sparse pools can use verified same-POS reading prefixes paired with the ending as distractors. Known accepted readings and kana-normalised duplicates cannot be wrong options. Target filters select the question word; the full same-POS pool supplies distractors. Keep the current options fixed during rendering and checked feedback, and retain the original choices in saved Review/retests. Okurigana spelling-boundary choices keep their separate rules.

## Display and explanation languages

All interface labels, exercise instructions, grammar-condition labels and accessible blank names follow Display Language, including saved Review/retests. `exercise-text.js` resolves the bundled bilingual instruction/condition catalogue generated by `node scripts/build-exercise-ui-copy.mjs`. Historical published variants and current generated instructions are retained, so stored snapshots do not need rewriting and an instruction can change display language without downloading the other explanation pack. Unknown original constraints remain intact; do not machine-translate or replace them with a less specific generic task. New features omit standalone visible instruction lines. Use prompts, controls, and accessible labels to communicate the task.

Downloaded meanings, context clues, example translations and source explanations retain their content language. Actual study prompts, answers, roots and reading segments retain their content language. The generated root cue's origin label follows Display Language without translating its meaning text. Language-picker names remain the explicitly requested bilingual names. Render projections do not mutate question snapshots, answer grading, package content or progress. Exercise text and content carry their corresponding language attributes; do not use the explanation locale for an interface input's accessible name.

## Specialist Review details

Use `exercise-review-view.js` for saved specialist details; never embed the full quiz prompt renderer in a Review card. Keep the established single word/reading heading, meaning, separator and `renderStudyReviewAnswer` rows. Use a single question-type filter with the same labels as the card badges. Include individual categories for merged study sections. Word Reading shows its saved question sentence and sentence translation above the stored wrong reading. Underline the target in the compact sentence with the shared blue style. Keep the saved wording and translation when dictionary content changes. A standalone saved word has no question sentence to repeat. The heading supplies the correct reading. Full-word Okurigana shows the wrong spelling and its requested compact blue/green reading row. Root clues and phrase sentences use `.wrong-question-block` / `.wrong-question` at 16px; omit duplicate word meanings and generic quiz instructions/explanation paragraphs.

Show Correct Answer only when it adds information beyond the displayed word/reading/meaning. Preserve the separate conditions/base/question/correct/wrong layout for historical forms, including its explicit correct-answer row. Separated gaps keep indexed single-line Review blanks; the stored attempted answer crosses out only incorrect parts, with matching parts in the shared correct colour. All labels follow Display Language; original study/translation content and question snapshots remain unchanged. Retests continue to use their full saved quiz view and options.

Run `verify-specialist-review-browser.mjs` to compare real Reading, Okurigana, roots, phrase choices, separated gaps and historical-form cards directly against German/Chinese Review typography, card geometry, answer rows and separator spacing at phone/tablet widths, both themes and opposite display/explanation languages. Also run the standard Review parity and the reading/Okurigana/phrase-gap/retired-question lifecycle checks. Inspect the card screenshots under `/private/tmp/specialist-review`.

## English expressions in default practice

English expressions use the existing Meaning Quiz and Cloze sections. The Study menu omits the separate Expressions tile. Meaning Quiz includes expression entries from the active Word List and uses the shared same-part-of-speech meaning choices. Cloze combines ordinary dictionary sentences with the authored expression gap questions, including separated blanks. English Cloze offers the shared Selection and Typing controls. Selection checks immediately. Typing retains one device-keyboard field per blank and the standard Submit/Skip/Next controls. Existing saved expression questions keep their original snapshots and retest grading.

## Word grouping

Word List and Flashcards group exact spellings across parts of speech in each study level. Keep case-distinct words and different spellings separate. A word with noun and verb meanings has one card with both part-of-speech tags; a POS filter includes only matching senses. Details and card backs pair each recorded sense with one matching example and selected explanation translation. Where a package combines usages in one record, exact reviewed sentence links provide separate examples. Number distinct meanings consistently in Word List, the dictionary sheet and on the card back. In the dictionary sheet, place the linked sentence and translation directly below that meaning. On Flashcards, the linked example carries its meaning’s number. Give single meanings the number 1 and keep synonyms for one sense together. Wrapped lines, sentences and translations align under the text of their numbered meaning. Ambiguous examples carry no number. Word List, details, Flashcards, Review and related-word rows remove parenthetical notes from displayed meanings and keep alternatives for one sense together. Use separate records, explicit usage groups or reviewed boundaries for separate lines. Semicolons alone do not define a sense. English-to-English examples omit redundant English translations. Use the existing card, example, speaker and scrolling patterns. Put the three status buttons last in the dictionary sheet, including after the quiz’s Next button, with an accessible group name and no visible heading.

Browsing counts and status filters refer to grouped cards. All-New is New; all-Mastered is Mastered; mixed states are Learning. An explicit status change applies only to the displayed senses, retaining other levels and excluded parts of speech. Dictionary links from Review/Root Families open the current same-level meaning group. Quizzes and saved Review retain their original sense IDs, examples, levels and grading. Grouping does not rewrite packages or progress.

## Meaning-choice quality

Word Input and Meaning Quiz use the dictionary’s sense layout. Retain lexical context needed to distinguish answers and keep the original saved choice set if formatting would make two choices indistinguishable. Fresh Meaning Quiz options use the same active part of speech and existing level/status filters. Wrong choices are sampled from across that pool, not adjacent ordered entries. Prefer similar definition lengths and balanced visible starts: one option must not be the unique initial against otherwise matching starts. Exact wording, aliases and other known meanings remain protected. Small pools may show two or three unambiguous choices instead of four visually revealing ones; do not invent or rewrite definitions. Choice order remains shuffled, and historical Review/retests retain their saved options.

## Word List initial index

Word List groups Search and Filters inside one card. Filters start with horizontally scrolling initial tags, followed by Study Status and Part of Speech tags. The selected initial appears in the collapsed summary. The initial filter combines with the selected level, query, part of speech and study status. English/German use A–Z with accent folding and German noun-article handling; Chinese uses supplied pinyin initials; Japanese uses supplied kana-reading rows. Unknown readings stay in Other. The index never infers a kanji reading, drops a dictionary sense or replaces the search field while typing. A new Word List visit or changed study level resets the initial to All; POS/status redraws preserve the current choice.

Run `node scripts/verify-word-initial-browser.mjs` for all four adapters, EN/KO, phone/tablet and both themes.

## Answer sounds

Settings exposes a global Answer Sounds switch, default off, shared across study/explanation languages. Correct/incorrect feedback uses quiet original WebAudio tones through the shared feedback hook; no audio files, microphone or network are used. The sound service unlocks on trusted user activation and safely handles muting, backgrounding and unavailable audio. Device volume and platform audio policy still apply; scripted clicks do not prove physical iPad audibility.

Run `node scripts/verify-answer-sounds-browser.mjs` for default-off, settings/reload/language persistence and actual quiz feedback across all four languages.

## Cloze translation targets

Visible sentence translations underline a reliable matching phrase for the missing word, before and after answering. `translation-focus.js` uses validated explicit spans or conservative selected-language lexical/inflection matches, preserves original UTF-16/grapheme boundaries and rejects ambiguous matches. `translation-target-view.js` escapes all text. Source spelling is not an alignment fallback; English-to-English definition hints remain plain. Saved question strings and translations are never rewritten.

Automatic matching currently covers about two thirds of usable translated Cloze targets across the released pairs. Paraphrases and uncertain lexical homographs require reviewed explicit annotations; absence of an underline does not mean missing translation data. Run `node scripts/audit-translation-focus.mjs` for coverage and `node scripts/verify-translation-focus-browser.mjs` for all four adapters, EN/KO, phone/tablet, themes and single/separated blanks.

## Focused Flashcard sets

All four languages use one shared Flashcard session/view. Choose 10, 20, 50 or 100 cards, default 20; the feature preference is shared across languages. All is the default scope. New refers to cards without a classification. Sessions keep a stable [level, exact spelling] identity while writing only the displayed original sense IDs. Learning and Mastered are directly below the card, keep keyboard focus and advance to the next unclassified card.

Tapping the card face reveals or hides the answer, including taps on the padding or example. Speaker, details and example paging controls handle their own actions.

A completed set offers Shuffle Learning for only that round's unfinished cards and Next Set for unseen eligible words. Completing or previewing a round cannot silently fill it with new words. Existing dictionary details remain under the ellipsis control; example paging keeps each meaning paired to its own example/translation. Other quiz layouts and progress records are unchanged.

The model owns session identity/selection; adapters own existing progress writes. Readings and German article colours remain language policies. Set-size storage failures are nonfatal; reset/removing study content clears the ephemeral round. Run `verify-flashcard-sets-browser.mjs` and `verify-flashcard-focus-browser.mjs` for capped sets, classifications, focus/inert behavior, completion/repeats, language/theme/device parity and stable history.

## Quiet visual language

Use opaque beige/charcoal surfaces, thin borders, restrained blue accents and neutral typographic headings. Avoid decorative gradients, repeated floating shadows and coloured emoji tiles. Study presents a consistent two-column tile grid with original monochrome SVG icons; the three existing tabs remain. Settings order is Appearance, Language Packages, practice toggles, report/data actions and support/licence.

Both Flashcard faces keep the headword in the same position, with examples below it. Flashcards have a fixed, flat reading surface, visible set progress,44px+ direct Learning/Mastered actions and paged examples. Do not add instructional prose or turn self-classification into a graded quiz. Preserve semantic green/red answer feedback, level/POS/type tag meanings and German article colours. Native selects and visible keyboard focus are required. Japanese examples retain their separate ruby clearance.

The interaction references are [Quizlet's Flashcard sorting](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) and [Anki's limited study sessions](https://docs.ankiweb.net/filtered-decks.html). Icons, tones and implementation are original; this is not a copy of their branding or assets. Run `verify-quiet-design-browser.mjs` and the existing screen/reading parity suites for both themes, EN/KO and phone/tablet layouts.

## Study menu grid

Study uses two equal columns on phone and tablet, with 12px gaps and at least112px high tiles. Keep monochrome outline icons, neutral centred labels and flat beige/charcoal cards. Omit chevrons, gradients, rainbow feature colours and large shadows. Preserve the established mode order; additional language-specific modes continue in the same grid. `verify-quiet-design-browser.mjs` checks column alignment, touch sizes, overflow and bilingual Settings parity across all four languages and both themes.

## Vocabulary hints and checked examples

Optional practice clues use the shared Hint disclosure. Word Input offers one collapsed Hint panel with a masked example when a valid clue is available. The example clue masks a validated unique target in the question sense’s own sentence and omits its translation; unsafe or unavailable targets do not get an invented clue. Opening hints must preserve typed input. After checking Word Input or Meaning Quiz, tapping the tested word opens its existing Word List detail sheet. The quiz adds Next below the dictionary content. Close returns to the graded question. Preserve Chinese/Japanese reading layout and suppress duplicate English-to-English translations. Selection still checks immediately; typing retains Submit, Skip and Next. `verify-vocabulary-learning-browser.mjs` covers all four adapters in both display languages, phone/tablet and themes.

## Dictation pronunciation clues

Word Dictation may reveal a supplied IPA, kana or pinyin through Pronunciation Hint / 발음 힌트. Never derive a transcription from spelling or display the written answer as a fake reading. Sentence mode has no word-pronunciation clue. Opening the clue preserves typed input and records hint use, while submission still requires successful audio completion. A new question closes the clue. Missing source readings omit the control. `verify-listening-reading-browser.mjs` checks all four language layouts and the audio gate.

## Sentence Scramble answer tools

Sentence translations use17px text at1.65 line height in all languages. Reset is a44px outline-icon button beside the answer-area label, with a translated accessible name and tooltip. Keep it separate from Submit/Skip and remove it after checking. Reuse renderStudyReset rather than another bottom text action. The shared screen-parity suite checks its placement, size, reset behaviour and translation font against German/Chinese.

## Review recency and type badges

Review orders saved mistakes by their latest incorrect attempt. A successful retest does not change recency. Preserve untimed legacy entries in a stable existing/insertion fallback order rather than inventing timestamps. English/Japanese records now retain lastWrongAt. Chinese includes failed retests; German already uses the last incorrect attempt. Exercise badges retain pastel blue and add14px decorative outline icons with the existing translated label. They remain distinct from level and part-of-speech badges.

## Sentence question rotation

Fresh Cloze questions use a content-keyed round: every eligible sentence/target is used once before repeats. English expressions and dictionary sentences share one round rather than a50% expression slot. Duplicate content from multiple records is grouped, filters rebuild the eligible round and choice order is still freshly shuffled. Small pools may repeat only after exhausting their valid content. Saved retests retain their fixed snapshots and order. `verify-cloze-rotation-browser.mjs` checks20 successive real-package questions in every language/display/theme/width plus both English answer modes.

Translation annotations use one shared precedence rule: a question-level span overrides its selected example, and explicit null suppresses guessing. Legacy questions may use their word’s explicit explanation-language metadata when the question locale is missing. This is not permission to borrow another explanation language. Korean matching handles ordinary plurals/copular forms and glossary notation, while rejecting misleading substrings such as 나→나이가 or 차→차이가. The published go-by-bus/가요 example has a frozen before/after-snapshot regression. Conservative automatic coverage is67.3%; unaligned paraphrases still require reviewed annotations.

New vocabulary snapshots retain one learningExample for checked feedback, not the full word example inventory. Retests use that exact saved example. Older snapshots may use an active same-ID, same-explanation-language example when one is missing; they never borrow another sense or explanation language. The vocabulary browser suite also verifies examples after saved Review retests.

Root cards explicitly label their recorded Origin / 어원 and keep the simple source language (Latin, Greek, etc.) plus the existing meaning and visible related words. Unrecorded origins say so; do not infer a history from spelling or reintroduce a root quiz.

Dictation uses the same Hint disclosure as Word Input. Meaning comes first, followed by pronunciation when a supplied reading is available. UI package tests use AVAILABLE_STUDY_LANGUAGES; unreleased languages remain hidden rather than being silently re-enabled for a test.
