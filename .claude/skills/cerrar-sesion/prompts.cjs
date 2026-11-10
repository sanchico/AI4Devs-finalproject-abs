#!/usr/bin/env node
// Extrae los prompts literales del usuario de los registros de Claude Code (.jsonl)
// y calcula el tiempo activo de la sesión.
//
// Uso:
//   node prompts.cjs                      # la sesión más reciente del proyecto
//   node prompts.cjs --since 2026-11-06   # todas las sesiones con actividad desde esa fecha (hora local)
//   node prompts.cjs ruta/a/sesion.jsonl  # sesiones concretas
//
// Tiempo activo: suma de los huecos entre eventos consecutivos menores de 30 min
// (las pausas largas no cuentan).

const fs = require('fs');
const path = require('path');
const os = require('os');

const PAUSA_MAX_MS = 30 * 60 * 1000;

function projectDir() {
  // Claude Code nombra la carpeta con la ruta del proyecto, cambiando ':', '\' y '/' por '-'.
  const cwd = process.cwd().replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ':');
  const name = cwd.replace(/[:\\/]/g, '-');
  const base = path.join(os.homedir(), '.claude', 'projects');
  const exact = path.join(base, name);
  if (fs.existsSync(exact)) return exact;
  const hit = fs.readdirSync(base).find((d) => d.toLowerCase() === name.toLowerCase());
  if (hit) return path.join(base, hit);
  throw new Error(`No encuentro el registro del proyecto en ${base} (buscaba ${name})`);
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// Una skill o comando invocado con /nombre llega como etiquetas XML; se muestra como "/nombre args".
function promptText(content) {
  const t = textOf(content).trim();
  const name = t.match(/<command-name>\s*([^<]*?)\s*<\/command-name>/);
  if (!name) return t;
  const args = t.match(/<command-args>\s*([\s\S]*?)\s*<\/command-args>/);
  const cmd = name[1].startsWith('/') ? name[1] : '/' + name[1];
  return args && args[1] ? `${cmd} ${args[1]}` : cmd;
}

function isHumanPrompt(e) {
  if (e.type !== 'user' || e.isMeta || e.isSidechain) return false;
  if (e.origin && e.origin.kind !== 'human') return false;
  const c = e.message && e.message.content;
  if (Array.isArray(c) && c.some((b) => b.type === 'tool_result')) return false;
  const t = textOf(c).trim();
  if (!t) return false;
  if (/^<(system-reminder|ide_|local-command-stdout)/.test(t)) return false;
  return true;
}

function readSession(file) {
  const events = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* línea incompleta */ }
  }
  return events;
}

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function main() {
  const args = process.argv.slice(2);
  let since = null;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since') since = new Date(args[++i].length <= 10 ? args[i] + 'T00:00' : args[i]);
    else files.push(args[i]);
  }

  if (!files.length) {
    const dir = projectDir();
    const all = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f))
      .map((f) => ({ f, m: fs.statSync(f).mtime }))
      .sort((a, b) => a.m - b.m);
    if (since) files.push(...all.filter((x) => x.m >= since).map((x) => x.f));
    else if (all.length) files.push(all[all.length - 1].f);
  }
  if (!files.length) { console.log('No hay sesiones en ese rango.'); return; }

  let totalMs = 0;
  let n = 0;
  for (const file of files) {
    const events = readSession(file);
    const times = events
      .map((e) => e.timestamp && new Date(e.timestamp))
      .filter((d) => d && !isNaN(d) && (!since || d >= since))
      .sort((a, b) => a - b);
    let activo = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap < PAUSA_MAX_MS) activo += gap;
    }
    totalMs += activo;

    const prompts = events.filter(isHumanPrompt)
      .filter((e) => !since || new Date(e.timestamp) >= since);
    if (!prompts.length) continue;

    console.log(`## Sesión ${path.basename(file, '.jsonl')}`);
    if (times.length) {
      console.log(`Inicio ${fmt(times[0])} · fin ${fmt(times[times.length - 1])} · ` +
        `activo ${(activo / 3600000).toFixed(2)} h · rama ${prompts[0].gitBranch || '?'}`);
    }
    console.log('');
    for (const e of prompts) {
      n++;
      console.log(`### Prompt ${n} · ${fmt(new Date(e.timestamp))}`);
      console.log('');
      console.log('```');
      console.log(promptText(e.message.content));
      console.log('```');
      console.log('');
    }
  }
  console.log(`**Total:** ${n} prompts · ${(totalMs / 3600000).toFixed(2)} h activas en ${files.length} registro(s).`);
}

if (require.main === module) main();

module.exports = { projectDir, textOf, promptText, isHumanPrompt, readSession, fmt };
