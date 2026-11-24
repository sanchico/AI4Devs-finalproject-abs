# diagram-management Specification

## Purpose

Define cómo una persona con sesión gestiona sus diagramas desde la interfaz: verlos en una lista, crear uno, renombrarlo o
borrarlo, y compartirlo con un enlace de invitación que otra persona acepta, sin depender de scripts ni de la consola.

## Requirements

### Requirement: La lista muestra los diagramas del usuario
El sistema SHALL ofrecer una pantalla «Mis diagramas», en la ruta `#/lista`, que muestre los diagramas de los que el
usuario es miembro y no están borrados, del más reciente al más antiguo, con su título, su tipo y la fecha de su
última modificación. Todo texto que venga del servidor MUST mostrarse como texto, nunca interpretado como HTML. La
pantalla MUST pedir sesión antes de cargar nada.

#### Scenario: Ver mis diagramas
- **WHEN** un usuario con sesión y dos diagramas abre `#/lista`
- **THEN** ve los dos, el modificado más recientemente primero, cada uno con título, tipo y fecha

#### Scenario: Sin diagramas
- **WHEN** un usuario con sesión y ningún diagrama abre `#/lista`
- **THEN** ve un mensaje que lo dice y el botón «Nuevo»

#### Scenario: Un diagrama borrado no sale
- **WHEN** el dueño ha borrado un diagrama y abre `#/lista`
- **THEN** ese diagrama no aparece

#### Scenario: Abrir desde la lista
- **WHEN** el usuario elige un diagrama de la lista
- **THEN** la app abre ese diagrama en `#/d/<id>`

#### Scenario: Título con HTML
- **WHEN** un diagrama se titula `<img src=x onerror=alert(1)>`
- **THEN** la lista muestra ese texto tal cual y no se crea ningún elemento ni se ejecuta ningún código

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión abre `#/lista`
- **THEN** se le pide entrar y no se muestra ninguna fila hasta que haya sesión

#### Scenario: Fallo al cargar
- **WHEN** el servidor no responde al pedir la lista
- **THEN** la pantalla lo dice con un aviso y la app sigue usable (puede volver al modo solitario)

### Requirement: Crear un diagrama desde la interfaz
El sistema SHALL ofrecer en la lista un botón «Nuevo» con la elección del tipo (Flujo o Estados UML). Al pulsarlo
SHALL crear un diagrama vacío de ese tipo, del que el usuario es dueño, y abrirlo en `#/d/<id>`. Mientras se crea,
el botón MUST quedar desactivado para que una doble pulsación no cree dos diagramas.

#### Scenario: Nuevo diagrama de Flujo
- **WHEN** el usuario elige Flujo y pulsa «Nuevo»
- **THEN** se crea un diagrama de Flujo vacío y se abre su ruta, listo para dibujar

#### Scenario: Nuevo diagrama de Estados
- **WHEN** el usuario elige Estados UML y pulsa «Nuevo»
- **THEN** se crea un diagrama de Estados vacío y se abre su ruta

#### Scenario: Doble pulsación
- **WHEN** el usuario pulsa «Nuevo» dos veces seguidas
- **THEN** se crea un solo diagrama

#### Scenario: Fallo al crear
- **WHEN** el servidor rechaza o no responde a la creación
- **THEN** no se abre ningún diagrama, el botón vuelve a estar activo y un aviso explica que no se pudo crear

### Requirement: Compartir un diagrama copia un enlace de editor
El sistema SHALL ofrecer en un diagrama compartido abierto un botón «Compartir» que cree una invitación con el rol
de editor y copie al portapapeles el enlace `#/i/<token>` completo, con la dirección actual de la app. Si el
portapapeles no está disponible, el sistema MUST mostrar el enlace para copiarlo a mano. Quien no es dueño MUST
recibir un aviso que lo explique, sin cambiar nada en el diagrama.

#### Scenario: Copiar el enlace
- **WHEN** el dueño pulsa «Compartir»
- **THEN** el portapapeles recibe un enlace `#/i/<token>` de la app y un aviso confirma que se copió

#### Scenario: Sin portapapeles
- **WHEN** el navegador no permite escribir en el portapapeles
- **THEN** el enlace se muestra seleccionado para copiarlo a mano

#### Scenario: Quien no es dueño
- **WHEN** un editor pulsa «Compartir»
- **THEN** aparece el aviso «Solo el dueño puede invitar» y no se crea ninguna invitación

#### Scenario: El diagrama se borró
- **WHEN** el dueño pulsa «Compartir» en un diagrama que ya se borró
- **THEN** un aviso lo explica y no se copia ningún enlace

### Requirement: Un enlace de invitación se acepta y abre el diagrama
El sistema SHALL tratar `#/i/<token>`, con un token de 64 caracteres hexadecimales, como una invitación: pedir
sesión si falta (con el mismo panel de entrada, de modo que quien no tiene cuenta puede crearla), aceptar la
invitación y abrir el diagrama en `#/d/<id>`. Una invitación caducada o desconocida MUST dar el mismo aviso. Un
enlace con un token que no tiene esa forma MUST tratarse como dirección no válida, sin llamar al servidor.

#### Scenario: Aceptar con sesión
- **WHEN** un usuario con sesión abre un enlace de invitación válido
- **THEN** pasa a ser miembro con el rol de la invitación y se abre el diagrama

#### Scenario: Aceptar sin sesión
- **WHEN** alguien sin sesión abre un enlace de invitación válido
- **THEN** se le pide entrar o crear una cuenta y, al tener sesión, se acepta la invitación y se abre el diagrama sin volver a pedirle el enlace

#### Scenario: Cuenta nueva que exige confirmar el correo
- **WHEN** un invitado crea su cuenta y el proyecto exige confirmar el correo
- **THEN** el panel sigue abierto con el aviso de confirmar el correo, y al entrar después con el mismo enlace se acepta la invitación

#### Scenario: Invitación caducada o desconocida
- **WHEN** el usuario abre un enlace cuya invitación caducó o no existe
- **THEN** un aviso dice que el enlace no es válido o caducó y no se abre ningún diagrama, con el mismo texto en los dos casos

#### Scenario: Diagrama borrado
- **WHEN** el usuario abre una invitación de un diagrama que ya se borró
- **THEN** un aviso dice que el diagrama ya no existe

#### Scenario: Token con forma inválida
- **WHEN** el usuario abre `#/i/xyz`
- **THEN** la app avisa de que la dirección no es válida y no llama al servidor

#### Scenario: Repetir el enlace
- **WHEN** un miembro que ya aceptó vuelve a abrir el mismo enlace
- **THEN** se abre el diagrama con su rol de siempre, sin duplicar nada

### Requirement: Se llega a la lista desde la app
El sistema SHALL ofrecer en la barra de herramientas un acceso «Mis diagramas» tanto en el modo solitario como en
un diagrama compartido. Pulsarlo SHALL cambiar la ruta a `#/lista`. En el modo solitario el acceso MUST NOT hacer
ninguna petición por sí mismo: la sesión se pide al abrir la lista.

#### Scenario: Desde el modo solitario
- **WHEN** el usuario pulsa «Mis diagramas» en la app sin ruta
- **THEN** la ruta pasa a `#/lista` y se le pide entrar si no tiene sesión

#### Scenario: Desde un diagrama compartido
- **WHEN** el usuario pulsa «Mis diagramas» dentro de un diagrama compartido
- **THEN** la ruta pasa a `#/lista` y la lista se carga sin pedir entrar otra vez

### Requirement: Renombrar un diagrama desde la lista
El sistema SHALL ofrecer en cada fila de la lista un botón «Renombrar» que pida el título nuevo y lo guarde como una
operación `setMeta` del diagrama, sin abrirlo. El título MUST tener entre 1 y 200 caracteres y no ser solo espacios, y
se guarda tal como se escribió, sin transformarlo. Cancelar la petición del título no cambia nada. Un rechazo del
servidor MUST explicarse con un aviso y dejar el título anterior.

#### Scenario: Renombrar
- **WHEN** el usuario pulsa «Renombrar» en un diagrama suyo y escribe «Pedidos»
- **THEN** la fila muestra «Pedidos» y el diagrama se abre después con ese título

#### Scenario: Cancelar
- **WHEN** el usuario pulsa «Renombrar» y cancela la petición del título
- **THEN** no se envía nada y la lista queda igual

#### Scenario: Título no válido
- **WHEN** el usuario escribe un título vacío, solo con espacios o de más de 200 caracteres
- **THEN** un aviso dice que el título debe tener entre 1 y 200 caracteres, no se llama al servidor y el título no cambia

#### Scenario: Un lector no puede renombrar
- **WHEN** un miembro con rol de lector pulsa «Renombrar» y escribe un título
- **THEN** un aviso dice que su rol no lo permite y el título no cambia

#### Scenario: Un editor sí puede
- **WHEN** un editor renombra un diagrama que no es suyo
- **THEN** el título cambia para todos los miembros

#### Scenario: Título con HTML
- **WHEN** el usuario escribe `<b>x</b>` como título
- **THEN** la lista lo muestra como texto y no se crea ningún elemento

### Requirement: Borrar un diagrama desde la lista
El sistema SHALL ofrecer en cada fila de la lista un botón «Borrar» que, tras pedir confirmación, borre el diagrama
(borrado lógico: los datos se conservan) y lo quite de la lista. Solo el dueño puede: a quien no lo es, un aviso se lo
dice y el diagrama sigue en su lista. Cancelar la confirmación no cambia nada.

#### Scenario: Borrar un diagrama propio
- **WHEN** el dueño pulsa «Borrar» y confirma
- **THEN** el diagrama desaparece de su lista y de la de los demás miembros al recargarla

#### Scenario: Cancelar el borrado
- **WHEN** el dueño pulsa «Borrar» y cancela la confirmación
- **THEN** no se envía nada y el diagrama sigue en la lista

#### Scenario: Quien no es dueño
- **WHEN** un editor pulsa «Borrar» y confirma
- **THEN** un aviso dice «Solo el dueño puede borrar el diagrama» y el diagrama sigue en su lista

#### Scenario: Fallo al borrar
- **WHEN** el servidor no responde al borrar
- **THEN** un aviso lo dice y el diagrama sigue en la lista
