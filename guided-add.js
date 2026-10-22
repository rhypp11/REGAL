/* Interactive prototype. Production never enables this flow or writes demo data. */
(() => {
  if(window.JTD_PREVIEW_MODE !== true) return;
  if(!location.hostname.startsWith('jtd-sandbox-rhypp11') && window.JTD_ENABLE_ADD_DEMO !== true) return;
  const catalog = [
    {key:'aster',nom:'Aster — Les Jardins suspendus',platforms:['Switch 2','PlayStation 5'],genre:'Aventure · RPG'},
    {key:'brume',nom:'Brume — Le Phare des souvenirs',platforms:['Switch 2','PlayStation 4'],genre:'Exploration · Mystère'},
    {key:'ciel',nom:'Ciel — La Route des étoiles',platforms:['Switch 2','PlayStation 5'],genre:'Action · Aventure'}
  ].map(game => ({...game,image:new URL('demo-covers/'+game.key+'.svg',location.href).href}));
  const overlay=document.createElement('div');
  overlay.id='guided-add-overlay';
  overlay.className='modal-overlay hidden';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','guided-add-title');
  overlay.innerHTML=`<div class="modal guided-add-modal">
    <div class="guided-add-heading"><span class="guided-add-eyebrow">Un nouvel exemplaire</span><button type="button" class="guided-close" aria-label="Fermer">×</button></div>
    <div><h2 id="guided-add-title">Quel jeu rejoint ta collection ?</h2><p class="guided-add-intro">Tout commence par une jaquette.</p></div>
    <label class="guided-search-label" for="guided-add-search">Chercher un jeu</label>
    <div class="guided-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input id="guided-add-search" type="search" autocomplete="off" placeholder="Un titre, une envie…"></div>
    <div class="guided-catalog-heading"><span>À découvrir dans la démo</span><small>Catalogue fictif</small></div>
    <div id="guided-add-results" class="guided-add-results"></div>
    <p id="guided-add-empty" class="guided-add-empty hidden" role="status">Aucun jeu de démo ne correspond. Tu peux aussi le saisir librement.</p>
    <div class="guided-add-footer"><span>La plateforme et l’achat viennent ensuite.</span><button type="button" id="guided-add-manual">Saisir moi-même <span aria-hidden="true">↗</span></button></div>
  </div>`;
  document.body.appendChild(overlay);
  const native=document.getElementById('modal-overlay');
  const save=document.getElementById('save-btn');
  const input=document.getElementById('guided-add-search');
  let activeGame=null;
  function dismiss(){window.JTDDialogs.close(overlay.id);}
  function results(){
    const query=input.value.trim().toLocaleLowerCase('fr');
    const matches=catalog.filter(game=>game.nom.toLocaleLowerCase('fr').includes(query));
    const container=document.getElementById('guided-add-results');
    container.replaceChildren();
    for(const game of matches){
      const button=document.createElement('button');
      button.type='button';button.className='guided-game-choice';button.dataset.game=game.key;
      button.innerHTML=`<span class="guided-choice-art"><img src="${escapeHTML(game.image)}" alt="" width="640" height="360"><span class="guided-choice-plus" aria-hidden="true">+</span></span><strong>${escapeHTML(game.nom)}</strong><span class="guided-choice-genre">${escapeHTML(game.genre)}</span><span class="guided-choice-platforms">${escapeHTML(game.platforms.join(' · '))}</span>`;
      button.addEventListener('click',()=>choose(game));
      container.appendChild(button);
    }
    document.getElementById('guided-add-empty').classList.toggle('hidden',matches.length>0);
  }
  function open(){input.value='';results();window.JTDDialogs.open(overlay.id,{onDismiss:dismiss,initialFocus:'#guided-add-search'});}
  function clearGuidedForm(){
    native.classList.remove('guided-add-form');
    document.getElementById('guided-platforms')?.remove();
    if(activeGame) save.textContent='Enregistrer';
    activeGame=null;
  }
  function choose(game){
    dismiss();
    openModal(null);
    activeGame=game;
    native.classList.add('guided-add-form');
    document.getElementById('modal-title').textContent='Ton nouvel exemplaire';
    save.textContent='Ajouter à ma collection';
    const platform=game.platforms.includes(state.platform)?state.platform:game.platforms[0];
    fillIdentityFields('f',{...game,plateforme:platform,imageFit:'contain'});
    const item={...game,plateforme:platform};
    setIdentityEditor('f',item,true);
    const date=new Date();
    document.getElementById('f-date').value=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
    const platforms=document.createElement('div');platforms.id='guided-platforms';
    platforms.innerHTML='<span class="guided-platform-label">Pour quelle console ?</span><div role="group" aria-label="Plateforme du nouvel exemplaire"></div>';
    for(const name of game.platforms){
      const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.platform=name;
      button.setAttribute('aria-pressed',String(name===platform));
      button.addEventListener('click',()=>{
        setSelectValueAndSync('f-plateforme',name);
        setIdentityEditor('f',{...game,plateforme:name},true);
        platforms.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      });
      platforms.querySelector('div').appendChild(button);
    }
    document.getElementById('f-identity-summary').parentElement.appendChild(platforms);
    platforms.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
  }
  input.addEventListener('input',results);
  overlay.querySelector('.guided-close').addEventListener('click',dismiss);
  document.getElementById('guided-add-manual').addEventListener('click',()=>{dismiss();openModal(null);});
  document.getElementById('add-btn').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();},true);
  new MutationObserver(()=>{if(native.classList.contains('hidden'))clearGuidedForm();}).observe(native,{attributes:true,attributeFilter:['class']});
  save.addEventListener('click',()=>{
    if(!activeGame || !native.classList.contains('guided-add-form'))return;
    const before=new Set(GAMES.map(game=>game.id));
    queueMicrotask(()=>{
      if(!native.classList.contains('hidden'))return;
      const added=GAMES.find(game=>!before.has(game.id));
      if(!added)return;
      applyNavigation({page:'collection',platform:added.plateforme,sort:'name-asc'});
      requestAnimationFrame(()=>{
        const card=[...document.querySelectorAll('#grid .card')].find(el=>el.dataset.dialogTrigger==='game:'+added.id);
        if(card){card.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});card.classList.add('guided-card-arrival');}
        showToast(`« ${added.nom} » a rejoint ta collection.`);
      });
    });
  },true);
  window.JTDAddDemo={open};
})();
