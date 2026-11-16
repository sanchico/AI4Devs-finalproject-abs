# Tasks

Estimación total: 0,8 h (dentro de las 1,5 h del bloque F3 del PRD; con `meta-titulo` van 1,05 h y quedan
unos 0,45 h para `grabar-trazos`).

Este change solo añade tests, fixtures y un ayudante de test: no se modifica ningún archivo de `frontend/`
fuera de `frontend/test/`.

## 1. Fixtures de operaciones (0,25 h)

- [x] 1.1 Crear `frontend/test/fixtures/ops/` con cinco secuencias escritas **a mano** (el `final` y el `resultado` de cada operación salen de la spec, no de ejecutar `apply`): `flujo-basico.json` (nodos, aristas, etiqueta y título), `estados-con-pseudoestados.json` (elipses y elección), `rechazos.json` (`missing`, `duplicate`, `invalid`, `unknown` y que el diagrama no cambia), `borrar-nodo-con-aristas.json` y `orden-de-insercion.json` (`addNode` y `addEdge` con `at`). Cada una con el formato de design.md §5, y `mermaid` en las que lo fijan. Verificación: `ls frontend/test/fixtures/ops` muestra los cinco archivos y cada uno es JSON válido (`node -e "JSON.parse(require('fs').readFileSync(f))"`).
- [x] 1.2 Crear `frontend/test/fixtures.test.js`, que lee todos los `*.json` de esa carpeta y, por cada uno, aplica las operaciones desde el estado inicial (vacío si falta `inicial`), comprueba el `resultado` de cada una, compara el diagrama final con `final` y, si existe, el código con `mermaid`. También aplica la copia serializada de cada operación. Verificación: `node --test "frontend/**/*.test.js"` pasa; cambiando a mano un `resultado` o un `final` el test falla con el nombre de la fixture (y se deshace el cambio).

## 2. Red simulada y convergencia (0,4 h)

- [x] 2.1 Crear `frontend/test/helpers/red-simulada.js` con `Servidor` (numera y guarda el registro, reparte a las bandejas de los clientes), `Cliente` (`confirmado`, `pendientes`, `visible` recalculado por reproducción; envía de una en una; rechaza un hueco de secuencia), `reproducir(registro, inicial)` y el generador con semilla `mulberry32`. Máximo orientativo de unas 120 líneas. Verificación: un test mínimo en `convergencia.test.js` con un solo cliente muestra que `visible` incluye lo pendiente y que, al confirmarse, `visible` es igual a `confirmado`.
- [x] 2.2 En `frontend/test/convergencia.test.js`, añadir los casos escritos a mano, cada uno con sus clientes, el orden de entrega y el diagrama final esperado: (a) dos inserciones en la misma posición con el orden de nodos y el código Mermaid idénticos en ambos clientes (el caso `q,p,x` de design.md); (b) dos `updateNode` de la misma etiqueta, donde gana la última del registro en todos; (c) uno borra un nodo y otro lo edita; (d) los dos crean la misma arista y la segunda se descarta en todos; (e) una operación pendiente que el registro deja sin efecto. En cada uno, `visible` de todos los clientes, su `confirmado` y `reproducir(registro)` son iguales, y el código Mermaid también. Verificación: los tests pasan.
- [x] 2.3 Añadir en el mismo archivo el **control negativo**: un cliente que aplica lo propio al momento y no lo repite al confirmarse (la regla "por campo") diverge en el caso (a). Verificación: el test comprueba que los dos diagramas **difieren**, de modo que si la red simulada dejara de producir conflictos el control fallaría.
- [x] 2.4 Añadir las ráfagas con semilla fija: 100 semillas, 3 clientes, unos 40 pasos cada una (editar, enviar, entregar a un cliente al azar), generando las operaciones desde el `visible` de cada cliente. Al final se entrega todo y se comprueba que los tres clientes y el registro reproducido coinciden en diagrama y en Mermaid. El mensaje de fallo incluye la semilla. El test cuenta además las operaciones rechazadas del registro y las de cada tipo, y exige que haya rechazos y que aparezcan los siete tipos. Verificación: `node --test "frontend/**/*.test.js"` pasa en menos de unos segundos y dos ejecuciones seguidas dan el mismo resultado.

## 3. Mermaid por tipo (0,1 h)

- [x] 3.1 Crear `frontend/test/mermaid-tipos.test.js` con el código **completo** esperado, escrito a mano, de: un diagrama de Flujo en `LR` con las tres formas, un nodo sin etiqueta (`[" "]`) y aristas con y sin etiqueta; y un diagrama de Estados con una elipse inicial y otra final (`[*] --> n2`, `n4 --> [*]`, sin línea `state` para las elipses, y los demás nodos numerados contando las elipses), un estado, una elección (`state n3 <<choice>>`) y una arista con etiqueta. Verificación: los tests pasan y `grep -c "<<choice>>\|\[\*\]" frontend/test/mermaid-tipos.test.js` es mayor que 0.

## 4. Documentación y comprobación (0,05 h)

- [x] 4.1 Actualizar `CLAUDE.md`: en la lista de `test/`, añadir `fixtures.test.js` y `fixtures/ops/` (secuencias de operaciones con su resultado), `convergencia.test.js` con `helpers/red-simulada.js` (clientes con pendientes y semilla fija) y `mermaid-tipos.test.js`. Verificación: `grep -n "convergencia.test.js\|fixtures/ops\|mermaid-tipos" CLAUDE.md` muestra las tres menciones.
- [x] 4.2 Comprobar que el change no toca la aplicación y que todo pasa. Verificación: `git status -s frontend | grep -v "frontend/test"` no devuelve nada, y `node --test "frontend/**/*.test.js"` termina con 0 fallos.

## Workflow follow-up

- Archivar el change antes de proponer `grabar-trazos`. Al llevar `skip_specs`, el archivado no sincroniza ninguna spec.
- Al empezar F4, corregir en el PRD la regla de "Respuesta inmediata" para las operaciones pendientes (design.md, Riesgos) y escribir entonces la spec de la convergencia con pendientes.
- Escribir la entrada de la sesión con `/cerrar-sesion`.
