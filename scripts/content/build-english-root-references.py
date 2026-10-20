#!/usr/bin/env python3
"""Project explicit historical relationships into a reference-only family explorer.

Input metadata is licensed source evidence, not automatically written lessons.
No segmentation, ancestor gloss, productive morphology or quiz answer is inferred.
Run --self-test for the boundary tests; the default writes only the local report.
"""
import argparse
import collections
import hashlib
import gzip
import json
from pathlib import Path
import re
import sqlite3
import unittest

REPO = Path(__file__).resolve().parents[2]
ALLOWED = {'root', 'inh', 'inh+', 'der', 'der+', 'bor', 'bor+', 'lbor', 'slbor'}
UNCERTAIN = re.compile(r'\b(uncertain|unknown|unclear|perhaps|possibly|probably|likely|disputed|speculative|conjectural|tentative|allegedly|alleged|debate|debated|debates|whether|theory|theories|alternatively|suggested|proposed|unproven|purported|controversial)\b|\b(?:may|might|could)\s+(?:be|have|come|derive)|\b(?:folk etymology|falsely derived|erroneously derived|mistakenly derived)\b', re.I)
NEGATED = re.compile(r'\b(?:not|never|no)\b[^.!?]{0,100}\b(?:cognate|related|derived|derive|borrowed|borrowing|connection|relation|origin|etymology)\b|\bunrelated\b', re.I)
PLACEHOLDERS = {'', '-', '--', '—', '?', '??', '???', '...', '…', '*', 'unknown', 'uncertain'}
DOCS = [
 'https://en.wiktionary.org/w/index.php?title=Template:root/documentation&oldid=70220395',
 'https://en.wiktionary.org/wiki/Template:derived/documentation',
 'https://en.wiktionary.org/wiki/Module:roots',
]


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def get_identity(fact):
    """Retain source homonym IDs; id/id1 names the first root, id2 the second."""
    template = fact['template']; args = template['args']; term = fact.get('term', '')
    if template['name'] == 'root':
        positions = [int(k)-2 for k, v in args.items() if k.isdigit() and int(k) >= 3 and v == term]
        if len(positions) != 1:
            raise ValueError('non-unique-root-position')
        n = positions[0]
        if n == 1:
            if args.get('id') and args.get('id1') and args['id'] != args['id1']:
                raise ValueError('conflicting-root-sense-ids')
            sense = args.get('id') or args.get('id1') or ''
        else:
            sense = args.get('id'+str(n), '')
    else:
        sense = args.get('id', '')
    return fact['relation'], fact['language'], term, sense


def get_rejection(fact, row):
    if not fact.get('usableFamilyCandidate') or fact.get('rejectionReasons'):
        return 'upstream-source-guard'
    name = fact['template']['name']; args = fact['template']['args']
    if name not in ALLOWED or fact.get('relation') not in {'explicit-root', 'explicit-ancestry'}:
        return 'unsupported-relation-template'
    if args.get('1') != 'en' or args.get('2') != fact['language']:
        return 'inconsistent-language-template'
    term = fact.get('term', '').strip()
    if term.casefold() in PLACEHOLDERS or any(c in term for c in '?{},/|<>#'):
        return 'placeholder-or-compound-source-label'
    if term.startswith(('-', '*-')) or (term.endswith('-') and name != 'root'):
        return 'standalone-affix-or-unreviewed-bound-form'
    if name != 'root' and args.get('3') != term:
        return 'inconsistent-source-term'
    text = row.get('etymologyText', '')
    if not text.strip():
        return 'missing-etymology-context'
    if '?' in text or UNCERTAIN.search(text) or NEGATED.search(text):
        return 'uncertain-or-negated-etymology-context'
    for key, value in args.items():
        if key.startswith(('q', 'qual')) and value:
            return 'qualified-template-needs-clause-review'
    return None


def project(core, candidates, source_rows):
    entries = {e['id']: e for e in core['entries']}
    rows = {str(r['rowId']): r for r in source_rows}
    by_word_pos = collections.defaultdict(list)
    identity_senses = collections.defaultdict(set)
    for row in source_rows:
        if not row.get('formOnly'):
            by_word_pos[row['word'], row['pos']].append(row)
        for fact in row['etymologyFacts']:
            if fact.get('relation') not in {'explicit-root', 'explicit-ancestry'}:
                continue
            try:
                identity = get_identity(fact)
            except ValueError:
                continue
            if identity[3]:
                identity_senses[identity[:3]].add(identity[3])
    groups = collections.defaultdict(lambda: collections.defaultdict(list))
    proofs = {}; excluded = []; counts = collections.Counter()
    def reject(candidate, member, evidence, reason):
        counts[reason] += 1
        excluded.append({'candidateId': candidate['candidateId'], 'entryId': member['entryId'], 'evidence': evidence, 'reason': reason})
    for candidate in candidates:
        for member in candidate['members']:
            entry = entries.get(member['entryId'])
            for ev in member['evidence']:
                row = rows.get(str(ev['rowId']))
                if not entry or not row:
                    reject(candidate, member, ev, 'missing-entry-or-source'); continue
                if row['word'] != entry['word'] or row['pos'] != entry['partOfSpeech'] or row.get('formOnly'):
                    reject(candidate, member, ev, 'word-pos-or-lexical-scope-mismatch'); continue
                alternatives = by_word_pos[row['word'], row['pos']]
                scopes = {(str(r.get('etymologyNumber') or ''), r.get('etymologyText', '').strip()) for r in alternatives}
                if len(scopes) != 1:
                    reject(candidate, member, ev, 'unmapped-same-pos-homograph-etymologies'); continue
                matches = [f for f in row['etymologyFacts'] if f['templateOrdinal'] == ev['templateOrdinal'] and f.get('term') == candidate['term'] and f.get('language') == candidate['language'] and f.get('relation') == candidate['relation']]
                if len(matches) != 1:
                    reject(candidate, member, ev, 'non-unique-exact-template-proof'); continue
                fact = matches[0]; reason = get_rejection(fact, row)
                try:
                    identity = get_identity(fact)
                except ValueError as error:
                    reason = str(error)
                if not reason and not identity[3] and identity_senses[identity[:3]]:
                    reason = 'ancestor-homonym-id-unspecified'
                if reason:
                    reject(candidate, member, ev, reason); continue
                proof = {'rowId':row['rowId'], 'templateOrdinal':fact['templateOrdinal'], 'template':fact['template'], 'etymologyNumber':row.get('etymologyNumber'), 'word':row['word'], 'pos':row['pos'], 'rawPos':row.get('rawPos', row['pos']), 'provenance':row['provenance'], 'etymologyTextSha256':hashlib.sha256(row['etymologyText'].encode()).hexdigest(), 'scope':'Exact headword/POS with one source etymology scope; selected definitions remain the current package definitions.'}
                proof_id = 'root-proof-'+digest(proof)[:20]
                proofs[proof_id] = proof
                groups[identity][entry['id']].append(proof_id)
    families = []; used = set(); member_ids = set()
    for identity, members in sorted(groups.items()):
        if len({entries[i]['word'] for i in members}) < 2:
            counts['fewer-than-two-distinct-words-after-guards'] += 1
            continue
        relation, language, term, sense = identity
        family = {'id':'en-historical-'+digest(identity)[:20], 'term':term, 'language':language, 'relation':relation, 'members':[]}
        if sense:
            family['sourceSenseId'] = sense
        for entry_id, proof_ids in sorted(members.items(), key=lambda pair:(entries[pair[0]]['word'].casefold(),pair[0])):
            proof_ids = sorted(set(proof_ids)); used.update(proof_ids); member_ids.add(entry_id)
            family['members'].append({'entryId':entry_id, 'references':sorted({proofs[p]['provenance']['url'] for p in proof_ids}), 'proofIds':proof_ids})
        families.append(family)
    return {'version':1, 'families':families, 'coverage':{'coreEntries':len(entries), 'candidateFamilies':len(candidates), 'families':len(families), 'entries':len(member_ids), 'distinctWords':len({entries[i]['word'] for i in member_ids}), 'memberships':sum(len(f['members']) for f in families)}, 'report':{'scope':'Source-linked historical family reference only; not generated root meanings, modern segmentation, interchangeable synonyms or quiz answers.', 'review':'Projection rules and representative template/edge cases reviewed; not every historical relationship manually adjudicated.', 'excludedReasons':dict(sorted(counts.items())), 'templateDocumentation':DOCS, 'sampledTemplateNames':['root','inh','inh+','der','der+','bor','bor+','lbor'], 'sampledSourceRowIds':[63598,63605,63621,63650,63666,64252,65891,64268,64270,66297,66299,67198,67200,81256,64221,78725,77045,79920,69024,86430,77600,99219], 'limitations':['Same-POS words with multiple etymologies are withheld until selected-sense mapping exists.', 'Missing ancestor homonym IDs are withheld wherever the source inventory supplies sense distinctions.', 'Source ancestry may be indirect. Shared ancestry does not imply shared current meaning or a productive modern word-building rule.', 'Current meanings must be resolved by member entryId from the installed explanation package; no ancestor meaning is invented.', 'Unknown and rejected coverage remains explicit; no dictionary-wide completeness claim.']}, 'proofLedger':{p:proofs[p] for p in sorted(used)}, 'excludedEvidence':excluded}


def verify_proofs(result, repo):
    """Fail closed on stale source links or a template/hash mismatch."""
    db = sqlite3.connect((repo/'local-data/sources/wiktionary/sources.sqlite').as_uri()+'?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    extract_proofs = collections.defaultdict(list)
    verified = 0
    def check_template(proof, raw):
        templates = raw.get('etymology_templates', [])
        ordinal = proof['templateOrdinal']
        assert 0 < ordinal <= len(templates), 'Missing original template'
        actual = {k:templates[ordinal-1].get(k, {}) for k in ('name','args')}
        assert actual == proof['template'], 'Changed original template'
        assert raw['word'] == proof['word'], 'Changed source headword'
        assert hashlib.sha256(raw.get('etymology_text','').encode()).hexdigest() == proof['etymologyTextSha256'], 'Changed etymology context'
    for proof in result['proofLedger'].values():
        provenance = proof['provenance']
        assert provenance['license'] == 'CC-BY-SA-4.0'
        assert provenance['creator'] and provenance['licenseUrl'] and provenance['historyUrl']
        if isinstance(proof['rowId'], int):
            row = db.execute('select * from source_rows where id=?', (proof['rowId'],)).fetchone()
            assert row and row['pos'] == proof['pos']
            assert row['row_digest'] == provenance['sourceRowDigest']
            check_template(proof, json.loads(row['raw_json'])); verified += 1
        else:
            extract_proofs[provenance['referenceIndex']].append(proof)
    if extract_proofs:
        with gzip.open(repo/'local-data/feature-sources/en-raw.jsonl.gz','rb') as source:
            for index, line in enumerate(source, 1):
                for proof in extract_proofs.pop(index, []):
                    assert hashlib.sha256(line).hexdigest() == proof['provenance']['rawLineSha256']
                    raw = json.loads(line)
                    assert raw['pos'] == proof['rawPos']
                    check_template(proof, raw); verified += 1
                if not extract_proofs:
                    break
    assert not extract_proofs, 'Missing raw source indices'
    db.close()
    assert verified == len(result['proofLedger'])
    return {'verifiedProofRecords':verified, 'checks':['exact template ordinal/name/args', 'source row identity and original hash', 'etymology context hash', 'creator/licence/history retained']}


class ProjectionTests(unittest.TestCase):
    def make_inputs(self):
        fact = {'templateOrdinal':1,'template':{'name':'der','args':{'1':'en','2':'la','3':'portare'}},'relation':'explicit-ancestry','language':'la','term':'portare','usableFamilyCandidate':True,'rejectionReasons':[]}
        rows = [{'rowId':i,'word':w,'pos':'verb','formOnly':False,'etymologyNumber':None,'etymologyText':'From Latin portare.','etymologyFacts':[fact],'provenance':{'url':'https://en.wiktionary.org/wiki/'+w}} for i,w in enumerate(['import','transport'],1)]
        core = {'entries':[{'id':r['word'],'word':r['word'],'partOfSpeech':'verb'} for r in rows]}
        candidates = [{'candidateId':'p','relation':'explicit-ancestry','language':'la','term':'portare','members':[{'entryId':r['word'],'evidence':[{'rowId':r['rowId'],'templateOrdinal':1}]} for r in rows]}]
        return core,candidates,rows
    def test_explorer_keeps_proven_sources_without_inventing_meanings(self):
        result=project(*self.make_inputs());self.assertEqual(result['coverage']['families'],1);self.assertNotIn('meaning',result['families'][0]);self.assertEqual(len(result['proofLedger']),2)
    def test_unknown_ancestry_is_not_promoted(self):
        core,candidates,rows=self.make_inputs();rows[0]['etymologyText']='Perhaps from Latin portare.'
        self.assertEqual(project(core,candidates,rows)['families'],[])
    def test_same_pos_homographs_require_sense_mapping(self):
        core,candidates,rows=self.make_inputs();other=dict(rows[0],rowId=3,etymologyNumber=2,etymologyText='From another origin.');rows.append(other)
        self.assertEqual(project(core,candidates,rows)['families'],[])
    def test_wrong_pos_source_is_not_a_match(self):
        core,candidates,rows=self.make_inputs();rows[0]['pos']='noun'
        self.assertEqual(project(core,candidates,rows)['families'],[])
    def test_root_homonym_ids_are_preserved_per_position(self):
        f={'relation':'explicit-root','language':'ine-pro','term':'*per-','template':{'name':'root','args':{'1':'en','2':'ine-pro','3':'*per-','4':'*dhe-','id1':'beat','id2':'put'}}}
        self.assertEqual(get_identity(f)[3],'beat');f['term']='*dhe-';self.assertEqual(get_identity(f)[3],'put')
    def test_affix_only_and_placeholder_targets_are_excluded(self):
        _,_,rows=self.make_inputs();r=rows[0]
        for term in ['-ness','*','unknown','a,b']:
            f=dict(r['etymologyFacts'][0],term=term);self.assertIsNotNone(get_rejection(f,r))
    def test_negation_and_question_mark_require_review(self):
        _,_,rows=self.make_inputs();r=rows[0]
        for text in ['Not derived from portare.','Latin portare?','There is debate as to whether this comes from portare.']:
            r['etymologyText']=text;self.assertIsNotNone(get_rejection(r['etymologyFacts'][0],r))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--core',type=Path,default=REPO/'language-packages/en-core-4.2.0.json')
    parser.add_argument('--input',type=Path,default=REPO/'local-data/feature-coverage-en')
    parser.add_argument('--output',type=Path,default=REPO/'local-data/feature-coverage-en/root-references.json')
    args=parser.parse_args()
    if args.self_test:
        result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ProjectionTests))
        raise SystemExit(not result.wasSuccessful())
    candidate_path=args.input/'family-candidates.jsonl';source_path=args.input/'source-facts.jsonl'
    result=project(json.loads(args.core.read_text()),read_jsonl(candidate_path),read_jsonl(source_path))
    result['report']['inputSha256']={str(p.relative_to(REPO) if p.is_relative_to(REPO) else p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [args.core,candidate_path,source_path]}
    result['report']['sourceValidation'] = verify_proofs(result, REPO)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['coverage'],indent=2))


if __name__=='__main__':
    main()
