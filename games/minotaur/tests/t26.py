import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
# The kids' rule: getting caught costs one golden thread (it goes back into the maze somewhere new),
# and the caught player is thrown to a random spot well away from the Minotaur, not back to the start.
# If the exit was open, losing a thread seals it again.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':640})
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear()")
    pg.click('#startBtn'); pg.wait_for_timeout(400)
    pg.evaluate("minos.forEach(m=>m.next=1e15)")  # hold the Minotaur still

    def catch():
        pg.evaluate("(()=>{const p=players[0],m=minos[0];p.inv=0;m.stunUntil=0;m.x=p.x;m.y=p.y;checkHug(performance.now())})()")
        pg.wait_for_timeout(100)

    # caught with no threads: just thrown somewhere new
    start=pg.evaluate("[players[0].sx,players[0].sy]")
    catch()
    pos=pg.evaluate("[players[0].x,players[0].y]")
    print('no threads -> thrown to',pos,'start',start,'got',pg.evaluate("got"))
    assert pg.evaluate("got")==0 and pos!=start or pg.evaluate("got")==0

    # pick up two threads, then get caught: one is lost and reappears in the maze
    pg.evaluate("threads.slice(0,2).forEach(t=>{t.taken=true;t.popT=performance.now()});got=2")
    pg.wait_for_timeout(600)
    before=pg.evaluate("threads.filter(t=>!t.taken).length")
    catch()
    after=pg.evaluate("threads.filter(t=>!t.taken).length")
    p0=pg.evaluate("[players[0].x,players[0].y]"); m0=pg.evaluate("[minos[0].x,minos[0].y]")
    dist=pg.evaluate("reach(minos[0].x,minos[0].y)[players[0].y*W+players[0].x]")
    vis=pg.evaluate("threads.filter(t=>!t.taken).every(t=>t.mesh.visible)")
    print('got',pg.evaluate("got"),'threads left in maze',before,'->',after,'player',p0,'minotaur',m0,'path distance',dist,'visible',vis)
    print('toast:',pg.evaluate("$('toast').textContent"))
    assert pg.evaluate("got")==1 and after==before+1 and vis
    assert pg.evaluate("walk(players[0].x,players[0].y)") and dist>=4
    assert pg.evaluate("[players[0].x,players[0].y]")!=start

    # with the exit open, losing a thread seals it again
    pg.evaluate("threads.forEach(t=>{t.taken=true;t.popT=performance.now()});got=needed;doorOpen=true;minos.forEach(m=>m.enraged=true)")
    catch()
    print('exit open after catch:',pg.evaluate("doorOpen"),'got',pg.evaluate("got"),'/',pg.evaluate("needed"),'-',pg.evaluate("$('toast').textContent"))
    assert not pg.evaluate("doorOpen") and pg.evaluate("got")==pg.evaluate("needed")-1 and not pg.evaluate("minos[0].enraged")
    # and the dropped thread can be picked up again to reopen it
    pg.evaluate("(()=>{const t=threads.find(t=>!t.taken),p=players[0];p.inv=1e12;p.x=t.x;p.y=t.y;p.px=t.x;p.py=t.y})()")
    pg.evaluate("(()=>{const p=players[0],t=threads.find(t=>!t.taken);for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}])if(walk(t.x+d.x,t.y+d.y)){p.x=t.x+d.x;p.y=t.y+d.y;p.px=p.x;p.py=p.y;tryMove(p,{x:-d.x,y:-d.y},performance.now());break}})()")
    pg.wait_for_timeout(300)
    print('picked it back up, exit open:',pg.evaluate("doorOpen"))
    assert pg.evaluate("doorOpen")
    print(errs); assert not errs
    b.close()
