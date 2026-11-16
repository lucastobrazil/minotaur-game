// Game state and the per-frame update: hero, follow camera, colour drops, quests, Gloomies.
import * as THREE from 'three';
import { addSplat, camera, scene, shape } from './scene';
import { animateStick, makeStick, type Hat, type StickParts } from './stick';
import { colliders, buildWorld, makeCar, makeHouse, makeSlide, makeStall, place, SPOTS, WORLD_R } from './world';
import { COLOUR_IDS, HEX, NAME, type ColourId, type Needs } from './palette';

type Stick = THREE.Group & { userData: StickParts };
export interface Quest {
  id: string; who: string; hat: Hat; target: THREE.Group; npc: Stick; needs: Needs;
  ask: string; thanks: string; done: boolean; paintT: number; x: number; z: number;
}
export interface Drop { colour: ColourId; mesh: THREE.Group; x: number; z: number; t: number }
export interface Gloomy { mesh: THREE.Group; x: number; z: number; tx: number; tz: number; speed: number }
/** act = talk if someone's near, otherwise jump (controller A, Space). talk = talk only (the on-screen A button). */
export interface Input { x: number; y: number; act: boolean; talk?: boolean; jump: boolean; camX: number; recenter: boolean }

const SPEED = 5.2, GRAVITY = 22, JUMP = 7.5, CAM_DIST = 7.5, CAM_H = 3.4, TALK_R = 2.6;

export const game = {
  state: 'title' as 'title' | 'play' | 'won',
  hero: { x: 0, z: 2, y: 0, vy: 0, face: Math.PI, mesh: null as unknown as Stick, hitUntil: 0, lastColour: null as ColourId | null },
  camYaw: 0,
  bag: Object.fromEntries(COLOUR_IDS.map((c) => [c, 0])) as Record<ColourId, number>,
  quests: [] as Quest[],
  drops: [] as Drop[],
  gloomies: [] as Gloomy[],
  near: null as Quest | null,
  message: '' as string,
  messageUntil: 0,
  particles: [] as { m: THREE.Mesh; v: THREE.Vector3; life: number }[],
  time: 0,
  finale: 0,
};

// ---------- setup ----------
export function setup() {
  buildWorld();
  const h = makeStick('brush'); scene.add(h); game.hero.mesh = h;
  const defs: [keyof typeof SPOTS, string, Hat, () => THREE.Group, Needs, string, string][] = [
    ['house', 'Nana Pip', 'bun', makeHouse, { red: 2, yellow: 1 }, 'The Grey took the colour from my house! Could you bring me 2 red and 1 yellow?', 'My lovely red house is back! Thank you, sweetheart!'],
    ['car', 'Zoom', 'cap', makeCar, { blue: 2 }, 'My car is all grey. A car can\'t go fast without colour! I need 2 blue.', 'Vroom vroom! Blue and fast again!'],
    ['stall', 'Mo the Grocer', 'top', makeStall, { red: 1, orange: 1, green: 1 }, 'Nobody wants grey apples! Bring me red, orange and green, please.', 'Fresh, juicy colours! Have an apple!'],
    ['slide', 'Tilly', 'bow', makeSlide, { purple: 1, yellow: 1 }, 'My slide lost its colour and now it\'s boring. Can you find purple and yellow?', 'WHEEEE! Best slide ever!'],
  ];
  for (const [id, who, hat, make, needs, ask, thanks] of defs) {
    const s = SPOTS[id], target = make(); place(target, s.x, s.z, s.ry); colliders.push({ x: s.x, z: s.z, r: s.r });
    const npc = makeStick(hat, .95); place(npc, s.owner[0], s.owner[1], Math.atan2(-s.owner[0], -s.owner[1]));
    npc.userData.head.userData.mouth.rotation.z = 0; // sad until helped
    colliders.push({ x: s.owner[0], z: s.owner[1], r: .4 });
    game.quests.push({ id, who, hat, target, npc, needs, ask, thanks, done: false, paintT: -1, x: s.owner[0], z: s.owner[1] });
  }
  // colour drops: a few more than the quests need, scattered near the splashes of colour
  const counts: Record<ColourId, number> = { red: 4, orange: 2, yellow: 3, green: 2, blue: 3, purple: 2 };
  for (const c of COLOUR_IDS) for (let k = 0; k < counts[c]; k++) spawnDrop(c);
  for (let k = 0; k < 3; k++) spawnGloomy();
}

function freeSpot(minR: number, maxR: number): [number, number] {
  for (let tries = 0; tries < 200; tries++) {
    const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 1.2)) return [x, z];
  }
  return [0, 6];
}
export function spawnDrop(colour: ColourId, at?: [number, number]): Drop {
  const [x, z] = at ?? freeSpot(5, WORLD_R - 3);
  const g = new THREE.Group();
  const blob = shape(new THREE.SphereGeometry(.28, 16, 12), undefined, 'hull');
  (blob.material as THREE.MeshLambertMaterial).color.set(HEX[colour]); (blob.material as THREE.MeshLambertMaterial).emissive.set(HEX[colour]).multiplyScalar(.45);
  blob.scale.set(1, 1.25, 1); g.add(blob);
  const tip = shape(new THREE.ConeGeometry(.17, .3, 12), undefined, 'hull'); tip.position.y = .38;
  (tip.material as THREE.MeshLambertMaterial).color.set(HEX[colour]); (tip.material as THREE.MeshLambertMaterial).emissive.set(HEX[colour]).multiplyScalar(.45); g.add(tip);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: HEX[colour], transparent: true, depthWrite: false, opacity: .55 })); glow.scale.setScalar(1.6); g.add(glow);
  place(g, x, z); g.position.y = .8;
  addSplat(x, z, HEX[colour], .55);
  const d: Drop = { colour, mesh: g, x, z, t: Math.random() * 6 }; game.drops.push(d); return d;
}
let _glow: THREE.Texture | null = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c));
}
export function spawnGloomy(at?: [number, number]): Gloomy {
  const [x, z] = at ?? freeSpot(12, WORLD_R - 2);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(.7, 18, 14), new THREE.MeshLambertMaterial({ color: '#6d6d72', transparent: true, opacity: .88 }));
  body.position.y = .75; g.add(body);
  for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), body.material); const a = k / 6 * Math.PI * 2; p.position.set(Math.cos(a) * .55, .25, Math.sin(a) * .55); g.add(p); }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); e.position.set(s * .22, .95, .58); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#111' })); p.position.set(s * .22, .93, .67); g.add(p); }
  place(g, x, z);
  const gl: Gloomy = { mesh: g, x, z, tx: x, tz: z, speed: 2.1 }; game.gloomies.push(gl); return gl;
}

// ---------- helpers ----------
export const hasAll = (n: Needs) => (Object.keys(n) as ColourId[]).every((c) => game.bag[c] >= (n[c] ?? 0));
export const needText = (n: Needs) => (Object.keys(n) as ColourId[]).map((c) => `${n[c]} ${NAME[c].toLowerCase()}`).join(', ');
function say(text: string, ms = 2600) { game.message = text; game.messageUntil = game.time + ms / 1000; }
function burst(x: number, y: number, z: number, cols: string[], n = 36) {
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5), new THREE.MeshBasicMaterial({ color: cols[k % cols.length] }));
    m.position.set(x, y, z); scene.add(m);
    game.particles.push({ m, v: new THREE.Vector3((Math.random() - .5) * 6, 4 + Math.random() * 5, (Math.random() - .5) * 6), life: 1.4 + Math.random() * .6 });
  }
}
function paintMeshes(root: THREE.Object3D, t: number) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.userData.paint || !(o.material instanceof THREE.MeshLambertMaterial)) return;
    o.material.color.set('#ffffff').lerp(new THREE.Color(o.userData.paint), t);
  });
}

/** Give colours to the quest owner you're next to. */
export function talk(q: Quest) {
  if (q.done) { say(`${q.who}: ${q.thanks}`); return; }
  if (!hasAll(q.needs)) { say(`${q.who}: ${q.ask}`, 4200); return; }
  for (const c of Object.keys(q.needs) as ColourId[]) game.bag[c] -= q.needs[c] ?? 0;
  q.done = true; q.paintT = 0;
  const s = SPOTS[q.id as keyof typeof SPOTS], cols = (Object.keys(q.needs) as ColourId[]).map((c) => HEX[c]);
  cols.forEach((c, i) => addSplat(s.x + (i - 1) * 1.2, s.z + (i % 2) * 1.2, c, 4.5 + i, .2));
  burst(s.x, 2.5, s.z, cols, 60);
  q.npc.userData.head.userData.mouth.rotation.z = Math.PI;
  say(`${q.who}: ${q.thanks}`, 3500);
  if (game.quests.every((x) => x.done)) { game.state = 'won'; game.finale = 0; for (const g of game.gloomies) burst(g.x, 1, g.z, ['#888', '#aaa'], 12); }
}

// ---------- the frame ----------
const tmp = new THREE.Vector3();
export function update(dt: number, inp: Input) {
  game.time += dt;
  const h = game.hero, playing = game.state === 'play' || game.state === 'won';

  // camera-relative movement (pushing up walks away from the camera)
  let mx = 0, mz = 0;
  if (playing) {
    const fx = -Math.sin(game.camYaw), fz = -Math.cos(game.camYaw); // forward = from camera towards hero
    const rx = -fz, rz = fx;
    mx = fx * -inp.y + rx * inp.x; mz = fz * -inp.y + rz * inp.x;
    // (rx, rz) is the camera's right: forward rotated a quarter turn clockwise when seen from above
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  }
  const moving = Math.hypot(mx, mz);
  h.x += mx * SPEED * dt; h.z += mz * SPEED * dt;
  if (moving > .1) { const want = Math.atan2(mx, mz); let d = want - h.face; d = Math.atan2(Math.sin(d), Math.cos(d)); h.face += d * Math.min(1, dt * 12); }
  for (const c of colliders) { const dx = h.x - c.x, dz = h.z - c.z, d = Math.hypot(dx, dz), min = c.r + .35; if (d < min && d > 1e-4) { h.x = c.x + dx / d * min; h.z = c.z + dz / d * min; } }
  const r = Math.hypot(h.x, h.z); if (r > WORLD_R) { h.x *= WORLD_R / r; h.z *= WORLD_R / r; }
  // nearest quest owner: A talks to them, otherwise A jumps
  game.near = game.quests.find((q) => Math.hypot(q.x - h.x, q.z - h.z) < TALK_R) ?? null;
  if (playing && (inp.act || inp.talk) && game.near) talk(game.near);
  else if (playing && (inp.act || inp.jump) && h.y <= 0) h.vy = JUMP;
  h.vy -= GRAVITY * dt; h.y = Math.max(0, h.y + h.vy * dt); if (h.y === 0) h.vy = 0;
  const m = h.mesh; m.position.set(h.x, h.y, h.z); m.rotation.y = h.face;
  animateStick(m, game.time, h.y > 0 ? .3 : moving, dt);
  m.visible = game.time > h.hitUntil || Math.floor(game.time * 12) % 2 === 0;

  // drops: bob, and collect when touched
  for (const d of [...game.drops]) {
    d.t += dt; d.mesh.position.y = .8 + Math.sin(d.t * 2.4) * .15; d.mesh.rotation.y += dt * 1.5;
    if (Math.hypot(d.x - h.x, d.z - h.z) < 1 && h.y < 1.4) {
      game.bag[d.colour]++; h.lastColour = d.colour; scene.remove(d.mesh); game.drops.splice(game.drops.indexOf(d), 1);
      addSplat(d.x, d.z, HEX[d.colour], 1.1, .3); burst(d.x, 1, d.z, [HEX[d.colour]], 14);
      say(`+1 ${NAME[d.colour]}!`, 1200);
      const tip = m.userData.accent[m.userData.accent.length - 1];
      if (tip.material instanceof THREE.MeshLambertMaterial) tip.material.color.set(HEX[d.colour]);
    }
  }
  // Gloomies drift about and chase you when close; touching one knocks a colour out of your bag
  for (const g of game.gloomies) {
    if (game.state === 'won') { g.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 1.5)); continue; }
    const dh = Math.hypot(h.x - g.x, h.z - g.z), chase = playing && dh < 8;
    if (chase) { g.tx = h.x; g.tz = h.z; } else if (Math.hypot(g.tx - g.x, g.tz - g.z) < .5) [g.tx, g.tz] = freeSpot(8, WORLD_R - 2);
    const dx = g.tx - g.x, dz = g.tz - g.z, dl = Math.hypot(dx, dz) || 1, sp = (chase ? g.speed : g.speed * .55) * dt;
    g.x += dx / dl * Math.min(sp, dl); g.z += dz / dl * Math.min(sp, dl);
    g.mesh.position.set(g.x, Math.sin(game.time * 3 + g.speed) * .12, g.z); g.mesh.rotation.y = Math.atan2(dx, dz);
    const sq = 1 + Math.sin(game.time * 5 + g.x) * .06; g.mesh.scale.set(sq, 2 - sq, sq);
    if (playing && dh < 1.1 && h.y < 1 && game.time > h.hitUntil) hitByGloomy();
  }
  // quest owners: look at the hero, bounce when happy; targets fade back into colour
  for (const q of game.quests) {
    const n = q.npc; n.rotation.y = Math.atan2(h.x - q.x, h.z - q.z);
    if (q.done) { n.position.y = Math.abs(Math.sin(game.time * 5 + q.x)) * .35; animateStick(n, game.time * .6, .5, dt); }
    if (q.paintT >= 0 && q.paintT < 1) { q.paintT = Math.min(1, q.paintT + dt * .7); paintMeshes(q.target, q.paintT); paintMeshes(n, q.paintT); }
  }
  // the end: colour floods back into the whole world
  if (game.state === 'won') {
    const before = game.finale; game.finale += dt;
    if (Math.floor(before * 6) !== Math.floor(game.finale * 6) && game.finale < 5) {
      const a = Math.random() * Math.PI * 2, rr = 4 + game.finale * 6, cols = Object.values(HEX);
      addSplat(Math.cos(a) * rr, Math.sin(a) * rr, cols[Math.floor(Math.random() * cols.length)], 5 + Math.random() * 4, .5);
    }
    if (game.finale < 4) scene.traverse((o) => { if (o instanceof THREE.Mesh && o.userData.paint && o.material instanceof THREE.MeshLambertMaterial && Math.hypot(o.getWorldPosition(tmp).x, tmp.z) < game.finale * 10) o.material.color.lerp(new THREE.Color(o.userData.paint), dt * 2); });
  }
  // particles
  for (const p of [...game.particles]) {
    p.life -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < .05) { p.m.position.y = .05; p.v.set(0, 0, 0); }
    if (p.life <= 0) { scene.remove(p.m); game.particles.splice(game.particles.indexOf(p), 1); }
  }

  // Zelda-style camera: trails behind and swings round lazily as you turn; right stick turns it, L recentres
  const cx = camera.position.x - h.x, cz = camera.position.z - h.z;
  if (Math.hypot(cx, cz) > .5) game.camYaw = Math.atan2(cx, cz);
  game.camYaw -= inp.camX * dt * 2.4;
  if (inp.recenter) { let d = (h.face + Math.PI) - game.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); game.camYaw += d * Math.min(1, dt * 8); }
  const want = new THREE.Vector3(h.x + Math.sin(game.camYaw) * CAM_DIST, CAM_H + h.y * .4, h.z + Math.cos(game.camYaw) * CAM_DIST);
  camera.position.lerp(want, Math.min(1, dt * 6));
  camera.lookAt(h.x, 1.3 + h.y * .5, h.z);
  // hide trees, rocks and lamps standing between the camera and the hero
  const ax = camera.position.x, az = camera.position.z, bx = h.x - ax, bz = h.z - az, bl = bx * bx + bz * bz || 1;
  for (const c of colliders) {
    if (!c.obj) continue;
    const t = Math.max(0, Math.min(1, ((c.x - ax) * bx + (c.z - az) * bz) / bl));
    const d = Math.hypot(ax + bx * t - c.x, az + bz * t - c.z);
    c.obj.visible = !(t > .02 && t < .92 && d < c.r + 1.1);
  }
}

function hitByGloomy() {
  const h = game.hero; h.hitUntil = game.time + 2;
  const owned = COLOUR_IDS.filter((c) => game.bag[c] > 0);
  burst(h.x, 1.2, h.z, ['#777', '#999', '#555'], 18);
  if (!owned.length) { say('Brrr, a Gloomy! Stay away from the grey!', 1800); return; }
  const c = owned[Math.floor(Math.random() * owned.length)]; game.bag[c]--;
  const a = Math.random() * Math.PI * 2; spawnDrop(c, [h.x + Math.cos(a) * 3.5, h.z + Math.sin(a) * 3.5]);
  say(`A Gloomy knocked your ${NAME[c].toLowerCase()} away! Grab it back!`, 2200);
}

/** Put the camera straight behind the hero (on start). */
export function snapCamera() {
  const h = game.hero; game.camYaw = h.face + Math.PI;
  camera.position.set(h.x + Math.sin(game.camYaw) * CAM_DIST, CAM_H, h.z + Math.cos(game.camYaw) * CAM_DIST); camera.lookAt(h.x, 1.3, h.z);
}
