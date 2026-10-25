const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../jtd-data.js');
const box={id:'box',nom:'Jeu en boîte',plateforme:'Switch',format:'Physique',prix:40};
const base={id:'base',nom:'Jeu numérique',plateforme:'Switch',format:'Numérique',contentType:'game',accountId:'eu',prix:30,currency:'EUR'};
const dlc={id:'dlc',nom:'Extension',plateforme:'Switch',format:'Numérique',contentType:'dlc',parentId:'base',accountId:'eu',prix:20,currency:'EUR'};
test('old backups stay physical; digital purchases, accounts, currency and attachment round-trip',()=>{
  assert.equal(D.parseBackup([{id:'old',nom:'Ancien jeu',plateforme:'PS2'}]).games[0].format,'Physique');
  const data={games:[box,base,dlc],digitalAccounts:[{id:'eu',name:'Principal',ecosystem:'Nintendo',region:'Europe',preferred:true}]};
  const restored=D.parseBackup({app:'Jeux Tout Doux',version:4,data});
  assert.equal(restored.games[2].parentId,'base');assert.equal(restored.games[2].currency,'EUR');assert.equal(restored.games[1].accountId,'eu');
  assert.deepEqual(restored.digitalAccounts,data.digitalAccounts);
  assert.deepEqual(D.normalizeData(JSON.parse(JSON.stringify(restored))),restored);
  assert.equal(D.normalizeData({games:[]}).digitalAccounts.length,0);
});
test('DLC grouping follows format and survives sold, deleted and mismatched parents',()=>{
  assert.deepEqual(D.collectionCards([box,base,dlc],'physical').map(g=>g.id),['box']);
  assert.deepEqual(D.collectionCards([box,base,dlc],'digital').map(g=>g.id),['base']);
  assert.deepEqual(D.collectionCards([box,base,dlc],'all').map(g=>g.id),['box','base']);
  const physicalDlc={...dlc,parentId:'box'};
  assert.deepEqual(D.collectionCards([box,physicalDlc],'digital').map(g=>g.id),['dlc']);
  assert.deepEqual(D.collectionCards([dlc],'digital').map(g=>g.id),['dlc']);
  assert.equal(D.contentParent({...dlc,plateforme:'PS5'},[base]),null);
  assert.equal(D.contentParent({...dlc,parentId:'dlc'},[dlc]),null);
});
test('an account filter or DLC search cannot hide a purchase behind an excluded parent',()=>{
  assert.deepEqual(D.collectionCards([base,{...dlc,accountId:'jp'}],'digital','jp').map(g=>g.id),['dlc']);
  assert.deepEqual(D.collectionCards([base,dlc],'digital',null,'Extension').map(g=>g.id),['dlc']);
});
test('invalid content, currencies, accounts and self-links are rejected',()=>{
  for(const bad of [{...dlc,currency:'<bad>'},{...dlc,contentType:'wrong'},{...dlc,parentId:'dlc'},{...dlc,format:'Physique'}])assert.throws(()=>D.normalizeData({games:[bad]}));
  for(const accounts of ['bad',[{}],[{id:'x',name:'A',ecosystem:'Nintendo'},{id:'x',name:'B',ecosystem:'Nintendo'}]])assert.throws(()=>D.normalizeData({games:[],digitalAccounts:accounts}));
});
test('Switch 2 upgrades retain their target platform and link to a Switch copy',()=>{
  const upgrade={...dlc,id:'upgrade',contentType:'upgrade',plateforme:'Switch 2',parentId:'box'};
  assert.equal(D.contentParent(upgrade,[box])?.id,'box');
  assert.equal(D.contentParent({...upgrade,plateforme:'PlayStation 5'},[box]),null);
  assert.equal(D.contentParent({...upgrade,contentType:'dlc'},[box]),null);
  assert.equal(D.normalizeData({games:[box,upgrade]}).games[1].contentType,'upgrade');
  const digitalBase={...box,format:'Numérique'};
  assert.deepEqual(D.collectionCards([digitalBase,upgrade],'digital').map(g=>g.id),['box','upgrade']);
});
test('account nicknames and avatars round-trip without allowing script URLs',()=>{
  const account={id:'eu',name:'Nintendo',nickname:'Aster',avatar:'data:image/png;base64,AAAA',ecosystem:'Nintendo'};
  const data=D.normalizeData({games:[],digitalAccounts:[account]});
  assert.equal(data.digitalAccounts[0].nickname,'Aster');assert.equal(data.digitalAccounts[0].avatar,account.avatar);
  assert.equal(D.normalizeData({games:[],digitalAccounts:[{...account,avatar:'javascript:alert(1)'}]}).digitalAccounts[0].avatar,null);
});
