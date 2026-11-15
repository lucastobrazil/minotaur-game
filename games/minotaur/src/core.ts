import type { Vec2 } from './types';

import { update } from './logic';
/** getElementById that assumes the element exists (all ids are in index.html). */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
export let cv: HTMLCanvasElement;
export let stage: HTMLElement;
export let isTouch: boolean;
export const rnd = (n: number): number=>Math.floor(Math.random()*n);
export const keys: Record<string, boolean> = {};
export const codes: Record<string, boolean> = {};
/** keys pressed since the last game update, so a very quick tap still counts */
export const tapped = new Set<string>();
export const touchSprint = [false,false,false,false];
export const touchThrow = [false,false,false,false];
export const GATE_COLS = ['#4fc3ff','#7dff6a','#ff5ad9','#ffd84a'];
export const touchDir: Vec2[] = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
export const COLORS = ['#35609e','#7d3a8c','#2f7d4a','#b8642a'];
export const TRAIL = ['#7fb0ff','#e48cff','#7be39a','#ffb36a'];
export const NAMES = ['Theseus','Ariadne','Perseus','Atalanta'];
export const KEYDESC = ['arrow keys','W A S D','I J K L','number pad 8 4 5 6'];
export const STEP = 140;

export function init() {
  cv = $<HTMLCanvasElement>('cv');
  stage = $('stage');
  isTouch = ('ontouchstart' in window)||matchMedia('(pointer:coarse)').matches;
  if(isTouch)document.body.classList.add('touch');
}
