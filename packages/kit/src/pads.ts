// Controllers for any game: Pro Controller, Joy-Cons (single or joined), Xbox/PlayStation pads.
//
// Lessons from The Minotaur, built in here so new games get them for free:
//  - Chrome only lists a controller after a button press on it.
//  - Two Joy-Cons can be listed three times: left, right, and both joined as one "L+R" device.
//    When the single Joy-Cons are listed, the joined device is just a copy and is ignored.
//  - Players claim a controller by pressing a button on it (see players.ts), so ghost duplicates
//    and phantom devices never take a player slot.
//  - Non-standard controllers report the d-pad as a "hat" axis (axes[9]).

export const isCombo = (p: Gamepad): boolean => /L\+R|200e|Joy-Con \(L\/R\)/i.test(p.id);
export const isSingleJoy = (p: Gamepad): boolean => /Joy-Con/i.test(p.id) && !isCombo(p);
export const isLeftJoy = (p: Gamepad): boolean => /Joy-Con \(L\)/i.test(p.id);

export function padName(p: Gamepad): string {
  if (isCombo(p)) return 'Joy-Con pair';
  if (isLeftJoy(p)) return 'Joy-Con (L)';
  if (/Joy-Con \(R\)/i.test(p.id)) return 'Joy-Con (R)';
  return p.id.split('(')[0].trim() || 'Controller';
}

/** Connected controllers, minus the joined Joy-Con copy when the single Joy-Cons are listed. */
export function connectedPads(): Gamepad[] {
  let list: Gamepad[] = [];
  try { list = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((p): p is Gamepad => !!p && p.connected !== false); } catch { /* not allowed */ }
  list.sort((a, b) => a.index - b.index);
  const singles = list.some(isSingleJoy);
  return list.filter((p) => !(singles && isCombo(p)));
}

/** Decode a non-standard controller's d-pad "hat" axis into a direction. */
export function hatDir(v: number | undefined): [number, number] | null {
  if (v === undefined || v > 1.05 || v < -1.05) return null;
  const dirs: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  return dirs[Math.round((v + 1) * 3.5) % 8];
}

const DEAD = .25;
/**
 * Movement direction from a controller: stick, d-pad buttons or hat, as x/y in -1..1 (y down).
 * Pass sideways=true for a single Joy-Con held sideways: its stick is turned a quarter, so that is corrected
 * (same convention as The Minotaur's sideways grip; not yet checked on real Joy-Cons held one per player).
 */
export function padDir(p: Gamepad, sideways = false): { x: number; y: number } {
  let x = 0, y = 0;
  const a = p.axes, b = p.buttons;
  if (a.length >= 2 && Math.hypot(a[0], a[1]) > DEAD) { x = a[0]; y = a[1]; }
  const h = p.mapping !== 'standard' && a.length > 9 ? hatDir(a[9]) : null;
  if (h) { x = h[0]; y = h[1]; }
  if (b[12]?.pressed) y = -1; if (b[13]?.pressed) y = 1; if (b[14]?.pressed) x = -1; if (b[15]?.pressed) x = 1;
  if (sideways && isSingleJoy(p)) { // held sideways: left Joy-Con turns one way, right the other
    [x, y] = isLeftJoy(p) ? [y, -x] : [-y, x];
  }
  return { x, y };
}

/** Is any face/shoulder button held? `which` picks specific button indexes. */
export const held = (p: Gamepad, which: number[]): boolean => which.some((i) => !!p.buttons[i]?.pressed);
export const BUTTON = { A: 1, B: 0, X: 3, Y: 2, L: 4, R: 5, ZL: 6, ZR: 7, MINUS: 8, PLUS: 9, HOME: 16 } as const;
export const MENU_BUTTONS = [8, 9];

/** Tracks button presses between frames so a game can react to "just pressed". */
export class PadWatcher {
  private prev = new Map<number, boolean[]>();
  /** Call once per frame; returns, per controller index, the button indexes pressed since last frame. */
  update(pads: Gamepad[]): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (const p of pads) {
      const before = this.prev.get(p.index) ?? [];
      const now = p.buttons.map((b) => b.pressed);
      const fresh = now.flatMap((on, i) => (on && !before[i] ? [i] : []));
      if (fresh.length) out.set(p.index, fresh);
      this.prev.set(p.index, now);
    }
    return out;
  }
}
