# Working on The Minotaur

Lucas builds this game with Claude for his kids. They play it from a Claude artifact link, often with Joy-Cons / a Pro Controller on a laptop. The general workflow is in the repo's root `CLAUDE.md`; this file holds what's specific to this game.

## Publishing
- Live artifact: slug `d306575e-eb0a-4331-9e37-e2cc608d1c77`, https://claude.ai/artifact/T4NuzpimAwdVK1HWCqmvEJ
- Preview artifact (try changes here first): slug `7f938642-91c7-4a58-98e4-7bf7db471223`, https://claude.ai/artifact/GkiKP3iMhW8SoghySefGmp
- Publish `games/minotaur/dist/index.html` as `index.html`. Get the current version with get_artifact first and pass it as base_version.
- **Ask before publishing to the live artifact.** The kids may be mid-game, and publishing can reload their page.
- `#boss` on the URL starts at the first boss level (level 4).

## Notes
- Three.js is pinned at r128 on purpose; upgrading changes lighting and colour (see README roadmap). Other games can use newer versions.
- Shared mutable state lives in `G` (`src/state.ts`, typed by `GameState` in `src/types.ts`). Module-level `export let` values are only assigned inside their own module's `init()`.
- Keep `npm run typecheck -w minotaur` clean (strict mode). Don't add `any` or `@ts-nocheck` to get around errors; extend the types instead.
- Controller handling is the most fragile area (Chrome joins two Joy-Cons into a "Joy-Con L+R" copy; ghost duplicates; sideways orientation untested on real hardware). Keep the controller tests (t11, t15, t16, t19, t23) passing. This game keeps its own controller code in `src/input.ts` rather than using `packages/kit`.
- `legacy/index.html` is the original single-file prototype, kept for reference only.
