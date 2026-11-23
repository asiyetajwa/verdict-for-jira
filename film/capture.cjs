// Screenshots the real panel and log, filled with receipts captured from the live site, for the film.
const { chromium } = require('playwright');
const fs = require('fs');
const FX = process.argv[2];
const OUT = 'film/public/shots';
(async () => {
  const b = await chromium.launch();
  const shoot = async (page, fixture, name, width) => {
    const p = await b.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
    await p.addInitScript((f) => { window.__VERDICT_FIXTURE__ = f; }, fixture);
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`file://${process.cwd()}/static/preview/${page}/index.html`);
    await p.addStyleTag({ content: 'html,body{background:transparent!important} body{padding:18px} .route .path{animation:none!important;stroke-dasharray:none!important}' });
    await p.waitForTimeout(1200);
    const el = await p.$('.glass');
    await el.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
    console.log(name, errs.length ? errs : 'ok');
    await p.close();
  };
  for (const k of ['TAL-56', 'TAL-65', 'TAL-42', 'TAL-49', 'TAL-74', 'TAL-51', 'TAL-68']) {
    const st = JSON.parse(fs.readFileSync(`${FX}/${k}.json`, 'utf8'));
    await shoot('panel', { state: st }, `panel-${k}`, 620);
  }
  await shoot('log', { log: JSON.parse(fs.readFileSync(`${FX}/log.json`, 'utf8')) }, 'log', 1240);
  await b.close();
})();
