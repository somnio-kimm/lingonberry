# One project folder

Use `avocavocado` as the only active checkout. It is connected to
`git@github.com:somnio-kimm/lingonberry.git`.

The app is named Lingonberry and keeps its existing app ID and learner
storage keys. Renaming the repository does not reset installed users' progress.
The imported source is the integrated `learn_language` commit
`c6c97e8b29351e9a64a7032770d18285ec80cfed`. All language-source branch patches are
already included. The older main checkout's local review-label and red erase-data
changes are included too; its old service-worker hash is superseded by a fresh one.

## Where things live

| Location | Purpose |
| --- | --- |
| `web/`, `mobile/`, `scripts/`, `tests/` | Current app, native wrapper and tooling |
| `language-packages/` | Versioned package data, authoring sources and licence notices |
| `local-data/generation/content-paused.sqlite` | Verified snapshot of the paused generation database |
| `local-data/generation/run/` | Current saved commands, status, safeguards and logs |
| `local-data/sources/` | Original dictionary downloads and source inputs |
| `local-data/recovery/` | Prior authoring/review evidence and recovery material |
| `local-data/backups/pre-consolidation-20261016/` | Recovery archives and inventories for retired projects |
| `.toolchain/` | Existing local Node/npm runtime, excluded from Git |

`local-data/` and `.toolchain/` are local files inside this project folder, not
published to GitHub. The test command explicitly selects `tests/*.test.mjs` so
recovery material cannot accidentally become part of the app's test suite.

The working SQLite database remains at
`~/Library/Application Support/LearnLanguageContent/content.sqlite`, outside the
Google Drive sync root. This avoids synchronising an actively written SQLite/WAL
pair. It needs no manual editing. Its verified paused snapshot above contains
76,385 entries and 10,018 saved draft results, matching the live database at
consolidation. The final standalone database is still scheduled to be copied to
`local-data/generation/content-completed.sqlite` after generation completes.
Drafts are not automatically published or treated as language-reviewed content.

## Generation is paused

No worker or supervisor is running. The manifest retains `pausedByUser: true`
and `resumeRequiresUserRequest: true`. Resume only after a new user instruction.
The order remains native examples for every study language, then English/Korean
meanings and sentence translations, then other explanations. The prepared
critical-memory/low-disk safeguards and disabled usage caps are unchanged.
See [safeguards](corpus-resource-guard.md) and
[generation priority](content-generation-priority.md).

## Retired project recovery

The old top-level Chinese, German, shared-core shortcut, legacy project and
worktree directories are removed only after preserving their needed contents.
Working-file archives are verified against SHA-256 inventories. Original Git
metadata and cloud-only files are preserved by same-volume moves, retaining their
file identities without forcing unavailable Google Drive downloads. These are
recovery material, not active app dependencies or a second checkout.

`archive-verification.json`, `import-verification.json`, `moved-resources.json`
and the cleanup report record what was retained. To recover old work, extract
its working-file archive into a separate temporary directory and overlay its
cloud-only files; use the preserved Git metadata if history is needed. Do not
restore a retired folder beside this project for normal development.

Historical attribution URLs and source-path records remain unchanged where they
are provenance evidence. The active GitHub button, repository metadata, native
package download source and generation commands use the new project.
