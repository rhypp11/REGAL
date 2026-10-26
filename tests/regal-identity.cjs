/* REGAL identity and viewport checks, always with fictitious sandbox data. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try {
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   for(const name of ['home','collection','cemetery','profile','new','wishlist','arrival','sale','platforms','drawer','import']){
    await page.evaluate(name=>{
     closeModal();closeWishlistModal();closeArrivalModal();closeSaleModal();closePlatformModal();closeMobileDrawers();
     document.getElementById('profile-menu').classList.add('hidden');
     document.getElementById('cemetery-import-overlay').classList.add('hidden');
     goToPage(['home','collection','cemetery'].includes(name)?name:'collection');
     if(name==='profile')document.getElementById('profile-menu').classList.remove('hidden');
     if(name==='new')openModal(null);
     if(name==='wishlist')openWishlistModal(null);
     if(name==='arrival')openArrivalModal(null);
     if(name==='sale'){if(!CEMETERY.some(g=>g.id==='regal-sale'))CEMETERY.push({...GAMES[0],id:'regal-sale',saleStatus:'pending'});openSaleModal('regal-sale');}
     if(name==='platforms')openPlatformModal();
     if(name==='drawer'&&innerWidth<821)openMobileDrawer(document.getElementById('collection-sidebar'));
    },name);
    if(name==='import')await page.locator('#cemetery-import-input').setInputFiles({name:'regal-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{nom:'Vente fictive REGAL',plateforme:'Nintendo Switch',saleStatus:'pending'}]))});
    const state=await page.evaluate(()=>{
     const logo=document.querySelector('.regal-logo');const rect=logo.getBoundingClientRect();
     return {preview:window.JTD_PREVIEW_MODE,overflow:document.documentElement.scrollWidth>innerWidth,canvas:getComputedStyle(document.body).backgroundColor,header:getComputedStyle(document.querySelector('.topnav')).backgroundColor,logo:logo.complete&&logo.naturalWidth>0,logoRight:rect.right,themeButtonLeft:document.getElementById('theme-toggle').getBoundingClientRect().left,title:document.title};
    });
    assert.equal(state.preview,true);assert.equal(state.overflow,false,`${width} ${theme} ${name} overflow`);
    assert.equal(state.canvas,theme==='light'?'rgb(245, 246, 247)':'rgb(23, 25, 27)');
    assert.equal(state.header,'rgb(25, 94, 112)');assert.equal(state.logo,true);assert.ok(state.logoRight<=state.themeButtonLeft);assert.match(state.title,/^REGAL \|/);
    await page.screenshot({path:path.join(os.tmpdir(),`jtd-regal-${width}-${theme}-${name}.png`),fullPage:true});
   }
   assert.deepEqual(errors,[]);console.log(`PASS REGAL ${width}px ${theme}: 11 pages, menus and dialogs; sandbox, palette, logo, overflow, console`);
   await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
