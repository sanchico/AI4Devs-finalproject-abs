// Drives pen2mermaid with TWO users at once (two browser contexts, so two sessions) against the Supabase project of the
// env file. It creates throwaway diagrams with supabase/scripts/preparar-diagrama.js, runs the collaboration scenario and
// deletes the diagrams at the end. It types the credentials of users A and B of the latency measurement into the sign-in
// panel without printing them. WRITES to the remote project: ask the owner first.
//
// Usage (from the repo root, with `frontend/` served on :8000):
//   NODE_PATH=<dir>/node_modules node --env-file=supabase/.env.remoto .claude/skills/run-trazo-mermaid/driver-colaborativo.cjs [url] [outDir]
const { chromium } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const url = (process.argv[2] || 'http://localhost:8000').replace(/\/+$/, '');
const out = process.argv[3] || '.';
const E = process.env;
for (const n of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'MEDIR_A_CORREO', 'MEDIR_A_PASSWORD', 'MEDIR_B_CORREO', 'MEDIR_B_PASSWORD']) {
  if (!E[n]) { console.error(`Falta ${n}: lanza el driver con node --env-file=supabase/.env.remoto`); process.exit(2); }
}

const resultados = [];
const check = (nombre, cond, detalle = '') => { resultados.push(Boolean(cond)); console.log(`${cond ? 'OK   ' : 'FALLO'} ${nombre}${detalle !== '' ? ' — ' + detalle : ''}`); };
const preparar = (...args) => execFileSync(process.execPath, ['supabase/scripts/preparar-diagrama.js', ...args], { env: E, encoding: 'utf8' });
const crearDiagrama = (rol, tipo = 'flow') => preparar('--rol', rol, '--tipo', tipo, '--url', url).match(/^diagrama: (\S+)/m)[1];
const borrarDiagrama = id => { try { preparar('--borrar', id); } catch (e) { console.log(`(no se pudo borrar ${id}: ${e.message.split('\n')[0]})`); } };

const modo = page => page.textContent('#estado');
const nodos = async page => Number(/(\d+) nodos/.exec(await page.textContent('#stats'))?.[1] ?? NaN);
const esperar = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout });
const esperarNodos = (page, n, timeout) => esperar(page, n => Number(/(\d+) nodos/.exec(document.getElementById('stats').textContent)?.[1]) === n, n, timeout);

async function usuario(browser, nombre, correo, clave) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => m.type() === 'error' && errores.push(m.text()));
  return { nombre, ctx, page, correo, clave, errores };
}
async function abrir(u, id, { entrar = true } = {}) {
  await u.page.goto('about:blank');                  // a hash-only change reloads the app: force a full load instead
  await u.page.goto(`${url}/#/d/${id}`);
  await u.page.waitForFunction(() => window.mermaid && window.supabase);
  if (entrar) {
    await u.page.waitForSelector('#login:not([hidden])', { timeout: 10000 });
    await u.page.fill('#loginCorreo', u.correo);
    await u.page.fill('#loginClave', u.clave);
    await u.page.click('#loginEntrar');
  }
}
async function trazo(page, pts) {
  const c = await page.locator('#c').boundingBox();
  await page.mouse.move(c.x + pts[0][0], c.y + pts[0][1]); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(c.x + x, c.y + y, { steps: 8 });
  await page.mouse.up();
}
const rect = (page, x, y, w, h) => trazo(page, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]]);
const clic = async (page, x, y) => { const c = await page.locator('#c').boundingBox(); await page.mouse.click(c.x + x, c.y + y); };

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const creados = [];
  let A, B;
  try {
    const editor = crearDiagrama('editor'); creados.push(editor);
    const lector = crearDiagrama('viewer'); creados.push(lector);
    A = await usuario(browser, 'A', E.MEDIR_A_CORREO, E.MEDIR_A_PASSWORD);
    B = await usuario(browser, 'B', E.MEDIR_B_CORREO, E.MEDIR_B_PASSWORD);

    // ---- 1. Los dos entran y abren el mismo diagrama (B como editor)
    await Promise.all([abrir(A, editor), abrir(B, editor)]);
    await Promise.all([A, B].map(u => esperar(u.page, () => document.getElementById('estado').textContent === 'Editando')));
    check('A y B abren el diagrama y quedan en "Editando"', (await modo(A.page)) === 'Editando' && (await modo(B.page)) === 'Editando');
    check('el diagrama compartido abre vacío, sin el ejemplo', (await nodos(A.page)) === 0 && (await nodos(B.page)) === 0);
    check('el tipo está fijado y bloqueado', await A.page.evaluate(() => document.getElementById('kind').value === 'flow' && document.getElementById('kind').disabled));
    check('el panel de entrada se cerró y aparece "Salir"', await A.page.evaluate(() => document.getElementById('login').hidden && !document.getElementById('salir').hidden));

    // ---- 2. A dibuja, B lo ve
    await rect(A.page, 150, 150, 140, 70);
    const t0 = Date.now();
    await esperarNodos(B.page, 1, 6000);
    const ms = Date.now() - t0;
    check('A dibuja un rectángulo y B lo ve en menos de 3 s', ms < 3000, `${ms} ms de A a B (incluye el repintado de B)`);
    check('A también lo conserva (1 nodo)', (await nodos(A.page)) === 1);
    await esperar(B.page, () => !!document.querySelector('#preview svg'), null, 8000);
    check('la vista previa Mermaid de B se pinta con lo que dibuja A', true);
    await A.page.screenshot({ path: out + '/10-A-dibuja.png' });
    await B.page.screenshot({ path: out + '/11-B-ve.png' });

    // ---- 3. B renombra, A lo ve
    await clic(B.page, 220, 185);
    await B.page.waitForSelector('#editor', { state: 'visible' });
    await B.page.fill('#editInput', 'De B');
    await B.page.click('#editOk');
    await esperar(A.page, () => document.getElementById('code').textContent.includes('"De B"'));
    check('B renombra el nodo y A ve "De B" en el código Mermaid', true);

    // ---- 4. A cambia la dirección, el selector de B la sigue
    await A.page.selectOption('#dir', 'LR');
    await esperar(B.page, () => document.getElementById('dir').value === 'LR');
    await esperar(B.page, () => document.getElementById('code').textContent.startsWith('flowchart LR'));
    check('A cambia la dirección y B ve "LR" en el selector y en el código', true);

    // ---- 5. B recarga: vuelve al mismo diagrama sin volver a entrar
    await B.page.reload();
    await B.page.waitForFunction(() => window.mermaid && window.supabase);
    await esperar(B.page, () => document.getElementById('estado').textContent === 'Editando', null, 12000);
    await esperarNodos(B.page, 1);
    check('B recarga y vuelve al mismo diagrama, con la sesión y el contenido', await B.page.evaluate(() => document.getElementById('login').hidden && document.getElementById('code').textContent.includes('"De B"') && document.getElementById('dir').value === 'LR'));

    // ---- 6. A deshace y B deja de verlo (solo se deshace lo propio)
    await A.page.click('#undo');
    await esperarNodos(B.page, 0, 6000);
    check('A deshace su rectángulo y B deja de verlo', (await nodos(A.page)) === 0 && (await nodos(B.page)) === 0);
    check('"Deshacer" sin nada propio avisa y no cambia nada', await (async () => { await B.page.click('#undo'); return (await B.page.textContent('#toast')) === 'Nada que deshacer'; })());

    // ---- 7. Un lector no dibuja, pero ve lo que escribe el editor
    await abrir(B, lector, { entrar: false });
    await esperar(B.page, () => /^Solo lectura/.test(document.getElementById('estado').textContent), null, 12000);
    check('B abre como lector: "Solo lectura: tu rol no permite editar"', (await modo(B.page)) === 'Solo lectura: tu rol no permite editar');
    check('lector: botones y selectores desactivados', await B.page.evaluate(() => ['undo', 'clear', 'dir', 'kind'].every(i => document.getElementById(i).disabled)));
    await rect(B.page, 150, 150, 140, 70);
    check('lector: dibujar avisa del motivo y no crea nada', (await nodos(B.page)) === 0 && (await B.page.textContent('#toast')) === 'Solo lectura: tu rol no permite editar');
    await abrir(A, lector, { entrar: false });
    await esperar(A.page, () => document.getElementById('estado').textContent === 'Editando', null, 12000);
    await rect(A.page, 300, 200, 140, 70);
    await esperarNodos(B.page, 1, 6000);
    await clic(B.page, 370, 235);
    check('lector: ve lo que dibuja el dueño y al tocar un nodo no se abre el editor', (await nodos(B.page)) === 1 && !(await B.page.isVisible('#editor')));
    await esperar(B.page, () => !!document.querySelector('#preview svg'), null, 8000);
    check('lector: la vista previa también se pinta', true);
    await B.page.screenshot({ path: out + '/12-lector.png' });

    // ---- 8. Un diagrama que no es de B (o no existe) no se explica más que "sin acceso"
    const ajeno = '00000000-0000-4000-8000-000000000000';
    await abrir(B, ajeno, { entrar: false });
    await esperar(B.page, () => /^No tienes acceso/.test(document.getElementById('estado').textContent), null, 12000);
    check('un diagrama inexistente o ajeno: "No tienes acceso a este diagrama o no existe"', (await modo(B.page)) === 'No tienes acceso a este diagrama o no existe');
    check('y el lienzo queda vacío y bloqueado', (await nodos(B.page)) === 0 && await B.page.evaluate(() => document.getElementById('stage').classList.contains('bloqueado')));

    // ---- 9. Salir vuelve al modo solitario y cierra la sesión
    await B.page.click('#salir');
    await esperar(B.page, () => document.getElementById('estado').hidden && /5 nodos/.test(document.getElementById('stats').textContent), null, 12000);
    check('"Salir" vuelve al modo solitario con el ejemplo', (await nodos(B.page)) === 5);
    await abrir(B, lector, { entrar: false });
    await B.page.waitForSelector('#login:not([hidden])', { timeout: 10000 });
    check('tras salir, el enlace del diagrama vuelve a pedir entrar', true);

    // ---- 10. Sin errores en la consola
    check('A: sin errores de consola', A.errores.length === 0, A.errores.join(' | '));
    check('B: sin errores de consola (salvo los de la carga de un diagrama sin acceso)', B.errores.every(e => /40[1346]|Failed to load resource/.test(e)), B.errores.join(' | '));
  } catch (e) {
    check('el escenario termina sin excepciones', false, e.message.split('\n')[0]);
  } finally {
    for (const id of creados) borrarDiagrama(id);
    await browser.close();
  }
  const fallos = resultados.filter(r => !r).length;
  console.log(fallos ? `FALLO (${fallos})` : 'OK');
  process.exit(fallos ? 1 : 0);
})();
