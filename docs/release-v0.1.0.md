# FrameVault v0.1.0

First usable release of a local creative asset library.

Import images, organize project/character metadata, search tags, review the latest version, preserve earlier images and export a filtered manifest. An optional vision adapter proposes tags for explicit acceptance.

## Run

Requires Node.js 24+. Clone the repository and run `npm start`; no dependency installation is required. Open http://127.0.0.1:4317 and load the original demo assets or import a raster image.

## Validation

All 12 tests passed locally on Windows. Browser QA verified file import, approval editing, new-version review reset, old-version download, Chinese tag search, filtered export and desktop/narrow layouts.

The AI provider integration was tested using a mock. A live model/key must be configured to use vision tagging; live-model quality is not yet evaluated.

## Current boundaries

Single-user local operation. Metadata manifests do not include images and are not full backups. Batch import, restore tooling, per-version approval history and English UI are planned for later releases.
