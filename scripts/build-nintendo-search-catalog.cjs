// Usage: node scripts/build-nintendo-search-catalog.cjs switch-fr.json switch2-fr.json
// Inputs are Nintendo France search exports filtered to type:GAME and the relevant system.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname,'..','switch-catalog');
const prefix = 'https://www.nintendo.com/eu/media/images';
function image(value){
  if(typeof value!=='string') return '';
  if(value.startsWith(prefix+'/') && /\.(?:jpe?g|png|webp)$/i.test(value)) return value.slice(prefix.length);
  return /^https:\/\/assets\.nintendo\.eu\/image\/private\/[\w,/-]+$/.test(value) ? value : '';
}

const files = [];
for(const [offset,platform,slug] of [[0,'Switch','sw1'],[1,'Switch 2','sw2']]){
  const {response} = JSON.parse(fs.readFileSync(process.argv[2+offset],'utf8'));
  if(!response?.docs?.length) throw new Error('Catalogue Nintendo vide : '+platform);
  const rows = new Map();
  for(const doc of response.docs){
    const name = doc.title?.trim();
    const square = image(doc.image_url_sq_s);
    const banner = image(doc.image_url_h16x9_s);
    if(!name || !square && !banner || /\b(démo gratuite|version démo|demo version|trial version)\b/i.test(name)) continue;
    const id = /^(?:01|04)[\da-f]{14}$/i.test(doc.application_id_s) ? doc.application_id_s.toUpperCase() : '';
    if(platform==='Switch' && (id.startsWith('04') || /switch[™®]?\s*2\s+edition/i.test(name))) continue;
    const key = name.normalize('NFC').toLowerCase();
    const prior = rows.get(key);
    if(!prior || Number(Boolean(id))+Number(Boolean(square))+Number(Boolean(banner)) >
        Number(Boolean(prior[0]))+Number(Boolean(prior[2]))+Number(Boolean(prior[3]))){
      rows.set(key,[id,name,square,banner,platform]);
    }
  }
  const sorted = [...rows.values()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
  if(!sorted.length) throw new Error('Aucun visuel Nintendo valide : '+platform);
  for(let i=0;i<sorted.length;i+=120){
    const file = 'nintendo-fr-'+slug+'-'+i/120+'.json';
    fs.writeFileSync(path.join(output,file),JSON.stringify(sorted.slice(i,i+120))+'\n');
    files.push(file);
  }
  console.log(platform,sorted.length);
}
fs.writeFileSync(path.join(output,'nintendo-fr-manifest.json'),JSON.stringify(files)+'\n');

// Optional arguments are all pages from a Nintendo France search filtered to type:DLC.
const dlcPages = process.argv.slice(4);
if(dlcPages.length){
  const pages = dlcPages.map(file=>JSON.parse(fs.readFileSync(file,'utf8')).response);
  const docs = pages.flatMap(page=>page.docs);
  if(new Set(docs.map(doc=>doc.fs_id)).size!==pages[0].numFound)
    throw new Error('Catalogue DLC incomplet');
  const rows = [];
  for(const doc of docs){
    const id = /^(?:01|04)[\da-f]{14}$/i.test(doc.application_id_s) ? doc.application_id_s.toUpperCase() : '';
    const name = doc.title?.trim();
    if(!name || !id) continue;
    // Nintendo supplies the base application's ID here, never use it as the DLC's Title ID.
    rows.push([name,image(doc.image_url_sq_s),image(doc.image_url_h16x9_s),id.startsWith('04')?'Switch 2':'Switch']);
  }
  const index = new Map(rows.map(row=>[row[3]+'|'+row[0].toLowerCase(),row]));
  const sorted = [...index.values()].sort((a,b)=>a[0].localeCompare(b[0],'fr'));
  const parts = [];
  for(let i=0;i<sorted.length;i+=500){
    const file = 'nintendo-dlc-fr-'+i/500+'.json';
    fs.writeFileSync(path.join(output,file),JSON.stringify(sorted.slice(i,i+500))+'\n');
    parts.push(file);
  }
  fs.writeFileSync(path.join(output,'nintendo-dlc-fr-manifest.json'),JSON.stringify(parts)+'\n');
  console.log('DLC',sorted.length);
}
