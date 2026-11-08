/* Private Pokédex trackers: shared account, cloud and backup data boundary. */
(() => {
 document.body.classList.add('dex-enabled');
 document.getElementById('pokedex-nav').classList.remove('hidden');
 const $=id=>document.getElementById(id),esc=escapeHTML;
 const catalog=window.REGAL_POKEDEX_CATALOG;
 const species=new Map(catalog.species.map(entry=>[entry.id,entry]));
 const labels=['À obtenir','À ranger','Rangé'];
 const regionNames={alola:'Alola',galar:'Galar',hisui:'Hisui',paldea:'Paldea'};
 const generationNames=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
 const boxes=$('dex-boxes'),storagePrefix='jtd:sandbox-pokedex-prototype:';
 const libraryKey=storagePrefix+'trackers:v2';
 let trackers=POKEDEX_TRACKERS,current=null,active='',states={},entries=[],home=false,shiny=false,loadError=false;
 let revision=0;
 const choices=[];
 const versions=[[2,'Rouge','Bleu','Jaune'],[3,'Or','Argent','Cristal'],[4,'Rubis','Saphir','Émeraude'],['frlg','Rouge Feu','Vert Feuille'],[5,'Diamant','Perle'],[6,'Platine'],[7,'HeartGold','SoulSilver'],[8,'Noir','Blanc'],[9,'Noir 2','Blanc 2'],[12,'X','Y'],[15,'Rubis Oméga','Saphir Alpha'],[16,'Soleil','Lune'],[21,'Ultra-Soleil','Ultra-Lune'],[26,'Let’s Go Pikachu','Let’s Go Évoli'],[27,'Épée','Bouclier'],[28,'Épée · Isolarmure (DLC)','Bouclier · Isolarmure (DLC)'],[29,'Épée · Couronneige (DLC)','Bouclier · Couronneige (DLC)'],[30,'Légendes Arceus'],[31,'Écarlate','Violet'],[32,'Écarlate · Septentria (DLC)','Violet · Septentria (DLC)'],[33,'Écarlate · Myrtille (DLC)','Violet · Myrtille (DLC)'],[34,'Légendes Z-A'],[35,'Légendes Z-A · Méga-Dimension (DLC)']];
 for(const [number,...names] of versions) names.forEach((name,index)=>choices.push({id:'game-'+number+':'+index,catalogId:'game-'+number,name}));
 const validCatalog=id=>['home','home-shiny'].includes(id)||catalog.dexes.some(d=>d.id===id);
 const cleanStates=value=>Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).filter(([id,state])=>/^\d+$/.test(id)&&[1,2].includes(state)));
 function persist(next,generation=window.JTDAccountGeneration){
  if(generation!==window.JTDAccountGeneration || (!IS_PREVIEW_MODE&&window.JTDCanWriteData?.()!==true)) throw Error('Le compte doit être chargé avant de modifier le Pokédex.');
  const normalized=JTDData.normalizePokedex(next);
  JTDData.assertCloudSize({...buildBackupPayload().data,pokedex:normalized,shareToken:SHARE_TOKEN,updatedAt:Date.now()});
  if(IS_PREVIEW_MODE) savePreviewData({pokedex:normalized});
  else accountStorage.atomicWrite([[POKEDEX_KEY,JSON.stringify(normalized)]]);
  POKEDEX_TRACKERS=normalized;trackers=normalized;window.JTDDataChanged?.();
 }
 function migratePreviewPrototype(){
  if(!IS_PREVIEW_MODE||!window.JTDMigratePreviewPokedex) return;
  window.JTDMigratePreviewPokedex=false;
  if(trackers.length) return;
  const raw=localStorage.getItem(libraryKey);
  if(raw!==null){
   const saved=JSON.parse(raw);
   if(saved?.version!==2||!Array.isArray(saved.trackers)) throw Error('Ancien Pokédex illisible.');
   persist(saved.trackers);return;
  }
  const migrated=new Map();
  for(const id of ['home','home-shiny',...Array.from({length:34},(_,i)=>'game-'+(i+2))]){
   const raw=localStorage.getItem(storagePrefix+id+':v1')??(id==='game-2'?localStorage.getItem(storagePrefix+'kanto:v1'):null);
   if(raw===null) continue;
   const number=+id.slice(5),catalogId=[13,14].includes(number)?'game-12':[17,18,19,20].includes(number)?'game-16':[22,23,24,25].includes(number)?'game-21':id;
   if(!validCatalog(catalogId)) continue;
   const previous=migrated.get(catalogId)||{id:crypto.randomUUID(),catalogId,name:catalogId==='home'?'HOME':catalogId==='home-shiny'?'HOME shiny':catalog.dexes.find(d=>d.id===catalogId).name.split(' — ')[0],states:{}};
   for(const [id,state] of Object.entries(cleanStates(JSON.parse(raw)))) previous.states[id]=Math.max(previous.states[id]||0,state);
   migrated.set(catalogId,previous);
  }
  if(migrated.size) persist([...migrated.values()]);
 }
 const pad=n=>String(n).padStart(4,'0');
 const sparkle='<svg class="dex-shiny-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="M20 2v4m-2-2h4"/></svg>';
 const pencil='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9M4 20l1-5L16 4l4 4L9 19z"/></svg>';
 function iconHtml(catalogId,choiceId){
  const isHome=['home','home-shiny'].includes(catalogId),gameId=Number(catalogId.slice(5));
  const choice=choices.find(c=>c.id===choiceId),name=choice?.name.split(' · ')[0]||({4:'Émeraude',5:'Diamant',6:'Platine',7:'HeartGold',8:'Noir',9:'Noir 2',frlg:'Rouge Feu'})[catalogId.slice(5)];
  let file=isHome?'Icône Pokémon HOME HOME.png':gameId===30?'Icône Légendes Pokémon Arceus HOME.png':gameId>=34?'Icône Légendes Pokémon Z-A HOME.png':gameId>=12&&name?'Icône Pokémon '+name+' HOME.png':gameId===2&&name?'Icône Pokémon '+name+' (3DS).png':gameId===3&&name?'Icône Pokémon '+name+' (3DS).png':gameId===4&&name?'Icône Pokémon '+name+'.png':'';
  if(gameId===26) file="Icône Pokémon Let's Go, "+(name?.includes('Évoli')?'Évoli':'Pikachu')+' HOME.png';
  const dsFiles={
   Diamant:'/images/6/63/Ic%C3%B4ne_Pok%C3%A9mon_Diamant.png',Perle:'/images/3/3f/Ic%C3%B4ne_Pok%C3%A9mon_Perle.png',Platine:'/images/3/33/Ic%C3%B4ne_Pok%C3%A9mon_Platine.png',
   HeartGold:'/images/0/0d/Ic%C3%B4ne_Pok%C3%A9mon_Or_HeartGold.png',SoulSilver:'/images/3/37/Ic%C3%B4ne_Pok%C3%A9mon_Argent_SoulSilver.png',
   Noir:'/images/1/16/Ic%C3%B4ne_Pok%C3%A9mon_Noir_%28DS%29.png',Blanc:'/images/d/d6/Ic%C3%B4ne_Pok%C3%A9mon_Blanc_%28DS%29.png',
   'Noir 2':'/images/e/e0/Ic%C3%B4ne_Pok%C3%A9mon_Noir_2_%28DS%29.png','Blanc 2':'/images/1/1f/Ic%C3%B4ne_Pok%C3%A9mon_Blanc_2_%28DS%29.png'
  };
  const gbaFiles={Rubis:'d/df/Jaquette_de_Pok%C3%A9mon_Rubis.png',Saphir:'3/3e/Jaquette_de_Pok%C3%A9mon_Saphir.png','Émeraude':'0/0c/Jaquette_de_Pok%C3%A9mon_%C3%89meraude.png','Rouge Feu':'3/3b/Jaquette_de_Pok%C3%A9mon_Rouge_Feu.png','Vert Feuille':'9/9e/Jaquette_de_Pok%C3%A9mon_Vert_Feuille.png'};
  const gba=gbaFiles[name],ds=dsFiles[name];
  const source=gba?'https://www.pokepedia.fr/images/thumb/'+gba+'/200px-'+gba.split('/').at(-1):ds?'https://www.pokepedia.fr'+ds:file?'https://www.pokepedia.fr/Spécial:FilePath/'+encodeURIComponent(file):'';
  const assetClass=gba?' dex-gba-cover':ds?' dex-ds-icon':'';
  const svg='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+(isHome?'<path d="m5 15 11-9 11 9v12H5zM12 27V16h8v11"/>':'<circle cx="16" cy="16" r="11"/><path d="M5 16h7m8 0h7"/><circle cx="16" cy="16" r="4"/>')+'</svg>';
  return '<span class="dex-game-icon" aria-hidden="true">'+svg+(source?'<img class="dex-icon-image'+assetClass+'" src="'+source+'" alt="" loading="lazy" decoding="async">':'')+(catalogId==='home-shiny'?'<span class="dex-shiny-badge">'+sparkle+'</span>':'')+'</span>';
 }
 document.addEventListener('error',event=>{if(event.target.matches?.('.dex-icon-image')) event.target.remove();},true);
 document.addEventListener('load',event=>{if(event.target.matches?.('.dex-icon-image')) event.target.classList.add('ready');},true);
 function badges(total,pending,done){return '<span class="dex-count-badge" data-state="0"><b>'+(total-pending-done)+'</b> À obtenir</span><span class="dex-count-badge" data-state="1"><b>'+pending+'</b> À ranger</span><span class="dex-count-badge" data-state="2"><b>'+done+'</b> Rangés</span>';}
 function renderLibrary(){
  $('dex-detail').classList.add('hidden');$('dex-library').classList.remove('hidden');current=null;
  $('dex-tracker-list').innerHTML=trackers.length?trackers.map(tracker=>{
   const isHome=['home','home-shiny'].includes(tracker.catalogId),dex=catalog.dexes.find(d=>d.id===tracker.catalogId);
   const ids=new Set(isHome?[...catalog.species,...catalog.forms].map(e=>String(e.id)):(dex?.entries||[]).map(e=>String(e.id)));
   const values=Object.entries(tracker.states).filter(([id])=>ids.has(id)).map(([,state])=>state),done=values.filter(s=>s===2).length,pending=values.filter(s=>s===1).length,total=ids.size;
   const title=isHome?'Pokémon HOME'+(tracker.catalogId==='home-shiny'?' · Shiny':''):(choices.find(c=>c.id===tracker.choice)?.name||dex?.name.split(' — ')[0]||'Catalogue indisponible')+' — '+(dex?.name.split(' — ')[1]||tracker.catalogId);
   return '<article class="dex-tracker-card"><button type="button" class="dex-tracker-open" data-tracker="'+esc(tracker.id)+'"><span class="dex-card-heading">'+iconHtml(tracker.catalogId,tracker.choice)+'<strong>'+esc(tracker.name)+'</strong></span><span class="dex-tracker-catalog">'+esc(title)+'</span><strong class="dex-tracker-total">'+(done+pending)+' / '+total+'</strong><span class="dex-card-legend">'+badges(total,pending,done)+'</span><span class="dex-progress-track" aria-hidden="true"><span class="dex-progress-home" style="width:'+done/total*100+'%"></span><span class="dex-progress-pending" style="width:'+pending/total*100+'%"></span></span></button><button type="button" class="identity-edit-btn dex-tracker-edit" data-edit-tracker="'+esc(tracker.id)+'" aria-label="Modifier '+esc(tracker.name)+'">'+pencil+'</button></article>';
  }).join(''):'<p class="dex-empty-library">Aucun Pokédex pour le moment.</p>';
 }
 $('dex-tracker-list').addEventListener('click',event=>{const edit=event.target.closest('[data-edit-tracker]');if(edit){openEditor(trackers.find(t=>t.id===edit.dataset.editTracker));return;}const button=event.target.closest('[data-tracker]');if(!button) return;current=trackers.find(t=>t.id===button.dataset.tracker);if(!current) return;if(!validCatalog(current.catalogId)){$('dex-library-error').textContent='Le catalogue de ce Pokédex n’est pas disponible dans cette version. Sa progression est conservée.';current=null;return;}active=current.catalogId;states={...current.states};$('dex-library').classList.add('hidden');$('dex-detail').classList.remove('hidden');loadDex();window.scrollTo(0,0);$('dex-back').focus({preventScroll:true});});
 $('dex-back').onclick=()=>{renderLibrary();window.scrollTo(0,0);$('dex-new').focus({preventScroll:true});};
 let editorGeneration,editorRevision;
 let editingId=null,selectedChoice='home',proposedName='';
 const templates=[{id:'home',catalogId:'home',name:'HOME'},{id:'home-shiny',catalogId:'home-shiny',name:'HOME shiny'},...choices];
 function closeEditor(){JTDDialogs.close('dex-editor-overlay');editingId=null;}
 function renderChoices(){
  const fold=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
  const query=fold($('dex-choice-search').value.trim());
  const list=templates.filter(t=>fold(t.name).includes(query));
  $('dex-choices').innerHTML=list.map(t=>'<button type="button" class="dex-choice" data-dex-choice="'+t.id+'" aria-pressed="'+String(t.id===selectedChoice)+'">'+iconHtml(t.catalogId,t.id)+'<span>'+esc(t.name)+'</span></button>').join('')||'<p>Aucun Pokédex trouvé.</p>';
 }
 function openEditor(tracker=null){
  editorGeneration=window.JTDAccountGeneration;editorRevision=revision;
  editingId=tracker?.id||null;selectedChoice=tracker?.choice||tracker?.catalogId||'home';
  $('dex-create').reset();$('dex-picker').classList.toggle('hidden',!!tracker);
  $('dex-editor-title').textContent=tracker?'Modifier le Pokédex':'Créer un Pokédex';
  $('dex-editor-save').textContent=tracker?'Enregistrer':'Créer';
  $('dex-delete').classList.toggle('hidden',!tracker);
  proposedName=tracker?.name||'HOME';$('dex-name').value=proposedName;$('dex-editor-error').textContent='';
  renderChoices();JTDDialogs.open('dex-editor-overlay',{onDismiss:closeEditor,initialFocus:tracker?'#dex-name':'#dex-choice-search'});
 }
 $('dex-new').onclick=()=>openEditor();
 $('dex-edit-current').innerHTML=pencil;
 $('dex-edit-current').onclick=()=>{if(current) openEditor(current);};
 $('dex-create-cancel').onclick=closeEditor;
 $('dex-choice-search').addEventListener('input',renderChoices);
 $('dex-choices').addEventListener('click',event=>{
  const button=event.target.closest('[data-dex-choice]');if(!button) return;
  selectedChoice=button.dataset.dexChoice;
  const next=templates.find(t=>t.id===selectedChoice).name;
  if(!$('dex-name').value||$('dex-name').value===proposedName) $('dex-name').value=next;
  proposedName=next;
  for(const option of $('dex-choices').querySelectorAll('[data-dex-choice]')) option.setAttribute('aria-pressed',String(option.dataset.dexChoice===selectedChoice));
 });
 $('dex-delete').onclick=()=>{
  const id=editingId,tracker=trackers.find(t=>t.id===id),generation=editorGeneration,view=editorRevision;if(!tracker) return;
  confirmAction('Supprimer « '+tracker.name+' » et sa progression ?',()=>{
   if(generation!==window.JTDAccountGeneration||view!==revision) return;
   try {persist(trackers.filter(t=>t.id!==id),generation);closeEditor();renderLibrary();$('dex-new').focus();}
   catch {$('dex-editor-error').textContent='Le Pokédex n’a pas pu être supprimé.';}
  });
 };
 $('dex-create').addEventListener('submit',event=>{
  event.preventDefault();if(loadError||editorGeneration!==window.JTDAccountGeneration||editorRevision!==revision){closeEditor();return;}
  const name=$('dex-name').value.trim();if(!name){$('dex-name').focus();return;}
  const existing=editingId&&trackers.find(t=>t.id===editingId);
  if(editingId&&!existing){$('dex-editor-error').textContent='Ce Pokédex n’existe plus.';return;}
  const template=templates.find(t=>t.id===selectedChoice);
  const tracker=existing?{...existing,name:name.slice(0,100)}:{id:crypto.randomUUID(),catalogId:template.catalogId,name:name.slice(0,100),states:{},choice:template.id};
  try {
   persist(existing?trackers.map(t=>t.id===tracker.id?tracker:t):[...trackers,tracker],editorGeneration);
   closeEditor();$('dex-library-error').textContent='';
   if(existing&&current?.id===tracker.id){current=tracker;loadDex();$('dex-edit-current').focus();}
   else {renderLibrary();const button=$('dex-tracker-list').querySelector('[data-tracker="'+tracker.id+'"]');if(existing) button.focus();else button.click();}
  }catch {$('dex-editor-error').textContent='Le Pokédex n’a pas pu être enregistré dans ce navigateur.';}
 });
 function count(list){
  let pending=0,done=0;
  for(const entry of list){if(states[entry.id]===1) pending++;if(states[entry.id]===2) done++;}
  return {pending,done,total:list.length};
 }
 function progress(list){
  const {pending,done,total}=count(list);
  return '<div class="dex-progress-track" role="img" aria-label="'+done+' rangés, '+pending+' à ranger, '+(total-pending-done)+' à obtenir sur '+total+'"><span class="dex-progress-home" style="width:'+(done/total*100)+'%"></span><span class="dex-progress-pending" style="width:'+(pending/total*100)+'%"></span></div>';
 }
 function sprite(entry){return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/'+(shiny?'shiny/':'')+entry.sprite+'.png';}
 function slot(entry){
  const number=(shiny?'S ':'')+pad(entry.number);
  return '<div class="dex-slot" data-pokemon="'+entry.id+'"><button type="button" class="dex-pokemon" title="'+esc(entry.name)+'" data-id="'+entry.id+'"><span class="dex-number">'+number+'</span><img src="'+sprite(entry)+'" alt="" loading="lazy" decoding="async" width="96" height="96"><span class="dex-name">'+esc(entry.name)+'</span><span class="dex-state-mark" aria-hidden="true"></span></button><a class="dex-info" href="https://www.pokepedia.fr/'+encodeURIComponent(entry.speciesName)+'#Localisations" target="_blank" rel="noopener noreferrer" aria-label="Où obtenir '+esc(entry.name)+' ? (nouvel onglet)" title="Lieux de capture sur Poképédia">i</a></div>';
 }
 function addBoxes(list,region=''){
  for(let start=0;start<list.length;start+=30){
   const content=list.slice(start,start+30),section=document.createElement('section');
   const title=region?'Formes '+(region==='alola'?"d’Alola":'de '+regionNames[region])+(list.length>30?' · '+(start/30+1):''):(shiny?'S ':'')+pad(start+1)+'–'+pad(start+30);
   section.className='dex-box';
   const heading='dex-box-'+(region||'base')+'-'+start;
   section.setAttribute('aria-labelledby',heading);
   section.innerHTML='<header><h2 id="'+heading+'">'+(shiny?sparkle:'')+title+'</h2><div class="dex-box-tools"><span>'+(region?content.length+' formes':'Boîte '+(start/30+1))+'</span><details class="dex-box-actions"><summary aria-label="Modifier toute la boîte '+esc(title)+'" title="Modifier toute la boîte"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg></summary><div class="dex-box-menu" role="group" aria-label="Appliquer à toute la boîte"><button type="button" data-box-state="1">Tout à ranger</button><button type="button" data-box-state="2">Tout ranger</button><button type="button" data-box-state="0">Tout décocher</button></div></details></div></header><div class="dex-grid">'+content.map(slot).join('')+Array.from({length:30-content.length},()=>'<div class="dex-empty" aria-hidden="true"></div>').join('')+'</div>';
   boxes.append(section);
  }
 }
 function loadDex(){
  home=active==='home'||active==='home-shiny';shiny=active==='home-shiny';
  const dex=catalog.dexes.find(d=>d.id===active);
  const region=dex&&({16:'alola',17:'alola',18:'alola',19:'alola',20:'alola',21:'alola',22:'alola',23:'alola',24:'alola',25:'alola',27:'galar',28:'galar',29:'galar',30:'hisui',31:'paldea',32:'paldea',33:'paldea'})[active.slice(5)];
  const base=(home?catalog.species.map(entry=>({id:entry.id,number:entry.id})):dex.entries).map(entry=>{
   const source=species.get(entry.id);
   const regional=!home&&catalog.forms.find(f=>f.region===region&&f.speciesId===entry.id);
   return {...entry,sprite:regional?.id||entry.id,name:regional?.name||source.name,speciesName:source.name,generation:source.generation};
  });
  const forms=home?catalog.forms.map(form=>({id:form.id,sprite:form.id,number:form.speciesId,name:form.name,speciesName:species.get(form.speciesId).name,region:form.region})):[];
  entries=[...base,...forms];
  $('pokedex-title').innerHTML=(shiny?sparkle:'')+esc(current.name);
  $('dex-subtitle').textContent=home?'Pokémon HOME'+(shiny?' · Shiny':'')+' · National · '+base.length+' espèces · '+forms.length+' formes régionales':(choices.find(c=>c.id===current.choice)?.name||dex.name.split(' — ')[0])+' · '+dex.name.split(' — ')[1]+' · '+base.length+' Pokémon';
  $('dex-identity-icon').innerHTML=iconHtml(active,current.choice);
  boxes.replaceChildren();addBoxes(base);
  for(const region of Object.keys(regionNames)) if(home) addBoxes(forms.filter(entry=>entry.region===region),region);
  $('dex-generations').classList.toggle('hidden',!home);
  $('dex-error').textContent='';update();
 }
 function update(){
  for(const entry of entries){
   const state=states[entry.id]||0,button=boxes.querySelector('[data-id="'+entry.id+'"]');
   button.parentElement.dataset.state=state;
   button.setAttribute('aria-label',entry.name+' · '+(shiny?'S ':'')+pad(entry.number)+' · '+labels[state]+'. Cliquer : '+labels[(state+1)%3]);
   button.querySelector('.dex-state-mark').textContent=['','•','✓'][state];
  }
  const overall=count(entries);
  $('dex-progress').innerHTML='<strong>'+(overall.done+overall.pending)+' <small>/ '+overall.total+'</small></strong>'+progress(entries);
  $('dex-legend').innerHTML=badges(overall.total,overall.pending,overall.done);
  $('dex-generations').innerHTML=home?[...new Set(catalog.species.map(entry=>entry.generation))].sort((a,b)=>a-b).map(generation=>{
   const list=entries.filter(entry=>!entry.region&&entry.generation===generation),totals=count(list);
   return '<div class="dex-generation"><div><strong>Gén. '+generation+(generationNames[generation-1]?' · '+generationNames[generation-1]:'')+'</strong><span>'+(totals.done+totals.pending)+' / '+totals.total+'</span></div>'+progress(list)+'</div>';
  }).join(''):'';
 }
 boxes.addEventListener('click',event=>{
  const bulk=event.target.closest('[data-box-state]');
  const button=event.target.closest('.dex-pokemon');if(!current||loadError||(!button&&!bulk)) return;
  const next={...states};
  if(bulk){
   const state=Number(bulk.dataset.boxState);
   for(const item of bulk.closest('.dex-box').querySelectorAll('.dex-pokemon')) next[item.dataset.id]=state;
  }else next[button.dataset.id]=((states[button.dataset.id]||0)+1)%3;
  try {const updated={...current,states:next};persist(trackers.map(t=>t.id===current.id?updated:t));current=updated;states=next;$('dex-error').textContent='';update();}
  catch {$('dex-error').textContent='La progression n’a pas pu être enregistrée dans ce navigateur.';}
  if(bulk){const menu=bulk.closest('details');menu.open=false;menu.querySelector('summary').focus({preventScroll:true});}
 });
 boxes.addEventListener('toggle',event=>{
  const menu=event.target;if(!menu.matches('.dex-box-actions')||!menu.open) return;
  for(const other of boxes.querySelectorAll('.dex-box-actions[open]')) if(other!==menu) other.open=false;
 },true);
 boxes.addEventListener('keydown',event=>{if(event.key!=='Escape') return;const menu=event.target.closest('.dex-box-actions[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}});
 document.addEventListener('pointerdown',event=>{if(event.target.closest('.dex-box-actions')) return;for(const menu of boxes.querySelectorAll('.dex-box-actions[open]')) menu.open=false;});
 window.refreshPokedex=()=>{
  revision++;
  if(!$('dex-editor-overlay').classList.contains('hidden')){window.cancelPendingConfirmation?.();closeEditor();}
  boxes.replaceChildren();entries=[];states={};current=null;loadError=false;
  $('pokedex-title').textContent='Pokédex';$('dex-subtitle').textContent='';$('dex-identity-icon').replaceChildren();
  $('dex-progress').replaceChildren();$('dex-legend').replaceChildren();$('dex-generations').replaceChildren();$('dex-create').reset();
  $('dex-library-error').textContent='';$('dex-new').disabled=false;
  trackers=POKEDEX_TRACKERS;
  try {migratePreviewPrototype();}
  catch(error){loadError=true;$('dex-new').disabled=true;$('dex-library-error').textContent='Les anciens Pokédex n’ont pas pu être repris. Les données d’origine sont conservées.';}
  renderLibrary();
 };
 window.refreshPokedex();
})();
