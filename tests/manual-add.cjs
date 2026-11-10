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
   await page.locator('#f-identity-editor .icon-select-trigger').click();
   await page.locator('#f-identity-editor .icon-select-option').filter({hasText:/^Switch 2$/}).click();
   await page.locator('#f-source').fill('Boutique fictive');
   await page.locator('#f-prix').fill('0');
   await page.locator('#f-nom').scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/jtd-manual-entry-${width}-${theme}.png`});
   await page.locator('#save-btn').click();
   const created=await page.evaluate(()=>GAMES.find(g=>g.nom==='Aventure manuelle fictive'));
   assert.equal(created.prix,0);assert.equal(created.source,'Boutique fictive');
   await page.evaluate(id=>{GAMES.find(game=>game.id===id).date='2023-06';openModal(id);},created.id);
   assert.equal(await page.locator('#f-partial-date').inputValue(),'2023-06');
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   await page.locator('#f-nom').fill('Aventure fictive renommée');
   await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(id=>GAMES.find(game=>game.id===id).date,created.id),'2023-06');
   await page.evaluate(id=>openModal(id),created.id);
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   assert.equal(await page.locator('#save-btn').innerText(),'Enregistrer');
   await page.keyboard.press('Escape');
   const before=await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST}));
   await page.evaluate(()=>openWishlistModal(WISHLIST[0].id));
   assert.equal(await page.locator('#w-order-btn').innerText(),'Commander');
   await page.locator('#w-order-btn').click();
   assert.equal(await page.locator('#arrival-modal-title').innerText(),'Confirmer la commande');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>openArrivalModal(ARRIVALS[0].id));
   assert.equal(await page.locator('#a-received-btn').innerText(),'Réceptionner');
   await page.locator('#a-received-btn').click();
   assert.equal(await page.locator('#modal-title').innerText(),'Confirmer la réception');
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST})),before,'Opening and cancelling transfers keeps all lists');
   for(const route of ['home','collection','cemetery']){
    await page.locator(`#collection-views [data-page="${route}"]`).click();
    assert.equal(await page.locator('#collection-views [aria-current="page"]').getAttribute('data-page'),route);
   }
   await page.evaluate(()=>openPlatformModal());
   const platformRow=page.locator('.platform-row[data-current-name="Switch 2"]');
   await platformRow.locator('.platform-edit-btn').click();
   const originalColor=await platformRow.locator('[data-role="color"]').inputValue();
   await platformRow.locator('[data-role="color"]').evaluate(el=>{el.value='#43897c';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await platformRow.locator('.platform-save-btn').scrollIntoViewIfNeeded();
   const platformSave=await platformRow.locator('.platform-save-btn').boundingBox();
   assert.ok(platformSave.y>=0&&platformSave.y+platformSave.height<=801,'Platform save is visible in the viewport');
   assert.equal(await page.locator('#platform-modal-overlay .platform-modal-actions').evaluate(el=>getComputedStyle(el).position),'static','Close actions do not cover the platform editor');
   assert.equal(await page.locator('#platform-modal-overlay .platform-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Platform editor fits the dialog');
   await page.screenshot({path:`/tmp/jtd-platform-editor-${width}-${theme}.png`});
   await platformRow.locator('.platform-cancel-btn').click();
   await platformRow.locator('.platform-edit-btn').click();
   assert.equal(await platformRow.locator('[data-role="color"]').inputValue(),originalColor,'Cancel discards the live preview');
   await page.locator('#close-platform-modal-btn').click();
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(id=>GAMES.some(g=>g.id===id),created.id),true,'Manual add survives reload');
   await checkJournalSources(page);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS manual entry and module actions',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

async function checkJournalSources(page){
 await page.evaluate(()=>{
  GAMES.push(...['Physique','Numérique','Extension'].map((format,index)=>({id:'source-'+index,nom:'Source fictive',plateforme:'Switch 2',format:index?'Numérique':'Physique',contentType:index===2?'dlc':'game'})));
  WISHLIST.push({id:'wish-source',nom:'Sortie fictive',plateforme:'Switch 2',date:'2028-04-12',image:'',imageFit:'cover'});
 });
 await page.locator('.nav-tab[data-page="journal"]').click();
 for(const group of ['playing','backlog','completed']){
  await page.locator(`[data-journal-add="${group}"]`).evaluate(el=>el.click());
  await page.locator('[name="origin"][value="collection"]').check();
  await page.locator('[name="lookup"]').fill('Source fictive');
  const results=page.locator('#journal-source-results');
  assert.match(await results.innerText(),/Physique/);
  assert.match(await results.innerText(),/Numérique/);
  assert.match(await results.innerText(),/Extension/);
  assert.equal(await results.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  if(group==='backlog') await page.screenshot({path:`/tmp/jtd-journal-sources-${page.viewportSize().width}-${await page.evaluate(()=>document.documentElement.dataset.theme||'theme')}.png`});
  await results.locator('[data-journal-source="source-1"]').click();
  assert.match(await page.locator('#journal-game-summary').innerText(),/Numérique/);
  await page.locator('#journal-close').click();
  await page.locator('#confirm-modal-cancel-btn').click();
  assert.equal(await page.locator('#journal-form [name="name"]').inputValue(),'Source fictive');
  await page.keyboard.press('Escape');
  await page.locator('#confirm-modal-confirm-btn').click();
 }
 await page.locator('[data-journal-add="completed"]').evaluate(el=>el.click());
 await page.locator('#journal-form [name="name"]').fill('Complétion à l’année');
 await page.locator('#journal-platform').selectOption('Switch 2');
 await page.locator('#journal-form [name="estimated"]').selectOption('year');
 assert.equal(await page.locator('#journal-form [name="date"]').isVisible(),false);
 await page.locator('#journal-form [name="completionYear"]').fill('2012');
 await page.locator('#journal-save').click();
 assert.equal(await page.locator('#journal-year').inputValue(),'2012');
 await page.locator('.journal-row').filter({hasText:'Complétion à l’année'}).click();
 assert.match(await page.locator('#journal-dialog-body').innerText(),/≈ 2012/);
 await page.locator('#journal-edit-completion').click();
 assert.equal(await page.locator('#journal-form [name="completionYear"]').inputValue(),'2012');
 await page.locator('#journal-save').click();
 await page.locator('#journal-close').click();
 await page.locator('[data-journal-add="release"]').evaluate(el=>el.click());
 assert.match(await page.locator('#journal-form .journal-source-choice').innerText(),/Depuis la wishlist/);
 assert.equal(await page.locator('select[name="format"]').count(),0);
 await page.locator('[name="origin"][value="collection"]').check();
 await page.locator('[name="lookup"]').fill('Sortie fictive');
 await page.locator('[data-journal-source="wish-source"]').click();
 assert.equal(await page.locator('#journal-release-date').inputValue(),'2028-04-12');
 assert.doesNotMatch(await page.locator('#journal-game-summary').innerText(),/Physique|Numérique/);
 await page.locator('#journal-save').click();
 const original=await page.evaluate(()=>({wishlist:JSON.stringify(WISHLIST),release:getJournalReleases().find(item=>item.nom==='Sortie fictive')}));
 assert.equal(original.release.date,'2028-04-12');
 assert.equal(await page.evaluate(()=>JSON.stringify(WISHLIST)),original.wishlist,'Recovery leaves the source wishlist intact');
 await page.evaluate(()=>openWishlistModal(null));
 await page.locator('[name="w-origin"][value="release"]').check();
 await page.locator('#w-release-search').fill('Sortie fictive');
 await page.locator('[data-w-release]').click();
 assert.equal(await page.locator('#w-nom').inputValue(),'Sortie fictive');
 assert.equal(await page.locator('#w-date').inputValue(),'2028-04-12');
 await page.screenshot({path:`/tmp/jtd-wishlist-source-${page.viewportSize().width}.png`});
 await page.locator('#w-save-btn').click();
 assert.equal(await page.evaluate(()=>WISHLIST.filter(item=>item.nom==='Sortie fictive').length),2);
 assert.equal(await page.evaluate(()=>getJournalReleases().filter(item=>item.nom==='Sortie fictive').length),1);
 await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>getJournalReleases().find(item=>item.nom==='Sortie fictive').date),'2028-04-12');
}

