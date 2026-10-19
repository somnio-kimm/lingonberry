"""Conservative Wiktionary candidates; pure matching, never review or publication.

Rows use the index wrapper {edition,snapshot,row,rowIndex,rowDigest,provenance}.
Snapshot-local identity may be recorded as evidence.wiktionarySense with edition,
snapshotSha256, rowDigest and zero-based senseIndex. Otherwise a unique exact
selected gloss in the edition's language is required. No token scoring is used.
"""
from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import json
import re
import unicodedata
from urllib.parse import quote

_SOURCE_SPEC = importlib.util.spec_from_file_location(
    'wiktionary_sources', Path(__file__).with_name('wiktionary-sources.py'))
sources = importlib.util.module_from_spec(_SOURCE_SPEC)
_SOURCE_SPEC.loader.exec_module(sources)

BLOCKED = {'obsolete', 'archaic', 'misspelling', 'offensive', 'vulgar',
           'derogatory', 'slur', 'form-of', 'alt-of', 'dialectal', 'Cantonese',
           'Min-Nan', 'Wu', 'Hakka', 'Classical-Chinese'}
EDITIONS = {'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish',
            'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese'}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def nfc(value):
    return unicodedata.normalize('NFC', value) if isinstance(value, str) else ''


def normalise_gloss(value):
    """NFC and whitespace only; case, negation and qualifiers stay meaningful."""
    return ' '.join(nfc(value).split())


def sense_gloss(sense):
    # Wiktextract glosses can be a parent-to-child chain, not alternatives.
    values = sense.get('glosses', [])
    if not values or any(not isinstance(x, str) or not x.strip() for x in values):
        return ''
    return ' '.join(values)


def normalise_pos(value):
    return sources.normalise_pos(value)


def _script(text):
    if re.search('[\u3040-\u30ff]', text): return 'ja'
    if re.search('[\uac00-\ud7af]', text): return 'ko'
    if re.search('[\u3400-\u9fff]', text): return 'zh'
    return 'latin'


def _language_text(text, language):
    script = _script(text)
    if language in {'en', 'de', 'es', 'fr'}:
        return script == 'latin'
    letters = [c for c in text if unicodedata.category(c).startswith('L')]
    native = sum(_script(c) in ({'ja', 'zh'} if language == 'ja' else {language}) for c in letters)
    return script == language and bool(letters) and native / len(letters) >= 0.7


def _sentence(text, language):
    if not isinstance(text, str) or not 4 <= len(text) <= 500:
        return False
    if not re.search(r'[.!?。！？][\"”’」』）)]?$', text.strip()):
        return False
    if re.search(r'<[^>]*>|\{\{|\}\}|\[\[|https?://|\n|\t', text):
        return False
    if not _language_text(text, language):
        return False
    if language in {'en', 'de', 'es', 'fr'}:
        return len(re.findall(r"[^\W\d_]+", text, re.UNICODE)) >= 3
    return len(re.findall(r'[^\W\d_]', text, re.UNICODE)) >= 4


def _readings(row):
    found = set()
    for form in row.get('forms', []):
        tags = set(form.get('tags', []))
        if 'romanization' in tags:
            found.add(normalise_gloss(form.get('form')))
        if 'canonical' in tags and form.get('ruby'):
            value = form.get('form', '')
            for pair in form['ruby']:
                if len(pair) >= 2: value = value.replace(pair[0], pair[1], 1)
            found.add(normalise_gloss(value))
    for sound in row.get('sounds', []):
        if sound.get('other'): found.add(normalise_gloss(sound['other']))
        if 'Pinyin' in sound.get('tags', []) and 'Mandarin' in sound.get('tags', []):
            found.add(normalise_gloss(sound.get('zh_pron', '')).split(' (')[0])
    return found - {''}


def _reading_conflict(entry, row, language):
    if language not in {'ja', 'zh'}: return False
    selected = [entry.get(key) for key in ('reading', 'pronunciation', 'pinyin')]
    selected = {normalise_gloss(x) for x in selected if isinstance(x, str) and x.strip()}
    supplied = _readings(row)
    for reading in selected:
        comparable = {value for value in supplied if _script(value) == _script(reading)}
        if comparable and reading not in comparable: return True
    return False


def _focus(row, example):
    text = example['text']
    verified = {nfc(row.get('word'))}
    for form in row.get('forms', []):
        tags = set(form.get('tags', []))
        if (form.get('source') == 'inflection' or 'canonical' in tags) and not (
            tags & {'romanization', 'table-tags', 'inflection-template', 'noun-from-adj'}
        ) and not form.get('raw_tags'):
            verified.add(nfc(form.get('form')))
    spans = []
    for span in example.get('bold_text_offsets', []):
        if not isinstance(span, (list, tuple)) or len(span) != 2: continue
        start, end = span
        if (type(start) is not int or type(end) is not int or
                not 0 <= start < end <= len(text)): continue
        surface = text[start:end]
        if nfc(surface) in verified:
            spans.append({'start': len(text[:start].encode('utf-16-le')) // 2,
                          'text': surface})
    return spans[0] if len(spans) == 1 else None


def _identity(wrapper, index):
    return {'edition': wrapper['edition'],
            'snapshotSha256': wrapper['snapshot']['sha256'],
            'rowDigest': wrapper['rowDigest'], 'senseIndex': index}


def _candidate(wrapper, index, text, alignment=None, **fields):
    edition = wrapper['edition']; row = wrapper['row']; snapshot = wrapper['snapshot']
    title = row.get('original_title') or row.get('word')
    provenance = {'kind': 'licensed-source', 'license': 'CC-BY-SA-4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'creator': snapshot.get('creator') or EDITIONS.get(edition, edition) + ' Wiktionary contributors',
        'url': 'https://' + edition + '.wiktionary.org/wiki/' + quote(title, safe=''),
        'history': 'https://' + edition + '.wiktionary.org/w/index.php?title=' + quote(title, safe='') + '&action=history',
        'sourceIdentity': _identity(wrapper, index), 'sourceLine': wrapper.get('rowIndex'),
        'sourceSnapshot': {key: value for key, value in snapshot.items() if key != 'path'},
        'review': 'independent-review-required'}
    if 'source_example_index' in fields:
        provenance['sourceExampleIndex'] = fields['source_example_index']
        provenance['modifications'] = ([
            'Converted focus offsets from Unicode code points to UTF-16 code units; source sentence text unchanged.'
        ] if 'focus' in fields else ['Source translation text unchanged.'])
    else:
        provenance['modifications'] = ([
            'Joined the source gloss hierarchy with single spaces; individual gloss text unchanged.'
        ] if len(row['senses'][index].get('glosses', [])) > 1 else [])
    if alignment is not None:
        provenance['alignment'] = dict(alignment)
        fields['alignment'] = dict(alignment)
    value = {'text': text, 'provenance': provenance,
             'source_snapshot_sha256': snapshot['sha256'], 'accepted': False, **fields}
    value['source_digest'] = digest(value)
    return value


def match_wiktionary(entry, evidence, rows, study_language=None, allow_single_sense_candidates=False):
    """Return source candidates and explicit holds, without mutating inputs.

    Exact selected gloss matching is scoped per edition. Multiple matching senses
    in one edition are held, even if their surface gloss strings are identical.
    Native-edition definitions are candidates; their examples remain held until
    a dedicated usage-example rights adapter exists. Opt-in single-sense retrieval
    supplies unverified candidates for independent review, never sense approval.
    """
    language = study_language or entry.get('studyLanguage') or entry.get('language')
    if language not in EDITIONS: raise ValueError('Explicit supported study language required')
    result = {'meanings': {}, 'native_examples': [], 'example_translations': {}, 'holds': [],
              'retrieval_counts': {'exact_selected_senses': 0,
                                   'unique_source_sense_candidates': 0,
                                   'ambiguous_source_sense_groups': 0}}
    matches = {}; eligible = {}; methods = {}
    selected_identity = evidence.get('wiktionarySense')
    def hold(reason, wrapper=None, **detail):
        value = {'reason': reason, **detail}
        if wrapper: value.update(edition=wrapper.get('edition'), rowIndex=wrapper.get('rowIndex'))
        result['holds'].append(value)
    for wrapper in rows:
        row = wrapper.get('row', {}); edition = wrapper.get('edition'); snapshot = wrapper.get('snapshot', {})
        if (edition not in EDITIONS or not re.fullmatch('[a-f0-9]{64}', snapshot.get('sha256', ''))
                or not re.fullmatch('[a-f0-9]{64}', wrapper.get('rowDigest', ''))
                or snapshot.get('license') != 'CC-BY-SA-4.0'):
            hold('unverified-source-metadata', wrapper); continue
        if row.get('lang_code') != language or nfc(row.get('word')) != nfc(entry.get('word')):
            hold('lemma-or-language-mismatch', wrapper); continue
        if normalise_pos(row.get('pos')) != normalise_pos(entry.get('partOfSpeech')):
            hold('part-of-speech-mismatch', wrapper); continue
        if _reading_conflict(entry, row, language):
            hold('reading-conflict', wrapper); continue
        known = evidence.get('meanings', {}).get(edition, {})
        known_text = known.get('text') if isinstance(known, dict) else known
        for index, sense in enumerate(row.get('senses', [])):
            if _identity(wrapper, index) in evidence.get('wiktionaryExcludedSenses', []):
                hold('reviewed-source-sense-mismatch', wrapper, senseIndex=index); continue
            tags = set(row.get('tags', [])) | set(sense.get('tags', []))
            if (sense.get('form_of') or sense.get('alt_of') or tags & BLOCKED or
                    any(sense.get(key) or row.get(key) for key in
                        ('external_source', 'copyright', 'source_license', 'attribution',
                         'ref', 'refs', 'reference', 'references', 'citation', 'citations',
                         'quote', 'quotation', 'quotations', 'attestations', 'author', 'source')) or
                    any(str(tag).lower() in {'quotation', 'quote', 'citation', 'historical-attestation'}
                        for container in (row, sense)
                        for tag in container.get('tags', []) + container.get('raw_tags', []))):
                hold('excluded-sense', wrapper, senseIndex=index); continue
            if sense_gloss(sense):
                eligible.setdefault(edition, []).append((wrapper, index, sense))
            identity_match = selected_identity == _identity(wrapper, index)
            gloss_match = bool(known_text) and normalise_gloss(known_text) == normalise_gloss(sense_gloss(sense))
            # Explicit recorded identity is authoritative; other senses cannot win.
            if selected_identity and not identity_match: continue
            if not (identity_match or gloss_match): continue
            matches.setdefault(edition, []).append((wrapper, index, sense))
            methods[edition] = 'recorded-source-sense-identity' if identity_match else 'exact-selected-gloss'
    if allow_single_sense_candidates and not selected_identity:
        for edition, options in eligible.items():
            if edition in matches: continue
            if len(options) == 1:
                matches[edition] = options
                methods[edition] = 'unique-source-sense-candidate'
            else:
                result['retrieval_counts']['ambiguous_source_sense_groups'] += 1
                hold('ambiguous-source-sense-candidates', edition=edition, count=len(options))
    for edition, options in matches.items():
        if len(options) != 1:
            hold('ambiguous-selected-sense', count=len(options), edition=edition); continue
        wrapper, index, sense = options[0]
        unverified = methods[edition] == 'unique-source-sense-candidate'
        alignment = {'method': methods[edition],
                     'status': ('selected-sense-equivalence-unverified' if unverified
                                else 'selected-sense-source-aligned'),
                     'review': 'independent-review-required'}
        result['retrieval_counts']['unique_source_sense_candidates' if unverified else 'exact_selected_senses'] += 1
        if unverified:
            hold('selected-sense-equivalence-unverified', wrapper, senseIndex=index,
                 method=methods[edition], candidateRetrieved=True)
        gloss = sense_gloss(sense)
        if not gloss or not _language_text(gloss, edition):
            hold('invalid-gloss-language', wrapper, senseIndex=index)
        elif edition != language or language == 'en':
            result['meanings'].setdefault(edition, []).append(_candidate(wrapper, index, gloss, alignment=alignment))
        for example_index, example in enumerate(sense.get('examples', [])):
            rights = sources.classify_example(example, edition, sense)
            if rights['status'] != 'candidate':
                reason = ('native-edition-rights-verification-required'
                          if rights['status'] == 'rights-verification-needed'
                          else 'quotation-or-unverified-example-rights')
                hold(reason, wrapper, exampleIndex=example_index, details=rights['reasons']); continue
            if (set(example.get('tags', [])) & BLOCKED or example.get('raw_tags')
                    or not _sentence(example.get('text'), language)):
                hold('fragment-or-language-or-usage-unverified', wrapper, exampleIndex=example_index); continue
            text = example['text']; focus = _focus(wrapper['row'], example)
            translations = sources.example_translations(example, edition)
            translation = translations['translations'].get('en')
            conflict = translations['conflict']
            if language == 'en':
                conflict = conflict or bool(translation and translation != text)
                translation = text
            known_translations = {}
            if conflict:
                hold('conflicting-example-translation', wrapper, exampleIndex=example_index)
            elif translation and _sentence(translation, 'en'):
                known_translations['en'] = _candidate(wrapper, index, translation, alignment=alignment,
                    source_text=text, source_example_index=example_index)
            if focus:
                phonetic = {}
                if language == 'zh' and 'Pinyin' in example.get('tags', []) and example.get('roman'):
                    phonetic['pinyin'] = example['roman']
                result['native_examples'].append(_candidate(wrapper, index, text, alignment=alignment, focus=focus,
                    source_example_index=example_index, known_translations=known_translations, **phonetic))
            else: hold('unverified-focus', wrapper, exampleIndex=example_index)
            if not known_translations: continue
            for existing_index, existing in enumerate(evidence.get('examples', [])):
                if existing.get('text') != text: continue
                candidate = _candidate(wrapper, index, translation, alignment=alignment, source_text=text,
                    source_example_digest=digest(existing), source_example_index=example_index)
                result['example_translations'].setdefault(str(existing_index), {}).setdefault('en', []).append(candidate)
    if not matches: hold('no-exact-selected-sense')
    return result


if __name__ == '__main__':
    import sys
    payload = json.load(sys.stdin)
    json.dump(match_wiktionary(payload['entry'], payload['evidence'], payload['rows'],
                             payload.get('studyLanguage'),
                             allow_single_sense_candidates=payload.get('allow_single_sense_candidates', False)),
              sys.stdout, ensure_ascii=False)
    print()
