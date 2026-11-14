/* Existing public links can still be revoked from the profile. */
(() => {
  if(window.JTD_PREVIEW_MODE === true) return;
  const exportButton = document.getElementById('collection-export-btn');
  if(!exportButton) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'share-disable-btn';
  button.className = 'profile-menu-item profile-menu-danger hidden';
  button.textContent = 'Désactiver le partage existant';
  exportButton.after(button);
  button.addEventListener('click', () => {
    if(!window.JTDShare?.disable) return;
    confirmAction('Le lien actuel cessera de fonctionner.', () => window.JTDShare.disable(),
      {title:'Désactiver le partage ?', confirmLabel:'Désactiver'});
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
