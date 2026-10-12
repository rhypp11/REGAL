const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../jtd-data.js');
const game=(id,nom='Un jeu',plateforme='NSW',other={})=>({id,nom,plateforme,...other});
const record=(id,collectionId,other={})=>({id,nom:'Titre du parcours',plateforme:'PC',collectionId,status:'done',finishedAt:'2026-02-01',review:'Un avis',...other});
test('ChatGPT export preserves exemplars, replays, deleted links and lot identity without private acquisition or image data',()=>{
  const data={games:[game('g')],cemetery:[game('c','Vendu','PS5',{saleStatus:'sold',salePrice:20,saleId:'lot'}),game('d','Vendu B','PS5',{saleStatus:'sold',salePrice:20,saleId:'lot'})],journal:[record('r','g'),record('replay','g'),record('sold','c'),record('deleted','missing'),record('free',null)],profile:{name:'Privé'},shareToken:'secret'};
  data.games[0].image='https://example.com/art.png';data.games[0].prix=100;data.games[0].source='Magasin';
  const exported=D.createChatGPTPayload(data);
  assert.equal(exported.data.games[0].id,'g');assert.equal(exported.data.journal[0].collectionId,'g');
  assert.equal(exported.data.journal[1].collectionId,'g');assert.equal(exported.data.journal[3].collectionId,'missing');assert.equal(exported.data.journal[4].collectionId,null);
  assert.equal(exported.data.journal[0].review,'Un avis');assert.equal(exported.data.cemetery[0].saleId,exported.data.cemetery[1].saleId);
  for(const field of ['image','prix','source'])assert.equal(field in exported.data.games[0],false);
  assert.equal('profile' in exported.data,false);assert.equal(JSON.stringify(exported).includes('secret'),false);
  assert.equal('journal' in D.createPublicSharePayload(data),false);
  assert.throws(()=>D.parseBackup(exported),/ChatGPT/);
});
test('complete v4 backup round trip preserves links, former status, lot, profile and platform settings',()=>{
  const data={games:[game('g','Physique','PS5',{status:'multi'})],cemetery:[game('sold','Vendu','PS5',{saleStatus:'sold',salePrice:30,saleId:'lot'})],journal:[record('r','g'),record('old','sold')],profile:{name:'Test'},platformOrder:['PS5'],platformMeta:{PS5:{color:'#123456'}}};
  const restored=D.parseBackup({app:'Jeux Tout Doux',version:4,data});
  assert.equal(restored.games[0].status,'termine_ailleurs');assert.equal(restored.games[0].journalPreviousStatus,'multi');
  assert.equal(restored.journal[1].collectionId,'sold');assert.equal(restored.profileName,'Test');assert.deepEqual(restored.platformOrder,['PS5']);assert.equal(restored.cemetery[0].saleId,'lot');
  assert.deepEqual(D.normalizeData(restored),restored);
});
test('ambiguous backup IDs referenced by journal are refused instead of silently redirecting history',()=>{
  assert.throws(()=>D.normalizeData({games:[game('g')],cemetery:[game('g')],journal:[record('r','g')]}),/ambigu/);
  assert.throws(()=>D.normalizeData({games:[game('g'),game('g')],journal:[record('r','g')]}),/ambigu/);
  assert.equal(D.normalizeData({games:[game('g'),game('g')]}).games.length,2,'legacy duplicates without journal links are still repaired');
});
test('cloud ceiling counts UTF-8 bytes before any caller writes',()=>{
  assert.equal(D.assertCloudSize({games:[]}).games.length,0);
  assert.throws(()=>D.assertCloudSize({review:'é'.repeat(450000)}),/volumineuses/);
  assert.doesNotThrow(()=>D.assertCloudSize({review:'a'.repeat(800000)}));
});
test('candidate proposals preserve every physical copy and include sold copies across title and platform differences',()=>{
  const incoming=game('new','Dark Souls II: Scholar of the First Sin','Steam');
  const candidates=D.importCandidates(incoming,[game('a',incoming.nom,'PC'),game('b',incoming.nom,'PC'),game('c','Dark Souls II Scholar ot the First Sin','PS4')],[game('sold',incoming.nom,'PC',{saleStatus:'sold'})]);
  assert.equal(candidates.filter(x=>x.exact).length,3);assert.equal(candidates.find(x=>x.id==='sold').location,'sold');assert.ok(candidates.find(x=>x.id==='c').score>0);
  assert.equal(D.importKey(game('a','Pokémon : Test','NSW')),D.importKey(game('b','Pokemon Test','Nintendo Switch')));
  assert.equal(D.importKey(game('a','Titre','GC')),D.importKey(game('b','Titre','Nintendo Gamecube')));
  assert.notEqual(D.importKey(game('a','Titre','NSW')),D.importKey(game('b','Titre','NS2')));
});
