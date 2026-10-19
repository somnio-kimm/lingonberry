"""Audit or import Wiktionary candidates into missing queue fields, without inference.

The default is a read-only audit. --apply fills pending jobs as unreviewed drafts;
existing results and entry evidence remain unchanged. Source matching is conservative.
"""
from __future__ import annotations
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import sys


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

sources = load_module('reuse_wiktionary_sources', 'wiktionary-sources.py')
matcher = load_module('reuse_wiktionary_match', 'match-wiktionary.py')
queue = load_module('reuse_wiktionary_queue', 'prepare-gpu-jobs.py')
EXCLUSIONS = Path(__file__).resolve().parents[2] / 'language-packages/sources/wiktionary-review-exclusions.json'


def choose_candidate(candidates, task):
    """Different definitions/translations need review; same-sense examples may vary."""
    if not candidates:
        return None
    if task != 'native_example' and len({c['text'] for c in candidates}) != 1:
        return None
    return candidates[0]


def candidates_for_job(matches, job):
    if job['task'] == 'native_example':
        return matches['native_examples']
    if job['task'] == 'meaning':
        return matches['meanings'].get(job['locale'], [])
    return matches['example_translations'].get(str(job['example_index']), {}).get(job['locale'], [])


def iter_entries(conn, batch_size=256):
    """Release each read cursor before writes so SQLite can checkpoint its WAL."""
    after = None
    while True:
        if after is None:
            rows = conn.execute('SELECT * FROM entries ORDER BY study_language,entry_id LIMIT ?', (batch_size,)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM entries WHERE (study_language,entry_id)>(?,?) ORDER BY study_language,entry_id LIMIT ?', (*after, batch_size)).fetchall()
        if not rows:
            return
        after = (rows[-1]['study_language'], rows[-1]['entry_id'])
        yield from rows


def audit_reuse(queue_path, catalog_path, report_path, *, apply=False, include_single_sense_candidates=False):
    if Path(report_path).resolve() in {Path(queue_path).resolve(), Path(catalog_path).resolve()}:
        raise ValueError('Report must not replace the queue or source catalogue')
    reader = sources.open_readonly(queue_path)
    catalog = sources.open_readonly(catalog_path)
    writer = queue.open_queue(queue_path) if apply else None
    counts = {lang: Counter() for lang in queue.LANGUAGES}
    holds = Counter()
    exclusions = json.loads(EXCLUSIONS.read_text(encoding='utf-8'))
    if exclusions.get('schemaVersion') != 1:
        raise ValueError('Unsupported source review exclusions')
    excluded = {}
    for decision in exclusions['exclusions']:
        key = (decision['studyLanguage'], decision['entryId'], decision['entryDigest'])
        excluded.setdefault(key, []).append(decision['sourceIdentity'])
    # Snapshot the old result digests. All old result IDs must survive unchanged.
    previous = dict(reader.execute('SELECT job_id,output_digest FROM results'))
    entry_count = reader.execute('SELECT count(*) FROM entries').fetchone()[0]
    report = {'schemaVersion': 1, 'createdAt': queue.now(), 'applied': apply,
              'modelGenerationStarted': False, 'entries': entry_count,
              'existingResults': len(previous), 'catalog': str(Path(catalog_path).resolve()),
              'singleSenseCandidateRetrieval': include_single_sense_candidates,
              'sourceReviewExclusionsDigest': queue.digest(exclusions),
              'draftsRequireIndependentReview': True, 'languages': counts}
    try:
        for number, row in enumerate(iter_entries(reader), 1):
            lang, entry_id = row['study_language'], row['entry_id']
            entry, evidence = json.loads(row['entry_json']), json.loads(row['evidence_json'])
            evidence = {**evidence, 'wiktionaryExcludedSenses': excluded.get((lang, entry_id, row['entry_digest']), [])}
            wrappers = sources.find_rows(catalog, lang, entry['word'])
            counts[lang]['entriesAudited'] += 1
            counts[lang]['entriesWithSourceRows'] += bool(wrappers)
            matches = matcher.match_wiktionary(entry, evidence, wrappers, lang,
                allow_single_sense_candidates=include_single_sense_candidates)
            holds.update(h['reason'] for h in matches['holds'])
            # Force the entry index: the ready-language index otherwise scans
            # an entire language's pending queue once for every headword.
            pending = reader.execute("SELECT * FROM jobs INDEXED BY jobs_entry WHERE study_language=? AND entry_id=? AND status='pending' AND task!='review' ORDER BY id", (lang, entry_id)).fetchall()
            for job in pending:
                payload = json.loads(job['payload_json'])
                if payload.get('source_import_allowed') is False or payload.get('revision_request'):
                    counts[lang]['editorialRepairPreserved'] += 1
                    continue
                candidates = candidates_for_job(matches, job)
                candidate = choose_candidate(candidates, job['task'])
                if not candidate:
                    if candidates: counts[lang]['conflictingFieldCandidates'] += 1
                    continue
                if candidate.get('alignment', {}).get('method') == 'unique-source-sense-candidate' and payload.get('candidate'):
                    counts[lang]['existingSourceCandidatePreserved'] += 1
                    continue
                # Draft translations from earlier work may address a different sentence.
                if job['task'] == 'example_translation' and candidate.get('source_example_digest') != queue.digest(payload.get('source_example')):
                    counts[lang]['differentSentenceCandidates'] += 1
                    continue
                counts[lang]['reusable_' + job['task']] += 1
                counts[lang]['alignment_' + candidate.get('alignment', {}).get('method', 'exact-selected-sense')] += 1
                if writer:
                    if writer.execute('SELECT entry_digest FROM entries WHERE study_language=? AND entry_id=?',(lang, entry_id)).fetchone()[0] != row['entry_digest']:
                        raise ValueError('Entry changed during source audit')
                    with queue.transaction(writer):
                        replacement = queue.import_source_candidate(writer, job['id'], candidate)
                        if job['task'] == 'native_example':
                            import_native_translations(writer, replacement, candidate, counts[lang])
                    counts[lang]['imported_' + job['task']] += 1
            if number % 5000 == 0:
                print(json.dumps({'entriesAudited': number, 'totalEntries': entry_count}), flush=True)
        if writer:
            for old_id, old_digest in previous.items():
                current = writer.execute('SELECT output_digest FROM results WHERE job_id=?', (old_id,)).fetchone()
                if not current or current[0] != old_digest:
                    raise RuntimeError('Existing result changed during import')
            report['existingResultsPreserved'] = True
            report['resultsAfter'] = writer.execute('SELECT count(*) FROM results').fetchone()[0]
        current = writer or reader
        report['pendingFieldsAfter'] = {r[0]: r[1] for r in current.execute("SELECT task,count(*) FROM jobs WHERE status='pending' AND task!='review' GROUP BY task")}
        report['holdReasons'] = dict(holds)
        report['languages'] = {k: dict(v) for k, v in counts.items()}
        report['note'] = 'Candidate counts are not approved or published coverage. Held senses and rights need review. Pending fields still include existing licensed NIKL candidates.'
        target = Path(report_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        temporary.replace(target)
        return report
    finally:
        reader.close()
        catalog.close()
        if writer: writer.close()


def import_native_translations(conn, native_job_id, native_candidate, counts):
    """Bind source translations to the exact newly saved native sentence output."""
    for locale, candidate in native_candidate.get('known_translations', {}).items():
        rows = conn.execute("SELECT j.* FROM jobs j JOIN dependencies d ON d.job_id=j.id WHERE d.depends_on=? AND j.task='example_translation' AND j.locale=? AND j.status='pending'", (native_job_id, locale)).fetchall()
        for row in rows:
            payload = json.loads(row['payload_json'])
            if candidate.get('source_text') != native_candidate['text'] or payload['text'] != native_candidate['text']:
                raise ValueError('Source translation belongs to a different native sentence')
            bound = dict(candidate, source_text=payload['text'], source_example_digest=queue.digest(payload['source_example']))
            bound.pop('source_digest', None)
            bound['source_digest'] = queue.digest(bound)
            queue.import_source_candidate(conn, row['id'], bound)
            counts['imported_example_translation'] += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--include-single-sense-candidates', action='store_true',
        help='Retrieve uniquely eligible source senses as unapproved drafts; semantic equivalence still needs review')
    args = parser.parse_args()
    print(json.dumps(audit_reuse(args.queue, args.catalog, args.report, apply=args.apply,
        include_single_sense_candidates=args.include_single_sense_candidates), ensure_ascii=False))


if __name__ == '__main__':
    main()
