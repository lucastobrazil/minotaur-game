import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1000,'height':640})
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(800)
    pg.screenshot(path='/tmp/d0.png')
    pg.click('#startBtn'); pg.wait_for_timeout(400)
    print(pg.evaluate("[W,H,gates.length,minos.length,threads.length,gates.map(g=>[g.x,g.y,g.lx,g.ly])]"))
    pg.keyboard.down('Enter')
    for k in ['ArrowRight','ArrowDown','ArrowLeft','ArrowDown','ArrowRight']:
        pg.keyboard.down(k); pg.wait_for_timeout(450); pg.keyboard.up(k)
    pg.keyboard.up('Enter')
    print(pg.evaluate("[players[0].stamina.toFixed(2),players[0].tired]"))
    pg.wait_for_timeout(300); pg.screenshot(path='/tmp/d1.png')
    # teleport onto lever 0 and check gate opens, then step off
    pg.evaluate("(()=>{const g=gates[0],p=players[0];p.x=g.lx;p.y=g.ly;p.px=p.x;p.py=p.y;p.inv=1e12;computeSight();camInit=false})()")
    pg.wait_for_timeout(1200); pg.screenshot(path='/tmp/d2.png')
    print('gate open?',pg.evaluate("gates[0].open"))
    pg.keyboard.press('c'); pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/d3.png')
    # trigger final chase
    pg.evaluate("threads.forEach(t=>{if(!t.taken){players[0].x=t.x;players[0].y=t.y}});threads.slice(0,-1).forEach(t=>t.taken=true);got=needed-1;const t=threads[threads.length-1];const p=players[0];p.x=t.x+ (walk(t.x+1,t.y)?1:-1);p.y=t.y; if(!walk(p.x,p.y)){p.x=t.x;p.y=t.y+(walk(t.x,t.y+1)?1:-1)} tryMove(p,{x:t.x-p.x,y:t.y-p.y},performance.now())")
    pg.wait_for_timeout(1500)
    print('door',pg.evaluate("[doorOpen,minos.map(m=>m.enraged)]"))
    pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/d4.png')
    print(errs)
    b.close()
