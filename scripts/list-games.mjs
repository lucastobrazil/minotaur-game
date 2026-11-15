#!/usr/bin/env node
// List the games (reads each games/*/game.json). A future launcher screen will read the same files.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const games = join(dirname(fileURLToPath(import.meta.url)), '..', 'games');
for (const dir of readdirSync(games).sort()) {
  const f = join(games, dir, 'game.json');
  if (!existsSync(f)) continue;
  const g = JSON.parse(readFileSync(f, 'utf8'));
  console.log(`${g.emoji} ${g.title.padEnd(20)} games/${dir.padEnd(16)} ${g.status.padEnd(9)} ${g.artifact?.url ?? '(not published)'}`);
}
