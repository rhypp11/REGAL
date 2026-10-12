/* Private player journal. Uses the same account transaction as backup restore. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), esc=JTDData.escapeHTML;
 const statusNames={playing:'En cours',backlog:'Backlog',done:'Terminé'};
 const completionNames={finished:'Terminé',hundred:'100 %',achievements:'Tous les succès'};
 const feelings={gem:'Pépite',love:'Adoré',like:'Aimé',mixed:'Mitigé',dislike:'Pas aimé'};
 const bookshelf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4v16M8 8v12M12 6v14m4-14 4 14"/></svg>';
 const puzzle='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h6V2a2 2 0 0 1 4 0v2h6v6h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4Z"/></svg>';
 const icon=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
 const icons={
  physical:icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="m7 6-2 3m14 6-2 3"/>'),
  digital:icon('<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>'),
  emulation:'<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 1h2v2H3zm8 0h2v2h-2zM5 3h6v2h2v2h2v6h-2V9h-2v4H5V9H3v4H1V7h2V5h2zm0 4v2h2V7zm4 0v2h2V7zM5 13h2v2H3v-2zm4 0h2v2h2v-2z" fill-rule="evenodd"/></svg>',
  finished:JOURNAL_COMPLETION_ICONS.finished,
  hundred:JOURNAL_COMPLETION_ICONS.hundred,
  achievements:JOURNAL_COMPLETION_ICONS.achievements,
  gem:icon('<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"/>'),
  love:icon('<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 3 10 8 15 5-5 12-10 8-15Z"/>'),
  like:icon('<path d="M3 10h4v11H3zm4 9 4 2h7l3-11h-7l1-5c0-3-3-3-3-3L7 10"/>'),
  mixed:icon('<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 15h8"/>'),
  dislike:icon('<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01m-8 8c1-4 7-4 8 0"/>'),
  review:icon('<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 0 1-1-5 8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 9h10M7 13h7"/>'),
  backlog:icon('<path d="M4 4h16v16H4zm0 5h16m-12 5h8"/>'),
  date:icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>')
 };
 function completionMark(r){return '<span class="journal-completion completion-'+esc(r.completion)+'">'+icons[r.completion]+esc(completionNames[r.completion])+'</span>';}
 function feelingMark(r){return r.feeling?'<span class="journal-feeling feeling-'+esc(r.feeling)+'">'+icons[r.feeling]+esc(feelings[r.feeling])+'</span>':'';}
 const fields=['nom','plateforme','kind','parentName','status','completion','medium','access','finishedAt','feeling','review','image','imageFit'];
 let year=String(new Date().getFullYear()), monthLimit=3, draft=null, generation=0, detailId=null, detailGeneration=0, returnDetailId=null;
 const currentGeneration=()=>window.JTDAccountGeneration||0;
 const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr').trim();
 function collectionLabel(r){if(!r.collectionId)return '';if(GAMES.some(g=>g.id===r.collectionId))return 'Collection';const old=CEMETERY.find(g=>g.id===r.collectionId);return old?(old.saleStatus==='sold'?'Vendu':'À vendre'):'';}
 function linkedGame(r){return r.collectionId&&(GAMES.find(g=>g.id===r.collectionId)||CEMETERY.find(g=>g.id===r.collectionId));}
 function displayRecord(r){const g=linkedGame(r);return g&&r.importSource?{...r,image:r.image||g.image||'',imageFit:r.image?r.imageFit:g.imageFit||'contain'}:g?{...r,nom:g.nom,plateforme:g.plateforme,image:g.image||'',imageFit:g.imageFit||'contain',kind:'game',parentName:''}:r;}
 function metadata(r,platform=true){r=displayRecord(r);const label=collectionLabel(r),collection=label==='Collection',format=collection&&r.medium==='physical'?'collection':r.access==='emulation'?'emulation':r.medium;return (platform?'<span class="journal-platform">'+esc(r.plateforme)+'</span>':'')+(r.kind==='extension'?'<span>'+puzzle+'Extension</span>':'')+'<span class="journal-format format-'+format+'">'+(format==='collection'?bookshelf:icons[format])+esc(format==='collection'?'Collection':format==='emulation'?'Émulation':format==='physical'?'Physique':'Numérique')+'</span>'+(!collection&&['family','subscription'].includes(r.access)?'<span>'+esc(r.access==='family'?'Partage familial':'Abonnement')+'</span>':'')+(label&&format!=='collection'?'<span>'+esc(label)+'</span>':'');}
 function selectTab(tab){document.querySelector('.journal-layout').dataset.tab=tab;document.querySelectorAll('[data-journal-tab]').forEach(x=>{const active=x.dataset.journalTab===tab;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});}
 function sourceGames(){return [...GAMES,...CEMETERY];}
 function sourceLabel(g){const location=GAMES.some(item=>item.id===g.id)?'Collection':g.saleStatus==='sold'?'Vendu':'À vendre';return g.nom+' · '+g.plateforme+' · '+location+(g.collector?' · Collector':'')+(g.japanese?' · Japonais':'')+(g.date?' · '+g.date:'')+(g.source?' · '+g.source:'')+' · réf. '+g.id;}
 function filterSources(){
  const query=JTDData.foldImport($('j-source-search').value),selected=$('j-source').value||draft?.collectionId||'';
  const matches=sourceGames().filter(g=>JTDData.foldImport(g.nom+' '+g.plateforme+' '+JTDData.importPlatform(g.plateforme)).includes(query));
  $('j-source').replaceChildren(new Option('Sans lien avec un exemplaire',''));
  for(const g of matches)$('j-source').add(new Option(sourceLabel(g),g.id));
  if(selected&&!matches.some(g=>g.id===selected)){const g=sourceGames().find(g=>g.id===selected);if(g)$('j-source').add(new Option(sourceLabel(g),g.id));}
  $('j-source').value=selected;$('j-source-empty').classList.toggle('hidden',!!matches.length||!query);
 }
 function row(r,compact=false){
  r=displayRecord(r);
  const day=r.finishedAt?.slice(8), month=r.finishedAt?.length>=7?MONTH_NAMES_FULL[Number(r.finishedAt.slice(5,7))-1]:'';
  return '<button class="journal-entry'+(compact?' compact':'')+'" data-journal-id="'+esc(r.id)+'">'+(!compact?'<span class="journal-date">'+(day?'<strong>'+esc(day)+'</strong><small>'+esc(month.slice(0,3))+'</small>':r.finishedAt?'<small>'+esc(month?month.slice(0,3):r.finishedAt)+'</small>':'<span>—</span>')+'</span>':'')+boardThumb(r)+'<span class="journal-entry-body"><strong>'+esc(JTDJournalData.title(r))+'</strong><span class="journal-meta">'+metadata(r)+'</span>'+(!compact?'<span class="journal-result">'+completionMark(r)+feelingMark(r)+(r.review?'<span class="journal-review-mark">'+icons.review+'Avis rédigé</span>':'')+'</span>':'')+'</span></button>';
 }
 function renderJournal(){
  const selected=year;
  const years=[...new Set([String(new Date().getFullYear()),...JOURNAL.filter(r=>r.finishedAt&&r.status==='done').map(r=>r.finishedAt.slice(0,4))])].sort().reverse();
  if(!years.includes(selected)) years.push(selected);
  $('journal-year').innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');$('journal-year').value=selected;
  const past=JOURNAL.filter(r=>r.status==='done'&&(!r.finishedAt||r.finishedAt.startsWith(year))).sort((a,b)=>(b.finishedAt||'').localeCompare(a.finishedAt||'')||a.nom.localeCompare(b.nom,'fr'));
  const groups=new Map();for(const r of past){const key=r.finishedAt?r.finishedAt.slice(0,7):'none';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const dated=[...groups.keys()].filter(k=>k!=='none');const shown=dated.slice(0,monthLimit);
  $('journal-feed').innerHTML=shown.map(k=>'<section class="journal-month"><h2>'+esc(k.length===4?'Mois non précisé':MONTH_NAMES_FULL[Number(k.slice(5))-1])+'</h2>'+groups.get(k).map(r=>row(r)).join('')+'</section>').join('')+(dated.length>monthLimit?'<button class="btn btn-ghost" id="journal-more">Voir les mois précédents</button>':'')+(groups.has('none')?'<section class="journal-month"><h2>Sans date</h2>'+groups.get('none').map(r=>row(r)).join('')+'</section>':'')+(!past.length?'<p class="journal-empty">Aucun jeu terminé cette année.</p>':'');
  for(const status of ['playing','backlog']){const list=JOURNAL.filter(r=>r.status===status);$('journal-'+status).innerHTML=list.length?list.map(r=>row(r,true)).join(''):'<p class="journal-empty">'+(status==='playing'?'Aucun jeu en cours.':'Backlog vide.')+'</p>';}
  $('journal-more')?.addEventListener('click',()=>{monthLimit+=3;renderJournal();});
 }
 function read(){return displayRecord({...draft,...Object.fromEntries(fields.map(f=>[f,$('j-'+f).value]))});}
 function reflect(){
  const digitalAccess=$('j-access').value!=='owned';
  if(digitalAccess)$('j-medium').value='digital';
  $('j-medium').disabled=digitalAccess;
  const r=read(), done=r.status==='done',linked=!!linkedGame(r);
  ['j-kind-field','j-name-field','j-platform-field','j-art-details','j-access-fields'].forEach(id=>$(id).classList.toggle('hidden',linked&&!r.importSource));
  $('j-parent-field').classList.toggle('hidden',r.kind!=='extension');
  $('j-kind').disabled=!!r.collectionId;
  $('j-source-picker').classList.toggle('hidden',r.kind==='extension');
  $('j-source').disabled=r.kind==='extension';
  $('j-source-search').disabled=r.kind==='extension';
  $('j-finished-fields').classList.toggle('hidden',!done);
  $('j-completion-field').classList.toggle('hidden',!done);
  $('j-identity-card').innerHTML=r.nom?identitySummaryHtml({...r,nom:JTDJournalData.title(r)}):'';
  $('j-identity-card').querySelector('.identity-copy')?.insertAdjacentHTML('beforeend','<div class="journal-meta">'+metadata(r,false)+'</div>');
  const edit=$('j-identity-card').querySelector('.identity-edit-btn');
  if(edit){if(linked){edit.title='Changer l’exemplaire';edit.setAttribute('aria-label','Changer l’exemplaire');}edit.addEventListener('click',()=>{setGameEditor(true);if(linked)$('j-source-picker').open=true;$(linked?'j-source-search':'j-nom').focus();});}
  $('j-link-info').textContent=r.collectionId?(GAMES.some(g=>g.id===r.collectionId)?'Lié à un exemplaire de la collection.':(CEMETERY.some(g=>g.id===r.collectionId)?'Lié à un exemplaire du cimetière ; historique conservé.':'Exemplaire absent de la collection ; historique conservé.')) : '';
  $('j-unlink').classList.toggle('hidden',!r.collectionId);
 }
 function setGameEditor(expanded){
  $('j-details').classList.toggle('hidden',!expanded);
  $('j-identity-card').classList.toggle('hidden',expanded&&!linkedGame(read()));
 }
 function open(record=null,collectionId=null){
  generation=currentGeneration();
  const g=collectionId?GAMES.find(g=>g.id===collectionId):null;
  draft=record?{...displayRecord(record)}:{id:crypto.randomUUID(),nom:g?.nom||'',plateforme:g?.plateforme||'',kind:'game',parentName:'',collectionId:g?.id||null,status:'playing',completion:'finished',medium:g?'physical':'digital',access:'owned',finishedAt:'',feeling:'',review:'',image:g?.image||'',imageFit:g?.imageFit||'contain'};
  fields.forEach(f=>$('j-'+f).value=draft[f]||'');
  $('journal-modal-title').textContent=record?'Modifier le parcours':'Ajouter au journal';
  $('j-source-field').classList.remove('hidden');
  $('j-source-search').value='';$('j-source').innerHTML='';filterSources();
  $('j-platforms').innerHTML=allPlatformNames().map(p=>'<option value="'+esc(p)+'"></option>').join('');
  setGameEditor(!draft.nom);
  $('j-art-details').open=false;$('j-source-picker').open=false;
  $('j-error').textContent='';
  $('j-delete').classList.toggle('hidden',!record);$('j-replay').classList.toggle('hidden',!record||record.status!=='done');
  JTDDialogs.clearErrors($('journal-modal-overlay'));reflect();
  JTDDialogs.open('journal-modal-overlay',{initialFocus:draft.nom?'#j-status':'#j-nom',onDismiss:close});
 }
 function close(reopen=true){const id=returnDetailId;returnDetailId=null;JTDDialogs.close('journal-modal-overlay');draft=null;if(reopen&&id&&generation===currentGeneration()){const r=JOURNAL.find(r=>r.id===id);if(r)showRecord(r);}}
 function commit(next){
  if(generation!==currentGeneration())throw Error('Le compte a changé. Rouvre le journal.');
  const data=JTDData.normalizeData({...buildBackupPayload().data,journal:next});
  window.persistAppData(data); // storage failure must leave memory and editor untouched
  replaceAppData(data);window.JTDDataChanged?.();
  render();buildStatusToggles();renderJournal();
  if(!$('modal-overlay').classList.contains('hidden'))renderCollectionSummary(editingId);
 }
 function save(){
  let r=read();
  for(const [field,message] of [['nom','Indique un titre.'],['plateforme','Indique une plateforme.'],...(r.kind==='extension'?[['parentName','Indique le jeu de base.']]:[])]){
   if(!r[field].trim()){setGameEditor(true);JTDDialogs.error('j-'+field,message);return;}
  }
  if(r.image&&!JTDData.safeURL(r.image,true)){setGameEditor(true);$('j-art-details').open=true;JTDDialogs.error('j-image','Indique une URL d’image valide.');return;}
  try{r=JTDJournalData.normalizeJournal([r])[0];const next=JOURNAL.some(x=>x.id===r.id)?JOURNAL.map(x=>x.id===r.id?r:x):[...JOURNAL,r];commit(next);close(false);if(r.status==='done'){year=r.finishedAt?r.finishedAt.slice(0,4):String(new Date().getFullYear());monthLimit=3;selectTab('feed');renderJournal();showRecord(r);}showToast('Journal enregistré.');}
  catch(e){$('j-error').textContent=e.message;}
 }
 function dateLabel(r){return JTDJournalData.dateLabel(r.finishedAt);}
 function bilan(r){return r.status==='done'?completionMark(r)+(r.finishedAt?'<span>'+icons.date+esc(dateLabel(r))+'</span>':'')+feelingMark(r):'<span>'+(r.status==='playing'?ICON_STATUS_PLAYING:icons.backlog)+esc(statusNames[r.status])+'</span>';}
 function closeDetail(){JTDDialogs.close('journal-detail-overlay');detailId=null;}
 function showRecord(r){
  r=displayRecord(r);
  if(r.status!=='done'){open(r);return;}
  detailId=r.id;detailGeneration=currentGeneration();
  $('journal-detail-identity').innerHTML=identitySummaryHtml({...r,nom:JTDJournalData.title(r)});
  $('journal-detail-identity').querySelector('.identity-edit-btn')?.remove();
  $('journal-detail-meta').innerHTML=metadata(r,false);
  $('journal-detail-bilan').innerHTML=completionMark(r)+(r.finishedAt?'<span>'+icons.date+esc(dateLabel(r))+'</span>':'')+feelingMark(r);
  $('journal-detail-review').textContent=r.review||'Aucun avis rédigé.';
  $('journal-detail-review').classList.toggle('journal-empty',!r.review);
  JTDDialogs.open('journal-detail-overlay',{initialFocus:'#journal-detail-close',onDismiss:closeDetail});
  $('journal-detail-overlay').querySelector('.modal').scrollTop=0;
 }
 function renderCollectionSummary(id){
  const entries=id?JOURNAL.filter(r=>r.collectionId===id).sort((a,b)=>(a.status==='done')-(b.status==='done')||(b.finishedAt||'').localeCompare(a.finishedAt||'')):[];
  $('f-journal-btn').classList.toggle('hidden',!id||!!entries.length);
  $('f-journal-entries').innerHTML=entries.map(r=>'<button type="button" class="collection-journal-entry" data-journal-id="'+esc(r.id)+'"><span>'+bilan(r)+'</span><span class="collection-journal-entry-action">'+(r.status==='done'?'Voir le bilan':'Modifier le parcours')+'</span></button>').join('');
 }
 function openForGame(id){const p=JTDJournalData.collectionProgress(JOURNAL,id);if(p)showRecord(p.record);else open(null,id);}
 window.renderJournal=renderJournal;
 window.JTDJournal={openForGame,renderCollectionSummary,close(){close(false);closeDetail();}};
 $('journal-add').addEventListener('click',()=>open());
 $('journal-year').addEventListener('change',e=>{year=e.target.value;monthLimit=3;renderJournal();});
 $('page-journal').addEventListener('click',e=>{const entry=e.target.closest('[data-journal-id]');if(entry){const r=JOURNAL.find(r=>r.id===entry.dataset.journalId);if(r)showRecord(r);}});
 $('f-journal-entries').addEventListener('click',e=>{const entry=e.target.closest('[data-journal-id]');const r=entry&&JOURNAL.find(r=>r.id===entry.dataset.journalId);if(r)showRecord(r);});
 $('journal-detail-close').addEventListener('click',closeDetail);
 $('journal-detail-overlay').addEventListener('click',e=>{if(e.target===$('journal-detail-overlay'))closeDetail();});
 $('journal-detail-edit').addEventListener('click',()=>{const r=detailGeneration===currentGeneration()&&JOURNAL.find(r=>r.id===detailId);closeDetail();if(r){open(r);returnDetailId=r.id;}});
 $('journal-detail-replay').addEventListener('click',()=>{const r=detailGeneration===currentGeneration()&&JOURNAL.find(r=>r.id===detailId);if(r){closeDetail();startReplay(r);}});
 document.querySelectorAll('[data-journal-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.journalTab));
 $('j-source-search').addEventListener('input',filterSources);
 $('j-source').addEventListener('change',e=>{const g=sourceGames().find(g=>g.id===e.target.value);if(g){draft.collectionId=g.id;for(const f of ['nom','plateforme','image','imageFit'])$('j-'+f).value=g[f]|| (f==='imageFit'?'contain':'');$('j-kind').value='game';$('j-medium').value='physical';$('j-access').value='owned';}else draft.collectionId=null;reflect();if(g)setGameEditor(false);});
 $('j-unlink').addEventListener('click',()=>{draft.collectionId=null;$('j-source').value='';reflect();});
 fields.forEach(f=>$('j-'+f).addEventListener('input',reflect));
 $('j-save').addEventListener('click',save);$('j-cancel').addEventListener('click',close);
 $('j-delete').addEventListener('click',()=>{
  const id=draft.id, session=generation;
  confirmAction('Supprimer ce parcours du journal ?',()=>{
  if(!draft||draft.id!==id||generation!==session||session!==currentGeneration())return;
  try{commit(JOURNAL.filter(r=>r.id!==id));close(false);showToast('Parcours supprimé.');}catch(e){$('j-error').textContent=e.message;}
  });
 });
 function startReplay(previous){
  close(false);open({...previous,importSource:undefined,id:crypto.randomUUID(),status:'playing',completion:'finished',finishedAt:'',feeling:'',review:''});returnDetailId=previous.id;
  $('journal-modal-title').textContent='Rejouer';$('j-delete').classList.add('hidden');
 }
 $('j-replay').addEventListener('click',()=>{const previous=JOURNAL.find(r=>r.id===draft.id);if(previous)startReplay(previous);});
 $('f-journal-btn').addEventListener('click',()=>openForGame(editingId));
 for(const status of ['playing','backlog']){document.querySelector('[data-journal-panel="'+status+'"] h2').innerHTML=(status==='playing'?ICON_STATUS_PLAYING:icons.backlog)+statusNames[status];}
 document.querySelectorAll('[data-journal-tab]').forEach(b=>b.innerHTML=(b.dataset.journalTab==='playing'?ICON_STATUS_PLAYING:b.dataset.journalTab==='backlog'?icons.backlog:icon('<path d="M4 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4Zm16 0h-4"/>'))+b.textContent);
 renderJournal();
})();



