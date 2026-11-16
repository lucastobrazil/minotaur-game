// Renderer, camera, lights, the "ink on paper" look, and the paper ground that colour splats onto.
import * as THREE from 'three';
import { INK, PAPER } from './palette';

export const FOG_NEAR = 22, FOG_FAR = 62;
const cv = document.getElementById('cv') as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
export const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, FOG_NEAR, FOG_FAR);
export const camera = new THREE.PerspectiveCamera(55, 1, .1, 200);
scene.add(new THREE.HemisphereLight('#ffffff', '#a8a294', 1.7));
const sun = new THREE.DirectionalLight('#ffffff', 1.0); sun.position.set(6, 12, 4); scene.add(sun);

export function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- ink ----------
const inkLine = new THREE.LineBasicMaterial({ color: INK });
const inkHull = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
export const inkMat = new THREE.MeshBasicMaterial({ color: INK });

/** A drawable white shape: paintable later by setting `paint` (the colour it gets back). */
export function shape(geo: THREE.BufferGeometry, paint?: string, outline: 'edges' | 'hull' = 'edges'): THREE.Mesh {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  if (paint) m.userData.paint = paint;
  if (outline === 'edges') m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), inkLine));
  else { const h = new THREE.Mesh(geo, inkHull); h.scale.setScalar(1.06); m.add(h); }
  return m;
}
/** A black ink stroke between two points (stick-figure limbs, poles, wires). */
export function stroke(a: THREE.Vector3, b: THREE.Vector3, r = .035): THREE.Mesh {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), inkMat);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

// ---------- the paper ground, with colour splats ----------
export const MAX_SPLATS = 96;
interface Splat { x: number; z: number; r: number; target: number; colour: THREE.Color }
export const splats: Splat[] = [];
const uSplat = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
const uSplatCol = Array.from({ length: MAX_SPLATS }, () => new THREE.Color());
const groundMat = new THREE.ShaderMaterial({
  uniforms: {
    uSplat: { value: uSplat }, uSplatCol: { value: uSplatCol }, uCount: { value: 0 },
    uPaper: { value: new THREE.Color(PAPER) }, uFog: { value: new THREE.Vector2(FOG_NEAR, FOG_FAR) },
  },
  vertexShader: /* glsl */`
    varying vec3 vWorld;
    void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    #define MAX ${MAX_SPLATS}
    uniform vec4 uSplat[MAX]; uniform vec3 uSplatCol[MAX]; uniform int uCount; uniform vec3 uPaper; uniform vec2 uFog;
    varying vec3 vWorld;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 p = vWorld.xz;
      vec3 col = uPaper * (0.95 + 0.05 * noise(p * 3.0)) * (0.97 + 0.03 * noise(p * 0.4));
      for (int i = 0; i < MAX; i++) {
        if (i >= uCount) break;
        vec4 s = uSplat[i];
        if (s.z <= 0.0) continue;
        vec2 d = p - s.xy;
        float ang = atan(d.y, d.x);
        float wob = (noise(vec2(ang * 2.5 + s.w, s.w)) - 0.5) * 0.45 * s.z + (noise(p * 2.0 + s.w) - 0.5) * 0.25;
        float a = 1.0 - smoothstep(s.z - 0.08, s.z + 0.04, length(d) + wob);
        col = mix(col, uSplatCol[i] * (0.92 + 0.08 * noise(p * 6.0 + s.w)), a);
      }
      float fog = smoothstep(uFog.x, uFog.y, length(cameraPosition - vWorld));
      gl_FragColor = vec4(mix(col, uPaper, fog), 1.0);
      #include <colorspace_fragment>
    }`,
});
const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 96), groundMat);
ground.rotation.x = -Math.PI / 2; scene.add(ground);

/** Add a splat of colour on the ground. It grows from `start` to radius r. Returns its index. */
export function addSplat(x: number, z: number, hex: string, r: number, start = r): number {
  if (splats.length >= MAX_SPLATS) splats.shift();
  splats.push({ x, z, r: start, target: r, colour: new THREE.Color(hex) });
  return splats.length - 1;
}
export function updateSplats(dt: number) {
  splats.forEach((s, i) => {
    if (s.r < s.target) s.r = Math.min(s.target, s.r + dt * Math.max(2, s.target * 1.2));
    uSplat[i].set(s.x, s.z, s.r, i * 1.37); uSplatCol[i].copy(s.colour);
  });
  groundMat.uniforms.uCount.value = splats.length;
}
