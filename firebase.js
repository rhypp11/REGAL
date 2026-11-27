import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
  import {
    getFirestore, doc, getDoc, runTransaction
  } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDFzVeQx7mw37Fk4mXr3odu9H57xpSXmdg",
    authDomain: "jeux-tout-doux.firebaseapp.com",
    projectId: "jeux-tout-doux",
    storageBucket: "jeux-tout-doux.firebasestorage.app",
    messagingSenderId: "367742323465",
    appId: "1:367742323465:web:ad01acd9274d4d6ca2e1d8"
  };
  const previewMode = window.JTD_PREVIEW_MODE === true;
  const fbApp = previewMode ? null : initializeApp(firebaseConfig);
  const auth = previewMode ? null : getAuth(fbApp);
  const db = previewMode ? null : getFirestore(fbApp);

  let currentUser = null;
  let syncTimer = null;
  let syncRevision = 0;
  let savedRevision = 0;
  let lastLocalState = null;
  // Reste à true tant que le chargement initial (local + cloud) n'est pas terminé,
  // pour qu'aucune sauvegarde locale déclenchée pendant l'init ne parte écraser
  // le document Firestore avant qu'on ait pu lire les vraies données du compte.
  let suppressSync = true;
  const sessions = JTDData.createSession();
  let syncQueue = Promise.resolve();
  const sessionIsCurrent = session => sessions.isCurrent(session);
  function enqueueCloudOperation(operation){
    const result = syncQueue.then(operation);
    syncQueue = result.catch(() => {});
    return result;
  }
  function cancelPendingSync(){ clearTimeout(syncTimer); syncTimer = null; }
  function emptyData(){ return JTDData.normalizeData({games:[]}); }


  /* ---------- Construction / application du paquet de données cloud ---------- */
  function buildCloudPayload(){
    const raw = {
      games: GAMES,
      arrivals: ARRIVALS,
      wishlist: WISHLIST,
      cemetery: CEMETERY,
      journal: LEGACY_JOURNAL,
      pokedex: POKEDEX_TRACKERS,
      digitalAccounts: DIGITAL_ACCOUNTS,
      platformMeta: platformMeta,
      platformOrder: platformOrder,
      profileName: PROFILE_NAME,
      profileAvatar: PROFILE_AVATAR,
      shareToken: SHARE_TOKEN,
      updatedAt: Date.now()
    };
    // Firestore refuse toute valeur "undefined" explicite : ce passage par JSON
    // nettoie automatiquement les éventuels champs jamais initialisés sur d'anciennes entrées.
    return JSON.parse(JSON.stringify(raw));
  }

  function applyCloudPayload(data){
    const normalized = JTDData.normalizeData(data);
    replaceAppData(normalized);
    SHARE_TOKEN = typeof data.shareToken === 'string' && data.shareToken ? data.shareToken : null;
    renderShareUI();
    return normalized;
  }

  function refreshAllViews(){
    normalizeCollectionEditions();
    buildPlatformList();
    buildFormatToggles();
    buildStatusToggles();
    render();
    renderArrivals();
    renderWishlist();
    renderProfileAvatar();
    updateBackupNote();
  }

  /* ---------- Partage public lecture seule ---------- */
  const FIRESTORE_SHARE_BASE = 'https://firestore.googleapis.com/v1/projects/' +
    firebaseConfig.projectId + '/databases/(default)/documents/shares/';

  function generateShareToken(){
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function shareUrl(token){
    return FIRESTORE_SHARE_BASE + encodeURIComponent(token) + '?key=' + encodeURIComponent(firebaseConfig.apiKey);
  }

  function renderShareUI(){
    const disableBtn = document.getElementById('share-disable-btn');
    if(disableBtn) disableBtn.classList.toggle('hidden', !SHARE_TOKEN);
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
    }catch(err){
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  async function commitCloudState(session, payload, shareAction){
    const local=JTDData.normalizeData(payload);
    const base=lastLocalState;
    const ref=doc(db,'users',session.uid);
    const candidateToken=shareAction==='create' ? generateShareToken() : null;
    const result=await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(ref);
      if(!sessionIsCurrent(session)) throw Error('Session terminée');
      const current=snapshot.exists() ? snapshot.data() : {};
      const remote=snapshot.exists() ? JTDData.normalizeData(current) : emptyData();
      const merged=base
        ? JTDData.mergeCloudData(base,local,remote)
        : JTDData.mergeCloudData(emptyData(),local,remote);
      const previousToken=current.shareToken || null;
      const shareToken=shareAction==='disable' ? null : previousToken || candidateToken;
      const data={...merged,shareToken,updatedAt:payload.updatedAt};
      JTDData.assertCloudSize(data);
      transaction.set(ref,data);
      if(previousToken && shareAction==='disable') transaction.delete(doc(db,'shares',previousToken));
      else if(shareToken) transaction.set(doc(db,'shares',shareToken),JTDData.createPublicSharePayload(merged));
      return shareToken;
    });
    if(sessionIsCurrent(session)){
      lastLocalState=local;
      SHARE_TOKEN=result;
      renderShareUI();
    }
    return result;
  }

  async function createOrCopyShare(session){
    if(!currentUser || suppressSync || !sessionIsCurrent(session)) return;
    try{
      const token=await commitCloudState(session,buildCloudPayload(),'create');
      if(!sessionIsCurrent(session)) return;
      await copyText(shareUrl(token));
      showToast('Lien de partage copié. Il restera à jour avec ta collection.');
    }catch(err){
      if(!sessionIsCurrent(session)) return;
      reportSyncError(err);
    }
  }

  async function disableShare(session){
    if(!currentUser || suppressSync || !sessionIsCurrent(session)) return;
    try{
      await commitCloudState(session,buildCloudPayload(),'disable');
      if(!sessionIsCurrent(session)) return;
      showToast('Partage désactivé. L’ancien lien ne fonctionne plus.');
    }catch(err){
      if(!sessionIsCurrent(session)) return;
      reportSyncError(err);
    }
  }

  window.JTDShare = {
    createOrCopy(){
      const session = sessions.current();
      return enqueueCloudOperation(() => createOrCopyShare(session));
    },
    disable(){
      const session = sessions.current();
      return enqueueCloudOperation(() => disableShare(session));
    }
  };
  window.renderShareUI = renderShareUI;
  renderShareUI();

  /* ---------- Indicateur de synchronisation ---------- */
  function setSyncStatus(status, message){
    const el = document.getElementById('cloud-sync-status');
    if(!el) return;
    el.className = 'cloud-sync-status ' + status;
    el.title = message || '';
    el.setAttribute('aria-label', message || 'Synchronisation');
    el.textContent = ({conflict:'Conflit sync',error:'Échec sync',syncing:'Synchronisation…',pending:'En attente…',ok:'Synchronisé'})[status] || 'Synchronisation';
  }

  function reportSyncError(error){
    console.error('Erreur de synchronisation Firebase',error);
    if(error.code==='rgl/sync-conflict'){
      setSyncStatus('conflict',error.message);
      showToast('Conflit de synchronisation. Télécharge une sauvegarde de tes modifications avant de fermer cet onglet.', 'Sauvegarder', () => document.getElementById('backup-btn')?.click(),15000);
    }else{
      setSyncStatus('error','Erreur de synchronisation : '+error.message);
    }
  }

  async function doCloudSync(session, payload, revision = syncRevision){
    if(suppressSync || !sessionIsCurrent(session)) return false;
    if(revision === syncRevision) setSyncStatus('syncing','Synchronisation en cours…');
    try{
      await commitCloudState(session,payload);
      if(!sessionIsCurrent(session)) return false;
      savedRevision=revision;
      if(revision===syncRevision) setSyncStatus('ok','Synchronisé avec le cloud');
      return true;
    }catch(error){
      if(sessionIsCurrent(session) && revision===syncRevision) reportSyncError(error);
      return false;
    }
  }

  function scheduleCloudSync(){
    if(!currentUser || suppressSync) return;
    const session = sessions.current();
    const revision = ++syncRevision;
    setSyncStatus('pending', 'Synchronisation en attente...');
    cancelPendingSync();
    syncTimer = setTimeout(() => {
      if(!sessionIsCurrent(session) || suppressSync) return;
      const payload = buildCloudPayload();
      enqueueCloudOperation(() => doCloudSync(session, payload, revision));
    }, 900);
  }
  window.JTDDataChanged = scheduleCloudSync;
  window.JTDCanWriteData = () => previewMode || (!!currentUser && !suppressSync && sessionIsCurrent(sessions.current()));
  window.JTDPrepareReload = async () => {
    if(!currentUser) return true;
    if(suppressSync) return false;
    const session = sessions.current();
    cancelPendingSync();
    const revision = syncRevision;
    return enqueueCloudOperation(() => doCloudSync(session, buildCloudPayload(), revision));
  };

  async function loadFromCloudOrSeed(session){
    const ref = doc(db, 'users', session.uid);
    try{
      const snap = await getDoc(ref);
      if(!sessionIsCurrent(session)) return false;
      // An existing document is authoritative, even when its collection is empty.
      if(snap.exists()){
        const cloudData = snap.data();
        const normalized = JTDData.normalizeData(cloudData);
        // Cache only validated data; errors must not trigger a cloud replacement.
        try{
          persistAppData(normalized);
        }catch(cacheError){
          console.error('Cache local indisponible', cacheError);
          showToast('Données cloud chargées. Le stockage local est indisponible sur cet appareil.');
        }
        applyCloudPayload(cloudData);
      }else{
        // Only scoped data loaded for this UID may initialize its new document.
        replaceAppData(JTDData.normalizeData(buildCloudPayload()));
        await commitCloudState(session,buildCloudPayload());
        if(!sessionIsCurrent(session)) return false;
      }
      refreshAllViews();
      suppressSync = false;
      lastLocalState=JTDData.normalizeData(buildCloudPayload());
      if(!sessionIsCurrent(session)) return false;
      setSyncStatus('ok', 'Synchronisé avec le cloud');
      return true;
    }catch(err){
      if(!sessionIsCurrent(session)) return false;
      // Leave editing and automatic writes blocked until a successful reload.
      suppressSync = true;
      console.error('Erreur de chargement Firebase', err);
      setSyncStatus('error', 'Erreur de chargement : ' + err.message);
      const detail = err && err.code ? ` (${err.code})` : '';
      setLoginError(`Chargement des données impossible${detail}. Clique sur « Se connecter » pour réessayer.`);
      return false;
    }
  }

  /* ---------- Écran de connexion ---------- */
  function showLoginGate(){
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }
  function hideLoginGate(){
    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
  }
  function setLoginError(msg){
    const el = document.getElementById('login-error');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }
  function translateAuthError(code){
    const map = {
      'auth/invalid-email': "Adresse email invalide.",
      'auth/user-not-found': "Aucun compte avec cet email.",
      'auth/wrong-password': "Mot de passe incorrect.",
      'auth/invalid-credential': "Email ou mot de passe incorrect.",
      'auth/email-already-in-use': "Un compte existe déjà avec cet email.",
      'auth/weak-password': "Le mot de passe doit faire au moins 6 caractères."
    };
    return map[code] || "Une erreur est survenue. Réessaie.";
  }

  document.getElementById('login-submit-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const isSignup = document.getElementById('login-gate').dataset.mode === 'signup';
    const btn = document.getElementById('login-submit-btn');
    const originalLabel = btn.textContent;
    setLoginError('');

    // Firebase may already have restored this account even though Firestore failed.
    // Signing into the same UID again does not necessarily emit another auth event,
    // so retry the data load directly instead.
    const currentEmail = String(currentUser && currentUser.email || '').trim().toLowerCase();
    const sameAuthenticatedAccount = currentUser
      && !document.getElementById('login-gate').classList.contains('hidden')
      && currentEmail
      && email.toLowerCase() === currentEmail;
    if(sameAuthenticatedAccount){
      const session = sessions.current();
      btn.disabled = true;
      btn.textContent = 'Chargement…';
      try{
        await initApp(() => sessionIsCurrent(session));
        if(!sessionIsCurrent(session)) return;
        const loaded = await loadFromCloudOrSeed(session);
        if(loaded && sessionIsCurrent(session)){
          hideAuthLoading();
          initializeNavigation();
          hideLoginGate();
          try{ window.JTDMigratePlatformAliases?.(); }
          catch(error){ console.error('Migration des plateformes impossible', error); }
        }
      }catch(err){
        if(sessionIsCurrent(session)){
          const detail = err && err.code ? ` (${err.code})` : '';
          setLoginError(`Chargement impossible${detail}. Clique sur « Se connecter » pour réessayer.`);
          console.error('Nouvelle tentative de chargement impossible', err);
        }
      }finally{
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
      return;
    }

    if(!email || !password){ setLoginError('Renseigne un email et un mot de passe.'); return; }
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    try{
      if(isSignup){
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    }catch(err){
      setLoginError(translateAuthError(err.code));
    }finally{
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') document.getElementById('login-submit-btn').click();
  });

  document.getElementById('login-toggle-mode').addEventListener('click', () => {
    const gate = document.getElementById('login-gate');
    const isSignup = gate.dataset.mode === 'signup';
    gate.dataset.mode = isSignup ? 'signin' : 'signup';
    document.getElementById('login-title').textContent = isSignup ? 'Connexion' : 'Créer un compte';
    document.getElementById('login-submit-btn').textContent = isSignup ? 'Se connecter' : 'Créer le compte';
    document.getElementById('login-toggle-mode').textContent = isSignup ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter";
    setLoginError('');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    if(!confirm('Se déconnecter ?')) return;
    window.JTDPrepareReload().then(saved=>{if(saved) return signOut(auth);});
  });

  window.addEventListener?.('beforeunload',event=>{
    if(!currentUser || syncRevision===savedRevision) return;
    event.preventDefault();
    event.returnValue='';
  });

  function hideAuthLoading(){
    const el = document.getElementById('auth-loading');
    if(el) el.classList.add('hidden');
  }

  if(previewMode){
    currentUser = null;
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('profile-menu-divider').classList.add('hidden');
    document.getElementById('cloud-sync-status').classList.add('hidden');
    await initApp();
    hideAuthLoading();
    hideLoginGate();
  } else {
  onAuthStateChanged(auth, async (user) => {
    const session = sessions.start(user && user.uid);
    resetNavigationSession();
    window.JTDAccountGeneration = session.generation;
    window.cancelPendingConfirmation();
    state.platform = null;
    state.search = '';
    document.getElementById('search-input').value = '';
    cancelPendingSync();
    suppressSync = true;
    lastLocalState = null;
    syncRevision = savedRevision = 0;
    currentUser = user || null;
    accountStorage.setAccount(user && user.uid);
    replaceAppData(emptyData());
    SHARE_TOKEN = null;
    closeModal();
    window.closeListSearch?.();
    window.closeSaleModal?.();
    closeArrivalModal();
    closeWishlistModal();
    closePlatformModal();
    closeMobileDrawers();
    document.getElementById('confirm-modal-overlay').classList.add('hidden');
    document.getElementById('profile-menu').classList.add('hidden');
    showLoginGate();
    if(user){
      document.getElementById('logout-btn').classList.remove('hidden');
      document.getElementById('profile-menu-divider').classList.remove('hidden');
      document.getElementById('cloud-sync-status').classList.remove('hidden');
      setLoginError('');
      // Keep the whole application hidden until this account's data is loaded.
      try{
        await initApp(() => sessionIsCurrent(session));
        if(!sessionIsCurrent(session)) return;
        const loaded = await loadFromCloudOrSeed(session);
        if(!sessionIsCurrent(session)) return;
        hideAuthLoading();
        if(loaded){
          initializeNavigation();
          hideLoginGate();
          try{
            window.JTDMigratePlatformAliases?.();
          }catch(error){
            console.error('Migration des plateformes impossible', error);
          }
          if(accountStorage.consumeLegacyNotice(STORAGE_KEY)){
            showToast('Anciennes données locales conservées. Le compte utilise sa sauvegarde cloud ou son stockage dédié.');
          }
        }
      }catch(error){
        if(!sessionIsCurrent(session)) return;
        hideAuthLoading();
        setLoginError('Chargement impossible. Recharge la page pour réessayer.');
        console.error('Chargement du compte impossible', error);
      }
    }else{
      document.getElementById('logout-btn').classList.add('hidden');
      document.getElementById('profile-menu-divider').classList.add('hidden');
      document.getElementById('cloud-sync-status').classList.add('hidden');
      hideAuthLoading();
    }
  });
  }





