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
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('#app-shell').waitFor({state:'visible'});
  await page.locator('#profile-menu-btn').click();
  assert.match(await page.locator('#backup-note').innerText(),/Aucune sauvegarde complète/);
  const download=page.waitForEvent('download');await page.locator('#backup-btn').click();await download;
  assert.match(await page.locator('#backup-note').textContent(),/Dernière sur cet appareil/);
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
  await page.locator('#profile-menu-btn').click();
  assert.match(await page.locator('#backup-note').innerText(),/Dernière sur cet appareil/);
  const before=await page.evaluate(()=>JSON.stringify(buildBackupPayload().data));
  const restore=()=>page.locator('#restore-input').setInputFiles({name:'sauvegarde-fictive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'Jeux Tout Doux',version:5,data:{games:[]}}))});
  await restore();await page.locator('#confirm-modal-overlay').waitFor({state:'visible'});
  assert.match(await page.locator('#confirm-modal-message').innerText(),/Données actuelles → Après restauration/);
  assert.match(await page.locator('#confirm-modal-message').innerText(),/Jeux : \d+ → 0/);
  assert.match(await page.locator('#confirm-modal-message').innerText(),/Comptes numériques : \d+ → 0/);
  await page.locator('#confirm-modal-confirm-btn').scrollIntoViewIfNeeded();
  const bounds=await page.locator('#confirm-modal-confirm-btn').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=801);
  await page.screenshot({path:`/tmp/jtd-backup-preview-${width}-${theme}.png`});
  await page.locator('#confirm-modal-cancel-btn').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(buildBackupPayload().data)),before);
  await page.locator('#profile-menu-btn').click();await restore();
  await page.locator('#confirm-modal-confirm-btn').click();
  assert.equal(await page.evaluate(()=>GAMES.length),0);
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>GAMES.length),0);
  // Check the wider readable status with the actual header layout in every viewport.
  await page.evaluate(()=>{const el=document.getElementById('cloud-sync-status');el.className='cloud-sync-status syncing';el.textContent='Synchronisation…';});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS backup preview',width,theme);
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
