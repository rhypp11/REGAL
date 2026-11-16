const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [320,390,1440])for(const theme of ['dark','light']){
  const context=await sandboxContext(browser,{viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')remote.push(request.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/prototypes/versions/index.html');
  if(theme==='light')await page.locator('#theme').click();
  assert.equal(await page.locator('#grid .game-card').count(),2);
  await page.locator('#grouped').uncheck();assert.equal(await page.locator('#grid .game-card').count(),4);
  await page.locator('#grouped').check();assert.equal(await page.locator('#grid .game-card').count(),2);
  const personaCard=page.locator('[data-game="persona"]');
  assert.equal(await personaCard.locator('.platform-row').count(),2,'One row per platform, not per copy');
  assert.match(await personaCard.locator('.platform-row').first().innerText(),/Switch.*Physique.*Numérique/);
  assert.match(await personaCard.locator('.platform-row').last().innerText(),/PS4.*Physique/);
  const animalCard=page.locator('[data-game="animal"]');
  assert.equal(await animalCard.locator('.addon-counter[aria-label="1 DLC"]').count(),1);
  assert.equal(await animalCard.locator('.addon-counter[aria-label="1 mise à niveau"]').count(),1);
  assert.doesNotMatch(await animalCard.innerText(),/Happy Home Paradise|Mise à niveau|Switch 2 Edition/,'Linked content names stay inside the sheet');
  for(const card of [personaCard,animalCard]){
   assert.ok(await card.evaluate(el=>{
    const rows=[...el.querySelectorAll('.platform-row')],box=el.getBoundingClientRect(),status=el.querySelector('.card-status-footer').getBoundingClientRect();
    return rows.every(row=>{const r=row.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.bottom<=status.top&&row.scrollWidth<=row.clientWidth+1;});
   }),'Rows stay compact and above the common status');
  }
  await personaCard.locator('[data-card-status]').selectOption('abandonne');
  assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false,'Status changes directly in the collection');
  await page.locator('#grid [data-open="persona"]').click();
  assert.equal(await page.locator('#shared-status').inputValue(),'abandonne');
  await page.locator('#close').click();

  await page.locator('#platforms [data-value="Switch 2"]').click();assert.equal(await page.locator('#grid .game-card').count(),1);
  await page.locator('#grid [data-open="animal"]').click();
  assert.match(await page.locator('#sheet-body').innerText(),/Achat d’origine : Switch/);
  assert.equal(await page.locator('#sheet-body [data-relation="dlc"]').count(),1);
  assert.equal(await page.locator('#sheet-body [data-relation="upgrade"]').count(),1);
  await page.locator('#sheet-body [data-relation="upgrade"]').click();
  assert.match(await page.locator('#sheet-kind').innerText(),/MISE À NIVEAU/);
  await page.locator('#upgrade-linked').uncheck();await page.locator('#close').click();
  assert.equal(await page.locator('#grid .game-card').count(),0,'Unlinking returns the game to Switch without changing its acquisition');
  await page.locator('#platforms [data-value="all"]').click();
  await page.locator('#content [data-value="dlc"]').click();assert.equal(await page.locator('#platforms [data-value="all"] strong').textContent(),'1');await page.locator('#grid [data-open="dlc"]').click();
  assert.equal(await page.locator('#sheet-kind').innerText(),'DLC');
  assert.match(await page.locator('#sheet-body [data-relation="animal"]').innerText(),/Jeu de base/);
  await page.screenshot({path:`/tmp/jtd-versions-dlc-${width}-${theme}.png`});
  await page.locator('#sheet-body [data-relation="animal"]').click();assert.match(await page.locator('#sheet-body').innerText(),/20\/03\/2020/);
  await page.locator('#close').click();await page.locator('#content [data-value="upgrade"]').click();
  await page.locator('#grid [data-open="upgrade"]').click();await page.locator('#upgrade-linked').check();
  await page.locator('#sheet-body [data-relation="animal"]').click();
  assert.equal(await page.locator('#sheet-body .edition-label').innerText(),'↑ Switch 2 Edition');
  await page.screenshot({path:`/tmp/jtd-versions-sheet-${width}-${theme}.png`});
  await page.locator('#close').click();await page.locator('#content [data-value="games"]').click();
  await page.screenshot({path:`/tmp/jtd-versions-collection-${width}-${theme}.png`});
  await page.locator('#add').click();await page.locator('#add-title').fill('Persona 5 Royal');assert.equal(await page.locator('#match').isVisible(),true);
  await page.locator('#add-platform').selectOption('Switch 2');await page.locator('#add-media').selectOption('digital');await page.locator('#add-price').fill('19.99');
  await page.locator('#add-form button[type=submit]').click();
  assert.equal(await page.locator('#sheet-body .copy').count(),4);
  await page.locator('#shared-status').selectOption('abandonne');await page.locator('#close').click();
  assert.equal(await page.locator('#grid .game-card').count(),2);assert.equal(await page.locator('#grid [data-game="persona"] [data-card-status]').inputValue(),'abandonne');
  await page.locator('#media [data-value="digital"]').click();assert.equal(await page.locator('#grid .game-card').count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.locator('#grid .game-card').count(),2);
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);await context.close();console.log('PASS versions prototype',width,theme);
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
