# Lucas's games

Lucas builds browser games with Claude for his kids. They play them from Claude artifact links, often with Joy-Cons or a Pro Controller on a laptop. Each game builds to one self-contained HTML file that gets published as an artifact.

## Layout
- `games/<id>/`: one folder per game, with its own `src/`, `tests/`, `package.json` (it pins its own Three.js version), `game.json` and `CLAUDE.md`. Read the game's own `CLAUDE.md` before working on it.
- `games/_template/`: the starter game (Star Catch) that new games are copied from.
- `packages/kit/`: code shared between games (controllers, players joining, test helpers). See its README for the rules.
- `scripts/`: `new-game.mjs`, `list-games.mjs`, `run_tests.py` (the test runner every game uses).

## Workflow
1. New game: `npm run new-game -- <id> "<Title>" [emoji]`.
2. Change code in `games/<id>/src/`, then `npm run build -w <id>` (produces `games/<id>/dist/index.html`).
3. `npm test -w <id>` runs that game's headless Playwright tests. Add or update a test for new behaviour. `npm run typecheck -w <id>` must stay clean (strict TypeScript; no `any` or `@ts-nocheck`).
4. Work on a branch, then commit and push to GitHub (`lucastobrazil/minotaur-game`). Merge to main when Lucas says so.
5. Publish `games/<id>/dist/index.html` as `index.html` to the game's artifact (slug and URL in its `game.json`). Get the current version with get_artifact first and pass it as base_version. A new game gets a new artifact; record its slug and URL in `game.json`.

**Ask before publishing to a live artifact.** The kids may be mid-game, and publishing can reload their page. Build, test and describe the change first; publish when Lucas says so. Preview artifacts are fine to update.

## Notes
- `game.json` (id, title, emoji, description, players, status, artifact) is what a future launcher screen will read. Keep it up to date.
- Root `npm run build` / `npm test` / `npm run typecheck` run every workspace.
- Move code into `packages/kit` only once a second game needs it.
