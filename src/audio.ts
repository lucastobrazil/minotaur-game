import { G } from './state';
import type { Minotaur, Vec2 } from './types';
import { startAmbience } from './ambience';

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }

/* ---------- audio ---------- */
export function initAudio(){
  try{
    if(!G.ac)G.ac=new(window.AudioContext||window.webkitAudioContext!)();
    if(G.ac.state==='suspended')G.ac.resume();
    if(!G.master){
      G.master=G.ac.createGain();G.master.gain.value=G.muted?0:1;G.master.connect(G.ac.destination);
      G.reverb=G.ac.createConvolver();G.reverb.buffer=makeIR(G.ac,3);const rg=G.ac.createGain();rg.gain.value=.55;G.reverb.connect(rg).connect(G.master);
      G.noiseB=G.ac.createBuffer(1,G.ac.sampleRate*2,G.ac.sampleRate);const d=G.noiseB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      startAmbience();
    }
  }catch(e){}
}
export function makeIR(ac: AudioContext, sec: number): AudioBuffer{
  const len=ac.sampleRate*sec,b=ac.createBuffer(2,len,ac.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
  return b;
}
// send a node to the speakers, with some of it into the cave echo
export function route(node: AudioNode, dry=1, wet=0, pan=0){
  if(!G.ac||!G.master||!G.reverb)return;
  let n=node;
  if(pan&&G.ac.createStereoPanner){const p=G.ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));n.connect(p);n=p}
  if(dry){const g=G.ac.createGain();g.gain.value=dry;n.connect(g).connect(G.master)}
  if(wet){const g=G.ac.createGain();g.gain.value=wet;n.connect(g).connect(G.reverb)}
}
export function tone(f: number, d: number, type: OscillatorType='sine', v=.15, f2: number | null=null, delay=0){
  if(!G.ac||!G.master)return;
  const t0=G.ac.currentTime+delay,o=G.ac.createOscillator(),g=G.ac.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t0+d);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(v,t0+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
  o.connect(g);route(g,1,.25);o.start(t0);o.stop(t0+d+.05);
}
export function noiseBurst(t0: number, dur: number, filterType: BiquadFilterType, freq: number, vol: number, dry=1, wet=0, pan=0){
  if(!G.ac||!G.noiseB)return;
  const n=G.ac.createBufferSource();n.buffer=G.noiseB;
  const f=G.ac.createBiquadFilter();f.type=filterType;f.frequency.value=freq;
  const g=G.ac.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+Math.min(.01,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  n.connect(f).connect(g);route(g,dry,wet,pan);n.start(t0,Math.random()*1.5);n.stop(t0+dur+.05);
}
export function roar(){
  if(!G.ac||!G.master)return;
  const t0=G.ac.currentTime,o=G.ac.createOscillator(),g=G.ac.createGain(),f=G.ac.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(95,t0);o.frequency.linearRampToValueAtTime(120,t0+.15);o.frequency.exponentialRampToValueAtTime(55,t0+.8);
  f.type='lowpass';f.frequency.value=520;
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.3,t0+.06);g.gain.exponentialRampToValueAtTime(.0001,t0+.85);
  o.connect(f).connect(g);route(g,1,.6);o.start(t0);o.stop(t0+.9);
  noiseBurst(t0,.6,'bandpass',400,.12,1,.5);
}
// a deep, rattling growl for when the Minotaur catches someone
export function growl(){
  if(!G.ac||!G.master)return;
  const t0=G.ac.currentTime,dur=1.5;
  const env=G.ac.createGain();env.gain.setValueAtTime(.0001,t0);env.gain.exponentialRampToValueAtTime(.34,t0+.12);
  env.gain.setValueAtTime(.34,t0+.55);env.gain.exponentialRampToValueAtTime(.12,t0+1.1);env.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  // throat rattle: amplitude wobble at ~25-35Hz
  const am=G.ac.createGain();am.gain.value=.6;
  const lfo=G.ac.createOscillator(),lg=G.ac.createGain();lfo.type='triangle';
  lfo.frequency.setValueAtTime(24,t0);lfo.frequency.linearRampToValueAtTime(34,t0+.5);lfo.frequency.linearRampToValueAtTime(20,t0+dur);
  lg.gain.value=.45;lfo.connect(lg).connect(am.gain);
  const o1=G.ac.createOscillator(),o2=G.ac.createOscillator();o1.type='sawtooth';o2.type='sawtooth';
  o1.frequency.setValueAtTime(70,t0);o1.frequency.linearRampToValueAtTime(92,t0+.35);o1.frequency.exponentialRampToValueAtTime(52,t0+dur);
  o2.frequency.setValueAtTime(105,t0);o2.frequency.linearRampToValueAtTime(131,t0+.35);o2.frequency.exponentialRampToValueAtTime(77,t0+dur);
  const sub=G.ac.createOscillator();sub.type='sine';sub.frequency.setValueAtTime(38,t0);sub.frequency.exponentialRampToValueAtTime(30,t0+dur);
  const subG=G.ac.createGain();subG.gain.value=.8;
  const form=G.ac.createBiquadFilter();form.type='bandpass';form.frequency.setValueAtTime(320,t0);form.frequency.linearRampToValueAtTime(480,t0+.4);form.frequency.linearRampToValueAtTime(260,t0+dur);form.Q.value=2.2;
  const lp=G.ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;
  const n=G.ac.createBufferSource();n.buffer=G.noiseB;const nf=G.ac.createBiquadFilter();nf.type='bandpass';nf.frequency.value=260;nf.Q.value=1.2;const ng=G.ac.createGain();ng.gain.value=.7;
  o1.connect(form);o2.connect(form);n.connect(nf).connect(ng).connect(form);
  form.connect(lp).connect(am);sub.connect(subG).connect(am);
  am.connect(env);route(env,1,.55);
  [o1,o2,sub,lfo,n].forEach(x=>{x.start(t0);x.stop(t0+dur+.05)});
  setTimeout(()=>snort(.2),dur*1000-150);
}
// when a Minotaur spots you: two greedy sniffs, then a hungry, rising rumble
export function hungry(m: Minotaur){
  if(!G.ac||!G.master)return;
  let d=6,ax=m.x;for(const p of G.players){const dd=Math.hypot(p.x-m.x,p.y-m.y);if(dd<d){d=dd;ax=p.x}}
  const v=Math.max(.35,1-d/18),pan=Math.max(-.7,Math.min(.7,(m.x-ax)/8)),t0=G.ac.currentTime;
  noiseBurst(t0,.09,'bandpass',1500,.16*v,1,.3,pan);
  noiseBurst(t0+.14,.12,'bandpass',1900,.2*v,1,.3,pan);
  const s=t0+.32,dur=.75;
  const env=G.ac.createGain();env.gain.setValueAtTime(.0001,s);env.gain.exponentialRampToValueAtTime(.26*v,s+.18);env.gain.exponentialRampToValueAtTime(.0001,s+dur);
  const am=G.ac.createGain();am.gain.value=.6;
  const lfo=G.ac.createOscillator(),lg=G.ac.createGain();lfo.frequency.setValueAtTime(18,s);lfo.frequency.linearRampToValueAtTime(32,s+dur);lg.gain.value=.4;lfo.connect(lg).connect(am.gain);
  const o=G.ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(62,s);o.frequency.exponentialRampToValueAtTime(118,s+dur*.8);
  const f=G.ac.createBiquadFilter();f.type='bandpass';f.frequency.setValueAtTime(300,s);f.frequency.linearRampToValueAtTime(620,s+dur);f.Q.value=2.5;
  o.connect(f).connect(am).connect(env);route(env,1,.45,pan);
  [o,lfo].forEach(x=>{x.start(s);x.stop(s+dur+.05)});
  noiseBurst(s+dur-.1,.18,'lowpass',800,.14*v,1,.4,pan);
}
export function snort(vol=.18,pan=0){
  if(!G.ac||!G.master)return;
  noiseBurst(G.ac.currentTime,.25,'lowpass',900,vol,1,.5,pan);
}

// iron portcullis: rattling chains + grinding as it lowers, a heavy clank when it slams shut
export function gateSound(open: boolean, g?: Vec2){
  const ac=G.ac;if(!ac||!G.master)return;
  let d=0,ax=g?g.x:0;
  if(g&&G.players.length){d=1e9;for(const p of G.players){const dd=Math.hypot(p.x-g.x,p.y-g.y);if(dd<d){d=dd;ax=p.x}}}
  const v=Math.max(.45,1-d/26),pan=g?Math.max(-.7,Math.min(.7,(g.x-ax)/8)):0,t0=ac.currentTime;
  const clink=(t: number, vol: number)=>{
    const o=ac.createOscillator(),gg=ac.createGain();o.type='triangle';o.frequency.value=1700+Math.random()*1800;
    gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(vol,t+.003);gg.gain.exponentialRampToValueAtTime(.0001,t+.05);
    o.connect(gg);route(gg,1,.35,pan);o.start(t);o.stop(t+.06);
    noiseBurst(t,.025,'highpass',3500,vol*.8,1,.2,pan);
  };
  const clank=(t: number, vol: number)=>{
    const o=ac.createOscillator(),gg=ac.createGain();o.type='sine';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(38,t+.25);
    gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(vol,t+.008);gg.gain.exponentialRampToValueAtTime(.0001,t+.35);
    o.connect(gg);route(gg,1,.6,pan);o.start(t);o.stop(t+.4);
    noiseBurst(t,.12,'lowpass',600,vol*.6,1,.5,pan);
    const m=ac.createOscillator(),mg=ac.createGain();m.type='square';m.frequency.value=410;
    mg.gain.setValueAtTime(.0001,t);mg.gain.exponentialRampToValueAtTime(vol*.12,t+.004);mg.gain.exponentialRampToValueAtTime(.0001,t+.3);
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200;bp.Q.value=8;
    m.connect(bp).connect(mg);route(mg,1,.6,pan);m.start(t);m.stop(t+.32);
  };
  if(open){
    clank(t0,.16*v);
    for(let k=0;k<16;k++)clink(t0+.05+k*.055+Math.random()*.02,.05*v*(1-k/22));
    // grinding stone and iron
    const n=ac.createBufferSource();n.buffer=G.noiseB;const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=170;f.Q.value=2;
    const gg=ac.createGain();gg.gain.setValueAtTime(.0001,t0);gg.gain.exponentialRampToValueAtTime(.22*v,t0+.15);gg.gain.setValueAtTime(.22*v,t0+.75);gg.gain.exponentialRampToValueAtTime(.0001,t0+1.05);
    n.connect(f).connect(gg);route(gg,1,.4,pan);n.start(t0,Math.random());n.stop(t0+1.1);
    const sw=ac.createOscillator(),sg=ac.createGain();sw.type='sawtooth';sw.frequency.setValueAtTime(46,t0);sw.frequency.linearRampToValueAtTime(40,t0+1);
    const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;
    sg.gain.setValueAtTime(.0001,t0);sg.gain.exponentialRampToValueAtTime(.08*v,t0+.15);sg.gain.exponentialRampToValueAtTime(.0001,t0+1.05);
    sw.connect(lp).connect(sg);route(sg,1,.3,pan);sw.start(t0);sw.stop(t0+1.1);
    clank(t0+1.0,.22*v);
  }else{
    for(let k=0;k<6;k++)clink(t0+k*.035,.045*v);
    clank(t0+.24,.32*v);
  }
}
