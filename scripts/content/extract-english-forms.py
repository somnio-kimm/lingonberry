"""Extract licensed dictionary inflections; this script performs no model inference."""
import gzip
import hashlib
import json
from pathlib import Path
import unicodedata
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'local-data/coverage/four-language-review/english-sense-plan'
SOURCE = ROOT / 'local-data/sources/legacy-german-dictionary-downloads/en-extract.jsonl.gz'
OUTPUT = BASE / 'source-forms.jsonl'


def normalise(value):
    return unicodedata.normalize('NFKC', value).casefold().strip()


def wanted_words():
    wanted = set()

    def add(word):
        if isinstance(word, str) and word.strip():
            wanted.add(normalise(word))
            wanted.add(normalise(word.split()[0]))

    for part in (1, 2, 3):
        with (BASE / f'independent-{part}-input.jsonl').open() as stream:
            for line in stream:
                add(json.loads(line).get('word'))
    for name in ('supplemental-sense-candidates.jsonl', 'independent-effective-finalized.jsonl'):
        path = BASE / name
        if not path.exists():
            continue
        with path.open() as stream:
            for line in stream:
                row = json.loads(line)
                add((row.get('reviewedFields') or row).get('word'))
                for alias in row.get('aliases', []):
                    add(alias)
    return wanted


def is_inflection(form):
    tags = set(form.get('tags') or [])
    return not tags.intersection({'table-tags', 'inflection-template', 'obsolete', 'archaic', 'nonstandard', 'misspelling'}) and bool(tags.intersection({'plural', 'past', 'present', 'participle', 'comparative', 'superlative', 'infinitive', 'gerund'}))


def select_record(row, wanted, number, raw, source_path):
    # English Wiktionary dumps contain entries for many languages.
    if row.get('lang_code') != 'en':
        return None
    word = row.get('word', '')
    forms = row.get('forms') or []
    selected = normalise(word) in wanted or any(
        is_inflection(form) and isinstance(form.get('form'), str)
        and normalise(form['form']) in wanted for form in forms)
    if not forms or not selected:
        return None
    return {'language': 'en', 'word': word, 'partOfSpeech': row.get('pos'), 'forms': forms,
            'source': {'url': 'https://en.wiktionary.org/wiki/' + quote(word.replace(' ', '_'), safe='') + '#English',
                       'creator': 'English Wiktionary contributors', 'license': 'CC-BY-SA-4.0',
                       'sourcePath': source_path, 'sourceLine': number,
                       'rawLineSha256': hashlib.sha256(raw.rstrip(b'\r\n')).hexdigest(),
                       'digestAlgorithm': 'sha256-original-json-without-line-terminator'}}


def extract():
    wanted = wanted_words()
    temporary = OUTPUT.with_suffix('.jsonl.tmp')
    matched = 0
    number = 0
    print(json.dumps({'wantedSpellings': len(wanted), 'method': 'dictionary-data-extraction-only'}), flush=True)
    with gzip.open(SOURCE, 'rb') as stream, temporary.open('w') as output:
        for number, raw in enumerate(stream, 1):
            row = json.loads(raw)
            record = select_record(row, wanted, number, raw, str(SOURCE.relative_to(ROOT)))
            if record:
                output.write(json.dumps(record, ensure_ascii=False) + '\n')
                matched += 1
            if number % 500000 == 0:
                print(json.dumps({'sourceRowsRead': number, 'matchedEnglishLexemeRows': matched}), flush=True)
    if not matched:
        raise ValueError('No English dictionary forms were extracted')
    temporary.replace(OUTPUT)
    print(json.dumps({'sourceRowsRead': number, 'matchedEnglishLexemeRows': matched,
                      'output': str(OUTPUT.relative_to(ROOT)), 'sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}), flush=True)


if __name__ == '__main__':
    extract()
