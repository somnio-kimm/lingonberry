# Shared Study Design Reference

Use this reference for every new or changed feature in every study language. The existing German and Chinese screens are the visual and interaction baseline. Language-specific content may differ; card geometry, controls, navigation and feedback follow the shared patterns.

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
| Card | `.panel` / `.card`: 16px padding, 16px radius, 0.5px border, 16px section spacing |
| Section title | `.section-title`: 15px, weight 600, blue |
| List word / reference form | 24px, weight 700, main text colour; no faded or blue replacement word colour |
| List meaning / origin | 13px, secondary text colour |
| Word row | `.wl-list.wl-list--wordlist` and `.word-row-window`; established row padding/radius and 2px gap |
| Search | `renderStudySearch`: 17px text, no inherited input margins, existing search card wrapper, device keyboard |
| Reference group | `.panel.study-reference-card` plus `renderStudyReferenceHeading`; related words use normal Word List rows |
| Primary action | 14px, at least 44px high, 12px radius; Submit above smaller Skip, in normal content flow |
| Secondary action | `.btn-small` / `.text-button`: 14px, 32px minimum height, 8px radius |
| Segmented choices | `renderStudyTabs`: 14px text, equal widths, 44px minimum height; Selection left, Typing right when both are offered |
| Flashcards / word details | Keep established 36px flashcard words / 48px detail words and existing layout; do not replace with reference-card sizes |
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
  <details class="study-reference-words" open>
    <summary>Related Words</summary>
    <div class="wl-list wl-list--wordlist">
      <div class="word-row-window"><!-- normal .wl-row elements --></div>
    </div>
  </details>
  <a class="study-reference-source">Source</a>
</section>
```

For a paged collection of reference cards, give the pager host `.study-reference-list` and use `mountWordRows`. This removes per-card bottom margins inside the grid so spacing does not double.

Do not style a nested word list through a broad descendant selector: the outer reference-card pager has 16px gaps; the nested Word List retains 2px gaps. Keep list pagination and source/usage information separate from the word meaning.

## Interaction and language contract

- Dictation uses `renderStudyQuizHeader` (including the initial 0 / 0 score) followed immediately by `renderStudyTabs` with `variant:'listening'`, then Filters, then the question. Word is left and Sentence is right. All languages reuse these renderers; do not put a separate compact switch below Filters. Saved-question retests omit the mode switch.
- Word-choice answers check on tap and then show Next. Do not add Submit to selection questions. Typing uses Submit and the device keyboard; Chinese pinyin input retains its dedicated keyboard.
- Submit, Skip and Next stay at the end of content, above the navigation by normal page flow. Do not make them floating overlays.
- Meaning Quiz and Word Input remain vocabulary-only. Put specialist features in their own Study sections unless the user explicitly asks to merge them.
- Use a single underline for a missing answer, never an empty bracket pair. Chinese readings remain aligned above characters; do not add pinyin space to other languages unnecessarily.
- Reuse existing localisation keys, button labels and icons. Search says only Search / 검색. Display language and explanation language remain independent. Never show another explanation language as a fabricated fallback.
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

Use `renderPhraseGapSentence` through `renderExercisePrompt` for explicitly authored nonadjacent blanks. Each typing blank is a transparent, single-underline device-keyboard input with a 44px minimum target. Keep inputs within the existing question card, retain shared Submit/Skip/Next flow and use `bindTypingAnswers` for all-field readiness, Enter navigation and IME handling. Selection still checks on tap. Show corrected parts inline and cross out only incorrect parts. Do not create a second answer box below the sentence. See [Separated Phrase Gaps](phrase-gaps.md) and `verify-phrase-gaps-browser.mjs` for the reference behaviour and responsive checks.

The Dictation contract measures actual downloaded-package screens in all seven study languages, English/Korean display, phone/tablet widths and both themes. It compares selector position, size, spacing and button styles directly with German, checks title → selector → Filters order, mode changes and the audio gate, and saves screenshots. The opt-in native `--verify-dictation-design` check compares German, Chinese, English and Japanese controls on-device without downloading packages or recording study answers.

## Complete Dictation screen

Every language must use `web/js/shared/listening-view.js` for the entire Dictation screen, not just its header and tabs. German and Chinese remain the baselines. Adapters provide question/answer policies, data filters, labels, stored-answer recording and optional reading markup; they must not duplicate the speaker/card/answer/action HTML.

The question card uses `.card.panel.listening-question`. Its top row contains the mode/level badge on the left and the standard 44px `.word-listen` speaker on the right. The blank device-keyboard textarea sits inside `.vocab-answer-cell`, with one row for Word and two for Sentence, followed by Meaning hint. Submit/Skip and Next stay below the card in the existing action bars. Audio must finish before submission, and stale playback must not unlock a new question. Filter changes preserve Word/Sentence mode. Saved-question retests omit mode controls/filters, keep original question IDs and use the same answer/feedback body.

English follows the German layout, including typed correction, crossed-out wrong input and the green correct answer. English explanation of English sentences must not duplicate the complete answer as a translation or reveal it through a hint; its hint uses the anchor word's meaning instead. Hints/translations use the selected explanation's content and language, independently of Display Language. All adapters use `listening-text.js` for consistent English/Korean labels.

Japanese follows the Chinese answer-reading hierarchy after checking. `japanese-furigana.js` renders known whole-word readings above kanji groups, keeping written kana endings outside ruby. Sentence annotation uses exact installed dictionary words and verified forms; standard polite stems are derived only where the stored negative paradigm identifies the class. It matches complete segmented spans, preserves punctuation, and leaves unknown or ambiguous non-anchor readings plain. It does not infer per-kanji readings from on/kun lists or show answers/furigana before checking. Existing source licences/attribution remain in the installed packages; no external service or new language-data download is needed.

Run `node scripts/verify-dictation-screen-browser.mjs` as well as the control-order contract. It compares full front-card/speaker/textarea/hint/action geometry with German (English and the other generic languages) or Chinese (Japanese), across both modes, EN/KO display, phone/tablet and light/dark. It also checks hint content, audio gating, correction, English self-translation suppression, saved retest balances and dictionary-backed Japanese feedback. Inspect the screenshots under `/private/tmp/dictation-screen`. The opt-in native Dictation check verifies both full-screen modes for German/Chinese/English/Japanese and Japanese ruby without submitting real study answers.

## Non-Dictation screen parity

English follows German; Japanese follows Chinese. Reuse the baseline `.vocab-question`, `.vocab-prompt`, `.vocab-answer-cell`, `.vocab-choice`, `.sentence-question`, `.cloze-options`, `.scramble-answer` and `.scramble-pool` structures and styles. Do not add a second minimum card height, outer card margin, input font or selection-button style for the generic languages. Text can wrap naturally; equal geometry means equal gutters, padding, control dimensions and spacing, rather than forcing translations of different lengths into a fixed height.

Cloze checks a choice immediately and shows Next. Sentence Scramble keeps question, chosen answer and remaining tiles in three cards, with Reset followed by Submit/Skip. Checked answers retain those cards. Japanese offers a reading switch above the sentence, with known furigana above kanji and a reading above the blank where its exact lexical reading is known. Its Word List, example and Flashcard readings use the same installed dictionary projection as Dictation; unknown readings remain plain. English never displays an English sentence translation as a duplicate answer.

Review uses the established heading with Delete All on the right, combined collapsible filters, full-width Retest, standard tags, 32px headword, 16px meaning and separated answer rows. Additional language-specific filters remain inside the filter block. Delete All still asks for confirmation; matching and mistake balances remain owned by the presentation/store. Retest completion uses the shared `.retest-complete` block and summary.

Run `node scripts/verify-study-screen-parity-browser.mjs` for real-package comparisons of Word List, details, Flashcards, Meaning Quiz, Word Input, Cloze and Sentence Scramble in English/German and Japanese/Chinese, at phone/tablet widths, EN/KO display and light/dark themes. Content-dependent heights may differ. It also exercises immediate Cloze checking, Scramble Reset and overflow, and saves screenshots under `/private/tmp/study-screen-parity`. Use the multilingual lifecycle and specialist checks for Review/retests, package handling and language-specific content.


## Japanese example reading space

Word-detail and Flashcard examples use the browser’s native ruby layout. Restore `display:revert` on `ruby` and `rt`, because WebKit and Chromium expose different native display values. Override the legacy flex-column ruby rules for Japanese examples: kanji and unannotated kana must share a baseline, and readings occupy their own space above the original text. A 2.4 line height and 4px top clearance reserve room for the first annotation and for wrapped rows. Keep written kana endings outside the ruby group and preserve punctuation and original sentence text. The example audio button is a sibling in the existing second grid column, never inside the text line.

Run `node scripts/verify-japanese-furigana-browser.mjs` for real Word List/Flashcard examples plus short mixed-kanji/kana and long wrapped fixtures, at phone/tablet widths, light/dark and EN/KO explanations. It measures character baselines and actual glyph ink bounds to catch reading overlap without confusing font-box descenders with visible collisions. Screenshots and measurements are under `/private/tmp/japanese-furigana-layout`. The DEBUG-only `--verify-japanese-furigana` native check repeats baseline/clearance tests in the iPad WebView without changing language selection or recording answers.


## Japanese Okurigana spelling

Kanji and Okurigana keeps the standard Selection/Typing controls, filters, question card and action bars. Its prompt is a full kana reading, such as ひさしい; the response is the full written word 久しい. Selection presents endings of the same kanji, including 久い as a distractor for this example, and checks on tap. Typing uses the device keyboard and Submit; a kana-only answer does not satisfy the written-word question. Keep the written answer and boundary segments hidden until checking. The selected explanation meaning can provide a sense clue.

Prepare these questions once with the installed spelling index. Recognised dictionary spellings and matching KANJIDIC2 kun-reading boundaries are accepted and excluded from distractors. New spelling question IDs keep old partial-reading/ending Review snapshots unchanged. Run `verify-okurigana-spelling-browser.mjs` for the actual 久しい entry, both answer modes, IME, corrections, Review/retest and offline use across phone/tablet, themes and EN/KO. The DEBUG native `--verify-japanese-okurigana` check reads installed Japanese pairs and validates the same example and 行う / 行なう without recording answers or changing study selection.


## Japanese reading targets and Korean labels

Use 한자 읽기 for Word Reading and 오쿠리가나 for Kanji and Okurigana when Display Language is Korean. Word Reading presents a single sentence with `.study-reading-target` under the complete target word; use the shared blue token, a 2px single underline and the existing text colour. Do not repeat a separate headword or show furigana before checking. A word without a suitable exact-match example appears once by itself, underlined, with its dictionary reading unchanged. Existing bracket markers and duplicate-heading snapshots are normalised for display without mutating the saved question.

Selection instructions are **밑줄 친 단어의 읽기를 선택하세요.** / **Choose the reading of the underlined word.** Typing uses the corresponding hiragana-input instruction. These labels use Display Language; meanings remain in Explanation Language. Pass the UI locale to `renderExercisePrompt` for both live questions and Review/retests. `verify-reading-target-browser.mjs` covers curated/generated/standalone questions, single-target markup, computed underline colour, both answer modes and mixed display/explanation locales on phone/tablet in light/dark themes.

Word Reading checks retain the answer colours, correction and Next action, without an extra explanation or reading-segment block beneath the question. This applies to Selection, Typing and Review retests; other exercise explanations and saved Review details remain available.
