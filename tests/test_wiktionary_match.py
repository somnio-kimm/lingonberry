"""Observable acceptance/hold contracts for conservative dictionary reuse."""
import copy
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / 'scripts/content/match-wiktionary.py'
SPEC = importlib.util.spec_from_file_location('wiktionary_match', PATH)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


def source(word='食べる', pos='verb', language='ja', gloss='to eat', edition='en', examples=None):
    row = {'word': word, 'pos': pos, 'lang_code': language,
           'senses': [{'glosses': [gloss], 'examples': examples or []}]}
    return {'edition': edition, 'snapshot': {'sha256': 'a' * 64, 'license': 'CC-BY-SA-4.0'},
            'rowIndex': 12, 'rowDigest': m.digest(row), 'row': row}


def inputs():
    return ({'word': '食べる', 'partOfSpeech': 'verb', 'studyLanguage': 'ja'},
            {'meanings': {'en': {'text': 'to eat'}}, 'examples': []})


def japanese_example():
    return {'text': '私は毎朝パンを食べる。', 'type': 'example',
            'bold_text_offsets': [[7, 10]], 'translation': 'I eat bread every morning.'}


class WiktionaryMatchingTests(unittest.TestCase):
    def test_reviewed_sense_mismatch_cannot_be_retrieved(self):
        entry, evidence = inputs(); row = source(examples=[japanese_example()])
        evidence['wiktionaryExcludedSenses'] = [m._identity(row, 0)]
        result = m.match_wiktionary(entry, evidence, [row], allow_single_sense_candidates=True)
        self.assertFalse(result['native_examples'])
        self.assertFalse(result['meanings'])
        self.assertIn('reviewed-source-sense-mismatch', [item['reason'] for item in result['holds']])

    def test_public_attribution_excludes_local_cache_path(self):
        entry, evidence = inputs(); row = source()
        row['snapshot']['path'] = '/private/local/cache/en.jsonl.gz'
        candidate = m.match_wiktionary(entry, evidence, [row])['meanings']['en'][0]
        self.assertNotIn('path', candidate['provenance']['sourceSnapshot'])
        self.assertEqual(candidate['provenance']['sourceSnapshot']['sha256'], 'a' * 64)

    def test_unique_exact_selected_gloss_returns_attributed_draft(self):
        entry, evidence = inputs()
        result = m.match_wiktionary(entry, evidence, [source()])
        candidate = result['meanings']['en'][0]
        self.assertEqual(candidate['text'], 'to eat')
        self.assertFalse(candidate['accepted'])
        self.assertEqual(candidate['provenance']['creator'], 'English Wiktionary contributors')
        self.assertIn('%E9%A3%9F', candidate['provenance']['url'])
        self.assertIn('action=history', candidate['provenance']['history'])
        self.assertEqual(candidate['source_digest'], m.digest({k: v for k, v in candidate.items() if k != 'source_digest'}))
        changed = {**candidate, 'text': 'to drink'}
        self.assertNotEqual(candidate['source_digest'], m.digest({k: v for k, v in changed.items() if k != 'source_digest'}))

    def test_token_overlap_is_not_sense_admission(self):
        entry, evidence = inputs()
        result = m.match_wiktionary(entry, evidence, [source(gloss='to eat a meal quickly')])
        self.assertEqual(result['meanings'], {})
        self.assertIn('no-exact-selected-sense', [x['reason'] for x in result['holds']])

    def test_gloss_case_is_not_erased_when_it_changes_meaning(self):
        entry = {'word': 'turkey', 'partOfSpeech': 'noun'}
        result = m.match_wiktionary(entry, {'meanings': {'en': {'text': 'Turkey'}}},
                                   [source('turkey', 'noun', 'en', 'turkey')], 'en')
        self.assertFalse(result['meanings'])

    def test_parent_gloss_does_not_admit_a_different_narrower_sense(self):
        entry, evidence = inputs(); row = source()
        row['row']['senses'][0]['glosses'] = ['to eat', 'specifically, to eat dinner']
        self.assertFalse(m.match_wiktionary(entry, evidence, [row])['meanings'])
        evidence['meanings']['en']['text'] = 'to eat specifically, to eat dinner'
        candidate = m.match_wiktionary(entry, evidence, [row])['meanings']['en'][0]
        self.assertEqual(candidate['text'], 'to eat specifically, to eat dinner')
        self.assertEqual(candidate['provenance']['modifications'], [
            'Joined the source gloss hierarchy with single spaces; individual gloss text unchanged.'])

    def test_duplicate_senses_are_held_not_chosen(self):
        entry, evidence = inputs(); row = source()
        row['row']['senses'].append(copy.deepcopy(row['row']['senses'][0]))
        result = m.match_wiktionary(entry, evidence, [row])
        self.assertEqual(result['meanings'], {})
        self.assertEqual(result['holds'][0]['reason'], 'ambiguous-selected-sense')

    def test_explicit_snapshot_sense_identity_can_resolve_ambiguity(self):
        entry, evidence = inputs(); row = source()
        row['row']['senses'].append({'glosses': ['to make a living']})
        evidence['wiktionarySense'] = {'edition': 'en', 'snapshotSha256': 'a' * 64,
                                      'rowDigest': row['rowDigest'], 'senseIndex': 1}
        result = m.match_wiktionary(entry, evidence, [row])
        self.assertEqual([x['text'] for x in result['meanings']['en']], ['to make a living'])
        evidence['wiktionarySense']['snapshotSha256'] = 'b' * 64
        self.assertFalse(m.match_wiktionary(entry, evidence, [row])['meanings'])

    def test_character_is_not_automatically_a_noun(self):
        row = source('馬', 'character', 'zh', 'horse')
        result = m.match_wiktionary({'word': '馬', 'partOfSpeech': 'noun'},
            {'meanings': {'en': {'text': 'horse'}}}, [row], 'zh')
        self.assertFalse(result['meanings'])
        self.assertEqual(result['holds'][0]['reason'], 'part-of-speech-mismatch')

    def test_nfc_lemma_and_whitespace_gloss_but_no_alias_inference(self):
        row = source('cafe\u0301', 'noun', 'fr', 'a coffee')
        entry = {'word': 'café', 'partOfSpeech': 'noun'}
        evidence = {'meanings': {'en': {'text': ' a   coffee '}}}
        self.assertTrue(m.match_wiktionary(entry, evidence, [row], 'fr')['meanings'])
        entry['word'] = 'cafe'
        self.assertFalse(m.match_wiktionary(entry, evidence, [row], 'fr')['meanings'])

    def test_reading_conflict_holds_matching_kanji_and_gloss(self):
        row = source('生', 'noun', 'ja', 'life')
        row['row']['forms'] = [{'form': '生', 'tags': ['canonical'], 'ruby': [['生', 'せい']]}]
        result = m.match_wiktionary({'word': '生', 'partOfSpeech': 'noun', 'reading': 'なま'},
            {'meanings': {'en': {'text': 'life'}}}, [row], 'ja')
        self.assertFalse(result['meanings'])
        self.assertEqual(result['holds'][0]['reason'], 'reading-conflict')

    def test_all_edition_definitions_allowed_but_native_example_rights_held(self):
        row = source('食べる', 'verb', 'ja', 'manger', 'fr', [japanese_example()])
        result = m.match_wiktionary({'word': '食べる', 'partOfSpeech': 'verb'},
            {'meanings': {'fr': {'text': 'manger'}}}, [row], 'ja')
        self.assertEqual(result['meanings']['fr'][0]['text'], 'manger')
        self.assertFalse(result['native_examples'])
        self.assertEqual(result['holds'][0]['reason'], 'native-edition-rights-verification-required')

    def test_quotes_fragments_wrong_language_and_unknown_type_are_held(self):
        entry, evidence = inputs()
        for change in ({'type': 'quotation'}, {'ref': 'Book, page 3'}, {'author': 'Book author'},
                       {'tags': ['quotation']}, {'type': None},
                       {'text': '食べる'}, {'text': 'This is 食べる.'}, {'text': '吃面包。'}):
            with self.subTest(change=change):
                ex = {**japanese_example(), **change}
                result = m.match_wiktionary(entry, evidence, [source(examples=[ex])])
                self.assertFalse(result['native_examples'])
                self.assertTrue(result['holds'])

    def test_native_example_requires_verified_bold_focus(self):
        entry, evidence = inputs(); ex = japanese_example()
        self.assertEqual(m.match_wiktionary(entry, evidence, [source(examples=[ex])])['native_examples'][0]['focus'], {'start': 7, 'text': '食べる'})
        ex['bold_text_offsets'] = [[0, 1]]
        result = m.match_wiktionary(entry, evidence, [source(examples=[ex])])
        self.assertFalse(result['native_examples'])
        self.assertEqual(result['holds'][0]['reason'], 'unverified-focus')

    def test_verified_inflection_offsets_convert_to_utf16(self):
        entry, evidence = inputs()
        text = '🍞私はパンを食べた。'
        start = text.index('食べた')
        ex = {'text': text, 'type': 'example', 'bold_text_offsets': [[start, start + 3]]}
        row = source(examples=[ex])
        row['row']['forms'] = [{'form': '食べた', 'source': 'inflection', 'tags': ['past']}]
        result = m.match_wiktionary(entry, evidence, [row])
        self.assertEqual(result['native_examples'][0]['focus'], {'text': '食べた', 'start': start + 1})
        provenance = result['native_examples'][0]['provenance']
        self.assertEqual(provenance['sourceExampleIndex'], 0)
        self.assertEqual(provenance['modifications'], [
            'Converted focus offsets from Unicode code points to UTF-16 code units; source sentence text unchanged.'])
        row['row']['forms'] = []
        self.assertFalse(m.match_wiktionary(entry, evidence, [row])['native_examples'])

    def test_existing_sentence_translation_requires_exact_text_and_selected_sense(self):
        entry, evidence = inputs(); ex = japanese_example()
        existing = {'text': ex['text'], 'focus': {'text': '食べる'}, 'translations': {}}
        evidence['examples'] = [existing, {'text': '私は毎朝パンを食べる！'}]
        result = m.match_wiktionary(entry, evidence, [source(examples=[ex])])
        candidate = result['example_translations']['0']['en'][0]
        self.assertEqual(candidate['source_text'], ex['text'])
        self.assertEqual(candidate['source_example_digest'], m.digest(existing))
        self.assertEqual(candidate['text'], ex['translation'])
        self.assertEqual(candidate['provenance']['sourceExampleIndex'], 0)
        self.assertEqual(candidate['provenance']['modifications'], ['Source translation text unchanged.'])
        self.assertNotIn('1', result['example_translations'])
        evidence['meanings']['en']['text'] = 'to make a living'
        self.assertFalse(m.match_wiktionary(entry, evidence, [source(examples=[ex])])['example_translations'])

    def test_native_source_translation_is_retained_with_own_digest(self):
        entry, evidence = inputs(); ex = japanese_example()
        candidate = m.match_wiktionary(entry, evidence, [source(examples=[ex])])['native_examples'][0]
        known = candidate['known_translations']['en']
        self.assertEqual(known['text'], ex['translation'])
        self.assertEqual(known['source_text'], ex['text'])
        self.assertEqual(known['provenance']['sourceExampleIndex'], 0)
        self.assertEqual(known['provenance']['modifications'], ['Source translation text unchanged.'])
        self.assertEqual(known['source_digest'], m.digest({k: v for k, v in known.items() if k != 'source_digest'}))
        ex['english'] = 'A conflicting translation.'
        candidate = m.match_wiktionary(entry, evidence, [source(examples=[ex])])['native_examples'][0]
        self.assertEqual(candidate['known_translations'], {})

    def test_nonenglish_self_explanation_is_never_emitted(self):
        row = source('食べる', 'verb', 'ja', '食事を取る', 'ja')
        result = m.match_wiktionary({'word': '食べる', 'partOfSpeech': 'verb'},
            {'meanings': {'ja': {'text': '食事を取る'}}}, [row], 'ja')
        self.assertEqual(result['meanings'], {})

    def test_english_native_example_keeps_exact_self_translation(self):
        text = 'I eat bread every morning.'
        row = source('eat', 'verb', 'en', 'consume food', examples=[
            {'type': 'example', 'text': text, 'bold_text_offsets': [[2, 5]]}])
        result = m.match_wiktionary({'word': 'eat', 'partOfSpeech': 'verb'},
            {'meanings': {'en': {'text': 'consume food'}}}, [row], 'en')
        self.assertEqual(result['native_examples'][0]['known_translations']['en']['text'], text)

    def test_source_licence_and_snapshot_are_required(self):
        entry, evidence = inputs()
        for field, value in [('sha256', ''), ('license', 'MIT')]:
            with self.subTest(field=field):
                row = source(); row['snapshot'][field] = value
                result = m.match_wiktionary(entry, evidence, [row])
                self.assertFalse(result['meanings'])
                self.assertEqual(result['holds'][0]['reason'], 'unverified-source-metadata')

    def test_external_source_and_alternative_senses_excluded(self):
        entry, evidence = inputs()
        for key, value in [('external_source', 'book'), ('alt_of', [{'word': '食う'}])]:
            row = source(); row['row']['senses'][0][key] = value
            self.assertFalse(m.match_wiktionary(entry, evidence, [row])['meanings'])

    def test_definition_reference_and_quotation_evidence_is_held(self):
        entry, evidence = inputs()
        cases = [('refs', ['Book']), ('reference', 'Dictionary'), ('citation', 'Book'),
                 ('quotations', ['Sentence']), ('quote', 'Sentence'), ('source', 'Book'),
                 ('tags', ['quotation']), ('raw_tags', ['historical-attestation'])]
        for key, value in cases:
            with self.subTest(key=key):
                row = source(); row['row']['senses'][0][key] = value
                result = m.match_wiktionary(entry, evidence, [row])
                self.assertFalse(result['meanings'])
                self.assertEqual(result['holds'][0]['reason'], 'excluded-sense')

    def test_unique_source_sense_requires_explicit_optin_and_stays_unverified(self):
        entry, evidence = inputs(); row = source(gloss='consume food', examples=[japanese_example()])
        strict = m.match_wiktionary(entry, evidence, [row])
        self.assertFalse(strict['meanings'])
        self.assertFalse(strict['native_examples'])
        result = m.match_wiktionary(entry, evidence, [row], allow_single_sense_candidates=True)
        candidate = result['meanings']['en'][0]
        self.assertEqual(candidate['text'], 'consume food')
        self.assertFalse(candidate['accepted'])
        self.assertEqual(candidate['alignment'], {
            'method': 'unique-source-sense-candidate',
            'status': 'selected-sense-equivalence-unverified',
            'review': 'independent-review-required'})
        self.assertEqual(candidate['provenance']['alignment'], candidate['alignment'])
        native = result['native_examples'][0]
        self.assertEqual(native['alignment'], candidate['alignment'])
        self.assertEqual(native['known_translations']['en']['alignment'], candidate['alignment'])
        self.assertEqual(result['retrieval_counts']['unique_source_sense_candidates'], 1)
        self.assertIn('selected-sense-equivalence-unverified', [h['reason'] for h in result['holds']])
        self.assertEqual(candidate['source_digest'], m.digest({k: v for k, v in candidate.items() if k != 'source_digest'}))

    def test_optin_does_not_choose_between_multiple_source_senses(self):
        entry, evidence = inputs(); row = source(gloss='consume food')
        row['row']['senses'].append({'glosses': ['earn a living']})
        result = m.match_wiktionary(entry, evidence, [row], allow_single_sense_candidates=True)
        self.assertFalse(result['meanings'])
        self.assertEqual(result['retrieval_counts']['ambiguous_source_sense_groups'], 1)
        self.assertIn('ambiguous-source-sense-candidates', [h['reason'] for h in result['holds']])

    def test_optin_does_not_bypass_wrong_pos_reading_or_reference(self):
        entry, evidence = inputs()
        for mismatch in ('pos', 'reading', 'reference'):
            with self.subTest(mismatch=mismatch):
                row = source(gloss='consume food'); selected = dict(entry)
                if mismatch == 'pos': row['row']['pos'] = 'noun'
                elif mismatch == 'reading':
                    selected['reading'] = 'くう'
                    row['row']['forms'] = [{'form': '食べる', 'tags': ['canonical'], 'ruby': [['食', 'た']]}]
                else: row['row']['senses'][0]['refs'] = ['Book']
                result = m.match_wiktionary(selected, evidence, [row], allow_single_sense_candidates=True)
                self.assertFalse(result['meanings'])
                self.assertFalse(result['native_examples'])
                self.assertEqual(result['retrieval_counts']['unique_source_sense_candidates'], 0)

    def test_optin_never_falls_back_after_explicit_identity_mismatch(self):
        entry, evidence = inputs(); row = source(gloss='consume food')
        evidence['wiktionarySense'] = {'edition': 'en', 'snapshotSha256': 'b' * 64,
                                      'rowDigest': row['rowDigest'], 'senseIndex': 0}
        result = m.match_wiktionary(entry, evidence, [row], allow_single_sense_candidates=True)
        self.assertFalse(result['meanings'])
        self.assertEqual(result['retrieval_counts']['unique_source_sense_candidates'], 0)

    def test_exact_match_keeps_priority_over_optional_retrieval(self):
        entry, evidence = inputs(); row = source()
        row['row']['senses'].append({'glosses': ['earn a living']})
        result = m.match_wiktionary(entry, evidence, [row], allow_single_sense_candidates=True)
        self.assertEqual(result['meanings']['en'][0]['alignment']['method'], 'exact-selected-gloss')
        self.assertEqual(result['retrieval_counts']['exact_selected_senses'], 1)
        self.assertEqual(result['retrieval_counts']['unique_source_sense_candidates'], 0)

    def test_does_not_mutate_evidence(self):
        entry, evidence = inputs(); rows = [source(examples=[japanese_example()])]
        before = copy.deepcopy((entry, evidence, rows))
        m.match_wiktionary(entry, evidence, rows)
        self.assertEqual((entry, evidence, rows), before)


if __name__ == '__main__':
    unittest.main()
