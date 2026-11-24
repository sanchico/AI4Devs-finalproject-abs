// avisos.js: los textos de lo que el usuario ve cuando el servidor rechaza algo, cambia el modo o no se puede abrir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoAviso, textoModo, textoErrorApertura, textoGestion, AVISO_ENLACE_COPIADO, AVISO_ENLACE_MANUAL, SIN_CONEXION } from '../avisos.js';

test('cada rechazo del servidor tiene su texto', () => {
  assert.equal(textoAviso('invalid_op'), 'Un cambio fue rechazado por el servidor y se ha deshecho');
  assert.equal(textoAviso('op_limit'), 'El diagrama alcanzó el límite de 5 000 operaciones');
  assert.equal(textoAviso('forbidden'), 'Tu rol ya no permite editar este diagrama');
  assert.equal(textoAviso('not_found'), 'Ya no tienes acceso a este diagrama');
  assert.equal(textoAviso('diagram_deleted'), 'Este diagrama se ha borrado');
});

test('perder la sincronía o la red es "sin conexión"', () => {
  for (const clave of ['gap', 'closed', 'network', 'load']) assert.equal(textoAviso(clave), 'Sin conexión: recarga la página', clave);
  assert.equal(SIN_CONEXION, 'Sin conexión: recarga la página');
});

test('una clave desconocida cae en un texto genérico y nunca devuelve undefined', () => {
  assert.equal(typeof textoAviso('rarísima'), 'string');
  assert.ok(textoAviso('rarísima').length > 0);
  assert.ok(textoAviso(undefined).length > 0);
});

test('cada modo tiene su texto', () => {
  assert.equal(textoModo({ mode: 'loading', reason: null }), 'Conectando…');
  assert.equal(textoModo({ mode: 'edit', reason: null }), 'Editando');
  assert.equal(textoModo({ mode: 'readonly', reason: 'role' }), 'Solo lectura: tu rol no permite editar');
  assert.equal(textoModo({ mode: 'readonly', reason: 'deleted' }), 'Solo lectura: este diagrama se ha borrado');
  assert.equal(textoModo({ mode: 'readonly', reason: 'no-access' }), 'Solo lectura: ya no tienes acceso');
  assert.equal(textoModo({ mode: 'offline', reason: 'gap' }), 'Sin conexión: recarga la página');
  assert.equal(textoModo({ mode: 'offline', reason: 'load' }), 'Sin conexión: recarga la página');
});

test('un modo o un motivo desconocido no rompe', () => {
  assert.equal(typeof textoModo({ mode: 'solo-lectura-rara', reason: 'x' }), 'string');
  assert.equal(typeof textoModo({ mode: 'readonly', reason: 'x' }), 'string');
  assert.equal(typeof textoModo(null), 'string');
});

test('un error al abrir se explica según su estado', () => {
  assert.equal(textoErrorApertura({ status: 404 }), 'No tienes acceso a este diagrama o no existe');
  assert.equal(textoErrorApertura({ status: 410 }), 'Este diagrama se ha borrado');
  assert.equal(textoErrorApertura({ status: 500 }), 'Sin conexión: recarga la página');
  assert.equal(textoErrorApertura(new Error('sin red')), 'Sin conexión: recarga la página');
  assert.equal(textoErrorApertura(undefined), 'Sin conexión: recarga la página');
});

test('no distingue entre un diagrama inexistente y uno ajeno', () => {
  // los dos llegan como 404: el texto es el mismo y no menciona que el diagrama exista
  assert.ok(!/existe\b.*pero|ajeno|privado/i.test(textoErrorApertura({ status: 404 })));
});

// ---------- Gestión de diagramas: lista, crear, compartir y aceptar una invitación ----------
test('los avisos de gestión tienen su texto', () => {
  assert.equal(AVISO_ENLACE_COPIADO, 'Enlace de invitación copiado');
  assert.equal(AVISO_ENLACE_MANUAL, 'Copia el enlace de invitación');
});

test('crear un diagrama que falla se explica, con o sin respuesta del servidor', () => {
  assert.equal(textoGestion('crear', { status: 422 }), 'No se pudo crear el diagrama');
  assert.equal(textoGestion('crear', new Error('x')), 'No se pudo crear el diagrama');
  assert.equal(textoGestion('crear'), 'No se pudo crear el diagrama');
});

test('una lista que no carga se explica', () => {
  assert.equal(textoGestion('lista', { status: 500 }), 'No se pudo cargar tu lista de diagramas');
  assert.equal(textoGestion('lista', new Error('x')), 'No se pudo cargar tu lista de diagramas');
});

test('compartir: solo el dueño, diagrama borrado y cualquier otro fallo', () => {
  assert.equal(textoGestion('compartir', { status: 403 }), 'Solo el dueño puede invitar');
  assert.equal(textoGestion('compartir', { status: 410 }), 'Este diagrama se ha borrado');
  assert.equal(textoGestion('compartir', { status: 500 }), 'No se pudo crear el enlace de invitación');
  assert.equal(textoGestion('compartir', new Error('x')), 'No se pudo crear el enlace de invitación');
});

test('aceptar: una invitación desconocida y una caducada leen igual; un diagrama borrado, aparte', () => {
  assert.equal(textoGestion('aceptar', { status: 404 }), 'El enlace de invitación no es válido o caducó');
  assert.equal(textoGestion('aceptar', { status: 410 }), 'Este diagrama se ha borrado');
  assert.equal(textoGestion('aceptar', new Error('x')), SIN_CONEXION);
});

test('una acción desconocida no devuelve undefined', () => {
  assert.equal(typeof textoGestion('rarísima', { status: 500 }), 'string');
  assert.ok(textoGestion(undefined).length > 0);
});
