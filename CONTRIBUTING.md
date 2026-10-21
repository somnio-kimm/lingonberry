# Contributing

Follow [REVIEW.md](REVIEW.md) for branch, commit, test and review conventions.

Use Node.js 26.11.1 or newer and npm 12.2.0 or newer:

```bash
npm ci
npm run check
npm test
```

Create a narrowly scoped issue before its branch and PR. Use the repository issue and PR templates, write in English, and link `Closes #<number>`.

PRs target `main`. When a change depends on an open PR, a stacked PR may target that topic branch to keep its diff small; name the dependency in Notes and retarget to main after it merges. There is no dev branch.

Keep each feature with its own tests. Keep unrelated cleanup and content migrations separate. The root MIT license covers code and original starter content; imported datasets must retain their own license notices and provenance.

UI changes must follow [Shared Study Design Reference](docs/study-design.md). Reuse the documented components/tokens and include the relevant design-contract browser check with phone/tablet and light/dark evidence.
