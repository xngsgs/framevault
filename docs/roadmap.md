# Roadmap

This is a proposal, not a list of shipped features. Items should advance through reproducible issues and tested pull requests.

## v0.1 — Local asset library

- [x] Raster import, SHA-256 duplicate handling
- [x] Projects, characters, tags, notes and status filters
- [x] Immutable versions and review reset
- [x] Download previous versions and export metadata manifest
- [x] Original demo illustrations
- [x] Optional vision tag proposals with explicit human acceptance
- [x] Storage, HTTP and mocked provider tests

## v0.2 — Daily use

- [x] Batch import with per-file progress, partial failures, pause and failed-item retry
- [x] Multi-selection and atomic project/status editing with image-version checks
- [x] Project readiness, recent updates and exact tag filtering/export
- [ ] Complete backup/export and restore with media hashes verified
- [ ] English interface and persistent locale preference
- [ ] Repeatable browser interaction suite and full accessibility review (desktop/mobile browser checks are recorded for v0.2.0)
- [ ] Optimistic revision checks for editing in multiple tabs
- [ ] Thumbnail generation and image dimension validation

Bulk editing already checks selected image-version IDs. Full metadata revision checks and conflict resolution for individual editors remain planned.

## v0.3 — Useful AI retrieval

- [ ] Small labeled evaluation set for tagging precision and recall
- [ ] Natural-language retrieval with explicit matching evidence
- [ ] Provider usage and cost visibility
- [ ] Approval history attached to individual versions

## Portfolio notes

Maintain a short record of real engineering decisions, bug fixes and measurements. Claims about speed, accuracy, usage or live model quality must refer to reproducible evidence. A release should include screenshots, clear setup instructions and known limitations.
