// Usage: node scripts/build-switch-catalog.cjs /path/to/FR.fr.json
const fs = require('node:fs');
const path = require('node:path');
const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const output = path.join(__dirname, '..', 'switch-catalog');
const hash = url => /^https:\/\/img-eshop\.cdn\.nintendo\.net\/i\/([a-f0-9]{64})\.jpg$/i.exec(url)?.[1] || '';
const rows = new Map();
for (const entry of Object.values(source)) {
  if (!/^(01|04)[0-9A-F]{11}000$/i.test(entry.id || '') || !entry.name || entry.isDemo ||
      /^(retail only:|demo version:)|\b(démo gratuite|version démo|demo version|trial version)\b/i.test(entry.name)) continue;
  const icon = hash(entry.iconUrl), banner = hash(entry.bannerUrl);
  if (!icon && !banner) continue;
  const row = [entry.id.toUpperCase(), entry.name.trim(), icon, banner];
  rows.set([row[0],row[1],icon,banner].join('|'),row);
}
const sorted = [...rows.values()].sort((a,b) => a[1].localeCompare(b[1], 'fr') || a[0].localeCompare(b[0]));
fs.mkdirSync(output, {recursive:true});
const files = [];
for (let index=0; index<sorted.length; index+=1000) {
  const file = 'fr-' + files.length + '.json';
  fs.writeFileSync(path.join(output,file), JSON.stringify(sorted.slice(index,index+1000)));
  files.push(file);
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(files)+'\n');
console.log(sorted.length, 'editions across', files.length, 'files');
