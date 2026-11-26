// ruta.js: la dirección de la página decide si la app es solitaria o abre un diagrama compartido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuta, llevaSesion, urlDeVuelta } from '../ruta.js';

const ID = '3f2b8a1c-9d4e-4b7a-8c11-0a1b2c3d4e5f';
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';   // 64 hex, como el de create_invite

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
  for (const hash of ['#/otra', '#/dd/' + ID, '#algo', '#/lista/x', '#/listado', '#/ii/' + TOKEN]) assert.deepEqual(parseRuta(hash), { tipo: 'solitario' }, hash);
});

test('#/lista es la lista de diagramas del usuario', () => {
  assert.deepEqual(parseRuta('#/lista'), { tipo: 'lista' });
});

test('#/i/<64 hex> es una invitación y conserva el token tal cual', () => {
  assert.deepEqual(parseRuta(`#/i/${TOKEN}`), { tipo: 'invitacion', token: TOKEN });
  // un token en mayúsculas no es el que genera el servidor (hexadecimal en minúsculas): no se transforma, se rechaza
  assert.deepEqual(parseRuta(`#/i/${TOKEN.toUpperCase()}`), { tipo: 'invalida' });
});

test('una dirección de invitación sin un token de 64 hex es inválida', () => {
  for (const hash of ['#/i', '#/i/', '#/i/xyz', `#/i/${TOKEN.slice(1)}`, `#/i/${TOKEN}0`, `#/i/${'g'.repeat(64)}`, `#/i/${TOKEN}/más`, `#/i/${ID}`]) {
    assert.deepEqual(parseRuta(hash), { tipo: 'invalida' }, hash);
  }
});

test('el UUID admite los 5 grupos de cualquier versión', () => {
  const v1 = '123e4567-e89b-12d3-a456-426614174000';
  assert.deepEqual(parseRuta(`#/d/${v1}`), { tipo: 'diagrama', id: v1 });
});

// ---------- Una sesión nunca se queda en la dirección ----------
test('un fragmento con access_token o refresh_token lleva una sesión', () => {
  for (const hash of ['#access_token=abc&refresh_token=def&type=signup', '#refresh_token=x', '#access_token=x', '#type=signup&access_token=x']) {
    assert.equal(llevaSesion(hash), true, hash);
  }
});

test('un error de Auth, una ruta y lo que no es texto no llevan sesión', () => {
  for (const hash of ['#error=access_denied&error_code=otp_expired', '#/lista', `#/d/${ID}`, `#/i/${TOKEN}`, '', '#', undefined, null, 42, '#/otra?access_token=x', '#xaccess_token=1', '#mi_refresh_token=1']) {
    assert.equal(llevaSesion(hash), false, String(hash));
  }
});

// urlDeVuelta: adónde vuelve el enlace de confirmación del correo (emailRedirectTo de signUp). Sin ella, Supabase usa el
// Referer, que el navegador recorta al origen, y la vuelta pierde el subdirectorio de GitHub Pages.
test('urlDeVuelta conserva el subdirectorio de la app desplegada', () => {
  assert.equal(urlDeVuelta({ origin: 'https://sanchico.github.io', pathname: '/AI4Devs-finalproject-abs/' }),
    'https://sanchico.github.io/AI4Devs-finalproject-abs/');
});

test('urlDeVuelta en local es la raíz del servidor', () => {
  assert.equal(urlDeVuelta({ origin: 'http://localhost:8000', pathname: '/' }), 'http://localhost:8000/');
});

test('urlDeVuelta no lleva el # ni la consulta de la página (ni la ruta del diagrama ni el token de una invitación)', () => {
  const loc = { origin: 'https://sanchico.github.io', pathname: '/AI4Devs-finalproject-abs/', hash: `#/i/${TOKEN}`, search: '?grabar' };
  const url = urlDeVuelta(loc);
  assert.equal(url, 'https://sanchico.github.io/AI4Devs-finalproject-abs/');
  assert.ok(!url.includes(TOKEN) && !url.includes('#') && !url.includes('?'));
});

test('urlDeVuelta devuelve tal cual una ruta sin barra final', () => {
  assert.equal(urlDeVuelta({ origin: 'https://ejemplo.test', pathname: '/app/index.html' }), 'https://ejemplo.test/app/index.html');
});
