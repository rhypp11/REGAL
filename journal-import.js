/* ROM COMPLETE CSV mapping. The browser reads the selected file locally. */
(function(root){
  'use strict';
  const D=root.JTDData||(typeof require==='function'?require('./jtd-data.js'):null);
  const months=['janv','fevr','mars','avr','mai','juin','juil','aout','sept','oct','nov','dec'];
  const headers=['date','si date approximative','plateforme','nom','support','mode de jeu','completion','histoire','gameplay','visuel','duree de vie','musique','ressenti'];
  const clean=value=>String(value??'').trim();
  const emoji=value=>clean(value).replace(/\uFE0F/g,'');
  const support={
    '💿':{format:'physical',access:'owned'}, '🌐':{format:'digital',access:'owned'}, '🧩':{format:'extension',access:'owned'},
    '🟢':{format:'digital',access:'subscription',service:'Game Pass'},
    '🔵':{format:'digital',access:'subscription',service:'PlayStation Plus'},
    '🔴':{format:'digital',access:'subscription',service:'Nintendo Switch Online'},
    '🏴‍☠':{format:'',access:'emulation'}, '👪':{format:'',access:'family'},
    '🔁':{format:'',access:'',replayed:true}
  };
  const modes={'👤':'solo','📺':'local','📶':'online'};
  const levels={'✅':'finished','💯':'hundred','🏆':'achievements'};
  const feelings={'💩':'bad','😐':'neutral','👍':'okay','🩷':'love','❤':'love','💎':'gem'};
  function readDate(raw,previousYear){
    const explicit=raw.match(/^(\d{4})(?:\s*-\s*(\d{1,2})\s+(.+))?$/);
    if(explicit&&!explicit[2]) return {date:explicit[1]+'-01-01',yearOnly:true};
    const exact=raw.match(/^\d{4}-\d{2}-\d{2}$/);
    const day=exact?raw.slice(8,10):explicit?explicit[2].padStart(2,'0'):'01';
    const year=exact?raw.slice(0,4):explicit?.[1]||previousYear;
    const monthText=D.foldImport(explicit?.[3]||raw);
    const month=exact?Number(raw.slice(5,7))-1:months.findIndex(name=>monthText.startsWith(name));
    if(!year||month<0||month>11) throw Error('Date non reconnue : '+raw);
    const date=year+'-'+String(month+1).padStart(2,'0')+'-'+day;
    const parsed=new Date(date+'T12:00:00Z');
    if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==date) throw Error('Date invalide : '+raw);
    return {date,inferredYear:!exact&&!explicit};
  }
  const signature=entry=>JSON.stringify([D.foldImport(entry.name),D.foldImport(D.importPlatform(entry.platform)),entry.date,entry.completion]);
  function parse(text){
    const file=text.replace(/^\uFEFF/,'');
    const first=file.split(/\r?\n/,1)[0];
    const delimiter=[',',';','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
    const [header,...rows]=D.parseDelimited(file,delimiter);
    if(!header) throw Error('Le fichier CSV est vide.');
    const normalized=header.map(D.foldImport);
    const indexes=headers.map(label=>normalized.indexOf(label));
    if(indexes.some(index=>index<0)) throw Error('Les colonnes du CSV ROM COMPLETE n’ont pas été reconnues.');
    const seen=new Map();
    let year='';
    return rows.map((row,index)=>{
      const [rawDate,approx,platform,name,medium,mode,level,...last]=indexes.map(i=>clean(row[i]));
      try{
        const parsed=readDate(rawDate,year);
        year=parsed.date.slice(0,4);
        const format=support[emoji(medium)], completion=levels[emoji(level)], playMode=modes[emoji(mode)];
        if(!name||!platform||!format||!completion||!playMode) throw Error('Titre, plateforme ou symbole non reconnu.');
        const notes=last.slice(0,5).map(value=>value==='-'||value==='–'?'':value.toUpperCase());
        const feeling=feelings[emoji(last[5])]||'';
        if(notes.some(value=>!['','D','C','B','A','S','S+'].includes(value))||(!feeling&&last[5])) throw Error('Note ou ressenti non reconnu.');
        const entry={group:'completed',name,platform:D.importPlatform(platform),date:parsed.date,estimated:!!approx||!!parsed.inferredYear||!!parsed.yearOnly,yearOnly:!!parsed.yearOnly,mode:playMode,completion,notes,feeling,...format};
        const key=signature(entry);
        const occurrence=(seen.get(key)||0)+1;
        seen.set(key,occurrence);
        return {entry:{...entry,importKey:'rom-csv:'+key+':'+occurrence},inferredYear:!!parsed.inferredYear,rawDate};
      }catch(error){throw Error('Ligne '+(index+2)+' · '+error.message);}
    });
  }
  const api={parse,signature};
  root.JTDJournalImport=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
