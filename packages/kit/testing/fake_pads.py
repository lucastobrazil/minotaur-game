"""Fake controllers for headless browser tests (Playwright).

    from fake_pads import FAKE_PADS        # sys.path.insert(0, '<repo>/packages/kit/testing')
    page.add_init_script(FAKE_PADS)
    page.evaluate("addPad('Pro Controller (STANDARD GAMEPAD)')")   # -> index 0
    page.evaluate("press(0, 1)")          # tap button 1 (A) on pad 0
    page.evaluate("stick(0, 1, 0)")       # push pad 0's stick right
"""
FAKE_PADS = """
window.__pads = [];
navigator.getGamepads = () => window.__pads.slice();
window.addPad = (id, mapping = 'standard') => {
  const p = { id, index: __pads.length, mapping, connected: true, timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  __pads.push(p); return p.index;
};
window.press = (i, b, ms = 120) => { __pads[i].buttons[b].pressed = true; setTimeout(() => __pads[i].buttons[b].pressed = false, ms); };
window.hold = (i, b, on = true) => { __pads[i].buttons[b].pressed = on; };
window.stick = (i, x, y) => { __pads[i].axes[0] = x; __pads[i].axes[1] = y; };
"""
