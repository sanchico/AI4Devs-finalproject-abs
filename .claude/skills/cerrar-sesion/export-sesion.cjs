#!/usr/bin/env node
// Guarda la conversación de una sesión como texto en docs/sesiones/, a partir del registro de
// Claude Code (.jsonl). Sustituye a /export, que solo puede lanzar el usuario: el formato es
// parecido (prompts con "> ", respuestas con "●"), pero no idéntico.
//
// Uso:
//   node export-sesion.cjs --nombre "Sesion4 fix barra vertical"   # la sesión más reciente
//   node export-sesion.cjs --nombre "Sesion3" ruta/a/sesion.jsonl  # un registro concreto
//   --out <carpeta>   carpeta de salida (por defecto docs/sesiones)
//
// El archivo se llama "<nombre> <AAAA-MM-DD-HHMMSS>.txt" (hora local del primer evento). Si ya existe
// se sobrescribe, así que se puede ejecutar de nuevo para añadir lo ocurrido después.

const fs = require('fs');
const path = require('path');
const { projectDir, textOf, promptText, isHumanPrompt, readSession } = require('./prompts.cjs');

const MAX_DETALLE = 110;

function sello(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function indentar(texto, prefijo, resto = '  ') {
  return texto.split('\n').map((l, i) => (i === 0 ? prefijo : resto) + l).join('\n');
}

function detalle(input) {
  const v = input && (input.description || input.command || input.file_path || input.pattern || input.path || input.url || input.skill);
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  return s.length > MAX_DETALLE ? s.slice(0, MAX_DETALLE - 1) + '…' : s;
}

function render(events) {
  const out = [];
  for (const e of events) {
    if (e.isSidechain) continue;
    if (isHumanPrompt(e)) {
      out.push(indentar(promptText(e.message.content), '> '));
    } else if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
      for (const b of e.message.content) {
        if (b.type === 'text' && b.text.trim()) out.push(indentar(b.text.trim(), '● '));
        else if (b.type === 'tool_use') out.push(`  ⎿ ${b.name}${detalle(b.input) ? ': ' + detalle(b.input) : ''}`);
      }
    }
  }
  return out.join('\n\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  let nombre = 'sesion';
  let outDir = path.join(process.cwd(), 'docs', 'sesiones');
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--nombre') nombre = args[++i];
    else if (args[i] === '--out') outDir = path.resolve(args[++i]);
    else files.push(args[i]);
  }
  nombre = nombre.replace(/[\\/:*?"<>|]/g, '-').trim() || 'sesion';

  if (!files.length) {
    const dir = projectDir();
    const todas = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({ f: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => a.m - b.m);
    if (!todas.length) { console.error('No hay registros de sesión.'); process.exit(1); }
    files.push(todas[todas.length - 1].f);
  }

  const events = files.flatMap(readSession);
  const primero = events.map((e) => e.timestamp && new Date(e.timestamp)).find((d) => d && !isNaN(d)) || new Date();
  fs.mkdirSync(outDir, { recursive: true });
  const destino = path.join(outDir, `${nombre} ${sello(primero)}.txt`);
  fs.writeFileSync(destino, render(events), 'utf8');
  console.log(`Guardado ${path.relative(process.cwd(), destino)} (${fs.statSync(destino).size} bytes)`);
}

main();
