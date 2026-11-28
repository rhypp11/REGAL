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
  let preferredGroup=group.value;
  for(const field of settings){
    try{
      const value=localStorage.getItem('rgl:'+field.id);
      if([...field.options].some(option=>option.value===value)) field.value=value;
    }catch{}
    if(field===group) preferredGroup=field.value;
    field.addEventListener('change',()=>{
      if(field===group) preferredGroup=field.value;
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
    const singlePlatform=!!state.platform;
    group.querySelector('[value="platform"]').disabled=singlePlatform;
    group.value=singlePlatform && preferredGroup==='platform' ? 'none' : preferredGroup;
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
  function groupingPanel(game){
    const panel=document.createElement('div');
    panel.id='gallery-link-panel';
    panel.className='hidden';
    panel.innerHTML='<div class="gallery-link-form">'+
      '<label>Rechercher <input type="search" placeholder="Titre du jeu"></label>'+
      '<label>Jeu à regrouper <select><option value="">Choisir un autre achat</option></select></label>'+
      '<label class="hidden">Statut commun <select></select></label>'+
      '<div class="gallery-link-actions"><button type="button" class="btn btn-ghost">Annuler</button><button type="button" class="btn btn-primary" disabled>Associer</button></div></div>';
    const search=panel.querySelector('input');
    const [target,status]=panel.querySelectorAll('select');
    const [cancel,submit]=panel.querySelectorAll('button');
    cancel.onclick=()=>{
      panel.classList.add('hidden');
      byId('f-game-actions')?.querySelector('summary').focus();
    };
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
  function appendActions(topMenu,actions){
    const buttons=sheetActions(actions).querySelectorAll('.sheet-actions-list button');
    for(const button of buttons){
      const invoke=button.onclick;
      button.onclick=()=>{
        topMenu.open=false;
        topMenu.querySelector('summary').focus({preventScroll:true});
        invoke();
      };
      const list=topMenu.querySelector('.sheet-actions-list');
      list.insertBefore(button,list.querySelector('.sheet-action-danger'));
    }
  }
  function addPurchaseActions(topMenu,copies){
    if(copies.length<2) return;
    appendActions(topMenu,copies.map(copy=>[
      'Dissocier · '+shortPlatform(copy.plateforme)+' · '+formatOf(copy),()=>detach(copy),null,'link'
    ]));
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
    if(existingMenu) addPurchaseActions(existingMenu,copies);
    const identity=byId('f-identity-summary');
    identity.innerHTML=identitySummaryHtml({...art,nom:canonical.nom});
    identity.querySelector('.identity-edit-btn')?.remove();
    const heading=document.createElement('h3');
    heading.className='form-section-title';
    heading.textContent='Jeu';
    purchaseSection.append(heading,groupingPanel(game));
    for(const copy of copies){
      const row=document.createElement('div');
      row.className='gallery-purchase-row';
      const info=document.createElement('div');
      info.className='gallery-purchase-info';
      const format=formatOf(copy);
      const formatIcon=MEDIA_ICONS[JTDData.isDigital(copy)?'digital':'physical'];
      info.innerHTML='<div class="gallery-purchase-title">'+platformMark(copy.plateforme)+
        '<strong>'+escapeHTML(copy.plateforme)+'</strong><span class="gallery-purchase-format">'+formatIcon+escapeHTML(format)+'</span></div>';
      const fields=[
        ['Prix',copy.prix!=null?purchaseMoney(copy):''],
        ['Date d’achat',copy.date?dateFR(copy.date):''],
        ['Enseigne',copy.source]
      ].filter(([,value])=>value);
      if(fields.length){
        const details=document.createElement('dl');
        details.className='gallery-purchase-details';
        details.innerHTML=fields.map(([label,value])=>'<div><dt>'+escapeHTML(label)+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('');
        info.append(details);
      }
      const edit=document.createElement('button');
      edit.type='button';
      edit.className='gallery-purchase-edit';
      edit.title='Modifier cet achat';
      edit.setAttribute('aria-label','Modifier cet achat · '+copy.plateforme+' · '+format);
      edit.innerHTML=contextEditIcon();
      edit.onclick=()=>editPurchase(copy);
      row.append(info,edit);
      purchaseSection.append(row);
    }
    purchaseSection.classList.remove('hidden');
    overlay.classList.add('gallery-sheet-purchases-visible');
    const statusSection=byId('f-sheet-status');
    const statusHeading=statusSection.querySelector('h3');
    if(statusHeading) statusHeading.textContent='Complétion';
    const statusPanel=statusSection.querySelector('.game-status-panel');
    const original=statusPanel?.querySelector('.game-sheet-status');
    if(!original) return;
    const change=key=>{
      if(key!==(getEffectiveStatus(GAMES.find(copy=>copy.id===game.id)) || null)) setStatus(game.id,key);
      updateTag();
      tag.focus({preventScroll:true});
    };
    const menu=sheetActions([
      ...STATUS_OPTIONS.map(option=>[option.label,()=>change(option.key)]),
      ['Sans statut',()=>change(null)]
    ]);
    menu.classList.add('gallery-completion-menu');
    menu.querySelectorAll('button').forEach((button,index)=>{
      const status=STATUS_OPTIONS[index];
      const icon=document.createElement('span');
      icon.className='gallery-status-symbol';
      icon.innerHTML=status?.icon || '—';
      button.prepend(icon);
      button.style.setProperty('--choice-color',status?.color || 'var(--ui-text-muted)');
      button.style.setProperty('--choice-bg',status?.bg || 'var(--ui-surface)');
      button.style.setProperty('--choice-border',status?.border || 'var(--ui-border)');
    });
    const tag=menu.querySelector('summary');
    tag.className='game-sheet-status';
    function updateTag(){
      const current=GAMES.find(copy=>copy.id===game.id);
      const key=current ? getEffectiveStatus(current) || null : null;
      const status=STATUS_OPTIONS.find(option=>option.key===key);
      tag.style.setProperty('--status-color',status?.color || 'var(--ui-text-muted)');
      tag.style.setProperty('--status-fill',status?.fill || 'var(--ui-border)');
      tag.innerHTML=(status?.icon || '')+'<span>'+escapeHTML(status?.label || 'Sans statut')+'</span><svg class="gallery-status-chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 6 4 4 4-4"/></svg>';
      tag.setAttribute('aria-label','Modifier le statut de complétion · '+(status?.label || 'Sans statut'));
      menu.querySelectorAll('button').forEach((button,index)=>{
        button.setAttribute('aria-pressed',String((STATUS_OPTIONS[index]?.key || null)===key));
      });
    }
    updateTag();
    original.replaceWith(menu);
  }
  window.RGLGallery={active:true,render:renderGallery,sheet:renderSheet,clearSheet,
    openGrouping(){
      const panel=byId('gallery-link-panel');
      if(!panel) return;
      panel.classList.remove('hidden');
      panel.querySelector('input').focus();
    }
  };
  if(IS_PREVIEW_MODE) render();
})();
