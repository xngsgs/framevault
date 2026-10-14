# Working on FrameVault

- This repository is an open-source, single-user local creative asset manager.
- Preserve original image bytes and every existing version. New versions reset current approval to draft.
- AI proposals require explicit human acceptance; do not infer approval or character identity.
- Keep API keys server-side, and never commit `.env`, `data/` or imported user assets.
- Default to bounded, reviewable changes. Avoid framework migrations without a concrete need.
- Run `npm run check` and `npm test` before committing implementation changes.
- Keep README and roadmap honest about shipped versus planned behavior and mocked versus live validation.
- Database changes require backup instructions and tests for upgrading an existing library.
- Use small feature/fix branches and pull requests for published-repository changes. Initial repository bootstrap may go to `main`.
- Do not send messages to maintainers or users unless the human has authorized that communication.
