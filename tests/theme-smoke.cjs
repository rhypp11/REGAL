const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light'});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='localhost')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8').replace("location.hostname === 'jtd-preview-rhypp11.web.app'","location.hostname === 'localhost'")});
   return route.continue();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/');await page.waitForSelector('#app-shell:not(.hidden)');
  for(const theme of ['light','dark']){
   if(theme==='dark')await page.click('#theme-toggle');
   for(const name of ['home','collection']){
    await page.click(`[data-page="${name}"]`);
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
        group.remove(); return result;
      });
      if(ratios.some(tag => tag.ratio < 4.5)) throw Error(JSON.stringify({theme,width,ratios}));
      console.log(JSON.stringify({theme,width,tagContrast:ratios}));
    }
    await page.screenshot({path:`/tmp/jtd-${width}-${theme}-${name}.png`,fullPage:true});
    const state=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth,body:getComputedStyle(document.body).backgroundColor,button:document.getElementById('theme-toggle').getBoundingClientRect().toJSON(),profile:document.getElementById('profile-menu-btn').getBoundingClientRect().toJSON(),brand:document.querySelector('.brand-word').getBoundingClientRect().toJSON()}));
    if(state.overflow||state.theme!==theme||state.brand.right>state.button.x||state.profile.right>width)throw Error(JSON.stringify({width,name,state}));
   }
   await page.click('#add-btn');await page.waitForSelector('#modal-overlay:not(.hidden)');await page.screenshot({path:`/tmp/jtd-${width}-${theme}-modal.png`,fullPage:true});await page.click('#cancel-btn');
   await page.click('#profile-menu-btn');await page.waitForSelector('#profile-menu:not(.hidden)');await page.click('#profile-menu-btn');
  }
  await page.reload();await page.waitForSelector('#app-shell:not(.hidden)');
  if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')throw Error('Theme persistence');
  if(errors.length) throw Error(errors.join('; '));
  results.push({width,errors,persistence:true});await context.close();
 }
 const context=await browser.newContext({colorScheme:'dark'});await context.route('**/*', route => { const url = new URL(route.request().url()); if(url.hostname !== 'localhost') return route.abort(); if(url.pathname === '/') return route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8').replace("location.hostname === 'jtd-preview-rhypp11.web.app'","location.hostname === 'localhost'")}); return route.continue(); });const page=await context.newPage();await page.goto('http://localhost:8765/');if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')throw Error('system preference');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='light')throw Error('system update');results.push({systemPreference:true});
 console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
