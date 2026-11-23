const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,821,1024,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{
    GAMES=[{id:'finish-game',nom:'Jeu fictif au titre assez long',plateforme:'Switch 2',format:'Physique',status:'a_jouer'}];
    CEMETERY=[
     {id:'finish-pending',nom:'Jeu en vente',plateforme:'Switch 2',saleStatus:'pending'},
     {id:'finish-sold',nom:'Jeu vendu',plateforme:'PC',saleStatus:'sold',saleId:'finish-sale',salePrice:10}
    ];
    ARRIVALS=[
     {id:'finish-a',nom:'Étoile & forêt',plateforme:'Switch 2',date:'2030-02-15'},
     {id:'finish-b',nom:'Aventure "test"',plateforme:'PC',date:'2030-02-16'}
    ];
    WISHLIST=[{id:'finish-w',nom:'Un souhait au titre assez long',plateforme:'Switch 2',date:'2030-02-17',lien:'https://example.com/jeu'}];
    render();renderArrivals();renderWishlist();renderCemetery();goToPage('collection');
   });
   const card=page.locator('#grid .card').first(),badge=card.locator('.card-status-badge'),face=badge.locator('.card-status-face');
   const target=await badge.boundingBox(),visual=await face.boundingBox();
   assert.ok(target.width>=44 && target.height>=44,'Status has a 44px target: '+JSON.stringify({target,visual}));
   assert.ok(visual.height<32 && visual.height<target.height,'Status pill remains compact');
   const surrounding=await card.evaluate(card=>{
    const rect=selector=>{const r=card.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {title:rect('.card-name'),status:rect('.card-status-badge'),platform:rect('.card-platform')};
   });
   assert.ok(surrounding.title.bottom<=surrounding.status.top+.5,'Status target does not overlap title');
   assert.ok(surrounding.platform.right<=surrounding.status.left+.5 || surrounding.platform.bottom<=surrounding.status.top+.5,'Status target does not overlap platform');
   if([320,1440].includes(width))await page.screenshot({path:'/tmp/jtd-finishing-card-'+width+'-'+theme+'.png'});
   await badge.focus();assert.equal(await badge.evaluate(e=>e.matches(':focus-visible')),true);
   // Tap inside the target but above the visible pill.
   await page.mouse.click(target.x+target.width/2,target.y+2);
   assert.equal(await card.locator('.card-status-menu').isVisible(),true);
   assert.equal(await page.locator('#modal-overlay').isVisible(),false,'Expanded target does not open the game sheet');
   await card.locator('[data-status="termine"]').click();
   assert.equal(await page.evaluate(()=>GAMES[0].status),'termine');
   await card.locator('.card-open-control').click();assert.equal(await page.locator('#modal-overlay').isVisible(),true);await page.keyboard.press('Escape');
   await page.evaluate(()=>goToPage('home'));
   await page.getByRole('button',{name:'Modifier l’arrivage : Étoile & forêt · Switch 2',exact:true}).focus();
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('#arrival-modal-overlay').isVisible(),true);
   assert.equal(await page.locator('#a-nom').inputValue(),'Étoile & forêt');
   await page.keyboard.press('Escape');
   assert.equal(await page.getByRole('button',{name:'Modifier l’arrivage : Aventure "test" · PC',exact:true}).count(),1);
   if(width<=820)await page.locator('[data-target="wishlist"]').click();
   const link=page.locator('#wishlist-rows .board-link'),linkBox=await link.boundingBox(),icon=await link.locator('svg').boundingBox();
   assert.ok(linkBox.width>=44 && linkBox.height>=44,'Wishlist link has a 44px target');
   assert.ok(icon.width<=16 && icon.height<=16,'Link icon stays compact');
   if([320,1440].includes(width))await page.screenshot({path:'/tmp/jtd-finishing-wishlist-'+width+'-'+theme+'.png'});
   assert.equal(await link.getAttribute('href'),'https://example.com/jeu');
   assert.equal(await link.getAttribute('target'),'_blank');
   const overlap=await link.evaluate(a=>{const r=a.getBoundingClientRect(),t=a.closest('.board-row').querySelector('.board-info').getBoundingClientRect();return t.right>r.left+.5&&t.bottom>r.top&&t.top<r.bottom});
   assert.equal(overlap,false,'Wishlist link does not overlap the row text');
   await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');assert.equal(await link.evaluate(e=>e.matches(':focus-visible')),true);
   await link.evaluate(a=>a.addEventListener('click',e=>{e.preventDefault();window.testLinkActivated=true},{once:true}));
   await page.mouse.click(linkBox.x+2,linkBox.y+2);
   assert.equal(await page.evaluate(()=>window.testLinkActivated),true);
   assert.equal(await page.locator('#wishlist-modal-overlay').isVisible(),false,'Expanded link target does not open the editor');
   await page.evaluate(()=>goToPage('cemetery'));
   const before=await page.evaluate(()=>JSON.stringify(CEMETERY));
   for(const view of ['pending','sold']){
    await page.evaluate(view=>setSaleView(view),view);
    await page.locator('#cemetery-search').fill('inexistant');
    assert.match(await page.locator('.cemetery-empty').textContent(),/Aucune vente ne correspond/);
    const reset=page.getByRole('button',{name:'Effacer les filtres',exact:true});
    assert.ok((await reset.boundingBox()).height>=44);
    if([320,1440].includes(width))await page.screenshot({path:'/tmp/jtd-finishing-empty-'+width+'-'+theme+'.png'});
    await reset.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#cemetery-search').inputValue(),'');
    assert.equal(await page.locator('#cemetery-search').evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.locator('.sale-group').count(),1);
    assert.equal(await page.evaluate(()=>saleView),view,'Reset preserves the active tab');
   }
   await page.evaluate(()=>{setSaleView('pending');document.getElementById('cemetery-platform').value='PC';renderCemetery()});
   assert.match(await page.locator('.cemetery-empty').textContent(),/Aucune vente ne correspond/);
   await page.getByRole('button',{name:'Effacer les filtres',exact:true}).click();
   assert.equal(await page.locator('#cemetery-platform').inputValue(),'');
   assert.equal(await page.evaluate(()=>JSON.stringify(CEMETERY)),before,'Reset never changes sale records');
   await page.evaluate(()=>{CEMETERY=[];renderCemetery()});
   assert.match(await page.locator('.cemetery-empty').textContent(),/Aucun jeu à vendre pour le moment/);
   assert.equal(await page.getByRole('button',{name:'Effacer les filtres',exact:true}).count(),0);
   await page.evaluate(()=>setSaleView('sold'));
   assert.match(await page.locator('.cemetery-empty').textContent(),/Aucune vente enregistrée pour le moment/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   console.log('PASS UI finishing',width,theme,': compact 44px targets, independent clicks, keyboard, named arrivals, filtered and real empty sales');
   await context.close();
  }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
