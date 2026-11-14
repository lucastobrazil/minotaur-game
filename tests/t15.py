import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
INIT="""
window.__pad={id:'Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
navigator.getGamepads=()=>[window.__pad];
"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':800})
    pg.add_init_script(INIT)
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    print('auto players:',pg.evaluate("numPlayers"),'|',pg.inner_text('#padStatus'))
    pg.screenshot(path='/tmp/h1.png')
    pg.evaluate("startGame()"); pg.wait_for_timeout(300)
    # sideways: left joy-con stick pushed native 'right' (+x) should be player UP for P1, P2 untouched
    print(pg.evaluate("""(()=>{const o=[];
      __pad.axes=[1,0,0,0];o.push(['L native right',getDir(0),getDir(1)]);
      __pad.axes=[0,0,0,-1];o.push(['R native up',getDir(0),getDir(1)]);
      __pad.axes=[0,0,0,0];__pad.buttons[1].pressed=true;o.push(['R button A',getDir(0),getDir(1)]);__pad.buttons[1].pressed=false;
      __pad.buttons[7].pressed=true;o.push(['ZR sprint',sprintHeld(0),sprintHeld(1)]);__pad.buttons[7].pressed=false;
      setGrip('upright');__pad.axes=[1,0,0,0];o.push(['upright L right',getDir(0),getDir(1)]);__pad.axes=[0,0,0,0];
      return JSON.stringify(o)})()"""))
    print(errs)
    b.close()
