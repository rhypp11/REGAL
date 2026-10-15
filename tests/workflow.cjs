const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {createSandboxServer, sandboxContext} = require('./sandbox.cjs');
const server = createSandboxServer();
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA7sAAAAASUVORK5CYII=';
const fixture = {games:[],arrivals:[],wishlist:[
 {id:'wish-year',nom:'Un très long titre de jeu collector japonais pour tester la place sur téléphone',plateforme:'Switch 2',date:'2027',collector:true,japanese:true,image},
 {id:'wish-exact',nom:'Sortie à venir',plateforme:'Switch 2',date:'2099-12-05',collector:false,japanese:false},
 {id:'wish-past',nom:'Déjà sorti',plateforme:'Switch 2',date:'2020-11-01',collector:false,japanese:false,lien:'https://example.com/game'}
],platformMeta:{'Switch 2':{color:'#c00035',logo:null}}};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try {
  for(const width of [320,390,820,900,1440]) for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme,isMobile:width<500,hasTouch:width<500});
   const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(data=>{replaceAppData(JTDData.normalizeData(data));goToPage('lists');setHomeBoard('wishlist');renderWishlist();renderArrivals();},fixture);
   const yearRow=page.locator('[data-id="wish-year"]');
   assert.equal(await page.locator('.board-workflow-action').count(),0);
   const action=async()=>{await yearRow.click();await page.locator('#w-order-btn').click();};
   const layout=await yearRow.evaluate(el=>{const info=el.querySelector('.board-info').getBoundingClientRect(),title=el.querySelector('.board-name').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,infoRight:info.right,titleRight:title.right};});
   assert.ok(await yearRow.evaluate(el=>el.querySelector('.board-thumb').getBoundingClientRect().right<=el.querySelector('.board-info').getBoundingClientRect().left),'Artwork never overlaps the title');assert.equal(layout.overflow,false);assert.ok(layout.titleRight<=layout.infoRight+1);
   await page.screenshot({path:`/tmp/jtd-workflow-${width}-${theme}-wishlist.png`,fullPage:true});
   await action();await page.locator('#arrival-modal-overlay').waitFor({state:'visible'});
   assert.equal(await page.locator('#wishlist-modal-overlay').isVisible(),false);
   assert.equal(await page.locator('#a-date').inputValue(),'');
   assert.equal(await page.locator('#a-received-btn').isVisible(),false);
   await page.locator('#a-cancel-btn').click();assert.equal(await page.evaluate(()=>WISHLIST.length),3);assert.equal(await page.evaluate(()=>ARRIVALS.length),0);
   await action();await page.locator('#a-prix').fill('49,90');await page.locator('#a-source').fill('Fnac');
   await page.screenshot({path:`/tmp/jtd-workflow-${width}-${theme}-order.png`,fullPage:true});
   await page.locator('#a-save-btn').click();
   assert.equal(await page.locator('#arrival-modal-overlay').isVisible(),false);
   assert.equal(await page.evaluate(()=>navigationBoard),'arrivals');
   const ordered=await page.evaluate(()=>ARRIVALS[0]);assert.equal(ordered.id,'wish-year');assert.equal(ordered.prix,49.9);assert.equal(ordered.source,'Fnac');assert.equal(ordered.image,image);assert.ok(ordered.collector&&ordered.japanese);assert.equal(ordered.date,null);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>WISHLIST.some(item=>item.id==='wish-year')),false);
   assert.deepEqual(await page.evaluate(()=>ARRIVALS[0]),ordered);
   const received=async()=>{await page.locator('#arrivals-rows [data-id="wish-year"]').click();await page.locator('#a-received-btn').click();};
   await received();assert.equal(await page.locator('#arrival-modal-overlay').isVisible(),false);
   assert.equal(await page.locator('#f-identity-editor').isVisible(),false);assert.equal(await page.locator('#f-context-editor').isVisible(),false);
   await page.locator('#cancel-btn').click();assert.equal(await page.evaluate(()=>ARRIVALS.length),1);assert.equal(await page.evaluate(()=>GAMES.length),0);
   await received();await page.locator('#f-context-summary .context-edit-btn').click();
   await page.locator('#f-date').fill('2026-10-01');await page.locator('#f-prix').fill('45,90');
   await page.screenshot({path:`/tmp/jtd-workflow-${width}-${theme}-receive.png`,fullPage:true});
   await page.locator('#save-btn').click();
   const game=await page.evaluate(()=>GAMES[0]);assert.equal(game.id,ordered.id);assert.equal(game.status,'a_jouer');assert.equal(game.prix,45.9);assert.equal(game.source,'Fnac');assert.equal(game.date,'2026-10-01');assert.ok(game.collector&&game.japanese);assert.equal(game.image,image);assert.equal(await page.evaluate(()=>ARRIVALS.length),0);
   await page.getByRole('button',{name:'Voir',exact:true}).click();assert.ok(await page.locator('#page-collection').isVisible());assert.equal(await page.locator('.card').count(),1);
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.deepEqual(await page.evaluate(()=>GAMES[0]),game);assert.equal(await page.evaluate(()=>ARRIVALS.length),0);
   await page.locator('.nav-tab[data-page="lists"]').click();
   await page.evaluate(()=>setHomeBoard('wishlist'));
   await page.locator('[data-id="wish-exact"]').click();await page.locator('#w-order-btn').click();assert.equal(await page.locator('#a-date').inputValue(),'2099-12-05');await page.locator('#a-save-btn').click();
   await page.locator('#arrivals-rows [data-id="wish-exact"]').click();await page.locator('#a-received-btn').click();await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>ARRIVALS.length),0);assert.equal(await page.evaluate(()=>GAMES.some(item=>item.id==='wish-exact')),true);
   await page.evaluate(()=>setHomeBoard('wishlist'));assert.equal(await page.locator('[data-id="wish-past"] .board-link').getAttribute('href'),'https://example.com/game');
   await page.locator('[data-id="wish-past"]').click();await page.locator('#w-order-btn').click();assert.equal(await page.locator('#a-date').inputValue(),'');await page.locator('#a-cancel-btn').click();
   assert.deepEqual(errors,[]);
   console.log(`PASS workflow ${width}px ${theme}: modal order/cancel/receive/cancel, refresh persistence, unknown/exact/past dates, metadata, no overflow`);
   await context.close();
  }
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
