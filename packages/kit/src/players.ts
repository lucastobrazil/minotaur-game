// Players join by pressing a button on their controller (or a key on the keyboard), like on a Switch.
// Each player then reads input only from what they claimed.
import { connectedPads, MENU_BUTTONS, padDir, padName, PadWatcher } from './pads';

export type Source = { kind: 'pad'; index: number } | { kind: 'keys'; set: number };
export interface Joined { slot: number; source: Source; label: string }
export interface PlayerInput { x: number; y: number; action: boolean; justAction: boolean }

/** Keyboard layouts: WASD + Space for one player, arrows + Enter for another. */
export const KEY_SETS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: ['Space', 'KeyF'], name: 'Keyboard (WASD)' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: ['Enter', 'ShiftRight'], name: 'Keyboard (arrows)' },
];

export class Players {
  readonly joined: Joined[] = [];
  private keys = new Set<string>();
  private fresh = new Set<string>();
  private watcher = new PadWatcher();
  private padPresses = new Map<number, number[]>();
  private menu = false;

  /** Set true when single Joy-Cons are held sideways (one per player). */
  sideways = false;

  constructor(readonly max = 4) {
    addEventListener('keydown', (e) => { if (!e.repeat) this.fresh.add(e.code); this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  /** Call once per frame before reading input. */
  update(): void {
    const pads = connectedPads();
    this.padPresses = this.watcher.update(pads);
    this.menu = [...this.padPresses.values()].some((b) => b.some((i) => MENU_BUTTONS.includes(i))) || this.fresh.has('Escape');
    // drop players whose controller went away
    for (let i = this.joined.length - 1; i >= 0; i--) {
      const s = this.joined[i].source;
      if (s.kind === 'pad' && !pads.some((p) => p.index === s.index)) this.joined.splice(i, 1);
    }
  }
  /** Call at the end of the frame. */
  endFrame(): void { this.fresh.clear(); }

  /** In a join screen: anyone pressing a button or key joins. Returns players who joined this frame. */
  acceptJoins(): Joined[] {
    const added: Joined[] = [];
    const add = (source: Source, label: string) => {
      if (this.joined.length >= this.max) return;
      const j = { slot: this.freeSlot(), source, label }; this.joined.push(j); added.push(j);
    };
    for (const [index, presses] of this.padPresses) {
      if (presses.every((b) => MENU_BUTTONS.includes(b))) continue; // + / - start the game, they don't join
      if (this.joined.some((j) => j.source.kind === 'pad' && j.source.index === index)) continue;
      const pad = connectedPads().find((p) => p.index === index);
      add({ kind: 'pad', index }, pad ? padName(pad) : 'Controller');
    }
    KEY_SETS.forEach((ks, set) => {
      const pressed = [ks.up, ks.down, ks.left, ks.right, ...ks.action].some((k) => this.fresh.has(k));
      if (pressed && !this.joined.some((j) => j.source.kind === 'keys' && j.source.set === set)) add({ kind: 'keys', set }, ks.name);
    });
    this.joined.sort((a, b) => a.slot - b.slot);
    return added;
  }
  private freeSlot(): number { let s = 0; while (this.joined.some((j) => j.slot === s)) s++; return s; }

  /** + / - on a controller, or Escape. */
  menuPressed(): boolean { return this.menu; }
  /** Start the game: + / - on a controller, or Enter on the keyboard. */
  startPressed(): boolean { return this.menu || this.fresh.has('Enter'); }

  input(j: Joined): PlayerInput {
    if (j.source.kind === 'keys') {
      const ks = KEY_SETS[j.source.set], k = this.keys;
      return {
        x: (k.has(ks.right) ? 1 : 0) - (k.has(ks.left) ? 1 : 0), y: (k.has(ks.down) ? 1 : 0) - (k.has(ks.up) ? 1 : 0),
        action: ks.action.some((c) => k.has(c)), justAction: ks.action.some((c) => this.fresh.has(c)),
      };
    }
    const index = j.source.index;
    const pad = connectedPads().find((p) => p.index === index);
    if (!pad) return { x: 0, y: 0, action: false, justAction: false };
    const d = padDir(pad, this.sideways), act = [0, 1, 2, 3];
    return { ...d, action: act.some((i) => !!pad.buttons[i]?.pressed), justAction: (this.padPresses.get(index) ?? []).some((i) => act.includes(i)) };
  }
}
