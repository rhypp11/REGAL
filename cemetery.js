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
function saleHeading(item){
  const venue = item.saleChannel === 'online' ? 'En ligne' : item.saleChannel === 'store' ? 'En boutique' : 'Canal à définir';
  const amount = item.saleStatus === 'sold' ? item.salePrice : item.estimatedPrice;
  return '<span class="sale-group-heading"><span class="sale-heading-main"><strong class="sale-amount">' + (amount != null ? euros(amount) : '—') + '</strong></span><span class="sale-venue">' + venue + '</span></span>';
}
function saleCards(group){
  const cards = document.createElement('div');
  cards.className = 'sale-cards';
  for(const game of group){
    const card = renderCard(game,{readOnly:true,onOpen:()=>openSaleModal(game.id)});
    card.classList.add('sale-game');
    const purchase = card.querySelector('.card-purchase');
    if(purchase) purchase.replaceWith(...purchase.childNodes);
    cards.append(card);
  }
  return cards;
}
function moveSale(key, offset){
  const groups = orderedSaleGroups('sold');
  const from = groups.findIndex(group => saleKey(group[0]) === key);
  const to = from + offset;
  if(from < 0 || to < 0 || to >= groups.length) return;
  [groups[from],groups[to]] = [groups[to],groups[from]];
  const positions = new Map(groups.map((group,index)=>[saleKey(group[0]),groups.length-index]));
  const next = CEMETERY.map(game=>{
    const saleOrder = game.saleStatus === 'sold' ? positions.get(saleKey(game)) : undefined;
    return saleOrder === undefined || saleOrder === game.saleOrder ? game : {...game,saleOrder};
  });
  if(!commitCemetery(next)){ showToast('L’ordre n’a pas pu être enregistré.'); return; }
  const row = [...saleEl('cemetery-list').querySelectorAll('.sale-order-row')].find(element=>element.dataset.saleKey === key);
  (row?.querySelector(`[data-move="${offset}"]:enabled`) || row?.querySelector('[data-move]:enabled'))?.focus();
}
function renderOrderRow(group,index,length){
  const item = group[0];
  const key = saleKey(item);
  const row = document.createElement('div');
  row.className = 'sale-order-row';
  row.dataset.saleKey = key;
  const title = group.length > 1 ? 'Lot · ' + lotLabel(group) : item.nom;
  row.innerHTML = `<span class="sale-order-title">${escapeHTML(title)}</span>
    <span class="sale-order-actions">
      <button type="button" class="btn btn-ghost" data-move="-1" aria-label="Monter ${escapeHTML(title)}"${index === 0 ? ' disabled' : ''}>↑</button>
      <button type="button" class="btn btn-ghost" data-move="1" aria-label="Descendre ${escapeHTML(title)}"${index === length-1 ? ' disabled' : ''}>↓</button>
    </span>`;
  row.querySelector('.sale-order-actions').addEventListener('click',event=>{
    const button = event.target.closest('[data-move]');
    if(button) moveSale(key,Number(button.dataset.move));
  });
  return row;
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
  const search = saleEl('cemetery-search').value.trim().toLocaleLowerCase('fr');
  const matches = game => (!platform || game.plateforme === platform) && (!search || game.nom.toLocaleLowerCase('fr').includes(search));
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

  const openLots = new Set([...container.querySelectorAll('.sale-lot[open]')].map(lot=>lot.dataset.saleKey));
  container.classList.toggle('pending-sales',saleView === 'pending');
  container.replaceChildren();
  if(!groups.length){ container.innerHTML = '<div class="cemetery-empty">Aucun jeu ici pour le moment.</div>'; return; }
  groups.forEach((group,index)=>{
    if(reorderingSales){ container.append(renderOrderRow(group,index,groups.length)); return; }
    const item = group[0];
    if(group.length > 1){
      const lot = document.createElement('details');
      lot.className = 'sale-lot';
      lot.dataset.saleKey = saleKey(item);
      lot.open = openLots.has(lot.dataset.saleKey);
      lot.innerHTML = `<summary class="sale-lot-summary">
        <span class="sale-lot-title"><strong>Lot · ${group.length} jeux</strong><span>${escapeHTML(lotLabel(group))}</span></span>
        ${saleHeading(item)}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
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
function renderSaleIdentity(group){
  const identity = saleEl('sale-identity');
  identity.replaceChildren();
  for(const game of group){
    const summary = document.createElement('div');
    summary.className = 'game-identity-summary';
    summary.innerHTML = identitySummaryHtml(game);
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
function openSaleModal(id){
  const item = CEMETERY.find(g => g.id === id);
  if(!item) return;
  saleEditingId = id;
  const sold = item.saleStatus === 'sold', group = saleGroup(item);
  saleEl('sale-modal-title').textContent = sold ? (group.length > 1 ? 'Vente en lot' : 'Vente') : 'Préparer la vente';
  renderSaleIdentity(group);
  saleEl('sale-channel').value = item.saleChannel || '';
  saleEl('sale-estimate').value = item.estimatedPrice ?? '';
  saleEl('sale-price').value = item.salePrice ?? '';
  saleEl('sale-error').textContent = '';
  saleEl('sale-rollback').textContent = sold ? 'Annuler la vente' : 'Remettre en collection';
  saleEl('sale-lot-section').classList.toggle('hidden', sold);
  saleEl('sale-lot-toggle').checked = false;
  saleEl('sale-lot-toggle').setAttribute('aria-expanded','false');
  saleEl('sale-lot-options').classList.add('hidden');
  saleEl('sale-lot-options').replaceChildren();
  for(const other of CEMETERY.filter(g => g.saleStatus === 'pending' && g.id !== id)){
    const label = document.createElement('label');
    label.className = 'sale-lot-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = other.id;
    const copy = document.createElement('span');
    const name = document.createElement('span'); name.textContent = other.nom;
    const platform = document.createElement('small'); platform.textContent = other.plateforme;
    copy.append(name,platform);
    label.append(checkbox,copy);
    saleEl('sale-lot-options').appendChild(label);
  }
  saleEl('sale-lot-section').classList.toggle('hidden', sold || !saleEl('sale-lot-options').children.length);
  updateSaleAction();
  window.JTDDialogs.open('sale-modal-overlay', {onDismiss:closeSaleModal,initialFocus:'#sale-channel'});
  saleEl('sale-channel').focus();
}
function closeSaleModal(){ window.JTDDialogs.close('sale-modal-overlay'); saleEditingId = null; }
window.closeSaleModal = closeSaleModal;
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
  const item = CEMETERY.find(g => g.id === saleEditingId);
  if(!item) return;
  try{
    const estimatedPrice = readSalePrice('sale-estimate');
    const salePrice = readSalePrice('sale-price');
    const sold = item.saleStatus === 'sold' || salePrice !== null;
    const completed = item.saleStatus !== 'sold' && sold;
    if(sold && salePrice === null) throw new Error('Renseigne le prix réel de vente avant de valider.');
    const selected = saleEl('sale-lot-toggle').checked ? [...saleEl('sale-lot-options').querySelectorAll('input:checked')].map(input => input.value) : [];
    if(!sold && selected.length) throw new Error('Renseigne le prix réel du lot avant d’enregistrer.');
    const ids = item.saleStatus === 'sold' ? saleGroup(item).map(g => g.id) : [item.id, ...(sold ? selected : [])];
    const fields = {saleStatus:sold ? 'sold' : 'pending', saleChannel:saleEl('sale-channel').value || null};
    if(sold){
      Object.assign(fields, {salePrice, saleId:item.saleId || crypto.randomUUID(), saleOrder:completed ? CEMETERY.reduce((max,game)=>Math.max(max,game.saleOrder ?? 0),0) + 1 : (item.saleOrder ?? 0)});
    }
    const next = CEMETERY.map(g => ids.includes(g.id) ? {...g, ...fields, ...(g.id === item.id ? {estimatedPrice} : {})} : g);
    if(commitCemetery(next)){ closeSaleModal(); if(completed) setSaleView('sold'); showToast(sold ? 'Vente enregistrée.' : 'Informations enregistrées.'); }
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
  const moved = commitBoardTransfer('games', 'cemetery', item.id, {...item, saleStatus:'pending'});
  if(!moved) return;
  closeModal(); buildPlatformList(); render(); renderCemetery();
  showToast('« ' + item.nom + ' » mis en vente.', 'Annuler', () => restoreFromCemetery(item.id));
  goToPage('cemetery'); setSaleView('pending'); openSaleModal(item.id);
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
  if(item.saleStatus === 'pending'){ restoreFromCemetery(item.id); return; }
  const ids = saleGroup(item).map(g => g.id);
  confirmAction('Annuler cette vente' + (ids.length > 1 ? ' pour tout le lot' : '') + ' et remettre les jeux à vendre ?', () => {
    const next = CEMETERY.map(g => {
      if(!ids.includes(g.id)) return g;
      const draft = {...g, saleStatus:'pending'};
      delete draft.saleId; delete draft.salePrice; delete draft.saleOrder;
      return draft;
    });
    if(commitCemetery(next)){ closeSaleModal(); setSaleView('pending'); }
  });
});
function updateSaleAction(){
  const item = CEMETERY.find(g => g.id === saleEditingId);
  const isLot = item?.saleStatus === 'sold' ? saleGroup(item).length > 1 : saleEl('sale-lot-toggle').checked;
  saleEl('sale-price-label').textContent = isLot ? 'Prix réel du lot (€)' : 'Prix réel (€)';
  saleEl('sale-save').textContent = item?.saleStatus !== 'sold' && saleEl('sale-price').value.trim() ? 'Valider la vente' : 'Enregistrer';
}
saleEl('sale-lot-toggle').addEventListener('change', () => {
  const enabled = saleEl('sale-lot-toggle').checked;
  saleEl('sale-lot-options').classList.toggle('hidden', !enabled);
  saleEl('sale-lot-toggle').setAttribute('aria-expanded',String(enabled));
  if(!enabled) saleEl('sale-lot-options').querySelectorAll('input').forEach(input => { input.checked = false; });
  updateSaleAction();
});
saleEl('sale-price').addEventListener('input',updateSaleAction);
saleEl('sale-save').addEventListener('click', saveSale);
saleEl('sale-cancel').addEventListener('click', closeSaleModal);
saleEl('cemetery-order-toggle').addEventListener('click',()=>{
  reorderingSales = !reorderingSales;
  renderCemetery();
});
saleEl('cemetery-search').addEventListener('input', renderCemetery);
saleEl('cemetery-platform').addEventListener('change', renderCemetery);
document.querySelectorAll('[data-sale-view]').forEach(button => button.addEventListener('click', () => setSaleView(button.dataset.saleView)));
renderCemetery();


