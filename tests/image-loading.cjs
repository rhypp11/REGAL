const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440]){
   const context=await sandboxContext(browser,{viewport:{width,height:900},reducedMotion:'reduce'});
   const requested=new Set();let release;
   const gate=new Promise(r=>release=r);
   await context.route('**/load-art-*.svg',async route=>{
    requested.add(Number(/load-art-(\d+)/.exec(route.request().url())[1]));
    await gate;
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#b5cbaf"/></svg>'});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const url='http://127.0.0.1:'+server.address().port;
   await page.goto(url);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(url=>{
    GAMES=Array.from({length:200},(_,i)=>({id:'load-'+i,nom:'Jeu '+String(i).padStart(3,'0'),plateforme:'Switch 2',format:'Physique',image:url+'/load-art-'+i+'.svg'}));
    ARRIVALS=[];WISHLIST=[];CEMETERY=[];
    render();renderArrivals();renderWishlist();renderCemetery();
   },url);
   await page.waitForTimeout(100);
   assert.equal(requested.size,0,'The hidden collection does not fetch deferred art');
   await page.evaluate(()=>goToPage('collection'));
   await page.waitForFunction(()=>[...document.querySelectorAll('#grid .card')].slice(0,12).every(card=>[...card.querySelectorAll('.game-art-frame img')].every(img=>img.loading==='eager')));
   const frame=page.locator('#grid .card-banner').first();
   const before=await frame.boundingBox();
   release();
   await page.locator('#grid .game-art-image').evaluateAll(imgs=>Promise.all(imgs.slice(0,12).map(img=>img.decode())));
   await page.waitForTimeout(200);
   const initial=requested.size;
   assert.ok(initial>=12 && initial<100,'Only the initial viewport and nearby art are requested: '+initial);
   for(let i=0;i<12;i++)assert.ok(requested.has(i),'Initial art '+i+' is fetched immediately');
   assert.equal(requested.has(199),false,'The last image is not requested at opening');
   assert.equal(await page.locator('#grid .card').last().locator('.game-art-image').getAttribute('loading'),'lazy');
   assert.equal(await page.locator('#grid .card').last().locator('.game-art-backdrop').getAttribute('loading'),'lazy');
   const after=await frame.boundingBox();
   assert.ok(Math.abs(before.height-after.height)<1 && Math.abs(before.width-after.width)<1,'Loading art does not change the reserved frame');
   assert.ok(Math.abs(after.width/after.height-16/9)<.02);
   assert.equal(requested.has(150),false);
   await page.evaluate(()=>openModal('load-150'));
   await page.locator('#f-identity-summary .game-art-image').evaluate(img=>img.decode());
   assert.equal(await page.locator('#f-identity-summary .game-art-image').getAttribute('loading'),'eager');
   assert.equal(await page.locator('#f-identity-summary .game-art-backdrop').getAttribute('loading'),'eager');
   assert.ok(requested.has(150),'Opening a distant game loads its modal art immediately');
   await page.keyboard.press('Escape');
   await page.locator('#grid .card').last().scrollIntoViewIfNeeded();
   await page.locator('#grid .card').last().locator('.game-art-image').evaluate(img=>img.decode());
   assert.ok(requested.has(199),'Scrolling reveals and loads distant art');
   await page.evaluate(()=>{state.search='Jeu 190';render()});
   await page.locator('#grid .game-art-image').evaluate(img=>img.decode());
   assert.equal(await page.locator('#grid .game-art-image').getAttribute('loading'),'eager','A newly filtered first result is immediate');
   assert.ok(requested.has(190));
   // Arrivals/Wishlist/Journal share native deferred board thumbnails; their modal identity remains immediate.
   const policies=await page.evaluate(()=>{
    const holder=document.createElement('div');
    holder.innerHTML=boardThumb(GAMES[0])+identitySummaryHtml(GAMES[0]);
    return [...holder.querySelectorAll('img.game-art-image,img.game-art-backdrop')].map(img=>img.loading);
   });
   assert.deepEqual(policies,['lazy','lazy','eager','eager']);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   console.log('PASS deferred images',width,':',initial+'/200 requested at opening; hidden list, both layers, stable frames, modal, scroll and filter');
   await context.close();
  }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
