import * as THREE from 'three';
import { G } from './state';
import type { HeroParts, Minotaur, Player } from './types';
import { syncBoss } from './boss';
import { $, TRAIL, stage } from './core';
import { ITEM_ICON } from './items';
import { camPos, camera, glowSprite, hemi, moon, renderer, scene } from './scene';

/* ---------- 3D sync & camera ---------- */
/** Interpolate between two angles the short way round. */
export const angLerp = (a: number, b: number, t: number): number=>{let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t};
export let tmpV: THREE.Vector3;
interface Puff { s: THREE.Sprite; t: number; vx: number; vz: number }
export const puffs: Puff[] = [];
export function spawnPuff(m: Minotaur){
  if(!m.mesh)return;
  m.mesh.updateMatrixWorld(true);
  const s=glowSprite('#8a8a8a',.2,.45);s.material.blending=THREE.NormalBlending;
  s.position.copy(m.mesh.userData.head.localToWorld(new THREE.Vector3(0,-.1,.42)));
  scene.add(s);puffs.push({s,t:0,vx:Math.sin(m.face)*.6,vz:Math.cos(m.face)*.6});
}
export function sync(now: number, dt: number){
  const k=Math.min(1,dt*14);
  G.players.forEach(p=>{
    if(!p.mesh)return;
    p.px+=(p.x-p.px)*k;p.py+=(p.y-p.py)*k;
    const moving=Math.abs(p.x-p.px)+Math.abs(p.y-p.py)>.03;
    p.face=angLerp(p.face,Math.atan2(p.last.x,p.last.y),Math.min(1,dt*16));
    p.mesh.position.set(p.px,moving?Math.abs(Math.sin(now/55))*.08:0,p.py);
    p.mesh.rotation.y=p.face;
    // swing arms and legs in step with the bob, easing back to standing when stopped
    const u=p.mesh.userData as Partial<HeroParts>;
    if(u.legs&&u.arms){const sw=moving?Math.sin(now/110)*.6:0,e=Math.min(1,dt*12),L=u.legs,A=u.arms;
      L[0].rotation.x+=(sw-L[0].rotation.x)*e;L[1].rotation.x+=(-sw-L[1].rotation.x)*e;
      A[0].rotation.x+=(-sw*.8-A[0].rotation.x)*e;A[1].rotation.x+=(sw*.8-A[1].rotation.x)*e}
    p.mesh.visible=!(p.inv>now&&Math.floor(now/110)%2);
  });
  const r=stage.getBoundingClientRect();
  for(const m of G.minos){
    const mesh=m.mesh;if(!mesh)continue;
    const km=Math.min(1,dt*9);m.px+=(m.x-m.px)*km;m.py+=(m.y-m.py)*km;
    const moving=Math.abs(m.x-m.px)+Math.abs(m.y-m.py)>.03;
    m.face=angLerp(m.face,Math.atan2(m.dir.x,m.dir.y),Math.min(1,dt*8));
    const caught=m.hugT&&now-m.hugT<900,u=mesh.userData;
    const sp=m.mode==='chase'?75:130,sw=moving?Math.sin(now/sp)*.55:0;
    u.legs[0].rotation.x=sw;u.legs[1].rotation.x=-sw;
    u.arms[0].rotation.x=-sw*.8;u.arms[1].rotation.x=sw*.8;
    if(caught){u.arms.forEach(a=>a.rotation.x=-2.2+Math.sin(now/60)*.2)}
    mesh.position.set(m.px,moving?Math.abs(Math.sin(now/sp))*.04:0,m.py);
    mesh.rotation.y=m.face;
    u.head.rotation.x=m.mode==='chase'?.25:Math.sin(now/700)*.08;
    u.head.rotation.z=Math.sin(now/900)*.06;
    u.eyeMat.color.set(m.mode==='chase'?'#ff3a10':(G.difficulty==='sleepy'?'#7a2a10':'#b03a14'));
    // stay visible for a moment after leaving view, so he doesn't flicker at the edge of sight
    const inView=G.state==='title'||!G.sight||G.sight[m.y*G.W+m.x]||G.sight[Math.round(m.py)*G.W+Math.round(m.px)];
    if(inView)m.lastSeen=now;
    const seen=inView||now-(m.lastSeen||-1e9)<900||fpActive();
    mesh.visible=!!seen;
    if(m.enraged)u.eyeMat.color.set('#ff2200');
    if(seen&&m.mode==='chase'&&G.state==='play'&&now-m.puffT>(m.enraged?380:650)){m.puffT=now;spawnPuff(m)}
    if(m.bubble){
      const fp=fpActive(),pc=fp?fpCam:camera;
      if(seen&&m.say&&now<m.sayUntil&&!(fp&&G.players.length>1)&&(tmpV.set(mesh.position.x,2.05,mesh.position.z).project(pc),tmpV.z<1)){
        m.bubble.style.display='block';m.bubble.textContent=m.say;
        m.bubble.style.left=((tmpV.x+1)/2*r.width)+'px';m.bubble.style.top=((1-tmpV.y)/2*r.height)+'px';
      }else m.bubble.style.display='none';
    }
  }
  for(let i=puffs.length-1;i>=0;i--){
    const pf=puffs[i];pf.t+=dt;
    pf.s.position.x+=pf.vx*dt;pf.s.position.z+=pf.vz*dt;pf.s.position.y+=dt*.35;
    pf.s.scale.setScalar(.2+pf.t*.9);pf.s.material.opacity=.45*(1-pf.t/.9);
    if(pf.t>.9){scene.remove(pf.s);pf.s.material.dispose();puffs.splice(i,1)}
  }
  G.threads.forEach((t,i)=>{
    if(!t.mesh)return;
    if(t.taken){
      const a=(now-(t.popT??now))/350;
      if(a>=1){t.mesh.visible=false;if(t.pool)t.pool.visible=false}else{t.mesh.position.y=.35+a*.8;t.mesh.scale.setScalar(1-a*.8)}
    }else{t.mesh.position.y=.35+Math.sin(now/300+i)*.06;t.mesh.rotation.y+=dt*1.5}
  });
  G.torches.forEach((t,i)=>{
    const f=t.fire.userData,fl=.85+Math.sin(now/70+f.seed)*.08+Math.sin(now/37+f.seed*2)*.07;
    f.outer.scale.set(1,fl*1.1,1);f.inner.scale.set(1,fl,1);f.glow.material.opacity=.7*fl;
    t.pool.material.opacity=(t.wg?.3:.38)*fl;if(t.wg)t.wg.material.opacity=.22*fl;
  });
  if(G.doorParts){
    const gy=G.doorParts.gate.position.y,target=G.doorOpen?-1.35:0;
    G.doorParts.gate.position.y=gy+(target-gy)*Math.min(1,dt*2.5);
    G.doorParts.beam.material.opacity=G.doorOpen?.22+Math.sin(now/250)*.1:0;
    G.doorParts.exitLight.intensity=G.doorOpen?1.8+Math.sin(now/250)*.4:0;
    G.doorParts.sprite.position.y=2.2+Math.sin(now/400)*.08;
  }
  G.gates.forEach(g=>{
    if(!g.bars||!g.arm||!g.ring)return;
    const ty=g.open?-1.05:0;g.bars.position.y+=(ty-g.bars.position.y)*Math.min(1,dt*(g.open?4:7));
    g.bars.position.z=g.open&&!g.pressed&&g.until-now<2500?Math.sin(now/25)*.02:0;
    const ta=g.pressed?-.6:.6;g.arm.rotation.z+=(ta-g.arm.rotation.z)*Math.min(1,dt*10);
    g.ring.material.opacity=(g.pressed?.85:.45)+Math.sin(now/300)*.1;
  });
  if(G.fogParts){G.fogParts.mesh.visible=!(G.state==='title'||(G.state==='assign'&&!G.gameActive)||fpActive());if(G.fogDirty)redrawFog()}
  // chests: grow in, sparkle, open; effects; Minotaur flashing while stunned
  for(const c of G.chests){
    const u=c.g.userData,age=(now-c.born)/1000;
    const sc=1.35*(c.opened<0?Math.max(.01,1+(now+c.opened)/-700):Math.min(1,age*2.5));c.g.scale.setScalar(sc);
    u.sparks.forEach((sp,k)=>{const a=now/700+k*Math.PI/2;sp.position.set(Math.cos(a)*.38,.35+Math.sin(now/400+k)*.15,Math.sin(a)*.38)});
    u.ring.material.opacity=.35+Math.sin(now/300)*.15;u.halo.material.opacity=.25+Math.sin(now/450)*.1;
    if(c.opened>0){const t=Math.min(1,(now-c.opened)/400);u.lid.rotation.x=-1.9*t;if(now-c.opened>1500)c.g.scale.setScalar(1.35*Math.max(.01,1-(now-c.opened-1500)/1000))}
  }
  for(let i=G.fx.length-1;i>=0;i--){const e=G.fx[i];e.t+=dt;e.s.position.addScaledVector(e.v,dt);e.v.y-=dt*1.5;e.s.material.opacity=Math.max(0,1-e.t/e.life);if(e.grow)e.s.scale.multiplyScalar(1+e.grow*dt);if(e.t>=e.life){scene.remove(e.s);e.s.material.dispose();G.fx.splice(i,1)}}
  G.players.forEach((p,i)=>{
    if(p.orb){p.orb.visible=!!p.item&&!p.ghost;const glow=p.orb.children[1] as THREE.Sprite;glow.material.opacity=.7+Math.sin(now/120)*.2;glow.material.color.set(p.item==='sandals'?'#ffd36a':'#ff6a1a')}
    if(p.feet){p.feet.visible=(p.sandalsUntil??0)>now;p.feet.material.opacity=.6+Math.sin(now/80)*.3}
    const iv=$('inv'+i);if(iv){iv.classList.toggle('on',!!p.item);iv.textContent=p.item?ITEM_ICON[p.item]:''}
    const tb=$('throw'+i);if(tb){tb.classList.toggle('ready',!!p.item);tb.textContent=p.item?ITEM_ICON[p.item]:'🔥'}
    const hs=$('hearts'+i);if(hs){hs.style.display=G.isBoss?'':'none';hs.textContent=p.ghost?'👻':'❤️'.repeat(p.hearts??0)+'🖤'.repeat(Math.max(0,G.maxHearts-(p.hearts??0)))}
  });
  for(const m of G.minos){if((m.stunUntil??0)>now&&m.mesh){const on=Math.sin(now/55)>0;m.mesh.userData.mats.forEach(mt=>{mt.emissive.set(on?'#ff9a3a':'#000000');mt.emissiveIntensity=on?.8:1});m.mesh.userData.head.rotation.z=Math.sin(now/90)*.35;m.mesh.userData.eyeMat.color.set('#552010')}}
  syncBoss(now,dt);
  // the last phase of a boss fight is fought in the dark
  hemi.intensity=.55-.42*G.darkness;moon.intensity=.5-.42*G.darkness;
  drawMini(now);
  G.players.forEach((p,i)=>{const b=$('stb'+i);if(b){b.style.width=(p.stamina*100)+'%';b.style.background=p.tired?'#a33':TRAIL[i]}});
  // camera
  const aspect=r.width/Math.max(1,r.height),map=G.camMode==='map'||G.state==='title'||!G.players.length;
  const pitch=map?1.1:1.18,tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let tx: number,tz: number,dist: number;
  if(map){
    tx=(G.W-1)/2;tz=(G.H-1)/2+.5;
    dist=Math.max((G.H*Math.sin(pitch)+1.5)/(2*tan),(G.W+3)/(2*tan*aspect))*1.22;
  }else{
    let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
    const pts=G.players.map(p=>({px:p.px,py:p.py}));if(G.boss&&G.boss.mode!=='dead')pts.push({px:G.boss.px,py:G.boss.py});
    pts.forEach(p=>{minX=Math.min(minX,p.px);maxX=Math.max(maxX,p.px);minZ=Math.min(minZ,p.py);maxZ=Math.max(maxZ,p.py)});
    tx=(minX+maxX)/2;tz=(minZ+maxZ)/2;
    const sx=maxX-minX+5,sz=maxZ-minZ+5;
    dist=Math.max(9,Math.max(sz*Math.sin(pitch)/(2*tan),sx/(2*tan*aspect))*1.1);
  }
  G.camDist+=(dist-G.camDist)*Math.min(1,dt*4);
  if(fpActive()){scene.fog.near=1.5;scene.fog.far=14}else{scene.fog.near=G.camDist*.8;scene.fog.far=G.camDist*(map?2.2:1.75)}
  tmpV.set(tx,Math.sin(pitch)*dist,tz+Math.cos(pitch)*dist);
  if(!G.camInit){camPos.copy(tmpV);G.camDist=dist;G.camInit=true}else camPos.lerp(tmpV,Math.min(1,dt*4));
  camera.position.copy(camPos);
  camera.lookAt(camPos.x,0,camPos.z-camPos.y/Math.tan(pitch));
}
export function redrawFog(){
  G.fogDirty=false;
  const fp=G.fogParts;if(!fp)return;
  const {canvas:c,mask,S}=fp,m=mask.getContext('2d')!,x=c.getContext('2d')!;
  m.clearRect(0,0,mask.width,mask.height);m.fillStyle='#000';
  for(let y=0;y<G.H;y++)for(let xx=0;xx<G.W;xx++)if(G.explored[y*G.W+xx])m.fillRect(xx*S-1,y*S-1,S+2,S+2);
  x.globalCompositeOperation='source-over';x.clearRect(0,0,c.width,c.height);
  x.fillStyle='rgb(6,7,11)';x.fillRect(0,0,c.width,c.height);
  x.globalCompositeOperation='destination-out';
  try{x.filter='blur(5px)'}catch(e){}
  x.drawImage(mask,0,0);
  try{x.filter='none'}catch(e){}
  x.globalCompositeOperation='source-over';
  fp.tex.needsUpdate=true;
}
export function drawMini(now: number){
  const mc=$<HTMLCanvasElement>('mini');
  if(G.state==='title'||(G.state==='assign'&&!G.gameActive)||!G.explored){mc.style.display='none';return}
  mc.style.display='block';
  if(now-G.lastMini<100)return;G.lastMini=now;
  const r=stage.getBoundingClientRect(),maxS=Math.min(190,r.width*.34,r.height*.42);
  const s=Math.max(2,Math.floor(maxS/Math.max(G.W,G.H))),dpr=Math.min(2,window.devicePixelRatio||1);
  if(mc.width!==G.W*s*dpr||mc.height!==G.H*s*dpr){mc.width=G.W*s*dpr;mc.height=G.H*s*dpr;mc.style.width=G.W*s+'px';mc.style.height=G.H*s+'px'}
  const x=mc.getContext('2d')!;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.W*s,G.H*s);
  for(let y=0;y<G.H;y++)for(let xx=0;xx<G.W;xx++){const k=y*G.W+xx;if(!G.explored[k])continue;x.fillStyle=G.grid[y][xx]===1?'#8a7a66':(G.sight[k]?'#4f453a':'#2c2620');x.fillRect(xx*s,y*s,s,s)}
  x.fillStyle=G.doorOpen?'#5fe07a':'#b5823f';x.fillRect(G.exit.x*s-s*.5,G.exit.y*s-s*.5,s*2,s*2);
  const dot=(tx: number, ty: number, c: string, rr: number)=>{x.fillStyle=c;x.beginPath();x.arc(tx*s+s/2,ty*s+s/2,Math.max(1.6,s*rr),0,7);x.fill()};
  G.threads.forEach(t=>{if(!t.taken&&G.explored[t.y*G.W+t.x])dot(t.x,t.y,'#ffc23a',.9)});
  G.gates.forEach(g=>{
    if(G.explored[g.y*G.W+g.x]){x.globalAlpha=g.open?.35:1;x.fillStyle=g.col;x.fillRect(g.x*s-s*.2,g.y*s-s*.2,s*1.4,s*1.4);x.globalAlpha=1}
    if(G.explored[g.ly*G.W+g.lx]){x.strokeStyle=g.col;x.lineWidth=Math.max(1,s*.45);x.beginPath();x.arc(g.lx*s+s/2,g.ly*s+s/2,Math.max(2.2,s*.9),0,7);x.stroke()}
  });
  G.chests.forEach(c=>{if(c.opened)return;x.globalAlpha=.6+Math.sin(now/250)*.4;x.fillStyle='#c890ff';x.fillRect(c.x*s-s*.3,c.y*s-s*.3,s*1.6,s*1.6);x.globalAlpha=1});
  G.minos.forEach(m=>{if(G.sight[m.y*G.W+m.x]||now-(m.lastSeen||-1e9)<900)dot(m.x,m.y,m.enraged?'#ff2200':'#d0401a',1.15)});
  G.players.forEach((p,i)=>{
    dot(p.x,p.y,TRAIL[i],1.1);
    if(G.camMode==='fp'){const h=p.last,cx=p.x*s+s/2,cy=p.y*s+s/2,L=Math.max(5,s*2.2);x.strokeStyle=TRAIL[i];x.lineWidth=Math.max(1.5,s*.5);x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+h.x*L,cy+h.y*L);x.stroke()}
  });
}
export let fpCam: THREE.PerspectiveCamera;
export const fpActive = ()=>G.camMode==='fp'&&G.players.length>0&&!(G.state==='title'||(G.state==='assign'&&!G.gameActive));
export function placeFpCam(p: Player, w: number, h: number){
  fpCam.aspect=w/Math.max(1,h);fpCam.updateProjectionMatrix();
  const target=Math.atan2(p.last.x,p.last.y);
  p.camAng=p.camAng===undefined?target:angLerp(p.camAng,target,Math.min(1,(p.camDt||.016)*12));
  const moving=Math.abs(p.x-p.px)+Math.abs(p.y-p.py)>.03;
  const bob=moving?Math.sin(performance.now()/(p.sprinting?55:75))*.025:0;
  fpCam.position.set(p.px-Math.sin(p.camAng)*.12,.62+bob,p.py-Math.cos(p.camAng)*.12);
  fpCam.lookAt(fpCam.position.x+Math.sin(p.camAng),.58+bob,fpCam.position.z+Math.cos(p.camAng));
}
export function renderView(t: number){
  const dt=Math.min(.05,(t-G.lastRenderT)/1000||.016);G.lastRenderT=t;
  const sz=renderer.getSize(new THREE.Vector2()),W2=sz.x,H2=sz.y;
  const fp=fpActive(),n=G.players.length,two=fp&&n>1,grid4=fp&&n>2,side=W2>=H2;
  stage.classList.toggle('fpOn',two);$('splitLine').className=grid4?'v':(side?'v':'h');$('splitLine2').style.display=grid4?'block':'none';
  if(!fp){renderer.setScissorTest(false);renderer.setViewport(0,0,W2,H2);renderer.render(scene,camera);return}
  renderer.setScissorTest(two);
  const hw=W2/2,hh=H2/2,quads=[[0,hh],[hw,hh],[0,0],[hw,0]];
  if(n===3){ // the spare corner shows everyone from above
    camera.aspect=hw/hh;camera.updateProjectionMatrix();
    renderer.setViewport(hw,0,hw,hh);renderer.setScissor(hw,0,hw,hh);renderer.render(scene,camera);
    camera.aspect=W2/Math.max(1,H2);camera.updateProjectionMatrix();
  }
  G.players.forEach((p,i)=>{
    let x=0,y=0,w=W2,h=H2;
    if(grid4){[x,y]=quads[i];w=hw;h=hh}
    else if(two){if(side){w=W2/2;x=i*w}else{h=H2/2;y=i===0?h:0}}
    p.camDt=dt;placeFpCam(p,w,h);
    const mesh=p.mesh,vis=mesh?.visible??false;if(mesh)mesh.visible=false;
    renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
    renderer.render(scene,fpCam);
    if(mesh)mesh.visible=vis;
  });
  renderer.setScissorTest(false);renderer.setViewport(0,0,W2,H2);
}
export function resize(){
  const r=stage.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);
  camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();
}

export function init() {
  tmpV = new THREE.Vector3();
  fpCam = new THREE.PerspectiveCamera(72,1,.05,120);
}
