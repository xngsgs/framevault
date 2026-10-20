# Maintenance record

## 2026-10-20 — v0.2.0 daily-use workbench (on demand)

- Replaced the greeting and statistic tiles with a compact working header, image-led collection and a real project/review rail.
- Added batch import (up to 20 images), individual names/results, pause and failed-item retry; successful files are never resubmitted by retry.
- Added multi-selection and atomic project/status editing (up to 100 assets), with selected image-version checks and all-or-nothing validation.
- Added exact tag filtering with matching manifest exports, project confirmation progress and recent changes. Retained local theme/view preferences and added persistent sorting.
- All 20 functional/queue tests passed locally, including reopening an existing schema-v1 library. Browser checks used isolated demo libraries and synthetic raster files.
- Browser import saved two valid images, reported duplicate/unsupported files, and retained successes on retry. Bulk edits survived reload; a new version reset approval, and the downloaded old file matched its original SHA-256.
- Desktop/mobile checks and screenshots are in `docs/workbench-v0.2.0.md`. No schema migration, new package or real AI-provider call was introduced. Recurring maintenance remains canceled.

## 2026-10-15 — v0.1.2 icon refinement (on demand)

- Replaced the stacked CSS logo with an original shaded SVG mark and matching favicon.
- Redrew the interface symbols, removed statistic tile backgrounds and retained accessible names on icon-only controls.
- Verified light/dark desktop and 390px mobile layouts plus filtering, view switching, upload and preview controls using an isolated demo library.
- Syntax checks and all 12 functional tests passed locally. See `docs/iconography-v0.1.2.md` for visual evidence and validation limits.
- This was requested manual maintenance. Recurring maintenance remains canceled.

## 2026-10-14 — v0.1.1 interface improvement

- Replaced the first layout with a studio-style collection, consistent original icons, clearer typography and light/dark palettes.
- Added persistent gallery/list mode, status tabs, filter chips, actionable overview counts and responsive project selection.
- Reworked asset details into a large preview plus metadata/history tabs; added image enlargement and canvas controls.
- Improved upload feedback, shortcuts, empty/error/loading states and preserved all existing asset/version behavior.
- Fixed a search/export mismatch caused by leading or trailing spaces in the query.
- All 12 functional tests passed; live browser checks verified the changed workflows. Full evidence and limitations are in `docs/interface-v0.1.1.md`.

## 2026-10-14 — Initial implementation

- Implemented a local asset-management workflow and an optional, reviewable vision-tagging adapter.
- Added Windows/Linux CI and functional tests using real SQLite and media files.
- Fixed a Windows test teardown bug: the reopened database must close before its temporary directory is removed.
- Replaced a fetch-based forged-Host test with Node's HTTP client because fetch does not transmit an overridden Host header as expected.
- All 12 automated tests passed locally on Windows with Node.js 24.21.0.
- Browser QA verified real file import, status editing, new-version review reset, previous-version download, Chinese tag search and filtered manifest download. The downloaded old version matched the original SHA-256.
- Live AI service quality remains unverified; provider contract/error/concurrency tests use a mock.

## Maintenance rules

Run relevant checks before publishing. Do not regenerate demo files casually; their hashes appear in seeded manifests. Do not include `data/`, credentials, imported user images or personal project assets in commits. Back up local data before schema migrations.

For ongoing maintenance, inspect CI and issues, reproduce failures, make bounded fixes and describe validation in pull requests. Use incremental version numbers for real changes; do not create empty commits or fabricate activity.
