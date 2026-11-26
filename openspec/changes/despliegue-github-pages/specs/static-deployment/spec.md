## ADDED Requirements

### Requirement: La app está disponible en una URL pública con HTTPS
El sistema SHALL servir la aplicación por HTTPS desde una URL pública y estable, sin que haga falta ningún
programa ni servidor propio en el equipo de quien la abre. Con esa URL y sin ruta, la app MUST comportarse como
siempre: diagrama de ejemplo, un solo usuario, sin sesión y sin peticiones a Supabase.

#### Scenario: Abrir la URL pública sin ruta
- **WHEN** una persona abre la URL pública en un navegador, sin ninguna ruta tras la dirección
- **THEN** aparece el diagrama de ejemplo, no se muestra el panel de entrada y no se hace ninguna petición a Supabase

#### Scenario: Abrir la URL pública con HTTP
- **WHEN** una persona abre la dirección de la app con `http://` en lugar de `https://`
- **THEN** el navegador acaba en la dirección con `https://`

#### Scenario: Abrir desde otra red
- **WHEN** una tablet que no está en la red del equipo de desarrollo abre la URL pública
- **THEN** la app carga y se puede dibujar en ella

### Requirement: Solo se publica una versión que pasa los tests del frontend
El sistema SHALL publicar la aplicación únicamente cuando los tests del frontend han pasado sobre ese mismo
commit de la rama de integración (`develop`). Si algún test falla, MUST NOT publicarse nada y la versión publicada
antes SHALL seguir disponible sin cambios.

#### Scenario: Un cambio con los tests en verde
- **WHEN** se sube a `develop` un commit con todos los tests del frontend en verde
- **THEN** la versión publicada pasa a ser la de ese commit

#### Scenario: Un cambio con un test en rojo
- **WHEN** se sube a `develop` un commit con algún test del frontend en rojo
- **THEN** el despliegue no se ejecuta, la ejecución queda marcada como fallida y la URL pública sigue sirviendo la versión anterior

#### Scenario: Una rama que no es la de integración
- **WHEN** se sube un commit a una rama de trabajo distinta de `develop`
- **THEN** no se publica nada

### Requirement: Se publica solo lo que usa el navegador
El sistema SHALL publicar el código de la aplicación (HTML, hojas de estilo y módulos de `frontend/`) y MUST NOT
publicar los tests ni las muestras de trazos (`frontend/test/`). No MUST publicarse ningún secreto: la única
clave presente es la clave pública del proyecto, protegida por RLS.

#### Scenario: Pedir un archivo de tests
- **WHEN** una persona pide en la URL pública un archivo de `test/`, por ejemplo `test/ruta.test.js`
- **THEN** el servidor responde que no existe

#### Scenario: Revisar lo publicado
- **WHEN** se examinan los archivos publicados
- **THEN** no hay ninguna clave de servicio, contraseña de base de datos ni archivo `.env`

### Requirement: Los enlaces funcionan bajo el subdirectorio de la URL pública
La app SHALL funcionar cuando se sirve bajo un subdirectorio (`/AI4Devs-finalproject-abs/`) y no solo en la raíz
de un dominio. El enlace de invitación que genera «Compartir» MUST incluir ese subdirectorio, y abrirlo en otro
navegador MUST llevar a aceptar la invitación en la app desplegada.

#### Scenario: Generar un enlace de invitación desplegado
- **WHEN** el dueño de un diagrama pulsa «Compartir» en la app desplegada
- **THEN** el enlace copiado empieza por la URL pública completa, con su subdirectorio, y termina en `#/i/<token>`

#### Scenario: Abrir una invitación desde otro dispositivo
- **WHEN** otra persona abre ese enlace en un navegador distinto, con su sesión iniciada
- **THEN** acepta la invitación y entra en `#/d/<id>` dentro de la misma URL pública

#### Scenario: Navegar a un diagrama desde la lista
- **WHEN** un usuario abre un diagrama desde «Mis diagramas» en la app desplegada
- **THEN** la dirección cambia solo en su parte tras `#`, sin salir del subdirectorio, y el diagrama se abre

### Requirement: El enlace de confirmación del correo vuelve a la app desplegada
El sistema SHALL configurar Supabase Auth de modo que el enlace de confirmación del correo lleve siempre a la URL
pública de la app, y no a `localhost`, sea cual sea la dirección desde la que se creó la cuenta. Al volver, la app
MUST quitar de la dirección la sesión que añade el enlace, como ya hace en local.

#### Scenario: Crear cuenta desde la app desplegada
- **WHEN** una persona crea una cuenta desde la URL pública y pulsa el enlace de confirmación del correo
- **THEN** el navegador abre la URL pública, la dirección no conserva ningún `access_token` ni `refresh_token` y la app muestra el panel de entrada

#### Scenario: Crear cuenta desde la app en local
- **WHEN** una persona crea una cuenta desde `http://localhost:8000/` con el mismo proyecto de Supabase y pulsa el enlace de confirmación del correo
- **THEN** el navegador abre la URL pública (no `localhost`), y la cuenta queda confirmada y sirve para entrar también en local

### Requirement: Dos dispositivos colaboran a través de la URL pública
El sistema SHALL permitir que dos usuarios, cada uno en un dispositivo distinto, abran el mismo diagrama desde la
URL pública y se vean los cambios en tiempo real, con la latencia medida de forma que no se acerque a 1 s.

#### Scenario: PC y tablet en el mismo diagrama
- **WHEN** un usuario en el PC y otro en la tablet abren el mismo diagrama compartido desde la URL pública y uno añade un nodo
- **THEN** el otro lo ve aparecer, y el código Mermaid de los dos es idéntico

#### Scenario: Latencia con la app desplegada
- **WHEN** se ejecuta `npm run medir:latencia` contra el proyecto remoto tras el despliegue
- **THEN** el p95 de una operación suelta queda por debajo de 1 s
