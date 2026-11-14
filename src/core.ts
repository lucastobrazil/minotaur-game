// @ts-nocheck
// Ported from the single-file prototype. Types are added incrementally.
import * as THREE from 'three';

export const $ = id=>document.getElementById(id);
export let cv;
export let stage;
export let isTouch;
export const rnd = n=>Math.floor(Math.random()*n);
export const keys = {};
export const codes = {};
export const touchSprint = [false,false,false,false];
export const touchThrow = [false,false,false,false];
export const GATE_COLS = ['#4fc3ff','#7dff6a','#ff5ad9','#ffd84a'];
export const touchDir = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
export const COLORS = ['#35609e','#7d3a8c','#2f7d4a','#b8642a'];
export const TRAIL = ['#7fb0ff','#e48cff','#7be39a','#ffb36a'];
export const NAMES = ['Theseus','Ariadne','Perseus','Atalanta'];
export const KEYDESC = ['arrow keys','W A S D','I J K L','number pad 8 4 5 6'];
export const STEP = 140;

export function init() {
  cv = $('cv');
  stage = $('stage');
  isTouch = ('ontouchstart' in window)||matchMedia('(pointer:coarse)').matches;
  if(isTouch)document.body.classList.add('touch');
}
