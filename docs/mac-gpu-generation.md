# Full-corpus Mac GPU generation

The target is every current entry and all 43 allowed explanation pairs. Work is queued for all seven languages together; batch size is a memory/throughput setting, not a content milestone.

The verified host is an Apple M1 MacBook Pro with an 8-core GPU and 16 GB of unified memory. The local runtime is MLX 0.32.4 / MLX-LM 0.31.3. Model weights stay in `~/Library/Caches/LearnLanguage/models`, outside Git and Google Drive. Qwen3.5-9B-4bit is pinned to `8b2b98c00a6b4d291155e4890773ca8f769aee53` (Apache-2.0). The optional TranslateGemma 4B pilot is pinned to `5788ec08c047f3f2e17808101b8d9566ac930d58` under the Gemma terms; its observed quality was insufficient as a universal replacement, so it is disabled by default.

A model-specific chat template is mandatory. The earlier Qwen download omitted `chat_template.jinja`, which caused generic role formatting. Gemma additionally needs its `<end_of_turn>` stop token. Correcting runtime formatting and termination does not eliminate semantic errors; benchmark reports retain these distinctions.

The live database is `~/Library/Application Support/LearnLanguageContent/content.sqlite`. It contains 76,385 entry records and 435,962 initial generation jobs: 46,534 missing native examples, 299,714 missing meanings and 89,714 missing translations of existing examples. New native examples create another 279,204 translation jobs. Reviews and bounded repairs are additional jobs. Licensed definition candidates remain unapproved until reviewed.

## Run and resume

Run the [Wiktionary source pass](wiktionary-source-reuse.md) before resuming
generation. It reuses suitable definitions, examples and exact sentence
translations as separately reviewed drafts, without starting a model. Preserve
the user pause until generation is explicitly resumed; source imports do not
change that setting.

Run from the persistent content worktree, with the cached Python runtime:

```sh
~/Library/Caches/LearnLanguage/mlx-venv/bin/python scripts/content/run-local-corpus.py \
  --db "$HOME/Library/Application Support/LearnLanguageContent/content.sqlite" \
  --run-dir local-data/generation/run --draft-only --recover-running \
  --batch-size 4 --max-tokens 256 \
  --final-drive-backup local-data/generation/content-completed.sqlite
```

Omitting `--limit` processes the full queue. The GPU lock prevents concurrent local model workers. Interrupted claims are recoverable only for the explicit worker identity. Raw attempts, source/model/prompt digests and failures remain recorded. Invalid JSON, truncated responses and structural errors are retried with feedback; repeated failures or three failed attempts go to the agent queue.

The current broad run uses `--draft-only`: the tested small-model reviewer produced false positives and missed some POS errors, so its output is not a safe automatic approval oracle. Deterministic checks, review jobs, semantic findings and source attribution are retained. Draft coverage is not completed quality review. Final assembled entries still require digest-bound review before the existing complete-release gate can stage packages. No raw machine drafts are published.

The worker pauses below 20% battery and saves each result. Progress is in `local-data/generation/run/status.json`, raw attempts in `attempts.jsonl`, and the process snapshot in `final-snapshot.json`. Long-run throughput depends on text lengths, repairs and model choice; small pilot timings are not a reliable completion promise.

## Google Drive copy after generation

The user requested the database back beside the code after generation. `--final-drive-backup` produces a consistent SQLite backup only when the expected generation fields exist and no generation jobs remain pending, running, failed or rejected. It performs an integrity check, converts the snapshot to DELETE journal mode, removes its own temporary sidecars and atomically publishes one standalone database file. It does not copy an active WAL piecemeal. Existing destination copies are preserved using a timestamped new filename. A stopped or incomplete run does not masquerade as the final Drive copy.

Generation completion and linguistic-review completion remain distinct in the backup metadata. The live local database is retained until the verified copy is available. Nothing in this tool changes an installed app, package catalogue, learner progress, or repository main branch.
