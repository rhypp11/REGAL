const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{
    GAMES=[{id:'zero',nom:'Jeu fictif gratuit',plateforme:'Switch 2',prix:0}];
    CEMETERY=[{id:'sold',nom:'Vendu',plateforme:'PC',saleStatus:'sold',prix:500},{id:'pending',nom:'À vendre',plateforme:'PC',saleStatus:'pending'}];
    renderHomeStats();goToPage('home');
   });
   assert.equal(await page.locator('#home-total-games').textContent(),'1');
   assert.match(await page.locator('#home-summary-meta').textContent(),/0 €valeur d’achat/);
   assert.deepEqual(await page.locator('.nav-tab').evaluateAll(t=>t.map(e=>e.dataset.page)),['home','collection','cemetery']);
   assert.equal(await page.locator('#page-lists').count(),0);
   assert.match(await page.locator('#home-summary-meta').textContent(),/0terminés1à faire/);
   const sidebar=page.locator('#home-sidebar');
   if(width<=820){
    assert.equal(await sidebar.evaluate(el=>el.getBoundingClientRect().right<=0),true,'Summary starts in a closed drawer');
    await page.locator('#global-filter-toggle').click();
    assert.equal(await sidebar.evaluate(el=>el.classList.contains('mobile-open')),true);
    await page.waitForFunction(()=>Math.abs(document.getElementById('home-sidebar').getBoundingClientRect().left)<1);
    assert.ok((await sidebar.boundingBox()).width>250,'Open drawer has a readable width');
    assert.ok(await sidebar.evaluate(el=>Math.abs(el.getBoundingClientRect().bottom-innerHeight)<2),'Drawer reaches the bottom of the viewport');
    await page.screenshot({path:'/tmp/jtd-home-drawer-'+width+'-'+theme+'.png'});
   }else{
    const side=await sidebar.boundingBox(),boards=await page.locator('#home-boards').boundingBox();
    assert.ok(side.x+side.width<=boards.x,'Summary is a separate desktop sidebar');
   }
   assert.equal(await page.locator('.home-widget-title a').count(),0,'No duplicate collection shortcut');
   assert.equal(await page.locator('.home-widget-title h2').textContent(),'Statistiques');
   await page.keyboard.press('Escape');
   await page.locator('[data-page="collection"]').click();await page.waitForFunction(()=>navigationPage==='collection');
   await page.locator('[data-page="home"]').click();
   assert.equal(await page.locator('#home-boards-switcher').isVisible(),width<=820);
   if(width<=820){await page.locator('[data-target="arrivals"]').click();assert.equal(await page.locator('.board.wishlist').isVisible(),false)}
   else {assert.equal(await page.locator('.board.wishlist').isVisible(),true);const left=await page.locator('.board.wishlist').boundingBox(),right=await page.locator('#arrivals-board').boundingBox();assert.ok(left.x+left.width<=right.x)}
   assert.equal(await page.locator('#arrivals-board').isVisible(),true);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>navigationPage),'home');
   if(width<=820)assert.equal(await page.evaluate(()=>navigationBoard),'arrivals');
   await page.screenshot({path:'/tmp/jtd-home-'+width+'-'+theme+'.png',fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.evaluate(()=>{GAMES=[];renderHomeStats();});assert.equal(await page.locator('#home-total-games').textContent(),'0');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS home/navigation',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

