// Drives pen2mermaid in headless Chromium: clears the example, draws shapes and
// connectors with the mouse, taps a node to rename it, screenshots and prints the Mermaid code.
// Usage: NODE_PATH=<dir>/node_modules node driver.cjs [url] [outDir]
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8000';
const out = process.argv[3] || '.';

(async () => {
  let b;
  try { b = await chromium.launch(); }
  catch { b = await chromium.launch({ channel: 'chrome' }); } // fall back to installed Google Chrome
  const page = await b.newPage({ viewport: { width: 1400, height: 850 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));

  await page.goto(url);
  await page.waitForFunction(() => window.mermaid);
  await page.screenshot({ path: out + '/01-inicial.png' });
  await page.click('#clear');                       // drop the preloaded example

  const c = await page.locator('#c').boundingBox();
  const stroke = async pts => {
    await page.mouse.move(c.x + pts[0][0], c.y + pts[0][1]); await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(c.x + x, c.y + y, { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(150);
  };
  const rect = (x, y, w, h) => stroke([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]]);
  const diamond = (cx, cy, rx, ry) => stroke([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry + 2]]);
  const ellipse = (cx, cy, rx, ry) => {
    const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 2 * Math.PI; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return stroke(p);
  };

  await ellipse(200, 80, 70, 35);     // Inicio/Fin
  await rect(130, 180, 140, 70);      // Proceso
  await diamond(200, 380, 90, 60);    // Decisión
  await rect(400, 350, 140, 70);      // Proceso
  await stroke([[200, 100], [200, 200]]);
  await stroke([[200, 230], [200, 360]]);
  await stroke([[230, 380], [450, 380]]);

  // Tap (click without moving) = edit label
  await page.mouse.click(c.x + 470, c.y + 385);
  await page.fill('#editInput', 'Guardar');
  await page.click('#editOk');

  await page.waitForTimeout(1500);                  // mermaid render is debounced 250ms
  await page.screenshot({ path: out + '/02-dibujado.png' });
  await page.click('#tabCode');
  const code = await page.textContent('#code');
  const stats = await page.textContent('#stats');
  console.log(code); console.log('STATS:', stats); console.log('ERRORS:', JSON.stringify(errs));
  await b.close();

  const ok = stats.startsWith('4 nodos · 3 conexiones') && code.includes('"Guardar"') && !errs.length;
  console.log(ok ? 'OK' : 'FALLO'); process.exit(ok ? 0 : 1);
})();
