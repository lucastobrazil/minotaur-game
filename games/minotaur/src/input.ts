import { G } from './state';
import type { Grip, Vec2 } from './types';
import { initAudio, tone } from './audio';
import { assignInput, nextLevel, pause, renderPadList, requestStart, resume } from './controllers';
import { $, codes, keys, tapped, touchDir, touchSprint, touchThrow } from './core';
import { setPlayers, showToast, toggleCam } from './hud';

export function throwHeld(i: number): boolean{
  const c=[['ControlRight','KeyM'],['KeyF'],['KeyO'],['Numpad9']][i].slice();
  if(G.numPlayers===1)c.push('KeyF','ControlLeft');
  if(c.some(k=>codes[k]||tapped.has(k))||touchThrow[i])return true;
  if(splitMode()){const p=splitPad();const k=i===0?6:7;return!!(p.buttons[k]&&p.buttons[k].pressed)}
  for(const p of padsFor(i))if(p.buttons[1]&&p.buttons[1].pressed)return true;
  return false;
}
export function sprintHeld(i: number): boolean{
  const c=[['Enter','NumpadEnter','ShiftRight','Slash','Period'],['ShiftLeft','KeyQ','KeyE'],['KeyU'],['Numpad7']][i].slice();
  if(G.numPlayers===1)c.push('ShiftLeft','KeyQ','KeyE','Space');
  if(c.some(k=>codes[k])||touchSprint[i])return true;
  if(splitMode()){const p=splitPad();return(i===0?[4,10]:[5,11]).some(k=>p.buttons[k]&&p.buttons[k].pressed)}
  const myPads=padsFor(i);
  for(const p of myPads)for(const b of (p.mapping==='standard'?[0,2,3,6,7]:[0,2,3,6,7,10,11]))if(p.buttons[b]&&p.buttons[b].pressed)return true;
  return false;
}
export function padReport(): string{
  const n=G.pads.length,pill=$('padPill');
  if(n||G.everPad){pill.style.display='';pill.textContent='🎮 '+n;pill.style.background=n?'rgba(95,224,122,.18)':'rgba(255,80,60,.3)'}
  if(n===1&&G.numPlayers===2&&splitMode())return `1 controller (${G.pads[0].id.split('(')[0].trim()}) shared: left side = Theseus, right side = Ariadne. Grip: ${G.grip}.`;
  return n?`${n} controller${n>1?'s':''} connected. Press buttons to see which one lights up:`
          :'No controllers found. Click or tap the game once, then press a button on each Joy-Con. The browser only notices a controller after a button press.';
}
export function showPauseMsg(t: string){const m=$('pauseMsg');m.textContent=t;m.style.display=t?'':'none'}
export function pollPads(){
  let list: Gamepad[]=[];try{list=Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter((p): p is Gamepad=>!!p)}catch(e){}
  G.pads=list.sort((a,b)=>a.index-b.index);
  if(G.pads.length)G.everPad=true;
  if(G.pads.length!==G.lastPadCount){G.lastPadCount=G.pads.length;padReport()}
  let selPress=false,menuPress=false,camPress=false,nx=0,ny=0;const edged=new Set<number>();
  for(const p of G.pads){
    const prev=G.prevBtn[p.index]||[],std=p.mapping==='standard';
    p.buttons.forEach((b,i)=>{
      if(b.pressed&&!prev[i]){
        edged.add(p.index);
        if(std&&i>=12&&i<=15)return;
        if(i===8||i===9)menuPress=true;
        else if(std&&(i===4||i===5))camPress=true;
        else selPress=true;
      }
    });
    G.prevBtn[p.index]=p.buttons.map(b=>b.pressed);
    const a=p.axes,b=p.buttons;
    if(a.length>=2){if(Math.abs(a[0])>.6)nx=Math.sign(a[0]);if(Math.abs(a[1])>.6)ny=Math.sign(a[1])}
    if(!std&&a.length>9){const h=hatDir(a[9]);if(h){nx=h[0];ny=h[1]}}
    if(b[12]&&b[12].pressed)ny=-1;if(b[13]&&b[13].pressed)ny=1;if(b[14]&&b[14].pressed)nx=-1;if(b[15]&&b[15].pressed)nx=1;
  }
  document.body.classList.toggle('haspad',G.pads.length>0);
  if(G.state==='assign'){assignInput(edged,menuPress);renderPadList();return}
  if(G.livePads&&G.state==='pause')renderPadList();
  const inMenu=G.state==='title'||G.state==='win'||G.state==='pause';
  if(inMenu&&G.pads.length){
    const items=navItems();
    if(items.length&&(!G.navFocus||!items.includes(G.navFocus)))setFocus(defaultFocus(items));
    if(G.pads.length===1&&isCombo(G.pads[0])&&G.grip==='sideways'&&(G.state==='title'||G.numPlayers===2)){const r=rotGrip(nx,ny,0);nx=r[0];ny=r[1]}
    const key=ny?'y'+ny:(nx?'x'+nx:''),now=performance.now();
    if(key&&(key!==G.navPrev||now>G.navT)){G.navT=now+(key!==G.navPrev?380:170);navMove(ny?0:nx,ny)}
    G.navPrev=key;
  }
  if(G.state==='title'){
    const combo=usable().length===1&&isCombo(usable()[0]);
    const want=combo?2:Math.min(4,usable().length);
    if(!G.modeTouched&&want>=2&&G.numPlayers!==want)setPlayers(want,false);
    $('padStatus').textContent=combo?'🎮 Both Joy-Cons connected (as one controller). Left = Theseus, right = Ariadne.':(G.pads.length?`🎮 ${G.pads.length} controller${G.pads.length>1?'s':''} connected`:'');
    if(menuPress)requestStart();else if(selPress&&G.navFocus){initAudio();G.navFocus.click()}
  }else if(G.state==='win'){if(menuPress)nextLevel();else if(selPress&&G.navFocus)G.navFocus.click()}
  else if(G.state==='play'){if(menuPress)pause();if(camPress&&!splitMode())toggleCam()}
  else if(G.state==='pause'){if(menuPress)resume();else if(selPress&&G.navFocus)G.navFocus.click()}
}
export function navItems(): HTMLElement[]{
  const ov=['titleOv','winOv','pauseOv'].map(id=>$(id)).find(o=>!o.classList.contains('hidden'));
  return ov?[...ov.querySelectorAll<HTMLElement>('button')].filter(b=>b.offsetParent!==null):[];
}
export function defaultFocus(items: HTMLElement[]): HTMLElement{return items.find(b=>b.classList.contains('go'))||items[0]}
export function setFocus(el: HTMLElement | null){
  document.querySelectorAll<HTMLElement>('.focus').forEach(e=>e.classList.remove('focus'));
  G.navFocus=el;if(el){el.classList.add('focus');try{el.scrollIntoView({block:'nearest'})}catch(e){}}
}
export function navMove(dx: number, dy: number){
  const items=navItems();if(!items.length||!G.navFocus)return;
  const r=G.navFocus.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let best: HTMLElement | null=null,bs=1e9;
  for(const it of items){
    if(it===G.navFocus)continue;
    const q=it.getBoundingClientRect(),ddx=q.left+q.width/2-cx,ddy=q.top+q.height/2-cy;
    if(dy){if(Math.sign(ddy)!==dy||Math.abs(ddy)<6)continue}
    else{if(Math.sign(ddx)!==dx||Math.abs(ddy)>r.height/2)continue}
    const sc=dy?Math.abs(ddy)+Math.abs(ddx)*.4:Math.abs(ddx);
    if(sc<bs){bs=sc;best=it}
  }
  if(best){setFocus(best);tone(520,.04,'triangle',.05)}
}
/** Decode a non-standard controller's d-pad "hat" axis into a direction. */
export function hatDir(v: number | undefined): [number, number] | null{
  if(v===undefined||v>1.05||v<-1.05)return null;
  const i=Math.round((v+1)*3.5)%8;
  const dirs: [number, number][]=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  return dirs[i];
}
export const isCombo = (p: Gamepad | undefined): boolean=>!!p&&/L\+R|200e|Joy-Con \(L\/R\)/i.test(p.id);
// two players but only one controller (Chrome joins a pair of Joy-Cons into one device): split it in half
export const newAssign = (): Set<number>[]=>[new Set(),new Set(),new Set(),new Set()];
export const ownerOf = (idx: number): number=>G.assign.findIndex((s,k)=>k<G.numPlayers&&s.has(idx));
export const padName = (p: Gamepad): string=>isCombo(p)?'Joy-Con pair':/Joy-Con \(L\)/i.test(p.id)?'Joy-Con (L)':/Joy-Con \(R\)/i.test(p.id)?'Joy-Con (R)':(p.id.split('(')[0].trim()||'Controller');
export const isSingleJoy = (p: Gamepad): boolean=>/Joy-Con/i.test(p.id)&&!isCombo(p);
// Chrome can list two Joy-Cons three times: left, right, and both joined as a "pair".
// When the single Joy-Cons are listed, the joined pair is only a copy, so it's ignored.
export const pairIsCopy = (p: Gamepad): boolean=>isCombo(p)&&G.pads.some(isSingleJoy);
export const usable = (): Gamepad[]=>G.pads.filter(p=>!pairIsCopy(p));
// which connected controllers belong to player i
export function padsFor(i: number): Gamepad[]{
  if(G.numPlayers===1)return G.pads;
  const u=usable();
  const mine=u.filter(p=>G.assign[i].has(p.index));
  if(mine.length)return mine;
  const any=G.assign.some((s,k)=>k<G.numPlayers&&s.size);
  if(!any)return u[i]?[u[i]]:[];
  // players without a chosen controller share out the free ones in order
  const free=u.filter(p=>ownerOf(p.index)<0);
  const waiting=[...Array(G.numPlayers).keys()].filter(k=>!G.assign[k].size);
  const slot=waiting.indexOf(i);
  return free[slot]?[free[slot]]:[];
}
export const splitPad = (): Gamepad=>G.pads.find(p=>p.index===G.splitIdx)||usable()[0]||G.pads[0];
export const splitMode = (): boolean=>G.numPlayers===2&&(usable().length===1||(G.splitIdx!==null&&G.pads.some(p=>p.index===G.splitIdx)));
export function rotGrip(nx: number, ny: number, side: number): [number, number]{if(G.grip!=='sideways')return[nx,ny];return side===0?[ny,-nx]:[-ny,nx]}
export function splitDir(p: Gamepad, i: number): [number, number]{
  let nx=0,ny=0;const a=p.axes,pr=(k: number)=>p.buttons[k]&&p.buttons[k].pressed;
  if(i===0){
    if(a.length>=2){if(Math.abs(a[0])>.5)nx+=Math.sign(a[0]);if(Math.abs(a[1])>.5)ny+=Math.sign(a[1])}
    if(pr(12))ny-=1;if(pr(13))ny+=1;if(pr(14))nx-=1;if(pr(15))nx+=1;
  }else{
    if(a.length>=4){if(Math.abs(a[2])>.5)nx+=Math.sign(a[2]);if(Math.abs(a[3])>.5)ny+=Math.sign(a[3])}
    if(pr(3))ny-=1;if(pr(0))ny+=1;if(pr(2))nx-=1;if(pr(1))nx+=1;
  }
  return rotGrip(Math.sign(nx),Math.sign(ny),i);
}
export function setGrip(g: Grip){G.grip=g;try{localStorage.setItem('minoGrip',g)}catch(e){}document.querySelectorAll<HTMLElement>('[data-grip]').forEach(b=>b.classList.toggle('sel',b.dataset.grip===g))}
export function getDir(i: number): Vec2 | null{
  let x=0,y=0;
  const KS=[['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'],['KeyA','KeyD','KeyW','KeyS'],['KeyJ','KeyL','KeyI','KeyK'],['Numpad4','Numpad6','Numpad8','Numpad5']];
  const sets=[KS[i]];if(G.numPlayers===1)sets.push(KS[1]);
  for(const [l,r,u,d] of sets){if(codes[l])x-=1;if(codes[r])x+=1;if(codes[u])y-=1;if(codes[d])y+=1}
  if(splitMode()){const v=splitDir(splitPad(),i);x+=v[0];y+=v[1]}
  const myPads=splitMode()?[]:padsFor(i);
  for(const p of myPads){
    const a=p.axes,b=p.buttons;
    if(a.length>=2){if(Math.abs(a[0])>.5)x+=Math.sign(a[0]);if(Math.abs(a[1])>.5)y+=Math.sign(a[1])}
    if(isCombo(p)&&a.length>=4){if(Math.abs(a[2])>.5)x+=Math.sign(a[2]);if(Math.abs(a[3])>.5)y+=Math.sign(a[3])}
    if(p.mapping!=='standard'&&a.length>9){const h=hatDir(a[9]);if(h){x+=h[0];y+=h[1]}}
    if(b[12]&&b[12].pressed)y-=1;if(b[13]&&b[13].pressed)y+=1;if(b[14]&&b[14].pressed)x-=1;if(b[15]&&b[15].pressed)x+=1;
  }
  x+=touchDir[i].x;y+=touchDir[i].y;
  x=Math.sign(x);y=Math.sign(y);
  return(x||y)?{x,y}:null;
}

export function init() {
  /* ---------- input ---------- */
  addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    keys[e.key.length===1?e.key.toLowerCase():e.key]=true;codes[e.code]=true;tapped.add(e.code);
    if(G.state==='play'&&(['Tab','Slash','Space'].includes(e.code)||e.code.startsWith('Numpad')))e.preventDefault();
    if(e.repeat)return;
    if(e.key==='c'||e.key==='C')toggleCam();
    if(G.state==='assign'){if(e.key==='Escape')$('assignSkip').click();else if(e.key==='Enter'&&$('assignDone').style.display!=='none')$('assignDone').click()}
    else if(G.state==='title'&&(e.key==='Enter'||e.key===' '))requestStart();
    else if(G.state==='win'&&(e.key==='Enter'||e.key===' '))nextLevel();
    else if(G.state==='play'&&(e.key==='Escape'||e.key==='p'))pause();
    else if(G.state==='pause'&&(e.key==='Escape'||e.key==='p'||e.key==='Enter'))resume();
  });
  addEventListener('keyup',e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false;codes[e.code]=false});
  addEventListener('blur',()=>{for(const k in keys)keys[k]=false;for(const k in codes)codes[k]=false});
  document.querySelectorAll<HTMLElement>('.sprint:not(.throw)').forEach(b=>{
    const p=Number(b.dataset.p);
    b.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();touchSprint[p]=true;b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}});
    const off=()=>{touchSprint[p]=false;b.classList.remove('on')};
    b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);
  });
  document.querySelectorAll<HTMLElement>('.sprint.throw').forEach(b=>{
    const p=Number(b.dataset.p);
    b.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();touchThrow[p]=true;b.classList.add('on')});
    const off=()=>{touchThrow[p]=false;b.classList.remove('on')};
    b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);
  });
  document.querySelectorAll<HTMLElement>('.pad button').forEach(b=>{
    const p=Number(b.dataset.p),x=Number(b.dataset.x),y=Number(b.dataset.y);
    const on=(e: PointerEvent)=>{e.preventDefault();initAudio();touchDir[p]={x,y};b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}};
    const off=()=>{if(touchDir[p].x===x&&touchDir[p].y===y)touchDir[p]={x:0,y:0};b.classList.remove('on')};
    b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);
  });
  addEventListener('gamepadconnected',e=>{G.everPad=true;pollPads();showToast('🎮 Controller connected',1600)});
  addEventListener('gamepaddisconnected',e=>{
    const gi=e.gamepad&&e.gamepad.index;G.assign.forEach(s=>s.delete(gi));if(G.splitIdx===gi)G.splitIdx=null;
    pollPads();
    if(G.state==='play'){pause();showPauseMsg('🎮 A controller disconnected. Press any button on it to reconnect, then press a button again to keep playing.')}
    else showToast('🎮 Controller disconnected. Press a button on it to reconnect.',3000);
  });
  try{G.grip=localStorage.getItem('minoGrip')==='upright'?'upright':'sideways'}catch(e){}
  G.assign = newAssign();
}
