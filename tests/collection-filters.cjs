const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
  {id:'box',nom:'Exemplaire physique',plateforme:'Switch 2',format:'Physique',status:'termine',prix:40},
  {id:'base',nom:'Jardin des étoiles',plateforme:'Switch 2',format:'Numérique',accountId:'jp',status:'termine',prix:30},
  {id:'dlc',nom:'Extension du jardin',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'base',accountId:'jp',status:'termine',prix:10},
  {id:'other',nom:'Autre jeu',plateforme:'Switch 2',format:'Numérique',accountId:'eu',status:'a_jouer',prix:20},
  {id:'upgrade',nom:'Mise à niveau du jardin',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'base',accountId:'jp',prix:5}
],digitalAccounts:[{id:'jp',name:'Japon',nickname:'Jardin JP',ecosystem:'Nintendo'},{id:'eu',name:'Europe',ecosystem:'Nintendo'}]};
async function drawer(page){if(await page.evaluate(()=>matchMedia('(max-width:820px)').matches&&!document.getElementById('collection-sidebar').classList.contains('mobile-open')))await page.locator('#global-filter-toggle').click();}
async function types(page,...values){await page.evaluate(values=>{state.contentType=values.join(',')||null;buildPlatformList();render();},values);}
async function cards(page){return page.locator('#grid .card').evaluateAll(cards=>cards.map(card=>card.dataset.dialogTrigger));}
async function stat(page,key){return Number(await page.locator('[data-stat="'+key+'"] strong').innerText());}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME});
  try{
    for(const width of [320,390,1440])for(const theme of ['light','dark']){
      const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.locator('#share-preview-btn').count(),1);
      await page.evaluate(()=>{window.shareCalls=0;window.JTDShare={createOrCopy(){window.shareCalls++;}};});
      await page.locator('#profile-menu-btn').click();await page.locator('#share-preview-btn').click();
      assert.equal(await page.evaluate(()=>window.shareCalls),0,'Sandbox sharing never publishes');
      if(await page.locator('#profile-menu').isVisible())await page.locator('#profile-menu-btn').click();
      await page.evaluate(data=>{applyRestoredData(JTDData.normalizeData(data));applyNavigation({page:'collection',media:'digital',platform:'Switch 2',accountId:'jp',contentType:'game,dlc'});},fixture);
      assert.deepEqual((await cards(page)).sort(),['game:base','game:dlc']);
      await page.locator('.collection-stat-details > summary').click();
      assert.equal(await stat(page,'games'),2);
      assert.equal(await stat(page,'termine'),2);
      assert.equal(await stat(page,'digital'),2);
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/40/);
      assert.match(await page.locator('#results-bar .results-count').innerText(),/^2 /);
      assert.match(await page.locator('#platform-list .active .plat-count').innerText(),/^2$/);
      await types(page,'game');
      assert.deepEqual(await cards(page),['game:base']);
      assert.equal(await stat(page,'games'),1);assert.equal(await stat(page,'termine'),1);
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/30/);
      await types(page,'dlc');
      assert.deepEqual(await cards(page),['game:dlc']);
      assert.equal(await stat(page,'games'),1);assert.equal(await stat(page,'termine'),1);
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/10/);
      for(const view of ['cards','gallery','list']){
        await page.locator('#collection-view-switch [data-view="'+view+'"]').click();
        await page.locator('[data-dialog-trigger="game:dlc"]').click();
        assert.match(await page.locator('#modal-title').innerText(),/DLC/);
        await page.locator('#cancel-btn').click();
      }
      await types(page);
      assert.deepEqual(await cards(page),['game:base']);
      assert.equal(await stat(page,'games'),3,'Grouped purchases still count separately');
      assert.equal(await stat(page,'termine'),2,'Upgrades do not affect completion');
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/45/);
      await page.evaluate(()=>{state.status='termine';buildPlatformList();render();});
      assert.equal(await stat(page,'games'),2);assert.equal(await stat(page,'termine'),2);
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/40/);
      await page.evaluate(()=>{state.status=null;state.search='Extension';render();});
      assert.deepEqual(await cards(page),['game:dlc']);assert.equal(await stat(page,'games'),1);
      await page.evaluate(()=>{state.search='Jardin des étoiles';render();});
      assert.deepEqual(await cards(page),['game:base']);assert.equal(await stat(page,'games'),3);
      await types(page,'game','dlc');
      assert.deepEqual(await cards(page),['game:base']);assert.equal(await stat(page,'games'),1,'Search excludes nonmatching explicit rows');
      await page.evaluate(()=>{state.search='';render();});

      await page.evaluate(()=>{state.media='all';state.accountId=null;buildPlatformList();render();});
      await types(page,'game','dlc','upgrade');
      for(const view of ['cards','gallery','list']){
        await page.locator('#collection-view-switch [data-view="'+view+'"]').click();
        const appearance=await page.evaluate(()=>{
          const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
          const ctx=canvas.getContext('2d');
          const rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
          const luminance=value=>rgb(value).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
          const card=document.querySelector('[data-dialog-trigger="game:base"]'),background=getComputedStyle(card).backgroundColor;
          const bg=luminance(background);
          const contrasts=[...card.querySelectorAll('.card-name,.card-platform,.card-status-badge,.card-list-details dd')].filter(el=>el.getClientRects().length).map(el=>{
            const fg=luminance(getComputedStyle(el).color);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
          });
          const dlc=document.querySelector('[data-dialog-trigger="game:dlc"] .dlc-label'),upgrade=document.querySelector('.upgrade-card .dlc-label');
          return {physicalStyle:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderLeftStyle,radius:getComputedStyle(card).borderTopLeftRadius,physicalBorder:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderLeftWidth,digitalBorder:getComputedStyle(card).borderLeftWidth,physicalRadius:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderTopLeftRadius,borderStyle:getComputedStyle(card).borderTopStyle,background:rgb(background),physical:rgb(getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).backgroundColor),contrasts,dlc:rgb(getComputedStyle(dlc).backgroundColor),upgrade:rgb(getComputedStyle(upgrade).backgroundColor),heights:[dlc,upgrade].map(el=>el.getBoundingClientRect().height)};
        });
        assert.ok(appearance.contrasts.every(ratio=>ratio>=4.5),JSON.stringify(appearance));
        assert.ok(theme==='dark'?appearance.physical.every(value=>value<40):appearance.physical.every(value=>value>240),'Physical cards retain the base surface');
        assert.deepEqual(appearance.background,appearance.physical,'Both formats share the same surface');
        assert.equal(appearance.radius,'16px','Digital cards have round corners in every view');
        assert.equal(appearance.physicalRadius,'5px','Physical cards keep box-like corners');
        assert.equal(appearance.borderStyle,'solid','Digital keeps a thin solid edge');
        assert.equal(appearance.physicalStyle,'double','Physical uses a case rim');
        assert.equal(appearance.physicalBorder,'3px');assert.equal(appearance.digitalBorder,'1px');
        assert.ok(appearance.upgrade[2]>appearance.upgrade[0]);
        assert.ok(appearance.dlc[1]>appearance.dlc[0]);
        assert.ok(appearance.heights.every(height=>height<=22),'Content bands stay compact in all views');
        await page.screenshot({path:'/tmp/jtd-card-surface-'+view+'-'+width+'-'+theme+'.png'});
      }
      await page.evaluate(()=>{state.media='digital';state.accountId='jp';buildPlatformList();render();openModal('base');});
      await page.locator('#f-context-summary .context-edit-btn').click();
      assert.equal(await page.locator('#f-account').isVisible(),true);
      assert.equal(await page.locator('#modal-overlay #f-account-identity, #modal-overlay #f-manage-accounts').count(),0,'Editor contains only the account choice');
      assert.equal(await page.locator('#modal-overlay').getByRole('button',{name:/Gérer les comptes/}).count(),0);
      await page.screenshot({path:'/tmp/jtd-purchase-account-'+width+'-'+theme+'.png'});
      await page.locator('#cancel-btn').click();
      await types(page,'game','dlc');
      await drawer(page);
      await page.waitForFunction(()=>!matchMedia('(max-width:820px)').matches || Math.abs(document.getElementById('collection-sidebar').getBoundingClientRect().left)<1);
      assert.equal(await page.locator('#collection-account-options button').count(),3);
      assert.equal(await page.locator('#collection-account-picker, #collection-account').count(),0);
      assert.equal(await page.locator('[data-account=""] .account-all-icon svg circle').count(),1);
      assert.equal(await page.locator('[data-account="jp"]').getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('[data-account="jp"] .plat-count').innerText(),/^2$/);
      await page.screenshot({path:'/tmp/jtd-account-filters-'+width+'-'+theme+'.png'});
      await page.locator('[data-account="eu"]').click();
      assert.deepEqual(await cards(page),['game:other']);
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>state.accountId),'eu');
      await drawer(page);await page.locator('[data-account="eu"]').click();
      assert.equal(await page.evaluate(()=>state.accountId),null,'Reclick clears account filter');
      await drawer(page);await page.locator('[data-account="jp"]').press('Enter');
      assert.deepEqual((await cards(page)).sort(),['game:base','game:dlc']);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await context.close();console.log('PASS collection filters',width,theme);
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
