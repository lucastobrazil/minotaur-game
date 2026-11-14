// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { heroStep, sfx } from './ambience';
import { roar } from './audio';
import { win } from './controllers';
import { STEP } from './core';
import { showToast, updateHUD } from './hud';
import { checkHug, say } from './items';
import { computeSight, gateSound } from './level';
import { canStep } from './maze';
import { setDoorLabel } from './scene';

/* ---------- game logic ---------- */
export function addTrail(p,ax,ay,bx,by){
  const s=new THREE.Mesh(p.segGeo,p.segMat);
  s.position.set((ax+bx)/2,.02,(ay+by)/2);if(ax!==bx)s.rotation.y=Math.PI/2;
  p.trail.add(s);if(p.trail.children.length>900)p.trail.remove(p.trail.children[0]);
}
export function tryMove(p,d,now){
  let cands;
  if(d.x&&d.y)cands=p.last.x?[{x:0,y:d.y},{x:d.x,y:0}]:[{x:d.x,y:0},{x:0,y:d.y}];
  else cands=[d];
  for(const c of cands){
    const nx=p.x+c.x,ny=p.y+c.y;
    if(!canStep(nx,ny))continue;
    addTrail(p,p.x,p.y,nx,ny);
    p.x=nx;p.y=ny;p.last=c;p.next=now+(p.sprinting?82:STEP);computeSight();heroStep(p,G.players.indexOf(p));
    for(const t of G.threads)if(!t.taken&&t.x===nx&&t.y===ny){
      t.taken=true;t.popT=now;G.got++;sfx.pickup();updateHUD();
      if(G.got>=G.needed){G.doorOpen=true;sfx.door();gateSound(true,{x:G.exit.x,y:G.exit.y});G.minos.forEach(m=>{m.enraged=true;m.lastSpot=0});setTimeout(()=>{if(G.state==='play'){roar();G.minos.forEach(m=>say(m,'RAAAH!',1400))}},700);showToast('The exit is open… and the Minotaur heard it. RUN! 🏃',3500)}
      else showToast(`🧶 Golden thread! ${G.needed-G.got} to go`,1400);
      setDoorLabel();
    }
    if(G.doorOpen&&nx===G.exit.x&&ny===G.exit.y){win();return}
    checkHug(now);
    return;
  }
}
