// Higher-detail character models (study). Three tiers:
//   1 = the current in-game models (simple spheres and cylinders)
//   2 = "refined": shaped bodies (lathed torsos, jointed limbs, faces, armour, cloth)
//   3 = "detailed": tier 2 plus painted textures, bump maps, fingers, jewellery and props
// Models face +z, stand on y = 0. Heroes are ~1.0 tall, the Minotaur ~2.0.
import * as THREE from 'three';
import type { MinoParts, HeroParts } from './types';

export type Tier = 1 | 2 | 3;
export type HeroStyle = 'helmet' | 'hair';
export interface HeroSpec { style: HeroStyle; tunic: string; accent: string; hair: string; plume: string }

export const HERO_SPECS: HeroSpec[] = [
  { style: 'helmet', tunic: '#35609e', accent: '#c9a03a', hair: '#3a2414', plume: '#9b2a1c' }, // Theseus
  { style: 'hair', tunic: '#7d3a8c', accent: '#d9a52e', hair: '#2e1a10', plume: '#ffd23f' },   // Ariadne
  { style: 'helmet', tunic: '#2f7d4a', accent: '#c9c2b0', hair: '#4a3020', plume: '#e8e2d0' }, // Perseus
  { style: 'hair', tunic: '#b8642a', accent: '#5a8a3a', hair: '#b0702a', plume: '#5a8a3a' },   // Atalanta
];

// ---------- helpers ----------
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...o });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos?: THREE.Vector3, scale?: THREE.Vector3): THREE.Mesh {
  const o = new THREE.Mesh(g, m); if (pos) o.position.copy(pos); if (scale) o.scale.copy(scale);
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function lathe(profile: [number, number][], seg: number): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
/** Smooth capsule along +y, centred on the origin; total length len + 2r. */
function capsuleGeo(r: number, len: number, seg: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [], n = Math.max(3, seg >> 2);
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, -len / 2 + Math.sin(a) * r)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, len / 2 + Math.sin(a) * r)); }
  return new THREE.LatheGeometry(pts, seg);
}
/** A capsule stretched between two points (arms, legs, fingers). */
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, parent: THREE.Object3D, seg: number, r2?: number): THREE.Mesh {
  const d = b.clone().sub(a), len = d.length();
  const g = r2 === undefined ? capsuleGeo(r, Math.max(.001, len), seg) : lathe([[0, -len / 2 - r], [r * .7, -len / 2 - r * .7], [r, -len / 2], [r2, len / 2], [r2 * .7, len / 2 + r2 * .7], [0, len / 2 + r2]], seg);
  const o = mesh(g, m, parent, a.clone().add(b).multiplyScalar(.5));
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}
/** A tube along a curve whose radius tapers from r0 to r1 (horns, tails, braids, thread). */
function taperTube(points: THREE.Vector3[], r0: number, r1: number, tubular: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular, p = curve.getPointAt(t), r = r0 + (r1 - r0) * t, N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const n = V(c * N.x + s * B.x, c * N.y + s * B.y, c * N.z + s * B.z);
      pos.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z); nor.push(n.x, n.y, n.z); uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
const sphereGeo = (r: number, seg: number) => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 3 >> 2));

/** A joint: rotating `pivot` swings everything added to `inner`, which keeps the model's own coordinates. */
function joint(parent: THREE.Object3D, at: THREE.Vector3): { pivot: THREE.Group; inner: THREE.Group } {
  const pivot = new THREE.Group(); pivot.position.copy(at); parent.add(pivot);
  const inner = new THREE.Group(); inner.position.copy(at).negate(); pivot.add(inner);
  return { pivot, inner };
}

function matKey(m: THREE.Material): string {
  if (m instanceof THREE.MeshStandardMaterial) return ['S', m.color.getHex(), m.map?.uuid, m.bumpMap?.uuid, m.metalness, m.roughness, m.emissive.getHex(), m.transparent, m.opacity, m.side].join('|');
  return m.uuid;
}
/** Merge each group's direct mesh children into one mesh per material, so a character costs a
 *  handful of draw calls instead of ~100. Runs recursively through child groups (joints, head). */
export function bake(group: THREE.Object3D): void {
  for (const c of [...group.children]) if (!(c instanceof THREE.Mesh) && c.children.length) bake(c);
  const meshes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && !c.children.length);
  if (meshes.length < 2) return;
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  for (const m of meshes) {
    m.updateMatrix();
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(m.matrix);
    const mat = m.material as THREE.Material, k = matKey(mat);
    const b = buckets.get(k) ?? { mat, geos: [] }; b.geos.push(geo); buckets.set(k, b);
    group.remove(m); m.geometry.dispose();
  }
  for (const { mat, geos } of buckets.values()) {
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = name === 'uv' ? 2 : 3, total = geos.reduce((n, g) => n + g.attributes[name].count, 0), arr = new Float32Array(total * size);
      let off = 0; for (const g of geos) { arr.set(g.attributes[name].array as Float32Array, off); off += g.attributes[name].count * size; }
      merged.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    }
    geos.forEach((g) => g.dispose());
    const out = new THREE.Mesh(merged, mat); out.castShadow = true; out.receiveShadow = true; group.add(out);
  }
}

// ---------- painted textures (tier 3) ----------
function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeatU = 1, repeatV = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatU, repeatV); t.anisotropy = 4;
  return t;
}
function noise(x: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, size = 2) {
  for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.fillRect(Math.random() * w, Math.random() * h, size, size); }
}
/** Woven cloth with a Greek key (meander) border along the bottom edge. */
function clothTex(base: string, border: string): THREE.CanvasTexture {
  return tex(512, 256, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 512, 256);
    x.globalAlpha = .08; x.fillStyle = '#000';
    for (let y = 0; y < 256; y += 3) x.fillRect(0, y, 512, 1);
    for (let i = 0; i < 512; i += 3) x.fillRect(i, 0, 1, 256);
    x.globalAlpha = 1; noise(x, 512, 256, 3000, .05);
    // folds
    for (let i = 0; i < 512; i += 32) { const g = x.createLinearGradient(i, 0, i + 32, 0); g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(.5, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(i, 0, 32, 256); }
    // meander border near the hem (v=0 is the hem on a lathe whose profile starts at the bottom)
    const y0 = 256 - 46; x.fillStyle = border; x.fillRect(0, y0, 512, 34);
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3;
    for (let i = 0; i < 512; i += 32) {
      x.beginPath(); x.moveTo(i + 4, y0 + 28); x.lineTo(i + 4, y0 + 6); x.lineTo(i + 26, y0 + 6); x.lineTo(i + 26, y0 + 22); x.lineTo(i + 12, y0 + 22); x.lineTo(i + 12, y0 + 14); x.lineTo(i + 20, y0 + 14); x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, y0 - 2, 512, 2); x.fillRect(0, y0 + 34, 512, 2);
  }, 1, 1);
}
function metalTex(base: string): THREE.CanvasTexture {
  return tex(256, 256, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 4000, .08);
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { x.beginPath(); const sx = Math.random() * 256, sy = Math.random() * 256; x.moveTo(sx, sy); x.lineTo(sx + Math.random() * 30 - 15, sy + Math.random() * 6 - 3); x.stroke(); }
    x.fillStyle = 'rgba(40,25,10,.18)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 18, 0, 7); x.fill(); }
  });
}
function furTex(base: string, dark: string): THREE.CanvasTexture {
  return tex(256, 256, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const px = Math.random() * 256, py = Math.random() * 256, l = 4 + Math.random() * 9;
      x.strokeStyle = Math.random() < .5 ? dark : 'rgba(255,230,200,.18)'; x.globalAlpha = .35; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.random() * 3 - 1.5, py + l); x.stroke();
    }
    x.globalAlpha = 1;
  }, 2, 2);
}
function hairTex(base: string): THREE.CanvasTexture {
  return tex(256, 256, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const px = Math.random() * 256; x.strokeStyle = Math.random() < .5 ? 'rgba(0,0,0,.25)' : 'rgba(255,220,180,.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 8, 80, px - 8, 170, px + 4, 256); x.stroke(); }
  }, 2, 1);
}
function hornTex(): THREE.CanvasTexture {
  return tex(256, 64, (x) => {
    const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#8a7a60'); g.addColorStop(.6, '#d9ccb0'); g.addColorStop(1, '#f2ead8');
    x.fillStyle = g; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = 'rgba(60,40,20,.35)'; for (let i = 6; i < 200; i += 7 + Math.random() * 6) { x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 3, 64); x.stroke(); }
  });
}
function leatherTex(base: string): THREE.CanvasTexture {
  return tex(256, 256, (x) => { x.fillStyle = base; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 6000, .1, 1); x.strokeStyle = 'rgba(255,220,170,.25)'; x.setLineDash([6, 5]); x.lineWidth = 2; x.strokeRect(8, 8, 240, 240); });
}

// ---------- heroes ----------
export function makeHero(base: HeroSpec, tier: 2 | 3, robe = false): THREE.Group & { userData: HeroParts } {
  const spec: HeroSpec = robe ? { ...base, tunic: '#8e1f1f', accent: '#d9a52e' } : base;
  const g = new THREE.Group(), hi = tier === 3, S = hi ? 28 : 18;
  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  const skin = std('#e8bf98', { roughness: .65 });
  const tunic = hi ? std('#ffffff', { map: clothTex(spec.tunic, spec.accent), roughness: .9 }) : std(spec.tunic, { roughness: .9 });
  const tunicPlain = std(spec.tunic, { roughness: .9 });
  const bronze = hi ? std('#ffffff', { map: metalTex('#b0843c'), metalness: .75, roughness: .35, bumpMap: metalTex('#888'), bumpScale: .004 }) : std('#b0843c', { metalness: .65, roughness: .38 });
  const leather = hi ? std('#ffffff', { map: leatherTex('#5a3a20'), roughness: .85 }) : std('#5a3a20');
  const hairM = hi ? std('#ffffff', { map: hairTex(spec.hair), roughness: .7 }) : std(spec.hair, { roughness: .7 });
  const accent = std(spec.accent, { metalness: .5, roughness: .4 });
  const helmet = spec.style === 'helmet';

  // legs and sandals
  for (const s of [-1, 1]) {
    const hip = V(s * .06, .4, 0), knee = V(s * .066, .21, .012), ankle = V(s * .066, .055, 0);
    const { pivot, inner: L } = joint(g, hip); legs.push(pivot);
    limb(hip, knee, .042, skin, L, S, .036); limb(knee, ankle, .034, skin, L, S, .028);
    mesh(new THREE.BoxGeometry(.07, .022, .14), leather, L, V(s * .066, .011, .022));
    for (let k = 0; k < (hi ? 3 : 1); k++) mesh(new THREE.TorusGeometry(.031 - k * .002, .005, 6, S), leather, L, V(s * .066, .06 + k * .045, 0)).rotation.x = Math.PI / 2;
    if (helmet) { const gr = mesh(lathe([[.03, .08], [.04, .12], [.041, .18], [.034, .21]], S), bronze, L); gr.position.set(s * .066, 0, .006); }
  }
  // skirt / dress
  const long = !helmet;
  const skirtProfile: [number, number][] = long ? [[.2, .07], [.19, .16], [.165, .3], [.14, .44], [.13, .48]] : [[.19, .27], [.175, .33], [.15, .41], [.135, .47]];
  mesh(lathe(skirtProfile, S + 8), tunic, g);
  if (!hi) mesh(new THREE.TorusGeometry(skirtProfile[0][0], .009, 6, S + 8), accent, g, V(0, skirtProfile[0][1] + .006, 0)).rotation.x = Math.PI / 2;
  if (hi && helmet) { // leather pteruges (strips) over the tunic
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, st = mesh(new THREE.BoxGeometry(.045, .1, .012), leather, g, V(Math.sin(a) * .158, .39, Math.cos(a) * .158)); st.rotation.y = a; st.rotation.x = -.18 * Math.cos(0); }
  }
  // torso (cuirass for helmeted heroes, folded overdress for the others)
  mesh(lathe([[0, .44], [.13, .45], [.145, .52], [.155, .6], [.142, .66], [.085, .705], [0, .712]], S), helmet ? tunicPlain : tunic, g);
  if (helmet) {
    const cu = mesh(lathe([[.138, .47], [.152, .52], [.163, .6], [.16, .645], [.11, .69], [.06, .705]], S), bronze, g); cu.scale.z = .9;
    if (hi) for (const s of [-1, 1]) mesh(sphereGeo(.05, 14), bronze, g, V(s * .055, .6, .118), V(1.1, .8, .45));
  } else {
    mesh(lathe([[.17, .5], [.165, .55], [.155, .62], [.15, .66]], S), std(spec.tunic, { roughness: .9, color: new THREE.Color(spec.tunic).offsetHSL(0, -.05, .08).getStyle() }), g);
    if (hi) mesh(new THREE.TorusGeometry(.11, .006, 6, S), accent, g, V(0, .69, .02)).rotation.x = Math.PI / 2 - .25;
  }
  const belt = mesh(new THREE.TorusGeometry(.142, .013, 8, S), helmet ? leather : accent, g, V(0, .468, 0)); belt.rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.035, .03, .012), accent, g, V(0, .468, .148));

  // arms and hands
  for (const s of [-1, 1]) {
    const sh = V(s * .165, .655, 0), el = V(s * .215, .53, .02), wr = V(s * .225, .41, .055);
    const { pivot, inner: A } = joint(g, sh); arms.push(pivot);
    mesh(sphereGeo(.048, S), helmet ? bronze : skin, A, sh);
    limb(sh, el, .034, skin, A, S, .03); limb(el, wr, .03, skin, A, S, .026);
    if (helmet) mesh(lathe([[.03, -.03], [.034, 0], [.033, .04], [.029, .05]], S), leather, A, V(s * .222, .43, .045)).quaternion.setFromUnitVectors(V(0, 1, 0), el.clone().sub(wr).normalize());
    else if (hi) mesh(new THREE.TorusGeometry(.029, .006, 6, S), accent, A, V(s * .224, .435, .048)).rotation.x = Math.PI / 2;
    const hand = V(s * .228, .385, .065);
    mesh(sphereGeo(.03, S), skin, A, hand, V(.85, 1.1, .7));
    if (hi) { // fingers and thumb
      for (let f = 0; f < 4; f++) limb(V(s * .228 + (f - 1.5) * .011 * s, .365, .07), V(s * .228 + (f - 1.5) * .012 * s, .34, .078), .0065, skin, A, 8);
      limb(V(s * .21, .385, .08), V(s * .205, .365, .095), .007, skin, A, 8);
    }
  }
  // neck and head
  mesh(new THREE.CylinderGeometry(.04, .045, .07, S), skin, g, V(0, .73, 0));
  const head = new THREE.Group(); head.position.set(0, .85, 0); head.scale.setScalar(1.22); g.add(head);
  mesh(sphereGeo(.13, S + 6), skin, head, V(0, 0, 0), V(1, 1.06, 1));
  mesh(sphereGeo(.085, S), skin, head, V(0, -.055, .035), V(1, .9, 1));
  for (const s of [-1, 1]) {
    mesh(sphereGeo(.03, 16), std('#ffffff', { roughness: .3 }), head, V(s * .048, .005, .104), V(.9, 1.05, .55));
    mesh(sphereGeo(.019, 14), std(hi ? '#5a7a4a' : '#20140c', { roughness: .2 }), head, V(s * .048, .002, .118), V(1, 1, .5));
    if (hi) mesh(sphereGeo(.01, 10), std('#0a0604', { roughness: .1 }), head, V(s * .048, .002, .126), V(1, 1, .5));
    mesh(sphereGeo(.006, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), head, V(s * .048 + .008, .012, .129));
    const brow = mesh(new THREE.BoxGeometry(.042, .008, .01), std(spec.hair), head, V(s * .05, .05, .112)); brow.rotation.z = s * .1;
    mesh(sphereGeo(.026, 12), skin, head, V(s * .128, -.005, 0), V(.45, 1, .8));
    if (hi) mesh(sphereGeo(.022, 10), std('#f09a90', { roughness: .8, transparent: true, opacity: .45 }), head, V(s * .07, -.035, .1), V(1, .6, .3));
  }
  mesh(sphereGeo(.018, 12), skin, head, V(0, -.02, .128), V(.9, .8, .8));
  const smile = mesh(new THREE.TorusGeometry(.022, .004, 6, 14, Math.PI), std('#9a4a40'), head, V(0, -.048, .118)); smile.rotation.z = Math.PI;

  if (helmet) {
    // short hair under a Corinthian helmet with cheek guards, nose guard and a horsehair crest
    mesh(new THREE.SphereGeometry(.142, S + 6, 14, 0, Math.PI * 2, 0, Math.PI * .45), bronze, head);
    const band = mesh(new THREE.SphereGeometry(.145, S + 6, 10, Math.PI / 2 + .62, Math.PI * 2 - 1.24, Math.PI * .45, Math.PI * .27), bronze, head);
    (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh(new THREE.BoxGeometry(.022, .07, .012), bronze, head, V(0, .015, .143));
    mesh(new THREE.TorusGeometry(.143, .008, 6, S + 6), bronze, head, V(0, .02, 0)).rotation.x = Math.PI / 2;
    const plume = std(spec.plume, { roughness: 1 });
    const n = hi ? 26 : 13;
    for (let k = 0; k < n; k++) {
      const a = Math.PI * .1 + (k / (n - 1)) * Math.PI * .85, r = .175;
      const st = mesh(new THREE.BoxGeometry(hi ? .03 : .034, hi ? .085 - Math.sin(a) * .02 : .075, hi ? .018 : .032), plume, head, V(0, Math.sin(a) * r, Math.cos(a) * r));
      st.rotation.x = Math.PI / 2 - a;
    }
    mesh(new THREE.BoxGeometry(.018, .03, .3), bronze, head, V(0, .148, -.01)).rotation.x = .05;
    // cape and shield on the back
    const capeGeo = new THREE.PlaneGeometry(.34, .52, 6, 10), p = capeGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, -Math.abs(x) * .25 - (.26 - y) * .12 + Math.sin(x * 30) * .008 * (.26 - y)); p.setX(k, x * (1 + (.26 - y) * .6)); }
    capeGeo.computeVertexNormals();
    const cape = mesh(capeGeo, std(spec.plume, { roughness: .95, side: THREE.DoubleSide }), g, V(0, .42, -.14));
    cape.rotation.x = .08;
    const shield = mesh(lathe([[0, 0], [.11, .008], [.14, .022], [.15, .03], [.152, .036]], S + 6), hi ? std('#ffffff', { map: shieldTex(), metalness: .6, roughness: .4 }) : bronze, g, V(.0, .5, -.2));
    shield.rotation.x = -Math.PI / 2 + .12;
    const sheath = mesh(new THREE.BoxGeometry(.03, .2, .018), leather, g, V(-.17, .38, .05)); sheath.rotation.z = .35;
    mesh(new THREE.BoxGeometry(.06, .012, .02), accent, g, V(-.135, .47, .05)).rotation.z = .35;
  } else {
    // long hair: cap, back volume, side locks and a braid down the back; headband
    mesh(new THREE.SphereGeometry(.139, S + 6, 14, 0, Math.PI * 2, 0, Math.PI * .5), hairM, head, V(0, .008, -.004));
    mesh(sphereGeo(.13, S), hairM, head, V(0, -.04, -.05), V(1.05, 1.15, .8));
    for (const s of [-1, 1]) limb(V(s * .115, -.02, .03), V(s * .13, -.17, .02), .03, hairM, head, S, .02);
    for (let k = 0; k < (hi ? 5 : 3); k++) mesh(sphereGeo(.03, 12), hairM, head, V((k - (hi ? 2 : 1)) * .04, .1, .1), V(1.2, .6, .7));
    const bandM = accent;
    mesh(new THREE.TorusGeometry(.137, .01, 6, S + 6), bandM, head, V(0, .065, 0)).rotation.x = Math.PI / 2 - .15;
    const braidPts = [V(0, .78, -.13), V(0, .7, -.17), V(0, .6, -.18), V(0, .5, -.17), V(.01, .42, -.16)];
    if (hi) { const n = 14; for (let k = 0; k < n; k++) { const t = k / (n - 1), c = new THREE.CatmullRomCurve3(braidPts).getPointAt(t); mesh(sphereGeo(.034 - t * .016, 12), hairM, g, c, V(1, .8, 1)); } mesh(new THREE.TorusGeometry(.016, .006, 6, 12), bandM, g, braidPts[4].clone().add(V(0, -.01, 0))); }
    else mesh(taperTube(braidPts, .032, .016, 16, 8), hairM, g);
    if (hi) { // flower, earrings, necklace
      mesh(sphereGeo(.022, 10), std('#ffd23f'), head, V(.11, .08, .07)); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; mesh(sphereGeo(.016, 8), std('#ffffff'), head, V(.11 + Math.cos(a) * .022, .08 + Math.sin(a) * .022, .068)); }
      for (const s of [-1, 1]) mesh(sphereGeo(.009, 8), accent, head, V(s * .13, -.04, .01));
    }
    // ball of golden thread in her hand, with a strand trailing behind
    const gold = std('#e8b030', { metalness: .4, roughness: .45, emissive: '#3a2400' });
    const R = arms[1].children[0];
    mesh(sphereGeo(.05, S), gold, R, V(.235, .36, .1));
    for (let k = 0; k < (hi ? 4 : 2); k++) mesh(new THREE.TorusGeometry(.05, .004, 6, 20), std('#b07a10'), R, V(.235, .36, .1)).rotation.set(k * .9, k * .6, 0);
    mesh(taperTube([V(.235, .33, .1), V(.22, .22, .05), V(.18, .14, -.02)], .004, .003, 12, 5), gold, R);
  }
  if (robe) { // Minotaur-Slayer robe extras: gold sash, and bronze horns (helmets) or a gold laurel (hair)
    const gold = std('#d9a52e', { metalness: .7, roughness: .35 });
    const sash = mesh(new THREE.BoxGeometry(.04, .36, .012), gold, g, V(0, .57, .15)); sash.rotation.z = .55;
    if (helmet) for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(.022, .12, 10), std('#e8dcc0', { roughness: .5 }), head, V(s * .14, .07, 0)); h.rotation.z = -s * .7; }
    else for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const leaf = mesh(sphereGeo(.018, 8), gold, head, V(Math.sin(a) * .14, .075, Math.cos(a) * .14), V(1.4, .5, .8)); leaf.rotation.y = a; }
  }
  bake(g);
  g.userData = { legs, arms } as HeroParts;
  return g as THREE.Group & { userData: HeroParts };
}
function shieldTex(): THREE.CanvasTexture {
  return tex(256, 256, (x) => {
    x.fillStyle = '#b0843c'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 3000, .08);
    x.strokeStyle = '#6a4a1a'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    // a labrys (double axe), the symbol of Crete
    x.fillStyle = '#5a3612';
    x.fillRect(122, 50, 12, 156);
    x.beginPath(); x.moveTo(128, 90); x.quadraticCurveTo(70, 60, 60, 128); x.quadraticCurveTo(70, 196, 128, 166); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(128, 90); x.quadraticCurveTo(186, 60, 196, 128); x.quadraticCurveTo(186, 196, 128, 166); x.closePath(); x.fill();
  });
}

// ---------- the Minotaur ----------
export function makeMinotaurHD(tier: 2 | 3): THREE.Group & { userData: MinoParts } {
  const root = new THREE.Group(), g = new THREE.Group(), hi = tier === 3, S = hi ? 28 : 18;
  g.scale.setScalar(.87); root.add(g); // same height as the old model so gameplay scales still fit
  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff4a1a' });
  const fur = hi ? std('#ffffff', { map: furTex('#3a2a20', 'rgba(10,6,4,.8)'), bumpMap: furTex('#808080', '#000'), bumpScale: .01, roughness: 1 }) : std('#3a2a20', { roughness: 1 });
  const furD = hi ? std('#ffffff', { map: furTex('#241913', 'rgba(0,0,0,.8)'), roughness: 1 }) : std('#241913', { roughness: 1 });
  const hide = std('#5a4033', { roughness: .85 });
  const horn = hi ? std('#ffffff', { map: hornTex(), roughness: .5 }) : std('#d6c7a8', { roughness: .55 });
  const bronze = hi ? std('#ffffff', { map: metalTex('#9a6a2a'), metalness: .75, roughness: .35 }) : std('#9a6a2a', { metalness: .65, roughness: .4 });
  const leather = hi ? std('#ffffff', { map: leatherTex('#4a3020'), roughness: .85 }) : std('#4a3020');
  const hoofM = std('#141010', { roughness: .5 });

  // digitigrade legs with hooves
  for (const s of [-1, 1]) {
    const hip = V(s * .16, .86, 0), knee = V(s * .18, .55, .13), hock = V(s * .18, .25, -.07), hoof = V(s * .18, .06, .02);
    const { pivot, inner: L } = joint(g, hip); legs.push(pivot);
    limb(hip, knee, .095, fur, L, S, .075); limb(knee, hock, .07, furD, L, S, .05); limb(hock, hoof, .05, furD, L, S, .045);
    mesh(new THREE.CylinderGeometry(.06, .075, .07, S), hoofM, L, V(s * .18, .035, .03));
    if (hi) mesh(new THREE.BoxGeometry(.012, .07, .08), std('#000'), L, V(s * .18, .036, .07));
  }
  // loincloth and belt
  mesh(lathe([[.29, .6], [.27, .7], [.25, .8], [.235, .86]], S + 6), leather, g);
  const flap = mesh(new THREE.BoxGeometry(.18, .32, .015), leather, g, V(0, .6, .25)); flap.rotation.x = .08;
  const belt = mesh(new THREE.TorusGeometry(.245, .025, 8, S + 6), leather, g, V(0, .85, 0)); belt.rotation.x = Math.PI / 2;
  mesh(sphereGeo(.05, 14), bronze, g, V(0, .85, .25), V(1.2, 1, .5));
  // torso: broad chest, narrow waist, pecs and abs
  const torso = mesh(lathe([[0, .82], [.22, .84], [.25, .95], [.31, 1.12], [.345, 1.25], [.31, 1.36], [.19, 1.43], [0, 1.45]], S + 6), fur, g); torso.scale.z = .78;
  for (const s of [-1, 1]) mesh(sphereGeo(.12, S), hide, g, V(s * .12, 1.24, .19), V(1.15, .75, .45));
  for (let r = 0; r < 3; r++) for (const s of [-1, 1]) mesh(sphereGeo(.05, 12), hide, g, V(s * .055, 1.08 - r * .085, .2 - r * .005), V(1, .8, .45));
  // shoulders, pauldron, straps
  for (const s of [-1, 1]) mesh(sphereGeo(.14, S), fur, g, V(s * .37, 1.32, 0));
  const paul = mesh(new THREE.SphereGeometry(.17, S, 10, 0, Math.PI * 2, 0, Math.PI * .5), bronze, g, V(-.38, 1.35, 0)); paul.rotation.z = .5;
  if (hi) for (let k = 0; k < 4; k++) mesh(sphereGeo(.02, 8), bronze, g, V(-.38 + Math.cos(k * 1.6) * .13, 1.42, Math.sin(k * 1.6) * .13));
  const strap = mesh(new THREE.BoxGeometry(.07, .62, .02), leather, g, V(-.04, 1.18, .225)); strap.rotation.z = -.62;
  const strapB = mesh(new THREE.BoxGeometry(.07, .62, .02), leather, g, V(-.04, 1.18, -.2)); strapB.rotation.z = .62;
  // arms with bracers and clawed hands
  for (const s of [-1, 1]) {
    const sh = V(s * .4, 1.3, 0), el = V(s * .5, 1.02, .05), wr = V(s * .52, .76, .13);
    const { pivot, inner: A } = joint(g, sh); arms.push(pivot);
    limb(sh, el, .09, fur, A, S, .078); limb(el, wr, .085, fur, A, S, .065);
    const br = mesh(lathe([[.075, -.06], [.085, -.04], [.088, .04], [.078, .07]], S), bronze, A, el.clone().lerp(wr, .62));
    br.quaternion.setFromUnitVectors(V(0, 1, 0), el.clone().sub(wr).normalize());
    const hand = wr.clone().add(V(s * .01, -.06, .03));
    mesh(sphereGeo(.075, S), hide, A, hand, V(1, 1.1, .85));
    for (let f = 0; f < 3; f++) { const c = mesh(new THREE.ConeGeometry(.014, .06, 8), std('#e8dcc0'), A, hand.clone().add(V((f - 1) * .03, -.07, .05))); c.rotation.x = Math.PI + .4; }
    if (hi) for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(.04, .01, 6, 10), std('#555', { metalness: .9, roughness: .3 }), A, wr.clone().add(V(0, .02 + k * .025, s * 0))).rotation.set(Math.PI / 2, 0, k * 1.2);
  }
  // neck, mane, head
  mesh(lathe([[.17, 1.4], [.15, 1.5], [.13, 1.58]], S), fur, g, V(0, 0, .03));
  const maneN = hi ? 34 : 14;
  for (let k = 0; k < maneN; k++) {
    const a = (k / maneN) * Math.PI * 2, r = .16 + (hi ? Math.random() * .03 : 0);
    const c = mesh(new THREE.ConeGeometry(.045, .16, 6), furD, g, V(Math.cos(a) * r, 1.5 + Math.random() * .03, Math.sin(a) * r * .9 - .02));
    c.lookAt(V(Math.cos(a) * 2, 1.2, Math.sin(a) * 2 - .02)); c.rotateX(Math.PI / 2);
  }
  const head = new THREE.Group(); head.position.set(0, 1.64, .06); head.rotation.x = .12; g.add(head);
  mesh(sphereGeo(.2, S + 6), fur, head, V(0, 0, 0), V(1, .95, 1.08));
  mesh(sphereGeo(.135, S), hide, head, V(0, -.08, .21), V(1.12, .85, 1.15));
  mesh(sphereGeo(.11, S), furD, head, V(0, .075, .15), V(1.5, .45, .7)); // heavy brow
  for (const s of [-1, 1]) {
    mesh(sphereGeo(.024, 10), std('#0a0604'), head, V(s * .05, -.07, .355), V(1, .7, .6));
    const eye = mesh(sphereGeo(.03, 12), eyeMat, head, V(s * .105, .035, .165));
    if (hi) { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ff5a1a', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(.12); eye.add(glow); }
    const ear = mesh(sphereGeo(.08, 14), fur, head, V(s * .21, .02, 0), V(1.5, .5, .75)); ear.rotation.z = s * -.35;
    mesh(sphereGeo(.05, 10), std('#b07a70'), head, V(s * .24, .015, .025), V(1.4, .35, .5)).rotation.z = s * -.35;
    // curving, tapering horns
    mesh(taperTube([V(s * .15, .1, .02), V(s * .3, .15, 0), V(s * .42, .28, .06), V(s * .4, .42, .17), V(s * .33, .48, .23)], .058, .006, hi ? 40 : 20, hi ? 14 : 9), horn, head);
  }
  const ring = mesh(new THREE.TorusGeometry(.05, .011, 8, 18), std('#c9a03a', { metalness: .8, roughness: .3 }), head, V(0, -.15, .34)); ring.rotation.x = -.2;
  mesh(new THREE.TorusGeometry(.05, .008, 6, 14, Math.PI), furD, head, V(0, -.165, .3)).rotation.z = Math.PI;
  // tail with a tuft
  const tailPts = [V(0, .86, -.2), V(0, .7, -.36), V(.04, .48, -.42), V(.08, .3, -.36)];
  mesh(taperTube(tailPts, .03, .014, 20, 8), furD, g);
  mesh(sphereGeo(.05, 12), furD, g, V(.085, .26, -.35), V(.8, 1.4, .8));
  if (hi) { // a labrys (double axe) slung across his back
    const shape = new THREE.Shape(); shape.moveTo(0, -.12); shape.quadraticCurveTo(-.22, -.2, -.24, 0); shape.quadraticCurveTo(-.22, .2, 0, .12); shape.lineTo(0, -.12);
    const blade = new THREE.ExtrudeGeometry(shape, { depth: .02, bevelEnabled: true, bevelSize: .008, bevelThickness: .006, bevelSegments: 2 });
    const axe = new THREE.Group(); axe.position.set(.05, 1.15, -.3); axe.rotation.set(0, 0, .7); g.add(axe);
    mesh(new THREE.CylinderGeometry(.018, .018, 1.0, 10), leather, axe);
    for (const s of [-1, 1]) { const b = mesh(blade, std('#8a8a8a', { metalness: .9, roughness: .3 }), axe, V(0, .38, -.01)); b.scale.x = s; }
  }
  bake(g);
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && !mats.includes(o.material)) mats.push(o.material); });
  root.userData = { legs, arms, head, eyeMat, mats } as MinoParts;
  return root as THREE.Group & { userData: MinoParts };
}

/** Triangle count of everything in a group (for comparing tiers). */
export function triangles(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const geo = c.geometry as THREE.BufferGeometry;
    n += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  });
  return Math.round(n);
}
