#!/usr/bin/env python3
"""Verify correction evidence against cached licensed source rows, without model inference."""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def read_rows(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]


def verify(directory, catalog, report_path, records_path=None, language="en", review_path=None):
    review = {row['id']: row for row in read_rows(review_path or 'language-packages/sources/meaning-reviews/en-3.0.0/entries.jsonl')}
    records = read_rows(records_path) if records_path else [row for file in sorted(directory.glob('*-decisions.jsonl')) for row in read_rows(file)]
    conn = sqlite3.connect(catalog.resolve().as_uri() + '?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    sources = {}
    for row in conn.execute('SELECT id,snapshot_json FROM sources'):
        snapshot = json.loads(row['snapshot_json'])
        sources[snapshot['sha256']] = row['id']
    supplemental = {}
    path = directory / 'supplemental/source-rows.jsonl'
    if path.exists():
        for row in read_rows(path):
            assert digest(row['raw']) == row['provenance']['sourceRowDigest'], 'Supplemental row digest mismatch'
            supplemental[row['provenance']['sourceRowDigest']] = row
    failures, seen, proofs = [], set(), 0
    nikl_records = None
    nikl_sha = None
    for decision in records:
        try:
            original = review.get(decision['id'])
            assert original and (language != 'en' or original['status'] != 'accepted'), 'Unknown finding'
            assert decision['id'] not in seen, 'Duplicate decision'
            seen.add(decision['id'])
            assert decision['index'] == original['index'] and decision['digest'] == original['digest'], 'Stale finding'
            assert isinstance(decision.get('evidence'), list) and (decision['evidence'] or (language != 'en' and decision['decision'] == 'retain')), 'No source evidence'
            for proof in decision['evidence']:
                if proof.get('kind') == 'nikl':
                    if nikl_records is None:
                        data = Path('local-data/sources/nikl-senses.json').read_bytes()
                        nikl_sha = hashlib.sha256(data).hexdigest()
                        nikl_records = json.loads(data)
                    assert proof.get('snapshotSha256') == nikl_sha, 'NIKL snapshot differs'
                    ordinal = proof.get('sourceRecordOrdinal')
                    assert type(ordinal) is int and 1 <= ordinal <= len(nikl_records), 'Invalid NIKL record ordinal'
                    record = nikl_records[ordinal - 1]
                    assert digest(record) == proof.get('sourceRowDigest'), 'NIKL record digest differs'
                    assert record['id'] == proof.get('entryId') and record['sense'] == proof.get('senseId'), 'NIKL sense identity differs'
                    assert proof.get('glosses') == [record['equivalents']['en']['definition']], 'NIKL English definition differs'
                    assert proof.get('equivalents') == record['equivalents']['en']['lemma'], 'NIKL English equivalents differ'
                    assert proof.get('koreanDefinition') == record['definition'], 'NIKL Korean definition differs'
                    assert proof.get('license') == 'CC-BY-SA-2.0-KR', 'NIKL licence differs'
                    for key in ['creator', 'dictionary', 'entryId', 'senseId', 'sourceWord', 'license', 'url', 'snapshot']:
                        assert proof.get(key) == original['source']['source'].get(key), 'NIKL source binding differs: ' + key
                    assert proof.get('licenseUrl') == 'https://creativecommons.org/licenses/by-sa/2.0/kr/', 'NIKL licence link differs'
                    assert decision['decision'] != 'replace', 'New concept requires new lexical evidence'
                elif proof.get('sourceRowDigest'):
                    wrapper = supplemental.get(proof['sourceRowDigest'])
                    if wrapper:
                        raw, provenance = wrapper['raw'], wrapper['provenance']
                        assert raw.get('lang_code') == language, 'Supplemental source language differs'
                    else:
                        source_id = sources.get(proof.get('snapshotSha256'))
                        assert source_id is not None, 'Unknown source snapshot'
                        row = conn.execute('SELECT * FROM source_rows WHERE source_id=? AND source_line=?', (source_id, proof.get('sourceLine'))).fetchone()
                        assert row and row['language'] == language, 'Missing target-language lexical source row'
                        assert row['row_digest'] == proof['sourceRowDigest'], 'Source row digest differs'
                        raw, provenance = json.loads(row['raw_json']), json.loads(row['provenance_json'])
                    for key in ['creator', 'license', 'licenseUrl', 'url', 'historyUrl', 'snapshotSha256', 'sourceLine', 'sourceRowDigest']:
                        assert proof.get(key) == provenance.get(key), 'Source provenance differs: ' + key
                    assert proof['license'] == 'CC-BY-SA-4.0', 'Unexpected Wiktionary licence'
                    if 'sourceWord' in proof:
                        assert proof['sourceWord'] == raw.get('word'), 'Source headword differs'
                    if 'sourcePos' in proof:
                        aliases = {'adj': 'adjective', 'adv': 'adverb', 'intj': 'interjection', 'pron': 'pronoun', 'det': 'determiner', 'prep': 'preposition', 'conj': 'conjunction'}
                        assert aliases.get(proof['sourcePos'], proof['sourcePos']) == aliases.get(raw.get('pos'), raw.get('pos')), 'Source part of speech differs'
                    ordinal = proof.get('senseOrdinal')
                    senses = raw.get('senses', [])
                    assert type(ordinal) is int and 1 <= ordinal <= len(senses), 'Invalid 1-based sense ordinal'
                    sense = senses[ordinal - 1]
                    if proof.get('readingCategory'):
                        category = proof['readingCategory']
                        assert language == 'ja' and raw.get('pos') == 'character', 'Reading metadata requires a Japanese character row'
                        assert category.startswith('Japanese kanji with ') and ' reading ' in category and category in raw.get('categories', []), 'Reading category differs from source'
                        assert proof.get('glosses') == sense.get('glosses', []), 'Reading-row glosses differ from source'
                    else:
                        assert proof.get('glosses') and proof['glosses'] == sense.get('glosses'), 'Selected glosses differ from source'
                    if 'tags' in proof:
                        assert proof['tags'] == sense.get('tags', []), 'Selected usage tags differ'
                else:
                    source = original.get('source', {})
                    assert proof == source or proof == source.get('source'), 'Non-Wiktionary evidence does not match original source'
                    assert source.get('source', {}).get('license') == 'CC-BY-SA-2.0-KR', 'Unexpected original source licence'
                    assert decision['decision'] != 'replace', 'New concept requires new lexical evidence'
                proofs += 1
        except (AssertionError, KeyError, TypeError) as error:
            failures.append({'id': decision.get('id'), 'index': decision.get('index'), 'error': str(error)})
    conn.close()
    report = {'schemaVersion': 1, 'checked': len(records), 'proofsVerified': proofs,
              'decisionDigest': digest(sorted(records, key=lambda row: row['index'])), 'failures': failures,
              'note': 'Source identities, licences, sense ordinals and quoted glosses were checked. This is provenance verification, not independent linguistic approval.'}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({**report, 'failures': failures[:12]}, ensure_ascii=False))
    return bool(failures)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path('local-data/corrections/english-4.0.0'))
    parser.add_argument('--catalog', type=Path, default=Path('local-data/sources/wiktionary/sources.sqlite'))
    parser.add_argument('--records', type=Path)
    parser.add_argument('--report', type=Path, default=Path('local-data/corrections/english-4.0.0/source-validation.json'))
    parser.add_argument('--language', choices=['en', 'ja'], default='en')
    parser.add_argument('--review', type=Path)
    args = parser.parse_args()
    if args.language != 'en' and args.review is None:
        parser.error('--review is required for Japanese')
    raise SystemExit(verify(args.directory, args.catalog, args.report, args.records, args.language, args.review))
