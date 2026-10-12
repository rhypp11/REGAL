/* Shared data boundary: no DOM or Firebase dependency. */
(function(root){
  'use strict';
  const journalData = root.JTDJournalData || require('./journal-data.js');
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, field, nullable = true) => {
    if(value == null && nullable) return null;
    if(typeof value !== 'string') throw new Error('Champ invalide : ' + field);
    return value;
  };
  function escapeHTML(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeURL(value, image = false){
    if(typeof value !== 'string' || !value.trim()) return '';
    if(image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
    try{
      const url = new URL(value);
      return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    }catch(e){ return ''; }
  }
  function normalizeData(data, defaults = {}){
    if(!isRecord(data) || !Array.isArray(data.games)) throw new Error('Collection invalide');
    const used = new Set();
    let sequence = 0;
    const list = (key) => {
      if(data[key] === undefined && key !== 'games') return [];
      if(!Array.isArray(data[key])) throw new Error('Liste invalide : ' + key);
      return data[key].map(value => {
        if(!isRecord(value)) throw new Error('Entrée invalide');
        const nom = text(value.nom, 'nom', false).trim();
        const plateforme = text(value.plateforme, 'plateforme', false).trim();
        if(!nom || !plateforme) throw new Error('Nom ou plateforme vide');
        let id = value.id;
        if(id != null && typeof id !== 'string' && typeof id !== 'number') throw new Error('Identifiant invalide');
        if(typeof id === 'number' && !Number.isFinite(id)) throw new Error('Identifiant invalide');
        id = id == null ? '' : String(id);
        if(!id || used.has(id)){
          do { id = 'restored-' + key + '-' + (++sequence); } while(used.has(id));
        }
        used.add(id);
        const item = {id, nom, plateforme};
        for(const field of ['date','source','image','lien','format','type','status','saleStatus','saleVenue','saleChannel','saleId','journalPreviousStatus']){
          if(value[field] !== undefined) item[field] = text(value[field], field);
        }
        for(const field of ['collector','japanese']){
          if(value[field] != null && typeof value[field] !== 'boolean') throw new Error('Édition invalide');
          item[field] = value[field] === true;
        }
        if(value.prix != null && (typeof value.prix !== 'number' || !Number.isFinite(value.prix))) throw new Error('Prix invalide');
        if(value.prix !== undefined) item.prix = value.prix;
        for(const field of ['estimatedPrice','salePrice','saleOrder']){
          if(value[field] != null && (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] < 0)) throw new Error('Vente invalide');
          if(value[field] !== undefined) item[field] = value[field];
        }
        if(key === 'cemetery'){
          item.saleStatus = item.saleStatus || 'pending';
          if(!['pending','sold'].includes(item.saleStatus)) throw new Error('État de vente invalide');
          if(item.saleChannel && !['online','store'].includes(item.saleChannel)) throw new Error('Canal de vente invalide');
          if(item.saleStatus === 'sold' && item.salePrice == null) throw new Error('Prix de vente manquant');
        }
        // Missing mode in older backups keeps the whole image. Unknown modes cannot become CSS.
        if(value.imageFit !== undefined) item.imageFit = value.imageFit === 'cover' ? 'cover' : 'contain';
        if(item.image) item.image = safeURL(item.image, true) || null;
        if(item.lien) item.lien = safeURL(item.lien) || null;
        if(key === 'games'){
          if(item.format === 'Collector'){ item.format = 'Physique'; item.collector = true; }
          // Preserve retired backup metadata without exposing it as a collection mode.
          if(!item.format) item.format = 'Physique';
        }
        return item;
      });
    };
    // A repaired duplicate ID must never silently redirect a journal link.
    const referenced = new Set((Array.isArray(data.journal) ? data.journal : []).map(r => r && r.collectionId != null ? String(r.collectionId) : null));
    const identities = new Set();
    for(const key of ['games','arrivals','wishlist','cemetery']) for(const item of (Array.isArray(data[key]) ? data[key] : [])){
      if(item && item.id != null){const id=String(item.id);if(identities.has(id) && referenced.has(id)) throw new Error('Identifiant d’exemplaire ambigu dans la sauvegarde : ' + id);identities.add(id);}
    }
    let games = list('games'); const arrivals = list('arrivals'), wishlist = list('wishlist'), cemetery = list('cemetery');
    const journal = journalData.normalizeJournal(data.journal).map(item => ({...item, image:safeURL(item.image, true) || ''}));
    games = journalData.syncGames(games, journal);
    if(data.platformMeta !== undefined && !isRecord(data.platformMeta)) throw new Error('Métadonnées invalides');
    const platformMeta = Object.create(null);
    for(const [name, meta] of Object.entries(data.platformMeta || {})){
      if(!name.trim() || !isRecord(meta)) throw new Error('Plateforme invalide');
      const color = text(meta.color, 'couleur');
      if(color && !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) throw new Error('Couleur invalide');
      platformMeta[name] = {color, logo: safeURL(text(meta.logo, 'logo'), true) || null};
    }
    if(data.platformOrder !== undefined && (!Array.isArray(data.platformOrder) || !data.platformOrder.every(p => typeof p === 'string' && p.trim()))) throw new Error('Ordre des plateformes invalide');
    if(data.profile !== undefined && !isRecord(data.profile)) throw new Error('Profil invalide');
    const profile = data.profile || {};
    const profileName = text(profile.name ?? data.profileName ?? defaults.profileName ?? '', 'profil', false);
    const avatar = text(profile.avatar !== undefined ? profile.avatar : (data.profileAvatar !== undefined ? data.profileAvatar : defaults.profileAvatar), 'avatar');
    return {games, arrivals, wishlist, cemetery, journal, platformMeta, platformOrder:[...new Set(data.platformOrder || [])], profileName, profileAvatar:safeURL(avatar, true) || null};
  }
  function parseBackup(parsed, defaults){
    if(isRecord(parsed) && parsed.purpose) throw new Error('Cet export est destiné à ChatGPT. Choisis une sauvegarde complète pour restaurer JTD.');
    let data;
    if(Array.isArray(parsed)) data = {games:parsed};
    else if(isRecord(parsed) && parsed.app === 'Jeux Tout Doux'){
      if(!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > 4) throw new Error('Version de sauvegarde incompatible');
      data = parsed.data;
    }else data = parsed;
    return normalizeData(data, defaults);
  }
  function transferItem(source, target, id, draft){
    if(!source.some(item => item.id === id)) throw new Error('Élément introuvable');
    if(target.some(item => item.id === id)) throw new Error('Élément déjà transféré');
    return {source:source.filter(item => item.id !== id), target:[...target, {...draft, id}]};
  }
  function createStorage(storage){
    let uid = null;
    const keyFor = key => {
      if(!uid) throw new Error('Compte non chargé');
      return 'jtd-account:' + encodeURIComponent(uid) + ':' + key;
    };
    return {
      setAccount(value){ uid = value || null; },
      getItem(key){ return storage.getItem(keyFor(key)); },
      setItem(key, value){ storage.setItem(keyFor(key), value); },
      // Old unscoped data stays untouched: it is never attributed to a new account.
      hasLegacy(key){ return storage.getItem(key) !== null; },
      consumeLegacyNotice(key){
        const marker = keyFor('legacy-notice-v1');
        try {
          if(storage.getItem(key) === null || storage.getItem(marker) === 'seen') return false;
          storage.setItem(marker, 'seen');
          return true;
        } catch { return false; }
      },
      atomicWrite(entries){
        const previous = entries.map(([key]) => [keyFor(key), storage.getItem(keyFor(key))]);
        try { for(const [key,value] of entries) storage.setItem(keyFor(key), value); }
        catch(error){
          let rollbackFailed = false;
          for(const [key,value] of previous){
            try { if(value === null) storage.removeItem(key); else storage.setItem(key,value); }
            catch(e){ rollbackFailed = true; }
          }
          throw new Error(rollbackFailed ? 'Stockage indisponible ; retour local incomplet. Les données en mémoire sont conservées.' : 'Stockage indisponible ; restauration annulée.');
        }
      }
    };
  }
  function createSession(){
    let generation = 0, uid = null;
    return {
      start(nextUid){ uid = nextUid || null; return {uid, generation:++generation}; },
      current(){ return {uid, generation}; },
      isCurrent(session){ return !!session.uid && session.uid === uid && session.generation === generation; }
    };
  }
  function createPublicSharePayload(data, publishedAt = Date.now()){
    const list = key => Array.isArray(data && data[key]) ? data[key] : [];
    const cleanGame = item => ({
      nom: String(item.nom || ''),
      plateforme: String(item.plateforme || ''),
      collector: item.collector === true,
      japanese: item.japanese === true,
      status: item.status || null
    });
    const cleanBoardItem = item => ({
      nom: String(item.nom || ''),
      plateforme: String(item.plateforme || ''),
      date: item.date || null,
      collector: item.collector === true,
      japanese: item.japanese === true
    });
    const cemetery = list('cemetery');
    const lotSizes = new Map();
    for(const item of cemetery){
      if(item && item.saleStatus === 'sold'){
        const key = item.saleId || item.id;
        if(key) lotSizes.set(key, (lotSizes.get(key) || 0) + 1);
      }
    }
    const cleanSaleItem = item => {
      const result = cleanGame(item);
      result.saleStatus = item.saleStatus === 'sold' ? 'sold' : 'pending';
      if(item.saleChannel === 'online' || item.saleChannel === 'store') result.saleChannel = item.saleChannel;
      if(typeof item.saleVenue === 'string' && item.saleVenue.trim()) result.saleVenue = item.saleVenue.trim();
      if(Number.isFinite(item.estimatedPrice) && item.estimatedPrice >= 0) result.estimatedPrice = item.estimatedPrice;
      if(result.saleStatus === 'sold' && Number.isFinite(item.salePrice) && item.salePrice >= 0) result.salePrice = item.salePrice;
      const key = item.saleId || item.id;
      const lotSize = key && lotSizes.get(key);
      if(result.saleStatus === 'sold' && lotSize > 1) result.lotSize = lotSize;
      return result;
    };
    return {
      version: 2,
      publishedAt,
      games: list('games').filter(item => item && item.nom && item.plateforme).map(cleanGame),
      wishlist: list('wishlist').filter(item => item && item.nom && item.plateforme).map(cleanBoardItem),
      arrivals: list('arrivals').filter(item => item && item.nom && item.plateforme).map(cleanBoardItem),
      cemetery: cemetery.filter(item => item && item.nom && item.plateforme).map(cleanSaleItem)
    };
  }

  function assertCloudSize(data){
    // Shared conservative ceiling, below Firestore's document limit.
    if(new TextEncoder().encode(JSON.stringify(data)).length > 900000)
      throw new Error('Données trop volumineuses pour la synchronisation. Aucune modification appliquée. Réduis les images ou les avis après avoir téléchargé une sauvegarde.');
    return data;
  }
  function foldImport(value){
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();
  }
  const platformAliases = new Map([
    ['switch','Nintendo Switch'],['nintendo switch','Nintendo Switch'],['ns','Nintendo Switch'],['n switch','Nintendo Switch'],['nsw','Nintendo Switch'],
    ['switch 2','Nintendo Switch 2'],['switch2','Nintendo Switch 2'],['nintendo switch 2','Nintendo Switch 2'],['ns2','Nintendo Switch 2'],
    ['3ds','Nintendo 3DS'],['nintendo 3ds','Nintendo 3DS'],['ds','Nintendo DS'],['nintendo ds','Nintendo DS'],
    ['wu','Nintendo Wii U'],['wii u','Nintendo Wii U'],['nintendo wii u','Nintendo Wii U'],['wii','Nintendo Wii'],['nintendo wii','Nintendo Wii'],
    ['gc','Nintendo Gamecube'],['gamecube','Nintendo Gamecube'],['game cube','Nintendo Gamecube'],['nintendo gamecube','Nintendo Gamecube'],
    ['gba','Nintendo Game Boy Advance'],['gb','Nintendo Game Boy'],['gbc','Nintendo Game Boy Color'],
    ['ps5','PlayStation 5'],['playstation 5','PlayStation 5'],['ps4','PlayStation 4'],['playstation 4','PlayStation 4'],
    ['ps3','PlayStation 3'],['playstation 3','PlayStation 3'],['ps2','PlayStation 2'],['playstation 2','PlayStation 2'],['ps1','PlayStation'],['ps','PlayStation'],
    ['ps vita','PlayStation Vita'],['psvita','PlayStation Vita'],['vita','PlayStation Vita'],['psv','PlayStation Vita'],['playstation vita','PlayStation Vita'],['psp','PlayStation Portable'],
    ['xbox one','Xbox One'],['xbox series x','Xbox Series X'],['pc','PC'],['steam','PC']
  ]);
  function importPlatform(value){const raw=String(value ?? '').trim();return platformAliases.get(foldImport(raw)) || raw;}
  function importKey(item){return foldImport(item.nom)+'|'+foldImport(importPlatform(item.plateforme));}
  function importCandidates(item, games, cemetery){
    const title=foldImport(item.nom), platform=foldImport(importPlatform(item.plateforme));
    const tokens=new Set(title.split(' ').filter(t=>t.length>2));
    return [...games.map(game=>({...game,location:'collection'})),...cemetery.map(game=>({...game,location:game.saleStatus==='sold'?'sold':'pending'}))].map(game=>{
      const other=foldImport(game.nom), exactTitle=title===other, samePlatform=platform===foldImport(importPlatform(game.plateforme));
      const otherTokens=new Set(other.split(' ').filter(t=>t.length>2));
      const overlap=[...tokens].filter(t=>otherTokens.has(t)).length;
      const similarity=2*overlap/(tokens.size+otherTokens.size || 1);
      const score=exactTitle?(samePlatform?100:90):(similarity>=0.6?Math.round(similarity*70)+(samePlatform?10:0):0);
      return {...game,score,exact:exactTitle&&samePlatform};
    }).sort((a,b)=>b.score-a.score||a.nom.localeCompare(b.nom,'fr'));
  }
  function createChatGPTPayload(data, exportedAt=new Date().toISOString()){
    const normalized=normalizeData(data), shared=createPublicSharePayload(normalized);
    for(const key of ['games','arrivals','wishlist','cemetery']) shared[key]=shared[key].map((item,i)=>({...item,id:normalized[key][i].id}));
    shared.cemetery=shared.cemetery.map((item,i)=>normalized.cemetery[i].saleId?{...item,saleId:normalized.cemetery[i].saleId}:item);
    shared.journal=normalized.journal.map(({id,nom,plateforme,kind,parentName,collectionId,status,completion,medium,access,finishedAt,feeling,review})=>({id,nom,plateforme,kind,parentName,collectionId,status,completion,medium,access,finishedAt,feeling,review}));
    return {app:'Jeux Tout Doux',purpose:'Conseils dans ChatGPT',exportedAt,definitions:{
      games:'Exemplaires physiques actuellement dans la collection.',
      cemetery:'Exemplaires physiques à vendre (pending) ou vendus (sold).',
      journal:'Parcours indépendants ou liés à un exemplaire par collectionId. Plusieurs parcours peuvent être des replays ; ne pas les compter comme plusieurs jeux possédés.',
      collectionId:'Identifiant de games ou cemetery. Si absent des deux listes, exemplaire supprimé ; historique conservé. null signifie sans lien.',
      extensions:'Les extensions ne créent aucun exemplaire et ne pilotent pas le statut du jeu de base.',
      salePrice:'Prix encaissé par vente ; un même saleId désigne un lot dont le prix ne doit être compté qu’une fois.'
    },data:shared};
  }

  const api = {assertCloudSize, foldImport, importPlatform, importKey, importCandidates, createChatGPTPayload, escapeHTML, safeURL, normalizeData, parseBackup, transferItem, createStorage, createSession, createPublicSharePayload};
  root.JTDData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);



