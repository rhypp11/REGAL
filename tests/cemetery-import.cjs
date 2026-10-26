/* Run in the local sandbox. Never signs in or contacts Firebase. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {createSandboxServer,sandboxContext} = require('./sandbox.cjs');
const server = createSandboxServer();
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,...(process.env.JTD_CHROME ? {executablePath:process.env.JTD_CHROME} : {}),args:['--no-sandbox']});
  try{
    const context = await sandboxContext(browser,{viewport:{width:390,height:900},colorScheme:'dark'});
    const page = await context.newPage(), errors=[], firebase=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/firebasejs|firestore.googleapis|identitytoolkit|securetoken/.test(request.url())) firebase.push(request.url());});
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('#app-shell').waitFor({state:'visible'});
    const before = await page.evaluate(()=>({
      games:GAMES.map(item=>({...item})), arrivals:ARRIVALS.map(item=>({...item})),
      wishlist:WISHLIST.map(item=>({...item})), cemetery:CEMETERY.map(item=>({...item}))
    }));
    await page.locator('#profile-menu-btn').click();
    const chooserEvent=page.waitForEvent('filechooser');
    await page.locator('.profile-maintenance').evaluate(el=>el.open=true);await page.locator('#cemetery-import-trigger').click();
    const chooser=await chooserEvent;
    const csv=[
      'JEU;NOM;Date;Source;Prix;Canal;Valeur;Gain',
      'PS5;Vente importée;2026-09-01;Fnac;30;🛜;18,50;14,25',
      'Switch 2;Fire Emblem — Test;2026-09-02;Test;59,99;🏪;45;35',
      'Switch 2;Jeu Multi — Test;2026-09-03;Test;59,99;;45;25',
      'PS5;Terminé ailleurs — Test;2026-09-04;Test;24,99;;20;21',
      'PS4;Encore à vendre;2026-08-15;Micromania;12;🏪;10;',
      'PS5;Kena: Bridge of Spirits — Test;;;;;;'
    ].join('\n');
    await chooser.setFiles({name:'cimetiere.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
    assert.match(await page.locator('#cemetery-import-summary').textContent(),/2 ajout\(s\) direct\(s\).*3 correspondance/);
    assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),true,'collection matches require an explicit choice');
    assert.equal(await page.locator('#cemetery-import-review-title').textContent(),'3 jeux à revoir');
    assert.equal(await page.locator('.cemetery-import-row.needs-review').count(),3);
    assert.equal(await page.locator('.cemetery-import-other').getAttribute('open'),null,'other entries are collapsed when matches require review');
    await page.locator('.cemetery-import-row[data-kind="match"] .cemetery-import-action select:not(.cemetery-import-source)').nth(0).selectOption('transfer');
    await page.locator('.cemetery-import-row[data-kind="match"] .cemetery-import-action select:not(.cemetery-import-source)').nth(1).selectOption('skip');
    await page.locator('.cemetery-import-row[data-kind="match"] .cemetery-import-action select:not(.cemetery-import-source)').nth(2).selectOption('keep');
    assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),false);
    assert.equal(await page.locator('#cemetery-import-review-title').textContent(),'Correspondances vérifiées');
    assert.equal(await page.locator('.cemetery-import-row.needs-review').count(),0);
    await page.locator('#cemetery-import-apply').click();
    await page.locator('#cemetery-import-overlay').waitFor({state:'hidden'});
    const after=await page.evaluate(()=>({
      games:GAMES, arrivals:ARRIVALS, wishlist:WISHLIST, cemetery:CEMETERY
    }));
    assert.equal(after.games.some(item=>item.id==='test-fe'),false,'transfer removes only the matched collection game');
    assert.ok(after.games.some(item=>item.id==='test-party'),'skip leaves the collection untouched');
    assert.ok(after.games.some(item=>item.id==='test-elsewhere'),'keep leaves the collection copy in place');
    assert.equal(after.games.length,before.games.length-1);
    assert.deepEqual(after.arrivals,before.arrivals);
    assert.deepEqual(after.wishlist,before.wishlist);
    const sold=after.cemetery.find(item=>item.nom==='Vente importée');
    assert.equal(sold.saleStatus,'sold');assert.equal(sold.salePrice,14.25);assert.equal(sold.estimatedPrice,18.5);
    assert.equal(sold.prix,30);assert.equal(sold.saleChannel,'online');
    const pending=after.cemetery.find(item=>item.nom==='Encore à vendre');
    assert.equal(pending.saleStatus,'pending');assert.equal(pending.salePrice,undefined);assert.equal(pending.estimatedPrice,10);
    const transferred=after.cemetery.find(item=>item.id==='test-fe');
    assert.equal(transferred.salePrice,35);assert.equal(transferred.prix,59.99);assert.equal(transferred.japanese,true);
    const keptCopy=after.cemetery.find(item=>item.nom==='Terminé ailleurs — Test');
    assert.ok(keptCopy && keptCopy.id!=='test-elsewhere','keep creates a separate cemetery entry');
    assert.equal(keptCopy.salePrice,21);
    assert.equal(after.cemetery.filter(item=>item.nom==='Kena: Bridge of Spirits — Test').length,1,'an existing cemetery row is skipped');
    await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>CEMETERY.find(item=>item.nom==='Vente importée').salePrice),14.25,'import survives reload');
    assert.deepEqual(await page.evaluate(()=>ARRIVALS),before.arrivals,'arrivals remain unchanged after reload');
    assert.deepEqual(await page.evaluate(()=>WISHLIST),before.wishlist,'wishlist remains unchanged after reload');
    assert.equal(await page.evaluate(()=>buildBackupPayload().data.cemetery.find(item=>item.nom==='Vente importée').salePrice),14.25);
    await page.locator('#profile-menu-btn').click();
    await page.locator('#cemetery-import-input').setInputFiles({name:'colonnes.tsv',mimeType:'text/tab-separated-values',buffer:Buffer.from('\ufeffGain\tJeu\tLieu d’achat\tPlateforme\tDate d’achat\tPrix\tValeur\n0\tConsole de test\tBrocante\tPSV\t\t12\t9\n\tCartouche test\tMarché\tNSW\t02/10/2026\t5\t7')});
    await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
    assert.match(await page.locator('#cemetery-import-list').textContent(),/Date d’achat non renseignée/);
    await page.locator('#cemetery-import-apply').click();
    const hardware=await page.evaluate(()=>CEMETERY.find(g=>g.nom==='Console de test'));
    assert.equal(hardware.plateforme,'PlayStation Vita');
    assert.equal(hardware.date,undefined);assert.equal(hardware.source,'Brocante');
    assert.equal(hardware.salePrice,0);assert.equal(hardware.prix,12);
    const cartridge=await page.evaluate(()=>CEMETERY.find(g=>g.nom==='Cartouche test'));
    assert.equal(cartridge.plateforme,'Nintendo Switch');assert.equal(cartridge.date,'2026-10-02');
    assert.equal(cartridge.estimatedPrice,7);assert.equal(cartridge.saleStatus,'pending');
    await page.reload();await page.locator('#app-shell').waitFor({state:'visible'});
    const cemeteryCount=await page.evaluate(()=>CEMETERY.length);
    await page.locator('#profile-menu-btn').click();
    const secondChooserEvent=page.waitForEvent('filechooser');
    await page.locator('.profile-maintenance').evaluate(el=>el.open=true);await page.locator('#cemetery-import-trigger').click();
    const secondChooser=await secondChooserEvent;
    await secondChooser.setFiles({name:'cimetiere.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
    assert.match(await page.locator('#cemetery-import-summary').textContent(),/0 ajout\(s\) direct\(s\).*2 correspondance/);
    for(const action of await page.locator('.cemetery-import-row[data-kind="match"] .cemetery-import-action select:not(.cemetery-import-source)').all()) await action.selectOption('skip');
    assert.equal(await page.locator('#cemetery-import-apply').isDisabled(),true,'a repeated import cannot add duplicate rows');
    await page.locator('#cemetery-import-cancel').click();
    const lotBackup={app:'Jeux Tout Doux',version:4,data:{cemetery:[
      {id:'import-lot-1',nom:'Lot importé A',plateforme:'PS4',saleStatus:'sold',saleId:'sheet-lot-1',saleOrder:1,salePrice:42.5},
      {id:'import-lot-2',nom:'Lot importé B',plateforme:'PS4',saleStatus:'sold',saleId:'sheet-lot-1',saleOrder:1,salePrice:42.5}
    ]}};
    await page.locator('#profile-menu-btn').click();
    const lotChooserEvent=page.waitForEvent('filechooser');
    await page.locator('.profile-maintenance').evaluate(el=>el.open=true);await page.locator('#cemetery-import-trigger').click();
    const lotChooser=await lotChooserEvent;
    await lotChooser.setFiles({name:'lot.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lotBackup))});
    await page.locator('#cemetery-import-overlay').waitFor({state:'visible'});
    await page.locator('#cemetery-import-apply').click();
    const importedLot=await page.evaluate(()=>CEMETERY.filter(item=>item.saleId==='sheet-lot-1'));
    assert.equal(importedLot.length,2);assert.equal(importedLot[0].salePrice,42.5);
    assert.equal(await page.evaluate(()=>CEMETERY.length),cemeteryCount+2);
    assert.deepEqual(errors,[]);assert.deepEqual(firebase,[]);
    console.log('PASS cemetery import: Gain/Valeur, pending rows, explicit match choice, transfer metadata, duplicate skip, board isolation, reload, v4 backup, sale lot, no Firebase');
    await context.close();
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});


