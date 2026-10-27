/* Deku Deals input boundary: console purchases only, no network calls. */
(function(root){
  'use strict';
  const data=typeof module==='object' && module.exports ? require('./jtd-data.js') : root.JTDData;
  function parse(payload){
    if(!payload || !Array.isArray(payload.items) || payload.items.length>10000)throw Error('Export Deku Deals invalide : liste items attendue (10 000 entrées maximum).');
    const rows=[],ignored={platform:0,missing:0,invalid:0};
    for(const item of payload.items){
      if(!item || typeof item!=='object'){ignored.invalid++;continue;}
      if(!item.platform){ignored.missing++;continue;}
      const platform=data.importPlatform(item.platform);
      if(!['Nintendo Switch','Nintendo Switch 2'].includes(platform)){ignored.platform++;continue;}
      if(typeof item.name!=='string' || !item.name.trim() || item.name.length>400 || !['physical','digital'].includes(item.format)){ignored.invalid++;continue;}
      const currency=item.price_paid_currency || 'EUR';
      if((item.price_paid!=null && typeof item.price_paid_currency!=='string') || !['EUR','JPY','USD','GBP'].includes(currency) || (item.price_paid!=null && (!Number.isSafeInteger(item.price_paid) || item.price_paid<0))){ignored.invalid++;continue;}
      const digital=item.format==='digital';
      const kind=digital && /upgrade pack|mise [àa] niveau/i.test(item.name) ? 'upgrade' : digital && /\bDLC\b|expansion pass|season pass|extension pass|booster course pass|pass d[’']extension/i.test(item.name) ? 'dlc' : 'game';
      let link=data.safeURL(item.link);if(link && !/(^|\.)dekudeals\.com$/i.test(new URL(link).hostname))link='';
      rows.push({nom:item.name.trim(),plateforme:platform,format:digital?'Numérique':'Physique',contentType:kind,currency,prix:item.price_paid==null?null:item.price_paid/(currency==='JPY'?1:100),date:null,source:null,lien:link || null,dekuNote:typeof item.note==='string'?item.note.slice(0,2000):null,dekuAddedAt:typeof item.added_at==='string'?item.added_at.slice(0,80):null});
    }
    return {rows,ignored,total:payload.items.length};
  }
  function key(item){return data.importKey(item)+'|'+(data.isDigital(item)?'digital|'+(item.accountId || ''):'physical');}
  function plan(rows,games,cemetery=[]){
    const known=new Map(games.map(g=>[key(g),g]));const archived=new Set(cemetery.map(key));
    return rows.map(row=>{
      const candidate={...row,accountId:row.accountChoice==='__none__'?null:row.accountChoice || null};
      const signature=key(candidate);
      if(known.has(signature))return {row,candidate,status:'duplicate',match:known.get(signature)};
      if(archived.has(signature))return {row,candidate,status:'archived'};
      if(!row.selected)return {row,candidate,status:'excluded'};
      if(data.isDigital(row) && !row.accountChoice)return {row,candidate,status:'account'};
      known.set(signature,candidate);return {row,candidate,status:'add'};
    });
  }
  const api={parse,key,plan};root.JTDDeku=api;if(typeof module==='object' && module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
