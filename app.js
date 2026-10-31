const IS_PREVIEW_MODE = window.JTD_PREVIEW_MODE === true;
const mobileFilterToggle = document.getElementById('global-filter-toggle');
window.JTD_PREVIEW_MODE = IS_PREVIEW_MODE;
if(IS_PREVIEW_MODE){
  document.documentElement.dataset.environment = 'sandbox';
  window.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.id = 'sandbox-environment-badge';
    badge.textContent = 'ENVIRONNEMENT TEST';
    badge.style.cssText = 'position:fixed;z-index:99999;right:12px;bottom:12px;padding:7px 10px;border-radius:999px;background:#f5b942;color:#17130a;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 4px 18px rgba(0,0,0,.35);pointer-events:none';
    document.body.appendChild(badge);
  });
}
const PREVIEW_SEED = {
  games: [
    {id:'test-fe',japanese:true,nom:'Fire Emblem — Test',plateforme:'Switch 2',prix:59.99,format:'Physique',collector:false,type:null,status:'a_jouer',date:'2026-09-17',source:'Test',image:null},
    {id:'test-party',nom:'Jeu Multi — Test',plateforme:'Switch 2',prix:39.99,format:'Physique',collector:false,type:null,status:'multi',date:'2026-05-01',source:'Test',image:null},
    {id:'test-elsewhere',nom:'Terminé ailleurs — Test',plateforme:'PlayStation 5',prix:24.99,format:'Physique',collector:true,type:null,status:'termine_ailleurs',date:'2025-12-01',source:'Test',image:null}
  ],
  arrivals:[{id:'test-arrival',nom:'Arrivage — Test',plateforme:'Switch 2',prix:49.99,date:'2026-11-20',source:'Test',image:null}],
  wishlist:[
    {id:'test-wish',nom:'Wishlist — Test 2027',plateforme:'PC',prix:null,date:'2027',source:'Test',image:null},
    {id:'test-wish-nov-12',nom:'Avant dans l’alphabet — Test du 12',plateforme:'Switch 2',date:'2026-11-12',image:null},
    {id:'test-wish-nov-5',nom:'Plus tard dans l’alphabet — Test du 5',plateforme:'Switch 2',date:'2026-11-05',image:null},
    {id:'test-wish-year',nom:'Wishlist — Test 2026',plateforme:'PC',date:'2026',image:null},
    {id:'test-wish-tbd',nom:'Wishlist — Test TBD',plateforme:'PC',date:'TBD',image:null},
    {id:'test-wish-released',nom:'Déjà sorti — Test',plateforme:'Switch 2',date:'2026-09-17',image:null}
  ]
};
PREVIEW_SEED.cemetery = [
  {id:'sale-pending-1',nom:'Kena: Bridge of Spirits — Test',plateforme:'PlayStation 5',format:'Physique',prix:35,date:'2025-06-15',source:'Fnac',status:'termine',saleStatus:'pending',saleVenue:'Vinted',saleChannel:'online',estimatedPrice:20},
  {id:'sale-pending-2',nom:'Rayman Legends — Test',plateforme:'PlayStation 4',format:'Physique',prix:15,source:'Micromania',status:'termine',saleStatus:'pending'},
  {id:'sale-sold-1',nom:'Deathloop — Test',plateforme:'PlayStation 5',format:'Physique',prix:30,source:'Fnac',saleStatus:'sold',saleId:'test-sale-1',saleOrder:1,salePrice:18,saleVenue:'Vinted',saleChannel:'online'},
  {id:'sale-lot-1',nom:'Hidden Agenda — Test',plateforme:'PlayStation 4',format:'Physique',prix:10,saleStatus:'sold',saleId:'test-sale-lot',saleOrder:2,salePrice:25,saleVenue:'Micromania',saleChannel:'store'},
  {id:'sale-lot-2',nom:'Detroit: Become Human — Test',plateforme:'PlayStation 4',format:'Physique',prix:20,saleStatus:'sold',saleId:'test-sale-lot',saleOrder:2,salePrice:25,saleVenue:'Micromania',saleChannel:'store'}
];
const SEED_GAMES = [];
const {escapeHTML, safeURL} = window.JTDData;
const accountStorage = JTDData.createStorage(localStorage);
window.JTDStorage = accountStorage;
function writeStoredValue(key, value){
  if(IS_PREVIEW_MODE){
    try { savePreviewData(); return true; }
    catch(error){ console.error('Sauvegarde sandbox impossible', error); showToast('Sauvegarde locale impossible. Télécharge une sauvegarde pour conserver tes changements.'); return false; }
  }
  try{
    accountStorage.setItem(key, value);
    if(window.JTDDataChanged) window.JTDDataChanged();
    return true;
  }catch(error){
    console.error('Sauvegarde locale impossible', error);
    showToast('Sauvegarde locale impossible. Télécharge une sauvegarde pour conserver tes changements.');
    return false;
  }
}
// A single sandbox-only snapshot keeps transfers atomic and survives refreshes.
// It never reads account keys or contacts Firebase.
// Hosted previews get a generous fictional collection; local regression fixtures stay small.
const HAS_PREVIEW_COLLECTION_DEMO = IS_PREVIEW_MODE && location.hostname.startsWith('jtd-sandbox-rhypp11');
function buildPreviewCollectionDemo(){
  const titles = ['Les Jardins d’Aster','Chroniques du rivage','La Tour des saisons','Échos de cristal',
    'L’Archipel oublié','Les Voyageurs de l’aube','Le Dernier atelier','Sous les lunes jumelles',
    'La Route des étoiles','Mémoires de la forêt','Les Gardiens du phare','Un été à Solaria'];
  const statuses = ['en_cours','a_jouer','termine','termine_ailleurs','multi',null];
  return Array.from({length:72}, (_,i) => ({
    id:'demo-collection-'+i,
    nom:titles[i % titles.length] + ' ' + (Math.floor(i / titles.length) + 1) + ' — Démo',
    plateforme:i < 48 ? 'Switch 2' : i < 64 ? 'PlayStation 5' : 'PlayStation 4',
    format:'Physique', collector:i % 7 === 0, japanese:i % 11 === 0,
    prix:i % 9 === 0 ? null : (1999 + (i % 5) * 1000) / 100,
    date:i % 8 === 0 ? null : '2026-' + String(i % 10 + 1).padStart(2,'0') + '-15',
    source:i % 3 === 0 ? 'Boutique démo' : 'Enseigne démo',
    status:statuses[i % statuses.length], image:new URL('preview-assets/'+['garden','lighthouse','mountains'][i % 3]+'.svg',location.href).href
  }));
}
function decoratePreviewData(data){
  const art = ['garden','lighthouse','mountains'];
  for(const key of ['games','arrivals','wishlist','cemetery']){
    data[key].forEach((item,index) => {
      if(!item.image && /^(demo-collection-|test-|sale-)/.test(item.id)){
        item.image = new URL('preview-assets/'+art[index % art.length]+'.svg',location.href).href;
      }
    });
  }
  const icons = {'Switch 2':['switch','#C4342B'],'PlayStation 5':['playstation','#245594'],'PlayStation 4':['playstation','#2C4C7C'],'PC':['pc','#4F7CD9']};
  for(const [name,[icon,color]] of Object.entries(icons)){
    if(!data.platformMeta[name]) data.platformMeta[name] = {color};
    if(!data.platformMeta[name].logo) data.platformMeta[name].logo = new URL('preview-assets/'+icon+'.svg',location.href).href;
  }
  return data;
}
const PREVIEW_STORAGE_KEY = 'jtd:sandbox:cemetery-poc-v1' + (HAS_PREVIEW_COLLECTION_DEMO ? ':collection-demo-v1' : '');
let previewData;
function loadPreviewData(){
  if(previewData) return previewData;
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    if(raw){
      const parsed = JTDData.normalizeData(JSON.parse(raw));
      return previewData = HAS_PREVIEW_COLLECTION_DEMO ? decoratePreviewData(parsed) : parsed;
    }
  } catch(error){ console.error('Lecture sandbox impossible', error); }
  const initial = JTDData.normalizeData({...PREVIEW_SEED,
    games:HAS_PREVIEW_COLLECTION_DEMO ? [...PREVIEW_SEED.games,...buildPreviewCollectionDemo(),...digitalPreviewGames()] : PREVIEW_SEED.games,
    digitalAccounts:HAS_PREVIEW_COLLECTION_DEMO ? digitalPreviewAccounts() : [],
    profileName:'Mode test'});
  return previewData = HAS_PREVIEW_COLLECTION_DEMO ? decoratePreviewData(initial) : initial;
}
function savePreviewData(overrides = {}){
  const data = {...{games:GAMES, arrivals:ARRIVALS, wishlist:WISHLIST, cemetery:CEMETERY, journal:LEGACY_JOURNAL, digitalAccounts:DIGITAL_ACCOUNTS, platformMeta, platformOrder, profileName:PROFILE_NAME, profileAvatar:PROFILE_AVATAR}, ...overrides};
  localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data));
  previewData = data;
}
function restoredStorageEntries(data){
  return [
    [STORAGE_KEY, JSON.stringify(data.games)],
    [ARRIVALS_KEY, JSON.stringify(data.arrivals)],
    [WISHLIST_KEY, JSON.stringify(data.wishlist)],
    [CEMETERY_KEY, JSON.stringify(data.cemetery || [])],
    [LEGACY_JOURNAL_KEY, JSON.stringify(data.journal || [])],
    [DIGITAL_ACCOUNTS_KEY, JSON.stringify(data.digitalAccounts || [])],
    [PLATFORM_META_KEY, JSON.stringify(data.platformMeta)],
    [PLATFORM_ORDER_KEY, JSON.stringify(data.platformOrder)],
    [PROFILE_KEY, JSON.stringify({name:data.profileName, avatar:data.profileAvatar})]
  ];
}
function replaceAppData(data){
  GAMES = data.games;
  ARRIVALS = data.arrivals;
  WISHLIST = data.wishlist;
  CEMETERY = data.cemetery || [];
  LEGACY_JOURNAL = data.journal || [];
  DIGITAL_ACCOUNTS = data.digitalAccounts || [];
  window.renderCemetery?.();
  platformMeta = data.platformMeta;
  platformOrder = data.platformOrder;
  PROFILE_NAME = data.profileName;
  PROFILE_AVATAR = data.profileAvatar;
}
window.replaceAppData = replaceAppData;
window.persistAppData = data => {
  JTDData.assertCloudSize({...data,shareToken:SHARE_TOKEN,updatedAt:Date.now()});
  return IS_PREVIEW_MODE ? savePreviewData(data) : accountStorage.atomicWrite(restoredStorageEntries(data));
};

const STORAGE_KEY = 'ludotheque:games-v2';
const ARRIVALS_KEY = 'ludotheque:arrivals-v1';
const WISHLIST_KEY = 'ludotheque:wishlist-v1';
const MONTH_NAMES_FULL = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// Palette mensuelle de la référence de Rom, de janvier à décembre.
const MONTH_COLORS = ['#45818E','#38761D','#6AA84F','#F1C232','#E69138','#B45F06','#E06666','#990000','#741B47','#351C75','#0B5394','#6D9EEB'];
const MONTH_DATE_COLORS = ['#A2C4C9','#93C47D','#B6D7A8','#FFD966','#F6B26B','#E69138','#EA9999','#E06666','#A64D79','#B4A7D6','#9FC5E8','#C9DAF8'];
function calendarTextColor(color) {
  const rgb = color.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel,16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return 1.05 / (luminance + .05) >= 4.5 ? '#FFFFFF' : '#000000';
}
const MONTH_TEXT_COLORS = MONTH_COLORS.map(calendarTextColor);
const MONTH_DATE_TEXT_COLORS = MONTH_DATE_COLORS.map(calendarTextColor);
const PROFILE_KEY = 'ludotheque:profile-v1';


let PROFILE_NAME = '';
let PROFILE_AVATAR = null;
let SHARE_TOKEN = null;

function loadProfile(){
  if(IS_PREVIEW_MODE){ const data = loadPreviewData(); PROFILE_NAME = data.profileName; PROFILE_AVATAR = data.profileAvatar; return; }
  try{
    const raw = accountStorage.getItem(PROFILE_KEY);
    if(raw){
      const p = JSON.parse(raw);
      PROFILE_NAME = p.name || '';
      PROFILE_AVATAR = p.avatar || null;
    }
  }catch(e){ /* ignore */ }
}
function saveProfile(){
  return writeStoredValue(PROFILE_KEY, JSON.stringify({ name: PROFILE_NAME, avatar: PROFILE_AVATAR }));
}
function profileInitials(){
  const trimmed = PROFILE_NAME.trim();
  if(!trimmed) return '';
  return trimmed.split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
}
function renderProfileAvatar(){
  const initials = profileInitials();
  document.querySelectorAll('[data-avatar-img]').forEach(el => {
    el.src = PROFILE_AVATAR || '';
    el.classList.toggle('hidden', !PROFILE_AVATAR);
  });
  document.querySelectorAll('[data-avatar-initials]').forEach(el => {
    el.textContent = initials;
    el.classList.toggle('hidden', !!PROFILE_AVATAR || !initials);
  });
  document.querySelectorAll('[data-avatar-fallback]').forEach(el => {
    el.classList.toggle('hidden', !!PROFILE_AVATAR || !!initials);
  });
  const nameInput = document.getElementById('profile-name-input');
  if(nameInput && document.activeElement !== nameInput) nameInput.value = PROFILE_NAME;
}
function resizeImageToDataUrl(file, size){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const PLATFORM_COLORS = {
  "Nintendo Switch 2": "#C4342B",
  "Nintendo Switch": "#E4483C",
  "Nintendo 3DS": "#6E4FA3",
  "Nintendo Wii": "#C9CCD1",
  "Nintendo Wii U": "#4A6FA5",
  "Nintendo DS": "#6BAED6",
  "Nintendo Gamecube": "#4B3F72",
  "PlayStation 5": "#E5E5E5",
  "PlayStation 4": "#2C4C7C",
  "PlayStation 3": "#5A5D66",
  "PlayStation 2": "#8B95A1",
  "PlayStation Vita": "#3A4A66",
  "PlayStation Portable": "#71787F",
  "PlayStation 1": "#A9A9A9"
};
const FALLBACK_PALETTE = ["#D9A441","#4FC7B5","#8B7CD9","#D97757","#5EA8D9","#C97BB0"];
const PLATFORM_META_KEY = 'ludotheque:platform-meta-v1';
let platformMeta = Object.create(null); // { [nom]: { color, logo } }

function loadPlatformMeta(){
  if(IS_PREVIEW_MODE){ platformMeta = loadPreviewData().platformMeta; return; }
  try{
    const raw = accountStorage.getItem(PLATFORM_META_KEY);
    platformMeta = raw ? JSON.parse(raw) : {};
  }catch(e){
    platformMeta = {};
  }
}

function savePlatformMeta(){
  return writeStoredValue(PLATFORM_META_KEY, JSON.stringify(platformMeta));
}

function hashColor(name){
  let hash = 0;
  for(let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function getPlatformColor(name){
  if(platformMeta[name] && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(platformMeta[name].color || '')) return platformMeta[name].color;
  if(Object.hasOwn(PLATFORM_COLORS, name)) return PLATFORM_COLORS[name];
  return hashColor(name);
}

function getPlatformLogo(name){
  return safeURL(platformMeta[name] && platformMeta[name].logo, true) || null;
}

function ensurePlatformMeta(name){
  if(!Object.hasOwn(platformMeta, name)) platformMeta[name] = { color: getPlatformColor(name), logo: null };
  return platformMeta[name];
}

function seedPcPlatformOnce(){
  try{
    let changed = false;
    if(!platformMeta['PC']){
      ensurePlatformMeta('PC').color = '#4F7CD9';
      changed = true;
    }
    if(!platformMeta['Nintendo Game Boy Advance']){
      ensurePlatformMeta('Nintendo Game Boy Advance').color = '#8B5FBF';
      changed = true;
    }
    if(changed) savePlatformMeta();
  }catch(e){}
}

function renamePlatform(oldName, newName){
  newName = newName.trim();
  if(!newName || newName === oldName) return false;
  [GAMES, ARRIVALS, WISHLIST, CEMETERY].forEach(items => items.forEach(g => { if(g.plateforme === oldName) g.plateforme = newName; }));
  const meta = platformMeta[oldName];
  delete platformMeta[oldName];
  platformMeta[newName] = meta || { color: getPlatformColor(oldName), logo: null };
  if(state.platform === oldName) state.platform = newName;
  const orderIdx = platformOrder.indexOf(oldName);
  if(orderIdx !== -1) platformOrder[orderIdx] = newName;
  savePlatformOrder();
  saveGames();
  saveArrivals();
  saveWishlist();
  writeStoredValue(CEMETERY_KEY, JSON.stringify(CEMETERY));
  savePlatformMeta();
  window.renderCemetery?.();
  renderArrivals();
  renderWishlist();
  return true;
}


function migrateImportedPlatformAliases(){
  const aliases = new Map([['NSW','Nintendo Switch'],['PSV','PlayStation Vita']]);
  let gamesChanged = false, arrivalsChanged = false, wishlistChanged = false, cemeteryChanged = false;
  const remap = (items, markChanged) => items.forEach(game => {
    const canonical = aliases.get(String(game.plateforme || '').trim().toUpperCase());
    if(canonical && game.plateforme !== canonical){ game.plateforme = canonical; markChanged(); }
  });
  remap(GAMES, () => { gamesChanged = true; });
  remap(ARRIVALS, () => { arrivalsChanged = true; });
  remap(WISHLIST, () => { wishlistChanged = true; });
  remap(CEMETERY, () => { cemeteryChanged = true; });

  let metaChanged = false;
  for(const [alias, canonical] of aliases){
    if(Object.hasOwn(platformMeta, alias)){
      if(!Object.hasOwn(platformMeta, canonical)) platformMeta[canonical] = platformMeta[alias];
      delete platformMeta[alias];
      metaChanged = true;
    }
  }
  const previousOrder = JSON.stringify(platformOrder);
  platformOrder = [...new Set(platformOrder.map(name => aliases.get(String(name).trim().toUpperCase()) || name))];
  const orderChanged = previousOrder !== JSON.stringify(platformOrder);
  const changed = gamesChanged || arrivalsChanged || wishlistChanged || cemeteryChanged || metaChanged || orderChanged;
  if(!changed) return;

  if(IS_PREVIEW_MODE){
    savePreviewData();
  } else {
    const writes = [];
    if(gamesChanged) writes.push([STORAGE_KEY, JSON.stringify(GAMES)]);
    if(arrivalsChanged) writes.push([ARRIVALS_KEY, JSON.stringify(ARRIVALS)]);
    if(wishlistChanged) writes.push([WISHLIST_KEY, JSON.stringify(WISHLIST)]);
    if(cemeteryChanged) writes.push([CEMETERY_KEY, JSON.stringify(CEMETERY)]);
    if(metaChanged) writes.push([PLATFORM_META_KEY, JSON.stringify(platformMeta)]);
    if(orderChanged) writes.push([PLATFORM_ORDER_KEY, JSON.stringify(platformOrder)]);
    if(writes.length){
      accountStorage.atomicWrite(writes);
      window.JTDDataChanged?.();
    }
  }
  buildPlatformList();
  render();
  window.renderCemetery?.();
  renderArrivals();
  renderWishlist();
}

window.JTDMigratePlatformAliases = migrateImportedPlatformAliases;
/* ---------- Ordre personnalisé des plateformes ---------- */
const PLATFORM_ORDER_KEY = 'ludotheque:platform-order-v1';
let platformOrder = [];

function loadPlatformOrder(){
  if(IS_PREVIEW_MODE){ platformOrder = loadPreviewData().platformOrder; return; }
  try{
    const raw = accountStorage.getItem(PLATFORM_ORDER_KEY);
    platformOrder = raw ? JSON.parse(raw) : [];
  }catch(e){
    platformOrder = [];
  }
}

function savePlatformOrder(){
  return writeStoredValue(PLATFORM_ORDER_KEY, JSON.stringify(platformOrder));
}

function getOrderedPlatformNames(){
  const all = allPlatformNames();
  const known = platformOrder.filter(p => all.includes(p));
  const missing = all.filter(p => !known.includes(p)).sort((a,b) => a.localeCompare(b));
  return [...known, ...missing];
}

function movePlatformOrder(name, direction){
  const order = getOrderedPlatformNames();
  const idx = order.indexOf(name);
  const swapIdx = idx + direction;
  if(idx === -1 || swapIdx < 0 || swapIdx >= order.length) return;
  [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
  platformOrder = order;
  savePlatformOrder();
}

/* ---------- Tri de la liste de plateformes (filtres) ---------- */
const PLATFORM_SORT_MODE_KEY = 'ludotheque:platform-sort-mode-v1';
let platformSortMode = 'count'; // 'count' | 'custom'
try{
  const storedMode = IS_PREVIEW_MODE ? null : accountStorage.getItem(PLATFORM_SORT_MODE_KEY);
  if(storedMode === 'count' || storedMode === 'custom') platformSortMode = storedMode;
}catch(e){ /* ignore */ }

function togglePlatformSortMode(){
  platformSortMode = platformSortMode === 'count' ? 'custom' : 'count';
  try{ accountStorage.setItem(PLATFORM_SORT_MODE_KEY, platformSortMode); }catch(e){ /* ignore */ }
  buildPlatformList();
}

function updateSortButtonUI(){
  const btn = document.getElementById('sort-platforms-btn');
  if(!btn) return;
  if(platformSortMode === 'custom'){
    btn.classList.add('active-sort');
    btn.title = 'Tri : ordre personnalisé (cliquer pour trier par nombre de jeux)';
  } else {
    btn.classList.remove('active-sort');
    btn.title = 'Tri : nombre de jeux (cliquer pour utiliser l\'ordre personnalisé défini dans la gestion des plateformes)';
  }
}

const ICON_STATUS_TODO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"></circle><line x1="12" y1="9" x2="12" y2="15"></line><rect x="6" y="15" width="12" height="5" rx="1.5"></rect></svg>`;
const ICON_STATUS_DONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const ICON_STATUS_MULTI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15c-1.66 0-3-1.34-3-3s1.34-3 3-3c2.5 0 4 3 6 3s3.5-3 6-3c1.66 0 3 1.34 3 3s-1.34 3-3 3c-2.5 0-4-3-6-3s-3.5 3-6 3z"></path></svg>`;
const ICON_STATUS_PLAYING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 7h9c2 0 3.2 1.5 3.6 3.4l1.2 6.1c.5 2.5-2.2 3.9-3.8 2.1L15 16H9l-2.5 2.6c-1.6 1.8-4.3.4-3.8-2.1l1.2-6.1C4.3 8.5 5.5 7 7.5 7Z"/><path d="M7 10v4m-2-2h4"/><circle cx="16" cy="11" r=".6" fill="currentColor"/><circle cx="18" cy="13" r=".6" fill="currentColor"/></svg>`;
const STATUS_OPTIONS = [
  { key: "a_jouer", label: "À faire", icon: ICON_STATUS_TODO, color: "var(--status-todo)", fill: "var(--status-todo-fill)", bg: "color-mix(in srgb,var(--status-todo-fill) 28%,var(--surface))", border: "color-mix(in srgb,var(--status-todo-fill) 55%,var(--surface))" },
  { key: "multi", label: "Multi", icon: ICON_STATUS_MULTI, color: "var(--status-multi)", fill: "var(--status-multi-fill)", bg: "color-mix(in srgb,var(--status-multi-fill) 28%,var(--surface))", border: "color-mix(in srgb,var(--status-multi-fill) 55%,var(--surface))" },
  { key: "termine", label: "Terminé", icon: ICON_STATUS_DONE, color: "var(--status-done)", fill: "var(--status-done-fill)", bg: "color-mix(in srgb,var(--status-done-fill) 28%,var(--surface))", border: "color-mix(in srgb,var(--status-done-fill) 55%,var(--surface))" },
  { key: "termine_ailleurs", label: "Terminé ailleurs", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h5v5"></path><path d="m10 14 10-10"></path><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"></path></svg>`, color: "var(--status-elsewhere)", fill: "var(--status-elsewhere-fill)", bg: "color-mix(in srgb,var(--status-elsewhere-fill) 28%,var(--surface))", border: "color-mix(in srgb,var(--status-elsewhere-fill) 55%,var(--surface))" }
];

let GAMES = [];
let ARRIVALS = [];
let WISHLIST = [];
let CEMETERY = [];
// Inert private archive: preserve old backups and account data without collection links.
let LEGACY_JOURNAL = [];
const LEGACY_JOURNAL_KEY = 'ludotheque:journal-v1';
const CEMETERY_KEY = 'ludotheque:cemetery-v1';
let editingId = null; // null = ajout, sinon id du jeu en édition
let editingCollection = 'games';
let editingArrivalId = null;
let editingWishlistId = null;
let convertingWishlistId = null; // id de l'item wishlist en cours de bascule vers arrivage
let convertingArrivalId = null; // id de l'arrivage en cours de bascule vers la collection
let convertingArrivalToWishlistId = null; // id de l'arrivage en cours de bascule vers la wishlist

let state = {
  media: 'physical',
  contentType: null,
  accountId: null,
  platform: null,
  collector: false,
  japanese: false,
  status: null,
  search: "",
  sort: "name-asc"
};

/* ---------- Toasts & confirmation réutilisables ---------- */
let toastTimer = null;
function showToast(message, actionLabel, onAction, duration){
  const stack = document.getElementById('toast-stack');
  if(!stack) return;
  stack.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  const actionHtml = actionLabel ? `<button type="button" class="toast-action">${escapeHTML(actionLabel)}</button>` : '';
  toast.innerHTML = `<span class="toast-message">${escapeHTML(message)}</span>${actionHtml}<button type="button" class="toast-close" aria-label="Fermer">✕</button>`;
  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 160);
  };
  if(actionLabel){
    toast.querySelector('.toast-action').addEventListener('click', () => {
      clearTimeout(toastTimer);
      remove();
      onAction && onAction();
    });
  }
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(toastTimer);
    remove();
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(remove, duration || 6000);
}

let activeConfirmationCleanup = null;
window.cancelPendingConfirmation = () => { if(activeConfirmationCleanup) activeConfirmationCleanup(); };
function confirmAction(message, onConfirm, opts){
  window.cancelPendingConfirmation();
  const overlay = document.getElementById('confirm-modal-overlay');
  document.getElementById('confirm-modal-title').textContent = (opts && opts.title) || 'Confirmer la suppression';
  document.getElementById('confirm-modal-message').textContent = message;
  const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
  confirmBtn.textContent = (opts && opts.confirmLabel) || 'Supprimer';

  const cleanup = () => {
    window.JTDDialogs.close('confirm-modal-overlay');
    confirmBtn.removeEventListener('click', onConfirmClick);
    cancelBtn.removeEventListener('click', onCancelClick);
    activeConfirmationCleanup = null;
  };
  const onConfirmClick = () => { cleanup(); onConfirm(); };
  const onCancelClick = () => { cleanup(); };
  const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
  confirmBtn.addEventListener('click', onConfirmClick);
  cancelBtn.addEventListener('click', onCancelClick);
  activeConfirmationCleanup = cleanup;
  window.JTDDialogs.open('confirm-modal-overlay', {onDismiss:cleanup,initialFocus:'#confirm-modal-cancel-btn'});
}

function euros(n){
  if(n === null || n === undefined) return "—";
  return n.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + " €";
}

function dateFR(iso){
  if(!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parsePriceInput(s){
  if(!s) return null;
  s = s.trim().replace(',', '.').replace('€','').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function loadGames(){
  if(IS_PREVIEW_MODE){ GAMES = loadPreviewData().games.map(g => ({...g})); return; }
  try{
    const raw = accountStorage.getItem(STORAGE_KEY);
    if(raw){
      GAMES = JSON.parse(raw);
      return;
    }
  }catch(e){ console.error('Lecture locale impossible', e); }
  // Premier lancement (ou stockage local vide) : on part des données du CSV
  GAMES = SEED_GAMES.map(g => ({...g, image: null, status:null}));
  await saveGames();
}

function normalizeCollectionEditions(){
  GAMES.forEach(g => {
    if(g.format === 'Collector'){
      g.format = 'Physique';
      g.collector = true;
    } else if(g.collector === undefined){
      g.collector = false;
    }
  });
}

function saveGames(){
  return writeStoredValue(STORAGE_KEY, JSON.stringify(GAMES));
}


async function loadArrivals(){
  if(IS_PREVIEW_MODE){ ARRIVALS = loadPreviewData().arrivals.map(g => ({...g})); return; }
  try{
    const raw = accountStorage.getItem(ARRIVALS_KEY);
    ARRIVALS = raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Lecture des arrivages impossible', e);
    ARRIVALS = [];
  }
}

function saveArrivals(){
  return writeStoredValue(ARRIVALS_KEY, JSON.stringify(ARRIVALS));
}

async function loadWishlist(){
  if(IS_PREVIEW_MODE){ WISHLIST = loadPreviewData().wishlist.map(g => ({...g})); return; }
  try{
    const raw = accountStorage.getItem(WISHLIST_KEY);
    WISHLIST = raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Lecture de la wishlist impossible', e);
    WISHLIST = [];
  }
}

function saveWishlist(){
  return writeStoredValue(WISHLIST_KEY, JSON.stringify(WISHLIST));
}

const BACKUP_VERSION = 4;
const LAST_BACKUP_KEY = 'ludotheque:last-backup-v2';
const LEGACY_LAST_EXPORT_KEY = 'ludotheque:last-export-v1';

function updateBackupNote(){
  const el = document.getElementById('backup-note');
  if(!el) return;
  const raw = IS_PREVIEW_MODE ? null : (accountStorage.getItem(LAST_BACKUP_KEY) || accountStorage.getItem(LEGACY_LAST_EXPORT_KEY));
  if(!raw){
    el.textContent = 'Aucune sauvegarde locale';
    return;
  }
  const d = new Date(raw);
  el.textContent = 'Dernière : ' + d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function buildBackupPayload(){
  return {
    app: 'Jeux Tout Doux',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      games: GAMES,
      arrivals: ARRIVALS,
      wishlist: WISHLIST,
      cemetery: CEMETERY,
      journal: LEGACY_JOURNAL,
      digitalAccounts: DIGITAL_ACCOUNTS,
      platformMeta,
      platformOrder,
      profile: { name: PROFILE_NAME, avatar: PROFILE_AVATAR }
    }
  };
}

function downloadBackup(suffix){
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = 'jeux-tout-doux-' + (suffix ? suffix + '-' : '') + date + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupData(){
  downloadBackup('sauvegarde');
  try{ accountStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); }catch(e){ /* ignore */ }
  updateBackupNote();
  showToast('Sauvegarde téléchargée.');
}

function cleanBackupData(parsed){
  return JTDData.parseBackup(parsed, {profileName:PROFILE_NAME, profileAvatar:PROFILE_AVATAR});
}
function applyRestoredData(data){
  window.persistAppData(data);
  replaceAppData(data);
  state.platform = null;
  buildPlatformList();
  buildFormatToggles();
  buildStatusToggles();
  render();
  renderArrivals();
  renderWishlist();
  renderProfileAvatar();
  window.renderCemetery?.();
  if(window.JTDDataChanged) window.JTDDataChanged();
}

// Cemetery imports write only the boards they actually change.
window.JTDApplyCemeteryImport = (games, cemetery) => {
  games = [...games,...GAMES.filter(game => JTDData.isDigital(game))];
  JTDData.assertCloudSize({...buildBackupPayload().data,games,cemetery,shareToken:SHARE_TOKEN,updatedAt:Date.now()});
  if(IS_PREVIEW_MODE) savePreviewData({games, cemetery});
  else accountStorage.atomicWrite([
    [STORAGE_KEY, JSON.stringify(games)],
    [CEMETERY_KEY, JSON.stringify(cemetery)]
  ]);
  GAMES = games;
  CEMETERY = cemetery;
  buildPlatformList();
  render();
  window.renderCemetery?.();
  window.JTDDataChanged?.();
};
window.JTDGetCemeteryImportState = () => ({
  games: GAMES.filter(game => !JTDData.isDigital(game)).map(game => ({...game})),
  cemetery: CEMETERY.map(game => ({...game})),
  usedIds: [...GAMES,...CEMETERY,...ARRIVALS,...WISHLIST].map(item=>item.id)
});

function restoreBackup(file){
  const accountGeneration = window.JTDAccountGeneration;
  const reader = new FileReader();
  reader.onload = (e) => {
    if(accountGeneration !== window.JTDAccountGeneration) return;
    try{
      const data = cleanBackupData(JSON.parse(e.target.result));
      JTDData.assertCloudSize({...data,shareToken:SHARE_TOKEN,updatedAt:Date.now()});
      const summary = [
        data.games.length + ' jeu(x)',
        data.wishlist.length + ' souhait(s)',
        data.arrivals.length + ' arrivage(s)',
        data.cemetery.length + ' entrée(s) au cimetière'
      ].join(' • ');
      confirmAction(
        'Cette restauration remplacera toutes les listes, le profil et les plateformes par le contenu du fichier : ' + summary + '. Les sections absentes d’une ancienne sauvegarde seront vidées. Tu peux annuler et télécharger une sauvegarde complète avant de continuer.',
        () => {
          if(accountGeneration !== window.JTDAccountGeneration) return;
          try{
            applyRestoredData(data);
            showToast('Sauvegarde restaurée.' + (IS_PREVIEW_MODE ? '' : ' Synchronisation cloud en attente.'));
          }catch(error){
            console.error('Restauration impossible', error);
            showToast(error.message || 'Restauration impossible.');
          }
        },
        { title:'Restaurer la sauvegarde ?', confirmLabel:'Restaurer' }
      );
    }catch(err){
      console.error('Restauration impossible', err);
      showToast(err.message || "Ce fichier n’est pas une sauvegarde Jeux Tout Doux valide.");
    }
  };
  reader.onerror = () => showToast('Lecture du fichier impossible.');
  reader.readAsText(file);
}

function setStatus(id, statusKey){
  const g = GAMES.find(x => x.id === id);
  if(!g || !isPlayablePurchase(g)) return;
  g.status = (getEffectiveStatus(g) === statusKey) ? null : statusKey;
  saveGames();
  render();
}

// A long desktop sidebar follows the document, then pins when its last filter is visible.
function updateCollectionSidebarPosition(){
  const sidebar=document.getElementById('collection-sidebar');
  if(!sidebar || matchMedia('(max-width:820px)').matches)return;
  const navHeight=document.querySelector('.topnav').getBoundingClientRect().height;
  const top=Math.min(navHeight,innerHeight-sidebar.getBoundingClientRect().height-12);
  sidebar.style.setProperty('--collection-sidebar-top',top+'px');
}
document.addEventListener('DOMContentLoaded',()=>{
  const observer=new ResizeObserver(updateCollectionSidebarPosition);
  observer.observe(document.getElementById('collection-sidebar'));
  observer.observe(document.querySelector('.topnav'));
  window.addEventListener('resize',updateCollectionSidebarPosition,{passive:true});
  updateCollectionSidebarPosition();
});

function buildPlatformList(){
  const scoped = collectionScope();
  if(state.platform && !scoped.some(g => g.plateforme === state.platform)) state.platform = null;
  const counts = Object.create(null);
  scoped.forEach(g => { counts[g.plateforme] = (counts[g.plateforme]||0) + 1; });
  const platforms = platformSortMode === 'custom'
    ? getOrderedPlatformNames().filter(p => counts[p])
    : Object.keys(counts).sort((a,b) => counts[b]-counts[a]);

  updateSortButtonUI();

  const container = document.getElementById('platform-list');
  container.innerHTML = "";

  const allItem = document.createElement('div');
  allItem.className = 'plat-item' + (state.platform === null ? ' active' : '');
  allItem.style.setProperty('--spine', 'var(--muted)');
  allItem.tabIndex = 0;
  setFilterAccessibility(allItem, state.platform === null);
  const allIconSvg = `<svg class="gamepad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.5"></circle></svg>`;
  allItem.innerHTML = `${allIconSvg}<span class="plat-name">Toutes</span><span class="plat-count">${scoped.length}</span>`;
  allItem.onclick = () => { state.platform = null; buildPlatformList(); render(); closeMobileDrawers(); };
  container.appendChild(allItem);

  platforms.forEach(p => {
    const item = document.createElement('div');
    const color = getPlatformColor(p);
    const logo = getPlatformLogo(p);
    item.className = 'plat-item' + (state.platform === p ? ' active' : '');
    item.style.setProperty('--spine', color);
    item.tabIndex = 0;
  setFilterAccessibility(item, state.platform === p);
    const iconHtml = logo
      ? `<img class="mini-logo" src="${escapeHTML(safeURL(logo, true))}" alt="">`
      : `<span class="spine-chip"></span>`;
    item.innerHTML = `${iconHtml}<span class="plat-name">${escapeHTML(p)}</span><span class="plat-count">${counts[p]}</span>`;
    item.onclick = () => { state.platform = (state.platform === p ? null : p); buildPlatformList(); render(); closeMobileDrawers(); };
    container.appendChild(item);
  });
}

function setFilterAccessibility(element, active){
  element.setAttribute('role', 'button');
  element.setAttribute('aria-pressed', String(active));
  element.addEventListener('keydown', event => {
    if(event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const parent = element.parentElement;
    const index = [...parent.children].indexOf(element);
    element.click();
    const replacement = parent.children[index];
    const sidebar = parent.closest('.sidebar');
    const closedDrawer = matchMedia('(max-width:820px)').matches && sidebar && !sidebar.classList.contains('mobile-open');
    if(!closedDrawer && replacement?.getClientRects().length) replacement.focus({preventScroll:true});
  });
}

function buildFormatToggles(){
  const container = document.getElementById('format-toggles');
  container.innerHTML = "";
  const collectorChip = document.createElement('div');
  collectorChip.className = 'toggle-chip' + (state.collector ? ' active' : '');
  collectorChip.tabIndex = 0;
  setFilterAccessibility(collectorChip, state.collector);
  collectorChip.innerHTML = `<span class="toggle-chip-label">${FORMAT_ICON_STAR}<span>Collector</span></span>`;
  collectorChip.onclick = () => { state.collector = !state.collector; buildFormatToggles(); render(); };
  container.appendChild(collectorChip);
  const japaneseChip = document.createElement('div');
  japaneseChip.className = 'toggle-chip' + (state.japanese ? ' active' : '');
  japaneseChip.tabIndex = 0;
  setFilterAccessibility(japaneseChip, state.japanese);
  japaneseChip.innerHTML = '<span class="toggle-chip-label"><span class="japanese-flag" aria-hidden="true"></span><span>Japonais</span></span>';
  japaneseChip.onclick = () => { state.japanese = !state.japanese; buildFormatToggles(); render(); };
  container.appendChild(japaneseChip);
}

function buildStatusToggles(){
  const container = document.getElementById('status-toggles');
  container.innerHTML = "";
  STATUS_OPTIONS.forEach(s => {
    const chip = document.createElement('div');
    const isActive = state.status === s.key;
    chip.className = 'toggle-chip status-chip' + (isActive ? ' active' : '');
    chip.tabIndex = 0;
  setFilterAccessibility(chip, isActive);
    chip.innerHTML = `<span class="toggle-chip-label"><span class="status-chip-icon" style="color:${s.color}">${s.icon}</span><span>${s.label}</span></span>`;
    if(isActive){
      chip.style.borderColor = s.border;
      chip.style.background = s.bg;
    }
    chip.onclick = () => { state.status = (state.status === s.key ? null : s.key); buildStatusToggles(); render(); };
    container.appendChild(chip);
  });

  const noneChip = document.createElement('div');
  const noneActive = state.status === '__none__';
  noneChip.className = 'toggle-chip status-chip' + (noneActive ? ' active' : '');
  noneChip.tabIndex = 0;
  setFilterAccessibility(noneChip, noneActive);
  noneChip.innerHTML = `<span class="toggle-chip-label"><span class="status-chip-icon" style="color:var(--muted)">—</span><span>Sans statut</span></span>`;
  if(noneActive){
    noneChip.style.borderColor = 'var(--hairline)';
    noneChip.style.background = 'var(--surface-raised)';
  }
  noneChip.onclick = () => { state.status = (state.status === '__none__' ? null : '__none__'); buildStatusToggles(); render(); };
  container.appendChild(noneChip);
}

function getEffectiveStatus(g){
  return g.status === 'en_cours' ? 'a_jouer' : g.status;
}

function filteredGames(){
  const q = state.search.trim().toLowerCase();
  return collectionCardsForFilters(q).filter(g => {
      if(state.platform && g.plateforme !== state.platform) return false;
      if(state.collector && !g.collector) return false;
      if(state.japanese && !g.japanese) return false;
      if(q && !g.nom.toLowerCase().includes(q)) return false;
      if(state.status){
        if(state.status === '__none__'){
          if(getEffectiveStatus(g)) return false;
        } else if(getEffectiveStatus(g) !== state.status){
          return false;
        }
      }
      return true;
    });
}

function sortGames(games){
  const arr = [...games];
  switch(state.sort){
    case 'name-asc': arr.sort((a,b) => a.nom.localeCompare(b.nom)); break;
    case 'name-desc': arr.sort((a,b) => b.nom.localeCompare(a.nom)); break;
    case 'price-desc': arr.sort((a,b) => (b.prix ?? -1) - (a.prix ?? -1)); break;
    case 'price-asc': arr.sort((a,b) => (a.prix ?? 999999) - (b.prix ?? 999999)); break;
    case 'date-desc': arr.sort((a,b) => (b.date || '').localeCompare(a.date || '')); break;
    case 'date-asc': arr.sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999')); break;
  }
  return arr;
}

function platformBandText(color){
  let hex=String(color).replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  if(!/^[0-9a-f]{6}$/i.test(hex)) return 'var(--ui-text)';
  const channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  return luminance>.179 ? '#111111' : '#ffffff';
}

// The compact context appears only once the full collection heading has left view.
let collectionContextFrame = null;
function requestCollectionContextUpdate(){
  if(collectionContextFrame !== null) return;
  collectionContextFrame = requestAnimationFrame(() => {
    collectionContextFrame = null;
    updateCollectionScrollContext();
  });
}
function updateCollectionScrollContext(){
  let context = document.getElementById('collection-scroll-context');
  if(!context){
    context = document.createElement('div');
    context.id = 'collection-scroll-context';
    context.className = 'collection-scroll-context hidden';
    context.setAttribute('role','region');
    context.setAttribute('aria-label','Collection filtrée');
    context.innerHTML = '<button type="button" class="collection-context-filters" aria-label="Ouvrir les filtres" aria-expanded="false" aria-controls="collection-sidebar"></button><span class="collection-context-icon" aria-hidden="true"></span><span class="collection-context-labels"><strong></strong><span class="collection-context-media"></span></span><span class="collection-context-count"></span>';
    context.querySelector('button').innerHTML = mobileFilterToggle.innerHTML;
    context.querySelector('button').addEventListener('click', () => mobileFilterToggle.click());
    document.getElementById('page-collection').appendChild(context);
  }
  if(navigationPage !== 'collection'){
    context.classList.add('hidden');
    return;
  }
  const banner = document.getElementById('platform-banner');
  const nav = document.querySelector('.topnav').getBoundingClientRect();
  const heading = banner.getBoundingClientRect();
  const top = Math.max(0, nav.bottom);
  const show = heading.bottom <= top;
  context.classList.toggle('hidden', !show);
  if(!show) return;
  const main = document.querySelector('#page-collection .main').getBoundingClientRect();
  context.style.top = top + 'px';
  context.style.left = main.left + 'px';
  context.style.width = main.width + 'px';
  context.style.setProperty('--platform-accent',state.platform ? getPlatformColor(state.platform) : 'var(--ui-accent)');
  context.style.setProperty('--platform-band-text',state.platform ? platformBandText(getPlatformColor(state.platform)) : 'var(--ui-text)');
  context.classList.toggle('platform-filtered',!!state.platform);
  const iconHtml=banner.querySelector('.platform-banner-logo,.platform-banner-fallback')?.outerHTML || '';
  const icon=context.querySelector('.collection-context-icon');
  if(icon.innerHTML!==iconHtml) icon.innerHTML=iconHtml;
  context.querySelector('strong').textContent = state.platform || 'Tous les jeux';
  context.querySelector('.collection-context-media').innerHTML = collectionFilterLabel();
  const count = Number(banner.dataset.resultCount || 0);
  context.querySelector('.collection-context-count').textContent = count + (state.media && state.media !== 'physical' ? ' élément'+(count > 1 ? 's' : '') : count > 1 ? ' jeux' : ' jeu');
}
// Capture document and nested scrolling, including other views and drawers.
document.addEventListener('scroll', requestCollectionContextUpdate, {passive:true, capture:true});
window.addEventListener('resize', requestCollectionContextUpdate);

let collectionStatsOpen=false;
function renderPlatformBanner(cards){
  const games = collectionPurchases(cards);
  const banner = document.getElementById('platform-banner');
  if(!banner) return;

  banner.dataset.resultCount = games.length;
  requestCollectionContextUpdate();
  const total = games.length;
  const playableGames = games.filter(isPlayablePurchase);
  const spent = games.reduce((sum,g) => sum + ((g.currency || 'EUR') === 'EUR' ? (g.prix || 0) : 0), 0);
  const collectors = games.filter(g => g.collector).length;
  const platformsCount = new Set(games.map(g => g.plateforme)).size;
  const statIcons = {
    games:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/></svg>',
    platforms:ICON_STATUS_PLAYING,
    spent:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M16 7.5a5 5 0 1 0 0 9M6 10h8M6 14h7"/></svg>',
    collectors:FORMAT_ICON_STAR,
    physical:MEDIA_ICONS.physical, digital:MEDIA_ICONS.digital, japanese:ICON_EDITION_REGION,
    a_jouer:ICON_STATUS_TODO,
    termine:ICON_STATUS_DONE,
    multi:ICON_STATUS_MULTI
  };
  const stat = (value, label, key) =>
    `<span class="library-stat" data-stat="${key}"><strong>${value}</strong><span class="library-stat-label"><span class="library-stat-icon" aria-hidden="true">${statIcons[key] || ''}</span>${key === 'platforms' ? `<span class="library-stat-label-wide">${escapeHTML(label)}</span><span class="library-stat-label-short">${platformsCount > 1 ? 'Supports' : 'Support'}</span>` : escapeHTML(label)}</span></span>`;
  const collectionStats = [
    stat(total, state.media && state.media !== 'physical' ? 'Éléments' : total > 1 ? 'Jeux' : 'Jeu', 'games'),
    !state.platform ? stat(platformsCount, platformsCount > 1 ? 'Plateformes' : 'Plateforme', 'platforms') : '',
    stat(games.filter(g=>!JTDData.isDigital(g)).length,'Physique','physical'),
    stat(games.filter(g=>JTDData.isDigital(g)).length,'Numérique','digital'),
    collectors ? stat(collectors, collectors > 1 ? 'Collectors' : 'Collector', 'collectors') : '',
    games.some(g=>g.japanese) ? stat(games.filter(g=>g.japanese).length,'Éditions japonaises','japanese') : ''
  ].join('');
  const completionStats = [
    stat(playableGames.filter(g => !getEffectiveStatus(g) || getEffectiveStatus(g)==='a_jouer').length,'À faire','a_jouer'),
    stat(playableGames.filter(g => g.status==='termine' || g.status==='termine_ailleurs').length,'Terminés','termine'),
    stat(playableGames.filter(g => g.status==='multi').length,'Multi','multi')
  ].join('');
  const statsHtml = `<section class="library-stat-group" aria-labelledby="collection-stats-title">
    <h3 id="collection-stats-title">Collection</h3><div class="library-stat-values library-collection-values">${collectionStats}</div>
    </section><section class="library-stat-group" aria-labelledby="completion-stats-title">
    <h3 id="completion-stats-title">${playableGames.some(JTDData.isDLC) ? 'Complétion des jeux et DLC' : 'Complétion'}</h3><div class="library-stat-values library-completion-values">${completionStats}</div></section><section class="library-stat-group library-value-group" aria-label="Valeur des achats">${stat(collectionValueLabel(games, spent), 'Valeur', 'spent')}</section>`;

  const detailsHtml=`<details class="collection-stat-details" ${collectionStatsOpen ? 'open' : ''}><summary><strong>${total} ${total > 1 ? 'Éléments' : 'Élément'}</strong><span>Détails<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></summary><div class="platform-banner-stats">${statsHtml}</div></details>`;
  if(!state.platform){
    banner.classList.remove('hidden');
    banner.classList.add('neutral');
    banner.style.background = '';
    banner.style.color = '';
    banner.style.setProperty('--platform-accent','var(--teal)');
    banner.innerHTML = `
      <div class="platform-banner-head">
        <span class="platform-banner-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12a4 4 0 0 1 3.7 5.5l-1.2 3a2 2 0 0 1-3.2.8L15 15H9l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.2-3A4 4 0 0 1 6 8Z"></path><path d="M7 12h4M9 10v4"></path><circle cx="16.5" cy="11.5" r=".7" fill="currentColor" stroke="none"></circle><circle cx="18.5" cy="13.5" r=".7" fill="currentColor" stroke="none"></circle></svg></span>
        <div><span class="platform-banner-title">Tous les jeux</span></div>
      </div>
      ${detailsHtml}
    `;
    banner.querySelector('details > summary').addEventListener('click',()=>{collectionStatsOpen=!banner.querySelector('details').open;});
  banner.querySelector('details').addEventListener('toggle',event=>{if(event.target.isConnected) collectionStatsOpen=event.target.open;});
    renderCollectionFilterContext(banner);
    if(navigationPage === 'collection') banner.querySelector('.platform-banner-head').prepend(mobileFilterToggle);
    return;
  }

  const color = getPlatformColor(state.platform);
  const logo = getPlatformLogo(state.platform);
  const initials = state.platform.slice(0,2).toUpperCase();
  banner.classList.remove('hidden', 'neutral');
  banner.style.background = '';
  banner.style.color = '';
  banner.style.setProperty('--platform-accent',color);
  banner.style.setProperty('--platform-band-text',platformBandText(color));
  const logoHtml = logo
    ? `<img class="platform-banner-logo" src="${escapeHTML(safeURL(logo, true))}" alt="">`
    : `<span class="platform-banner-fallback">${escapeHTML(initials)}</span>`;
  banner.innerHTML = `
    <div class="platform-banner-head">${logoHtml}<div><span class="platform-banner-title">${escapeHTML(state.platform)}</span></div></div>
    ${detailsHtml}
  `;
  banner.querySelector('details > summary').addEventListener('click',()=>{collectionStatsOpen=!banner.querySelector('details').open;});
  banner.querySelector('details').addEventListener('toggle',event=>{if(event.target.isConnected) collectionStatsOpen=event.target.open;});
  renderCollectionFilterContext(banner);
  if(navigationPage === 'collection') banner.querySelector('.platform-banner-head').prepend(mobileFilterToggle);
}

function renderCard(g, options = {}){
  const color = getPlatformColor(g.plateforme);
  const logo = getPlatformLogo(g.plateforme);

  const card = document.createElement('div');
  card.className = 'card' + (g.collector ? ' collector' : '');
  card.dataset.dialogTrigger = (options.readOnly ? 'sale:' : 'game:') + g.id;
  card.style.setProperty('--spine', color);

  const activeStatus = STATUS_OPTIONS.find(s => s.key === getEffectiveStatus(g));
  const statusIcon = activeStatus ? activeStatus.icon : '<span class="card-status-empty-dot"></span>';
  const statusTitle = activeStatus ? activeStatus.label : 'Définir le statut';
  const statusColor = activeStatus ? activeStatus.color : 'var(--muted)';
  const statusFill = activeStatus ? activeStatus.fill : 'var(--muted)';
  const statusMenu = STATUS_OPTIONS.map(s => `
    <button type="button" class="card-status-option${g.status === s.key ? ' active' : ''}" data-status="${s.key}" style="--option-color:${s.color};" title="${s.label}" aria-label="${s.label}">
      ${s.icon}<span>${s.label}</span>
    </button>`).join('');

  const statusBadgeHtml = `<div class="card-status-control">
      <button type="button" class="card-status-badge" style="--status-color:${statusColor};--status-fill:${statusFill};" title="${statusTitle}" aria-label="Statut : ${statusTitle}" aria-expanded="false">
        ${statusIcon}<span class="card-status-label">${activeStatus ? activeStatus.label : 'Statut'}</span>
      </button>
      <div class="card-status-menu hidden">${statusMenu}</div>
    </div>`;

  const collectorTitleHtml = g.collector
    ? `<span class="card-title-collector" title="Édition collector" aria-label="Édition collector">${FORMAT_ICON_STAR}</span>`
    : '';

  const bannerInner = g.image
    ? gameImageHtml(g, g.nom)
    : '';

  const bannerHtml = `<div class="card-banner${gameImageClass(g)}${g.image ? '' : ' placeholder'}">
      ${bannerInner}
      <span class="card-fallback${g.image ? ' hidden' : ''}">${escapeHTML(g.plateforme.slice(0,2).toUpperCase())}</span>
    </div>`;

  const platformHtml = `${logo
    ? `<img class="mini-logo" src="${escapeHTML(safeURL(logo, true))}" alt="">`
    : `<span class="dot" style="--spine:${color}"></span>`}<span>${escapeHTML(g.plateforme)}</span>`;

  // Only expose the acquisition value that explains the collection's active sort.
  // Sale cards keep their own metadata and must not inherit collection sorting.
  let acquisitionHtml = '';
  if(options.readOnly){
    const bits = [];
    if(g.source) bits.push(`<span class="card-source" title="${escapeHTML(g.source)}">${escapeHTML(g.source)}</span>`);
    if(g.prix != null) bits.push(`<span class="card-price">${euros(g.prix)}</span>`);
    const dateHtml = g.date ? `<time class="card-purchase-date" datetime="${escapeHTML(g.date)}" title="Date d'achat">${escapeHTML(dateFR(g.date))}</time>` : '';
    if(dateHtml || bits.length) acquisitionHtml = `<div class="card-acquisition">${dateHtml}${bits.length ? `<div class="card-purchase">${bits.join('')}</div>` : ''}</div>`;
  } else if(state.sort.startsWith('price-')){
    acquisitionHtml = `<div class="card-acquisition"><span class="card-sort-label">Prix d'achat</span><span class="card-price">${g.prix != null ? euros(g.prix) : 'Non renseigné'}</span></div>`;
  } else if(state.sort.startsWith('date-')){
    const dateHtml = g.date
      ? `<time class="card-purchase-date" datetime="${escapeHTML(g.date)}">${escapeHTML(dateFR(g.date))}</time>`
      : '<span class="card-purchase-date">Non renseignée</span>';
    acquisitionHtml = `<div class="card-acquisition"><span class="card-sort-label">Date d'achat</span>${dateHtml}</div>`;
  }

  card.innerHTML = `
    ${bannerHtml}
    <div class="card-body">
      <div class="card-name" title="${escapeHTML(g.nom)}">${collectorTitleHtml}${japaneseEditionMark(g)}<span class="card-name-text">${escapeHTML(g.nom)}</span></div>
      <div class="card-summary card-identity">
        <span class="card-platform">${platformHtml}</span>
        ${statusBadgeHtml}
      </div>
      ${acquisitionHtml}
    </div>
  `;

  if(options.readOnly){
    const control = card.querySelector('.card-status-control');
    if(activeStatus) control.innerHTML = '<span class="card-status-badge" style="--status-color:' + statusColor + ';--status-fill:' + statusFill + ';">' + statusIcon + '<span class="card-status-label">' + escapeHTML(activeStatus.label) + '</span></span>';
    else control.remove();
  } else {
  const badge = card.querySelector('.card-status-badge');
  const menu = card.querySelector('.card-status-menu');
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willOpen);
    badge.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  menu.querySelectorAll('.card-status-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setStatus(g.id, btn.dataset.status);
    });
  });
  }
  if(!options.readOnly){
    const detail=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
    const digital=JTDData.isDigital(g);
    const details=document.createElement('dl');details.className='card-list-details';
    details.innerHTML=detail('Support',digital ? 'Numérique' : 'Physique')+detail('Prix',g.prix != null ? escapeHTML(purchaseMoney(g)) : '—')+detail('Date d’achat',g.date ? escapeHTML(dateFR(g.date)) : '—')+detail(digital ? 'Compte' : 'Enseigne',digital ? escapeHTML(accountName(g.accountId)) : escapeHTML(g.source || '—'));
    card.querySelector('.card-body').appendChild(details);
  }
  decorateDigitalCard(card, g, options);
  if(!options.readOnly){
    const identity = card.querySelector('.card-identity');
    const platformLine = document.createElement('div');platformLine.className='card-platform-line';
    identity.querySelectorAll('.card-platform,.card-status-control').forEach(el=>platformLine.appendChild(el));
    identity.prepend(platformLine);
    const footer = document.createElement('div');footer.className='card-state-row';
    for(const selector of ['.card-media-mark','.card-console-account','.card-dlc-count']){
      const element=card.querySelector(selector);
      if(element) footer.appendChild(element);
    }
    if(footer.childNodes.length) identity.appendChild(footer);
  }
  const onOpen = options.onOpen || (() => openModal(g.id));
  card.addEventListener('click', onOpen);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', (options.onOpen ? 'Modifier la vente de ' : 'Ouvrir la fiche de ') + g.nom);
  card.addEventListener('keydown', event => {
    if(event.target===card && (event.key === 'Enter' || event.key === ' ')){ event.preventDefault(); onOpen(); }
  });
  return card;
}

function renderResultsBar(count){
  const bar = document.getElementById('results-bar');
  if(!bar) return;

  const filters = [];
  if(state.platform) filters.push(state.platform);
  if(state.contentType) filters.push(contentFilterLabel());
  if(state.collector) filters.push('⭐ Collector');
  if(state.japanese) filters.push({label:'Japonais', japanese:true});
  if(state.status){
    const s = STATUS_OPTIONS.find(x => x.key === state.status);
    filters.push(state.status === '__none__' ? 'Sans statut' : (s ? s.label : state.status));
  }
  if(state.search.trim()) filters.push(`« ${state.search.trim()} »`);

  let html = `<span class="results-count">${count} ${state.media && state.media !== 'physical' ? 'élément'+(count > 1 ? 's' : '') : 'jeu'+(count > 1 ? 'x' : '')}</span>`;
  if(filters.length){
    html += `<span class="results-filters">${filters.map(f => `<b>${f.japanese ? '<span class="japanese-flag" aria-hidden="true"></span> ' : ''}${escapeHTML(typeof f === 'string' ? f : f.label)}</b>`).join(' · ')}</span>`;
    html += `<button type="button" class="results-reset-btn" id="results-reset-btn">Réinitialiser</button>`;
  }
  bar.innerHTML = html;
  const resetBtn = document.getElementById('results-reset-btn');
  if(resetBtn) resetBtn.addEventListener('click', () => document.getElementById('reset-btn').click());
}

let collectionView = 'cards';
try { const saved=localStorage.getItem('regal:collection-view');if(['cards','gallery','list'].includes(saved)) collectionView=saved; } catch(error) {}
document.getElementById('collection-view-switch').addEventListener('click',event=>{
  const button=event.target.closest('[data-view]');if(!button)return;
  collectionView=button.dataset.view;
  try { localStorage.setItem('regal:collection-view',collectionView); } catch(error) {}
  render();
});
function syncCollectionView(){
  document.querySelectorAll('#collection-view-switch [data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===collectionView)));
}

function render(){
  syncCollectionView();
  renderMediaControls();
  persistNavigation();
  const games = sortGames(filteredGames());
  renderPlatformBanner(games);
  renderResultsBar(collectionPurchases(games).length);

  const grid = document.getElementById('grid');
  grid.innerHTML = "";
  grid.dataset.view = collectionView;

  renderHomeStats();
  if(games.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.gridColumn = '1 / -1';
    empty.innerHTML = GAMES.length === 0
      ? '<div class="big">Ta collection est vide</div>Ajoute ton premier jeu avec « Ajouter un jeu ».'
      : `<div class="big">Aucun jeu ne correspond</div>Essaie d'élargir tes filtres ou ta recherche.`;
    grid.appendChild(empty);
    return;
  }

  games.forEach(g => grid.appendChild(renderCard(g)));
}

/* ---------- Modal ajout / édition ---------- */

function allPlatformNames(){
  const names = new Set([...GAMES,...ARRIVALS,...WISHLIST,...CEMETERY].map(g => g.plateforme));
  Object.keys(platformMeta).forEach(p => names.add(p));
  return [...names].sort();
}

/* ---------- Combo avec icône (plateforme) ---------- */
/* Le <select> natif reste la source de vérité (valeur, focus clavier, formulaire) ;
   on l'habille visuellement d'un déclencheur + liste custom pour pouvoir y afficher
   des logos de plateforme, ce qu'un <select> natif
   ne permet pas. */

const iconSelectRegistry = {};

function getPlatformOptionIconHtml(name){
  const color = getPlatformColor(name);
  const logo = getPlatformLogo(name);
  return logo
    ? `<img class="icon-select-icon" src="${escapeHTML(safeURL(logo, true))}" alt="">`
    : `<span class="icon-select-dot" style="background:${color}"></span>`;
}

function japaneseEditionMark(item){
  return item && item.japanese
    ? '<span class="japanese-edition-mark japanese-flag" title="Édition japonaise" aria-label="Édition japonaise"></span>'
    : '';
}

const ICON_EDITION_REGION = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></svg>`;
const FORMAT_ICON_STAR = `<svg class="format-icon star-icon icon-select-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" title="Collector"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

function iconSelectify(selectId, getIcon){
  iconSelectRegistry[selectId] = { getIcon };
  const select = document.getElementById(selectId);
  if(!select || select.dataset.iconified){
    rebuildIconSelectList(selectId);
    syncIconSelectTrigger(selectId);
    return;
  }
  select.dataset.iconified = '1';

  const wrap = document.createElement('div');
  wrap.className = 'icon-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icon-select-trigger';
  wrap.appendChild(trigger);

  const list = document.createElement('div');
  list.className = 'icon-select-list hidden';
  wrap.appendChild(list);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = list.classList.contains('hidden');
    document.querySelectorAll('.icon-select-list').forEach(l => l.classList.add('hidden'));
    if(willOpen) list.classList.remove('hidden');
  });
  document.addEventListener('click', (e) => {
    if(!wrap.contains(e.target)) list.classList.add('hidden');
  });

  select.addEventListener('change', () => syncIconSelectTrigger(selectId));

  rebuildIconSelectList(selectId);
  syncIconSelectTrigger(selectId);
}

function rebuildIconSelectList(selectId){
  const cfg = iconSelectRegistry[selectId];
  const select = document.getElementById(selectId);
  if(!cfg || !select) return;
  const wrap = select.closest('.icon-select-wrap');
  if(!wrap) return;
  const list = wrap.querySelector('.icon-select-list');
  list.innerHTML = '';
  Array.from(select.options).forEach(opt => {
    const row = document.createElement('div');
    row.className = 'icon-select-option';
    row.innerHTML = `${cfg.getIcon(opt.value)}<span>${escapeHTML(opt.textContent)}</span>`;
    row.onclick = () => {
      select.value = opt.value;
      select.dispatchEvent(new Event('change'));
      list.classList.add('hidden');
    };
    list.appendChild(row);
  });
}

function syncIconSelectTrigger(selectId){
  const cfg = iconSelectRegistry[selectId];
  const select = document.getElementById(selectId);
  if(!cfg || !select) return;
  const wrap = select.closest('.icon-select-wrap');
  if(!wrap) return;
  const trigger = wrap.querySelector('.icon-select-trigger');
  const val = select.value;
  const opt = select.options[select.selectedIndex];
  const label = opt ? opt.textContent : 'Choisir...';
  trigger.innerHTML = `${cfg.getIcon(val)}<span class="icon-select-trigger-label">${escapeHTML(label)}</span><svg class="icon-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
}

function populatePlatformSelect(selectId){
  const select = document.getElementById(selectId);
  if(!select) return;
  let platforms = allPlatformNames();
  const current = select.value;
  select.innerHTML = platforms.map(p => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('');
  if(current && platforms.includes(current)) select.value = current;
  else if(platforms.length) select.value = platforms[0];
  rebuildIconSelectList(selectId);
  syncIconSelectTrigger(selectId);
}

function setSelectValueAndSync(selectId, value){
  const select = document.getElementById(selectId);
  if(!select) return;
  select.value = value;
  syncIconSelectTrigger(selectId);
}

function getLastUsed(key, fallback){
  try {
    const v = accountStorage.getItem('jtd-last-'+key);
    return (v !== null && v !== '') ? v : fallback;
  } catch(e){ return fallback; }
}
function setLastUsed(key, value){
  try { accountStorage.setItem('jtd-last-'+key, value); } catch(e){}
}

/* One image treatment for cards, board thumbnails and editing previews. */
function gameImageHtml(item, alt = '', board = false){
  const url = safeURL(item?.image, true);
  if(!url) return '';
  const src = escapeHTML(url);
  return `<img class="game-art-backdrop" src="${src}" alt="" aria-hidden="true" decoding="async"><img class="game-art-image" ${board ? 'data-board-art' : ''} src="${src}" alt="${escapeHTML(alt)}" decoding="async">`;
}
function gameImageClass(item){ return ' game-art-frame image-fit-' + (item?.imageFit === 'cover' ? 'cover' : 'contain'); }

function identitySummaryHtml(item){
  const name = item && item.nom ? item.nom : 'Jeu';
  const platform = item && item.plateforme ? item.plateforme : 'Plateforme';
  const image = item && item.image ? item.image : null;
  const color = getPlatformColor(platform);
  const logo = getPlatformLogo(platform);
  const thumb = image
    ? gameImageHtml(item)
    : escapeHTML(platform.slice(0,2).toUpperCase());
  const platformIcon = logo
    ? `<img src="${escapeHTML(safeURL(logo, true))}" alt="">`
    : `<span class="identity-platform-dot" style="background:${color}"></span>`;
  const collectorMark = item && item.collector
    ? `<span class="identity-collector" title="Édition collector" aria-label="Édition collector">${FORMAT_ICON_STAR}</span>`
    : '';
  return `
    <div class="identity-thumb${gameImageClass(item)}" style="${image ? '' : `background:${color}`}">${thumb}</div>
    <div class="identity-copy">
      <strong>${collectorMark}${japaneseEditionMark(item)}<span>${escapeHTML(name)}</span></strong>
      <span>${platformIcon}${escapeHTML(platform)}</span>
    </div>
    <button type="button" class="identity-edit-btn" title="Modifier les infos du jeu" aria-label="Modifier les infos du jeu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>
    </button>
  `;
}

function setIdentityEditor(prefix, item, compact){
  const summary = document.getElementById(prefix+'-identity-summary');
  const editor = document.getElementById(prefix+'-identity-editor');
  if(!summary || !editor) return;

  const showSummary = !!compact;
  summary.classList.toggle('hidden', !showSummary);
  editor.classList.toggle('hidden', showSummary);
  if(item) summary.innerHTML = identitySummaryHtml(item);

  const editBtn = summary.querySelector('.identity-edit-btn');
  if(editBtn){
    editBtn.addEventListener('click', () => {
      if(prefix === 'f') setGameSheetViewing(false);
      summary.classList.add('hidden');
      editor.classList.remove('hidden');
      const nameInput = editor.querySelector('input[type="text"]');
      if(nameInput) nameInput.focus();
    }, {once:true});
  }
}

function contextEditIcon(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>`;
}

function contextSummaryHtml(item, type){
  if(type === 'purchase'){
    const bits = [
      `<span><small>Prix payé</small><strong>${item.prix != null ? purchaseMoney(item) : '—'}</strong></span>`,
      `<span><small>Date d'achat</small><strong>${escapeHTML(item.date ? dateFR(item.date) : '—')}</strong></span>`,
      JTDData.isDigital(item) ? `<span><small>Compte</small><strong>${escapeHTML(accountName(item.accountId))}</strong></span>` : `<span><small>Source</small><strong>${escapeHTML(item.source || '—')}</strong></span>`
    ].join('');
    return `<div class="context-summary-values">${bits}</div><button type="button" class="context-edit-btn" title="Modifier l'achat" aria-label="Modifier l'achat">${contextEditIcon()}</button>`;
  }
  if(type === 'arrival'){
    const bits = [
      `<span><small>Livraison</small><strong>${escapeHTML(item.date ? dateFR(item.date) : '—')}</strong></span>`,
      `<span><small>Prix payé</small><strong>${item.prix != null ? euros(item.prix) : '—'}</strong></span>`,
      `<span><small>Source</small><strong>${escapeHTML(item.source || '—')}</strong></span>`
    ].join('');
    return `<div class="context-summary-values">${bits}</div><button type="button" class="context-edit-btn" title="Modifier l'arrivage" aria-label="Modifier l'arrivage">${contextEditIcon()}</button>`;
  }
  const parsed = parseWishlistDate(item.date);
  const dateLabel = parsed && parsed.label ? parsed.label : '—';
  const linkLabel = item.lien ? 'Lien renseigné' : 'Aucun lien';
  return `<div class="context-summary-values">
    <span><small>Sortie</small><strong>${escapeHTML(dateLabel)}</strong></span>
    <span><small>Lien</small><strong>${linkLabel}</strong></span>
  </div><button type="button" class="context-edit-btn" title="Modifier la wishlist" aria-label="Modifier la wishlist">${contextEditIcon()}</button>`;
}

function setContextEditor(prefix, item, type, compact){
  const summary = document.getElementById(prefix+'-context-summary');
  const editor = document.getElementById(prefix+'-context-editor');
  if(!summary || !editor) return;
  const showSummary = !!compact;
  summary.classList.toggle('hidden', !showSummary);
  editor.classList.toggle('hidden', showSummary);
  if(item) summary.innerHTML = contextSummaryHtml(item, type);
  const btn = summary.querySelector('.context-edit-btn');
  if(btn){
    btn.addEventListener('click', () => {
      if(prefix === 'f') setGameSheetViewing(false);
      summary.classList.add('hidden');
      editor.classList.remove('hidden');
      const first = editor.querySelector('input,select,button');
      if(first) first.focus();
    }, {once:true});
  }
}

function fillIdentityFields(prefix, item = {}){
  populatePlatformSelect(prefix+'-plateforme');
  document.getElementById(prefix+'-nom').value = item.nom || '';
  setSelectValueAndSync(prefix+'-plateforme', item.plateforme || '');
  document.getElementById(prefix+'-collector').checked = !!item.collector;
  document.getElementById(prefix+'-japanese').checked = !!item.japanese;
  document.getElementById(prefix+'-image').value = item.image || '';
  document.getElementById(prefix+'-image-fit').value = item.imageFit === 'cover' ? 'cover' : 'contain';
  updateImagePreviewFor(prefix+'-image', prefix === 'f' ? 'image-preview' : prefix+'-image-preview');
}
function readIdentityFields(prefix){
  return {
    nom:document.getElementById(prefix+'-nom').value.trim(),
    plateforme:document.getElementById(prefix+'-plateforme').value.trim(),
    collector:document.getElementById(prefix+'-collector').checked,
    japanese:document.getElementById(prefix+'-japanese').checked,
    image:safeURL(document.getElementById(prefix+'-image').value.trim(), true) || null,
    imageFit:document.getElementById(prefix+'-image-fit').value === 'cover' ? 'cover' : 'contain'
  };
}
function commitBoardTransfer(from, to, id, draft){
  if(to === 'cemetery' && JTDData.isDigital(draft)){ showToast('Seuls les jeux physiques peuvent être mis en vente.'); return null; }
  const lists = {games:GAMES, arrivals:ARRIVALS, wishlist:WISHLIST, cemetery:CEMETERY};
  const keys = {games:STORAGE_KEY, arrivals:ARRIVALS_KEY, wishlist:WISHLIST_KEY, cemetery:CEMETERY_KEY};
  try {
    const moved = JTDData.transferItem(lists[from], lists[to], id, draft);
    // Both local lists succeed before either list is replaced in memory.
    if(IS_PREVIEW_MODE) savePreviewData({...lists, [from]:moved.source, [to]:moved.target});
    else accountStorage.atomicWrite([
      [keys[from], JSON.stringify(moved.source)], [keys[to], JSON.stringify(moved.target)]
    ]);
    lists[from] = moved.source; lists[to] = moved.target;
    GAMES = lists.games; ARRIVALS = lists.arrivals; WISHLIST = lists.wishlist; CEMETERY = lists.cemetery;
    if(window.JTDDataChanged) window.JTDDataChanged();
    return moved.target.at(-1);
  } catch(error) {
    console.error('Transfert impossible', error);
    showToast('Transfert impossible. Tes listes sont conservées ; réessaie après avoir téléchargé une sauvegarde.');
    return null;
  }
}
function setGameSheetViewing(viewing){
  if(!viewing) setContextEditor('f',null,'purchase',false);
  document.getElementById('modal-overlay').classList.toggle('game-sheet-viewing', viewing);
  document.getElementById('cancel-btn').textContent = viewing ? 'Fermer' : 'Annuler';
}

function openModal(id, collection = 'games'){
  editingCollection = collection === 'cemetery' ? 'cemetery' : 'games';
  const items = editingCollection === 'cemetery' ? CEMETERY : GAMES;
  editingId = id || null;
  if(editingId && !items.some(game => game.id === editingId)) return;
  document.getElementById('f-sell-btn').classList.toggle('hidden', !editingId || editingCollection !== 'games');
  convertingArrivalId = null; // ouverture normale (pas une bascule depuis les arrivages)

  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('delete-btn');

  if(editingId){
    const g = items.find(x => x.id === editingId);
    title.textContent = editingCollection === 'cemetery' ? 'Modifier les infos du jeu' : 'Fiche du jeu';
    deleteBtn.classList.toggle('hidden', editingCollection === 'cemetery');
    document.getElementById('f-quick-hide-fields').classList.remove('hidden');
    document.getElementById('f-nom').value = g.nom || '';
    populatePlatformSelect('f-plateforme');
    setSelectValueAndSync('f-plateforme', g.plateforme);
    document.getElementById('f-collector').checked = !!g.collector;
  document.getElementById('f-japanese').checked = !!g.japanese;
    document.getElementById('f-prix').value = g.prix != null ? Number(g.prix).toFixed(g.currency === 'JPY' ? 0 : 2).replace('.',',') : '';
    document.getElementById('f-date').value = g.date || '';
    document.getElementById('f-source').value = g.source || '';
    document.getElementById('f-image').value = g.image || '';
  } else {
    title.textContent = 'Ajouter un jeu';
    deleteBtn.classList.add('hidden');
    document.getElementById('f-nom').value = '';
    populatePlatformSelect('f-plateforme');
    if(state.platform){
      setSelectValueAndSync('f-plateforme', state.platform);
    } else {
      const lastPlatform = getLastUsed('platform', '');
      if(lastPlatform) setSelectValueAndSync('f-plateforme', lastPlatform);
    }
    document.getElementById('f-collector').checked = false;
  document.getElementById('f-japanese').checked = false;
    document.getElementById('f-prix').value = '';
    document.getElementById('f-date').value = '';
    document.getElementById('f-source').value = '';
    document.getElementById('f-image').value = '';
  }
  document.getElementById('f-image-fit').value = editingId && items.find(x => x.id === editingId)?.imageFit === 'cover' ? 'cover' : 'contain';
  updateImagePreview();
  const identityItem = editingId ? items.find(x => x.id === editingId) : null;
  openDigitalFields(identityItem);
  setIdentityEditor('f', identityItem, !!editingId);
  setContextEditor('f', identityItem, 'purchase', !!editingId);
  document.getElementById('modal-overlay').classList.toggle('cemetery-game-editor', editingCollection === 'cemetery');
  setGameSheetViewing(!!editingId && editingCollection === 'games');
  document.getElementById('save-btn').textContent = editingId ? 'Enregistrer' : 'Ajouter';
  window.JTDDialogs.open('modal-overlay', {onDismiss:closeModal});
  if(!editingId) document.getElementById('f-nom').focus();
}

function closeModal(){
  document.getElementById('f-sell-btn').classList.add('hidden');
  document.getElementById('save-btn').textContent = 'Enregistrer';
  window.JTDDialogs.close('modal-overlay');
  setGameSheetViewing(false);
  document.getElementById('modal-overlay').classList.remove('cemetery-game-editor');
  editingId = null;
  editingCollection = 'games';
  convertingArrivalId = null; // annuler = l'arrivage reste où il était
  document.getElementById('f-content-details').replaceChildren();
}

function updateImagePreview(){
  updateImagePreviewFor('f-image', 'image-preview');
}

function saveModal(){
  const {nom, plateforme, collector, japanese, image, imageFit} = readIdentityFields('f');
  window.JTDDialogs.clearErrors(document.getElementById('modal-overlay'));
  if(!nom){ window.JTDDialogs.error('f-nom','Indique le nom du jeu.'); return; }
  if(!plateforme){ window.JTDDialogs.error('f-plateforme','Choisis une plateforme.'); return; }
  const prix = parsePriceInput(document.getElementById('f-prix').value);
  const date = document.getElementById('f-date').value || null;
  const source = document.getElementById('f-source').value.trim() || null;
  const fields = {nom, plateforme, prix, date, source, collector, japanese, image, imageFit};
  try { Object.assign(fields, readDigitalFields()); }
  catch(error){ window.JTDDialogs.error(error.field || 'f-parent',error.message); return; }
  const editedCemetery = editingCollection === 'cemetery' && !!editingId;
  const received = convertingArrivalId
    ? commitBoardTransfer('arrivals', 'games', convertingArrivalId, {...fields, format:'Physique', type:null, status:'a_jouer'})
    : null;
  if(convertingArrivalId && !received) return;
  if(editedCemetery){
    if(!window.updateCemeteryGame?.(editingId, fields)) return;
  } else if(!convertingArrivalId){
    const next = editingId
      ? GAMES.map(game => game.id === editingId ? {...game,...fields} : game)
      : [...GAMES,{id:crypto.randomUUID(),type:null,status:null,...fields}];
    if(!commitCollection(next)) return;
  } else renderArrivals();

  setLastUsed('platform', plateforme);
  const savedMedia = JTDData.isDigital(fields) ? 'digital' : 'physical';
  if(editingCollection === 'games' && state.media !== 'all') state.media = savedMedia;
  closeModal();
  buildPlatformList();
  render();
  if(editedCemetery){
    window.renderCemetery?.();
    showToast('Infos du jeu mises à jour.');
    return;
  }
  if(received) showToast(`« ${received.nom} » ajouté à la collection.`, 'Voir', () => {
    goToPage('collection');
    state.platform = received.plateforme;
    state.search = ''; document.getElementById('search-input').value = '';
    state.status = null; state.collector = false; state.japanese = false;
    buildPlatformList(); buildFormatToggles(); buildStatusToggles(); render();
  });
}

function deleteGame(){
  if(!editingId) return;
  const g = GAMES.find(x => x.id === editingId);
  if(!g) return;
  confirmAction(`Supprimer « ${g.nom} » de la ludothèque ?`, () => {
    const idx = GAMES.indexOf(g);
    if(!commitCollection(GAMES.filter(x => x.id !== editingId))) return;
    closeModal();
    buildPlatformList();
    render();
    showToast(`« ${g.nom} » supprimé`, 'Annuler', () => {
      const next = [...GAMES];
      next.splice(Math.min(idx, next.length), 0, g);
      if(!commitCollection(next)) return;
      buildPlatformList();
      render();
    });
  });
}

/* ---------- Accueil : Stats ---------- */

function renderHomeStats(){
  const games=GAMES.filter(g=>!JTDData.isAddon(g));
  const physical=games.filter(g=>!JTDData.isDigital(g));
  const digital=games.filter(g=>JTDData.isDigital(g));
  const total=games.length;
  const playable=GAMES.filter(isPlayablePurchase);
  const finished=playable.filter(g=>['termine','termine_ailleurs'].includes(g.status)).length;
  const multi=playable.filter(g=>g.status==='multi').length;
  const todo=playable.length-finished-multi;
  const totalEl=document.getElementById('home-total-games');if(totalEl) totalEl.textContent=total;
  const icon=(content)=>`<span class="stats-icon" aria-hidden="true">${content}</span>`;
  const row=(label,value,content='')=>`<div class="home-summary-stat">${content ? icon(content) : ''}<span>${label}</span><strong>${value}</strong></div>`;
  const meta=document.getElementById('home-summary-meta');
  const sums=new Map();GAMES.forEach(g=>{if(g.prix!=null)sums.set(g.currency || 'EUR',(sums.get(g.currency || 'EUR') || 0)+g.prix);});
  if(meta) meta.innerHTML=row('Physique',physical.length,MEDIA_ICONS.physical)+row('Numérique',digital.length,MEDIA_ICONS.digital)+row('Plateformes',new Set(games.map(g=>g.plateforme)).size,ICON_STATUS_PLAYING)+row('Collectors',physical.filter(g=>g.collector).length,FORMAT_ICON_STAR)+row('Éditions japonaises',physical.filter(g=>g.japanese).length,ICON_EDITION_REGION)+row('DLC et mises à niveau',GAMES.filter(g=>JTDData.isAddon(g)).length,MEDIA_ICONS.dlc)+`<div class="home-value-stat"><span>Valeur d’achat</span><strong>${[...sums].map(([currency,prix])=>`<span>${escapeHTML(purchaseMoney({currency,prix}))}</span>`).join('') || '—'}</strong></div>`;
  const ring=document.getElementById('home-completion-ring');
  if(ring){const done=playable.length ? finished/playable.length*100 : 0, shared=playable.length ? multi/playable.length*100 : 0;
    ring.style.background=playable.length ? `conic-gradient(var(--status-done) 0 ${done}%,var(--status-multi) ${done}% ${done+shared}%,var(--ui-border) ${done+shared}% 100%)` : 'var(--ui-border)';
    ring.setAttribute('aria-label',`${finished} jeux et DLC terminés, ${multi} multijoueurs et ${todo} à faire sur ${playable.length}`);
    ring.querySelector('strong').textContent=Math.round(done)+' %';
  }
  const legend=document.getElementById('home-status-legend');
  if(legend) legend.innerHTML=`<span><i class="completion-dot done"></i>Terminés<strong>${finished}</strong></span><span><i class="completion-dot multi"></i>Multi<strong>${multi}</strong></span><span><i class="completion-dot todo"></i>À faire<strong>${todo}</strong></span>`;
}

/* ---------- Accueil : Arrivages & Wishlist ---------- */


function boardThumb(item){
  const initials = (item.plateforme || item.nom || '??').slice(0,2).toUpperCase();
  const logo = getPlatformLogo(item.plateforme);
  const color = getPlatformColor(item.plateforme);
  const fallback = logo
    ? `<img src="${escapeHTML(logo)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;">`
    : `<span style="color:${color};font-weight:700;">${escapeHTML(initials)}</span>`;
  const image = safeURL(item.image, true);
  return `<div class="board-thumb${gameImageClass(item)}"><span class="board-image-fallback${image ? ' hidden' : ''}">${fallback}</span>${image ? gameImageHtml(item, '', true) : ''}</div>`;
}

function calendarDayHtml(date, opts = {}){
  const raw = String(date || '').trim();
  const exact = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(exact){
    const d = new Date(Number(exact[1]), Number(exact[2]) - 1, Number(exact[3]));
    const weekday = d.toLocaleDateString('fr-FR', {weekday:'short'}).replace('.', '');
    const monthIndex = d.getMonth();
    return `<div class="calendar-day${opts.released ? ' released' : ''}" style="--calendar-day-bg:${MONTH_DATE_COLORS[monthIndex]};--calendar-day-ink:${MONTH_DATE_TEXT_COLORS[monthIndex]}">
      <strong>${Number(exact[3])}</strong><span>${weekday}</span>
    </div>`;
  }
  const parsed = parseWishlistDate(raw);
  const label = parsed.label || '—';
  return `<div class="calendar-day calendar-day-loose"><strong>${escapeHTML(label)}</strong></div>`;
}

function calendarGroupHtml(label, year, color, loose = false){
  return `<div class="calendar-group-head${loose ? ' calendar-group-head-loose' : ''}"${color ? ` style="--calendar-accent:${color};--calendar-ink:${MONTH_TEXT_COLORS[MONTH_COLORS.indexOf(color)]}"` : ''}>
    <div class="calendar-group-title">
      <strong>${escapeHTML(label)}</strong>
      ${year ? `<span>${year}</span>` : ''}
    </div>
  </div>`;
}

function arrivalRowHtml(item){
  const color = getPlatformColor(item.plateforme);
  const logo = getPlatformLogo(item.plateforme);
  const platIconHtml = logo
    ? `<img class="mini-logo-sm" src="${escapeHTML(safeURL(logo, true))}" alt="">`
    : `<span class="dot"></span>`;
  const purchaseBits = [];
  if(item.source) purchaseBits.push(`<span class="arrival-source" title="${escapeHTML(item.source)}">${escapeHTML(item.source)}</span>`);
  if(item.prix != null) purchaseBits.push(`<span class="arrival-price">${euros(item.prix)}</span>`);
  const purchaseHtml = purchaseBits.length
    ? `<div class="arrival-purchase">${purchaseBits.join('<span class="arrival-meta-sep">·</span>')}</div>`
    : '';
  return `
    <div class="board-row" data-id="${escapeHTML(item.id)}" draggable="true" style="--spine:${color}">
      ${calendarDayHtml(item.date)}
      ${boardThumb(item)}
      <div class="board-info">
        <div class="board-name" title="${escapeHTML(item.nom)}">${item.collector ? `<span class="board-collector-star" title="Édition collector">${FORMAT_ICON_STAR}</span>` : ''}${japaneseEditionMark(item)}<span>${escapeHTML(item.nom)}</span></div>
        <div class="board-plat">${platIconHtml}${escapeHTML(item.plateforme)}</div>
      </div>
      ${purchaseHtml}
    </div>`;
}

function renderArrivals(){
  const container = document.getElementById('arrivals-rows');
  if(!container) return;
  container.innerHTML = "";

  renderHomeStats();
  wireArrivalsDropZone();

  if(ARRIVALS.length === 0){
    container.innerHTML = `<div class="board-empty">Aucun jeu en précommande pour l'instant.</div>`;
    return;
  }

  const sorted = [...ARRIVALS].sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));

  const groups = [];
  const groupMap = new Map();
  sorted.forEach(item => {
    const rawDate = String(item.date || '');
    const m = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const key = m ? `${m[1]}-${m[2]}` : '__none__';
    const monthIndex = m ? parseInt(m[2], 10) - 1 : null;
    const group = {
      key,
      label: m ? MONTH_NAMES_FULL[monthIndex] : 'Sans date',
      year: m ? m[1] : '',
      color: m ? MONTH_COLORS[monthIndex] : null,
      loose: !m,
      items: []
    };
    if(!groupMap.has(key)){
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).items.push(item);
  });

  container.innerHTML = groups.map(g => `
    <section class="calendar-group${g.loose ? ' calendar-group-loose' : ''}">
      ${calendarGroupHtml(g.label, g.year, g.color, g.loose)}
      <div class="calendar-items">${g.items.map(arrivalRowHtml).join('')}</div>
    </section>
  `).join('');

  container.querySelectorAll('.board-row').forEach(row => {
    const id = row.dataset.id;
    row.tabIndex = 0;
    row.setAttribute('role','button');
    row.setAttribute('aria-label','Modifier cet arrivage');
    row.dataset.dialogTrigger = 'arrival:'+id;
    row.addEventListener('keydown',event=>{
      if(event.target===row && (event.key==='Enter' || event.key===' ')){event.preventDefault();openArrivalModal(id);}
    });
    row.addEventListener('click', () => openArrivalModal(id));
    row.addEventListener('dragstart', () => {
      homeDragArrivalId = id;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      homeDragArrivalId = null;
      const zone = document.querySelector('.board.wishlist');
      if(zone) zone.classList.remove('drag-over');
    });
  });
}

let homeDragWishlistId = null;
let homeDragArrivalId = null;

function wireArrivalsDropZone(){
  const zone = document.getElementById('arrivals-board');
  if(!zone) return;
  zone.ondragover = (e) => {
    if(!homeDragWishlistId) return;
    e.preventDefault();
    zone.classList.add('drag-over');
  };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if(homeDragWishlistId) moveWishlistToArrivals(homeDragWishlistId);
    homeDragWishlistId = null;
  };
}

function wireWishlistDropZone(){
  const zone = document.querySelector('.board.wishlist');
  if(!zone) return;
  zone.ondragover = (e) => {
    if(!homeDragArrivalId) return;
    e.preventDefault();
    zone.classList.add('drag-over');
  };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if(homeDragArrivalId) moveArrivalToWishlist(homeDragArrivalId);
    homeDragArrivalId = null;
  };
}

function parseWishlistDate(str){
  const s = (str || '').trim();
  if(!s) return { priority:4, key:'zzz', label:'—' };

  // Date ISO : AAAA-MM-JJ
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m){
    const iso = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return { priority:0, key:iso, label:dateFR(iso) };
  }
  // Date JJ/MM/AAAA
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    const iso = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return { priority:0, key:iso, label:`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}` };
  }
  // Date JJ/MM (année manquante) : on la considère plus précise qu'une simple année,
  // donc juste après les dates complètes et avant les années.
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(m){
    return { priority:1, key:`${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, label:`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}` };
  }
  // Année seule : AAAA
  m = s.match(/^(\d{4})$/);
  if(m) return { priority:2, key:m[1], label:m[1] };

  // Tout le reste (TBD, texte libre...)
  return { priority:3, key:s.toLowerCase(), label:s };
}

function wishlistGroupInfo(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0){
    const [y, m] = parsed.key.split('-');
    const mi = parseInt(m, 10) - 1;
    return { key:`${y}-${m}`, label:`${MONTH_NAMES_FULL[mi]} ${y}`, color: MONTH_COLORS[mi], order:0 };
  }
  if(parsed.priority === 1){
    const m = parsed.key.split('-')[0];
    const mi = parseInt(m, 10) - 1;
    return { key:`month-${m}`, label:MONTH_NAMES_FULL[mi], color: MONTH_COLORS[mi], order:1 };
  }
  if(parsed.priority >= 2){
    return { key:'__none__', label:'Sans date', color:null, order:2, loose:true };
  }
  return { key:'__none__', label:'Sans date', color:null, order:2, loose:true };
}

function wishlistIsReleased(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0) return parsed.key <= new Date().toISOString().slice(0,10);
  return false;
}

function comparePendingWishlistItems(a, b){
  const ga = wishlistGroupInfo(a.date), gb = wishlistGroupInfo(b.date);
  if(ga.order !== gb.order) return ga.order - gb.order;
  if(ga.key !== gb.key) return ga.key.localeCompare(gb.key);
  const da = parseWishlistDate(a.date), db = parseWishlistDate(b.date);
  return da.priority - db.priority || da.key.localeCompare(db.key) || (a.nom || '').localeCompare(b.nom || '');
}

function renderWishlist(){
  const container = document.getElementById('wishlist-rows');
  if(!container) return;
  container.innerHTML = "";

  renderHomeStats();
  wireWishlistDropZone();

  if(WISHLIST.length === 0){
    container.innerHTML = `<div class="board-empty">La wishlist est vide pour l'instant.</div>`;
    return;
  }

  function makeWishlistRow(item, released){
    const color = getPlatformColor(item.plateforme);
    const logo = getPlatformLogo(item.plateforme);
    const platIconHtml = logo
      ? `<img class="mini-logo-sm" src="${escapeHTML(safeURL(logo, true))}" alt="">`
      : `<span class="dot"></span>`;
    const row = document.createElement('div');
    row.className = 'board-row' + (released ? ' wishlist-row-released' : '');
    row.dataset.id = item.id;
    row.style.setProperty('--spine', color);
    row.draggable = true;
    row.title = 'Glisse ce jeu vers les Arrivages pour le basculer';
    const linkHtml = safeURL(item.lien)
      ? `<a class="board-link" href="${escapeHTML(safeURL(item.lien))}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(item.lien)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h5v5"></path><path d="m10 14 10-10"></path><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"></path></svg><span>Voir le lien</span></a>`
      : '';
    const parsedDate = parseWishlistDate(item.date);
    const releaseDateHtml = item.date
      ? `<span class="wishlist-release-date" title="Date de sortie">${escapeHTML(parsedDate.label)}</span>`
      : '';
    row.innerHTML = `
      ${boardThumb(item)}
      <div class="board-info">
        <div class="board-name" title="${escapeHTML(item.nom)}">${item.collector ? `<span class="board-collector-star" title="Édition collector">${FORMAT_ICON_STAR}</span>` : ''}${japaneseEditionMark(item)}<span>${escapeHTML(item.nom)}</span></div>
        <div class="board-plat">${platIconHtml}<span>${escapeHTML(item.plateforme)}</span>${releaseDateHtml}</div>
      </div>
      ${linkHtml}
    `;
    row.addEventListener('click', (e) => {
      if(e.target.closest('.board-link')) return;
      openWishlistModal(item.id);
    });
    row.tabIndex = 0;
    row.setAttribute('role','button');
    row.setAttribute('aria-label','Modifier '+item.nom);
    row.dataset.dialogTrigger = 'wishlist:'+item.id;
    row.addEventListener('keydown',event=>{
      if(event.target===row && (event.key==='Enter' || event.key===' ')){event.preventDefault();openWishlistModal(item.id);}
    });
    row.addEventListener('dragstart', () => {
      homeDragWishlistId = item.id;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      homeDragWishlistId = null;
      const zone = document.getElementById('arrivals-board');
      if(zone) zone.classList.remove('drag-over');
    });
    return row;
  }

  const pending = WISHLIST.filter(w => !wishlistIsReleased(w.date));
  const released = WISHLIST.filter(w => wishlistIsReleased(w.date));

  const sortedPending = [...pending].sort(comparePendingWishlistItems);
  const sortedReleased = [...released].sort((a,b) => parseWishlistDate(b.date).key.localeCompare(parseWishlistDate(a.date).key));

  const pendingGroups = [];
  const pendingMap = new Map();
  sortedPending.forEach(item => {
    const info = wishlistGroupInfo(item.date);
    if(!pendingMap.has(info.key)){
      const parsed = parseWishlistDate(item.date);
      let year = '';
      if(parsed.priority === 0) year = parsed.key.split('-')[0];
      const group = {...info, year, items:[]};
      pendingMap.set(info.key, group);
      pendingGroups.push(group);
    }
    pendingMap.get(info.key).items.push(item);
  });

  pendingGroups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'calendar-group' + (group.loose ? ' calendar-group-loose' : '');
    const label = group.label.replace(/\s+\d{4}$/, '');
    section.innerHTML = calendarGroupHtml(label, group.year, group.color, !!group.loose) + '<div class="calendar-items"></div>';
    const itemsEl = section.querySelector('.calendar-items');
    group.items.forEach(item => itemsEl.appendChild(makeWishlistRow(item, false)));
    container.appendChild(section);
  });

  if(sortedReleased.length){
    const section = document.createElement('section');
    section.className = 'calendar-group calendar-group-released';
    section.innerHTML = calendarGroupHtml('Déjà sorti', '', null, true) + '<div class="calendar-items"></div>';
    const itemsEl = section.querySelector('.calendar-items');
    sortedReleased.forEach(item => itemsEl.appendChild(makeWishlistRow(item, true)));
    container.appendChild(section);
  }
}

function flexibleDateMode(prefix, mode){
  const wrap = document.querySelector('[data-date-mode="'+prefix+'"]');
  if(!wrap) return;
  wrap.querySelectorAll('.date-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  document.getElementById(prefix+'-date').classList.toggle('hidden', mode !== 'date');
  document.getElementById(prefix+'-year').classList.toggle('hidden', mode !== 'year');
  wrap.dataset.currentMode = mode;
}
function setFlexibleDate(prefix, value){
  const v = String(value || '').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){
    flexibleDateMode(prefix,'date'); document.getElementById(prefix+'-date').value=v; document.getElementById(prefix+'-year').value='';
  }else if(/^\d{4}$/.test(v)){
    flexibleDateMode(prefix,'year'); document.getElementById(prefix+'-year').value=v; document.getElementById(prefix+'-date').value='';
  }else if(v.toUpperCase()==='TBD'){
    flexibleDateMode(prefix,'tbd'); document.getElementById(prefix+'-date').value=''; document.getElementById(prefix+'-year').value='';
  }else{
    flexibleDateMode(prefix,'date'); document.getElementById(prefix+'-date').value=''; document.getElementById(prefix+'-year').value='';
  }
}
function getFlexibleDate(prefix){
  const wrap=document.querySelector('[data-date-mode="'+prefix+'"]');
  const mode=(wrap && wrap.dataset.currentMode) || 'date';
  if(mode==='year') return document.getElementById(prefix+'-year').value.trim() || null;
  if(mode==='tbd') return 'TBD';
  return document.getElementById(prefix+'-date').value || null;
}
document.querySelectorAll('.date-mode').forEach(group => {
  group.addEventListener('click', e => {
    const btn=e.target.closest('.date-mode-btn'); if(!btn) return;
    flexibleDateMode(group.dataset.dateMode, btn.dataset.mode);
  });
});

/* ----- Modal Arrivage ----- */

function openArrivalModal(id){
  editingArrivalId = id || null;
  convertingWishlistId = null; // ouverture normale (pas une bascule depuis la wishlist)
  const identityItem = editingArrivalId ? ARRIVALS.find(x => x.id === editingArrivalId) : null;
  if(editingArrivalId && !identityItem) return;
  fillIdentityFields('a', identityItem || {});
  document.getElementById('a-save-btn').textContent = editingArrivalId ? 'Enregistrer' : 'Ajouter';
  const title = document.getElementById('arrival-modal-title');
  const deleteBtn = document.getElementById('a-delete-btn');
  const receivedBtn = document.getElementById('a-received-btn');

  if(editingArrivalId){
    const item = ARRIVALS.find(x => x.id === editingArrivalId);
    title.textContent = 'Arrivage';
    deleteBtn.classList.remove('hidden');
    receivedBtn.classList.remove('hidden');
    document.getElementById('a-date').value = /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : '';
    document.getElementById('a-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
    document.getElementById('a-source').value = item.source || '';
  } else {
    title.textContent = 'Ajouter un arrivage';
    deleteBtn.classList.add('hidden');
    receivedBtn.classList.add('hidden');
    document.getElementById('a-date').value = '';
    document.getElementById('a-prix').value = '';
    document.getElementById('a-source').value = '';
  }
  setIdentityEditor('a', identityItem, !!editingArrivalId);
  setContextEditor('a', identityItem, 'arrival', !!editingArrivalId);
  window.JTDDialogs.open('arrival-modal-overlay', {onDismiss:closeArrivalModal});
  if(!editingArrivalId) document.getElementById('a-nom').focus();
}

function closeArrivalModal(){
  document.getElementById('a-save-btn').textContent = 'Enregistrer';
  window.JTDDialogs.close('arrival-modal-overlay');
  editingArrivalId = null;
  convertingWishlistId = null; // annuler = l'item reste dans la wishlist
}

function saveArrivalModal(){
  const {nom, plateforme, collector, japanese, image, imageFit} = readIdentityFields('a');
  window.JTDDialogs.clearErrors(document.getElementById('arrival-modal-overlay'));
  if(!nom){ window.JTDDialogs.error('a-nom','Indique le nom du jeu.'); return; }
  if(!plateforme){ window.JTDDialogs.error('a-plateforme','Choisis une plateforme.'); return; }

  const date = document.getElementById('a-date').value || null;
  const prix = parsePriceInput(document.getElementById('a-prix').value);
  const source = document.getElementById('a-source').value.trim() || null;

  const fields = {nom, plateforme, date, prix, source, collector, japanese, image, imageFit};
  const ordered = !!convertingWishlistId;
  if(ordered){
    if(!commitBoardTransfer('wishlist', 'arrivals', convertingWishlistId, fields)) return;
    renderWishlist();
  } else {
    if(editingArrivalId) Object.assign(ARRIVALS.find(x => x.id === editingArrivalId), fields);
    else ARRIVALS.push({id:crypto.randomUUID(), ...fields});
    saveArrivals();
  }

  ensurePlatformMeta(plateforme);
  savePlatformMeta();
  closeArrivalModal();
  buildPlatformList();
  renderArrivals();
  if(ordered){ setHomeBoard('arrivals'); goToPage('home'); showToast(`« ${nom} » ajouté aux arrivages.`); }
}

function deleteArrival(){
  if(!editingArrivalId) return;
  const item = ARRIVALS.find(x => x.id === editingArrivalId);
  if(!item) return;
  confirmAction(`Supprimer l'arrivage « ${item.nom} » ?`, () => {
    const idx = ARRIVALS.indexOf(item);
    ARRIVALS = ARRIVALS.filter(x => x.id !== editingArrivalId);
    saveArrivals();
    closeArrivalModal();
    renderArrivals();
    showToast(`« ${item.nom} » supprimé`, 'Annuler', () => {
      ARRIVALS.splice(Math.min(idx, ARRIVALS.length), 0, item);
      saveArrivals();
      renderArrivals();
    });
  });
}

function addArrivalToCollection(id){
  const item = ARRIVALS.find(x => x.id === id);
  if(!item) return;

  setGameSheetViewing(false);

  convertingArrivalId = id;
  editingId = null;
  editingCollection = 'games';
  fillIdentityFields('f', item);
  openDigitalFields(item);

  document.getElementById('modal-title').textContent = 'Confirmer la réception';
  document.getElementById('delete-btn').classList.add('hidden');
  document.getElementById('f-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
  document.getElementById('f-date').value = item.date || '';
  document.getElementById('f-source').value = item.source || '';
  setIdentityEditor('f', item, true);
  setContextEditor('f', item, 'purchase', true);
  document.getElementById('f-quick-hide-fields').classList.remove('hidden');
  document.getElementById('save-btn').textContent = 'Confirmer';
  window.JTDDialogs.open('modal-overlay', {onDismiss:closeModal});
}

/* ----- Modal Wishlist ----- */

function openWishlistModal(id){
  editingWishlistId = id || null;
  convertingArrivalToWishlistId = null; // ouverture normale (pas une bascule depuis les arrivages)
  const identityItem = editingWishlistId ? WISHLIST.find(x => x.id === editingWishlistId) : null;
  if(editingWishlistId && !identityItem) return;
  fillIdentityFields('w', identityItem || {});
  document.getElementById('w-save-btn').textContent = editingWishlistId ? 'Enregistrer' : 'Ajouter';
  const title = document.getElementById('wishlist-modal-title');
  const deleteBtn = document.getElementById('w-delete-btn');
  const orderBtn = document.getElementById('w-order-btn');

  if(editingWishlistId){
    const item = WISHLIST.find(x => x.id === editingWishlistId);
    title.textContent = 'Wishlist';
    deleteBtn.classList.remove('hidden');
    orderBtn.classList.remove('hidden');
    setFlexibleDate('w', item.date);
    document.getElementById('w-lien').value = item.lien || '';
  } else {
    title.textContent = 'Ajouter à la wishlist';
    deleteBtn.classList.add('hidden');
    orderBtn.classList.add('hidden');
    setFlexibleDate('w', '');
    document.getElementById('w-lien').value = '';
  }
  setIdentityEditor('w', identityItem, !!editingWishlistId);
  setContextEditor('w', identityItem, 'wishlist', !!editingWishlistId);
  window.JTDDialogs.open('wishlist-modal-overlay', {onDismiss:closeWishlistModal});
  if(!editingWishlistId) document.getElementById('w-nom').focus();
}

function closeWishlistModal(){
  window.JTDDialogs.close('wishlist-modal-overlay');
  editingWishlistId = null;
  convertingArrivalToWishlistId = null; // annuler = l'arrivage reste où il était
}

function saveWishlistModal(){
  const {nom, plateforme, collector, japanese, image, imageFit} = readIdentityFields('w');
  window.JTDDialogs.clearErrors(document.getElementById('wishlist-modal-overlay'));
  if(!nom){ window.JTDDialogs.error('w-nom','Indique le nom du jeu.'); return; }
  if(!plateforme){ window.JTDDialogs.error('w-plateforme','Choisis une plateforme.'); return; }

  const date = getFlexibleDate('w');
  const lien = document.getElementById('w-lien').value.trim() || null;

  const fields = {nom, plateforme, date, lien, collector, japanese, image, imageFit};
  if(convertingArrivalToWishlistId){
    if(!commitBoardTransfer('arrivals', 'wishlist', convertingArrivalToWishlistId, fields)) return;
    renderArrivals();
  } else {
    if(editingWishlistId){
      const item = WISHLIST.find(x => x.id === editingWishlistId);
      Object.assign(item, fields); delete item.prix;
    } else WISHLIST.push({id:crypto.randomUUID(), ...fields});
    saveWishlist();
  }

  ensurePlatformMeta(plateforme);
  savePlatformMeta();
  closeWishlistModal();
  buildPlatformList();
  renderWishlist();
}

function deleteWishlist(){
  if(!editingWishlistId) return;
  const item = WISHLIST.find(x => x.id === editingWishlistId);
  if(!item) return;
  confirmAction(`Retirer « ${item.nom} » de la wishlist ?`, () => {
    const idx = WISHLIST.indexOf(item);
    WISHLIST = WISHLIST.filter(x => x.id !== editingWishlistId);
    saveWishlist();
    closeWishlistModal();
    renderWishlist();
    showToast(`« ${item.nom} » retiré de la wishlist`, 'Annuler', () => {
      WISHLIST.splice(Math.min(idx, WISHLIST.length), 0, item);
      saveWishlist();
      renderWishlist();
    });
  });
}

function moveWishlistToArrivals(id){
  const item = WISHLIST.find(x => x.id === id);
  if(!item) return;

  convertingWishlistId = id;
  editingArrivalId = null;
  fillIdentityFields('a', item);

  document.getElementById('arrival-modal-title').textContent = 'Confirmer la commande';
  document.getElementById('a-delete-btn').classList.add('hidden');
  document.getElementById('a-received-btn').classList.add('hidden');
  document.getElementById('a-save-btn').textContent = 'Confirmer';
  const parsed = parseWishlistDate(item.date);
  document.getElementById('a-date').value = parsed.priority === 0 && !wishlistIsReleased(item.date) ? parsed.key : '';
  document.getElementById('a-prix').value = '';
  document.getElementById('a-source').value = '';
  setIdentityEditor('a', item, true);
  setContextEditor('a', item, 'arrival', false);
  window.JTDDialogs.open('arrival-modal-overlay', {onDismiss:closeArrivalModal});
}

function moveArrivalToWishlist(id){
  const item = ARRIVALS.find(x => x.id === id);
  if(!item) return;

  convertingArrivalToWishlistId = id;
  editingWishlistId = null;
  fillIdentityFields('w', item);

  document.getElementById('wishlist-modal-title').textContent = 'Basculer vers la wishlist';
  document.getElementById('w-delete-btn').classList.add('hidden');
  document.getElementById('w-order-btn').classList.add('hidden');
  setFlexibleDate('w', item.date);
  document.getElementById('w-lien').value = '';
  setIdentityEditor('w', item, true);
  setContextEditor('w', item, 'wishlist', false);
  window.JTDDialogs.open('wishlist-modal-overlay', {onDismiss:closeWishlistModal});
}

function updateImagePreviewFor(inputId, previewId){
  const prefix = inputId.slice(0,1);
  const item = {image:document.getElementById(inputId).value.trim(), imageFit:document.getElementById(prefix+'-image-fit').value};
  const preview = document.getElementById(previewId);
  const filled = item.imageFit === 'cover';
  preview.classList.add('game-art-frame');
  preview.classList.toggle('image-fit-cover', filled);
  preview.classList.toggle('image-fit-contain', !filled);
  preview.replaceChildren();
  if(safeURL(item.image, true)){
    preview.innerHTML = gameImageHtml(item);
    preview.querySelector('.game-art-image').addEventListener('error', () => { preview.textContent = 'Image introuvable'; });
  }else preview.textContent = "Aperçu de l'image";
}
for(const prefix of ['f','a','w']){
  document.getElementById(prefix+'-image-fit').addEventListener('change', () => updateImagePreviewFor(prefix+'-image', prefix === 'f' ? 'image-preview' : prefix+'-image-preview'));
}

document.getElementById('add-arrival-btn').addEventListener('click', () => openArrivalModal(null));
document.getElementById('a-cancel-btn').addEventListener('click', closeArrivalModal);
document.getElementById('a-save-btn').addEventListener('click', saveArrivalModal);
document.getElementById('a-delete-btn').addEventListener('click', deleteArrival);
document.getElementById('a-image').addEventListener('input', () => updateImagePreviewFor('a-image','a-image-preview'));
document.getElementById('a-received-btn').addEventListener('click', () => {
  if(!editingArrivalId) return;
  const id = editingArrivalId;
  closeArrivalModal();
  addArrivalToCollection(id);
});
/* Un clic en dehors de la fenêtre d'édition d'un arrivage ne la ferme plus (évite les pertes accidentelles) */

document.getElementById('add-wishlist-btn').addEventListener('click', () => openWishlistModal(null));
document.getElementById('w-cancel-btn').addEventListener('click', closeWishlistModal);
document.getElementById('w-save-btn').addEventListener('click', saveWishlistModal);
document.getElementById('w-delete-btn').addEventListener('click', deleteWishlist);
document.getElementById('w-order-btn').addEventListener('click', () => {
  if(!editingWishlistId) return;
  const id = editingWishlistId;
  closeWishlistModal();
  moveWishlistToArrivals(id);
});
document.getElementById('w-image').addEventListener('input', () => updateImagePreviewFor('w-image','w-image-preview'));
/* Un clic en dehors de la fenêtre d'édition d'un élément wishlist ne la ferme plus (évite les pertes accidentelles) */

/* ---------- Modal gestion des plateformes ---------- */

function openPlatformModal(){
  closeMobileDrawers();
  buildPlatformRows();
  window.JTDDialogs.open('platform-modal-overlay', {onDismiss:closePlatformModal,initialFocus:'#new-platform-toggle'});
}

function closePlatformModal(){
  window.JTDDialogs.close('platform-modal-overlay');
  buildPlatformList();
  render();
}

function buildPlatformRows(){
  const counts = Object.create(null);
  [GAMES, ARRIVALS, WISHLIST, CEMETERY.filter(g => g.saleStatus !== 'sold')].forEach(items => items.forEach(g => { counts[g.plateforme] = (counts[g.plateforme]||0) + 1; }));
  allPlatformNames().forEach(p => { if(!(p in counts)) counts[p] = 0; });
  const platforms = getOrderedPlatformNames();

  const container = document.getElementById('platform-rows');
  container.innerHTML = "";

  platforms.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'platform-row';
    row.dataset.currentName = p;

    const color = getPlatformColor(p);
    const logo = getPlatformLogo(p);
    const count = counts[p] || 0;
    const initials = p.slice(0,2).toUpperCase();

    row.innerHTML = `
      <div class="platform-row-main">
        <div class="row-order-btns" aria-label="Ordre de la plateforme">
          <button type="button" class="order-btn" data-dir="-1" title="Monter" aria-label="Monter ${escapeHTML(p)}"${idx === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>
          <button type="button" class="order-btn" data-dir="1" title="Descendre" aria-label="Descendre ${escapeHTML(p)}"${idx === platforms.length - 1 ? ' disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        </div>
        <div class="swatch-preview" data-role="swatch">
          ${logo ? `<img src="${escapeHTML(safeURL(logo, true))}" alt="">` : escapeHTML(initials)}
        </div>
        <div class="platform-row-info">
          <strong class="platform-row-name">${escapeHTML(p)}</strong>
        </div>
        <button type="button" class="platform-edit-btn" aria-label="Modifier ${escapeHTML(p)}" title="Modifier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>
        </button>
      </div>
      <div class="platform-row-editor hidden">
        <div class="platform-editor-topline">
          <label class="platform-editor-field platform-editor-name">
            <span>Nom</span>
            <input type="text" data-role="name" value="${escapeHTML(p)}">
          </label>
          <label class="platform-editor-field platform-editor-color">
            <span>Couleur</span>
            <input type="color" data-role="color" value="${toHexColor(color)}">
          </label>
        </div>
        <label class="platform-editor-field">
          <span>Image du logo</span>
          <input type="text" data-role="logo" placeholder="https://…" value="${escapeHTML(safeURL(logo, true))}">
        </label>
        <div class="platform-editor-actions">
          ${count === 0 ? `<button type="button" class="platform-delete-btn">Supprimer</button>` : ''}
          <div class="platform-editor-spacer"></div>
          <button type="button" class="platform-cancel-btn">Annuler</button>
          <button type="button" class="platform-save-btn">Enregistrer</button>
        </div>
      </div>
    `;

    row.style.setProperty('--platform-editor-accent',color);
    const swatch = row.querySelector('[data-role="swatch"]');
    if(!logo) swatch.style.background = color;
    swatch.style.color = platformBandText(color);

    row.querySelector('[data-dir="-1"]').addEventListener('click', () => {
      movePlatformOrder(row.dataset.currentName, -1);
      buildPlatformRows();
    });
    row.querySelector('[data-dir="1"]').addEventListener('click', () => {
      movePlatformOrder(row.dataset.currentName, 1);
      buildPlatformRows();
    });

    const editor = row.querySelector('.platform-row-editor');
    const editBtn = row.querySelector('.platform-edit-btn');
    const nameInput = row.querySelector('[data-role="name"]');
    const colorInput = row.querySelector('[data-role="color"]');
    const logoInput = row.querySelector('[data-role="logo"]');

    const closeOtherEditors = () => {
      container.querySelectorAll('.platform-row.editing').forEach(other => {
        if(other !== row){
          other.classList.remove('editing');
          other.querySelector('.platform-row-editor').classList.add('hidden');
        }
      });
    };

    editBtn.addEventListener('click', () => {
      const willOpen = editor.classList.contains('hidden');
      closeOtherEditors();
      row.classList.toggle('editing', willOpen);
      editor.classList.toggle('hidden', !willOpen);
      if(willOpen) nameInput.focus();
    });

    const refreshDraftPreview = () => {
      row.style.setProperty('--platform-editor-accent',colorInput.value);
      swatch.style.color = platformBandText(colorInput.value);
      const url = safeURL(logoInput.value.trim(), true);
      const draftName = nameInput.value.trim() || p;
      swatch.innerHTML = '';
      if(url){
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.addEventListener('error', () => {
          img.remove();
          swatch.textContent = draftName.slice(0,2).toUpperCase();
          swatch.style.background = colorInput.value;
        });
        swatch.appendChild(img);
        swatch.style.background = 'var(--surface-raised)';
      }else{
        swatch.textContent = draftName.slice(0,2).toUpperCase();
        swatch.style.background = colorInput.value;
      }
    };
    colorInput.addEventListener('input', refreshDraftPreview);
    logoInput.addEventListener('input', refreshDraftPreview);
    nameInput.addEventListener('input', () => { if(!logoInput.value.trim()) refreshDraftPreview(); });

    row.querySelector('.platform-cancel-btn').addEventListener('click', () => buildPlatformRows());

    row.querySelector('.platform-save-btn').addEventListener('click', () => {
      const current = row.dataset.currentName;
      const newName = nameInput.value.trim();
      if(!newName){ window.JTDDialogs.error(nameInput,'Indique le nom de la plateforme.'); return; }
      const duplicate = allPlatformNames().find(name => name !== current && name.toLowerCase() === newName.toLowerCase());
      if(duplicate){
        window.JTDDialogs.error(nameInput,`La plateforme « ${duplicate} » existe déjà.`);
        return;
      }

      let finalName = current;
      if(newName !== current){
        if(!renamePlatform(current, newName)) return;
        finalName = newName;
      }
      const meta = ensurePlatformMeta(finalName);
      meta.color = colorInput.value;
      meta.logo = logoInput.value.trim() || null;
      savePlatformMeta();
      buildPlatformList();
      render();
      renderArrivals();
      renderWishlist();
      buildPlatformRows();
      showToast(`« ${finalName} » mise à jour`);
    });

    const deleteBtn = row.querySelector('.platform-delete-btn');
    if(deleteBtn){
      deleteBtn.addEventListener('click', () => {
        const current = row.dataset.currentName;
        confirmAction(`Supprimer la plateforme « ${current} » ?`, () => {
          delete platformMeta[current];
          platformOrder = platformOrder.filter(name => name !== current);
          if(state.platform === current) state.platform = null;
          savePlatformMeta();
          savePlatformOrder();
          buildPlatformRows();
          buildPlatformList();
          render();
          showToast(`« ${current} » supprimée`);
        }, {title:'Supprimer la plateforme', confirmLabel:'Supprimer'});
      });
    }

    container.appendChild(row);
  });
}
function toHexColor(color){
  // Les couleurs sont déjà en hex dans ce projet ; on sécurise au cas où.
  if(/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#8B8FA3';
}

function setAddPlatformOpen(open){
  const form = document.getElementById('add-platform-row');
  window.JTDDialogs.clearErrors(form);
  const toggle = document.getElementById('new-platform-toggle');
  form.classList.toggle('hidden', !open);
  toggle.classList.toggle('hidden', open);
  if(open) document.getElementById('new-platform-name').focus();
  else toggle.focus();
}

function addPlatform(){
  const input = document.getElementById('new-platform-name');
  const name = input.value.trim();
  if(!name) { window.JTDDialogs.error(input.id,'Indique le nom de la plateforme.'); return; }
  const existing = allPlatformNames().find(p => p.toLowerCase() === name.toLowerCase());
  if(existing){
    window.JTDDialogs.error(input.id,`La plateforme « ${existing} » existe déjà.`);
    return;
  }
  ensurePlatformMeta(name);
  platformOrder = [...getOrderedPlatformNames().filter(p => p !== name), name];
  savePlatformMeta();
  savePlatformOrder();
  input.value = '';
  setAddPlatformOpen(false);
  buildPlatformRows();
  showToast(`« ${name} » ajoutée`);
}

document.getElementById('new-platform-toggle').addEventListener('click', () => setAddPlatformOpen(true));
document.getElementById('cancel-add-platform-btn').addEventListener('click', () => {
  document.getElementById('new-platform-name').value = '';
  setAddPlatformOpen(false);
});
document.getElementById('add-platform-btn').addEventListener('click', addPlatform);
document.getElementById('new-platform-name').addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){ e.preventDefault(); addPlatform(); }
  if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); e.target.value=''; setAddPlatformOpen(false); }
});

document.getElementById('sort-platforms-btn').addEventListener('click', togglePlatformSortMode);
document.getElementById('manage-platforms-btn').addEventListener('click', openPlatformModal);
document.getElementById('close-platform-modal-btn').addEventListener('click', closePlatformModal);

document.getElementById('backup-btn').addEventListener('click', backupData);

const restoreInput = document.getElementById('restore-input');
restoreInput.addEventListener('click', () => {
  // Permet de sélectionner à nouveau exactement le même fichier.
  restoreInput.value = '';
});
restoreInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if(file) restoreBackup(file);
});

function downloadChatGPTSnapshot(){
  try{
    const payload = JTDData.createChatGPTPayload(buildBackupPayload().data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jeux-tout-doux-chatgpt-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Fichier prêt à joindre dans ChatGPT.');
  }catch(error){
    console.error('Export ChatGPT impossible', error);
    showToast('Impossible de préparer le fichier pour ChatGPT.');
  }
}

document.getElementById('chatgpt-export-btn').addEventListener('click', downloadChatGPTSnapshot);

document.getElementById('profile-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('profile-menu').classList.toggle('hidden');
});
document.getElementById('profile-menu').addEventListener('click', (e) => {
  if(e.target.closest('.profile-menu-item')) document.getElementById('profile-menu').classList.add('hidden');
});
document.addEventListener('click', (e) => {
  const menu = document.getElementById('profile-menu');
  if(!menu.classList.contains('hidden') && !e.target.closest('.profile-menu-wrap')){
    menu.classList.add('hidden');
  }
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') document.getElementById('profile-menu').classList.add('hidden');
});

document.getElementById('profile-name-input').addEventListener('click', (e) => e.stopPropagation());
document.getElementById('profile-name-input').addEventListener('change', (e) => {
  PROFILE_NAME = e.target.value.trim();
  saveProfile();
  renderProfileAvatar();
});
document.getElementById('profile-avatar-edit-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('profile-avatar-input').click();
});
document.getElementById('profile-avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    PROFILE_AVATAR = await resizeImageToDataUrl(file, 160);
    saveProfile();
    renderProfileAvatar();
  }catch(err){
    console.error('Impossible de traiter cette image', err);
  }
  e.target.value = '';
});

document.getElementById('add-btn').addEventListener('click', () => openModal(null));
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('save-btn').addEventListener('click', saveModal);
document.getElementById('delete-btn').addEventListener('click', deleteGame);
document.getElementById('f-image').addEventListener('input', updateImagePreview);
/* Un clic en dehors de la fenêtre d'édition d'un jeu ne la ferme plus (évite les pertes accidentelles) */

document.getElementById('search-input').addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
  state.sort = e.target.value;
  render();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  state = { media:state.media || 'physical', accountId:null, contentType:null, platform:null, collector:false, japanese:false, status:null, search:"", sort:"name-asc" };
  document.getElementById('search-input').value = "";
  document.getElementById('sort-select').value = "name-asc";
  buildPlatformList();
  buildFormatToggles();
  buildStatusToggles();
  render();
});

const NAVIGATION_KEY = 'navigation-v1';
let navigationReady = false;
let restoringNavigation = false;
let navigationPage = 'home';
let navigationBoard = 'arrivals';
let firstNavigation = true;

function navigationSnapshot(){
  return {page:navigationPage, board:navigationBoard, ...state};
}
function navigationHash(view){
  const params = new URLSearchParams();
  for(const key of ['platform','status','search','accountId','contentType']) if(view[key]) params.set(key, view[key]);
  if(view.media && view.media !== 'physical') params.set('media',view.media);
  for(const key of ['collector','japanese']) if(view[key]) params.set(key, '1');
  if(view.sort && view.sort !== 'name-asc') params.set('sort', view.sort);
  if(['arrivals','wishlist'].includes(view.board)) params.set('board', view.board);
  return '#' + view.page + (params.size ? '?' + params.toString() : '');
}
function navigationFromHash(){
  const match = location.hash.match(/^#(home|collection|cemetery)(?:\?(.*))?$/);
  if(!match) return null;
  const params = new URLSearchParams(match[2]);
  return {page:match[1], ...Object.fromEntries(params), collector:params.get('collector') === '1', japanese:params.get('japanese') === '1'};
}
function saveNavigationView(view){
  try {
    if(IS_PREVIEW_MODE) sessionStorage.setItem('jtd:sandbox-navigation', JSON.stringify(view));
    else accountStorage.setItem(NAVIGATION_KEY, JSON.stringify(view));
  } catch { /* La navigation reste utilisable sans stockage. */ }
}
function persistNavigation(push = false){
  if(!navigationReady || restoringNavigation) return;
  const view = navigationSnapshot();
  const hash = navigationHash(view);
  const entry = {jtdNavigation:true, generation:window.JTDAccountGeneration || 0};
  if(location.hash !== hash) history[push ? 'pushState' : 'replaceState'](entry, '', location.pathname + location.search + hash);
  else history.replaceState(entry, '', location.href);
  saveNavigationView(view);
}
function setHomeBoard(board){
  navigationBoard = board === 'wishlist' ? 'wishlist' : 'arrivals';
  document.querySelectorAll('.home-boards-switch-btn').forEach(button => {
    const active = button.dataset.target === navigationBoard;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const boards = document.getElementById('home-boards');
  boards.classList.remove('show-wishlist', 'show-arrivals');
  boards.classList.add('show-' + navigationBoard);
}
function applyNavigation(view = {}){
  restoringNavigation = true;
  navigationPage = ['collection','cemetery'].includes(view.page) ? view.page : 'home';
  state = {
    media:['all','digital'].includes(view.media) ? view.media : 'physical',
    contentType:['all','digital'].includes(view.media) && selectedContentTypes(view.contentType || null).length ? selectedContentTypes(view.contentType || null).join(',') : null,
    accountId:DIGITAL_ACCOUNTS.some(a => a.id === view.accountId) ? view.accountId : null,
    platform:allPlatformNames().includes(view.platform) ? view.platform : null,
    collector:view.collector === true, japanese:view.japanese === true,
    status:STATUS_OPTIONS.some(s => s.key === view.status) || view.status === '__none__' ? view.status : null,
    search:typeof view.search === 'string' ? view.search.slice(0,200) : '',
    sort:['name-asc','name-desc','price-desc','price-asc','date-desc','date-asc'].includes(view.sort) ? view.sort : 'name-asc'
  };
  document.getElementById('search-input').value = state.search;
  document.getElementById('sort-select').value = state.sort;
  setHomeBoard(view.board);
  goToPage(navigationPage, false);
  restoringNavigation = false;
  persistNavigation();
}
function initializeNavigation(){
  let saved = null;
  try { saved = JSON.parse(IS_PREVIEW_MODE ? sessionStorage.getItem('jtd:sandbox-navigation') : accountStorage.getItem(NAVIGATION_KEY)); } catch {}
  const view = (firstNavigation && navigationFromHash()) || saved || {};
  firstNavigation = false;
  navigationReady = true;
  applyNavigation(view && typeof view === 'object' ? view : {});
}
function resetNavigationSession(){
  if(navigationReady) {
    navigationReady = false;
    history.replaceState(null, '', location.pathname + location.search);
  }
}
function goToPage(page, push = true){
  const wasRestoring = restoringNavigation;
  // Save the old entry before creating the next one, including current filters.
  persistNavigation();
  navigationPage = ['collection','cemetery'].includes(page) ? page : 'home';
  document.querySelectorAll('.nav-tab').forEach(b => {
    const active = b.dataset.page === navigationPage;
    b.classList.toggle('active', active);
    if(active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.title = 'REGAL | ' + (navigationPage === 'collection' ? 'Collection' : 'Accueil');
  document.getElementById('page-cemetery').classList.toggle('hidden', navigationPage !== 'cemetery');
  if(navigationPage === 'cemetery'){ document.title = 'REGAL | Cimetière'; window.renderCemetery?.(); }
  if(navigationPage === 'cemetery') document.getElementById('cemetery-view-controls').prepend(mobileFilterToggle);
  if(navigationPage === 'home') document.getElementById('home-view-controls').prepend(mobileFilterToggle);
  mobileFilterToggle.setAttribute('aria-label', navigationPage === 'collection' ? 'Afficher les filtres' : 'Afficher les statistiques');
  document.getElementById('page-home').classList.toggle('hidden', navigationPage !== 'home');
  document.getElementById('page-collection').classList.toggle('hidden', navigationPage !== 'collection');
  restoringNavigation = true;
  if(navigationPage === 'collection'){
    buildPlatformList();
    buildFormatToggles();
    buildStatusToggles();
    render();
  }
  // applyNavigation owns its own final persistence.
  restoringNavigation = wasRestoring;
  closeMobileDrawers();
  requestCollectionContextUpdate();
  if(push) persistNavigation(true);
}
window.addEventListener('popstate', event => {
  if(!navigationReady) return;
  if(event.state?.generation !== undefined && event.state.generation !== (window.JTDAccountGeneration || 0)) applyNavigation({});
  else applyNavigation(navigationFromHash() || {});
});
window.addEventListener('hashchange', () => {
  if(navigationReady) applyNavigation(navigationFromHash() || {});
});

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    goToPage(btn.dataset.page);
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
});

/* ---------- Navigation mobile ---------- */
function closeMobileDrawers(){
  document.querySelector('.collection-context-filters')?.setAttribute('aria-expanded','false');
  mobileFilterToggle.setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.sidebar.mobile-open').forEach(el => el.classList.remove('mobile-open'));
  document.getElementById('mobile-backdrop').classList.remove('visible');
  document.body.classList.remove('mobile-drawer-open');
}
function openMobileDrawer(el){
  if(!el) return;
  closeMobileDrawers();
  el.classList.add('mobile-open');
  document.querySelector('.collection-context-filters')?.setAttribute('aria-expanded','true');
  mobileFilterToggle.setAttribute('aria-expanded', 'true');
  mobileFilterToggle.setAttribute('aria-controls', el.id);
  document.getElementById('mobile-backdrop').classList.add('visible');
  document.body.classList.add('mobile-drawer-open');
}
function toggleMobileDrawer(el){
  if(!el) return;
  if(el.classList.contains('mobile-open')) closeMobileDrawers();
  else openMobileDrawer(el);
}
document.getElementById('mobile-backdrop').addEventListener('click', closeMobileDrawers);

const PAGE_SIDEBAR_IDS = { home:'home-sidebar', collection: 'collection-sidebar', cemetery: 'cemetery-sidebar' };
document.getElementById('global-filter-toggle')?.addEventListener('click', () => {
  const activePage = document.querySelector('.nav-tab.active')?.dataset.page || 'home';
  toggleMobileDrawer(document.getElementById(PAGE_SIDEBAR_IDS[activePage]));
});

function updateTopnavHeightVar(){
  const h = document.querySelector('.topnav')?.offsetHeight || 50;
  document.documentElement.style.setProperty('--topnav-h', h + 'px');
  requestCollectionContextUpdate();
}
updateTopnavHeightVar();
const topnavEl = document.querySelector('.topnav');
if(topnavEl && window.ResizeObserver){
  // Recalcule à chaque changement réel de hauteur du nav (chargement de police,
  // passage 1/2 lignes, rotation d'écran...) plutôt que de deviner le bon moment.
  new ResizeObserver(updateTopnavHeightVar).observe(topnavEl);
} else {
  window.addEventListener('load', updateTopnavHeightVar);
}
window.addEventListener('resize', () => {
  if(window.innerWidth > 820) closeMobileDrawers();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeMobileDrawers();
});

/* ---------- Sélecteur mobile Wishlist / Arrivages ---------- */
document.querySelectorAll('.home-boards-switch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setHomeBoard(btn.dataset.target);
    persistNavigation(true);
  });
});

async function initApp(isCurrent = () => true){
  loadProfile();
  renderProfileAvatar();
  loadPlatformMeta();
  loadPlatformOrder();
  await loadGames();
  if(!isCurrent()) return;
  await loadArrivals();
  if(!isCurrent()) return;
  await loadWishlist();
  CEMETERY = IS_PREVIEW_MODE ? loadPreviewData().cemetery : JSON.parse(accountStorage.getItem(CEMETERY_KEY) || '[]');
  LEGACY_JOURNAL = IS_PREVIEW_MODE ? loadPreviewData().journal : JSON.parse(accountStorage.getItem(LEGACY_JOURNAL_KEY) || '[]');
  DIGITAL_ACCOUNTS = IS_PREVIEW_MODE ? loadPreviewData().digitalAccounts : JSON.parse(accountStorage.getItem(DIGITAL_ACCOUNTS_KEY) || '[]');
  window.renderCemetery?.();
  if(!isCurrent()) return;
  normalizeCollectionEditions();
  try { const mode = accountStorage.getItem(PLATFORM_SORT_MODE_KEY); platformSortMode = mode === 'custom' ? 'custom' : 'count'; }catch(e){}
  seedPcPlatformOnce();
  iconSelectify('f-plateforme', getPlatformOptionIconHtml);
  iconSelectify('a-plateforme', getPlatformOptionIconHtml);
  iconSelectify('w-plateforme', getPlatformOptionIconHtml);
  buildPlatformList();
  buildFormatToggles();
  buildStatusToggles();
  render();
  renderArrivals();
  renderWishlist();
  updateBackupNote();
}

/* ---------- Bootstrap totalement isolé de la preview ---------- */
if(IS_PREVIEW_MODE){
  window.JTDShare = {
    async createOrCopy(){
      const label = document.getElementById('share-label');
      const note = document.getElementById('share-note');
      const disableBtn = document.getElementById('share-disable-btn');
      if(label) label.textContent = 'Copier le lien de partage';
      if(note) note.textContent = 'Simulation sandbox • aucune donnée réelle publiée';
      if(disableBtn) disableBtn.classList.remove('hidden');
      try{ await navigator.clipboard.writeText('https://jtd-sandbox-rhypp11.web.app/?share-preview=sandbox'); }catch(e){}
      showToast('Lien de partage test simulé. Aucune donnée réelle n’est publiée.');
    },
    disable(){
      const label = document.getElementById('share-label');
      const note = document.getElementById('share-note');
      const disableBtn = document.getElementById('share-disable-btn');
      if(label) label.textContent = 'Partager ma collection';
      if(note) note.textContent = 'Crée un lien lecture seule à copier dans ChatGPT';
      if(disableBtn) disableBtn.classList.add('hidden');
      showToast('Partage test désactivé.');
    }
  };

  initApp()
    .then(() => {
      migrateImportedPlatformAliases();
      initializeNavigation();
      const loading = document.getElementById('auth-loading');
      const login = document.getElementById('login-gate');
      const shell = document.getElementById('app-shell');
      const logout = document.getElementById('logout-btn');
      const divider = document.getElementById('profile-menu-divider');
      const sync = document.getElementById('cloud-sync-status');
      if(loading) loading.classList.add('hidden');
      if(login) login.classList.add('hidden');
      if(shell) shell.classList.remove('hidden');
      if(logout) logout.classList.add('hidden');
      if(divider) divider.classList.add('hidden');
      if(sync) sync.classList.add('hidden');
    })
    .catch(err => {
      console.error('Erreur de démarrage sandbox', err);
      const loading = document.getElementById('auth-loading');
      if(loading){
        loading.classList.remove('auth-loading');
        loading.textContent = 'Erreur de démarrage sandbox : ' + (err && err.stack ? err.stack : String(err));
        loading.style.cssText += ';white-space:pre-wrap;padding:24px;overflow:auto;font:12px/1.5 monospace;';
      }
    });
}


// Image errors never evaluate code assembled from user data.
document.addEventListener('error', event => {
  const image = event.target;
  if(!(image instanceof HTMLImageElement)) return;
  const parent = image.parentElement;
  if(!parent) return;
  if(image.classList.contains('game-art-backdrop')){ image.remove(); return; }
  if(image.classList.contains('game-art-image')) parent.querySelector('.game-art-backdrop')?.remove();
  if(image.hasAttribute('data-board-art')){
    image.remove();
    parent.querySelector('.board-image-fallback')?.classList.remove('hidden');
  }else if(parent.classList.contains('card-banner')){
    image.remove();
    parent.classList.add('placeholder');
    parent.querySelector('.card-fallback')?.classList.remove('hidden');
  }else if(parent.classList.contains('identity-thumb') || parent.classList.contains('swatch-preview')){
    image.remove();
    parent.textContent = '—';
  }else if(!parent.classList.contains('image-preview')){
    const dot = document.createElement('span');
    dot.className = image.classList.contains('icon-select-icon') ? 'icon-select-dot' : 'dot';
    image.replaceWith(dot);
  }
}, true);






