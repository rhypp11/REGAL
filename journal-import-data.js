/* File parsing and duplicate proposals. No network, DOM or account access. */
(function(root){
 'use strict';
 const D=root.JTDData||(typeof require==='function'?require('./jtd-data.js'):null);
 const J=root.JTDJournalData||(typeof require==='function'?require('./journal-data.js'):null);
 const clean=value=>String(value??'').trim();
 const months=['janv','fevr','mars','avr','mai','juin','juil','aout','sept','oct','nov','dec'];
 function dateFromSheet(value,year){
  const raw=clean(value),fold=D.foldImport(raw);
  if(!raw)return '';
  if(J.validDate(raw))return raw;
  let m=raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if(m){const d=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');if(J.validDate(d))return d;}
  m=fold.match(/^(?:(\d{4})\s+)?(?:(\d{1,2})\s+)?([a-z]+)$/);
  if(m){const index=months.findIndex(name=>name===m[3]||name.startsWith(m[3])||m[3].startsWith(name));const y=m[1]||String(year||'');if(index>=0&&/^\d{4}$/.test(y)){
   const d=y+'-'+String(index+1).padStart(2,'0')+(m[2]?'-'+m[2].padStart(2,'0'):'');if(J.validDate(d))return d;
  }}
  throw Error('Date non reconnue : '+raw+'. Indique une année pour les dates au mois.');
 }
 function parseDelimited(text,delimiter){
  const result=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
   const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
   else if(ch==='"'&&!field)quoted=true;else if(ch===delimiter){row.push(field);field='';}
   else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);result.push(row);row=[];field='';}else field+=ch;
  }
  if(quoted)throw Error('Le fichier contient une cellule entre guillemets non fermée.');
  if(field||row.length){row.push(field);result.push(row);}return result;
 }
 const accessMap={'💿':['physical','owned'],'🌐':['digital','owned'],'🔴':['digital','subscription'],'🔵':['digital','subscription'],'🟢':['digital','subscription'],'👪':['digital','family'],'🏴‍☠️':['digital','emulation']};
 const completions={'✅':'finished','💯':'hundred','🏆':'achievements'};
 const feelings={'💎':'gem','🩷':'love','❤':'love','❤️':'love','👍':'like','😐':'mixed','💩':'dislike'};
 function sourceKey(r){return JSON.stringify([D.foldImport(r.nom),D.importPlatform(r.plateforme),r.kind,r.finishedAt,r.completion]);}
 function parseSheet(sheet,year){
  if(!Array.isArray(sheet.values)||sheet.values.length>10000)throw Error('Tableau de journal invalide.');
  const header=sheet.values[0]||[],dateCol=header.findIndex(v=>clean(v)==='📅'),ratingCol=header.findIndex(v=>clean(v)==='📖');
  if(dateCol<0||ratingCol<0)throw Error('En-têtes du journal introuvables dans '+(sheet.name||'le fichier')+'. Exporte l’onglet du journal avec ses en-têtes.');
  const titleCol=ratingCol-5,platformCol=dateCol+2;
  if(titleCol<=platformCol)throw Error('Disposition du journal non reconnue.');
  const entries=[],warnings=[];
  for(let i=1;i<sheet.values.length;i++){
   const row=sheet.values[i]||[],nom=clean(row[titleCol]),plateforme=D.importPlatform(row[platformCol]),completion=completions[clean(row[titleCol+3])];
   // Only completed journal rows; never look at sidebar columns or statistics.
   if(!nom||!plateforme||!completion)continue;
   const symbol=clean(row[titleCol+1]),extension=symbol==='🧩',replay=symbol==='🔁';
   const access=accessMap[symbol];let finishedAt='',dateWarning='';
   try{finishedAt=dateFromSheet(row[dateCol],sheet.year||year);}catch(e){dateWarning=e.message;}
   const notes=[];for(let c=dateCol;c<=ratingCol+5;c++){const note=clean(sheet.notes?.[i+':'+c]);if(note&&!notes.includes(note))notes.push(note);}
   const labels=['Scénario','Gameplay','Visuel','Durée','Musique'];
   const ratings=labels.map((label,c)=>clean(row[ratingCol+c])?label+' : '+clean(row[ratingCol+c]):'').filter(Boolean);
   const mode=clean(row[titleCol+2]);
   const extra=mode&&mode!=='👤'?'Mode de jeu (Sheets) : '+mode:'';
   const review=[...notes,ratings.length?'Notes du Sheets\n'+ratings.join('\n'):'',extra,replay?'Replay indiqué dans le Sheets.':''].filter(Boolean).join('\n\n');
   const record={id:'sheet-row-'+entries.length,nom,plateforme,kind:extension?'extension':'game',parentName:'',collectionId:null,status:'done',completion,medium:access?.[0]||(extension?'digital':''),access:access?.[1]||(extension?'owned':''),finishedAt,feeling:feelings[clean(row[ratingCol+5])]||'',review,image:'',imageFit:'contain'};
   record.importSource=sourceKey(record);
   entries.push({record,line:i+1,source:sheet.name||'CSV',dateWarning,rawDate:clean(row[dateCol]),replay,unknownAccess:!access&&!extension,symbol});
  }
  if(!entries.length)throw Error('Aucun jeu terminé trouvé dans le journal. Les blocs latéraux sont exclus.');
  if(!sheet.notes)warnings.push('Le CSV ne contient pas les notes de cellules (avis). Utilise le JSON préparé depuis Sheets pour les conserver.');
  return {entries,warnings};
 }
 function parseFile(text,name,year){
  if(text.length>10000000)throw Error('Fichier trop volumineux.');
  if(/\.json$/i.test(name)){
   const file=JSON.parse(text);if(file.app!=='JTD Sheets Journal'||file.version!==1||!Array.isArray(file.sheets))throw Error('Choisis un export de journal Sheets, pas une sauvegarde complète.');
   const parsed=file.sheets.map(sheet=>parseSheet(sheet,year));return {entries:parsed.flatMap(x=>x.entries),warnings:[...new Set(parsed.flatMap(x=>x.warnings))]};
  }
  const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];
  const delimiter=/\.tsv$/i.test(name)?'\t':['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  return parseSheet({name,values:parseDelimited(text.replace(/^\uFEFF/,''),delimiter)},year);
 }
 function dateOverlap(a,b){return !a||!b||a.startsWith(b)||b.startsWith(a);}
 function sameWork(a,b){return D.importKey(a)===D.importKey(b)&&a.kind===b.kind;}
 function classify(entries,state){
  const previous=[];
  return entries.map(item=>{
   const r=item.record,existing=state.journal.find(x=>x.importSource===r.importSource||sameWork(x,r)&&x.finishedAt===r.finishedAt&&x.completion===r.completion);
   const repeated=previous.find(x=>sameWork(x,r)&&x.finishedAt===r.finishedAt&&x.completion===r.completion);
   const possible=[...state.journal,...previous].filter(x=>sameWork(x,r)&&dateOverlap(x.finishedAt,r.finishedAt));
   const candidates=r.kind==='game'?D.importCandidates(r,state.games,state.cemetery):[];
   const needs=!!item.dateWarning||item.unknownAccess||r.kind==='extension'||possible.length||candidates.some(x=>x.score>0);
   previous.push(r);
   return {...item,candidates,possible,choice:existing||repeated?'skip':needs?'':'add',collectionId:'',kind:existing||repeated?'duplicate':needs?'review':'new'};
  });
 }
 const api={parseFile,parseSheet,dateFromSheet,sourceKey,classify,dateOverlap};root.JTDJournalImportData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
