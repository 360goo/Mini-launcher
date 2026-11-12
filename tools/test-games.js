// Smoke-tests every game variant in headless Chromium and regenerates catalog.json.
// Usage: node tools/test-games.js [gameId ...] [--shots DIR]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '../app/src/main/assets/games');
const args = process.argv.slice(2);
const shotIdx = args.indexOf('--shots');
const shots = shotIdx >= 0 ? args.splice(shotIdx, 2)[1] : null;
const only = args;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + dir + '/index.html#none/0');
  const catalog = await page.evaluate(() => Engine.catalog());
  if (!only.length) fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log('catalog entries:', catalog.length);

  const keys = ['up', 'down', 'left', 'right', 'ok'];
  let failed = 0;
  for (const g of catalog) {
    if (only.length && !only.includes(g.id)) continue;
    errors.length = 0;
    await page.evaluate(([id, v]) => { Engine.load(id, v); Engine.key('ok'); }, [g.id, g.variant]);
    // Random play for ~3s of game time, also restarting after game over.
    for (let i = 0; i < 60; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      await page.evaluate(k => { Engine.key(k, false); Engine.keyUp(k); }, k);
      await page.waitForTimeout(40);
      if (i % 20 === 19) await page.evaluate(() => { if (Engine.state === 'over') Engine.key('ok'); });
    }
    const state = await page.evaluate(() => Engine.state);
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `${g.id}-${g.variant}.png`) });
    }
    const ok = errors.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${g.id}#${g.variant} ${g.variantName} [${state}] ${errors.slice(0, 3).join(' | ')}`);
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
