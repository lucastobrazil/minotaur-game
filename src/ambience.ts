import { G } from './state';
import type { Minotaur, Player } from './types';
import { hungry, noiseBurst, route, tone } from './audio';
import { win } from './controllers';

/* ---------- ambient soundscape (no music, just the labyrinth) ---------- */
export function startAmbience(){
  const ac=G.ac;if(!ac)return;
  const t=ac.currentTime;
  // wind moaning through the corridors
  const wn=ac.createBufferSource();wn.buffer=G.noiseB;wn.loop=true;
  const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=380;bp.Q.value=1.4;
  const wg=ac.createGain();wg.gain.value=.05;
  const l1=ac.createOscillator(),l1g=ac.createGain();l1.frequency.value=.07;l1g.gain.value=180;l1.connect(l1g).connect(bp.frequency);
  const l2=ac.createOscillator(),l2g=ac.createGain();l2.frequency.value=.045;l2g.gain.value=.035;l2.connect(l2g).connect(wg.gain);
  wn.connect(bp).connect(wg);route(wg,1,.4);
  // a second, higher whistle of wind
  const wn2=ac.createBufferSource();wn2.buffer=G.noiseB;wn2.loop=true;wn2.playbackRate.value=.97;
  const bp2=ac.createBiquadFilter();bp2.type='bandpass';bp2.frequency.value=900;bp2.Q.value=6;
  const wg2=ac.createGain();wg2.gain.value=.012;
  const l3=ac.createOscillator(),l3g=ac.createGain();l3.frequency.value=.11;l3g.gain.value=300;l3.connect(l3g).connect(bp2.frequency);
  const l4=ac.createOscillator(),l4g=ac.createGain();l4.frequency.value=.06;l4g.gain.value=.012;l4.connect(l4g).connect(wg2.gain);
  wn2.connect(bp2).connect(wg2);route(wg2,1,.5,-.3);
  // deep rumble of stone
  const d1=ac.createOscillator(),d2=ac.createOscillator();d1.type='sine';d1.frequency.value=41;d2.type='triangle';d2.frequency.value=55.4;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=110;
  const dg=ac.createGain();dg.gain.value=.06;
  const l5=ac.createOscillator(),l5g=ac.createGain();l5.frequency.value=.03;l5g.gain.value=.03;l5.connect(l5g).connect(dg.gain);
  d1.connect(lp);d2.connect(lp);lp.connect(dg);route(dg,1,0);
  [wn,wn2,l1,l2,l3,l4,d1,d2,l5].forEach(n=>n.start(t));
  scheduleDrip();
  setInterval(crackle,90);
}
export function drip(){
  if(!G.ac||G.ac.state!=='running')return;
  const t0=G.ac.currentTime,o=G.ac.createOscillator(),g=G.ac.createGain(),f=900+Math.random()*900;
  o.type='sine';o.frequency.setValueAtTime(f,t0);o.frequency.exponentialRampToValueAtTime(f*.45,t0+.07);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.07,t0+.004);g.gain.exponentialRampToValueAtTime(.0001,t0+.1);
  o.connect(g);route(g,.45,1,Math.random()*1.4-.7);o.start(t0);o.stop(t0+.15);
}
export function scheduleDrip(){
  setTimeout(()=>{drip();if(Math.random()<.3)setTimeout(drip,180+Math.random()*250);scheduleDrip()},1200+Math.random()*4500);
}
export function crackle(){
  if(!G.ac||G.ac.state!=='running'||G.torchNear<.05)return;
  if(Math.random()<.35*G.torchNear)noiseBurst(G.ac.currentTime,.012+Math.random()*.02,'highpass',2500,.05*G.torchNear,1,.1,Math.random()*.6-.3);
}
// heavy hoof-steps: louder and closer-sounding as a Minotaur approaches
export function footstep(m: Minotaur){
  if(!G.ac||!G.master||!G.players.length)return;
  let d=1e9,ax=0;
  for(const p of G.players){const dd=Math.hypot(p.x-m.x,p.y-m.y);if(dd<d){d=dd;ax=p.x}}
  const v=Math.pow(Math.max(0,1-d/16),2)*(m.mode==='chase'?.6:.42);
  if(v<.008)return;
  const pan=Math.max(-.8,Math.min(.8,(m.x-ax)/8)),t0=G.ac.currentTime;
  const o=G.ac.createOscillator(),g=G.ac.createGain();o.type='sine';
  o.frequency.setValueAtTime(85,t0);o.frequency.exponentialRampToValueAtTime(36,t0+.2);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(v,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+.28);
  o.connect(g);route(g,1,.7*(1-v),pan);o.start(t0);o.stop(t0+.3);
  noiseBurst(t0,.06,'lowpass',350,v*.5,1,.4,pan);
}
// soft footsteps for the heroes: a quiet scuff on stone with a little thump
export function heroStep(p: Player, i: number){
  if(!G.ac||!G.master||G.ac.state!=='running')return;
  p.foot=!p.foot;
  const t0=G.ac.currentTime,run=p.sprinting,v=(run?.05:.032)*(.85+Math.random()*.3);
  const pan=(p.foot?-.15:.15)+(i?.1:-.1);
  noiseBurst(t0,run?.05:.065,'bandpass',(i?1300:1000)*(.85+Math.random()*.3),v,1,.15,pan);
  const o=G.ac.createOscillator(),g=G.ac.createGain();o.type='sine';
  o.frequency.setValueAtTime(i?150:125,t0);o.frequency.exponentialRampToValueAtTime(70,t0+.06);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(v*.9,t0+.005);g.gain.exponentialRampToValueAtTime(.0001,t0+.08);
  o.connect(g);route(g,1,.1,pan);o.start(t0);o.stop(t0+.1);
}
export function heartbeat(now: number){
  if(!G.ac||!G.master||!G.players.length||!G.minos.length)return;
  let d=1e9;for(const m of G.minos)for(const p of G.players)if(p.inv<now)d=Math.min(d,Math.abs(p.x-m.x)+Math.abs(p.y-m.y));
  if(d>6||now<G.nextBeat)return;
  const v=.05+(6-d)/6*.12;G.nextBeat=now+(d<3?520:780);
  const ac=G.ac,t0=ac.currentTime;
  [0,.16].forEach((off,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(58,t0+off);o.frequency.exponentialRampToValueAtTime(40,t0+off+.12);
    g.gain.setValueAtTime(.0001,t0+off);g.gain.exponentialRampToValueAtTime(v*(i?.7:1),t0+off+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+off+.15);
    o.connect(g);route(g,1,0);o.start(t0+off);o.stop(t0+off+.2)});
}
export const sfx = {
  pickup(){tone(660,.12,'triangle',.16);tone(990,.18,'triangle',.16,null,.08)},
  door(){[392,523,659,784].forEach((f,i)=>tone(f,.3,'triangle',.15,null,i*.12));tone(70,.6,'sawtooth',.08)},
  win(){[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.3,'square',.07,null,i*.09))},
  spot(m: Minotaur){hungry(m)}
};
