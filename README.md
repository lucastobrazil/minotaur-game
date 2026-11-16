# Lucas's games

Browser games built with Claude for the kids. Each game builds to one self-contained HTML page, which is published as a Claude artifact and played with keyboards, touch, Joy-Cons or other controllers.

| Game | Folder |
| --- | --- |
| 🐂 The Minotaur | [`games/minotaur`](games/minotaur) |
| 🎨 Colour Quest (prototype) | [`games/colour-quest`](games/colour-quest) |
| ⭐ Star Catch (starter template) | [`games/_template`](games/_template) |

## Getting started

```sh
npm install                                   # installs every game (npm workspaces)
npm run games                                 # list the games and their links
npm run new-game -- star-race "Star Race" 🏁   # start a new game from the template
npm run build -w star-race                    # build one game -> games/star-race/dist/index.html
npm test -w star-race                         # run its headless browser tests
npm run dev -w star-race                      # dev server with hot reload
```

Running `npm run build`, `npm test` or `npm run typecheck` with no `-w` runs them for every game.

## Layout

```
games/
  minotaur/        The Minotaur (Three.js r128, its own controller code)
  _template/       Star Catch: the starter every new game is copied from
packages/
  kit/             shared code: controllers, players joining, test helpers
scripts/
  new-game.mjs     copy the template into games/<id>
  list-games.mjs   list games from their game.json
  run_tests.py     test runner used by every game
```

Each game has a `game.json` with its title, emoji, description and artifact link. A future launcher screen will read these files so the kids can pick a game.
