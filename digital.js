/* Console purchases share the existing data/session boundary; no store integrations. */
const DIGITAL_ACCOUNTS_KEY = 'ludotheque:digital-accounts-v1';
let DIGITAL_ACCOUNTS = [];
function digitalPreviewAccounts(){ return [
  {id:'demo-nintendo-eu',name:'Nintendo principal',nickname:'Aster',ecosystem:'Nintendo',region:'Europe',preferred:true},
  {id:'demo-nintendo-jp',name:'Nintendo japonais',nickname:'Aster JP',ecosystem:'Nintendo',region:'Japon',preferred:false},
  {id:'demo-playstation',name:'PlayStation principal',nickname:'Rivage',ecosystem:'PlayStation',region:'Europe',preferred:true}
]; }
function digitalPreviewGames(){ return [
  {id:'test-digital-nintendo',nom:'Les Jardins d’Aster — Numérique démo',plateforme:'Switch 2',format:'Numérique',contentType:'game',accountId:'demo-nintendo-jp',currency:'JPY',prix:6980},
  {id:'test-digital-ps',nom:'Échos de cristal — Numérique démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'game',accountId:'demo-playstation',currency:'EUR',prix:23.99},
  {id:'test-dlc-digital',nom:'Échos de cristal — Extension démo',plateforme:'PlayStation 5',format:'Numérique',contentType:'dlc',parentId:'test-digital-ps',accountId:'demo-playstation',currency:'EUR',prix:12.99},
  {id:'test-dlc-physical',nom:'Fire Emblem — Pass démo',plateforme:'Switch 2',format:'Numérique',contentType:'dlc',parentId:'test-fe',accountId:'demo-nintendo-eu',currency:'EUR',prix:29.99},
  {id:'test-upgrade',nom:'Fire Emblem — Mise à niveau démo',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'test-fe',accountId:'demo-nintendo-eu',currency:'EUR',prix:9.99}
]; }
const MEDIA_ICONS = {
  all:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  upgrade:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 17V7m-4 4 4-4 4 4"/></svg>',
  physical:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="m6 6 2 2m8 8 2 2"/></svg>',
  digital:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg>',
  dlc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h3a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v6h-6a3 3 0 1 0-6 0H3v-6a3 3 0 1 0 0-6V3h5Z"/></svg>'
};
function selectedContentTypes(value=state.contentType){ return [...new Set(String(value || '').split(',').filter(type=>['game','dlc','upgrade'].includes(type)))]; }
function contentFilterLabel(){ return selectedContentTypes().map(type=>({game:'Jeux',dlc:'DLC',upgrade:'Mises à niveau'})[type]).join(', '); }
function collectionScope(){
  return collectionCardsForFilters();
}
function collectionCardsForFilters(search = ''){
  const types=selectedContentTypes();
  const source = types.length ? GAMES.filter(g=>types.includes(g.contentType || 'game')) : GAMES;
  return JTDData.collectionCards(source,state.media || 'physical',state.media === 'physical' ? null : state.accountId,search);
}
function accountName(id){ const account = DIGITAL_ACCOUNTS.find(a => a.id === id); return account?.nickname || account?.name || 'Compte non renseigné'; }
function accountIdentityHtml(account, showName = true){
  const name = account?.nickname || account?.name || 'Compte non renseigné';
  const initials = name.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase();
  const avatar = safeURL(account?.avatar,true);
  return '<span class="console-account-identity" title="'+escapeHTML(name)+'"><span class="console-avatar" aria-hidden="true">'+escapeHTML(initials)+(avatar?'<img src="'+escapeHTML(avatar)+'" alt="" loading="lazy">':'')+'</span>'+(showName?'<span class="console-account-name">'+escapeHTML(name)+'</span>':'')+'</span>';
}
function contentKind(game){ return game?.contentType === 'upgrade' ? 'Mise à niveau' : 'DLC'; }
function contentIcon(game){ return MEDIA_ICONS[game?.contentType === 'upgrade' ? 'upgrade' : 'dlc']; }
function bindAvatarFallbacks(root){root.querySelectorAll('.console-avatar img').forEach(img=>{img.onerror=()=>img.remove();});}
function purchaseMoney(game){
  if(game.prix == null) return '—';
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:game.currency || 'EUR',maximumFractionDigits:(game.currency === 'JPY' ? 0 : 2)}).format(game.prix);
}
function collectionValueLabel(games, euroTotal){
  if((state.media || 'physical') === 'physical') return '<span class="currency-total">'+euroTotal.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €</span>';
  const purchases = new Map(games.map(game=>[game.id,game]));
  for(const game of games) for(const dlc of gameContents(game)){
    if((!state.accountId || dlc.accountId === state.accountId) && (!state.platform || dlc.plateforme === state.platform) && JTDData.isDigital(game)) purchases.set(dlc.id,dlc);
  }
  const sums = new Map();
  for(const game of purchases.values()) if(game.prix != null) sums.set(game.currency || 'EUR',(sums.get(game.currency || 'EUR') || 0) + game.prix);
  return [...sums].map(([currency,prix])=>'<span class="currency-total">'+escapeHTML(purchaseMoney({prix,currency}))+'</span>').join('') || '—';
}
function accountEcosystemLabel(ecosystem){
  return ({Nintendo:'Compte Nintendo · Switch / Switch 2','Nintendo Network':'Nintendo Network · Wii U / Nintendo 3DS',PlayStation:'PlayStation · PS4 / PS5',Xbox:'Xbox'})[ecosystem] || ecosystem;
}
function renderMediaControls(){
  const controls = document.getElementById('collection-media-tabs');
  for(const button of controls.querySelectorAll('[data-media]')){
    const mode = button.dataset.media;
    button.innerHTML = MEDIA_ICONS[mode]+'<span>'+({all:'Tout',physical:'Physique',digital:'Numérique'})[mode]+'</span>';
    button.setAttribute('aria-pressed',String((state.media || 'physical') === mode));
  }
  const digital = state.media !== 'physical';
  document.getElementById('collection-account-field').classList.toggle('hidden',!digital);
  document.getElementById('content-filter-section').classList.toggle('hidden',!digital);
  document.getElementById('collector-filter-section').classList.toggle('hidden',state.media === 'digital');
  if(!digital) state.contentType = null;
  document.getElementById('content-type-options').innerHTML = [['game','Jeux'],['dlc','DLC'],['upgrade','Mises à niveau']].map(([value,label])=>'<button type="button" class="toggle-chip" data-content-type="'+value+'" aria-pressed="'+selectedContentTypes().includes(value)+'">'+(MEDIA_ICONS[value] || '')+'<span>'+label+'</span></button>').join('');
  const account = document.getElementById('collection-account');
  account.classList.add('hidden');
  if(state.media === 'physical') state.accountId = null;
  account.innerHTML = '<option value="">Tous les comptes</option>'+DIGITAL_ACCOUNTS.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML(a.name)+'</option>').join('');
  if(!DIGITAL_ACCOUNTS.some(a=>a.id === state.accountId)) state.accountId = null;
  account.value = state.accountId || '';
  const current = DIGITAL_ACCOUNTS.find(a=>a.id === state.accountId);
  document.getElementById('collection-account-summary').innerHTML = current ? accountIdentityHtml(current) : '<span class="account-all-icon">'+MEDIA_ICONS.digital+'</span><span>Tous les comptes</span>';
  const list = document.getElementById('collection-account-options');
  list.innerHTML = '<button type="button" class="console-account-option" data-account="" aria-pressed="'+(!state.accountId)+'">Tous les comptes</button>'+DIGITAL_ACCOUNTS.map(a=>'<button type="button" class="console-account-option" data-account="'+escapeHTML(a.id)+'" aria-pressed="'+(a.id === state.accountId)+'">'+accountIdentityHtml(a)+'</button>').join('');
  bindAvatarFallbacks(list);
  bindAvatarFallbacks(document.getElementById('collection-account-summary'));
}
function collectionFilterLabel(){
  const media = state.media || 'physical';
  const label = ({physical:'Physique',digital:'Numérique',all:'Physique et numérique'})[media];
  return (MEDIA_ICONS[media] || '')+'<span>'+escapeHTML(label+(state.accountId ? ' · '+accountName(state.accountId) : '')+(state.contentType ? ' · '+contentFilterLabel() : ''))+'</span>';
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
  card.dataset.media = digital ? 'digital' : 'physical';
  if(dlc){
    card.querySelector('.card-status-control')?.remove();
    const banner = card.querySelector('.card-banner');
    // Keep the supplied artwork, with a visible DLC label even when no image is available.
    banner.insertAdjacentHTML('beforeend','<span class="dlc-label">'+contentIcon(game)+'<span>'+contentKind(game)+'</span></span>');
    if(!game.image){
      banner.classList.remove('placeholder');
      banner.querySelector('.card-fallback')?.remove();
      banner.insertAdjacentHTML('afterbegin','<span class="dlc-placeholder">'+contentIcon(game)+'</span>');
    }
  }
  const body = card.querySelector('.card-body');
  if(state.media === 'all' && !dlc){
    body.querySelector('.card-identity').insertAdjacentHTML('beforeend','<span class="card-media-mark">'+MEDIA_ICONS[digital?'digital':'physical']+'<span>'+(digital?'Numérique':'Physique')+'</span></span>');
  }
  const contents = gameContents(game);
  if(contents.length) body.insertAdjacentHTML('beforeend','<span class="card-dlc-count">'+MEDIA_ICONS.dlc+contents.length+(contents.some(g=>g.contentType === 'upgrade')?' contenu'+(contents.length>1?'s':''):' DLC')+'</span>');
  if(digital){
    if(game.accountId) body.querySelector('.card-platform').insertAdjacentHTML('afterend','<span class="card-console-account">'+accountIdentityHtml(DIGITAL_ACCOUNTS.find(a=>a.id === game.accountId))+'</span>');
    const price = card.querySelector('.card-price');
    if(price) price.textContent = game.prix == null ? 'Non renseigné' : purchaseMoney(game);
    bindAvatarFallbacks(body);
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
  if(/wii\s*u|3ds|2ds/i.test(platform)) return 'Nintendo Network';
  if(/switch|nintendo|wii/i.test(platform)) return 'Nintendo';
  if(/playstation|ps[1-5]|vita|psp/i.test(platform)) return 'PlayStation';
  if(/xbox/i.test(platform)) return 'Xbox';
  return 'Autre';
}
function populateDigitalAccounts(selected, chooseDefault = false){
  const ecosystem = ecosystemFor(document.getElementById('f-plateforme').value);
  const accounts = DIGITAL_ACCOUNTS.filter(a=>a.ecosystem === ecosystem || a.id === selected);
  const select = document.getElementById('f-account');
  select.innerHTML = '<option value="">Non renseigné</option>'+accounts.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML((a.nickname || a.name)+(a.region?' · '+a.region:''))+'</option>').join('');
  select.value = selected && accounts.some(a=>a.id === selected) ? selected : chooseDefault ? (accounts.find(a=>a.preferred)?.id || accounts[0]?.id || '') : '';
  renderFormAccountIdentity();
}
function renderFormAccountIdentity(){
  const account = DIGITAL_ACCOUNTS.find(a=>a.id === document.getElementById('f-account').value);
  const container = document.getElementById('f-account-identity');
  container.innerHTML = account ? accountIdentityHtml(account)+'<small>'+escapeHTML([account.ecosystem,account.region].filter(Boolean).join(' · '))+'</small>' : '';
  bindAvatarFallbacks(container);
}
function populateParentGames(selected = ''){
  const query = document.getElementById('f-parent-search').value.trim().toLocaleLowerCase('fr');
  const select = document.getElementById('f-parent');
  const candidates = GAMES.filter(g=>g.id !== editingId && !JTDData.isAddon(g) && (g.id === selected || !query || (g.nom+' '+g.plateforme).toLocaleLowerCase('fr').includes(query)));
  select.innerHTML = '<option value="">Aucun pour le moment</option>'+candidates.map(g=>'<option value="'+escapeHTML(g.id)+'">'+escapeHTML(g.nom+' · '+g.plateforme+' · '+(JTDData.isDigital(g)?'Numérique':'Physique'))+'</option>').join('');
  select.value = candidates.some(g=>g.id === selected) ? selected : '';
  renderParentPreview();
}
function relatedGameHtml(game){
  return '<span class="content-related-thumb'+gameImageClass(game)+'">'+(game.image?gameImageHtml(game):'<span>'+escapeHTML(game.plateforme.slice(0,2).toUpperCase())+'</span>')+'</span><span class="content-related-copy"><strong>'+escapeHTML(game.nom)+'</strong><small>'+escapeHTML(game.plateforme+' · '+(JTDData.isAddon(game)?contentKind(game):JTDData.isDigital(game)?'Numérique':'Physique'))+'</small></span>';
}
function renderParentPreview(){
  const parent = GAMES.find(g=>g.id === document.getElementById('f-parent').value);
  const container = document.getElementById('f-parent-preview');
  container.innerHTML = parent ? relatedGameHtml(parent) : '';
  container.classList.toggle('hidden',!parent);
}
function updateDigitalFields(){
  const digital = document.getElementById('f-media').value === 'digital';
  const dlc = digital && ['dlc','upgrade'].includes(document.getElementById('f-content-type').value);
  const upgrade = document.getElementById('f-content-type').value === 'upgrade';
  document.querySelector('label[for="f-nom"]').textContent = dlc ? 'Nom du contenu' : 'Nom du jeu';
  if(dlc) document.getElementById('modal-title').textContent = editingId ? (upgrade?'Mise à niveau':'Fiche du DLC') : (upgrade?'Ajouter une mise à niveau':'Ajouter un DLC');
  else if(!convertingArrivalId && editingCollection !== 'cemetery') document.getElementById('modal-title').textContent = editingId ? 'Fiche du jeu' : 'Ajouter un jeu';
  document.getElementById('f-content-type-field').classList.toggle('hidden',!digital);
  document.getElementById('f-digital-fields').classList.toggle('hidden',!dlc);
  document.getElementById('f-source-field').classList.toggle('hidden',digital);
  document.getElementById('f-purchase-digital-fields').classList.toggle('hidden',!digital);
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
  document.getElementById('f-content-type').value = JTDData.isAddon(game) ? game.contentType : 'game';
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
  const kind = document.getElementById('f-content-type').value;
  const dlc = ['dlc','upgrade'].includes(kind);
  const parentId = dlc ? document.getElementById('f-parent').value || null : null;
  const parent = GAMES.find(g=>g.id === parentId);
  if(parentId && !JTDData.canAttachContent({id:editingId,format:'Numérique',contentType:kind,plateforme:document.getElementById('f-plateforme').value},parent)){
    throw {field:'f-parent',message:'Choisis un jeu sur la même plateforme, ou un jeu Switch pour sa mise à niveau Switch 2.'};
  }
  const raw = document.getElementById('f-prix').value.trim();
  const currency = document.getElementById('f-currency').value;
  if(raw && (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || !Number.isFinite(Number(raw.replace(',','.'))) || (currency === 'JPY' && !/^\d+$/.test(raw)))){
    throw {field:'f-prix',message:currency === 'JPY'?'Indique un prix en yens sans décimales.':'Indique un prix positif avec deux décimales maximum.'};
  }
  return {format:'Numérique',contentType:dlc?kind:'game',parentId,accountId:document.getElementById('f-account').value || null,currency,collector:false,japanese:false};
}
function renderContentDetails(game){
  const container = document.getElementById('f-content-details');
  container.replaceChildren();
  if(!game) return;
  const parent = JTDData.contentParent(game,GAMES);
  const children = gameContents(game);
  const section = document.createElement('section');
  section.className = 'form-section content-purchases';
  if(JTDData.isDigital(game)){
    const summary = document.createElement('div');
    summary.className = 'content-format-summary';
    summary.innerHTML = MEDIA_ICONS[JTDData.isAddon(game)?game.contentType:'digital']+'<span>'+(JTDData.isAddon(game)?contentKind(game):'Jeu numérique')+'</span>';
    section.appendChild(summary);
  }
  if(parent){
    const title = document.createElement('div');title.className='form-section-title';title.textContent='Jeu de base';section.appendChild(title);
    const button = document.createElement('button');button.type='button';button.className='content-purchase-link';
    button.innerHTML = '<span class="content-related-identity">'+relatedGameHtml(parent)+'</span>';
    button.onclick=()=>openModal(parent.id);section.appendChild(button);
  }else if(JTDData.isAddon(game)){
    const note = document.createElement('p');note.className='content-parent-note';
    note.textContent = game.parentId ? 'Jeu de base hors de la collection. Cet achat reste dans ta bibliothèque numérique.' : 'Aucun jeu associé.';
    section.appendChild(note);
  }
  if(children.length){
    const title = document.createElement('div');title.className='form-section-title';title.textContent='DLC et mises à niveau';section.appendChild(title);
    for(const child of children){
      const button = document.createElement('button');button.type='button';button.className='content-purchase-link';
      button.innerHTML = '<span class="content-related-identity">'+relatedGameHtml(child)+'<span class="content-related-account">'+accountIdentityHtml(DIGITAL_ACCOUNTS.find(a=>a.id === child.accountId))+'</span></span><span class="content-related-price">'+purchaseMoney(child)+'</span>';
      button.onclick=()=>openModal(child.id);section.appendChild(button);
    }
    const sums = new Map();
    for(const purchase of [game,...children]) if(purchase.prix != null) sums.set(purchase.currency || 'EUR',(sums.get(purchase.currency || 'EUR') || 0)+purchase.prix);
    const total = document.createElement('div');total.className='content-purchase-total';
    total.textContent = 'Total jeu et contenus : '+[...sums].map(([currency,prix])=>purchaseMoney({currency,prix})).join(' + ');
    section.appendChild(total);
  }
  if(section.childNodes.length) container.appendChild(section);
  bindAvatarFallbacks(container);
}
function editDigitalAccountRow(account = {id:crypto.randomUUID(),name:'',ecosystem:'Nintendo',region:'',preferred:false}){
  const row = document.createElement('div');row.className='digital-account-row platform-row';row.dataset.accountId=account.id;
  row.dataset.avatar = safeURL(account.avatar,true);
  const isNew = !DIGITAL_ACCOUNTS.some(a=>a.id === account.id);row.dataset.new=String(isNew);
  row.innerHTML = '<div class="platform-row-main"><span class="digital-account-list-avatar">'+accountIdentityHtml(account,false)+'</span><div class="platform-row-info"><strong class="platform-row-name">'+escapeHTML(account.nickname || account.name || 'Nouveau compte')+'</strong></div><button type="button" class="platform-edit-btn digital-account-edit" aria-label="Modifier '+escapeHTML(account.nickname || account.name || 'le compte')+'" aria-expanded="false">'+contextEditIcon()+'</button></div><div class="platform-row-editor hidden"><div class="digital-account-heading"><span class="digital-account-avatar-preview">'+accountIdentityHtml(account,false)+'</span><label class="avatar-file-label">Changer l’avatar<input type="file" data-field="avatar-file" accept="image/*"></label><button type="button" class="manage-link" data-remove-avatar>Retirer</button></div><div class="field-row"><div class="field"><label>Pseudo<input data-field="nickname" maxlength="80" value="'+escapeHTML(account.nickname || '')+'" placeholder="Ton pseudo console"></label></div><div class="field"><label>Repère du compte<input data-field="name" maxlength="80" value="'+escapeHTML(account.name)+'" placeholder="Compte japonais"></label></div></div><div class="field-row"><div class="field"><label>Réseau<select data-field="ecosystem">'+['Nintendo','Nintendo Network','PlayStation','Xbox','Autre'].map(e=>'<option value="'+e+'"'+(e === account.ecosystem?' selected':'')+'>'+accountEcosystemLabel(e)+'</option>').join('')+'</select></label></div><div class="field"><label>Région <span class="optional-label">optionnel</span><input data-field="region" maxlength="80" value="'+escapeHTML(account.region)+'" placeholder="Japon"></label></div></div><div class="digital-account-actions"><label><input type="checkbox" data-field="preferred"'+(account.preferred?' checked':'')+'> Compte par défaut</label><button type="button" class="manage-link digital-account-delete">Supprimer</button></div><p class="digital-account-row-error" role="alert"></p><div class="platform-editor-actions"><div class="platform-editor-spacer"></div><button type="button" class="platform-cancel-btn digital-account-cancel">Annuler</button><button type="button" class="platform-save-btn digital-account-save">Enregistrer</button></div></div>';
  let avatarBusy = false;
  const refreshAvatar = ()=>{
    row.querySelector('.digital-account-avatar-preview').innerHTML = accountIdentityHtml({name:row.querySelector('[data-field="name"]').value,nickname:row.querySelector('[data-field="nickname"]').value,avatar:row.dataset.avatar},false);
    bindAvatarFallbacks(row);
  };
  row.querySelector('[data-field="avatar-file"]').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    avatarBusy=true;row.dataset.avatarBusy='true';
    try{const avatar=await resizeImageToDataUrl(file,96);if(row.isConnected){row.dataset.avatar=avatar;refreshAvatar();}}
    catch(error){document.getElementById('digital-accounts-error').textContent='Impossible de lire cette image.';}
    finally{avatarBusy=false;row.dataset.avatarBusy='false';event.target.value='';}
  };
  row.querySelector('[data-remove-avatar]').onclick=()=>{if(!avatarBusy){row.dataset.avatar='';refreshAvatar();}};
  row.querySelector('[data-field="nickname"]').oninput=refreshAvatar;
  bindAvatarFallbacks(row);
  const error = message=>{row.querySelector('.digital-account-row-error').textContent=message;};
  const editor = row.querySelector('.platform-row-editor');
  const edit = row.querySelector('.digital-account-edit');
  const showEditor = ()=>{
    document.querySelectorAll('.digital-account-row.editing').forEach(other=>{
      if(other !== row){
        other.classList.remove('editing');other.querySelector('.platform-row-editor').classList.add('hidden');other.querySelector('.digital-account-edit').setAttribute('aria-expanded','false');
      }
    });
    row.classList.add('editing');editor.classList.remove('hidden');edit.setAttribute('aria-expanded','true');
    row.querySelector('[data-field="nickname"]').focus();
  };
  edit.onclick=showEditor;
  row.querySelector('.digital-account-cancel').onclick=()=>{
    if(avatarBusy)return;
    if(isNew){row.remove();document.getElementById('digital-account-add').focus();return;}
    for(const field of ['name','nickname','ecosystem','region']) row.querySelector('[data-field="'+field+'"]').value=account[field] || '';
    row.querySelector('[data-field="preferred"]').checked=!!account.preferred;row.dataset.avatar=account.avatar || '';refreshAvatar();error('');
    row.classList.remove('editing');editor.classList.add('hidden');edit.setAttribute('aria-expanded','false');edit.focus();
  };
  row.querySelector('.digital-account-save').onclick=()=>{
    if(avatarBusy){error('L’avatar est en cours de préparation.');return;}
    const next={id:account.id,name:row.querySelector('[data-field="name"]').value.trim() || row.querySelector('[data-field="nickname"]').value.trim(),nickname:row.querySelector('[data-field="nickname"]').value.trim(),avatar:row.dataset.avatar || null,ecosystem:row.querySelector('[data-field="ecosystem"]').value,region:row.querySelector('[data-field="region"]').value.trim(),preferred:row.querySelector('[data-field="preferred"]').checked};
    if(!next.name){error('Renseigne un pseudo ou un repère pour ce compte.');row.querySelector('[data-field="nickname"]').focus();return;}
    if(next.preferred && DIGITAL_ACCOUNTS.some(a=>a.id !== next.id && a.ecosystem === next.ecosystem && a.preferred)){error('Un compte par défaut existe déjà pour ce réseau.');return;}
    const accounts=isNew ? [...DIGITAL_ACCOUNTS,next] : DIGITAL_ACCOUNTS.map(a=>a.id === next.id ? next : a);
    if(!commitCollection(GAMES,accounts))return;
    refreshDigitalAccountList();refreshAccountControls();
    document.querySelector('.digital-account-row[data-account-id="'+CSS.escape(next.id)+'"] .digital-account-edit')?.focus();
  };
  row.querySelector('.digital-account-delete').onclick=()=>{
    if(avatarBusy)return;
    if([...GAMES,...CEMETERY].some(g=>g.accountId === account.id)){error('Ce compte possède des achats. Réaffecte-les avant de le supprimer.');return;}
    if(!isNew && !commitCollection(GAMES,DIGITAL_ACCOUNTS.filter(a=>a.id !== account.id)))return;
    row.remove();refreshAccountControls();document.getElementById('digital-account-add').focus();
  };
  document.getElementById('digital-account-rows').appendChild(row);
  if(isNew) showEditor();
}
function refreshDigitalAccountList(){
  document.getElementById('digital-account-rows').replaceChildren();
  DIGITAL_ACCOUNTS.forEach(editDigitalAccountRow);
}
function refreshAccountControls(){
  const selected=document.getElementById('f-account').value;
  populateDigitalAccounts(selected);buildPlatformList();render();
}
function openDigitalAccounts(){
  closeMobileDrawers();
  refreshDigitalAccountList();
  document.getElementById('digital-accounts-error').textContent='';
  window.JTDDialogs.open('digital-accounts-overlay',{onDismiss:closeDigitalAccounts});
}
function closeDigitalAccounts(){window.JTDDialogs.close('digital-accounts-overlay');}
window.closeDigitalAccounts = closeDigitalAccounts;
function initDigitalControls(){
  document.getElementById('collection-media-tabs').addEventListener('click',event=>{
    const button = event.target.closest('[data-media]');if(!button)return;
    state.media=button.dataset.media;state.accountId=null;state.contentType=null;state.collector=false;state.japanese=false;state.status=null;
    buildPlatformList();buildFormatToggles();buildStatusToggles();render();closeMobileDrawers();
  });
  document.getElementById('content-type-options').onclick=event=>{
    const button=event.target.closest('[data-content-type]');if(!button)return;
    const types=new Set(selectedContentTypes());
    const type=button.dataset.contentType;types.has(type) ? types.delete(type) : types.add(type);
    state.contentType=[...types].join(',') || null;buildPlatformList();render();
  };
  document.getElementById('collection-account').onchange=event=>{
    state.accountId=event.target.value || null;
    if(state.accountId && state.media === 'physical') state.media='digital';
    document.getElementById('collection-account-picker').open=false;
    buildPlatformList();render();closeMobileDrawers();
  };
  document.getElementById('collection-account-options').onclick=event=>{
    const button=event.target.closest('[data-account]');if(!button)return;
    const select=document.getElementById('collection-account');select.value=state.accountId === button.dataset.account ? '' : button.dataset.account;select.dispatchEvent(new Event('change'));
  };
  document.getElementById('collection-manage-accounts').onclick=openDigitalAccounts;
  for(const id of ['f-media','f-content-type','f-currency']) document.getElementById(id).addEventListener('change',()=>{setGameSheetViewing(false);updateDigitalFields();});
  document.getElementById('f-account').addEventListener('change',()=>{setGameSheetViewing(false);renderFormAccountIdentity();});
  document.getElementById('f-parent-search').oninput=()=>populateParentGames(document.getElementById('f-parent').value);
  document.getElementById('f-parent').onchange=event=>{
    setGameSheetViewing(false);
    const parent=GAMES.find(g=>g.id===event.target.value);if(!parent)return;
    const upgrade = document.getElementById('f-content-type').value === 'upgrade';
    const target = upgrade && /^(?:Nintendo )?Switch(?: 1)?$/i.test(parent.plateforme) ? allPlatformNames().find(p=>/^(?:Nintendo )?Switch 2$/i.test(p)) || parent.plateforme : parent.plateforme;
    setSelectValueAndSync('f-plateforme',target);
    populateDigitalAccounts(parent.accountId || '',true);
    renderParentPreview();
  };
  document.getElementById('f-plateforme').addEventListener('change',()=>populateDigitalAccounts('',true));
  document.getElementById('f-manage-accounts').onclick=openDigitalAccounts;
  document.getElementById('digital-account-add').onclick=()=>{const draft=document.querySelector('.digital-account-row[data-new="true"]');if(draft)draft.querySelector('.digital-account-edit').click();else editDigitalAccountRow();};
  document.getElementById('digital-accounts-save').onclick=closeDigitalAccounts;
}
document.addEventListener('DOMContentLoaded',initDigitalControls);
