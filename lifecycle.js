/* Vérifie les fichiers de cette origine à la reprise, sans charger Firebase. */
(() => {
  const resources = ['journal-data.js', 'journal.js', 'journal.css', 'index.html', 'app.js', 'dialogs.js', 'styles.css', 'theme.js', 'jtd-data.js', 'firebase.js', 'lifecycle.js', 'cemetery.js', 'cemetery.css'];
  const baseline = new Map();
  let checking = false, lastCheck = 0, updateAvailable = false;
  async function check(force = false) {
    if(checking || document.hidden || (!force && Date.now() - lastCheck < 60000)) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const results = await Promise.all(resources.map(async file => {
        const response = await fetch(new URL(file, location.href), {method:'HEAD', cache:'no-store'});
        if(!response.ok) return null;
        const tag = response.headers.get('ETag');
        return tag ? [file, tag] : null;
      }));
      for(const result of results) {
        if(!result) continue;
        const [file, tag] = result;
        if(baseline.has(file) && baseline.get(file) !== tag) updateAvailable = true;
        else baseline.set(file, tag);
      }
      if(updateAvailable && !document.getElementById('app-shell').classList.contains('hidden')) {
        showToast('Une mise à jour du site est disponible.', 'Actualiser', async () => {
          if(document.querySelector('.modal-overlay:not(.hidden)')) {
            showToast('Ferme la fenêtre en cours avant d’actualiser.');
            return;
          }
          try {
            if(window.JTDPrepareReload && !await window.JTDPrepareReload()) {
              showToast('La sauvegarde cloud n’a pas abouti. Réessaie avant d’actualiser.');
              return;
            }
            location.reload();
          } catch {
            showToast('Actualisation impossible pour le moment. Réessaie.');
          }
        }, 15000);
      }
    } catch { /* Une reprise hors ligne ne perturbe pas la collection affichée. */ }
    finally { checking = false; }
  }
  window.addEventListener('pageshow', event => check(event.persisted));
  window.addEventListener('focus', () => check());
  window.addEventListener('online', () => check(true));
  document.addEventListener('visibilitychange', () => { if(!document.hidden) check(); });
  check(true);
})();


