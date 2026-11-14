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
    pg.goto(GAME); pg.wait_for_timeout(800)
    pg.click('#startBtn'); pg.wait_for_timeout(300)
    # verify for many random mazes: inside tile is cut off from the start when the gate is closed, outside is reachable
    print(pg.evaluate("""(()=>{let bad=0,n=0;for(let i=0;i<40;i++){level=1+(i%7);newLevel();for(const g of gates){n++;
      const p=players[0];const d=reach(p.sx,p.sy,new Set(gates.map(q=>q.y*W+q.x)));const solo=reach(p.sx,p.sy,new Set([g.y*W+g.x]));
      if(solo[g.iy*W+g.ix]>=0)bad++;if(d[g.ly*W+g.lx]<0)n+=1000}}return [n,bad]})()"""))
    # trapped-player scenario: stand inside with gate closed, gate should open
    pg.evaluate("level=1;newLevel();for(let k=0;k<20&&!gates.length;k++)newLevel();state='play';const g=gates[0],p=players[0];p.x=g.ix;p.y=g.iy;p.px=p.x;p.py=p.y;p.inv=1e12;g.open=false;g.until=0;computeSight();camInit=false")
    pg.wait_for_timeout(800)
    print('opens from inside:',pg.evaluate("gates[0].open"))
    pg.screenshot(path='/tmp/f1.png')
    print(errs)
    b.close()
