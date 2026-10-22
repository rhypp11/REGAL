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
   let headerGeometry;
   for(const view of ['home','collection','cemetery']){
    await page.locator('[data-page="'+view+'"]').click();
    const geometry=await page.locator('.topnav').evaluate(el=>[el,...el.querySelectorAll('.nav-tab,.regal-logo,#theme-toggle,#profile-menu-btn')].map(node=>{
     const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];
    }));
    if(headerGeometry)assert.deepEqual(geometry,headerGeometry,'Header geometry stays stable between pages');
    else headerGeometry=geometry;
    assert.equal(await page.locator('.topnav #global-filter-toggle').count(),0);
    const filter=page.locator('#global-filter-toggle');
    assert.equal(await filter.isVisible(),width<=820&&view!=='home');
    if(width<=820&&view!=='home'){
     const target=view==='collection'?'.platform-banner-title':'.cemetery-tabs';
     const button=await filter.boundingBox(),title=await page.locator(target).boundingBox();
     assert.ok(Math.abs(button.y+button.height/2-title.y-title.height/2)<23,'Filter is alongside page controls');
     await filter.click();assert.equal(await filter.getAttribute('aria-expanded'),'true');
     assert.equal(await page.locator('#'+view+'-sidebar').evaluate(el=>el.classList.contains('mobile-open')),true);
     await page.locator('#mobile-backdrop').click({position:{x:width-1,y:400}});
     assert.equal(await filter.getAttribute('aria-expanded'),'false');
    }
    if(view==='collection'&&width>=1101){
     assert.equal(await page.locator('#grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4,'Compact desktop grid');
    }
    assert.equal(await page.locator('.nav-tab[aria-current="page"]').getAttribute('data-page'),view);
    const controls=view==='home'?'.board-add-btn':view==='collection'?'#search-input,#sort-select,#add-btn':'#cemetery-search,#cemetery-platform';
    for(const control of await page.locator(controls).all()){
     if(!await control.isVisible())continue;
     const box=await control.boundingBox();assert.ok(box.height>=44,'Shared action size '+view);
     assert.ok(box.x>=0&&box.x+box.width<=width+1,'Control stays in viewport '+view+' '+width+'px '+JSON.stringify(box));
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow '+view);
    const main=view==='home'?'.home-main':view==='collection'?'#page-collection .main':'.cemetery-main';
    const padding=await page.locator(main).evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));
    assert.equal(padding,(width<=820?16:24),'Shared top spacing '+view);
    if(view==='home')assert.equal(await page.locator('#home-boards').evaluate(el=>getComputedStyle(el).paddingLeft),'0px','No duplicated page gutters');
    if(view==='home'&&width>820){
     assert.equal(await page.locator('.board.wishlist').isVisible(),true);
     assert.equal(await page.locator('#arrivals-board').isVisible(),true);
     const left=await page.locator('.board.wishlist').boundingBox(),right=await page.locator('#arrivals-board').boundingBox();
     assert.ok(left.x+left.width<=right.x && Math.abs(left.y-right.y)<1,'Desktop boards are side by side');
    }
    await page.screenshot({path:'/tmp/jtd-global-'+view+'-'+width+'-'+theme+'.png',fullPage:true});
   }
   await page.locator('[data-page="home"]').click();
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
   assert.equal(await page.locator('#platform-banner #global-filter-toggle').count(),1,'Filter survives platform and results redraw');

   if([320,390,1440].includes(width)){
    await page.evaluate(()=>{
     GAMES=Array.from({length:100},(_,i)=>({...GAMES[0],id:'scroll-'+i}));
     state.platform=GAMES[0].plateforme;state.japanese=false;state.collector=false;state.status=null;render();
     window.scrollTo(0,0);
     document.querySelector('#page-collection .main').scrollTop=0;
    });
    await page.waitForTimeout(50);
    const band=page.locator('#collection-scroll-context');
    assert.equal(await band.isVisible(),false,'No compact context at the top');
    assert.equal(await page.locator('#platform-banner').evaluate(el=>getComputedStyle(el,'::before').content),'none','No decorative platform underline');
    await page.evaluate(()=>{window.scrollTo(0,900);document.querySelector('#page-collection .main').scrollTop=900;});
    await band.waitFor({state:'visible'});
    assert.equal(await band.locator('strong').innerText(),await page.evaluate(()=>state.platform));
    assert.equal(await band.locator('span').innerText(),'100 jeux');
    const rect=await band.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'Compact context stays on screen');
    if(width<=820){
     await band.locator('button').click();
     assert.equal(await page.locator('#collection-sidebar').evaluate(el=>el.classList.contains('mobile-open')),true,'Compact context gives access to filters');
     await page.evaluate(()=>closeMobileDrawers());
    }
    await page.screenshot({path:`/tmp/jtd-collection-scroll-${width}-${theme}.png`,fullPage:true});
    await page.evaluate(()=>{state.platform=null;render();});
    await page.waitForTimeout(50);
    assert.equal(await band.locator('strong').innerText(),'Tous les jeux','Context updates after a filter change');
    await page.evaluate(()=>goToPage('home'));
    assert.equal(await band.isVisible(),false,'Context stays within collection');
    await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#page-collection .main').scrollTop=0;goToPage('collection');});
    await page.waitForTimeout(50);
    assert.equal(await band.isVisible(),false,'Full heading replaces compact context on return to top');
   }
   assert.deepEqual(errors,[]);
   await context.close();console.log('PASS global UI',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

