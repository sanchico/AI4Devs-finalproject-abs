---
name: run-trazo-mermaid
description: Run, launch, serve, screenshot or smoke-test pen2mermaid, formerly Trazo a Mermaid (the pen-to-Mermaid web app). Use when asked to start the app, draw on the canvas programmatically, check that shape recognition / connectors / Mermaid generation still work in the real browser, or take a screenshot of the UI.
---

Static web app (no build, ES modules): serve the `frontend/` folder over HTTP, then drive it in headless Chromium with
`.claude/skills/run-trazo-mermaid/driver.cjs` (Playwright). The driver draws strokes with the mouse,
which is the same code path as the S Pen (`ratón: dibuja` is the default mode).

All paths are relative to the repo root. Verified on Windows 10 with Git Bash, Node 22 and 24, playwright-core 1.63.

## Setup (once per session)

`playwright-core` is **not** a project dependency (the app must stay build-free). Install it into a
throwaway directory and point `NODE_PATH` at it:

```bash
T=$(mktemp -d); npm i --prefix "$T" --no-save playwright-core
```

The browser: playwright-core uses Playwright's cached Chromium (`~/AppData/Local/ms-playwright`)
if the version matches, otherwise the driver falls back to the installed Google Chrome
(`channel: 'chrome'`). If neither exists: `npx playwright install chromium`.

## Run (agent path)

1. Serve `frontend/` (Bash tool with `run_in_background: true`):

```bash
npx -y http-server -p 8000 -s -c-1 frontend
```

   Wait until it answers:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:8000 >/dev/null; do sleep 1; done' && echo SERVING
```

2. Drive it:

```bash
NODE_PATH="$T/node_modules" node .claude/skills/run-trazo-mermaid/driver.cjs http://localhost:8000 "$T"
```

   What it does: screenshot of the initial page (`$T/01-inicial.png`), clicks **Limpiar**, draws an
   ellipse, rectangle, diamond and rectangle, joins them with three lines, taps the last node and
   renames it to "Guardar", then screenshots (`$T/02-dibujado.png`) and prints the Mermaid code,
   the stats line and any console errors. Exits 0 and prints `OK` when there are 4 nodes, 3
   connections, the renamed label and no errors; otherwise `FALLO` / exit 1.

   Expected output (the same text is saved in `frontend/test/baseline-skill.txt`, the baseline of the
   modularization, so `diff` against it to check for regressions):

```
flowchart TD
  n6(["Inicio/Fin 1"])
  n7["Proceso 1"]
  n8{"Decisión 1"}
  n9["Guardar"]
  n6 --> n7
  n7 --> n8
  n8 --> n9
STATS: 4 nodos · 3 conexiones
ERRORS: []
OK
```

   Look at `02-dibujado.png` (Read it; in Git Bash get the Windows path with `cygpath -w`).
   To test a new shape or feature, copy the driver and add strokes with the `stroke/rect/diamond/ellipse`
   helpers: coordinates are relative to the canvas top-left.

3. Stop the server (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Run (human path)

Open `http://localhost:8000` in a browser; from the Android tablet use `http://<ip-del-pc>:8000`
on the same network. Pen draws, finger moves, mouse follows the "Ratón" toggle.

## Gotchas

- **`python` / `python3` on this PC is the Microsoft Store stub** (`WindowsApps\python.exe`): the
  `python3 -m http.server` command in CLAUDE.md starts nothing and the port never opens. Use
  `npx http-server`.
- **The page loads with an example diagram** (5 nodes: Inicio → Leer petición → …; the code, the
  stats and the preview are filled in from the start). Strokes
  drawn without clicking **Limpiar** land on top of it and connectors may snap to the example
  nodes. The driver clears first.
- **Node ids are not reset by Limpiar**: after clearing, ids continue at `n6`, while default labels
  restart at `Proceso 1`. Don't assert on ids.
- **ES modules do not load from `file://`** (the browser blocks them), so opening `index.html` by
  double-click shows a blank app: always serve `frontend/` over HTTP.
- **Module internals are not globals**, so `recognize()` / `mermaidCode()` cannot be called from
  `page.evaluate`. Test through strokes, or read `#code` (switch with `#tabCode`) and `#stats`. The pure
  modules (`geometry`, `recognizer`, `kinds/`, `model`) can instead be imported from Node: see
  `frontend/test/baseline.test.js` and run `node --test "frontend/**/*.test.js"`.
- **Closed-shape strokes must return close to their start point** (the driver ends 2px from the
  start); a connector must start inside one node and end inside another (18px tolerance), or you get
  the toast "Conector no reconocido".
- **A tap is pointerdown+up with <6px movement and <500ms**: `page.mouse.click` on a node opens
  the label editor (`#editInput`, `#editOk`).
- **The Mermaid preview is debounced 250ms** and mermaid.js comes from a CDN: wait ~1.5s before
  screenshotting, and the first load needs internet.
- Playwright's `mouse` produces `pointerType: 'mouse'`, not `'pen'`. That is fine because the mouse
  draws by default; if you click `#mode` first, the mouse moves nodes instead.
