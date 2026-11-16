const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [320,390,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:800},colorScheme:theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>{
   applyRestoredData(JTDData.normalizeData({games:[
    {id:'box',nom:'Aventure fictive',plateforme:'Switch 2',format:'Physique'},
    {id:'digital',nom:'Voyage fictif',plateforme:'Switch 2',format:'Numérique',status:'a_jouer'},
    {id:'dlc',nom:'Extension fictive',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',status:'abandonne'}
   ]}));applyNavigation({page:'collection',media:'all'});
  });
  const card=page.locator('[data-dialog-trigger="game:box"]');
  await card.locator('.card-status-badge').click();await card.getByRole('button',{name:'Abandonné',exact:true}).click();
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').status),'abandonne');
  assert.match(await card.locator('.card-status-badge').innerText(),/Abandonné/);
  assert.equal(await card.locator('.card-state-row .card-status-control').count(),1);
  assert.equal(await card.locator('.card-state-row .card-media-mark').count(),1);
  const alignment=await card.evaluate(el=>{
   const status=el.querySelector('.card-status-control').getBoundingClientRect(),media=el.querySelector('.card-media-mark').getBoundingClientRect();
   return Math.abs((status.top+status.bottom)/2-(media.top+media.bottom)/2);
  });assert.ok(alignment<2,'Support and status share the same line when space allows');
  await page.screenshot({path:`/tmp/jtd-abandoned-${width}-${theme}.png`});
  await page.locator('#toast-stack .toast-action').click();assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').status),null);
  await card.locator('.card-status-badge').click();await card.getByRole('button',{name:'Abandonné',exact:true}).click();
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').status),'abandonne');
  await page.evaluate(()=>applyNavigation({page:'collection',media:'all',status:'abandonne'}));
  assert.equal(await page.locator('#grid .card').count(),2);
  await page.locator('.collection-stat-toggle').click();assert.equal(await page.locator('[data-stat="abandonne"] strong').innerText(),'2');
  assert.equal(await page.locator('[data-stat="a_jouer"] strong').innerText(),'0');
  await page.evaluate(()=>openModal('dlc'));
  assert.match(await page.locator('#f-identity-summary .game-sheet-status').innerText(),/Abandonné/);
  assert.equal(await page.locator('#f-content-status').inputValue(),'abandonne');await page.locator('#cancel-btn').click();
  await page.evaluate(()=>goToPage('home'));
  const physical=page.locator('[data-home-progress="physical"]');
  assert.match(await physical.locator('.completion-dot.abandoned').locator('..').innerText(),/Abandonnés1/);
  assert.match(await physical.locator('.completion-dot.todo').locator('..').innerText(),/À faire0/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS abandoned status',width,theme);
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
