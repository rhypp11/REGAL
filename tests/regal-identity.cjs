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
     return {preview:window.JTD_PREVIEW_MODE,overflow:document.documentElement.scrollWidth>innerWidth,canvas:getComputedStyle(document.body).backgroundColor,header:getComputedStyle(document.querySelector('.topnav')).backgroundColor,logo:logo.complete&&logo.naturalWidth>0,logoSource:logo.currentSrc,logoRight:rect.right,searchButtonLeft:document.getElementById('global-search-open').getBoundingClientRect().left,title:document.title};
    });
    assert.equal(state.preview,true);assert.equal(state.overflow,false,`${width} ${theme} ${name} overflow`);
    assert.equal(state.canvas,'rgb(21, 22, 24)');
    assert.ok(state.logoSource.includes(width<=360?'logo-regal-mark.svg':'brand-header.svg'),'Compact screens keep only the current logo mark');
    assert.equal(state.header,'rgb(16, 16, 16)');assert.equal(state.logo,true);assert.ok(state.logoRight<=state.searchButtonLeft);assert.match(state.title,/^REGAL \|/);
    await page.screenshot({path:path.join(os.tmpdir(),`jtd-regal-${width}-${theme}-${name}.png`),fullPage:true});
   }
   const branding=await page.evaluate(async()=>{
    const manifest=await (await fetch('manifest.json')).json();
    const icons=await Promise.all([...manifest.icons.map(icon=>icon.src),document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href')].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({src,width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(Error(src));img.src=src;})));
    return {icons,loading:getComputedStyle(document.querySelector('.auth-loading .eyebrow')).backgroundImage,login:getComputedStyle(document.querySelector('.login-brand .eyebrow')).backgroundImage};
   });
   assert.deepEqual(branding.icons.map(x=>[x.width,x.height]),[[192,192],[512,512],[180,180]]);
   assert.ok(branding.icons.every(x=>x.src.startsWith('logo-regal-')));assert.ok(branding.loading.includes('brand-header.svg'));assert.ok(branding.login.includes('brand-header.svg'));
   assert.deepEqual(errors,[]);console.log(`PASS REGAL ${width}px ${theme}: 11 pages, menus and dialogs; sandbox, palette, logo, overflow, console`);
   await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
