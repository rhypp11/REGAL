/* Console purchases share the existing data/session boundary; no store integrations. */
const DIGITAL_ACCOUNTS_KEY = 'ludotheque:digital-accounts-v1';
let DIGITAL_ACCOUNTS = [];
function digitalPreviewAccounts(){ return [
  {id:'demo-nintendo-eu',name:'Nintendo principal',nickname:'Aster',ecosystem:'Nintendo',region:'Europe',preferred:true},
  {id:'demo-nintendo-jp',name:'Nintendo japonais',nickname:'Aster JP',ecosystem:'Nintendo',region:'Japon',preferred:false},
  {id:'demo-playstation',name:'PlayStation principal',nickname:'Rivage',ecosystem:'PlayStation',region:'Europe',preferred:true}
]; }
function digitalPreviewGames(){ return [
  {id:'demo-aster-upgrade',nom:'Les Jardins d’Aster — Switch 2 Edition',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'test-digital-nintendo',prix:4.99},
  {id:'test-digital-nintendo',nom:'Les Jardins d’Aster — Numérique démo',plateforme:'Switch',format:'Numérique',contentType:'game',accountId:'demo-nintendo-jp',currency:'JPY',prix:6980},
  {id:'test-digital-ps',nom:'Échos de cristal — Numérique démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'game',accountId:'demo-playstation',currency:'EUR',prix:23.99},
  {id:'test-dlc-digital',nom:'Échos de cristal — Extension démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'dlc',parentId:'test-digital-ps',accountId:'demo-playstation',currency:'EUR',prix:12.99},
  {id:'test-dlc-physical',nom:'Fire Emblem — Pass démo',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',accountId:'demo-nintendo-eu',currency:'EUR',prix:29.99},
  {id:'test-upgrade',nom:'Fire Emblem — Mise à niveau démo',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',accountId:'demo-nintendo-eu',currency:'EUR',prix:9.99}
]; }
const MEDIA_ICONS = {
  bundle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="13" height="11" rx="2"/><path d="M8 10V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3M7 10v4h5v-4"/></svg>',
  game:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 7h9a4 4 0 0 1 3.9 3.2l1.1 5a2.3 2.3 0 0 1-3.8 2.2l-2.6-2.4H8.9l-2.6 2.4a2.3 2.3 0 0 1-3.8-2.2l1.1-5A4 4 0 0 1 7.5 7Z"/><path d="M8 9.5v4m-2-2h4m6 0h.01m2-2h.01"/></svg>',
  all:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  upgrade:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 17V7m-4 4 4-4 4 4"/></svg>',
  physical:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="m6 6 2 2m8 8 2 2"/></svg>',
  digital:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg>',
  dlc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h3a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v6h-6a3 3 0 1 0-6 0H3v-6a3 3 0 1 0 0-6V3h5Z"/></svg>'
};
function selectedContentTypes(value = state.contentType){
  return [...new Set(String(value || '').split(',').filter(type => ['game','dlc','upgrade'].includes(type)))];
}
function contentFilterLabel(types = selectedContentTypes()){
  return types.map(type => ({game:'Jeux',dlc:'DLC',upgrade:'Mises à niveau'})[type]).join(', ');
}
function isPlayablePurchase(game){
  return !(JTDData.isDigital(game) && game.contentType === 'upgrade');
}
function matchesCollectionStatus(game){
  if(!state.status) return true;
  const status = getEffectiveStatus(game);
  return isPlayablePurchase(game) && (state.status === '__none__' ? !status : status === state.status);
}
// Count purchases represented by the cards, including only children actually grouped here.
function collectionPurchases(cards, {ignorePlatform = false, search = state.search || ''} = {}){
  const purchases = new Map(cards.map(game => [game.id,game]));
  const types = selectedContentTypes();
  if(types.length) return [...purchases.values()];
  const query = JTDData.searchKey(search.trim());
  for(const game of cards){
    if(!JTDData.isDigital(game)) continue;
    for(const child of gameContents(game)){
      const platform = JTDData.effectivePlatform(child,GAMES);
      if(!matchesCollectionVersion(child)) continue;
      if(!ignorePlatform && state.platform && platform !== state.platform) continue;
      if(types.length && !types.includes(child.contentType)) continue;
      if(!matchesCollectionStatus(child)) continue;
      if(query && !JTDData.searchKey(game.nom).includes(query) && !JTDData.searchKey(child.nom).includes(query)) continue;
      purchases.set(child.id,{...child,plateforme:platform});
    }
  }
  return [...purchases.values()];
}
function collectionPlayablePurchases(cards){
  return collectionPurchases(cards).filter(isPlayablePurchase);
}
function collectionScope(){
  const search = state.search || '';
  return collectionPurchases(collectionCardsForFilters(search),{ignorePlatform:true,search});
}
function collectionCardsForFilters(search = ''){
  const types=selectedContentTypes();
  const source = types.length ? GAMES.filter(g=>types.includes(g.contentType || 'game')) : GAMES;
  return JTDData.collectionCards(source.filter(game=>matchesCollectionStatus(game) && matchesCollectionVersion(game)),state.media || 'physical',null,search,!types.length)
    .map(game => ({...game,plateforme:JTDData.effectivePlatform(game,GAMES)}));
}
function contentKind(game){ return game?.contentType === 'upgrade' ? 'Mise à niveau' : 'DLC'; }
function contentIcon(game){ return MEDIA_ICONS[game?.contentType === 'upgrade' ? 'upgrade' : 'dlc']; }
function purchaseMoney(game){
  if(game.prix == null) return '—';
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:game.currency || 'EUR',maximumFractionDigits:(game.currency === 'JPY' ? 0 : 2)}).format(game.prix);
}
function collectionValueLabel(games, euroTotal){
  if((state.media || 'physical') === 'physical') return '<span class="currency-total">'+euroTotal.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €</span>';
  const purchases = collectionPurchases(games);
  const sums = new Map();
  for(const game of purchases) if(game.prix != null) sums.set(game.currency || 'EUR',(sums.get(game.currency || 'EUR') || 0) + game.prix);
  return [...sums].map(([currency,prix])=>'<span class="currency-total">'+escapeHTML(purchaseMoney({prix,currency}))+'</span>').join('') || '—';
}
function renderMediaControls(){
  const controls = document.getElementById('collection-media-tabs');
  for(const button of controls.querySelectorAll('[data-media]')){
    const mode = button.dataset.media;
    button.innerHTML = MEDIA_ICONS[mode]+'<span>'+({all:'Tout',physical:'Physique',digital:'Numérique'})[mode]+'</span>';
    button.setAttribute('aria-pressed',String((state.media || 'physical') === mode));
  }
  const digital = state.media !== 'physical';
  document.getElementById('content-filter-section').classList.toggle('hidden',!digital);
  if(!digital) state.contentType = null;
  document.getElementById('content-type-options').innerHTML = [['game','Jeu'],['dlc','DLC'],['upgrade','Mise à niveau']].map(([value,label])=>'<button type="button" class="toggle-chip" data-content-type="'+value+'" aria-pressed="'+selectedContentTypes().includes(value)+'">'+(MEDIA_ICONS[value] || '')+'<span>'+label+'</span></button>').join('');
}
function collectionFilterLabel(){
  const media = state.media || 'physical';
  const label = ({physical:'Physique',digital:'Numérique',all:'Tous les formats'})[media];
  return (MEDIA_ICONS[media] || '')+'<span>'+escapeHTML(label+(state.contentType ? ' · '+contentFilterLabel() : ''))+'</span>';
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
  const digital = JTDData.isDigital(game), dlc = JTDData.isAddon(game);
  card.classList.toggle('digital-game',digital);
  card.classList.toggle('dlc-card',dlc);
  card.classList.toggle('upgrade-card',digital && game.contentType === 'upgrade');
  card.dataset.media = digital ? 'digital' : 'physical';
  if(dlc){
    if(game.contentType==='upgrade')card.querySelector('.card-status-control')?.remove();
    const banner = card.querySelector('.card-banner');
    // Keep the supplied artwork, with a visible DLC label even when no image is available.
    banner.insertAdjacentHTML('beforeend','<span class="dlc-label" title="'+escapeHTML(contentKind(game))+'">'+contentIcon(game)+'<span>'+contentKind(game)+'</span></span>');
    if(!game.image){
      banner.classList.remove('placeholder');
      banner.querySelector('.card-fallback')?.remove();
      banner.insertAdjacentHTML('afterbegin','<span class="dlc-placeholder">'+contentIcon(game)+'</span>');
    }
  }
  const body = card.querySelector('.card-body');
  if(state.media === 'all' || collectionView !== 'gallery'){
    body.querySelector('.card-identity').insertAdjacentHTML('beforeend','<span class="card-media-mark"><span>'+(digital?'Numérique':'Physique')+'</span></span>');
  }
  const contents = gameContents(game).filter(JTDData.isDLC);
  if(contents.length) body.insertAdjacentHTML('beforeend','<span class="card-dlc-count">'+MEDIA_ICONS.dlc+contents.length+' DLC'+'</span>');
  if(digital){
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
function populateParentGames(selected){
  const value=document.getElementById('f-parent');
  if(selected!==undefined)value.value=GAMES.some(g=>g.id===selected && JTDData.isDigital(g) && !JTDData.isAddon(g)) ? selected : '';
  const query=JTDData.foldImport(document.getElementById('f-parent-search').value);
  const results=document.getElementById('f-parent-results');results.replaceChildren();
  const candidates=query ? GAMES.filter(g=>g.id!==editingId && JTDData.isDigital(g) && !JTDData.isAddon(g)
    && (document.getElementById('f-content-type').value !== 'upgrade' || /^(?:Nintendo )?Switch(?: [12])?$/i.test(g.plateforme)) && JTDData.foldImport(g.nom+' '+g.plateforme).includes(query)) : [];
  document.getElementById('f-parent-search-status').textContent=!query ? (value.value ? '' : 'Recherche un jeu numérique de ta collection.') : !candidates.length ? 'Aucun jeu trouvé. Essaie un autre mot du titre.' : candidates.length>30 ? '30 premiers résultats. Précise la recherche pour affiner.' : candidates.length+' jeu(x) trouvé(s).';
  for(const game of candidates.slice(0,30)){
    const button=document.createElement('button');button.type='button';button.className='parent-search-result';button.dataset.parentId=game.id;
    button.innerHTML=relatedGameHtml(game);
    button.onclick=()=>{value.value=game.id;value.dispatchEvent(new Event('change'));document.getElementById('f-parent-search').value='';populateParentGames();document.getElementById('f-parent-clear').focus();};results.appendChild(button);
  }
  renderParentPreview();
}
function updateParentAttachment(){
  const enabled=document.getElementById('f-parent-enabled').checked;
  document.getElementById('f-parent-editor').classList.toggle('hidden',!enabled);
  document.getElementById('f-parent-enabled').setAttribute('aria-expanded',String(enabled));
}
function relatedGameHtml(game){
  game = purchaseArtwork(game,true);
  const art=purchaseArtwork(game,true);
  return '<span class="content-related-thumb'+gameImageClass(art)+'">'+(art.image?gameImageHtml(art):'<span>'+escapeHTML(game.plateforme.slice(0,2).toUpperCase())+'</span>')+'</span><span class="content-related-copy"><strong>'+escapeHTML(game.nom)+'</strong><small>'+escapeHTML(JTDData.effectivePlatform(game,GAMES)+' · '+(JTDData.isAddon(game)?contentKind(game):JTDData.isDigital(game)?'Numérique':'Physique'))+'</small></span>';
}
function renderParentPreview(){
  const parent = GAMES.find(g=>g.id === document.getElementById('f-parent').value);
  const container = document.getElementById('f-parent-preview');
  container.innerHTML = parent ? relatedGameHtml(parent) : 'Aucun jeu associé';
  container.classList.toggle('content-related-card',!!parent);
  updatePurchaseChangeNote();
  document.getElementById('f-parent-clear').classList.toggle('hidden',!parent);
}
function updatePurchaseChangeNote(){
  const owned = GAMES.find(game => game.id === editingId);
  const digital = document.getElementById('f-media').value === 'digital';
  const linked = digital && ['dlc','upgrade'].includes(document.getElementById('f-content-type').value)
    && document.getElementById('f-parent-enabled').checked;
  const parentId = linked ? document.getElementById('f-parent').value : '';
  const changes = [];
  if(owned?.parentId && parentId !== owned.parentId){
    changes.push(parentId ? 'Le jeu de base sera remplacé.' : 'Le rattachement au jeu de base sera retiré.');
  }
  const parent = GAMES.find(game => game.id === parentId);
  if(parent && !JTDData.canAttachContent({
    id:editingId, format:'Numérique', contentType:document.getElementById('f-content-type').value,
    plateforme:document.getElementById('f-plateforme').value
  },parent)) changes.push('Le jeu de base est incompatible avec cette plateforme. Choisis un autre jeu ou retire le rattachement.');
  const note = document.getElementById('f-purchase-change-note');
  note.textContent = changes.join(' ');
  note.classList.toggle('hidden',!changes.length);
}

function updateDigitalFields(){
  const digital = document.getElementById('f-media').value === 'digital';
  document.getElementById('f-editor-format-title').innerHTML = MEDIA_ICONS[digital?'digital':'physical']+'<span>'+(digital?'Numérique':'Physique')+'</span>';
  document.querySelectorAll('[name="f-media-choice"]').forEach(input=>{input.checked=input.value===(digital?'digital':'physical');});
  const dlc = digital && ['dlc','upgrade'].includes(document.getElementById('f-content-type').value);
  const upgrade = document.getElementById('f-content-type').value === 'upgrade';
  if(dlc) document.getElementById('f-editor-format-title').innerHTML = MEDIA_ICONS[upgrade?'upgrade':'dlc']+'<span>'+(upgrade?'Mise à niveau · Switch 2 Edition':'DLC')+'</span>';
  document.querySelector('label[for="f-nom"]').textContent = dlc ? 'Nom du contenu' : 'Nom du jeu';
  document.getElementById('game-sheet-purchase-title').textContent = dlc || !editingId || editingCollection !== 'games' ? 'Achat' : 'Jeu';
  if(!convertingArrivalId && editingCollection !== 'cemetery'){
    const title = document.getElementById('modal-title');
    title.textContent = editingId ? document.getElementById('f-nom').value : dlc ? (upgrade?'Ajouter une mise à niveau':'Ajouter un DLC') : 'Ajouter un jeu';
  }
  document.getElementById('f-edition-options').classList.toggle('hidden',digital);
  document.getElementById('f-digital-fields').classList.toggle('hidden',!dlc);
  document.getElementById('f-source-field').classList.toggle('hidden',digital);
  document.getElementById('f-purchase-digital-fields').classList.toggle('hidden',!digital);
  document.getElementById('f-digital-version-options').classList.toggle('hidden',!digital);
  document.getElementById('f-parent-field').classList.toggle('hidden',!dlc);
  document.getElementById('f-content-status-field').classList.toggle('hidden',!digital || upgrade || !dlc);
  populateParentGames();
  document.getElementById('f-price-currency').textContent = digital ? ({EUR:'€',JPY:'¥',USD:'$',GBP:'£'})[document.getElementById('f-currency').value] : '€';
}
function openDigitalFields(game, content){
  const physicalOnly = editingCollection === 'cemetery' || !!convertingArrivalId;
  const digital = !physicalOnly && (game ? JTDData.isDigital(game) : !!content || state.media === 'digital');
  document.getElementById('f-media').value = digital ? 'digital' : 'physical';
  const types = selectedContentTypes();
  const newContentType = digital && types.length === 1 ? types[0] : 'game';
  document.getElementById('f-content-type').value = game ? (JTDData.isAddon(game) ? game.contentType : 'game') : content?.kind || newContentType;
  document.getElementById('f-media-field').classList.toggle('hidden',physicalOnly || (!game && digital && document.getElementById('f-content-type').value !== 'game'));
  document.getElementById('f-currency').value = game?.currency || 'EUR';
  document.getElementById('f-content-status').innerHTML='<option value="">Non défini</option>'+STATUS_OPTIONS.map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('');
  document.getElementById('f-content-status').value=game ? (game.status==='en_cours'?'a_jouer':game.status) || '' : '';
  document.getElementById('f-content-status').disabled=!!window.getLinkedJournalCompletion?.(game?.id);
  document.getElementById('f-parent-search').value = '';
  document.getElementById('f-parent-enabled').checked=!!(content?.parentId || JTDData.contentParent(game,GAMES));
  updateParentAttachment();
  document.getElementById('f-digital-version-options').open = false;
  document.getElementById('f-japanese-account').checked = game?.japaneseAccount === true;
  document.getElementById('f-bundle').checked = game?.bundle === true;
  populateParentGames(game?.parentId || content?.parentId || '');
  if(content) setCollectionContentPlatform(content.platform);
  renderContentDetails(game);
  updateDigitalFields();
}
function readDigitalFields(){
  const digital = editingCollection !== 'cemetery' && !convertingArrivalId && document.getElementById('f-media').value === 'digital';
  if(!digital){
    const original = [...GAMES,...CEMETERY].find(g=>g.id === editingId);
    if(!original || !JTDData.isDigital(original)) return {format:original?.format || 'Physique'};
    return {format:'Physique',contentType:'game',accountId:null,currency:'EUR',parentId:null,japaneseAccount:false,bundle:false};
  }
  const kind = document.getElementById('f-content-type').value;
  const dlc = ['dlc','upgrade'].includes(kind);
  const parentId = dlc && document.getElementById('f-parent-enabled').checked ? document.getElementById('f-parent').value || null : null;
  const parent = GAMES.find(g=>g.id === parentId);
  if(parentId && !JTDData.canAttachContent({id:editingId,format:'Numérique',contentType:kind,plateforme:document.getElementById('f-plateforme').value},parent)){
    throw {field:'f-parent-search',message:'Choisis un jeu sur la même plateforme, ou un jeu Switch pour sa mise à niveau Switch 2.'};
  }
  const raw = document.getElementById('f-prix').value.trim();
  const currency = document.getElementById('f-currency').value;
  if(raw && (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || !Number.isFinite(Number(raw.replace(',','.'))) || (currency === 'JPY' && !/^\d+$/.test(raw)))){
    throw {field:'f-prix',message:currency === 'JPY'?'Indique un prix en yens sans décimales.':'Indique un prix positif avec deux décimales maximum.'};
  }
  return {format:'Numérique',contentType:dlc?kind:'game',parentId,currency,collector:false,japanese:false,japaneseAccount:document.getElementById('f-japanese-account').checked,bundle:document.getElementById('f-bundle').checked,...(kind==='dlc'?{status:document.getElementById('f-content-status').value || null}:kind==='upgrade'?{status:null}:{})};
}
function renderGameSheetStatus(game){
  const section = document.getElementById('f-sheet-status');
  section.replaceChildren();
  if(!game || !isPlayablePurchase(game)) return;
  const status = STATUS_OPTIONS.find(option => option.key === getEffectiveStatus(game));
  const completion = window.getLinkedJournalCompletion?.(game.id);
  const heading = document.createElement('h3');
  heading.className = 'form-section-title';
  heading.textContent = 'Statut';
  const badge = document.createElement('span');
  badge.className = 'game-sheet-status';
  badge.style.setProperty('--status-color',status?.color || 'var(--ui-text-muted)');
  badge.style.setProperty('--status-fill',status?.fill || 'var(--ui-border)');
  badge.innerHTML = (status?.icon || '') + escapeHTML(status?.label || 'Sans statut');
  const card = document.createElement('div');
  card.className = 'game-status-panel';
  card.append(badge);
  section.append(heading,card);
  if(completion){
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'manage-link';
    link.innerHTML = document.querySelector('.nav-tab[data-page="journal"] svg')?.outerHTML || '';
    link.append('Voir dans le Journal');
    link.onclick = () => {closeModal();window.openJournalEntry(completion.id);};
    const summary = document.createElement('dl');
    summary.className = 'game-status-completion';
    summary.innerHTML = [
      ['Type de complétion',completion.result], ['Date de complétion',completion.date]
    ].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('');
    card.append(link,summary);
  }
}
function renderContentDetails(game){
  const container = document.getElementById('f-content-details');
  container.replaceChildren();
  if(!game) return;
  const parent = JTDData.contentParent(game,GAMES);
  const children = gameContents(game);
  const section = document.createElement('section');
  section.className = 'content-purchases';
  if(game.dekuNote){const note=document.createElement('p');note.className='content-parent-note';note.textContent='Note Deku Deals : '+game.dekuNote;section.appendChild(note);}
  if(parent){
    const title = document.createElement('h3');title.className='form-section-title';title.textContent='Fait partie de';section.appendChild(title);
    const button = document.createElement('button');button.type='button';button.className='content-purchase-link content-base-link';
    button.innerHTML = '<span class="content-related-identity">'+relatedGameHtml(parent)+'</span>';
    button.onclick=()=>withBoardEditorChanges('modal-overlay','f',()=>openModal(parent.id));section.appendChild(button);
  }
  if(children.length){
    const title = document.createElement('h3');title.className='form-section-title';title.textContent='DLC et mises à niveau';section.appendChild(title);
    for(const child of children){
      const button = document.createElement('button');button.type='button';button.className='content-purchase-link content-addon-link content-type-'+child.contentType;
      const status=JTDData.isDLC(child)?STATUS_OPTIONS.find(s=>s.key===getEffectiveStatus(child)):null;
      const art=purchaseArtwork(child,true);
      const thumb='<span class="content-related-thumb'+gameImageClass(art)+'">'+(art.image?gameImageHtml(art):'<span>'+escapeHTML(child.plateforme.slice(0,2).toUpperCase())+'</span>')+'</span>';
      button.innerHTML=thumb+
        '<span class="content-related-copy"><strong>'+escapeHTML(child.nom)+'</strong>'+
        '<span class="content-related-meta"><span class="content-kind-label"><span class="content-kind-icon" aria-hidden="true">'+contentIcon(child)+'</span>'+contentKind(child)+'</span>'+
        '<span>'+escapeHTML(child.plateforme)+'</span>'+
        (status?'<span class="content-dlc-status">'+escapeHTML(status.label)+'</span>':'')+'</span></span>'+
        (child.prix != null?'<span class="content-related-price">'+escapeHTML(purchaseMoney(child))+'</span>':'')+
        '<svg class="content-row-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
      button.onclick=()=>withBoardEditorChanges('modal-overlay','f',()=>openModal(child.id));section.appendChild(button);
    }
    const sums = new Map();
    for(const purchase of [game,...children]) if(purchase.prix != null) sums.set(purchase.currency || 'EUR',(sums.get(purchase.currency || 'EUR') || 0)+purchase.prix);
    const total = document.createElement('div');total.className='content-purchase-total';
    total.textContent = 'Total jeu et contenus : '+[...sums].map(([currency,prix])=>purchaseMoney({currency,prix})).join(' + ');
    if(sums.size) section.appendChild(total);
  }
  if(section.childNodes.length) container.appendChild(section);
}
function isSwitchUpgradeParent(game){
  return /^(?:Nintendo )?Switch(?: [12])?$/i.test(game.plateforme);
}
function collectionContentPlatform(parent, kind){
  if(kind === 'dlc' || /^(?:Nintendo )?Switch 2$/i.test(parent.plateforme)) return parent.plateforme;
  return allPlatformNames().find(platform => /^(?:Nintendo )?Switch 2$/i.test(platform)) || 'Switch 2';
}
function setCollectionContentPlatform(platform){
  if(!platform) return;
  const select = document.getElementById('f-plateforme');
  if(![...select.options].some(option => option.value === platform)) select.add(new Option(platform,platform));
  setSelectValueAndSync('f-plateforme',platform);
}
function openCollectionContent(game, kind){
  const digital = JTDData.isDigital(game);
  const content = {kind, parentId:digital ? game.id : null, platform:collectionContentPlatform(game,kind)};
  const overlay = 'collection-content-overlay';
  const close = () => window.JTDDialogs.close(overlay);
  const create = () => {close();openModal(null,'games',content);};
  if(!digital){create();return;}
  const search = document.getElementById('collection-content-search');
  const results = document.getElementById('collection-content-results');
  const empty = document.getElementById('collection-content-empty');
  const add = document.getElementById('collection-content-create');
  document.getElementById('collection-content-title').textContent = kind === 'dlc' ? 'Ajouter ou rattacher un DLC' : 'Ajouter ou rattacher une mise à niveau';
  add.textContent = kind === 'dlc' ? 'Créer un DLC' : 'Créer une mise à niveau';
  add.onclick = create;
  document.getElementById('collection-content-cancel').onclick = close;
  search.value = '';
  function renderCandidates(){
    const query = JTDData.foldImport(search.value);
    const candidates = GAMES.filter(child => child.contentType === kind && !JTDData.contentParent(child,GAMES)
      && JTDData.canAttachContent(child,game) && JTDData.foldImport(child.nom).includes(query));
    results.replaceChildren();
    for(const child of candidates.slice(0,30)){
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'parent-search-result';
      button.innerHTML = relatedGameHtml(child);
      button.onclick = () => {
        const parent = GAMES.find(item => item.id === game.id);
        const candidate = GAMES.find(item => item.id === child.id);
        if(!JTDData.canAttachContent(candidate,parent) || JTDData.contentParent(candidate,GAMES)){
          renderCandidates();
          return;
        }
        if(!commitCollection(GAMES.map(item => item.id === child.id ? {...item,parentId:game.id} : item))) return;
        close();
        openModal(game.id);
        buildPlatformList();
        render();
        showToast('Contenu rattaché.');
      };
      results.append(button);
    }
    empty.textContent = candidates.length ? '' : 'Aucun contenu compatible à rattacher.';
  }
  search.oninput = renderCandidates;
  renderCandidates();
  window.JTDDialogs.open(overlay,{onDismiss:close,initialFocus:'#collection-content-search'});
}

function initDigitalControls(){
  document.querySelectorAll('[data-format-icon]').forEach(element=>{element.innerHTML=MEDIA_ICONS[element.dataset.formatIcon];});
  document.querySelectorAll('[name="f-media-choice"]').forEach(input=>input.addEventListener('change',()=>{
    if(!input.checked)return;
    const select=document.getElementById('f-media');select.value=input.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }));
  document.getElementById('collection-media-tabs').addEventListener('click',event=>{
    const button = event.target.closest('[data-media]');if(!button)return;
    if(state.media === button.dataset.media){ closeMobileDrawers(); return; }
    state.media = button.dataset.media;
    if(state.media === 'physical'){ state.contentType = null; state.bundle = false; }
    if(state.media === 'digital') state.collector = false;
    persistNavigation(true);
    buildPlatformList();buildFormatToggles();buildStatusToggles();render();closeMobileDrawers();
  });
  document.getElementById('content-type-options').onclick=event=>{
    const button=event.target.closest('[data-content-type]');if(!button)return;
    const types=new Set(selectedContentTypes());
    const type=button.dataset.contentType;types.has(type) ? types.delete(type) : types.add(type);
    state.contentType=[...types].join(',') || null;buildPlatformList();render();
  };
  for(const id of ['f-media','f-currency']) document.getElementById(id).addEventListener('change',()=>{setGameSheetViewing(false);updateDigitalFields();});
  document.getElementById('f-parent-enabled').onchange=()=>{
    setGameSheetViewing(false);
    updateParentAttachment();
    updatePurchaseChangeNote();
    if(document.getElementById('f-parent-enabled').checked)document.getElementById('f-parent-search').focus();
  };
  document.getElementById('f-parent-search').oninput=()=>populateParentGames();
  document.getElementById('f-parent-clear').onclick=()=>{setGameSheetViewing(false);document.getElementById('f-parent').value='';populateParentGames();document.getElementById('f-parent-search').focus();};
  document.getElementById('f-parent').onchange=event=>{
    setGameSheetViewing(false);
    const parent=GAMES.find(g=>g.id===event.target.value);if(!parent)return;
    const upgrade = document.getElementById('f-content-type').value === 'upgrade';
    setCollectionContentPlatform(collectionContentPlatform(parent, upgrade ? 'upgrade' : 'dlc'));
    renderParentPreview();
  };
  document.getElementById('f-plateforme').addEventListener('change',renderParentPreview);
}
document.addEventListener('DOMContentLoaded',initDigitalControls);


