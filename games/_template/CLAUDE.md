# Star Catch (template)

This is the starter template that `npm run new-game` copies. Keep it small and working: it's what every new game starts from.

## Notes
- `src/main.ts` holds the whole game: Three.js scene, players joining through `kit/players`, the loop, the HUD and a debug bridge for tests. Split it into modules once it grows, the same way The Minotaur is split up.
- Players join by pressing a button (or WASD / arrows) and start with + or Enter. Up to 4 players.
- Three.js here is the latest version. Each game pins its own version in its `package.json`.
- Tests go in `tests/t*.py` (Playwright). Use `packages/kit/testing/fake_pads.py` to fake controllers.
- Before publishing, add the artifact slug and URL to `game.json` so the launcher and Claude can find it.
