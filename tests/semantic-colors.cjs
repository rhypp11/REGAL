/* Repères sémantiques comparés à la palette précédant REGAL (66ebd7e).
   Données fictives, sans accès externe ni Firebase. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#app-shell').waitFor({state:'visible'});
   await page.evaluate(()=>{
    const months=Array.from({length:12},(_,i)=>({id:'color-'+i,nom:'Jeu fictif '+i,plateforme:'PC',date:`2030-${String(i+1).padStart(2,'0')}-10`,format:'Physique'}));
    WISHLIST=months.map(x=>({...x}));ARRIVALS=months.map(x=>({...x,id:'arrival-'+x.id}));
    WISHLIST.push({id:'loose',nom:'Sans date',plateforme:'PC',date:''});ARRIVALS.push({id:'arrival-loose',nom:'Sans date',plateforme:'PC',date:''});
    renderWishlist();renderArrivals();goToPage('home');
   });
   const palette=await page.evaluate(()=>{
    const root=getComputedStyle(document.documentElement),ctx=document.createElement('canvas').getContext('2d');
    const value=name=>root.getPropertyValue('--'+name).trim();
    const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    const months=[...document.querySelectorAll('#home-boards .calendar-group-head:not(.calendar-group-head-loose)')].map(el=>{
     const css=getComputedStyle(el),title=getComputedStyle(el.querySelector('strong')),accent=css.getPropertyValue('--calendar-accent').trim();
     const foreground=rgb(title.color),background=rgb(css.backgroundColor),year=getComputedStyle(el.querySelector('.calendar-group-title span'));
     return {accent,background:css.backgroundColor,title:title.color,contrast:Math.min(contrast(foreground,background),contrast(rgb(year.color),background))};
    });
    const dates=[...document.querySelectorAll('#home-boards .calendar-day:not(.calendar-day-loose)')].map(el=>{
     const background=getComputedStyle(el).backgroundColor;
     return {background,contrast:Math.min(...[...el.children].map(child=>contrast(rgb(getComputedStyle(child).color),rgb(background))))};
    });
    return {wishlist:value('wishlist'),arrival:value('arrival'),warm:value('warm-rgb'),salmon:value('status-salmon'),months,monthSource:MONTH_COLORS,dates,dateSource:MONTH_DATE_COLORS,dateBackgrounds:MONTH_DATE_COLORS.map(color=>'rgb('+rgb(color).join(', ')+')'),
     statuses:['todo','multi','done','elsewhere'].map(x=>value('status-'+x)),platforms:Object.values(PLATFORM_COLORS)};
   });
   assert.equal(palette.wishlist,theme==='light'?'#8B3D11':'#FFB876');
   assert.equal(palette.arrival,theme==='light'?'#0B6257':'#78DCC6');
   assert.equal(palette.warm,theme==='light'?'187,98,72':'212,161,137');
   assert.equal(palette.salmon,theme==='light'?'#A14F38':'#D4A189');
   assert.equal(palette.months.length,24);assert.equal(new Set(palette.months.map(x=>x.background)).size,12);
   assert.deepEqual(palette.monthSource,['#45818E','#38761D','#6AA84F','#F1C232','#E69138','#B45F06','#E06666','#990000','#741B47','#351C75','#0B5394','#6D9EEB']);
   assert.deepEqual(palette.months.slice(0,12).map(x=>x.accent),palette.monthSource);
   assert.deepEqual(palette.months.slice(12).map(x=>x.accent),palette.monthSource);
   assert.ok(palette.months.every(x=>x.contrast>=4.5),JSON.stringify(palette.months.filter(x=>x.contrast<4.5)));
   assert.deepEqual(palette.dateSource,['#A2C4C9','#93C47D','#B6D7A8','#FFD966','#F6B26B','#E69138','#EA9999','#E06666','#A64D79','#B4A7D6','#9FC5E8','#C9DAF8']);
   assert.deepEqual(palette.dates.map(x=>x.background),[...palette.dateBackgrounds,...palette.dateBackgrounds]);
   assert.ok(palette.dates.every(x=>x.contrast>=4.5),JSON.stringify(palette.dates.filter(x=>x.contrast<4.5)));
   assert.deepEqual(palette.statuses,theme==='light'?['#805211','#594082','#35582D','#325D84']:['#F1D49F','#CAB7F0','#B4D4A3','#A8C9EA']);
   assert.ok(new Set(palette.platforms).size>10,'Les plateformes conservent leur palette distincte');
   for(const [board,token,view] of [['wishlist','wishlist','pending'],['arrivals','arrival','sold']]){
    const colors=await page.evaluate(({board,token,view})=>{
     goToPage('home');setHomeBoard(board);
     const probe=document.createElement('span');probe.style.color=`var(--${token})`;document.body.appendChild(probe);
     const expected=getComputedStyle(probe).color;probe.remove();
     const elements=[...document.querySelectorAll(`#home-boards .${board} .board-head-icon, #home-boards .${board} .board-add-btn`)];
     if(innerWidth<=820)elements.push(document.querySelector(`.home-boards-switch-btn[data-target="${board}"]`));
     const actual=elements.map(el=>getComputedStyle(el).color);
     goToPage('cemetery');setSaleView(view);
     actual.push(getComputedStyle(document.querySelector(`.cemetery-tab[data-sale-view="${view}"]`)).color);
     return {actual,expected};
    },{board,token,view});
    assert.ok(colors.actual.length>=3);assert.ok(colors.actual.every(x=>x===colors.expected),JSON.stringify(colors));
   }
   await page.evaluate(()=>{
    goToPage('cemetery');
    // Tester les états visuels sans lancer de connexion cloud.
    const sync=document.getElementById('cloud-sync-status');sync.textContent='État fictif';sync.classList.remove('hidden');
   });
   const states=[];
   for(const status of ['ok','pending','syncing','error']){
    states.push(await page.evaluate(status=>{const el=document.getElementById('cloud-sync-status');el.className='cloud-sync-status '+status;return getComputedStyle(el).color;},status));
   }
   assert.equal(new Set(states).size,3);assert.equal(states[1],states[2]);
   assert.deepEqual(errors,[]);console.log(`PASS semantic colors ${width}px ${theme}: 12 months × 2 lists, categories, completion and sync states`);
   await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
