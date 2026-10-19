# Local GPU content queue

The queue covers every entry in the seven active study packages and all 43 permitted explanation pairs. It preserves current catalogue and editorial text, corrections, source attribution and licences. Source candidates and generated results are drafts, never automatically accepted content. This tool does not build or publish language packages.

Run from the repository with Python 3.10 or newer:

```sh
python3 scripts/content/prepare-gpu-jobs.py --db local-data/generation/content.sqlite
python3 scripts/content/prepare-gpu-jobs.py --db local-data/generation/content.sqlite --counts-only
```

The database must live outside the Git workspace. The initial build is complete when the builder exits successfully and saves `metadata.coverage` with `metadata.build_state.status` set to `ready`. The claim API refuses an incomplete/building queue. A worker should wait for that result before consuming an initial queue. Repeating the build with unchanged inputs preserves job IDs, completed results and active claims. No row limit or sampling option is applied. An interrupted build can be rerun; it commits complete language inventories transactionally. The builder rejects duplicate IDs, mismatched package inventories and unknown sidecar IDs instead of silently skipping them.

`--source-senses PATH` optionally selects a licensed NIKL cache. By default, the builder uses `../sources/nikl-senses.json` if present. Matching definitions become `candidate` evidence, with original source attribution, per-sense digest and whole-cache SHA-256. They do not count as existing meanings. The worker may store a candidate as a source-import draft and ask the reviewer to check it; that saves generation work without bypassing review. Corrected entries never inherit candidates from their old source sense.

## Worker API

The [Wiktionary source pass](wiktionary-source-reuse.md) can supplement an existing
queue without rebuilding entry evidence or invalidating unrelated saved drafts.

Load `scripts/content/prepare-gpu-jobs.py` using `importlib.util`; register the module in `sys.modules` before `exec_module` because it contains a dataclass. Each process opens its own connection with `open_queue(path)`.

- `prepare_queue(conn, repo, generation_revision=..., source_senses_path=None)` builds the full queue and returns counts.
- `claim_jobs(conn, worker_id, limit=1, kind=None, locale=None, study_language=None)` atomically claims 1–128 jobs. It returns `Job` objects with `id`, `task`, `locale`, `entry_id`, `study_language`, `example_index`, `input_hash`, `payload`, `claim_token` and `attempts`.
- `finish_job(conn, job_id, output, worker_id=..., claim_token=..., producer=...)` records a draft and returns newly required review/translation job IDs. Generated native examples immediately produce translation jobs, even before review, but every child depends on the exact source job and sentence digest.
- `import_source_candidate(conn, job_id, candidate)` replaces a pending missing field with an immutable licensed-source draft. It preserves existing results, binds the source and snapshot digests, requires exact native-text binding for translations, and queues separate review. Native imports also create dependent translation jobs. Use a surrounding transaction when importing a native sentence and its known source translations together.
- `record_review(conn, review_job_id, review, worker_id=..., claim_token=..., producer=...)` records a fresh review and marks the original draft `checked` or `rejected`.
- `enqueue_repair(conn, target_job_id, review_job_id, feedback, max_rounds=3)` creates a distinct pending attempt with `repair_round`, the previous draft, review issues and any proposed repair as untrusted context. It returns a job ID, or `None` when it flags the target in `agent_queue`. Three failed rounds including the original, or repeated identical meaningful draft content, require agent review. Repairs clear the source candidate so it cannot be imported again. `enqueue_repair_job(conn, review_job_id)` is a convenience form. Neither function approves or overwrites rejected results.
- `enqueue_example_translation_jobs(conn, language, entry_id, example, source_job_id=None, example_index=0, known_translations=None)` is also available for explicit downstream insertion.
- `fail_job(conn, job_id, error, worker_id=..., claim_token=..., response=None)` retains execution or parser failures, including an optional raw response.
- `retry_failed_job(conn, job_id, feedback, max_rounds=3)` creates a new pending attempt with `runtime_retry_round`, `last_error`, `feedback` and `previous_response`. It returns the new/existing job ID, or `None` after three failed rounds including the original or an identical repeated failure. The latter remains failed and is flagged in `agent_queue`, never completed. Generation retries disable source fast-import. A newly generated draft starts a fresh reviewer execution budget; generator retry counters do not carry into it. Review retries preserve the exact candidate/target binding and supersede only the failed review branch, leaving the target draft and translation siblings intact. If the original `fail_job` did not receive a response, feedback may provide `previous_response` or `response`.
- `recover_running_jobs(conn, worker_id=...)` or `recover_running_jobs(conn, all_workers=True)` explicitly requeues interrupted claims. Old claim tokens then fail. Recovery is never automatic on startup.
- `checked_results(conn, language, entry_id)` exposes only checked drafts whose complete source dependency chain is checked. Use this gate for materialisation; never select raw `results` as accepted content.
- `dispatch_counts(conn, limit=128, kind=None, locale=None)` performs bounded scheduling probes for all seven study languages. Each `languages[code]` reports `ready`, `ready_more` and an exact active `agent_queue` count. `ready` is exact when `ready_more` is false; otherwise it is a lower bound. Each language probe retrieves at most `limit + 1` matching ready IDs. Agent flags cover all task kinds, irrespective of the task filter, and exclude superseded history. Use this in the worker loop; use full counts periodically.
- `export_entry_evidence(conn, language, entry_id)` returns JSON-safe corrected `entry`, preserved `evidence`, and `checkedResults` with dataclass jobs converted to dictionaries. It includes field-coverage gaps and `readyForEntryReview`; it always sets `wholeEntryReviewRequired` and `assembledStructuralCheckRequired`. It does not invent a whole-entry review or its method.
- `queue_counts(conn)` reports transaction-consistent status/task counts, per-language counts, agent-review flags and the catalogue coverage snapshot.

Task kinds are `native_example`, `meaning`, `example_translation` and `review`. Payloads include `task`, `source_language`, `target_language`, `text`, `word`, `part_of_speech`, `meaning_en`, `meaning_ko`, `candidate`, `source`, `provenance`, corrected `entry`, selected-sense `evidence`, `entryId` and `studyLanguage`. Example jobs also include example index and source digest. Missing source text is `null`, not invented filler.

Worker output contracts:

```json
{"text":"Original native sentence.","focus":{"text":"target surface","start":0},"uncertainties":[]}
{"text":"Definition or translated sentence."}
{"verdict":"pass","issues":[]}
{"verdict":"revise","issues":[{"code":"sense","detail":"Wrong selected sense"}],"repair":{"text":"Suggested replacement"}}
```

For a source-import draft, use `role: "local-draft"`, `method: "licensed-source-import"`, and the source digests. The model may be `null` because no model generated that text. Copy the candidate text exactly and retain its attribution; the output provenance can add `kind: "licensed-source"` to the original source descriptor. The subsequent check is recorded as `source-candidate-AI-review`. A changed or repaired definition is not a verbatim source import; its new producer metadata must identify the actual generation model and repair prompt, and its eventual adaptation attribution must be checked separately. Never carry the import method forward onto a model repair.

The worker owns provenance metadata, for example `{"role":"local-draft","model":"local-model","revision":"pinned-revision","prompt_digest":"..."}`. A review requires the distinct `local-review` role in a fresh context. Using the same model is labelled **same-model AI review**; it is not native-speaker review or an independent-model assessment. Model-produced approval fields have no authority. Passing reviews cannot contain unresolved issues or replacement text: a proposed repair must become a new draft and be checked again.

The export retains each result’s `output_digest`, `job.input_hash`, `job.payload.entry_digest`, producer and reviewer metadata, and digest-bound field-review evidence. Dependencies remain in `job.payload.dependency_job_ids`; native-source identity remains in `source_job_id`, `source_example` and `source_digest`. A JavaScript assembler must verify those bindings and reconstruct provenance from trusted evidence rather than trusting model-supplied licence claims. Field completeness is not entry review approval. Exact canonical JSON is exported as `entryJson`, `evidenceJson`, and each result’s `payloadJson`/`outputJson` (plus `sourceExampleJson` when present). Hash these UTF-8 strings and verify their parsed values match the accompanying objects. For the entry digest, hash `{"entry":` + `entryJson` + `,"evidence":` + `evidenceJson` + `}`. This preserves Python’s numeric spelling, including `1.0`, which JavaScript would otherwise reserialize as `1`.

Native and translated examples require structural and linguistic checks outside this storage module. English-to-English example text is the exact native sentence, so no redundant generation job is created. The final compiler must still verify every entry, pair and field. Queue generation completeness alone is not publication readiness.

## Persistence and invalidation

Pending indexes cover the optional study-language, task and target-locale filter combinations in ID order. They are created once by `open_queue`; reopen a worker connection after upgrading the module. No count-table backfill or live queue rebuild is required for these indexes.

Job identity includes study language, stable entry ID, task, target locale and canonical input SHA-256. Example identity includes its index, source sentence digest and dependency IDs. Changing catalogue/editorial evidence or generation revision supersedes prior jobs and descendants while retaining historical results. Completed work is never silently rerun. Rejected jobs need an explicit repair attempt; failed jobs remain visible in counters until explicitly retried, and superseded attempts retain their failure events.

The native queue includes every entry lacking an accepted primary example. Meaning jobs cover every missing explanation field. Existing example slots receive every missing translation job. Each new native draft adds six translation tasks; the English self-pair is deterministic. Do not count deferred translation fields as already queued or checked.

Focused tests run with `python3 tests/test_gpu_job_queue.py` and through `npm test` via `tests/gpu-job-queue.test.mjs`.
