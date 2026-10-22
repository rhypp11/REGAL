const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for(const width of [320,390,640,820,1440]) for(const theme of ['light','dark']) {
      const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
      const page=await context.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('#app-shell').waitFor({state:'visible'});
      await page.evaluate(()=>{
        const game=GAMES.find(g=>g.format==='Physique');
        game.nom='Fire Emblem — Une très longue édition collector pour tester la lisibilité du titre';
        game.image='data:image/png;base64,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';
        game.collector=true; game.japanese=true; game.source='Boutique avec un nom très long';
        game.prix=0; game.date='2026-10-22';
        GAMES.push({...game,id:'missing-purchase',nom:'Sans achat',prix:null,date:null,source:null});
        saveGames();
        goToPage('collection');
      });
      await page.locator('#grid .card-banner img').first().evaluate(img=>img.decode());
      const geometry=await page.locator('#grid .card').evaluateAll(cards=>cards.map(card=>{
        const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {card:box(card),banner:box(card.querySelector('.card-banner')),platformFont:parseFloat(getComputedStyle(card.querySelector('.card-platform')).fontSize),parts:[...card.querySelectorAll('.card-body,.card-name,.card-platform,.card-status-badge,.card-acquisition,.card-price')].map(box)};
      }));
      for(const g of geometry){
        assert.ok(g.banner.top>=g.card.top+9 && g.banner.bottom<=g.card.bottom-9,'Thumbnail stays inside padded card');
        assert.ok(Math.abs(g.banner.width/g.banner.height-16/9)<.02,'Horizontal thumbnail keeps its proportions');
        assert.ok(g.platformFont>=12,'Platform remains readable');
        for(const p of g.parts) assert.ok(p.left>=g.card.left && p.right<=g.card.right+.5 && p.top>=g.card.top && p.bottom<=g.card.bottom+.5,'Card information stays inside');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('#grid .card-acquisition').count(),0,'Default cards hide purchase details');
      for(const sort of ['price-asc','price-desc','date-asc','date-desc','name-desc','name-asc']){
        await page.selectOption('#sort-select',sort);
        const numeric=sort.startsWith('price-');
        const dated=sort.startsWith('date-');
        assert.equal(await page.locator('#grid .card-source').count(),0,'Source stays in the game sheet');
        assert.equal(await page.locator('#grid .card-acquisition').count(),numeric||dated ? await page.locator('#grid .card').count() : 0);
        assert.equal(await page.locator('#grid .card-price').count(),numeric ? await page.locator('#grid .card').count() : 0);
        assert.equal(await page.locator('#grid .card-purchase-date').count(),dated ? await page.locator('#grid .card').count() : 0);
        if(numeric) assert.ok((await page.locator('#grid').innerText()).includes('0,00'),'A free game shows its zero price');
        if(numeric||dated){
          assert.ok((await page.locator('[data-dialog-trigger="game:missing-purchase"] .card-acquisition').innerText()).includes(numeric?'Non renseigné':'Non renseignée'));
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        }
      }
      await page.screenshot({path:`/tmp/jtd-collection-${width}-${theme}.png`,fullPage:true});
      await page.locator('#grid .card-status-badge').first().click();
      await page.locator('#grid .card-status-menu:not(.hidden)').waitFor({state:'visible'});
      const menu=await page.locator('#grid .card-status-menu:not(.hidden)').boundingBox();
      assert.ok(menu.x>=0 && menu.x+menu.width<=width+.5,'Status menu stays on screen');
      await page.locator('#grid .card-status-option').first().click();
      await page.locator('#grid .card-name').first().click();
      await page.locator('#modal-overlay').waitFor({state:'visible'});
      assert.ok((await page.locator('#f-context-summary').innerText()).includes('Boutique avec un nom très long'),'Purchase details remain available on click');
      await page.locator('#cancel-btn').click();
      assert.equal(await page.locator('[data-collection-format]').count(),0,'Physical collection has no format selector');
      assert.equal(await page.locator('#f-type, #f-format, #type-filter-section').count(),0);
      const bannerGap=await page.evaluate(()=>{
        const banner=document.getElementById('platform-banner').getBoundingClientRect();
        const nav=document.querySelector('.topnav').getBoundingClientRect();
        return banner.top-nav.bottom;
      });
      assert.ok(bannerGap >= (width<=820 ? 16 : 24)-.5,'Platform banner has breathing room below top navigation');
      await page.evaluate(()=>applyNavigation({page:'collection',format:'Ancien format',type:'Ancien type'}));
      assert.equal(await page.evaluate(()=>Object.hasOwn(state,'format')||Object.hasOwn(state,'type')),false);
      assert.equal(await page.locator('#grid .card').count(),await page.evaluate(()=>GAMES.length));
      assert.equal(await page.evaluate(()=>location.hash.includes('format=')||location.hash.includes('type=')),false);
      await context.close();
      console.log(`PASS collection ${width}px ${theme}: image, long title, metadata, status menu and edit`);
    }
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

