const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
 for(const width of [320,390,821,1024,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>{
   const fixture=i=>({id:'edge-'+i,nom:i%2?'Un titre très long — édition collector '.repeat(5):'TitreSansAucunEspace'.repeat(12),plateforme:'Plateforme au nom très long '+i%30,format:'Physique',prix:999999.99,source:'BoutiqueSansEspace'.repeat(12),date:'2027-12-31',status:'termine_ailleurs',collector:true,japanese:true,image:i%3===0?'/image-introuvable.png':null});
   GAMES=Array.from({length:120},(_,i)=>fixture(i));WISHLIST=Array.from({length:60},(_,i)=>fixture(i+150));ARRIVALS=Array.from({length:60},(_,i)=>fixture(i+250));CEMETERY=Array.from({length:30},(_,i)=>({...fixture(i+350),saleStatus:'pending'}));
   renderWishlist();renderArrivals();
  });
  for(const view of ['home','collection','cemetery']){
   await page.evaluate(v=>goToPage(v),view);
   await page.waitForFunction(()=>[...document.querySelectorAll('.page:not(.hidden) img')].every(i=>i.complete));
   const result=await page.evaluate(view=>{
    const root=document.getElementById('page-'+view);
    const nav=[...document.querySelectorAll('.nav-tab')].map(el=>{const b=el.getBoundingClientRect(),i=el.querySelector('svg').getBoundingClientRect(),t=el.querySelector('span').getBoundingClientRect();return {left:b.left,right:b.right,iconLeft:i.left,iconRight:i.right,iconBottom:i.bottom,labelTop:t.top,labelLeft:t.left,labelRight:t.right};});
    return {overflow:document.documentElement.scrollWidth>innerWidth,broken:[...root.querySelectorAll('img')].filter(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth).length,nav};
   },view);
   assert.equal(result.overflow,false,'Long lists stay within viewport');
   assert.equal(result.broken,0,'Unavailable artwork shows its fallback');
   for(const n of result.nav){assert.ok(n.iconLeft>=n.left-.5&&n.labelRight<=n.right+.5,'Navigation contents stay in their own tab '+width+'px '+JSON.stringify(n));assert.ok(width<=420?n.iconBottom<=n.labelTop+.5:n.iconRight<=n.labelLeft+.5,'Icon and label never overlap');}
  }
  await page.evaluate(()=>{goToPage('collection');state.search='RechercheSansEspace'.repeat(40);state.collector=true;state.japanese=true;state.status='termine_ailleurs';render();});
  assert.match(await page.locator('.empty-state').textContent(),/Aucun jeu ne correspond/);
  await page.locator('#results-reset-btn').click();
  assert.equal(await page.locator('#grid .card').count(),120,'Reset restores the whole collection');
  await page.evaluate(()=>{GAMES=[GAMES[0]];state.platform=null;render();openModal(GAMES[0].id);});
  await page.locator('#delete-btn').click();await page.locator('#confirm-modal-confirm-btn').click();
  assert.match(await page.locator('.empty-state').textContent(),/Ta collection est vide/);
  assert.equal(await page.locator('#home-total-games').textContent(),'0','Deleting the last game refreshes the home count');
  await page.locator('.toast-action').last().click();
  assert.equal(await page.locator('#grid .card').count(),1);
  assert.equal(await page.locator('#home-total-games').textContent(),'1','Undo restores the home count');
  if(width===320)await page.screenshot({path:'/tmp/jtd-edge-'+theme+'.png'});
  assert.deepEqual(errors,[]);await context.close();console.log('PASS edge cases',width,theme);
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
