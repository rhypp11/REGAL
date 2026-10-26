/* Review and add only, within the existing collection persistence boundary. */
(()=>{
  const $=id=>document.getElementById(id),esc=JTDData.escapeHTML;
  let rows=[],ignored={},snapshot='',generation=0,readSequence=0;
  const fingerprint=()=>JSON.stringify([GAMES,DIGITAL_ACCOUNTS,CEMETERY]);
  const inScope=row=>$('deku-import-format').value==='all' || (JTDData.isDigital(row)?'digital':'physical')===$('deku-import-format').value;
  const currentPlan=()=>JTDDeku.plan(rows.filter(inScope),GAMES,CEMETERY);
  function close(){window.JTDDialogs.close('deku-import-overlay');rows=[];readSequence++;}
  function render(){
    const list=$('deku-import-rows'),scroll=list.scrollTop,active=document.activeElement?.dataset;
    const plan=currentPlan();
    const adds=plan.filter(p=>p.status==='add'),pending=plan.filter(p=>p.status==='account');
    $('deku-import-summary').textContent=`${adds.length} ajout(s) · ${plan.filter(p=>p.status==='duplicate').length} doublon(s) · ${plan.filter(p=>p.status==='archived').length} déjà au cimetière · ${pending.length} compte(s) à choisir`;
    $('deku-import-ignored').textContent=`Hors Switch : ${ignored.platform || 0} · Sans plateforme : ${ignored.missing || 0} · Invalides : ${ignored.invalid || 0}. La date d’ajout Deku Deals n’est pas une date d’achat.`;
    const parents=[...GAMES,...plan.filter(p=>p.status==='add' && p.candidate.contentType==='game').map(p=>p.candidate)];
    list.innerHTML=plan.map(p=>{
      const row=p.row,i=rows.indexOf(row),digital=JTDData.isDigital(row),blocked=['duplicate','archived'].includes(p.status);
      const options='<option value="">Choisir un compte…</option><option value="__none__">Sans compte</option>'+DIGITAL_ACCOUNTS.filter(a=>a.ecosystem==='Nintendo').map(a=>`<option value="${esc(a.id)}" ${row.accountChoice===a.id?'selected':''}>${esc(a.nickname || a.name)}</option>`).join('');
      const eligible=parents.filter(g=>g.id!==row.id && !JTDData.isAddon(g) && JTDData.canAttachContent({...row,plateforme:JTDData.importPlatform(row.plateforme)},{...g,plateforme:JTDData.importPlatform(g.plateforme)}));
      return `<article class="deku-import-row"><label class="deku-import-title"><input type="checkbox" data-index="${i}" data-field="selected" ${row.selected&&!blocked?'checked':''} ${blocked?'disabled':''}><span><strong>${esc(row.nom)}</strong><small>${esc(row.plateforme)} · ${digital?'Numérique':'Physique'} · ${row.prix==null?'Prix non renseigné':esc(purchaseMoney(row))}</small></span></label>${blocked?`<p>${p.status==='duplicate'?'Déjà présent — conservé sans modification':'Déjà au cimetière — ignoré'}</p>`:''}<div class="deku-import-fields">${digital?`<label>Compte<select data-index="${i}" data-field="accountChoice">${options}</select></label><label>Type à vérifier<select data-index="${i}" data-field="contentType">${[['game','Jeu'],['dlc','DLC'],['upgrade','Mise à niveau']].map(([k,v])=>`<option value="${k}" ${row.contentType===k?'selected':''}>${v}</option>`).join('')}</select></label>`:''}${digital&&row.contentType!=='game'?`<label class="deku-parent-field">Rattacher à un jeu<select data-index="${i}" data-field="parentId"><option value="">Rattacher plus tard</option>${eligible.map(g=>`<option value="${esc(g.id)}" ${row.parentId===g.id?'selected':''}>${esc(g.nom+' · '+g.plateforme+' · '+g.format)}</option>`).join('')}</select></label>`:''}</div>${row.dekuNote?`<p class="deku-import-note">Note Deku Deals : ${esc(row.dekuNote)}</p>`:''}</article>`;
    }).join('') || '<p>Aucun achat Switch dans ce format.</p>';
    for(const row of list.querySelectorAll('[data-field="accountChoice"]'))row.value=rows[Number(row.dataset.index)].accountChoice || '';
    list.scrollTop=scroll;
    if(active?.index!=null)list.querySelector(`[data-index="${active.index}"][data-field="${active.field}"]`)?.focus({preventScroll:true});
    $('deku-import-apply').disabled=!adds.length || !!pending.length;
  }
  $('deku-import-input').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const sequence=++readSequence,accountGeneration=window.JTDAccountGeneration || 0;
    try{
      if(file.size>3000000)throw Error('Fichier trop volumineux (3 Mo maximum).');
      const parsed=JTDDeku.parse(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));
      if(sequence!==readSequence || accountGeneration!==(window.JTDAccountGeneration || 0))return;
      if(!parsed.rows.length)throw Error('Aucun achat Switch ou Switch 2 exploitable dans ce fichier.');
      rows=parsed.rows.map(row=>({...row,id:crypto.randomUUID(),plateforme:GAMES.find(g=>JTDData.importPlatform(g.plateforme)===row.plateforme)?.plateforme || allPlatformNames().find(p=>JTDData.importPlatform(p)===row.plateforme) || (row.plateforme==='Nintendo Switch 2'?'Switch 2':row.plateforme),accountChoice:'',selected:true,parentId:null}));
      ignored=parsed.ignored;generation=accountGeneration;snapshot=fingerprint();
      $('deku-import-format').value='digital';$('deku-import-account').innerHTML='<option value="">Choisir pour les achats numériques…</option><option value="__none__">Sans compte</option>'+DIGITAL_ACCOUNTS.filter(a=>a.ecosystem==='Nintendo').map(a=>`<option value="${esc(a.id)}">${esc(a.nickname || a.name)}</option>`).join('');
      $('deku-import-error').textContent='';document.getElementById('profile-menu').classList.add('hidden');closeMobileDrawers();render();
      window.JTDDialogs.open('deku-import-overlay',{onDismiss:close,initialFocus:'#deku-import-format',trigger:$('profile-menu-btn')});
    }catch(error){showToast(error.message || 'Import Deku Deals impossible.');}
  });
  $('deku-import-rows').addEventListener('change',event=>{
    const {index,field}=event.target.dataset;if(index==null)return;
    const row=rows[Number(index)];row[field]=field==='selected'?event.target.checked:event.target.value;
    if(field==='contentType')row.parentId=null;
    if(field==='parentId' && row.parentId){const parent=[...GAMES,...rows].find(g=>g.id===row.parentId);if(parent && JTDData.importPlatform(parent.plateforme)===JTDData.importPlatform(row.plateforme))row.plateforme=parent.plateforme;}
    render();
  });
  $('deku-import-format').onchange=render;
  $('deku-import-account').onchange=event=>{if(event.target.value)for(const row of rows)if(JTDData.isDigital(row))row.accountChoice=event.target.value;render();};
  $('deku-import-cancel').onclick=close;
  $('deku-import-apply').onclick=()=>{
    const error=$('deku-import-error');
    if(generation!==(window.JTDAccountGeneration || 0) || fingerprint()!==snapshot){error.textContent='Les données ou la session ont changé. Relance l’import pour actualiser l’aperçu.';return;}
    const plan=currentPlan();if(plan.some(p=>p.status==='account')){error.textContent='Choisis un compte ou « Sans compte » pour les achats numériques sélectionnés.';return;}
    const additions=plan.filter(p=>p.status==='add').map(p=>{const {selected,accountChoice,...game}=p.candidate;return game;});
    if(!additions.length)return;
    const ids=new Set([...GAMES,...additions].map(g=>g.id));
    for(const row of additions)if(row.parentId&&!ids.has(row.parentId)){error.textContent='Le jeu de base choisi est exclu. Modifie le rattachement ou sélectionne ce jeu.';return;}
    for(const row of additions)if(row.parentId && !JTDData.canAttachContent(row,[...GAMES,...additions].find(g=>g.id===row.parentId))){error.textContent='Rattachement incompatible. Vérifie la plateforme et le type de contenu.';return;}
    if(!commitCollection([...GAMES,...additions])){error.textContent='Enregistrement impossible. Aucun achat ajouté.';return;}
    const count=additions.length;close();buildPlatformList();renderMediaControls();window.render();showToast(`${count} achat(s) ajouté(s). Les achats existants sont conservés.`);
  };
})();
