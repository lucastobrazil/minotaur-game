import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = 'file://' + os.path.join(HERE, '..', 'dist', 'index.html')
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'packages', 'kit', 'testing'))
from fake_pads import FAKE_PADS
# Players join with their controllers (the joined Joy-Con copy is ignored), start, move and collect a star.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    pg.add_init_script(FAKE_PADS)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(500)
    pg.evaluate("addPad('Joy-Con (L) (Vendor: 057e Product: 2006)','');addPad('Joy-Con (R) (Vendor: 057e Product: 2007)','');addPad('Joy-Con L+R (Vendor: 057e Product: 200e)','')")
    for i in range(3): pg.evaluate(f"press({i}, 1)"); pg.wait_for_timeout(300)
    joined = pg.evaluate("players.joined.map(j=>j.label)")
    print('joined:', joined)
    assert joined == ['Joy-Con (L)', 'Joy-Con (R)'], joined
    pg.evaluate("press(0, 9)"); pg.wait_for_timeout(400)
    print('state:', pg.evaluate("game.state"))
    assert pg.evaluate("game.state") == 'play'
    # put the star just to player 1's right and push their stick towards it
    pg.evaluate("const h=game.heroes[0];game.star.set(h.x+1.5,.6,h.z)")
    pg.evaluate("stick(0, 1, 0)"); pg.wait_for_timeout(1500); pg.evaluate("stick(0, 0, 0)")
    score = pg.evaluate("game.heroes[0].score")
    print('score:', score); assert score >= 1
    print(errs); assert not errs
    b.close()
