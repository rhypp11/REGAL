const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{for(const width of [821,1440]){
  const context=await sandboxContext(browser,{viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
  await page.evaluate(()=>{
   LEGACY_JOURNAL=[{regalJournal:2,entries:[
    {id:'drag-playing',group:'playing',name:'Jeu en cours fictif',platform:'PC',format:'digital',precision:'Version test',image:new URL('preview-assets/garden.svg',location.href).href},
    {id:'drag-backlog',group:'backlog',name:'Jeu à faire fictif',platform:'Switch 2',format:'physical',precision:'Édition test'},
    {id:'drag-release',group:'release',name:'Sortie fictive',platform:'PC',date:'2030-01-12'},
    {id:'drag-completed',group:'completed',name:'Complétion fictive',platform:'PC',date:new Date().getFullYear()+'-01-10',completion:'finished'}
   ]}];goToPage('journal');
  });
  const entries=()=>page.evaluate(()=>LEGACY_JOURNAL.find(x=>x.regalJournal===2).entries);
  const before=await entries();
  const row=id=>page.locator('[data-journal-entry="'+id+'"]');
  const zone=group=>page.locator('[data-journal-drop="'+group+'"]');
  await row('drag-backlog').dragTo(zone('playing'));
  await page.waitForFunction(()=>LEGACY_JOURNAL[0].entries.find(x=>x.id==='drag-backlog').group==='playing');
  assert.deepEqual(await entries(),before.map(x=>x.id==='drag-backlog'?{...x,group:'playing'}:x),'Move preserves every other field');
  await row('drag-backlog').dragTo(zone('backlog'));
  await page.waitForFunction(()=>LEGACY_JOURNAL[0].entries.find(x=>x.id==='drag-backlog').group==='backlog');assert.deepEqual(await entries(),before);
  await row('drag-backlog').dragTo(zone('completed'));assert.deepEqual(await entries(),before,'Backlog cannot be dropped directly into completions');
  await zone('playing').dispatchEvent('drop',{dataTransfer:await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('application/x-regal-journal-entry','drag-release');return d;})});
  assert.deepEqual(await entries(),before,'Foreign or release payload is rejected');
  const transfer=await page.evaluateHandle(()=>new DataTransfer());await row('drag-playing').dispatchEvent('dragstart',{dataTransfer:transfer});
  const generation=await page.evaluate(()=>{const value=window.JTDAccountGeneration;window.JTDAccountGeneration=value+1;return value;});
  await zone('backlog').dispatchEvent('drop',{dataTransfer:transfer});await page.evaluate(value=>window.JTDAccountGeneration=value,generation);assert.deepEqual(await entries(),before,'An account change rejects the in-flight move');
  await row('drag-playing').dragTo(zone('completed'));await page.locator('#journal-overlay').waitFor({state:'visible'});
  assert.deepEqual(await entries(),before,'Dropping prepares completion without writing');
  await page.keyboard.press('Escape');await page.locator('#journal-overlay').waitFor({state:'hidden'});assert.deepEqual(await entries(),before,'Cancel leaves the playing entry intact');
  await row('drag-playing').dragTo(zone('completed'));await page.locator('#journal-overlay').waitFor({state:'visible'});
  await page.locator('#journal-form [name="date"]').fill('2026-11-13');await page.locator('#journal-save').click();await page.locator('#journal-overlay').waitFor({state:'hidden'});
  const after=await entries(),moved=after.find(x=>x.id==='drag-playing');assert.equal(moved.group,'completed');assert.equal(moved.date,'2026-11-13');assert.equal(moved.name,before[0].name);assert.equal(moved.precision,before[0].precision);assert.equal(moved.image,before[0].image);assert.equal(after.filter(x=>x.id==='drag-playing').length,1);
  await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});assert.deepEqual(await entries(),after,'Moves and completions survive reload');
  assert.deepEqual(errors,[]);console.log('PASS Journal drag/drop',width,': roundtrip, payload isolation, account change, completion cancel/save, reload');await context.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
