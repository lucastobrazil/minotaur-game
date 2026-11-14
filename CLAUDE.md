# Working on The Minotaur

Lucas builds this game with Claude for his kids. They play it from a Claude artifact link, often with Joy-Cons / a Pro Controller on a laptop.

## Workflow

1. Change code in `src/`, then `npm run build` (produces a single self-contained `dist/index.html`).
2. Run `npm test` (headless Playwright tests against `dist/index.html`). Add or update a test for new behaviour.
3. Commit and push to GitHub (`lucastobrazil/minotaur-game`).
4. Publish `dist/index.html` as `index.html` to the live artifact:
   - slug `d306575e-eb0a-4331-9e37-e2cc608d1c77`, https://claude.ai/artifact/T4NuzpimAwdVK1HWCqmvEJ
   - Get the current version with get_artifact first and pass it as base_version.

**Ask before publishing to the live artifact.** The kids may be mid-game, and publishing can reload their page. Build, test and describe the change first; publish when Lucas says so.

## Notes

- Three.js is pinned at r128 on purpose; upgrading changes lighting and colour (see README roadmap).
- Shared mutable state lives in `G` (`src/state.ts`). Module-level `export let` values are only assigned inside their own module's `init()`.
- Controller handling is the most fragile area (Chrome joins two Joy-Cons into a "Joy-Con L+R" copy; ghost duplicates; sideways orientation untested on real hardware). Keep the controller tests (t11, t15, t16, t19, t23) passing.
- `legacy/index.html` is the original single-file prototype, kept for reference only.
