/* Private player journal. Uses the same account transaction as backup restore. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), esc=JTDData.escapeHTML;
 const statusNames={playing:'En cours',backlog:'Backlog',done:'Terminé'};
 const completionNames={finished:'Terminé',hundred:'100 %',achievements:'Tous les succès'};
 const feelings={gem:'Pépite',love:'Adoré',like:'Aimé',mixed:'Mitigé',dislike:'Pas aimé'};
 const bookshelf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4v16M8 8v12M12 6v14m4-14 4 14"/></svg>';
 const puzzle='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h6V2a2 2 0 0 1 4 0v2h6v6h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4Z"/></svg>';
 const fields=['nom','plateforme','kind','parentName','status','completion','medium','access','finishedAt','feeling','review','image','imageFit'];
 let year=String(new Date().getFullYear()), monthLimit=3, draft=null, generation=0, detailId=null, detailGeneration=0, returnDetailId=null;
 const currentGeneration=()=>window.JTDAccountGeneration||0;
 const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr').trim();
 function collectionLabel(r){if(!r.collectionId)return '';if(GAMES.some(g=>g.id===r.collectionId))return 'Collection';const old=CEMETERY.find(g=>g.id===r.collectionId);return old?(old.saleStatus==='sold'?'Vendu':'À vendre'):'';}
 function linkedGame(r){return r.collectionId&&(GAMES.find(g=>g.id===r.collectionId)||CEMETERY.find(g=>g.id===r.collectionId));}
 function displayRecord(r){const g=linkedGame(r);return g?{...r,nom:g.nom,plateforme:g.plateforme,image:g.image||'',imageFit:g.imageFit||'contain',kind:'game',parentName:'',medium:'physical',access:'owned'}:r;}
 function metadata(r,platform=true){r=displayRecord(r);const label=collectionLabel(r),collection=label==='Collection';return (platform?'<span>'+esc(r.plateforme)+'</span>':'')+(r.kind==='extension'?'<span>'+puzzle+'Extension</span>':'')+'<span>'+(collection?bookshelf+'Collection':esc(r.access==='emulation'?'Émulation':r.medium==='physical'?'Physique':'Numérique'))+'</span>'+(!collection&&['family','subscription'].includes(r.access)?'<span>'+esc(r.access==='family'?'Partage familial':'Abonnement')+'</span>':'')+(label&&!collection?'<span>'+esc(label)+'</span>':'');}
 function selectTab(tab){document.querySelector('.journal-layout').dataset.tab=tab;document.querySelectorAll('[data-journal-tab]').forEach(x=>{const active=x.dataset.journalTab===tab;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});}
 function filterSources(){const query=fold($('j-source-search').value);const selected=$('j-source').value||draft?.collectionId||'';const matches=GAMES.filter(g=>fold(g.nom+' '+g.plateforme).includes(query));$('j-source').innerHTML='<option value="">Nouvelle entrée</option>'+matches.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.nom+' · '+g.plateforme)+'</option>').join('');if(selected&&!matches.some(g=>g.id===selected)){const g=GAMES.find(g=>g.id===selected);if(g)$('j-source').add(new Option(g.nom+' · '+g.plateforme,g.id));}$('j-source').value=selected;$('j-source-empty').classList.toggle('hidden',!!matches.length||!query);}
 function row(r,compact=false){
  r=displayRecord(r);
  const day=r.finishedAt?.slice(8), month=r.finishedAt?MONTH_NAMES_FULL[Number(r.finishedAt.slice(5,7))-1]:'';
  return '<button class="journal-entry'+(compact?' compact':'')+'" data-journal-id="'+esc(r.id)+'">'+(!compact?'<span class="journal-date">'+(day?'<strong>'+esc(day)+'</strong><small>'+esc(month.slice(0,3))+'</small>':'<span>—</span>')+'</span>':'')+boardThumb(r)+'<span class="journal-entry-body"><strong>'+esc(JTDJournalData.title(r))+'</strong><span class="journal-meta">'+metadata(r)+'</span>'+(!compact?'<span class="journal-result"><span>'+(r.status==='playing'?ICON_STATUS_PLAYING:'')+esc(r.status==='done'?completionNames[r.completion]:statusNames[r.status])+'</span>'+(r.status==='done'&&r.feeling?'<span>'+esc(feelings[r.feeling])+'</span>':'')+(r.status==='done'&&r.review?'<span class="journal-review-mark">Avis rédigé</span>':'')+'</span>':'')+'</span></button>';
 }
 function renderJournal(){
  const selected=year;
  const years=[...new Set([String(new Date().getFullYear()),...JOURNAL.filter(r=>r.finishedAt&&r.status==='done').map(r=>r.finishedAt.slice(0,4))])].sort().reverse();
  if(!years.includes(selected)) years.push(selected);
  $('journal-year').innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');$('journal-year').value=selected;
  const past=JOURNAL.filter(r=>r.status==='done'&&(!r.finishedAt||r.finishedAt.startsWith(year))).sort((a,b)=>(b.finishedAt||'').localeCompare(a.finishedAt||'')||a.nom.localeCompare(b.nom,'fr'));
  const groups=new Map();for(const r of past){const key=r.finishedAt?r.finishedAt.slice(0,7):'none';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const dated=[...groups.keys()].filter(k=>k!=='none');const shown=dated.slice(0,monthLimit);
  $('journal-feed').innerHTML=shown.map(k=>'<section class="journal-month"><h2>'+esc(MONTH_NAMES_FULL[Number(k.slice(5))-1])+'</h2>'+groups.get(k).map(r=>row(r)).join('')+'</section>').join('')+(dated.length>monthLimit?'<button class="btn btn-ghost" id="journal-more">Voir les mois précédents</button>':'')+(groups.has('none')?'<section class="journal-month"><h2>Sans date</h2>'+groups.get('none').map(r=>row(r)).join('')+'</section>':'')+(!past.length?'<p class="journal-empty">Aucun jeu terminé cette année.</p>':'');
  for(const status of ['playing','backlog']){const list=JOURNAL.filter(r=>r.status===status);$('journal-'+status).innerHTML=list.length?list.map(r=>row(r,true)).join(''):'<p class="journal-empty">'+(status==='playing'?'Aucun jeu en cours.':'Backlog vide.')+'</p>';}
  $('journal-more')?.addEventListener('click',()=>{monthLimit+=3;renderJournal();});
 }
 function read(){return displayRecord({...draft,...Object.fromEntries(fields.map(f=>[f,$('j-'+f).value]))});}
 function reflect(){
  const r=read(), done=r.status==='done',linked=!!linkedGame(r);
  ['j-kind-field','j-name-field','j-platform-field','j-art-details','j-access-fields'].forEach(id=>$(id).classList.toggle('hidden',linked));
  $('j-parent-field').classList.toggle('hidden',r.kind!=='extension');
  $('j-kind').disabled=!!r.collectionId;
  $('j-source').disabled=r.kind==='extension';
  $('j-source-search').disabled=r.kind==='extension';
  $('j-finished-fields').classList.toggle('hidden',!done);
  $('j-completion-field').classList.toggle('hidden',!done);
  $('j-identity-card').innerHTML=r.nom?identitySummaryHtml({...r,nom:JTDJournalData.title(r)}):'';
  const edit=$('j-identity-card').querySelector('.identity-edit-btn');
  if(edit){if(linked){edit.title='Changer l’exemplaire';edit.setAttribute('aria-label','Changer l’exemplaire');}edit.addEventListener('click',()=>{setGameEditor(true);$(linked?'j-source-search':'j-nom').focus();});}
  $('j-link-info').textContent=r.collectionId?(GAMES.some(g=>g.id===r.collectionId)?'Lié à un exemplaire de la collection.':'Exemplaire absent de la collection ; historique conservé.') : '';
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
  $('j-art-details').open=false;
  $('j-error').textContent='';
  $('j-delete').classList.toggle('hidden',!record);$('j-replay').classList.toggle('hidden',!record||record.status!=='done');
  JTDDialogs.clearErrors($('journal-modal-overlay'));reflect();
  JTDDialogs.open('journal-modal-overlay',{initialFocus:draft.nom?'#j-status':'#j-nom',onDismiss:close});
 }
 function close(reopen=true){const id=returnDetailId;returnDetailId=null;JTDDialogs.close('journal-modal-overlay');draft=null;if(reopen&&id&&generation===currentGeneration()){const r=JOURNAL.find(r=>r.id===id);if(r)showRecord(r);}}
 function commit(next){
  if(generation!==currentGeneration())throw Error('Le compte a changé. Rouvre le journal.');
  const data=JTDData.normalizeData({...buildBackupPayload().data,journal:next});
  if(new TextEncoder().encode(JSON.stringify(data)).length>900000)throw Error('La sauvegarde approche de sa limite. Télécharge une sauvegarde avant de réduire les images ou les avis.');
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
 function dateLabel(r){return r.finishedAt?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(r.finishedAt+'T12:00:00Z')):'';}
 function bilan(r){return [r.status==='done'?completionNames[r.completion]:statusNames[r.status],r.status==='done'?dateLabel(r):'',r.status==='done'?feelings[r.feeling]:''].filter(Boolean);}
 function closeDetail(){JTDDialogs.close('journal-detail-overlay');detailId=null;}
 function showRecord(r){
  r=displayRecord(r);
  if(r.status!=='done'){open(r);return;}
  detailId=r.id;detailGeneration=currentGeneration();
  $('journal-detail-identity').innerHTML=identitySummaryHtml({...r,nom:JTDJournalData.title(r)});
  $('journal-detail-identity').querySelector('.identity-edit-btn')?.remove();
  $('journal-detail-meta').innerHTML=metadata(r,false);
  $('journal-detail-bilan').innerHTML=bilan(r).map(value=>'<span>'+esc(value)+'</span>').join('');
  $('journal-detail-review').textContent=r.review||'Aucun avis rédigé.';
  $('journal-detail-review').classList.toggle('journal-empty',!r.review);
  JTDDialogs.open('journal-detail-overlay',{initialFocus:'#journal-detail-close',onDismiss:closeDetail});
  $('journal-detail-overlay').querySelector('.modal').scrollTop=0;
 }
 function renderCollectionSummary(id){
  const entries=id?JOURNAL.filter(r=>r.collectionId===id).sort((a,b)=>(a.status==='done')-(b.status==='done')||(b.finishedAt||'').localeCompare(a.finishedAt||'')):[];
  $('f-journal-btn').classList.toggle('hidden',!id||!!entries.length);
  $('f-journal-entries').innerHTML=entries.map(r=>'<button type="button" class="collection-journal-entry" data-journal-id="'+esc(r.id)+'"><span>'+bilan(r).map(value=>'<span>'+esc(value)+'</span>').join('')+'</span><span class="collection-journal-entry-action">'+(r.status==='done'?'Voir le bilan':'Modifier le parcours')+'</span></button>').join('');
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
 $('j-source').addEventListener('change',e=>{const g=GAMES.find(g=>g.id===e.target.value);if(g){draft.collectionId=g.id;for(const f of ['nom','plateforme','image','imageFit'])$('j-'+f).value=g[f]|| (f==='imageFit'?'contain':'');$('j-kind').value='game';$('j-medium').value='physical';$('j-access').value='owned';}else draft.collectionId=null;reflect();if(g)setGameEditor(false);});
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
  close(false);open({...previous,id:crypto.randomUUID(),status:'playing',completion:'finished',finishedAt:'',feeling:'',review:''});returnDetailId=previous.id;
  $('journal-modal-title').textContent='Rejouer';$('j-delete').classList.add('hidden');
 }
 $('j-replay').addEventListener('click',()=>{const previous=JOURNAL.find(r=>r.id===draft.id);if(previous)startReplay(previous);});
 $('f-journal-btn').addEventListener('click',()=>openForGame(editingId));
 renderJournal();
})();
