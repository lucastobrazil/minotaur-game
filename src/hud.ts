import { G } from './state';
import type { CamMode, Difficulty, Grip } from './types';
import { $ } from './core';
import { faceOpen } from './firstPerson';
import { setFocus, setGrip } from './input';
import { resize } from './render';

/* ---------- HUD & flow ---------- */
export const fmt = (s: number): string=>{s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
export function updateHUD(){$('hLvl').textContent='Level '+G.level;$('hThr').textContent=`🧶 ${G.got}/${G.needed}`;$('hHug').textContent='💥 '+G.hugs;updateTime()}
export function updateTime(){$('hTime').textContent='⏱ '+fmt(G.elapsed)}
export function showToast(msg: string, ms=2200){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(G.toastTimer);G.toastTimer=setTimeout(()=>t.classList.remove('show'),ms)}
export function setPlayers(n: number, manual: boolean){
  G.numPlayers=n;if(manual)G.modeTouched=true;
  document.querySelectorAll<HTMLElement>('[data-players]').forEach(b=>b.classList.toggle('sel',Number(b.dataset.players)===n));
  $('pad1').classList.toggle('hidden',n<2);
  document.body.classList.toggle('two',n>1);requestAnimationFrame(resize);
  if(n<2){$('sideR').prepend($('acts0'));$('acts1').classList.add('hidden')}
  else{$('sideL').appendChild($('acts0'));$('acts1').classList.remove('hidden')}
}
export function setDiff(d: Difficulty){G.difficulty=d;document.querySelectorAll<HTMLElement>('[data-diff]').forEach(b=>b.classList.toggle('sel',b.dataset.diff===d))}
export const CAM_LABEL: Record<CamMode, [string, string]> = {near:['📷 Close','📷 Close view'],map:['🗺️ Map','🗺️ Map view'],fp:['👁️ First person','👁️ First person']};
export function toggleCam(){
  G.camMode=G.camMode==='near'?'map':G.camMode==='map'?'fp':'near';
  $('camBtn').textContent=CAM_LABEL[G.camMode][0];$('pCamBtn').textContent=CAM_LABEL[G.camMode][1];
  if(G.camMode==='fp'){G.players.forEach(faceOpen);if(G.state==='play'||G.state==='pause')showToast('👁️ First person: ▲ forward · ▼ step back · ◀ ▶ turn',3000)}
}
export function hideAll(){G.livePads=false;['titleOv','winOv','pauseOv','assignOv'].forEach(id=>$(id).classList.add('hidden'));setFocus(null)}
export function levelIntro(){
  const n=G.minos.length;
  showToast(n>1?`Level ${G.level}: ${G.needed} threads… and ${['','','TWO','THREE','FOUR'][n]} Minotaurs`:`Level ${G.level}: find ${G.needed} golden threads 🧶`,2800);
  if(G.level===1&&G.gates.length)setTimeout(()=>{if(G.state==='play')showToast('Find the coloured lever to open its gate. Hold sprint to run!',3500)},3000);
}

export function buildStamina(){
  const w=$('stamWrap');w.innerHTML='';
  G.players.forEach((p,i)=>{const wrap=document.createElement('span');wrap.style.display='flex';wrap.style.alignItems='center';const sp=document.createElement('span');sp.className='pill stam';sp.title='Sprint';const b=document.createElement('b');b.id='stb'+i;sp.appendChild(b);wrap.appendChild(sp);const iv=document.createElement('span');iv.className='inv';iv.id='inv'+i;iv.textContent='🔥';iv.title='Fireball ready';wrap.appendChild(iv);w.appendChild(wrap)});
}

export function init() {
  document.querySelectorAll<HTMLElement>('[data-players]').forEach(b=>b.onclick=()=>setPlayers(Number(b.dataset.players),true));
  document.querySelectorAll<HTMLElement>('[data-diff]').forEach(b=>b.onclick=()=>setDiff(b.dataset.diff as Difficulty));
  document.querySelectorAll<HTMLElement>('[data-grip]').forEach(b=>b.onclick=()=>setGrip(b.dataset.grip as Grip));
}
