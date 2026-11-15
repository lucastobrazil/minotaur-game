# kit — shared code for the games

Import from a game with `import { Players } from 'kit/players'`.

| File | What it does |
| --- | --- |
| `src/pads.ts` | Reads controllers. It ignores the joined "Joy-Con L+R" copy, reads sticks, d-pads and hat axes, corrects for a sideways Joy-Con, and detects new button presses. |
| `src/players.ts` | Lets players join by pressing a button or key (up to 4) and gives each player their own movement and action input. It also handles start/menu presses. |
| `testing/fake_pads.py` | Fake controllers for the headless Playwright tests. |

## Rules
- Move code here only once a **second** game needs it. Until then, keep it in the game.
- Keep it free of any one game's state, and of Three.js, so every game can use it whatever Three version it pins.
- The Minotaur still uses its own controller code (`games/minotaur/src/input.ts`). It is battle-tested on real Joy-Cons, so don't swap it for the kit without testing on the real controllers.
