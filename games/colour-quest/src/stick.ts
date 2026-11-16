// Stick figures: round white head with an ink outline, ink-line body and limbs that swing.
import * as THREE from 'three';
import { inkMat, shape, stroke } from './scene';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export interface StickParts { legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group; accent: THREE.Mesh[] }
export type Hat = 'none' | 'bun' | 'cap' | 'top' | 'bow' | 'brush';

function joint(parent: THREE.Object3D, at: THREE.Vector3): THREE.Group { const g = new THREE.Group(); g.position.copy(at); parent.add(g); return g; }

/** Height about 1.7. Faces +z. `accent` meshes are white until coloured (a scarf, hat, the paint brush tip). */
export function makeStick(hat: Hat, scale = 1): THREE.Group & { userData: StickParts } {
  const g = new THREE.Group() as THREE.Group & { userData: StickParts };
  const accent: THREE.Mesh[] = [];
  g.add(stroke(V(0, .82, 0), V(0, 1.3, 0), .045)); // body
  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = joint(g, V(s * .06, .82, 0));
    hip.add(stroke(V(0, 0, 0), V(s * .05, -.4, .02), .04), stroke(V(s * .05, -.4, .02), V(s * .06, -.8, 0), .04));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), inkMat); foot.position.set(s * .06, -.8, .05); foot.scale.set(1, .6, 1.6); hip.add(foot);
    legs.push(hip);
    const sh = joint(g, V(s * .05, 1.24, 0));
    sh.add(stroke(V(0, 0, 0), V(s * .2, -.28, 0), .035), stroke(V(s * .2, -.28, 0), V(s * .25, -.56, .06), .035));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), inkMat); hand.position.set(s * .25, -.57, .06); sh.add(hand);
    arms.push(sh);
  }
  const head = joint(g, V(0, 1.52, 0));
  head.add(shape(new THREE.SphereGeometry(.22, 20, 14), undefined, 'hull'));
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), inkMat); e.position.set(s * .075, .03, .2); e.scale.set(1, 1.5, .5); head.add(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 4, 10, Math.PI), inkMat); mouth.position.set(0, -.06, .205); mouth.rotation.z = Math.PI; head.add(mouth);
  head.userData.mouth = mouth;
  // a scarf that gets colour back, and a hat
  const scarf = shape(new THREE.TorusGeometry(.09, .035, 6, 14), '#ffffff'); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.31; g.add(scarf); accent.push(scarf);
  if (hat === 'bun') { const b = shape(new THREE.SphereGeometry(.1, 12, 10), '#ffffff', 'hull'); b.position.set(0, .22, -.08); head.add(b); accent.push(b); }
  if (hat === 'cap') { const c = shape(new THREE.SphereGeometry(.23, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff'); c.position.y = .03; head.add(c); const brim = shape(new THREE.BoxGeometry(.3, .03, .18), '#ffffff'); brim.position.set(0, .05, .24); head.add(brim); accent.push(c, brim); }
  if (hat === 'top') { const t = shape(new THREE.CylinderGeometry(.14, .14, .26, 14), '#ffffff'); t.position.y = .3; head.add(t); const r = shape(new THREE.CylinderGeometry(.24, .24, .03, 16), '#ffffff'); r.position.y = .18; head.add(r); accent.push(t, r); }
  if (hat === 'bow') { for (const s of [-1, 1]) { const b = shape(new THREE.ConeGeometry(.08, .16, 8), '#ffffff'); b.rotation.z = s * Math.PI / 2; b.position.set(s * .1, .22, 0); head.add(b); accent.push(b); } }
  if (hat === 'brush') { // the hero carries a giant paint brush on their back
    const brush = new THREE.Group(); brush.position.set(.12, 1.05, -.14); brush.rotation.z = -.5; g.add(brush);
    brush.add(shape(new THREE.CylinderGeometry(.035, .04, .9, 8)));
    const ferrule = shape(new THREE.CylinderGeometry(.06, .05, .12, 10)); ferrule.position.y = .5; brush.add(ferrule);
    const tip = shape(new THREE.ConeGeometry(.08, .26, 10), '#ffffff'); tip.position.y = .69; brush.add(tip); accent.push(tip);
  }
  g.scale.setScalar(scale);
  g.userData = { legs, arms, head, accent };
  return g;
}

/** Walk/run cycle. `amount` 0..1 (0 = standing). */
export function animateStick(s: THREE.Group & { userData: StickParts }, t: number, amount: number, dt: number) {
  const sw = Math.sin(t * 11) * .9 * amount, e = Math.min(1, dt * 14), { legs, arms } = s.userData;
  legs[0].rotation.x += (sw - legs[0].rotation.x) * e; legs[1].rotation.x += (-sw - legs[1].rotation.x) * e;
  arms[0].rotation.x += (-sw - arms[0].rotation.x) * e; arms[1].rotation.x += (sw - arms[1].rotation.x) * e;
}
