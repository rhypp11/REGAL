/* Explicitly enabled sandbox POC; no catalog API and no production connection. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  // Existing local regression contexts retain the regular Add interaction.
  const normal=await sandboxContext(browser,{viewport:{width:390,height:900}});
  const regular=await normal.newPage();await regular.goto('http://127.0.0.1:'+server.address().port);
  await regular.locator('#app-shell').waitFor({state:'visible'});
  assert.equal(await regular.evaluate(()=>typeof window.JTDAddDemo),'undefined');
  await normal.close();
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme,reducedMotion:theme==='dark'?'reduce':'no-preference'});
   await context.addInitScript(()=>{window.JTD_ENABLE_ADD_DEMO=true;});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.locator('[data-page="collection"]').click();
   const before=await page.evaluate(()=>JSON.stringify(GAMES));
   await page.locator('#add-btn').click();
   await page.locator('#guided-add-overlay').waitFor({state:'visible'});
   assert.equal(await page.locator('.guided-game-choice').count(),3);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'guided-add-search');
   await page.locator('.guided-choice-art img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
   assert.equal(await page.locator('.guided-add-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Catalog fits the viewport');
   await page.screenshot({path:`/tmp/jtd-guided-catalog-${width}-${theme}.png`});
   await page.locator('#guided-add-search').fill('introuvable');
   assert.equal(await page.locator('.guided-game-choice').count(),0);assert.equal(await page.locator('#guided-add-empty').isVisible(),true);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(GAMES)),before,'Closing search leaves collection unchanged');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'add-btn');
   await page.locator('#add-btn').click();await page.locator('#guided-add-manual').click();
   assert.equal(await page.locator('#modal-overlay').isVisible(),true);
   assert.equal(await page.locator('#f-nom').inputValue(),'');await page.locator('#cancel-btn').click();
   await page.locator('#add-btn').click();await page.locator('#guided-add-search').fill('Aster');
   assert.equal(await page.locator('.guided-game-choice').count(),1);
   await page.locator('.guided-game-choice').click();
   assert.equal(await page.locator('#modal-title').innerText(),'Ton nouvel exemplaire');
   assert.equal(await page.locator('#guided-add-overlay').isVisible(),false);
   await page.locator('#f-identity-summary .game-art-image').evaluate(img=>img.decode());
   assert.equal(await page.locator('#f-identity-editor').isVisible(),false,'Identity starts as a game heading');
   await page.locator('#guided-platforms [data-platform="PlayStation 5"]').click();
   assert.equal(await page.locator('#f-plateforme').inputValue(),'PlayStation 5');
   assert.ok((await page.locator('#f-identity-summary').innerText()).includes('PlayStation 5'));
   assert.match(await page.locator('#f-date').inputValue(),/^\d{4}-\d{2}-\d{2}$/);
   await page.locator('#f-prix').fill('0');await page.locator('#f-source').fill('Boutique fictive');
   await page.locator('#save-btn').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#modal-overlay .modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Guided form fits the viewport');
   await page.screenshot({path:`/tmp/jtd-guided-form-${width}-${theme}.png`});
   await page.locator('#save-btn').click();
   await page.locator('#modal-overlay').waitFor({state:'hidden'});
   await page.locator('.guided-card-arrival').waitFor({state:'visible'});
   const added=await page.evaluate(()=>GAMES.find(game=>game.nom==='Aster — Les Jardins suspendus'));
   assert.equal(added.plateforme,'PlayStation 5');assert.equal(added.prix,0);assert.equal(added.source,'Boutique fictive');assert.equal(added.format,'Physique');
   assert.equal(await page.evaluate(()=>GAMES.length),JSON.parse(before).length+1);
   if(theme==='dark')assert.equal(await page.locator('.guided-card-arrival').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion disables the reveal');
   await page.screenshot({path:`/tmp/jtd-guided-arrival-${width}-${theme}.png`});
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(id=>GAMES.some(game=>game.id===id),added.id),true,'Added demo game survives reload');
   await page.locator('#add-btn').click();await page.locator('[data-game="brume"]').click();await page.locator('#cancel-btn').click();
   assert.equal(await page.evaluate(()=>GAMES.length),JSON.parse(before).length+1,'Canceling the guided purchase does not add a game');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS guided addition',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
