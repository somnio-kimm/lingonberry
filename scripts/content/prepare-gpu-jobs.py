"""Build and operate the complete local content draft queue using SQLite only.

Existing catalogue/editorial text is evidence, not newly certified content. Generated
outputs stay drafts until a separate, digest-bound review. Nothing publishes packages.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
import sqlite3
from typing import Any
from urllib.parse import urlsplit
import uuid

LANGUAGES = ('de', 'en', 'es', 'fr', 'ja', 'ko', 'zh')
GENERATION_REVISION = 'local-field-content-v1'
ACTIVE_STATUSES = ('pending', 'running', 'draft', 'checked', 'failed', 'rejected')
TASKS = ('native_example', 'meaning', 'example_translation', 'review')


def encoded(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(value: Any) -> str:
    return hashlib.sha256(encoded(value).encode('utf-8')).hexdigest()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def locales(language: str) -> tuple[str, ...]:
    if language not in LANGUAGES:
        raise ValueError('Unknown study language: ' + language)
    return tuple(locale for locale in LANGUAGES if locale != language or language == 'en')


def has_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


@dataclass(frozen=True)
class Job:
    id: int
    study_language: str
    entry_id: str
    task: str
    locale: str
    example_index: int
    input_hash: str
    payload: dict[str, Any]
    status: str
    claim_token: str | None
    attempts: int


def open_queue(path: str | Path) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=60, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=60000')
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries(
      study_language TEXT NOT NULL, entry_id TEXT NOT NULL, entry_digest TEXT NOT NULL,
      entry_json TEXT NOT NULL, evidence_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(study_language,entry_id));
    CREATE TABLE IF NOT EXISTS jobs(
      id INTEGER PRIMARY KEY, study_language TEXT NOT NULL, entry_id TEXT NOT NULL,
      task TEXT NOT NULL CHECK(task IN ('native_example','meaning','example_translation','review')),
      locale TEXT NOT NULL, example_index INTEGER NOT NULL DEFAULT -1,
      logical_key TEXT NOT NULL, entry_digest TEXT NOT NULL, source_digest TEXT NOT NULL,
      input_hash TEXT NOT NULL, payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','running','draft','checked','failed','rejected','superseded')),
      attempts INTEGER NOT NULL DEFAULT 0, claimed_by TEXT, claim_token TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT,
      UNIQUE(study_language,entry_id,task,locale,input_hash),
      FOREIGN KEY(study_language,entry_id) REFERENCES entries(study_language,entry_id));
    CREATE INDEX IF NOT EXISTS jobs_claim ON jobs(status,task,locale,id);
    CREATE INDEX IF NOT EXISTS jobs_entry ON jobs(study_language,entry_id,logical_key,status);
    CREATE INDEX IF NOT EXISTS jobs_ready_order ON jobs(id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_kind ON jobs(task,id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_locale ON jobs(locale,id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_language ON jobs(study_language,id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_language_kind ON jobs(study_language,task,id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_language_locale ON jobs(study_language,locale,id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS jobs_ready_language_kind_locale ON jobs(study_language,task,locale,id) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS dependencies(
      job_id INTEGER NOT NULL REFERENCES jobs(id), depends_on INTEGER NOT NULL REFERENCES jobs(id),
      PRIMARY KEY(job_id,depends_on), CHECK(job_id != depends_on));
    CREATE INDEX IF NOT EXISTS dependency_parent ON dependencies(depends_on);
    CREATE TABLE IF NOT EXISTS results(
      job_id INTEGER PRIMARY KEY REFERENCES jobs(id), output_json TEXT NOT NULL,
      output_digest TEXT NOT NULL, producer_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews(
      review_job_id INTEGER PRIMARY KEY REFERENCES jobs(id), target_job_id INTEGER NOT NULL REFERENCES jobs(id),
      candidate_digest TEXT NOT NULL, verdict TEXT NOT NULL, evidence_json TEXT NOT NULL,
      reviewer_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_queue(
      job_id INTEGER PRIMARY KEY REFERENCES jobs(id), reason TEXT NOT NULL,
      detail_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY, job_id INTEGER REFERENCES jobs(id), event TEXT NOT NULL,
      detail_json TEXT NOT NULL, created_at TEXT NOT NULL);
    ''')
    version = conn.execute("SELECT value_json FROM metadata WHERE key='schema_version'").fetchone()
    if version and json.loads(version[0]) != 1:
        raise ValueError('Unsupported queue schema version')
    conn.execute("INSERT OR IGNORE INTO metadata VALUES('schema_version','1')")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection):
    nested = conn.in_transaction
    if not nested:
        conn.execute('BEGIN IMMEDIATE')
    try:
        yield
        if not nested:
            conn.commit()
    except BaseException:
        if not nested:
            conn.rollback()
        raise


def event(conn, job_id, name, detail):
    conn.execute('INSERT INTO events(job_id,event,detail_json,created_at) VALUES(?,?,?,?)',
                 (job_id, name, encoded(detail), now()))


def _job(row) -> Job:
    return Job(row['id'], row['study_language'], row['entry_id'], row['task'], row['locale'],
               row['example_index'], row['input_hash'], json.loads(row['payload_json']),
               row['status'], row['claim_token'], row['attempts'])


def get_job(conn, job_id: int) -> Job:
    row = conn.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
    if not row:
        raise ValueError('Unknown job')
    return _job(row)


def _invalidate(conn, job_id, reason):
    rows = conn.execute('''WITH RECURSIVE affected(id) AS (
      SELECT ? UNION SELECT d.job_id FROM dependencies d JOIN affected a ON d.depends_on=a.id)
      SELECT id FROM affected''', (job_id,)).fetchall()
    for row in rows:
        conn.execute("UPDATE jobs SET status='superseded',claimed_by=NULL,claim_token=NULL,updated_at=?,error=? WHERE id=?",
                     (now(), reason, row[0]))
        event(conn, row[0], 'superseded', {'reason': reason})


def enqueue_job(conn, language: str, entry_id: str, task: str, locale: str,
                payload: dict, *, example_index=-1, dependencies=(), logical_key=None) -> int:
    if task not in TASKS or language not in LANGUAGES or locale not in LANGUAGES:
        raise ValueError('Unknown task or language')
    if task in ('meaning', 'example_translation') and locale not in locales(language):
        raise ValueError('Disallowed explanation pair')
    entry = conn.execute('SELECT entry_digest FROM entries WHERE study_language=? AND entry_id=?',
                         (language, entry_id)).fetchone()
    if not entry:
        raise ValueError('Unknown stable entry ID')
    logical_key = logical_key or f'{task}:{locale}:{example_index}'
    body = dict(payload, task=task, entryId=entry_id, studyLanguage=language,
                source_language=payload.get('source_language', language), target_language=locale,
                example_index=example_index, entry_digest=entry[0], dependency_job_ids=sorted(dependencies))
    input_hash = digest(body)
    with transaction(conn):
        existing = conn.execute('SELECT id FROM jobs WHERE study_language=? AND entry_id=? AND task=? AND locale=? AND input_hash=?',
                                (language, entry_id, task, locale, input_hash)).fetchone()
        if existing:
            return existing[0]  # Completed, rejected and superseded work never reruns implicitly.
        old = conn.execute("SELECT id FROM jobs WHERE study_language=? AND entry_id=? AND logical_key=? AND status!='superseded'",
                           (language, entry_id, logical_key)).fetchall()
        for row in old:
            _invalidate(conn, row[0], 'Replaced by a different input digest')
        stamp = now()
        cursor = conn.execute('''INSERT INTO jobs(study_language,entry_id,task,locale,example_index,logical_key,
          entry_digest,source_digest,input_hash,payload_json,status,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)''',
          (language,entry_id,task,locale,example_index,logical_key,entry[0],body.get('source_digest',''),input_hash,encoded(body),stamp,stamp))
        job_id = cursor.lastrowid
        for parent in dependencies:
            parent_row = conn.execute('SELECT study_language,entry_id,status FROM jobs WHERE id=?', (parent,)).fetchone()
            if not parent_row or tuple(parent_row[:2]) != (language, entry_id) or parent_row['status'] in ('rejected','superseded'):
                raise ValueError('Invalid or stale dependency')
            conn.execute('INSERT INTO dependencies VALUES(?,?)', (job_id,parent))
        return job_id


def _ready_query(kind=None, locale=None, study_language=None):
    if kind is not None and kind not in TASKS:raise ValueError('Unknown task kind')
    if locale is not None and locale not in LANGUAGES:raise ValueError('Unknown explanation locale')
    if study_language is not None and study_language not in LANGUAGES:raise ValueError('Unknown study language')
    filters=[];values=[];parts=[]
    for name,value,part in [('study_language',study_language,'language'),('task',kind,'kind'),('locale',locale,'locale')]:
        if value is not None:filters.append(f'j.{name}=?');values.append(value);parts.append(part)
    # Each index preserves ID order for exactly the supplied filters. This avoids
    # sorting the entire pending queue merely to claim a small batch.
    index='jobs_claim' if parts==['kind','locale'] else 'jobs_ready_'+('_'.join(parts) if parts else 'order')
    clauses=["j.status='pending'",*filters,
             "NOT EXISTS (SELECT 1 FROM dependencies d JOIN jobs p ON p.id=d.depends_on WHERE d.job_id=j.id AND p.status NOT IN ('draft','checked'))"]
    return 'SELECT j.id FROM jobs j INDEXED BY '+index+' WHERE '+' AND '.join(clauses)+' ORDER BY j.id LIMIT ?',values


def _build_ready(conn):
    build=conn.execute("SELECT value_json FROM metadata WHERE key='build_state'").fetchone()
    return not build or json.loads(build[0])['status']=='ready'


def claim_jobs(conn, worker_id: str, limit=1, kind=None, locale=None, study_language=None) -> list[Job]:
    if not worker_id or not isinstance(limit,int) or not 1 <= limit <= 128:
        raise ValueError('Worker identity and bounded limit 1..128 required')
    query,values=_ready_query(kind,locale,study_language)
    with transaction(conn):
        if not _build_ready(conn):raise RuntimeError('Queue preparation is incomplete; rerun the builder before claiming work')
        rows=conn.execute(query,(*values,limit)).fetchall()
        for row in rows:
            conn.execute("UPDATE jobs SET status='running',claimed_by=?,claim_token=?,attempts=attempts+1,updated_at=?,error=NULL WHERE id=?",
                         (worker_id,uuid.uuid4().hex,now(),row[0]))
        return [get_job(conn,row[0]) for row in rows]


def dispatch_counts(conn, limit=128, kind=None, locale=None) -> dict:
    """Bounded ready-job probes for scheduling, plus exact active agent flags.

    ready is exact when ready_more is false; otherwise it is a lower bound.
    Full population counts remain available from queue_counts for periodic audits.
    """
    if not isinstance(limit,int) or not 1<=limit<=128:raise ValueError('Probe limit must be 1..128')
    _ready_query(kind,locale)  # Validate filters even when the build is incomplete.
    with transaction(conn):
        enabled=_build_ready(conn);languages={}
        for language in LANGUAGES:
            query,values=_ready_query(kind,locale,language)
            found=conn.execute(query,(*values,limit+1)).fetchall() if enabled else []
            languages[language]={'ready':min(len(found),limit),'ready_more':len(found)>limit,'agent_queue':0}
        # Start with the small flagged-job table, not the full jobs population.
        for row in conn.execute("SELECT j.study_language,count(*) n FROM agent_queue a CROSS JOIN jobs j ON j.id=a.job_id WHERE j.status!='superseded' GROUP BY j.study_language"):
            languages[row['study_language']]['agent_queue']=row['n']
        return {'claim_enabled':enabled,'limit':limit,'kind':kind,'locale':locale,'languages':languages,
                'ready_lower_bound':sum(v['ready'] for v in languages.values()),
                'ready_more':any(v['ready_more'] for v in languages.values()),
                'active_agent_queue':sum(v['agent_queue'] for v in languages.values())}


def _claimed(conn, job_id, worker_id, claim_token):
    row = conn.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
    if not row or row['status'] != 'running' or row['claimed_by'] != worker_id or row['claim_token'] != claim_token:
        raise ValueError('Stale or foreign job claim')
    return row


def _context(conn, language, entry_id):
    row = conn.execute('SELECT * FROM entries WHERE study_language=? AND entry_id=?',(language,entry_id)).fetchone()
    if not row:
        raise ValueError('Unknown entry')
    entry, evidence = json.loads(row['entry_json']), json.loads(row['evidence_json'])
    meanings = evidence['meanings']
    sense = {l:v['text'] for l,v in meanings.items()}
    return {'entry':entry,'word':entry['word'],'part_of_speech':entry['partOfSpeech'],
            'partOfSpeech':entry['partOfSpeech'],'level':entry.get('level'),
            'selectedSense':sense,'meaning_en':sense.get('en',''),'meaning_ko':sense.get('ko',''),
            'provenance':entry.get('provenance',{}),'source':entry.get('provenance',{}).get('source'),
            'evidence':{'meanings':meanings,'correction':evidence.get('correction')},
            'generation_revision':evidence['generation_revision']}


def enqueue_example_translation_jobs(conn, language, entry_id, example, *, source_job_id=None,
                                     example_index=0, known_translations=None) -> list[int]:
    if not has_text(example.get('text')):
        raise ValueError('Native sentence text required')
    if source_job_id is not None:
        parent = conn.execute('SELECT * FROM jobs WHERE id=?',(source_job_id,)).fetchone()
        result = conn.execute('SELECT output_json FROM results WHERE job_id=?',(source_job_id,)).fetchone()
        if (not parent or parent['task']!='native_example' or parent['status'] not in ('draft','checked')
            or parent['study_language']!=language or parent['entry_id']!=entry_id or not result
            or json.loads(result[0]).get('text') != example['text']):
            raise ValueError('Native draft dependency does not match the sentence')
    known_translations = known_translations or {}
    context = _context(conn,language,entry_id)
    sentence_digest = digest(example)
    ids=[]
    for target in locales(language):
        if target == language or has_text(known_translations.get(target)):
            continue  # English self-pair is exactly the native sentence, never model-generated.
        payload = dict(context, text=example['text'], focus=example.get('focus'),
                       source_language=language, source_digest=sentence_digest, source_example=example,
                       source_job_id=source_job_id, reference_translations=known_translations,
                       candidate=None)
        ids.append(enqueue_job(conn,language,entry_id,'example_translation',target,payload,
                              example_index=example_index,dependencies=(() if source_job_id is None else (source_job_id,))))
    return ids


def finish_job(conn, job_id, output: dict, *, worker_id, claim_token, producer: dict,
               enqueue_translations=True) -> list[int]:
    if not isinstance(output,dict) or producer.get('role')!='local-draft':
        raise ValueError('A draft object and caller-owned local-draft producer metadata are required')
    with transaction(conn):
        row=_claimed(conn,job_id,worker_id,claim_token)
        if row['task']=='review':
            raise ValueError('Use record_review for reviewer jobs')
        conn.execute('INSERT INTO results VALUES(?,?,?,?,?)',(job_id,encoded(output),digest(output),encoded(producer),now()))
        conn.execute("UPDATE jobs SET status='draft',claimed_by=NULL,claim_token=NULL,updated_at=? WHERE id=?",(now(),job_id))
        body=json.loads(row['payload_json'])
        review_payload=dict(body,candidate=output,candidate_digest=digest(output),target_job_id=job_id,
                            target_task=row['task'],generator=producer,source_digest=digest(output))
        # Reviewer execution retries are independent of generator execution retries.
        for key in ('runtime_retry_round','runtime_retry_of_job_id','runtime_failure_digest','last_error','feedback','previous_response'):
            review_payload.pop(key,None)
        review_id=enqueue_job(conn,row['study_language'],row['entry_id'],'review',row['locale'],review_payload,
                              example_index=row['example_index'],dependencies=(job_id,),logical_key='review:'+row['logical_key'])
        children=[review_id]
        if row['task']=='native_example' and enqueue_translations and has_text(output.get('text')):
            children += enqueue_example_translation_jobs(conn,row['study_language'],row['entry_id'],output,
                                                         source_job_id=job_id,example_index=row['example_index'])
        event(conn,job_id,'draft-produced',{'output_digest':digest(output),'producer':producer})
        return children


def source_candidate_output(job: Job) -> dict | None:
    """Validate host-bound source evidence; never take attribution from model output."""
    p = job.payload
    candidate = p.get('licensed_source_candidate')
    if candidate is None:
        return None
    if (job.task not in ('meaning', 'native_example', 'example_translation')
        or p.get('source_import_allowed') is False or p.get('revision_request')
        or not isinstance(candidate, dict) or p.get('licensed_source_candidate_digest') != digest(candidate)):
        raise ValueError('Invalid licensed source candidate binding')
    if not has_text(candidate.get('text')):
        raise ValueError('Source candidate text required')
    for key in ('source_digest', 'source_snapshot_sha256'):
        if not isinstance(candidate.get(key), str) or not re.fullmatch('[a-f0-9]{64}', candidate[key]):
            raise ValueError('Source candidate requires source and snapshot SHA-256 digests')
    provenance = candidate.get('provenance')
    if not isinstance(provenance, dict):
        raise ValueError('Source candidate provenance required')
    if not has_text(provenance.get('url')):raise ValueError('Licensed source URL required')
    url = urlsplit(provenance.get('url', ''))
    if (provenance.get('license') not in ('CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-SA-2.0-KR')
        or not has_text(provenance.get('creator')) or url.scheme != 'https' or not url.netloc
        or url.username or url.password):
        raise ValueError('Licensed source attribution required')
    output = {'text': candidate['text'], 'provenance': {**provenance, 'kind': provenance.get('kind', 'licensed-source')}}
    if output['provenance']['kind'] not in ('licensed-source', 'licensed-adaptation'):
        raise ValueError('Licensed source attribution kind required')
    if job.task == 'native_example':
        focus = candidate.get('focus')
        if not isinstance(focus, dict) or not has_text(focus.get('text')) or focus['text'] not in candidate['text']:
            raise ValueError('Native source candidate focus required')
        start = focus.get('start')
        if start is not None:
            if type(start) is not int or start < 0 or candidate['text'].encode('utf-16-le')[start*2:(start+len(focus['text'].encode('utf-16-le'))//2)*2] != focus['text'].encode('utf-16-le'):
                raise ValueError('Native source focus offset does not match text')
        elif candidate['text'].count(focus['text']) != 1:
            raise ValueError('Ambiguous native source focus requires an exact offset')
        output['focus'] = focus
        if 'pinyin' in candidate:
            if not has_text(candidate['pinyin']):raise ValueError('Invalid source pinyin')
            output['pinyin'] = candidate['pinyin']
    if job.task == 'example_translation':
        if (candidate.get('source_text') != p.get('text') or not has_text(p.get('text'))
            or candidate.get('source_example_digest') != digest(p.get('source_example'))
            or p.get('source_digest') != candidate['source_example_digest']):
            raise ValueError('Translation candidate must bind the exact native source')
    return output


def import_source_candidate(conn, job_id: int, candidate: dict) -> int:
    """Replace only pending missing work with an immutable, separately reviewed draft."""
    with transaction(conn):
        if not _build_ready(conn):raise ValueError('Queue preparation is incomplete')
        row = conn.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
        if not row:raise ValueError('Unknown job')
        original = _job(row)
        if digest(original.payload) != original.input_hash:
            raise ValueError('Stale job payload digest')
        entry = conn.execute('SELECT * FROM entries WHERE study_language=? AND entry_id=?',
                             (original.study_language, original.entry_id)).fetchone()
        if not entry or entry['entry_digest'] != row['entry_digest']:
            raise ValueError('Stale source candidate entry')
        body = dict(original.payload, licensed_source_candidate=json.loads(encoded(candidate)),
                    licensed_source_candidate_digest=digest(candidate), source_import_of_job_id=job_id)
        bound = Job(original.id, original.study_language, original.entry_id, original.task, original.locale,
                    original.example_index, original.input_hash, body, original.status, None, original.attempts)
        output = source_candidate_output(bound)
        if output is None:raise ValueError('Source candidate required')
        # A repeated call may recover exactly the draft it created, but cannot revive stale work.
        for previous in conn.execute('SELECT * FROM jobs WHERE study_language=? AND entry_id=? AND logical_key=?',
                                     (original.study_language, original.entry_id, row['logical_key'])):
            p = json.loads(previous['payload_json'])
            if (p.get('source_import_of_job_id') == job_id and p.get('licensed_source_candidate_digest') == digest(candidate)
                and previous['status'] in ('draft', 'checked') and previous['entry_digest'] == entry['entry_digest']):
                return previous['id']
        if row['status'] != 'pending' or original.task not in ('meaning', 'native_example', 'example_translation'):
            raise ValueError('Source imports require pending missing fields; existing work is preserved')
        evidence = json.loads(entry['evidence_json'])
        if original.task == 'meaning' and has_text(evidence.get('meanings', {}).get(original.locale, {}).get('text')):
            raise ValueError('Meaning already exists')
        examples = evidence.get('examples', [])
        example = examples[original.example_index] if 0 <= original.example_index < len(examples) else None
        if original.task == 'native_example' and example:
            raise ValueError('Native example already exists')
        if original.task == 'example_translation':
            if original.locale == original.study_language:raise ValueError('Self-pair must reuse native text')
            known = (example or {}).get('translations', {}).get(original.locale)
            if has_text(known) or isinstance(known, dict) and has_text(known.get('text')):
                raise ValueError('Translation already exists')
            source_job = original.payload.get('source_job_id')
            if source_job is None:
                if digest(example) != digest(original.payload.get('source_example')):
                    raise ValueError('Stale native source example')
            else:
                source_result = conn.execute('SELECT output_json FROM results WHERE job_id=?', (source_job,)).fetchone()
                if not source_result or digest(json.loads(source_result[0])) != digest(original.payload.get('source_example')):
                    raise ValueError('Stale native source draft')
        parents = [r[0] for r in conn.execute('SELECT depends_on FROM dependencies WHERE job_id=?', (job_id,))]
        if any(conn.execute('SELECT status FROM jobs WHERE id=?', (parent,)).fetchone()[0] not in ('draft','checked') for parent in parents):
            raise ValueError('Source import dependencies are not ready')
        replacement = enqueue_job(conn, original.study_language, original.entry_id, original.task, original.locale,
                                  body, example_index=original.example_index, dependencies=parents, logical_key=row['logical_key'])
        token = uuid.uuid4().hex
        conn.execute("UPDATE jobs SET status='running',claimed_by='source-import',claim_token=? WHERE id=?", (token, replacement))
        finish_job(conn, replacement, output, worker_id='source-import', claim_token=token,
                   producer={'role':'local-draft','method':'licensed-source-import','model':None,
                             'revision':candidate['source_snapshot_sha256'],'source_digest':candidate['source_digest'],
                             'candidate_digest':digest(candidate),'prompt_digest':None})
        return replacement


def record_review(conn, review_job_id, review: dict, *, worker_id, claim_token, producer: dict):
    if producer.get('role')!='local-review' or review.get('verdict') not in ('pass','revise','uncertain') or not isinstance(review.get('issues'),list):
        raise ValueError('Separate local-review role and explicit verdict/issues required')
    if review['verdict']=='pass' and (review['issues'] or review.get('repair')):
        raise ValueError('A passing review cannot contain unresolved issues or unreviewed replacement text')
    with transaction(conn):
        row=_claimed(conn,review_job_id,worker_id,claim_token)
        if row['task']!='review': raise ValueError('Not a review task')
        body=json.loads(row['payload_json']); target=body['target_job_id']
        result=conn.execute('SELECT * FROM results WHERE job_id=?',(target,)).fetchone()
        target_row=conn.execute('SELECT * FROM jobs WHERE id=?',(target,)).fetchone()
        if not result or target_row['status']!='draft' or result['output_digest']!=body['candidate_digest']:
            raise ValueError('Stale review candidate')
        generator=json.loads(result['producer_json'])
        if generator.get('role')==producer.get('role') or generator==producer:
            raise ValueError('Generator cannot approve its own output')
        conn.execute('INSERT INTO results VALUES(?,?,?,?,?)',(review_job_id,encoded(review),digest(review),encoded(producer),now()))
        method='source-candidate-AI-review' if generator.get('method') in ('source-import','licensed-source-import') else 'same-model-AI-review' if generator.get('model')==producer.get('model') else 'separate-model-AI-review'
        evidence={'review':review,'method':method,
                  'nativeSpeakerReview':'pending','contentDigest':result['output_digest']}
        conn.execute('INSERT INTO reviews VALUES(?,?,?,?,?,?,?)',(review_job_id,target,result['output_digest'],review['verdict'],encoded(evidence),encoded(producer),now()))
        conn.execute("UPDATE jobs SET status='checked',claimed_by=NULL,claim_token=NULL,updated_at=? WHERE id=?",(now(),review_job_id))
        status='checked' if review['verdict']=='pass' else 'rejected'
        conn.execute('UPDATE jobs SET status=?,updated_at=? WHERE id=?',(status,now(),target))
        if status=='rejected':
            for child in conn.execute('SELECT job_id FROM dependencies WHERE depends_on=? AND job_id!=?',(target,review_job_id)).fetchall():
                _invalidate(conn,child[0],'Source draft did not pass review')
        event(conn,target,'reviewed',evidence)
        return status


def _draft_content_digest(task, output):
    text=output.get('text',output.get('meaning',output.get('translation')))
    content={'text':text.strip() if isinstance(text,str) else text}
    if task=='native_example':content['focus']=output.get('focus')
    return digest(content)


def enqueue_repair(conn, target_job_id: int, review_job_id: int, feedback,
                   max_rounds=3) -> int | None:
    """Repair rejected work; three failed rounds (including original) require an agent.

    Returns the new/existing pending repair ID, or None when explicitly flagged in
    agent_queue. Suggested repairs remain untrusted context and need fresh review.
    """
    if not isinstance(max_rounds,int) or not 1<=max_rounds<=10:
        raise ValueError('max_rounds must be an integer from 1 to 10')
    with transaction(conn):
        review=conn.execute('SELECT * FROM reviews WHERE review_job_id=?',(review_job_id,)).fetchone()
        if not review or review['verdict']=='pass' or review['target_job_id']!=target_job_id:
            raise ValueError('A matching completed revise/uncertain review is required')
        target=conn.execute('SELECT * FROM jobs WHERE id=?',(target_job_id,)).fetchone()
        if target['status'] not in ('rejected','superseded'):
            raise ValueError('Target is not awaiting revision')
        current=conn.execute('SELECT entry_digest FROM entries WHERE study_language=? AND entry_id=?',(target['study_language'],target['entry_id'])).fetchone()
        if not current or current[0]!=target['entry_digest']:
            raise ValueError('Cannot repair a superseded catalogue or editorial input')
        payload=json.loads(target['payload_json'])
        result=conn.execute('SELECT output_json FROM results WHERE job_id=?',(target_job_id,)).fetchone()
        if not result:raise ValueError('Rejected draft result is missing')
        previous_draft=json.loads(result[0]);round_number=payload.get('repair_round',0)
        current_digest=_draft_content_digest(target['task'],previous_draft)
        ancestor_id=payload.get('repair_of_job_id');repeated=False;seen=set()
        while ancestor_id is not None:
            if ancestor_id in seen:raise ValueError('Repair lineage contains a cycle')
            seen.add(ancestor_id)
            ancestor=conn.execute('SELECT j.payload_json,r.output_json FROM jobs j JOIN results r ON r.job_id=j.id WHERE j.id=?',(ancestor_id,)).fetchone()
            if not ancestor:raise ValueError('Repair lineage is incomplete')
            if _draft_content_digest(target['task'],json.loads(ancestor['output_json']))==current_digest:repeated=True
            ancestor_id=json.loads(ancestor['payload_json']).get('repair_of_job_id')
        reason='repeated-draft-no-progress' if repeated else 'repair-round-limit' if round_number+1>=max_rounds else None
        evidence=json.loads(review['evidence_json'])['review']
        if reason:
            details={'review_job_id':review_job_id,'failed_rounds':round_number+1,'max_rounds':max_rounds,
                     'content_digest':current_digest,'feedback':feedback,'issues':evidence['issues']}
            conn.execute('INSERT INTO agent_queue VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET reason=excluded.reason,detail_json=excluded.detail_json',
                         (target_job_id,reason,encoded(details),now()))
            event(conn,target_job_id,'agent-review-required',details|{'reason':reason})
            return None
        payload.update(repair_round=round_number+1,repair_of_job_id=target_job_id,
                       previous_draft=previous_draft,candidate=None,source_import_allowed=False,
                       revision_request={'review_job_id':review_job_id,'issues':evidence['issues'],
                                         'feedback':feedback,'proposed_repair':evidence.get('repair'),
                                         'previous_candidate_digest':review['candidate_digest']})
        parents=[r[0] for r in conn.execute('SELECT depends_on FROM dependencies WHERE job_id=?',(target_job_id,))]
        return enqueue_job(conn,target['study_language'],target['entry_id'],target['task'],target['locale'],payload,
                           example_index=target['example_index'],dependencies=parents,logical_key=target['logical_key'])


def enqueue_repair_job(conn, review_job_id: int) -> int | None:
    """Convenience form using the recorded review as feedback."""
    row=conn.execute('SELECT target_job_id,evidence_json FROM reviews WHERE review_job_id=?',(review_job_id,)).fetchone()
    if not row:raise ValueError('Unknown review')
    return enqueue_repair(conn,row['target_job_id'],review_job_id,json.loads(row['evidence_json'])['review'])


def fail_job(conn, job_id, error: str, *, worker_id, claim_token, response=None):
    """Retain an execution/parser failure and optional raw response for explicit retry."""
    with transaction(conn):
        _claimed(conn,job_id,worker_id,claim_token)
        conn.execute("UPDATE jobs SET status='failed',error=?,claimed_by=NULL,claim_token=NULL,updated_at=? WHERE id=?",(str(error),now(),job_id))
        detail={'error':str(error)}
        if response is not None:detail['response']=response
        event(conn,job_id,'failed',detail)


def retry_failed_job(conn, job_id: int, feedback, max_rounds=3) -> int | None:
    """Retry an execution failure, preserving any review candidate binding.

    Returns a new/existing job ID, or None for agent intervention after three
    failed rounds (including the original) or a repeated identical response/error.
    """
    if not isinstance(max_rounds,int) or not 1<=max_rounds<=10:
        raise ValueError('max_rounds must be an integer from 1 to 10')
    with transaction(conn):
        job=conn.execute('SELECT * FROM jobs WHERE id=?',(job_id,)).fetchone()
        if not job or job['status'] not in ('failed','superseded'):
            raise ValueError('An execution-failed job is required')
        failure=conn.execute("SELECT detail_json FROM events WHERE job_id=? AND event='failed' ORDER BY id DESC LIMIT 1",(job_id,)).fetchone()
        if not failure:raise ValueError('Execution failure evidence is missing')
        current=conn.execute('SELECT entry_digest FROM entries WHERE study_language=? AND entry_id=?',(job['study_language'],job['entry_id'])).fetchone()
        if not current or current[0]!=job['entry_digest']:
            raise ValueError('Cannot retry superseded catalogue or editorial evidence')
        payload=json.loads(job['payload_json']);failure=json.loads(failure[0])
        last_error=failure['error'];previous_response=failure.get('response')
        if previous_response is None and isinstance(feedback,dict):
            previous_response=feedback.get('previous_response',feedback.get('response'))
        signature={'error':last_error.strip()} if previous_response is None else {'response':previous_response.strip() if isinstance(previous_response,str) else previous_response}
        failure_digest=digest(signature);round_number=payload.get('runtime_retry_round',0)
        if not isinstance(round_number,int) or round_number<0:raise ValueError('Invalid runtime retry round')
        parents=[r[0] for r in conn.execute('SELECT depends_on FROM dependencies WHERE job_id=?',(job_id,))]
        if job['task']=='review':
            target=conn.execute('SELECT j.status,r.output_digest FROM jobs j JOIN results r ON r.job_id=j.id WHERE j.id=?',(payload.get('target_job_id'),)).fetchone()
            if (not target or target['status']!='draft' or target['output_digest']!=payload.get('candidate_digest')
                or digest(payload.get('candidate'))!=target['output_digest'] or parents!=[payload.get('target_job_id')]):
                raise ValueError('Cannot retry a stale or unbound review candidate')
        repeated=False;cursor=payload;seen=set()
        while cursor.get('runtime_retry_of_job_id') is not None:
            ancestor_id=cursor['runtime_retry_of_job_id']
            if ancestor_id in seen:raise ValueError('Runtime retry lineage contains a cycle')
            seen.add(ancestor_id)
            if cursor.get('runtime_failure_digest')==failure_digest:repeated=True
            ancestor=conn.execute('SELECT payload_json FROM jobs WHERE id=?',(ancestor_id,)).fetchone()
            if not ancestor:raise ValueError('Runtime retry lineage is incomplete')
            cursor=json.loads(ancestor[0])
        reason='repeated-runtime-failure' if repeated else 'runtime-retry-round-limit' if round_number+1>=max_rounds else None
        detail={'failed_rounds':round_number+1,'max_rounds':max_rounds,'failure_digest':failure_digest,
                'last_error':last_error,'feedback':feedback,'previous_response':previous_response}
        if reason:
            conn.execute('INSERT INTO agent_queue VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET reason=excluded.reason,detail_json=excluded.detail_json',
                         (job_id,reason,encoded(detail),now()))
            event(conn,job_id,'agent-review-required',detail|{'reason':reason})
            return None
        payload.update(runtime_retry_round=round_number+1,runtime_retry_of_job_id=job_id,
                       runtime_failure_digest=failure_digest,last_error=last_error,feedback=feedback,
                       previous_response=previous_response,source_import_allowed=False)
        if job['task']!='review':payload['candidate']=None
        new_id=enqueue_job(conn,job['study_language'],job['entry_id'],job['task'],job['locale'],payload,
                           example_index=job['example_index'],dependencies=parents,logical_key=job['logical_key'])
        event(conn,job_id,'runtime-retry-requested',detail|{'new_job_id':new_id,'runtime_retry_round':round_number+1})
        return new_id


def recover_running_jobs(conn, *, worker_id=None, all_workers=False) -> int:
    if (not worker_id and not all_workers) or (worker_id and all_workers):
        raise ValueError('Choose an explicit worker or all_workers=True')
    with transaction(conn):
        rows=conn.execute("SELECT id FROM jobs WHERE status='running'"+(' AND claimed_by=?' if worker_id else ''),
                          (worker_id,) if worker_id else ()).fetchall()
        for row in rows:
            conn.execute("UPDATE jobs SET status='pending',claimed_by=NULL,claim_token=NULL,updated_at=?,error=NULL WHERE id=?",(now(),row[0]))
            event(conn,row[0],'interrupted-claim-recovered',{'worker_id':worker_id,'all_workers':all_workers})
        return len(rows)


def _checked_results(conn, language, entry_id) -> list[dict]:
    """Only expose reviewed drafts whose complete source dependency chain is checked."""
    rows=conn.execute("SELECT j.*,r.output_json,r.output_digest,r.producer_json FROM jobs j JOIN results r ON r.job_id=j.id WHERE j.study_language=? AND j.entry_id=? AND j.status='checked' AND j.task!='review' AND j.entry_digest=(SELECT entry_digest FROM entries WHERE study_language=j.study_language AND entry_id=j.entry_id) ORDER BY j.id",(language,entry_id)).fetchall()
    safe=[]
    for row in rows:
        blocked=conn.execute('''WITH RECURSIVE parents(id) AS (
          SELECT depends_on FROM dependencies WHERE job_id=? UNION
          SELECT d.depends_on FROM dependencies d JOIN parents p ON d.job_id=p.id)
          SELECT 1 FROM parents JOIN jobs ON jobs.id=parents.id WHERE jobs.status!='checked' LIMIT 1''',(row['id'],)).fetchone()
        review=conn.execute("SELECT evidence_json,reviewer_json FROM reviews WHERE target_job_id=? AND candidate_digest=? AND verdict='pass'",(row['id'],row['output_digest'])).fetchone()
        if not blocked and review:
            job=_job(row)
            canonical={'payloadJson':row['payload_json'],'outputJson':row['output_json']}
            if 'source_example' in job.payload:canonical['sourceExampleJson']=encoded(job.payload['source_example'])
            safe.append({'job':job,'output':json.loads(row['output_json']),'output_digest':row['output_digest'],'producer':json.loads(row['producer_json']),'review':json.loads(review['evidence_json']),'reviewer':json.loads(review['reviewer_json']),**canonical})
    return safe


def checked_results(conn, language, entry_id) -> list[dict]:
    with transaction(conn):
        return _checked_results(conn, language, entry_id)


def export_entry_evidence(conn, language, entry_id) -> dict:
    """JSON-safe inputs for an assembler; never a whole-entry review certificate."""
    requested=locales(language)
    with transaction(conn):
        row=conn.execute('SELECT * FROM entries WHERE study_language=? AND entry_id=?',(language,entry_id)).fetchone()
        if not row:raise ValueError('Unknown stable entry ID')
        entry=json.loads(row['entry_json']);evidence=json.loads(row['evidence_json'])
        results=_checked_results(conn,language,entry_id)
        meanings={l for l,v in evidence['meanings'].items() if has_text(v.get('text'))}
        examples={i:{'text':e['text'],'translations':{l for l,v in e.get('translations',{}).items() if has_text(v)}}
                  for i,e in enumerate(evidence['examples']) if has_text(e.get('text'))}
        for result in results:
            job=result['job'];output=result['output'];text=output.get('text',output.get('meaning',output.get('translation')))
            if not has_text(text):continue
            if job.task=='meaning':meanings.add(job.locale)
            elif job.task=='native_example':examples[job.example_index]={'text':text,'translations':set()}
            elif job.task=='example_translation' and job.example_index in examples:
                examples[job.example_index]['translations'].add(job.locale)
        if language=='en':
            for example in examples.values():example['translations'].add('en')
        missing_meanings=[l for l in requested if l not in meanings]
        missing_translations=[{'exampleIndex':i,'locale':l} for i,e in sorted(examples.items()) for l in requested if l not in e['translations']]
        flagged=[dict(r) for r in conn.execute("SELECT a.job_id,a.reason FROM agent_queue a JOIN jobs j ON j.id=a.job_id WHERE j.study_language=? AND j.entry_id=? AND j.status!='superseded' ORDER BY a.job_id",(language,entry_id))]
        complete=bool(examples) and not missing_meanings and not missing_translations
        return {'schemaVersion':1,'studyLanguage':language,'id':entry_id,'entryDigest':row['entry_digest'],
                'entry':entry,'evidence':evidence,'entryJson':row['entry_json'],'evidenceJson':row['evidence_json'],
                'checkedResults':[{**result,'job':asdict(result['job'])} for result in results],
                'coverage':{'fieldCoverageComplete':complete,'readyForEntryReview':complete and not flagged,
                            'missingNativeExample':not bool(examples),'missingMeanings':missing_meanings,
                            'missingExampleTranslations':missing_translations,'agentQueue':flagged},
                'validation':{'assembledStructuralCheckRequired':True,'wholeEntryReviewRequired':True,
                              'nativeSpeakerReview':'pending'}}


def queue_counts(conn) -> dict:
    with transaction(conn):
        return _queue_counts(conn)


def _queue_counts(conn) -> dict:
    counts={'entries':conn.execute('SELECT count(*) FROM entries').fetchone()[0], 'jobs':{}, 'by_language':{}, 'total_jobs':0, 'agent_queue':conn.execute('SELECT count(*) FROM agent_queue').fetchone()[0]}
    for row in conn.execute('SELECT task,status,count(*) n FROM jobs GROUP BY task,status'):
        counts['jobs'].setdefault(row['task'],{})[row['status']]=row['n'];counts['total_jobs']+=row['n']
    for row in conn.execute('SELECT study_language,count(*) n FROM entries GROUP BY study_language'):
        counts['by_language'][row['study_language']]={'entries':row['n']}
    for row in conn.execute("SELECT study_language,task,count(*) n FROM jobs WHERE status!='superseded' GROUP BY study_language,task"):
        counts['by_language'][row['study_language']][row['task']]=row['n']
    baseline=conn.execute("SELECT value_json FROM metadata WHERE key='coverage'").fetchone()
    if baseline:counts['coverage']=json.loads(baseline[0])
    build=conn.execute("SELECT value_json FROM metadata WHERE key='build_state'").fetchone()
    if build:counts['build_state']=json.loads(build[0])
    return counts


def _read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def _indexed(rows,label):
    result={}
    for row in rows:
        if row['id'] in result:raise ValueError(f'Duplicate {label}: {row["id"]}')
        result[row['id']]=row
    return result


def _sidecar(path):
    return _indexed((json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()),str(path)) if path.exists() else {}


def _meaning(locale,record,correction,installed):
    corrected=correction.get('meanings',{}).get(locale) or correction.get({'en':'meaningEn','ko':'meaningKo'}.get(locale,''))
    if has_text(corrected):return {'text':corrected,'provenance':correction.get('meaningProvenance',{}).get(locale,correction.get('provenance',{})),'origin':'editorial-correction'}
    if not correction and has_text(installed.get('meaning')):return {'text':installed['meaning'],'provenance':installed.get('provenance',{}),'origin':'installed-edition'}
    authored=record.get('meanings',{}).get(locale) or (record.get('meaningDe') if not correction and locale=='de' else None)
    if has_text(authored):return {'text':authored,'provenance':record.get('meaningProvenance',{}).get(locale,record.get('provenance',{})),'origin':'authored-gloss'}
    return None


def _prepare_queue(conn, repo: str | Path, *, generation_revision=GENERATION_REVISION, source_senses_path=None) -> dict:
    repo=Path(repo).resolve();base=repo/'language-packages';catalog=_read_json(base/'catalog.json')
    source_senses_path=Path(source_senses_path) if source_senses_path else repo.parent/'sources/nikl-senses.json'
    source_senses={};source_snapshot_hash=None
    if source_senses_path.exists():
        raw=source_senses_path.read_bytes();source_snapshot_hash=hashlib.sha256(raw).hexdigest()
        source_senses={(str(r['id']),str(r['sense'])):r for r in json.loads(raw)}
    studies={};pairs={}
    for item in catalog:
        url=item['url']
        if not url.startswith('/language-packages/') or '..' in Path(url).parts:raise ValueError('Catalogue package must be a local package path')
        package=_read_json(repo/url.lstrip('/'))
        if any(package.get(key)!=item.get(key) for key in ('id','version','kind','targetLanguage')):raise ValueError('Catalogue identity mismatch')
        if item['kind']=='explanation' and package.get('explanationLanguage')!=item.get('explanationLanguage'):raise ValueError('Explanation language identity mismatch')
        language=item['targetLanguage']
        if item['kind']=='study':
            if language in studies:raise ValueError('Duplicate active study package')
            studies[language]=package
        elif item['kind']=='explanation':
            key=(language,item['explanationLanguage'])
            if key in pairs:raise ValueError('Duplicate active explanation package')
            pairs[key]=_indexed(package['entries'],'explanation')
    if set(studies)!=set(LANGUAGES):raise ValueError('All seven study languages are required')
    coverage={'entries':0,'pairs':43,'missing_native_examples':0,'missing_meanings':0,
              'missing_existing_example_translations':0,'deferred_translation_fields':0,'licensed_meaning_candidates':0,'languages':{}}
    expected_ids=set()
    for language in LANGUAGES:
        core=_indexed(studies[language]['entries'],'core');authored=_sidecar(base/f'sources/examples/{language}-authored.jsonl');corrections=_sidecar(base/f'sources/examples/{language}-corrections.jsonl')
        if not set(authored).issubset(core) or not set(corrections).issubset(core):raise ValueError('Sidecar contains unknown stable IDs: '+language)
        for (study,target),pair in pairs.items():
            if study==language and set(pair)!=set(core):raise ValueError('Explanation inventory differs from core: '+study+'-'+target)
        counts={'entries':len(core),'native_examples':0,'example_slots':0,'missing_native_examples':0,'missing_meanings':0,'missing_existing_example_translations':0,'licensed_meaning_candidates':0}
        with transaction(conn):
            for entry_id,original in core.items():
                expected_ids.add((language,entry_id));record=authored.get(entry_id,{});correction=corrections.get(entry_id,{})
                entry={k:v for k,v in original.items() if k not in ('example','additionalExamples','referenceExamples')}
                for key in ('word','partOfSpeech','article','level','pronunciation','aliases'):
                    if key in correction:entry[key]=correction[key]
                if correction.get('grammar'):entry['grammar']={**entry.get('grammar',{}),**correction['grammar']}
                meanings={};native=[]
                for target in locales(language):
                    value=_meaning(target,record,correction,pairs.get((language,target),{}).get(entry_id,{}))
                    if value:meanings[target]=value
                if record:
                    if not has_text(record.get('text')):raise ValueError('Empty authored native sentence '+entry_id)
                    translations=dict(record.get('translations',{}))
                    for l in ('en','ko'):
                        if l in record:translations[l]=record[l]
                    if language=='en':translations['en']=record['text']
                    native=[{'text':record['text'],'focus':record.get('focus'),'provenance':record.get('provenance',{}),'translations':translations}]
                elif not correction:
                    for index,example in enumerate([original.get('example'),*original.get('additionalExamples',[])]):
                        if example is None:continue
                        if not has_text(example.get('text')):raise ValueError('Empty installed example '+entry_id)
                        translations={}
                        for target in locales(language):
                            old=pairs.get((language,target),{}).get(entry_id,{})
                            values=[old.get('exampleTranslation'),*old.get('additionalExampleTranslations',[])]
                            if index<len(values) and has_text(values[index]):translations[target]=values[index]
                        if language=='en':translations['en']=example['text']
                        native.append({**example,'provenance':example.get('provenance',example.get('source',{})),'translations':translations})
                evidence={'meanings':meanings,'examples':native,'authored':record,'correction':correction,
                          'original':original,'installed':{l:pairs.get((language,l),{}).get(entry_id,{}) for l in locales(language)},
                          'generation_revision':generation_revision,'sourceCandidatesAreAccepted':False}
                source=original.get('provenance',{}).get('source',{})
                source_sense=source_senses.get((str(source.get('entryId')),str(source.get('senseId')))) if not correction else None
                candidates={}
                if source_sense:
                    for target in locales(language):
                        text=source_sense.get('definition') if target=='ko' else source_sense.get('equivalents',{}).get(target,{}).get('definition')
                        if target not in meanings and has_text(text) and source.get('license') and source.get('url'):
                            candidates[target]={'text':text,'provenance':source,'source_digest':digest(source_sense),'source_snapshot_sha256':source_snapshot_hash,'accepted':False}
                evidence['meaningCandidates']=candidates
                entry_digest=digest({'entry':entry,'evidence':evidence})
                previous=conn.execute('SELECT entry_digest FROM entries WHERE study_language=? AND entry_id=?',(language,entry_id)).fetchone()
                if previous and previous[0]!=entry_digest:
                    for old in conn.execute("SELECT id FROM jobs WHERE study_language=? AND entry_id=? AND status!='superseded'",(language,entry_id)).fetchall():_invalidate(conn,old[0],'Catalogue or editorial input changed')
                if not previous or previous[0]!=entry_digest:
                    conn.execute('INSERT INTO entries VALUES(?,?,?,?,?,?) ON CONFLICT(study_language,entry_id) DO UPDATE SET entry_digest=excluded.entry_digest,entry_json=excluded.entry_json,evidence_json=excluded.evidence_json,updated_at=excluded.updated_at',
                                 (language,entry_id,entry_digest,encoded(entry),encoded(evidence),now()))
                context=_context(conn,language,entry_id)
                if native:
                    counts['native_examples']+=1;counts['example_slots']+=len(native)
                else:
                    counts['missing_native_examples']+=1
                    enqueue_job(conn,language,entry_id,'native_example',language,dict(context,text=None,candidate=None,source_digest=entry_digest),example_index=0)
                for target in locales(language):
                    if target not in meanings:
                        counts['missing_meanings']+=1
                        # Reference text may help drafting, but never fills an accepted field.
                        candidate=candidates.get(target)
                        if candidate:counts['licensed_meaning_candidates']+=1
                        enqueue_job(conn,language,entry_id,'meaning',target,dict(context,text=candidate['text'] if candidate else None,candidate=candidate,source_language=target if candidate else language,source_digest=candidate['source_digest'] if candidate else entry_digest))
                for index,example in enumerate(native):
                    missing=[l for l in locales(language) if l!=language and not has_text(example['translations'].get(l))]
                    counts['missing_existing_example_translations']+=len(missing)
                    if missing:enqueue_example_translation_jobs(conn,language,entry_id,{k:v for k,v in example.items() if k!='translations'},example_index=index,known_translations=example['translations'])
            coverage['languages'][language]=counts
        coverage['entries']+=counts['entries']
        for key in ('missing_native_examples','missing_meanings','missing_existing_example_translations','licensed_meaning_candidates'):coverage[key]+=counts[key]
    # Removed IDs must not linger as work silently outside the current catalogue.
    stored={(r[0],r[1]) for r in conn.execute('SELECT study_language,entry_id FROM entries')}
    if stored!=expected_ids:raise ValueError('Queue contains entries absent from the current catalogue; use a new queue or explicitly archive them')
    coverage['deferred_translation_fields']=coverage['missing_native_examples']*6
    with transaction(conn):
        conn.execute("INSERT INTO metadata VALUES('coverage',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",(encoded(coverage),))
        conn.execute("INSERT INTO metadata VALUES('repository',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",(encoded(str(repo)),))
    return queue_counts(conn)


def prepare_queue(conn, repo: str | Path, *, generation_revision=GENERATION_REVISION, source_senses_path=None) -> dict:
    def state(status, **extra):
        with transaction(conn):
            conn.execute("INSERT INTO metadata VALUES('build_state',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",
                         (encoded({'status':status,'updated_at':now(),**extra}),))
    state('building')
    try:
        _prepare_queue(conn,repo,generation_revision=generation_revision,source_senses_path=source_senses_path)
    except BaseException as error:
        state('incomplete',error=str(error))
        raise
    state('ready')
    return queue_counts(conn)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2])
    parser.add_argument('--db',type=Path,required=True,help='Persistent SQLite path outside Git')
    parser.add_argument('--generation-revision',default=GENERATION_REVISION)
    parser.add_argument('--counts-only',action='store_true')
    parser.add_argument('--source-senses',type=Path,help='Optional licensed NIKL sense cache; candidates stay unaccepted')
    parser.add_argument('--recover-worker')
    parser.add_argument('--recover-all-running',action='store_true')
    args=parser.parse_args()
    repo=args.repo.resolve();db=args.db.resolve()
    if db.is_relative_to(repo):parser.error('Queue database must be outside the Git workspace')
    conn=open_queue(db)
    if args.recover_worker or args.recover_all_running:
        recovered=recover_running_jobs(conn,worker_id=args.recover_worker,all_workers=args.recover_all_running)
        print(encoded({'recovered_running_jobs':recovered}))
    report=queue_counts(conn) if args.counts_only else prepare_queue(conn,repo,generation_revision=args.generation_revision,source_senses_path=args.source_senses)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    conn.close()


if __name__=='__main__':main()
