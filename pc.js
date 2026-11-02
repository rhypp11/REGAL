/* Launcher names and images use the existing synchronized metadata boundary. */
const LAUNCHER_META_PREFIX='__pc_launcher__:';
let managingLaunchers=false;
const isLauncherMetaKey=name=>name.startsWith(LAUNCHER_META_PREFIX);
const launcherKey=name=>LAUNCHER_META_PREFIX+name;
function pcCollection(){ return state.library === 'pc'; }
function hasPCBox(game){ return JTDData.isPC(game) && (game.pcPhysical === true || !JTDData.isDigital(game) || game.collector === true); }
function matchesLibrary(game){ return JTDData.isPC(game) === pcCollection(); }
function matchesLauncher(game){ return !pcCollection() || !state.launcher || (game.launcher || '') === (state.launcher === '__none__' ? '' : state.launcher); }
function launcherLabel(value){ return value && value !== '__none__' ? value : 'Sans launcher'; }
function allLauncherNames(){
  return [...new Set([...Object.keys(platformMeta).filter(isLauncherMetaKey).map(key=>key.slice(LAUNCHER_META_PREFIX.length)),...[...GAMES,...ARRIVALS,...WISHLIST,...CEMETERY].filter(JTDData.isPC).map(g=>g.launcher).filter(Boolean)])];
}
function orderedLauncherNames(){
  const all=allLauncherNames(),known=platformOrder.filter(isLauncherMetaKey).map(key=>key.slice(LAUNCHER_META_PREFIX.length)).filter(name=>all.includes(name));
  return [...known,...all.filter(name=>!known.includes(name)).sort((a,b)=>a.localeCompare(b,'fr'))];
}
function launcherIdentityHtml(name){
  const logo=safeURL(platformMeta[launcherKey(name)]?.logo,true);
  return '<span class="launcher-identity">'+(logo?'<img src="'+escapeHTML(logo)+'" alt="">':'')+'<span>'+escapeHTML(launcherLabel(name))+'</span></span>';
}
function chooseCollectionLibrary(library){
  if(state.library===library)return;
  Object.assign(state,{library,platform:null,launcher:null,accountId:null,contentType:null,media:library==='pc'?'all':'physical',collector:false,japanese:false,pcPhysical:false,status:null,search:''});
  document.getElementById('search-input').value='';
}
function renderLibraryControls(){
  if(pcCollection()){
    state.platform=null;state.accountId=null;state.media='all';state.japanese=false;
    state.contentType=selectedContentTypes().filter(type=>type!=='upgrade').join(',') || null;
  }else {state.launcher=null;state.pcPhysical=false;}
  document.querySelectorAll('.nav-tab').forEach(button=>{
    const active=button.dataset.page===(navigationPage==='collection'&&pcCollection()?'pc':navigationPage);
    button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  document.getElementById('collection-platform-label').textContent=pcCollection()?'Launchers':'Plateformes';
  document.getElementById('sort-platforms-btn').classList.toggle('hidden',pcCollection());
  const manager=document.getElementById('manage-platforms-btn');manager.classList.remove('hidden');manager.title=pcCollection()?'Launchers':'Plateformes';manager.setAttribute('aria-label',manager.title);
}
function decoratePCBanner(banner){
  if(!pcCollection())return;
  banner.querySelector('.collection-filter-context')?.remove();
  const fallback=banner.querySelector('.platform-banner-fallback');
  fallback.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>';
  const logo=state.launcher && safeURL(platformMeta[launcherKey(state.launcher)]?.logo,true);
  if(logo){const img=document.createElement('img');img.className='platform-banner-logo';img.src=logo;img.alt='';fallback.replaceWith(img);}
}
function buildPCEditionFilters(){
  const container=document.getElementById('format-toggles');container.replaceChildren();
  for(const [key,label,icon] of [['collector','Collector',FORMAT_ICON_STAR],['pcPhysical','Physique',MEDIA_ICONS.physical]]){
    const chip=document.createElement('div');chip.className='toggle-chip'+(state[key]?' active':'');chip.tabIndex=0;chip.dataset.pcEdition=key;
    chip.innerHTML='<span class="toggle-chip-label">'+icon+'<span>'+label+'</span></span>';setFilterAccessibility(chip,!!state[key]);
    chip.onclick=()=>{state[key]=!state[key];buildFormatToggles();render();};container.appendChild(chip);
  }
}
function buildLauncherList(){
  const scoped=collectionScope(),counts=new Map();for(const g of scoped){const name=g.launcher||'__none__';counts.set(name,(counts.get(name)||0)+1);}
  const container=document.getElementById('platform-list');container.replaceChildren();
  const option=(key,label,count)=>{
    const item=document.createElement('div');item.className='plat-item'+(state.launcher===key?' active':'');item.tabIndex=0;item.dataset.launcher=key||'';
    const meta=platformMeta[launcherKey(key)]||{},logo=safeURL(meta.logo,true);item.style.setProperty('--spine',meta.color||'var(--muted)');
    item.innerHTML=(logo?'<img class="mini-logo" src="'+escapeHTML(logo)+'" alt="">':'<span class="spine-chip" aria-hidden="true"></span>')+'<span class="plat-name">'+escapeHTML(label)+'</span><span class="plat-count">'+count+'</span>';
    setFilterAccessibility(item,state.launcher===key);item.onclick=()=>{state.launcher=state.launcher===key?null:key;buildPlatformList();render();closeMobileDrawers();};container.appendChild(item);
  };
  option(null,'Tous les launchers',scoped.length);
  orderedLauncherNames().forEach(name=>option(name,name,counts.get(name)||0));
  if(counts.has('__none__'))option('__none__','Sans launcher',counts.get('__none__'));
}
function updateLauncherField(){
  const pc=JTDData.isPC({plateforme:document.getElementById('f-plateforme').value});
  document.getElementById('f-launcher-field').classList.toggle('hidden',!pc);
  document.getElementById('f-pc-physical-field').classList.toggle('hidden',!pc);
  document.getElementById('f-japanese').closest('label').classList.toggle('hidden',pc);
  document.getElementById('f-plateforme').closest('.field').classList.toggle('hidden',pc);
  document.getElementById('f-account').closest('.field').classList.toggle('hidden',pc);
  document.getElementById('f-media-field').classList.toggle('hidden',pc || editingCollection==='cemetery' || !!convertingArrivalId);
  const upgrade=document.querySelector('#f-content-type option[value="upgrade"]');upgrade.hidden=pc;upgrade.disabled=pc;
}
function refreshLauncherSelect(selected=document.getElementById('f-launcher').value){
  const select=document.getElementById('f-launcher');select.replaceChildren(new Option('Sans launcher',''));
  orderedLauncherNames().forEach(name=>select.add(new Option(name,name)));select.value=selected||'';
}
function openLauncherField(game){
  refreshLauncherSelect(game?.launcher || (!game&&pcCollection()&&state.launcher!=='__none__'?state.launcher:'') || '');
  document.getElementById('f-pc-physical').checked=hasPCBox(game);updateLauncherField();
}
function readLauncherField(){return JTDData.isPC({plateforme:document.getElementById('f-plateforme').value})?document.getElementById('f-launcher').value||null:null;}
function commitLaunchers(meta,order,overrides={}){
  try{
    const data=JTDData.normalizeData({...buildBackupPayload().data,platformMeta:meta,platformOrder:order,...overrides});
    window.persistAppData(data);replaceAppData(data);window.JTDDataChanged?.();buildPlatformList();render();renderArrivals();renderWishlist();refreshLauncherSelect();return true;
  }catch(error){showToast('Enregistrement impossible. '+error.message);return false;}
}
function launcherOrder(names){return [...platformOrder.filter(key=>!isLauncherMetaKey(key)),...names.map(launcherKey)];}
function addLauncher(){
  const input=document.getElementById('new-platform-name'),name=input.value.trim();
  if(!name || name.length>80 || name==='__none__'){window.JTDDialogs.error(input,'Indique un nom de launcher (80 caractères maximum).');return;}
  if(allLauncherNames().some(n=>n.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr'))){window.JTDDialogs.error(input,'Ce launcher existe déjà.');return;}
  if(!commitLaunchers({...platformMeta,[launcherKey(name)]:{color:'#195e70',logo:null}},launcherOrder([...orderedLauncherNames(),name])))return;
  input.value='';setAddPlatformOpen(false);refreshLauncherSelect(name);buildLauncherRows();
}
function buildLauncherRows(){
  const container=document.getElementById('platform-rows');container.replaceChildren();const names=orderedLauncherNames();
  for(const [index,name] of names.entries()){
    const meta=platformMeta[launcherKey(name)]||{color:'#195e70',logo:null},used=[...GAMES,...ARRIVALS,...WISHLIST,...CEMETERY].some(g=>JTDData.isPC(g)&&g.launcher===name);
    const row=document.createElement('div');row.className='platform-row';row.dataset.launcherName=name;
    row.innerHTML='<div class="platform-row-main"><div class="row-order-btns"><button type="button" class="order-btn" data-move="-1" aria-label="Monter '+escapeHTML(name)+'"'+(index===0?' disabled':'')+'>↑</button><button type="button" class="order-btn" data-move="1" aria-label="Descendre '+escapeHTML(name)+'"'+(index===names.length-1?' disabled':'')+'>↓</button></div><div class="swatch-preview">'+(meta.logo?'<img src="'+escapeHTML(safeURL(meta.logo,true))+'" alt="">':escapeHTML(name.slice(0,2).toUpperCase()))+'</div><div class="platform-row-info"><strong class="platform-row-name">'+escapeHTML(name)+'</strong></div><button type="button" class="platform-edit-btn" aria-label="Modifier '+escapeHTML(name)+'">'+contextEditIcon()+'</button></div><div class="platform-row-editor hidden"><div class="platform-editor-topline"><label class="platform-editor-field platform-editor-name"><span>Nom</span><input data-role="name" maxlength="80" value="'+escapeHTML(name)+'"></label><label class="platform-editor-field platform-editor-color"><span>Couleur</span><input type="color" data-role="color" value="'+toHexColor(meta.color)+'"></label></div><label class="platform-editor-field"><span>Image du logo</span><input data-role="logo" placeholder="https://…" value="'+escapeHTML(meta.logo||'')+'"></label><div class="platform-editor-actions">'+(!used?'<button type="button" class="platform-delete-btn">Supprimer</button>':'')+'<div class="platform-editor-spacer"></div><button type="button" class="platform-cancel-btn">Annuler</button><button type="button" class="platform-save-btn">Enregistrer</button></div></div>';
    row.querySelector('.swatch-preview').style.background=meta.color;
    row.querySelector('.platform-edit-btn').onclick=()=>{row.classList.toggle('editing');row.querySelector('.platform-row-editor').classList.toggle('hidden');row.querySelector('[data-role="name"]').focus();};
    row.querySelector('.platform-cancel-btn').onclick=buildLauncherRows;
    row.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{const next=[...names],target=index+Number(button.dataset.move);[next[index],next[target]]=[next[target],next[index]];if(commitLaunchers(platformMeta,launcherOrder(next)))buildLauncherRows();});
    row.querySelector('.platform-save-btn').onclick=()=>{
      const input=row.querySelector('[data-role="name"]'),next=input.value.trim(),logoInput=row.querySelector('[data-role="logo"]'),logo=safeURL(logoInput.value.trim(),true);
      if(!next || next.length>80 || next==='__none__'){window.JTDDialogs.error(input,'Indique un nom de launcher valide.');return;}
      if(names.some(n=>n!==name&&n.toLocaleLowerCase('fr')===next.toLocaleLowerCase('fr'))){window.JTDDialogs.error(input,'Ce launcher existe déjà.');return;}
      if(logoInput.value.trim()&&!logo){window.JTDDialogs.error(logoInput,'Indique une adresse d’image valide.');return;}
      const metadata={...platformMeta};delete metadata[launcherKey(name)];metadata[launcherKey(next)]={color:row.querySelector('[data-role="color"]').value,logo:logo||null};
      const lists={};for(const [key,list] of Object.entries({games:GAMES,arrivals:ARRIVALS,wishlist:WISHLIST,cemetery:CEMETERY}))lists[key]=list.map(g=>JTDData.isPC(g)&&g.launcher===name?{...g,launcher:next}:g);
      if(commitLaunchers(metadata,launcherOrder(names.map(n=>n===name?next:n)),lists)){if(state.launcher===name)state.launcher=next;refreshLauncherSelect(next);buildLauncherRows();buildPlatformList();render();}
    };
    row.querySelector('.platform-delete-btn')?.addEventListener('click',()=>confirmAction('Supprimer le launcher « '+name+' » ?',()=>{const metadata={...platformMeta};delete metadata[launcherKey(name)];if(commitLaunchers(metadata,launcherOrder(names.filter(n=>n!==name)))){if(state.launcher===name)state.launcher=null;buildLauncherRows();buildPlatformList();render();}},{title:'Supprimer le launcher',confirmLabel:'Supprimer'}));
    container.appendChild(row);
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('f-plateforme').addEventListener('change',updateLauncherField);
  document.getElementById('f-launcher').addEventListener('change',()=>setGameSheetViewing(false));
  document.getElementById('f-manage-launchers').onclick=()=>openPlatformModal(true);
  document.getElementById('f-collector').addEventListener('change',()=>{if(JTDData.isPC({plateforme:document.getElementById('f-plateforme').value})&&document.getElementById('f-collector').checked)document.getElementById('f-pc-physical').checked=true;});
  document.getElementById('f-pc-physical').onchange=()=>{if(!document.getElementById('f-pc-physical').checked)document.getElementById('f-collector').checked=false;};
});

function pcPreviewGames(){ return [
  {id:'test-pc-box',nom:'Les Gardiens du phare — Collector démo',plateforme:'PC',format:'Physique',collector:true,launcher:'Steam',prix:89.99},
  {id:'test-pc-box-free',nom:'Le Dernier atelier — Boîte démo',plateforme:'PC',format:'Physique',prix:19.99},
  {id:'test-pc-steam',nom:'La Route des étoiles — démo',plateforme:'PC',format:'Numérique',launcher:'Steam',prix:29.99},
  {id:'test-pc-dlc',nom:'La Route des étoiles — Extension démo',plateforme:'PC',format:'Numérique',launcher:'Steam',contentType:'dlc',parentId:'test-pc-steam',prix:9.99},
  {id:'test-pc-gog',nom:'Mémoires de la forêt — démo',plateforme:'PC',format:'Numérique',launcher:'GOG',prix:14.99},
  {id:'test-pc-epic',nom:'L’Archipel oublié — démo',plateforme:'PC',format:'Numérique',launcher:'Epic Games Store',prix:0},
  {id:'test-pc-xbox',nom:'Les Voyageurs de l’aube — démo',plateforme:'PC',format:'Numérique',launcher:'Xbox app',prix:24.99}
]; }
