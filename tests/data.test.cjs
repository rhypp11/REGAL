const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../jtd-data.js');
const game = (extra = {}) => ({id:'g',nom:'Persona',plateforme:'PC',format:'Physique',...extra});
test('image modes survive backups and transfers, older data stays compatible',()=>{
  const parsed=D.parseBackup({app:'Jeux Tout Doux',version:3,data:{games:[game({imageFit:'cover'})],wishlist:[game({id:'w',imageFit:'contain'})],arrivals:[game({id:'a',imageFit:'unexpected'})],cemetery:[game({id:'c',imageFit:'cover',saleStatus:'pending'})]}});
  assert.equal(parsed.games[0].imageFit,'cover');
  assert.equal(parsed.wishlist[0].imageFit,'contain');
  assert.equal(parsed.arrivals[0].imageFit,'contain');
  assert.equal(parsed.cemetery[0].imageFit,'cover');
  assert.equal(D.parseBackup([game()]).games[0].imageFit,undefined);
  assert.equal(D.transferItem(parsed.games,[], 'g', parsed.games[0]).target[0].imageFit,'cover');
});
function memory(){
  const values = new Map();
  return {values,getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
test('v2 backup preserves flags, purchases and partial dates', () => {
  const result = D.parseBackup({app:'Jeux Tout Doux',version:2,data:{games:[game({collector:true,japanese:true,prix:12.5,date:'2026-10-01',source:'Steam'})],wishlist:[game({id:'w',date:'2027',lien:'https://example.com'})],arrivals:[],profile:{name:'Rom',avatar:null}}});
  assert.equal(result.games[0].japanese,true);
  assert.equal(result.games[0].prix,12.5);
  assert.equal(result.games[0].source,'Steam');
  assert.equal(result.wishlist[0].date,'2027');
  assert.equal(result.profileName,'Rom');
});
test('legacy arrays migrate collector and numeric, missing or duplicate ids', () => {
  const data = D.parseBackup([game({id:12,format:'Collector'}),game({id:12}),game({id:undefined})]);
  assert.equal(data.games[0].id,'12');
  assert.equal(data.games[0].collector,true);
  assert.equal(data.games[0].format,'Physique');
  assert.equal(new Set(data.games.map(g=>g.id)).size,3);
});
test('malformed sections, profile, prices, metadata and future versions are rejected', () => {
  for(const data of [{games:[],wishlist:'bad'},{games:[game({nom:''})]},{games:[game({prix:'20'})]},{games:[game({date:{}})]},{games:[],platformMeta:{PC:'bad'}},{games:[],platformMeta:{PC:{color:'red;display:none'}}},{games:[],platformOrder:[{}]},{games:[],profile:[]}]) assert.throws(()=>D.parseBackup(data));
  for(const version of [5,'3','2',null]) assert.throws(()=>D.parseBackup({app:'Jeux Tout Doux',version,data:{games:[]}}));
});
test('text and URLs do not become markup or script protocols', () => {
  assert.equal(D.escapeHTML('<img src=x onerror="x"> & \'x\''),'&lt;img src=x onerror=&quot;x&quot;&gt; &amp; &#39;x&#39;');
  for(const url of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com','<img>']) assert.equal(D.safeURL(url),'');
  assert.equal(D.safeURL('data:image/png;base64,AAAA',true),'data:image/png;base64,AAAA');
  assert.equal(D.safeURL('data:image/svg+xml;base64,AAAA',true),'');
  const item = D.parseBackup([game({image:'javascript:alert(1)',lien:'javascript:alert(1)'})]).games[0];
  assert.equal(item.image,null); assert.equal(item.lien,null);
});
test('account storage never falls back to legacy or another account', () => {
  const raw = memory(), storage = D.createStorage(raw);
  raw.setItem('games','legacy');
  storage.setAccount('A'); assert.equal(storage.getItem('games'),null);
  storage.setItem('games','A-data');
  storage.setAccount('B'); assert.equal(storage.getItem('games'),null);
  storage.setItem('games','B-data');
  storage.setAccount('A'); assert.equal(storage.getItem('games'),'A-data');
  assert.equal(raw.getItem('games'),'legacy');
  storage.setAccount(null); assert.throws(()=>storage.setItem('games','oops'));
});
test('a quota error rolls back all writes instead of persisting a partial restore', () => {
  const raw = memory(), storage = D.createStorage(raw);storage.setAccount('A');
  storage.setItem('games','old-games');storage.setItem('wishlist','old-wishes');
  const original = raw.setItem; raw.setItem = (key,value) => {if(value==='new-wishes') throw new Error('quota');original(key,value);};
  assert.throws(()=>storage.atomicWrite([['games','new-games'],['wishlist','new-wishes']]),/annulée/);
  assert.equal(storage.getItem('games'),'old-games');assert.equal(storage.getItem('wishlist'),'old-wishes');
});
test('old sessions remain invalid after logout and login with the same UID', () => {
  const sessions = D.createSession(), old = sessions.start('A');
  sessions.start(null);const next = sessions.start('A');
  assert.equal(sessions.isCurrent(old),false);assert.equal(sessions.isCurrent(next),true);
});

async function cloudHarness(){
  const raw = memory(), storage = D.createStorage(raw), writes = [];
  const element = {classList:{add(){},remove(){},toggle(){}},addEventListener(){},dataset:{}};
  const ctx = {
    console,JSON,Date,Uint8Array,crypto:require('node:crypto').webcrypto,
    setTimeout,clearTimeout,URL,window:{JTD_PREVIEW_MODE:false,cancelPendingConfirmation(){}},state:{platform:null,search:''},JTDData:D,accountStorage:storage,
    document:{getElementById:()=>element},navigator:{clipboard:{writeText:async()=>{}}},
    GAMES:[],ARRIVALS:[],WISHLIST:[],CEMETERY:[],JOURNAL:[],CEMETERY_KEY:'cemetery',platformMeta:{},platformOrder:[],PROFILE_NAME:'',PROFILE_AVATAR:null,SHARE_TOKEN:null,STORAGE_KEY:'games',
    initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),doc:(_db,collection,id)=>({collection,id}),
    getDoc:async()=>({exists:()=>false}),setDoc:async(ref,data)=>writes.push({ref,data}),deleteDoc:async()=>{},
    onAuthStateChanged:(_auth,callback)=>{ctx.authCallback=callback;},signInWithEmailAndPassword(){},createUserWithEmailAndPassword(){},signOut(){},
    initializeNavigation(){},resetNavigationSession(){},showToast(){},normalizeCollectionEditions(){},buildPlatformList(){},buildFormatToggles(){},buildStatusToggles(){},render(){},renderArrivals(){},renderWishlist(){},renderProfileAvatar(){},updateBackupNote(){},closeModal(){},closeArrivalModal(){},closeWishlistModal(){},closePlatformModal(){},closeMobileDrawers(){}
  };
  ctx.replaceAppData = data => {for(const [key,value] of Object.entries(data)){const names={games:'GAMES',arrivals:'ARRIVALS',wishlist:'WISHLIST',cemetery:'CEMETERY',journal:'JOURNAL',profileName:'PROFILE_NAME',profileAvatar:'PROFILE_AVATAR'};ctx[names[key]||key]=value;}};
  ctx.persistAppData = data => storage.atomicWrite([['games',JSON.stringify(data.games)]]);
  ctx.initApp = async () => {const games=storage.getItem('games');ctx.GAMES=games?JSON.parse(games):[];};
  vm.createContext(ctx);
  const file = fs.readFileSync(require.resolve('../firebase.js'),'utf8');
  const source = file.slice(file.indexOf('  const firebaseConfig'));
  await vm.runInContext('(async()=>{'+source+'\nwindow.testCloud={scheduleCloudSync,doCloudSync,sessions};})()',ctx);
  return {ctx,writes,storage};
}

test('private journal follows the cloud account and cannot leak into the next account',async()=>{
 const {ctx,writes}=await cloudHarness();
 ctx.getDoc=async(ref)=>({exists:()=>ref.id==='A',data:()=>({games:[],journal:[{id:'r',nom:'Jeu de test',plateforme:'PC',status:'done',review:'Avis privé'}]})});
 await ctx.authCallback({uid:'A'});assert.equal(ctx.JOURNAL[0].review,'Avis privé');
 await ctx.window.JTDPrepareReload();assert.equal(writes.at(-1).data.journal[0].review,'Avis privé');
 await ctx.authCallback(null);assert.equal(ctx.JOURNAL.length,0);
 await ctx.authCallback({uid:'B'});assert.equal(ctx.JOURNAL.length,0);assert.equal(writes.at(-1).data.journal.length,0);
});
test('existing empty cloud collection stays authoritative despite stale scoped games', async () => {
  const {ctx,writes,storage}=await cloudHarness();storage.setAccount('A');storage.setItem('games',JSON.stringify([game()]));
  ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[],wishlist:[game({id:'w'})],arrivals:[]})});
  await ctx.authCallback({uid:'A'});
  assert.equal(ctx.GAMES.length,0);assert.equal(ctx.WISHLIST.length,1);assert.equal(writes.length,0);
  assert.equal(storage.getItem('games'),'[]');
});
test('a full local cache does not prevent reading valid cloud data', async () => {
  const {ctx,writes}=await cloudHarness();ctx.console={error(){}};
  ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[game({nom:'Cloud-game'})]})});
  ctx.persistAppData=()=>{throw new Error('quota');};
  await ctx.authCallback({uid:'A'});
  assert.equal(ctx.GAMES[0].nom,'Cloud-game');assert.equal(writes.length,0);
});
test('new account does not import another account or unscoped legacy data', async () => {
  const {ctx,writes,storage}=await cloudHarness();storage.setAccount('A');storage.setItem('games',JSON.stringify([game()]));
  await ctx.authCallback({uid:'A'});await ctx.authCallback(null);await ctx.authCallback({uid:'B'});
  const b=writes.filter(write=>write.ref.id==='B');assert.equal(b.length,1);assert.equal(b[0].data.games.length,0);
});
test('a slow cloud read for A cannot apply after login to B', async () => {
  const {ctx}=await cloudHarness();let release;
  ctx.getDoc=ref=>ref.id==='A'?new Promise(resolve=>{release=resolve;}):Promise.resolve({exists:()=>true,data:()=>({games:[game({nom:'B-game'})]})});
  const first=ctx.authCallback({uid:'A'});await new Promise(resolve=>setImmediate(resolve));
  await ctx.authCallback({uid:'B'});release({exists:()=>true,data:()=>({games:[game({nom:'A-game'})]})});await first;
  assert.equal(ctx.GAMES[0].nom,'B-game');
});
test('logout cancels a pending cloud write', async () => {
  const {ctx,writes}=await cloudHarness();ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[]})});
  await ctx.authCallback({uid:'A'});ctx.window.JTDDataChanged();await ctx.authCallback(null);
  await new Promise(resolve=>setTimeout(resolve,950));assert.equal(writes.length,0);
});
test('cloud read failure blocks automatic writes', async () => {
  const {ctx,writes}=await cloudHarness();ctx.getDoc=async()=>{throw new Error('offline');};ctx.console={error(){}};
  await ctx.authCallback({uid:'A'});ctx.window.JTDDataChanged();
  await new Promise(resolve=>setTimeout(resolve,950));assert.equal(writes.length,0);
});
test('revoking a share waits for an in-flight save and leaves the token revoked', async () => {
  const {ctx,writes}=await cloudHarness();
  ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[],shareToken:'token-A'})});
  await ctx.authCallback({uid:'A'});writes.length=0;
  let release;const order=[];
  ctx.setDoc=async(ref,data)=>{
    writes.push({ref,data:JSON.parse(JSON.stringify(data))});
    if(ref.collection==='users' && writes.length===1) await new Promise(resolve=>{release=resolve;});
    order.push('write-'+ref.collection);
  };
  ctx.deleteDoc=async()=>{order.push('delete-share');};
  ctx.window.JTDDataChanged();await new Promise(resolve=>setTimeout(resolve,950));
  const revoke=ctx.window.JTDShare.disable();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(order.includes('delete-share'),false);
  release();await revoke;
  assert.equal(ctx.SHARE_TOKEN,null);
  assert.equal(writes.at(-1).data.shareToken,null);
  assert.ok(order.indexOf('delete-share')>order.indexOf('write-users'));
});
test('a failed restore does not replace memory or request cloud sync', () => {
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const fn=source.slice(source.indexOf('function applyRestoredData('),source.indexOf('function restoreBackup('));
  let replaced=false,scheduled=false;
  const ctx={IS_PREVIEW_MODE:false,accountStorage:{atomicWrite(){throw new Error('quota');}},restoredStorageEntries:()=>[],replaceAppData:()=>{replaced=true;},window:{JTDDataChanged:()=>{scheduled=true;}}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);assert.throws(()=>ctx.applyRestoredData({games:[]}),/quota/);
  assert.equal(replaced,false);assert.equal(scheduled,false);
});
test('renaming updates all three lists and preserves flags and purchases', () => {
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const fn=source.slice(source.indexOf('function renamePlatform('),source.indexOf('/* ---------- Ordre personnalisé des plateformes ---------- */'));
  const ctx={GAMES:[game({japanese:true,prix:20})],ARRIVALS:[game({collector:true})],WISHLIST:[game()],CEMETERY:[],JOURNAL:[],CEMETERY_KEY:'cemetery',writeStoredValue(){},window:{},platformMeta:{PC:{color:'#123456'}},platformOrder:['PC'],state:{platform:'PC'},getPlatformColor:()=> '#123456'};
  for(const name of ['savePlatformOrder','saveGames','saveArrivals','saveWishlist','savePlatformMeta','renderArrivals','renderWishlist'])ctx[name]=()=>{};
  vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(ctx.renamePlatform('PC','Ordinateur'),true);
  for(const items of [ctx.GAMES,ctx.ARRIVALS,ctx.WISHLIST])assert.equal(items[0].plateforme,'Ordinateur');
  assert.equal(ctx.GAMES[0].prix,20);assert.equal(ctx.GAMES[0].japanese,true);assert.equal(ctx.ARRIVALS[0].collector,true);
});
test('legacy notice is shown once per account and never removes old data', () => {
  const raw = memory(), storage = D.createStorage(raw);
  raw.setItem('games','old-data');storage.setAccount('A');
  assert.equal(storage.consumeLegacyNotice('games'),true);
  assert.equal(storage.consumeLegacyNotice('games'),false);
  storage.setAccount('B');assert.equal(storage.consumeLegacyNotice('games'),true);
  storage.setAccount('A');assert.equal(storage.consumeLegacyNotice('games'),false);
  assert.equal(raw.getItem('games'),'old-data');
  raw.getItem = () => {throw new Error('unavailable');};
  assert.equal(storage.consumeLegacyNotice('games'),false);
});
test('reload flushes the latest pending save, and a failed save prevents reload', async () => {
  const {ctx,writes}=await cloudHarness();await ctx.authCallback({uid:'A'});
  ctx.GAMES=[game({nom:'Latest change'})];ctx.window.JTDDataChanged();
  assert.equal(await ctx.window.JTDPrepareReload(),true);
  assert.equal(writes.at(-1).data.games[0].nom,'Latest change');
  ctx.setDoc=async()=>{throw new Error('offline');};
  assert.equal(await ctx.window.JTDPrepareReload(),false);
});

test('transfers preserve identity, never mutate input lists and refuse repeated confirmation', () => {
  const original=game({collector:true,japanese:true,image:'https://example.com/art.png'});
  const source=[original], target=[];
  const moved=D.transferItem(source,target,original.id,{...original,prix:49.9,source:'Fnac'});
  assert.equal(source.length,1);assert.equal(target.length,0);
  assert.equal(moved.source.length,0);assert.equal(moved.target[0].id,original.id);
  assert.equal(moved.target[0].collector,true);assert.equal(moved.target[0].japanese,true);
  assert.throws(()=>D.transferItem(moved.source,moved.target,original.id,original),/introuvable/);
  assert.throws(()=>D.transferItem(source,[original],original.id,original),/déjà transféré/);
});
test('a transfer quota failure leaves both lists and memory unchanged', () => {
  const raw=memory(), storage=D.createStorage(raw);storage.setAccount('A');
  const item=game();storage.setItem('arrivals',JSON.stringify([item]));storage.setItem('games','[]');
  const originalSet=raw.setItem;
  raw.setItem=(key,value)=>{if(key.endsWith(':games')&&value!=='[]')throw Error('quota');originalSet(key,value);};
  let changes=0;
  const ctx={JTDData:D,accountStorage:storage,IS_PREVIEW_MODE:false,GAMES:[],ARRIVALS:[item],WISHLIST:[],CEMETERY:[],JOURNAL:[],CEMETERY_KEY:'cemetery',STORAGE_KEY:'games',ARRIVALS_KEY:'arrivals',WISHLIST_KEY:'wishlist',window:{JTDDataChanged(){changes++;}},showToast(){},console:{error(){}}};
  vm.createContext(ctx);
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const start=app.indexOf('function commitBoardTransfer('), end=app.indexOf('\nfunction ',start+10);
  vm.runInContext(app.slice(start,end),ctx);
  assert.equal(ctx.commitBoardTransfer('arrivals','games',item.id,{...item,status:'a_jouer'}),null);
  assert.equal(ctx.ARRIVALS.length,1);assert.equal(ctx.GAMES.length,0);assert.equal(changes,0);
  assert.equal(storage.getItem('arrivals'),JSON.stringify([item]));assert.equal(storage.getItem('games'),'[]');
});


test('public share contains the requested boards and sale details without acquisition data', () => {
  const payload = D.createPublicSharePayload({
    games:[game({id:'private-game-id',prix:49.99,source:'Micromania',date:'2025-01-01',image:'https://example.com/cover.jpg'})],
    wishlist:[game({id:'wishlist-id',date:'2027-05',lien:'https://example.com'})],
    arrivals:[game({id:'arrival-id'})],
    cemetery:[
      game({id:'pending-id',prix:20,source:'Cash',saleStatus:'pending',saleChannel:'online',saleVenue:'Vinted',estimatedPrice:35}),
      game({id:'sold-a',prix:12,source:'Store',saleStatus:'sold',saleId:'internal-lot-id',salePrice:42}),
      game({id:'sold-b',prix:15,source:'Store',saleStatus:'sold',saleId:'internal-lot-id',salePrice:42})
    ]
  }, 123);
  assert.equal(payload.version,2);
  assert.equal(payload.publishedAt,123);
  assert.equal(payload.games[0].nom,'Persona');
  assert.equal(payload.wishlist[0].date,'2027-05');
  assert.equal(payload.arrivals.length,1);
  assert.deepEqual(payload.cemetery.map(item=>item.saleStatus),['pending','sold','sold']);
  assert.equal(payload.cemetery[0].estimatedPrice,35);
  assert.equal(payload.cemetery[0].saleVenue,'Vinted');
  assert.equal(payload.cemetery[1].salePrice,42);
  assert.equal(payload.cemetery[1].lotSize,2);
  for(const board of [payload.games,payload.wishlist,payload.arrivals,payload.cemetery]){
    for(const item of board){
      for(const field of ['id','prix','source','image','lien','saleId']) assert.equal(Object.hasOwn(item,field),false,field);
    }
  }
  for(const board of [payload.games,payload.cemetery]){
    for(const item of board) assert.equal(Object.hasOwn(item,'date'),false);
  }
  assert.deepEqual(Object.keys(payload).sort(),['arrivals','cemetery','games','publishedAt','version','wishlist']);
});

test('retired backup metadata preserves entries without becoming public collection options', () => {
  const original = game({format:'Ancien format',type:'Ancien type',collector:true,prix:25});
  const restored = D.parseBackup([original]);
  assert.equal(restored.games.length,1);
  assert.equal(restored.games[0].format,original.format);
  assert.equal(restored.games[0].type,original.type);
  assert.equal(restored.games[0].prix,25);
  const shared = D.createPublicSharePayload(restored).games[0];
  assert.equal(Object.hasOwn(shared,'format'),false);
  assert.equal(Object.hasOwn(shared,'type'),false);
});
