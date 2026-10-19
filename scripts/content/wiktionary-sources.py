"""Build a lossless, headword-filtered Wiktionary catalogue; never mutate the queue.

Example: python scripts/content/wiktionary-sources.py --queue local-data/jobs.sqlite
    --manifest local-data/wiktionary/manifest.json
    --output local-data/wiktionary/sources.sqlite

Manifest: {"schemaVersion":1,"sources":[{"edition":"en","path":"extract.jsonl.gz",
"sha256":"<compressed file SHA256>","license":"CC-BY-SA-4.0",
"licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/",
"url":"https://kaikki.org/dictionary/rawdata.html"}]}.
Paths are relative to the manifest. Pin extractor revision/dump date as additional
source fields when known. A digest identifies the bytes, not an invented dump date.
Sources are streamed once, including nonmatching rows, to verify their full digest.
Only exact NFC headwords from the queue's current entries are stored. Raw rows and
raw senses remain intact: lookup/POS normalisation must not imply sense alignment.
All examples remain unaccepted candidates. Native editions lacking explicit type
need source-rights verification; a missing reference alone cannot prove authorship.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import unicodedata
from urllib.parse import quote, urlparse

EDITIONS = {'de':'German','en':'English','es':'Spanish','fr':'French',
            'ja':'Japanese','ko':'Korean','zh':'Chinese'}
LANGUAGES = tuple(EDITIONS)
POS = {'adj':'adjective','adv':'adverb','pron':'pronoun','num':'numeral',
       'intj':'interjection','det':'determiner','prep':'preposition','postp':'postposition',
       'conj':'conjunction','name':'proper-noun','character':'character',
       'phrase':'phrase','noun':'noun','verb':'verb','particle':'particle',
       'classifier':'classifier','counter':'classifier','aux':'auxiliary'}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def normalise_word(value):
    return unicodedata.normalize('NFC', value) if isinstance(value, str) else ''


def normalise_pos(value):
    if not isinstance(value, str):
        return ''
    value = value.strip().lower()
    if value in ('proper noun', 'proper_noun', 'propernoun'):
        value = 'proper-noun'
    return POS.get(value, value)


def open_readonly(path):
    conn = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA query_only=ON')
    return conn


def load_wanted(queue_path):
    """Read a consistent queue snapshot, including already-applied corrections."""
    wanted = {language: set() for language in LANGUAGES}
    conn = open_readonly(queue_path)
    try:
        for row in conn.execute('SELECT study_language,entry_json FROM entries'):
            if row['study_language'] not in wanted:
                continue
            entry = json.loads(row['entry_json'])
            word = normalise_word(entry.get('word'))
            if word:
                wanted[row['study_language']].add(word)
    finally:
        conn.close()
    return wanted


def load_manifest(path, root=None):
    path = Path(path).resolve()
    manifest = json.loads(path.read_text(encoding='utf-8'))
    if manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('sources'), list):
        raise ValueError('Expected schemaVersion 1 and sources array')
    sources = []
    for source in manifest['sources']:
        if not isinstance(source, dict):
            raise ValueError('Source must be an object')
        item = dict(source)
        item['edition'] = item.get('edition', item.get('editionLanguage'))
        item['url'] = item.get('url', item.get('sourceUrl'))
        if item['edition'] not in EDITIONS:
            raise ValueError('Unsupported Wiktionary edition')
        if not isinstance(item.get('sha256'), str) or not re.fullmatch('[0-9a-fA-F]{64}', item['sha256']):
            raise ValueError('Every source requires its exact file SHA256')
        item['sha256'] = item['sha256'].lower()
        if not isinstance(item.get('license'), str) or not item['license'].strip():
            raise ValueError('Every source requires a licence identifier')
        for key in ('licenseUrl', 'url'):
            value = item.get(key)
            if not isinstance(value, str) or urlparse(value).scheme not in ('https', 'http') or not urlparse(value).netloc:
                raise ValueError('Every source requires valid ' + key)
        if not isinstance(item.get('path'), str) or not item['path']:
            raise ValueError('Every source requires a local path')
        item['path'] = str(((Path(root).resolve() if root is not None else path.parent) / item['path']).resolve())
        item.setdefault('creator', EDITIONS[item['edition']] + ' Wiktionary contributors')
        sources.append(item)
    if not sources:
        raise ValueError('At least one source is required')
    return sources


def example_translations(example, edition):
    """Edition translations and legacy English fields have different languages."""
    if edition not in EDITIONS:
        raise ValueError('Unsupported edition')
    result = {}
    if isinstance(example.get('translation'), str) and example['translation'].strip():
        result[edition] = example['translation']
    if isinstance(example.get('english'), str) and example['english'].strip():
        # Preserve conflicts as evidence instead of silently overwriting a value.
        if 'en' in result and result['en'] != example['english']:
            return {'translations': result, 'legacyEnglish': example['english'], 'conflict': True}
        result['en'] = example['english']
    return {'translations': result, 'conflict': False}


def classify_example(example, edition, sense=None):
    """Rights screening only; even 'candidate' still needs sense/focus review."""
    if edition not in EDITIONS:
        raise ValueError('Unsupported edition')
    reasons = []
    if not isinstance(example, dict):
        return {'status':'rejected','accepted':False,'reasons':['malformed-example']}
    if not isinstance(example.get('text'), str) or not example['text'].strip():
        reasons.append('missing-text')
    kind = example.get('type')
    if kind and kind not in ('example', 'usage-example'):
        reasons.append('non-usage-example-type')
    for key in ('ref', 'reference', 'references', 'source', 'author', 'title', 'url',
                'citation', 'citations', 'quote', 'quotation', 'attestations'):
        if example.get(key):
            reasons.append('external-or-quotation-evidence:' + key)
    if (sense or {}).get('attestations'):
        reasons.append('historical-attestation')
    for container in (example, sense or {}):
        tags = container.get('tags', []) + container.get('raw_tags', [])
        if any(str(tag).lower() in ('quotation', 'quote', 'citation', 'historical-attestation') for tag in tags):
            reasons.append('quotation-tag')
    if reasons:
        return {'status':'rejected','accepted':False,'reasons':sorted(set(reasons))}
    if edition == 'en' and kind != 'example':
        return {'status':'rejected','accepted':False,'reasons':['explicit-usage-example-type-required']}
    if edition != 'en':
        return {'status':'rights-verification-needed','accepted':False,
                'reasons':['native-edition-authorship-not-established']}
    return {'status':'candidate','accepted':False,'reasons':[]}


def source_provenance(source, row, line_number, row_digest):
    title = row.get('original_title') or row['word']
    encoded_title = quote(title, safe='')
    domain = source['edition'] + '.wiktionary.org'
    return {'kind':'wiktionary','edition':source['edition'],'creator':source['creator'],
            'license':source['license'],'licenseUrl':source['licenseUrl'],
            'url':'https://' + domain + '/wiki/' + encoded_title,
            'historyUrl':'https://' + domain + '/w/index.php?title=' + encoded_title + '&action=history',
            'snapshotUrl':source['url'],'snapshotSha256':source['sha256'],
            'sourceRowDigest':row_digest,'sourceLine':line_number,'modifications':[]}


class _HashReader(io.RawIOBase):
    """Hash compressed bytes as gzip consumes them, without a second dump pass."""
    def __init__(self, stream):
        self.stream = stream
        self.digest = hashlib.sha256()
        self.bytes = 0

    def readable(self):
        return True

    def readinto(self, buffer):
        data = self.stream.read(len(buffer))
        self.digest.update(data)
        self.bytes += len(data)
        buffer[:len(data)] = data
        return len(data)


SCHEMA = '''
CREATE TABLE metadata(key TEXT PRIMARY KEY,value_json TEXT NOT NULL);
CREATE TABLE sources(id INTEGER PRIMARY KEY,edition TEXT NOT NULL,snapshot_json TEXT NOT NULL);
CREATE TABLE source_rows(id INTEGER PRIMARY KEY,source_id INTEGER NOT NULL REFERENCES sources(id),
 source_line INTEGER NOT NULL,language TEXT NOT NULL,word TEXT NOT NULL,pos TEXT NOT NULL,
 row_digest TEXT NOT NULL,raw_json TEXT NOT NULL,provenance_json TEXT NOT NULL,
 UNIQUE(source_id,source_line));
CREATE INDEX row_lookup ON source_rows(language,word,pos);
CREATE TABLE senses(id INTEGER PRIMARY KEY,row_id INTEGER NOT NULL REFERENCES source_rows(id),
 sense_ordinal INTEGER NOT NULL,sense_id_json TEXT NOT NULL,raw_json TEXT NOT NULL,
 UNIQUE(row_id,sense_ordinal));
CREATE TABLE examples(id INTEGER PRIMARY KEY,sense_id INTEGER NOT NULL REFERENCES senses(id),
 example_ordinal INTEGER NOT NULL,raw_json TEXT NOT NULL,screening_json TEXT NOT NULL,
 translations_json TEXT NOT NULL,UNIQUE(sense_id,example_ordinal));
'''


def _import_source(conn, source_id, source, wanted):
    counts = {'lines':0, 'rows':0, 'senses':0, 'examples':0}
    with open(source['path'], 'rb') as raw:
        reader = _HashReader(raw)
        with io.BufferedReader(reader) as compressed:
            stream = gzip.GzipFile(fileobj=compressed) if source['path'].endswith('.gz') else compressed
            try:
                for line_number, line in enumerate(stream, 1):
                    counts['lines'] += 1
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        raise ValueError('Source row must be an object at line ' + str(line_number))
                    language, word = row.get('lang_code'), normalise_word(row.get('word'))
                    if language not in wanted or word not in wanted[language]:
                        continue
                    row_digest = hashlib.sha256(line.rstrip(b'\r\n')).hexdigest()
                    provenance = source_provenance(source, row, line_number, row_digest)
                    row_id = conn.execute('INSERT INTO source_rows(source_id,source_line,language,word,pos,row_digest,raw_json,provenance_json) VALUES(?,?,?,?,?,?,?,?)',
                        (source_id,line_number,language,word,normalise_pos(row.get('pos')),row_digest,line.decode('utf-8').rstrip('\r\n'),encoded(provenance))).lastrowid
                    counts['rows'] += 1
                    for ordinal, sense in enumerate(row.get('senses', [])):
                        if not isinstance(sense, dict):
                            raise ValueError('Malformed source sense')
                        identity = {key:sense[key] for key in ('senseid','sense_id','sense_index') if key in sense}
                        sense_id = conn.execute('INSERT INTO senses(row_id,sense_ordinal,sense_id_json,raw_json) VALUES(?,?,?,?)',
                            (row_id,ordinal,encoded(identity),encoded(sense))).lastrowid
                        counts['senses'] += 1
                        for index, example in enumerate(sense.get('examples', [])):
                            screening = classify_example(example, source['edition'], sense)
                            translations = example_translations(example, source['edition']) if isinstance(example, dict) else {}
                            conn.execute('INSERT INTO examples(sense_id,example_ordinal,raw_json,screening_json,translations_json) VALUES(?,?,?,?,?)',
                                (sense_id,index,encoded(example),encoded(screening),encoded(translations)))
                            counts['examples'] += 1
            finally:
                if stream is not compressed:
                    stream.close()
        if reader.digest.hexdigest() != source['sha256']:
            raise ValueError('Source SHA256 mismatch: ' + source['path'])
        if 'bytes' in source and source['bytes'] != reader.bytes:
            raise ValueError('Source byte length mismatch: ' + source['path'])
    return counts


def build_catalog(queue_path, manifest_path, output_path, *, replace=False, root=None):
    """Atomically install a verified catalogue; failure preserves prior output."""
    sources = load_manifest(manifest_path, root=root)
    output = Path(output_path).resolve()
    protected = {Path(queue_path).resolve(), Path(manifest_path).resolve(),
                 *(Path(source['path']) for source in sources)}
    if output in protected:
        raise ValueError('Output must not replace the queue, manifest or source dump')
    if output.exists() and not replace:
        raise FileExistsError('Catalogue already exists; use --replace explicitly')
    wanted = load_wanted(queue_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=output.name + '.', suffix='.tmp', dir=output.parent)
    os.close(descriptor)
    conn = sqlite3.connect(temporary)
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript(SCHEMA)
        conn.execute('INSERT INTO metadata VALUES(?,?)', ('schemaVersion','1'))
        conn.execute('INSERT INTO metadata VALUES(?,?)', ('wantedDigest',encoded(hashlib.sha256(encoded({k:sorted(v) for k,v in wanted.items()}).encode()).hexdigest())))
        reports = []
        for source in sources:
            print('Indexing Wiktionary edition ' + source['edition'] + ': ' + source['path'], file=sys.stderr, flush=True)
            source_id = conn.execute('INSERT INTO sources(edition,snapshot_json) VALUES(?,?)', (source['edition'],encoded(source))).lastrowid
            report = {'edition':source['edition'], **_import_source(conn,source_id,source,wanted)}
            reports.append(report)
            print('Verified Wiktionary edition: ' + encoded(report), file=sys.stderr, flush=True)
        conn.commit()
        conn.close()
        os.replace(temporary, output)
        return {'output':str(output), 'sources':reports, 'accepted':False}
    finally:
        conn.close()
        Path(temporary).unlink(missing_ok=True)


def find_rows(conn, language, word, pos=None):
    """Return lossless evidence wrappers, never claim semantic alignment."""
    sql = 'SELECT r.*,s.edition,s.snapshot_json FROM source_rows r JOIN sources s ON s.id=r.source_id WHERE r.language=? AND r.word=?'
    args = [language, normalise_word(word)]
    if pos is not None:
        sql += ' AND r.pos=?'
        args.append(normalise_pos(pos))
    sql += ' ORDER BY r.source_id,r.source_line'
    return [{'edition':row['edition'],'snapshot':json.loads(row['snapshot_json']),
             'row':json.loads(row['raw_json']),'rowIndex':row['source_line'],
             'rowDigest':row['row_digest'],'provenance':json.loads(row['provenance_json'])}
            for row in conn.execute(sql, args)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', required=True, type=Path)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path('local-data/wiktionary/sources.sqlite'))
    parser.add_argument('--root', type=Path, help='Resolve source paths relative to this repository root')
    parser.add_argument('--replace', action='store_true')
    args = parser.parse_args()
    print(json.dumps(build_catalog(args.queue,args.manifest,args.output,replace=args.replace,root=args.root), ensure_ascii=False))


if __name__ == '__main__':
    main()
