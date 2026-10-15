(() => {
  const $ = id => document.getElementById(id);
  const overlay = $('cemetery-import-overlay');
  if(!overlay) return;
  let rows = [];
  let accountGeneration = 0;

  const normalize = JTDData.foldImport;
  const keyOf = JTDData.importKey;
  const platformName = JTDData.importPlatform;
  let previewState = '';
  const rowElements = new Map();
  function parseMoney(value){
    let raw = String(value ?? '').trim().replace(/[€\s\u00a0]/g,'');
    if(!raw) return null;
    if(raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,'');
    else raw = raw.replace(',','.');
    const amount = Number(raw);
    if(!Number.isFinite(amount) || amount < 0) throw new Error('Montant invalide : ' + value);
    return amount;
  }
  function parseDate(value){
    const raw = String(value ?? '').trim();
    if(!raw) return null;
    const fr = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if(fr) return fr[3] + '-' + fr[2].padStart(2,'0') + '-' + fr[1].padStart(2,'0');
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : raw;
  }
  function parseDelimited(text, delimiter){
    const records = [];
    let row = [], field = '', quoted = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      if(quoted){
        if(ch === '"' && text[i+1] === '"'){field+='"';i++;}
        else if(ch === '"') quoted = false;
        else field += ch;
      } else if(ch === '"' && field === '') quoted = true;
      else if(ch === delimiter){row.push(field);field='';}
      else if(ch === '\n' || ch === '\r'){
        if(ch === '\r' && text[i+1] === '\n') i++;
        row.push(field); field=''; records.push(row); row=[];
      } else field += ch;
    }
    if(field || row.length){row.push(field);records.push(row);}
    return records.filter(record => record.some(value => String(value).trim()));
  }
  function fromCSV(text, fileName){
    const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/,3);
    const delimiter = fileName.toLowerCase().endsWith('.tsv') || lines[0].split('\t').length > lines[0].split(';').length
      ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
    const matrix = parseDelimited(text.replace(/^\uFEFF/,''), delimiter);
    if(matrix.length < 2) throw new Error('Le fichier ne contient aucune ligne de jeu.');
    const headers = matrix[0].map(normalize);
    const find = names => headers.findIndex(header => names.includes(header));
    // Prefer explicit headers; historical JEU/NOM exports use JEU as platform.
    let titleCol = find(['titre','titre du jeu','nom','nom jeu','jeu video','nom du jeu','game','title']);
    let platformCol = find(['plateforme','console','support','platform']);
    if(platformCol < 0 && titleCol >= 0) platformCol = find(['jeu']);
    if(titleCol < 0 && platformCol >= 0) titleCol = find(['jeu']);
    if(titleCol < 0 || platformCol < 0) throw new Error('Colonnes de titre et de plateforme introuvables. Vérifie que le CSV contient les en-têtes du cimetière.');
    const dateCol = find(['date','date achat','date d achat']);
    const sourceCol = find(['source','provenance','magasin','lieu achat','lieu d achat']);
    const purchaseCol = find(['prix','prix achat','prix d achat']);
    const channelCol = find(['canal','lieu','lieu de vente','type de vente','mode de vente','vente']);
    const estimateCol = find(['valeur','estimation','prix estime','prix estimatif']);
    const gainCol = find(['gain','prix vente','prix reel','gain reel']);
    const imageCol = find(['image','url image','jaquette']);
    const saleVenueCol = find(['plateforme de vente','vendeur','site de vente']);
    const lotCol = find(['lot','lot id','id lot','lot vente','groupe vente','sale id']);
    const saleOrderCol = find(['ordre vente','sale order']);
    const entries = [];
    for(const cells of matrix.slice(1)){
      const get = index => index < 0 ? '' : (cells[index] ?? '').trim();
      const nom = get(titleCol), rawPlatform = get(platformCol);
      if(!nom || !rawPlatform) continue;
      const gain = parseMoney(get(gainCol));
      const item = {
        id:'import-' + Math.random().toString(36).slice(2,12),
        nom, plateforme:platformName(rawPlatform), saleStatus:gain == null ? 'pending' : 'sold'
      };
      const date = parseDate(get(dateCol)); if(date) item.date = date;
      const source = get(sourceCol); if(source) item.source = source;
      const purchase = parseMoney(get(purchaseCol)); if(purchase != null) item.prix = purchase;
      const estimate = parseMoney(get(estimateCol)); if(estimate != null) item.estimatedPrice = estimate;
      if(gain != null) item.salePrice = gain;
      const channel = normalize(get(channelCol));
      if(channel.includes('online') || channel.includes('internet') || channel.includes('reseau') || get(channelCol).includes('🛜')) item.saleChannel = 'online';
      else if(channel.includes('boutique') || channel.includes('magasin') || channel.includes('store') || get(channelCol).includes('🏪')) item.saleChannel = 'store';
      const venue = get(saleVenueCol); if(venue) item.saleVenue = venue;
      const lot = get(lotCol); if(lot) item.saleId = lot;
      const order = get(saleOrderCol); if(order && Number.isFinite(Number(order))) item.saleOrder = Number(order);
      const image = get(imageCol); if(image && /^https?:\/\//i.test(image)) item.image = image;
      entries.push(item);
    }
    return entries;
  }
  async function readEntries(file){
    const content = await file.text();
    if(/\.json$/i.test(file.name) || file.type.includes('json')){
      const parsed = JSON.parse(content);
      if(parsed && parsed.app === 'Jeux Tout Doux' && (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > 4)) throw new Error('Version de sauvegarde incompatible.');
      const entries = Array.isArray(parsed) ? parsed : parsed?.data?.cemetery || parsed?.cemetery;
      if(!Array.isArray(entries)) throw new Error('Aucune liste de cimetière trouvée dans ce fichier.');
      return entries;
    }
    return fromCSV(content, file.name);
  }
  function setStatus(message){ $('cemetery-import-summary').textContent = message; }
  const snapshot = state => JSON.stringify(state);
  const candidateLabel = game => {
    const where=game.location==='collection'?'Collection':game.location==='sold'?'Vendu':'À vendre';
    return game.nom+' · '+game.plateforme+' · '+where+(game.collector?' · Collector':'')+(game.japanese?' · Japonais':'')+(game.date?' · '+game.date:'')+(game.source?' · '+game.source:'')+(game.prix!=null?' · achat '+game.prix+' €':'')+' · réf. '+game.id;
  };
  function renderPreview(){
    const list = $('cemetery-import-list');
    list.replaceChildren();
    rowElements.clear();
    const state = window.JTDGetCemeteryImportState();
    previewState = snapshot(state);
    const seenInput = new Set();
    let added = 0, alreadyThere = 0, conflicts = 0, repeated = 0;
    for(const entry of rows){
      const key = keyOf(entry);
      entry.candidates=JTDData.importCandidates(entry,state.games,state.cemetery);
      entry.gameId='';
      if(seenInput.has(key)){ entry.kind='repeat'; entry.choice='skip'; repeated++; continue; }
      seenInput.add(key);
      const exact=entry.candidates.filter(g=>g.exact);
      if(exact.length===1 && exact[0].location!=='collection'){
        entry.kind='existing'; entry.choice='skip'; entry.gameId=exact[0].id; alreadyThere++;
      }else if(entry.candidates.some(g=>g.score>0)){
        entry.kind='match'; entry.choice=''; conflicts++;
        // A single exact candidate may be proposed, never applied without a decision.
        if(exact.length===1)entry.gameId=exact[0].id;
      }else{entry.kind='new';entry.choice='add';added++;}
    }
    setStatus(rows.length+' ligne(s) lue(s) · '+added+' ajout(s) direct(s) · '+conflicts+' correspondance(s) à trancher · '+(alreadyThere+repeated)+' doublon(s) ignoré(s).');
    $('cemetery-import-error').textContent = '';
    const reviewSection=document.createElement('section');reviewSection.className='cemetery-import-review';
    const heading=document.createElement('h3');heading.id='cemetery-import-review-title';heading.setAttribute('aria-live','polite');reviewSection.append(heading);
    const otherSection=document.createElement('details');otherSection.className='cemetery-import-other';otherSection.open=conflicts===0;
    const otherHeading=document.createElement('summary');otherHeading.textContent='Autres lignes · '+(rows.length-conflicts)+' ('+added+' ajout(s), '+(alreadyThere+repeated)+' ignorée(s))';otherSection.append(otherHeading);
    if(conflicts)list.append(reviewSection);
    if(rows.length>conflicts)list.append(otherSection);
    for(const entry of rows){
      const line=document.createElement('div');line.className='cemetery-import-row';line.dataset.kind=entry.kind;
      const identity=document.createElement('div');identity.className='cemetery-import-identity';
      if(entry.kind==='match'){const badge=document.createElement('span');badge.className='cemetery-import-review-badge';identity.append(badge);}
      const title=document.createElement('strong');title.textContent=entry.nom;
      const detail=document.createElement('span');detail.textContent=entry.plateforme+(entry.saleStatus==='sold'?' · encaissé '+entry.salePrice+' €':' · à vendre');
      identity.append(title,detail);
      const acquisition=document.createElement('span');
      acquisition.textContent=[entry.date || 'Date d’achat non renseignée',entry.source,entry.prix!=null?'Achat '+entry.prix+' €':'',entry.estimatedPrice!=null?'Estimation '+entry.estimatedPrice+' €':'',entry.saleVenue,entry.saleId?'Lot '+entry.saleId:''].filter(Boolean).join(' · ');
      identity.append(acquisition);line.append(identity);
      const action=document.createElement('div');action.className='cemetery-import-action';
      {
        if(entry.kind==='repeat'){
          const note=document.createElement('span');note.className='cemetery-import-status';note.textContent='Répétition dans le fichier · ignorée par défaut. Ajoute un exemplaire distinct uniquement s’il s’agit d’une autre copie.';action.append(note);
        }
        if(entry.kind==='existing'){
          const note=document.createElement('span');note.className='cemetery-import-status';note.textContent='Déjà au cimetière · conservé tel quel';action.append(note);
        }
        const actionLabel=document.createElement('label');actionLabel.textContent='Action';
        const select=document.createElement('select');select.setAttribute('aria-label','Action pour '+entry.nom);
        for(const [value,label] of [['','Choisir une action…'],['transfer','Transférer cet exemplaire'],['keep','Ajouter un exemplaire distinct'],['skip','Ignorer cette ligne']]) select.add(new Option(label,value));
        select.value=entry.choice==='add'?'keep':entry.choice;
        actionLabel.append(select);action.append(actionLabel);
        const picker=document.createElement('details');picker.className='cemetery-import-picker';
        picker.open=entry.kind==='match' && !entry.gameId;
        const summary=document.createElement('summary');summary.textContent='Exemplaire proposé / rechercher';picker.append(summary);
        const search=document.createElement('input');search.type='search';search.placeholder='Titre ou plateforme';search.setAttribute('aria-label','Rechercher un exemplaire pour '+entry.nom);picker.append(search);
        const source=document.createElement('select');source.className='cemetery-import-source';source.setAttribute('aria-label','Exemplaire pour '+entry.nom);picker.append(source);
        const proposed=document.createElement('span');proposed.className='cemetery-import-status';action.append(proposed);
        const refresh=()=>{
          const query=normalize(search.value);const matches=entry.candidates.filter(g=>!query||normalize(g.nom+' '+g.plateforme+' '+platformName(g.plateforme)).includes(query));
          source.replaceChildren(new Option('Aucun exemplaire sélectionné',''));
          for(const game of matches)source.add(new Option((game.score>0?'Suggestion · ':'')+candidateLabel(game),game.id));
          if(entry.gameId&&!matches.some(g=>g.id===entry.gameId)){const game=entry.candidates.find(g=>g.id===entry.gameId);if(game)source.add(new Option(candidateLabel(game),game.id));}
          source.value=entry.gameId;
          const game=entry.candidates.find(g=>g.id===entry.gameId);
          proposed.textContent=game?candidateLabel(game):'';
        };
        search.addEventListener('input',refresh);
        source.addEventListener('change',()=>{entry.gameId=source.value;entry.choice='';select.value='';refresh();validateChoices();});
        select.addEventListener('change',()=>{entry.choice=select.value;if(entry.choice==='transfer'&&!entry.gameId)picker.open=true;validateChoices();});
        refresh();action.append(picker);
      }
      line.append(action);rowElements.set(entry,line);(entry.kind==='match'?reviewSection:otherSection).append(line);
    }
    $('cemetery-import-apply').textContent='Ajouter au cimetière';
    validateChoices();
  }
  function validateChoices(){
    const targets=new Map();const invalid=new Map();
    for(const entry of rows){
      if(!entry.choice)invalid.set(entry,'Choisis une action pour chaque correspondance.');
      if(entry.choice==='transfer'){
        const game=entry.candidates.find(g=>g.id===entry.gameId);
        if(!game || game.location!=='collection')invalid.set(entry,'Choisis un exemplaire de la collection pour le transférer. Un exemplaire déjà au cimetière peut être conservé en ignorant la ligne.');
        else if(targets.has(game.id)){
          const message='Un exemplaire ne peut être transféré qu’une fois. Vérifie les correspondances.';
          invalid.set(entry,message);invalid.set(targets.get(game.id),message);
        }else targets.set(game.id,entry);
      }
    }
    let pending=0;
    for(const entry of rows){
      const line=rowElements.get(entry);const needsReview=invalid.has(entry);
      line?.classList.toggle('needs-review',needsReview);
      const badge=line?.querySelector('.cemetery-import-review-badge');
      if(badge)badge.textContent=needsReview?'À revoir':'Choix validé';
      if(needsReview)pending++;
    }
    const heading=$('cemetery-import-review-title');if(heading)heading.textContent=pending?pending+' jeu'+(pending>1?'x':'')+' à revoir':'Correspondances vérifiées';
    const error=invalid.values().next().value||'';
    $('cemetery-import-error').textContent=error;
    $('cemetery-import-apply').disabled=!!error||!rows.some(entry=>entry.choice!=='skip');
    return !error;
  }
  function open(){window.JTDDialogs.open(overlay.id,{onDismiss:close,initialFocus:'#cemetery-import-cancel',trigger:document.getElementById('profile-menu-btn')});}
  function close(){window.JTDDialogs.close(overlay.id);rows=[];}
  $('cemetery-import-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value='';
    if(!file) return;
    accountGeneration = window.JTDAccountGeneration || 0;
    try{
      const input = await readEntries(file);
      if(accountGeneration !== (window.JTDAccountGeneration || 0)) return;
      const normalized = window.JTDData.normalizeData({games:[],cemetery:input});
      rows = normalized.cemetery.map(entry => ({...entry, plateforme:platformName(entry.plateforme)}));
      if(!rows.length) throw new Error('Aucun jeu avec un titre et une plateforme valides.');
      renderPreview(); open();
    }catch(error){
      window.showToast?.(error.message || 'Import impossible.');
      console.error('Import du cimetière impossible',error);
    }
  });
  $('cemetery-import-cancel').addEventListener('click',close);
  $('cemetery-import-apply').addEventListener('click',() => {
    if(accountGeneration !== (window.JTDAccountGeneration || 0)){ $('cemetery-import-error').textContent='Le compte a changé. Relance l’import depuis le bon compte.'; return; }
    const state = window.JTDGetCemeteryImportState();
    if(snapshot(state)!==previewState){renderPreview();$('cemetery-import-error').textContent='Les données ont changé. Vérifie à nouveau les correspondances avant de confirmer.';return;}
    if(!validateChoices())return;
    const games = state.games.slice(), cemetery = state.cemetery.slice();
    const remaining = rows.filter(entry => entry.choice && entry.choice !== 'skip');
    const uniqueId = base => {
      let id = base || 'import-' + Math.random().toString(36).slice(2,10), n=1;
      const used = new Set([...state.usedIds,...cemetery.map(item=>item.id)]);
      while(used.has(id)) id = (base || 'import') + '-' + n++;
      return id;
    };
    for(const entry of remaining){
      const {kind,gameId,choice,candidates,...incoming} = entry;
      if(entry.choice === 'transfer'){
        const game = games.find(item=>item.id===entry.gameId);
        if(!game) continue;
        const merged = {...incoming,...game,id:game.id,nom:game.nom,plateforme:game.plateforme,saleStatus:incoming.saleStatus};
        // Fill missing acquisition fields without replacing recorded collection data.
        for(const field of ['date','source','prix','image','lien']){
          if((game[field] == null || game[field] === '') && incoming[field] != null) merged[field] = incoming[field];
        }
        for(const field of ['saleVenue','saleChannel','estimatedPrice','salePrice','saleId','saleOrder']){
          if(incoming[field] !== undefined) merged[field] = incoming[field];
          else delete merged[field];
        }
        games.splice(games.indexOf(game),1);
        cemetery.push(merged);
      } else cemetery.push({...incoming,id:uniqueId(entry.id)});
    }
    try{
      window.JTDApplyCemeteryImport(games,cemetery);
      const added = remaining.length;
      close();
      window.showToast?.(added + ' entrée(s) ajoutée(s) au cimetière. Les transferts choisis ont été appliqués ; les autres listes sont conservées.');
    }catch(error){
      $('cemetery-import-error').textContent=error.message || 'Enregistrement impossible. Aucune modification appliquée.';
    }
  });
})();

