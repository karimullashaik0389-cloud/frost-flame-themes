import { chromium } from '/workspace/frost_flame_qr_billing/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE='http://127.0.0.1:45116';
const OUT='/workspace/emergent_themes_addon/screenshots/themes';
fs.mkdirSync(OUT,{recursive:true});
const THEMES=['solo_m','solo_f','friends','couple','gang','family','family_kids'];
const report={assertions:[],pageErrors:[],consoleErrors:[]};
const check=(c,m)=>{report.assertions.push({ok:!!c,msg:m}); if(!c) console.error('FAIL',m); else console.log('OK',m);};

const browser=await chromium.launch({headless:true});

async function shot(page,name){await page.screenshot({path:`${OUT}/${name}.png`});}

async function measure(page){
  return page.evaluate(()=>{
    const r=el=>el?(()=>{const b=el.getBoundingClientRect();return{x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),hidden:!!el.hidden,cls:String(el.className).slice(0,80),disp:getComputedStyle(el).display,txt:(el.innerText||'').replace(/\s+/g,' ').slice(0,40)};})():null;
    const login=document.querySelector('[data-testid="header-account-link"]');
    const lr=login?.getBoundingClientRect();
    const cover=lr?document.elementsFromPoint(lr.left+lr.width/2,lr.top+lr.height/2).slice(0,5).map(e=>({id:e.id,tid:e.getAttribute('data-testid'),tag:e.tagName})):[];
    return{
      dock:r(document.getElementById('ff-fab-dock')),
      games:r(document.getElementById('ff-fab-games')),
      stories:r(document.getElementById('ff-fab-stories')),
      frosty:r(document.querySelector('[data-testid="frosty-fab"]')),
      handle:r(document.getElementById('ff-fab-handle')),
      change:r(document.getElementById('ff-tree-change')),
      login:r(login),
      coverLogin:cover,
      tucked:document.getElementById('ff-fab-dock')?.classList.contains('is-tucked'),
      playOpen:!(document.getElementById('ff-play-modal')?.hidden),
      brandLeft: (()=>{const b=document.querySelector('header a, header [data-testid]'); return true;})()
    };
  });
}

// Mobile no-theme fresh — tree open, dock hidden
{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.goto(BASE+'/?fresh=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.FFChrome&&window.FFPlay,{timeout:20000});
  await page.waitForTimeout(1000);
  let m=await measure(page);
  check(m.dock && m.dock.disp==='none','mobile fresh: dock hidden while tree open');
  await shot(page,'after_tree_open_no_fabs');
  await ctx.close();
}

// Mobile each theme
for(const t of THEMES){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.goto(BASE+'/menu?group='+t,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.FFChrome&&window.FFPlay,{timeout:20000});
  await page.evaluate(()=>{try{window.FFFloatMenu?.hide?.()}catch(e){}});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>window.FFChrome?.tick?.());
  await page.waitForTimeout(400);
  let m=await measure(page);
  check(m.games && m.games.w>=50 && m.games.x>200, t+': Games FAB on right');
  check(m.stories && m.stories.w>=50 && m.stories.x>200, t+': Stories FAB on right');
  check(m.frosty && m.frosty.w<=70 && m.frosty.x>200, t+': Frosty small on right');
  check(m.change && m.change.x < 120, t+': theme chip on left (not over login)');
  check(!m.coverLogin.some(c=>c.id==='ff-tree-change'), t+': change chip not covering login point');
  // login clickable
  let loginOk=false;
  try{
    await page.click('[data-testid="header-account-link"]',{timeout:2500});
    await page.waitForTimeout(600);
    loginOk=/login|account|signup/i.test(page.url()) || await page.locator('input, [data-testid*="login"], [data-testid*="account"]').count()>0;
    // go back to menu for remaining checks
    await page.goto(BASE+'/menu?group='+t,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.FFChrome);
    await page.evaluate(()=>{try{window.FFFloatMenu?.hide?.()}catch(e){}});
    await page.waitForTimeout(800);
  }catch(e){ loginOk=false; console.error('login err', e.message); }
  check(loginOk, t+': login click reaches account/login');

  // open games modal
  await page.click('#ff-fab-games');
  await page.waitForSelector('#ff-play-modal:not([hidden])');
  check(await page.locator('#ff-play-modal:not([hidden])').count()===1, t+': Games opens modal');
  await page.keyboard.press('Escape');
  await page.click('#ff-fab-stories');
  await page.waitForSelector('#ff-play-modal:not([hidden])');
  check(await page.locator('#ff-play-sheet').count()===1, t+': Stories opens modal');
  await page.keyboard.press('Escape');

  if(t==='gang' || t==='couple'){
    await shot(page, 'after_fabs_'+t+'_mobile');
  }
  await ctx.close();
}

// Desktop gang
{
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await ctx.newPage();
  await page.goto(BASE+'/menu?group=gang',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.FFChrome);
  await page.evaluate(()=>{try{window.FFFloatMenu?.hide?.()}catch(e){}});
  await page.waitForTimeout(1000);
  await page.evaluate(()=>window.FFChrome.tick());
  await page.waitForTimeout(300);
  const m=await measure(page);
  check(m.games && m.games.x>1000, 'desktop: Games on right');
  check(m.frosty && m.frosty.w<=72, 'desktop: Frosty compact');
  await shot(page,'after_fabs_gang_desktop');
  await ctx.close();
}

// Cart tuck flow
{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  await page.goto(BASE+'/menu?group=friends',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.FFChrome&&window.FFPlay);
  await page.evaluate(()=>{try{window.FFFloatMenu?.hide?.()}catch(e){}});
  await page.waitForTimeout(1000);
  // Simulate cart count by patching badge + sticky bar if possible, and fire ff:added
  await page.evaluate(()=>{
    let badge=document.querySelector('[data-testid="cart-count-badge"]');
    if(badge) badge.textContent='2';
    else {
      const b=document.createElement('span'); b.setAttribute('data-testid','cart-count-badge'); b.textContent='2'; document.body.appendChild(b);
    }
    // fake sticky cart bar
    if(!document.querySelector('[data-testid="sticky-cart-bar"]')){
      const bar=document.createElement('div');
      bar.setAttribute('data-testid','sticky-cart-bar');
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;height:56px;background:#111;z-index:40';
      document.body.appendChild(bar);
    }
    sessionStorage.removeItem('ff_fab_force_show');
    window.dispatchEvent(new Event('ff:added'));
    window.FFChrome.tick();
  });
  await page.waitForTimeout(500);
  let m=await measure(page);
  check(m.tucked===true, 'cart items: dock tucked');
  check(m.handle && !m.handle.hidden && m.handle.disp!=='none', 'cart items: restore handle visible');
  await shot(page,'after_cart_tucked_mobile');
  // open play then tuck should close — already tucked
  // restore via handle
  await page.click('#ff-fab-handle');
  await page.waitForTimeout(400);
  m=await measure(page);
  check(m.tucked===false, 'handle restores dock');
  await shot(page,'after_fabs_restored_mobile');

  // checkout route
  await page.goto(BASE+'/cart?group=friends',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.FFChrome,{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>window.FFChrome?.tick?.());
  await page.waitForTimeout(400);
  m=await measure(page);
  check(m.tucked===true || (m.dock&&m.dock.cls.includes('is-tucked')), 'cart page: dock tucked');
  await shot(page,'after_cart_page_tucked_mobile');

  // order confirmation simulation
  await page.evaluate(()=>{
    const c=document.createElement('div');
    c.setAttribute('data-testid','order-sent-confirmation');
    c.textContent='Order sent';
    document.body.appendChild(c);
    sessionStorage.removeItem('ff_fab_force_show');
    window.FFChrome.tick();
  });
  await page.waitForTimeout(300);
  m=await measure(page);
  check(m.tucked===true, 'order confirmation: dock tucked');
  await shot(page,'after_order_tucked_mobile');
  await ctx.close();
}

const passed=report.assertions.filter(a=>a.ok).length;
const failed=report.assertions.filter(a=>!a.ok);
fs.writeFileSync(OUT+'/chrome_fabs_report.json', JSON.stringify({passed,failed:failed.length,failures:failed,pageErrors:report.pageErrors},null,2));
console.log(JSON.stringify({passed,failed:failed.length,failures:failed,pageErrors:report.pageErrors.length},null,2));
await browser.close();
process.exit(failed.length?1:0);
