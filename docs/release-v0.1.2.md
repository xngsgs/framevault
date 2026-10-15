# FrameVault v0.1.2

This patch refines the brand and interface icons in response to feedback that the old shapes looked like stacked blocks.

- New original SVG brand mark with a rounded frame, inset F, violet shading and edge highlights; also used as the browser favicon.
- Softer, consistent interface symbols with theme-aware tonal fills. Statistic icons no longer sit on colored rectangular tiles.
- Refined category, upload/download, theme and preview icons, with decorative SVGs excluded from screen-reader labels.

See the [visual review and validation](iconography-v0.1.2.md) for before/after, desktop and mobile screenshots.

Requires Node.js 24+. Run `npm start`, then open `http://127.0.0.1:4317`. Existing libraries need no migration. Restart a running server and reload the page after updating so the new brand SVG route is available.

Local validation: syntax checks and all 12 functional tests passed; desktop and mobile browser checks covered both themes and affected controls. AI tests use a mock provider; real model quality was not evaluated in this patch.
