/* Committed release identity: works with the existing static Hosting deployment. */
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const normalizeHTML=text=>text.replace(/(<meta name="regal-(?:version|build)" content=")[^"]*(">)/g,'$1__RELEASE__$2');
function label(major,date,sequence){const [y,m,d]=date.split('-');return major+'_'+d+'.'+m+'.'+y.slice(-2)+'-'+sequence;}
async function buildRelease({directory=root,check=false,date}={}){
 const config=JSON.parse(await fs.readFile(path.join(directory,'release-config.json'),'utf8'));
 if(!Number.isSafeInteger(config.major)||config.major<1) throw Error('Invalid major version');
 const files=(await fs.readdir(directory)).filter(file=>/\.(?:js|css|html|svg)$/.test(file)||/^logo-.*\.png$/.test(file)||['manifest.json','firebase.json'].includes(file)).sort();
 const hash=crypto.createHash('sha256').update('REGAL '+config.major+'\n');
 for(const file of files){let content=await fs.readFile(path.join(directory,file));if(file==='index.html') content=Buffer.from(normalizeHTML(content.toString()));hash.update(file+'\0').update(content).update('\0');}
 const fingerprint=hash.digest('hex').slice(0,24);
 let previous=null;
 try {previous=JSON.parse(await fs.readFile(path.join(directory,'site-version.json'),'utf8'));}catch(error){if(error.code!=='ENOENT') throw error;}
 let html=await fs.readFile(path.join(directory,'index.html'),'utf8');
 if(!html.includes('name="regal-version"')||!html.includes('name="regal-build"')) throw Error('Missing release metadata in index.html');
 if(check){
  if(!previous||previous.build!==fingerprint||previous.major!==config.major||previous.version!==label(config.major,previous.date,previous.sequence)||!html.includes('name="regal-version" content="'+previous.version+'"')||!html.includes('name="regal-build" content="'+fingerprint+'"')) throw Error('Release files are stale: run node scripts/build-release.cjs');
  return previous;
 }
 if(previous?.build===fingerprint&&previous.major===config.major){
  const repaired=html.replace(/(<meta name="regal-version" content=")[^"]*(">)/,'$1'+previous.version+'$2').replace(/(<meta name="regal-build" content=")[^"]*(">)/,'$1'+fingerprint+'$2');
  if(repaired!==html) await fs.writeFile(path.join(directory,'index.html'),repaired);
  return previous;
 }
 date=date||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) throw Error('Invalid build date');
 const sequence=previous?.date===date&&previous.major===config.major?previous.sequence+1:1;
 const release={version:label(config.major,date,sequence),major:config.major,date,sequence,build:fingerprint};
 html=html.replace(/(<meta name="regal-version" content=")[^"]*(">)/,'$1'+release.version+'$2').replace(/(<meta name="regal-build" content=")[^"]*(">)/,'$1'+fingerprint+'$2');
 await fs.writeFile(path.join(directory,'index.html'),html);
 await fs.writeFile(path.join(directory,'site-version.json'),JSON.stringify(release,null,2)+'\n');
 return release;
}
module.exports={buildRelease};
if(require.main===module) buildRelease({check:process.argv.includes('--check'),date:process.env.JTD_BUILD_DATE}).then(result=>console.log(result.version+' · '+result.build)).catch(error=>{console.error(error.message);process.exitCode=1;});
