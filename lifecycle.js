/* Partage vivant : interface seulement ; le payload est défini dans jtd-data.js. */
(() => {
  const exportButton = document.getElementById('chatgpt-export-btn');
  if(!exportButton || document.getElementById('share-btn') || document.getElementById('share-preview-btn')) return;

  const preview = window.JTD_PREVIEW_MODE === true;
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'profile-menu-item';
  shareButton.id = preview ? 'share-preview-btn' : 'share-btn';
  shareButton.innerHTML = '<span class="profile-menu-item-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.5 6.8-4"></path><path d="m8.6 13.5 6.8 4"></path></svg><span id="share-label">Partager ma collection</span></span><span class="profile-menu-sub" id="share-note">Lien vivant en lecture seule · se met à jour automatiquement</span>';

  if(preview){
    exportButton.before(shareButton);
    shareButton.addEventListener('click', () => showToast('Le partage vivant est désactivé dans la sandbox : aucune donnée réelle n’est publiée.'));
    return;
  }

  const disableButton = document.createElement('button');
  disableButton.type = 'button';
  disableButton.className = 'profile-menu-item profile-menu-danger hidden';
  disableButton.id = 'share-disable-btn';
  disableButton.innerHTML = '<span class="profile-menu-item-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg><span>Désactiver le partage</span></span><span class="profile-menu-sub">Invalide immédiatement le lien actuel</span>';

  exportButton.before(shareButton, disableButton);

  shareButton.addEventListener('click', () => {
    if(window.JTDShare && typeof window.JTDShare.createOrCopy === 'function'){
      window.JTDShare.createOrCopy();
      return;
    }
    showToast('Le partage est encore en cours d’initialisation.');
  });

  disableButton.addEventListener('click', () => {
    if(!window.JTDShare || typeof window.JTDShare.disable !== 'function') return;
    confirmAction(
      'Le lien actuel cessera immédiatement de fonctionner.',
      () => window.JTDShare.disable(),
      {title:'Désactiver le partage ?', confirmLabel:'Désactiver'}
    );
  });
})();

/* Compare the loaded release with one explicit manifest, never transport ETags. */
(() => {
 const version=document.querySelector('meta[name="regal-version"]')?.content;
 const build=document.querySelector('meta[name="regal-build"]')?.content;
 if(!version||!build) return;
 const label=document.getElementById('site-version-label'),button=document.getElementById('site-update-btn');
 if(label){label.textContent=version;label.title='Version du site · '+build;}
 // A fresh build URL bypasses stale navigation caches; keep the visible URL tidy.
 const clean=new URL(location.href);
 if(clean.searchParams.get('_regal')===build){clean.searchParams.delete('_regal');history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);}
 let checking=false,lastCheck=0,pending=null,refreshing=false;
 const notified=new Set();
 function updateButton(){if(button){button.classList.toggle('hidden',!pending);button.title=pending?'Installer la version '+pending.version:'';}}
 async function reload(){
  if(refreshing||!pending) return;
  if(document.querySelector('.modal-overlay:not(.hidden)')){showToast('Ferme la fenêtre en cours avant d’actualiser.','Actualiser',reload,15000);return;}
  refreshing=true;
  const generation=window.JTDAccountGeneration;
  try {
   if(window.JTDPrepareReload&&!await window.JTDPrepareReload()){showToast('La sauvegarde cloud n’a pas abouti. Réessaie avant d’actualiser.','Actualiser',reload,15000);return;}
   if(generation!==window.JTDAccountGeneration) return;
   const target=new URL(location.href);target.searchParams.set('_regal',pending.build);
   location.replace(target.href);
  } catch {showToast('Actualisation impossible pour le moment. Réessaie.','Actualiser',reload,15000);}
  finally {refreshing=false;}
 }
 button?.addEventListener('click',reload);
 async function check(force=false){
  if(checking||document.hidden||(!force&&Date.now()-lastCheck<60000)) return;
  checking=true;lastCheck=Date.now();
  try {
   const response=await fetch(new URL('site-version.json',location.href),{cache:'no-store'});
   if(!response.ok) return;
   const release=await response.json();
   if(!release||typeof release.version!=='string'||!/^\d+_\d{2}\.\d{2}\.\d{2}-[1-9]\d*$/.test(release.version)||typeof release.build!=='string'||! /^[a-f0-9]{24}$/.test(release.build)) return;
   pending=release.build===build?null:release;updateButton();
   if(!pending||notified.has(pending.build)||document.getElementById('app-shell')?.classList.contains('hidden')) return;
   notified.add(pending.build);
   showToast('Une mise à jour du site est disponible.','Actualiser',reload,15000);
  } catch { /* Offline or invalid responses do not disturb the current page. */ }
  finally {checking=false;}
 }
 window.addEventListener('pageshow',event=>check(event.persisted));
 window.addEventListener('focus',()=>check());
 window.addEventListener('online',()=>check(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden) check();});
 check(true);
})();
