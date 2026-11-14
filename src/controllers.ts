import { G } from './state';

import { sfx } from './ambience';
import { initAudio, tone } from './audio';
import { bossRewardText, isBossLevel } from './boss';
import { $, COLORS, KEYDESC, NAMES, stage } from './core';
import { fmt, hideAll, levelIntro, setPlayers, showToast, toggleCam } from './hud';
import { isCombo, newAssign, ownerOf, padName, padReport, pairIsCopy, pollPads, setGrip, showPauseMsg, splitMode, usable } from './input';
import { computeSight, newLevel } from './level';
import { minoStep, update } from './logic';
import { renderView, resize, sync } from './render';
// ---------- choosing controllers by pressing a button on each ----------
export function needAssign(){
  if(G.numPlayers<2||usable().length<2)return false;
  if(G.splitIdx!==null&&G.pads.some(p=>p.index===G.splitIdx))return false;
  let ok=0;for(let i=0;i<G.numPlayers;i++)if(G.pads.some(p=>G.assign[i].has(p.index)))ok++;
  return ok<Math.min(G.numPlayers,usable().length);
}
export function requestStart(){initAudio();if(needAssign())openAssign(startGame,()=>{G.state='title';$('titleOv').classList.remove('hidden')});else startGame()}
export function openAssign(after: () => void, back: () => void){
  hideAll();G.state='assign';G.assignAfter=after;G.assignBack=back;
  G.assign=newAssign();G.splitIdx=null;G.assignStep=0;G.assignDoneT=0;buildSlots();
  $('assignOv').classList.remove('hidden');renderAssign();renderPadList(true);
}
export function finishAssign(){const a=G.assignAfter;hideAll();if(a)a()}
export function freePads(){return usable().filter(p=>ownerOf(p.index)<0)}
export function assignInput(edged: Set<number>, menuPress: boolean){
  const now=performance.now();
  if(G.assignDoneT){
    // copies of the last press that arrive a moment later belong to the same player
    for(const p of usable())if(edged.has(p.index)&&now-G.claimT<300&&ownerOf(p.index)<0)G.assign[G.numPlayers-1].add(p.index);
    if(now>G.assignDoneT)finishAssign();
    return;
  }
  for(const p of usable()){
    if(!edged.has(p.index))continue;
    if(ownerOf(p.index)>=0)continue;   // already chosen: a press can never move a controller to the other player
    // another controller pressed at the same moment belongs to the same player:
    // a copy of the same controller, or both Joy-Cons pressed together on purpose (pair mode)
    if(G.assignStep>0&&now-G.claimT<300){G.assign[G.assignStep-1].add(p.index);continue}
    // only a joined pair is listed and nobody has a controller yet: one half each
    if(isCombo(p)&&G.assignStep===0&&G.numPlayers===2){G.splitIdx=p.index;G.assign=newAssign();G.assign[0].add(p.index);G.assign[1].add(p.index);G.assignStep=2;G.claimT=now;tone(880,.1,'triangle',.12);break}
    G.assign[G.assignStep].add(p.index);G.claimT=now;tone(660+G.assignStep*110,.1,'triangle',.12);
    G.assignStep++;
    if(G.assignStep>=G.numPlayers)break;
  }
  if(G.assignStep>=1&&G.assignStep<G.numPlayers&&menuPress&&now-G.claimT>300){G.assignStep=G.numPlayers;G.assignDoneT=now+50}
  if(G.assignStep>=G.numPlayers&&!G.assignDoneT)G.assignDoneT=now+800;
  renderAssign();
}
export function buildSlots(){
  $('slots').innerHTML=[...Array(G.numPlayers).keys()].map(i=>`<div class="slot" id="slot${i}"><span class="sw" style="background:${COLORS[i]}"></span><div><b>${NAMES[i]}</b> (Player ${i+1})<div class="st" id="slotTxt${i}"></div></div></div>`).join('');
}
export function renderAssign(){
  const name=(i: number)=>{const ps=G.pads.filter(p=>G.assign[i].has(p.index));return ps.length?padName(ps[0])+(ps.length>1?' (copy ignored)':''):''};
  for(let i=0;i<G.numPlayers;i++){
    const slot=$('slot'+i),txt=$('slotTxt'+i),has=G.assign[i].size>0;if(!slot)continue;
    slot.classList.toggle('active',G.assignStep===i);slot.classList.toggle('done',has);
    if(G.splitIdx!==null)txt.textContent=i?'✅ Right half of the Joy-Con pair':'✅ Left half of the Joy-Con pair';
    else if(has)txt.textContent='✅ '+name(i);
    else if(G.assignStep===i){
      txt.textContent=(i>0&&!freePads().length&&now0()-G.claimT>300)?`No controller left. ${NAMES[i]} can use the ${KEYDESC[i]}${i<2?' or the screen arrows':''}. Press + or the button below to start.`:'👉 Press any button on your controller…';
    }else txt.textContent=i>G.assignStep?`Waiting for ${NAMES[i-1]} first`:'';
  }
  const ready=G.assignStep>=1,all=G.assignStep>=G.numPlayers;
  $('assignDone').style.display=ready?'':'none';
  $('assignDone').textContent=all?'Start!':`Start (the rest use the keyboard)`;
  $('assignDone').classList.toggle('alt',!all);
}
export const now0 = ()=>performance.now();
export function renderPadList(force = false){
  const t=performance.now();if(!force&&t-G.lastList<80)return;G.lastList=t;
  const html=G.pads.length?G.pads.map(p=>{
    const on=p.buttons.some(b=>b.pressed)||p.axes.some((v,k)=>Math.abs(v)>.5&&Math.abs(v)<=1.05&&!(k===9&&p.mapping!=='standard'));
    const ow=ownerOf(p.index),u=usable(),any=G.assign.some((s2,k)=>k<G.numPlayers&&s2.size);
    const who=pairIsCopy(p)?'copy, ignored':G.splitIdx===p.index?'Both (split)':ow>=0?NAMES[ow]:(G.numPlayers>1&&!any&&u.indexOf(p)>=0&&u.indexOf(p)<G.numPlayers?NAMES[u.indexOf(p)]:'—');
    return `<div class="padrow"><span class="led${on?' on':''}"></span>${padName(p)} <span style="opacity:.6">#${p.index}</span><i>${who}</i></div>`;
  }).join(''):'<div style="opacity:.7">None yet. Press a button on each controller.</div>';
  const el=G.state==='assign'?$('padList'):$('padListP');
  if(el&&el.innerHTML!==html)el.innerHTML=html;
}
export function startGame(){
  G.carry=[null,null,null,null];
  G.gameActive=true;
  initAudio();hideAll();G.level=1;G.hugs=0;
  resize();newLevel();G.state='play';levelIntro();padTip();
}
export function nextLevel(){hideAll();G.level++;newLevel();G.state='play';levelIntro()}
export function padTip(){if(G.pads.length)setTimeout(()=>{if(G.state==='play')showToast(splitMode()?'🎮 Left Joy-Con: Theseus (sprint L/ZL) · Right Joy-Con: Ariadne (sprint R/ZR) · + pause':'🎮 Hold B/X/Y/ZR to sprint · L/R camera · + pause',3600)},G.level===1&&G.gates.length?6800:3000)}
export function win(){
  G.state='win';sfx.win();
  $('winText').textContent=G.isBoss?`You beat the Great Minotaur! ${bossRewardText()}`:`Level ${G.level} complete. ${isBossLevel(G.level+1)?'Next up: a BOSS fight!':'The next labyrinth is bigger and darker.'}`;
  $('winTime').textContent='⏱ '+fmt(G.elapsed);
  $('winHugs').textContent=`💥 ${G.hugsLevel} caught`;
  setTimeout(()=>{if(G.state==='win')$('winOv').classList.remove('hidden')},700);
}
export function pause(){if(G.state!=='play')return;G.state='pause';showPauseMsg('');G.torchNear=0;$('pauseOv').classList.remove('hidden')}
export function resume(){if(G.state!=='pause')return;hideAll();G.state='play';const now=performance.now();G.players.forEach(p=>p.next=now);G.minos.forEach(m=>m.next=now+600)}
export function frame(t: number){
  {const r=stage.getBoundingClientRect();if(Math.abs(r.width-G.lastStageW)>1||Math.abs(r.height-G.lastStageH)>1){G.lastStageW=r.width;G.lastStageH=r.height;resize()}}
  const dt=Math.min(.05,(t-G.lastT)/1000||0);G.lastT=t;
  pollPads();
  if(G.state==='play')update(t,dt);
  else if(G.state==='title'){const save=G.players;G.players=[];for(const m of G.minos)if(t>=m.next){minoStep(m,t);m.next=t+520}G.players=save;G.gates.forEach(g=>g.open=true)}
  sync(t,dt);
  renderView(t);
  requestAnimationFrame(frame);
}

export function init() {
  $('startBtn').onclick=requestStart;
  $('titleAssignBtn').onclick=()=>openAssign(startGame,()=>{G.state='title';$('titleOv').classList.remove('hidden')});
  $('reassignBtn').onclick=()=>openAssign(()=>{G.state='pause';$('pauseOv').classList.remove('hidden');resume()},()=>{G.state='pause';$('pauseOv').classList.remove('hidden')});
  $('assignDone').onclick=()=>finishAssign();
  $('assignRedo').onclick=()=>{G.assign=newAssign();G.splitIdx=null;G.assignStep=0;renderAssign()};
  $('assignSkip').onclick=()=>{const b=G.assignBack;hideAll();if(b)b()};
  $('nextBtn').onclick=nextLevel;
  $('pauseBtn').onclick=()=>G.state==='pause'?resume():pause();
  $('resumeBtn').onclick=resume;
  $('padCheckBtn').onclick=()=>{pollPads();showPauseMsg(padReport());G.livePads=true;const m=$('pauseMsg');const l=document.createElement('div');l.id='padListP';l.style.textAlign='left';l.style.marginTop='8px';m.appendChild(l);renderPadList(true)};
  $('homeBtn').onclick=()=>{
    G.players.forEach(p=>{p.x=p.sx;p.y=p.sy;p.px=p.sx;p.py=p.sy;p.inv=performance.now()+1500;while(p.trail&&p.trail.children.length)p.trail.remove(p.trail.children[0])});
    computeSight();resume();showToast('Back at the start.',1500);
  };
  $('rerollBtn').onclick=()=>{hideAll();newLevel();G.state='play';levelIntro()};
  $('camBtn').onclick=toggleCam;
  $('menuBtn').onclick=()=>{hideAll();G.state='title';G.gameActive=false;$('titleOv').classList.remove('hidden');G.level=1;newLevel()};
  $('pCamBtn').onclick=toggleCam;
  const toggleMute=()=>{G.muted=!G.muted;$('muteBtn').textContent=G.muted?'🔇':'🔊';$('pSndBtn').textContent=G.muted?'🔇 Sound off':'🔊 Sound on';initAudio();if(G.master&&G.ac)G.master.gain.setTargetAtTime(G.muted?0:1,G.ac.currentTime,.05)};
  $('pSndBtn').onclick=toggleMute;
  $('muteBtn').onclick=toggleMute;
  addEventListener('pointerdown',initAudio,{once:true});
  addEventListener('keydown',initAudio,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(G.ac)G.ac.suspend()}else if(G.ac)G.ac.resume()});
  addEventListener('resize',resize);
  setPlayers(1,false);
  setGrip(G.grip);
  resize();
  newLevel();
  requestAnimationFrame(frame);
}
