/* Run with Playwright and Chromium available; never logs in or accesses Firebase. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createSandboxServer} = require('./sandbox.cjs');
const server = createSandboxServer();
const payload = {
  app:'Jeux Tout Doux',version:2,data:{
    games:[{id:'g',nom:'<img src=x onerror="window.INJECTED=1"> & "Persona"',plateforme:'PC',format:'Physique',collector:true,japanese:true,prix:20,date:'2026-10-01',source:'L\'enseigne <b>test</b>',image:'http://127.0.0.1:1/broken.png'}],
    arrivals:[{id:'a',nom:'Arrivage',plateforme:'PC',collector:true,japanese:true,prix:30,date:'2026-11-10',source:'Test'}],
    wishlist:[{id:'w',nom:'Wishlist <b>test</b>',plateforme:'PC',collector:true,japanese:true,date:'2027',lien:'javascript:alert(1)'}],
    platformMeta:{PC:{color:'#123456',logo:null}},platformOrder:['PC'],profile:{name:'Test',avatar:null}
  }
};
async function restore(page, value, confirm=true){
  await page.locator('#profile-menu-btn').click();
  const event = page.waitForEvent('filechooser');
  await page.locator('#restore-trigger').click();
  const chooser = await event;
  await chooser.setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  if(confirm) await page.locator('#confirm-modal-confirm-btn').click();
  else await page.locator('#confirm-modal-cancel-btn').click();
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = process.env.JTD_TEST_URL || 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true,...(process.env.JTD_CHROME ? {executablePath:process.env.JTD_CHROME} : {})});
  try{
    for(const {width,theme} of [{width:390,theme:'light'},{width:1440,theme:'light'},{width:390,theme:'dark'},{width:1440,theme:'dark'}]){
      const context = await browser.newContext({viewport:{width,height:900},colorScheme:theme,isMobile:width<500,hasTouch:width<500,serviceWorkers:'block'});
      const page = await context.newPage();
      const errors=[],firebaseRequests=[];let pickers=0, headRequests=0, revision=1;
      page.on('pageerror',error=>errors.push(error.message));
      page.on('filechooser',()=>pickers++);
      await page.route('**/*',route=>{
        const target=route.request().url();
        if(/gstatic\.com\/firebase|firestore\.googleapis|identitytoolkit|securetoken/.test(target)){firebaseRequests.push(target);return route.abort();}
        if(/fonts\.googleapis|fonts\.gstatic/.test(target))return route.abort();
        if(route.request().method() === 'HEAD'){headRequests++;return route.fulfill({status:200,headers:{ETag:'"release-'+revision+'"'},body:''});}
        return route.continue();
      });
      await page.goto(url);
      await page.locator('#app-shell').waitFor({state:'visible'});
      // Navigation survives reload; Back/Forward restore the preceding view.
      await page.locator('.nav-tab[data-page="collection"]').click();
      await page.evaluate(() => {state.platform='Switch 2';state.status='a_jouer';buildPlatformList();buildStatusToggles();render();});
      await page.locator('#search-input').fill('Fire');
      await page.locator('#sort-select').selectOption('date-desc');
      const collectionURL = page.url();
      await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.locator('#search-input').inputValue(),'Fire');
      assert.equal(await page.locator('#sort-select').inputValue(),'date-desc');
      assert.equal(await page.evaluate(()=>state.platform),'Switch 2');
      assert.equal(await page.evaluate(()=>state.status),'a_jouer');
      assert.equal(await page.locator('#page-collection .card').count(),1);
      await page.locator('.nav-tab[data-page="home"]').click();
      await page.goBack();await page.waitForFunction(()=>!document.getElementById('page-collection').classList.contains('hidden'));
      assert.equal(page.url(),collectionURL);
      await page.goForward();await page.waitForFunction(()=>!document.getElementById('page-home').classList.contains('hidden'));
      if(width<500){
        await page.locator('[data-target="arrivals"]').click();
        await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
        assert.ok(await page.locator('#home-boards').evaluate(el=>el.classList.contains('show-arrivals')));
      }
      // A root visit reopens the saved view; unknown platform/sort/status are discarded.
      await page.goto(url);await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>navigationPage),'home');
      await page.goto(url+'/#collection?platform=Unknown&sort=invalid&status=invalid');
      await page.locator('#app-shell').waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>({platform:state.platform,sort:state.sort,status:state.status})),{platform:null,sort:'name-asc',status:null});
      // Wake-up checks detect changed files; an editor or failed save blocks refresh.
      await page.waitForTimeout(150);
      assert.ok(headRequests>=7);
      revision++;
      await page.evaluate(()=>dispatchEvent(new Event('online')));
      await page.getByRole('button',{name:'Actualiser',exact:true}).waitFor();
      await page.locator('#add-btn').click();
      // Background controls are inert while a dialog is open. Invoke the
      // existing reload handler directly to keep testing its defensive guard.
      assert.equal(await page.locator('#toast-stack').evaluate(el=>el.inert),true);
      await page.locator('.toast-action').filter({hasText:'Actualiser'}).evaluate(el=>el.click());
      assert.ok(await page.locator('#modal-overlay').isVisible());
      await page.locator('#cancel-btn').click();
      await page.evaluate(()=>{window.JTDPrepareReload=async()=>false;dispatchEvent(new Event('online'));});
      await page.getByRole('button',{name:'Actualiser',exact:true}).click();
      await page.getByText('La sauvegarde cloud n’a pas abouti.',{exact:false}).waitFor();
      const navigation = page.waitForEvent('framenavigated');
      await page.evaluate(()=>{window.JTDPrepareReload=async()=>true;dispatchEvent(new Event('online'));});
      await page.getByRole('button',{name:'Actualiser',exact:true}).click();
      await navigation;await page.locator('#app-shell').waitFor({state:'visible'});
      await page.locator('#reset-btn').evaluate(el=>el.click());
      console.log('PASS navigation '+width+'px '+theme+': reload, saved root, Back/Forward, board, invalid URL; update guards');
      await restore(page,payload);
      await page.waitForTimeout(200);
      assert.equal(pickers,1,'restore must not reopen the file picker');
      assert.equal(await page.evaluate(()=>window.INJECTED),undefined);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games[0].nom),payload.data.games[0].nom);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.wishlist[0].lien),null);
      await page.locator('.nav-tab[data-page="collection"]').click();
      assert.equal(await page.locator('#page-collection .card-name-text').innerText(),payload.data.games[0].nom);
      assert.equal(await page.locator('#page-collection .card-source').innerText(),payload.data.games[0].source);
      assert.equal(await page.locator('#page-collection .card img[onerror]').count(),0);
      assert.equal(await page.locator('#page-collection .card-name-text img').count(),0);
      await page.locator('#page-collection .card-status-badge').click();
      await page.locator('#page-collection .card-status-option[data-status="termine"]').click();
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games[0].status),'termine');
      await restore(page,{games:[]},false);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games.length),1);
      // Selecting the same filename again still works through the native label.
      await restore(page,payload);
      assert.equal(pickers,3);
      await page.evaluate(()=>{renamePlatform('PC','Ordinateur "test"');buildPlatformList();render();});
      assert.ok(await page.evaluate(()=>[GAMES,ARRIVALS,WISHLIST].every(list=>list.every(item=>item.plateforme==='Ordinateur "test"'))));
      await page.locator('#page-collection .card').click();
      await page.locator('#cancel-btn').click();
      // Editing must preserve retired metadata from an old backup.
      await page.evaluate(()=>{
        Object.assign(GAMES[0],{format:'Ancien format',type:'Ancien type'});
        openModal(GAMES[0].id);
        saveModal();
      });
      assert.equal(await page.evaluate(()=>GAMES[0].format),'Ancien format');
      assert.equal(await page.evaluate(()=>GAMES[0].type),'Ancien type');
      const chatGPTDownloadEvent=page.waitForEvent('download');
      await page.locator('#profile-menu-btn').click();await page.locator('#chatgpt-export-btn').click();
      const chatGPTDownload=await chatGPTDownloadEvent;
      assert.match(chatGPTDownload.suggestedFilename(),/^jeux-tout-doux-chatgpt-\d{4}-\d{2}-\d{2}\.json$/);
      const shared=JSON.parse(fs.readFileSync(await chatGPTDownload.path(),'utf8'));
      assert.equal(shared.app,'Jeux Tout Doux');assert.equal(shared.purpose,'Conseils dans ChatGPT');
      assert.deepEqual(Object.keys(shared.data).sort(),['arrivals','cemetery','games','publishedAt','version','wishlist']);
      assert.equal(Object.hasOwn(shared.data.games[0],'prix'),false);
      assert.equal(Object.hasOwn(shared.data.games[0],'source'),false);
      const downloadEvent=page.waitForEvent('download');
      await page.locator('#profile-menu-btn').click();await page.locator('#backup-btn').click();
      const download=await downloadEvent;
      const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(saved.data.games[0].japanese,true);assert.equal(saved.data.arrivals[0].prix,30);
      await page.locator('#profile-menu-btn').click();
      const invalidEvent=page.waitForEvent('filechooser');await page.locator('#restore-trigger').click();
      await (await invalidEvent).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"games":[],"wishlist":"invalid"}')});
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games.length),1);
      assert.equal(await page.locator('#confirm-modal-overlay').isVisible(),false);
      assert.equal(firebaseRequests.length,0,'sandbox must not load production Firebase');
      assert.deepEqual(errors,[]);
      await page.screenshot({path:'/tmp/jtd-step1-'+width+'.png',fullPage:true});
      console.log('PASS browser '+width+'px: restore/cancel/same file, escaping, status, rename, ChatGPT export, backup, invalid backup, no Firebase');
      await context.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});


