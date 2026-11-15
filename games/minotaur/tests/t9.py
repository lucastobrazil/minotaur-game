import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':780},has_touch=True,is_mobile=True,device_scale_factor=2)
    pg=ctx.new_page()
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    pg.tap('[data-players="2"]'); pg.tap('#startBtn'); pg.wait_for_timeout(2500)
    pg.screenshot(path='/tmp/e1.png')
    print(errs, pg.evaluate("[W,H,gates.length,players.length]"))
    b.close()
