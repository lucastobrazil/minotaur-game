import os
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = 'file://' + os.path.join(HERE, '..', 'dist', 'index.html')
# No controller: click to start, keyboard (WASD and arrows) moves, Space talks, on-screen joystick and
# A button work with the mouse, dragging turns the camera; a controller can still take over later.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader'])
    pg = b.new_page(viewport={'width': 1000, 'height': 640})
    pg.route('**fonts.g*', lambda r: r.abort())
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    pg.mouse.click(500, 320); pg.wait_for_timeout(400)
    print('after click:', pg.evaluate("game.state"))
    assert pg.evaluate("game.state") == 'play'
    pg.evaluate("game.gloomies.forEach(g=>{g.x=g.tx=60;g.z=g.tz=60;g.speed=0})")
    assert pg.is_visible('#stick') and pg.is_visible('#btnA')

    def moved(fn):
        a = pg.evaluate("[game.hero.x,game.hero.z]"); fn(); b2 = pg.evaluate("[game.hero.x,game.hero.z]")
        return ((a[0] - b2[0]) ** 2 + (a[1] - b2[1]) ** 2) ** .5
    for key in ['KeyW', 'ArrowUp']:
        def hold(key=key): pg.keyboard.down(key); pg.wait_for_timeout(600); pg.keyboard.up(key)
        d = moved(hold); print(key, 'moved', round(d, 2)); assert d > .5

    # on-screen joystick dragged with the mouse
    box = pg.locator('#stick').bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    def drag(): pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 60, cy - 60, steps=3); pg.wait_for_timeout(600); pg.mouse.up()
    d = moved(drag); print('joystick moved', round(d, 2)); assert d > .5

    # dragging the view turns the camera
    yaw = pg.evaluate("game.camYaw")
    pg.mouse.move(600, 250); pg.mouse.down(); pg.mouse.move(800, 250, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    print('camera turned', round(pg.evaluate("game.camYaw") - yaw, 2)); assert abs(pg.evaluate("game.camYaw") - yaw) > .1

    # the on-screen A button only talks (the Jump button jumps)
    pg.evaluate("game.hero.x=0;game.hero.z=10"); pg.wait_for_timeout(300)
    pg.click('#btnA'); pg.wait_for_timeout(150)
    print('A away from anyone, height', pg.evaluate('game.hero.y')); assert pg.evaluate('game.hero.y') == 0
    pg.click('#btnJump'); pg.wait_for_timeout(150)
    print('Jump button, height', pg.evaluate('game.hero.y')); assert pg.evaluate('game.hero.y') > 0
    pg.wait_for_timeout(1500)

    # Space talks to someone nearby; the on-screen A button gives colours
    pg.evaluate("(()=>{const q=game.quests[3];game.hero.x=q.x+1;game.hero.z=q.z+1})()"); pg.wait_for_timeout(300)
    pg.keyboard.press('Space'); pg.wait_for_timeout(300)
    print('Space ->', pg.evaluate("game.message")); assert 'Tilly' in pg.evaluate("game.message")
    pg.evaluate("game.bag.purple=1;game.bag.yellow=1"); pg.click('#btnA'); pg.wait_for_timeout(300)
    assert pg.evaluate("game.quests[3].done"); print('A button gave colours')

    # a controller can take over from the keyboard
    pg.evaluate("""window.__pads=[{id:'Pro Controller (STANDARD GAMEPAD)',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];
      navigator.getGamepads=()=>__pads; __pads[0].buttons[1].pressed=true; setTimeout(()=>__pads[0].buttons[1].pressed=false,150)""")
    pg.wait_for_timeout(500)
    src = pg.evaluate("(()=>{const m=players.joined.find(j=>j.source.kind==='pad');return !!m})()")
    print('controller joined:', src); assert src
    print(errs); assert not errs
    b.close()
