/* Interactive preview only; intentionally separate from account/cloud data. */
(() => {
  if(!IS_PREVIEW_MODE) return;
  document.body.classList.add('dex-prototype-enabled');
  document.getElementById('pokedex-nav').classList.remove('hidden');
  const entries=window.REGAL_DEX_KANTO;
  const key='jtd:sandbox-pokedex-prototype:kanto:v1';
  const labels=['À obtenir','À transférer','Dans HOME'];
  let states={};
  try {
    const saved=JSON.parse(localStorage.getItem(key)||'{}');
    for(const entry of entries) if([1,2].includes(saved?.[entry.id])) states[entry.id]=saved[entry.id];
  } catch { /* A fresh preview remains usable without storage. */ }
  const pad=n=>String(n).padStart(4,'0');
  const boxes=document.getElementById('dex-boxes');
  const escape=escapeHTML;
  for(let start=0;start<entries.length;start+=30){
    const content=entries.slice(start,start+30);
    const section=document.createElement('section');
    section.className='dex-box';
    section.setAttribute('aria-labelledby','dex-box-'+start);
    section.innerHTML='<header><h2 id="dex-box-'+start+'">'+pad(start+1)+'–'+pad(start+30)+'</h2><span>Boîte '+(start/30+1)+'</span></header><div class="dex-grid">'+content.map(entry=>
      '<div class="dex-slot" data-pokemon="'+entry.id+'"><button type="button" class="dex-pokemon" title="'+escape(entry.name)+'" data-id="'+entry.id+'"><span class="dex-number">'+pad(entry.id)+'</span><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/'+entry.id+'.png" alt="" loading="lazy" decoding="async" width="96" height="96"><span class="dex-name">'+escape(entry.name)+'</span><span class="dex-state-mark" aria-hidden="true"></span></button><a class="dex-info" href="https://www.pokepedia.fr/'+encodeURIComponent(entry.name)+'#Localisations" target="_blank" rel="noopener noreferrer" aria-label="Où obtenir '+escape(entry.name)+' ? (nouvel onglet)" title="Lieux de capture sur Poképédia">i</a></div>'
    ).join('')+Array.from({length:30-content.length},()=>'<div class="dex-empty" aria-hidden="true"></div>').join('')+'</div>';
    boxes.append(section);
  }
  function update(){
    let pending=0,home=0;
    for(const entry of entries){
      const state=states[entry.id]||0;
      if(state===1) pending++; if(state===2) home++;
      const button=boxes.querySelector('[data-id="'+entry.id+'"]');
      button.parentElement.dataset.state=state;
      button.setAttribute('aria-label',entry.name+' · '+pad(entry.id)+' · '+labels[state]+'. Cliquer : '+labels[(state+1)%3]);
      button.querySelector('.dex-state-mark').textContent=['','•','✓'][state];
    }
    document.getElementById('dex-progress').innerHTML='<strong>'+home+' <small>/ 151 dans HOME</small></strong><span>'+pending+' à transférer</span><div class="dex-progress-track" aria-hidden="true"><span style="width:'+(home/151*100)+'%"></span></div>';
  }
  boxes.addEventListener('click',event=>{
    const button=event.target.closest('.dex-pokemon');
    if(!button) return;
    const id=button.dataset.id,next={...states,[id]:((states[id]||0)+1)%3};
    try {localStorage.setItem(key,JSON.stringify(next));states=next;document.getElementById('dex-error').textContent='';update();}
    catch {document.getElementById('dex-error').textContent='La progression n’a pas pu être enregistrée dans ce navigateur.';}
  });
  update();
})();
