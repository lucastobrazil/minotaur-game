import os
GAME='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','index.html'))
# Refined character models: heroes have arm/leg joints that swing while walking, the Minotaur keeps the
# parts the game animates, the robe outfit builds, and merging keeps draw calls low.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':640})
    pg.route('**fonts.g*',lambda r:r.abort())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear();setPlayers(4)")
    pg.click('#startBtn'); pg.wait_for_timeout(800)
    parts=pg.evaluate("players.map(p=>[p.mesh.userData.legs.length,p.mesh.userData.arms.length])")
    mino=pg.evaluate("(()=>{const u=minos[0].mesh.userData;return [u.legs.length,u.arms.length,!!u.head,!!u.eyeMat,u.mats.length>3]})()")
    meshes=pg.evaluate("(()=>{let n=0;players[0].mesh.traverse(o=>{if(o.isMesh)n++});return n})()")
    print('hero joints',parts,'mino parts',mino,'meshes per hero',meshes)
    assert all(x==[2,2] for x in parts) and all(mino) and meshes<40
    pg.evaluate("players.forEach(q=>q.inv=1e12);minos.forEach(m=>m.next=1e12)")
    # walk: legs swing; stop: they settle back
    swung=0
    for k in ['ArrowRight','ArrowLeft','ArrowDown','ArrowUp']:
        pg.keyboard.down(k); pg.wait_for_timeout(500)
        swung=max(swung,pg.evaluate("Math.abs(players[0].mesh.userData.legs[0].rotation.x)")); pg.keyboard.up(k)
    pg.wait_for_timeout(1500)
    rest=pg.evaluate("Math.abs(players[0].mesh.userData.legs[0].rotation.x)")
    print('swing',round(swung,2),'rest',round(rest,3))
    assert swung>.05 and rest<.05
    calls=pg.evaluate("renderer.info.render.calls")
    print('draw calls',calls); assert calls<400
    # robe outfit builds on the new models
    pg.evaluate("robeUnlocked=true;setOutfit('robe');newLevel()"); pg.wait_for_timeout(400)
    print('robe meshes',pg.evaluate("(()=>{let n=0;players[1].mesh.traverse(o=>{if(o.isMesh)n++});return n})()"))
    print(errs); assert not errs
    b.close()
