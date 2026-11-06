import { chromium } from '/workspace/frost_flame_qr_billing/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const BASE = 'http://127.0.0.1:45116';
const OUT = '/workspace/emergent_themes_addon/screenshots/themes';
const THEMES = ['solo_m','solo_f','friends','couple','gang','family','family_kids'];
fs.mkdirSync(OUT, { recursive: true });

const report = { assertions: [], pageErrors: [], consoleErrors: [], themes: [], desktop: {}, noTheme: {} };
const check = (cond, msg) => { report.assertions.push({ ok: !!cond, msg }); if (!cond) console.error('FAIL', msg); else console.log('OK', msg); };

const browser = await chromium.launch({ headless: true });

async function runViewport(name, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push({ view: name, message: String(e) }));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ view: name, text: m.text() }); });

  // No theme: fresh tree should show, no body theme class, no wash
  await page.goto(BASE + '/?fresh=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.FFTree && window.FFThemesApply, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const noThemeClass = await page.evaluate(() => [...document.body.classList].filter(c => c.startsWith('ff-theme-')));
  const treeVisible = await page.evaluate(() => {
    const r = document.getElementById('ff-tree-root');
    return r && !r.hidden && r.querySelectorAll('.ff-tree-step.is-active').length === 1;
  });
  check(noThemeClass.length === 0, name + ': no theme class on fresh load');
  check(treeVisible, name + ': tree shows on fresh load');
  if (name === 'mobile') {
    await page.screenshot({ path: path.join(OUT, '00_no_theme_tree.png'), fullPage: false });
    report.noTheme = { classes: noThemeClass, treeVisible };
  }

  for (const t of THEMES) {
    await page.goto(BASE + '/menu?group=' + t + '&fast=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.FFTree && window.FFThemesApply, null, { timeout: 15000 });
    await page.waitForTimeout(900);
    // hide float overlay if open so we see themed page
    await page.evaluate(() => { try { window.FFFloatMenu && window.FFFloatMenu.hide && window.FFFloatMenu.hide(); } catch(e){} });
    await page.waitForTimeout(400);

    const info = await page.evaluate((tid) => {
      const bodyHas = document.body.classList.contains('ff-theme-' + tid);
      const attr = document.documentElement.getAttribute('data-ff-theme');
      const cs = getComputedStyle(document.documentElement);
      const greet = document.getElementById('ff-theme-greet');
      const theme = window.FFThemesApply.get(tid);
      return {
        bodyHas, attr,
        accent: cs.getPropertyValue('--ff-accent').trim(),
        bg: cs.getPropertyValue('--ff-bg').trim(),
        display: cs.getPropertyValue('--ff-display').trim(),
        greetOn: !!(greet && !greet.hidden),
        greetTitle: greet ? (greet.querySelector('.ff-tg-title') || {}).textContent : null,
        themeTitle: theme && theme.title,
        pill: !!document.getElementById('ff-play-pill')
      };
    }, t);

    check(info.bodyHas, name + ':' + t + ' body class');
    check(info.attr === t, name + ':' + t + ' data-ff-theme');
    check(!!info.accent, name + ':' + t + ' --ff-accent set');
    check(info.greetOn, name + ':' + t + ' greeting visible');
    check(info.pill, name + ':' + t + ' games pill present');

    // Open books briefly to ensure games still work under theme
    await page.evaluate(() => { try { window.FFFloatMenu && window.FFFloatMenu.hide && window.FFFloatMenu.hide(); } catch(e){} });
    await page.click('#ff-play-pill');
    await page.waitForSelector('#ff-play-modal:not([hidden])', { timeout: 8000 });
    const modalOk = await page.evaluate(() => {
      const m = document.getElementById('ff-play-modal');
      return m && !m.hidden;
    });
    check(modalOk, name + ':' + t + ' play modal opens');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    if (name === 'mobile') {
      await page.screenshot({ path: path.join(OUT, t + '_menu.png'), fullPage: false });
      // also capture with play open
      await page.click('#ff-play-pill');
      await page.waitForSelector('#ff-play-modal:not([hidden])');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, t + '_play.png'), fullPage: false });
      await page.keyboard.press('Escape');
      report.themes.push({ id: t, ...info });
    }
  }

  // Original site unaffected when no theme: clear and check vars gone
  await page.goto(BASE + '/?fresh=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.FFThemesApply);
  await page.waitForTimeout(400);
  const cleared = await page.evaluate(() => {
    return {
      classes: [...document.body.classList].filter(c => c.startsWith('ff-theme-')),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--ff-accent').trim(),
      attr: document.documentElement.getAttribute('data-ff-theme')
    };
  });
  check(cleared.classes.length === 0 && !cleared.attr, name + ': theme cleared on fresh');

  await context.close();
}

await runViewport('mobile', { width: 390, height: 844 });
await runViewport('desktop', { width: 1280, height: 800 });

await browser.close();
const passed = report.assertions.filter(a => a.ok).length;
const failed = report.assertions.filter(a => !a.ok);
fs.writeFileSync(path.join(OUT, 'test-report.json'), JSON.stringify({ passed, failed: failed.length, failures: failed, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors.slice(0, 30), themes: report.themes }, null, 2));
console.log(JSON.stringify({ passed, failed: failed.length, failures: failed, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length }, null, 2));
process.exit(failed.length ? 1 : 0);
