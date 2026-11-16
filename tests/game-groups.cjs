/* Integration on the existing REGAL theme, using only isolated fictional purchases. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');const server=createSandboxServer();
let activePage;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const context=await sandboxContext(browser,{viewport:{width,height:900}});const page=activePage=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>{
   const image=new URL('preview-assets/garden.svg',location.href).href;
   applyRestoredData(JTDData.normalizeData({games:[
    {id:'base',nom:'Chroniques fictives',plateforme:'Switch',format:'Numérique',prix:59.99,date:'2020-03-20',status:'termine',image},
    {id:'box',nom:'Chroniques fictives',plateforme:'Switch',format:'Physique',prix:39.99,status:'a_jouer',image},
    {id:'ps4',nom:'Chroniques fictives',plateforme:'PlayStation 4',format:'Physique',prix:29.99,status:'a_jouer',image},
    {id:'dlc',nom:'Extension fictive',plateforme:'Switch',format:'Numérique',contentType:'dlc',parentId:'base',status:'a_jouer',prix:12.99,image},
    {id:'upgrade',nom:'Chroniques fictives — Switch 2 Edition',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'base',prix:4.99,image}
   ],platformMeta:{Switch:{logo:new URL('preview-assets/switch.svg',location.href).href},'Switch 2':{logo:new URL('preview-assets/switch.svg',location.href).href},'PlayStation 4':{logo:new URL('preview-assets/playstation.svg',location.href).href}}}));
   applyNavigation({page:'collection',media:'all'});
  });
  assert.equal(await page.locator('#grid .card').count(),3,'Same names do not group without choosing');
  for(const source of ['box','ps4']){
   await page.locator(`[data-dialog-trigger="game:${source}"] .card-name`).click();
   await page.locator('#f-copy-details').getByRole('button',{name:'Regrouper avec un autre jeu',exact:true}).click();
   await page.locator('#f-copy-search').fill('Chroniques');await page.locator('[data-copy-target="base"]').click();
   assert.match(await page.locator('#f-copy-selection').innerText(),/statut commun : Terminé/);
   await page.locator('#save-btn').click();await page.locator('#modal-overlay').waitFor({state:'hidden'});
  }
  assert.equal(await page.locator('#grid .card').count(),1);
  assert.deepEqual(await page.evaluate(()=>GAMES.filter(g=>!JTDData.isAddon(g)).map(g=>[g.id,g.prix,g.status])),[['base',59.99,'termine'],['box',39.99,'termine'],['ps4',29.99,'termine']]);
  const card=()=>page.locator('[data-dialog-trigger="game:base"]');
  assert.equal(await card().locator('.copy-platform-row').count(),3);
  assert.equal(await card().locator('.copy-count-dlc').count(),1);assert.equal(await card().locator('.copy-count-upgrade').count(),1);
  for(const view of ['cards','gallery','list']){
   await page.locator(`#collection-view-switch [data-view="${view}"]`).click();
   const bounds=await card().evaluate(el=>{
    const box=el.getBoundingClientRect(),footer=el.querySelector('.copy-status-footer').getBoundingClientRect();
    return {overflow:el.scrollWidth>el.clientWidth+1,rows:[...el.querySelectorAll('.copy-platform-row')].map(row=>{const r=row.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right+1&&r.bottom<=footer.top+1&&row.scrollWidth<=row.clientWidth+1;}),status:el.querySelector('.card-status-badge').getBoundingClientRect().height};
   });assert.equal(bounds.overflow,false,JSON.stringify({width,view,bounds}));assert.ok(bounds.rows.every(Boolean));assert.ok(bounds.status>=40);
   await card().locator('.card-status-badge').click();await card().getByRole('button',{name:'Abandonné',exact:true}).click();
   assert.equal(await page.evaluate(()=>GAMES.filter(g=>!JTDData.isAddon(g)).every(g=>g.status==='abandonne')),true);
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='dlc').status),'a_jouer');
   await page.locator('#toast-stack .toast-action').click();assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='ps4').status),'termine');
   await card().scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/jtd-game-groups-${view}-${width}.png`,fullPage:true});
  }
  await card().locator('.card-name').click();assert.equal(await page.locator('#f-copy-details [data-copy-id]').count(),3);
  await page.locator('#f-content-details .content-type-dlc').click();assert.equal(await page.locator('#f-format-title').innerText(),'DLC');
  assert.match(await page.locator('#f-content-details .content-base-link').innerText(),/Switch 2/);
  await page.screenshot({path:`/tmp/jtd-game-groups-dlc-${width}.png`,fullPage:true});
  await page.locator('#f-content-details .content-base-link').click();await page.locator('#f-content-details .content-type-upgrade').click();
  assert.match(await page.locator('#f-format-title').innerText(),/Mise à niveau.*Switch 2 Edition/);
  await page.locator('#f-content-details').getByRole('button',{name:'Modifier le rattachement',exact:true}).click();await page.locator('#f-parent-enabled').uncheck();await page.locator('#save-btn').click();
  assert.equal(await page.evaluate(()=>copyPlatform(GAMES.find(g=>g.id==='base'))),'Switch');
  assert.equal(await page.locator('#grid .card').count(),2,'Unlinked upgrade stays as an independent purchase');
  await page.evaluate(()=>openModal('upgrade'));await page.locator('#f-content-details').getByRole('button',{name:'Rattacher à un jeu',exact:true}).click();
  await page.locator('#f-parent-enabled').check();await page.locator('#f-parent-search').fill('Chroniques');await page.locator('[data-parent-id="base"]').click();await page.locator('#save-btn').click();
  assert.equal(await page.evaluate(()=>copyPlatform(GAMES.find(g=>g.id==='base'))),'Switch 2');
  await page.evaluate(()=>applyNavigation({page:'collection',media:'all',platform:'PlayStation 4'}));
  assert.equal(await page.locator('#grid .card').count(),1);assert.equal(await page.locator('#grid .copy-platform-row').count(),1);
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.equal(await page.locator('#grid .card').count(),1);
  await page.evaluate(()=>openModal('base'));await page.locator('#f-copy-details').getByRole('button',{name:'Ajouter un exemplaire',exact:true}).click();
  assert.equal(await page.locator('#f-copy-target').inputValue(),'base');await page.locator('#f-prix').fill('10');await page.locator('#save-btn').click();
  assert.equal(await page.evaluate(()=>JTDData.gameCopies(GAMES.find(g=>g.id==='base'),GAMES).length),4);
  await page.evaluate(()=>openModal('box'));await page.locator('#f-copy-details').getByRole('button',{name:'Modifier le regroupement',exact:true}).click();
  await page.locator('#f-copy-selection').getByRole('button',{name:'Garder cet exemplaire séparé',exact:true}).click();await page.locator('#save-btn').click();
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').gameGroupId),null);
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='box').prix),39.99);
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='base').plateforme),'Switch');assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='base').date),'2020-03-20');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS REGAL grouped copies',width);
 }}catch(error){if(activePage)await activePage.screenshot({path:'/tmp/jtd-game-groups-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
