/**
 * Fix verification: Chromium + WebKit, phone 390x844 + desktop 1280x800.
 * Measures click-to-visible timings; saves screenshots under fix_1107/.
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = '/workspace/emergent_themes_addon/screenshots/themes/fix_1107';
const BASE = '/frost-flame-themes';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 }
];

function startServer() {
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  };
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u.startsWith(BASE)) u = u.slice(BASE.length) || '/';
    if (u === '/') u = '/index.html';
    // SPA fallback
    let fp = path.join(ROOT, u);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      // api/menu without .json
      if (u === '/api/menu' && fs.existsSync(path.join(ROOT, 'api/menu'))) fp = path.join(ROOT, 'api/menu');
      else if (!path.extname(u)) fp = path.join(ROOT, 'index.html');
    }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}${BASE}` });
    });
  });
}

async function measure(page, label, action, visibleSel, timeout = 8000) {
  const t0 = Date.now();
  await action();
  try {
    await page.waitForSelector(visibleSel, { state: 'visible', timeout });
    return { label, ms: Date.now() - t0, ok: true };
  } catch (e) {
    return { label, ms: Date.now() - t0, ok: false, err: String(e.message || e).slice(0, 160) };
  }
}

async function runEngine(browserType, engineName, origin) {
  const browser = await browserType.launch({ headless: true });
  const results = [];
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.name === 'phone' ? 2 : 1,
      hasTouch: vp.name === 'phone',
      isMobile: vp.name === 'phone',
      userAgent: vp.name === 'phone'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined
    });
    const page = await context.newPage();
    const tag = `${engineName}_${vp.name}`;
    const log = (msg) => results.push({ tag, msg });

    try {
      // Fresh entry
      await context.clearCookies();
      await page.goto(origin + '/?fresh=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `${tag}_01_entry.png`), fullPage: false });

      // Entry should be one screen with greeting + skip
      const treeVisible = await page.locator('#ff-tree-root:not([hidden])').count();
      const title = await page.locator('#ff-tree-root .ff-tree-title').first().textContent().catch(() => '');
      log(`entry_visible=${treeVisible} title="${(title||'').trim()}"`);

      const tSkip = await measure(page, 'entry_skip_to_content', async () => {
        const skip = page.locator('[data-testid="ff-tree-skip"]');
        if (await skip.count()) await skip.click();
        else {
          const theme = page.locator('[data-ff-theme="friends"]');
          if (await theme.count()) await theme.click();
        }
      }, 'body.ff-theme-friends, body[class*="ff-theme-"]', 5000);
      results.push({ tag, timing: tSkip });
      await page.waitForTimeout(400);
      // Float should NOT auto-open
      const floatOpen = await page.locator('#ff-float-root:not([hidden])').count();
      log(`float_auto_open=${floatOpen}`);
      await page.screenshot({ path: path.join(OUT, `${tag}_02_after_entry.png`), fullPage: false });

      // Persist: reload should skip gate
      await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(500);
      const gateAgain = await page.locator('#ff-tree-root:not([hidden])').count();
      log(`gate_on_reload=${gateAgain}`);

      // Deep link skips gate
      await page.goto(origin + '/menu?group=friends', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(450);
      const gateDeep = await page.locator('#ff-tree-root:not([hidden])').count();
      log(`gate_on_deep_menu=${gateDeep}`);
      await page.screenshot({ path: path.join(OUT, `${tag}_03_menu.png`), fullPage: false });

      // Idly visible
      const idly = await page.locator('text=Idly with chutney').count();
      log(`idly_text_count=${idly}`);

      // Pulao sizes — open Mutton Pulao choose
      const muttonBtn = page.locator('article:has-text("Mutton Pulao") button, [data-testid*="mutton-pulao"]').first();
      let sizeTiming = { label: 'open_size_picker_mutton', ms: -1, ok: false };
      if (await muttonBtn.count()) {
        sizeTiming = await measure(page, 'open_size_picker_mutton', async () => {
          await muttonBtn.click();
        }, '[data-testid="quick-view"], [role="dialog"], legend:has-text("Size"), text=Single', 6000);
        results.push({ tag, timing: sizeTiming });
        await page.waitForTimeout(300);
        const hasSingle = await page.locator('text=Single').count();
        const hasMedium = await page.locator('text=Medium').count();
        const hasFamily = await page.locator('text=Family Pack').count();
        log(`size_ui single=${hasSingle} medium=${hasMedium} family=${hasFamily}`);
        await page.screenshot({ path: path.join(OUT, `${tag}_04_size_picker.png`), fullPage: false });
        // close dialog if any
        const close = page.locator('[data-testid="quick-view"] button[aria-label*="Close" i], button:has-text("Close"), [data-testid="qv-close"]').first();
        if (await close.count()) await close.click().catch(() => {});
        else await page.keyboard.press('Escape').catch(() => {});
      } else {
        log('mutton_button_missing');
      }

      // More sheet
      const moreTiming = await measure(page, 'open_more', async () => {
        // untuck if needed
        const handle = page.locator('#ff-fab-handle.is-on, [data-testid="ff-fab-handle"]');
        if (await handle.isVisible().catch(() => false)) await handle.click();
        await page.locator('[data-testid="ff-more-btn"], #ff-more-btn').click({ force: true });
      }, '[data-testid="ff-more-sheet"]:not([hidden]), #ff-more-sheet:not([hidden])', 5000);
      results.push({ tag, timing: moreTiming });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${tag}_05_more.png`), fullPage: false });
      const gamesBright = await page.locator('.ff-more-item--games, [data-testid="ff-more-games"]').count();
      const closeVisible = await page.locator('[data-testid="ff-more-close"]').isVisible().catch(() => false);
      log(`games_item=${gamesBright} close_visible=${closeVisible}`);

      // Ask Frosty quick
      const frostyQuick = await page.locator('#ff-frosty-quick, [data-testid="ff-frosty-quick"]').count();
      log(`frosty_quick=${frostyQuick}`);
      const frostyTiming = await measure(page, 'open_frosty', async () => {
        const q = page.locator('#ff-frosty-quick');
        if (await q.count() && await q.isVisible().catch(() => false)) await q.click();
        else await page.locator('[data-testid="ff-more-frosty"]').click();
      }, '#ff-frosty-chat:not([hidden]), [data-testid="ff-frosty-chat"]', 5000);
      results.push({ tag, timing: frostyTiming });
      await page.screenshot({ path: path.join(OUT, `${tag}_06_frosty.png`), fullPage: false });
      await page.locator('#ff-frosty-chat .ff-fr-x, [data-testid="ff-frosty-close"]').first().click().catch(() => {});

      // Games via More
      await page.locator('[data-testid="ff-more-btn"]').click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      const gamesTiming = await measure(page, 'open_games', async () => {
        await page.locator('[data-testid="ff-more-games"]').click();
      }, '#ff-play-modal:not([hidden]), #ff-play-sheet', 5000);
      results.push({ tag, timing: gamesTiming });
      await page.screenshot({ path: path.join(OUT, `${tag}_07_games.png`), fullPage: false });
      await page.keyboard.press('Escape').catch(() => {});

      // Add item + toast position check
      await page.goto(origin + '/menu/frost?group=friends', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(400);
      const addBtn = page.locator('article button:has-text("Add"), [data-testid*="add-"]').first();
      if (await addBtn.count()) {
        const addTiming = await measure(page, 'add_to_basket', async () => {
          await addBtn.click();
        }, 'text=/added/i, [data-sonner-toast], [data-testid="sticky-cart-bar"]', 5000);
        results.push({ tag, timing: addTiming });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, `${tag}_08_added.png`), fullPage: false });
      }

      // Cart edit button
      await page.goto(origin + '/cart?group=friends', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(OUT, `${tag}_09_cart.png`), fullPage: false });
      const editBtn = await page.locator('[data-testid="ff-cart-edit"], .ff-cart-edit').count();
      log(`cart_edit_btn=${editBtn}`);

      // Mood chip should not be visible
      const greet = await page.locator('#ff-theme-greet:not([hidden]).is-on').count();
      log(`mood_chip_visible=${greet}`);

      // Pulao bubble deep link via Browse menus
      await page.goto(origin + '/menu?group=friends', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(600);
      await page.locator('[data-testid="ff-more-btn"]').click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      await page.locator('[data-testid="ff-more-menus"]').click().catch(() => {});
      await page.waitForTimeout(400);
      const pulaoBubble = page.locator('[data-ff-bubble="pulao"]');
      if (await pulaoBubble.count()) {
        await pulaoBubble.click();
        await page.waitForTimeout(500);
        const url = page.url();
        log(`pulao_bubble_url=${url}`);
        await page.screenshot({ path: path.join(OUT, `${tag}_10_pulao_section.png`), fullPage: false });
      } else {
        log('pulao_bubble_missing');
      }

    } catch (e) {
      log('FATAL ' + String(e).slice(0, 300));
      await page.screenshot({ path: path.join(OUT, `${tag}_FATAL.png`), fullPage: false }).catch(() => {});
    }

    await context.close();
  }
  await browser.close();
  return results;
}

const { server, origin } = await startServer();
console.log('Serving', origin);
const all = [];
try {
  all.push(...await runEngine(chromium, 'chromium', origin));
  all.push(...await runEngine(webkit, 'webkit', origin));
} finally {
  server.close();
}

const report = { origin, at: new Date().toISOString(), results: all };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const timings = all.filter(x => x.timing);
console.log('\n=== TIMINGS (ms) ===');
for (const t of timings) {
  console.log(`${t.tag}  ${t.timing.label}: ${t.timing.ms}ms ok=${t.timing.ok}${t.timing.err ? ' ' + t.timing.err : ''}`);
}
console.log('\n=== LOG ===');
for (const r of all.filter(x => x.msg)) console.log(`${r.tag}: ${r.msg}`);
const fails = timings.filter(t => !t.timing.ok);
process.exit(fails.length ? 1 : 0);
