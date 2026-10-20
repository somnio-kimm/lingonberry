# Japanese and English practice coverage

Meaning Quiz and Word Input each keep one Study button. Their visible Exercise Type picker sits above Filters. All is the default and samples available types evenly, so a large dictionary-generated pool cannot crowd out smaller categories. Other exercise modes keep separate buttons.

Japanese Form Input supports Te Form, Past, Negative, Potential, Passive, Causative, Causative Passive, Conditional, Volitional and Adjective filters. Review records retain the exact category, condition, answer and entry; Review can filter by exercise category before a mixed retest. Politeness/style-conversion exercises, English word formation and English word stress remain excluded.

## Dictionary readings and boundaries

Automatic reading practice requires a reviewed package policy. It uses the entry's primary reading plus explicitly verified same-sense variants; it does not treat arbitrary aliases as pronunciation variants. Known unresolved spellings and spellings with conflicting primary readings are held back unless the policy resolves the entry.

Boundary practice uses one uninterrupted kanji group followed by written hiragana, with an exact non-empty reading remainder. It never decomposes a compound into individual character readings or infers on/kun from spelling. Mixed forms such as 取り戻す and お祝い are excluded from this narrow rule.

The two directions have different prompts:

- 食べる → 食【 】べる: enter た. The complete kana reading stays hidden.
- たべる → 食【 】: enter べる. The complete written headword stays hidden.

After grading, ruby appears only over the kanji group. Dots or boundaries identify the kanji reading portion, not the grammatical verb stem. For 食べる, these are た and たべ respectively.

## Scope and validation

Word-based generators use only entries matching the selected study level, POS and study status. Missing evidence never triggers a cross-level fallback or guessed reading. Language-specific curated questions remain available and take precedence over generated equivalents. Unsupported legacy packages continue to use their curated content.

Coverage expansion is separate from linguistic certification: provenance, accepted variants, applicability and explicit exclusions must travel with each imported dataset. Standard form transformations must not be advertised as natural in every sentence context. Tests cover ambiguous readings, answer concealment, Unicode kana, safe boundaries, type-balanced sampling, package validation, device-keyboard composition and Review.
