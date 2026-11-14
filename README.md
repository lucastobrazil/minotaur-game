# The Minotaur

A 3D labyrinth game for 1–4 players, played in the browser with keyboard, touch, Joy-Cons or other gamepads.

Find the golden thread to open the exit, avoid the Minotaur, and escape. Features include random mazes, fog of war with a minimap, lever gates, sprint, trader chests with fireballs, a final chase, first-person split screen, and a procedural soundscape.

## Development

```sh
npm install
npm run dev        # local dev server with hot reload
npm run build      # builds one self-contained dist/index.html
npm run typecheck  # TypeScript check
npm test           # headless browser tests against dist/index.html (build first)
```

The build inlines everything (game code, Three.js, CSS) into a single `dist/index.html`, so the game can be opened straight from disk or published as a single page.

## Code layout

The code was split out of the original single-file prototype (kept in `legacy/index.html` for reference). It type-checks under TypeScript `strict` mode; shared types live in `src/types.ts`.

| File | What's in it |
|---|---|
| `src/main.ts` | Entry point: imports the modules and runs their start-up code in order |
| `src/types.ts` | Shared types: `Player`, `Minotaur`, `Gate`, `Chest`, `GameState`… |
| `src/state.ts` | Shared mutable game state (`G`, typed as `GameState`): level, players, Minotaurs, gates, camera mode, controller assignment… |
| `src/core.ts` | DOM handles, constants (player names/colours, key descriptions) |
| `src/audio.ts` | Web Audio setup, sound effects (growl, roar, hungry sniff, gate rattle) |
| `src/ambience.ts` | Wind, rumble, drips, torch crackle, footsteps, heartbeat |
| `src/textures.ts` | Procedural canvas textures (stone, glow) |
| `src/scene.ts` | Three.js renderer, lights, hero and Minotaur models |
| `src/maze.ts` | Maze generation (backtracker / Prim), rooms, pathfinding |
| `src/level.ts` | Level building: walls, torches, gates and levers, fog of war, spawning |
| `src/input.ts` | Keyboard, touch and gamepad input, menu navigation, Joy-Con handling |
| `src/logic.ts` | Movement, gates, Minotaur AI, catching, the per-frame update |
| `src/firstPerson.ts` | First-person movement (turn / step) |
| `src/items.ts` | Trader chests, fireballs, stun, item sounds |
| `src/render.ts` | Per-frame sync of 3D objects, camera, minimap, split-screen rendering |
| `src/hud.ts` | HUD (stamina, fireball slots), toasts, player count, difficulty, camera modes |
| `src/controllers.ts` | Choose-controllers screen, start game, main loop |

On `file://` (or with `?debug` in the URL) `main.ts` exposes the game state and functions as globals so the tests can drive the game.

## Tests

`tests/` holds headless browser checks (Python + Playwright, Chromium) that drive the built game with simulated keyboards and controllers. `tests/run_all.py` runs them all.

| Script | Checks |
|---|---|
| `t7.py` | Gameplay: gates, levers, sprint, fog, minimap, final chase |
| `t9.py` | Two-player phone layout |
| `t10.py` | Gate placement can never trap a player (40 random mazes) |
| `t11.py` | Controller-only menu navigation |
| `t15.py` | Joined Joy-Con pair split between two players |
| `t16.py` | Choosing controllers with a duplicate "ghost" controller |
| `t19.py` | Pro Controller + single Joy-Cons + joined pair |
| `t20.py` | Trader chests, fireball, stun |
| `t23.py` | Four players: controller assignment, keyboard sets, split screen |

## Roadmap

1. ~~Split into modules with a build step~~
2. ~~Add types (strict mode)~~
3. Upgrade Three.js from r128 (needs colour-management and light-intensity migration)
4. Settings menu, saving, input remapping, performance tiers
