// Star Catch: the starter game every new game is copied from.
// Shows the basics wired together: players join with their controllers (kit), a Three.js scene,
// a game loop, a HUD, and a debug bridge so the headless tests can drive it.
import './style.css';
import * as THREE from 'three';
import { Players, type Joined } from 'kit/players';

const COLORS = ['#4f8ef7', '#c85cf0', '#4fc86a', '#f0a03c'];
const ARENA = 8;
const SPEED = 4;

// ---------- scene ----------
const cv = document.getElementById('cv') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#10131c');
const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
camera.position.set(0, 13, 10); camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#bcd0ff', '#302820', 1.2));
const sun = new THREE.DirectionalLight('#fff2dd', 2.2); sun.position.set(4, 10, 6); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA + .6, 64), new THREE.MeshStandardMaterial({ color: '#3a4256', roughness: .9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- state ----------
interface Hero { j: Joined; mesh: THREE.Mesh; x: number; z: number; score: number }
const players = new Players(4);
const game = {
  state: 'join' as 'join' | 'play',
  heroes: [] as Hero[],
  star: new THREE.Vector3(),
};
const star = new THREE.Mesh(new THREE.OctahedronGeometry(.4), new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#7a5a00' }));
star.castShadow = true; scene.add(star);

function placeStar() {
  const a = Math.random() * Math.PI * 2, r = Math.random() * (ARENA - 1);
  game.star.set(Math.cos(a) * r, .6, Math.sin(a) * r);
}
function addHero(j: Joined): Hero {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(.35, .5, 6, 16), new THREE.MeshStandardMaterial({ color: COLORS[j.slot] }));
  mesh.castShadow = true; scene.add(mesh);
  const a = j.slot * Math.PI / 2;
  return { j, mesh, x: Math.cos(a) * 2, z: Math.sin(a) * 2, score: 0 };
}

// ---------- screens ----------
const $ = (id: string) => document.getElementById(id)!;
function renderSlots() {
  $('slots').innerHTML = [0, 1, 2, 3].map((s) => {
    const j = players.joined.find((p) => p.slot === s);
    return `<div class="slot ${j ? 'on' : ''}" style="border-color:${COLORS[s]}"><b>Player ${s + 1}</b>${j ? j.label : 'Press a button'}</div>`;
  }).join('');
}
function start() {
  if (!players.joined.length) return;
  game.heroes = players.joined.map(addHero);
  placeStar(); game.state = 'play';
  $('join').classList.add('hidden');
}
function renderHud() {
  $('hud').innerHTML = game.heroes.map((h) => `<span class="pill" style="color:${COLORS[h.j.slot]}">P${h.j.slot + 1}: ${h.score} ⭐</span>`).join('');
}

// ---------- loop ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  players.update();
  if (game.state === 'join') {
    if (players.acceptJoins().length) renderSlots();
    if (players.startPressed()) start();
  } else {
    for (const h of game.heroes) {
      const inp = players.input(h.j);
      const len = Math.hypot(inp.x, inp.y) || 1, k = Math.min(1, len);
      h.x += inp.x / len * k * SPEED * dt; h.z += inp.y / len * k * SPEED * dt;
      const r = Math.hypot(h.x, h.z); if (r > ARENA) { h.x *= ARENA / r; h.z *= ARENA / r; }
      h.mesh.position.set(h.x, .6, h.z);
      if (Math.hypot(h.x - game.star.x, h.z - game.star.z) < .8) { h.score++; placeStar(); }
    }
    renderHud();
  }
  star.position.copy(game.star); star.position.y = .6 + Math.sin(now / 300) * .15; star.rotation.y = now / 600;
  renderer.render(scene, camera);
  players.endFrame();
  requestAnimationFrame(frame);
}
renderSlots();
requestAnimationFrame(frame);

// Test/debug bridge: on file:// or with ?debug, expose the game to the headless tests.
if (location.protocol === 'file:' || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { game, players, placeStar });
}
