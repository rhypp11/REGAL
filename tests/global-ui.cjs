const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,820,821,900,901,1024,1100,1101,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   for(const view of ['home','lists','collection','cemetery']){
    await page.locator('[data-page="'+view+'"]').click();
    assert.equal(await page.locator('.nav-tab[aria-current="page"]').getAttribute('data-page'),view);
    const controls=view==='home'?'#home-add-game':view==='lists'?'.board-add-btn':view==='collection'?'#search-input,#sort-select,#add-btn':'#cemetery-search,#cemetery-platform';
    for(const control of await page.locator(controls).all()){
     if(!await control.isVisible())continue;
     const box=await control.boundingBox();assert.ok(box.height>=44,'Shared action size '+view);
     assert.ok(box.x>=0&&box.x+box.width<=width+1,'Control stays in viewport '+view+' '+width+'px '+JSON.stringify(box));
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow '+view);
    const main=view==='home'?'.home-main':view==='lists'?'.lists-main':view==='collection'?'#page-collection .main':'.cemetery-main';
    const padding=await page.locator(main).evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));
    assert.equal(padding,(width<=820?16:24),'Shared top spacing '+view);
    if(view==='home')assert.equal(await page.locator('#home-boards').evaluate(el=>getComputedStyle(el).paddingLeft),'0px','No duplicated page gutters');
    if(view==='home'&&width>820){
     const geometry=await page.evaluate(()=>{
      const main=document.querySelector('.home-main').getBoundingClientRect(),sidebar=document.querySelector('#home-sidebar').getBoundingClientRect();
      const headers=[...document.querySelectorAll('#page-lists .board-head')].filter(el=>el.getClientRects().length).map(el=>({title:el.querySelector('h2').getBoundingClientRect().right,button:el.querySelector('button').getBoundingClientRect().left}));
      return {mainWidth:main.width,sidebarRight:sidebar.right,mainLeft:main.left,headers};
     });
     assert.ok(geometry.mainWidth>=width-261,'Home main uses all remaining width');
     assert.ok(Math.abs(geometry.sidebarRight-geometry.mainLeft)<2,'Desktop sidebar stays beside the boards');
     for(const head of geometry.headers)assert.ok(head.title<=head.button+1,'Board title never overlaps Add');
    }
    await page.screenshot({path:'/tmp/jtd-global-'+view+'-'+width+'-'+theme+'.png',fullPage:true});
   }
   await page.locator('[data-page="lists"]').click();
   if(width<=820){
    await page.locator('[data-target="arrivals"]').click();assert.equal(await page.locator('[data-target="arrivals"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#arrivals-board').isVisible(),true);
    await page.locator('[data-target="wishlist"]').click();assert.equal(await page.locator('[data-target="wishlist"]').getAttribute('aria-pressed'),'true');
   }
   await page.locator('[data-page="collection"]').click();
   if(await page.locator('#global-filter-toggle').isVisible())await page.locator('#global-filter-toggle').click();
   const chip=page.locator('#format-toggles [role="button"]').first();
   await chip.focus();await page.keyboard.press('Space');
   assert.equal(await page.locator('#format-toggles [role="button"]').first().getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#format-toggles [role="button"]').first().evaluate(el=>el===document.activeElement),true,'Keyboard focus survives filter redraw');
   await page.keyboard.press('Enter');assert.equal(await page.locator('#format-toggles [role="button"]').first().getAttribute('aria-pressed'),'false');
   await page.evaluate(()=>{state.japanese=true;state.search='<img src=x onerror=alert(1)>';render();});
   assert.equal(await page.locator('#results-bar .japanese-flag').count(),1,'Japanese result filter renders a real flag');
   assert.equal(await page.locator('#results-bar').textContent().then(text=>text.includes('<span')),false);
   assert.equal(await page.locator('#results-bar img').count(),0,'Search input stays escaped');
   await page.evaluate(()=>{state.search='';render();});
   const platform=page.locator('#platform-list [role="button"]').nth(1);
   await platform.focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>state.platform!==null),true,'Keyboard platform filter works');
   if(width<=820){
    await page.locator('[data-page="home"]').click();
    assert.equal(await page.locator('#global-filter-toggle').isVisible(),false);
    await page.waitForFunction(()=>document.getElementById('home-sidebar').getBoundingClientRect().x>=-1);
    assert.ok((await page.locator('#home-sidebar').boundingBox()).x>=-1,'Mobile home sidebar opens on screen');
    await page.setViewportSize({width:821,height:900});
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#mobile-backdrop').evaluate(el=>el.classList.contains('visible')),false,'Drawer backdrop closes at desktop threshold');
   }
   assert.deepEqual(errors,[]);
   await context.close();console.log('PASS global UI',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
