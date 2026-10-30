# Unified language app

Follow REVIEW.md and CONTRIBUTING.md. This repository builds one app, not separate language apps.

- App code and language-specific exercise logic are bundled under `web/`.
- Downloaded language packages contain validated data only; keep them outside `web/`.
- Study language and explanation language are independent preferences. Study cores and each study-to-explanation pair are separate versioned downloads.
- Namespace learner progress by study language and stable content ID. Package updates must not erase progress.
- Validate download identity, size, integrity and schema before atomic installation. Preserve the installed version if an update fails.
- For UI work, read `docs/study-design.md` first. Reuse `web/js/shared/study-components.js` and `web/study-theme.css`; German/Chinese are the design baseline. Add or extend shared-design browser checks for new UI patterns; verify phone/tablet and light/dark parity.
- Run `npm test` and `npm run check`; verify browser/native behavior when relevant.
- Use small issue-linked PRs. Do not restore the retired app histories or create a dev branch.
- Do not publish packages, store binaries or merge PRs without user authorization.

Use current stable releases. The project targets Node 26.11.1+, npm 12.2.0+, iOS 27 and Swift 6; do not add support for older toolchains unless explicitly requested.
