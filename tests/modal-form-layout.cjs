/* Local fake data only; sandboxContext blocks external requests. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const longTitle='Une aventure au titre extrêmement long — édition complète avec tous ses épisodes '.repeat(5);
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,820,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:700},colorScheme:theme});
   await context.route('**/polish-fixture.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="teal"/></svg>'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   for(const prefix of ['f','a','w']){
    await page.evaluate(({prefix,longTitle})=>{
     closeModal();closeArrivalModal();closeWishlistModal();
     if(prefix==='f')openModal(null);
     if(prefix==='a')openArrivalModal(null);
     if(prefix==='w')openWishlistModal(null);
     document.getElementById(prefix+'-nom').value=longTitle;
    },{prefix,longTitle});
    const editor=page.locator('#'+prefix+'-identity-editor');
    const controls=editor.locator('.identity-collector-control');
    await controls.first().click();await controls.last().click();
    assert.equal(await page.locator('#'+prefix+'-collector').isChecked(),true);
    assert.equal(await page.locator('#'+prefix+'-japanese').isChecked(),true);
    const boxes=await controls.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {y:r.y,height:r.height};}));
    assert.ok(Math.abs(boxes[0].y-boxes[1].y)<1,'Optional edition choices share a compact row');
    assert.ok(boxes.every(r=>r.height>=44),'Edition labels keep touch targets');
    const preview=editor.locator('.image-preview-compact');
    await preview.scrollIntoViewIfNeeded();
    const box=await preview.boundingBox();
    assert.ok(box.width>=112&&Math.abs(box.width/box.height-16/9)<.01,'Horizontal image preview has usable dimensions');
    assert.equal(await preview.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Empty preview label does not clip');
    // The same geometry must hold with an actual horizontal image.
    await page.locator('#'+prefix+'-image').fill('http://127.0.0.1:'+server.address().port+'/polish-fixture.svg');
    await preview.locator('.game-art-image').evaluate(img=>img.decode());
    assert.equal(await preview.locator('.game-art-image').evaluate(img=>getComputedStyle(img).objectFit),'contain','Image is not cropped');
    const modal=editor.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," modal ")]');
    const save=modal.locator('[data-modal-action="save"]');await save.scrollIntoViewIfNeeded();
    const saveBox=await save.boundingBox();assert.ok(saveBox.y>=0&&saveBox.y+saveBox.height<=701,'Save reachable with a short viewport');
    const overflow=await modal.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,children:[...el.querySelectorAll('*')].filter(c=>c.getBoundingClientRect().right>el.getBoundingClientRect().right).map(c=>({html:c.outerHTML,width:c.getBoundingClientRect().width}))}));
    assert.ok(overflow.scroll<=overflow.width+1,'Long title and form do not overflow horizontally: '+JSON.stringify(overflow));
    if([390,1440].includes(width))await page.screenshot({path:`/tmp/jtd-polish-${prefix}-${width}-${theme}.png`});
   }
   await page.keyboard.press('Escape');
   const before=await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST,cemetery:CEMETERY}));
   await page.locator('#cemetery-import-input').setInputFiles({name:'long-list.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(Array.from({length:40},(_,i)=>({nom:longTitle+i,plateforme:'Nintendo Switch',saleStatus:'pending'}))))});
   await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
   const rows=page.locator('.cemetery-import-row');assert.equal(await rows.count(),40);
   await rows.last().scrollIntoViewIfNeeded();
   const apply=page.locator('#cemetery-import-apply');await apply.scrollIntoViewIfNeeded();
   const applyBox=await apply.boundingBox();assert.ok(applyBox.y>=0&&applyBox.y+applyBox.height<=701,'Long import keeps action reachable');
   assert.equal(await page.locator('#cemetery-import-overlay .cemetery-import-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Long import titles do not overflow');
   await page.locator('#cemetery-import-cancel').click();
   assert.equal(await page.evaluate(()=>JSON.stringify({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST,cemetery:CEMETERY})),before,'Cancel keeps data unchanged');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS modal form layout',width,theme);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});


