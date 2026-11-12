async function openCollectionMenu(page){
 if(await page.locator('#collection-views').isHidden()) await page.locator('[data-page="library"]').click();
}
const {chromium}=require('playwright');
const path=require('node:path');
const os=require('node:os');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME || process.env.CHROME_PATH,args:['--no-sandbox']});
 const results=[];
 for(const width of [1440,390,320]){
  const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:'light'});
  await context.addInitScript(() => localStorage.setItem('jtd:theme','light'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForSelector('#app-shell:not(.hidden)');
  const theme='dark';
   for(const name of ['home','collection']){
    await openCollectionMenu(page);await page.click(`[data-page="${name}"]`);
    if(name === 'collection') {
      const ratios = await page.evaluate(() => {
        const parent = document.querySelector('.card');
        const group = document.createElement('div');
        group.className = 'card-identity'; parent.appendChild(group);
        const ctx = document.createElement('canvas').getContext('2d');
        function luminance(color) {
          ctx.clearRect(0,0,1,1); ctx.fillStyle = color; ctx.fillRect(0,0,1,1);
          const rgb = ctx.getImageData(0,0,1,1).data;
          const linear = Array.from(rgb).slice(0,3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
          return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
        }
        const result = [];
        // Transparent status text is painted over the card and its ancestor layers.
        function background(element) {
          const ancestors = [];for(let node=element;node;node=node.parentElement) ancestors.push(node);
          ctx.clearRect(0,0,1,1);ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);
          for(const node of ancestors.reverse()){ctx.fillStyle=getComputedStyle(node).backgroundColor;ctx.fillRect(0,0,1,1);}
          const rgb=ctx.getImageData(0,0,1,1).data;return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        }
        for(const status of ['todo','multi','done','elsewhere']) {
          const badge = document.createElement('button'); badge.className = 'card-status-badge';
          badge.style.setProperty('--status-color', `var(--status-${status})`);
          badge.style.setProperty('--status-fill', `var(--status-${status}-fill)`);
          badge.style.transition = 'none'; badge.textContent = status; group.appendChild(badge);
          for(const state of ['normal','hover']) {
            if(state === 'hover') badge.style.background = 'color-mix(in srgb,var(--status-fill) 36%,var(--surface))';
            const css = getComputedStyle(badge), backdrop=background(badge), a = luminance(css.color), b = luminance(backdrop);
            result.push({status,state,ratio:(Math.max(a,b) + .05)/(Math.min(a,b) + .05)});
          }
          badge.remove();
        }
        const add=document.getElementById('add-btn');
        const addInk=luminance(getComputedStyle(add).color),addBackdrop=luminance(background(add));
        result.push({status:'add-game',state:'normal',ratio:(Math.max(addInk,addBackdrop)+.05)/(Math.min(addInk,addBackdrop)+.05)});
        group.remove(); return result;
      });
      if(ratios.some(tag => tag.ratio < 4.5)) throw Error(JSON.stringify({theme,width,ratios}));
      console.log(JSON.stringify({theme,width,tagContrast:ratios}));
    }
    await page.screenshot({path:path.join(os.tmpdir(),"jtd-"+width+"-dark-"+name+".png"),fullPage:true});
    const state=await page.evaluate(()=>({theme:getComputedStyle(document.documentElement).colorScheme,overflow:document.documentElement.scrollWidth>innerWidth,body:getComputedStyle(document.body).backgroundColor,button:document.getElementById('global-search-open').getBoundingClientRect().toJSON(),profile:document.getElementById('profile-menu-btn').getBoundingClientRect().toJSON(),brand:document.querySelector('.brand-word').getBoundingClientRect().toJSON()}));
    if(state.overflow||state.theme!==theme||state.brand.right>state.button.x||state.profile.right>width)throw Error(JSON.stringify({width,name,state}));
   }
   await page.click('#add-btn');await page.waitForSelector('#modal-overlay:not(.hidden)');await page.screenshot({path:path.join(os.tmpdir(),'jtd-'+width+'-dark-modal.png'),fullPage:true});await page.click('#cancel-btn');
   await page.click('#profile-menu-btn');await page.waitForSelector('#profile-menu:not(.hidden)');await page.click('#profile-menu-btn');
  if(await page.locator('#theme-toggle').count())throw Error('Unexpected theme control');
  for(const colorScheme of ['dark','light']){
   await page.emulateMedia({colorScheme});
   if(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)!=='dark')throw Error('System theme changed the palette');
  }
  await page.reload();await page.waitForSelector('#app-shell:not(.hidden)');
  if(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)!=='dark')throw Error('Legacy light preference changed the palette');
  if(errors.length) throw Error(errors.join('; '));
  results.push({width,errors,persistence:true});await context.close();
 }
 console.log(JSON.stringify(results));await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
