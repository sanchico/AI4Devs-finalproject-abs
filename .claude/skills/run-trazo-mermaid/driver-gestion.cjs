// Drives the diagram management of pen2mermaid with TWO users (two browser contexts): A creates diagrams from the list ("Mis
// diagramas" and "Nuevo"), draws, shares an invitation link, and B accepts it and ends up in the same diagram. It WRITES to
// the Supabase project of the env file (creates diagrams, deletes them at the end with preparar-diagrama.js) and types the
// credentials of users A and B of the latency measurement into the sign-in panel without printing them: ask the owner first.
//
// Usage (from the repo root, with `frontend/` served on :8000):
//   NODE_PATH=<dir>/node_modules node --env-file=supabase/.env.remoto .claude/skills/run-trazo-mermaid/driver-gestion.cjs [url] [outDir]
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
const borrarDiagrama = id => { try { execFileSync(process.execPath, ['supabase/scripts/preparar-diagrama.js', '--borrar', id], { env: E, encoding: 'utf8' }); } catch (e) { console.log(`(no se pudo borrar ${id}: ${e.message.split('\n')[0]})`); } };

// A diagram whose title is HTML, made with A's own session: the list must show it as text (there is no screen to set a title yet)
async function crearConTitulo(titulo) {
  const { createClient } = await import('@supabase/supabase-js');
  const c = createClient(E.SUPABASE_URL, E.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: e0 } = await c.auth.signInWithPassword({ email: E.MEDIR_A_CORREO, password: E.MEDIR_A_PASSWORD });
  if (e0) throw new Error('login de A: ' + e0.message);
  const { data: id, error: e1 } = await c.rpc('create_diagram', { p_kind: 'flow' });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await c.rpc('apply_op', { p_diagram_id: id, p_op_id: require('node:crypto').randomUUID(), p_op: { type: 'setMeta', set: { title: titulo } } });
  if (e2) throw new Error(e2.message);
  return id;
}

const esperar = (page, fn, arg, timeout = 12000) => page.waitForFunction(fn, arg, { timeout });
const nodos = async page => Number(/(\d+) nodos/.exec(await page.textContent('#stats'))?.[1] ?? NaN);
const idDeLaRuta = page => /#\/d\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? null;

async function usuario(browser, nombre, correo, clave) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => m.type() === 'error' && errores.push(m.text()));
  return { nombre, ctx, page, correo, clave, errores };
}
// A full load of an address (a hash-only change reloads the app anyway, but this also works from another page)
async function ir(u, hash) {
  await u.page.goto('about:blank');
  await u.page.goto(`${url}/${hash}`);
  await u.page.waitForFunction(() => window.mermaid && window.supabase);
}
async function entrarSiPide(u) {
  try { await u.page.waitForSelector('#login:not([hidden])', { timeout: 4000 }); } catch { return false; }   // the session may already be there
  await u.page.fill('#loginCorreo', u.correo);
  await u.page.fill('#loginClave', u.clave);
  await u.page.click('#loginEntrar');
  return true;
}
const filasLista = page => page.$$eval('#listaItems li', lis => lis.length);
async function trazo(page, pts) {
  const c = await page.locator('#c').boundingBox();
  await page.mouse.move(c.x + pts[0][0], c.y + pts[0][1]); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(c.x + x, c.y + y, { steps: 8 });
  await page.mouse.up();
}
const rect = (page, x, y, w, h) => trazo(page, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]]);

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const creados = [];
  let A, B;
  try {
    A = await usuario(browser, 'A', E.MEDIR_A_CORREO, E.MEDIR_A_PASSWORD);
    B = await usuario(browser, 'B', E.MEDIR_B_CORREO, E.MEDIR_B_PASSWORD);

    const HTML = '<img src=x onerror=alert(1)>';
    creados.push(await crearConTitulo(HTML));
    let dialogos = 0; A.page.on('dialog', d => { dialogos++; d.dismiss(); });

    // ---- 1. A abre la lista (pide entrar) y crea un diagrama de Estados con «Nuevo»
    await ir(A, '#/lista');
    await A.page.waitForSelector('#login:not([hidden])', { timeout: 12000 });
    check('la lista pide entrar y no muestra nada hasta que hay sesión', await A.page.evaluate(() => document.getElementById('lista').hidden && document.getElementById('listaItems').children.length === 0));
    await entrarSiPide(A);
    await A.page.waitForSelector('#lista:not([hidden])', { timeout: 12000 });
    await esperar(A.page, () => document.getElementById('listaMsg').textContent !== 'Cargando…');
    const antesA = await filasLista(A.page);
    check('la lista de A se muestra sin errores', (await A.page.textContent('#listaMsg')) === '' || antesA === 0, `${antesA} diagramas`);
    check('un título con HTML sale como texto: ni elementos nuevos ni diálogos', (await A.page.$$eval('#listaItems span', ss => ss.map(x => x.textContent))).includes(HTML)
      && (await A.page.$$('#listaItems img')).length === 0 && dialogos === 0);
    await A.page.selectOption('#listaTipo', 'state');
    await A.page.click('#listaNuevo');
    await esperar(A.page, () => /#\/d\//.test(location.hash));
    const compartido = idDeLaRuta(A.page); creados.push(compartido);
    await esperar(A.page, () => document.getElementById('estado').textContent === 'Editando');
    check('«Nuevo» crea un diagrama de Estados vacío y lo abre', compartido && (await A.page.inputValue('#kind')) === 'state' && (await nodos(A.page)) === 0);

    // ---- 2. A dibuja y comparte: el enlace queda en el portapapeles
    await A.page.selectOption('#dir', 'LR');
    await rect(A.page, 150, 150, 140, 70);
    await esperar(A.page, () => /1 nodos/.test(document.getElementById('stats').textContent));
    await A.page.click('#compartir');
    await esperar(A.page, () => /copiado|Copia/.test(document.getElementById('toast').textContent));
    const enlace = await A.page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    const m = /#\/i\/([0-9a-f]{64})$/.exec(enlace);
    check('«Compartir» copia un enlace #/i/<64 hex> de la app', m && enlace.startsWith(url), enlace ? enlace.slice(0, url.length + 12) + '…' : 'sin enlace');

    // ---- 3. A crea otro diagrama desde la lista, que no comparte
    await A.page.click('#misDiagramas');
    await A.page.waitForSelector('#lista:not([hidden])');
    await esperar(A.page, () => document.getElementById('listaMsg').textContent !== 'Cargando…');
    check('la lista de A ya incluye el diagrama nuevo', (await filasLista(A.page)) === antesA + 1);
    await A.page.click('#listaNuevo');
    await esperar(A.page, id => /#\/d\//.test(location.hash) && !location.hash.endsWith(id), compartido);
    const privado = idDeLaRuta(A.page); creados.push(privado);
    check('un segundo «Nuevo» crea otro diagrama distinto', privado && privado !== compartido);

    // ---- 4. B ve su lista antes de aceptar, acepta el enlace y entra en el diagrama de A
    await ir(B, '#/lista');
    await entrarSiPide(B);
    await B.page.waitForSelector('#lista:not([hidden])', { timeout: 12000 });
    await esperar(B.page, () => document.getElementById('listaMsg').textContent !== 'Cargando…');
    const antesB = await filasLista(B.page);
    await ir(B, `#/i/${m?.[1]}`);
    await entrarSiPide(B);
    await esperar(B.page, id => location.hash === '#/d/' + id, compartido, 15000);
    await esperar(B.page, () => document.getElementById('estado').textContent === 'Editando', null, 15000);
    check('B acepta el enlace y se abre el diagrama de A como editor', idDeLaRuta(B.page) === compartido);
    await esperar(B.page, () => /1 nodos/.test(document.getElementById('stats').textContent));
    check('B ve lo que dibujó A', (await nodos(B.page)) === 1 && (await B.page.inputValue('#dir')) === 'LR');
    await B.page.screenshot({ path: out + '/20-B-acepta.png' });

    // ---- 5. B en su lista: el compartido sí, el privado de A no, y repetir el enlace no duplica nada
    await B.page.click('#misDiagramas');
    await B.page.waitForSelector('#lista:not([hidden])');
    await esperar(B.page, () => document.getElementById('listaMsg').textContent !== 'Cargando…');
    check('la lista de B gana exactamente un diagrama', (await filasLista(B.page)) === antesB + 1);
    await ir(B, `#/i/${m?.[1]}`);
    await esperar(B.page, id => location.hash === '#/d/' + id, compartido, 15000);
    await B.page.click('#misDiagramas');
    await B.page.waitForSelector('#lista:not([hidden])');
    await esperar(B.page, () => document.getElementById('listaMsg').textContent !== 'Cargando…');
    check('repetir el enlace no duplica el diagrama en la lista', (await filasLista(B.page)) === antesB + 1);
    await ir(B, `#/d/${privado}`);
    await esperar(B.page, () => /^No tienes acceso/.test(document.getElementById('estado').textContent), null, 12000);
    check('el diagrama privado de A no se abre para B', true);

    // ---- 6. Quien no es dueño no puede invitar
    await ir(B, `#/d/${compartido}`);
    await esperar(B.page, () => document.getElementById('estado').textContent === 'Editando', null, 15000);
    await B.page.click('#compartir');
    await esperar(B.page, () => document.getElementById('toast').textContent === 'Solo el dueño puede invitar');
    check('B (editor) pulsa «Compartir»: «Solo el dueño puede invitar»', true);

    // ---- 7. Un enlace con basura no llama al servidor
    await ir(B, '#/i/xyz');
    check('#/i/xyz avisa de dirección no válida', (await B.page.textContent('#estado')) === 'La dirección del diagrama no es válida');

    check('A: sin errores de consola', A.errores.length === 0, A.errores.join(' | '));
    check('B: sin errores de consola (salvo el 404 esperado del diagrama ajeno)', B.errores.every(e => /40[1346]|Failed to load resource/.test(e)), B.errores.join(' | '));
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
