import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
INIT="""
const mk=(i,id)=>({id,index:i,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
window.SCEN=window.SCEN||'full';
window.P=[mk(0,'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'),mk(1,'Joy-Con (L) (STANDARD GAMEPAD Vendor: 057e Product: 2006)'),mk(2,'Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)'),mk(3,'Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)')];
navigator.getGamepads=()=>{const c=P[3];c.buttons.forEach((b,k)=>b.pressed=P[1].buttons[k].pressed||P[2].buttons[k].pressed);c.axes=[P[1].axes[0],P[1].axes[1],P[2].axes[0],P[2].axes[1]];
  return window.ONLYCOMBO?[P[0],P[3]]:P};
window.tap=(pads,btn)=>{pads.forEach(i=>P[i].buttons[btn].pressed=true);pollPads();pads.forEach(i=>P[i].buttons[btn].pressed=false);pollPads()};
"""
def run(b,setup_js,steps,checks):
    pg=b.new_page(viewport={'width':1000,'height':800})
    pg.add_init_script(INIT+setup_js)
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(700)
    pg.evaluate("setPlayers(2,true);requestStart()"); pg.wait_for_timeout(200)
    for st in steps: pg.evaluate(st); pg.wait_for_timeout(500)
    pg.wait_for_timeout(1200)
    print(' assign',pg.evaluate("assign.map(s=>[...s])"),'split',pg.evaluate("splitIdx"),'state',pg.evaluate("state"))
    print(' ',pg.evaluate(checks)); print(' errs',errs)
    pg.close()
CHK="""(()=>{const o=[];const t=(n,f)=>{f(1);pollPads();o.push(n+': P1='+JSON.stringify(getDir(0))+' P2='+JSON.stringify(getDir(1)));f(0)};
 t('Pro stick',v=>P[0].axes[0]=v);t('JoyL stick',v=>P[1].axes[1]=v);t('JoyR stick',v=>P[2].axes[1]=v);return o.join(' | ')})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    print('A) Pro -> Theseus, left Joy-Con -> Ariadne')
    run(b,"",["tap([0],1)","tap([1],0)"],CHK)
    print('B) Both Joy-Cons together -> Theseus (pair), Pro -> Ariadne')
    run(b,"",["tap([1,2],0)","tap([0],1)"],CHK)
    print('C) Only Pro + joined pair listed: Pro -> Theseus, pair -> Ariadne')
    run(b,"window.ONLYCOMBO=true;",["tap([0],1)","tap([1],0)"],CHK)
    b.close()
