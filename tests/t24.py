import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
# Boss level: arena, braziers, charge/stun, fireball damage, hearts, ghosts, revive, restart, defeat rewards, winged sandals
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1100,'height':680})
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear()")
    pg.click('#startBtn'); pg.wait_for_timeout(300)
    pg.evaluate("level=4;newLevel();levelIntro()"); pg.wait_for_timeout(400)
    print('boss level:',pg.evaluate("[isBoss,W,H,braziers.length,!!boss,boss.hp,players[0].hearts,threads.length]"))
    # the boss should stalk, wind up, charge and crash into something on his own
    pg.evaluate("players[0].inv=1e12;boss.modeUntil=0;boss.stalkStart=performance.now()")
    seen=set()
    for _ in range(40):
        seen.add(pg.evaluate("boss.mode")); pg.wait_for_timeout(250)
        if 'stunned' in seen: break
    print('modes seen:',sorted(seen))
    pg.screenshot(path='/tmp/boss1.png')
    # brazier gives a fireball
    pg.evaluate("const br=braziers[0],p=players[0];p.item=null;p.x=br.x;p.y=br.y;p.px=br.x;p.py=br.y")
    pg.wait_for_timeout(300)
    print('brazier item:',pg.evaluate("players[0].item"))
    # fireball bounces off when he isn't dazed
    def line_up():
        pg.evaluate("""(()=>{const b=boss,p=players[0];b.mode='stalk';b.modeUntil=performance.now()+1e9;
          for(const [dx,dy] of [[-3,0],[3,0],[0,-3],[0,3]]){const x=b.x+dx,y=b.y+dy;let ok=true;for(let k=1;k<=3;k++)if(!walk(b.x+Math.sign(dx)*k,b.y+Math.sign(dy)*k))ok=false;
            if(ok){p.x=x;p.y=y;p.px=x;p.py=y;p.last={x:-Math.sign(dx),y:-Math.sign(dy)};return}}})()""")
    line_up(); pg.evaluate("players[0].item='fireball'"); pg.keyboard.press('m'); pg.wait_for_timeout(700)
    print('hp after bounce:',pg.evaluate("boss.hp"))
    # dazed: a hit counts, minions come, a heart appears
    line_up(); pg.evaluate("boss.mode='stunned';boss.modeUntil=performance.now()+5000;players[0].item='fireball'"); pg.keyboard.press('m'); pg.wait_for_timeout(2600)
    print('after hit 1:',pg.evaluate("[boss.hp,boss.mode,minos.length,heartPickups.length]"))
    # touching him costs a heart; 0 hearts -> ghost; alone -> fight restarts
    pg.evaluate("const p=players[0];p.inv=0;p.hearts=2;minos.forEach(m=>m.next=1e12);boss.mode='stalk';boss.modeUntil=performance.now()+1e9;p.x=boss.x;p.y=boss.y;p.px=boss.px;p.py=boss.py")
    pg.wait_for_timeout(300)
    print('hearts after grab:',pg.evaluate("players[0].hearts"))
    pg.evaluate("const p=players[0];p.inv=0;p.hearts=1;p.x=boss.x;p.y=boss.y;p.px=boss.px;p.py=boss.py")
    pg.wait_for_timeout(300)
    print('ghost:',pg.evaluate("players[0].ghost"))
    pg.wait_for_timeout(2800)
    print('restarted:',pg.evaluate("[isBoss,boss.hp,players[0].ghost,players[0].hearts]"))
    # two players: a ghost revives by touching the living one
    pg.evaluate("setPlayers(2,true);newLevel()"); pg.wait_for_timeout(300)
    pg.evaluate("const [a,c]=players;boss.modeUntil=performance.now()+1e9;a.hearts=1;a.inv=0;a.x=boss.x;a.y=boss.y;a.px=boss.px;a.py=boss.py")
    pg.wait_for_timeout(300)
    print('p1 ghost, p2 alive:',pg.evaluate("[players[0].ghost,players[1].ghost]"))
    pg.evaluate("const [a,c]=players;a.x=c.x;a.y=c.y;a.px=c.px;a.py=c.py")
    pg.wait_for_timeout(300)
    print('revived:',pg.evaluate("[players[0].ghost,players[0].hearts]"))
    # defeat: last hit opens the exit and unlocks the robe + sandals
    pg.evaluate("setPlayers(1,true);newLevel()"); pg.wait_for_timeout(300)
    line_up(); pg.evaluate("boss.hp=1;boss.mode='stunned';boss.modeUntil=performance.now()+5000;players[0].item='fireball';players[0].inv=1e12"); pg.keyboard.press('m'); pg.wait_for_timeout(2000)
    print('defeated:',pg.evaluate("[boss.mode,doorOpen,robeUnlocked,outfit,bossWins,localStorage.getItem('minoRobe')]"))
    pg.screenshot(path='/tmp/boss2.png')
    rolls=pg.evaluate("Array.from({length:200},()=>rollItem()).filter(x=>x==='sandals').length")
    print('sandals in 200 chest rolls:',rolls)
    # sandals: super speed with no stamina cost
    pg.evaluate("level=1;newLevel();players[0].item='sandals'"); pg.keyboard.press('m'); pg.wait_for_timeout(200)
    pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(900); pg.keyboard.up('ArrowRight')
    print('sandals:',pg.evaluate("[players[0].sandalsUntil>performance.now(),players[0].stamina]"))
    pg.wait_for_timeout(1200); pg.screenshot(path='/tmp/boss3.png')
    print(errs)
    b.close()
