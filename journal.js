/* The active journal is a versioned entry in the private backup archive. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = escapeHTML;
  const marker = entry => entry?.regalJournal === 2;
  const formats = {physical:'Physique', digital:'Numérique', extension:'Extension'};
  const modes = {solo:'Solo', local:'Coop locale', online:'Coop en ligne'};
  const access = {owned:'Possédé', subscription:'Abonnement', loan:'Prêt', family:'Partage familial', emulation:'Émulation'};
  const completions = {finished:'Fini', hundred:'100 % en jeu', achievements:'Tous les succès'};
  const feelings = {bad:'💩', neutral:'😐', okay:'👍', love:'❤️', gem:'💎'};
  const ratings = ['','D','C','B','A','S','S+'];
  const criteria = ['Histoire','Gameplay','Visuel','Durée de vie','Musique'];
  const today = () => new Intl.DateTimeFormat('sv-SE').format(new Date());
  const previewEntries = [
    {id:'journal-demo-1',group:'completed',name:'Les Jardins d’Aster',platform:'Switch 2',date:'2026-03-21',format:'physical',mode:'solo',completion:'finished',notes:['A','S','S','A','S+'],feeling:'gem',comment:'La musique du dernier chapitre.'},
    {id:'journal-demo-2',group:'completed',name:'Chroniques du phare',platform:'PC',date:'2022-08-15',estimated:true,format:'digital',mode:'online',completion:'hundred',notes:['','A','S','B','A'],feeling:'love'},
    {id:'journal-demo-3',group:'playing',name:'Échos de cristal',platform:'PC',format:'digital'},
    {id:'journal-demo-4',group:'backlog',name:'Les Montagnes d’Ambre',platform:'Switch 2',precision:'Suggéré par Camille',format:'physical'},
    {id:'journal-demo-5',group:'release',name:'La Traversée de Solaria',platform:'PC',date:'2027-02-12',format:'digital'}
  ].map((entry,index)=>({...entry,image:new URL('preview-assets/'+['garden','lighthouse','mountains'][index%3]+'.svg',location.href).href}));

  function records(){
    const active = LEGACY_JOURNAL.find(marker);
    if(active && !Array.isArray(active.entries)) return [];
    return active?.entries ?? (IS_PREVIEW_MODE ? previewEntries : []);
  }
  function commit(next){
    const active = LEGACY_JOURNAL.find(marker);
    if(active && !Array.isArray(active.entries)) throw Error('Le journal enregistré est illisible.');
    const journal = [...LEGACY_JOURNAL.filter(entry=>!marker(entry)),{regalJournal:2,entries:next}];
    JTDData.assertCloudSize({...buildBackupPayload().data,journal,shareToken:SHARE_TOKEN,updatedAt:Date.now()});
    if(IS_PREVIEW_MODE) savePreviewData({journal});
    else accountStorage.atomicWrite([[LEGACY_JOURNAL_KEY,JSON.stringify(journal)]]);
    LEGACY_JOURNAL = journal;
    window.JTDDataChanged?.();
  }
  function dateLabel(entry,short=false){
    if(typeof entry.date !== 'string' || !entry.date) return 'À annoncer';
    if(entry.date==='TBD') return 'TBD';
    if(entry.yearOnly) return '≈ '+entry.date.slice(0,4);
    if(entry.date.length===4) return entry.date;
    const [year,month,day] = entry.date.split('-');
    if(entry.estimated) return '≈ '+MONTH_NAMES_FULL[Number(month)-1]+(short?'':' '+year);
    if(!day || short) return MONTH_NAMES_FULL[Number(month)-1]+(short?'':' '+year);
    return Number(day)+' '+MONTH_NAMES_FULL[Number(month)-1]+' '+year;
  }
  function score(value,criterion){
    return '<span class="journal-grade" data-grade="'+esc(value||'')+'" title="'+esc(criterion+': '+(value||'Sans note'))+'">'+esc(value||'–')+'</span>';
  }
  const bubble='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
  const pencil='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9M4 20l1-5L16 4l4 4L9 19z"/></svg>';
  const accessLabel=entry=>entry.access&&entry.access!=='owned'
    ? [access[entry.access],entry.access==='subscription'?entry.service:''].filter(Boolean).join(' · ') : '';
  const completionIcons={
    finished:'<path d="m5 12 4 4L19 6"/>',
    hundred:'<path d="M6 18 18 6"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
    achievements:'<path d="M8 4h8v6a4 4 0 0 1-8 0V4Zm0 2H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3m-4 3v5m-4 0h8"/>'
  };
  function completionBadge(value){
    const key=Object.hasOwn(completions,value)?value:'finished';
    return '<span class="journal-completion-badge" data-completion="'+key+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+completionIcons[key]+'</svg>'+completions[key]+'</span>';
  }
  function gameThumb(entry){
    return boardThumb({nom:entry.name,plateforme:entry.platform,image:entry.image,imageFit:entry.imageFit});
  }
  function day(entry){
    if(entry.estimated) return '<span class="calendar-day calendar-day-loose" title="Date approximative" aria-label="Date approximative"><strong>≈</strong></span>';
    return calendarDayHtml(entry.date);
  }
  function rowTags(entry){
    const tags=[];
    if(formats[entry.format]) tags.push([formats[entry.format],MEDIA_ICONS[entry.format==='extension'?'dlc':entry.format]]);
    if(modes[entry.mode]) tags.push([modes[entry.mode],modeIcons[entry.mode]]);
    if(accessLabel(entry)) tags.push([accessLabel(entry),accessIcons[entry.access]]);
    if(entry.replayed) tags.push(['Rejoué',replayIcon]);
    return tags.length?'<span class="journal-tags">'+tags.map(([label,icon])=>
      '<span class="journal-tag">'+(icon||'')+esc(label)+'</span>').join('')+'</span>':'';
  }
  function row(entry){
    const done = entry.group === 'completed';
    const tracked = entry.group === 'release';
    return '<button type="button" class="journal-row'+(done?' journal-completion-row':tracked?' journal-release-row':'')+'" data-journal-entry="'+esc(entry.id)+'">'+
      (done?day(entry):'')+
      gameThumb(entry)+'<span class="journal-title"><strong>'+esc(entry.name)+'</strong><small class="journal-row-platform">'+
      (entry.platform?getPlatformOptionIconHtml(entry.platform)+esc(entry.platform):'')+
      (entry.precision?'<span class="journal-row-precision">'+esc(entry.precision)+'</span>':'')+'</small>'+
      (done?rowTags(entry):'')+
      (tracked&&validDay(entry.date)?'<small class="journal-release-date">'+esc(parseWishlistDate(entry.date).label)+'</small>':'')+
      '</span>'+
      (done?'<span class="journal-row-status">'+completionBadge(entry.completion)+(entry.feeling?'<span class="journal-feeling">'+esc(feelings[entry.feeling]||'')+'</span>':'')+
        (entry.comment?'<span class="journal-comment-mark" title="Avec commentaire" aria-label="Avec commentaire">'+bubble+'</span>':'')+'</span>':'')+'</button>';
  }
  function calendar(entries,groupBy){
    const groups = new Map();
    for(const entry of entries){
      const group=groupBy(entry);
      if(!groups.has(group.key)) groups.set(group.key,{...group,items:[]});
      groups.get(group.key).items.push(entry);
    }
    return [...groups.values()].map(group=>'<section class="journal-calendar">'+
      calendarGroupHtml(group.label,'',group.color,!group.color)+group.items.map(row).join('')+'</section>').join('');
  }
  function completedGroup(entry){
    if(entry.yearOnly) return {key:'year',label:'Année seule'};
    const month=Number(entry.date.slice(5,7))-1;
    return {key:entry.date.slice(0,7),label:MONTH_NAMES_FULL[month]||'Date inconnue',color:MONTH_COLORS[month]};
  }
  function releaseGroup(entry){
    const value=String(entry.date||'');
    const month=/^\d{4}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)?Number(value.slice(5,7))-1:-1;
    if(month>=0) return {key:value.slice(0,7),label:MONTH_NAMES_FULL[month]+' '+value.slice(0,4),color:MONTH_COLORS[month]};
    const label=/^\d{4}$/.test(value)?value:'TBD';
    return {key:label,label};
  }
  const statIcon=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
  const modeIcons={
    solo:statIcon('<circle cx="12" cy="8" r="3"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>'),
    local:statIcon('<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M9 21h6m-3-4v4"/>'),
    online:statIcon('<path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0m-7 3a4 4 0 0 1 4 0m-2 3h.01"/>')
  };
  const replayIcon=statIcon('<path d="M5 10a7 7 0 1 1 1 7M5 5v5h5"/>');
  const accessIcons={
    owned:statIcon('<path d="M4 8h16v12H4zM3 4h18v4H3zm7 8h4"/>'),
    subscription:statIcon('<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M4 10h16m-6 5h3"/>'),
    loan:statIcon('<path d="M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4"/>'),
    family:statIcon('<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>'),
    emulation:statIcon('<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M9 21h6m-3-4v4"/>')
  };
  function stats(entries){
    const countBy=key=>{
      const counts=new Map();
      for(const entry of entries){
        const value=entry[key]??(key==='access'?'owned':'');
        if(value) counts.set(value,(counts.get(value)||0)+1);
      }
      return counts;
    };
    const stat=(label,count,graphic='')=>'<div class="journal-stat"><span>'+graphic+esc(label)+'</span><b>'+count+'</b></div>';
    const section=(label,html)=>'<section class="journal-stat-section"><h4>'+label+'</h4>'+html+'</section>';
    const counts=countBy('completion'), total=entries.length;
    const colors=['var(--status-done)','var(--amber)','#8867bb'];
    let start=0;
    const gradient=Object.keys(completions).map((key,index)=>{
      const end=start+(total?(counts.get(key)||0)/total*100:0);
      const part=colors[index]+' '+start+'% '+end+'%';
      start=end;
      return part;
    });
    const ring='<div class="home-completion-ring journal-stat-ring" style="background:'+
      (total?'conic-gradient('+gradient.join(',')+',var(--ui-border) '+start+'% 100%)':'var(--ui-border)')+
      '"><span><strong>'+total+'</strong><small>Complétions</small></span></div>';
    const platforms=[...countBy('platform')].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'fr')).map(([name,count])=>{
      const logo=safeURL(getPlatformLogo(name),true);
      const graphic=logo?'<img src="'+esc(logo)+'" alt="">':'<i style="background:'+esc(getPlatformColor(name))+'"></i>';
      return stat(name,count,graphic);
    }).join('');
    const formatCount=countBy('format'), accessCount=countBy('access');
    return section('Complétions',ring+Object.entries(completions).map(([key,label],index)=>stat(label,counts.get(key)||0,'<i style="background:'+colors[index]+'"></i>')).join(''))+
      section('Plateformes',platforms||'<p class="journal-empty">Aucune plateforme.</p>')+
      section('Supports',Object.entries(formats).map(([key,label])=>stat(label,formatCount.get(key)||0,MEDIA_ICONS[key==='extension'?'dlc':key])).join(''))+
      section('Accès',Object.entries(access).map(([key,label])=>stat(label,accessCount.get(key)||0,accessIcons[key])).join(''));
  }
  const sortByYear=new Map();
  function render(){
    const entries = records();
    const completed = entries.filter(entry=>entry?.group==='completed' && typeof entry.date==='string');
    const year = $('journal-year');
    const value = year.value || today().slice(0,4);
    const years = [...new Set([today().slice(0,4),...completed.map(entry=>entry.date.slice(0,4))])].sort().reverse();
    year.replaceChildren(...years.map(number=>new Option(number,number)));
    year.value = years.includes(value)?value:years[0];
    const sort=$('journal-sort');
    sort.value=sortByYear.get(year.value)||(year.value<today().slice(0,4)?'asc':'desc');
    const direction=sort.value==='asc'?1:-1;
    const selected = completed.filter(entry=>entry.date.startsWith(year.value)).sort((a,b)=>direction*a.date.localeCompare(b.date));
    $('journal-stats').innerHTML = stats(selected);
    $('journal-completed').innerHTML = calendar(selected,completedGroup) || '<p class="journal-empty">Aucune complétion cette année.</p>';
    for(const group of ['playing','backlog','release']){
      const list = entries.filter(entry=>entry?.group===group);
      if(group==='release') list.sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
      $('journal-'+group).innerHTML = (group==='release'?calendar(list,releaseGroup):list.map(row).join('')) || '<p class="journal-empty">Aucun jeu.</p>';
    }
  }
  window.renderJournal = render;
  const select = (name,options,value) => '<select id="journal-field-'+name+'" name="'+name+'">'+Object.entries(options).map(([key,label])=>
    '<option value="'+esc(key)+'"'+(key===value?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
  const field = (label,content) => '<label class="field"><span>'+label+'</span>'+content+'</label>';
  const input = (name,value='',attrs='') => '<input name="'+name+'" value="'+esc(value??'')+'" '+attrs+'>';
  let editorEvents;
  const close = () => { editorEvents?.abort(); JTDDialogs.close('journal-overlay'); };
  window.refreshJournal = () => { if(!$('journal-overlay').classList.contains('hidden')) close(); render(); };
  function identityCard(entry,editable=false){
    return '<div class="game-identity-summary'+(editable?'':' journal-identity-read')+'">'+
      identitySummaryHtml({nom:entry.name,plateforme:entry.platform,image:safeURL(entry.image,true),imageFit:entry.imageFit},
        formats[entry.format]||'')+'</div>';
  }
  function show(title,html,{editing=false,canComplete=false,canDelete=false}={}){
    editorEvents?.abort();
    editorEvents = new AbortController();
    $('journal-dialog-title').textContent = title;
    $('journal-dialog-body').innerHTML = html;
    $('journal-save').classList.toggle('hidden',!editing);
    $('journal-save').textContent='Enregistrer';
    $('journal-save').disabled=false;
    $('journal-delete').classList.toggle('hidden',!canDelete);
    $('journal-complete').classList.toggle('hidden',!canComplete);
    JTDDialogs.open('journal-overlay',{onDismiss:close});
    const target = [...$('journal-dialog-body').querySelectorAll('input:not([type="hidden"]),button')].find(element=>element.getClientRects().length);
    target?.focus({preventScroll:true});
  }
  function validDay(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value+'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10)===value;
  }
  function bindDelete(entry,generation){
    $('journal-delete').onclick=()=>confirmAction('Supprimer cette entrée du journal ?',()=>{
      if(generation!==window.JTDAccountGeneration) return;
      try { commit(records().filter(record=>record?.id!==entry.id)); close(); render(); }
      catch(error){ showToast(error.message); }
    });
  }
  function edit(entry,fromBacklog=false,section='all'){
    const group=entry.group, done=group==='completed', release=group==='release';
    const date=entry.date ?? (done?today():'');
    const existing=records().some(record=>record?.id===entry.id);
    const generation=window.JTDAccountGeneration;
    const sources=GAMES;
    const identityOnly=section==='identity', commentOnly=section==='comment', completionOnly=section==='completion'||section==='release';
    const chooseSource=!existing||identityOnly;
    const platforms=[...new Set([...allPlatformNames(),'PC',entry.platform].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    const customPlatform='__journal_custom_platform__';
    const canComplete=existing&&!done&&!release;
    const precisionField=field('Précision',input('precision',entry.precision,'maxlength="250" placeholder="Version 1.0, suggéré par…"'));
    show(identityOnly?'Modifier le jeu':commentOnly?'Modifier le commentaire':section==='release'?'Modifier la sortie':completionOnly?'Modifier la complétion':existing&&!fromBacklog?'Modifier l’entrée':done?'Ajouter une complétion':'Ajouter un jeu',
      '<form id="journal-form">'+
      '<section class="form-section journal-game-section">'+
      '<div id="journal-game-summary"'+(!existing||identityOnly?' class="hidden"':'')+'>'+identityCard(entry,!fromBacklog&&!completionOnly&&!commentOnly)+'</div>'+
      '<div id="journal-game-editor"'+(existing&&!identityOnly?' class="hidden"':'')+'>'+
      (chooseSource?'<fieldset class="journal-source-choice"><legend>Origine du jeu</legend>'+
        '<label><input type="radio" name="origin" value="manual" checked> Saisie manuelle</label>'+
        '<label><input type="radio" name="origin" value="collection"> Depuis la collection</label></fieldset>'+
        '<div id="journal-source-picker" class="hidden">'+field('Rechercher un jeu',input('lookup','','type="search" placeholder="Titre ou plateforme" autocomplete="off"'))+
        '<div id="journal-source-results" class="journal-source-results" aria-label="Jeux de la collection"></div></div>':'')+
      '<div id="journal-manual-fields">'+field('Nom du jeu',input('name',entry.name,'required maxlength="500"'))+
      '<div class="field-row identity-core-row">'+field('Plateforme','<select id="journal-platform" name="platform">'+
        '<option value="">Choisir une plateforme…</option>'+platforms.map(name=>'<option value="'+esc(name)+'"'+(name===entry.platform?' selected':'')+'>'+esc(name)+'</option>').join('')+
        '<option value="'+customPlatform+'">Autre plateforme…</option></select>')+
      field('Support',select('format',{'':'Non renseigné',...formats},entry.format??'digital'))+'</div>'+
      '<div id="journal-custom-platform" class="hidden">'+field('Nom de la plateforme',input('platformCustom','','maxlength="120"'))+'</div>'+
      '<div class="image-url-row">'+field('Image du jeu',input('image',entry.image,'id="j-image" maxlength="200000" placeholder="https://…"'))+
      '<div id="j-image-preview" class="image-preview image-preview-compact"><span>Aperçu de l’image</span></div></div>'+
      field('Affichage de l’image',select('imageFit',{contain:'Image entière',cover:'Remplir le cadre'},entry.imageFit==='cover'?'cover':'contain'))+
      '<button type="button" class="btn btn-ghost'+(identityOnly?' hidden':'')+'" id="journal-apply-identity">Valider le jeu</button></div></div></section>'+
      '<section class="form-section'+(identityOnly||commentOnly?' hidden':'')+'">'+
      (done?'<div class="form-section-title">Complétion</div>'+
        '<div class="journal-form-grid journal-date-fields">'+
        field('Date de complétion',input('date',date,'type="date" required'))+
        field('Précision de la date',select('estimated',{'0':'Exacte','1':'Approximative','year':'Année seule'},entry.yearOnly?'year':entry.estimated?'1':'0'))+'</div>'+
        '<div class="journal-form-grid">'+field('Mode de jeu',select('mode',modes,entry.mode||'solo'))+
        field('Complétion',select('completion',completions,entry.completion||'finished'))+'</div>'+
        precisionField+
        field('Accès',select('access',{'':'Non renseigné',...access},entry.access??'owned'))+
        '<div id="journal-service">'+field('Nom de l’abonnement',input('service',entry.service,'maxlength="120"'))+'</div>'+
        '<label class="journal-checkbox"><input type="checkbox" name="replayed"'+(entry.replayed?' checked':'')+'> Rejoué</label>'+
        '<div class="journal-form-ratings">'+criteria.map((label,index)=>field(label,select('note'+index,Object.fromEntries(ratings.map(value=>[value,value||'–'])),entry.notes?.[index]||''))).join('')+
          field('Ressenti',select('feeling',{'':'–',...feelings},entry.feeling||''))+'</div>':
      release?'<div class="journal-context-fields"><div class="field flexible-date-field"><span>Date de sortie</span><div class="date-mode" data-date-mode="journal-release">'+
        ['date','year','tbd'].map((mode,index)=>'<button type="button" class="date-mode-btn" data-mode="'+mode+'">'+['Date','Année','TBD'][index]+'</button>').join('')+
        '</div><input type="date" id="journal-release-date" aria-label="Date de sortie"><input type="number" id="journal-release-year" min="1970" max="2100" step="1" placeholder="2027" aria-label="Année de sortie"></div>'+
        precisionField+'</div>':
      '<div class="journal-context-fields">'+field('Statut',select('group',{backlog:'À faire',playing:'En cours'},group))+precisionField+'</div>')+
      '</section>'+
      (done?'<section class="form-section'+(identityOnly||completionOnly?' hidden':'')+'">'+field('Commentaire','<textarea name="comment" maxlength="10000" rows="4">'+esc(entry.comment||'')+'</textarea>')+'</section>':'')+
      '<p id="journal-error" role="alert" class="journal-error"></p></form>',{editing:true,canComplete,canDelete:existing&&!fromBacklog});
    const form=$('journal-form'), elements=form.elements;
    const summary=$('journal-game-summary'), editor=$('journal-game-editor');
    const platformValue=()=>elements.platform.value===customPlatform?elements.platformCustom.value.trim():elements.platform.value;
    const updatePlatform=()=> $('journal-custom-platform').classList.toggle('hidden',elements.platform.value!==customPlatform);
    iconSelectify('journal-platform',name=>name&&name!==customPlatform?getPlatformOptionIconHtml(name):'',editorEvents.signal);
    if(done&&!identityOnly&&!commentOnly){
      const selectIcons={
        mode:modeIcons,
        completion:Object.fromEntries(Object.entries(completionIcons).map(([key,path])=>[key,statIcon(path)])),
        access:accessIcons
      };
      for(const [name,icons] of Object.entries(selectIcons)){
        iconSelectify('journal-field-'+name,value=>icons[value]||'',editorEvents.signal);
      }
    }
    elements.platform.addEventListener('change',updatePlatform);
    const compactIdentity=()=>{
      if(!elements.name.value.trim() || !platformValue()){
        $('journal-error').textContent='Renseigne le titre et la plateforme.';
        if(!elements.name.value.trim()) elements.name.focus();
        else if(elements.platform.value===customPlatform) elements.platformCustom.focus();
        else editor.querySelector('.icon-select-trigger')?.focus();
        return;
      }
      $('journal-error').textContent='';
      summary.innerHTML=identityCard({name:elements.name.value,platform:platformValue(),image:elements.image.value,format:elements.format.value,imageFit:elements.imageFit.value},true);
      summary.classList.remove('hidden');
      editor.classList.add('hidden');
      (identityOnly?$('journal-save'):elements.date||elements.precision).focus();
    };
    $('journal-apply-identity').onclick=compactIdentity;
    summary.addEventListener('click',event=>{
      if(!event.target.closest('.identity-edit-btn') || fromBacklog || completionOnly || commentOnly) return;
      editor.classList.remove('hidden');
      summary.classList.add('hidden');
      elements.name.focus();
    });
    form.addEventListener('invalid',event=>{
      if(!fromBacklog && editor.contains(event.target)){
        editor.classList.remove('hidden');
        summary.classList.add('hidden');
      }
    },true);
    elements.imageFit.id='j-image-fit';
    const updatePreview=()=>updateImagePreviewFor('j-image','j-image-preview');
    elements.image.addEventListener('input',updatePreview);
    elements.imageFit.addEventListener('change',updatePreview);
    updatePreview();
    if(elements.lookup){
      const picker=$('journal-source-picker'), manual=$('journal-manual-fields'), results=$('journal-source-results');
      let sourcePending=false;
      const fold=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
      const fill=()=>{
        const query=fold(elements.lookup.value.trim());
        const choices=query?sources.filter(item=>fold(item.nom+' '+item.plateforme).includes(query)).slice(0,12):[];
        results.innerHTML=choices.map(item=>'<button type="button" data-journal-source="'+esc(item.id)+'"><strong>'+esc(item.nom)+'</strong><small>'+esc(item.plateforme)+'</small></button>').join('')+
          (query&&!choices.length?'<p class="journal-empty">Aucun jeu trouvé.</p>':'');
      };
      const mode=()=>{
        sourcePending=elements.origin.value==='collection';
        picker.classList.toggle('hidden',!sourcePending);
        manual.classList.toggle('hidden',sourcePending);
        elements.name.required=!sourcePending;
        if(sourcePending){fill();elements.lookup.focus();}
      };
      for(const radio of form.querySelectorAll('[name="origin"]')) radio.addEventListener('change',mode);
      summary.addEventListener('click',event=>{if(event.target.closest('.identity-edit-btn')&&elements.origin.value==='collection') elements.lookup.focus();});
      elements.lookup.addEventListener('input',fill);
      elements.lookup.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&!event.isComposing){event.preventDefault();results.querySelector('button')?.click();}
      });
      results.addEventListener('click',event=>{
        const choice=event.target.closest('[data-journal-source]');
        const item=choice&&sources.find(game=>game.id===choice.dataset.journalSource);
        if(!item) return;
        sourcePending=false;
        elements.name.value=item.nom;
        if(![...elements.platform.options].some(option=>option.value===item.plateforme)) elements.platform.add(new Option(item.plateforme,item.plateforme));
        setSelectValueAndSync('journal-platform',item.plateforme);
        updatePlatform();
        elements.image.value=item.image||'';
        elements.imageFit.value=item.imageFit==='cover'?'cover':'contain';
        elements.format.value=JTDData.isAddon(item)?'extension':JTDData.isDigital(item)?'digital':'physical';
        updatePreview();
        compactIdentity();
        if(!identityOnly) elements.precision.focus();
      });
      form.addEventListener('submit',event=>{
        if(!sourcePending) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        $('journal-error').textContent='Choisis un jeu dans les résultats ou passe en saisie manuelle.';
        elements.lookup.focus();
      });
    }
    let releaseDateChanged=false;
    if(release){
      const wrap=form.querySelector('[data-date-mode="journal-release"]');
      const setDateInputs=()=>{ $('journal-release-date').disabled=wrap.dataset.currentMode!=='date'; $('journal-release-year').disabled=wrap.dataset.currentMode!=='year'; };
      setFlexibleDate('journal-release',date);
      setDateInputs();
      wrap.addEventListener('click',event=>{
        const button=event.target.closest('[data-mode]');
        if(button){ flexibleDateMode('journal-release',button.dataset.mode); setDateInputs(); releaseDateChanged=true; }
      });
      form.querySelector('.flexible-date-field').addEventListener('input',()=>{releaseDateChanged=true;});
    }
    if(done){
      const toggle = () => $('journal-service').classList.toggle('hidden',elements.access.value!=='subscription');
      elements.access.addEventListener('change',toggle);
      toggle();
    }
    const value=name=>elements[name]?.value.trim()||'';
    const readGame=()=>{
      if(!value('name')||!platformValue()) throw Error('Renseigne le titre et la plateforme.');
      const art=safeURL(value('image'),true);
      if(value('image')&&!art) throw Error('L’adresse de l’image est invalide.');
      return {name:value('name'),platform:platformValue(),precision:value('precision'),image:art,imageFit:value('imageFit'),format:value('format')};
    };
    if(existing&&!fromBacklog) bindDelete(entry,generation);
    if(canComplete) $('journal-complete').onclick=()=>{
      if(generation!==window.JTDAccountGeneration){close();return;}
      try { edit({...entry,...readGame(),group:'completed'},true); }
      catch(error){ $('journal-error').textContent=error.message; }
    };
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(generation!==window.JTDAccountGeneration){close();return;}
      try{
        if(done&&!validDay(value('date'))) throw Error('Renseigne une date de complétion valide.');
        const releaseDate=release?(getFlexibleDate('journal-release')||(!releaseDateChanged?date:'')||'TBD'):'';
        if(release&&releaseDate!=='TBD'&&!/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(releaseDate)&&!validDay(releaseDate)) throw Error('Indique une année ou une date valide.');
        const next={...readGame(),id:entry.id||crypto.randomUUID(),group:value('group')||group};
        if(entry.importKey) next.importKey=entry.importKey;
        if(done) next.date=value('date');
        if(release) next.date=releaseDate;
        if(done) Object.assign(next,{estimated:value('estimated')!=='0',yearOnly:value('estimated')==='year',access:value('access'),service:value('access')==='subscription'?value('service'):'',replayed:elements.replayed.checked,mode:value('mode'),completion:value('completion'),notes:criteria.map((_,index)=>value('note'+index)),feeling:value('feeling'),comment:value('comment')});
        const current=records();
        if(existing&&!current.some(record=>record?.id===entry.id)) throw Error('Cette entrée n’existe plus.');
        commit(existing?current.map(record=>record?.id===next.id?next:record):[...current,next]);
        if(done){
          render();
          $('journal-year').value=next.date.slice(0,4);
          if(fromBacklog){ $('journal-layout').dataset.tab='completed'; syncTabs(); }
        }
        if(section==='all') close(); else detail(next);
        render();
      }catch(error){$('journal-error').textContent=error.message;}
    });
  }
  const calendarIcon=statIcon('<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4m8-4v4M4 10h16"/>');
  const contextField=(label,value,className='')=>'<div><dt>'+label+'</dt><dd class="'+className+'">'+value+'</dd></div>';
  function detail(entry){
    const done=entry.group==='completed';
    const generation=window.JTDAccountGeneration;
    if(['playing','backlog'].includes(entry.group)){ edit(entry); return; }
    const editButton=(id,label)=>'<button type="button" id="'+id+'" class="context-edit-btn" aria-label="'+label+'" title="'+label+'">'+pencil+'</button>';
    show(done?'Fiche de complétion':'Fiche du jeu',
      '<section class="form-section">'+identityCard(entry,true)+'</section>'+
      '<section class="form-section"><div class="journal-section-heading"><div class="form-section-title">'+(done?completionBadge(entry.completion):entry.group==='release'?'Sortie':'Backlog')+'</div>'+
      (done?editButton('journal-edit-completion','Modifier la complétion'):entry.group==='release'?editButton('journal-edit-release','Modifier la date de sortie'):'')+'</div>'+
      '<dl class="journal-context-fields'+(done?' journal-context-fields-completion':'')+'">'+
      contextField(done?'Date de complétion':'Sortie','<span class="journal-context-date"'+(entry.estimated?' aria-label="Date approximative"':'')+'>'+calendarIcon+esc(dateLabel(entry))+'</span>')+
      (done?contextField('Mode de jeu',esc(modes[entry.mode]||'—')):'')+
      contextField('Précision',esc(entry.precision||'—'), 'journal-context-precision')+'</dl>'+
      (done&&(entry.replayed||accessLabel(entry))?'<div class="journal-context-flags">'+
      (entry.replayed?'<span>Rejoué</span>':'')+
      (accessLabel(entry)?'<span class="journal-access">'+esc(accessLabel(entry))+'</span>':'')+'</div>':'')+
      (done?'<div class="journal-detail-ratings">'+criteria.map((label,index)=>'<div>'+esc(label)+score(entry.notes?.[index],label)+'</div>').join('')+
      '<div>Ressenti<span class="journal-rating-feeling">'+esc(feelings[entry.feeling]||'–')+'</span></div></div>':'')+
      '</section>'+
      (done?'<section class="form-section journal-comment-section"><div class="journal-section-heading"><div class="form-section-title journal-comment-heading">'+bubble+'Commentaire</div>'+
        editButton('journal-edit-comment','Modifier le commentaire')+'</div><p class="journal-comment">'+esc(entry.comment||'Aucun commentaire.')+'</p></section>':''),{canDelete:true});
    $('journal-dialog-body').querySelector('.identity-edit-btn').onclick=()=>edit(entry,false,'identity');
    if(entry.group==='release') $('journal-edit-release').onclick=()=>edit(entry,false,'release');
    if(done){
      $('journal-edit-completion').onclick=()=>edit(entry,false,'completion');
      $('journal-edit-comment').onclick=()=>edit(entry,false,'comment');
    }
    bindDelete(entry,generation);
  }
  function importPreview(items,generation){
    const existing=records();
    const known=new Map(existing.filter(entry=>entry?.importKey).map(entry=>[entry.importKey,entry]));
    const similar=new Set(existing.filter(entry=>entry?.group==='completed').map(JTDJournalImport.signature));
    const platforms=allPlatformNames();
    const groupPlatforms=games=>{
      const groups=new Map();
      for(const game of games){
        const platform=JTDData.importPlatform(game.plateforme);
        if(!groups.has(platform)) groups.set(platform,[]);
        groups.get(platform).push(game);
      }
      return groups;
    };
    const owned=groupPlatforms(GAMES), archived=groupPlatforms(CEMETERY);
    const matches=new Map();
    const rows=items.map(({entry,inferredYear,rawDate})=>{
      const platform=platforms.find(name=>JTDData.importPlatform(name)===entry.platform)||entry.platform;
      const key=JSON.stringify([JTDData.foldImport(entry.name),entry.platform]);
      if(!matches.has(key)){
        const candidates=JTDData.importCandidates({nom:entry.name,plateforme:platform},
          owned.get(entry.platform)||[],archived.get(entry.platform)||[]).filter(candidate=>candidate.score>0);
        const exact=candidates.filter(candidate=>candidate.exact);
        matches.set(key,{candidates:[...exact,...candidates.filter(candidate=>!candidate.exact).slice(0,5)],defaultMatch:exact.length===1?'0':''});
      }
      const match=matches.get(key);
      const matched=match.defaultMatch===''?null:match.candidates[Number(match.defaultMatch)];
      const imported=known.get(entry.importKey);
      return {entry:{...entry,platform},inferredYear,rawDate,imported,...match,
        possible:similar.has(JTDJournalImport.signature(entry))||
          (matched&&similar.has(JTDJournalImport.signature({...entry,name:matched.nom})))};
    });
    const location={collection:'Collection',sold:'Cimetière · vendu',pending:'Cimetière · à vendre'};
    const matchControl=item=>{
      if(!item.candidates.length) return '';
      const options={'':item.imported?'Garder le nom et l’image actuels':'Garder le titre du CSV'};
      for(const [index,game] of item.candidates.entries()){
        options[index]=[game.nom,location[game.location],safeURL(game.image,true)?'avec image':''].filter(Boolean).join(' · ');
      }
      return '<label class="journal-import-match">Jeu correspondant '+select('importMatch',options,item.defaultMatch)+'</label>';
    };
    const dateMode={'exact':'Exacte','approx':'Approximative','year':'Année seule'};
    const line=(item,index)=>{
      const entry=item.entry;
      const info=[entry.platform,completions[entry.completion],entry.replayed?'Rejoué':'',item.imported?(item.candidates.length?'Déjà importée · nom et image modifiables':'Déjà importée'):item.possible?'Doublon possible':item.defaultMatch!==''?'Correspondance proposée':item.candidates.length?'Correspondance à choisir':''].filter(Boolean).join(' · ');
      const flagged=item.inferredYear?'Année proposée : '+entry.date.slice(0,4):entry.yearOnly?'Année seule':entry.estimated?'Date signalée par !':'';
      return '<li class="journal-import-row" data-import-index="'+index+'">'+
        '<label class="journal-import-choice"><input type="checkbox" name="include"'+(item.imported?(item.candidates.length?'':' disabled'):item.possible?'':' checked')+'>'+
        '<span><strong>'+esc(entry.name)+'</strong><small>'+esc(info)+'</small></span></label>'+
        matchControl(item)+
        (item.imported?'':'<div class="journal-import-fields">'+
        '<label>Repère de tri <input type="date" name="importDate" value="'+esc(entry.date)+'" aria-label="Repère de tri"></label>'+
        '<label>Précision '+select('dateMode',dateMode,entry.yearOnly?'year':entry.estimated?'approx':'exact')+'</label>'+
        (!entry.format?'<label>Support '+select('importFormat',{'':'Non renseigné',...formats},'')+'</label>':'')+
        '</div>')+(flagged?'<small class="journal-import-flag">'+esc(flagged)+' · '+esc(item.rawDate)+'</small>':'')+'</li>';
    };
    show('Importer les complétions',
      '<form id="journal-form" class="journal-import-preview">'+
      '<p id="journal-import-count" role="status"></p>'+
      '<p class="journal-empty">Une correspondance reprend le nom et l’image du jeu. Pour une entrée déjà importée, coche la ligne pour actualiser uniquement ces deux éléments.</p>'+
      '<ol class="journal-import-list">'+rows.map(line).join('')+'</ol>'+
      '<p id="journal-error" role="alert" class="journal-error"></p></form>',{editing:true});
    const form=$('journal-form');
    const selected=()=>[...form.querySelectorAll('[name="include"]:checked')];
    const update=()=>{
      const count=selected().length;
      $('journal-import-count').textContent=count+' sélectionnée'+(count>1?'s':'')+' sur '+rows.length+' complétions';
      $('journal-save').textContent='Importer ('+count+')';
      $('journal-save').disabled=!count;
    };
    form.addEventListener('change',update);
    update();
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(generation!==window.JTDAccountGeneration){close();return;}
      try{
        const current=records(), present=new Map(current.filter(entry=>entry?.importKey).map(entry=>[entry.importKey,entry]));
        const added=[], updated=new Map();
        for(const checkbox of selected()){
          const line=checkbox.closest('[data-import-index]');
          const item=rows[Number(line.dataset.importIndex)];
          const match=line.querySelector('[name="importMatch"]')?.value;
          const game=match?item.candidates[Number(match)]:null;
          const currentEntry=present.get(item.entry.importKey);
          const identity=game?{name:game.nom}:null;
          const image=game&&safeURL(game.image,true);
          if(image) Object.assign(identity,{image,imageFit:game.imageFit==='cover'?'cover':'contain'});
          if(currentEntry){
            if(identity) updated.set(currentEntry.id,{...currentEntry,...identity});
            continue;
          }
          const date=line.querySelector('[name="importDate"]').value;
          if(!validDay(date)) throw Error('Date invalide pour « '+item.entry.name+' ».');
          const mode=line.querySelector('[name="dateMode"]').value;
          added.push({...item.entry,...identity,id:crypto.randomUUID(),date,estimated:mode!=='exact',yearOnly:mode==='year',format:line.querySelector('[name="importFormat"]')?.value??item.entry.format});
        }
        if(added.length||updated.size) commit([...current.map(entry=>updated.get(entry?.id)||entry),...added]);
        close();
        if(added.length||updated.size){
          $('journal-layout').dataset.tab='completed';
          syncTabs();
          if(navigationPage!=='journal') goToPage('journal');
          render();
          $('journal-year').value=[...added,...updated.values()].map(entry=>entry.date.slice(0,4)).sort().at(-1);
        }
        render();
        showToast([added.length?added.length+' importée(s)':'',updated.size?updated.size+' mise(s) à jour':''].filter(Boolean).join(' · ')||'Aucun changement.');
      }catch(error){$('journal-error').textContent=error.message;}
    });
  }
  $('journal-import-open').addEventListener('click',()=>$('journal-import-file').click());
  $('journal-import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];
    event.target.value='';
    if(!file) return;
    const generation=window.JTDAccountGeneration;
    try{
      if(file.size>1000000) throw Error('Le fichier dépasse 1 Mo.');
      const items=JTDJournalImport.parse(await file.text());
      if(generation!==window.JTDAccountGeneration) return;
      if(!items.length) throw Error('Le CSV ne contient aucune complétion.');
      importPreview(items,generation);
    }catch(error){showToast(error.message);}
  });
  const mobileJournal=matchMedia('(max-width:820px)');
  function syncTabs(){
    const layout=$('journal-layout');
    const selected=mobileJournal.matches ? layout.dataset.tab : layout.dataset.side;
    document.querySelectorAll('[data-journal-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.journalTab===selected)));
  }
  mobileJournal.addEventListener('change',syncTabs);
  syncTabs();
  $('journal-year').addEventListener('change',render);
  $('journal-sort').addEventListener('change',event=>{sortByYear.set($('journal-year').value,event.target.value);render();});
  $('journal-close').addEventListener('click',close);
  $('page-journal').addEventListener('click',event=>{
    const add=event.target.closest('[data-journal-add]');
    if(add) edit({group:add.dataset.journalAdd});
    const row=event.target.closest('[data-journal-entry]');
    if(row){
      const entry=records().find(item=>item?.id===row.dataset.journalEntry);
      if(entry) detail(entry);
    }
    const tab=event.target.closest('[data-journal-tab]');
    if(tab){
      const layout=$('journal-layout'), target=tab.dataset.journalTab;
      layout.dataset.tab=target;
      if(target!=='completed') layout.dataset.side=target;
      syncTabs();
    }
  });
  if(navigationPage==='journal') render();
})();
