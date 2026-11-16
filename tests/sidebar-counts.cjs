const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
async function counts(page){return page.locator('#platform-list .plat-item').evaluateAll(items=>Object.fromEntries(items.map(el=>[el.querySelector('.plat-name').textContent,Number(el.querySelector('.plat-count').textContent)])));}
async function drawer(page){if(await page.locator('#global-filter-toggle').isVisible() && !await page.locator('#collection-sidebar').evaluate(el=>el.classList.contains('mobile-open')))await page.locator('#global-filter-toggle').click();}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [320,390,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:800},colorScheme:theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>{
   applyRestoredData(JTDData.normalizeData({games:[
    {id:'s',nom:'Jardin fictif',plateforme:'Switch 2',format:'Physique',collector:true,status:'termine'},
    {id:'p',nom:'Voyage fictif',plateforme:'PlayStation 5',format:'Physique',japanese:true,status:'a_jouer'},
    {id:'d',nom:'Jeu numérique fictif',plateforme:'Switch 2',format:'Numérique',bundle:true,status:'termine'},
    {id:'dlc',nom:'Extension fictive',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'d',status:'abandonne'}
   ]}));applyNavigation({page:'collection',media:'physical'});
  });
  assert.deepEqual(await counts(page),{Toutes:2,'Switch 2':1,'PlayStation 5':1});
  await drawer(page);await page.locator('#status-toggles').getByRole('button',{name:'Terminé',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1},'Status immediately removes excluded platforms');
  await page.locator('#status-toggles').getByRole('button',{name:'Terminé',exact:true}).click();
  await page.locator('#format-toggles').getByRole('button',{name:/Collector/}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1},'Edition immediately refreshes counts');
  await page.locator('#format-toggles').getByRole('button',{name:/Collector/}).press('Enter');
  assert.deepEqual(await counts(page),{Toutes:2,'Switch 2':1,'PlayStation 5':1});
  await page.locator('#format-toggles').getByRole('button',{name:'Japonais',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'PlayStation 5':1});
  await page.locator('#format-toggles').getByRole('button',{name:'Japonais',exact:true}).click();
  await page.keyboard.press('Escape');await page.locator('#search-input').fill('Jardin');
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1},'Search immediately updates platform counts');
  await page.locator('#search-input').fill('introuvable');assert.deepEqual(await counts(page),{Toutes:0});
  await page.locator('#search-input').fill('');
  await drawer(page);await page.locator('#platform-list .plat-item').filter({hasText:'PlayStation 5'}).click();
  await drawer(page);await page.locator('#status-toggles').getByRole('button',{name:'Terminé',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1,'PlayStation 5':0});
  assert.equal(await page.evaluate(()=>state.platform),'PlayStation 5','An empty selected platform stays selected');
  await page.evaluate(()=>applyNavigation({page:'collection',media:'digital'}));
  assert.deepEqual(await counts(page),{Toutes:2,'Switch 2':2},'Grouped DLC counts as a purchase');
  await drawer(page);await page.locator('#content-type-options').getByRole('button',{name:'DLC',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1});
  await page.locator('#content-type-options').getByRole('button',{name:'DLC',exact:true}).click();
  await page.locator('#format-toggles').getByRole('button',{name:'Bundle',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1});
  await page.keyboard.press('Escape');await page.evaluate(()=>applyNavigation({page:'collection',media:'physical',status:'termine'}));
  await page.locator('[data-dialog-trigger="game:s"] .card-status-badge').click();
  await page.locator('[data-dialog-trigger="game:s"]').getByRole('button',{name:'Abandonné',exact:true}).click();
  assert.deepEqual(await counts(page),{Toutes:0},'Changing a game status also refreshes the sidebar');
  await page.locator('#toast-stack .toast-action').click();assert.deepEqual(await counts(page),{Toutes:1,'Switch 2':1});
  assert.deepEqual(errors,[]);await context.close();console.log('PASS sidebar counts',width,theme);
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
