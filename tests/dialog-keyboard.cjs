const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
async function checkTrap(page,id){
  const dialog=page.locator('#'+id);
  assert.match(await dialog.getAttribute('role'),/^(dialog|alertdialog)$/);
  assert.equal(await dialog.getAttribute('aria-modal'),'true');
  const title=await dialog.getAttribute('aria-labelledby');assert.ok(await page.locator('#'+title).textContent());
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'Focus starts inside '+id);
  for(const direction of ['forward','backward']){
    await dialog.evaluate((el,direction)=>{
      const items=[...el.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>e.tabIndex>=0&&!e.disabled&&e.getClientRects().length&&!e.closest('.hidden,[inert]'));
      (direction==='forward'?items.at(-1):items[0]).focus();
    },direction);
    await page.keyboard.press(direction==='forward'?'Tab':'Shift+Tab');
    assert.equal(await dialog.evaluate((el,direction)=>{
      const items=[...el.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>e.tabIndex>=0&&!e.disabled&&e.getClientRects().length&&!e.closest('.hidden,[inert]'));
      return document.activeElement===(direction==='forward'?items[0]:items.at(-1));
    },direction),true,'Tab wraps '+direction+' '+id);
  }
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>goToPage('collection'));
   for(const [name,id]of [['new','modal-overlay'],['edit','modal-overlay'],['wishlist','wishlist-modal-overlay'],['arrival','arrival-modal-overlay'],['platforms','platform-modal-overlay'],['sale','sale-modal-overlay']]){
    await page.evaluate(name=>{
     document.getElementById('add-btn').focus();
     if(name==='new')openModal(null);
     if(name==='edit')openModal(GAMES[0].id);
     if(name==='wishlist')openWishlistModal(WISHLIST[0].id);
     if(name==='arrival')openArrivalModal(ARRIVALS[0].id);
     if(name==='platforms')openPlatformModal();
     if(name==='sale'){CEMETERY=[{...GAMES[0],id:'keyboard-sale',saleStatus:'pending'}];openSaleModal('keyboard-sale');}
    },name);
    await checkTrap(page,id);
    await page.locator('#'+id).click({position:{x:1,y:1}});
    assert.equal(await page.locator('#'+id).isVisible(),true,'Backdrop keeps '+name+' open');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#'+id).isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'add-btn','Return focus '+name);
    assert.equal(await page.locator('.topnav').evaluate(el=>el.inert),false,'Background released');
   }
   // Keyboard entry and restoring a rebuilt card after saving.
   const card=page.locator('#page-collection .card').first();await card.focus();await page.keyboard.press('Enter');
   await checkTrap(page,'modal-overlay');
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>document.activeElement.matches('#page-collection .card')),true,'Rebuilt card receives focus');
   // Required-field error is linked, focused, announced, and cleared after correction.
   await page.locator('#add-btn').click();await page.locator('#save-btn').click();
   assert.equal(await page.locator('#f-nom').getAttribute('aria-invalid'),'true');
   assert.match(await page.locator('#f-nom').getAttribute('aria-describedby'),/f-nom-error/);
   assert.equal(await page.locator('#f-nom-error').getAttribute('role'),'alert');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'f-nom');
   await page.locator('#f-nom').fill('Saisie fictive à conserver');assert.equal(await page.locator('#f-nom-error').isVisible(),false);
   await page.locator('#modal-overlay').click({position:{x:1,y:1}});assert.equal(await page.locator('#f-nom').inputValue(),'Saisie fictive à conserver');await page.keyboard.press('Escape');
   // Confirmations cancel only themselves, and never execute deletion on Escape.
   const count=await page.evaluate(()=>GAMES.length);
   await page.evaluate(()=>openModal(GAMES[0].id));
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   await page.locator('#delete-btn').click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-modal-cancel-btn','Confirmation starts on the safe action');
   await checkTrap(page,'confirm-modal-overlay');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-modal-confirm-btn'); // checkTrap finishes at the last action
   await page.keyboard.press('Escape');assert.equal(await page.locator('#modal-overlay').isVisible(),true);assert.equal(await page.evaluate(()=>GAMES.length),count);await page.keyboard.press('Escape');
   for(const prefix of ['f','a','w']){
    await page.evaluate(prefix=>{if(prefix==='f')openModal(null);if(prefix==='a')openArrivalModal(null);if(prefix==='w')openWishlistModal(null);document.getElementById(prefix+'-nom').value='Validation fictive';setSelectValueAndSync(prefix+'-plateforme','');},prefix);
    await page.locator('#'+(prefix==='f'?'save-btn':prefix+'-save-btn')).click();
    assert.equal(await page.locator('#'+prefix+'-plateforme').getAttribute('aria-invalid'),'true');
    assert.equal(await page.locator('#'+prefix+'-plateforme-error').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.activeElement.id),prefix+'-plateforme');
    await page.keyboard.press('Escape');
   }
   // Sale -> game editor: Escape closes the child, then the sale, one at a time.
   await page.evaluate(()=>openSaleModal('keyboard-sale'));await page.locator('#sale-identity .identity-edit-btn').click();
   await checkTrap(page,'modal-overlay');assert.equal(await page.locator('#sale-modal-overlay').evaluate(el=>el.inert),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#sale-modal-overlay').isVisible(),true);assert.equal(await page.locator('#sale-modal-overlay').evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Escape');
   // Cancelled transfers retain both lists and draft changes do not save.
   const boards=await page.evaluate(()=>JSON.stringify([GAMES,ARRIVALS,WISHLIST]));
   for(const name of ['order','receive','return']){
    await page.evaluate(name=>{if(name==='order')moveWishlistToArrivals(WISHLIST[0].id);if(name==='receive')addArrivalToCollection(ARRIVALS[0].id);if(name==='return')moveArrivalToWishlist(ARRIVALS[0].id);},name);
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify([GAMES,ARRIVALS,WISHLIST])),boards,'Cancelled '+name);
   }
   // First Escape closes inline platform creation, second closes the dialog.
   await page.evaluate(()=>openPlatformModal());await page.locator('#new-platform-toggle').click();await page.locator('#new-platform-name').fill('Brouillon fictif');await page.keyboard.press('Escape');assert.equal(await page.locator('#platform-modal-overlay').isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'new-platform-toggle');await page.keyboard.press('Escape');
   // Import has the same focus trap and explicit cancellation, without writes.
   await page.locator('#cemetery-import-input').setInputFiles({name:'keyboard.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{nom:'Import fictif',plateforme:'Nintendo Switch'}]))});
   await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});await checkTrap(page,'cemetery-import-overlay');await page.keyboard.press('Escape');assert.equal(await page.locator('#cemetery-import-overlay').isVisible(),false);assert.equal(await page.evaluate(()=>CEMETERY.length),1);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS dialog keyboard',width,theme,': focus, Tab, Escape, nested dialogs, backdrop, validation, transfer/import cancellation');
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

