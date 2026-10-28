/* Restaure le partage vivant de la collection avant le chargement de Firebase. */
(() => {
  if(!window.JTDData) return;

  const baseCreatePublicSharePayload = window.JTDData.createPublicSharePayload;
  window.JTDData.createPublicSharePayload = function(data, publishedAt){
    const payload = baseCreatePublicSharePayload(data, publishedAt);
    const games = Array.isArray(data && data.games) ? data.games : [];
    payload.version = 3;
    payload.games = payload.games.map((item, index) => {
      const source = games[index] || {};
      return {
        ...item,
        id: source.id == null ? null : String(source.id),
        format: source.format || 'Physique',
        contentType: source.contentType || 'game',
        parentId: source.parentId == null ? null : String(source.parentId)
      };
    });
    return payload;
  };

  const exportButton = document.getElementById('chatgpt-export-btn');
  if(!exportButton || document.getElementById('share-btn')) return;

  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'profile-menu-item';
  shareButton.id = 'share-btn';
  shareButton.innerHTML = '<span class="profile-menu-item-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.5 6.8-4"></path><path d="m8.6 13.5 6.8 4"></path></svg><span id="share-label">Partager ma collection</span></span><span class="profile-menu-sub" id="share-note">Lien vivant en lecture seule · se met à jour automatiquement</span>';

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
    showToast(window.JTD_PREVIEW_MODE
      ? 'Le partage vivant est désactivé dans la sandbox : aucune donnée réelle n’est publiée.'
      : 'Le partage est encore en cours d’initialisation.');
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

/* Vérifie les fichiers de cette origine à la reprise, sans charger Firebase. */
(() => {
  const resources = ['index.html', 'app.js', 'dialogs.js', 'styles.css', 'regal.css', 'brand-header.svg', 'theme.js', 'jtd-data.js', 'firebase.js', 'lifecycle.js', 'cemetery.js', 'cemetery.css'];
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


