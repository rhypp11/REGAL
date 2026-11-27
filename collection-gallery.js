function collectionGameVersions(game){
  if(!window.RGLGallery?.active || !game.gameGroup || JTDData.isAddon(game)) return [game];
  return GAMES.filter(copy => copy.gameGroup === game.gameGroup && !JTDData.isAddon(copy));
}

(() => {
  if(!window.RGL_GALLERY_ENABLED) return;
  const byId = id => document.getElementById(id);
  const controls = byId('collection-gallery-controls');
  const display = byId('gallery-display');
  const group = byId('gallery-group');
  const purchaseSection = byId('gallery-sheet-purchases');
  const actionSlot = byId('gallery-sheet-actions');
  const back = byId('gallery-sheet-back');
  const overlay = byId('modal-overlay');
  const sheetGame = () => GAMES.find(game => game.id === editingId);
  const groupKey = game => game.gameGroup && !JTDData.isAddon(game) ? 'group:'+game.gameGroup : 'purchase:'+game.id;
  const platformOf = game => JTDData.effectivePlatform(game,GAMES);
  const formatOf = game => JTDData.isAddon(game) ? contentKind(game) : JTDData.isDigital(game) ? 'Numérique' : 'Physique';
  const shortPlatform = name => name.replace(/^PlayStation\s*(\d+)$/i,'PS$1').replace(/^Nintendo /i,'');
  const settings = [display,group];
  for(const field of settings){
    try{
      const value=localStorage.getItem('rgl:'+field.id);
      if([...field.options].some(option=>option.value===value)) field.value=value;
    }catch{}
    field.addEventListener('change',()=>{
      try{localStorage.setItem('rgl:'+field.id,field.value);}catch{}
      render();
    });
  }
  controls.classList.remove('hidden');
  byId('collection-view-switch').classList.add('hidden');
  back.addEventListener('click',closeModal);

  function platformMark(platform){
    const logo=safeURL(getPlatformLogo(platform),true);
    return '<span class="gallery-platform" title="'+escapeHTML(platform)+'" aria-label="'+escapeHTML(platform)+'">'+
      (logo ? '<img src="'+escapeHTML(logo)+'" alt="">' : escapeHTML(shortPlatform(platform)))+'</span>';
  }
  function renderTile(game, copies, loading){
    const card=renderCard(game,{imageLoading:loading,onOpen:()=>openModal(game.id)});
    const marks=document.createElement('div');
    marks.className='gallery-marks';
    const identities=new Map(copies.map(copy=>[platformOf(copy)+'|'+formatOf(copy),copy]));
    marks.innerHTML=[...identities.values()].map(copy=>{
      const format=formatOf(copy);
      const icon=JTDData.isAddon(copy) ? contentIcon(copy) : MEDIA_ICONS[JTDData.isDigital(copy)?'digital':'physical'];
      return '<span class="gallery-mark">'+platformMark(platformOf(copy))+
        '<span class="gallery-format" title="'+escapeHTML(format)+'" aria-label="'+escapeHTML(format)+'">'+icon+'</span></span>';
    }).join('');
    card.querySelector('.card-identity').append(marks);
    return card;
  }
  function renderGallery(grid,games){
    grid.dataset.view='rgl';
    const sections=new Map();
    const statusLabels=new Map(STATUS_OPTIONS.map(option=>[option.key,option.label]));
    for(const game of games){
      const section = group.value==='platform' ? platformOf(game)
        : group.value==='status' ? statusLabels.get(getEffectiveStatus(game)) || 'Sans statut' : '';
      if(!sections.has(section)) sections.set(section,new Map());
      const tiles=sections.get(section);
      const key=display.value==='copies' ? game.id : groupKey(game);
      if(!tiles.has(key)) tiles.set(key,[]);
      tiles.get(key).push(game);
    }
    let index=0;
    for(const [label,tiles] of sections){
      const section=document.createElement('section');
      section.className='gallery-group';
      if(label){
        const heading=document.createElement('h2');
        heading.textContent=label;
        section.append(heading);
      }
      const row=document.createElement('div');
      row.className='gallery-grid';
      for(const copies of tiles.values()){
        const game=copies.find(copy=>copy.squareImage) || copies[0];
        row.append(renderTile(game,copies,navigationPage==='collection' && index++<12?'eager':'lazy'));
      }
      section.append(row);
      grid.append(section);
    }
    return true;
  }

  function editPurchase(copy){
    openModal(copy.id);
    editCollectionSheet('f-prix');
  }
  function saveGroup(next,id){
    if(!commitCollection(next)) return;
    render();
    openModal(id);
  }
  function detach(copy){
    confirmAction('Cet achat ouvrira sa propre fiche. Son statut et ses contenus rattachés seront repris.',()=>{
      saveGroup(GAMES.map(game=>game.id===copy.id?{...game,gameGroup:null}:game),copy.id);
    },{title:'Dissocier cet exemplaire ?',confirmLabel:'Dissocier'});
  }
  function openGrouping(){
    const panel=byId('gallery-link-panel');
    if(!panel) return;
    panel.open=true;
    panel.querySelector('input').focus();
  }
  function groupingPanel(game){
    const panel=document.createElement('details');
    panel.id='gallery-link-panel';
    panel.innerHTML='<summary>Regrouper avec un jeu</summary><div class="gallery-link-form">'+
      '<label>Rechercher <input type="search" placeholder="Titre du jeu"></label>'+
      '<label>Jeu à regrouper <select><option value="">Choisir un autre achat</option></select></label>'+
      '<label class="hidden">Statut commun <select></select></label>'+
      '<button type="button" class="btn btn-primary" disabled>Regrouper</button></div>';
    const search=panel.querySelector('input');
    const [target,status]=panel.querySelectorAll('select');
    const submit=panel.querySelector('button');
    const optionsFor=selected=>{
      const possible=[game.status || null,selected?.status || null];
      const choices=[...new Set(possible)];
      status.replaceChildren(...choices.map(key=>new Option(STATUS_OPTIONS.find(item=>item.key===key)?.label || 'Sans statut',key || '')));
      status.parentElement.classList.toggle('hidden',!selected || choices.length===1);
      submit.disabled=!selected;
    };
    search.addEventListener('input',()=>{
      const needle=JTDData.searchKey(search.value.trim());
      const choices=needle ? GAMES.filter(candidate=>!JTDData.isAddon(candidate) &&
        groupKey(candidate)!==groupKey(game) && JTDData.searchKey(candidate.nom+' '+candidate.plateforme).includes(needle)).slice(0,30) : [];
      target.replaceChildren(new Option('Choisir un autre achat',''),...choices.map(candidate=>new Option(candidate.nom+' · '+candidate.plateforme,candidate.id)));
      optionsFor(null);
    });
    target.addEventListener('change',()=>optionsFor(GAMES.find(item=>item.id===target.value)));
    submit.addEventListener('click',()=>{
      const selected=GAMES.find(item=>item.id===target.value);
      const current=sheetGame();
      if(!selected || !current || groupKey(selected)===groupKey(current)) return;
      const ids=new Set([...collectionGameVersions(current),...collectionGameVersions(selected)].map(copy=>copy.id));
      const gameGroup=selected.gameGroup || current.gameGroup || crypto.randomUUID();
      saveGroup(GAMES.map(copy=>ids.has(copy.id)?{...copy,gameGroup,status:status.value || null}:copy),current.id);
    });
    return panel;
  }
  function clearSheet(){
    overlay.classList.remove('gallery-sheet','gallery-sheet-purchases-visible');
    purchaseSection.classList.add('hidden');
    purchaseSection.replaceChildren();
    back.classList.add('hidden');
    actionSlot.replaceChildren();
  }
  function renderSheet(game){
    clearSheet();
    if(!game) return;
    overlay.classList.add('gallery-sheet');
    back.classList.remove('hidden');
    const existingMenu=byId('f-game-actions');
    if(existingMenu) actionSlot.append(existingMenu);
    if(JTDData.isAddon(game)) return;
    const copies=collectionGameVersions(game);
    const canonical=copies[0];
    const art=copies.find(copy=>copy.image) || canonical;
    const identity=byId('f-identity-summary');
    identity.innerHTML=identitySummaryHtml({...art,nom:canonical.nom});
    identity.querySelector('.identity-edit-btn')?.remove();
    const heading=document.createElement('h3');
    heading.className='form-section-title';
    heading.textContent='Jeu / Achats';
    purchaseSection.append(heading);
    for(const copy of copies){
      const row=document.createElement('div');
      row.className='gallery-purchase-row';
      const button=document.createElement('button');
      button.type='button';
      button.innerHTML=platformMark(copy.plateforme)+'<strong>'+escapeHTML(shortPlatform(copy.plateforme)+' · '+formatOf(copy))+'</strong>'+
        '<small>'+escapeHTML([copy.prix!=null?purchaseMoney(copy):'',copy.date?dateFR(copy.date):''].filter(Boolean).join(' · '))+'</small>';
      button.title='Modifier cet achat';
      button.onclick=()=>editPurchase(copy);
      row.append(button);
      if(copies.length>1) row.append(sheetActions([['Modifier cet achat',()=>editPurchase(copy),null,'edit'],['Dissocier cet exemplaire',()=>detach(copy),null,'link']]));
      purchaseSection.append(row);
    }
    purchaseSection.append(groupingPanel(game));
    purchaseSection.classList.remove('hidden');
    overlay.classList.add('gallery-sheet-purchases-visible');
    const statusSection=byId('f-sheet-status');
    const statusHeading=statusSection.querySelector('h3');
    if(statusHeading) statusHeading.textContent='Complétion';
    const selector=document.createElement('select');
    selector.setAttribute('aria-label','Statut de complétion');
    selector.replaceChildren(new Option('Sans statut',''),...STATUS_OPTIONS.map(item=>new Option(item.label,item.key)));
    selector.value=getEffectiveStatus(game) || '';
    selector.addEventListener('change',()=>{
      setStatus(game.id,selector.value || null);
      openModal(game.id);
    });
    statusSection.append(selector);
  }
  window.RGLGallery={active:true,render:renderGallery,sheet:renderSheet,clearSheet(){
    overlay.classList.remove('gallery-sheet-purchases-visible');
    clearSheet();
  },openGrouping};
  if(IS_PREVIEW_MODE) render();
})();
