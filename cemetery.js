/* Collection exits retain their acquisition record. A shared saleId represents one sale/lot. */
let saleView = 'pending';
let saleEditingId = null;
let reorderingSales = false;
const saleEl = id => document.getElementById(id);
function saleGroup(item){
  return item.saleStatus === 'sold' && item.saleId
    ? CEMETERY.filter(g => g.saleStatus === 'sold' && g.saleId === item.saleId) : [item];
}
function saleKey(item){
  return item.saleStatus === 'sold' && item.saleId ? 'lot:' + item.saleId : 'game:' + item.id;
}
function orderedSaleGroups(status){
  const groups = new Map();
  for(const item of CEMETERY){
    if(item.saleStatus !== status) continue;
    const key = saleKey(item);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(item);
  }
  const result = [...groups.values()];
  if(status === 'sold') result.sort((a,b) => (b[0].saleOrder ?? 0) - (a[0].saleOrder ?? 0));
  return result;
}
function lotLabel(group){
  const counts = new Map();
  for(const item of group) counts.set(item.plateforme,(counts.get(item.plateforme) || 0) + 1);
  return [...counts].map(([platform,count]) => count + ' ' + platform).join(' · ');
}
function lotPreview(group){
  const thumbnails = group.slice(0,3).map(game=>{
    const hasImage = !!safeURL(game.image,true);
    return '<span class="sale-lot-thumb'+gameImageClass(game)+'">'+
      (hasImage ? gameImageHtml(game,'',true,'lazy') : '')+
      '<span class="board-image-fallback'+(hasImage?' hidden':'')+'">'+escapeHTML(game.plateforme.slice(0,2).toUpperCase())+'</span></span>';
  }).join('');
  const names = group.slice(0,2).map(game=>'<span class="sale-lot-name" title="'+escapeHTML(game.nom)+'">'+escapeHTML(game.nom)+'</span>').join('');
  const remaining = group.length-2;
  return {
    thumbnails:'<span class="sale-lot-thumbs" aria-hidden="true">'+thumbnails+'</span>',
    names:'<span class="sale-lot-names">'+names+(remaining>0?'<span class="sale-lot-more" aria-label="'+remaining+' autres jeux">+'+remaining+'</span>':'')+'</span>'
  };
}
function updateCemeteryStats(){
  const pending = CEMETERY.filter(game => game.saleStatus === 'pending');
  const sold = CEMETERY.filter(game => game.saleStatus === 'sold');
  const sales = new Map();
  for(const game of sold) sales.set(saleKey(game), Number(game.salePrice) || 0);
  saleEl('cemetery-stat-sales').textContent = euros([...sales.values()].reduce((sum, price) => sum + price, 0));
  saleEl('cemetery-stat-estimated').textContent = euros(pending.reduce((sum, game) => sum + (Number(game.estimatedPrice) || 0), 0));
  saleEl('cemetery-stat-sold-count').textContent = String(sold.length);
  saleEl('cemetery-stat-pending-count').textContent = String(pending.length);
}
function saleHeading(item, lot = false){
  const venue = item.saleChannel === 'online' ? 'En ligne' : item.saleChannel === 'store' ? 'En boutique' : 'Canal à définir';
  const amount = item.saleStatus === 'sold' ? item.salePrice : item.estimatedPrice;
  const label = lot ? 'Total du lot' : item.saleStatus === 'sold' ? 'Encaissé' : 'Estimation';
  return '<span class="sale-group-heading"><span class="sale-heading-main"><small class="sale-amount-label">' + label + '</small><strong class="sale-amount">' + (amount != null ? euros(amount) : '—') + '</strong></span><span class="sale-venue">' + venue + '</span></span>';
}
function saleCards(group){
  const cards = document.createElement('div');
  cards.className = 'sale-cards';
  for(const game of group){
    const card = renderCard(game,{readOnly:true,onOpen:()=>openSaleModal(game.id)});
    card.classList.add('sale-game');
    const purchase = card.querySelector('.card-purchase');
    if(purchase) purchase.replaceWith(...purchase.childNodes);
    const acquisition = card.querySelector('.card-acquisition');
    if(acquisition){
      const label = document.createElement('span');
      label.className = 'sale-purchase-label';
      label.textContent = 'Achat';
      acquisition.prepend(label);
    }
    cards.append(card);
  }
  return cards;
}
function persistSaleOrder(keys, movedKey){
  const groups = orderedSaleGroups('sold');
  const current = groups.map(group=>saleKey(group[0]));
  const positions = new Map(keys.map((key,index)=>[key,keys.length-index]));
  if(keys.length !== current.length || current.some(key=>!positions.has(key))){
    renderCemetery();
    return;
  }
  if(keys.every((key,index)=>key === current[index])) return;
  const next = CEMETERY.map(game=>{
    const saleOrder = game.saleStatus === 'sold' ? positions.get(saleKey(game)) : undefined;
    return saleOrder === undefined || saleOrder === game.saleOrder ? game : {...game,saleOrder};
  });
  if(!commitCemetery(next)){
    renderCemetery();
    showToast('L’ordre n’a pas pu être enregistré.');
  }
  const row = [...saleEl('cemetery-list').querySelectorAll('.sale-order-row')].find(element=>element.dataset.saleKey === movedKey);
  row?.querySelector('.sale-order-handle')?.focus({preventScroll:true});
}
function renderOrderRow(group){
  const item = group[0];
  const row = document.createElement('div');
  row.className = 'sale-order-row';
  row.dataset.saleKey = saleKey(item);
  const isLot = group.length > 1;
  const title = isLot ? 'Lot · ' + group.length + ' jeux' : item.nom;
  const subtitle = isLot ? lotLabel(group) : item.plateforme;
  row.innerHTML = `<button type="button" class="sale-order-handle" aria-label="Déplacer ${escapeHTML(title)} · ${escapeHTML(subtitle)}" aria-describedby="cemetery-order-hint">
      <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="5" r="1.3"/><circle cx="13" cy="5" r="1.3"/>
        <circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/>
        <circle cx="7" cy="15" r="1.3"/><circle cx="13" cy="15" r="1.3"/>
      </svg>
    </button>
    <span class="sale-order-title"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(subtitle)}</span></span>
    ${saleHeading(item)}`;
  return row;
}
function initSaleReordering(){
  const list = saleEl('cemetery-list');
  const rows = () => [...list.querySelectorAll('.sale-order-row')];
  const keys = () => rows().map(row=>row.dataset.saleKey);
  let drag = null;

  function placeRow(row,center){
    const before = rows().find(other=>{
      if(other === row) return false;
      const bounds = other.getBoundingClientRect();
      return center < bounds.top+bounds.height/2;
    }) || null;
    if(row.nextElementSibling !== before) list.insertBefore(row,before);
  }
  function slide(){
    if(!drag || !drag.row.isConnected) return;
    const {row,y,offset} = drag;
    const edge = 80;
    if(y < edge) window.scrollBy(0,-Math.min(16,(edge-y)/4));
    else if(y > innerHeight-edge) window.scrollBy(0,Math.min(16,(y-innerHeight+edge)/4));
    const center = y-offset;
    placeRow(row,center);
    const top = list.getBoundingClientRect().top + row.offsetTop;
    row.style.setProperty('--sale-drag-y', (center-top-row.offsetHeight/2) + 'px');
    drag.frame = requestAnimationFrame(slide);
  }
  function finish(event, save){
    if(!drag || event.pointerId !== drag.pointerId) return;
    const {row,frame,active,offset} = drag;
    drag = null;
    cancelAnimationFrame(frame);
    if(!active || !row.isConnected) return;
    row.classList.remove('sale-order-dragging');
    row.style.removeProperty('--sale-drag-y');
    if(save){
      placeRow(row,event.clientY-offset);
      persistSaleOrder(keys(),row.dataset.saleKey);
    } else renderCemetery();
  }

  list.addEventListener('pointerdown',event=>{
    const handle = event.target.closest('.sale-order-handle');
    if(!handle || drag || !event.isPrimary || event.button !== 0) return;
    const row = handle.closest('.sale-order-row');
    const bounds = row.getBoundingClientRect();
    drag = {row,pointerId:event.pointerId,y:event.clientY,start:event.clientY,offset:event.clientY-bounds.top-bounds.height/2,active:false,frame:0};
    list.setPointerCapture(event.pointerId);
  });
  list.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId !== drag.pointerId) return;
    drag.y = event.clientY;
    if(drag.active || Math.abs(drag.y-drag.start) < 4) return;
    drag.active = true;
    drag.row.classList.add('sale-order-dragging');
    slide();
  });
  list.addEventListener('pointerup',event=>finish(event,true));
  list.addEventListener('pointercancel',event=>finish(event,false));
  list.addEventListener('lostpointercapture',event=>finish(event,false));
  list.addEventListener('keydown',event=>{
    const handle = event.target.closest('.sale-order-handle');
    if(!handle || !['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const row = handle.closest('.sale-order-row');
    const current = keys();
    const from = current.indexOf(row.dataset.saleKey);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if(to < 0 || to >= current.length) return;
    [current[from],current[to]] = [current[to],current[from]];
    persistSaleOrder(current,row.dataset.saleKey);
  });
}
function renderCemetery(){
  const container = saleEl('cemetery-list');
  if(!container) return;
  updateCemeteryStats();
  const select = saleEl('cemetery-platform');
  const selectedPlatform = select.value;
  const platforms = [...new Set(CEMETERY.map(g => g.plateforme))].sort();
  select.replaceChildren(new Option('Toutes les plateformes',''),...platforms.map(platform=>new Option(platform,platform)));
  const platform = platforms.includes(selectedPlatform) ? selectedPlatform : '';
  select.value = platform;
  const search = JTDData.searchKey(saleEl('cemetery-search').value.trim());
  const matches = game => (!platform || game.plateforme === platform) && (!search || JTDData.searchKey(game.nom).includes(search));
  const allGroups = orderedSaleGroups(saleView);
  const groups = allGroups.filter(group=>group.some(matches));
  const canReorder = saleView === 'sold' && allGroups.length > 1 && !platform && !search;
  reorderingSales = reorderingSales && canReorder;
  const orderTools = saleEl('cemetery-order-tools');
  const orderToggle = saleEl('cemetery-order-toggle');
  orderTools.classList.toggle('hidden',saleView !== 'sold' || allGroups.length < 2);
  orderToggle.disabled = !canReorder;
  orderToggle.title = platform || search ? 'Efface les filtres pour réordonner les ventes' : '';
  orderToggle.textContent = reorderingSales ? 'Terminer' : 'Réordonner';
  orderToggle.setAttribute('aria-pressed',String(reorderingSales));
  saleEl('cemetery-order-hint').classList.toggle('hidden',!reorderingSales);

  const openLots = new Set([...container.querySelectorAll('.sale-lot[open]')].map(lot=>lot.dataset.saleKey));
  container.classList.toggle('pending-sales',saleView === 'pending');
  container.replaceChildren();
  if(!groups.length){ container.innerHTML = '<div class="cemetery-empty">Aucun jeu ici pour le moment.</div>'; return; }
  groups.forEach(group=>{
    if(reorderingSales){ container.append(renderOrderRow(group)); return; }
    const item = group[0];
    if(group.length > 1){
      const lot = document.createElement('details');
      lot.className = 'sale-lot';
      lot.dataset.saleKey = saleKey(item);
      lot.open = openLots.has(lot.dataset.saleKey);
      const preview = lotPreview(group);
      lot.innerHTML = `<summary class="sale-lot-summary">
        ${preview.thumbnails}
        <span class="sale-lot-title"><strong>Lot · ${group.length} jeux</strong>${preview.names}<span class="sale-lot-platforms" title="${escapeHTML(lotLabel(group))}">${escapeHTML(lotLabel(group))}</span></span>
        ${saleHeading(item,true)}
        <svg class="sale-lot-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </summary>`;
      lot.append(saleCards(group));
      container.append(lot);
      return;
    }
    const block = document.createElement('section');
    block.className = 'sale-group';
    block.innerHTML = saleHeading(item);
    block.append(saleCards(group));
    container.append(block);
  });
}
window.renderCemetery = renderCemetery;
function renderSaleIdentity(group, editable = true){
  const identity = saleEl('sale-identity');
  identity.replaceChildren();
  for(const game of group){
    const summary = document.createElement('div');
    summary.className = 'game-identity-summary';
    summary.innerHTML = identitySummaryHtml(game);
    if(!editable) summary.querySelector('.identity-edit-btn')?.remove();
    summary.querySelector('.identity-edit-btn')?.addEventListener('click', event => {
      event.stopPropagation();
      openModal(game.id, 'cemetery');
    });
    identity.appendChild(summary);
    const acquisition = document.createElement('p');
    acquisition.className = 'sale-acquisition';
    acquisition.textContent = [game.prix != null ? 'Acheté ' + euros(game.prix) : '', game.date ? dateFR(game.date) : '', game.source].filter(Boolean).join(' · ');
    if(acquisition.textContent) identity.appendChild(acquisition);
  }
}
window.updateCemeteryGame = (id, fields) => {
  if(!CEMETERY.some(game => game.id === id)) return false;
  const next = CEMETERY.map(game => game.id === id ? {...game, ...fields} : game);
  if(!commitCemetery(next)) return false;
  const active = CEMETERY.find(game => game.id === saleEditingId);
  if(active) renderSaleIdentity(saleGroup(active));
  return true;
};
let saleMode = 'pending';

function openSaleModal(id, mode){
  const item = (mode === 'new' ? GAMES : CEMETERY).find(g => g.id === id);
  if(!item) return;
  saleEditingId = id;
  saleMode = mode === 'new' ? 'new' : item.saleStatus === 'sold' ? 'sold' : mode || 'pending';
  const sold = saleMode === 'sold', group = sold ? saleGroup(item) : [item];
  saleEl('sale-modal-title').textContent = sold ? (group.length > 1 ? 'Vente en lot' : 'Vente') : saleMode === 'complete' ? 'Marquer vendu' : 'Préparer la vente';
  renderSaleIdentity(group, saleMode === 'pending' || sold);
  saleEl('sale-channel').value = item.saleChannel || '';
  saleEl('sale-estimate').value = item.estimatedPrice ?? '';
  saleEl('sale-price').value = item.salePrice ?? '';
  saleEl('sale-error').textContent = '';
  saleEl('sale-rollback').textContent = sold ? 'Repasser à vendre' : 'Remettre en collection';
  saleEl('sale-rollback').classList.toggle('hidden',saleMode !== 'pending' && !sold);
  saleEl('sale-complete').classList.toggle('hidden',saleMode !== 'pending');
  saleEl('sale-price-field').classList.toggle('hidden',saleMode !== 'complete' && !sold);
  saleEl('sale-estimate-field').classList.toggle('hidden',saleMode === 'complete');
  saleEl('sale-save').textContent = ({new:'Mettre en vente',pending:'Enregistrer la préparation',complete:'Confirmer la vente',sold:'Enregistrer'})[saleMode];
  saleEl('sale-cancel').textContent = saleMode === 'complete' ? 'Retour' : 'Annuler';
  saleEl('sale-lot-toggle').checked = false;
  saleEl('sale-lot-toggle').setAttribute('aria-expanded','false');
  saleEl('sale-lot-options').classList.add('hidden');
  saleEl('sale-lot-options').replaceChildren();
  for(const other of saleMode === 'complete' ? CEMETERY.filter(g => g.saleStatus === 'pending' && g.id !== id) : []){
    const label = document.createElement('label');
    label.className = 'sale-lot-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = other.id; checkbox.id = 'sale-lot-item-' + other.id;
    const copy = document.createElement('span');
    const name = document.createElement('span'); name.textContent = other.nom;
    const platform = document.createElement('small'); platform.textContent = other.plateforme;
    copy.append(name,platform);
    label.append(checkbox,copy);
    saleEl('sale-lot-options').appendChild(label);
  }
  saleEl('sale-lot-section').classList.toggle('hidden',!saleEl('sale-lot-options').children.length);
  updateSaleLot();
  openBoardEditor('sale-modal-overlay','sale',cancelSaleStep);
  saleEl('sale-modal-overlay').querySelector('.sale-sheet-body').scrollTop = 0;
  saleEl(saleMode === 'complete' ? 'sale-price' : 'sale-channel').focus();
}
function closeSaleModal(){ window.JTDDialogs.close('sale-modal-overlay'); saleEditingId = null; }
window.closeSaleModal = closeSaleModal;
function cancelSaleStep(){
  const id = saleEditingId;
  const returning = saleMode === 'complete';
  closeSaleModal();
  if(returning) openSaleModal(id);
}

function selectedSaleLot(){
  return [...saleEl('sale-lot-options').querySelectorAll('input:checked')].map(input=>input.value);
}
function commitCemetery(next){
  try{
    if(IS_PREVIEW_MODE) savePreviewData({cemetery:next});
    else accountStorage.atomicWrite([[CEMETERY_KEY, JSON.stringify(next)]]);
    CEMETERY = next;
    window.JTDDataChanged?.();
    renderCemetery();
    return true;
  }catch(error){ saleEl('sale-error').textContent = 'Enregistrement impossible. Tes données sont conservées.'; return false; }
}
function readSalePrice(id){
  const raw = saleEl(id).value.trim();
  if(!raw) return null;
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) throw new Error('Indique un prix positif, avec au maximum deux décimales.');
  const price = Number(raw.replace(',','.'));
  if(!Number.isFinite(price)) throw new Error('Prix invalide.');
  return price;
}
function saveSale(){
  const item = (saleMode === 'new' ? GAMES : CEMETERY).find(g => g.id === saleEditingId);
  if(!item) return;
  try{
    const saleChannel = saleEl('sale-channel').value || null;
    if(saleMode === 'new'){
      const estimatedPrice = readSalePrice('sale-estimate');
      if(!commitBoardTransfer('games','cemetery',item.id,{...item,saleStatus:'pending',saleChannel,estimatedPrice})) return;
      closeSaleModal();
      closeModal();
      buildPlatformList();
      render();
      goToPage('cemetery');
      setSaleView('pending');
      showToast('« ' + item.nom + ' » mis en vente.');
      return;
    }
    const completed = saleMode === 'complete';
    const sold = completed || saleMode === 'sold';
    const fields = {saleStatus:sold ? 'sold' : 'pending', saleChannel};
    const estimatedPrice = completed ? null : readSalePrice('sale-estimate');
    let ids = [item.id];
    if(sold){
      const salePrice = readSalePrice('sale-price');
      if(salePrice === null) throw new Error('Renseigne le montant encaissé avant de valider.');
      ids = completed ? [item.id, ...selectedSaleLot()] : saleGroup(item).map(g=>g.id);
      if(completed && ids.some(id=>!CEMETERY.some(game=>game.id===id && game.saleStatus==='pending'))){
        throw new Error('Le lot a changé. Retourne à la préparation et sélectionne les jeux à nouveau.');
      }
      Object.assign(fields,{salePrice,saleId:item.saleId || crypto.randomUUID(),saleOrder:completed ? CEMETERY.reduce((max,game)=>Math.max(max,game.saleOrder ?? 0),0) + 1 : (item.saleOrder ?? 0)});
    }
    const next = CEMETERY.map(g=>ids.includes(g.id) ? {...g,...fields,...(g.id === item.id && !completed ? {estimatedPrice} : {})} : g);
    if(commitCemetery(next)){
      closeSaleModal();
      if(completed) setSaleView('sold');
      showToast(sold ? 'Vente enregistrée.' : 'Préparation enregistrée.');
    }
  }catch(error){ saleEl('sale-error').textContent = error.message; }
}
function setSaleView(view){
  saleView = view;
  document.querySelectorAll('[data-sale-view]').forEach(button => { button.classList.toggle('active', button.dataset.saleView === view); button.setAttribute('aria-pressed', String(button.dataset.saleView === view)); });
  renderCemetery();
}
saleEl('f-sell-btn').addEventListener('click', () => {
  const item = GAMES.find(g => g.id === editingId);
  if(!item || JTDData.isDigital(item)) return;
  if(boardEditorSnapshots.get('modal-overlay') === boardEditorSnapshot('modal-overlay','f')){
    openSaleModal(item.id,'new');
    return;
  }
  withBoardEditorChanges('modal-overlay','f',() => {
    closeModal();
    openModal(item.id);
    openSaleModal(item.id,'new');
  });
});
saleEl('sale-complete').addEventListener('click', () => {
  const id = saleEditingId;
  withBoardEditorChanges('sale-modal-overlay','sale',() => {
    closeSaleModal();
    openSaleModal(id,'complete');
  });
});
function restoreFromCemetery(id){
  const item = CEMETERY.find(g => g.id === id);
  if(!item || item.saleStatus !== 'pending') return;
  const draft = {...item};
  for(const field of ['saleStatus','saleVenue','saleChannel','estimatedPrice','salePrice','saleId','saleOrder']) delete draft[field];
  if(commitBoardTransfer('cemetery','games',id,draft)){
    closeSaleModal(); buildPlatformList(); render(); renderCemetery(); showToast('Jeu remis dans la collection.');
  }
}
saleEl('sale-rollback').addEventListener('click', () => {
  const item = CEMETERY.find(g => g.id === saleEditingId);
  if(!item) return;
  if(item.saleStatus === 'pending'){
    confirmAction('Remettre « ' + item.nom + ' » dans la Collection ? Les informations de préparation seront retirées.', () => restoreFromCemetery(item.id), {title:'Remettre en collection ?',confirmLabel:'Remettre en collection'});
    return;
  }
  const ids = saleGroup(item).map(g => g.id);
  confirmAction(ids.length > 1 ? 'Les ' + ids.length + ' jeux du lot repasseront dans À vendre.' : '« ' + item.nom + ' » repassera dans À vendre.', () => {
    const next = CEMETERY.map(g => {
      if(!ids.includes(g.id)) return g;
      const draft = {...g, saleStatus:'pending'};
      delete draft.saleId; delete draft.salePrice; delete draft.saleOrder;
      return draft;
    });
    if(commitCemetery(next)){ closeSaleModal(); setSaleView('pending'); }
  }, {title:'Repasser à vendre ?',confirmLabel:'Repasser à vendre'});
});
function updateSaleLot(){
  const item = CEMETERY.find(g=>g.id === saleEditingId);
  const count = saleMode === 'sold' && item ? saleGroup(item).length : 1 + selectedSaleLot().length;
  saleEl('sale-price-label').textContent = count > 1 ? 'Total encaissé pour le lot (€)' : 'Montant encaissé (€)';
  saleEl('sale-lot-count').textContent = 'Lot de ' + count + ' jeux';
  saleEl('sale-lot-count').classList.toggle('hidden',count < 2);
}
saleEl('sale-lot-toggle').addEventListener('change', () => {
  const enabled = saleEl('sale-lot-toggle').checked;
  saleEl('sale-lot-options').classList.toggle('hidden', !enabled);
  saleEl('sale-lot-toggle').setAttribute('aria-expanded',String(enabled));
  if(!enabled) saleEl('sale-lot-options').querySelectorAll('input').forEach(input => { input.checked = false; });
  updateSaleLot();
});
saleEl('sale-lot-options').addEventListener('change',updateSaleLot);
saleEl('sale-save').addEventListener('click', saveSale);
saleEl('sale-cancel').addEventListener('click', () => withBoardEditorChanges('sale-modal-overlay','sale',cancelSaleStep));
saleEl('cemetery-order-toggle').addEventListener('click',()=>{
  reorderingSales = !reorderingSales;
  renderCemetery();
});
saleEl('cemetery-search').addEventListener('input', renderCemetery);
saleEl('cemetery-platform').addEventListener('change', renderCemetery);
document.querySelectorAll('[data-sale-view]').forEach(button => button.addEventListener('click', () => setSaleView(button.dataset.saleView)));
initSaleReordering();
renderCemetery();
