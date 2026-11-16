// Mouse and touch controls: an on-screen joystick, A and Jump buttons, and drag-to-turn the camera.
// They show up as soon as the screen is clicked or touched, so the game is testable without a controller.
const $ = (id: string) => document.getElementById(id)!;

export const pointer = { x: 0, y: 0, act: false, jump: false, camX: 0, used: false };
let stickId: number | null = null, camId: number | null = null, camLastX = 0, camVel = 0;

function show() {
  if (pointer.used) return;
  pointer.used = true; document.body.classList.add('pointer');
}

export function initPointer() {
  addEventListener('pointerdown', show); // any click or touch (even on the title screen) brings up the on-screen controls
  const stick = $('stick'), knob = $('knob');
  const moveStick = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    pointer.x = dx / max; pointer.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { e.preventDefault(); show(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e: PointerEvent) => { if (e.pointerId !== stickId) return; stickId = null; pointer.x = pointer.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  const tapButton = (id: string, key: 'act' | 'jump') => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); show(); pointer[key] = true; });
  tapButton('btnA', 'act'); tapButton('btnJump', 'jump');

  // drag anywhere else to turn the camera
  const cv = $('cv');
  cv.addEventListener('pointerdown', (e) => { show(); camId = e.pointerId; camLastX = e.clientX; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (e.pointerId !== camId) return; camVel += (e.clientX - camLastX) * .35; camLastX = e.clientX; });
  const endCam = (e: PointerEvent) => { if (e.pointerId === camId) camId = null; };
  cv.addEventListener('pointerup', endCam); cv.addEventListener('pointercancel', endCam);
}

/** Read once per frame; button taps count once. */
export function takePointer(dt: number) {
  const out = { ...pointer };
  out.camX = dt > 0 ? Math.max(-3, Math.min(3, camVel / (dt * 60) / 6)) : 0;
  camVel = 0; pointer.act = false; pointer.jump = false;
  return out;
}
