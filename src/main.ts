// @ts-nocheck
import './style.css';
import { G } from './state';
import * as core from './core';
import * as audio from './audio';
import * as ambience from './ambience';
import * as textures from './textures';
import * as scene from './scene';
import * as maze from './maze';
import * as level from './level';
import * as input from './input';
import * as logic from './logic';
import * as firstPerson from './firstPerson';
import * as items from './items';
import * as render from './render';
import * as hud from './hud';
import * as controllers from './controllers';

const modules = { core, audio, ambience, textures, scene, maze, level, input, logic, firstPerson, items, render, hud, controllers };

// Test/debug bridge: on file:// or with ?debug, expose game state and functions as globals
// so the headless browser tests can drive the game.
if (location.protocol === 'file:' || new URLSearchParams(location.search).has('debug')) {
  for (const k of Object.keys(G)) if (!(k in window)) Object.defineProperty(window, k, { get: () => G[k], set: (v) => { G[k] = v; }, configurable: true });
  for (const m of Object.values(modules)) for (const [k, v] of Object.entries(m)) if (k !== 'init' && !(k in window)) Object.defineProperty(window, k, { get: () => m[k], configurable: true });
  (window as any).__G = G;
}

core.init();
textures.init();
scene.init();
input.init();
render.init();
hud.init();
controllers.init();
