import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
# Touch joystick: slide a finger over it to steer; it snaps to maze directions, the middle is a dead zone,
# and letting go stops the hero. Runs on an emulated touch phone.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    ctx=b.new_context(viewport={'width':900,'height':600},has_touch=True,is_mobile=True)
    pg=ctx.new_page()
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear()")
    pg.tap('#startBtn'); pg.wait_for_timeout(400)
    assert pg.is_visible('#pad0'), 'joystick shown on touch'
    pg.evaluate("minos.forEach(m=>{m.x=m.px=1;m.y=m.py=1;m.next=1e15});players[0].inv=1e12")
    print('snap:',pg.evaluate("[joyDir(.1,.1),joyDir(.9,.1),joyDir(-.1,-.8),joyDir(.6,.55)].map(d=>d.x+','+d.y)"))
    assert pg.evaluate("JSON.stringify([joyDir(.1,.1),joyDir(.9,.1),joyDir(-.1,-.8),joyDir(.6,.55)])")=='[{"x":0,"y":0},{"x":1,"y":0},{"x":0,"y":-1},{"x":1,"y":1}]'

    box=pg.locator('#pad0').bounding_box(); cx,cy=box['x']+box['width']/2,box['y']+box['height']/2; R=box['width']/2
    def touch(kind,x,y):  # dispatch real pointer events with pointerType touch
        pg.evaluate(f"""(()=>{{const el=document.getElementById('pad0');el.dispatchEvent(new PointerEvent('{kind}',{{pointerId:7,pointerType:'touch',clientX:{x},clientY:{y},bubbles:true,cancelable:true,isPrimary:true}}))}})()""")
    # finger down in the middle: dead zone, no movement
    touch('pointerdown',cx,cy); pg.wait_for_timeout(100)
    assert pg.evaluate("touchDir[0].x===0&&touchDir[0].y===0")
    # slide around without lifting: the direction follows the finger
    seen=[]
    for dx,dy in [(R*.8,0),(0,R*.8),(-R*.8,0),(0,-R*.8)]:
        touch('pointermove',cx+dx,cy+dy); pg.wait_for_timeout(60); seen.append(pg.evaluate("touchDir[0].x+','+touchDir[0].y"))
    print('slide directions:',seen); assert seen==['1,0','0,1','-1,0','0,-1']
    # hold towards an open direction: the hero walks
    d=pg.evaluate("(()=>{const p=players[0];for(const [x,y] of [[1,0],[0,1],[-1,0],[0,-1]])if(walk(p.x+x,p.y+y))return [x,y]})()")
    start=pg.evaluate("[players[0].x,players[0].y]")
    touch('pointermove',cx+d[0]*R*.8,cy+d[1]*R*.8); pg.wait_for_timeout(900)
    now=pg.evaluate("[players[0].x,players[0].y]")
    print('walked',start,'->',now); assert now!=start
    knob=pg.evaluate("document.querySelector('#pad0 .knob').style.transform")
    print('knob follows finger:',knob); assert 'translate' in knob
    # lift: stop and recentre
    touch('pointerup',cx+d[0]*R*.8,cy+d[1]*R*.8); pg.wait_for_timeout(100)
    assert pg.evaluate("touchDir[0].x===0&&touchDir[0].y===0") and pg.evaluate("document.querySelector('#pad0 .knob').style.transform")==''
    print(errs); assert not errs
    b.close()
