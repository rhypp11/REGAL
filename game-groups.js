/* Copies remain independent acquisition records; grouping only adds an explicit key. */
function copyPlatform(game){ return JTDData.effectivePlatform(game,GAMES); }
function copyPlatformShort(name){return /^(?:Nintendo )?Switch 2$/i.test(name)?'SW2':/^(?:Nintendo )?Switch(?: 1)?$/i.test(name)?'SW':/^PlayStation ?[1-5]$/i.test(name)?name.replace(/PlayStation ?/i,'PS'):name;}
function copyPlatformHtml(name){
  return '<span class="copy-platform card-platform" title="'+escapeHTML(name)+'">'+getPlatformOptionIconHtml(name)+'<span class="copy-platform-name"><span class="copy-platform-long">'+escapeHTML(name)+'</span><span class="copy-platform-short">'+escapeHTML(copyPlatformShort(name))+'</span></span></span>';
}
function copyCounter(count,type){
  if(!count)return '';
  const label=count+' '+(type==='dlc'?'DLC':'mise'+(count>1?'s':'')+' à niveau');
  return '<span class="copy-content-count copy-count-'+type+'" title="'+label+'" aria-label="'+label+'"><span>'+count+'</span>'+MEDIA_ICONS[type]+'</span>';
}
function decorateCopyCard(card,entry){
  const identity=card.querySelector('.card-identity'),control=identity.querySelector('.card-status-control');
  const copies=GAMES.filter(copy=>(entry._copyIds || [entry.id]).includes(copy.id));
  if(!copies.length)copies.push(entry);
  const platforms=[...new Set(copies.map(copyPlatform))];
  const rows=document.createElement('div');rows.className='copy-platform-rows';
  for(const platform of platforms){
    const matches=copies.filter(copy=>copyPlatform(copy)===platform),ids=new Set(matches.map(copy=>copy.id));
    const contents=GAMES.filter(child=>ids.has(JTDData.contentParent(child,GAMES)?.id));
    const formats=[...new Set(matches.map(copy=>JTDData.isDigital(copy)?'digital':'physical'))];
    const row=document.createElement('div');row.className='copy-platform-row';
    row.innerHTML=copyPlatformHtml(platform)+'<span class="copy-media">'+formats.map(format=>'<span class="copy-media-tag card-media-mark" title="'+(format==='digital'?'Numérique':'Physique')+'">'+MEDIA_ICONS[format]+'<span class="copy-media-name">'+(format==='digital'?'Numérique':'Physique')+'</span></span>').join('')+'</span>'+copyCounter(contents.filter(JTDData.isDLC).length,'dlc')+copyCounter(contents.filter(child=>child.contentType==='upgrade').length,'upgrade');
    const purchases=document.createElement('div');purchases.className='copy-line-purchases';
    for(const copy of matches){
      const line=document.createElement('div');line.className='copy-line-purchase';line.dataset.purchaseId=copy.id;
      const format=JTDData.isDigital(copy)?'digital':'physical';
      line.innerHTML='<span class="copy-line-format">'+MEDIA_ICONS[format]+'<span>'+(format==='digital'?'Numérique':'Physique')+'</span></span><span class="copy-line-price">'+escapeHTML(purchaseMoney(copy))+'</span><time>'+escapeHTML(copy.date?dateFR(copy.date):'—')+'</time>'+(copy.source?'<span class="copy-line-source">'+escapeHTML(copy.source)+'</span>':'');
      purchases.appendChild(line);
    }
    row.appendChild(purchases);rows.appendChild(row);
  }
  identity.replaceChildren(rows);
  card.classList.add('copy-card');
  if(control){const footer=document.createElement('div');footer.className='card-state-row copy-status-footer';
    const count=document.createElement('span');count.className='copy-count';count.textContent=!JTDData.isAddon(entry)&&copies.length>1?copies.length+' exemplaires':'';
    footer.append(count,control);card.querySelector('.card-body').appendChild(footer);
  }
  card.querySelector('.card-list-details')?.remove();
  if(copies.length>1){
    const acquisition=card.querySelector('.card-acquisition');if(acquisition && state.sort.startsWith('price-'))acquisition.innerHTML='<span class="card-sort-label">Achats des exemplaires</span><span class="card-price">'+copyPrices(copies)+'</span>';
  }
}
function copyPrices(copies){const sums=new Map();for(const copy of copies)if(copy.prix!=null)sums.set(copy.currency||'EUR',(sums.get(copy.currency||'EUR')||0)+copy.prix);return [...sums].map(([currency,prix])=>escapeHTML(purchaseMoney({currency,prix}))).join(' + ') || '—';}
function copyCandidates(){
  const input=document.getElementById('f-copy-search'),container=document.getElementById('f-copy-candidates');
  const query=JTDData.searchKey(input.value.trim());container.replaceChildren();
  const owned=GAMES.find(game=>game.id===editingId);
  const candidates=JTDData.uniqueGames(GAMES.filter(game=>!JTDData.isAddon(game)&&game.id!==editingId && (!owned?.gameGroupId || game.gameGroupId!==owned.gameGroupId) && query && JTDData.searchKey(game.nom).includes(query)));
  for(const game of candidates.slice(0,8)){
    const button=document.createElement('button');button.type='button';button.className='parent-search-result';button.dataset.copyTarget=game.id;button.innerHTML=relatedGameHtml(game);
    button.onclick=()=>{document.getElementById('f-copy-target').value=game.id;input.value='';container.replaceChildren();renderCopySelection();};container.appendChild(button);
  }
}
function renderCopySelection(){
  const container=document.getElementById('f-copy-selection'),target=GAMES.find(game=>game.id===document.getElementById('f-copy-target').value);
  container.replaceChildren();container.classList.toggle('hidden',!target);if(!target)return;
  const label=document.createElement('p');label.textContent='Même jeu que « '+target.nom+' » · statut commun : '+(STATUS_OPTIONS.find(option=>option.key===getEffectiveStatus(target))?.label || 'Sans statut');
  const clear=document.createElement('button');clear.type='button';clear.className='manage-link';clear.textContent='Garder cet exemplaire séparé';clear.onclick=()=>{document.getElementById('f-copy-target').value='';renderCopySelection();document.getElementById('f-copy-search').focus();};container.append(label,clear);
}
function openCopyFields(game){
  const options=document.getElementById('f-copy-options');options.open=false;
  options.classList.toggle('hidden',editingCollection!=='games' || !!convertingArrivalId || (document.getElementById('f-media').value==='digital' && document.getElementById('f-content-type').value!=='game'));
  document.getElementById('f-copy-search').value='';document.getElementById('f-copy-candidates').replaceChildren();
  const other=game?JTDData.gameCopies(game,GAMES).find(copy=>copy.id!==game.id):null;
  document.getElementById('f-copy-target').value=other?.id || '';renderCopySelection();renderCopyDetails(game);
}
function readCopyFields(games,id){
  const copy=games.find(game=>game.id===id);if(JTDData.isAddon(copy))return games.map(game=>game.id===id?{...game,gameGroupId:null}:game);
  return JTDData.linkGameCopies(games,id,document.getElementById('f-copy-target').value,crypto.randomUUID());
}
function renderCopyDetails(game){
  const container=document.getElementById('f-copy-details');container.replaceChildren();
  document.getElementById('modal-overlay').classList.toggle('copy-sheet-group',!!game && !JTDData.isAddon(game) && JTDData.gameCopies(game,GAMES).length>1);
  if(!game || JTDData.isAddon(game) || editingCollection!=='games')return;
  const copies=JTDData.gameCopies(game,GAMES);
  const add=document.createElement('button');add.type='button';add.className='manage-link copy-add';add.textContent='Ajouter un exemplaire';
  add.onclick=()=>withBoardEditorChanges('modal-overlay','f',()=>{openModal(null);document.getElementById('f-nom').value=game.nom;document.getElementById('f-copy-target').value=game.id;renderCopySelection();});
  if(copies.length===1){container.appendChild(add);return;}
  const heading=document.createElement('div');heading.className='copy-section-heading';heading.innerHTML='<h3>Exemplaires</h3>';heading.appendChild(add);container.appendChild(heading);
  for(const copy of copies){
    const section=document.createElement('section');section.className='copy-exemplar';section.dataset.exemplarId=copy.id;
    const button=document.createElement('button');button.type='button';button.className='content-purchase-link copy-purchase-link';button.dataset.copyId=copy.id;
    button.innerHTML='<span class="copy-purchase-info"><strong>'+copyPlatformHtml(copyPlatform(copy))+'</strong><span>'+escapeHTML((JTDData.isDigital(copy)?'Numérique':'Physique')+(copy.collector?' · Collector':'')+(copy.japanese?' · Japonais':'')+(copy.date?' · '+dateFR(copy.date):''))+'</span>'+(copy.source?'<small>'+escapeHTML(copy.source)+'</small>':'')+(copyPlatform(copy)!==copy.plateforme?'<small>Achat d’origine : '+escapeHTML(copy.plateforme)+'</small>':'')+'</span><span class="content-related-price">'+escapeHTML(purchaseMoney(copy))+'</span>';
    button.setAttribute('aria-label','Modifier cet exemplaire : '+copy.plateforme+' · '+(JTDData.isDigital(copy)?'Numérique':'Physique'));
    button.onclick=()=>withBoardEditorChanges('modal-overlay','f',()=>{if(copy.id!==editingId)openModal(copy.id);document.querySelector('#f-identity-summary .identity-edit-btn')?.click();});section.appendChild(button);
    const children=GAMES.filter(child=>JTDData.contentParent(child,GAMES)?.id===copy.id);
    if(children.length){
      const title=document.createElement('div');title.className='copy-linked-title';title.textContent='Contenus liés · '+children.length;section.appendChild(title);
      for(const child of children)section.appendChild(linkedContentButton(child));
      const total=document.createElement('div');total.className='content-purchase-total';total.textContent='Total avec contenus : ';total.innerHTML+=copyPrices([copy,...children]);section.appendChild(total);
    }
    container.appendChild(section);
  }
}
document.getElementById('f-copy-search').addEventListener('input',copyCandidates);
document.getElementById('f-nom').addEventListener('input',()=>{
  if(editingId || document.getElementById('f-copy-options').classList.contains('hidden'))return;
  const name=document.getElementById('f-nom').value.trim();
  if(name.length<3)return;
  if(GAMES.some(game=>!JTDData.isAddon(game) && JTDData.searchKey(game.nom)===JTDData.searchKey(name))){
    document.getElementById('f-copy-options').open=true;document.getElementById('f-copy-search').value=name;copyCandidates();
  }
});

function groupedPreviewGames(){
  const common={nom:'Aventure des saisons — exemplaires démo',gameGroupId:'demo-shared-game',status:'termine',image:new URL('preview-assets/garden.svg',location.href).href};
  return [
    {...common,id:'demo-copy-switch',plateforme:'Switch',format:'Physique',prix:39.99,date:'2020-03-20'},
    {...common,id:'demo-copy-digital',plateforme:'Switch',format:'Numérique',prix:29.99,date:'2021-02-10'},
    {...common,id:'demo-copy-ps4',plateforme:'PlayStation 4',format:'Physique',prix:19.99,date:'2023-04-15'},
    {id:'demo-copy-dlc',nom:'Les îles des saisons — DLC démo',plateforme:'Switch',format:'Numérique',contentType:'dlc',parentId:'demo-copy-digital',status:'a_jouer',prix:12.99},
    {id:'demo-copy-upgrade',nom:'Aventure des saisons — Switch 2 Edition démo',plateforme:'Switch 2',format:'Numérique',contentType:'upgrade',parentId:'demo-copy-digital',prix:4.99}
  ];
}

function navigateGameSheet(id){withBoardEditorChanges('modal-overlay','f',()=>openModal(id));}

function updateCopyHeading(viewing){
  const game=GAMES.find(game=>game.id===editingId);if(!game || JTDData.isAddon(game))return;
  const copies=JTDData.gameCopies(game,GAMES);if(copies.length<2)return;
  const heading=document.getElementById('f-format-title');heading.dataset.kind='game';
  const digital=document.getElementById('f-media').value==='digital';
  heading.innerHTML=viewing?MEDIA_ICONS.game+'<span>Jeu · '+copies.length+' exemplaires</span>':MEDIA_ICONS[digital?'digital':'physical']+'<span>'+(digital?'Numérique':'Physique')+'</span>';
}
