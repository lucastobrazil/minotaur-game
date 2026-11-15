// Character lab: compare detail tiers of the heroes and the Minotaur in game-like torchlight.
// URL params (used by the render script): ?shot&char=theseus|ariadne|perseus|atalanta|minotaur|all&tier=1|2|3&view=near|game|fp&yaw=deg
import * as THREE from 'three';
import { makePlayerClassic as makePlayer, makeMinoClassic as makeMino } from './scene';
import { HERO_SPECS, makeHero, makeMinotaurHD, triangles, type Tier } from './characters';
import * as textures from './textures';
import { WALLTEX } from './textures';

textures.init();

type CharId = 'theseus' | 'ariadne' | 'perseus' | 'atalanta' | 'minotaur' | 'all';
type View = 'near' | 'game' | 'fp';
const CHARS: CharId[] = ['theseus', 'ariadne', 'perseus', 'atalanta', 'minotaur', 'all'];
const LABEL: Record<CharId, string> = { theseus: 'Theseus', ariadne: 'Ariadne', perseus: 'Perseus', atalanta: 'Atalanta', minotaur: 'Minotaur', all: 'Line-up' };
const TIER_NAME: Record<Tier, string> = { 1: 'Current', 2: 'Refined', 3: 'Detailed' };

const q = new URLSearchParams(location.search);
const shot = q.has('shot');
if (shot) document.body.classList.add('shot');
let char: CharId = (CHARS as string[]).includes(q.get('char') ?? '') ? q.get('char') as CharId : 'all';
let tier: Tier = (Number(q.get('tier')) || 2) as Tier;
let view: View = (q.get('view') as View) || 'near';
let yaw = Number(q.get('yaw') ?? 30) * Math.PI / 180;
let spin = !shot;

const cv = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#161a28'); scene.fog = new THREE.Fog('#161a28', 9, 26);
const camera = new THREE.PerspectiveCamera(40, 1, .05, 100);

// set: stone floor, two maze walls and a torch, lit like the game (moonlight + warm torch + hemisphere)
scene.add(new THREE.HemisphereLight('#8a9ac8', '#3a2c20', .55));
const moon = new THREE.DirectionalLight('#b8c8ff', .55); moon.position.set(-4, 8, 5); moon.castShadow = true; moon.shadow.bias = -.0008;
moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(moon);
const torch = new THREE.PointLight('#ffa050', 2.2, 9, 1.6); torch.position.set(2.2, 2.4, 1.6); torch.castShadow = true; torch.shadow.bias = -.002; scene.add(torch);
const fill = new THREE.PointLight('#ff8a40', .6, 8, 2); fill.position.set(-2.5, 1.2, 2.5); scene.add(fill);
const floorTex = WALLTEX.clone(); floorTex.needsUpdate = true; floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#6a5e50', map: floorTex, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wallTex = WALLTEX.clone(); wallTex.needsUpdate = true; wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 1.4);
const wallM = new THREE.MeshStandardMaterial({ color: '#9a8a78', map: wallTex, roughness: 1 });
const back = new THREE.Mesh(new THREE.BoxGeometry(12, 2.8, .6), wallM); back.position.set(0, 1.4, -2.4); back.receiveShadow = true; scene.add(back);
const side = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.8, 6), wallM); side.position.set(-4.2, 1.4, .3); side.receiveShadow = true; scene.add(side);
const flame = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffcc66' })); flame.position.set(2.2, 2.35, -2.05); scene.add(flame);
const bracket = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .35, 8), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); bracket.position.set(2.2, 2.15, -2.05); scene.add(bracket);

// model building
const HERO_IDX: Partial<Record<CharId, number>> = { theseus: 0, ariadne: 1, perseus: 2, atalanta: 3 };
/** Height each character has in the game (current models at in-game scale). */
function fitHeight(o: THREE.Object3D, h: number) {
  const b = new THREE.Box3().setFromObject(o), cur = b.max.y - b.min.y;
  o.scale.multiplyScalar(h / cur);
}
function build(id: CharId, t: Tier): THREE.Group {
  const g = new THREE.Group();
  if (id === 'minotaur') {
    const m = t === 1 ? makeMino() : makeMinotaurHD(t);
    const ref = makeMino(); ref.scale.setScalar(1.15); const rb = new THREE.Box3().setFromObject(ref);
    if (t === 1) m.scale.setScalar(1.15); else fitHeight(m, (rb.max.y - rb.min.y) * 1.08);
    g.add(m);
  } else {
    const i = HERO_IDX[id] ?? 0;
    const h = t === 1 ? makePlayer(i) : makeHero(HERO_SPECS[i], t);
    // drop the gameplay point light that makePlayer adds so the comparison is lit the same
    h.traverse((o) => { if (o instanceof THREE.PointLight) o.visible = false; });
    const ref = makePlayer(i); ref.scale.setScalar(1.3); const rb = new THREE.Box3().setFromObject(ref);
    if (t === 1) h.scale.setScalar(1.3); else fitHeight(h, rb.max.y - rb.min.y);
    g.add(h);
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

let current = new THREE.Group(); scene.add(current);
let tris = 0, modelH = 1;
function rebuild() {
  scene.remove(current);
  current.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); } });
  current = new THREE.Group();
  if (char === 'all') {
    const ids: CharId[] = ['theseus', 'ariadne', 'minotaur', 'perseus', 'atalanta'];
    const xs = [-1.9, -.95, 0, .95, 1.9];
    ids.forEach((id, k) => { const m = build(id, tier); m.position.x = xs[k]; m.position.z = id === 'minotaur' ? -.5 : 0; m.rotation.y = (k - 2) * -.18; current.add(m); });
  } else current.add(build(char, tier));
  scene.add(current);
  const bb = new THREE.Box3().setFromObject(current); modelH = bb.max.y - bb.min.y;
  tris = 0; current.children.forEach((c) => { tris = Math.max(tris, triangles(c)); });
  info();
}

function frame() {
  const big = char === 'minotaur', all = char === 'all', H = modelH;
  const target = new THREE.Vector3(0, H * .52, 0);
  let dist = all ? 6.4 : H * 1.75 + .4, h = all ? 1.7 : H * .7;
  camera.fov = 40;
  if (view === 'game') { dist = 9; h = 9.5; camera.fov = 50; target.y = .5; } // like the close follow camera
  if (view === 'fp') { dist = big ? 3.2 : 1.9; h = .9; camera.fov = 70; target.y = big ? 1.6 : .75; } // first-person eye height
  camera.position.set(Math.sin(yaw) * dist, h, Math.cos(yaw) * dist).add(new THREE.Vector3(target.x, 0, target.z));
  if (view === 'game') camera.position.set(0, h, dist * .45);
  camera.lookAt(target); camera.updateProjectionMatrix();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ui
const $ = (id: string) => document.getElementById(id)!;
function btn(parent: string, label: string, on: boolean, fn: () => void) {
  const b = document.createElement('button'); b.textContent = label; if (on) b.className = 'on'; b.onclick = fn; $(parent).appendChild(b);
}
function ui() {
  for (const id of ['chars', 'tiers', 'opts']) $(id).innerHTML = '';
  CHARS.forEach((c) => btn('chars', LABEL[c], c === char, () => { char = c; ui(); rebuild(); }));
  ([1, 2, 3] as Tier[]).forEach((t) => btn('tiers', `${t} · ${TIER_NAME[t]}`, t === tier, () => { tier = t; ui(); rebuild(); }));
  (['near', 'game', 'fp'] as View[]).forEach((v) => btn('opts', { near: 'Close-up', game: 'Game camera', fp: 'First person' }[v], v === view, () => { view = v; ui(); }));
  btn('opts', spin ? 'Stop spin' : 'Spin', spin, () => { spin = !spin; ui(); });
}
function info() {
  const note: Record<Tier, string> = {
    1: 'What the game uses today: spheres and cylinders, flat colours.',
    2: 'Shaped bodies, jointed arms and legs, faces, armour, cloth and props. Flat colours, no extra textures.',
    3: 'Refined plus painted textures (woven cloth with a Greek key hem, fur, horn rings, hammered bronze, leather), fingers, eye detail and extra props.',
  };
  $('info').innerHTML = `<b>${LABEL[char]} · ${TIER_NAME[tier]}</b><br>${note[tier]}<br>About ${tris.toLocaleString()} triangles per character. Drag to rotate.`;
}
let drag: number | null = null;
cv.addEventListener('pointerdown', (e) => { drag = e.clientX; spin = false; ui(); });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (drag !== null) { yaw -= (e.clientX - drag) * .01; drag = e.clientX; } });
addEventListener('resize', resize);

resize(); ui(); rebuild();
let last = performance.now();
function loop(now: number) {
  const dt = (now - last) / 1000; last = now;
  if (spin && char !== 'all') yaw += dt * .5;
  torch.intensity = 2.2 + Math.sin(now * .011) * .12 + Math.sin(now * .023) * .08;
  frame(); renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
(window as unknown as { labReady: boolean; labTris: () => number }).labReady = true;
(window as unknown as { labTris: () => number }).labTris = () => tris;
