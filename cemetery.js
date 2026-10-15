/* Collection exits retain their acquisition record. A shared saleId represents one sale/lot. */
let saleView = 'pending';
let saleEditingId = null;
const saleEl = id => document.getElementById(id);
function saleGroup(item){
  return item.saleStatus === 'sold' && item.saleId
    ? CEMETERY.filter(g => g.saleStatus === 'sold' && g.saleId === item.saleId) : [item];
}
function updateCemeteryStats(){
  const pending = CEMETERY.filter(game => game.saleStatus === 'pending');
  const sold = CEMETERY.filter(game => game.saleStatus === 'sold');
  const sales = new Map();
  for(const game of sold) sales.set(game.saleId || game.id, Number(game.salePrice) || 0);
  saleEl('cemetery-stat-sales').textContent = euros([...sales.values()].reduce((sum, price) => sum + price, 0));
  saleEl('cemetery-stat-estimated').textContent = euros(pending.reduce((sum, game) => sum + (Number(game.estimatedPrice) || 0), 0));
  saleEl('cemetery-stat-sold-count').textContent = String(sold.length);
  saleEl('cemetery-stat-pending-count').textContent = String(pending.length);
}
function renderCemetery(){
  const container = saleEl('cemetery-list');
  if(!container) return;
  updateCemeteryStats();
  const platform = saleEl('cemetery-platform').value;
  const platforms = [...new Set(CEMETERY.map(g => g.plateforme))].sort();
  saleEl('cemetery-platform').innerHTML = '<option value="">Toutes les plateformes</option>' + platforms.map(p => '<option>' + escapeHTML(p) + '</option>').join('');
  saleEl('cemetery-platform').value = platforms.includes(platform) ? platform : '';
  const search = saleEl('cemetery-search').value.trim().toLocaleLowerCase('fr');
  const matches = g => (!platform || g.plateforme === platform) && (!search || g.nom.toLocaleLowerCase('fr').includes(search));
  const items = CEMETERY.filter(g => g.saleStatus === saleView);
  const groups = [];
  const seen = new Set();
  for(const item of items){
    const key = item.saleStatus === 'sold' ? (item.saleId || item.id) : item.id;
    if(seen.has(key)) continue;
    seen.add(key);
    const group = saleGroup(item);
    if(group.some(matches)) groups.push(group);
  }
  if(saleView === 'sold') groups.sort((a,b) => (b[0].saleOrder || 0) - (a[0].saleOrder || 0));
  container.classList.toggle('pending-sales', saleView === 'pending');
  container.replaceChildren();
  if(!groups.length){ container.innerHTML = '<div class="cemetery-empty">Aucun jeu ici pour le moment.</div>'; return; }
  for(const group of groups){
    const item = group[0];
    const block = document.createElement('section');
    block.className = 'sale-group';
    const venue = item.saleChannel === 'online' ? 'En ligne' : item.saleChannel === 'store' ? 'En boutique' : 'Canal à définir';
    const amount = saleView === 'sold' ? item.salePrice : item.estimatedPrice;
    block.innerHTML = '<div class="sale-group-heading"><div class="sale-heading-main"><strong class="sale-amount">' + (amount != null ? euros(amount) : '—') + '</strong></div><div class="sale-venue">' + escapeHTML(venue) + '</div></div>';
    const cards = document.createElement('div');
    cards.className = 'sale-cards';
    for(const g of group){
      const card = renderCard(g, {readOnly:true, onOpen:() => openSaleModal(g.id)});
      card.classList.add('sale-game');
      // Explicit field siblings keep date, source and price in a stable order.
      const purchase = card.querySelector('.card-purchase');
      if(purchase) purchase.replaceWith(...purchase.childNodes);
      cards.appendChild(card);
    }
    block.appendChild(cards);
    container.appendChild(block);
  }
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
  saleEl('sale-modal-title').textContent = sold ? (group.length > 1 ? 'Modifier cette vente en lot' : 'Modifier cette vente') : 'Préparer la vente';
  renderSaleIdentity(group);
  saleEl('sale-channel').value = item.saleChannel || '';
  saleEl('sale-estimate').value = item.estimatedPrice ?? '';
  saleEl('sale-price').value = item.salePrice ?? '';
  saleEl('sale-error').textContent = '';
  saleEl('sale-rollback').textContent = sold ? 'Annuler la vente' : 'Remettre en collection';
  saleEl('sale-lot-section').classList.toggle('hidden', sold);
  saleEl('sale-lot-options').replaceChildren();
  for(const other of CEMETERY.filter(g => g.saleStatus === 'pending' && g.id !== id)){
    const label = document.createElement('label');
    label.className = 'sale-lot-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = other.id;
    label.append(checkbox, document.createTextNode(other.nom + ' · ' + other.plateforme));
    saleEl('sale-lot-options').appendChild(label);
  }
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
    const selected = [...saleEl('sale-lot-options').querySelectorAll('input:checked')].map(input => input.value);
    if(!sold && selected.length) throw new Error('Renseigne le prix réel du lot avant d’enregistrer.');
    const ids = item.saleStatus === 'sold' ? saleGroup(item).map(g => g.id) : [item.id, ...(sold ? selected : [])];
    const fields = {saleStatus:sold ? 'sold' : 'pending', saleChannel:saleEl('sale-channel').value || null};
    if(sold){
      Object.assign(fields, {salePrice, saleId:item.saleId || crypto.randomUUID(), saleOrder:item.saleOrder ?? (Math.max(0,...CEMETERY.map(g => g.saleOrder || 0)) + 1)});
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
  if(!item) return;
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
saleEl('sale-save').addEventListener('click', saveSale);
saleEl('sale-cancel').addEventListener('click', closeSaleModal);
saleEl('cemetery-search').addEventListener('input', renderCemetery);
saleEl('cemetery-platform').addEventListener('change', renderCemetery);
document.querySelectorAll('[data-sale-view]').forEach(button => button.addEventListener('click', () => setSaleView(button.dataset.saleView)));
renderCemetery();
