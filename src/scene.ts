// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { COLORS, cv } from './core';
import { GLOW, canvasTex } from './textures';

/* ---------- 3D setup ---------- */
export let renderer;
export const SKY = '#161a28';
export let scene;
export let camera;
export let moon;
export let ground;
export const M = (c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:0},o));
export const sph = (r,c,ws=16,hs=12)=>new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),typeof c==='string'?M(c):c);
export const cyl = (rt,rb,h,c,s=12)=>new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s),typeof c==='string'?M(c):c);
export const box = (w,h,d,c)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof c==='string'?M(c):c);
export const glowSprite = (color,size,op=1)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(size);return s};
export const glowPool = (color,size,op)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:GLOW,color,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}));p.rotation.x=-Math.PI/2;return p};
export let camPos;
export function shadowAll(g){g.traverse(o=>{if(o.isMesh&&!(o.material&&o.material.blending===THREE.AdditiveBlending)){o.castShadow=true;o.receiveShadow=true}})}
export function makePlayer(i){
  const g=new THREE.Group(),skin=M('#e8bf98'),bronze=M('#a87a3a',{metalness:.6,roughness:.4});
  const body=cyl(.14,.24,.42,COLORS[i],18);body.position.y=.21;g.add(body);
  const belt=cyl(.195,.205,.05,'#4a2f1a',18);belt.position.y=.24;g.add(belt);
  const head=sph(.2,skin,20,16);head.position.y=.6;g.add(head);
  for(const s of [-1,1]){const e=sph(.03,'#1a120c',10,8);e.position.set(s*.075,.6,.18);g.add(e)}
  if(i%2===0){
    const helm=new THREE.Mesh(new THREE.SphereGeometry(.218,20,12,0,Math.PI*2,0,Math.PI/2),bronze);helm.position.y=.62;g.add(helm);
    for(const s of [-1,1]){const gd=box(.04,.16,.12,bronze);gd.position.set(s*.19,.56,.08);g.add(gd)}
    const plume=box(.06,.16,.36,i?'#e8e2d0':'#9b2a1c');plume.position.set(0,.88,-.02);g.add(plume);
    const shield=cyl(.17,.17,.04,bronze,18);shield.rotation.x=Math.PI/2;shield.position.set(0,.28,-.22);g.add(shield);
  }else{
    const hc=i===3?'#b0702a':'#2e1a10';
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.222,20,12,0,Math.PI*2,0,Math.PI/2),M(hc));hair.position.y=.62;g.add(hair);
    const back=sph(.2,hc);back.scale.set(1,1,.6);back.position.set(0,.58,-.07);g.add(back);
    const tail=sph(.1,hc);tail.position.set(0,.48,-.22);g.add(tail);
    const band=cyl(.225,.225,.04,bronze,20);band.position.y=.68;g.add(band);
    const spool=cyl(.06,.06,.12,'#d9a52e',12);spool.rotation.z=Math.PI/2;spool.position.set(.22,.3,.05);g.add(spool);
  }
  shadowAll(g);
  const light=new THREE.PointLight('#ffb066',1.5*[1,1,.8,.65,.55][Math.max(1,G.numPlayers)],7,1.6);light.position.set(0,1.3,.2);g.add(light);
  return g;
}
export function makeMino(){
  const g=new THREE.Group(),fur=M('#3a2a20',{roughness:1}),furD=M('#241913',{roughness:1}),hide=M('#5a4033'),bone=M('#d6c7a8',{roughness:.6}),hoof=M('#120d0a'),bronze=M('#9a6a2a',{metalness:.6,roughness:.4});
  const eyeMat=new THREE.MeshBasicMaterial({color:'#ff4a1a'});
  const legs=[],arms=[];
  for(const s of [-1,1]){
    const leg=new THREE.Group();leg.position.set(s*.13,.5,0);
    const th=cyl(.1,.075,.48,furD,10);th.position.y=-.22;leg.add(th);
    const hf=cyl(.075,.09,.08,hoof,10);hf.position.y=-.47;leg.add(hf);
    g.add(leg);legs.push(leg);
  }
  const kilt=cyl(.21,.28,.22,'#4a3020',12);kilt.position.y=.55;g.add(kilt);
  const strap=box(.05,.5,.3,'#2a1a10');strap.position.set(0,.85,0);strap.rotation.z=.6;strap.scale.set(1,1,1.3);g.add(strap);
  const torso=sph(.27,fur,18,14);torso.scale.set(1.25,1.15,.85);torso.position.y=.86;g.add(torso);
  const chest=sph(.2,hide);chest.scale.set(1.25,.85,.5);chest.position.set(0,.9,.14);g.add(chest);
  for(const s of [-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.36,1.03,0);arm.rotation.z=s*.18;
    const sh=sph(.1,fur);arm.add(sh);
    const up=cyl(.085,.07,.46,fur,10);up.position.y=-.24;arm.add(up);
    const br=cyl(.078,.078,.1,bronze,10);br.position.y=-.36;arm.add(br);
    const fist=sph(.085,hide);fist.position.y=-.5;arm.add(fist);
    g.add(arm);arms.push(arm);
  }
  const head=new THREE.Group();head.position.set(0,1.28,.06);g.add(head);
  const skull=sph(.24,fur,20,16);skull.scale.set(1,.95,1.05);head.add(skull);
  const snout=sph(.16,hide);snout.scale.set(1.1,.8,1.25);snout.position.set(0,-.09,.2);head.add(snout);
  for(const s of [-1,1]){
    const n=sph(.03,'#120d0a',8,6);n.position.set(s*.06,-.08,.39);head.add(n);
    const e=new THREE.Mesh(new THREE.SphereGeometry(.04,10,8),eyeMat);e.position.set(s*.115,.04,.2);head.add(e);
    const brow=box(.13,.035,.05,furD);brow.position.set(s*.11,.1,.2);brow.rotation.z=s*.35;head.add(brow);
    const ear=sph(.09,fur);ear.scale.set(1.4,.5,.7);ear.position.set(s*.26,.05,0);ear.rotation.z=s*-.3;head.add(ear);
    const hb=cyl(.05,.045,.22,bone,10);hb.rotation.z=Math.PI/2;hb.position.set(s*.3,.15,0);head.add(hb);
    const ht=new THREE.Mesh(new THREE.ConeGeometry(.045,.3,10),bone);ht.position.set(s*.44,.28,.02);ht.rotation.z=-s*.4;head.add(ht);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.055,.012,8,16),bronze);ring.position.set(0,-.16,.37);head.add(ring);
  const mane=sph(.14,furD);mane.scale.set(1.4,.6,1);mane.position.set(0,.2,-.05);head.add(mane);
  shadowAll(g);
  g.userData={legs,arms,head,eyeMat,mats:[fur,furD,hide,bone]};
  return g;
}
export function labelTexture(text,bg,fg){
  return canvasTex(128,128,(x)=>{
    x.fillStyle=bg;x.beginPath();x.arc(64,64,56,0,Math.PI*2);x.fill();x.lineWidth=6;x.strokeStyle='#efe2c8';x.stroke();
    x.fillStyle=fg;x.font='700 '+(text.length>2?34:56)+'px Fredoka, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,64,68);
  });
}
export function setDoorLabel(){
  if(!G.doorParts)return;
  const old=G.doorParts.sprite.material.map;
  G.doorParts.sprite.material.map=G.doorOpen?labelTexture('EXIT','#2c6a3a','#ffffff'):labelTexture('🧶'+(G.needed-G.got),'#5a3d14','#ffd36a');
  G.doorParts.sprite.material.needsUpdate=true;if(old)old.dispose();
}

export function init() {
  renderer = new THREE.WebGLRenderer({canvas:cv,antialias:true});
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background=new THREE.Color(SKY);
  scene.fog=new THREE.Fog(SKY,10,30);
  camera = new THREE.PerspectiveCamera(50,1,.1,300);
  scene.add(new THREE.HemisphereLight('#8090c0','#3b2f25',.55));
  moon = new THREE.DirectionalLight('#b4c2f0',.5);
  moon.castShadow=true;
  moon.shadow.mapSize.set(2048,2048);
  moon.shadow.bias=-.0008;
  scene.add(moon);
  scene.add(moon.target);
  ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({color:'#2a271f'}));
  ground.rotation.x=-Math.PI/2;
  ground.position.y=-.02;
  ground.receiveShadow=true;
  scene.add(ground);
  G.levelGroup = new THREE.Group();
  scene.add(G.levelGroup);
  camPos = new THREE.Vector3(0,30,20);
}
