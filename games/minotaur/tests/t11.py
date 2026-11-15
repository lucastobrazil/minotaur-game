import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
INIT="""
window.__pad={id:'Pro Controller (STANDARD GAMEPAD)',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
navigator.getGamepads=()=>[window.__pad];
window.press=(i)=>{__pad.buttons[i].pressed=true;setTimeout(()=>__pad.buttons[i].pressed=false,60)};
"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':700})
    pg.add_init_script(INIT)
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    f=lambda: pg.evaluate("navFocus&&navFocus.textContent.trim()")
    print('default focus:',f())
    pg.screenshot(path='/tmp/g1.png')
    for btn in [12,12,15]:   # up, up, right
        pg.evaluate(f"press({btn})"); pg.wait_for_timeout(400); print(' ->',f())
    pg.evaluate("press(1)"); pg.wait_for_timeout(400)
    print('players/diff:',pg.evaluate("[numPlayers,difficulty]"))
    for btn in [13,13]:
        pg.evaluate(f"press({btn})"); pg.wait_for_timeout(400); print(' ->',f())
    pg.evaluate("press(1)"); pg.wait_for_timeout(800)
    print('state:',pg.evaluate("state"))
    pg.evaluate("press(4)"); pg.wait_for_timeout(400); print('cam:',pg.evaluate("camMode"))
    pg.evaluate("press(9)"); pg.wait_for_timeout(400); print('state:',pg.evaluate("state"),'focus:',f())
    pg.evaluate("press(13)"); pg.wait_for_timeout(400); print(' ->',f())
    pg.evaluate("press(1)"); pg.wait_for_timeout(400); print('cam:',pg.evaluate("camMode"))
    pg.screenshot(path='/tmp/g2.png')
    pg.evaluate("press(9)"); pg.wait_for_timeout(400); print('state:',pg.evaluate("state"))
    pg.evaluate("initAudio();hungry(minos[0]);growl()"); pg.wait_for_timeout(500)
    print(errs)
    b.close()
