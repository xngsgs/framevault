# Maintenance record

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
