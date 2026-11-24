// ruta.js: la dirección de la página decide si la app es solitaria o abre un diagrama compartido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuta } from '../ruta.js';

const ID = '3f2b8a1c-9d4e-4b7a-8c11-0a1b2c3d4e5f';

test('sin hash, con "#" o con "#/" la app es solitaria', () => {
  for (const hash of ['', '#', '#/', undefined, null]) assert.deepEqual(parseRuta(hash), { tipo: 'solitario' }, String(hash));
});

test('#/d/<uuid> es un diagrama compartido con su id', () => {
  assert.deepEqual(parseRuta(`#/d/${ID}`), { tipo: 'diagrama', id: ID });
});

test('el id se normaliza a minúsculas', () => {
  assert.deepEqual(parseRuta(`#/d/${ID.toUpperCase()}`), { tipo: 'diagrama', id: ID });
});

test('una dirección de diagrama sin UUID válido es inválida', () => {
  for (const hash of ['#/d/', '#/d', '#/d/xyz', `#/d/${ID}x`, `#/d/${ID}/más`, `#/d/${ID.slice(1)}`, `#/d/${ID.replace(/-/g, '')}`, `#/d/<script>`]) {
    assert.deepEqual(parseRuta(hash), { tipo: 'invalida' }, hash);
  }
});

test('cualquier otra ruta es solitaria', () => {
  for (const hash of ['#/otra', '#/dd/' + ID, '#algo', '#/i/' + ID]) assert.deepEqual(parseRuta(hash), { tipo: 'solitario' }, hash);
});

test('el UUID admite los 5 grupos de cualquier versión', () => {
  const v1 = '123e4567-e89b-12d3-a456-426614174000';
  assert.deepEqual(parseRuta(`#/d/${v1}`), { tipo: 'diagrama', id: v1 });
});
