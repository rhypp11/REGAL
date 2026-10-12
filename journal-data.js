/* Journal rules shared by backup validation, collection links and the UI. */
(function(root){
  'use strict';
  const statuses = ['playing','backlog','done'];
  const completions = ['finished','hundred','achievements'];
  const feelings = ['', 'gem','love','like','mixed','dislike'];
  const own = (value, field) => Object.prototype.hasOwnProperty.call(value, field);
  function string(value, label, max, optional = false){
    if(optional && value == null) return '';
    if(typeof value !== 'string' || value.length > max) throw Error('Champ du journal invalide : ' + label);
    return value.trim();
  }
  function choice(value, values, fallback, field){
    const result = value == null ? fallback : value;
    if(!values.includes(result)) throw Error('Choix du journal invalide : ' + field);
    return result;
  }
  function validDate(value){
    if(!value) return true;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function normalizeJournal(input = []){
    if(!Array.isArray(input)) throw Error('Journal invalide');
    const used = new Set();
    let sequence = 0;
    return input.map(value => {
      if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Parcours invalide');
      if(value.id != null && (!['string','number'].includes(typeof value.id) || (typeof value.id === 'number'&&!Number.isFinite(value.id)))) throw Error('Identifiant du journal invalide');
      let id = value.id == null ? '' : String(value.id);
      if(!id || used.has(id)) do {id='journal-restored-'+(++sequence);} while(used.has(id));
      used.add(id);
      const nom=string(value.nom,'titre',500), plateforme=string(value.plateforme,'plateforme',150);
      if(!nom || !plateforme) throw Error('Titre et plateforme nécessaires');
      const kind=choice(value.kind,['game','extension'],'game','type');
      const parentName=string(value.parentName,'jeu de base',500,true);
      if(kind==='extension' && !parentName) throw Error('Jeu de base nécessaire pour une extension');
      const date=string(value.finishedAt,'date de fin',10,true);
      if(!validDate(date)) throw Error('Date de fin invalide');
      let collectionId=null;
      if(value.collectionId != null && value.collectionId !== ''){
        if(!['string','number'].includes(typeof value.collectionId) || (typeof value.collectionId === 'number'&&!Number.isFinite(value.collectionId))) throw Error('Lien collection invalide');
        collectionId=String(value.collectionId);
      }
      if(kind==='extension' && collectionId) throw Error('Une extension reste indépendante de la collection');
      return {id,nom,plateforme,kind,parentName:kind==='extension'?parentName:'',collectionId,
        status:choice(value.status==='abandoned'?'backlog':value.status,statuses,'backlog','statut'),
        completion:choice(value.completion==='both'?'achievements':value.completion,completions,'finished','complétion'),
        medium:choice(value.medium,['physical','digital'],'digital','support'),
        access:choice(value.access,['owned','subscription','family','emulation'],'owned','accès'),
        finishedAt:date,feeling:choice(value.feeling,feelings,'','ressenti'),
        review:string(value.review,'avis',20000,true),image:string(value.image,'image',200000,true),
        imageFit:value.imageFit==='cover'?'cover':'contain'};
    });
  }
  function collectionProgress(journal, id){
    const records=journal.filter(r=>r.kind==='game'&&r.collectionId===id);
    if(!records.length) return null;
    const completed=records.filter(r=>r.status==='done').sort((a,b)=>(b.finishedAt||'').localeCompare(a.finishedAt||''));
    const playing=records.find(r=>r.status==='playing');
    const latest=completed[0];
    const status=playing?'en_cours':latest?(latest.medium==='physical'?'termine':'termine_ailleurs'):'a_jouer';
    return {status,completion:latest?.completion||null,replay:!!playing&&!!latest,record:playing||latest||records[records.length-1]};
  }
  function syncGames(games, journal){
    return games.map(game=>{
      const progress=collectionProgress(journal,game.id);
      const next={...game};
      if(progress){
        if(!own(next,'journalPreviousStatus')) next.journalPreviousStatus=game.status??null;
        next.status=progress.status;
      }else if(own(next,'journalPreviousStatus')){
        next.status=next.journalPreviousStatus;
        delete next.journalPreviousStatus;
      }
      return next;
    });
  }
  function title(record){
    return record.kind==='extension'&&!record.nom.toLocaleLowerCase('fr').startsWith(record.parentName.toLocaleLowerCase('fr'))
      ? record.parentName+' — '+record.nom : record.nom;
  }
  const api={normalizeJournal,collectionProgress,syncGames,title,validDate};
  root.JTDJournalData=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
