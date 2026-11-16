// The village: everything starts paper-white with ink outlines. Quest targets get their colour back.
import * as THREE from 'three';
import { addSplat, scene, shape, stroke } from './scene';
import { HEX } from './palette';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Solid things you bump into. `obj` (trees, rocks, lamps) is hidden when it blocks the camera's view. */
export interface Circle { x: number; z: number; r: number; obj?: THREE.Object3D }
export const colliders: Circle[] = [];
export const WORLD_R = 34;

function place(o: THREE.Object3D, x: number, z: number, ry = 0) { o.position.set(x, 0, z); o.rotation.y = ry; scene.add(o); return o; }

// ---------- quest targets ----------
export function makeHouse(): THREE.Group {
  const g = new THREE.Group();
  const walls = shape(new THREE.BoxGeometry(4, 2.6, 3.6), HEX.red); walls.position.y = 1.3; g.add(walls);
  const roof = shape(new THREE.ConeGeometry(3.4, 1.8, 4), HEX.yellow); roof.position.y = 3.5; roof.rotation.y = Math.PI / 4; roof.scale.z = .9; g.add(roof);
  const door = shape(new THREE.BoxGeometry(.9, 1.6, .1), '#8a2a10'); door.position.set(0, .8, 1.82); g.add(door);
  for (const s of [-1, 1]) { const w = shape(new THREE.BoxGeometry(.8, .7, .1), '#9fd8ff'); w.position.set(s * 1.3, 1.6, 1.82); g.add(w); }
  const chim = shape(new THREE.BoxGeometry(.45, 1.1, .45), HEX.red); chim.position.set(1, 3.8, -.6); g.add(chim);
  return g;
}
export function makeCar(): THREE.Group {
  const g = new THREE.Group();
  const body = shape(new THREE.BoxGeometry(3.6, .8, 1.7), HEX.blue); body.position.y = .75; g.add(body);
  const cab = shape(new THREE.BoxGeometry(1.9, .7, 1.5), HEX.blue); cab.position.set(-.2, 1.5, 0); g.add(cab);
  for (const s of [-1, 1]) { const w = shape(new THREE.BoxGeometry(1.5, .45, .05), '#bfe6ff'); w.position.set(-.2, 1.55, s * .76); g.add(w); }
  for (const [x, z] of [[1.15, .85], [-1.15, .85], [1.15, -.85], [-1.15, -.85]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .3, 16), new THREE.MeshLambertMaterial({ color: '#2a2a2a' })); wh.rotation.x = Math.PI / 2; wh.position.set(x, .38, z); g.add(wh);
    const hub = shape(new THREE.CylinderGeometry(.16, .16, .32, 10), '#d8d8d8'); hub.rotation.x = Math.PI / 2; hub.position.set(x, .38, z); g.add(hub);
  }
  for (const s of [-1, 1]) { const l = shape(new THREE.BoxGeometry(.06, .2, .35), '#fff36a'); l.position.set(1.81, .85, s * .55); g.add(l); }
  return g;
}
export function makeStall(): THREE.Group {
  const g = new THREE.Group();
  const table = shape(new THREE.BoxGeometry(3.4, .9, 1.4), '#c47a3a'); table.position.y = .45; g.add(table);
  for (const s of [-1, 1]) g.add(stroke(V(s * 1.6, .9, -.6), V(s * 1.6, 2.6, -.6), .05), stroke(V(s * 1.6, .9, .6), V(s * 1.6, 2.4, .9), .05));
  for (let k = 0; k < 6; k++) { const st = shape(new THREE.BoxGeometry(.58, .06, 1.7), k % 2 ? '#ffffff' : HEX.green); st.position.set(-1.45 + k * .58, 2.5, .15); st.rotation.x = -.18; g.add(st); }
  const fruit: [string, number][] = [[HEX.red, -1.05], [HEX.orange, 0], [HEX.green, 1.05]];
  for (const [col, x] of fruit) {
    const crate = shape(new THREE.BoxGeometry(.9, .3, .9), '#9a5a2a'); crate.position.set(x, 1.05, 0); g.add(crate);
    for (let k = 0; k < 5; k++) { const f = shape(new THREE.SphereGeometry(.15, 10, 8), col, 'hull'); f.position.set(x + (k % 3 - 1) * .25, 1.3 + (k > 2 ? .15 : 0), (k % 2 - .5) * .3); g.add(f); }
  }
  return g;
}
export function makeSlide(): THREE.Group {
  const g = new THREE.Group();
  const deck = shape(new THREE.BoxGeometry(1.4, .15, 1.4), HEX.yellow); deck.position.set(0, 2.2, 0); g.add(deck);
  for (const [x, z] of [[-.65, -.65], [.65, -.65], [-.65, .65], [.65, .65]]) g.add(stroke(V(x, 0, z), V(x, 2.2, z), .06));
  for (let k = 0; k < 6; k++) g.add(stroke(V(-.65, .3 + k * .33, -.65), V(.65, .3 + k * .33, -.65), .04));
  const slideGeo = new THREE.BoxGeometry(1.1, .08, 3.4);
  const slide = shape(slideGeo, HEX.purple); slide.position.set(0, 1.15, 2.3); slide.rotation.x = .62; g.add(slide);
  for (const s of [-1, 1]) { const rail = shape(new THREE.BoxGeometry(.08, .25, 3.4), HEX.purple); rail.position.set(s * .58, 1.3, 2.3); rail.rotation.x = .62; g.add(rail); }
  const roof = shape(new THREE.ConeGeometry(1.1, .8, 4), HEX.yellow); roof.position.y = 3.3; roof.rotation.y = Math.PI / 4; g.add(roof);
  for (const [x, z] of [[-.65, -.65], [.65, -.65], [-.65, .65], [.65, .65]]) g.add(stroke(V(x, 2.2, z), V(x, 2.9, z), .04));
  return g;
}

// ---------- decoration ----------
function tree(x: number, z: number, s = 1) {
  const g = new THREE.Group();
  const trunk = shape(new THREE.CylinderGeometry(.18, .26, 1.8, 8), '#8a5a30'); trunk.position.y = .9; g.add(trunk);
  for (const [cx, cy, cz, r] of [[0, 2.4, 0, 1.0], [.6, 2.1, .2, .7], [-.55, 2.2, -.2, .75], [0, 2.9, .1, .7]]) { const c = shape(new THREE.SphereGeometry(r, 14, 10), HEX.green, 'hull'); c.position.set(cx, cy, cz); g.add(c); }
  g.scale.setScalar(s); place(g, x, z, Math.random() * 6); colliders.push({ x, z, r: .5 * s, obj: g });
  return g;
}
function rock(x: number, z: number, s: number) { const r = shape(new THREE.DodecahedronGeometry(.5, 0)); r.scale.set(s, s * .6, s); r.position.set(x, .2 * s, z); r.rotation.y = x; scene.add(r); colliders.push({ x, z, r: .45 * s, obj: r }); }
function lamp(x: number, z: number) {
  const g = new THREE.Group(); g.add(stroke(V(0, 0, 0), V(0, 3, 0), .05), stroke(V(0, 3, 0), V(.5, 3.2, 0), .04));
  const b = shape(new THREE.SphereGeometry(.16, 10, 8), '#fff6a0', 'hull'); b.position.set(.55, 3.05, 0); g.add(b);
  place(g, x, z, Math.random() * 6); colliders.push({ x, z, r: .2, obj: g });
}
/** Flowers: most are paper-white; a few kept their colour (remnants the Grey missed). */
function flower(x: number, z: number, col?: string) {
  const g = new THREE.Group(); g.add(stroke(V(0, 0, 0), V(0, .45, 0), .02));
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const p = shape(new THREE.SphereGeometry(.07, 8, 6), undefined, 'hull'); p.position.set(Math.cos(a) * .09, .48, Math.sin(a) * .09); if (col) (p.material as THREE.MeshLambertMaterial).color.set(col); g.add(p); }
  place(g, x, z);
}
function fence(x: number, z: number, len: number, ry: number) {
  const g = new THREE.Group();
  for (let k = 0; k <= len; k++) g.add(stroke(V(k - len / 2, 0, 0), V(k - len / 2, .9, 0), .04));
  g.add(stroke(V(-len / 2, .7, 0), V(len / 2, .7, 0), .03), stroke(V(-len / 2, .35, 0), V(len / 2, .35, 0), .03));
  place(g, x, z, ry);
}

export function buildWorld() {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const keep = (x: number, z: number) => Math.hypot(x, z) > 5 && [[-10, -10], [10, -7], [-11, 9], [11, 10]].every(([qx, qz]) => Math.hypot(x - qx, z - qz) > 5);
  let n = 0;
  while (n < 26) { const a = rnd(0, Math.PI * 2), r = rnd(8, WORLD_R - 1), x = Math.cos(a) * r, z = Math.sin(a) * r; if (keep(x, z) && colliders.every((c) => Math.hypot(c.x - x, c.z - z) > 3)) { tree(x, z, rnd(.85, 1.3)); n++; } }
  for (let k = 0; k < 10; k++) { const a = rnd(0, 6.28), r = rnd(6, WORLD_R), x = Math.cos(a) * r, z = Math.sin(a) * r; if (keep(x, z)) rock(x, z, rnd(.7, 1.6)); }
  for (const [x, z] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) lamp(x, z);
  const cols = Object.values(HEX);
  for (let k = 0; k < 70; k++) { const a = rnd(0, 6.28), r = rnd(3, WORLD_R), x = Math.cos(a) * r, z = Math.sin(a) * r; flower(x, z, Math.random() < .12 ? cols[k % cols.length] : undefined); }
  fence(-10, -14.5, 6, 0); fence(-14.5, -10, 6, Math.PI / 2); fence(14, 13.5, 5, 0);
  // the village square: a ring of stepping stones and a well
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const s = shape(new THREE.CylinderGeometry(.35, .38, .06, 10)); s.position.set(Math.cos(a) * 3, .03, Math.sin(a) * 3); scene.add(s); }
  const well = new THREE.Group(); const wb = shape(new THREE.CylinderGeometry(.8, .85, .7, 16)); wb.position.y = .35; well.add(wb);
  for (const s of [-1, 1]) well.add(stroke(V(s * .7, .7, 0), V(s * .7, 1.9, 0), .05));
  const wr = shape(new THREE.ConeGeometry(1.1, .6, 4), '#5aa0ff'); wr.position.y = 2.1; wr.rotation.y = Math.PI / 4; well.add(wr);
  place(well, 0, -1.5 - 3.5); colliders.push({ x: 0, z: -5, r: 1 });
  // splashes of colour the Grey missed
  for (let k = 0; k < 14; k++) { const a = rnd(0, 6.28), r = rnd(6, WORLD_R - 4); addSplat(Math.cos(a) * r, Math.sin(a) * r, cols[k % cols.length], rnd(.5, 1.3)); }
}

/** Quest spots: where each target and its owner stand. */
export const SPOTS = {
  house: { x: -10, z: -10, ry: .5, owner: [-7.4, -7.4] as [number, number], r: 2.8 },
  car: { x: 10, z: -7, ry: -.4, owner: [7.6, -5] as [number, number], r: 2.2 },
  stall: { x: -11, z: 9, ry: 2.4, owner: [-8.6, 6.8] as [number, number], r: 2 },
  slide: { x: 11, z: 10, ry: -2.3, owner: [8.6, 7.6] as [number, number], r: 2 },
};
export { place };
