const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
async function checkTrap(page,id){
  const dialog=page.locator('#'+id);
  assert.match(await dialog.getAttribute('role'),/^(dialog|alertdialog)$/);
  assert.equal(await dialog.getAttribute('aria-modal'),'true');
  const title=await dialog.getAttribute('aria-labelledby');assert.ok(title ? await page.locator('#'+title).textContent() : await dialog.getAttribute('aria-label'));
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
   await page.locator('#collection-view-switch [data-view="cards"]').click();
   const card=page.locator('#page-collection .card-open-control').first();await card.focus();await page.keyboard.press('Enter');
   await page.keyboard.press('Escape');
   assert.equal(await card.evaluate(el=>el===document.activeElement),true,'Keyboard opening ignores a recent pointer on the view switch');
   await page.keyboard.press('Enter');
   await checkTrap(page,'modal-overlay');
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>document.activeElement.matches('#page-collection .card-open-control')),true,'Rebuilt card opening control receives focus');
   // Required-field error is linked, focused, announced, and cleared after correction.
   await page.locator('#add-btn').click();await page.locator('#save-btn').click();
   assert.equal(await page.locator('#f-nom').getAttribute('aria-invalid'),'true');
   assert.match(await page.locator('#f-nom').getAttribute('aria-describedby'),/f-nom-error/);
   assert.equal(await page.locator('#f-nom-error').getAttribute('role'),'alert');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'f-nom');
   await page.locator('#f-nom').fill('Saisie fictive à conserver');assert.equal(await page.locator('#f-nom-error').isVisible(),false);
   await page.locator('#modal-overlay').click({position:{x:1,y:1}});assert.equal(await page.locator('#f-nom').inputValue(),'Saisie fictive à conserver');await page.keyboard.press('Escape');
   await page.locator('#confirm-modal-confirm-btn').click();
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
    await page.locator('#confirm-modal-confirm-btn').click();
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
   // Drawers use the same focus lifecycle; rebuilding filters returns to a live trigger.
   await page.evaluate(()=>goToPage('collection'));
   if(width<=1100){
    await page.locator('#global-filter-toggle').click();
    await checkTrap(page,'collection-sidebar');
    assert.equal(await page.locator('.topnav').evaluate(el=>el.inert),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'global-filter-toggle');
    await page.locator('#global-filter-toggle').click();
    await page.locator('#platform-list [role="button"]').nth(1).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'global-filter-toggle');
    assert.equal(await page.locator('.topnav').evaluate(el=>el.inert),false);
    await page.locator('#global-filter-toggle').click();
    await page.locator('#mobile-backdrop').click({position:{x:width-1,y:400}});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'global-filter-toggle');
   }
   // Status controls are siblings of the native sheet button, with predictable focus.
   await page.evaluate(()=>{
    GAMES=[{id:'focus-a',nom:'Jeu fictif A',plateforme:'PC',format:'Physique',status:'a_jouer'},{id:'focus-b',nom:'Jeu fictif B',plateforme:'PC',format:'Physique',status:'a_jouer'}];
    state.platform=null;state.status=null;state.search='';state.collector=false;state.japanese=false;state.bundle=false;state.media='physical';state.contentType=null;render();
   });
   assert.equal(await page.locator('#grid [role="button"] button').count(),0,'No nested buttons in a button role');
   const badge=page.locator('#grid .card-status-badge').first();
   await badge.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#grid .card-status-menu').first().evaluate(el=>el.contains(document.activeElement)),true);
   await page.keyboard.press('Escape');
   assert.equal(await badge.evaluate(el=>el===document.activeElement),true);
   await badge.click();await page.locator('#search-input').click();
   assert.equal(await page.locator('#grid .card-status-menu:not(.hidden)').count(),0);
   await badge.click();await page.locator('#grid .card-status-badge').nth(1).click();
   assert.equal(await page.locator('#grid .card-status-menu:not(.hidden)').count(),1);
   await page.keyboard.press('Escape');
   await badge.click();await page.locator('#grid .card').first().locator('[data-status="termine"]').click();
   assert.equal(await badge.evaluate(el=>el===document.activeElement),true,'Status redraw restores its control');
   await page.evaluate(()=>{state.status='termine';render();});
   await badge.click();await page.locator('#grid [data-status="a_jouer"]').click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'search-input','Empty filtered grid has a focus fallback');
   // Both dropdowns keep a theme-aware keyboard outline inside the black header.
   for(const [trigger,item] of [['[data-page="library"]','#collection-views button'],['#profile-menu-btn','.profile-menu-item']]){
    await page.locator(trigger).click();await page.keyboard.press('Tab');await page.locator(item).first().focus();
    assert.equal(await page.locator(item).first().evaluate(el=>getComputedStyle(el).outlineColor),await page.evaluate(()=>{const probe=document.createElement('span');probe.style.color='var(--ui-accent)';document.body.append(probe);const c=getComputedStyle(probe).color;probe.remove();return c;}));
    await page.keyboard.press('Escape');
    await page.mouse.click(width-2,800);
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>showToast('Une confirmation fictive suffisamment longue pour revenir à la ligne sur un écran mobile, sans masquer la fin du message.','Annuler',()=>{}));
   assert.equal(await page.locator('#toast-stack').getAttribute('role'),'status');
   assert.equal(await page.locator('.toast-message').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   assert.equal(await page.locator('.toast').evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.equal(await page.locator('#auth-loading .eyebrow').evaluate(el=>getComputedStyle(el).animationName),'none');
   // Capture the requested scroll behavior without depending on animation timing.
   await page.evaluate(()=>{window.originalScrollTo=window.scrollTo;window.scrollTo=options=>{window.requestedScroll=options.behavior;};});
   await page.locator('[data-page="journal"]').click();
   assert.equal(await page.evaluate(()=>window.requestedScroll),'instant');
   await page.evaluate(()=>{window.scrollTo=window.originalScrollTo;goToPage('collection');});
   // A controllable clock proves timeout suspension for both pointer and keyboard.
   await page.clock.install();
   await page.mouse.move(0,0);
   await page.evaluate(()=>{document.getElementById('search-input').focus();showToast('Confirmation fictive','Annuler',()=>{window.toastActionRan=true;},1000);});
   await page.clock.runFor(200);
   await page.locator('.toast-action').focus();
   await page.clock.runFor(2000);
   assert.equal(await page.locator('.toast.leaving').count(),0,'Keyboard focus pauses dismissal');
   await page.locator('#search-input').focus();
   await page.locator('.toast').hover();
   await page.clock.runFor(2000);
   assert.equal(await page.locator('.toast.leaving').count(),0,'Pointer hover pauses dismissal');
   await page.mouse.move(0,0);
   await page.clock.runFor(1100);
   assert.equal(await page.locator('.toast').count(),0,'Dismissal resumes after leaving');
   await page.evaluate(()=>showToast('Autre confirmation','Annuler',()=>{window.toastActionRan=true;}));
   await page.locator('.toast-action').click();
   assert.equal(await page.evaluate(()=>window.toastActionRan),true);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS dialog keyboard and UI polish',width,theme,': dialogs, drawers, status focus, toasts, reduced motion, menu outlines');
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

