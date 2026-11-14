// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { footstep, heartbeat, sfx } from './ambience';
import { growl, noiseBurst, route, snort, tone } from './audio';
import { $, NAMES, isTouch, rnd } from './core';
import { fpInput } from './firstPerson';
import { showToast, updateHUD, updateTime } from './hud';
import { getDir, splitMode, sprintHeld, throwHeld } from './input';
import { computeSight, gateSound } from './level';
import { tryMove } from './logic';
import { bfs, walk } from './maze';
import { M, box, glowPool, glowSprite, scene, shadowAll, sph } from './scene';

// ---------- trader chests & fireballs ----------
export function rollItem(){return'fireball'}
// more items can be added to the chest later
export function makeChest(){
  const g=new THREE.Group(),wood=M('#6b4423',{roughness:.9}),gold=M('#d9a52e',{metalness:.7,roughness:.35});
  const base=box(.5,.28,.34,wood);base.position.y=.14;g.add(base);
  for(const x of [-.22,.22]){const b=box(.05,.3,.36,gold);b.position.set(x,.15,0);g.add(b)}
  const lid=new THREE.Group();lid.position.set(0,.28,-.17);
  const top=box(.52,.1,.36,wood);top.position.set(0,.05,.17);lid.add(top);
  const trim=box(.54,.03,.38,gold);trim.position.set(0,.1,.17);lid.add(trim);
  const lock=box(.08,.1,.03,gold);lock.position.set(0,0,.36);lid.add(lock);
  g.add(lid);
  const ring=glowPool('#b46cff',1.8,.5);ring.position.y=.02;g.add(ring);
  const sparks=[];for(let k=0;k<4;k++){const sp=glowSprite('#e0c0ff',.22,.9);g.add(sp);sparks.push(sp)}
  const halo=glowSprite('#b46cff',1.4,.35);halo.position.y=.35;g.add(halo);
  shadowAll(g);g.userData={lid,ring,sparks,halo};
  return g;
}
export function spawnChest(now){
  const avoid=[...G.players,...G.minos],bad=new Set();
  G.threads.forEach(t=>{if(!t.taken)bad.add(t.y*G.W+t.x)});G.gates.forEach(g=>{bad.add(g.ly*G.W+g.lx);bad.add(g.iy*G.W+g.ix)});
  const opts=[];
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
export function updateItems(now,dt){
  // chests appear by magic, and vanish again if nobody opens them
  if(now>G.nextChestT){if(G.chests.filter(c=>!c.opened).length<2)spawnChest(now);G.nextChestT=now+40000}
  for(const c of G.chests){
    if(!c.opened&&now-c.born>80000){c.opened=-now;burst(c.x,.4,c.y,'#c890ff',10,1.2);continue}
    if(c.opened)continue;
    const p=G.players.find(p=>p.x===c.x&&p.y===c.y);
    if(!p)continue;
    if(p.item){if(now-(c.nag||0)>2500){c.nag=now;showToast('You can only carry one fireball. Use it first!',1800)}continue}
    c.opened=now;p.item=c.item;G.carry[G.players.indexOf(p)]=c.item;sfxChestOpen();
    burst(c.x,.5,c.y,'#ffb347',12,1.4);
    showToast(`🔥 ${NAMES[G.players.indexOf(p)]} found a fireball! ${throwHint(G.players.indexOf(p))}`,3200);
  }
  G.chests=G.chests.filter(c=>{const gone=(c.opened>0&&now-c.opened>2500)||(c.opened<0&&now+c.opened>700);if(gone)G.levelGroup.remove(c.g);return!gone});
  // throwing
  G.players.forEach((p,i)=>{
    const held=throwHeld(i);
    if(held&&!p.throwPrev&&p.item==='fireball'){p.item=null;G.carry[i]=null;launchFireball(p,now)}
    p.throwPrev=held;
  });
  // fireballs fly straight down the corridor until they hit something
  for(const f of G.fireballs){
    const step=dt*11;f.fx+=f.dx*step;f.fz+=f.dz*step;f.dist+=step;
    const tx=Math.round(f.fx),tz=Math.round(f.fz);
    const hit=G.minos.find(m=>Math.hypot(m.px-f.fx,m.py-f.fz)<.65);
    if(hit){stunMino(hit,now);explode(f,true);continue}
    if(!(walk(tx,tz)||G.players.some(p=>p.x===tx&&p.y===tz))||f.dist>14){explode(f,false);continue}
    f.g.position.set(f.fx,.55,f.fz);
    if(now-f.trailT>28){f.trailT=now;const s=glowSprite('#ff8a3a',.3,.8);s.position.copy(f.g.position);scene.add(s);G.fx.push({s,t:0,life:.35,v:new THREE.Vector3(0,.2,0),grow:-.5})}
  }
  G.fireballs=G.fireballs.filter(f=>!f.dead);
}
export function throwHint(i){
  if(G.pads.length&&G.numPlayers===2&&splitMode())return i?'Throw it with ZR.':'Throw it with ZL.';
  if(G.pads.length)return'Press A to throw it.';
  if(isTouch)return'Tap 🔥 to throw it.';
  return G.numPlayers===1?'Press F or M to throw it.':`Press ${['M','F','O','9 on the number pad'][i]} to throw it.`;
}
export function launchFireball(p,now){
  const h=p.last,g=new THREE.Group();
  g.add(sph(.13,new THREE.MeshBasicMaterial({color:'#ffd27a'}),14,10));
  g.add(glowSprite('#ff6a1a',1.1,.95));
  const l=new THREE.PointLight('#ff7a2a',1.8,4.5,1.6);g.add(l);
  g.position.set(p.x+h.x*.3,.55,p.y+h.y*.3);scene.add(g);
  G.fireballs.push({g,fx:p.x+h.x*.3,fz:p.y+h.y*.3,dx:h.x,dz:h.y,dist:0,trailT:0,dead:false});
  sfxWhoosh();
}
export function explode(f,onMino){
  f.dead=true;scene.remove(f.g);
  burst(f.fx,.55,f.fz,onMino?'#ffb347':'#ff7a2a',onMino?18:9,onMino?2.4:1.3);
  if(onMino)sfxBoom();else sfxFizzle();
}
export function burst(x,y,z,col,n,size){
  const flash=glowSprite(col,size,1);flash.position.set(x,y,z);scene.add(flash);G.fx.push({s:flash,t:0,life:.4,v:new THREE.Vector3(),grow:2});
  for(let k=0;k<n;k++){const s=glowSprite(col,.18,1);s.position.set(x,y,z);scene.add(s);
    const a=Math.random()*Math.PI*2,u=Math.random()*1.5+.3;G.fx.push({s,t:0,life:.5+Math.random()*.3,v:new THREE.Vector3(Math.cos(a)*u,Math.random()*1.4+.3,Math.sin(a)*u),grow:0})}
}
export function stunMino(m,now){
  m.stunUntil=now+5000;m.mode='stunned';m.hugT=0;
  say(m,['ARGH! My eyes!','HOT HOT HOT!','RRAAGH!'][rnd(3)],1600);
  setTimeout(()=>{if(m.stunUntil>performance.now())say(m,'✦ ✦ ✦',3200)},1600);
  sfxYelp();
  showToast('💥 Direct hit! The Minotaur is stunned. Run!',2400);
}
export function restoreMino(m){if(!m.mesh)return;m.mesh.userData.mats.forEach(mt=>{mt.emissive.set('#000000');mt.emissiveIntensity=1});m.mesh.visible=true}
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
export function diffCfg(m){
  const c=G.difficulty==='sleepy'
    ?{interval:Math.max(360,600-G.level*25),radius:6+G.level,chase:.8}
    :{interval:Math.max(220,420-G.level*22),radius:9+G.level*2,chase:.9};
  if(m&&m.enraged){c.interval=Math.round(c.interval*.72);c.radius=999;c.chase=1}
  return c;
}
export function minoStep(m,now){
  const {dist,prev}=bfs(m.x,m.y);
  let target=null,best=1e9;
  for(const p of G.players){if(p.inv>now)continue;const d=dist[p.y*G.W+p.x];if(d>=0&&d<best){best=d;target=p}}
  const cfg=diffCfg(m);
  const inRange=target&&best<=cfg.radius;
  let step=null;
  if(inRange){
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
    const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>walk(m.x+dx,m.y+dy));
    const fwd=opts.filter(([dx,dy])=>!(dx===-m.dir.x&&dy===-m.dir.y));
    const keep=fwd.find(([dx,dy])=>dx===m.dir.x&&dy===m.dir.y);
    let ch=(keep&&Math.random()<.7)?keep:(fwd.length?fwd[rnd(fwd.length)]:opts[0]);
    if(ch)step={x:ch[0],y:ch[1]};
  }
  if(step&&walk(m.x+step.x,m.y+step.y)&&!G.minos.some(o=>o!==m&&o.x===m.x+step.x&&o.y===m.y+step.y)){m.x+=step.x;m.y+=step.y;m.dir=step;if(G.state==='play')footstep(m)}
  checkHug(now);
}
export function checkHug(now){
  for(const m of G.minos)for(const p of G.players){
    if(p.inv>now||m.stunUntil>now)continue;
    if(p.x===m.x&&p.y===m.y){
      G.hugs++;G.hugsLevel++;
      const fl=$('flash');fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),120);
      say(m,['CAUGHT YOU!','Back you go!','Too slow!','Got you!'][rnd(4)],1500);
      growl();
      p.x=p.sx;p.y=p.sy;p.px=p.sx;p.py=p.sy;p.inv=now+2200;computeSight();
      while(p.trail.children.length)p.trail.remove(p.trail.children[0]);
      m.next=now+1100;m.hugT=now;
      showToast(`${NAMES[G.players.indexOf(p)]} was caught! Back to the start.`,1800);
      updateHUD();
    }
  }
}
export function say(m,text,ms){m.say=text;m.sayUntil=performance.now()+ms}
export function update(now,dt){
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
