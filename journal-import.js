/* Additive file import. Only fictional fixtures are used in previews and tests. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),P=JTDJournalImportData;
 let rows=[],fileText='',fileName='',generation=0,request=0,previewState='';
 const elements=new Map(),current=()=>window.JTDAccountGeneration||0;
 const data=()=>buildBackupPayload().data;
 function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
 function field(label,node){const wrap=element('label',label,'journal-import-field');wrap.append(node);return wrap;}
 function select(options,value,onChange){const node=element('select');for(const [key,label] of options)node.add(new Option(label,key));node.value=value;node.addEventListener('change',()=>onChange(node.value));return node;}
 function textField(label,value,change,limit=500){const input=element('input');input.type='text';input.value=value;input.maxLength=limit;input.addEventListener('input',()=>change(input.value));return field(label,input);}
 function buildRows(){
  const parsed=P.parseFile(fileText,fileName,$('journal-import-year').value);
  rows=P.classify(parsed.entries,{games:GAMES,cemetery:CEMETERY,journal:JOURNAL});previewState=JSON.stringify(data());elements.clear();
  const list=$('journal-import-list'),help=$('journal-import-help');list.replaceChildren(help);$('journal-import-warning').textContent=parsed.warnings.join(' ');
  const review=element('section','', 'cemetery-import-review');review.append(element('h3','À vérifier'));
  const other=element('details','','cemetery-import-other');other.open=!rows.some(r=>r.kind==='review');other.append(element('summary','Autres parcours · '+rows.filter(r=>r.kind!=='review').length));
  if(rows.some(r=>r.kind==='review'))list.append(review);if(rows.some(r=>r.kind!=='review'))list.append(other);
  for(const item of rows){
   const r=item.record,line=element('div','','cemetery-import-row'),identity=element('div','','cemetery-import-identity'),action=element('div','','cemetery-import-action');line.dataset.title=r.nom;
   const badge=element('span','','cemetery-import-review-badge');identity.append(badge,element('strong',r.nom),element('span',r.plateforme+' · '+(r.finishedAt||item.rawDate||'Sans date')+' · '+item.source+' ligne '+item.line));
   if(item.kind==='duplicate')identity.append(element('span','Déjà importé ou parcours identique · ignoré par défaut.'));
   else if(item.possible.length)identity.append(element('span','Parcours similaire déjà présent : vérifie s’il s’agit du même parcours ou d’un replay.'));
   if(item.dateWarning)identity.append(element('span',item.dateWarning));
   const choices=[['','Choisir une action…'],['add',item.possible.length||item.kind==='duplicate'?'Ajouter un parcours distinct (replay)':'Ajouter sans lien'],...(r.kind==='game'?[['link','Lier à un exemplaire']]:[]),['skip','Ignorer']];
   const decision=select(choices,item.choice,value=>{item.choice=value;if(value==='link')picker.open=true;if(value!=='skip'&&(item.dateWarning||item.unknownAccess||r.kind==='extension'))details.open=true;validate();});decision.setAttribute('aria-label','Action pour '+r.nom);action.append(field('Que faire de ce parcours ?',decision));
   const guidance=element('p','','journal-import-guidance');action.append(guidance);
   const picker=element('details','','cemetery-import-picker');picker.append(element('summary','Rechercher un exemplaire'));
   if(r.kind==='game'){
    const search=element('input');search.type='search';search.placeholder='Titre ou plateforme';search.setAttribute('aria-label','Rechercher pour '+r.nom);
    const source=select([['','Sans lien']],item.collectionId,value=>{item.collectionId=value;validate();});source.setAttribute('aria-label','Exemplaire pour '+r.nom);
    const chosen=element('span','','cemetery-import-status');
    const refresh=()=>{
     source.replaceChildren(new Option('Sans lien',''));
     const query=JTDData.foldImport(search.value);
     const matches=item.candidates.filter(g=>query?JTDData.foldImport(g.nom+' '+g.plateforme+' '+JTDData.importPlatform(g.plateforme)).includes(query):picker.open||g.score>0);
     for(const g of matches)source.add(new Option(g.nom+' · '+g.plateforme+' · '+({collection:'Collection',sold:'Vendu',pending:'À vendre'}[g.location])+(g.collector?' · Collector':'')+' · réf. '+g.id,g.id));
     if(item.collectionId&&!matches.some(g=>g.id===item.collectionId)){const g=item.candidates.find(g=>g.id===item.collectionId);if(g)source.add(new Option(g.nom+' · '+g.plateforme,g.id));}
     source.value=item.collectionId;const g=item.candidates.find(g=>g.id===item.collectionId);chosen.textContent=g?g.nom+' · '+g.plateforme+' · '+({collection:'Collection',sold:'Vendu',pending:'À vendre'}[g.location]):'';
    };
    search.addEventListener('input',refresh);source.addEventListener('change',refresh);picker.addEventListener('toggle',refresh);refresh();picker.append(search,source);action.append(picker,chosen);
   }
   const details=element('details','','journal-import-edit');details.append(element('summary','Voir ou corriger les informations et l’avis'));
   details.append(textField('Titre',r.nom,value=>{r.nom=value;validate();}),textField('Plateforme jouée',r.plateforme,value=>{r.plateforme=value;validate();},150));
   if(r.kind==='extension')details.append(textField('Jeu de base de l’extension',r.parentName,value=>{r.parentName=value;validate();}));
   details.append(textField('Date de fin · AAAA-MM-JJ, AAAA-MM ou AAAA',r.finishedAt,value=>{r.finishedAt=value;item.dateWarning='';validate();},10));
   details.append(field('Support joué',select([['','À préciser'],['physical','Physique'],['digital','Numérique']],r.medium,value=>{r.medium=value;validate();})));
   details.append(field('Accès',select([['','À préciser'],['owned','Possédé'],['subscription','Abonnement'],['family','Partage familial'],['emulation','Émulation']],r.access,value=>{r.access=value;validate();})));
   details.append(field('Complétion',select([['finished','Jeu terminé'],['hundred','100 %'],['achievements','Tous les succès']],r.completion,value=>{r.completion=value;validate();})));
   const reviewInput=element('textarea');reviewInput.rows=4;reviewInput.value=r.review;reviewInput.maxLength=20000;reviewInput.addEventListener('input',()=>{r.review=reviewInput.value;validate();});details.append(field('Avis et notes importés',reviewInput));
   const rowError=element('p','','journal-import-row-error');rowError.setAttribute('aria-live','polite');
   action.append(details,rowError);line.append(identity,action);(item.kind==='review'?review:other).append(line);elements.set(item,{line,badge,decision,picker,details,guidance,rowError});
  }
  list.scrollTop=0;validate();
 }
 function recordFor(item){return {...item.record,collectionId:item.choice==='link'?item.collectionId:null};}
 function validate(){
  let pending=0,added=0,ignored=0;
  for(const item of rows){
   let error='';
   if(item.choice==='skip')ignored++;
   else{
    if(item.choice)added++;if(!item.choice)error='Choisis : ajouter, lier à un exemplaire ou ignorer.';
    else if(item.dateWarning)error='Vérifie la date non reconnue.';
    else if(item.choice==='link'&&!item.collectionId)error='Choisis l’exemplaire à lier, ou ajoute le parcours sans lien.';
    else if(!item.record.medium||!item.record.access)error='Précise le support joué et le mode d’accès dans les informations du parcours.';
    else if(item.record.kind==='extension'&&!item.record.parentName.trim())error='Indique le jeu de base de cette extension dans les informations du parcours.';
    else if(item.record.access!=='owned'&&item.record.medium==='physical')error='Abonnement, partage familial et émulation nécessitent un support numérique.';
    else try{JTDJournalData.normalizeJournal([recordFor(item)]);}catch(e){error=e.message;}
   }
   const ui=elements.get(item);ui?.line.classList.toggle('needs-review',!!error);if(ui)ui.badge.textContent=error?'À revoir':item.choice==='skip'?'Ignoré':'Choix validé';
   if(ui){
    ui.rowError.textContent=error;ui.picker.hidden=item.choice!=='link';ui.details.hidden=item.choice==='skip';
    ui.guidance.textContent=item.choice==='skip'?'Ce parcours ne sera pas importé.':item.choice==='link'?'Ajoute le parcours au journal et le relie à l’exemplaire choisi. Aucun jeu physique ne sera créé.':item.choice==='add'?'Ajoute uniquement ce parcours au journal, sans lien avec la collection.':item.unknownAccess?'Le support et l’accès ne sont pas indiqués dans le Sheets.':item.record.kind==='extension'?'Le jeu de base de cette extension doit être précisé.':item.possible.length?'Un parcours similaire existe : ignore-le si c’est le même, ou ajoute-le si c’est un replay.':'Une correspondance est proposée : choisis de lier le parcours, de l’ajouter sans lien ou de l’ignorer.';
   }
   if(error)pending++;
  }
  $('journal-import-summary').textContent=rows.length+' parcours · '+added+' à importer · '+ignored+' ignoré(s)'+(pending?' · '+pending+' à revoir':'');
  $('journal-import-error').textContent=pending?'Il reste '+pending+' parcours à vérifier. Le bouton ci-dessous te mène au premier.':added?'Prêt à ajouter '+added+' parcours. Le journal existant sera conservé.':'Tous les parcours sont ignorés. Tu peux fermer sans rien modifier.';
  $('journal-import-apply').disabled=false;
  $('journal-import-apply').textContent=pending?'Revoir '+pending+' parcours':added?'Importer '+added+' parcours':'Fermer sans importer';
  const impacts=$('journal-import-impact');impacts?.remove();
  if(!pending&&added){
   const next=[...JOURNAL,...rows.filter(r=>r.choice!=='skip').map(recordFor)];
   const games=JTDJournalData.syncGames(GAMES,next),changes=games.filter(g=>g.status!==GAMES.find(old=>old.id===g.id)?.status);
   if(changes.length){const impact=element('details','','journal-import-impact');impact.id='journal-import-impact';impact.append(element('summary',changes.length+' statut(s) de collection seront mis à jour'));
    const names={termine:'Terminé',termine_ailleurs:'Terminé ailleurs',en_cours:'En cours',a_jouer:'À jouer'};
    for(const g of changes)impact.append(element('p',g.nom+' → '+(names[g.status]||g.status)));$('journal-import-summary').after(impact);
   }
  }
  return !pending;
 }
 function close(){request++;JTDDialogs.close('journal-import-overlay');rows=[];fileText='';elements.clear();}
 $('journal-import-input').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;const token=++request,account=current();
  try{const content=await file.text();if(token!==request||account!==current())return;
   fileText=content;fileName=file.name;generation=account;$('journal-import-year').value=String(new Date().getFullYear());$('journal-import-year').disabled=/\.json$/i.test(file.name);$('journal-import-year').parentElement.hidden=/\.json$/i.test(file.name);buildRows();
   JTDDialogs.open('journal-import-overlay',{onDismiss:close,initialFocus:'#journal-import-cancel',trigger:$('profile-menu-btn')});
  }catch(e){showToast(e.message||'Import impossible.');}
 });
 $('journal-import-year').addEventListener('change',()=>{try{buildRows();}catch(e){$('journal-import-error').textContent=e.message;$('journal-import-apply').disabled=true;}});
 $('journal-import-cancel').addEventListener('click',close);
 $('journal-import-apply').addEventListener('click',()=>{
  if(generation!==current()){$('journal-import-error').textContent='Le compte a changé. Relance l’import.';return;}
  if(JSON.stringify(data())!==previewState){buildRows();$('journal-import-error').textContent='Les données ont changé. Vérifie à nouveau les choix.';return;}
  if(!validate()){
   const first=rows.find(item=>elements.get(item).line.classList.contains('needs-review')),ui=elements.get(first);
   let target=ui.decision;
   if(first.choice==='link'&&!first.collectionId){ui.picker.open=true;target=ui.picker.querySelector('select');}
   else if(first.choice){ui.details.open=true;target=ui.details.querySelector('input,select,textarea');}
   ui.line.scrollIntoView({block:'start'});target.focus({preventScroll:true});return;
  }
  if(rows.every(item=>item.choice==='skip')){close();showToast('Aucun parcours importé. Tes données sont inchangées.');return;}
  try{
   const incoming=rows.filter(r=>r.choice!=='skip').map(item=>({...recordFor(item),id:crypto.randomUUID()}));
   const normalized=JTDData.normalizeData({...data(),journal:[...JOURNAL,...incoming]});
   window.persistAppData(normalized);replaceAppData(normalized);buildStatusToggles();buildPlatformList();render();window.JTDDataChanged?.();
   close();goToPage('journal');showToast(incoming.length+' parcours ajouté(s).');
  }catch(e){$('journal-import-error').textContent=e.message||'Enregistrement impossible. Aucune modification appliquée.';}
 });
})();
