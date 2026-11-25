/* French eShop index. Artwork stays on Nintendo's CDN. */
const switchArtworkMarket = (() => {
  const base = new URL('switch-catalog/', document.currentScript.src);
  const build = document.querySelector('meta[name="regal-build"]')?.content || '';
  const imageUrl = value => {
    if (/^[a-f0-9]{64}$/i.test(value)) return 'https://img-eshop.cdn.nintendo.net/i/'+value+'.jpg';
    if (/^https:\/\/www\.nintendo\.com\/eu\/media\/images\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(value)) return value;
    if (typeof value==='string' && /^\/[\w%./-]+\.(?:jpe?g|png|webp)$/i.test(value)) return 'https://www.nintendo.com/eu/media/images'+value;
    if (/^https:\/\/assets\.nintendo\.eu\/image\/private\/[\w,/-]+$/.test(value)) return value;
    return '';
  };
  let pending;
  function load(){
    if(!pending){
      const get=async name=>{
        const url=new URL(name,base);
        url.searchParams.set('v',build);
        const response=await fetch(url);
        if(!response.ok) throw Error('Catalogue eShop indisponible.');
        return response.json();
      };
      pending=Promise.all([get('manifest.json'),get('nintendo-fr-manifest.json')])
        .then(async ([legacy,official])=>{
          const [legacyParts,officialParts]=await Promise.all([
            Promise.all(legacy.map(get)),Promise.all(official.map(get))
          ]);
          const rows=officialParts.flat().map(([id,name,square,banner,platform])=>({id,name,square,banner,platform}));
          const key=row=>row.platform+'|'+JTDData.foldImport(row.name);
          const known=new Map(rows.map(row=>[key(row),row]));
          for(const [id,name,square,banner] of legacyParts.flat()){
            const row={id,name,square,banner,platform:id.startsWith('04')?'Switch 2':'Switch'};
            const official=known.get(key(row));
            if(!official) rows.push(row);
            else if(!official.id) official.id=id;
          }
          return rows.map(row=>({...row,key:JTDData.foldImport(row.name),square:imageUrl(row.square),banner:imageUrl(row.banner)}));
        })
        .catch(error=>{pending=null;throw error;});
    }
    return pending;
  }
  function platformOf(value){
    const platform=JTDData.importPlatform(value);
    return /^Nintendo Switch(?: 2)?$/i.test(platform) ? platform.replace(/^Nintendo /i,'') :
      /^Switch(?: 2)?$/i.test(platform) ? platform : '';
  }
  function search(rows, title, platform, limit=8){
    const key=JTDData.foldImport(title);
    if(key.length<2) return [];
    const ranked=[[],[],[]];
    for(const row of rows){
      if(platform && row.platform!==platform) continue;
      if(row.key===key) ranked[0].push(row);
      else if(row.key.startsWith(key)) ranked[1].push(row);
      else if(row.key.includes(key)) ranked[2].push(row);
    }
    return ranked.flat().slice(0,limit);
  }
  function patch(game,row,{rename=false,replace=false}={}){
    return {
      ...(rename ? {nom:row.name} : {}),
      ...((replace || !game.image) && row.banner ? {image:row.banner} : {}),
      ...((replace || !game.squareImage) && row.square ? {squareImage:row.square} : {}),
      ...(row.id ? {nintendoTitleId:row.id} : {})
    };
  }
  return {load,search,platformOf,patch};
})();

function fillArtworkFields(prefix,item){
  const square=document.getElementById(prefix+'-square-image');
  const title=document.getElementById(prefix+'-nintendo-id');
  if(square){square.value=item?.squareImage || '';square.dataset.hadValue=item?.squareImage?'1':'';square.dispatchEvent(new Event('input'));}
  if(title){title.value=item?.nintendoTitleId || '';title.dispatchEvent(new Event('change'));}
  const suggestions=document.getElementById(prefix+'-eshop-results');
  suggestions?.replaceChildren();
}
function readArtworkFields(prefix){
  const squareImage=safeURL(document.getElementById(prefix+'-square-image')?.value.trim(),true) || null;
  const id=document.getElementById(prefix+'-nintendo-id')?.value;
  return {...(squareImage || document.getElementById(prefix+'-square-image')?.dataset.hadValue ? {squareImage} : {}), ...(id ? {nintendoTitleId:id} : {})};
}

function mountSwitchArtwork(editor,{prefix,name,platform,image}){
  if(!editor || !name || !platform || !image) return;
  const id=document.createElement('input');
  id.type='hidden'; id.id=prefix+'-nintendo-id'; id.name='nintendoTitleId';
  const field=document.createElement('div');
  field.className='field switch-square-field';
  field.innerHTML='<label for="'+prefix+'-square-image">Icône carrée</label><input type="url" id="'+prefix+'-square-image" name="squareImage" placeholder="https://…"><div class="switch-square-preview">Aperçu de l’icône</div>';
  const square=field.querySelector('input'), squarePreview=field.lastElementChild;
  function previewSquare(){
    const url=safeURL(square.value.trim(),true);
    squarePreview.textContent='Aperçu de l’icône';
    if(!url) return;
    const preview=new Image();
    preview.alt='Aperçu de l’icône'; preview.src=url;
    preview.onerror=()=>{if(preview.isConnected) squarePreview.textContent='Image introuvable';};
    squarePreview.replaceChildren(preview);
  }
  square.addEventListener('input',previewSquare);
  image.labels[0].firstChild.textContent='Bannière 16:9 ';
  const banner=image.closest('.image-url-row');
  const fit=banner.nextElementSibling;
  const artwork=document.createElement('div');
  artwork.className='switch-artwork-grid';
  const bannerPanel=document.createElement('div');
  bannerPanel.className='switch-banner-field';
  banner.before(artwork);
  artwork.append(bannerPanel,field);
  bannerPanel.append(banner);
  if(fit?.classList.contains('image-fit-field')) bannerPanel.append(fit);
  artwork.after(id);
  const home=document.createElement('button');
  home.type='button'; home.className='manage-link hidden'; home.textContent='Essayer l’icône HOME';
  const homeStatus=document.createElement('small');
  homeStatus.setAttribute('role','status');
  field.append(home,homeStatus);
  id.addEventListener('change',()=>{
    home.classList.toggle('hidden',!/^01[0-9A-F]{14}$/.test(id.value));
    homeStatus.textContent='';
  });
  home.onclick=()=>{
    const selected=id.value, generation=window.JTDAccountGeneration;
    const priorSquare=square.value;
    if(!/^01[0-9A-F]{14}$/.test(selected)) return;
    const url='https://api.nlib.cc/nx/'+selected+'/icon';
    const picture=new Image();
    homeStatus.textContent='Vérification de l’icône HOME…';
    const stillCurrent=()=>id.value===selected && generation===window.JTDAccountGeneration &&
      square.value===priorSquare && !!field.closest('.modal-overlay:not(.hidden)');
    picture.onload=()=>{
      if(!stillCurrent()) return;
      square.value=url;
      previewSquare();
      homeStatus.textContent='Icône HOME sélectionnée.';
    };
    picture.onerror=()=>{
      if(stillCurrent()) homeStatus.textContent='Icône HOME indisponible chez Nlib.';
    };
    picture.src=url;
  };

  const results=document.createElement('div');
  results.id=prefix+'-eshop-results';
  results.className='switch-art-results';
  results.setAttribute('aria-label','Suggestions eShop');
  const anchor=document.createElement('div');
  anchor.className='switch-art-anchor';
  name.before(anchor);
  anchor.append(name,results);
  name.setAttribute('autocomplete','off');
  name.setAttribute('aria-controls',results.id);
  results.setAttribute('aria-live','polite');
  let timer,revision=0;
  function update(){
    clearTimeout(timer);
    const current=++revision;
    results.replaceChildren();
    const selectedPlatform=switchArtworkMarket.platformOf(platform.value);
    const query=name.value.trim();
    if(query.length<3 || (platform.value && !selectedPlatform) || editor.classList.contains('hidden')) return;
    const generation=window.JTDAccountGeneration;
    timer=setTimeout(async()=>{
      try{
        const rows=await switchArtworkMarket.load();
        if(current!==revision || query!==name.value.trim() || generation!==window.JTDAccountGeneration || !results.isConnected ||
            !name.closest('.modal-overlay:not(.hidden)')) return;
        const choices=switchArtworkMarket.search(rows,query,selectedPlatform);
        if(!choices.length) results.textContent=selectedPlatform
          ? 'Aucun titre '+selectedPlatform+' trouvé dans le catalogue Nintendo.'
          : 'Aucun titre trouvé dans le catalogue Nintendo.';
        for(const row of choices){
          const button=document.createElement('button');
          button.type='button';
          button.className='switch-art-choice';
          const title=document.createElement('strong');
          title.textContent=row.name;
          const detail=document.createElement('small');
          const alias=[...platform.options].find(option=>switchArtworkMarket.platformOf(option.value)===row.platform);
          const label=alias?.textContent || (row.platform==='Switch' ? 'Nintendo Switch' : 'Nintendo Switch 2');
          detail.innerHTML=getPlatformOptionIconHtml(alias?.value || row.platform);
          detail.append(label);
          button.title=row.id;
          button.append(title,detail);
          button.onclick=()=>{
            name.value=row.name;
            if(!platform.value){
              if(!alias) platform.add(new Option(row.platform,row.platform));
              setSelectValueAndSync(platform.id,alias?.value || row.platform);
              platform.dispatchEvent(new Event('change',{bubbles:true}));
            }
            if(row.banner){image.value=row.banner;image.dispatchEvent(new Event('input',{bubbles:true}));}
            if(row.square){square.value=row.square;square.dispatchEvent(new Event('input',{bubbles:true}));}
            const details=artwork.closest('details');
            if(details) details.open=true;
            id.value=row.id || '';
            id.dispatchEvent(new Event('change'));
            clear();
            name.focus({preventScroll:true});
          };
          results.appendChild(button);
        }
      }catch{
        if(current===revision && query===name.value.trim() && results.isConnected) results.textContent='Catalogue indisponible. Tu peux utiliser des liens manuels.';
      }
    },220);
  }
  function clear(){
    clearTimeout(timer);
    revision++;
    results.replaceChildren();
  }
  let pointerInside=false;
  // Mobile Safari can blur the input before delivering the suggestion's click.
  results.addEventListener('pointerdown',()=>{pointerInside=true;});
  results.addEventListener('pointercancel',()=>{pointerInside=false;});
  results.addEventListener('pointerup',()=>setTimeout(()=>{pointerInside=false;},350));
  anchor.addEventListener('focusout',event=>{
    if(!pointerInside && event.relatedTarget && !anchor.contains(event.relatedTarget)) clear();
  });
  anchor.addEventListener('keydown',event=>{
    if(event.key==='Escape' && results.childNodes.length){
      event.preventDefault();
      event.stopPropagation();
      clear();
      name.focus();
    }
  });
  name.addEventListener('input',update);
  platform.addEventListener('change',update);
  name.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown' && results.firstElementChild){
      event.preventDefault();results.firstElementChild.focus();
    }
  });
}

for(const prefix of ['f','a','w']){
  const bySuffix=suffix=>document.getElementById(prefix+'-'+suffix);
  mountSwitchArtwork(bySuffix('identity-editor'),{prefix,name:bySuffix('nom'),platform:bySuffix('plateforme'),image:bySuffix('image')});
}

(() => {
  const $=id=>document.getElementById(id);
  const dialog=$('switch-artwork-overlay'), list=$('switch-artwork-list'), status=$('switch-artwork-status');
  const save=$('switch-artwork-apply'), rename=$('switch-artwork-rename'), replace=$('switch-artwork-replace');
  const close=()=>JTDDialogs.close(dialog.id);
  let generation, candidates=[], request=0;
  $('switch-artwork-close').onclick=()=>{request++;close();};
  $('switch-artwork-open').onclick=async()=>{
    const current=++request;
    generation=window.JTDAccountGeneration;
    candidates=[];
    list.replaceChildren();save.disabled=true;
    rename.checked=false;replace.checked=false;
    status.textContent='Chargement du catalogue français…';
    JTDDialogs.open(dialog.id,{onDismiss:()=>{request++;close();}});
    try{
      const index=await switchArtworkMarket.load();
      if(current!==request || generation!==window.JTDAccountGeneration) return;
      const boards=[['games','Collection',GAMES],['wishlist','Wishlist',WISHLIST],['arrivals','Arrivages',ARRIVALS]];
      let unmatched=0;
      const fragment=document.createDocumentFragment();
      for(const [key,label,games] of boards){
        for(const game of games){
          const platform=switchArtworkMarket.platformOf(game.plateforme);
          if(!platform || (game.contentType && game.contentType!=='game')) continue;
          const titleKey=JTDData.foldImport(game.nom);
          const choices=switchArtworkMarket.search(index,game.nom,platform,12);
          const exact=index.filter(row=>row.platform===platform && row.key===titleKey);
          const identified=exact.length===1 ? exact[0] :
            choices.filter(row=>row.id===game.nintendoTitleId && row.key===titleKey).length===1
              ? choices.find(row=>row.id===game.nintendoTitleId && row.key===titleKey) : null;
          if(!choices.length){unmatched++;continue;}
          const row=document.createElement('div');row.className='switch-bulk-row';
          const identity=document.createElement('label');
          const include=document.createElement('input');include.type='checkbox';
          include.checked=!!identified && (!game.image || !game.squareImage);
          identity.append(include,' '+game.nom+' · '+label+' · '+platform);
          const select=document.createElement('select');
          select.setAttribute('aria-label','Édition eShop pour '+game.nom);
          select.append(new Option('Choisir une édition',''),...choices.map((choice,i)=>new Option(choice.name+' · '+choice.id,String(i))));
          select.value=identified && choices.includes(identified)?String(choices.indexOf(identified)):'';
          const preview=document.createElement('div');
          preview.className='switch-bulk-preview';
          function showPreview(){
            preview.replaceChildren();
            const choice=choices[Number(select.value)];
            if(!select.value || !choice) return;
            for(const [label,url] of [['Icône',choice.square],['Bannière',choice.banner]]){
              if(!url) continue;
              const picture=document.createElement('img');
              picture.alt=label+' de '+choice.name; picture.loading='lazy'; picture.src=url;
              preview.appendChild(picture);
            }
          }
          select.onchange=()=>{include.checked=select.value!=='';showPreview();};
          showPreview();
          row.append(identity,select,preview);
          fragment.appendChild(row);
          candidates.push({key,id:game.id,game,choices,include,select});
        }
      }
      list.appendChild(fragment);
      status.textContent=candidates.length+' fiche(s) à vérifier. '+unmatched+' sans correspondance, modifiables dans leur fiche.';
      save.disabled=!candidates.length;
    }catch(error){if(current===request) status.textContent=error.message;}
  };
  save.onclick=()=>{
    if(generation!==window.JTDAccountGeneration){close();return;}
    const backup=buildBackupPayload();
    let count=0;
    for(const key of ['games','wishlist','arrivals']){
      const selected=new Map(candidates.filter(candidate=>candidate.key===key && candidate.include.checked && candidate.select.value!=='').map(candidate=>[candidate.id,candidate]));
      backup.data[key]=backup.data[key].map(game=>{
        const candidate=selected.get(game.id);
        if(!candidate || candidate.game!==game) return game;
        const updated={...game,...switchArtworkMarket.patch(game,candidate.choices[Number(candidate.select.value)],{rename:rename.checked,replace:replace.checked})};
        if(JSON.stringify(updated)!==JSON.stringify(game)) count++;
        return updated;
      });
    }
    if(!count){status.textContent='Aucune modification à enregistrer.';return;}
    try{
      applyRestoredData(cleanBackupData(backup));
      close();
      showToast(count+' fiche(s) mises à jour.');
    }catch(error){status.textContent=error.message;}
  };
})();
