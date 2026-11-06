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
    {id:'journal-demo-5',group:'release',name:'La Traversée de Solaria',platform:'PC',date:'2027-02',format:'digital'}
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
    if(entry.yearOnly) return '≈ '+entry.date.slice(0,4);
    if(entry.date.length===4) return entry.date;
    const [year,month,day] = entry.date.split('-');
    if(entry.estimated) return '≈ '+MONTH_NAMES_FULL[Number(month)-1]+(short?'':' '+year);
    if(!day || short) return MONTH_NAMES_FULL[Number(month)-1]+(short?'':' '+year);
    return Number(day)+' '+MONTH_NAMES_FULL[Number(month)-1]+' '+year;
  }
  function image(entry){
    const src = safeURL(entry.image,true);
    return src ? '<img class="journal-art" src="'+esc(src)+'" alt="" loading="lazy">' : '';
  }
  function score(value,criterion){
    return '<span class="journal-grade" data-grade="'+esc(value||'')+'" title="'+esc(criterion+': '+(value||'Sans note'))+'">'+esc(value||'–')+'</span>';
  }
  function row(entry){
    const done = entry.group === 'completed';
    const month=done&&!entry.yearOnly?Number(entry.date?.slice(5,7))-1:-1;
    const monthStyle=MONTH_DATE_COLORS[month]?' style="--journal-month-bg:'+MONTH_DATE_COLORS[month]+';--journal-month-ink:'+MONTH_DATE_TEXT_COLORS[month]+'"':'';
    return '<button type="button" class="journal-row'+(done?' journal-completion-row':'')+'" data-journal-entry="'+esc(entry.id)+'">'+
      (entry.date || entry.group==='release'?'<time class="journal-month"'+monthStyle+' title="'+esc(dateLabel(entry))+'">'+esc(dateLabel(entry,done))+'</time>':'')+
      image(entry)+'<span class="journal-title"><strong>'+esc(entry.name)+'</strong><small>'+esc([entry.platform,entry.precision].filter(Boolean).join(' · '))+'</small>'+
      (done?'<small>'+esc([formats[entry.format],modes[entry.mode],completions[entry.completion]].filter(Boolean).join(' · '))+'</small>':'')+'</span>'+
      (done?'<span class="journal-scores">'+criteria.map((criterion,index)=>score(entry.notes?.[index],criterion)).join('')+'<span class="journal-feeling">'+esc(feelings[entry.feeling]||'')+'</span></span>':'')+'</button>';
  }
  function render(){
    const entries = records();
    const completed = entries.filter(entry=>entry?.group==='completed' && typeof entry.date==='string');
    const year = $('journal-year');
    const value = year.value || today().slice(0,4);
    const years = [...new Set([today().slice(0,4),...completed.map(entry=>entry.date.slice(0,4))])].sort().reverse();
    year.replaceChildren(...years.map(number=>new Option(number,number)));
    year.value = years.includes(value)?value:years[0];
    const selected = completed.filter(entry=>entry.date.startsWith(year.value)).sort((a,b)=>b.date.localeCompare(a.date));
    const platforms = new Map();
    for(const entry of selected) platforms.set(entry.platform,(platforms.get(entry.platform)||0)+1);
    $('journal-stats').innerHTML = '<strong>'+selected.length+' complétion'+(selected.length>1?'s':'')+'</strong>'+
      [...platforms].sort((a,b)=>b[1]-a[1]).map(([name,count])=>'<div class="journal-stat"><span>'+esc(name)+'</span><b>'+count+'</b></div>').join('')+
      '<hr>'+Object.entries(completions).map(([key,label])=>'<div class="journal-stat"><span>'+label+'</span><b>'+selected.filter(entry=>entry.completion===key).length+'</b></div>').join('');
    $('journal-completed').innerHTML = selected.map(row).join('') || '<p class="journal-empty">Aucune complétion cette année.</p>';
    for(const group of ['playing','backlog','release']){
      const list = entries.filter(entry=>entry?.group===group);
      if(group==='release') list.sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')));
      $('journal-'+group).innerHTML = list.map(row).join('') || '<p class="journal-empty">Aucun jeu.</p>';
    }
  }
  window.renderJournal = render;
  const select = (name,options,value) => '<select name="'+name+'">'+Object.entries(options).map(([key,label])=>
    '<option value="'+esc(key)+'"'+(key===value?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
  const field = (label,content) => '<label class="field"><span>'+label+'</span>'+content+'</label>';
  const input = (name,value='',attrs='') => '<input name="'+name+'" value="'+esc(value??'')+'" '+attrs+'>';
  const close = () => JTDDialogs.close('journal-overlay');
  window.refreshJournal = () => { if(!$('journal-overlay').classList.contains('hidden')) close(); render(); };
  function identityCard(entry,editable=false){
    return '<div class="game-identity-summary'+(editable?'':' journal-identity-read')+'">'+
      identitySummaryHtml({nom:entry.name,plateforme:entry.platform,image:safeURL(entry.image,true),imageFit:entry.imageFit})+
      '<small class="journal-identity-meta">'+esc([formats[entry.format],entry.precision].filter(Boolean).join(' · '))+'</small></div>';
  }
  function show(title,html,editing=false,canComplete=false){
    $('journal-dialog-title').textContent = title;
    $('journal-dialog-body').innerHTML = html;
    $('journal-save').classList.toggle('hidden',!editing);
    $('journal-delete').classList.toggle('hidden',editing);
    $('journal-edit').classList.toggle('hidden',editing);
    $('journal-complete').classList.toggle('hidden',!canComplete);
    $('journal-close').textContent = editing ? 'Annuler' : 'Fermer';
    JTDDialogs.open('journal-overlay',{onDismiss:close});
    const target = [...$('journal-dialog-body').querySelectorAll('input:not([type="hidden"]),button')].find(element=>element.getClientRects().length);
    target?.focus({preventScroll:true});
  }
  function validDay(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value+'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10)===value;
  }
  function edit(entry,fromBacklog=false){
    const group=entry.group, done=group==='completed', release=group==='release';
    const date=entry.date ?? (done?today():'');
    const existing=records().some(record=>record?.id===entry.id);
    const generation=window.JTDAccountGeneration;
    const sources=GAMES;
    show(existing&&!fromBacklog?'Modifier l’entrée':done?'Ajouter une complétion':'Ajouter un jeu',
      '<form id="journal-form">'+
      '<section class="form-section journal-game-section">'+
      '<div id="journal-game-summary"'+(!existing?' class="hidden"':'')+'>'+identityCard(entry,!fromBacklog)+'</div>'+
      '<div id="journal-game-editor"'+(existing?' class="hidden"':'')+'>'+
      (!existing?field('Chercher dans la collection',input('lookup','','type="search" placeholder="Titre ou plateforme"'))+field('Jeu de la collection',select('source',{'':'Saisie manuelle'},'')):'')+
      '<div class="journal-form-grid">'+field('Titre',input('name',entry.name,'required maxlength="500"'))+
      field('Plateforme',input('platform',entry.platform,'required maxlength="120" list="journal-platforms"'))+'</div>'+
      '<datalist id="journal-platforms">'+allPlatformNames().map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>'+
      field('Précision',input('precision',entry.precision,'maxlength="250" placeholder="Version 1.0, suggéré par…"'))+
      '<div class="journal-form-grid">'+field('Image (URL)',input('image',entry.image,'maxlength="200000"'))+
      field('Support',select('format',formats,entry.format||'digital'))+'</div>'+
      '<button type="button" class="btn btn-ghost" id="journal-apply-identity">Valider le jeu</button></div></section>'+
      (done?'<section class="form-section"><div class="form-section-title">Complétion</div><div class="journal-form-grid">'+field('Date de complétion',input('date',date,'type="date" required'))+
        field('Précision de la date',select('estimated',{'0':'Exacte','1':'Approximative','year':'Année seule'},entry.yearOnly?'year':entry.estimated?'1':'0'))+'</div>':'<section class="form-section">')+
      (release?field('Sortie',input('date',date,'placeholder="AAAA, AAAA-MM ou AAAA-MM-JJ" maxlength="10"')):'')+
      (!done&&!release?field('Statut',select('group',{backlog:'Backlog',playing:'En cours'},group)):'')+
      (done?field('Accès',select('access',access,entry.access||'owned')):'')+
      (done?'<div id="journal-service">'+field('Nom de l’abonnement',input('service',entry.service,'maxlength="120"'))+'</div>'+
        '<label class="journal-checkbox"><input type="checkbox" name="replayed"'+(entry.replayed?' checked':'')+'> Rejoué</label>'+
        '<div class="journal-form-grid">'+field('Mode de jeu',select('mode',modes,entry.mode||'solo'))+
        field('Complétion',select('completion',completions,entry.completion||'finished'))+'</div>'+
        '<div class="journal-form-ratings">'+criteria.map((label,index)=>field(label,select('note'+index,Object.fromEntries(ratings.map(value=>[value,value||'–'])),entry.notes?.[index]||''))).join('')+'</div>'+
        field('Ressenti',select('feeling',{'':'–',...feelings},entry.feeling||''))+
        field('Commentaire','<textarea name="comment" maxlength="10000" rows="4">'+esc(entry.comment||'')+'</textarea>'):'')+
      '</section><p id="journal-error" role="alert" class="journal-error"></p></form>',true);
    const form=$('journal-form'), elements=form.elements;
    const summary=$('journal-game-summary'), editor=$('journal-game-editor');
    const compactIdentity=()=>{
      if(!elements.name.value.trim() || !elements.platform.value.trim()){
        (elements.name.value.trim()?elements.platform:elements.name).reportValidity();
        return;
      }
      summary.innerHTML=identityCard({name:elements.name.value,platform:elements.platform.value,image:elements.image.value,format:elements.format.value,precision:elements.precision.value},true);
      summary.classList.remove('hidden');
      editor.classList.add('hidden');
      (elements.date || $('journal-save')).focus();
    };
    $('journal-apply-identity').onclick=compactIdentity;
    summary.addEventListener('click',event=>{
      if(!event.target.closest('.identity-edit-btn') || fromBacklog) return;
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
    if(elements.source){
      const fill = () => {
        const query=elements.lookup.value.trim().toLocaleLowerCase('fr');
        const choices=sources.filter(item=>(item.nom+' '+item.plateforme).toLocaleLowerCase('fr').includes(query));
        elements.source.replaceChildren(new Option('Saisie manuelle',''),...choices.map(item=>new Option(item.nom+' · '+item.plateforme,item.id)));
      };
      fill();
      elements.lookup.addEventListener('input',fill);
      elements.source.addEventListener('change',()=>{
        const item=sources.find(game=>game.id===elements.source.value);
        if(!item) return;
        elements.name.value=item.nom;
        elements.platform.value=item.plateforme;
        elements.image.value=item.image||'';
        elements.format.value=JTDData.isAddon(item)?'extension':JTDData.isDigital(item)?'digital':'physical';
        compactIdentity();
      });
    }
    if(done){
      const toggle = () => $('journal-service').classList.toggle('hidden',elements.access.value!=='subscription');
      elements.access.addEventListener('change',toggle);
      toggle();
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(generation!==window.JTDAccountGeneration){close();return;}
      const value=name=>elements[name]?.value.trim()||'';
      try{
        if(!value('name')||!value('platform')) throw Error('Renseigne le titre et la plateforme.');
        if(done&&!validDay(value('date'))) throw Error('Renseigne une date de complétion valide.');
        if(release&&value('date')&&!/^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$/.test(value('date'))&&!validDay(value('date'))) throw Error('Indique une année, un mois ou une date valide.');
        const art=safeURL(value('image'),true);
        if(value('image')&&!art) throw Error('L’adresse de l’image est invalide.');
        const next={id:entry.id||crypto.randomUUID(),group:value('group')||group,name:value('name'),platform:value('platform'),precision:value('precision'),image:art,format:value('format')};
        if(done||release) next.date=value('date');
        if(done) Object.assign(next,{estimated:value('estimated')!=='0',yearOnly:value('estimated')==='year',access:value('access'),service:value('access')==='subscription'?value('service'):'',replayed:elements.replayed.checked,mode:value('mode'),completion:value('completion'),notes:criteria.map((_,index)=>value('note'+index)),feeling:value('feeling'),comment:value('comment')});
        const current=records();
        if(existing&&!current.some(record=>record?.id===entry.id)) throw Error('Cette entrée n’existe plus.');
        commit(existing?current.map(record=>record?.id===next.id?next:record):[...current,next]);
        if(done){
          render();
          $('journal-year').value=next.date.slice(0,4);
          if(fromBacklog){ $('journal-layout').dataset.tab='completed'; syncTabs(); }
        }
        close(); render();
      }catch(error){$('journal-error').textContent=error.message;}
    });
  }
  function detail(entry){
    const done=entry.group==='completed';
    const generation=window.JTDAccountGeneration;
    const canComplete=['playing','backlog'].includes(entry.group);
    show(done?'Fiche de complétion':'Fiche du jeu',
      '<section class="form-section">'+identityCard(entry)+'</section>'+
      '<section class="form-section"><div class="form-section-title">'+(done?'Complétion':entry.group==='release'?'Sortie':'Backlog')+'</div>'+
      '<div class="context-summary">'+
      ((entry.date || entry.group==='release')?'<p>'+esc(dateLabel(entry))+(entry.estimated?' · Date approximative':'')+'</p>':'')+
      '<p>'+esc([entry.access&&access[entry.access],entry.service,entry.replayed&&'Rejoué',modes[entry.mode],completions[entry.completion],feelings[entry.feeling],canComplete&&(entry.group==='playing'?'En cours':'À faire')].filter(Boolean).join(' · '))+'</p></div>'+
      (done?'<div class="journal-detail-ratings">'+criteria.map((label,index)=>'<div>'+esc(label)+score(entry.notes?.[index],label)+'</div>').join('')+'</div>'+
      '<div class="form-section-title">Commentaire</div><p class="journal-comment">'+esc(entry.comment||'Aucun commentaire.')+'</p>':'')+
      '</section>',false,canComplete);
    $('journal-edit').onclick=()=>edit(entry);
    $('journal-complete').onclick=()=>edit({...entry,group:'completed'},true);
    $('journal-delete').onclick=()=>confirmAction('Supprimer cette entrée du journal ?',()=>{
      if(generation!==window.JTDAccountGeneration) return;
      try { commit(records().filter(record=>record?.id!==entry.id)); close(); render(); }
      catch(error){ showToast(error.message); }
    });
  }
  const mobileJournal=matchMedia('(max-width:820px)');
  function syncTabs(){
    const layout=$('journal-layout');
    const selected=mobileJournal.matches ? layout.dataset.tab : layout.dataset.side;
    document.querySelectorAll('[data-journal-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.journalTab===selected)));
  }
  mobileJournal.addEventListener('change',syncTabs);
  syncTabs();
  $('journal-year').addEventListener('change',render);
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
