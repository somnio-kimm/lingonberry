# Archived design as the baseline

For current implementation conventions and reusable components, follow [Shared Study Design Reference](study-design.md). This document records the original restoration.

The Chinese and German view renderers and their dependency graphs are imported from `learn_language_legacy_20261014`. Both language stylesheets and the shared `study-theme.css` are copied directly. `archived-ui-source.json` records the source paths and original checksums for review.

The archived Home menus (nine modes each), level selectors, Word List, flashcards, quiz screens, Wrong Answers and Settings are retained. The unified host supplies installed package data to those renderers. It does not introduce replacement layouts for those screens.

Integration changes are limited to:

- One host header/navigation with the requested study/explanation selectors in Settings.
- Namespaced study progress and an installed-package vocabulary provider instead of fetching separate-app data files.
- Adapter fields that expose only the selected explanation pack; unavailable translations are not invented.
- Unified repository/version metadata and licence content matching the downloaded package.
- Package-management controls added to Settings in the separate download-management change.

Only the original starter data is currently packaged. Some archived exercises correctly have no suitable questions with two entries; the complete dictionaries and grammatical metadata have not been migrated. Their existing renderers remain present rather than being replaced by mock exercise screens.
