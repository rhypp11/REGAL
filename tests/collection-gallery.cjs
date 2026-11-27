const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer({journal:false,gallery:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
  try{
    for(const width of [390,1440]){
      const context=await sandboxContext(browser,{viewport:{width,height:900}});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/#collection');
      await page.locator('#app-shell').waitFor({state:'visible'});
      await page.evaluate(()=>{
        const icon=new URL('preview-assets/garden.svg',location.href).href;
        const banner=new URL('preview-assets/lighthouse.svg',location.href).href;
        applyRestoredData(JTDData.normalizeData({games:[
          {id:'switch',nom:'Chroniques d’Aster',plateforme:'Switch',format:'Physique',squareImage:icon,image:banner,status:'termine'},
          {id:'ps4',nom:'Chroniques d’Aster',plateforme:'PlayStation 4',format:'Numérique',squareImage:icon,image:banner,status:'a_jouer'},
          {id:'other',nom:'Phares du nord',plateforme:'Switch',squareImage:icon}
        ]}));
        applyNavigation({page:'collection',media:'all'});
      });
      const cards=page.locator('.gallery-grid .card');
      assert.equal(await cards.count(),3);
      assert.match(await cards.first().locator('.game-art-image').getAttribute('src'),/garden\.svg$/);
      if(width===390)assert.equal(await page.locator('.gallery-grid').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
      await page.locator('[data-dialog-trigger="game:switch"] .card-open-control').click();
      assert.match(await page.locator('#f-identity-summary .game-art-image').getAttribute('src'),/lighthouse\.svg$/);
      await page.locator('#gallery-link-panel summary').click();
      await page.locator('#gallery-link-panel input').fill('PlayStation');
      await page.locator('#gallery-link-panel select').first().selectOption('ps4');
      await page.locator('#gallery-link-panel select').nth(1).selectOption('termine');
      await page.locator('#gallery-link-panel button').click();
      assert.equal(await page.locator('.gallery-purchase-row').count(),2);
      await page.getByRole('button',{name:'Retour',exact:true}).click();
      assert.equal(await cards.count(),2);
      await page.locator('#gallery-group').selectOption('platform');
      assert.equal(await cards.count(),3);
      await page.locator('[data-dialog-trigger="game:ps4"] .card-open-control').click();
      assert.equal(await page.locator('.gallery-purchase-row').count(),2);
      await page.locator('#f-sheet-status select').selectOption('abandonne');
      assert.equal(await page.evaluate(()=>GAMES.filter(item=>item.gameGroup).every(item=>item.status==='abandonne')),true);
      const row=page.locator('.gallery-purchase-row').filter({hasText:'PS4'});
      await row.locator('summary').click();
      await row.getByRole('button',{name:'Dissocier cet exemplaire'}).click();
      await page.locator('#confirm-modal-overlay').getByRole('button',{name:'Dissocier',exact:true}).click();
      assert.equal(await page.locator('.gallery-purchase-row').count(),1);
      await page.reload();
      await page.locator('#app-shell').waitFor({state:'visible'});
      assert.equal(await page.locator('#gallery-group').inputValue(),'platform');
      assert.equal(await page.evaluate(()=>GAMES.find(item=>item.id==='ps4').gameGroup),null);
      assert.deepEqual(errors,[]);
      await context.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
