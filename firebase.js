import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
  import {
    getFirestore, doc, getDoc, setDoc, deleteDoc
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
      journal: JOURNAL,
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
    window.renderJournal?.();
    renderProfileAvatar();
    updateBackupNote();
  }

  /* ---------- Partage public lecture seule ---------- */
  const FIRESTORE_SHARE_BASE = 'https://firestore.googleapis.com/v1/projects/' +
    firebaseConfig.projectId + '/databases/(default)/documents/shares/';

  function buildPublicSharePayload(){
    return JTDData.createPublicSharePayload({
      games:GAMES,
      wishlist:WISHLIST,
      arrivals:ARRIVALS,
      cemetery:CEMETERY
    });
  }

  function generateShareToken(){
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function shareUrl(token){
    return FIRESTORE_SHARE_BASE + encodeURIComponent(token) + '?key=' + encodeURIComponent(firebaseConfig.apiKey);
  }

  function renderShareUI(){
    const label = document.getElementById('share-label');
    const note = document.getElementById('share-note');
    const disableBtn = document.getElementById('share-disable-btn');
    if(!label || !note || !disableBtn) return;
    const active = !!SHARE_TOKEN;
    label.textContent = active ? 'Copier le lien de partage' : 'Partager ma collection';
    note.textContent = active
      ? 'Lien vivant en lecture seule • collection, wishlist, arrivages et ventes'
      : 'Lien lecture seule à copier dans ChatGPT';
    disableBtn.classList.toggle('hidden', !active);
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

  async function publishSharedSnapshot(session = sessions.current(), token = SHARE_TOKEN, payload = buildPublicSharePayload()){
    if(previewMode || suppressSync || !sessionIsCurrent(session) || !token) return;
    await setDoc(doc(db, 'shares', token), payload);
  }

  async function createOrCopyShare(session){
    if(previewMode){
      SHARE_TOKEN = 'sandbox-preview';
      renderShareUI();
      await copyText('https://jtd-sandbox-rhypp11.web.app/?share-preview=sandbox');
      showToast('Lien de partage test copié. Aucune donnée réelle n’est publiée.');
      return;
    }
    if(!currentUser || suppressSync || !sessionIsCurrent(session)) return;
    try{
      if(!SHARE_TOKEN){
        SHARE_TOKEN = generateShareToken();
        // Le token doit d'abord être enregistré sur le document privé de l'utilisateur :
        // les règles Firestore s'en servent pour autoriser l'écriture du snapshot public.
        await setDoc(doc(db, 'users', session.uid), buildCloudPayload());
      }
      if(!sessionIsCurrent(session)) return;
      const token = SHARE_TOKEN;
      await publishSharedSnapshot(session, token);
      if(!sessionIsCurrent(session)) return;
      await copyText(shareUrl(token));
      renderShareUI();
      showToast('Lien de partage copié. Il restera à jour avec ta collection.');
    }catch(err){
      if(!sessionIsCurrent(session)) return;
      console.error('Création du partage impossible', err);
      setSyncStatus('error', 'Partage impossible : ' + err.message);
      showToast("Impossible de créer le lien de partage pour l'instant.");
    }
  }

  async function disableShare(session){
    if(previewMode){
      SHARE_TOKEN = null;
      renderShareUI();
      showToast('Partage test désactivé.');
      return;
    }
    if(!currentUser || suppressSync || !SHARE_TOKEN || !sessionIsCurrent(session)) return;
    try{
      clearTimeout(syncTimer);
      const oldToken = SHARE_TOKEN;
      // Suppression avant d'effacer le token privé, sinon la règle d'écriture ne
      // reconnaîtrait plus le propriétaire du document public.
      await deleteDoc(doc(db, 'shares', oldToken));
      if(!sessionIsCurrent(session)) return;
      SHARE_TOKEN = null;
      await setDoc(doc(db, 'users', session.uid), buildCloudPayload());
      if(!sessionIsCurrent(session)) return;
      renderShareUI();
      setSyncStatus('ok', 'Synchronisé avec le cloud');
      showToast('Partage désactivé. L’ancien lien ne fonctionne plus.');
    }catch(err){
      if(!sessionIsCurrent(session)) return;
      console.error('Désactivation du partage impossible', err);
      setSyncStatus('error', 'Désactivation du partage impossible : ' + err.message);
      showToast("Impossible de désactiver le partage pour l'instant.");
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
    el.textContent = status === 'error' ? '⚠ Sync' : (status === 'syncing' || status === 'pending' ? '☁ …' : '☁ Sync');
  }

  async function doCloudSync(session, payload, publicPayload){
    if(suppressSync || !sessionIsCurrent(session)) return;
    setSyncStatus('syncing', 'Synchronisation...');
    try{
      // The UID and data are captured together; a later login cannot retarget this write.
      payload.shareToken = SHARE_TOKEN;
      await setDoc(doc(db, 'users', session.uid), payload);
      if(!sessionIsCurrent(session)) return;
      if(payload.shareToken && payload.shareToken === SHARE_TOKEN){
        await publishSharedSnapshot(session, payload.shareToken, publicPayload);
      }
      if(sessionIsCurrent(session)) setSyncStatus('ok', 'Synchronisé avec le cloud');
      return sessionIsCurrent(session);
    }catch(err){
      if(!sessionIsCurrent(session)) return;
      console.error('Erreur de synchronisation Firebase', err);
      setSyncStatus('error', 'Erreur de synchronisation : ' + err.message);
      return false;
    }
  }

  function scheduleCloudSync(){
    if(!currentUser || suppressSync) return;
    const session = sessions.current();
    setSyncStatus('pending', 'Synchronisation en attente...');
    cancelPendingSync();
    syncTimer = setTimeout(() => {
      if(!sessionIsCurrent(session) || suppressSync) return;
      const payload = buildCloudPayload();
      const publicPayload = buildPublicSharePayload();
      enqueueCloudOperation(() => doCloudSync(session, payload, publicPayload));
    }, 900);
  }
  window.JTDDataChanged = scheduleCloudSync;
  window.JTDPrepareReload = async () => {
    if(!currentUser) return true;
    if(suppressSync) return false;
    const session = sessions.current();
    cancelPendingSync();
    return enqueueCloudOperation(() => doCloudSync(session, buildCloudPayload(), buildPublicSharePayload()));
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
        await setDoc(ref, buildCloudPayload());
        if(!sessionIsCurrent(session)) return false;
      }
      refreshAllViews();
      suppressSync = false;
      if(SHARE_TOKEN) await publishSharedSnapshot(session);
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
    if(confirm('Se déconnecter ?')) signOut(auth);
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
    currentUser = user || null;
    accountStorage.setAccount(user && user.uid);
    replaceAppData(emptyData());
    SHARE_TOKEN = null;
    window.JTDJournal?.close();
    closeModal();
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




