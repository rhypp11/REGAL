const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:'+server.address().port);
   await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{
    GAMES=[
     {id:'physical',nom:'Étoile physique',plateforme:'Switch 2',format:'Physique'},
     {id:'base',nom:'Échos numériques',plateforme:'PlayStation 5',format:'Numérique',contentType:'game'},
     {id:'dlc',nom:'À l’horizon — Extension',plateforme:'PlayStation 5',format:'Numérique',contentType:'dlc',parentId:'base'}
    ];
    ARRIVALS=[{id:'arrival',nom:'Étoile arrivage',plateforme:'Switch 2'}];
    WISHLIST=[{id:'wish',nom:'Étoile souhaitée',plateforme:'Switch 2',date:'2030-02'}];
    CEMETERY=[{id:'pending',nom:'Étoile à vendre',plateforme:'Switch 2',saleStatus:'pending'},{id:'sold',nom:'Étoile vendue',plateforme:'PC',saleStatus:'sold',saleId:'one',salePrice:5}];
    LEGACY_JOURNAL=[{regalJournal:2,entries:[
     {id:'physical',group:'completed',name:'Étoile terminée',platform:'PC',date:'2026-03-21',format:'digital',completion:'finished'},
     {id:'playing',group:'playing',name:'Étoile en cours',platform:'PC',format:'digital'},
     {id:'backlog',group:'backlog',name:'Étoile à faire',platform:'Switch 2',format:'physical'},
     {id:'release',group:'release',name:'Étoile sortie',platform:'PC',date:'2030-02'}
    ]}];
    savePreviewData();render();renderCemetery();renderJournal();goToPage('home');
   });
   const search=page.locator('#global-search-input'),results=page.locator('#global-search-results button');
   await page.locator('#global-search-open').click();
   await search.fill('ETOILE');
   assert.equal(await results.count(),9);
   assert.equal(await results.filter({hasText:'Journal · Terminé'}).count(),1);
   assert.match(await results.filter({hasText:'Étoile terminée'}).textContent(),/Numérique.*Journal/);
   assert.doesNotMatch(await results.filter({hasText:'Étoile sortie'}).textContent(),/Physique|Numérique/,'Unknown release format is not invented');
   assert.equal(await results.filter({hasText:'Ventes · Vendu'}).count(),1);
   assert.equal(await results.filter({hasText:'Ventes · À vendre'}).count(),1);
   assert.doesNotMatch(await page.locator('#global-search-results').textContent(),/Cimetière/);
   await search.fill('  étoile  ');assert.equal(await results.count(),9);
   for(const [query,label,editable] of [['terminee','Terminé',false],['en cours','En cours',true],['a faire','À faire',true],['sortie','Sorties',false]]){
    await search.fill(query);
    assert.equal(await results.count(),1);
    assert.match(await results.first().textContent(),new RegExp('Journal · '+label));
    await search.press('Enter');
    assert.equal(await page.locator('#journal-overlay').isVisible(),true);
    assert.equal(await page.locator('#journal-save').isVisible(),editable);
    if(query==='terminee')assert.match(await page.locator('#journal-dialog-body').textContent(),/Étoile terminée/,'Overlapping collection ID opens the Journal entry');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#global-search-overlay').isVisible(),true);
    assert.equal(await search.inputValue(),query);
    assert.equal(await search.evaluate(e=>e===document.activeElement),true);
   }
   await search.fill('aucune-correspondance');assert.equal(await results.count(),0);
   assert.equal(await page.locator('#global-search-status').textContent(),'Aucun jeu trouvé.');
   await search.fill(' ');assert.equal(await page.locator('#global-search-status').textContent(),'');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{goToPage('collection');state.media='physical';state.search='etoile';render()});
   assert.deepEqual(await page.locator('#grid .card').evaluateAll(es=>es.map(e=>e.dataset.dialogTrigger)),['game:physical']);
   await page.evaluate(()=>{state.media='digital';state.search='echos';render()});
   assert.deepEqual(await page.evaluate(()=>filteredGames().map(g=>g.id)),['base']);
   assert.equal(await page.evaluate(()=>collectionPurchases(filteredGames()).length),2,'Parent and DLC remain counted with an accentless parent query');
   await page.evaluate(()=>{state.search='a l’horizon';render()});
   assert.deepEqual(await page.evaluate(()=>filteredGames().map(g=>g.id)),['dlc'],'Accentless DLC query keeps its own card discoverable');
   await page.evaluate(()=>{goToPage('cemetery');document.getElementById('cemetery-search').value='etoile';renderCemetery()});
   assert.match(await page.locator('#cemetery-list').textContent(),/Étoile à vendre/);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   await page.locator('#global-search-open').click();await search.fill('terminee');assert.equal(await results.count(),1,'Journal remains searchable after reload');
   await page.evaluate(()=>{LEGACY_JOURNAL=[{regalJournal:2,entries:[]}];GAMES=[];ARRIVALS=[];WISHLIST=[];CEMETERY=[]});
   await search.fill('etoile');assert.equal(await results.count(),0,'Search reads current session without stale cached entries');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   console.log('PASS consistent search',width,theme);
   await context.close();
  }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
