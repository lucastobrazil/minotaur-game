import * as THREE from 'three';
import { G } from './state';
import type { Minotaur, Player, Vec2 } from './types';
import { footstep, heartbeat, heroStep, sfx } from './ambience';
import { gateSound, growl, roar, snort, tone } from './audio';
import { win } from './controllers';
import { $, NAMES, STEP, rnd } from './core';
import { fpInput } from './firstPerson';
import { showToast, updateHUD, updateTime } from './hud';
import { getDir, sprintHeld } from './input';
import { restoreMino, updateItems } from './items';
import { computeSight } from './level';
import { bfs, canStep, walk } from './maze';
import { setDoorLabel } from './scene';

/* ---------- game logic ---------- */
export function addTrail(p: Player, ax: number, ay: number, bx: number, by: number){
  if(!p.trail)return;
  const s=new THREE.Mesh(p.segGeo,p.segMat);
  s.position.set((ax+bx)/2,.02,(ay+by)/2);if(ax!==bx)s.rotation.y=Math.PI/2;
  p.trail.add(s);if(p.trail.children.length>900)p.trail.remove(p.trail.children[0]);
}
export function tryMove(p: Player, d: Vec2, now: number){
  let cands: Vec2[];
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

// ---------- Minotaur AI, catching, and the per-frame update ----------
export interface MinoCfg { interval: number; radius: number; chase: number }
export function diffCfg(m?: Minotaur): MinoCfg{
  const c: MinoCfg=G.difficulty==='sleepy'
    ?{interval:Math.max(360,600-G.level*25),radius:6+G.level,chase:.8}
    :{interval:Math.max(220,420-G.level*22),radius:9+G.level*2,chase:.9};
  if(m&&m.enraged){c.interval=Math.round(c.interval*.72);c.radius=999;c.chase=1}
  return c;
}
export function minoStep(m: Minotaur, now: number){
  const {dist,prev}=bfs(m.x,m.y);
  let target: Player | null=null,best=1e9;
  for(const p of G.players){if(p.inv>now)continue;const d=dist[p.y*G.W+p.x];if(d>=0&&d<best){best=d;target=p}}
  const cfg=diffCfg(m);
  const inRange=target&&best<=cfg.radius;
  let step: Vec2 | null=null;
  if(target&&inRange){
    if(m.mode!=='chase'&&now-m.lastSpot>4000){say(m,['!','Fresh meat…','*sniff* …MEAT!','Hrrr… hungry…'][rnd(4)],1100);sfx.spot(m);m.lastSpot=now}
    m.mode='chase';
    if(Math.random()<cfg.chase&&best>0){
      let k=target.y*G.W+target.x;const mk=m.y*G.W+m.x;
      while(prev[k]!==mk&&prev[k]!==-1)k=prev[k];
      step={x:k%G.W-m.x,y:((k/G.W)|0)-m.y};
    }
  }else{
    if(m.mode==='chase'&&Math.random()<.6)say(m,['Hrrmph...','Where are you?','*sniff sniff*'][rnd(3)],1200);
    m.mode='wander';
    if(Math.random()<.03){say(m,'*SNORT*',900);snort(.12)}
  }
  if(!step){
    const opts=([[1,0],[-1,0],[0,1],[0,-1]] as [number, number][]).filter(([dx,dy])=>walk(m.x+dx,m.y+dy));
    const fwd=opts.filter(([dx,dy])=>!(dx===-m.dir.x&&dy===-m.dir.y));
    const keep=fwd.find(([dx,dy])=>dx===m.dir.x&&dy===m.dir.y);
    let ch=(keep&&Math.random()<.7)?keep:(fwd.length?fwd[rnd(fwd.length)]:opts[0]);
    if(ch)step={x:ch[0],y:ch[1]};
  }
  const st=step;
  if(st&&walk(m.x+st.x,m.y+st.y)&&!G.minos.some(o=>o!==m&&o.x===m.x+st.x&&o.y===m.y+st.y)){m.x+=st.x;m.y+=st.y;m.dir=st;if(G.state==='play')footstep(m)}
  checkHug(now);
}
export function checkHug(now: number){
  for(const m of G.minos)for(const p of G.players){
    if(p.inv>now||(m.stunUntil??0)>now)continue;
    if(p.x===m.x&&p.y===m.y){
      G.hugs++;G.hugsLevel++;
      const fl=$('flash');fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),120);
      say(m,['CAUGHT YOU!','Back you go!','Too slow!','Got you!'][rnd(4)],1500);
      growl();
      p.x=p.sx;p.y=p.sy;p.px=p.sx;p.py=p.sy;p.inv=now+2200;computeSight();
      const tr=p.trail;if(tr)while(tr.children.length)tr.remove(tr.children[0]);
      m.next=now+1100;m.hugT=now;
      showToast(`${NAMES[G.players.indexOf(p)]} was caught! Back to the start.`,1800);
      updateHUD();
    }
  }
}
export function say(m: Minotaur, text: string, ms: number){m.say=text;m.sayUntil=performance.now()+ms}
export function update(now: number, dt: number){
  G.elapsed+=dt;
  for(let i=0;i<G.players.length;i++){
    const p=G.players[i],dir=getDir(i);
    p.sprinting=sprintHeld(i)&&!p.tired&&p.stamina>0&&!!dir;
    if(p.sprinting){p.stamina=Math.max(0,p.stamina-dt/1.8);if(p.stamina<=0)p.tired=true}
    else{p.stamina=Math.min(1,p.stamina+dt/(p.tired?5:3.5));if(p.tired&&p.stamina>=.4)p.tired=false}
    if(G.camMode==='fp'){fpInput(p,dir,now);if(G.state!=='play')return}
    else if(now>=p.next&&dir){tryMove(p,dir,now);if(G.state!=='play')return}
  }
  // gates: open while someone stands on the lever, then stay open for a little while
  const linger=G.numPlayers>1?2500:8000;
  for(const g of G.gates){
    const pressed=G.players.some(p=>p.x===g.lx&&p.y===g.ly);
    if(G.players.some(p=>p.x===g.ix&&p.y===g.iy)){
      if(!g.open){g.open=true;gateSound(true,g);showToast('You heave the gate open from the inside.',1800)}
      g.until=Math.max(g.until,now+1500);
    }
    if(pressed){
      if(!g.open){g.open=true;gateSound(true,g);if(!g.pressed)showToast(G.numPlayers>1?'Gate open! It shuts soon after you step off…':'Gate open! Run, it shuts in 8 seconds!',2200)}
      g.until=now+linger;
    }
    g.pressed=pressed;
    if(g.open&&now>g.until){
      if(G.players.some(p=>p.x===g.x&&p.y===g.y)||G.minos.some(m=>m.x===g.x&&m.y===g.y))g.until=now+150;
      else{g.open=false;gateSound(false,g)}
    }
    if(g.open&&!pressed&&g.until-now<2500&&now>g.tick){g.tick=now+500;tone(1300,.05,'square',.035)}
  }
  for(const m of G.minos){
    if(m.stunUntil){if(now<m.stunUntil)continue;m.stunUntil=0;m.mode='wander';m.lastSpot=now;m.next=now+500;restoreMino(m)}
    if(now>=m.next){minoStep(m,now);m.next=now+diffCfg(m).interval}
  }
  updateItems(now,dt);
  heartbeat(now);
  let tn=0;for(const t of G.torches)for(const p of G.players){const d=Math.hypot(t.x-p.x,t.y-p.y);tn=Math.max(tn,1-d/4)}G.torchNear=Math.max(0,tn);
  updateTime();
}
