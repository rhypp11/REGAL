/* Manual entry and explicit transfer actions; fake sandbox data only. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:800},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');
   await page.locator('#app-shell').waitFor({state:'visible'});
   await page.locator('#add-btn').click();
   await page.locator('#modal-overlay').waitFor({state:'visible'});
   assert.equal(await page.locator('#guided-add-overlay').count(),0,'Add opens manual entry directly');
   assert.equal(await page.locator('#f-nom').isVisible(),true);
   assert.equal(await page.locator('#save-btn').innerText(),'Ajouter');
   await page.locator('#save-btn').click();
   assert.equal(await page.locator('#modal-overlay').isVisible(),true,'Empty entry does not save');
   await page.locator('#f-nom').fill('Aventure manuelle fictive');
   await page.locator('#f-plateforme').selectOption({label:'Nintendo Switch'});
   await page.locator('#f-source').fill('Boutique fictive');
   await page.locator('#f-prix').fill('0');
   await page.locator('#f-nom').scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/jtd-manual-entry-${width}-${theme}.png`});
   await page.locator('#save-btn').click();
   const created=await page.evaluate(()=>GAMES.find(g=>g.nom==='Aventure manuelle fictive'));
   assert.equal(created.prix,0);assert.equal(created.source,'Boutique fictive');
   await page.evaluate(id=>openModal(id),created.id);
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   assert.equal(await page.locator('#save-btn').innerText(),'Enregistrer');
   await page.keyboard.press('Escape');
   const before=await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST}));
   await page.evaluate(()=>openWishlistModal(WISHLIST[0].id));
   assert.equal(await page.locator('#w-order-btn').innerText(),'Vers les arrivages');
   await page.locator('#w-order-btn').click();
   assert.equal(await page.locator('#arrival-modal-title').innerText(),'Confirmer la commande');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>openArrivalModal(ARRIVALS[0].id));
   assert.equal(await page.locator('#a-received-btn').innerText(),'Vers la collection');
   await page.locator('#a-received-btn').click();
   assert.equal(await page.locator('#modal-title').innerText(),'Confirmer la réception');
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST})),before,'Opening and cancelling transfers keeps all lists');
   for(const route of ['home','collection','cemetery']){
    await page.locator(`.nav-tab[data-page="${route}"]`).click();
    assert.equal(await page.locator('.nav-tab[aria-current="page"]').getAttribute('data-page'),route);
   }
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(id=>GAMES.some(g=>g.id===id),created.id),true,'Manual add survives reload');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS manual entry and module actions',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
