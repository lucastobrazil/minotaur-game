import * as THREE from 'three';
import { G } from './state';
import type { Chest, ChestParts, Effect, Fireball, ItemId, Minotaur, Player, Vec2 } from './types';
import { noiseBurst, route, tone } from './audio';
import { fireballHitsBoss } from './boss';
import { $, NAMES, isTouch, rnd } from './core';
import { showToast } from './hud';
import { splitMode, throwHeld } from './input';
import { say } from './logic';
import { walk } from './maze';
import { M, box, glowPool, glowSprite, scene, shadowAll, sph } from './scene';

// ---------- trader chests & fireballs ----------
/** What's in a trader chest. Winged sandals join the fireball once the Great Minotaur has been beaten. */
export function rollItem(): ItemId{return G.robeUnlocked&&Math.random()<.45?'sandals':'fireball'}
export const ITEM_ICON: Record<ItemId, string>={fireball:'🔥',sandals:'👟'};
export const ITEM_NAME: Record<ItemId, string>={fireball:'a fireball',sandals:'winged sandals'};
// more items can be added to the chest later
export function makeChest(): Chest['g']{
  const g=new THREE.Group(),wood=M('#6b4423',{roughness:.9}),gold=M('#d9a52e',{metalness:.7,roughness:.35});
  const base=box(.5,.28,.34,wood);base.position.y=.14;g.add(base);
  for(const x of [-.22,.22]){const b=box(.05,.3,.36,gold);b.position.set(x,.15,0);g.add(b)}
  const lid=new THREE.Group();lid.position.set(0,.28,-.17);
  const top=box(.52,.1,.36,wood);top.position.set(0,.05,.17);lid.add(top);
  const trim=box(.54,.03,.38,gold);trim.position.set(0,.1,.17);lid.add(trim);
  const lock=box(.08,.1,.03,gold);lock.position.set(0,0,.36);lid.add(lock);
  g.add(lid);
  const ring=glowPool('#b46cff',1.8,.5);ring.position.y=.02;g.add(ring);
  const sparks: THREE.Sprite[]=[];for(let k=0;k<4;k++){const sp=glowSprite('#e0c0ff',.22,.9);g.add(sp);sparks.push(sp)}
  const halo=glowSprite('#b46cff',1.4,.35);halo.position.y=.35;g.add(halo);
  const parts: ChestParts={lid,ring,sparks,halo};
  shadowAll(g);g.userData=parts;
  return g as Chest['g'];
}
export function spawnChest(now: number){
  const avoid: Vec2[]=[...G.players,...G.minos],bad=new Set<number>();
  G.threads.forEach(t=>{if(!t.taken)bad.add(t.y*G.W+t.x)});G.gates.forEach(g=>{bad.add(g.ly*G.W+g.lx);bad.add(g.iy*G.W+g.ix)});
  const opts: [number, number][]=[];
  for(let y=1;y<G.H;y+=2)for(let x=1;x<G.W;x+=2){
    if(G.grid[y][x]!==0||bad.has(y*G.W+x))continue;
    if(avoid.some(a=>Math.abs(a.x-x)+Math.abs(a.y-y)<7))continue;
    if(G.chests.some(c=>Math.abs(c.x-x)+Math.abs(c.y-y)<9))continue;
    opts.push([x,y]);
  }
  if(!opts.length)return;
  const [x,y]=opts[rnd(opts.length)];
  const g=makeChest();g.position.set(x,0,y);g.rotation.y=rnd(4)*Math.PI/2;g.scale.setScalar(.01);G.levelGroup.add(g);
  G.chests.push({x,y,g,born:now,opened:0,item:rollItem()});
  burst(x,.4,y,'#c890ff',14,1.6);sfxChestAppear();
  showToast('✨ A trader\'s chest has appeared somewhere in the labyrinth!',2600);
}
export function updateItems(now: number, dt: number){
  // chests appear by magic, and vanish again if nobody opens them
  if(now>G.nextChestT){if(G.chests.filter(c=>!c.opened).length<2)spawnChest(now);G.nextChestT=now+40000}
  for(const c of G.chests){
    if(!c.opened&&now-c.born>80000){c.opened=-now;burst(c.x,.4,c.y,'#c890ff',10,1.2);continue}
    if(c.opened)continue;
    const p=G.players.find(p=>p.x===c.x&&p.y===c.y);
    if(!p)continue;
    if(p.item||p.ghost){if(!p.ghost&&now-(c.nag||0)>2500){c.nag=now;showToast('You can only carry one item. Use it first!',1800)}continue}
    c.opened=now;p.item=c.item;G.carry[G.players.indexOf(p)]=c.item;sfxChestOpen();
    burst(c.x,.5,c.y,'#ffb347',12,1.4);
    showToast(`${ITEM_ICON[c.item]} ${NAMES[G.players.indexOf(p)]} found ${ITEM_NAME[c.item]}! ${throwHint(G.players.indexOf(p),c.item)}`,3200);
  }
  G.chests=G.chests.filter(c=>{const gone=(c.opened>0&&now-c.opened>2500)||(c.opened<0&&now+c.opened>700);if(gone)G.levelGroup.remove(c.g);return!gone});
  // throwing
  G.players.forEach((p,i)=>{
    const held=throwHeld(i);
    if(held&&!p.throwPrev&&p.item&&!p.ghost){
      const it=p.item;p.item=null;G.carry[i]=null;
      if(it==='fireball')launchFireball(p,now);
      else{p.sandalsUntil=now+10000;sfxWhoosh();[660,880,1320].forEach((f,k)=>tone(f,.15,'triangle',.08,null,k*.06));showToast(`👟 ${NAMES[i]} is wearing winged sandals: super speed for 10 seconds!`,2400)}
    }
    p.throwPrev=held;
  });
  // fireballs fly straight down the corridor until they hit something
  for(const f of G.fireballs){
    const step=dt*11;f.fx+=f.dx*step;f.fz+=f.dz*step;f.dist+=step;
    const tx=Math.round(f.fx),tz=Math.round(f.fz);
    if(G.boss&&G.boss.mode!=='dead'&&Math.hypot(G.boss.px-f.fx,G.boss.py-f.fz)<1.05){explode(f,fireballHitsBoss(now));continue}
    const hit=G.minos.find(m=>Math.hypot(m.px-f.fx,m.py-f.fz)<.65);
    if(hit){stunMino(hit,now);explode(f,true);continue}
    if(!(walk(tx,tz)||G.players.some(p=>p.x===tx&&p.y===tz))||f.dist>14){explode(f,false);continue}
    f.g.position.set(f.fx,.55,f.fz);
    if(now-f.trailT>28){f.trailT=now;const s=glowSprite('#ff8a3a',.3,.8);s.position.copy(f.g.position);scene.add(s);G.fx.push({s,t:0,life:.35,v:new THREE.Vector3(0,.2,0),grow:-.5})}
  }
  G.fireballs=G.fireballs.filter(f=>!f.dead);
}
export function throwHint(i: number, item: ItemId='fireball'): string{
  const verb=item==='fireball'?'throw it':'put them on';
  return useHint(i).replace('throw it',verb);
}
function useHint(i: number): string{
  if(G.pads.length&&G.numPlayers===2&&splitMode())return i?'Throw it with ZR.':'Throw it with ZL.';
  if(G.pads.length)return'Press A to throw it.';
  if(isTouch)return'Tap 🔥 to throw it.';
  return G.numPlayers===1?'Press F or M to throw it.':`Press ${['M','F','O','9 on the number pad'][i]} to throw it.`;
}
export function launchFireball(p: Player, now: number){
  const h=p.last,g=new THREE.Group();
  g.add(sph(.13,new THREE.MeshBasicMaterial({color:'#ffd27a'}),14,10));
  g.add(glowSprite('#ff6a1a',1.1,.95));
  const l=new THREE.PointLight('#ff7a2a',1.8,4.5,1.6);g.add(l);
  g.position.set(p.x+h.x*.3,.55,p.y+h.y*.3);scene.add(g);
  G.fireballs.push({g,fx:p.x+h.x*.3,fz:p.y+h.y*.3,dx:h.x,dz:h.y,dist:0,trailT:0,dead:false});
  sfxWhoosh();
}
export function explode(f: Fireball, onMino: boolean){
  f.dead=true;scene.remove(f.g);
  burst(f.fx,.55,f.fz,onMino?'#ffb347':'#ff7a2a',onMino?18:9,onMino?2.4:1.3);
  if(onMino)sfxBoom();else sfxFizzle();
}
export function burst(x: number, y: number, z: number, col: string, n: number, size: number){
  const flash=glowSprite(col,size,1);flash.position.set(x,y,z);scene.add(flash);G.fx.push({s:flash,t:0,life:.4,v:new THREE.Vector3(),grow:2});
  for(let k=0;k<n;k++){const s=glowSprite(col,.18,1);s.position.set(x,y,z);scene.add(s);
    const a=Math.random()*Math.PI*2,u=Math.random()*1.5+.3;G.fx.push({s,t:0,life:.5+Math.random()*.3,v:new THREE.Vector3(Math.cos(a)*u,Math.random()*1.4+.3,Math.sin(a)*u),grow:0})}
}
export function stunMino(m: Minotaur, now: number){
  m.stunUntil=now+5000;m.mode='stunned';m.hugT=0;
  say(m,['ARGH! My eyes!','HOT HOT HOT!','RRAAGH!'][rnd(3)],1600);
  setTimeout(()=>{if((m.stunUntil??0)>performance.now())say(m,'✦ ✦ ✦',3200)},1600);
  sfxYelp();
  showToast('💥 Direct hit! The Minotaur is stunned. Run!',2400);
}
export function restoreMino(m: Minotaur){if(!m.mesh)return;m.mesh.userData.mats.forEach(mt=>{mt.emissive.set('#000000');mt.emissiveIntensity=1});m.mesh.visible=true}
// ---- item sounds ----
export function sfxChestAppear(){if(!G.ac||!G.master)return;[1047,1319,1568,2093].forEach((f,i)=>tone(f,.5,'sine',.06,null,i*.08));noiseBurst(G.ac.currentTime,.8,'highpass',5000,.04,1,.8)}
export function sfxChestOpen(){if(!G.ac||!G.master)return;tone(190,.35,'sawtooth',.05,120);[784,988,1175,1568].forEach((f,i)=>tone(f,.35,'triangle',.08,null,.25+i*.07))}
export function sfxWhoosh(){if(!G.ac||!G.master)return;const t0=G.ac.currentTime,n=G.ac.createBufferSource();n.buffer=G.noiseB;const f=G.ac.createBiquadFilter();f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(400,t0);f.frequency.exponentialRampToValueAtTime(2200,t0+.35);
  const g=G.ac.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.25,t0+.05);g.gain.exponentialRampToValueAtTime(.0001,t0+.45);n.connect(f).connect(g);route(g,1,.3);n.start(t0);n.stop(t0+.5);tone(90,.3,'sawtooth',.05,60)}
export function sfxBoom(){if(!G.ac||!G.master)return;const t0=G.ac.currentTime,o=G.ac.createOscillator(),g=G.ac.createGain();o.frequency.setValueAtTime(140,t0);o.frequency.exponentialRampToValueAtTime(35,t0+.5);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.4,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+.6);o.connect(g);route(g,1,.6);o.start(t0);o.stop(t0+.65);noiseBurst(t0,.5,'lowpass',1200,.3,1,.6)}
export function sfxFizzle(){if(!G.ac||!G.master)return;noiseBurst(G.ac.currentTime,.35,'highpass',2500,.12,1,.4)}
export function sfxYelp(){if(!G.ac||!G.master)return;const t0=G.ac.currentTime+.08,o=G.ac.createOscillator(),g=G.ac.createGain(),f=G.ac.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(150,t0);o.frequency.linearRampToValueAtTime(230,t0+.12);o.frequency.exponentialRampToValueAtTime(80,t0+.7);
  f.type='bandpass';f.frequency.value=600;f.Q.value=2;g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.3,t0+.04);g.gain.exponentialRampToValueAtTime(.0001,t0+.75);o.connect(f).connect(g);route(g,1,.5);o.start(t0);o.stop(t0+.8)}
