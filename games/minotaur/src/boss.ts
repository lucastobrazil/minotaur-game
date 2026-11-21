// Boss levels: every 4th level is an arena fight against the Great Minotaur.
//
// He stalks the nearest hero, winds up, then charges in a straight line until he
// crashes into a wall or pillar. While he's dazed, a fireball hurts him. Three hits
// win the fight. Heroes have hearts here (and only here); at 0 they become ghosts,
// and a ghost that touches a living teammate comes back with one heart.
import * as THREE from 'three';
import { G } from './state';
import type { Boss, Player, Vec2 } from './types';
import { footstep } from './ambience';
import { gateSound, initAudio, noiseBurst, roar, snort, tone } from './audio';
import { win } from './controllers';
import { $, NAMES, rnd, stage } from './core';
import { buildStamina, showToast, updateHUD } from './hud';
import { burst, sfxBoom, sfxChestOpen, sfxYelp } from './items';
import { attachPlayerMesh, buildLevel, computeSight, makeFire, newLevel } from './level';
import { say } from './logic';
import { bfs, reach, walk } from './maze';
import { fpActive, fpCam, tmpV } from './render';
import { M, box, camera, glowPool, glowSprite, makeMino, setDoorLabel, shadowAll } from './scene';
import { canvasTex } from './textures';

const BOSS_NAME = 'The Great Minotaur';
export const isBossLevel = (level: number): boolean => level % 4 === 0;

// ---------- tuning (Restless / Hunting, getting tougher with each boss) ----------
function tuning(num: number) {
  const hunt = G.difficulty === 'speedy';
  return {
    stalk: Math.max(300, 540 - num * 40) * (hunt ? .8 : 1),
    windup: Math.max(550, 1050 - num * 70) * (hunt ? .8 : 1),
    charge: Math.max(65, 105 - num * 8) * (hunt ? .85 : 1),
    stun: hunt ? 2300 : 2900,
    patience: hunt ? 2600 : 3600,
  };
}

// ---------- saved progress ----------
export function loadProgress() {
  try {
    G.bossWins = Number(localStorage.getItem('minoBossWins') || 0) || 0;
    G.robeUnlocked = localStorage.getItem('minoRobe') === '1';
    G.outfit = localStorage.getItem('minoOutfit') === 'classic' ? 'classic' : (G.robeUnlocked ? 'robe' : 'classic');
  } catch (e) { /* storage unavailable: start fresh */ }
}
function saveProgress() {
  try {
    localStorage.setItem('minoBossWins', String(G.bossWins));
    localStorage.setItem('minoRobe', G.robeUnlocked ? '1' : '0');
    localStorage.setItem('minoOutfit', G.outfit);
  } catch (e) { /* ignore */ }
}
export function setOutfit(o: 'classic' | 'robe') {
  G.outfit = o; saveProgress(); renderTrophies();
  G.players.forEach((p, i) => attachPlayerMesh(p, i));
}
export function renderTrophies() {
  const t = $('trophies');
  t.textContent = G.bossWins ? `🏆 ${BOSS_NAME} defeated ×${G.bossWins}` : '';
  $('outfitRow').style.display = G.robeUnlocked ? '' : 'none';
  document.querySelectorAll<HTMLElement>('[data-outfit]').forEach((b) => b.classList.toggle('sel', b.dataset.outfit === G.outfit));
}

// ---------- level setup ----------
/** Clear any boss-level state (called at the start of every level). */
export function resetBoss() {
  G.isBoss = false; G.boss = null; G.braziers = []; G.heartPickups = []; G.darkTarget = 0;
  document.querySelectorAll('.bossBubble').forEach((b) => b.remove());
  $('bossBar').classList.remove('on');
}

export function newBossLevel() {
  const now = performance.now();
  const r = stage.getBoundingClientRect(), portrait = r.height > r.width * 1.1;
  const W = portrait ? 15 : 21, H = portrait ? 21 : 15;
  G.W = W; G.H = H;
  const grid: number[][] = [];
  for (let y = 0; y < H; y++) { const row: number[] = []; for (let x = 0; x < W; x++) row.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0); grid.push(row); }
  // five 2x2 pillars to crash him into
  for (const [fx, fy] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7], [.5, .5]]) {
    const cx = Math.round(fx * (W - 1)), cy = Math.round(fy * (H - 1));
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[cy + dy][cx + dx] = 1;
  }
  G.grid = grid;
  const midX = (W - 1) / 2, midY = (H - 1) / 2;
  G.exit = portrait ? { x: midX, y: 0, axis: 'z' } : { x: W - 1, y: midY, axis: 'x' };
  grid[G.exit.y][G.exit.x] = 0;
  G.rooms = []; G.gates = []; G.gateMap = new Int16Array(W * H); G.threads = [];
  G.needed = 0; G.got = 0; G.doorOpen = false;
  G.isBoss = true;
  G.maxHearts = G.difficulty === 'speedy' ? 2 : 3;

  // heroes start on the far side from the exit
  const spawn: Vec2[] = portrait
    ? [{ x: midX, y: H - 3 }, { x: midX - 1, y: H - 3 }, { x: midX + 1, y: H - 3 }, { x: midX, y: H - 4 }]
    : [{ x: 2, y: midY }, { x: 2, y: midY - 1 }, { x: 2, y: midY + 1 }, { x: 3, y: midY }];
  G.players = [];
  for (let i = 0; i < G.numPlayers; i++) {
    const s = spawn[i];
    G.players.push({ x: s.x, y: s.y, px: s.x, py: s.y, sx: s.x, sy: s.y, next: 0, inv: 0, last: portrait ? { x: 0, y: -1 } : { x: 1, y: 0 }, face: 0, stamina: 1, tired: false, sprinting: false, hearts: G.maxHearts, ghost: false, item: G.carry[i] || null });
  }
  G.minos = [];
  G.chests = []; G.fireballs.forEach((f) => G.levelGroup && G.levelGroup.remove(f.g)); G.fireballs = []; G.fx = []; G.nextChestT = Infinity;
  G.heartPickups = [];
  G.elapsed = 0; G.hugsLevel = 0;
  G.explored = new Uint8Array(W * H).fill(1); G.sight = new Uint8Array(W * H);
  computeSight();
  buildLevel();

  // braziers in the four corners hand out fireballs
  G.braziers = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].map(([x, y]) => {
    const iron = M('#26221e', { metalness: .5, roughness: .6 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .6, 10), iron); stand.position.set(x, .3, y);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.26, .13, .14, 14), iron); bowl.position.set(x, .66, y);
    shadowAll(stand); shadowAll(bowl); G.levelGroup.add(stand, bowl);
    const fire = makeFire(2.2); fire.position.set(x, .72, y); G.levelGroup.add(fire);
    const pool = glowPool('#ff7a2a', 2.8, .4); pool.position.set(x, .013, y); G.levelGroup.add(pool);
    const torch = { x, y, fire, pool }; G.torches.push(torch);
    return { x, y, readyAt: 0, torch };
  });

  // the Great Minotaur himself
  const bx = portrait ? midX : W - 5, by = portrait ? 4 : midY;
  const mesh = makeMino();
  const cape = box(.62, .75, .04, M('#5a0f0f', { roughness: 1 })); cape.position.set(0, .8, -.24); cape.rotation.x = .12; mesh.add(cape);
  const gold = M('#d9a52e', { metalness: .7, roughness: .3 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.2, .23, .09, 18, 1, true), gold); crown.position.set(0, .2, -.02); mesh.userData.head.add(crown);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .5, sp = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 6), gold); sp.position.set(Math.cos(a) * .21, .28, -Math.sin(a) * .21 - .02); mesh.userData.head.add(sp); }
  mesh.scale.setScalar(2.1); mesh.position.set(bx, 0, by); G.levelGroup.add(mesh);
  const bubble = document.createElement('div'); bubble.className = 'bubble bossBubble'; stage.appendChild(bubble);
  const num = G.level / 4;
  G.boss = { x: bx, y: by, px: bx, py: by, hp: 3, maxHp: 3, mode: 'stalk', modeUntil: now + 2600, next: 0, stalkStart: now + 2600, dir: portrait ? { x: 0, y: 1 } : { x: -1, y: 0 }, face: portrait ? 0 : -Math.PI / 2, num, say: '', sayUntil: 0, deadT: 0, flashUntil: 0, mesh, bubble };
  bossSay(G.boss, 'WHO DARES ENTER MY HALL?', 2400);

  $('bossBar').classList.add('on'); renderBossBar();
  updateHUD(); buildStamina();
}

export function bossIntro() {
  showToast(`⚔️ BOSS: ${BOSS_NAME}! Make him crash into a pillar, then hit him with a fireball while he's dazed.`, 4200);
  setTimeout(() => { if (G.state === 'play' && G.isBoss) showToast(`🔥 Grab fireballs from the glowing braziers. You have ${G.maxHearts} hearts each.`, 3600); }, 4400);
}

// ---------- the fight ----------
function bossSay(b: Boss, text: string, ms: number) { b.say = text; b.sayUntil = performance.now() + ms; }
const alive = (): Player[] => G.players.filter((p) => !p.ghost);

function nearest(b: Boss): Player | null {
  let best: Player | null = null, bd = 1e9;
  for (const p of alive()) { const d = Math.abs(p.x - b.x) + Math.abs(p.y - b.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function clearLine(b: Boss, p: Player): Vec2 | null {
  if (b.x !== p.x && b.y !== p.y) return null;
  const dx = Math.sign(p.x - b.x), dy = Math.sign(p.y - b.y), n = Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
  if (n < 2) return null;
  for (let k = 1; k < n; k++) if (!walk(b.x + dx * k, b.y + dy * k)) return null;
  return { x: dx, y: dy };
}
function startWindup(b: Boss, p: Player, now: number, aimed: Vec2 | null) {
  let dir = aimed;
  if (!dir) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const first: Vec2 = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const second: Vec2 = first.x ? { x: 0, y: Math.sign(dy) } : { x: Math.sign(dx), y: 0 };
    dir = [first, second].find((d) => (d.x || d.y) && walk(b.x + d.x, b.y + d.y)) || null;
  }
  if (!dir) { b.stalkStart = now; return; }
  b.dir = dir; b.mode = 'windup'; b.modeUntil = now + tuning(b.num).windup;
  bossSay(b, ['RRRAAAH!', 'HERE I COME!', '*SNORT* *SNORT*'][rnd(3)], 1000);
  snort(.3); if (G.ac) noiseBurst(G.ac.currentTime + .1, .5, 'lowpass', 500, .25, 1, .4);
}
function crash(b: Boss, now: number) {
  b.mode = 'stunned'; b.modeUntil = now + tuning(b.num).stun;
  sfxBoom(); if (G.ac) noiseBurst(G.ac.currentTime + .05, .8, 'lowpass', 300, .35, 1, .7);
  burst(b.x + b.dir.x * .5, .5, b.y + b.dir.y * .5, '#a89880', 16, 1.8);
  bossSay(b, '✦ ✦ ✦  (dazed!)', tuning(b.num).stun);
}

function hurtPlayer(p: Player, now: number, why: string) {
  if (p.ghost || p.inv > now) return;
  p.hearts = Math.max(0, (p.hearts ?? 1) - 1); p.inv = now + 2000;
  const fl = $('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 120);
  tone(220, .12, 'square', .12, 90); if (G.ac) noiseBurst(G.ac.currentTime, .15, 'highpass', 2000, .15);
  const name = NAMES[G.players.indexOf(p)];
  if (p.hearts > 0) { showToast(`💔 ${name} ${why}! ${p.hearts} heart${p.hearts === 1 ? '' : 's'} left.`, 1800); return; }
  // out of hearts: become a ghost
  p.ghost = true; p.item = null; ghostLook(p, true);
  tone(660, .6, 'sine', .1, 220);
  if (alive().length) showToast(`👻 ${name} is a ghost! Touch a teammate to come back.`, 2800);
  else {
    showToast(`${BOSS_NAME} wins this round… try again!`, 2600);
    setTimeout(() => { if (G.state === 'play' && G.isBoss && alive().length === 0) restartBoss(); }, 2200);
  }
}
/** A minion catching someone in a boss fight costs a heart instead of a thread and a random respawn. */
export function minionCatch(p: Player, now: number) { hurtPlayer(p, now, 'was caught'); }

function revive(p: Player, now: number) {
  p.ghost = false; p.hearts = 1; p.inv = now + 2000; ghostLook(p, false);
  [523, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .1, null, i * .08));
  showToast(`✨ ${NAMES[G.players.indexOf(p)]} is back with 1 heart!`, 1800);
}
function ghostLook(p: Player, ghost: boolean) {
  p.mesh?.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
    mats.forEach((m) => { m.transparent = ghost; m.opacity = ghost ? .3 : 1; m.depthWrite = !ghost; });
  });
}
export function restartBoss() {
  G.carry = G.carry.map(() => null);
  newLevel(); bossIntro();
}

/** Called when a fireball reaches the boss. Returns true if it was a hit (vs. bouncing off). */
export function fireballHitsBoss(now: number): boolean {
  const b = G.boss; if (!b || b.mode === 'dead') return false;
  if (b.mode !== 'stunned') {
    bossSay(b, ['HA! Too slow!', 'That tickles!', 'Missed me!'][rnd(3)], 1300);
    tone(1600, .08, 'square', .06);
    return false;
  }
  b.hp--; b.flashUntil = now + 900; sfxYelp(); renderBossBar();
  if (b.hp <= 0) { defeat(b, now); return true; }
  b.mode = 'hurt'; b.modeUntil = now + 1500;
  bossSay(b, b.hp === 2 ? 'ROOOAR! Come forth, my children!' : 'ENOUGH! Let the darkness fall!', 2000);
  setTimeout(roar, 300);
  // each phase brings more minions; the last one is fought in the dark
  const phase = b.maxHp - b.hp + 1;
  const minions = phase === 2 ? Math.min(3, b.num) : 1;
  for (let k = 0; k < minions; k++) spawnMinion(now + 1500 + k * 600);
  if (phase === 3) G.darkTarget = 1;
  spawnHeart(now);
  showToast(phase === 3 ? `💥 Hit! One more… but the torches are going out.` : `💥 Hit! ${b.hp} to go. Watch out for his minions!`, 2600);
  return true;
}

function spawnMinion(when: number) {
  const far: Vec2[] = [];
  for (let y = 1; y < G.H - 1; y++) for (let x = 1; x < G.W - 1; x++) if (walk(x, y) && G.players.every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) >= 7)) far.push({ x, y });
  if (!far.length) return;
  const s = far[rnd(far.length)];
  const mesh = makeMino(); mesh.scale.setScalar(1.05); mesh.position.set(s.x, 0, s.y); G.levelGroup.add(mesh);
  const bubble = document.createElement('div'); bubble.className = 'bubble'; stage.appendChild(bubble);
  G.minos.push({ x: s.x, y: s.y, px: s.x, py: s.y, next: when, dir: { x: 0, y: 1 }, face: 0, mode: 'wander', say: '', sayUntil: 0, lastSpot: 0, hugT: 0, puffT: 0, enraged: false, mesh, bubble });
  burst(s.x, .5, s.y, '#5a4030', 12, 1.4);
}

let heartTex: THREE.CanvasTexture | null = null;
function spawnHeart(now: number) {
  if (!heartTex) heartTex = canvasTex(64, 64, (x) => {
    x.fillStyle = '#ff3b4e'; x.beginPath(); x.moveTo(32, 54);
    x.bezierCurveTo(6, 36, 4, 14, 20, 12); x.bezierCurveTo(28, 11, 32, 18, 32, 22);
    x.bezierCurveTo(32, 18, 36, 11, 44, 12); x.bezierCurveTo(60, 14, 58, 36, 32, 54); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
  });
  const br = G.braziers[rnd(G.braziers.length)];
  const spots = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => ({ x: br.x + dx, y: br.y + dy })).filter((s) => walk(s.x, s.y));
  const s = spots[rnd(spots.length)] || { x: br.x, y: br.y };
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
  sp.scale.setScalar(.55); sp.position.set(s.x, .5, s.y); G.levelGroup.add(sp);
  const glow = glowSprite('#ff3b4e', 1.1, .5); sp.add(glow);
  G.heartPickups.push({ x: s.x, y: s.y, s: sp, born: now });
}

function defeat(b: Boss, now: number) {
  b.mode = 'dead'; b.deadT = now; renderBossBar();
  bossSay(b, 'NOOOOOooo…', 2500);
  initAudio(); roar(); setTimeout(roar, 450);
  burst(b.x, 1, b.y, '#ffd27a', 26, 3);
  G.minos.forEach((m) => { if (m.mesh) { burst(m.x, .5, m.y, '#5a4030', 10, 1.2); G.levelGroup.remove(m.mesh); } m.bubble?.remove(); });
  G.minos = [];
  G.darkTarget = 0;
  G.doorOpen = true; setDoorLabel(); gateSound(true, { x: G.exit.x, y: G.exit.y });
  G.bossWins++;
  setTimeout(() => { if (G.boss === b) $('bossBar').classList.remove('on'); }, 3500);
  const firstWin = !G.robeUnlocked;
  if (firstWin) { G.robeUnlocked = true; G.outfit = 'robe'; }
  saveProgress(); renderTrophies();
  if (firstWin) setTimeout(() => G.players.forEach((p, i) => { attachPlayerMesh(p, i); if (p.ghost) ghostLook(p, true); }), 1200);
  G.players.forEach((p) => { if (p.ghost) revive(p, now); });
  showToast(firstWin ? `🏆 You defeated ${BOSS_NAME}! You've earned the Minotaur-Slayer robe. Now escape!` : `🏆 You defeated ${BOSS_NAME}! The exit is open.`, 4200);
}

/** Extra lines for the win screen after a boss fight. */
export function bossRewardText(): string {
  return G.bossWins === 1
    ? `New outfit: the Minotaur-Slayer robe! And trader chests can now hold 👟 winged sandals (10 seconds of super speed).`
    : `${BOSS_NAME} defeated ×${G.bossWins}. The next one will be tougher.`;
}

export function updateBoss(now: number) {
  const b = G.boss; if (!b) return;
  const living = alive();
  // ghosts come back by touching a living teammate
  for (const g of G.players) if (g.ghost) for (const a of living) if (Math.hypot(g.px - a.px, g.py - a.py) < .8) { revive(g, now); break; }
  // braziers hand out fireballs, then relight after a few seconds
  for (const br of G.braziers) {
    const ready = now >= br.readyAt;
    br.torch.fire.visible = ready; br.torch.pool.visible = ready;
    if (!ready) continue;
    const p = living.find((q) => q.x === br.x && q.y === br.y && !q.item);
    if (p) { p.item = 'fireball'; br.readyAt = now + 7000; sfxChestOpen(); burst(br.x, .8, br.y, '#ffb347', 10, 1.2); showToast(`🔥 ${NAMES[G.players.indexOf(p)]} has a fireball. Wait until he's dazed!`, 2000); }
  }
  // heart pickups
  G.heartPickups = G.heartPickups.filter((h) => {
    const p = living.find((q) => q.x === h.x && q.y === h.y && (q.hearts ?? 0) < G.maxHearts);
    if (!p) return true;
    p.hearts = (p.hearts ?? 0) + 1; G.levelGroup.remove(h.s);
    [880, 1175].forEach((f, i) => tone(f, .2, 'triangle', .1, null, i * .08));
    showToast(`❤️ ${NAMES[G.players.indexOf(p)]} got a heart back!`, 1600);
    return false;
  });
  if (G.state !== 'play') return;
  const t = tuning(b.num);
  switch (b.mode) {
    case 'stalk': {
      if (now < b.modeUntil || !living.length) break;
      const p = nearest(b); if (!p) break;
      const line = clearLine(b, p);
      if (line || now - b.stalkStart > t.patience) { startWindup(b, p, now, line); break; }
      if (now >= b.next) {
        b.next = now + t.stalk;
        const { prev } = bfs(b.x, b.y);
        let k = p.y * G.W + p.x; const mk = b.y * G.W + b.x;
        while (prev[k] !== mk && prev[k] !== -1) k = prev[k];
        if (prev[k] === mk) { const nx = k % G.W, ny = (k / G.W) | 0; b.dir = { x: nx - b.x, y: ny - b.y }; b.x = nx; b.y = ny; footstep(asMino(b)); }
      }
      break;
    }
    case 'windup':
      if (now >= b.modeUntil) { b.mode = 'charge'; b.next = now; }
      break;
    case 'charge':
      if (now >= b.next) {
        const nx = b.x + b.dir.x, ny = b.y + b.dir.y;
        if (!walk(nx, ny)) crash(b, now);
        else { b.x = nx; b.y = ny; b.next = now + t.charge; footstep(asMino(b)); }
      }
      break;
    case 'stunned':
    case 'hurt':
      if (now >= b.modeUntil) { b.mode = 'stalk'; b.stalkStart = now; b.modeUntil = now + 500; }
      break;
    case 'dead': break;
  }
  // touching him hurts (unless he's dazed or beaten)
  if (b.mode === 'stalk' || b.mode === 'windup' || b.mode === 'charge') {
    const reach = b.mode === 'charge' ? .95 : .75;
    for (const p of living) if (Math.hypot(b.px - p.px, b.py - p.py) < reach) hurtPlayer(p, now, b.mode === 'charge' ? 'was trampled' : 'was grabbed');
  }
}
// footstep() expects a Minotaur; the boss has the bits it needs
const asMino = (b: Boss) => ({ x: b.x, y: b.y, mode: 'chase' as const }) as unknown as Parameters<typeof footstep>[0];

// ---------- drawing ----------
export function renderBossBar() {
  const b = G.boss; const bar = $('bossBar');
  if (!b) { bar.classList.remove('on'); return; }
  bar.querySelectorAll('i').forEach((seg, k) => seg.classList.toggle('lost', k >= b.hp));
}

export function syncBoss(now: number, dt: number) {
  G.darkness += (G.darkTarget - G.darkness) * Math.min(1, dt * 1.5);
  for (const h of G.heartPickups) { h.s.position.y = .5 + Math.sin(now / 250) * .08; h.s.scale.setScalar(.55 + Math.sin(now / 180) * .05); }
  const b = G.boss; if (!b) return;
  const u = b.mesh.userData, k = Math.min(1, dt * (b.mode === 'charge' ? 22 : 8));
  b.px += (b.x - b.px) * k; b.py += (b.y - b.py) * k;
  const target = Math.atan2(b.dir.x, b.dir.y);
  let d = ((target - b.face + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; b.face += d * Math.min(1, dt * 10);
  const m = b.mesh;
  const moving = Math.abs(b.x - b.px) + Math.abs(b.y - b.py) > .03;
  const sp = b.mode === 'charge' ? 45 : 120, sw = moving ? Math.sin(now / sp) * .6 : 0;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw; u.arms[0].rotation.x = -sw * .8; u.arms[1].rotation.x = sw * .8;
  let y = moving ? Math.abs(Math.sin(now / sp)) * .06 : 0, lean = 0, tilt = 0;
  if (b.mode === 'windup') { lean = .35; y = 0; tilt = Math.sin(now / 30) * .05; u.legs[0].rotation.x = Math.sin(now / 70) * .5; }
  if (b.mode === 'charge') lean = .3;
  if (b.mode === 'stunned') u.head.rotation.z = Math.sin(now / 120) * .4;
  else u.head.rotation.z = 0;
  if (b.mode === 'dead') {
    // topples backwards, then sinks away through the floor
    const t = Math.min(1, (now - b.deadT) / 1100), s = Math.max(0, Math.min(1, (now - b.deadT - 2500) / 2500));
    lean = -t * Math.PI / 2 * .95; y = .15 * t - s * 1.6;
  }
  m.position.set(b.px, y, b.py); m.rotation.set(lean, b.face, tilt, 'YXZ');
  u.eyeMat.color.set(b.mode === 'stunned' || b.mode === 'dead' ? '#552010' : (b.mode === 'windup' || b.mode === 'charge' ? '#ff2200' : '#ff5a1f'));
  const flash = b.flashUntil > now && Math.sin(now / 50) > 0;
  u.mats.forEach((mt) => { mt.emissive.set(flash ? '#ffffff' : '#000000'); mt.emissiveIntensity = flash ? .6 : 1; });
  // speech bubble
  const r = stage.getBoundingClientRect(), fp = fpActive(), pc = fp ? fpCam : camera;
  if (b.say && now < b.sayUntil && !(fp && G.players.length > 1) && (tmpV.set(b.px, 4.2, b.py).project(pc), tmpV.z < 1)) {
    b.bubble.style.display = 'block'; b.bubble.textContent = b.say;
    b.bubble.style.left = ((tmpV.x + 1) / 2 * r.width) + 'px'; b.bubble.style.top = ((1 - tmpV.y) / 2 * r.height) + 'px';
  } else b.bubble.style.display = 'none';
}

export function init() {
  loadProgress();
  document.querySelectorAll<HTMLElement>('[data-outfit]').forEach((btn) => { btn.onclick = () => setOutfit(btn.dataset.outfit === 'classic' ? 'classic' : 'robe'); });
  renderTrophies();
}

