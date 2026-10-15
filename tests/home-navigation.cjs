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
    GAMES=[{id:'recent',nom:'Acquisition récente',plateforme:'Switch 2',date:'2026-10-01',prix:0,image:'/logo-icon.png',status:'a_jouer'},{id:'old',nom:'Ancien achat',plateforme:'Switch 2',date:'2024-01-01'},{id:'undated',nom:'Sans date',plateforme:'PlayStation 5'}];
    CEMETERY=[{id:'sold',nom:'Vendu',plateforme:'PC',saleStatus:'sold',prix:500},{id:'pending',nom:'À vendre',plateforme:'PC',saleStatus:'pending'}];
    renderHomeStats();goToPage('home');
   });
   assert.equal(await page.locator('#home-total-games').textContent(),'3');
   assert.match(await page.locator('#home-summary-meta').textContent(),/0 €achats renseignés/);
   assert.equal(await page.locator('#home-recent .dashboard-game').count(),2);
   assert.match(await page.locator('#home-recent .dashboard-game').first().textContent(),/Acquisition récente/);
   await page.locator('#home-recent .dashboard-game').first().click();
   assert.equal(await page.locator('#f-nom').inputValue(),'Acquisition récente');await page.locator('#cancel-btn').click();
   await page.locator('#home-statuses a[href*="a_jouer"]').click();
   await page.waitForFunction(()=>navigationPage==='collection'&&state.status==='a_jouer');
   assert.equal(await page.locator('#grid .card').count(),1);
   await page.locator('[data-page="home"]').click();
   await page.locator('#home-platform-bars a').filter({hasText:'Switch 2'}).click();
   await page.waitForFunction(()=>state.platform==='Switch 2'&&state.status===null);
   assert.equal(await page.locator('#grid .card').count(),2);
   await page.locator('[data-page="home"]').click();
   await page.locator('.dashboard-links a[href*="arrivals"]').click();
   await page.waitForFunction(()=>navigationPage==='lists'&&navigationBoard==='arrivals');
   assert.equal(await page.locator('#arrivals-board').isVisible(),true);
   assert.equal(await page.locator('.board.wishlist').isVisible(),width>820);
   assert.equal(await page.locator('#home-boards-switcher').isVisible(),width<=820);
   assert.deepEqual(await page.locator('.nav-tab').evaluateAll(tabs=>tabs.map(tab=>tab.dataset.page)),['home','lists','collection','cemetery']);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>navigationPage),'lists');
   assert.equal(await page.evaluate(()=>navigationBoard),'arrivals');
   await page.goBack();await page.waitForFunction(()=>navigationPage==='home');
   await page.locator('#home-add-game').click();await page.locator('#cancel-btn').click();
   await page.screenshot({path:'/tmp/jtd-home-'+width+'-'+theme+'.png',fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.evaluate(()=>{GAMES=[];renderHomeStats();});
   assert.match(await page.locator('#home-recent').textContent(),/Ta collection est vide/);
   assert.equal(await page.locator('#home-total-games').textContent(),'0');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS home/navigation',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
