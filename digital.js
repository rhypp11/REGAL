/* Console purchases share the existing data/session boundary; no store integrations. */
const DIGITAL_ACCOUNTS_KEY = 'ludotheque:digital-accounts-v1';
let DIGITAL_ACCOUNTS = [];
function digitalPreviewAccounts(){ return [
  {id:'demo-nintendo-eu',name:'Nintendo principal',ecosystem:'Nintendo',region:'Europe',preferred:true},
  {id:'demo-nintendo-jp',name:'Nintendo japonais',ecosystem:'Nintendo',region:'Japon',preferred:false},
  {id:'demo-playstation',name:'PlayStation principal',ecosystem:'PlayStation',region:'Europe',preferred:true}
]; }
function digitalPreviewGames(){ return [
  {id:'test-digital-nintendo',nom:'Les Jardins d’Aster — Numérique démo',plateforme:'Switch 2',format:'Numérique',contentType:'game',accountId:'demo-nintendo-jp',currency:'JPY',prix:6980},
  {id:'test-digital-ps',nom:'Échos de cristal — Numérique démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'game',accountId:'demo-playstation',currency:'EUR',prix:23.99},
  {id:'test-dlc-digital',nom:'Échos de cristal — Extension démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'dlc',parentId:'test-digital-ps',accountId:'demo-playstation',currency:'EUR',prix:12.99},
  {id:'test-dlc-physical',nom:'Fire Emblem — Pass démo',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'test-fe',accountId:'demo-nintendo-eu',currency:'EUR',prix:29.99}
]; }
const MEDIA_ICONS = {
  physical:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="m6 6 2 2m8 8 2 2"/></svg>',
  digital:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg>',
  dlc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h3a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v6h-6a3 3 0 1 0-6 0H3v-6a3 3 0 1 0 0-6V3h5Z"/></svg>'
};
function collectionScope(){
  return JTDData.collectionCards(GAMES,state.media || 'physical',state.media === 'physical' ? null : state.accountId);
}
function accountName(id){ return DIGITAL_ACCOUNTS.find(a => a.id === id)?.name || 'Compte non renseigné'; }
function purchaseMoney(game){
  if(game.prix == null) return '—';
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:game.currency || 'EUR',maximumFractionDigits:(game.currency === 'JPY' ? 0 : 2)}).format(game.prix);
}
function collectionValueLabel(games, euroTotal){
  if((state.media || 'physical') === 'physical') return euroTotal.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €';
  const purchases = new Map(games.map(game=>[game.id,game]));
  for(const game of games) for(const dlc of gameContents(game)){
    if((!state.accountId || dlc.accountId === state.accountId) && JTDData.isDigital(game)) purchases.set(dlc.id,dlc);
  }
  const sums = new Map();
  for(const game of purchases.values()) if(game.prix != null) sums.set(game.currency || 'EUR',(sums.get(game.currency || 'EUR') || 0) + game.prix);
  return [...sums].map(([currency,prix])=>purchaseMoney({prix,currency})).join(' + ') || '—';
}
function renderMediaControls(){
  const controls = document.getElementById('collection-media-tabs');
  for(const button of controls.querySelectorAll('[data-media]')){
    const mode = button.dataset.media;
    button.innerHTML = (MEDIA_ICONS[mode] || '') + '<span>'+({all:'Tout',physical:'Physique',digital:'Numérique'})[mode]+'</span>';
    button.setAttribute('aria-pressed',String((state.media || 'physical') === mode));
  }
  const account = document.getElementById('collection-account');
  account.classList.toggle('hidden',(state.media || 'physical') === 'physical');
  document.getElementById('collection-account-field').classList.toggle('hidden',(state.media || 'physical') === 'physical');
  if(state.media === 'physical') state.accountId = null;
  account.innerHTML = '<option value="">Tous les comptes</option>'+DIGITAL_ACCOUNTS.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML(a.name)+'</option>').join('');
  if(!DIGITAL_ACCOUNTS.some(a=>a.id === state.accountId)) state.accountId = null;
  account.value = state.accountId || '';
}
function collectionFilterLabel(){
  const media = state.media || 'physical';
  const label = ({physical:'Physique',digital:'Numérique',all:'Physique et numérique'})[media];
  return (MEDIA_ICONS[media] || '')+'<span>'+escapeHTML(label+(state.accountId ? ' · '+accountName(state.accountId) : ''))+'</span>';
}
function renderCollectionFilterContext(banner){
  const heading = banner.querySelector('.platform-banner-title')?.parentElement;
  if(!heading) return;
  const context = document.createElement('span');
  context.className = 'collection-filter-context';
  context.innerHTML = collectionFilterLabel();
  heading.appendChild(context);
}
function gameContents(game){
  return GAMES.filter(child => JTDData.contentParent(child,GAMES)?.id === game.id);
}
function decorateDigitalCard(card, game, options){
  if(options.readOnly) return;
  const digital = JTDData.isDigital(game), dlc = JTDData.isDLC(game);
  card.classList.toggle('digital-game',digital);
  card.classList.toggle('dlc-card',dlc);
  card.dataset.media = digital ? 'digital' : 'physical';
  if(dlc){
    card.querySelector('.card-status-control')?.remove();
    const banner = card.querySelector('.card-banner');
    // Keep the supplied artwork, with a visible DLC label even when no image is available.
    banner.insertAdjacentHTML('beforeend','<span class="dlc-label">'+MEDIA_ICONS.dlc+'<span>DLC</span></span>');
    if(!game.image){
      banner.querySelector('.card-fallback')?.remove();
      banner.insertAdjacentHTML('afterbegin','<span class="dlc-placeholder">'+MEDIA_ICONS.dlc+'</span>');
    }
  }
  const body = card.querySelector('.card-body');
  if(state.media === 'all' && !dlc){
    body.querySelector('.card-identity').insertAdjacentHTML('beforeend','<span class="card-media-mark">'+MEDIA_ICONS[digital?'digital':'physical']+'<span>'+(digital?'Numérique':'Physique')+'</span></span>');
  }
  const contents = gameContents(game);
  if(contents.length) body.insertAdjacentHTML('beforeend','<span class="card-dlc-count">'+MEDIA_ICONS.dlc+contents.length+' DLC</span>');
  if(digital){
    body.insertAdjacentHTML('beforeend','<span class="card-console-account">'+escapeHTML(accountName(game.accountId))+'</span>');
    if(!state.sort.startsWith('price-') && !state.sort.startsWith('date-')) body.insertAdjacentHTML('beforeend','<span class="card-digital-price">'+purchaseMoney(game)+'</span>');
    const price = card.querySelector('.card-price');
    if(price) price.textContent = game.prix == null ? 'Non renseigné' : purchaseMoney(game);
  }
}
function commitCollection(games, digitalAccounts = DIGITAL_ACCOUNTS){
  try{
    const next = JTDData.normalizeData({...buildBackupPayload().data,games,digitalAccounts});
    window.persistAppData(next);
    replaceAppData(next);
    window.JTDDataChanged?.();
    return true;
  }catch(error){ console.error('Achat non enregistré',error); showToast('Enregistrement impossible. '+error.message); return false; }
}
function ecosystemFor(platform){
  if(/switch|nintendo|wii|3ds/i.test(platform)) return 'Nintendo';
  if(/playstation|ps[1-5]|vita|psp/i.test(platform)) return 'PlayStation';
  if(/xbox/i.test(platform)) return 'Xbox';
  return 'Autre';
}
function populateDigitalAccounts(selected, chooseDefault = false){
  const ecosystem = ecosystemFor(document.getElementById('f-plateforme').value);
  const accounts = DIGITAL_ACCOUNTS.filter(a=>a.ecosystem === ecosystem || a.id === selected);
  const select = document.getElementById('f-account');
  select.innerHTML = '<option value="">Non renseigné</option>'+accounts.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML(a.name)+'</option>').join('');
  select.value = selected && accounts.some(a=>a.id === selected) ? selected : chooseDefault ? (accounts.find(a=>a.preferred)?.id || accounts[0]?.id || '') : '';
}
function populateParentGames(selected = ''){
  const query = document.getElementById('f-parent-search').value.trim().toLocaleLowerCase('fr');
  const select = document.getElementById('f-parent');
  const candidates = GAMES.filter(g=>g.id !== editingId && !JTDData.isDLC(g) && (g.id === selected || !query || (g.nom+' '+g.plateforme).toLocaleLowerCase('fr').includes(query)));
  select.innerHTML = '<option value="">Aucun pour le moment</option>'+candidates.map(g=>'<option value="'+escapeHTML(g.id)+'">'+escapeHTML(g.nom+' · '+g.plateforme+' · '+(JTDData.isDigital(g)?'Numérique':'Physique'))+'</option>').join('');
  select.value = candidates.some(g=>g.id === selected) ? selected : '';
}
function updateDigitalFields(){
  const digital = document.getElementById('f-media').value === 'digital';
  const dlc = digital && document.getElementById('f-content-type').value === 'dlc';
  document.getElementById('f-content-type-field').classList.toggle('hidden',!digital);
  document.getElementById('f-digital-fields').classList.toggle('hidden',!digital);
  document.getElementById('f-parent-field').classList.toggle('hidden',!dlc);
  document.getElementById('f-price-currency').textContent = digital ? ({EUR:'€',JPY:'¥',USD:'$',GBP:'£'})[document.getElementById('f-currency').value] : '€';
  const owned = GAMES.find(g=>g.id === editingId);
  document.getElementById('f-sell-btn').classList.toggle('hidden',!owned || digital || JTDData.isDigital(owned) || editingCollection !== 'games');
}
function openDigitalFields(game){
  const physicalOnly = editingCollection === 'cemetery' || !!convertingArrivalId;
  const digital = !physicalOnly && (game ? JTDData.isDigital(game) : state.media === 'digital');
  document.getElementById('f-media-section').classList.toggle('hidden',physicalOnly);
  document.getElementById('f-media').value = digital ? 'digital' : 'physical';
  document.getElementById('f-content-type').value = JTDData.isDLC(game) ? 'dlc' : 'game';
  document.getElementById('f-currency').value = game?.currency || 'EUR';
  document.getElementById('f-parent-search').value = '';
  populateDigitalAccounts(game?.accountId || '',!game);
  populateParentGames(game?.parentId || '');
  renderContentDetails(game);
  updateDigitalFields();
}
function readDigitalFields(){
  const digital = editingCollection !== 'cemetery' && !convertingArrivalId && document.getElementById('f-media').value === 'digital';
  if(!digital){
    const original = [...GAMES,...CEMETERY].find(g=>g.id === editingId);
    if(!original || !JTDData.isDigital(original)) return {format:original?.format || 'Physique'};
    return {format:'Physique',contentType:'game',accountId:null,currency:'EUR',parentId:null};
  }
  const dlc = document.getElementById('f-content-type').value === 'dlc';
  const parentId = dlc ? document.getElementById('f-parent').value || null : null;
  const parent = GAMES.find(g=>g.id === parentId);
  if(parentId && (!parent || JTDData.isDLC(parent) || parent.id === editingId || parent.plateforme !== document.getElementById('f-plateforme').value)){
    throw {field:'f-parent',message:'Le jeu associé doit être sur la même plateforme que ce DLC.'};
  }
  const raw = document.getElementById('f-prix').value.trim();
  const currency = document.getElementById('f-currency').value;
  if(raw && (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || !Number.isFinite(Number(raw.replace(',','.'))) || (currency === 'JPY' && !/^\d+$/.test(raw)))){
    throw {field:'f-prix',message:currency === 'JPY'?'Indique un prix en yens sans décimales.':'Indique un prix positif avec deux décimales maximum.'};
  }
  return {format:'Numérique',contentType:dlc?'dlc':'game',parentId,accountId:document.getElementById('f-account').value || null,currency,collector:false,japanese:false};
}
function renderContentDetails(game){
  const container = document.getElementById('f-content-details');
  container.replaceChildren();
  if(!game) return;
  const parent = JTDData.contentParent(game,GAMES);
  const children = gameContents(game);
  const section = document.createElement('section');
  section.className = 'form-section content-purchases';
  const summary = document.createElement('div');
  summary.className = 'content-format-summary';
  summary.innerHTML = MEDIA_ICONS[JTDData.isDLC(game)?'dlc':JTDData.isDigital(game)?'digital':'physical']+'<span>'+(JTDData.isDLC(game)?'Contenu téléchargeable':JTDData.isDigital(game)?'Jeu numérique':'Jeu physique')+(JTDData.isDigital(game)?' · '+escapeHTML(accountName(game.accountId)):'')+'</span>';
  section.appendChild(summary);
  if(parent){
    const button = document.createElement('button');button.type='button';button.className='content-purchase-link';
    button.textContent = 'Jeu associé : '+parent.nom+' · '+(JTDData.isDigital(parent)?'Numérique':'Physique');
    button.onclick=()=>openModal(parent.id);section.appendChild(button);
  }else if(JTDData.isDLC(game)){
    const note = document.createElement('p');note.className='content-parent-note';
    note.textContent = game.parentId ? 'Jeu associé hors de la collection. Ce DLC reste dans ta bibliothèque numérique.' : 'Aucun jeu associé.';
    section.appendChild(note);
  }
  if(children.length){
    const title = document.createElement('div');title.className='form-section-title';title.textContent='Contenus téléchargeables';section.appendChild(title);
    for(const child of children){
      const button = document.createElement('button');button.type='button';button.className='content-purchase-link';
      button.innerHTML = '<span>'+MEDIA_ICONS.dlc+escapeHTML(child.nom)+'<small>'+escapeHTML(accountName(child.accountId))+'</small></span><span>'+purchaseMoney(child)+'</span>';
      button.onclick=()=>openModal(child.id);section.appendChild(button);
    }
    const sums = new Map();
    for(const purchase of [game,...children]) if(purchase.prix != null) sums.set(purchase.currency || 'EUR',(sums.get(purchase.currency || 'EUR') || 0)+purchase.prix);
    const total = document.createElement('div');total.className='content-purchase-total';
    total.textContent = 'Total jeu et DLC : '+[...sums].map(([currency,prix])=>purchaseMoney({currency,prix})).join(' + ');
    section.appendChild(total);
  }
  container.appendChild(section);
}
function editDigitalAccountRow(account = {id:crypto.randomUUID(),name:'',ecosystem:'Nintendo',region:'',preferred:false}){
  const row = document.createElement('div');row.className='digital-account-row';row.dataset.accountId=account.id;
  row.innerHTML = '<div class="field"><label>Nom du compte<input data-field="name" maxlength="80" value="'+escapeHTML(account.name)+'" placeholder="Nintendo japonais"></label></div><div class="field-row"><div class="field"><label>Écosystème<select data-field="ecosystem">'+['Nintendo','PlayStation','Xbox','Autre'].map(e=>'<option'+(e === account.ecosystem?' selected':'')+'>'+e+'</option>').join('')+'</select></label></div><div class="field"><label>Région <span class="optional-label">optionnel</span><input data-field="region" maxlength="80" value="'+escapeHTML(account.region)+'" placeholder="Japon"></label></div></div><div class="digital-account-actions"><label><input type="checkbox" data-field="preferred"'+(account.preferred?' checked':'')+'> Compte par défaut</label><button type="button" class="manage-link digital-account-delete">Supprimer</button></div>';
  row.querySelector('.digital-account-delete').onclick=()=>{
    if([...GAMES,...CEMETERY].some(g=>g.accountId === account.id)){
      document.getElementById('digital-accounts-error').textContent='Ce compte possède des achats. Réaffecte-les avant de le supprimer.';return;
    }
    row.remove();
  };
  document.getElementById('digital-account-rows').appendChild(row);
}
function openDigitalAccounts(){
  document.getElementById('digital-account-rows').replaceChildren();
  document.getElementById('digital-accounts-error').textContent='';
  DIGITAL_ACCOUNTS.forEach(editDigitalAccountRow);
  if(!DIGITAL_ACCOUNTS.length) editDigitalAccountRow();
  window.JTDDialogs.open('digital-accounts-overlay',{onDismiss:closeDigitalAccounts});
}
function closeDigitalAccounts(){window.JTDDialogs.close('digital-accounts-overlay');}
window.closeDigitalAccounts = closeDigitalAccounts;
function initDigitalControls(){
  document.getElementById('collection-media-tabs').addEventListener('click',event=>{
    const button = event.target.closest('[data-media]');if(!button)return;
    state.media=button.dataset.media;state.accountId=null;state.collector=false;state.japanese=false;state.status=null;
    buildPlatformList();buildFormatToggles();buildStatusToggles();render();closeMobileDrawers();
  });
  document.getElementById('collection-account').onchange=event=>{state.accountId=event.target.value || null;buildPlatformList();render();closeMobileDrawers();};
  for(const id of ['f-media','f-content-type','f-currency']) document.getElementById(id).addEventListener('change',()=>{setGameSheetViewing(false);updateDigitalFields();});
  document.getElementById('f-account').addEventListener('change',()=>setGameSheetViewing(false));
  document.getElementById('f-parent-search').oninput=()=>populateParentGames(document.getElementById('f-parent').value);
  document.getElementById('f-parent').onchange=event=>{
    setGameSheetViewing(false);
    const parent=GAMES.find(g=>g.id===event.target.value);if(!parent)return;
    setSelectValueAndSync('f-plateforme',parent.plateforme);
    populateDigitalAccounts(parent.accountId || '',true);
  };
  document.getElementById('f-plateforme').addEventListener('change',()=>populateDigitalAccounts('',true));
  document.getElementById('digital-accounts-btn').onclick=openDigitalAccounts;
  document.getElementById('f-manage-accounts').onclick=openDigitalAccounts;
  document.getElementById('digital-account-add').onclick=()=>editDigitalAccountRow();
  document.getElementById('digital-accounts-cancel').onclick=closeDigitalAccounts;
  document.getElementById('digital-accounts-save').onclick=()=>{
    const accounts=[...document.querySelectorAll('.digital-account-row')].map(row=>({id:row.dataset.accountId,name:row.querySelector('[data-field="name"]').value.trim(),ecosystem:row.querySelector('[data-field="ecosystem"]').value,region:row.querySelector('[data-field="region"]').value.trim(),preferred:row.querySelector('[data-field="preferred"]').checked}));
    const defaults=new Set();
    for(const a of accounts){
      if(!a.name){document.getElementById('digital-accounts-error').textContent='Donne un nom à chaque compte.';return;}
      if(a.preferred && defaults.has(a.ecosystem)){document.getElementById('digital-accounts-error').textContent='Choisis un seul compte par défaut par écosystème.';return;}
      if(a.preferred) defaults.add(a.ecosystem);
    }
    const selected=document.getElementById('f-account').value;
    if(!commitCollection(GAMES,accounts))return;
    closeDigitalAccounts();populateDigitalAccounts(selected,true);buildPlatformList();render();
  };
}
document.addEventListener('DOMContentLoaded',initDigitalControls);
