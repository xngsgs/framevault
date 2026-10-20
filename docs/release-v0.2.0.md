# FrameVault v0.2.0

The workbench now supports organizing a collection in groups, with the images at the center and project readiness alongside them.

- Import 1–20 PNG/JPEG/WebP images together. Edit individual names, share project/type settings, see each result, pause after the current save and retry failed rows without resubmitting successes.
- Select up to 100 assets and explicitly set a project or confirmation status. The server validates the whole selection atomically and rejects image versions that changed since selection.
- View real project thumbnails/readiness and recent changes. Click a common tag to filter exactly; JSON manifest exports match the tag filter.
- Use the compact header, redesigned collection, clearer selection controls and responsive project rail in either theme. Sort preference now survives reload.

Requires Node.js 24+. Run `npm start` and open `http://127.0.0.1:4317`. Stop an older running server before updating, retain the complete `data/` directory, restart and reload the page. The existing schema-v1 library works without migration. Backup instructions remain in the README.

Validation: JavaScript checks and 20 tests passed locally. Browser checks covered real synthetic-file imports, duplicates, failed-item retry, bulk organization, old-version download/hash preservation, exact-tag exports, mobile dialogs and theme/view behavior. See the [workbench review](workbench-v0.2.0.md).

Limits: each image remains capped at 10 MB; batch requests run sequentially; pausing finishes the current request. This release does not add complete media backup/restore, full image decoding/dimension limits, metadata conflict resolution, English localization or a permanent browser test suite. AI-provider tests use mocks, and live model quality remains unevaluated.
