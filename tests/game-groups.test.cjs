const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../jtd-data.js');
const g=(id,extra={})=>({id,nom:'Aventure fictive',plateforme:'Switch',format:'Physique',...extra});
test('grouping is explicit, preserves each purchase and uses the target common status',()=>{
 const raw=[g('box',{prix:40,date:'2020-03-20',status:'a_jouer'}),g('download',{format:'Numérique',prix:20,accountId:'jp',currency:'JPY',status:'termine'}),g('ps',{plateforme:'PS4',prix:30})];
 assert.equal(D.collectionEntries(raw,{media:'all'}).length,3,'Same titles never merge automatically');
 const linked=D.linkGameCopies(raw,'box','download','shared');
 assert.equal(raw[0].status,'a_jouer');assert.equal(linked[0].status,'termine');
 assert.deepEqual(linked.map(x=>x.prix),[40,20,30]);assert.deepEqual(linked.map(x=>x.id),['box','download','ps']);assert.equal(linked[1].accountId,'jp');
 const third=D.linkGameCopies(linked,'ps','box','unused');
 assert.equal(third[2].gameGroupId,'shared');assert.equal(D.uniqueGames(third).length,1);
 const entries=D.collectionEntries(third,{media:'all'});assert.equal(entries.length,1);assert.deepEqual(entries[0]._copyIds,['box','download','ps']);
 assert.equal(entries[0].prix,null,'Different currencies are never added together');
 const filtered=D.collectionEntries(third,{media:'physical',platform:'PS4',status:'termine'});
 assert.equal(filtered.length,1);assert.deepEqual(filtered[0]._copyIds,['ps']);assert.equal(D.gameStatus(third[2],third),'termine');
 const detached=D.linkGameCopies(third,'ps',null);assert.equal(detached[2].gameGroupId,null);assert.equal(detached[2].status,'termine');assert.equal(D.uniqueGames(detached).length,2);
});
test('Switch 2 upgrades project the base game without rewriting its acquisition or links',()=>{
 const raw=[g('base',{format:'Numérique',date:'2020-03-20',prix:59.99}),g('upgrade',{format:'Numérique',plateforme:'Switch 2',contentType:'upgrade',parentId:'base',prix:4.99}),g('dlc',{format:'Numérique',contentType:'dlc',parentId:'base',prix:20})];
 assert.equal(D.effectivePlatform(raw[0],raw),'Switch 2');
 const all=D.collectionEntries(raw,{media:'all'});assert.equal(all.length,1);assert.deepEqual(all[0]._purchaseIds,['base','upgrade','dlc']);
 const upgraded=D.collectionEntries(raw,{media:'digital',platform:'Switch 2'});assert.equal(upgraded[0].id,'base');assert.equal(upgraded[0].plateforme,'Switch 2');
 assert.equal(raw[0].plateforme,'Switch');assert.equal(raw[0].date,'2020-03-20');assert.equal(raw[1].parentId,'base');
 assert.equal(D.effectivePlatform(raw[0],[raw[0],raw[2]]),'Switch');
 assert.equal(D.collectionEntries(raw,{media:'digital',types:['upgrade']})[0].id,'upgrade');
 const missing=raw.slice(1);assert.equal(D.collectionEntries(missing,{media:'digital'}).length,2,'Detached or absent parents never hide purchases');
});
test('groups and DLC survive complete backups and consultation exports without prices leaking',()=>{
 const input={games:[g('a',{gameGroupId:'group-1',status:'abandonne',prix:40}),g('b',{gameGroupId:'group-1',format:'Numérique',status:'abandonne'}),g('dlc',{format:'Numérique',contentType:'dlc',parentId:'b',status:'a_jouer'})]};
 const saved=D.parseBackup({app:'Jeux Tout Doux',version:5,data:input});
 assert.equal(saved.games[0].gameGroupId,'group-1');assert.equal(saved.games[2].parentId,'b');assert.equal(D.uniqueGames(saved.games).length,2);
 const publicData=D.createPublicSharePayload(saved);assert.equal(publicData.games[0].gameGroupId,'group-1');assert.equal('prix' in publicData.games[0],false);
 const consultation=D.createCollectionPayload(saved);assert.equal(consultation.data.games[1].gameGroupId,'group-1');
 for(const gameGroupId of [[],{},'bad/id','x'.repeat(201)])assert.throws(()=>D.normalizeData({games:[g('bad',{gameGroupId})]}));
 assert.throws(()=>D.normalizeData({games:[g('bad',{gameGroupId:'g',format:'Numérique',contentType:'dlc'})]}));
 assert.equal(D.parseBackup({games:[g('legacy')]}).games[0].gameGroupId,undefined);
});
test('filtered rows and represented purchases keep matching copies and DLC independently',()=>{
 const raw=[g('box',{gameGroupId:'g',status:'termine',collector:true}),g('digital',{gameGroupId:'g',format:'Numérique',status:'termine'}),g('dlc',{format:'Numérique',contentType:'dlc',parentId:'digital',status:'a_jouer'})];
 assert.equal(D.collectionEntries(raw,{media:'all'})[0]._purchaseIds.length,3);
 assert.deepEqual(D.collectionEntries(raw,{media:'physical'})[0]._purchaseIds,['box']);
 assert.deepEqual(D.collectionEntries(raw,{media:'digital',status:'a_jouer'}).map(x=>x.id),['dlc']);
 assert.deepEqual(D.collectionEntries(raw,{media:'all',collector:true})[0]._copyIds,['box']);
 const renamed=raw.map(x=>x.id==='digital'?{...x,nom:'Version japonaise fictive'}:x);
 assert.deepEqual(D.collectionEntries(renamed,{media:'all',search:'japonaise'})[0]._copyIds,['digital']);
 assert.equal(D.linkGameCopies(raw,'box','digital','ignored')[2].status,'a_jouer','DLC completion is never copied from its base game');
});
