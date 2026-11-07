/* Interactive preview only; intentionally separate from account/cloud data. */
(() => {
 if(!IS_PREVIEW_MODE) return;
 document.body.classList.add('dex-prototype-enabled');
 document.getElementById('pokedex-nav').classList.remove('hidden');
 const $=id=>document.getElementById(id),esc=escapeHTML;
 const catalog=window.REGAL_POKEDEX_CATALOG;
 const species=new Map(catalog.species.map(entry=>[entry.id,entry]));
 const labels=['À obtenir','À transférer','Dans HOME'];
 const regionNames={alola:'Alola',galar:'Galar',hisui:'Hisui',paldea:'Paldea'};
 const generationNames=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
 const select=$('dex-select'),boxes=$('dex-boxes');
 const storagePrefix='jtd:sandbox-pokedex-prototype:';
 let active='game-2',states={},entries=[],home=false,shiny=false;
 try {const saved=localStorage.getItem(storagePrefix+'selected');if(['home','home-shiny',...catalog.dexes.map(d=>d.id)].includes(saved)) active=saved;} catch {}
 select.innerHTML='<optgroup label="Pokémon HOME"><option value="home">HOME · National</option><option value="home-shiny">HOME · National shiny</option></optgroup><optgroup label="Jeux et DLC">'+catalog.dexes.map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('')+'</optgroup>';
 const pad=n=>String(n).padStart(4,'0');
 const key=()=>storagePrefix+active+':v1';
 function readStates(){
  states={};
  try {
   const raw=localStorage.getItem(key())??(active==='game-2'?localStorage.getItem(storagePrefix+'kanto:v1'):null);
   const saved=JSON.parse(raw||'{}');
   for(const entry of entries) if([1,2].includes(saved?.[entry.id])) states[entry.id]=saved[entry.id];
  } catch { /* A fresh preview remains usable without storage. */ }
 }
 function count(list){
  let pending=0,done=0;
  for(const entry of list){if(states[entry.id]===1) pending++;if(states[entry.id]===2) done++;}
  return {pending,done,total:list.length};
 }
 function progress(list){
  const {pending,done,total}=count(list);
  return '<div class="dex-progress-track" role="img" aria-label="'+done+' dans HOME, '+pending+' à transférer, '+(total-pending-done)+' à obtenir sur '+total+'"><span class="dex-progress-home" style="width:'+(done/total*100)+'%"></span><span class="dex-progress-pending" style="width:'+(pending/total*100)+'%"></span></div>';
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
  entries=[...base,...forms];readStates();select.value=active;
  $('pokedex-title').textContent=home?'Pokémon HOME'+(shiny?' · Shiny':''):dex.name.split(' — ')[0];
  $('dex-subtitle').textContent=home?'National · '+base.length+' espèces · '+forms.length+' formes régionales':dex.name.split(' — ')[1]+' · '+base.length+' Pokémon';
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
  $('dex-progress').innerHTML='<strong>'+overall.done+' <small>/ '+overall.total+' dans HOME</small></strong><span>'+overall.pending+' à transférer</span>'+progress(entries);
  $('dex-generations').innerHTML=home?[...new Set(catalog.species.map(entry=>entry.generation))].sort((a,b)=>a-b).map(generation=>{
   const list=entries.filter(entry=>!entry.region&&entry.generation===generation),totals=count(list);
   return '<div class="dex-generation"><div><strong>Gén. '+generation+(generationNames[generation-1]?' · '+generationNames[generation-1]:'')+'</strong><span>'+totals.done+' / '+totals.total+'</span></div>'+progress(list)+'</div>';
  }).join(''):'';
 }
 boxes.addEventListener('click',event=>{
  const button=event.target.closest('.dex-pokemon');if(!button) return;
  const id=button.dataset.id,next={...states,[id]:((states[id]||0)+1)%3};
  try {localStorage.setItem(key(),JSON.stringify(next));states=next;$('dex-error').textContent='';update();}
  catch {$('dex-error').textContent='La progression n’a pas pu être enregistrée dans ce navigateur.';}
 });
 select.addEventListener('change',()=>{
  active=select.value;
  try {localStorage.setItem(storagePrefix+'selected',active);}catch {}
  loadDex();
 });
 loadDex();
})();
