const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../jtd-data.js'),J=require('../journal-data.js');
const game={id:'physical',nom:'Ancien nom',plateforme:'PC',status:'multi'};
const entry=(extra={})=>J.normalizeJournal([{id:'r',nom:'Nouveau nom',plateforme:'PC',collectionId:game.id,status:'done',medium:'physical',finishedAt:'2026-10-09',...extra}])[0];
test('retired preview choices are simplified without discarding entries or reviews',()=>{
 const restored=entry({status:'abandoned',completion:'both',review:'Avis de test'});
 assert.equal(restored.status,'backlog');assert.equal(restored.completion,'achievements');assert.equal(restored.review,'Avis de test');
});
test('stable link survives title differences and restores former collection status on unlink',()=>{
 const result=D.normalizeData({games:[game],journal:[entry({completion:'achievements'})]});
 assert.equal(result.games[0].status,'termine');assert.equal(result.games[0].journalPreviousStatus,'multi');
 assert.equal(J.collectionProgress(result.journal,game.id).completion,'achievements');
 assert.equal(D.normalizeData({...result,journal:[]}).games[0].status,'multi');
});
test('replays preserve completed history and digital completion marks finished elsewhere',()=>{
 const journal=[entry({medium:'digital'}),entry({id:'replay',status:'playing'})];
 assert.equal(J.collectionProgress(journal,game.id).replay,true);
 assert.equal(J.collectionProgress(journal,game.id).status,'en_cours');
 assert.equal(J.collectionProgress(journal.slice(0,1),game.id).status,'termine_ailleurs');
 assert.equal(journal[0].finishedAt,'2026-10-09');
});
test('v4 backups preserve private journal and old backups default to an empty journal',()=>{
 const r=entry({review:'Un avis long\navec des retours.',feeling:'love'});
 assert.deepEqual(D.parseBackup({app:'Jeux Tout Doux',version:4,data:{games:[game],journal:[r]}}).journal,[r]);
 assert.deepEqual(D.parseBackup([game]).journal,[]);
 assert.equal('journal' in D.createPublicSharePayload({games:[game],journal:[r]}),false);
});
test('extension is independent, prefixed once, and invalid dates and unsafe images are rejected or cleaned',()=>{
 const r=entry({kind:'extension',parentName:'Jeu',nom:'Extension',collectionId:null});
 assert.equal(J.title(r),'Jeu — Extension');
 assert.equal(J.collectionProgress([r],game.id),null);
 for(const extra of [{finishedAt:'2026-02-30'},{kind:'extension',parentName:'Jeu'},{status:'unknown'},{review:'x'.repeat(20001)}])assert.throws(()=>entry(extra));
 assert.equal(D.normalizeData({games:[],journal:[entry({image:'javascript:alert(1)'})]}).journal[0].image,'');
});
