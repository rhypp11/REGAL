const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try {
  for(const width of [320,390,820,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:800},colorScheme:theme});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   for(const scene of ['collection','new','wishlist','arrival','sale']){
    await page.evaluate(scene=>{
     closeModal();closeWishlistModal();closeArrivalModal();document.getElementById('sale-modal-overlay').classList.add('hidden');
     if(scene==='collection'||scene==='new')openModal(scene==='new'?null:GAMES[0].id);
     if(scene==='wishlist')openWishlistModal(WISHLIST[0].id);
     if(scene==='arrival')openArrivalModal(ARRIVALS[0].id);
     if(scene==='sale'){CEMETERY.push({...GAMES[0],id:'modal-sale',saleStatus:'pending'});openSaleModal('modal-sale');}
    },scene);
    if(scene==='collection'){
     assert.equal(await page.locator('#modal-title').innerText(),'Fiche du jeu');
     assert.equal(await page.locator('#cancel-btn').innerText(),'Fermer');
     assert.equal(await page.locator('#save-btn').isVisible(),false,'Consultation does not offer to save');
     assert.equal(await page.locator('#delete-btn').isVisible(),false,'Consultation keeps deletion out of the way');
     const before=await page.evaluate(()=>JSON.stringify(GAMES));
     if([320,390,1440].includes(width))await page.screenshot({path:`/tmp/jtd-sheet-view-${width}-${theme}.png`,fullPage:true});
     await page.locator('#f-context-summary .context-edit-btn').click();
     assert.equal(await page.locator('#save-btn').isVisible(),true,'Purchase pencil enters editing');
     assert.equal(await page.locator('#cancel-btn').innerText(),'Annuler');
     await page.locator('#f-source').fill('Modification à annuler');
     await page.locator('#cancel-btn').click();
     assert.equal(await page.evaluate(()=>JSON.stringify(GAMES)),before,'Cancel keeps the game unchanged');
     await page.evaluate(()=>openModal(GAMES[0].id));
     assert.equal(await page.locator('#save-btn').isVisible(),false,'Reopening returns to consultation');
     await page.locator('#f-identity-summary .identity-edit-btn').click();
     assert.equal(await page.locator('#save-btn').isVisible(),true,'Game pencil enters editing');
    }
    const footer=page.locator('.modal-overlay:not(.hidden) .modal-edit-actions');
    await footer.locator('[data-modal-action="save"]').scrollIntoViewIfNeeded();
    const result=await footer.evaluate(el=>{
     const buttons=[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length);
     return buttons.map(b=>{const r=b.getBoundingClientRect();return {role:b.dataset.modalAction,x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width};});
    });
    const cancel=result.find(b=>b.role==='cancel'),save=result.find(b=>b.role==='save');
    assert.ok(Math.abs(cancel.y-save.y)<1,'Cancel and Save share the last row: '+scene);
    assert.ok(cancel.right<=save.x+1,'Cancel precedes Save');
    for(const b of result){assert.ok(b.x>=0&&b.right<=width+1,'No horizontal overflow');assert.ok(b.height>=40,'Touch target');if(width<=820&&!['cancel','save'].includes(b.role))assert.ok(b.bottom<=cancel.y+1,'Context actions precede primary pair');}
    assert.ok(save.bottom<=801&&save.y>=0,'Save remains reachable');
    const footerBox=await footer.boundingBox();
    assert.ok(footerBox.height<=(width>820?70:125),'Footer stays compact');
    if(width>820)for(const b of result)assert.ok(Math.abs((b.y+b.height/2)-(save.y+save.height/2))<1,'Desktop actions share one line');
    if([390,1440].includes(width)&&theme==='light')await page.screenshot({path:'/tmp/jtd-modal-'+scene+'-'+width+'.png',fullPage:true});
   }
   assert.deepEqual(errors,[]);await context.close();console.log('PASS modal actions',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

