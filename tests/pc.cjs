const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
 {id:'console',nom:'Console fictive',plateforme:'Switch 2',format:'Physique',prix:40},
 {id:'box',nom:'Collector PC fictif',plateforme:'PC',format:'Physique',launcher:'Steam',collector:true,prix:80},
 {id:'old',nom:'Ancienne boîte PC',plateforme:'PC',format:'Physique',prix:10},
 {id:'steam',nom:'Jardin PC',plateforme:'PC',format:'Numérique',launcher:'Steam',prix:20},
 {id:'gog',nom:'Jardin GOG',plateforme:'PC',format:'Numérique',launcher:'GOG',prix:15},
 {id:'dlc',nom:'Extension PC',plateforme:'PC',format:'Numérique',launcher:'GOG',contentType:'dlc',parentId:'steam',prix:5}
],arrivals:[{id:'arrival',nom:'Boîte à recevoir',plateforme:'PC',launcher:'GOG',collector:true,prix:50}]};
async function drawer(page){if(await page.evaluate(()=>matchMedia('(max-width:820px)').matches&&!document.getElementById('collection-sidebar').classList.contains('mobile-open')))await page.locator('#global-filter-toggle').click();}
async function ids(page){return page.locator('#grid .card').evaluateAll(cards=>cards.map(c=>c.dataset.dialogTrigger).sort());}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[],cloud=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(/firestore|identitytoolkit|securetoken/.test(r.url()))cloud.push(r.url());});
   await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>window.JTD_PREVIEW_MODE),true);
   await page.evaluate(()=>{applyRestoredData(JTDData.normalizeData({games:[{id:'only-console',nom:'Console',plateforme:'Switch 2'}]}));applyNavigation({page:'collection',library:'pc',platform:'Switch 2'});});
   assert.match(await page.locator('.empty-state').innerText(),/Ta collection PC est vide/);
   assert.equal(await page.evaluate(()=>state.platform),null);
   await page.evaluate(data=>{applyRestoredData(JTDData.normalizeData(data));applyNavigation({page:'collection'});},fixture);
   assert.deepEqual(await ids(page),['game:console']);
   await page.locator('[data-library="pc"]').click();
   assert.deepEqual(await ids(page),['game:box','game:gog','game:old','game:steam']);
   assert.equal(await page.locator('#collection-account-field').isVisible(),false);
   await page.locator('.collection-stat-details > summary').click();
   assert.equal(await page.locator('[data-stat="games"] strong').innerText(),'5');
   assert.match(await page.locator('[data-stat="spent"]').innerText(),/130/);
   await drawer(page);await page.locator('[data-launcher="GOG"]').click();
   assert.deepEqual(await ids(page),['game:dlc','game:gog'],'DLC remains visible when its parent uses another launcher');
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>state.library),'pc');assert.equal(await page.evaluate(()=>state.launcher),'GOG');
   assert.deepEqual(await ids(page),['game:dlc','game:gog']);
   await drawer(page);await page.locator('[data-launcher="__none__"]').click();
   assert.deepEqual(await ids(page),['game:old']);
   await drawer(page);await page.locator('#reset-btn').click();if(width<=820)await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>state.library),'pc');
   for(const view of ['cards','gallery','list']){
    await page.locator('#collection-view-switch [data-view="'+view+'"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   }
   await page.locator('#collection-view-switch [data-view="cards"]').click();
   await page.locator('[data-dialog-trigger="game:box"] .card-name').click();
   assert.match(await page.locator('#f-context-summary').innerText(),/Steam/);
   await page.locator('#f-context-summary .context-edit-btn').click();
   assert.equal(await page.locator('#f-launcher').inputValue(),'Steam');
   await page.locator('#f-launcher').fill('Mon launcher');await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').collector),true);
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').format),'Physique');
   await drawer(page);await page.locator('[data-launcher="Mon launcher"]').click();
   await page.locator('#add-btn').click();assert.equal(await page.locator('#f-plateforme').inputValue(),'PC');
   assert.equal(await page.locator('#f-launcher').inputValue(),'Mon launcher');
   await page.locator('#f-nom').fill('Nouvel achat PC');await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.nom==='Nouvel achat PC').launcher),'Mon launcher');
   await page.evaluate(()=>{addArrivalToCollection('arrival');saveModal();});
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='arrival').launcher),'GOG');
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='arrival').collector),true);
   await page.evaluate(()=>applyNavigation({page:'collection',library:'pc',media:'all'}));
   await page.evaluate(()=>{closeMobileDrawers();window.scrollTo(0,0);});await page.waitForTimeout(300);
   await page.screenshot({path:path.resolve(__dirname,'..','pc-'+width+'-'+theme+'.png'),fullPage:true});
   assert.deepEqual(errors,[]);assert.deepEqual(cloud,[]);
   await context.close();console.log('PASS PC',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
