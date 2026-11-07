const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
(async()=>{
 const server=createSandboxServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{
    CEMETERY.push({...GAMES[0],id:'audit-sale',saleStatus:'pending'});
    LEGACY_JOURNAL=[{archive:'préservée'},{regalJournal:2,entries:[
     {id:'audit-done',group:'completed',name:'Aventure fictive',platform:'PC',date:'2026-03-21',format:'digital',mode:'solo',completion:'finished',notes:['A','B','C','D','S'],feeling:'love',comment:'Avis fictif'},
     {id:'audit-next',group:'backlog',name:'À jouer fictif',platform:'PC',format:'digital'},
     {id:'audit-release',group:'release',name:'Sortie fictive',platform:'PC',date:'2027',format:'digital'}
    ]}];
   });
   const before=await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST,cemetery:CEMETERY,journal:LEGACY_JOURNAL}));
   const samples=[];
   for(const scene of ['collection','arrival','wishlist','journal-new','journal-game','journal-completion','journal-comment','backlog','release','sale']){
    await page.evaluate(scene=>{
     if(scene==='collection')openModal(null);
     if(scene==='arrival')openArrivalModal(null);
     if(scene==='wishlist')openWishlistModal(null);
     if(scene==='sale')openSaleModal('audit-sale');
     if(!['collection','arrival','wishlist','sale'].includes(scene)){
      goToPage('journal');
      document.getElementById('journal-year').value='2026';
      renderJournal();
     }
    },scene);
    if(scene==='journal-new')await page.locator('[data-journal-add="completed"]').click();
    else if(scene.startsWith('journal-')){
     await page.locator('#journal-completed .journal-row').click();
     assert.equal(await page.locator('#journal-close').innerText(),'Fermer');
     if(scene==='journal-game')await page.locator('#journal-game-summary .identity-edit-btn, #journal-dialog-body .identity-edit-btn').first().click();
     if(scene==='journal-completion')await page.locator('#journal-edit-completion').click();
     if(scene==='journal-comment')await page.locator('#journal-edit-comment').click();
    }else if(scene==='backlog'||scene==='release'){
     await page.locator('[data-journal-tab="'+scene+'"]').click();
     await page.locator('#journal-'+scene+' .journal-row').click();
     if(scene==='release')await page.locator('#journal-edit-release').click();
    }
    const overlay=page.locator('.sheet-dialog:not(.hidden)');
    const labels=await overlay.locator('.field > label:visible').evaluateAll(elements=>elements.map(element=>({
     text:element.textContent,for:element.htmlFor,size:getComputedStyle(element).fontSize,font:getComputedStyle(element).fontFamily
    })));
    assert.ok(labels.length,'Fields have labels in '+scene);
    assert.ok(labels.every(label=>label.size==='12px'),'Label typography is consistent in '+scene+': '+JSON.stringify(labels));
    const input=overlay.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):visible,textarea:visible').first();
    samples.push(await input.evaluate(element=>({font:getComputedStyle(element).fontFamily,size:getComputedStyle(element).fontSize})));
    if(scene.startsWith('journal-')||scene==='backlog'||scene==='release'){
     assert.ok(labels.every(label=>label.for),'Journal labels target their controls');
    }
    const footer=overlay.locator('.modal-edit-actions');
    await footer.locator('[data-modal-action="save"]').scrollIntoViewIfNeeded();
    const actions=await footer.locator('[data-modal-action]:visible').evaluateAll(elements=>elements.map(element=>{
     const r=element.getBoundingClientRect();return {role:element.dataset.modalAction,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
    }));
    const primary=actions.filter(action=>['delete','cancel','save'].includes(action.role));
    assert.deepEqual(primary.map(action=>action.role),primary.some(action=>action.role==='delete')?['delete','cancel','save']:['cancel','save']);
    assert.ok(primary.every(action=>Math.abs(action.top-primary[0].top)<1),'Primary actions share a row in '+scene);
    assert.ok(actions.every(action=>action.left>=0&&action.right<=width+1&&action.bottom<=901),'Actions stay accessible in '+scene);
    assert.equal(await overlay.locator('.modal').evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
    if(scene==='journal-completion'||scene==='journal-game')await page.screenshot({path:'audit-'+scene+'-'+width+'-'+theme+'.png'});
    await footer.locator('[data-modal-action="cancel"]').click();
    assert.equal(await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST,cemetery:CEMETERY,journal:LEGACY_JOURNAL})),before,'Cancel preserves every list');
   }
   assert.ok(samples.every(sample=>sample.font===samples[0].font),'Same font across editors');
   // Game names have the same emphasis in all four identity editors.
   assert.ok(samples.slice(0,5).every(sample=>sample.size===samples[0].size),'Same game-name size across editors');
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS sheet consistency',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
