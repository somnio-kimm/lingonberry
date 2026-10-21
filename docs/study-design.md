# Shared Study Design Reference

Use this reference for every new or changed feature in every study language. The existing German and Chinese screens are the visual and interaction baseline. Language-specific content may differ; card geometry, controls, navigation and feedback follow the shared patterns.

## Source of truth

- `web/study-theme.css`: semantic colours, theme behaviour, geometry tokens and shared component classes. Put reusable visual rules here.
- `web/js/shared/study-components.js`: escaped HTML primitives for search, segmented choices and reference-card headings. Reuse these rather than copying their markup or inline styles.
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
node scripts/verify-design-parity-browser.mjs
node scripts/verify-practice-design-browser.mjs
```

The first is the reusable design contract: German/Chinese base styles, shared search/tabs/reference cards/word rows, light and dark themes, phone and tablet widths. The other checks use real downloaded data for established screens and specialist exercises. Inspect screenshots for changed screens as well as checking measurements. Add a representative case for a new shared component or feature; a new screen must not become its own untested visual standard.
