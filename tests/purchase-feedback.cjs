/* Purchase feedback remains local to the active account and uses sandbox fixtures. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:800},colorScheme:theme});
   const page=await context.newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');
   await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{state.search='Introuvable';state.status='termine';state.collector=true;state.japanese=true;state.bundle=true;render();openModal();});
   await page.locator('#f-nom').fill('Achat fictif à retrouver');
   await page.locator('#save-btn').click();
   const id=await page.evaluate(()=>GAMES.find(game=>game.nom==='Achat fictif à retrouver').id);
   assert.equal(await page.locator('#toast-stack .toast-action').innerText(),'Voir');
   assert.equal(await page.locator('#grid .card').count(),0,'Saving preserves the current filters');
   await page.locator('#toast-stack .toast-action').click();
   assert.equal(await page.locator('#grid .card').count(),1,'Voir reveals the new purchase despite incompatible filters');
   assert.equal(await page.locator('#search-input').inputValue(),'Achat fictif à retrouver');
   assert.equal(await page.locator('#grid .card-open-control').evaluate(el=>el===document.activeElement),true);
   await page.evaluate(id=>setStatus(id,'termine'),id);
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).status,id),'termine');
   await page.locator('#toast-stack .toast-action').click();
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).status,id),null,'Undo restores the exact previous status');
   await page.evaluate(id=>{state.status='__none__';render();setStatus(id,'termine');},id);
   assert.equal(await page.locator('#grid .card').count(),0,'Changed status respects the active filter');
   await page.locator('#toast-stack .toast-action').click();
   assert.equal(await page.locator('#grid .card').count(),1,'Undo restores the filtered card');
   await page.evaluate(()=>{if(!commitCollection([...GAMES,...digitalPreviewGames()],digitalPreviewAccounts()))throw new Error('Fixture non enregistrée');revealCollectionPurchase('test-dlc-digital');});
   assert.equal(await page.locator('#grid .card').count(),1,'Explicit DLC filter shows the child rather than its parent');
   assert.equal(await page.locator('#grid .card').getAttribute('data-dialog-trigger'),'game:test-dlc-digital');
   await page.evaluate(id=>{setStatus(id,'termine');window.JTDAccountGeneration=(window.JTDAccountGeneration||0)+1;},id);
   await page.locator('#toast-stack .toast-action').click();
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).status,id),'termine','Old undo cannot cross an account generation');
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).status,id),'termine','Status persists after reload');
   // Failed persistence must leave memory unchanged and must not offer a successful undo.
   await page.evaluate(id=>{window.persistAppData=()=>{throw new Error('Stockage fictif indisponible');};setStatus(id,'a_jouer');},id);
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).status,id),'termine');
   assert.match(await page.locator('#toast-stack').innerText(),/Enregistrement impossible/);
   assert.equal(await page.locator('#toast-stack .toast-action').count(),0);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS purchase feedback',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
