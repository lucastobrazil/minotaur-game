#!/usr/bin/env node
// Make a new game from the starter template.
//   npm run new-game -- <id> "<Title>" [emoji]
//   npm run new-game -- star-race "Star Race" 🏁
import { cpSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, title, emoji = '🎮'] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !title) {
  console.error('Usage: npm run new-game -- <id> "<Title>" [emoji]\n  id: lowercase letters, numbers and dashes, e.g. star-race');
  process.exit(1);
}
const dest = join(root, 'games', id);
if (existsSync(dest)) { console.error(`games/${id} already exists.`); process.exit(1); }

cpSync(join(root, 'games', '_template'), dest, {
  recursive: true,
  filter: (src) => !/[\\/](node_modules|dist|__pycache__)([\\/]|$)/.test(src),
});
const edit = (file, fn) => { const p = join(dest, file); writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
edit('package.json', (s) => { const j = JSON.parse(s); j.name = id; return JSON.stringify(j, null, 2) + '\n'; });
edit('game.json', (s) => {
  const j = JSON.parse(s);
  Object.assign(j, { id, title, emoji, description: 'TODO: one line about the game.', status: 'wip', artifact: null });
  return JSON.stringify(j, null, 2) + '\n';
});
edit('index.html', (s) => s.replace('<title>Star Catch</title>', `<title>${title}</title>`).replace('<h1 id="title">Star Catch</h1>', `<h1 id="title">${title}</h1>`));
edit('CLAUDE.md', (s) => s.replace(/^# .*$/m, `# ${title}`).replace(/This is the starter template[^\n]*\n/, `This game was started from the template; it still plays Star Catch until you change src/main.ts.\n`));
rmSync(join(dest, 'README.md'), { force: true });
writeFileSync(join(dest, 'README.md'), `# ${emoji} ${title}\n\nTODO: what the game is and how to play.\n\nBuild \`npm run build -w ${id}\`, test \`npm test -w ${id}\`.\n`);

console.log(`Created games/${id}. Linking workspace…`);
execSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit' });
console.log(`\nNext:\n  npm run build -w ${id}\n  npm test -w ${id}\n  then edit games/${id}/src/main.ts`);
