# Proposal

## Why

Tercera y última parte del bloque **F4 · Cliente colaborativo** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md)
(v0.7.7), con el **login mínimo de F5**. Respalda **HU-01** (dibujar juntos) y los criterios de terminado 1
(dos dispositivos, menos de 1 s), 3 (deshacer solo lo propio) y 6 (aviso y solo lectura si se corta la conexión).

El servidor (`apply_ops`, ya en el remoto) y la cola del cliente (`collab.js`, probada en Node con una red
simulada) están hechos, pero **nada los conecta a la app**: no hay supabase-js, ni sesión, ni forma de abrir un
diagrama compartido, y `input.js` desestructura el resultado de `addNode` sin comprobarlo, así que un modelo en
solo lectura lo haría fallar. Sin este change la colaboración solo existe en los tests, y el plazo de entrega
(26-11-2026) no deja margen para descubrirlo después de desplegar.

## What Changes

- **supabase-js por CDN, sin build:** la versión exacta 2.119.0 (la que ya usan los tests del backend), con
  comprobación de integridad, como mermaid.js. Un `frontend/config.js` con la URL y la clave pública del
  proyecto remoto (la clave pública va en el frontend por diseño: la barrera es la RLS).
- **Adaptador del transporte** (`frontend/transporte-supabase.js`, sin DOM, con el cliente de supabase-js
  inyectado para probarlo en Node): `subscribe` espera al mensaje `system` de Postgres Changes con estado `ok` y
  no a `SUBSCRIBED` (lo enviado entre los dos se perdía); `load` lee el tipo, el rol y el registro **paginando
  de 1 000 en 1 000**, porque la API devuelve como máximo 1 000 filas y un diagrama puede tener 5 000
  operaciones; `send` llama a `apply_ops` y traduce la respuesta al contrato de `collab.js`.
- **Sesión mínima:** panel de correo y contraseña con "Entrar" y "Crear cuenta" y botón "Salir", con errores
  mostrados como texto; la sesión sobrevive a recargar.
- **Abrir un diagrama compartido** con la ruta `#/d/<id>`: si no hay sesión pide entrar, carga el registro, fija
  el tipo (el selector queda bloqueado) y enlaza el modelo con la cola. **Sin ruta, la app abre como hoy**
  (ejemplo, un solo usuario, sin red ni sesión). Cambiar la ruta recarga la página.
- **Estado y bloqueo visibles:** un indicador de modo (conectando, editando, solo lectura con su motivo, sin
  conexión), avisos con el texto de cada rechazo del servidor, y barra de herramientas y lienzo bloqueados cuando
  no se puede editar. `input.js` comprueba el resultado de cada gesto y no empieza a dibujar si está bloqueado.
- **El selector de dirección y el de tipo siguen al diagrama** cuando cambian por una operación ajena, y el
  repintado se agrupa por fotograma para que una ráfaga remota no renderice Mermaid decenas de veces.
- **`collab.js`:** `open()` devuelve también la causa del fallo (el error del adaptador, con su estado) para que
  la app distinga "sin acceso", "borrado" y "sin conexión".
- **`supabase/scripts/preparar-diagrama.js`:** crea un diagrama con el usuario A de la medida, lo comparte con B
  como editor (o lector) y escribe el enlace `#/d/<id>`, para probar en dos navegadores sin botón de "nuevo".
- **Prueba en navegador real** con dos contextos (A y B) contra el proyecto remoto.

## Fuera de alcance

- **Lista de diagramas, "Nuevo diagrama", renombrar, borrar, invitar con enlace y cambiar roles**: son el resto de
  F5. Hasta entonces los diagramas se crean y se comparten con el script de arriba.
- **El despliegue (D1)**, la URL pública y la configuración de Auth (confirmación por correo, URLs de redirección).
  La prueba de este change es con `http-server` en local contra el remoto.
- Reconexión del canal, presencia, edición sin conexión y mostrar quién edita: fuera del MVP.
- Aviso al cerrar la página con gestos aún sin confirmar (tardan menos de 1 s en confirmarse).
- No choca con el "fuera de alcance" del MVP.
- Presupuesto: el PRD da 2 h al resto de F4 y 0,5 h de login a F5; este change son unas 3,5 h. La desviación
  respecto al PRD se anota en la bitácora.

## Capabilities

### New Capabilities
- `user-session`: entrar, registrarse y salir con correo y contraseña, persistencia de la sesión y modo
  solitario sin sesión.
- `shared-diagram-session`: abrir un diagrama compartido por su ruta, ver y respetar el modo (editando, solo
  lectura, sin conexión), avisar de los rechazos y abrir diagramas grandes completos.

### Modified Capabilities
- `canvas-editing`: "Diagrama de ejemplo al abrir" pasa a valer solo sin ruta de diagrama compartido, y
  "App servida sin build" añade supabase-js a las dependencias del CDN con versión exacta e integridad.
- `collaborative-editing`: se añade que, si el diagrama no se puede abrir, se informa de la causa.

## Impact

- Nuevos módulos: `frontend/config.js`, `frontend/ruta.js`, `frontend/avisos.js`, `frontend/transporte-supabase.js`
  y `frontend/colaboracion.js` (el único que toca el DOM). Cambios en `index.html`, `styles.css`, `main.js`,
  `input.js` y `collab.js`.
- Tests en `frontend/test/`: `ruta.test.js`, `avisos.test.js`, `transporte-supabase.test.js` (con un cliente falso
  en `helpers/supabase-falso.js`) y un caso nuevo en `collab.test.js`. Los 225 anteriores no cambian.
- Nuevo `supabase/scripts/preparar-diagrama.js`; usa el entorno de `supabase/.env.remoto`, sin imprimir credenciales.
- `CLAUDE.md`, `docs/PRD-MVP.md` y el readme.
- Una dependencia más por CDN (supabase-js, unos 220 KB): si no carga, el modo solitario sigue funcionando.
