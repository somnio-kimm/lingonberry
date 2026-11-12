# German dictionary form variants

Imported dictionary entries can list more than one valid article or inflection. Word Input and Article questions accept `accepted_articles` in addition to the displayed article. Review snapshots retain those alternatives, so a re-test uses the same grading rules.

Case questions expand abbreviated variants such as `des Buches / Buchs` into `des Buches` and `des Buchs`. They display one answer and accept either complete phrase. The selected noun gender determines which case forms are suitable for adjective exercises.

Verb questions display one finite form and accept the documented alternatives, such as `backst` and `bäckst`. Compound tenses repeat the appropriate auxiliary for each participle. When a verb is marked separable, a main-clause prompt accepts `biege ab`, rather than the joined subordinate form `abbiege`. Missing or ambiguous auxiliary paradigms remain excluded from compound-tense generation.

Cloze recognises the same noun and verb alternatives as individual surface forms. It does not require learners to type a dictionary's slash notation. Coverage is in `tests/german-article-variants.test.mjs` and `tests/german-form-alternatives.test.mjs`.

A German verb can declare `grammar.verb_persons` as a nonempty, unique subset of `ich`, `du`, `er`, `wir`, `ihr`, `sie`. Form Input uses that explicit practice scope in every tense, including derived perfect and future forms. Ordinary entries retain all six persons; missing finite data does not establish a restriction. Snapshots preserve the declared constraint. The reviewed content release must invalidate obsolete question contracts while keeping raw history and manual status. Source counterevidence belongs in the retained reference history, not a universal linguistic prohibition.

A reviewed `grammar.reflexive_case` may use slash-separated alternatives, such as `accusative / dative` (`acc / dat` also works). Each declared case must apply to the same generic leading `sich` citation: Form Input expands the person-specific pronouns in the four derived tenses while retaining each citation’s auxiliary. This field does not describe ordinary object cases or distinguish meanings. Missing or unknown case alternatives withhold the incomplete derived question; complete finite forms remain usable. Review snapshots retain the expanded answer inventory.
