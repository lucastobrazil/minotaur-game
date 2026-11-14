// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';
import { G } from './state';
import { noiseBurst, route } from './audio';
import { $, GATE_COLS, TRAIL, rnd, stage } from './core';
import { updateHUD } from './hud';
import { genMaze, reach } from './maze';
import { M, box, cyl, glowPool, glowSprite, makeMino, makePlayer, moon, renderer, scene, setDoorLabel, shadowAll, sph } from './scene';
import { CAPTEX, GLOW, WALLTEX, canvasTex, speckle } from './textures';

/* ---------- level setup ---------- */
export function dims(){
  const r=stage.getBoundingClientRect(),aspect=Math.max(.3,r.width/Math.max(1,r.height));
  const long=Math.min(11+G.level*2,33);let c,rr;
  if(aspect>=1){c=long;rr=Math.max(6,Math.round(long/aspect))}else{rr=long;c=Math.max(6,Math.round(long*aspect))}
  return[c,rr];
}
export function disposeGroup(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map&&m.map!==GLOW&&m.map!==WALLTEX&&m.map!==CAPTEX)m.map.dispose();m.dispose()})}})}
export function makeFire(scale=1){
  const f=new THREE.Group();
  const outer=new THREE.Mesh(new THREE.ConeGeometry(.06*scale,.18*scale,8),new THREE.MeshBasicMaterial({color:'#ff7a26'}));outer.position.y=.09*scale;f.add(outer);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(.032*scale,.11*scale,8),new THREE.MeshBasicMaterial({color:'#ffe08a'}));inner.position.y=.06*scale;f.add(inner);
  const glow=glowSprite('#ff8a3a',1.1*scale,.9);glow.position.y=.1*scale;f.add(glow);
  f.userData={outer,inner,glow,seed:Math.random()*100,base:scale};
  return f;
}
export function boxesGeo(list,U,V,keepBottom){
  const tmp=new THREE.BoxGeometry(1,1,1).toNonIndexed(),P=tmp.attributes.position.array,N=tmp.attributes.normal.array;
  const pos=[],nor=[],uv=[];
  for(const [cx,cy,cz,sx,sy,sz] of list){
    for(let i=0;i<P.length;i+=9){
      if(N[i+1]<-.5&&!keepBottom)continue; // wall bottoms are never seen (cap undersides are, from first person)
      for(let v=0;v<9;v+=3){
        const k=i+v,x=cx+P[k]*sx,y=cy+P[k+1]*sy,z=cz+P[k+2]*sz,nx=N[k],ny=N[k+1],nz=N[k+2];
        pos.push(x,y,z);nor.push(nx,ny,nz);
        if(Math.abs(nx)>.5)uv.push(z*U,y*V);else if(Math.abs(nz)>.5)uv.push(x*U,y*V);else uv.push(x*U*.5,z*U*.5);
      }
    }
  }
  tmp.dispose();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeBoundingSphere();return g;
}
export function buildLevel(){
  scene.remove(G.levelGroup);disposeGroup(G.levelGroup);G.levelGroup=new THREE.Group();scene.add(G.levelGroup);
  G.torches=[];
  const isWall=(x,y)=>x>=0&&y>=0&&x<G.W&&y<G.H&&G.grid[y][x]===1;
  // floor: worn flagstones
  const TP=32;
  const ftex=canvasTex(G.W*TP,G.H*TP,(x)=>{
    x.fillStyle='#2b241d';x.fillRect(0,0,G.W*TP,G.H*TP);
    for(let y=0;y<G.H;y++)for(let xx=0;xx<G.W;xx++){
      const split=Math.random()<.35;
      const stones=split?(Math.random()<.5?[[0,0,TP,TP/2],[0,TP/2,TP,TP/2]]:[[0,0,TP/2,TP],[TP/2,0,TP/2,TP]]):[[0,0,TP,TP]];
      for(const [sx,sy,sw,sh] of stones){const v=rnd(22);x.fillStyle=`rgb(${98+v},${86+v},${70+v})`;x.fillRect(xx*TP+sx+1.5,y*TP+sy+1.5,sw-3,sh-3)}
    }
    speckle(x,G.W*TP,G.H*TP,G.W*G.H*10,['#000','#fff','#3a2f24']);
    for(let i=0;i<G.W*G.H/6;i++){const g=x.createRadialGradient(0,0,0,0,0,1);const cx=rnd(G.W*TP),cy=rnd(G.H*TP),rr=10+rnd(30);x.save();x.translate(cx,cy);x.scale(rr,rr);g.addColorStop(0,'rgba(30,24,18,.35)');g.addColorStop(1,'rgba(30,24,18,0)');x.fillStyle=g;x.fillRect(-1,-1,2,2);x.restore()}
    x.strokeStyle='rgba(15,10,6,.55)';x.lineWidth=1;
    for(let i=0;i<G.W*G.H/5;i++){x.beginPath();let cx=rnd(G.W*TP),cy=rnd(G.H*TP);x.moveTo(cx,cy);for(let k=0;k<3;k++){cx+=rnd(14)-7;cy+=rnd(14)-7;x.lineTo(cx,cy)}x.stroke()}
  });
  ftex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(G.W,G.H),new THREE.MeshStandardMaterial({map:ftex,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.set((G.W-1)/2,0,(G.H-1)/2);floor.receiveShadow=true;G.levelGroup.add(floor);
  // walls
  const WH=.95,T=.44;
  // walls are built as one mesh: pillars plus connecting sections that don't overlap (no flickering faces),
  // with textures mapped in world space so the brick courses line up across every piece
  const pieces2=[],capPieces=[],CT=T+.06;
  for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){
    if(!isWall(x,y))continue;
    pieces2.push([x,WH/2,y,T,WH,T]);capPieces.push([x,WH+.035,y,CT,.07,CT]);
    if(isWall(x+1,y)){pieces2.push([x+.5,WH/2,y,1-T,WH,T]);capPieces.push([x+.5,WH+.035,y,1-CT,.07,CT])}
    if(isWall(x,y+1)){pieces2.push([x,WH/2,y+.5,T,WH,1-T]);capPieces.push([x,WH+.035,y+.5,CT,.07,1-CT])}
  }
  const walls=new THREE.Mesh(boxesGeo(pieces2,1,1/WH),new THREE.MeshStandardMaterial({map:WALLTEX,roughness:.95}));
  const caps=new THREE.Mesh(boxesGeo(capPieces,2,8,true),new THREE.MeshStandardMaterial({map:CAPTEX,roughness:.95}));
  walls.castShadow=walls.receiveShadow=caps.castShadow=caps.receiveShadow=true;
  G.levelGroup.add(walls,caps);
  // wall torches
  const iron=M('#26221e',{metalness:.5,roughness:.6}),wood=M('#4a3220');
  const spots=[];
  for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){
    if(!isWall(x,y)||(x+y)%2===0)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>0&&ny>0&&nx<G.W-1&&ny<G.H-1&&G.grid[ny][nx]===0)spots.push([x,y,dx,dy])}
  }
  const want=Math.max(4,Math.round(G.W*G.H/45));
  for(let i=0;i<want&&spots.length;i++){
    const [x,y,dx,dy]=spots.splice(rnd(spots.length),1)[0];
    if(G.torches.some(t=>Math.abs(t.x-x)+Math.abs(t.y-y)<5))continue;
    const t=new THREE.Group();t.position.set(x+dx*(T/2+.06),.68,y+dy*(T/2+.06));t.rotation.y=Math.atan2(dx,dy);
    const br=box(.05,.05,.14,iron);br.position.z=-.04;t.add(br);
    const st=cyl(.03,.022,.22,wood,8);st.position.set(0,.05,.02);st.rotation.x=.25;t.add(st);
    const fire=makeFire(1);fire.position.set(0,.17,.05);t.add(fire);
    G.levelGroup.add(t);
    const pool=glowPool('#ff7a2a',2.6,.32);pool.position.set(x+dx*.9,.012,y+dy*.9);G.levelGroup.add(pool);
    const wg=glowSprite('#ff7a2a',1.6,.25);wg.position.set(x+dx*(T/2+.02),.75,y+dy*(T/2+.02));G.levelGroup.add(wg);
    G.torches.push({x,y,fire,pool,wg});
  }
  // chamber fire pillars
  for(const r of G.rooms){
    const bowl=cyl(.3,.18,.16,iron,14);bowl.position.set(r.px,WH+.12,r.py);G.levelGroup.add(bowl);
    const fire=makeFire(2.6);fire.position.set(r.px,WH+.18,r.py);G.levelGroup.add(fire);
    const pool=glowPool('#ff7a2a',4.5,.4);pool.position.set(r.px,.013,r.py);G.levelGroup.add(pool);
    G.torches.push({x:r.px,y:r.py,fire,pool});
  }
  // rubble in dead ends
  const rock=M('#6a6157',{roughness:1});
  for(let y=1;y<G.H-1;y+=2)for(let x=1;x<G.W-1;x+=2){
    let open=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(G.grid[y+dy][x+dx]===0)open++;
    if(open===1&&Math.random()<.35){
      const g=new THREE.Group();
      for(let k=0;k<2+rnd(3);k++){const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.05+Math.random()*.08),rock);s.position.set(Math.random()*.6-.3,.04,Math.random()*.6-.3);s.rotation.set(Math.random()*3,Math.random()*3,0);g.add(s)}
      g.position.set(x,0,y);shadowAll(g);G.levelGroup.add(g);
    }
  }
  // outside: dead trees, broken columns, boulders
  const bark=M('#2e261f',{roughness:1}),marble=M('#8d867b',{roughness:.9});
  for(let i=0;i<Math.round((G.W+G.H)*1.1);i++){
    const side=rnd(4);let x,z;const d=1.8+Math.random()*7;
    if(side===0){x=Math.random()*(G.W+10)-5;z=-1-d}else if(side===1){x=Math.random()*(G.W+10)-5;z=G.H+d}else if(side===2){x=-1-d;z=Math.random()*(G.H+10)-5}else{x=G.W+d;z=Math.random()*(G.H+10)-5}
    const t=new THREE.Group(),kind=Math.random();
    if(side===1&&kind<.6)continue;
    if(kind<.45){
      const h=1.2+Math.random()*1.2;const tr=cyl(.07,.14,h,bark,7);tr.position.y=h/2;tr.rotation.z=Math.random()*.2-.1;t.add(tr);
      for(let k=0;k<3;k++){const bl=.4+Math.random()*.5;const b=cyl(.02,.05,bl,bark,6);const a=Math.random()*Math.PI*2;b.position.set(Math.cos(a)*bl*.35,h*(.55+k*.13),Math.sin(a)*bl*.35);b.rotation.set(Math.sin(a)*.9,0,-Math.cos(a)*.9);t.add(b)}
    }else if(kind<.8){
      const h=.6+Math.random()*1.6;const c=cyl(.22,.26,h,marble,14);c.position.y=h/2;t.add(c);
      const base=box(.7,.16,.7,marble);base.position.y=.08;t.add(base);
      if(Math.random()<.6){const ch=cyl(.22,.22,.5,marble,14);ch.rotation.z=Math.PI/2;ch.position.set(.6,.22,.2);ch.rotation.y=Math.random()*3;t.add(ch)}
    }else{
      const b=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+Math.random()*.4),rock);b.position.y=.15;b.rotation.set(Math.random()*3,Math.random()*3,0);t.add(b);
    }
    t.position.set(x,0,z);shadowAll(t);G.levelGroup.add(t);
  }
  // exit gate with portcullis
  const door=new THREE.Group();door.position.set(G.exit.x,0,G.exit.y);if(G.exit.axis==='z')door.rotation.y=Math.PI/2;
  for(const s of [-1,1]){const p=cyl(.14,.17,1.5,marble,14);p.position.set(0,.75,s*.5);door.add(p)}
  const lintel=box(.45,.22,1.35,marble);lintel.position.y=1.55;door.add(lintel);
  const gate=new THREE.Group(),bars=M('#2a2826',{metalness:.7,roughness:.5});
  for(let k=0;k<6;k++){const b=cyl(.022,.022,1.3,bars,6);b.position.set(0,.65,-.4+k*.16);gate.add(b)}
  for(let k=0;k<3;k++){const b=box(.05,.04,.9,bars);b.position.y=.25+k*.4;gate.add(b)}
  door.add(gate);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,3.2,20,1,true),new THREE.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  beam.position.y=1.6;door.add(beam);
  const exitLight=new THREE.PointLight('#ffd27a',0,6,1.5);exitLight.position.y=1;door.add(exitLight);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({depthTest:false}));sprite.scale.set(.85,.85,.85);sprite.position.y=2.2;sprite.renderOrder=5;door.add(sprite);
  shadowAll(door);
  G.levelGroup.add(door);
  G.doorParts={door,gate,beam,sprite,exitLight};setDoorLabel();
  // gates & levers
  const gIron=M('#2a2826',{metalness:.7,roughness:.5}),gStone=M('#6a6157',{roughness:1}),gBronze=M('#a87a3a',{metalness:.6,roughness:.4});
  G.gates.forEach(g=>{
    const grp=new THREE.Group();grp.position.set(g.x,0,g.y);if(g.axis==='z')grp.rotation.y=Math.PI/2;
    const bars=new THREE.Group();
    for(let k=0;k<6;k++){const b=cyl(.024,.024,1.0,gIron,6);b.position.set(0,.5,-.42+k*.168);bars.add(b)}
    for(let k=0;k<3;k++){const b=box(.05,.04,.95,gIron);b.position.y=.18+k*.34;bars.add(b)}
    grp.add(bars);
    const lin=box(.22,.12,1.1,gStone);lin.position.y=1.0;grp.add(lin);
    const gem=sph(.08,new THREE.MeshBasicMaterial({color:g.col}));gem.position.y=1.13;grp.add(gem);
    const gl=glowSprite(g.col,.9,.8);gl.position.y=1.13;grp.add(gl);
    shadowAll(grp);G.levelGroup.add(grp);
    const lv=new THREE.Group();lv.position.set(g.lx,0,g.ly);
    const plate=cyl(.32,.36,.06,gStone,20);plate.position.y=.03;lv.add(plate);
    const ring=glowPool(g.col,1.7,.55);ring.position.y=.07;lv.add(ring);
    const base=box(.16,.14,.12,gIron);base.position.y=.13;lv.add(base);
    const arm=new THREE.Group();arm.position.y=.16;
    const stick=cyl(.025,.025,.42,gBronze,8);stick.position.y=.21;arm.add(stick);
    const knob=sph(.06,new THREE.MeshBasicMaterial({color:g.col}));knob.position.y=.43;arm.add(knob);
    arm.rotation.z=.6;lv.add(arm);
    shadowAll(lv);G.levelGroup.add(lv);
    const inner=glowPool(g.col,1.1,.4);inner.position.set(g.ix,.016,g.iy);G.levelGroup.add(inner);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.07,.015,6,14),gBronze);handle.position.set(g.ix-g.x,.55,g.iy-g.y);G.levelGroup.add(handle);handle.position.add(new THREE.Vector3(g.x,0,g.y)).lerp(new THREE.Vector3(g.x,.55,g.y),.55);handle.lookAt(g.ix,.55,g.iy);
    Object.assign(g,{bars,arm,ring,gl,inner});
  });
  // fog of war: a dark veil over everything nobody has explored yet
  {
    const S=8,fcv=document.createElement('canvas');fcv.width=G.W*S;fcv.height=G.H*S;
    const mask=document.createElement('canvas');mask.width=G.W*S;mask.height=G.H*S;
    const ftx=new THREE.CanvasTexture(fcv);
    const fm=new THREE.Mesh(new THREE.PlaneGeometry(G.W,G.H),new THREE.MeshBasicMaterial({map:ftx,transparent:true,depthWrite:false,fog:false}));
    fm.rotation.x=-Math.PI/2;fm.position.set((G.W-1)/2,1.2,(G.H-1)/2);fm.renderOrder=3;G.levelGroup.add(fm);
    G.fogParts={canvas:fcv,mask,tex:ftx,mesh:fm,S};G.fogDirty=true;
  }
  // golden thread (glows so you can spot it in the dark)
  const gold=M('#f4b400',{emissive:'#7a5200',roughness:.4,metalness:.3}),goldD=M('#b07a00',{roughness:.5});
  for(const t of G.threads){
    const g=new THREE.Group();
    g.add(sph(.18,gold,18,14));
    for(let k=0;k<3;k++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.016,6,24),goldD);ring.rotation.set(Math.random()*3,Math.random()*3,0);g.add(ring)}
    g.add(glowSprite('#ffc23a',1.3,.6));
    g.position.set(t.x,.35,t.y);shadowAll(g);G.levelGroup.add(g);t.mesh=g;
    const pool=glowPool('#ffb000',1.4,.35);pool.position.set(t.x,.014,t.y);G.levelGroup.add(pool);t.pool=pool;
  }
  // players & trails
  const segGeo=new THREE.BoxGeometry(.07,.02,1);
  G.players.forEach((p,i)=>{
    p.mesh=makePlayer(i);p.mesh.scale.setScalar(1.3);p.mesh.position.set(p.x,0,p.y);G.levelGroup.add(p.mesh);
    p.orb=new THREE.Group();p.orb.add(sph(.06,new THREE.MeshBasicMaterial({color:'#ffd27a'}),10,8));p.orb.add(glowSprite('#ff6a1a',.45,.9));p.orb.position.set(.26,.32,.1);p.mesh.add(p.orb);
    p.trail=new THREE.Group();G.levelGroup.add(p.trail);
    p.segGeo=segGeo;p.segMat=new THREE.MeshBasicMaterial({color:TRAIL[i],transparent:true,opacity:.75});
  });
  // minotaurs
  document.querySelectorAll('.bubble').forEach(b=>b.remove());
  G.minos.forEach(m=>{
    m.mesh=makeMino();m.mesh.scale.setScalar(1.15);m.mesh.position.set(m.x,0,m.y);G.levelGroup.add(m.mesh);
    m.bubble=document.createElement('div');m.bubble.className='bubble';stage.appendChild(m.bubble);
  });
  // moonlight & shadows
  const span=Math.max(G.W,G.H)/2+4,cx=(G.W-1)/2,cz=(G.H-1)/2;
  moon.position.set(cx+span*.7,span*1.6,cz-span*.6);moon.target.position.set(cx,0,cz);
  Object.assign(moon.shadow.camera,{left:-span*1.3,right:span*1.3,top:span*1.3,bottom:-span*1.3,near:1,far:span*5});
  moon.shadow.camera.updateProjectionMatrix();
  G.camInit=false;
}
export function newLevel(){
  const [c,r]=dims();
  G.exit={x:-5,y:-5,axis:'x'};
  G.grid=genMaze(c,r).g;
  // random start corner, exit on a far edge
  const sc=[[0,0],[c-1,0],[0,r-1],[c-1,r-1]][rnd(4)];
  const sx=2*sc[0]+1,sy=2*sc[1]+1;
  if(Math.random()<.5){
    const ex=sc[0]===0?G.W-1:0;const half=sc[1]===0?[Math.floor(r/2),r]:[0,Math.ceil(r/2)];
    G.exit={x:ex,y:2*(half[0]+rnd(half[1]-half[0]))+1,axis:'x'};
  }else{
    const ey=sc[1]===0?G.H-1:0;const half=sc[0]===0?[Math.floor(c/2),c]:[0,Math.ceil(c/2)];
    G.exit={x:2*(half[0]+rnd(half[1]-half[0]))+1,y:ey,axis:'z'};
  }
  G.grid[G.exit.y][G.exit.x]=0;
  G.gates=[];G.gateMap=null;
  G.players=[];
  const near=[];{const d0=reach(sx,sy);for(let k=0;k<d0.length;k++)if(d0[k]>=0)near.push([d0[k],k]);near.sort((a,b)=>a[0]-b[0])}
  for(let i=0;i<G.numPlayers;i++){
    const k=(near[i]||near[0])[1],px=k%G.W,py=(k/G.W)|0;
    G.players.push({x:px,y:py,px,py,sx:px,sy:py,next:0,inv:0,last:{x:0,y:1},face:0,stamina:1,tired:false,sprinting:false});
  }
  placeGates(sx,sy);
  const dist=reach(sx,sy);let maxd=0;for(const d of dist)if(d>maxd)maxd=d;
  const isLever=(x,y)=>G.gates.some(g=>g.lx===x&&g.ly===y);
  const cells=[];for(let y=1;y<G.H;y+=2)for(let x=1;x<G.W;x+=2)if(dist[y*G.W+x]>=0)cells.push([x,y,dist[y*G.W+x]]);
  // minotaurs
  const th=G.difficulty==='speedy'?[2,5]:[4,8];const nMino=1+(G.level>=th[0])+(G.level>=th[1]);
  G.minos=[];
  const lairs=G.rooms.map(rm=>[rm.px-1,rm.py-1]).filter(([x,y])=>dist[y*G.W+x]>=maxd*.4);
  const far=cells.filter(([,,d])=>d>=maxd*.5);
  for(let i=0;i<nMino;i++){
    let pos=lairs.length?lairs.splice(rnd(lairs.length),1)[0]:null;
    if(!pos){const f=far.filter(([x,y])=>!G.minos.some(m=>Math.abs(m.x-x)+Math.abs(m.y-y)<8));const pick=(f.length?f:far)[rnd((f.length?f:far).length)];pos=[pick[0],pick[1]]}
    G.minos.push({x:pos[0],y:pos[1],px:pos[0],py:pos[1],next:performance.now()+1800+i*700,dir:{x:0,y:1},face:0,mode:'wander',say:'',sayUntil:0,lastSpot:0,hugT:0,puffT:0,enraged:false});
  }
  // threads: favour dead ends far from the start
  G.needed=Math.min(5+Math.floor((G.level-1)/2),10);G.got=0;G.doorOpen=false;G.threads=[];
  const isDead=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>G.grid[y+dy][x+dx]===0).length===1;
  const pools=[cells.filter(([x,y,d])=>d>=6&&isDead(x,y)),cells.filter(([x,y,d])=>d>=5)];
  for(const pool of pools){
    let tries=0;
    while(G.threads.length<G.needed&&tries<400&&pool.length){
      tries++;const [x,y]=pool[rnd(pool.length)];
      if(G.minos.some(m=>m.x===x&&m.y===y)||isLever(x,y))continue;
      if(G.threads.some(t=>Math.abs(t.x-x)+Math.abs(t.y-y)<(tries<250?6:1)))continue;
      G.threads.push({x,y,taken:false});
    }
  }
  G.needed=G.threads.length;
  G.elapsed=0;G.hugsLevel=0;
  G.chests=[];G.fireballs.forEach(f=>scene.remove(f.g));G.fireballs=[];G.fx.forEach(f=>scene.remove(f.s));G.fx=[];G.nextChestT=performance.now()+15000;
  G.players.forEach((p,i)=>p.item=G.carry[i]||null);
  G.explored=new Uint8Array(G.W*G.H);G.sight=new Uint8Array(G.W*G.H);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=G.exit.x+dx,y=G.exit.y+dy;if(x>=0&&y>=0&&x<G.W&&y<G.H)G.explored[y*G.W+x]=1}
  computeSight();
  buildLevel();updateHUD();buildStamina();
}
// co-op gates: each one cuts off part of the maze and is opened by the lever of the same colour
export function placeGates(sx,sy){
  G.gates=[];G.gateMap=new Int16Array(G.W*G.H);
  const all=reach(sx,sy);let total=0;for(const v of all)if(v>=0)total++;
  const nGates=Math.min(1+Math.floor(G.level/2),4);
  const conns=[];
  for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){
    if(G.grid[y][x]!==0||(x+y)%2===0)continue;
    const ax=G.grid[y][x-1]===0&&G.grid[y][x+1]===0&&G.grid[y-1][x]===1&&G.grid[y+1][x]===1;
    const az=G.grid[y-1][x]===0&&G.grid[y+1][x]===0&&G.grid[y][x-1]===1&&G.grid[y][x+1]===1;
    if(ax||az)conns.push([x,y,ax?'x':'z']);
  }
  while(conns.length&&G.gates.length<nGates){
    const [gx,gy,axis]=conns.splice(rnd(conns.length),1)[0];
    if(Math.abs(gx-sx)+Math.abs(gy-sy)<5||G.gates.some(g=>Math.abs(g.x-gx)+Math.abs(g.y-gy)<8))continue;
    // each gate must be a true chokepoint on its own, so there's always a clear "inside" with a handle
    const solo=reach(sx,sy,new Set([gy*G.W+gx]));
    const nb=axis==='x'?[[gx-1,gy],[gx+1,gy]]:[[gx,gy-1],[gx,gy+1]];
    const r0=solo[nb[0][1]*G.W+nb[0][0]]>=0,r1=solo[nb[1][1]*G.W+nb[1][0]]>=0;
    if(r0===r1)continue;
    const inside=r0?nb[1]:nb[0];
    let soloN=0;for(const v of solo)if(v>=0)soloN++;
    if(total-soloN-1<10)continue;
    const blocked=new Set(G.gates.map(g=>g.y*G.W+g.x));blocked.add(gy*G.W+gx);
    const d=reach(sx,sy,blocked);let n=0;for(const v of d)if(v>=0)n++;
    const cut=total-n-1;
    if(cut<Math.max(10,total*.06)||n<14)continue;
    if(G.gates.some(g=>d[g.ly*G.W+g.lx]<0))continue; // never trap an earlier lever behind this gate
    const dg=reach(gx,gy,null),opts=[];
    for(let y=1;y<G.H;y+=2)for(let x=1;x<G.W;x+=2){const k=y*G.W+x;if(d[k]>=4&&dg[k]>=6&&dg[k]<=22&&!G.gates.some(g=>g.lx===x&&g.ly===y))opts.push([x,y])}
    if(!opts.length)continue;
    const [lx,ly]=opts[rnd(opts.length)];
    G.gates.push({x:gx,y:gy,axis,lx,ly,ix:inside[0],iy:inside[1],open:false,until:0,pressed:false,tick:0,col:GATE_COLS[G.gates.length]});
  }
  G.gates.forEach((g,i)=>G.gateMap[g.y*G.W+g.x]=i+1);
}
// what the heroes can see right now (and everything they've ever seen)
export function computeSight(){
  if(!G.sight)return;G.sight.fill(0);
  const mark=(x,y)=>{if(x>=0&&y>=0&&x<G.W&&y<G.H){const k=y*G.W+x;G.sight[k]=1;if(!G.explored[k]){G.explored[k]=1;G.fogDirty=true}}};
  for(const p of G.players){
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)mark(p.x+dx,p.y+dy);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      for(let st=1;st<=8;st++){const x=p.x+dx*st,y=p.y+dy*st;if(x<0||y<0||x>=G.W||y>=G.H)break;mark(x,y);mark(x+dy,y+dx);mark(x-dy,y-dx);if(G.grid[y][x]===1)break}
    }
  }
}
export function buildStamina(){
  const w=$('stamWrap');w.innerHTML='';
  G.players.forEach((p,i)=>{const wrap=document.createElement('span');wrap.style.display='flex';wrap.style.alignItems='center';const sp=document.createElement('span');sp.className='pill stam';sp.title='Sprint';const b=document.createElement('b');b.id='stb'+i;sp.appendChild(b);wrap.appendChild(sp);const iv=document.createElement('span');iv.className='inv';iv.id='inv'+i;iv.textContent='🔥';iv.title='Fireball ready';wrap.appendChild(iv);w.appendChild(wrap)});
}
// iron portcullis: rattling chains + grinding as it lowers, a heavy clank when it slams shut
export function gateSound(open,g){
  if(!G.ac||!G.master)return;
  let d=0,ax=g?g.x:0;
  if(g&&G.players.length){d=1e9;for(const p of G.players){const dd=Math.hypot(p.x-g.x,p.y-g.y);if(dd<d){d=dd;ax=p.x}}}
  const v=Math.max(.45,1-d/26),pan=g?Math.max(-.7,Math.min(.7,(g.x-ax)/8)):0,t0=G.ac.currentTime;
  const clink=(t,vol)=>{
    const o=G.ac.createOscillator(),gg=G.ac.createGain();o.type='triangle';o.frequency.value=1700+Math.random()*1800;
    gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(vol,t+.003);gg.gain.exponentialRampToValueAtTime(.0001,t+.05);
    o.connect(gg);route(gg,1,.35,pan);o.start(t);o.stop(t+.06);
    noiseBurst(t,.025,'highpass',3500,vol*.8,1,.2,pan);
  };
  const clank=(t,vol)=>{
    const o=G.ac.createOscillator(),gg=G.ac.createGain();o.type='sine';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(38,t+.25);
    gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(vol,t+.008);gg.gain.exponentialRampToValueAtTime(.0001,t+.35);
    o.connect(gg);route(gg,1,.6,pan);o.start(t);o.stop(t+.4);
    noiseBurst(t,.12,'lowpass',600,vol*.6,1,.5,pan);
    const m=G.ac.createOscillator(),mg=G.ac.createGain();m.type='square';m.frequency.value=410;
    mg.gain.setValueAtTime(.0001,t);mg.gain.exponentialRampToValueAtTime(vol*.12,t+.004);mg.gain.exponentialRampToValueAtTime(.0001,t+.3);
    const bp=G.ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200;bp.Q.value=8;
    m.connect(bp).connect(mg);route(mg,1,.6,pan);m.start(t);m.stop(t+.32);
  };
  if(open){
    clank(t0,.16*v);
    for(let k=0;k<16;k++)clink(t0+.05+k*.055+Math.random()*.02,.05*v*(1-k/22));
    // grinding stone and iron
    const n=G.ac.createBufferSource();n.buffer=G.noiseB;const f=G.ac.createBiquadFilter();f.type='bandpass';f.frequency.value=170;f.Q.value=2;
    const gg=G.ac.createGain();gg.gain.setValueAtTime(.0001,t0);gg.gain.exponentialRampToValueAtTime(.22*v,t0+.15);gg.gain.setValueAtTime(.22*v,t0+.75);gg.gain.exponentialRampToValueAtTime(.0001,t0+1.05);
    n.connect(f).connect(gg);route(gg,1,.4,pan);n.start(t0,Math.random());n.stop(t0+1.1);
    const sw=G.ac.createOscillator(),sg=G.ac.createGain();sw.type='sawtooth';sw.frequency.setValueAtTime(46,t0);sw.frequency.linearRampToValueAtTime(40,t0+1);
    const lp=G.ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;
    sg.gain.setValueAtTime(.0001,t0);sg.gain.exponentialRampToValueAtTime(.08*v,t0+.15);sg.gain.exponentialRampToValueAtTime(.0001,t0+1.05);
    sw.connect(lp).connect(sg);route(sg,1,.3,pan);sw.start(t0);sw.stop(t0+1.1);
    clank(t0+1.0,.22*v);
  }else{
    for(let k=0;k<6;k++)clink(t0+k*.035,.045*v);
    clank(t0+.24,.32*v);
  }
}
