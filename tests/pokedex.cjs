const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try {
  for(const width of [320,390,1440]) for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:1000},colorScheme:theme});
   await context.route('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/*.png',route=>route.continue());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/#pokedex');
   await page.locator('#page-pokedex').waitFor({state:'visible'});
   assert.equal(await page.locator('.dex-pokemon').count(),151);
   assert.equal(await page.locator('.dex-box').count(),6);
   assert.equal(await page.locator('.dex-box').first().locator('h2').innerText(),'0001–0030');
   assert.equal(await page.locator('.dex-box').nth(1).locator('h2').innerText(),'0031–0060');
   assert.equal(await page.locator('.dex-box').last().locator('.dex-empty').count(),29);
   assert.equal(await page.locator('.dex-grid').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const before=await page.evaluate(()=>JSON.stringify({games:GAMES,journal:LEGACY_JOURNAL,wishlist:WISHLIST}));
   const first=page.locator('.dex-slot[data-pokemon="1"]');
   await first.locator('button').click();assert.equal(await first.getAttribute('data-state'),'1');
   await first.locator('button').click();assert.equal(await first.getAttribute('data-state'),'2');
   await page.reload();await page.locator('#page-pokedex').waitFor({state:'visible'});
   assert.equal(await first.getAttribute('data-state'),'2');
   assert.match(await page.locator('#dex-progress').innerText(),/1\s*\/ 151/);
   await first.locator('button').focus();await page.keyboard.press('Enter');assert.equal(await first.getAttribute('data-state'),'0');
   await page.keyboard.press('Space');assert.equal(await first.getAttribute('data-state'),'1');
   await page.locator('[data-id="4"]').click();await page.locator('[data-id="4"]').click();
   assert.equal(await first.locator('a').getAttribute('target'),'_blank');
   assert.equal(await first.locator('a').getAttribute('href'),'https://www.pokepedia.fr/Bulbizarre#Localisations');
   assert.equal(await page.evaluate(()=>JSON.stringify({games:GAMES,journal:LEGACY_JOURNAL,wishlist:WISHLIST})),before);
   await page.waitForTimeout(1200);
   await page.screenshot({path:`/tmp/jtd-pokedex-${width}-${theme}.png`});
   await page.locator('.nav-tab[data-page="journal"]').click();
   assert.equal(await page.locator('#page-pokedex').isVisible(),false);
   await page.goBack();await page.locator('#page-pokedex').waitFor({state:'visible'});
   assert.deepEqual(errors,[]);
   console.log('PASS Pokédex prototype',width,theme);
   await context.close();
  }
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
