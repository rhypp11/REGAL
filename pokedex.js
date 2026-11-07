/* Interactive preview only; intentionally separate from account/cloud data. */
(() => {
 if(!IS_PREVIEW_MODE) return;
 document.body.classList.add('dex-prototype-enabled');
 document.getElementById('pokedex-nav').classList.remove('hidden');
 const $=id=>document.getElementById(id),esc=escapeHTML;
 const catalog=window.REGAL_POKEDEX_CATALOG;
 const species=new Map(catalog.species.map(entry=>[entry.id,entry]));
 const labels=['À obtenir','À ranger','Rangé'];
 const regionNames={alola:'Alola',galar:'Galar',hisui:'Hisui',paldea:'Paldea'};
 const generationNames=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
 const boxes=$('dex-boxes'),storagePrefix='jtd:sandbox-pokedex-prototype:';
 const libraryKey=storagePrefix+'trackers:v2';
 let trackers=[],current=null,active='',states={},entries=[],home=false,shiny=false,loadError=false;
 const choices=[];
 const versions=[[2,'Rouge','Bleu','Jaune'],[3,'Or','Argent','Cristal'],[4,'Rubis','Saphir','Émeraude'],[5,'Diamant','Perle'],[6,'Platine'],[7,'HeartGold','SoulSilver'],[8,'Noir','Blanc'],[9,'Noir 2','Blanc 2'],[12,'X','Y'],[15,'Rubis Oméga','Saphir Alpha'],[16,'Soleil','Lune'],[21,'Ultra-Soleil','Ultra-Lune'],[26,'Let’s Go Pikachu','Let’s Go Évoli'],[27,'Épée','Bouclier'],[28,'Épée · Isolarmure (DLC)','Bouclier · Isolarmure (DLC)'],[29,'Épée · Couronneige (DLC)','Bouclier · Couronneige (DLC)'],[30,'Légendes Arceus'],[31,'Écarlate','Violet'],[32,'Écarlate · Septentria (DLC)','Violet · Septentria (DLC)'],[33,'Écarlate · Myrtille (DLC)','Violet · Myrtille (DLC)'],[34,'Légendes Z-A'],[35,'Légendes Z-A · Méga-Dimension (DLC)']];
 for(const [number,...names] of versions) names.forEach((name,index)=>choices.push({id:'game-'+number+':'+index,catalogId:'game-'+number,name}));
 const validCatalog=id=>['home','home-shiny'].includes(id)||catalog.dexes.some(d=>d.id===id);
 const cleanStates=value=>Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).filter(([id,state])=>/^\d+$/.test(id)&&[1,2].includes(state)));
 function persist(next){localStorage.setItem(libraryKey,JSON.stringify({version:2,trackers:next}));trackers=next;}
 try {
  const raw=localStorage.getItem(libraryKey);
  if(raw!==null){
   const saved=JSON.parse(raw);
   if(saved?.version!==2||!Array.isArray(saved.trackers)||saved.trackers.some(t=>!t||typeof t.id!=='string'||typeof t.name!=='string'||!validCatalog(t.catalogId))||new Set(saved.trackers.map(t=>t.id)).size!==saved.trackers.length) throw Error('invalid');
   trackers=saved.trackers.map(t=>({...t,name:t.name.slice(0,100),states:cleanStates(t.states)}));
  }else{
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
 }catch {loadError=true;$('dex-library-error').textContent='Impossible de charger les Pokédex enregistrés. Les données ont été conservées.';$('dex-new').disabled=true;}
 const pad=n=>String(n).padStart(4,'0');
 function renderLibrary(){
  $('dex-detail').classList.add('hidden');$('dex-library').classList.remove('hidden');current=null;
  $('dex-tracker-list').innerHTML=trackers.length?trackers.map(tracker=>{
   const isHome=['home','home-shiny'].includes(tracker.catalogId),dex=catalog.dexes.find(d=>d.id===tracker.catalogId);
   const ids=new Set(isHome?[...catalog.species,...catalog.forms].map(e=>String(e.id)):dex.entries.map(e=>String(e.id)));
   const values=Object.entries(tracker.states).filter(([id])=>ids.has(id)).map(([,state])=>state),done=values.filter(s=>s===2).length,pending=values.filter(s=>s===1).length,total=ids.size;
   const title=isHome?'Pokémon HOME'+(tracker.catalogId==='home-shiny'?' · Shiny':''):(choices.find(c=>c.id===tracker.choice)?.name||dex.name.split(' — ')[0])+' — '+dex.name.split(' — ')[1];
   return '<button type="button" class="dex-tracker-card" data-tracker="'+esc(tracker.id)+'"><strong>'+esc(tracker.name)+'</strong><span class="dex-tracker-catalog">'+esc(title)+'</span><span class="dex-tracker-count">'+done+' / '+total+' rangés · '+pending+' à ranger</span><span class="dex-progress-track" aria-hidden="true"><span class="dex-progress-home" style="width:'+done/total*100+'%"></span><span class="dex-progress-pending" style="width:'+pending/total*100+'%"></span></span></button>';
  }).join(''):'<p class="dex-empty-library">Aucun Pokédex pour le moment.</p>';
 }
 $('dex-tracker-list').addEventListener('click',event=>{const button=event.target.closest('[data-tracker]');if(!button) return;current=trackers.find(t=>t.id===button.dataset.tracker);if(!current) return;active=current.catalogId;states={...current.states};$('dex-library').classList.add('hidden');$('dex-detail').classList.remove('hidden');loadDex();window.scrollTo(0,0);$('dex-back').focus({preventScroll:true});});
 $('dex-back').onclick=()=>{renderLibrary();window.scrollTo(0,0);$('dex-new').focus({preventScroll:true});};
 $('dex-game').innerHTML=choices.map(choice=>'<option value="'+choice.id+'">'+esc(choice.name)+'</option>').join('');
 let proposedName='';
 function syncCreate(){
  const isHome=$('dex-kind').value==='home';$('dex-game-field').classList.toggle('hidden',isHome);$('dex-shiny-field').classList.toggle('hidden',!isHome);
  const next=isHome?($('dex-shiny').value==='shiny'?'HOME shiny':'HOME'):choices.find(c=>c.id===$('dex-game').value).name;
  if(!$('dex-name').value||$('dex-name').value===proposedName) $('dex-name').value=next;
  proposedName=next;
 }
 for(const id of ['dex-kind','dex-game','dex-shiny']) $(id).addEventListener('change',syncCreate);
 $('dex-new').onclick=()=>{$('dex-create').reset();proposedName='';syncCreate();$('dex-create').classList.remove('hidden');$('dex-kind').focus();};
 $('dex-create-cancel').onclick=()=>{$('dex-create').classList.add('hidden');$('dex-new').focus();};
 $('dex-create').addEventListener('submit',event=>{
  event.preventDefault();if(loadError) return;
  const name=$('dex-name').value.trim();if(!name){$('dex-name').focus();return;}
  const choice=choices.find(c=>c.id===$('dex-game').value);
  const catalogId=$('dex-kind').value==='home'?($('dex-shiny').value==='shiny'?'home-shiny':'home'):choice.catalogId;
  const tracker={id:crypto.randomUUID(),catalogId,name:name.slice(0,100),states:{},choice:choice.id};
  try {persist([...trackers,tracker]);$('dex-create').classList.add('hidden');$('dex-library-error').textContent='';renderLibrary();$('dex-tracker-list').querySelector('[data-tracker="'+tracker.id+'"]').click();}
  catch {$('dex-library-error').textContent='Le Pokédex n’a pas pu être enregistré dans ce navigateur.';}
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
   const title=region?'Formes '+(region==='alola'?"d’Alola":'de '+regionNames[region])+(list.length>30?' · '+(start/30+1):''):(shiny?'S ':'')+pad(start+1)+'–'+(shiny?'S ':'')+pad(start+30);
   section.className='dex-box';
   const heading='dex-box-'+(region||'base')+'-'+start;
   section.setAttribute('aria-labelledby',heading);
   section.innerHTML='<header><h2 id="'+heading+'">'+title+'</h2><span>'+(region?content.length+' formes':'Boîte '+(start/30+1))+'</span></header><div class="dex-grid">'+content.map(slot).join('')+Array.from({length:30-content.length},()=>'<div class="dex-empty" aria-hidden="true"></div>').join('')+'</div>';
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
  $('pokedex-title').textContent=current.name;
  $('dex-subtitle').textContent=home?'Pokémon HOME'+(shiny?' · Shiny':'')+' · National · '+base.length+' espèces · '+forms.length+' formes régionales':(choices.find(c=>c.id===current.choice)?.name||dex.name.split(' — ')[0])+' · '+dex.name.split(' — ')[1]+' · '+base.length+' Pokémon';
  $('dex-identity-icon').innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+(home?'<path d="m5 15 11-9 11 9v12H5zM12 27V16h8v11"/>':'<circle cx="16" cy="16" r="11"/><path d="M5 16h7m8 0h7"/><circle cx="16" cy="16" r="4"/>')+'</svg>';
  const gameId=Number(active.slice(5));
  const iconFile=home?'Icône Pokémon HOME HOME.png':gameId===2?'Icône Pokémon Jaune (3DS).png':[3,7].includes(gameId)?'Icône Pokémon Cristal (3DS).png':gameId>=12&&gameId<=14?'Icône Pokémon X HOME.png':gameId===15?'Icône Pokémon Rubis Oméga HOME.png':gameId>=16&&gameId<=20?'Icône Pokémon Soleil HOME.png':gameId>=21&&gameId<=25?'Icône Pokémon Ultra-Soleil HOME.png':gameId===26?"Icône Pokémon Let's Go, Pikachu HOME.png":gameId>=27&&gameId<=29?'Icône Pokémon Épée HOME.png':gameId===30?'Icône Légendes Pokémon Arceus HOME.png':gameId>=31&&gameId<=33?'Icône Pokémon Écarlate HOME.png':gameId>=34?'Icône Légendes Pokémon Z-A HOME.png':'';
  if(iconFile){
   const image=new Image();image.alt='';image.src='https://www.pokepedia.fr/Spécial:FilePath/'+encodeURIComponent(iconFile);
   image.addEventListener('error',()=>image.remove(),{once:true});$('dex-identity-icon').append(image);
  }
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
  $('dex-progress').innerHTML='<strong>'+overall.done+' <small>/ '+overall.total+' rangés</small></strong><span>'+overall.pending+' à ranger</span>'+progress(entries);
  $('dex-generations').innerHTML=home?[...new Set(catalog.species.map(entry=>entry.generation))].sort((a,b)=>a-b).map(generation=>{
   const list=entries.filter(entry=>!entry.region&&entry.generation===generation),totals=count(list);
   return '<div class="dex-generation"><div><strong>Gén. '+generation+(generationNames[generation-1]?' · '+generationNames[generation-1]:'')+'</strong><span>'+totals.done+' / '+totals.total+'</span></div>'+progress(list)+'</div>';
  }).join(''):'';
 }
 boxes.addEventListener('click',event=>{
  const button=event.target.closest('.dex-pokemon');if(!button) return;
  const id=button.dataset.id,next={...states,[id]:((states[id]||0)+1)%3};
  try {const updated={...current,states:next};persist(trackers.map(t=>t.id===current.id?updated:t));current=updated;states=next;$('dex-error').textContent='';update();}
  catch {$('dex-error').textContent='La progression n’a pas pu être enregistrée dans ce navigateur.';}
 });
 renderLibrary();
})();
