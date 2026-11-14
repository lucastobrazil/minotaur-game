import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
INIT="""
const mk=(i,id)=>({id,index:i,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
// pad0 = Joy-Con L, pad1 = a ghost copy of Joy-Con L (mirrors pad0), pad2 = Joy-Con R
window.P=[mk(0,'Joy-Con (L) (STANDARD GAMEPAD Vendor: 057e Product: 2006)'),mk(1,'Xbox 360 Controller (XInput STANDARD GAMEPAD)'),mk(2,'Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)')];
navigator.getGamepads=()=>{P[1].buttons.forEach((b,k)=>b.pressed=P[0].buttons[k].pressed);P[1].axes=P[0].axes.slice();return P};
window.tap=(pad,btn)=>{P[pad].buttons[btn].pressed=true;pollPads();P[pad].buttons[btn].pressed=false;pollPads()};
"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':800})
    pg.add_init_script(INIT)
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    print('players:',pg.evaluate("numPlayers"))
    pg.evaluate("tap(0,1)")   # A on left joycon -> Start (focused) -> opens assignment
    pg.wait_for_timeout(300); print('state:',pg.evaluate("state"))
    pg.evaluate("tap(0,0)"); pg.wait_for_timeout(500)   # Theseus presses on Joy-Con L (ghost mirrors it)
    pg.screenshot(path='/tmp/i1.png')
    pg.evaluate("tap(2,0)"); pg.wait_for_timeout(200)   # Ariadne presses on Joy-Con R
    print('assign:',pg.evaluate("assign.map(s=>[...s])"))
    pg.screenshot(path='/tmp/i2.png')
    pg.wait_for_timeout(1500); print('state:',pg.evaluate("state"))
    print(pg.evaluate("""(()=>{const o=[];P[0].axes=[1,0,0,0];o.push(['L stick right',getDir(0),getDir(1)]);P[0].axes=[0,0,0,0];
      P[2].axes=[0,1,0,0];o.push(['R stick down',getDir(0),getDir(1)]);P[2].axes=[0,0,0,0];return JSON.stringify(o)})()"""))
    print(errs)
    b.close()
