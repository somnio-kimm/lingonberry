#!/usr/bin/env python3
"""Inventory every English affix row in a fixed Wiktionary snapshot, without a study-word cap.

Keeps source senses and provenance; extraction is not linguistic review or translation.
Reconstructed forms, IPA and non-English-script labels never become display forms.
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import re
import time

READABLE = re.compile(r"-?[A-Za-z]+(?:[-'][A-Za-z]+)*-?\Z")
POSITIONS = {'prefix', 'suffix', 'affix', 'infix', 'interfix', 'circumfix'}

def extract(row, line):
    if row.get('lang_code') != 'en' or row.get('pos') not in POSITIONS:
        return None
    word = row.get('word', '')
    if not READABLE.fullmatch(word):
        return None
    senses = []
    for ordinal, sense in enumerate(row.get('senses', [])):
        glosses = sense.get('glosses') or sense.get('raw_glosses') or []
        if not glosses:
            continue
        senses.append({'ordinal': ordinal, 'glosses': glosses, 'tags': sense.get('tags', []),
                       'links': sense.get('links', []), 'examples': sense.get('examples', [])})
    if not senses:
        return None
    return {'form': word, 'partOfSpeech': row['pos'], 'etymologyNumber': row.get('etymology_number'),
            'etymologyText': row.get('etymology_text', ''), 'etymologyTemplates': row.get('etymology_templates', []),
            'derived': row.get('derived', []), 'related': row.get('related', []),
            'translations': row.get('translations', []), 'senses': senses,
            'provenance': {'creator': 'English Wiktionary contributors', 'license': 'CC-BY-SA-4.0',
                           'url': 'https://en.wiktionary.org/wiki/' + word,
                           'sourceLine': line, 'sourceRowSha256': hashlib.sha256(json.dumps(row, ensure_ascii=False, sort_keys=True).encode()).hexdigest()}}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    counts = collections.Counter(); forms = set(); started = time.monotonic()
    marker = re.compile(rb'"pos":\s*"(?:prefix|suffix|affix|infix|interfix|circumfix)"')
    with gzip.open(args.snapshot, 'rb') as stream, (args.output / 'affixes.jsonl').open('w') as out:
        for line, raw in enumerate(stream, 1):
            if marker.search(raw):
                item = extract(json.loads(raw), line)
                if item:
                    out.write(json.dumps(item, ensure_ascii=False) + '\n')
                    counts[item['partOfSpeech']] += 1; forms.add(item['form'])
            if line % 200000 == 0:
                print(json.dumps({'lines': line, 'rows': sum(counts.values()), 'forms': len(forms), 'seconds': round(time.monotonic() - started)}), flush=True)
    report = {'completeSnapshotScan': True, 'snapshot': str(args.snapshot), 'sourceLines': line,
              'rowsByPartOfSpeech': dict(counts), 'distinctReadableForms': len(forms),
              'scope': 'All English affix entries with ASCII letter/hyphen/apostrophe labels in this snapshot; not all historical roots or a claim of completed bilingual learner families.',
              'license': 'CC-BY-SA-4.0', 'creator': 'English Wiktionary contributors'}
    (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)

if __name__ == '__main__':
    main()
