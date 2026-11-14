// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { heroStep } from './ambience';
import { tryMove } from './logic';
import { canStep } from './maze';

// ---------- first person: turn on the spot, walk forward / step back ----------
export const HEAD = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
export const headingOf = p=>{const i=HEAD.findIndex(h=>h.x===p.last.x&&h.y===p.last.y);return i<0?2:i};
export function faceOpen(p){
  // when switching to first person, face down an open corridor rather than at a wall
  let h=headingOf(p);
  for(let k=0;k<4&&!canStep(p.x+HEAD[h].x,p.y+HEAD[h].y);k++)h=(h+1)%4;
  p.last={...HEAD[h]};p.camAng=Math.atan2(p.last.x,p.last.y);
}
export function fpInput(p,d,now){
  if(!d||now<p.next)return;
  if(d.x){p.last={...HEAD[(headingOf(p)+(d.x>0?1:3))%4]};p.next=now+300;heroStep(p,G.players.indexOf(p));return}
  const h=HEAD[headingOf(p)],dir=d.y<0?h:{x:-h.x,y:-h.y};
  tryMove(p,dir,now);
  p.last={...h};
}
