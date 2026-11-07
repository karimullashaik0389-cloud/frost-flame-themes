import { chromium, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = '/workspace/emergent_themes_addon/screenshots/themes/fix_1107';
const BASE = '/frost-flame-themes';
fs.mkdirSync(OUT, { recursive: true });

function startServer() {
  const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.svg':'image/svg+xml','.woff2':'font/woff2' };
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u.startsWith(BASE)) u = u.slice(BASE.length) || '/';
    if (u === '/') u = '/index.html';
    let fp = path.join(ROOT, u);
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      if (u === '/api/menu' && fs.existsSync(path.join(ROOT,'api/menu'))) fp = path.join(ROOT,'api/menu');
      else if (!path.extname(u)) fp = path.join(ROOT,'index.html');
    }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(r => server.listen(0,'127.0.0.1',()=>r({server, origin:`http://127.0.0.1:${server.address().port}${BASE}`})));
}

async function timeTo(page, label, act, sel, timeout=6000) {
  const t0 = Date.now();
  await act();
  try { await page.waitForSelector(sel, { state:'visible', timeout }); return {label, ms:Date.now()-t0, ok:true}; }
  catch(e){ return {label, ms:Date.now()-t0, ok:false, err:String(e.message||e).slice(0,120)}; }
}

async function run(engine, name, origin, vp) {
  const browser = await engine.launch({ headless:true });
  const ctx = await browser.newContext({
    viewport:{width:vp.w,height:vp.h}, deviceScaleFactor: vp.phone?2:1,
    isMobile:!!vp.phone, hasTouch:!!vp.phone,
    userAgent: vp.phone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined
  });
  const page = await ctx.newPage();
  const tag = `${name}_${vp.name}`;
  const out = { tag, checks:[], timings:[] };
  try {
    await page.goto(origin+'/?fresh=1', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(300);
    const title = (await page.locator('#ff-tree-root .ff-tree-title').first().textContent().catch(()=>''))||'';
    out.checks.push({k:'entry_greeting', v:title.trim()});
    await page.screenshot({ path: path.join(OUT, `${tag}_after_entry_gate.png`) });

    let t = await timeTo(page, 'skip_entry', async()=>{
      const s=page.locator('[data-testid="ff-tree-skip"]');
      if(await s.count()) await s.click(); else await page.locator('[data-ff-theme="friends"]').click();
    }, 'body[class*="ff-theme-"]');
    out.timings.push(t);
    await page.waitForTimeout(200);
    out.checks.push({k:'float_auto', v: await page.locator('#ff-float-root:not([hidden])').count()});
    await page.screenshot({ path: path.join(OUT, `${tag}_home.png`) });

    await page.goto(origin+'/', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(250);
    out.checks.push({k:'gate_reload', v: await page.locator('#ff-tree-root:not([hidden])').count()});

    await page.goto(origin+'/menu?group=friends', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(500);
    out.checks.push({k:'gate_deep', v: await page.locator('#ff-tree-root:not([hidden])').count()});
    out.checks.push({k:'idly', v: await page.locator('text=Idly with chutney').count()});
    out.checks.push({k:'mood_chip', v: await page.locator('#ff-theme-greet:not([hidden]).is-on').count()});
    await page.screenshot({ path: path.join(OUT, `${tag}_menu.png`) });

    // open mutton size picker
    const choose = page.locator('article:has-text("Mutton Pulao"):not(:has-text("Gongura")) button:has-text("Choose"), article:has-text("Mutton Pulao"):not(:has-text("Gongura")) button:has-text("Add")').first();
    if (await choose.count()) {
      t = await timeTo(page, 'size_picker', async()=> choose.click(), '[data-testid="quick-view"], [role="dialog"]');
      out.timings.push(t);
      await page.waitForTimeout(400);
      out.checks.push({k:'single', v: await page.locator('[data-testid="quick-view"] >> text=Single, [role="dialog"] >> text=Single').count()});
      await page.screenshot({ path: path.join(OUT, `${tag}_size.png`) });
      await page.keyboard.press('Escape').catch(()=>{});
    } else out.checks.push({k:'mutton_btn', v:0});

    // More + games brightness + close
    t = await timeTo(page, 'more', async()=>{
      const h=page.locator('#ff-fab-handle.is-on'); if(await h.isVisible().catch(()=>false)) await h.click();
      await page.locator('#ff-more-btn').click({force:true});
    }, '#ff-more-sheet:not([hidden])');
    out.timings.push(t);
    out.checks.push({k:'games_bright', v: await page.locator('.ff-more-item--games').count()});
    out.checks.push({k:'close_vis', v: await page.locator('[data-testid="ff-more-close"]').isVisible()});
    await page.screenshot({ path: path.join(OUT, `${tag}_more.png`) });

    t = await timeTo(page, 'frosty', async()=>{
      await page.locator('[data-testid="ff-more-frosty"]').click();
    }, '#ff-frosty-chat:not([hidden])');
    out.timings.push(t);
    await page.screenshot({ path: path.join(OUT, `${tag}_frosty.png`) });
    await page.locator('#ff-frosty-chat .ff-fr-x').first().click().catch(()=>{});

    // frosty quick visible on menu
    await page.goto(origin+'/menu?group=friends', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(400);
    out.checks.push({k:'frosty_quick', v: await page.locator('#ff-frosty-quick').count()});

    // add + cart
    await page.goto(origin+'/menu/frost?group=friends', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(500);
    const add = page.locator('article button:has-text("Add")').first();
    if (await add.count()) {
      t = await timeTo(page, 'add', async()=> add.click(), '[data-testid="sticky-cart-bar"], text=/added/i, [data-sonner-toast]');
      out.timings.push(t);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${tag}_added.png`) });
    }
    await page.goto(origin+'/cart?group=friends', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(600);
    out.checks.push({k:'cart_edit', v: await page.locator('.ff-cart-edit, [data-testid="ff-cart-edit"]').count()});
    await page.screenshot({ path: path.join(OUT, `${tag}_cart.png`) });

    // compare-ish: ensure Emergent tokens not heavily overridden
    const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg').trim() || getComputedStyle(document.body).backgroundColor);
    out.checks.push({k:'bg_token', v: bg});
  } catch (e) {
    out.fatal = String(e).slice(0,400);
    await page.screenshot({ path: path.join(OUT, `${tag}_FATAL.png`) }).catch(()=>{});
  }
  await browser.close();
  return out;
}

const {server, origin} = await startServer();
console.log('origin', origin);
const all=[];
try {
  for (const [eng,name] of [[chromium,'chromium'],[webkit,'webkit']]) {
    for (const vp of [{name:'phone',w:390,h:844,phone:true},{name:'desktop',w:1280,h:800,phone:false}]) {
      console.log('run', name, vp.name);
      const r = await run(eng, name, origin, vp);
      all.push(r);
      console.log(JSON.stringify({tag:r.tag, timings:r.timings, checks:r.checks, fatal:r.fatal||null}, null, 0));
    }
  }
} finally { server.close(); }
fs.writeFileSync(path.join(OUT,'smoke_report.json'), JSON.stringify({origin, at:new Date().toISOString(), all}, null, 2));
const bad = all.flatMap(a => (a.timings||[]).filter(t=>!t.ok));
const fatals = all.filter(a=>a.fatal);
console.log('FAIL_TIMINGS', bad.length, 'FATALS', fatals.length);
process.exit(fatals.length ? 1 : 0);
