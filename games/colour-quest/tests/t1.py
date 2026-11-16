import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = 'file://' + os.path.join(HERE, '..', 'dist', 'index.html')
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'packages', 'kit', 'testing'))
from fake_pads import FAKE_PADS
# Colour Quest: start with a controller, camera-relative movement, collecting drops, quests,
# Gloomies knocking colours away, and winning.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    pg.route('**fonts.g*', lambda r: r.abort())
    pg.add_init_script(FAKE_PADS)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    assert pg.evaluate("game.state") == 'title'
    pg.evaluate("addPad('Pro Controller (STANDARD GAMEPAD)')"); pg.evaluate("press(0, 1)"); pg.wait_for_timeout(500)
    assert pg.evaluate("game.state") == 'play'
    pg.evaluate("game.gloomies.forEach(g=>{g.x=g.tx=60;g.z=g.tz=60;g.speed=0})")  # keep them out of the way for now

    # pushing the stick up walks away from the camera
    pg.evaluate("game.hero.x=0;game.hero.z=8")
    pg.wait_for_timeout(600)
    before = pg.evaluate("[game.hero.x,game.hero.z,camera.position.x,camera.position.z]")
    pg.evaluate("stick(0, 0, -1)"); pg.wait_for_timeout(700); pg.evaluate("stick(0, 0, 0)")
    after = pg.evaluate("[game.hero.x,game.hero.z]")
    away = lambda hx, hz: ((hx - before[2]) ** 2 + (hz - before[3]) ** 2) ** .5
    print('distance from camera', round(away(before[0], before[1]), 2), '->', round(away(*after), 2))
    assert away(*after) > away(before[0], before[1]) + .5

    # collect a drop by walking into it
    pg.evaluate("(()=>{const d=game.drops.find(d=>d.colour=='blue');d.x=game.hero.x;d.z=game.hero.z})()"); pg.wait_for_timeout(400)
    print('bag', pg.evaluate("game.bag"))
    assert pg.evaluate("game.bag.blue") == 1

    # talking without enough colour just repeats the ask; with enough, colour comes back
    pg.evaluate("(()=>{const q=game.quests[1];game.hero.x=q.x+1;game.hero.z=q.z+1})()"); pg.wait_for_timeout(300)
    assert pg.evaluate("game.near && game.near.id") == 'car'
    pg.evaluate("press(0, 1)"); pg.wait_for_timeout(300)
    print('ask:', pg.evaluate("game.message")); assert 'blue' in pg.evaluate("game.message") and not pg.evaluate("game.quests[1].done")
    pg.evaluate("game.bag.blue=2"); pg.evaluate("press(0, 1)"); pg.wait_for_timeout(400)
    assert pg.evaluate("game.quests[1].done") and pg.evaluate("game.bag.blue") == 0
    print('car painted:', pg.evaluate("game.quests[1].paintT"))

    # away from anyone, A jumps
    pg.evaluate("game.hero.x=0;game.hero.z=10"); pg.wait_for_timeout(300)
    pg.evaluate("press(0, 1)"); pg.wait_for_timeout(120)
    print('jump height', pg.evaluate("game.hero.y")); assert pg.evaluate("game.hero.y") > 0

    # a Gloomy knocks a colour out of the bag; it lands nearby as a drop
    drops = pg.evaluate("game.drops.length")
    pg.evaluate("game.bag.red=1;game.hero.hitUntil=0;const g=game.gloomies[0];g.x=g.tx=game.hero.x;g.z=g.tz=game.hero.z+.5;g.speed=0")
    pg.wait_for_function('game.bag.red===0', timeout=20000)
    print('after gloomy:', pg.evaluate("game.bag.red"), pg.evaluate("game.drops.length"), '-', pg.evaluate("game.message"))
    assert pg.evaluate("game.bag.red") == 0 and pg.evaluate("game.drops.length") == drops + 1
    pg.evaluate("game.gloomies[0].x=game.gloomies[0].tx=60")

    # finish every quest: the world floods with colour and the win screen shows
    for i in [0, 2, 3]:
        pg.evaluate(f"(()=>{{const q=game.quests[{i}];for(const c in q.needs)game.bag[c]+=q.needs[c];talk(q)}})()")
    print('state', pg.evaluate("game.state")); assert pg.evaluate("game.state") == 'won'
    pg.wait_for_function("!document.getElementById('win').classList.contains('hidden')", timeout=60000)
    print('win screen shown')
    print(errs); assert not errs
    b.close()
