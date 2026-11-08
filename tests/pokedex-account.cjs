/* Exercise the production UI with local-only Firebase stubs; no account or network backend. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
const sdk={
 'firebase-app.js':'export const initializeApp=()=>({});',
 'firebase-auth.js':`export const getAuth=()=>({});export function onAuthStateChanged(auth,callback){window.testAuth=async uid=>callback(uid?{uid}:null);queueMicrotask(()=>callback(null));}export const signInWithEmailAndPassword=()=>Promise.resolve();export const createUserWithEmailAndPassword=()=>Promise.resolve();export const signOut=()=>window.testAuth(null);`,
 'firebase-firestore.js':`export const getFirestore=()=>({});export const doc=(db,collection,id)=>({collection,id});export async function getDoc(ref){if(window.testReadFails) throw Error('offline');const key=ref.collection+'/'+ref.id;const data=structuredClone(window.testDocuments[key]);return {exists:()=>data!==undefined,data:()=>data};}export async function setDoc(ref,value){const key=ref.collection+'/'+ref.id;window.testDocuments[key]=structuredClone(value);window.testWrites.push({ref,value:structuredClone(value)});}export const deleteDoc=async ref=>{delete window.testDocuments[ref.collection+'/'+ref.id];};`
};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.JTD_CHROME?{executablePath:process.env.JTD_CHROME}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   await context.addInitScript(()=>{
    Object.defineProperty(window,'JTD_PREVIEW_MODE',{get:()=>false,set(){}});
    window.testDocuments={'users/A':{games:[],pokedex:[]}};window.testWrites=[];
    localStorage.setItem('jtd:sandbox-pokedex-prototype:trackers:v2',JSON.stringify({version:2,trackers:[{id:'preview-only',name:'Ancienne preview',catalogId:'home',states:{1:2}}]}));
   });
   await context.route('https://www.gstatic.com/firebasejs/**',route=>{
    const file=new URL(route.request().url()).pathname.split('/').at(-1);
    return sdk[file]?route.fulfill({contentType:'application/javascript',body:sdk[file]}):route.abort();
   });
   const page=await context.newPage(),errors=[],backend=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{if(/firestore\.googleapis|identitytoolkit|securetoken/.test(request.url())) backend.push(request.url());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/#pokedex');
   await page.waitForFunction(()=>typeof window.testAuth==='function');
   await page.evaluate(()=>window.testAuth('A'));
   await page.locator('#app-shell').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>IS_PREVIEW_MODE),false);
   assert.equal(await page.locator('#page-pokedex').isVisible(),true,'Pokédex route works outside preview');
   assert.equal(await page.locator('[data-tracker]').count(),0,'Prototype storage never enters a real account');
   await page.locator('#dex-new').click();await page.locator('[data-dex-choice="home"]').click();
   await page.locator('#dex-name').fill('Compte A');await page.locator('#dex-editor-save').click();
   await page.locator('[data-id="1"]').click();
   const tracker=await page.evaluate(()=>structuredClone(POKEDEX_TRACKERS[0]));
   assert.equal(tracker.states[1],1);
   await page.evaluate(()=>window.JTDPrepareReload());
   assert.equal(await page.evaluate(()=>window.testDocuments['users/A'].pokedex[0].states[1]),1,'Private cloud payload includes progression');
   const backup=await page.evaluate(()=>buildBackupPayload());assert.equal(backup.version,5);assert.equal(backup.data.pokedex[0].id,tracker.id);
   // Capture an A deletion callback, then load a B tracker with the same id.
   await page.evaluate(()=>{window.originalConfirm=confirmAction;confirmAction=(message,callback)=>{window.staleDexDelete=callback;};});
   await page.locator('#dex-edit-current').click();await page.locator('#dex-delete').click();
   await page.evaluate(tracker=>{window.testDocuments['users/B']={games:[],pokedex:[{...tracker,name:'Compte B',states:{4:2}}]};},tracker);
   await page.evaluate(()=>window.testAuth('B'));
   await page.locator('.nav-tab[data-page="pokedex"]').click();
   assert.equal(await page.locator('#dex-editor-overlay').isVisible(),false,'Account change closes editors');
   await page.evaluate(()=>window.staleDexDelete());
   assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS[0].name),'Compte B','Stale A callback cannot delete a B tracker');
   assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS[0].states[1]),undefined);
   await page.evaluate(()=>window.JTDPrepareReload());
   assert.equal(await page.evaluate(()=>window.testDocuments['users/B'].pokedex[0].states[4]),2);
   await page.evaluate(()=>window.testAuth(null));assert.equal(await page.locator('#app-shell').isVisible(),false);assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS.length),0);
   await page.evaluate(()=>window.testAuth('A'));await page.locator('.nav-tab[data-page="pokedex"]').click();
   await page.locator('[data-tracker="'+tracker.id+'"]').click();assert.equal(await page.locator('.dex-slot[data-pokemon="1"]').getAttribute('data-state'),'1');
   // Restoring an old backup clears only the Pokédex section, then v5 restores it.
   await page.evaluate(()=>applyRestoredData(JTDData.parseBackup({app:'Jeux Tout Doux',version:4,data:{games:[]}})));
   assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS.length),0);
   await page.evaluate(backup=>applyRestoredData(JTDData.parseBackup(backup)),backup);
   assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS[0].states[1]),1);
   await page.evaluate(()=>window.JTDPrepareReload());
   await page.evaluate(()=>{window.testReadFails=true;return window.testAuth('C');});
   assert.equal(await page.evaluate(()=>window.JTDCanWriteData()),false);assert.equal(await page.locator('#app-shell').isVisible(),false);
   const count=await page.evaluate(()=>testWrites.length);
   // Programmatic events must also respect the loading failure, even behind the login gate.
   await page.evaluate(()=>{document.getElementById('dex-new').click();document.getElementById('dex-name').value='Refusé';document.getElementById('dex-create').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
   assert.equal(await page.evaluate(()=>POKEDEX_TRACKERS.length),0);
   assert.equal(await page.evaluate(()=>testWrites.length),count);
   assert.deepEqual(backend,[]);assert.deepEqual(errors,[]);
   console.log('PASS Pokédex account integration',width,theme);await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
