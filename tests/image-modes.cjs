const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{})});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   await context.route('**/art-*.svg',route=>{
    const size=route.request().url().includes('portrait')?[180,320]:route.request().url().includes('wide')?[400,100]:[320,180];
    return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}"><rect width="100%" height="100%" fill="#e6bf24"/><circle cx="50%" cy="50%" r="40" fill="#b92a36"/></svg>`});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(url=>{
    GAMES= ['wide','portrait','exact'].map((shape,i)=>({...GAMES[0],id:'art-'+shape,nom:'Image '+shape,image:url+'/art-'+shape+'.svg',imageFit:i===1?'cover':'contain'}));
    saveGames();goToPage('collection');render();
   },url);
   for(const shape of ['wide','portrait','exact']){
    const frame=page.locator('#grid .card').filter({hasText:'Image '+shape}).locator('.card-banner');
    const art=frame.locator('.game-art-image');await art.evaluate(img=>img.decode());
    assert.equal(await art.evaluate(img=>getComputedStyle(img).objectFit),shape==='portrait'?'cover':'contain');
    const back=frame.locator('.game-art-backdrop');assert.equal(await back.getAttribute('aria-hidden'),'true');
    assert.equal(await back.evaluate(img=>getComputedStyle(img).display==='none'),shape==='portrait');
    if(shape!=='portrait')assert.match(await back.evaluate(img=>getComputedStyle(img).filter),/blur/);
    const box=await frame.boundingBox();assert.ok(Math.abs(box.width/box.height-16/9)<.02);
   }
   await page.screenshot({path:`/tmp/jtd-image-modes-${width}-${theme}.png`,fullPage:true});
   await page.evaluate(()=>{CEMETERY.push({...GAMES.find(g=>g.id==='art-portrait'),id:'art-sale',saleStatus:'pending'});goToPage('cemetery');renderCemetery();});
   assert.equal(await page.locator('#cemetery-list .game-art-image').first().evaluate(img=>getComputedStyle(img).objectFit),'cover','Cemetery shares the image mode');
   await page.evaluate(()=>goToPage('collection'));
   await page.evaluate(()=>openModal('art-wide'));
   await page.locator('#f-identity-summary .identity-edit-btn').click();
   assert.equal(await page.locator('#f-image-fit').inputValue(),'contain');
   // Native dropdowns must stay readable with either OS preference.
    const contrast=await page.locator('#f-image-fit option').evaluateAll(options=>{
     const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
     const luminance=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
     return options.map(option=>{const style=getComputedStyle(option),fg=luminance(style.color),bg=luminance(style.backgroundColor);return {ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),background:style.backgroundColor};});
    });
    for(const option of contrast){assert.ok(option.ratio>=4.5,'Dropdown text contrast');assert.ok(!option.background.includes('rgba'),'Dropdown options have an opaque background');}
   await page.locator('#f-image-fit').selectOption('cover');
   assert.equal(await page.locator('#image-preview .game-art-image').evaluate(img=>getComputedStyle(img).objectFit),'cover');
   await page.locator('#f-image-fit').selectOption('contain');
   assert.equal(await page.locator('#image-preview .game-art-image').evaluate(img=>getComputedStyle(img).objectFit),'contain');
   await page.locator('#f-image-fit').selectOption('cover');
   if([390,1440].includes(width))await page.screenshot({path:`/tmp/jtd-image-editor-${width}-${theme}.png`});
   await page.locator('#save-btn').click();
   await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='art-wide').imageFit),'cover');
   // All identity editors share the same control; transfers carry the saved choice.
   await page.evaluate(url=>{WISHLIST.push({id:'art-flow',nom:'Image transférée',plateforme:'Switch 2',image:url+'/art-wide.svg',imageFit:'cover'});saveWishlist();moveWishlistToArrivals('art-flow');},url);
   assert.equal(await page.locator('#a-image-fit').inputValue(),'cover');await page.locator('#a-save-btn').click();
   await page.evaluate(()=>addArrivalToCollection('art-flow'));assert.equal(await page.locator('#f-image-fit').inputValue(),'cover');await page.locator('#save-btn').click();
   assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='art-flow').imageFit),'cover');
   await page.evaluate(()=>openModal(null));assert.equal(await page.locator('#f-image-fit').inputValue(),'contain');await page.keyboard.press('Escape');
   // Both decorative and main image errors must preserve the original fallback.
   await page.evaluate(url=>{GAMES.push({id:'art-broken',nom:'Image absente',plateforme:'Switch 2',format:'Physique',image:url+'/missing.png'});saveGames();goToPage('collection');render();},url);
   const broken=page.locator('#grid .card').filter({hasText:'Image absente'});
   await broken.locator('.card-fallback').waitFor({state:'visible'});
   assert.equal(await broken.locator('.game-art-backdrop').count(),0);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS image modes',width,theme,': wide/portrait/exact, blur, crop, edit, reload, transfers, default, broken image');
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
