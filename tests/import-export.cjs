/* Fictional data only; sandboxContext blocks every external request. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
 {id:'copy-a',nom:'Chroniques du Vent',plateforme:'Nintendo Switch',prix:20,source:'A'},
 {id:'copy-b',nom:'Chroniques du Vent',plateforme:'NSW',prix:30,source:'B',collector:true}
],cemetery:[{id:'sold',nom:'Aventure passée',plateforme:'PS5',saleStatus:'sold',salePrice:10}],journal:[
 {id:'history',nom:'Chroniques du Vent',plateforme:'Nintendo Switch',collectionId:'copy-a',status:'done',finishedAt:'2026-01-02',medium:'physical',review:'Avis fictif'},
 {id:'sold-history',nom:'Aventure passée',plateforme:'PS5',collectionId:'sold',status:'done',finishedAt:'2025-01-02',review:'Histoire conservée'}
]};
async function importFile(page,data){
 await page.locator('#cemetery-import-input').setInputFiles({name:'ventes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'Jeux Tout Doux',version:4,data:{cemetery:data}}))});
 await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{for(const width of [320,390,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
  const page=await context.newPage(),errors=[],cloud=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/firestore|firebasejs|identitytoolkit|securetoken/.test(r.url()))cloud.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
  assert.equal(await page.locator('#share-btn, #share-disable-btn').count(),0);
  assert.equal(await page.locator('#chatgpt-export-btn').count(),1);
  await page.evaluate(data=>applyRestoredData(JTDData.normalizeData(data)),fixture);
  assert.equal(await page.locator('[data-page="journal"], #page-journal, [id^="j-"], [id^="f-journal"]').count(),0);
  assert.equal(await page.locator('script[src*="journal"], link[href*="journal"]').count(),0);
  await page.evaluate(()=>{goToPage('collection');setStatus('copy-a','a_jouer');});
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='copy-a').status),'a_jouer','old links cannot override a collection status');
  await page.locator('.card').filter({hasText:'Chroniques du Vent'}).first().locator('.card-status-badge').click();
  assert.equal(await page.locator('.card-status-menu:not(.hidden)').count(),1,'linked exemplars use the ordinary status menu');
  await page.locator('.card-status-menu:not(.hidden) [data-status="termine"]').click();
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='copy-a').status),'termine');
  await page.evaluate(()=>goToPage('home'));

  await importFile(page,[...Array.from({length:60},(_,i)=>({id:'bulk-'+i,nom:'Entrée fictive '+i,plateforme:'PC',saleStatus:'pending'})),{id:'bulk-match',nom:'Chroniques du Vent',plateforme:'NSW',saleStatus:'pending'}]);
  assert.match(await page.locator('#cemetery-import-list .cemetery-import-row').first().textContent(),/Chroniques du Vent/,'review rows come first even when they are last in a large file');
  assert.equal(await page.locator('#cemetery-import-review-title').textContent(),'1 jeu à revoir');
  assert.equal(await page.locator('.cemetery-import-other').getAttribute('open'),null);
  await page.screenshot({path:'/tmp/jtd-import-review-'+width+'-'+theme+'.png',fullPage:true});
  await page.locator('#cemetery-import-cancel').click();
  const original=await page.evaluate(()=>buildBackupPayload().data);
  await importFile(page,[{id:'incoming',nom:'Chroniques du vent',plateforme:'Switch',saleStatus:'pending'}]);
  const action=page.locator('.cemetery-import-action select:not(.cemetery-import-source)'),source=page.locator('.cemetery-import-source');
  assert.equal(await source.inputValue(),'','multiple copies must not preselect an arbitrary ID');assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),true);
  assert.equal(await source.locator('option').count(),4,'active and sold copies are all searchable');
  await action.selectOption('transfer');assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),true);
  await source.selectOption('copy-b');assert.equal(await action.inputValue(),'','changing the proposed copy requires a fresh decision');await action.selectOption('transfer');
  await page.screenshot({path:'/tmp/jtd-import-export-'+width+'-'+theme+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#cemetery-import-apply').click();
  const after=await page.evaluate(()=>buildBackupPayload().data);
  assert.equal(after.games.length,1);assert.equal(after.games[0].id,'copy-a');assert.ok(after.cemetery.some(g=>g.id==='copy-b'));assert.deepEqual(after.journal,original.journal);
  await importFile(page,[{id:'renamed',nom:'Tout autre titre',plateforme:'PS4',saleStatus:'pending'}]);
  await page.locator('.cemetery-import-picker').evaluate(el=>el.open=true);
  await page.locator('.cemetery-import-picker input').fill('Aventure');await source.selectOption('sold');await action.selectOption('transfer');
  assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),true,'a sold copy cannot be transferred again');await action.selectOption('skip');await page.locator('#cemetery-import-cancel').click();
  // Editing the source boards while the preview is open invalidates previous decisions.
  await importFile(page,[{id:'new',nom:'Jeu inédit',plateforme:'PS5',saleStatus:'pending'}]);
  await page.evaluate(()=>{CEMETERY=[...CEMETERY,{id:'concurrent',nom:'Concurrent',plateforme:'PC',saleStatus:'pending'}];});
  await page.locator('#cemetery-import-apply').click();assert.match(await page.locator('#cemetery-import-error').textContent(),/changé/);assert.equal(await page.evaluate(()=>CEMETERY.some(g=>g.id==='new')),false);await page.locator('#cemetery-import-cancel').click();
  // Advice exports exclude the retired private archive.
  const downloadEvent=page.waitForEvent('download');await page.locator('#profile-menu-btn').click();await page.locator('#chatgpt-export-btn').click();
  const advice=JSON.parse(fs.readFileSync(await (await downloadEvent).path(),'utf8'));
  assert.equal('journal' in advice.data,false);
  assert.equal(await page.evaluate(()=>Object.hasOwn(JTDData.createPublicSharePayload(buildBackupPayload().data),'journal')),false);
  // Oversized or advice files must not replace data, even when selected as restore input.
  const before=await page.evaluate(()=>JSON.stringify(buildBackupPayload().data));
  for(const payload of [advice,{app:'Jeux Tout Doux',version:4,data:{games:[],profile:{name:'é'.repeat(450000)}}}]){
   await page.locator('#profile-menu-btn').click();const event=page.waitForEvent('filechooser');await page.locator('.profile-maintenance').evaluate(el=>el.open=true);await page.locator('#restore-trigger').click();await (await event).setFiles({name:'bad-restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
   await page.waitForTimeout(100);assert.equal(await page.locator('#confirm-modal-overlay').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify(buildBackupPayload().data)),before);
  }
  // Import storage failure leaves all lists in memory intact and the preview open.
  await importFile(page,[{id:'rollback',nom:'Quota fictif',plateforme:'PS5',saleStatus:'pending'}]);
  await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota fictif');};});await page.locator('#cemetery-import-apply').click();assert.match(await page.locator('#cemetery-import-error').textContent(),/quota/);assert.equal(await page.evaluate(()=>CEMETERY.some(g=>g.id==='rollback')),false);await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;});await page.locator('#cemetery-import-cancel').click();
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>GAMES[0].id),'copy-a');assert.equal(await page.evaluate(()=>GAMES[0].status),'termine');assert.equal(await page.evaluate(()=>LEGACY_JOURNAL.find(r=>r.id==='sold-history').collectionId),'sold');
  assert.deepEqual(errors,[]);assert.deepEqual(cloud,[]);
  console.log('PASS import/export',width,theme,': ambiguous exemplars, manual title/platform match, stale preview, collection exports, restore rejection, rollback, persistence, no Firebase');await context.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

