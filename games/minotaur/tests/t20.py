import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
THREE=os.environ.get('THREE_JS','/tmp/t3/node_modules/three/build/three.min.js')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':640})
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='application/javascript'))
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)
    pg.click('#startBtn'); pg.wait_for_timeout(300)
    # spawn a chest right next to the player (bypass distance rule)
    pg.evaluate("""(()=>{const p=players[0];p.inv=1e12;let t=null;for(const [dx,dy] of [[2,0],[0,2],[-2,0],[0,-2]])if(walk(p.x+dx/2,p.y+dy/2)&&walk(p.x+dx,p.y+dy)){t=[p.x+dx,p.y+dy];break}
      const g=makeChest();g.position.set(t[0],0,t[1]);levelGroup.add(g);chests.push({x:t[0],y:t[1],g,born:performance.now(),opened:0,item:'fireball'});window.CT=t;camInit=false})()""")
    pg.wait_for_timeout(1000); pg.screenshot(path='/tmp/k1.png')
    pg.evaluate("players[0].x=CT[0];players[0].y=CT[1];players[0].px=CT[0];players[0].py=CT[1];computeSight()")
    pg.wait_for_timeout(900)
    print('item:',pg.evaluate("players[0].item"),'inv shown:',pg.evaluate("$('inv0').classList.contains('on')"))
    pg.screenshot(path='/tmp/k2.png')
    # place minotaur 3 tiles ahead in a straight corridor, face the player that way, throw with M
    pg.evaluate("""(()=>{const p=players[0];let best=null;for(const h of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){let k=0,x=p.x,y=p.y;while(k<4&&walk(x+h.x,y+h.y)){x+=h.x;y+=h.y;k++}if(k>=2&&(!best||k>best.k))best={h,k,x,y}}
      p.last=best.h;const m=minos[0];m.x=best.x;m.y=best.y;m.px=m.x;m.py=m.y;m.next=performance.now()+400;window.MB=best})()""")
    pg.keyboard.press('m'); pg.wait_for_timeout(900)
    print('stunned:',pg.evaluate("minos[0].stunUntil>performance.now()"),'item now:',pg.evaluate("players[0].item"))
    pg.screenshot(path='/tmp/k3.png')
    # stunned minotaur must not catch: move him onto the player
    pg.evaluate("players[0].inv=0;const m=minos[0];m.x=players[0].x;m.y=players[0].y;checkHug(performance.now())")
    print('hugs while stunned:',pg.evaluate("hugs"))
    pg.evaluate("minos[0].x=MB.x;minos[0].y=MB.y;players[0].inv=1e12")
    pg.wait_for_timeout(5500)
    print('recovered:',pg.evaluate("[minos[0].stunUntil,minos[0].mode]"))
    # natural spawn
    pg.evaluate("nextChestT=0"); pg.wait_for_timeout(600)
    print('chests:',pg.evaluate("chests.length"))
    print(errs)
    b.close()
