# FrameVault v0.1.1

A redesigned creative workspace with larger artwork previews, clearer Chinese typography and a consistent visual system.

- Light/dark themes and gallery/list layouts, remembered across reloads.
- Status tabs, scoped counts, project filtering and removable filter chips.
- Dedicated metadata/history tabs, enlarged image previews and transparency canvas controls.
- Clearer upload feedback, single-image drop support and keyboard shortcuts.
- Fixed whitespace-padded search/export inconsistency.

All 12 functional tests passed locally. Browser QA verified changed workflows and narrow-screen layouts; screenshots and limitations are in `docs/interface-v0.1.1.md`. Native dragging and real AI-model calls were not exercised.

Run with Node.js 24+ and `npm start`; no dependency installation or database migration required.
