/* PC is a collection scope, not a second copy of the library. */
const PC_LAUNCHERS = ['Steam','GOG','Epic Games Store','Battle.net','Xbox app','EA app','Ubisoft Connect','Autre'];
function pcPreviewGames(){ return [
  {id:'test-pc-box',nom:'Les Gardiens du phare — Collector PC démo',plateforme:'PC',format:'Physique',collector:true,launcher:'Steam',prix:89.99},
  {id:'test-pc-box-free',nom:'Le Dernier atelier — Boîte PC démo',plateforme:'PC',format:'Physique',prix:19.99},
  {id:'test-pc-steam',nom:'La Route des étoiles — PC démo',plateforme:'PC',format:'Numérique',launcher:'Steam',prix:29.99},
  {id:'test-pc-dlc',nom:'La Route des étoiles — Extension démo',plateforme:'PC',format:'Numérique',launcher:'Steam',contentType:'dlc',parentId:'test-pc-steam',prix:9.99},
  {id:'test-pc-gog',nom:'Mémoires de la forêt — PC démo',plateforme:'PC',format:'Numérique',launcher:'GOG',prix:14.99},
  {id:'test-pc-epic',nom:'L’Archipel oublié — PC démo',plateforme:'PC',format:'Numérique',launcher:'Epic Games Store',prix:0},
  {id:'test-pc-xbox',nom:'Les Voyageurs de l’aube — PC démo',plateforme:'PC',format:'Numérique',launcher:'Xbox app',prix:24.99}
]; }
function pcCollection(){ return state.library === 'pc'; }
function matchesLibrary(game){ return JTDData.isPC(game) === pcCollection(); }
function matchesLauncher(game){ return !pcCollection() || !state.launcher || (game.launcher || '') === (state.launcher === '__none__' ? '' : state.launcher); }
function launcherLabel(value){ return value && value !== '__none__' ? value : 'Sans launcher'; }
function renderLibraryControls(){
  if(pcCollection()) { state.platform=null;state.accountId=null; }
  else state.launcher=null;
  document.querySelectorAll('#collection-library-tabs [data-library]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.library === (state.library || 'consoles'))));
  document.getElementById('collection-platform-label').textContent = pcCollection() ? 'Launchers' : 'Plateformes';
  for(const id of ['sort-platforms-btn','manage-platforms-btn']) document.getElementById(id).classList.toggle('hidden',pcCollection());
}
function buildLauncherList(){
  const scoped = collectionScope();
  const counts = new Map();
  for(const game of scoped){ const key=game.launcher || '__none__'; counts.set(key,(counts.get(key)||0)+1); }
  const container=document.getElementById('platform-list');container.replaceChildren();
  const option=(key,label,count)=>{
    const button=document.createElement('button');button.type='button';button.className='plat-item'+(state.launcher === key ? ' active' : '');
    button.dataset.launcher=key || '';button.setAttribute('aria-pressed',String(state.launcher === key));
    button.innerHTML='<span class="spine-chip" aria-hidden="true"></span><span class="plat-name">'+escapeHTML(label)+'</span><span class="plat-count">'+count+'</span>';
    button.onclick=()=>{state.launcher=state.launcher === key ? null : key;buildPlatformList();render();closeMobileDrawers();};
    container.appendChild(button);
  };
  option(null,'Tous les launchers',scoped.length);
  for(const key of [...counts.keys()].sort((a,b)=>launcherLabel(a).localeCompare(launcherLabel(b),'fr'))) option(key,launcherLabel(key),counts.get(key));
}
function updateLauncherField(){
  const pc=JTDData.isPC({plateforme:document.getElementById('f-plateforme').value});
  document.getElementById('f-launcher-field').classList.toggle('hidden',!pc);
  // PC purchases do not use console accounts; currency remains available.
  document.getElementById('f-account').closest('.field').classList.toggle('hidden',pc);
}
function openLauncherField(game){
  const input=document.getElementById('f-launcher');
  input.value=game?.launcher || (!game && pcCollection() && state.launcher && state.launcher !== '__none__' ? state.launcher : '');
  const names=[...new Set([...PC_LAUNCHERS,...GAMES.filter(JTDData.isPC).map(g=>g.launcher).filter(Boolean)])];
  const list=document.getElementById('pc-launcher-options');list.replaceChildren();
  names.forEach(name=>{const option=document.createElement('option');option.value=name;list.appendChild(option);});
  updateLauncherField();
}
function readLauncherField(){
  return JTDData.isPC({plateforme:document.getElementById('f-plateforme').value}) ? document.getElementById('f-launcher').value.trim() || null : null;
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('collection-library-tabs').onclick=event=>{
    const button=event.target.closest('[data-library]');if(!button || button.dataset.library === state.library)return;
    state.library=button.dataset.library;state.platform=null;state.launcher=null;state.accountId=null;state.contentType=null;
    state.media=pcCollection() ? 'all' : 'physical';state.collector=false;state.japanese=false;state.status=null;state.search='';
    document.getElementById('search-input').value='';
    buildPlatformList();buildFormatToggles();buildStatusToggles();render();
  };
  document.getElementById('f-plateforme').addEventListener('change',updateLauncherField);
  document.getElementById('f-launcher').addEventListener('input',()=>setGameSheetViewing(false));
});
