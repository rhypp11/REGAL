const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
 {id:'console',nom:'Jeu console fictif',plateforme:'Switch 2',format:'Physique',prix:40},
 {id:'box',nom:'Collector fictif',plateforme:'PC',format:'Physique',launcher:'Steam',collector:true,prix:80},
 {id:'old',nom:'Ancienne boîte',plateforme:'PC',format:'Physique',prix:10},
 {id:'steam',nom:'Jardin des étoiles',plateforme:'PC',format:'Numérique',launcher:'Steam',prix:20},
 {id:'gog',nom:'Les Gardiens du phare',plateforme:'PC',format:'Numérique',launcher:'GOG',prix:15},
 {id:'dlc',nom:'Extension du jardin',plateforme:'PC',format:'Numérique',launcher:'GOG',contentType:'dlc',parentId:'steam',prix:5}
],platformMeta:{'__pc_launcher__:Steam':{color:'#195e70'},'__pc_launcher__:GOG':{color:'#665590'}},platformOrder:['__pc_launcher__:Steam','__pc_launcher__:GOG']};
async function drawer(page){if(await page.evaluate(()=>matchMedia('(max-width:820px)').matches&&!document.getElementById('collection-sidebar').classList.contains('mobile-open')))await page.locator('#global-filter-toggle').click();}
async function ids(page){return page.locator('#grid .card').evaluateAll(cards=>cards.map(c=>c.dataset.dialogTrigger).sort());}
async function manage(page){await drawer(page);await page.locator('#manage-platforms-btn').click();assert.equal(await page.locator('#platform-modal-title').innerText(),'Launchers');}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[],cloud=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/firestore|identitytoolkit|securetoken/.test(r.url()))cloud.push(r.url());});
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>window.JTD_PREVIEW_MODE),true);
   await page.evaluate(()=>{applyRestoredData(JTDData.normalizeData({games:[]}));chooseCollectionLibrary('pc');goToPage('collection');});
   await manage(page);assert.equal(await page.locator('#platform-rows .platform-row').count(),0);await page.locator('#close-platform-modal-btn').click();
   await page.evaluate(data=>{data.games.forEach(g=>g.image=new URL('preview-assets/garden.svg',location.href).href);applyRestoredData(JTDData.normalizeData(data));applyNavigation({page:'collection'});},fixture);
   assert.deepEqual(await ids(page),['game:console']);await page.locator('.nav-tab[data-page="pc"]').click();
   await page.goBack();await page.waitForFunction(()=>state.library==='consoles');assert.deepEqual(await ids(page),['game:console']);
   await page.goForward();await page.waitForFunction(()=>state.library==='pc');
   assert.equal(await page.locator('#collection-library-tabs').count(),0);assert.equal(await page.locator('.nav-tab[data-page="pc"]').getAttribute('aria-current'),'page');
   assert.deepEqual(await ids(page),['game:box','game:gog','game:old','game:steam']);
   assert.equal(await page.locator('.collection-media-controls').isVisible(),false);assert.equal(await page.locator('#collection-account-field').isVisible(),false);
   assert.deepEqual(await page.locator('#content-type-options button').evaluateAll(b=>b.map(e=>e.dataset.contentType)),['game','dlc']);
   assert.equal(await page.locator('#format-toggles .japanese-flag').count(),0);assert.equal(await page.locator('#grid .card-platform').evaluateAll(els=>els.some(e=>/\bPC\b/.test(e.textContent))),false);
   await drawer(page);await page.locator('[data-pc-edition="pcPhysical"]').click();if(width<=820)await page.keyboard.press('Escape');assert.deepEqual(await ids(page),['game:box','game:old']);
   await drawer(page);await page.locator('#reset-btn').click();if(width<=820)await page.keyboard.press('Escape');
   await drawer(page);await page.locator('[data-launcher="GOG"]').click();assert.deepEqual(await ids(page),['game:dlc','game:gog']);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>state.library),'pc');assert.equal(await page.evaluate(()=>state.launcher),'GOG');
   await drawer(page);await page.locator('#reset-btn').click();if(width<=820)await page.keyboard.press('Escape');
   await manage(page);await page.locator('#new-platform-toggle').click();await page.locator('#new-platform-name').fill('Mon launcher');await page.locator('#add-platform-btn').click();
   const row=page.locator('[data-launcher-name="Mon launcher"]');await row.locator('.platform-edit-btn').click();
   const logo='http://127.0.0.1:'+server.address().port+'/preview-assets/pc.svg';await row.locator('[data-role="logo"]').fill(logo);await row.locator('[data-role="color"]').fill('#246678');await row.locator('.platform-save-btn').click();
   await page.locator('[data-launcher-name="Mon launcher"] [data-move="-1"]').click();await page.locator('[data-launcher-name="Mon launcher"] [data-move="-1"]').click();
   assert.equal(await page.locator('#platform-rows .platform-row').first().getAttribute('data-launcher-name'),'Mon launcher');assert.equal(await page.locator('#platform-modal-overlay .modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   await page.locator('#close-platform-modal-btn').click();await page.locator('#add-btn').click();await page.locator('#f-nom').fill('Nouvel achat');await page.locator('#f-launcher').selectOption('Mon launcher');await page.locator('#f-collector').check();
   assert.equal(await page.locator('#f-pc-physical').isChecked(),true);assert.equal(await page.locator('#f-japanese').isVisible(),false);assert.equal(await page.locator('#f-media-field').isVisible(),false);
   assert.deepEqual(await page.locator('#f-content-type').evaluate(el=>[...el.options].filter(o=>!o.hidden&&!o.disabled).map(o=>o.value)),['game','dlc']);await page.locator('#save-btn').click();
   assert.deepEqual(await page.evaluate(()=>{const g=GAMES.find(g=>g.nom==='Nouvel achat');return [g.format,g.collector,g.pcPhysical,g.launcher];}),['Numérique',true,true,'Mon launcher']);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>orderedLauncherNames()[0]),'Mon launcher');assert.equal(await page.evaluate(()=>allPlatformNames().some(isLauncherMetaKey)),false);
   await manage(page);const renamed=page.locator('[data-launcher-name="Mon launcher"]');await renamed.locator('.platform-edit-btn').click();await renamed.locator('[data-role="name"]').fill('Ma bibliothèque');await renamed.locator('.platform-save-btn').click();
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.nom==='Nouvel achat').launcher),'Ma bibliothèque');await page.locator('#close-platform-modal-btn').click();
   assert.equal(await page.evaluate(()=>JTDData.parseBackup(buildBackupPayload()).platformMeta[launcherKey('Ma bibliothèque')].logo),logo);assert.equal(await page.evaluate(()=>JTDData.parseBackup(buildBackupPayload()).games.find(g=>g.nom==='Nouvel achat').pcPhysical),true);
   await drawer(page);assert.equal(await page.locator('#platform-list [data-launcher="Ma bibliothèque"] .mini-logo').getAttribute('src'),logo);await page.keyboard.press('Escape');
   for(const view of ['cards','gallery','list']){await page.locator('#collection-view-switch [data-view="'+view+'"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
   await page.locator('#collection-view-switch [data-view="cards"]').click();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);await page.screenshot({path:path.resolve(__dirname,'..','pc-'+width+'-'+theme+'.png'),fullPage:true});
   await page.locator('.nav-tab[data-page="collection"]').click();assert.deepEqual(await ids(page),['game:console']);assert.equal(await page.locator('#format-toggles .japanese-flag').count(),1);
   assert.deepEqual(errors,[]);assert.deepEqual(cloud,[]);await context.close();console.log('PASS PC library and managed launchers',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
