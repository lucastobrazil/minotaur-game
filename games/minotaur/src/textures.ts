import * as THREE from 'three';

import { $, rnd } from './core';
/* ---------- textures ---------- */
export type Draw2D = (x: CanvasRenderingContext2D, w: number, h: number) => void;
export function canvasTex(w: number, h: number, draw: Draw2D, repeat = false): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}return t;
}
export function speckle(x: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[]){for(let i=0;i<n;i++){x.fillStyle=cols[rnd(cols.length)];x.globalAlpha=.06+Math.random()*.12;x.fillRect(rnd(w),rnd(h),1+rnd(2),1+rnd(2))}x.globalAlpha=1}
export let GLOW: THREE.CanvasTexture;
export let WALLTEX: THREE.CanvasTexture;
export let CAPTEX: THREE.CanvasTexture;

export function init() {
  GLOW = canvasTex(64,64,(x)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)});
  WALLTEX = canvasTex(256,256,(x,w,h)=>{
    x.fillStyle='#3e352d';x.fillRect(0,0,w,h);
    const rows=8,rh=h/rows;
    for(let r=0;r<rows;r++){
      let off=(r%2)*-30-rnd(20),bx=off;
      while(bx<w){
        const bw=44+rnd(40),v=rnd(30);
        x.fillStyle=`rgb(${120+v},${106+v},${90+v})`;
        x.fillRect(bx+2,r*rh+2,bw-4,rh-4);
        x.fillStyle='rgba(0,0,0,.18)';x.fillRect(bx+2,r*rh+rh-6,bw-4,4);
        x.fillStyle='rgba(255,255,255,.07)';x.fillRect(bx+2,r*rh+2,bw-4,3);
        bx+=bw;
      }
    }
    speckle(x,w,h,1200,['#000','#fff','#5a4a3a']);
    x.strokeStyle='rgba(20,15,10,.6)';x.lineWidth=1.5;
    for(let i=0;i<6;i++){x.beginPath();let cx=rnd(w),cy=rnd(h);x.moveTo(cx,cy);for(let k=0;k<5;k++){cx+=rnd(24)-12;cy+=rnd(18);x.lineTo(cx,cy)}x.stroke()}
    const g=x.createLinearGradient(0,h*.65,0,h);g.addColorStop(0,'rgba(60,80,40,0)');g.addColorStop(1,'rgba(60,85,40,.55)');x.fillStyle=g;x.fillRect(0,0,w,h);
  },true);
  CAPTEX = canvasTex(64,64,(x,w,h)=>{x.fillStyle='#7a6c5c';x.fillRect(0,0,w,h);speckle(x,w,h,600,['#000','#fff','#4a3f35'])},true);
}
