const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const fixture={games:[
  {id:'box',nom:'Exemplaire physique',plateforme:'Switch 2',format:'Physique',status:'termine',prix:40},
  {id:'base',nom:'Jardin des étoiles',plateforme:'Switch 2',format:'Numérique',accountId:'jp',status:'termine',prix:30},
  {id:'dlc',nom:'Extension du jardin',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'base',accountId:'jp',status:'termine',prix:10},
  {id:'other',nom:'Autre jeu',plateforme:'Switch 2',format:'Numérique',accountId:'eu',bundle:true,status:'a_jouer',prix:20},
  {id:'upgrade',nom:'Mise à niveau du jardin',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'base',accountId:'jp',prix:5}
],digitalAccounts:[{id:'jp',name:'Japon',nickname:'Jardin JP',ecosystem:'Nintendo',region:'Japon'},{id:'eu',name:'Europe',ecosystem:'Nintendo'}]};
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
      await page.locator('#profile-menu-btn').click();await page.locator('#profile-share-group > summary').click();await page.locator('#share-preview-btn').click();
      assert.equal(await page.evaluate(()=>window.shareCalls),0,'Sandbox sharing never publishes');
      if(await page.locator('#profile-menu').isVisible())await page.locator('#profile-menu-btn').click();
      await page.evaluate(data=>{applyRestoredData(JTDData.normalizeData(data));applyNavigation({page:'collection',media:'digital',platform:'Switch 2',japanese:true,contentType:'game,dlc'});},fixture);
      assert.deepEqual((await cards(page)).sort(),['game:base','game:dlc']);
      await page.locator('.collection-stat-toggle').click();
      assert.equal(await stat(page,'games'),2);
      assert.equal(await stat(page,'termine'),2);
      assert.equal(await stat(page,'digital'),2);
      assert.match(await page.locator('[data-stat="spent"]').innerText(),/40/);
      assert.match(await page.locator('.collection-stat-toggle').innerText(),/^2(?:\s|$)/);
      assert.match(await page.locator('#platform-list .active .plat-count').textContent(),/^2$/);
      const currentView=await page.evaluate(()=>navigationSnapshot());
      await page.evaluate(view=>applyNavigation({...view,search:'Jardin',sort:'name-desc'}),currentView);
      const searchChip=page.getByRole('button',{name:'Retirer « Jardin »'});
      await searchChip.click();
      assert.equal(await page.locator('#search-input').inputValue(),'');
      await page.getByRole('button',{name:'Retirer DLC',exact:true}).press('Enter');
      assert.equal(await page.getByRole('button',{name:'Retirer DLC',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Retirer Compte japonais',exact:true}).evaluate(el=>el===document.activeElement),true);
      assert.deepEqual(await page.evaluate(()=>[state.platform,state.japanese,state.media,state.contentType,state.sort]),['Switch 2',true,'digital','game','name-desc']);
      assert.deepEqual(await cards(page),['game:base']);
      assert.equal(await page.evaluate(()=>new URLSearchParams(location.hash.split('?')[1]).get('contentType')),'game');
      await page.getByRole('button',{name:'Retirer Compte japonais',exact:true}).click();
      assert.deepEqual((await cards(page)).sort(),['game:base','game:other']);
      await page.evaluate(view=>applyNavigation({...view,bundle:true}),currentView);
      await page.getByRole('button',{name:'Retirer Bundle',exact:true}).click();
      assert.deepEqual((await cards(page)).sort(),['game:base','game:dlc']);
      await page.evaluate(view=>applyNavigation({...view,japanese:false,bundle:true}),currentView);
      await page.getByRole('button',{name:'Retirer Jeux',exact:true}).click();
      assert.deepEqual(await cards(page),[]);
      assert.equal(await page.locator('#platform-list .active .plat-name').textContent(),'Switch 2');
      assert.equal(await page.evaluate(()=>state.platform),'Switch 2');
      await page.evaluate(view=>applyNavigation(view),currentView);
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
        await page.locator('[data-dialog-trigger="game:dlc"] .card-name').click();
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

      await page.evaluate(()=>{state.media='all';state.japanese=false;buildPlatformList();render();});
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
          return {physicalShadow:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).boxShadow,digitalShadow:getComputedStyle(card).boxShadow,physicalStyle:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderLeftStyle,radius:getComputedStyle(card).borderTopLeftRadius,physicalBorder:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderLeftWidth,digitalBorder:getComputedStyle(card).borderLeftWidth,physicalRadius:getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).borderTopLeftRadius,borderStyle:getComputedStyle(card).borderTopStyle,background:rgb(background),physical:rgb(getComputedStyle(document.querySelector('[data-dialog-trigger="game:box"]')).backgroundColor),contrasts,dlc:rgb(getComputedStyle(dlc).backgroundColor),upgrade:rgb(getComputedStyle(upgrade).backgroundColor),heights:[dlc,upgrade].map(el=>el.getBoundingClientRect().height)};
        });
        assert.ok(appearance.contrasts.every(ratio=>ratio>=4.5),JSON.stringify(appearance));
        assert.ok(theme==='dark'?appearance.physical.every(value=>value<40):appearance.physical.every(value=>value>240),'Physical cards retain the base surface');
        assert.deepEqual(appearance.background,appearance.physical,'Both formats share the same surface');
        assert.equal(appearance.radius,'12px','Cards share the original corners in every view');
        assert.equal(appearance.physicalRadius,appearance.radius);
        assert.equal(appearance.physicalShadow,'none');
        assert.equal(appearance.digitalShadow,'none');
        assert.equal(appearance.borderStyle,'solid','Digital keeps a thin solid edge');
        assert.equal(appearance.physicalStyle,'solid','Physical keeps the same simple border');
        assert.equal(appearance.physicalBorder,'1px');assert.equal(appearance.digitalBorder,'1px');
        assert.ok(appearance.upgrade[2]>appearance.upgrade[0]);
        assert.ok(appearance.dlc[1]>appearance.dlc[0]);
        assert.ok(appearance.heights.every(height=>height<=22),'Content bands stay compact in all views');
        assert.equal(await page.locator('[data-dialog-trigger="game:base"] .card-platform-line .card-status-control').count(),1);
        assert.equal(await page.locator('[data-dialog-trigger="game:base"] .card-state-row .card-console-account').count(),0);
        assert.equal(await page.locator('[data-dialog-trigger="game:base"] .card-state-row .card-media-mark').count(),1);
        await page.screenshot({path:'/tmp/jtd-card-surface-'+view+'-'+width+'-'+theme+'.png'});
      }
      await page.evaluate(()=>{state.media='digital';state.japanese=true;buildPlatformList();render();openModal('base');});
      assert.equal(await page.locator('#f-content-details .content-addon-link').count(),2);
      assert.equal(await page.locator('#f-content-details .content-type-dlc .content-kind-icon').count(),1);
      assert.equal(await page.locator('#f-content-details .content-type-upgrade .content-kind-icon').count(),1);
      assert.equal(await page.locator('#f-quick-hide-fields').evaluate(el=>getComputedStyle(el).borderBottomWidth),'0px');
      await page.screenshot({path:'/tmp/jtd-linked-content-'+width+'-'+theme+'.png'});
      assert.equal(await page.locator('#f-format-title').innerText(),'Numérique');
      assert.equal(await page.evaluate(()=>document.getElementById('f-media-section').compareDocumentPosition(document.getElementById('f-identity-summary')) & Node.DOCUMENT_POSITION_PRECEDING),2);
      await page.locator('#f-context-summary .context-edit-btn').click();
      assert.equal(await page.locator('#f-digital-version-options').isVisible(),true);
      assert.equal(await page.locator('#f-collector-field').isVisible(),false);
      assert.equal(await page.locator('#f-content-type-field').isVisible(),true);
      await page.locator('[name="f-media-choice"][value="physical"]').check();
      await page.locator('#f-edition-options summary').click();
      assert.equal(await page.locator('#f-collector-field').isVisible(),true);
      assert.equal(await page.locator('#f-content-type-field').isVisible(),false);
      assert.equal(await page.locator('#f-media-section #f-collector-field').count(),1);
      await page.locator('#f-collector').check();await page.locator('#f-japanese').check();
      await page.locator('[name="f-media-choice"][value="digital"]').check();
      assert.equal(await page.locator('#f-collector-field').isVisible(),false);
      assert.equal(await page.evaluate(()=>{const fields=readDigitalFields();return fields.collector || fields.japanese;}),false);
      await page.locator('[name="f-media-choice"][value="physical"]').check();
      assert.equal(await page.locator('#f-collector').isChecked(),true);
      assert.equal(await page.locator('#f-japanese').isChecked(),true);
      await page.screenshot({path:'/tmp/jtd-physical-edition-'+width+'-'+theme+'.png'});
      await page.locator('[name="f-media-choice"][value="digital"]').check();
      assert.equal(await page.locator('#modal-overlay #f-account-identity, #modal-overlay #f-manage-accounts').count(),0,'Editor contains only the account choice');
      assert.equal(await page.locator('#modal-overlay').getByRole('button',{name:/Gérer les comptes/}).count(),0);
      await page.screenshot({path:'/tmp/jtd-purchase-account-'+width+'-'+theme+'.png'});
      await page.locator('#cancel-btn').click();
      await page.locator('#confirm-modal-confirm-btn').click();
      await types(page,'game','dlc');
      await drawer(page);
      const contentRows = await page.locator('#content-type-options button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().top));
      assert.equal(new Set(contentRows).size,3,'Each content filter occupies its own row');
      assert.equal(await page.locator('#collection-account-options').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

      // Reproduce the hosted demo collector conversion with its floating-point price.
      await page.evaluate(()=>{
        applyRestoredData(JTDData.normalizeData({games:[{id:'conversion',nom:'Chroniques du rivage 5 — Démo',plateforme:'Switch 2',format:'Physique',collector:true,japanese:true,prix:19.99+40,status:'termine',date:'2026-10-15',source:'Boutique démo'}]}));
        openModal('conversion');
      });
      await page.locator('#f-identity-summary .identity-edit-btn').click();
      await page.locator('[name="f-media-choice"][value="digital"]').check();
      await page.locator('#save-btn').click();
      assert.equal(await page.locator('#modal-overlay').isVisible(),false,'Changing only format must save and close');
      let converted=await page.evaluate(()=>GAMES.find(g=>g.id==='conversion'));
      assert.equal(converted.format,'Numérique');assert.equal(converted.prix,59.99);
      assert.equal(converted.collector,false);assert.equal(converted.japanese,false);
      assert.equal(converted.status,'termine');assert.equal(converted.date,'2026-10-15');
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='conversion').format),'Numérique');
      await page.evaluate(()=>{openModal('conversion');setGameSheetViewing(false);setContextEditor('f',GAMES.find(g=>g.id==='conversion'),'purchase',true);document.getElementById('f-prix').value='12,345';});
      await page.locator('#save-btn').click();
      assert.equal(await page.locator('#f-context-editor').isVisible(),true,'Purchase validation reveals its folded editor');
      assert.equal(await page.locator('#f-prix').getAttribute('aria-invalid'),'true');
      assert.equal(await page.locator('#f-prix-error').isVisible(),true);
      await page.locator('#f-prix').fill('12,34');await page.locator('#save-btn').click();
      assert.equal(await page.locator('#modal-overlay').isVisible(),false);
      assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='conversion').prix),12.34);
      await page.evaluate(()=>{
        applyRestoredData(JTDData.normalizeData({games:[
          {id:'label-long',nom:'Aventure fictive au titre long pour vérifier la fiche',plateforme:'Nintendo Game Boy Advance',format:'Physique',status:'termine_ailleurs'},
          {id:'label-old',nom:'Ancien état fictif',plateforme:'Nintendo Game Boy Advance',format:'Physique',status:'en_cours'},
          {id:'label-none',nom:'Sans statut fictif',plateforme:'PC',format:'Physique'},
          {id:'label-upgrade',nom:'Mise à niveau fictive',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade'}
        ]}));
        applyNavigation({page:'collection',media:'physical'});
      });
      await drawer(page);
      assert.ok(await page.locator('#platform-list .plat-name').evaluateAll(labels=>labels.every(label=>label.scrollWidth<=label.clientWidth+1&&label.scrollHeight<=label.clientHeight+1)),'Full platform labels fit without truncation');
      assert.ok(await page.locator('#status-toggles .toggle-chip-label span:last-child').evaluateAll(labels=>labels.every(label=>label.scrollWidth<=label.clientWidth+1)),'Full status labels fit without truncation');
      await page.keyboard.press('Escape');
      for(const [id,label] of [['label-long','Terminé ailleurs'],['label-old','À faire'],['label-none','Sans statut']]){
        await page.evaluate(id=>openModal(id),id);
        const badge=page.locator('#f-identity-summary .game-sheet-status');
        assert.equal(await badge.innerText(),label,'The sheet repeats the effective card status');
        assert.ok(await badge.evaluate(element=>{
          const bounds=element.getBoundingClientRect();
          return bounds.left>=0&&bounds.right<=innerWidth+1;
        }),'The status stays inside a narrow sheet');
        await page.locator('#cancel-btn').click();
      }
      await page.evaluate(()=>openModal('label-upgrade'));
      assert.equal(await page.locator('#f-identity-summary .game-sheet-status').count(),0,'An upgrade has no completion status');
      await page.locator('#cancel-btn').click();
      assert.deepEqual(errors,[]);
      await context.close();console.log('PASS collection filters',width,theme);
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
