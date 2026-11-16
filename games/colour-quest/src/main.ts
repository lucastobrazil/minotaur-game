// Colour Quest: a stick figure brings colour back to a world the Grey has drained.
// (Charlie's idea.) One player for now; the camera follows behind like Zelda.
import './style.css';
import * as THREE from 'three';
import { Players, type Joined } from 'kit/players';
import { BUTTON } from 'kit/pads';
import { camera, renderer, scene, updateSplats } from './scene';
import { game, hasAll, needText, setup, snapCamera, talk, update, type Input } from './game';
import { COLOUR_IDS, HEX, type ColourId } from './palette';

const $ = (id: string) => document.getElementById(id)!;
const players = new Players(1);
let me: Joined | null = null;

setup();
snapCamera();

function readInput(): Input {
  const none: Input = { x: 0, y: 0, act: false, jump: false, camX: 0, recenter: false };
  if (!me) return none;
  const i = players.input(me), pad = players.pad(me), pressed = players.padPressed(me);
  let camX = (players.keyDown('KeyE') ? 1 : 0) - (players.keyDown('KeyQ') ? 1 : 0);
  if (pad && pad.axes.length >= 4 && Math.abs(pad.axes[2]) > .25) camX = pad.axes[2];
  const act = me.source.kind === 'pad' ? pressed.includes(BUTTON.A) || pressed.includes(BUTTON.X) : i.justAction;
  return {
    x: i.x, y: i.y, act,
    jump: pressed.includes(BUTTON.B) || pressed.includes(BUTTON.Y),
    camX,
    recenter: players.keyDown('KeyR') || (!!pad && (pad.buttons[BUTTON.L]?.pressed || pad.buttons[BUTTON.ZL]?.pressed) === true),
  };
}

// ---------- HUD ----------
let lastBag = '';
function hud() {
  const bag = COLOUR_IDS.map((c) => game.bag[c]).join();
  if (bag !== lastBag) {
    const prev = lastBag.split(',').map(Number); lastBag = bag;
    $('bag').innerHTML = COLOUR_IDS.map((c, k) => `<div class="pot ${game.bag[c] ? '' : 'empty'} ${game.bag[c] > (prev[k] || 0) ? 'pop' : ''}" style="background:${HEX[c]}">${game.bag[c]}</div>`).join('');
    setTimeout(() => document.querySelectorAll('.pot.pop').forEach((p) => p.classList.remove('pop')), 220);
  }
  $('quests').innerHTML = `<b>Help everyone (${game.quests.filter((q) => q.done).length}/${game.quests.length})</b><br>` + game.quests.map((q) =>
    `<div class="${q.done ? 'done' : ''}">${q.who} ${(Object.keys(q.needs) as ColourId[]).map((c) => Array(q.needs[c]).fill(`<span class="dot" style="background:${HEX[c]}"></span>`).join('')).join('')}</div>`).join('');
  const q = game.near, talkEl = $('talk');
  if (q && game.state === 'play' && game.time > game.messageUntil) {
    talkEl.classList.remove('hidden');
    talkEl.innerHTML = q.done ? `<b>${q.who}</b>Thank you!` : `<b>${q.who}</b>${hasAll(q.needs) ? `You have ${needText(q.needs)}! Press <u>A</u> to give them.` : `I need ${needText(q.needs)}. Press <u>A</u> to talk.`}`;
  } else talkEl.classList.add('hidden');
  const msg = $('msg');
  if (game.time < game.messageUntil) { msg.textContent = game.message; msg.classList.remove('hidden'); } else msg.classList.add('hidden');
  $('win').classList.toggle('hidden', !(game.state === 'won' && game.finale > 4));
}

// ---------- loop ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  players.update();
  if (game.state === 'title') {
    const j = players.acceptJoins();
    if (j.length) { me = j[0]; game.state = 'play'; $('title').classList.add('hidden'); }
  } else if (!me || !players.joined.includes(me)) {
    // controller unplugged: let anyone take over
    const j = players.acceptJoins(); if (j.length) me = j[0];
  }
  if (game.state === 'won' && game.finale > 4 && players.startPressed()) location.reload();
  update(dt, readInput());
  updateSplats(dt);
  hud();
  renderer.render(scene, camera);
  players.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test/debug bridge: on file:// or with ?debug, expose the game to the headless tests.
if (location.protocol === 'file:' || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { game, players, talk, THREE, camera });
}
