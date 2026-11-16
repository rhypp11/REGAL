/* Standalone visual proposal. Memory-only fixtures: no storage, Firebase or app data. */
'use strict';
window.JTD_PREVIEW_MODE=true;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art={animal:'../../preview-assets/garden.svg',persona:'../../preview-assets/lighthouse.svg'};
const groups=[
 {id:'animal',name:'Animal Crossing: New Horizons',status:'multi',copies:[{platform:'Switch',media:'digital',date:'20/03/2020',price:59.99}],upgraded:true},
 {id:'persona',name:'Persona 5 Royal',status:'termine',copies:[{platform:'Switch',media:'physical',date:'15/06/2023',price:39.99},{platform:'Switch',media:'digital',date:'12/02/2025',price:23.99},{platform:'PS4',media:'physical',date:'18/11/2022',price:29.99}]}
];
const statusLabels={a_jouer:'À faire',termine:'Terminé',termine_ailleurs:'Terminé ailleurs',multi:'Multi',abandonne:'Abandonné'};
const state={media:'all',platform:'all',content:'games',grouped:true};
let current=null,trigger=null,noticeTimer;
const platform=(group,copy)=>group.id==='animal'&&group.upgraded&&copy.platform==='Switch'?'Switch 2':copy.platform;
const money=value=>value==null?'Prix non renseigné':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(value);
const mediaLabel=value=>value==='digital'?'Numérique':'Physique';
const matches=(group,copy)=> (state.media==='all'||copy.media===state.media)&&(state.platform==='all'||platform(group,copy)===state.platform);
const tag=(text,kind='')=>`<span class="tag ${kind}">${esc(text)}</span>`;
const artSrc=group=>art[group.id]||art.persona;
function announce(message){$('notice').textContent=message;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),4500);}
function render(){
 for(const [id,key] of [['media','media'],['content','content']])for(const button of $(id).querySelectorAll('button'))button.setAttribute('aria-pressed',String(state[key]===button.dataset.value));
 const counts={all:0};
 if(state.content==='games')for(const group of groups){const platforms=new Set(group.copies.filter(copy=>state.media==='all'||copy.media===state.media).map(copy=>platform(group,copy)));if(platforms.size)counts.all++;for(const p of platforms)counts[p]=(counts[p]||0)+1;}
 if(state.content!=='games'&&state.media!=='physical'){counts.all=1;counts[state.content==='upgrade'?'Switch 2':'Switch']=1;}
 $('platforms').innerHTML=[['all','Toutes'],...['Switch 2','Switch','PS4'].map(p=>[p,p])].map(([value,label])=>`<button data-value="${value}" aria-pressed="${state.platform===value}"><span>${label}</span><strong>${counts[value]||0}</strong></button>`).join('');
 $('heading').textContent=state.content==='dlc'?'DLC':state.content==='upgrade'?'Mises à niveau':state.platform==='all'?'Tous les jeux':state.platform;
 const visible=groups.map(group=>({group,copies:group.copies.filter(copy=>matches(group,copy))})).filter(item=>item.copies.length);
 const copyCount=visible.reduce((sum,item)=>sum+item.copies.length,0);
 $('summary').textContent=state.content==='games'?`${visible.length} jeux · ${copyCount} exemplaires`:'Contenus additionnels · achats distincts';
 let html='';
 if(state.content==='games')for(const {group,copies} of visible){
  for(const shown of state.grouped?[copies]:copies.map(copy=>[copy])){
   const platforms=[...new Set(shown.map(copy=>platform(group,copy)))];
   const puzzle='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3h3a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v6h-6a3 3 0 1 0-6 0H3v-6a3 3 0 1 0 0-6V3h5Z"/></svg>';
   const counter=(count,kind,icon,label)=>`<span class="addon-counter ${kind}" title="${label}" aria-label="${label}"><span>${count}</span>${icon}</span>`;
   const rows=platforms.map(p=>{
    const copies=shown.filter(copy=>platform(group,copy)===p);
    const media=[...new Set(copies.map(copy=>copy.media))].map(mediaLabel).join(' · ');
    const animal=group.id==='animal'&&copies.some(copy=>copy.platform==='Switch');
    return `<div class="platform-row"><span class="row-platform" title="${esc(p)}">${esc(p)}</span><span class="row-support" title="${esc(media)}">${esc(media)}</span>${animal?counter(1,'dlc',puzzle,'1 DLC'):''}${animal&&group.upgraded?counter(1,'upgrade','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V4m-6 6 6-6 6 6"/></svg>','1 mise à niveau'):''}</div>`;
   }).join('');
   html+=`<article class="game-card" data-game="${group.id}"><button class="card-open-control" data-open="${group.id}" aria-label="Ouvrir ${esc(group.name)}"></button><div class="art"><img src="${artSrc(group)}" alt="Illustration de démonstration"></div><div class="card-copy"><h2>${esc(group.name)}</h2><div class="platform-rows">${rows}</div><div class="card-status-footer"><span class="count-note">${shown.length} exemplaire${shown.length>1?'s':''}</span><select class="card-status-select ${group.status}" data-card-status="${group.id}" aria-label="Statut commun de ${esc(group.name)}">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${value===group.status?'selected':''}>${label}</option>`).join('')}</select></div></div></article>`;
  }
 }else if(state.media!=='physical'&&(state.platform==='all'||state.platform===(state.content==='upgrade'?'Switch 2':'Switch'))){
  const upgrade=state.content==='upgrade';
  html=`<button class="game-card" data-open="${upgrade?'upgrade':'dlc'}"><div class="art"><img src="${art.animal}" alt="Illustration de démonstration"><span class="art-label tag ${upgrade?'upgrade':'dlc'}">${upgrade?'↑ Mise à niveau':'DLC'}</span></div><div class="card-copy"><h2>${upgrade?'Animal Crossing: New Horizons':'Happy Home Paradise'}</h2>${upgrade?'<span class="edition-label">Switch 2 Edition</span>':''}<div class="tags">${tag(upgrade?'Switch 2':'Switch','platform')}${tag('Numérique')}</div><p class="count-note">${upgrade&&!groups[0].upgraded?'Non rattachée':`Jeu de base · Animal Crossing: New Horizons`}</p></div></button>`;
 }
 $('grid').innerHTML=html||'<div class="empty">Aucun résultat avec ces filtres.</div>';
 $('known-titles').innerHTML=groups.map(group=>`<option value="${esc(group.name)}"></option>`).join('');
}
function relation(group,kind){
 const upgrade=kind==='upgrade',base=kind==='base';
 const name=base?group.name:upgrade?'Switch 2 Edition':'Happy Home Paradise';
 const caption=base?'Jeu de base':upgrade?'Mise à niveau':'DLC';
 return `<button class="relation ${upgrade?'upgrade':base?'base':'dlc'}" data-relation="${base?group.id:kind}"><img src="${artSrc(group)}" alt=""><span class="relation-copy">${tag(caption,upgrade?'upgrade':base?'':'dlc')}<strong>${esc(name)}</strong><small>${base?(group.upgraded?'Switch 2 · édition mise à niveau':'Switch · jeu d’origine'):upgrade?'Vers la Switch 2 Edition · achat distinct':'Switch · contenu additionnel'}</small></span><span aria-hidden="true">›</span></button>`;
}
function openSheet(id){
 current=id;
 const group=groups.find(item=>item.id===id);
 const upgrade=id==='upgrade',dlc=id==='dlc';
 $('sheet-kind').className='eyebrow '+(upgrade?'kind-upgrade':dlc?'kind-dlc':'');
 $('sheet-kind').textContent=upgrade?'↑ MISE À NIVEAU · SWITCH 2 EDITION':dlc?'DLC':'FICHE DU JEU';
 if(group){
  $('sheet-body').innerHTML=`<img class="sheet-art" src="${artSrc(group)}" alt="Illustration de démonstration"><h2>${esc(group.name)}</h2>${group.upgraded?'<span class="edition-label">↑ Switch 2 Edition</span>':''}<div class="tags">${[...new Set(group.copies.map(copy=>platform(group,copy)))].map(p=>tag(p,'platform')).join('')}</div><label class="status-edit">Statut commun<select id="shared-status">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${value===group.status?'selected':''}>${label}</option>`).join('')}</select></label><section class="sheet-section"><div class="section-title"><h3>Exemplaires</h3><button data-add-copy="${group.id}">Ajouter</button></div>${group.copies.map(copy=>`<div class="copy"><div><strong>${esc(platform(group,copy))} · ${mediaLabel(copy.media)}</strong><p>${esc(copy.date)}${group.id==='animal'?' · eShop':''}</p>${group.id==='animal'&&group.upgraded?'<small class="count-note">Achat d’origine : Switch</small>':''}</div><span class="money">${money(copy.price)}</span></div>`).join('')}</section>${group.id==='animal'?`<section class="sheet-section"><div class="section-title"><h3>Contenus liés</h3><small>${group.upgraded?'1 DLC · 1 mise à niveau':'1 DLC'}</small></div>${relation(group,'dlc')}${group.upgraded?relation(group,'upgrade'):''}</section><div class="history"><strong>Historique conservé</strong><br>Achat Switch en 2020 : ${money(59.99)}${group.upgraded?`<br>Mise à niveau Switch 2 : ${money(4.99)}`:''}. Montants fictifs pour cette maquette.</div>`:''}`;
  $('shared-status').onchange=event=>{group.status=event.target.value;render();announce('Statut commun mis à jour pour tous les exemplaires.');};
 }else{
  const animal=groups[0];
  $('sheet-body').innerHTML=`<img class="sheet-art" src="${art.animal}" alt="Illustration de démonstration"><h2>${upgrade?'Animal Crossing: New Horizons':'Happy Home Paradise'}</h2>${upgrade?'<span class="edition-label">Switch 2 Edition</span>':''}<div class="tags">${tag(upgrade?'Switch 2':'Switch','platform')}${tag('Numérique')}</div><section class="sheet-section"><div class="section-title"><h3>Jeu de base</h3></div>${upgrade&&!animal.upgraded?'<p class="sheet-subtitle">Aucun jeu rattaché pour le moment.</p>':relation(animal,'base')}</section>${upgrade?`<section class="sheet-section"><label class="upgrade-control"><input id="upgrade-linked" type="checkbox" ${animal.upgraded?'checked':''}> Rattachée à Animal Crossing: New Horizons</label><p class="sheet-subtitle">Le jeu apparaît sous Switch 2 quand cette mise à niveau lui est rattachée. Son achat Switch d’origine est conservé.</p></section>`:''}<section class="sheet-section"><div class="copy"><div><strong>Achat du contenu</strong><p>Montant fictif · ${upgrade?'mise à niveau':'DLC'}</p></div><span class="money">${money(upgrade?4.99:24.99)}</span></div></section>`;
  if(upgrade)$('upgrade-linked').onchange=event=>{animal.upgraded=event.target.checked;render();openSheet('upgrade');$('upgrade-linked').focus();announce(animal.upgraded?'Le jeu apparaît maintenant sous Switch 2.':'Le jeu retrouve sa plateforme Switch d’origine.');};
 }
 if(!$('sheet').open){trigger=document.activeElement;$('sheet').showModal();}else $('sheet').scrollTop=0;
}
function closeSheet(){$('sheet').close();const target=trigger?.isConnected?trigger:document.querySelector(`[data-open="${current}"]`);target?.focus();}
for(const [id,key] of [['media','media'],['content','content'],['platforms','platform']])$(id).onclick=event=>{const button=event.target.closest('[data-value]');if(!button)return;state[key]=button.dataset.value;render();if(id==='platforms')$(id).querySelector(`[data-value="${state.platform}"]`)?.focus();};
$('grouped').onchange=event=>{state.grouped=event.target.checked;render();};
$('grid').onchange=event=>{
 const select=event.target.closest('[data-card-status]');if(!select)return;
 const group=groups.find(group=>group.id===select.dataset.cardStatus);group.status=select.value;
 const index=[...$('grid').querySelectorAll('[data-card-status]')].indexOf(select);
 render();$('grid').querySelectorAll('[data-card-status]')[index]?.focus();
 announce('Statut commun mis à jour pour tous les exemplaires.');
};
$('grid').onclick=event=>{const button=event.target.closest('[data-open]');if(button)openSheet(button.dataset.open);};
$('sheet-body').onclick=event=>{const relation=event.target.closest('[data-relation]');if(relation)openSheet(relation.dataset.relation);const add=event.target.closest('[data-add-copy]');if(add){closeSheet();openAdd(groups.find(g=>g.id===add.dataset.addCopy).name);}};
$('close').onclick=closeSheet;
$('sheet').addEventListener('click',event=>{if(event.target===$('sheet')){const r=$('sheet').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSheet();}});
$('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';};
const key=text=>text.trim().toLocaleLowerCase('fr');
function findMatch(){return groups.find(group=>key(group.name)===key($('add-title').value));}
function updateMatch(){$('match').hidden=!findMatch();}
function openAdd(title=''){$('add-form').reset();$('add-title').value=title;updateMatch();$('add-dialog').showModal();$('add-title').focus();}
$('add').onclick=()=>openAdd();$('add-title').oninput=updateMatch;$('cancel-add').onclick=()=>$('add-dialog').close();
$('add-form').onsubmit=event=>{
 event.preventDefault();const name=$('add-title').value.trim();if(!name)return;
 let group=findMatch();if(!group||!$('attach').checked){group={id:'new-'+groups.length,name,status:'a_jouer',copies:[]};groups.push(group);}
 group.copies.push({platform:$('add-platform').value,media:$('add-media').value,date:'Nouvel achat',price:$('add-price').value===''?null:Number($('add-price').value)});
 $('add-dialog').close();state.content='games';state.platform='all';state.media='all';render();announce('Exemplaire ajouté à la fiche du jeu.');openSheet(group.id);
};
render();
