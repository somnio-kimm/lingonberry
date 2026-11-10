// Archived shared-runtime module; provenance is recorded in docs/archived-ui-source.json.
/** Stable review snapshots: persistence does not depend on question generators. */
const WORD_FIELDS = Object.freeze([
  'id', 'lemma', 'hanzi', 'cefr', 'hskLevel', 'pos', 'subtype', 'article', 'gender', 'accepted_articles', 'article_optional',
  'partOfSpeech', 'meaning_en', 'meaning_ko', 'meaningEn', 'meaningKo', 'syllables',
  'alternateSyllables', 'studyMeaning', 'studyExplanationLanguage',
]);

export function snapshotQuestion(question) {
  const word = Object.fromEntries(
    WORD_FIELDS.filter(key => question.word[key] !== undefined)
      .map(key => [key, question.word[key]])
  );
  // Preserve the existing JSON persistence contract and detach nested options/readings.
  return JSON.parse(JSON.stringify({ ...question, word }));
}
