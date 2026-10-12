const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../journal-import-data.js'),D=require('../jtd-data.js'),J=require('../journal-data.js');
function sheet(layout='current'){
 const date=layout==='current'?6:1,rating=layout==='current'?15:layout==='archive'?10:9,title=rating-5;
 const header=Array(34).fill('');header[date]='📅';header[rating]='📖';header[rating+5]='🤍';header[23]='🎮 BACKLOG';
 const row=Array(34).fill('');row[date]=layout==='current'?'févr.':'2026 - 9 févr.';row[date+2]='NSW';row[title]='Jeu fictif';row[title+1]='🌐';row[title+2]='👤';row[title+3]='✅';row[rating]='A';row[rating+1]='S';row[rating+5]='🩷';row[25]='Jeu latéral à exclure';
 return {name:'Fictif',year:2026,values:[header,row],notes:{['1:'+(rating+5)]:'Avis avec une virgule, et\nun retour à la ligne.'}};
}
module.exports={sheet};
test('parses three layouts, excludes sidebars and preserves notes, ratings, symbols and partial dates',()=>{
 for(const layout of ['current','archive','pre']){
  const r=P.parseSheet(sheet(layout),2026).entries[0].record;
  assert.equal(r.nom,'Jeu fictif');assert.equal(r.plateforme,'Nintendo Switch');assert.equal(r.finishedAt,layout==='current'?'2026-02':'2026-02-09');assert.equal(r.medium,'digital');assert.equal(r.feeling,'love');
  assert.match(r.review,/Avis avec une virgule/);assert.match(r.review,/Scénario : A/);assert.match(r.review,/Gameplay : S/);assert.equal(r.review.includes('Jeu latéral'),false);
 }
});
test('French dates preserve precision and reject impossible dates',()=>{
 for(const [source,result] of [['2013','2013'],['janv.','2026-01'],['2025 - 9 août','2025-08-09'],['21/12/2018','2018-12-21'],['2026-03','2026-03']])assert.equal(P.dateFromSheet(source,2026),result);
 for(const date of ['2026-02-30','2026-13','0000','2019 - 31 févr.'])assert.throws(()=>P.dateFromSheet(date,2026));
 for(const date of ['2026','2026-02','2026-02-28'])assert.equal(J.validDate(date),true);
 assert.equal(J.dateLabel('2026-02'),'février 2026');assert.equal(J.dateLabel('2013'),'2013');
});
test('CSV quotes, BOM, multiline cells and sidebars are parsed without including unfinished rows',()=>{
 const source=sheet(),matrix=source.values;
 matrix[1][10]='Titre, avec\nretour';const csv=matrix.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const parsed=P.parseFile('\uFEFF'+csv,'journal.csv',2026);assert.equal(parsed.entries.length,1);assert.equal(parsed.entries[0].record.nom,'Titre, avec\nretour');assert.match(parsed.warnings[0],/notes de cellules/);
 const ignored=matrix[1].slice();ignored[10]='Pas terminé';ignored[13]='';matrix.push(ignored);assert.equal(P.parseSheet(source,2026).entries.length,1);
 assert.throws(()=>P.parseFile('bad','journal.csv',2026),/En-têtes/);
});
test('extensions, replay and unknown access are explicit review cases',()=>{
 for(const symbol of ['🧩','🔁','']){
  const source=sheet();source.values[1][11]=symbol;const item=P.parseSheet(source,2026).entries[0];
  const row=P.classify([item],{games:[],cemetery:[],journal:[]})[0];assert.equal(row.kind,'review');assert.equal(row.choice,'');
  if(symbol==='🧩'){assert.equal(row.record.kind,'extension');assert.equal(row.candidates.length,0);}else assert.equal(row.unknownAccess,true);
 }
});
test('same source is skipped after edits; overlapping partial dates require a decision; distinct dated replays stay distinct',()=>{
 const item=P.parseSheet(sheet(),2026).entries[0],first={...item.record,id:'old',nom:'Titre renommé'};
 assert.equal(P.classify([item],{games:[],cemetery:[],journal:[first]})[0].choice,'skip');
 const existing={...item.record,id:'old',importSource:undefined,finishedAt:'2026-02-09'};
 assert.equal(P.classify([item],{games:[],cemetery:[],journal:[existing]})[0].kind,'review');
 const later={...item,record:{...item.record,finishedAt:'2026-03-02',importSource:'other'}};
 assert.equal(P.classify([later],{games:[],cemetery:[],journal:[existing]})[0].kind,'new');
 assert.equal(P.classify([item,item],{games:[],cemetery:[],journal:[]})[1].choice,'skip');
});
test('physical collection remains physical, a linked digital journey marks finished elsewhere, v5 backup preserves source and precision',()=>{
 const item=P.parseSheet(sheet(),2026).entries[0].record;const data={games:[{id:'g',nom:'Jeu fictif',plateforme:'NSW',format:'Physique',status:'multi'}],journal:[{...item,collectionId:'g'}]};
 const restored=D.parseBackup({app:'Jeux Tout Doux',version:5,data});assert.equal(restored.games[0].format,'Physique');assert.equal(restored.games[0].status,'termine_ailleurs');assert.equal(restored.journal[0].finishedAt,'2026-02');assert.equal(restored.journal[0].importSource,item.importSource);
 assert.equal(D.createChatGPTPayload(restored).data.journal[0].finishedAt,'2026-02');
});
