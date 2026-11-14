# The Minotaur

A 3D labyrinth game for 1–4 players, played in the browser with keyboard, touch, Joy-Cons or other gamepads.

Find the golden thread to open the exit, avoid the Minotaur, and escape. Features include random mazes, fog of war with a minimap, lever gates, sprint, trader chests with fireballs, a final chase, first-person split screen, and a procedural soundscape.

## Current state

This is the original single-file prototype: everything lives in `index.html` (Three.js r128 from a CDN, Web Audio, Gamepad API). The plan is to port it to TypeScript + Vite with proper modules.

Play it by opening `index.html` in Chrome or Edge.

## Tests

`tests/` holds headless browser checks (Python + Playwright) that drive the game with simulated keyboards and controllers:

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

They need Playwright with Chromium and a local copy of Three.js r128 (`npm i three@0.128.0`, then point `THREE_JS` at `node_modules/three/build/three.min.js`).
