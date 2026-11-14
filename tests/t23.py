import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
INIT="""
const mk=(i,id)=>({id,index:i,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
window.P=[mk(0,'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'),mk(1,'Joy-Con (L) (STANDARD GAMEPAD Vendor: 057e Product: 2006)'),mk(2,'Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)'),mk(3,'Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)'),mk(4,'Xbox Controller (STANDARD GAMEPAD)')];
navigator.getGamepads=()=>{const c=P[3];c.buttons.forEach((b,k)=>b.pressed=P[1].buttons[k].pressed||P[2].buttons[k].pressed);c.axes=[P[1].axes[0],P[1].axes[1],P[2].axes[0],P[2].axes[1]];return P};
window.tap=(pads,btn)=>{pads.forEach(i=>P[i].buttons[btn].pressed=true);pollPads();pads.forEach(i=>P[i].buttons[btn].pressed=false);pollPads()};
"""
def setup(pg):
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1100,'height':700}); pg.add_init_script(INIT); setup(pg)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(700)
    print('auto players:',pg.evaluate("numPlayers"))
    pg.screenshot(path='/tmp/m0.png')
    pg.evaluate("requestStart()"); pg.wait_for_timeout(200)
    for st in ["tap([0],1)","tap([1],0)","tap([2],0)"]:
        pg.evaluate(st); pg.wait_for_timeout(450)
    pg.screenshot(path='/tmp/m1.png')
    pg.evaluate("tap([4],0)"); pg.wait_for_timeout(1500)
    print('state',pg.evaluate("state"),'assign',pg.evaluate("assign.map(s=>[...s])"),'players',pg.evaluate("players.length"))
    print(pg.evaluate("""(()=>{const o=[];const t=(n,f)=>{f(1);pollPads();o.push(n+': '+[0,1,2,3].map(i=>getDir(i)?'P'+(i+1):'').join(''));f(0);pollPads()};
      t('Pro',v=>P[0].axes[0]=v);t('JoyL',v=>P[1].axes[0]=v);t('JoyR',v=>P[2].axes[0]=v);t('Xbox',v=>P[4].axes[0]=v);
      codes.KeyJ=true;o.push('key J: '+[0,1,2,3].map(i=>getDir(i)?'P'+(i+1):'').join(''));codes.KeyJ=false;
      codes.Numpad8=true;o.push('num8: '+[0,1,2,3].map(i=>getDir(i)?'P'+(i+1):'').join(''));codes.Numpad8=false;
      return o.join(' | ')})()"""))
    pg.evaluate("toggleCam();toggleCam()"); pg.wait_for_timeout(1800); pg.screenshot(path='/tmp/m2.png')
    pg.evaluate("toggleCam()"); pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/m3.png')
    # three players: fp grid with overview corner
    pg.evaluate("setPlayers(3,true);hideAll();startGame();camMode='near';toggleCam();toggleCam()"); pg.wait_for_timeout(1800); pg.screenshot(path='/tmp/m4.png')
    print(errs)
    b.close()
