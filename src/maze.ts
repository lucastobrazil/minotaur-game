// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { rnd } from './core';

/* ---------- maze generation ---------- */
export function genMaze(c,r){
  G.W=2*c+1;G.H=2*r+1;
  const g=[];for(let y=0;y<G.H;y++)g.push(new Array(G.W).fill(1));
  const D=[[1,0],[-1,0],[0,1],[0,-1]];
  const inC=(x,y)=>x>=0&&y>=0&&x<c&&y<r;
  const seen=new Uint8Array(c*r);
  const carve=(ax,ay,bx,by)=>{g[2*ay+1][2*ax+1]=0;g[ay+by+1][ax+bx+1]=0;g[2*by+1][2*bx+1]=0};
  const algo=Math.random()<.5?'backtrack':'prim';
  if(algo==='backtrack'){
    const sx=rnd(c),sy=rnd(r),stack=[[sx,sy]];seen[sy*c+sx]=1;g[2*sy+1][2*sx+1]=0;
    while(stack.length){
      const [x,y]=stack[stack.length-1];
      const nb=D.map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>inC(nx,ny)&&!seen[ny*c+nx]);
      if(!nb.length){stack.pop();continue}
      const [nx,ny]=nb[rnd(nb.length)];carve(x,y,nx,ny);seen[ny*c+nx]=1;stack.push([nx,ny]);
    }
  }else{
    const sx=rnd(c),sy=rnd(r),front=[];seen[sy*c+sx]=1;g[2*sy+1][2*sx+1]=0;
    const addF=(x,y)=>D.forEach(([dx,dy])=>{const nx=x+dx,ny=y+dy;if(inC(nx,ny)&&!seen[ny*c+nx]){seen[ny*c+nx]=2;front.push([nx,ny])}});
    addF(sx,sy);
    while(front.length){
      const [x,y]=front.splice(rnd(front.length),1)[0];
      const vis=D.map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>inC(nx,ny)&&seen[ny*c+nx]===1);
      const [vx,vy]=vis[rnd(vis.length)];carve(vx,vy,x,y);seen[y*c+x]=1;addF(x,y);
    }
  }
  // a few loops (fewer than before, so dead ends really are dead ends)
  for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){
    if(g[y][x]!==1||(x+y)%2===0)continue;
    const horiz=g[y][x-1]===0&&g[y][x+1]===0,vert=g[y-1][x]===0&&g[y+1][x]===0;
    if((horiz||vert)&&Math.random()<.05)g[y][x]=0;
  }
  // chambers: open 2x2-cell rooms with a fire pillar in the middle
  G.rooms=[];
  const nRooms=c*r>=70?2:1;
  for(let k=0;k<nRooms*10&&G.rooms.length<nRooms;k++){
    const rx=1+rnd(Math.max(1,c-3)),ry=1+rnd(Math.max(1,r-3));
    if(G.rooms.some(q=>Math.abs(q.rx-rx)<4&&Math.abs(q.ry-ry)<4))continue;
    for(let y=2*ry+1;y<=2*ry+3;y++)for(let x=2*rx+1;x<=2*rx+3;x++)g[y][x]=0;
    g[2*ry+2][2*rx+2]=1;
    G.rooms.push({rx,ry,px:2*rx+2,py:2*ry+2});
  }
  return{g,algo};
}
export const gateAt = (x,y)=>G.gateMap&&G.gateMap[y*G.W+x]?G.gates[G.gateMap[y*G.W+x]-1]:null;
export const walk = (x,y)=>{if(!(x>=0&&y>=0&&x<G.W&&y<G.H&&G.grid[y][x]===0)||(x===G.exit.x&&y===G.exit.y))return false;const g=gateAt(x,y);return!g||g.open};
// reachability ignoring gate state, with an optional set of blocked tiles
export function reach(sx,sy,blocked){
  const dist=new Int32Array(G.W*G.H).fill(-1),q=[sy*G.W+sx];dist[sy*G.W+sx]=0;
  for(let i=0;i<q.length;i++){const k=q[i],x=k%G.W,y=(k/G.W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=G.W||ny>=G.H||G.grid[ny][nx]!==0||(nx===G.exit.x&&ny===G.exit.y))continue;const nk=ny*G.W+nx;if(blocked&&blocked.has(nk))continue;if(dist[nk]<0){dist[nk]=dist[k]+1;q.push(nk)}}}
  return dist;
}
export const canStep = (x,y)=>walk(x,y)||(G.doorOpen&&x===G.exit.x&&y===G.exit.y);
export function bfs(sx,sy){
  const dist=new Int32Array(G.W*G.H).fill(-1),prev=new Int32Array(G.W*G.H).fill(-1),q=[sy*G.W+sx];dist[sy*G.W+sx]=0;
  for(let i=0;i<q.length;i++){
    const k=q[i],x=k%G.W,y=(k/G.W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;if(!walk(nx,ny))continue;const nk=ny*G.W+nx;
      if(dist[nk]<0){dist[nk]=dist[k]+1;prev[nk]=k;q.push(nk)}
    }
  }
  return{dist,prev};
}
