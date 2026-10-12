/* Compare the previous CSS with the cleaned CSS against identical current markup. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const baseline=fs.readFileSync(process.env.JTD_BASELINE_CSS,'utf8');
const path=require('node:path');
const baselineDir=process.env.JTD_BASELINE_DIR;
const properties=['display','position','width','height','min-width','max-width','min-height','max-height','box-sizing','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-top-color','border-right-color','border-bottom-color','border-left-color','border-radius','background-color','background-image','background-size','background-position','color','font-family','font-size','font-weight','line-height','letter-spacing','text-transform','text-align','white-space','text-overflow','overflow-x','overflow-y','opacity','visibility','transform','top','right','bottom','left','z-index','box-shadow','outline-color','outline-width','outline-offset','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','justify-content','justify-self','grid-template-columns','grid-template-rows','grid-column-start','grid-column-end','grid-row-start','grid-row-end','column-gap','row-gap','object-fit','object-position','cursor','pointer-events','content'];
// Compare all pages and unaffected dialogs. The three deliberately polished game
// forms are covered by modal-form-layout.cjs, modal-actions and dialog-keyboard.
// Deliberate artwork layers are covered by image-modes.cjs; surrounding layout is compared.
const scenes=['collection','status','wishlist','arrivals','cemetery','drawer','collection-drawer','cemetery-drawer','profile','order','receive','edit','new','wishlist-edit','arrival-edit','sale','import','platforms'];
async function snapshot(page){
 await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 return page.evaluate(properties=>[...document.body.querySelectorAll('*')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('.game-art-frame, #modal-overlay > .modal, #arrival-modal-overlay > .modal, #wishlist-modal-overlay > .modal')).map(el=>{
  const rect=el.getBoundingClientRect();
  const styles=pseudo=>{const css=getComputedStyle(el,pseudo);return Object.fromEntries(properties.map(key=>[key,css.getPropertyValue(key)]));};
  return {tag:el.tagName,id:el.id,class:el.className?.baseVal??el.className,rect:[rect.x,rect.y,rect.width,rect.height],style:styles(),before:styles('::before'),after:styles('::after')};
 }),properties);
}
async function scene(page,name){
 await page.evaluate(name=>{
  closeModal();closeArrivalModal();closeWishlistModal();closePlatformModal();closeSaleModal();closeMobileDrawers();document.getElementById('cemetery-import-overlay').classList.add('hidden');document.getElementById('profile-menu').classList.add('hidden');
  state.platform=null;state.search='';state.status=null;state.collector=false;state.japanese=false;
  if(['wishlist','arrivals','order','receive','drawer'].includes(name)){
   goToPage('home');setHomeBoard(name==='arrivals'||name==='receive'?'arrivals':'wishlist');
  } else goToPage(name.startsWith('cemetery')?'cemetery':'collection');
  if(name==='order')moveWishlistToArrivals(WISHLIST[0].id);
  if(name==='receive')addArrivalToCollection(ARRIVALS[0].id);
  if(name==='edit')openModal(GAMES.find(game=>game.format==='Physique').id);
  if(name==='platforms')openPlatformModal();
  if(name==='profile')document.getElementById('profile-menu').classList.remove('hidden');
  if(name==='drawer')openMobileDrawer(document.getElementById('home-sidebar'));
  if(name==='collection-drawer')openMobileDrawer(document.getElementById('collection-sidebar'));
  if(name==='cemetery-drawer')openMobileDrawer(document.getElementById('cemetery-sidebar'));
  if(name==='new')openModal(null);
  if(name==='wishlist-edit')openWishlistModal(WISHLIST[0].id);
  if(name==='arrival-edit')openArrivalModal(ARRIVALS[0].id);
  if(name==='sale'){
   if(!CEMETERY.some(g=>g.id==='css-sale'))CEMETERY.push({...GAMES[0],id:'css-sale',saleStatus:'pending'});
   openSaleModal('css-sale');
  }
  window.scrollTo(0,0);
 },name);
 if(name==='import')await page.locator('#cemetery-import-input').setInputFiles({name:'css-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{nom:'Jeu de test import',plateforme:'Nintendo Switch',saleStatus:'pending'}]))});
 if(name==='status')await page.locator('.card-status-badge').first().click();
 await page.waitForTimeout(100);
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,640,820,900,1100,1440])for(const theme of ['light','dark']){
   const snapshots=[];
   for(const useBaseline of [true,false]){
    const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
    if(useBaseline){
     if(baselineDir)await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(name!=='index.html'&&!name.endsWith('.css'))return route.fallback();
      // Current markup/scripts (including dialog lifecycle), previous styles.
      // This isolates CSS changes from deliberate accessibility attributes.
      if(name.endsWith('.css')&&!fs.existsSync(path.join(baselineDir,name)))return route.fallback();
      let body=fs.readFileSync(name==='index.html'?path.join(__dirname,'..',name):path.join(baselineDir,name),'utf8');
      if(name==='index.html')body=body.replace('window.JTD_PREVIEW_MODE =','window.JTD_PREVIEW_MODE = true ||');
      return route.fulfill({contentType:name==='index.html'?'text/html':'text/css',body});
     });
     else await context.route('**/styles.css*',route=>route.fulfill({contentType:'text/css',body:baseline}));
    }
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.locator('#app-shell').waitFor({state:'visible'});
    await page.addStyleTag({content:':root :is(#jtd-css-regression, *), :root :is(#jtd-css-regression, *)::before, :root :is(#jtd-css-regression, *)::after { animation:none!important;transition:none!important;caret-color:transparent!important; }'});
    await page.evaluate(()=>{GAMES.find(g=>g.format==='Physique').collector=true;GAMES.find(g=>g.format==='Physique').japanese=true;render();});
    const captured={};
    for(const name of scenes){await scene(page,name);captured[name]=await snapshot(page);if(!useBaseline&&['wishlist','order','receive'].includes(name)&&[320,390,1440].includes(width))await page.screenshot({path:`/tmp/jtd-css-${width}-${theme}-${name}.png`,fullPage:true});}
    assert.deepEqual(errors,[]);snapshots.push(captured);await context.close();
   }
   for(const name of scenes){
    try{assert.deepEqual(snapshots[1][name],snapshots[0][name]);}
    catch(error){
     const old=snapshots[0][name],current=snapshots[1][name];const differences=[];
     for(let i=0;i<Math.max(old.length,current.length);i++)if(JSON.stringify(old[i])!==JSON.stringify(current[i]))differences.push({index:i,old:old[i],current:current[i]});
     fs.writeFileSync(`/tmp/jtd-css-differences-${width}-${theme}-${name}.json`,JSON.stringify(differences,null,2));
     throw Error(`CSS regression ${width}px ${theme} ${name}: ${differences.length} elements differ; first: ${JSON.stringify(differences[0]).slice(0,1200)}`);
    }
   }
   console.log(`PASS CSS ${width}px ${theme}: ${scenes.length} scenes identical outside the three intentionally polished game forms`);
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
