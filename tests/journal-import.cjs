/* Fictional fixtures only. The sandbox blocks all external requests. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const header=Array(22).fill('');header[6]='📅';header[15]='📖';
function row(title,support,date='févr.'){const r=Array(22).fill('');r[6]=date;r[8]='NSW';r[10]=title;r[11]=support;r[13]='✅';r[15]='A';return r;}
const file={app:'JTD Sheets Journal',version:1,sheets:[{name:'Journal fictif',year:2026,values:[header,row('Aventure fictive','🌐'),row('Extension fictive','🧩'),row('Replay fictif','🔁'),row('Ancien fictif','🌐','2013')],notes:{'1:20':'Un avis fictif conservé.'}}]};
async function open(page,payload=file){await page.locator('#profile-menu-btn').click();const chooser=page.waitForEvent('filechooser');await page.locator('#journal-import-trigger').click();await(await chooser).setFiles({name:'journal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await page.locator('#journal-import-overlay').waitFor({state:'visible'});}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [320,390,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>applyRestoredData(JTDData.normalizeData({games:[{id:'copy',nom:'Aventure fictive',plateforme:'Nintendo Switch',status:'a_jouer'}],cemetery:[{id:'sold-copy',nom:'Aventure fictive',plateforme:'Nintendo Switch',saleStatus:'sold',salePrice:10}]})));
  const before=await page.evaluate(()=>buildBackupPayload().data);
  await open(page);assert.equal(await page.locator('#journal-import-apply').isDisabled(),true);
  const adventure=page.locator('[data-title="Aventure fictive"]'),extension=page.locator('[data-title="Extension fictive"]'),replay=page.locator('[data-title="Replay fictif"]');
  assert.equal(await adventure.getByLabel('Exemplaire pour Aventure fictive').inputValue(),'');
  await adventure.getByLabel('Action pour Aventure fictive',{exact:true}).selectOption('link');
  assert.match(await adventure.getByLabel('Exemplaire pour Aventure fictive').textContent(),/Vendu/);
  await adventure.getByLabel('Exemplaire pour Aventure fictive').selectOption('copy');
  await extension.getByLabel('Action pour Extension fictive',{exact:true}).selectOption('add');
  assert.equal(await page.locator('#journal-import-apply').isDisabled(),true);
  await extension.getByLabel('Jeu de base').fill('Base fictive');
  await replay.getByLabel('Action pour Replay fictif',{exact:true}).selectOption('add');
  await replay.getByLabel('Support joué').selectOption('digital');await replay.getByLabel(/^Accès/).selectOption('emulation');
  assert.equal(await page.locator('#journal-import-apply').isDisabled(),false);
  assert.match(await page.locator('#journal-import-impact').textContent(),/Terminé ailleurs/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/jtd-journal-import-'+width+'-'+theme+'.png'});
  await page.locator('#journal-import-apply').click();await page.locator('#journal-import-overlay').waitFor({state:'hidden'});
  const after=await page.evaluate(()=>buildBackupPayload().data);
  assert.equal(after.journal.length,4);assert.equal(after.games.length,1);assert.equal(after.games[0].status,'termine_ailleurs');
  for(const key of ['cemetery','wishlist','arrivals'])assert.deepEqual(after[key],before[key]);
  const imported=after.journal.find(r=>r.nom==='Aventure fictive');assert.equal(imported.medium,'digital');assert.equal(imported.collectionId,'copy');assert.equal(imported.finishedAt,'2026-02');assert.match(imported.review,/Un avis fictif conservé/);assert.match(imported.review,/Scénario : A/);
  assert.equal(after.journal.find(r=>r.nom==='Ancien fictif').finishedAt,'2013');assert.match(after.journal.find(r=>r.nom==='Replay fictif').review,/Replay/);
  await page.evaluate(()=>{const data=buildBackupPayload().data;data.journal[0].nom='Renommé';applyRestoredData(JTDData.normalizeData(data));});
  await open(page);assert.match(await page.locator('#journal-import-summary').textContent(),/0 ajout\(s\).*4 ignoré/);assert.equal(await page.locator('#journal-import-apply').isDisabled(),true);await page.locator('#journal-import-cancel').click();
  const extra={...file,sheets:[{name:'Fictif',year:2026,values:[header,row('Nouveau fictif','🌐')]}]};
  await open(page,extra);await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota fictif');};});
  await page.locator('#journal-import-apply').click();assert.match(await page.locator('#journal-import-error').textContent(),/quota/);assert.equal(await page.evaluate(()=>JOURNAL.length),4);await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});await page.locator('#journal-import-cancel').click();
  await open(page,extra);await page.evaluate(()=>{window.JTDAccountGeneration=(window.JTDAccountGeneration||0)+1;});await page.locator('#journal-import-apply').click();assert.match(await page.locator('#journal-import-error').textContent(),/compte a changé/);assert.equal(await page.evaluate(()=>JOURNAL.length),4);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS journal import '+width+' '+theme);
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


