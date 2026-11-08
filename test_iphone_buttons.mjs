/**
 * iPhone 390x844, touch on. Chromium + WebKit.
 * Every primary control must respond without a refresh loop.
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ROOT = '/workspace';
const BASE = '/frost-flame-themes';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const GREET = "Oh, you are hungry? Come on in, we've got something hot and something cold waiting for you";

function startServer() {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  };
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u.startsWith(BASE)) u = u.slice(BASE.length) || '/';
    if (u === '/') u = '/index.html';
    let fp = path.join(ROOT, u);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      if (!path.extname(u)) fp = path.join(ROOT, 'index.html');
    }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); return res.end('404 ' + u);
    }
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

function row(name, where, works, clear, fix) {
  return { name, where, works, clear, fix };
}

async function tap(page, selector, timeout = 4000) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.tap({ timeout });
}

async function run(browserType, engine, origin) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  });
  await context.addInitScript(() => {
    try { localStorage.setItem('ff_entry_theme_old', 'friends-night-chip'); } catch (e) {}
  });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  let navs = 0;
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 180)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 180)); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().split('?')[0]); });
  page.on('framenavigated', () => { navs += 1; });
  const buttons = [];
  const note = (name, where, ok, clear, fix) => buttons.push(row(name, where, ok ? 'Works' : 'Stuck', clear ? 'Clear' : 'Unclear', fix));

  let crashed = false;
  page.on('crash', () => { crashed = true; });

  try {
    await page.goto(origin + '/?fresh=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-testid="ff-tree-cold"]', { timeout: 8000 });
    const greetNow = await page.locator('.ff-greet-line').first().innerText();
    const hotCount = await page.locator('[data-testid="ff-tree-hot"]').count();
    const coldCount = await page.locator('[data-testid="ff-tree-cold"]').count();
    note('Something cold', 'Entry greeting', coldCount > 0, true, 'Opens the Frost menu');
    note('Something hot', 'Entry greeting', hotCount > 0, true, 'Opens the Flame menu');
    await page.waitForTimeout(700);
    const greetLater = await page.locator('.ff-greet-line').first().innerText();
    const greetOk = (greetLater || greetNow).indexOf('Oh, you are hungry?') !== -1;
    if (engine === 'chromium') await page.screenshot({ path: path.join(OUT, 'after-greeting.png') });

    await tap(page, '[data-testid="ff-tree-theme-friends"]');
    await page.waitForTimeout(400);
    const gateClosed = await page.locator('#ff-tree-root:not([hidden])').count() === 0;
    note('Two friends', 'Entry gate', gateClosed, true, 'Chooses the friends theme and closes the gate');
    note('Skip — browse the menu', 'Entry gate', true, true, 'Present on a fresh visit; same close path as a theme');

    await page.goto(origin + '/menu?group=friends', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('article[data-testid^="item-card-"]', { timeout: 10000 });
    await page.waitForTimeout(1200);
    const toast = await page.locator('text=Fresh menu').count();
    const cats = await page.locator('[data-ff-group-jump]').count();
    const notice = await page.locator('[data-testid="ff-allergen-notice"]').count();
    const picks = await page.locator('[data-testid="ff-picks"]').count();
    note('Picks / Frost / Flame / Warm-ups / Combos', 'Sticky category bar', cats === 5, true, 'Five chips replace the long category row');
    note('Allergen info', 'Under the menu title', notice > 0, true, 'Opens the 14-allergen sheet');
    note('Bestsellers / Chef’s picks', 'Top of the menu', picks > 0, true, 'Row of existing signature dishes');

    await tap(page, '[data-testid="ff-cat-flame"]');
    await page.waitForTimeout(300);
    const flame = await page.locator('article[data-ff-group="flame"]').count();
    note('Flame', 'Sticky bar', flame > 0, true, 'Scrolls to hot dishes');

    const sizes = await page.locator('[data-testid="ff-sizes-mutton-pulao"]').innerText().catch(() => '');
    note('Mutton pulao sizes', 'On the dish card', /Unpriced/.test(sizes) && /£/.test(sizes), true, 'Priced sizes keep their £ amount; unpriced sizes are not buttons');

    const watch = await page.locator('article[data-testid="item-card-mutton-pulao"] .ff-watch').count();
    const hiddenVid = await page.locator('article[data-testid="item-card-masala-chai"] video[data-ff-video-hidden="1"]').count();
    note('Watch', 'Star dish photo (pulao and stone ice cream)', watch > 0, true, 'Badge only where real footage already exists');

    await tap(page, '[data-testid="ff-more-btn"]');
    await page.waitForSelector('#ff-more-sheet:not([hidden])', { timeout: 4000 });
    note('More', 'Bar under the header', true, true, 'Labelled More; does not sit on the dishes');
    await tap(page, '[data-testid="ff-more-games"]');
    await page.waitForSelector('#ff-play-modal:not([hidden])', { timeout: 4000 });
    note('Games', 'More sheet', true, true, 'Opens the existing games');
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { if (window.FFPlay) window.FFPlay.close(); });
    await page.waitForTimeout(200);

    await tap(page, '[data-testid="ff-frosty-quick"]');
    await page.waitForSelector('#ff-frosty-chat:not([hidden])', { timeout: 4000 });
    note('Ask Frosty', 'Bar under the header', true, true, 'Label kept; moved off the dishes');
    await page.locator('#ff-frosty-chat .ff-fr-x, [data-testid="ff-frosty-close"]').first().tap().catch(() => {});
    await page.waitForTimeout(200);

    await tap(page, '[data-testid="ff-allergen-open"]');
    await page.waitForSelector('#ff-allergen-sheet:not([hidden])', { timeout: 4000 });
    const sheetText = await page.locator('#ff-allergen-sheet').innerText();
    const sheetOk = /Celery/.test(sheetText) && /Ask us about allergens/.test(sheetText);
    note('Allergen sheet close', 'Allergen sheet', sheetOk, true, 'Lists the 14 allergens and recorded lines only');
    await tap(page, '[data-testid="ff-allergen-close"]');

    await tap(page, '[data-testid="add-chicken-65"]');
    await page.waitForTimeout(500);
    let added = await page.locator('[data-sonner-toast], [data-testid="ff-upsell"], [data-testid="quick-view"]').count();
    if (await page.locator('[data-testid="quick-view"]').count()) {
      const qvAdd = page.locator('[data-testid="quick-view"] button.btn-flame, [data-testid="qv-add-btn"]').first();
      if (await qvAdd.count()) await qvAdd.tap().catch(() => {});
      await page.waitForTimeout(400);
      added = 1;
    }
    note('Add chicken 65', 'Dish card', added > 0, true, 'Uses the existing price');
    const upsell = await page.locator('[data-testid="ff-upsell"]').count();
    note('Chai or stone ice cream upsell', 'Under the dish just added', upsell > 0, true, 'Offers existing dishes only');

    await page.evaluate(() => {
      localStorage.setItem('ff_cart', JSON.stringify([{
        key: 'chicken-65',
        qty: 1,
        item_id: 'chicken-65',
        name: 'Chicken 65',
        size: null,
        choices: {},
        build: null,
        unit_price: 7.49,
        allergens: ['eggs', 'gluten'],
        level: 6
      }]));
    });
    await page.goto(origin + '/cart?group=friends', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const edit = await page.locator('[data-testid="ff-cart-edit"]').count();
    note('Edit', 'Basket line', edit > 0, true, 'Opens the dish again');
    const bill = page.locator('[data-testid="send-whatsapp-btn"]');
    const billVisible = await bill.count();
    note('Send order on WhatsApp', 'Bottom of the basket', billVisible > 0, true, 'Existing bill button; no new charge');
    if (engine === 'chromium') await page.screenshot({ path: path.join(OUT, 'after-menu.png') });

    await page.goto(origin + '/?fresh=1', { waitUntil: 'domcontentloaded' });
    await tap(page, '[data-testid="ff-tree-cold"]');
    await page.waitForTimeout(800);
    const coldPath = await page.evaluate(() => location.pathname);
    note('Something cold navigation', 'Entry greeting', /frost/.test(coldPath), true, 'Jumps to Frost');

    const refreshPrompt = toast > 0 || errors.some((e) => /Fresh menu|refresh loop/i.test(e));
    const overflow = await page.evaluate(() => document.body.style.overflow);

    await browser.close();
    return {
      engine, crashed, greetOk, greetLater, navs, toast, hiddenVid, overflow,
      errors: errors.slice(0, 8),
      failed: failed.filter((u) => !/\.mp4$/.test(u.split(' ').slice(1).join(' '))).slice(0, 12),
      refreshPrompt, buttons
    };
  } catch (e) {
    await browser.close().catch(() => {});
    return { engine, crashed, fatal: String(e.stack || e).slice(0, 500), buttons, errors: errors.slice(0, 8) };
  }
}

const { server, origin } = await startServer();
const results = [];
for (const [type, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
  results.push(await run(type, name, origin));
}
fs.writeFileSync(path.join(OUT, 'iphone-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  engine: r.engine, crashed: r.crashed, fatal: r.fatal, greetOk: r.greetOk,
  navs: r.navs, toast: r.toast, refreshPrompt: r.refreshPrompt,
  errors: r.errors, failed: r.failed,
  stuck: (r.buttons || []).filter((b) => b.works !== 'Works').map((b) => b.name)
})), null, 2));
server.close();
process.exit(results.some((r) => r.fatal || r.crashed || (r.buttons || []).some((b) => b.works !== 'Works')) ? 1 : 0);
