/* Search and purchase history use the data already loaded for the current session. */
(() => {
  const byId = id => document.getElementById(id);
  const searchDialog = 'global-search-overlay';
  const searchInput = byId('global-search-input');
  const results = byId('global-search-results');
  const searchStatus = byId('global-search-status');
  const searchKey = JTDData.searchKey;
  const closeSearch = () => JTDDialogs.close(searchDialog);

  function search(){
    const query = searchKey(searchInput.value.trim());
    results.replaceChildren();
    if(!query){ searchStatus.textContent = ''; return; }
    const sources = [
      [GAMES, () => 'Collection', openModal],
      [ARRIVALS, () => 'Arrivages', openArrivalModal],
      [WISHLIST, () => 'Wishlist', openWishlistModal],
      [CEMETERY, item => item.saleStatus === 'sold' ? 'Ventes · Vendu' : 'Ventes · À vendre', openSaleModal],
      [window.getJournalSearchEntries(), item => 'Journal · '+item.location, window.openJournalEntry]
    ];
    const matches = [];
    for(const [items, location, open] of sources){
      for(const item of items){
        const title = searchKey(item.nom);
        const position = title.indexOf(query);
        if(position !== -1) matches.push({item, location, open, rank:title === query ? 0 : position === 0 ? 1 : 2});
      }
    }
    matches.sort((a,b) => a.rank-b.rank || a.item.nom.localeCompare(b.item.nom,'fr'));
    const limit = 30;
    searchStatus.textContent = matches.length === 0 ? 'Aucun jeu trouvé.'
      : matches.length > limit ? `${limit} résultats affichés sur ${matches.length}`
      : `${matches.length} résultat${matches.length > 1 ? 's' : ''}`;
    for(const {item, location, open} of matches.slice(0,limit)){
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'overview-search-result';
      const support = item.searchSupport ?? (JTDData.isDigital(item) ? 'Numérique' : 'Physique');
      const type = JTDData.isAddon(item) ? ' · '+contentKind(item) : '';
      button.innerHTML = `<strong>${escapeHTML(item.nom)}</strong><small>${[item.plateforme,support+type,location(item)].filter(Boolean).map(escapeHTML).join(' · ')}</small>`;
      button.addEventListener('click',()=>open(item.id));
      row.append(button);
      results.append(row);
    }
  }

  byId('global-search-open').addEventListener('click',()=>{
    searchInput.value = '';
    search();
    JTDDialogs.open(searchDialog,{onDismiss:closeSearch,initialFocus:'#global-search-input'});
  });
  byId('global-search-close').addEventListener('click',closeSearch);
  searchInput.addEventListener('input',search);
  searchInput.addEventListener('keydown',event=>{
    if(event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const choices = results.querySelectorAll('button');
    if(choices.length === 1) choices[0].click();
    else choices[0]?.focus();
  });

  for(const button of document.querySelectorAll('[data-open-board]')){
    button.addEventListener('click',()=>{
      const board = button.dataset.openBoard;
      closeSearch();
      setHomeBoard(board);
      goToPage('home');
      persistNavigation(true);
      byId(board === 'wishlist' ? 'add-wishlist-btn' : 'add-arrival-btn').focus();
    });
  }
  window.closeListSearch = closeSearch;

  const reportDialog = 'purchase-report-overlay';
  const year = byId('purchase-report-year');
  const report = byId('purchase-report-results');
  const closeReport = () => JTDDialogs.close(reportDialog);
  const purchases = () => [...GAMES,...CEMETERY];
  const purchaseYear = item => /^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/.exec(item.date || '')?.[1];
  const totals = items => {
    const sums = new Map();
    for(const item of items){
      if(item.prix == null) continue;
      const currency = item.currency || 'EUR';
      sums.set(currency,(sums.get(currency) || 0) + item.prix);
    }
    return [...sums].sort(([a],[b])=>a.localeCompare(b))
      .map(([currency,prix])=>escapeHTML(purchaseMoney({currency,prix}))).join(' · ') || '—';
  };
  const quantity = count => `${count} achat${count > 1 ? 's' : ''}`;
  function renderReport(){
    const all = purchases();
    const undated = all.filter(item=>!purchaseYear(item)).length;
    const excluded = undated ? '<p class="overview-note">'+quantity(undated)+' sans date, hors bilan annuel.</p>' : '';
    const items = all.filter(item => purchaseYear(item) === year.value);
    if(!items.length){ report.innerHTML = '<p class="overview-note">Aucun achat daté pour cette année.</p>'+excluded; return; }
    const platforms = new Map();
    for(const item of items){
      if(!platforms.has(item.plateforme)) platforms.set(item.plateforme,[]);
      platforms.get(item.plateforme).push(item);
    }
    const missing = items.filter(item=>item.prix == null).length;
    report.innerHTML = `<div class="purchase-report-total"><span>${quantity(items.length)}</span><strong>${totals(items)}</strong></div>
      <ul class="overview-list">${[...platforms].sort(([a],[b])=>a.localeCompare(b,'fr')).map(([platform,games])=>
        `<li class="purchase-report-platform"><span><strong>${escapeHTML(platform)}</strong><small>${quantity(games.length)}</small></span><span>${totals(games)}</span></li>`
      ).join('')}</ul>${missing ? `<p class="overview-note">${quantity(missing)} sans prix renseigné.</p>` : ''}${excluded}`;
  }
  byId('home-summary-meta').addEventListener('click',event=>{
    if(!event.target.closest('#purchase-report-open')) return;
    const currentYear = String(new Date().getFullYear());
    const years = [...new Set([currentYear,...purchases().map(purchaseYear).filter(Boolean)])].sort().reverse();
    year.replaceChildren(...years.map(value=>new Option(value,value)));
    year.value = currentYear;
    renderReport();
    JTDDialogs.open(reportDialog,{onDismiss:closeReport,initialFocus:'#purchase-report-year'});
  });
  year.addEventListener('change',renderReport);
  byId('purchase-report-close').addEventListener('click',closeReport);
})();
