/* End-to-end purchase and attachment regression, always in an isolated local sandbox. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
  {id:'box',nom:'Jeu en boîte',plateforme:'Switch 2',format:'Physique',prix:40},
  {id:'old',nom:'Ancien jeu',plateforme:'PlayStation 2',format:'Physique',prix:15},
  {id:'base',nom:'Jeu numérique',plateforme:'Switch 2',format:'Numérique',contentType:'game',accountId:'eu',prix:30,currency:'EUR'},
  {id:'dlc',nom:'Extension numérique',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'base',accountId:'eu',prix:10,currency:'EUR'},
  {id:'box-dlc',nom:'Extension boîte',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'box',accountId:'jp',prix:2000,currency:'JPY'}
],digitalAccounts:[{id:'eu',name:'Nintendo principal',ecosystem:'Nintendo',region:'Europe',preferred:true},{id:'jp',name:'Nintendo japonais',ecosystem:'Nintendo',region:'Japon',preferred:false}]};
async function openFilters(page){
  const closed = await page.evaluate(()=>matchMedia('(max-width:820px)').matches && !document.getElementById('collection-sidebar').classList.contains('mobile-open'));
  if(closed) await page.locator('#global-filter-toggle').click();
}
async function chooseAccount(page,value){await openFilters(page);if(!await page.locator('#collection-account-picker').evaluate(el=>el.open))await page.locator('#collection-account-picker summary').click();await page.locator('[data-account="'+value+'"]').click();}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{})});
  try{
    for(const width of [320,390,1440]) for(const theme of ['light','dark']){
      const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
      await page.evaluate(data=>{applyRestoredData(JTDData.normalizeData(data));applyNavigation({page:'collection'});},fixture);
      assert.equal(await page.locator('#grid .card').count(),2);
      assert.equal(await page.locator('#home-total-games').innerText(),'2');
      await openFilters(page);await page.locator('[data-media="digital"]').click();
      assert.equal(await page.locator('#collection-sidebar [data-media="digital"]').count(),1);
      assert.equal(await page.locator('.collection-filter-context').innerText(),'Numérique');
      assert.equal(await page.locator('#grid .card').count(),2);
      assert.equal(await page.locator('[data-dialog-trigger="game:dlc"]').count(),0);
      assert.equal(await page.locator('.dlc-label').innerText(),'DLC');
      assert.equal(await page.locator('#status-toggles').innerText().then(t=>t.includes('En cours')),false);
      assert.equal(await page.locator('#platform-list').innerText().then(s=>s.includes('PlayStation 2')),false);
      assert.ok((await page.locator('[data-stat="spent"]').innerText()).includes('2 000'));
      await page.locator('[data-dialog-trigger="game:base"] .card-name').click();
      assert.ok((await page.locator('#f-content-details').innerText()).includes('Extension numérique'));
      assert.ok((await page.locator('#f-content-details').innerText()).includes('40,00'));
      assert.equal(await page.locator('#f-sell-btn').isVisible(),false);
      await page.locator('#cancel-btn').click();
      await chooseAccount(page,'jp');assert.equal(await page.locator('#grid .card').count(),1);
      assert.equal(await page.locator('.collection-filter-context').innerText(),'Numérique · Nintendo japonais');
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.locator('#collection-account').inputValue(),'jp');
      assert.equal(await page.evaluate(()=>state.media),'digital');
      await chooseAccount(page,'');
      await page.locator('#add-btn').click();
      await page.locator('#f-nom').fill('Nouvel achat japonais');await page.selectOption('#f-plateforme','Switch 2');
      await page.selectOption('#f-account','jp');await page.selectOption('#f-currency','JPY');
      await page.locator('#f-prix').fill('3980');await page.locator('#save-btn').click();
      assert.equal(await page.locator('#modal-overlay').isVisible(),false);
      const newId=await page.evaluate(()=>GAMES.find(g=>g.nom==='Nouvel achat japonais').id);
      await page.locator('#add-btn').click();await page.locator('#f-nom').fill('Nouvelle extension');
      await page.selectOption('#f-content-type','dlc');await page.locator('#f-parent-search').fill('Nouvel achat japonais');
      await page.selectOption('#f-parent',newId);await page.selectOption('#f-currency','JPY');await page.locator('#f-prix').fill('1000');await page.locator('#save-btn').click();
      assert.equal(await page.evaluate(()=>JTDData.collectionCards(GAMES,'digital').some(g=>g.nom==='Nouvelle extension')),false);
      // The child remains discoverable when the selected account excludes its parent.
      await page.evaluate(()=>{const child=GAMES.find(g=>g.nom==='Nouvelle extension');child.accountId='eu';saveGames();render();});
      await chooseAccount(page,'eu');
      assert.ok((await page.locator('#grid').innerText()).includes('Nouvelle extension'));
      await chooseAccount(page,'');
      // A sale removes only the physical copy; its DLC stays digital and cannot be sold.
      await page.evaluate(()=>{const box=GAMES.find(g=>g.id==='box');commitBoardTransfer('games','cemetery',box.id,{...box,saleStatus:'pending'});buildPlatformList();render();});
      assert.equal(await page.evaluate(()=>GAMES.some(g=>g.id==='box-dlc')),true);
      assert.equal(await page.evaluate(()=>commitBoardTransfer('games','cemetery','box-dlc',GAMES.find(g=>g.id==='box-dlc'))),null);
      // Additive cemetery imports must retain purchases absent from their physical-only snapshot.
      await page.evaluate(()=>{const snapshot=JTDGetCemeteryImportState();JTDApplyCemeteryImport(snapshot.games,snapshot.cemetery);});
      assert.equal(await page.evaluate(()=>GAMES.filter(JTDData.isDigital).length),5);
      const backup=await page.evaluate(()=>buildBackupPayload());
      assert.equal(backup.data.digitalAccounts.length,2);assert.equal(backup.data.games.find(g=>g.nom==='Nouvelle extension').parentId,newId);
      await page.evaluate(()=>{GAMES.push({id:'switch-base',nom:'Jeu Switch de base',plateforme:'Switch',format:'Physique',prix:40});buildPlatformList();render();});
      await page.locator('#add-btn').click();await page.locator('#f-nom').fill('Mise à niveau Switch 2');
      await page.selectOption('#f-content-type','upgrade');await page.locator('#f-parent-search').fill('Jeu Switch de base');await page.selectOption('#f-parent','switch-base');
      const optionColors=await page.locator('#f-content-type option').first().evaluate(option=>{const style=getComputedStyle(option);return {foreground:style.color,background:style.backgroundColor};});
      assert.notEqual(optionColors.foreground,optionColors.background);
      assert.notEqual(optionColors.background,'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('#f-plateforme').inputValue(),'Switch 2');
      assert.equal(await page.locator('#f-parent-preview .content-related-thumb').count(),1);
      await page.locator('#f-prix').fill('10');await page.locator('#save-btn').click();
      const upgradeId=await page.evaluate(()=>GAMES.find(g=>g.nom==='Mise à niveau Switch 2').id);
      assert.equal(await page.evaluate(()=>GAMES.find(g=>g.nom==='Mise à niveau Switch 2').parentId),'switch-base');
      await page.locator('[data-dialog-trigger="game:'+upgradeId+'"] .card-name').click();
      assert.ok((await page.locator('#f-content-details').innerText()).includes('Jeu de base'));
      assert.equal(await page.locator('#f-content-details .content-related-thumb').count(),1);
      await page.locator('#cancel-btn').click();
      // Content filters reveal attached DLC, persist, and stay specific to digital views.
      await chooseAccount(page,'');
      await openFilters(page);await page.locator('[data-content-type="dlc"]').click();
      assert.equal(await page.locator('[data-dialog-trigger="game:dlc"]').count(),1,'A grouped DLC becomes discoverable by content type');
      assert.equal(await page.locator('#grid .card:not(.dlc-card)').count(),0);
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>state.contentType),'dlc');
      await openFilters(page);await page.locator('[data-content-type="upgrade"]').click();
      assert.equal(await page.locator('[data-dialog-trigger="game:'+upgradeId+'"]').count(),1);
      await openFilters(page);await page.locator('[data-media="physical"]').click();
      assert.equal(await page.locator('#collection-account-field').isVisible(),false);
      assert.equal(await page.locator('#content-filter-section').isVisible(),false);
      assert.equal(await page.evaluate(()=>state.contentType),null);
      await openFilters(page);await page.locator('[data-media="all"]').click();
      const money=page.locator('[data-stat="spent"] .currency-total');
      assert.ok(await money.count()>=2,'Currencies remain independent amounts');
      assert.doesNotMatch(await page.locator('[data-stat="spent"]').innerText(),/ \+ /);
      assert.equal(await page.locator('[data-stat="spent"]').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
      assert.equal(await page.locator('#collection-account-scope').count(),0);
      // A storage failure cannot mutate purchases in memory.
      const rollback=await page.evaluate(()=>{const before=JSON.stringify(GAMES);const original=window.persistAppData;window.persistAppData=()=>{throw Error('quota test');};const result=commitCollection([]);window.persistAppData=original;return !result && before===JSON.stringify(GAMES);});assert.equal(rollback,true);
      await page.evaluate(()=>{
        GAMES.push({id:'shared-switch',nom:'Autre console',plateforme:'Nintendo Switch',format:'Numérique',accountId:'eu'});
        GAMES.push({id:'shared-ps4',nom:'Autre réseau',plateforme:'PlayStation 4',format:'Numérique',accountId:'jp'});
        state.platform='PlayStation 4';state.accountId='jp';buildPlatformList();render();
      });
      await chooseAccount(page,'eu');
      assert.equal(await page.evaluate(()=>state.platform),null);
      assert.match(await page.locator('#platform-list').innerText(),/Nintendo Switch/);
      assert.match(await page.locator('#platform-list').innerText(),/Switch 2/);
      assert.doesNotMatch(await page.locator('#platform-list').innerText(),/PlayStation 4/);
      assert.equal(await page.evaluate(()=>ecosystemFor('Nintendo 3DS')),'Nintendo Network');
      assert.equal(await page.evaluate(()=>ecosystemFor('Wii U')),'Nintendo Network');
      assert.equal(await page.locator('#cemetery-import-trigger, #digital-accounts-btn').count(),0);
      // Accounts are managed as labels, never connected credentials.
      await openFilters(page);await page.locator('#collection-account-picker').evaluate(el=>el.open=true);await page.locator('#collection-manage-accounts').click();
      assert.equal(await page.locator('#digital-accounts-overlay .modal').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
      await page.locator('#digital-account-add').click();const row=page.locator('.digital-account-row').last();
      await row.locator('[data-field="name"]').fill('Compte secondaire');await row.locator('[data-field="nickname"]').fill('Aster');
      const avatar=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;canvas.getContext('2d').fillRect(0,0,8,8);return canvas.toDataURL('image/png').split(',')[1];});
      await row.locator('[data-field="avatar-file"]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(avatar,'base64')});
      await page.waitForFunction(()=>document.querySelector('.digital-account-row:last-child').dataset.avatarBusy === 'false');
      await page.locator('#digital-accounts-save').click();
      assert.equal(await page.evaluate(()=>DIGITAL_ACCOUNTS.length),3);
      assert.equal(await page.evaluate(()=>DIGITAL_ACCOUNTS.at(-1).nickname),'Aster');
      assert.ok(await page.evaluate(()=>DIGITAL_ACCOUNTS.at(-1).avatar.startsWith('data:image/')));
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>DIGITAL_ACCOUNTS.length),3);
      await page.evaluate(()=>applyNavigation({page:'collection',media:'all'}));
      await page.screenshot({path:`/tmp/jtd-digital-${width}-${theme}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.evaluate(()=>{
        GAMES.push(...Array.from({length:45},(_,i)=>({id:'scroll-'+i,nom:'Achat démo '+i,plateforme:'Switch 2',format:'Numérique',accountId:'eu'})));
        applyNavigation({page:'collection',media:'digital',accountId:'eu'});window.scrollTo(0,1200);
      });
      await page.locator('#collection-scroll-context').waitFor({state:'visible'});
      assert.equal(await page.locator('.collection-context-media').innerText(),'Numérique · Nintendo principal');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS digital ${width}px ${theme}: purchases, DLC, accounts, reload, isolation and rollback`);
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
