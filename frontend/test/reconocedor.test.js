// Precisión del reconocedor con trazos reales del S Pen (frontend/test/fixtures/trazos/*.json),
// grabados con el modo `?grabar`. Un acierto es exactamente {type:'shape', shape:<la forma>}: reconocer otra
// forma, un trazo abierto o uno descartado cuenta como fallo.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { KINDS } from '../kinds/index.js';
import { recognize } from '../recognizer.js';
import { FORMAS } from '../grabacion.js';

const MIN_MUESTRAS = 10, MIN_PRECISION = 0.9;
const dir = new URL('./fixtures/trazos/', import.meta.url);
const archivos = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
const trazos = Object.fromEntries(FORMAS.map(f => [f, []]));
for (const a of archivos) {
  const { formas } = JSON.parse(readFileSync(new URL(a, dir), 'utf8'));
  for (const f of FORMAS) trazos[f].push(...(formas[f] ?? []));
}

test(`hay al menos ${MIN_MUESTRAS} trazos de cada forma y todos son del lápiz`, () => {
  for (const f of FORMAS) {
    assert.ok(trazos[f].length >= MIN_MUESTRAS, `${f}: ${trazos[f].length} trazos, hacen falta ${MIN_MUESTRAS}`);
    assert.ok(trazos[f].every(t => t.tipo === 'pen'), `${f}: hay trazos que no son de pen`);
  }
});

for (const kind of Object.keys(KINDS)) {
  const permitidas = Object.keys(KINDS[kind].shapes);
  // Pendiente: hoy rect 4/10 y ellipse 8/10. El change `ajustar-reconocedor` quitará el `todo`.
  test(`${KINDS[kind].name}: al menos el ${MIN_PRECISION * 100} % de los trazos de cada forma se reconoce bien`, { todo: 'ajustar-reconocedor' }, () => {
    const informe = [], fallos = [];
    for (const f of FORMAS) {
      const obtenidos = trazos[f].map(t => { const r = recognize(t.pts, permitidas); return r.type === 'shape' ? r.shape : r.type; });
      const aciertos = obtenidos.filter(o => o === f).length;
      const confusion = {};
      for (const o of obtenidos) if (o !== f) confusion[o] = (confusion[o] ?? 0) + 1;
      informe.push(`${f}: ${aciertos}/${obtenidos.length}` + (aciertos < obtenidos.length ? `  fallos → ${JSON.stringify(confusion)}` : ''));
      if (aciertos / obtenidos.length < MIN_PRECISION) fallos.push(`${f} ${aciertos}/${obtenidos.length}`);
    }
    console.log(`# Precisión ${KINDS[kind].name}\n# ${informe.join('\n# ')}`);
    assert.deepEqual(fallos, [], `por debajo del ${MIN_PRECISION * 100} %: ${fallos.join(', ')}\n${informe.join('\n')}`);
  });
}
