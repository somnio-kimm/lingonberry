#!/usr/bin/env python3
"""Build source-backed English practice metadata, without changing vocabulary.

Run with no arguments after audit.py and validate.py in local-data/feature-coverage-en.
The default output is an ignored staging file. Packaging remains a separate step.
Run --self-test for the classification/scope/failure-path contract checks.

Countability defaults to attested dictionary uses, not the selected study meaning.
Reviewed selected-sense records carry scope='selected-sense'. The accompanying
ledger accounts for every core entry, including withheld and inapplicable items.
This builder does not turn unreviewed historical candidates into root exercises.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
LABEL_ORDER = ('countable', 'uncountable', 'plural-only')
ALLOWED_SETS = {frozenset(['countable']), frozenset(['uncountable']),
                frozenset(['plural-only']), frozenset(['countable', 'uncountable'])}


def hash_file(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def read_rows(path):
    with path.open() as stream:
        for line in stream:
            if line.strip():
                yield json.loads(line)


def index_unique(rows, key):
    result = {}
    for row in rows:
        if row[key] in result:
            raise ValueError(f'Duplicate {key}: {row[key]}')
        result[row[key]] = row
    return result


def normalise_labels(labels):
    values = set(labels)
    if values - set(LABEL_ORDER):
        raise ValueError(f'Unknown countability labels: {sorted(values)}')
    return [label for label in LABEL_ORDER if label in values]


def collect_references(urls):
    result = sorted(set(urls))
    if not result or len(result) > 30:
        raise ValueError('Countability requires between 1 and 30 distinct references')
    for url in result:
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError(f'Invalid HTTPS reference: {url}')
    return result


def collect_plural_relations(path):
    """Find explicit plural-of statements; do not guess base words from spelling."""
    relations = collections.defaultdict(set)
    for row in read_rows(path):
        if row.get('pos') not in {'noun', 'name'}:
            continue
        for sense in row.get('senses', []):
            if 'plural' in sense.get('tags', []) and sense.get('form_of'):
                relations[row['word']].update(x['word'] for x in sense['form_of'] if x.get('word'))
    return relations


def build_countability(entry, audit, facts, review=None, plural_bases=()):
    """Return one optional runtime row and a complete scope-aware ledger item."""
    ledger = {'status': 'withheld', 'scope': 'dictionary-wide', 'reasonCode': 'missing-explicit-data',
              'sourceRowIds': audit['features']['countability']['sourceRowIds']}
    if entry['partOfSpeech'] != 'noun':
        if review:
            raise ValueError('A countability review unexpectedly targets a non-noun')
        ledger.update(status='not-applicable', reasonCode='non-noun-pos')
        return None, ledger
    if review:
        if review.get('scope') != 'selected-study-sense':
            raise ValueError('Unrecognised review scope')
        ledger.update(scope='selected-sense', reviewStatus=review['status'],
                      reasoning=review['reasoning'], numberBehaviour=review.get('numberBehaviour'))
        if review['status'] == 'not-applicable':
            ledger.update(status='not-applicable', reasonCode='reviewed-sense-not-suitable-for-countability')
            return None, ledger
        labels = normalise_labels(review.get('labels', []))
        ledger['observedLabels'] = labels
        if review['status'] != 'supported':
            ledger['reasonCode'] = 'review-unresolved'
            return None, ledger
        if not review.get('exerciseReady') or frozenset(labels) not in ALLOWED_SETS:
            ledger['reasonCode'] = 'reviewed-context-required'
            return None, ledger
        references = collect_references(x['url'] for x in review['references'] if x.get('url'))
        ledger.update(status='included', reasonCode='reviewed-selected-sense')
        return {'entryId': entry['id'], 'labels': labels, 'references': references,
                'scope': 'selected-sense'}, ledger

    labels, urls = set(), set()
    for row_id in ledger['sourceRowIds']:
        source = facts[row_id]
        if source['word'] != entry['word'] or source['pos'] not in {'noun', 'proper-noun'}:
            raise ValueError(f'Wrong source word/POS for {entry["id"]}')
        if source.get('formOnly'):
            raise ValueError('A form-only source cannot establish standalone noun countability')
        for fact in source['countabilityFacts']:
            labels.update(normalise_labels(fact.get('countability', [])))
            if fact.get('numberBehaviour') == 'plural-only':
                labels.add('plural-only')
        if source['countabilityFacts']:
            if source['provenance'].get('license') != 'CC-BY-SA-4.0':
                raise ValueError('Unexpected lexical source licence')
            urls.add(source['provenance']['url'])
    labels = normalise_labels(labels)
    ledger['observedLabels'] = labels
    if not labels:
        return None, ledger
    if frozenset(labels) not in ALLOWED_SETS:
        ledger['reasonCode'] = 'dictionary-uses-need-distinct-number-contexts'
        return None, ledger
    if labels == ['plural-only'] and plural_bases:
        ledger.update(reasonCode='lexical-plural-and-ordinary-plural-relation',
                      registeredPluralBases=sorted(plural_bases))
        return None, ledger
    references = collect_references(urls)
    ledger.update(status='included', reasonCode='explicit-dictionary-use-metadata')
    return {'entryId': entry['id'], 'labels': labels, 'references': references}, ledger


def verify_review_binding(review, core, meanings):
    entry = core.get(review['entryId'])
    if not entry or entry['word'] != review['word']:
        raise ValueError('Review entry identity does not match the current core')
    for language in ['en', 'ko']:
        if review['selectedMeaning'][language] != meanings[language][entry['id']]:
            raise ValueError(f'Stale {language} reviewed meaning for {entry["id"]}')


def verify_source_reference(reference, source):
    """Bind quoted proof to a licensed original row; do not infer its sense fitness."""
    raw = json.loads(source['raw_json'])
    provenance = json.loads(source['provenance_json'])
    for key in ['creator','license','licenseUrl','url','historyUrl','snapshotSha256','sourceLine','sourceRowDigest']:
        if reference.get(key) != provenance.get(key):
            raise ValueError(f'Review source provenance differs: {key}')
    if source['language'] != 'en' or source['pos'] not in {'noun','proper-noun'}:
        raise ValueError('Countability proof must use an English noun source')
    if reference.get('sourceWord', source['word']) != source['word']:
        raise ValueError('Review source word differs')
    if reference.get('sourcePos', source['pos']) != source['pos']:
        raise ValueError('Review source POS differs')
    ordinal = reference.get('senseOrdinal')
    if type(ordinal) is not int or not 1 <= ordinal <= len(raw.get('senses', [])):
        raise ValueError('Invalid review sense ordinal')
    sense = raw['senses'][ordinal-1]
    if reference.get('glosses') != sense.get('glosses', []):
        raise ValueError('Review sense gloss differs')
    if reference.get('tags', []) != sense.get('tags', []):
        raise ValueError('Review sense tags differ')
    if reference.get('headTemplates', []) != raw.get('head_templates', []):
        raise ValueError('Review headword template differs')


def verify_review_sources(reviews, database):
    counts = collections.Counter()
    connection = sqlite3.connect(database.resolve().as_uri()+'?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    cache = {}
    try:
        for review in reviews.values():
            for reference in review['references']:
                collect_references([reference['url']])
                if reference.get('type') == 'licensed-lexical-source':
                    row_id = reference['sourceRowId']
                    if row_id not in cache:
                        row = connection.execute('SELECT * FROM source_rows WHERE id=?',(row_id,)).fetchone()
                        if row is None:
                            raise ValueError('Missing review source row')
                        cache[row_id] = dict(row)
                    verify_source_reference(reference, cache[row_id])
                    counts['licensedSourceReferences'] += 1
                elif reference.get('type') == 'primary-factual-check':
                    counts['primaryReferenceURLs'] += 1
                else:
                    raise ValueError('Unknown review reference type')
    finally:
        connection.close()
    return {'records':len(reviews),**dict(counts),
            'scope':'Exact licensed source fields verified; primary URLs record reviewer factual checks. This does not replace the explicit linguistic adjudication.'}


def build_data(core_path, audit_dir):
    summary = read_json(audit_dir / 'summary.json')
    validation = read_json(audit_dir / 'validation.json')
    if validation.get('status') != 'passed' or summary.get('provisionalWarning'):
        raise ValueError('A final passed source audit is required')
    core_hash = hash_file(core_path)
    if core_hash != summary['coreSha256'] or core_hash != validation['coreSha256']:
        raise ValueError('Source audit is stale for this core')
    extract_path = ROOT / summary['supplementalExtract']['path']
    extract_hash = hash_file(extract_path)
    if extract_hash != summary['supplementalExtract']['sha256'] or extract_hash != validation['supplementalExtractSha256']:
        raise ValueError('Validated lexical extract has changed')
    core = index_unique(read_json(core_path)['entries'], 'id')
    audited = index_unique(read_rows(audit_dir / 'entry-coverage.jsonl'), 'entryId')
    if set(core) != set(audited):
        raise ValueError('Audit coverage does not exactly match current core IDs')
    facts = index_unique(read_rows(audit_dir / 'source-facts.jsonl'), 'rowId')
    review_path = audit_dir / 'countability-reviewed.json'
    reviews = index_unique(read_json(review_path), 'entryId') if review_path.exists() else {}
    meanings = {language: {r['id']:r['meaning'] for r in read_json(core_path.with_name(f'en-{language}-4.2.0.json'))['entries']} for language in ['en','ko']}
    for review in reviews.values():
        verify_review_binding(review, core, meanings)
    plural_relations = collect_plural_relations(extract_path)
    context_paths = [audit_dir/name for name in ['countability-context-reviewed.json','countability-context-peer.json']]
    context_paths = [path for path in context_paths if path.exists()]
    if context_paths:
        contexts = index_unique((r for path in context_paths for r in read_json(path)), 'entryId')
        baseline_withheld = set()
        for entry_id, entry in core.items():
            _, status = build_countability(entry, audited[entry_id], facts, reviews.get(entry_id), plural_relations[entry['word']])
            if status['status'] == 'withheld':
                baseline_withheld.add(entry_id)
        if set(contexts) != baseline_withheld:
            raise ValueError('Context review must explicitly account for every baseline withheld entry, without replacing approved entries')
        for review in contexts.values():
            verify_review_binding(review, core, meanings)
        # Original review files remain immutable. Reassessment replaces only their
        # previously withheld rows, never a different concept or an approved row.
        reviews = {**reviews, **contexts}
    review_verification = verify_review_sources(reviews, ROOT/'local-data/sources/wiktionary/sources.sqlite')
    runtime, ledger = [], []
    for entry_id in sorted(core):
        row, status = build_countability(core[entry_id], audited[entry_id], facts,
                                         reviews.get(entry_id), plural_relations[core[entry_id]['word']])
        if row:
            runtime.append(row)
        ledger.append({'entryId':entry_id,'word':core[entry_id]['word'],
                       'partOfSpeech':core[entry_id]['partOfSpeech'],'countability':status,
                       'otherSourceFeatureStatus':{k:v['status'] for k,v in audited[entry_id]['features'].items() if k != 'countability'}})
    if len(ledger) != len(core) or len({r['entryId'] for r in runtime}) != len(runtime):
        raise ValueError('Incomplete coverage or duplicate runtime entry')
    counts = collections.Counter(r['countability']['status'] for r in ledger)
    reasons = collections.Counter(r['countability']['reasonCode'] for r in ledger)
    inputs = [core_path, audit_dir/'summary.json', audit_dir/'validation.json',
              audit_dir/'entry-coverage.jsonl', audit_dir/'source-facts.jsonl', extract_path]
    if review_path.exists():
        inputs.append(review_path)
    inputs.extend(context_paths)
    return {'version':1,'language':'en',
            'countabilityScope':'Default: attested dictionary uses across senses for the exact noun headword. Rows marked selected-sense apply only to the displayed study meaning. These scopes must have different prompts.',
            'countability':runtime,
            'coverage':{'entries':ledger,'summary':{'coreEntries':len(core),
                'nounEntries':sum(x['partOfSpeech']=='noun' for x in core.values()),
                'included':len(runtime),'dictionaryWide':sum('scope' not in r for r in runtime),
                'selectedSense':sum(r.get('scope')=='selected-sense' for r in runtime),
                'statuses':dict(sorted(counts.items())),'reasons':dict(sorted(reasons.items()))},
                'rootFamilies':{'status':'separate-reviewed-projection-required',
                    'guardedSharedCandidates':summary['sharedExplicitRootOrAncestorGroups'],
                    'entriesWithCandidateRelatives':summary['entriesWithSharedFamilyCandidates'],
                    'note':'Audited historical candidates are not automatically promoted to reference families. The separate root review excludes ambiguous homographs and retains exact evidence; this file authors no root meanings or translations.'}},
            'sourcePolicy':{'creator':'English Wiktionary contributors; Lingonberry editorial reviewers',
                'license':'CC-BY-SA-4.0 for imported lexical metadata; review records retain their explicit evidence and editorial-analysis labels',
                'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
                'note':'Preserve the dictionary attribution and references when packaging. Publisher URLs in editorial reviews are factual checks; no publisher definitions or examples are copied here.'},
            'reviewVerification':review_verification,
            'inputHashes':{str(path.relative_to(ROOT)):hash_file(path) for path in inputs},
            'builderSha256':hash_file(Path(__file__))}


def build_review_projection(audit_dir, core_hash):
    reviews = {}
    for name in ['countability-reviewed.json','countability-context-reviewed.json','countability-context-peer.json']:
        path = audit_dir/name
        if path.exists():
            reviews.update(index_unique(read_json(path),'entryId'))
    records=[]
    for entry_id, row in sorted(reviews.items()):
        references=[]
        for source in row['references']:
            reference={key:source[key] for key in ['type','url','historyUrl','creator','license','licenseUrl',
                'snapshotSha256','sourceLine','sourceRowDigest','sourceRowId','sourceWord','sourcePos','senseOrdinal'] if key in source}
            if 'glosses' in source:
                encoded=json.dumps(source['glosses'],ensure_ascii=False,separators=(',',':')).encode()
                reference['glossesSha256']=hashlib.sha256(encoded).hexdigest()
            references.append(reference)
        records.append({'entryId':entry_id,'word':row['word'],'scope':'selected-sense',
            'status':row['status'],'labels':row['labels'],'exerciseReady':row['exerciseReady'],
            'reasoning':row['reasoning'],'numberBehaviour':row.get('numberBehaviour'),
            'currentMeaningSha256':{lang:hashlib.sha256(row['selectedMeaning'][lang].encode()).hexdigest() for lang in ['en','ko']},
            'references':references})
    return {'version':1,'language':'en','sourceCoreSha256':core_hash,
        'notice':'Original Lingonberry adjudication metadata. Imported Wiktionary factual and sense evidence retains CC BY-SA 4.0, with contributor, article, history, snapshot and sense references. Any current meaning snapshots remain under their original package and NIKL licences; this projection contains only their hashes, not the definitions. Publisher URLs are factual checks, not imported definitions or exercises. Full raw proof remains in the local review records.',
        'license':{'originalAdjudication':'MIT','importedWiktionaryEvidence':'CC-BY-SA-4.0',
                   'url':'https://creativecommons.org/licenses/by-sa/4.0/'},
        'digestRules':{'currentMeaningSha256':'SHA-256 of the UTF-8 meaning string',
                       'glossesSha256':'SHA-256 of the UTF-8 JSON gloss array, ensure_ascii=False, compact separators'},
        'records':records}


def write_json_atomic(path, data):
    encoded=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',dir=path.parent,prefix='.english-practice-',delete=False) as file:
        file.write(encoded)
        temporary=Path(file.name)
    try:
        temporary.replace(path)
    finally:
        if temporary.exists(): temporary.unlink()


class CountabilityContractTests(unittest.TestCase):
    def test_mixed_count_and_mass_are_two_labels(self):
        self.assertEqual(normalise_labels(['uncountable','countable','countable']), ['countable','uncountable'])

    def test_insecure_or_missing_references_are_rejected(self):
        for urls in [[], ['http://example.org/word'], ['https://user:password@example.org/word']]:
            with self.subTest(urls=urls), self.assertRaises(ValueError):
                collect_references(urls)

    def test_dictionary_wide_mixed_plural_only_is_withheld(self):
        entry={'id':'x','word':'scissors','partOfSpeech':'noun'}
        audit={'features':{'countability':{'sourceRowIds':[1]}}}
        facts={1:{'word':'scissors','pos':'noun','countabilityFacts':[{'countability':['countable'],'numberBehaviour':'plural-only'}],
                  'provenance':{'license':'CC-BY-SA-4.0','url':'https://en.wiktionary.org/wiki/scissors'}}}
        row,ledger=build_countability(entry,audit,facts)
        self.assertIsNone(row)
        self.assertEqual(ledger['reasonCode'],'dictionary-uses-need-distinct-number-contexts')

    def test_selected_review_remains_selected_scope(self):
        entry={'id':'x','word':'arms','partOfSpeech':'noun'}
        audit={'features':{'countability':{'sourceRowIds':[]}}}
        review={'scope':'selected-study-sense','status':'supported','labels':['plural-only'],
                'exerciseReady':True,'reasoning':'Weaponry sense only.',
                'references':[{'url':'https://en.wiktionary.org/wiki/arms'}]}
        row,ledger=build_countability(entry,audit,{},review)
        self.assertEqual(row['scope'],'selected-sense')
        self.assertEqual(row['labels'],['plural-only'])
        self.assertEqual(ledger['status'],'included')

    def test_contextual_review_is_not_promoted(self):
        entry={'id':'x','word':'memoirs','partOfSpeech':'noun'}
        audit={'features':{'countability':{'sourceRowIds':[]}}}
        review={'scope':'selected-study-sense','status':'supported','labels':['countable','plural-only'],
                'exerciseReady':False,'reasoning':'Different constructions need context.','references':[]}
        row,ledger=build_countability(entry,audit,{},review)
        self.assertIsNone(row)
        self.assertEqual(ledger['reasonCode'],'reviewed-context-required')

    def test_ordinary_plural_relation_blocks_exclusive_plural_only_claim(self):
        entry={'id':'x','word':'years','partOfSpeech':'noun'}
        audit={'features':{'countability':{'sourceRowIds':[1]}}}
        facts={1:{'word':'years','pos':'noun','countabilityFacts':[{'countability':[],'numberBehaviour':'plural-only'}],
                  'provenance':{'license':'CC-BY-SA-4.0','url':'https://en.wiktionary.org/wiki/years'}}}
        row,ledger=build_countability(entry,audit,facts,plural_bases=['year'])
        self.assertIsNone(row)
        self.assertEqual(ledger['registeredPluralBases'],['year'])

    def test_wrong_source_pos_and_duplicate_ids_fail(self):
        with self.assertRaises(ValueError):
            index_unique([{'id':'x'},{'id':'x'}],'id')
        with self.assertRaises(ValueError):
            build_countability({'id':'x','word':'coffee','partOfSpeech':'noun'},
                {'features':{'countability':{'sourceRowIds':[1]}}},
                {1:{'word':'coffee','pos':'adjective'}})

    def test_stale_review_meaning_fails(self):
        with self.assertRaises(ValueError):
            verify_review_binding({'entryId':'x','word':'arms','selectedMeaning':{'en':'Body parts.','ko':'팔.'}},
                {'x':{'id':'x','word':'arms'}},{'en':{'x':'Weapons.'},'ko':{'x':'무기.'}})

    def test_unresolved_meaning_is_not_misreported_as_grammar_context(self):
        row,ledger=build_countability({'id':'x','word':'bars','partOfSpeech':'noun'},
            {'features':{'countability':{'sourceRowIds':[]}}},{},
            {'scope':'selected-study-sense','status':'unresolved','labels':[],
             'exerciseReady':False,'reasoning':'Prison sense needs verification.','references':[]})
        self.assertIsNone(row)
        self.assertEqual(ledger['reasonCode'],'review-unresolved')

    def test_altered_source_gloss_fails(self):
        provenance={'creator':'English Wiktionary contributors','license':'CC-BY-SA-4.0',
            'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','url':'https://en.wiktionary.org/wiki/dog',
            'historyUrl':'https://en.wiktionary.org/w/index.php?title=dog&action=history',
            'snapshotSha256':'abc','sourceLine':1,'sourceRowDigest':'def'}
        source={'word':'dog','language':'en','pos':'noun','provenance_json':json.dumps(provenance),
                'raw_json':json.dumps({'senses':[{'glosses':['An animal.']}],'head_templates':[]})}
        with self.assertRaisesRegex(ValueError,'gloss'):
            verify_source_reference({**provenance,'senseOrdinal':1,'glosses':['A plant.']},source)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--core',type=Path,default=ROOT/'language-packages/en-core-4.2.0.json')
    parser.add_argument('--audit-dir',type=Path,default=ROOT/'local-data/feature-coverage-en')
    parser.add_argument('--output',type=Path,default=ROOT/'local-data/feature-coverage-en/runtime-data.json')
    parser.add_argument('--review-output',type=Path,default=ROOT/'language-packages/sources/exercises/en-countability-review.json')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:
        result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CountabilityContractTests))
        return 0 if result.wasSuccessful() else 1
    output=build_data(args.core.resolve(),args.audit_dir.resolve())
    projection=build_review_projection(args.audit_dir.resolve(),hash_file(args.core.resolve()))
    for relative, digest in output['inputHashes'].items():
        if hash_file(ROOT/relative)!=digest:
            raise ValueError('An input changed during the build')
    write_json_atomic(args.review_output,projection)
    output['reviewLedger']={'path':str(args.review_output.resolve().relative_to(ROOT)),
                           'sha256':hash_file(args.review_output)}
    write_json_atomic(args.output,output)
    print(json.dumps(output['coverage']['summary'],ensure_ascii=False,indent=2))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
