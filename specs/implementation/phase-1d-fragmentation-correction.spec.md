# Phase 1D Fragmentation Correction — Implementation Specification

## Context

El mock TCP de `mock/ltms-server.ts` aplica actualmente el escenario `fragmented` antes del dispatch y devuelve la respuesta fija `MSG:hello|FIELD_COUNT:3`. Por ello `echo` siempre responde `hello` y `search`, `detail` y `book` pierden campos. `delayed-end` presenta el mismo problema por usar una respuesta fija. El parser/cliente y los endpoints actuales funcionan; el baseline conocido es 14 archivos de tests, 136 tests, con typecheck, lint y build pasando.

**Bug reproducible:** activar `fragmented` o `delayed-end` para una operación distinta de la respuesta fija hace que el cliente reciba payload incorrecto o incompleto, aunque el dispatch de la operación debería generar otra respuesta.

**Objetivo:** hacer que `fragmented` y `delayed-end` operen sobre la respuesta específica producida por el comando, conservando exactamente su semántica, campos, framing y estado de booking.

**No-goals:** no cambiar `/api/tms/echo`, `/api/tms/loads/search`, `/api/tms/loads/detail` ni `/api/tms/loads/book`; no modificar parser/cliente, UI, contrato wire, reglas de booking o políticas de retry; no refactorizar el mock en un módulo monolítico.

## Dependencies / Inputs

- [x] Requisitos confirmados en este contexto.
- [x] Contrato wire: requests CMD/AUTH/fields con CRLF; responses con records y `END`/`ERR`.
- [x] Regla de booking: `AVAILABLE -> BOOKED` solo en booking exitoso; no retry.
- [x] Baseline de regresión: Phase 1A–1C y suite actual completa.

## Files / Modules

- [ ] `mock/ltms-server.ts` — conservar la orquestación del ciclo de request, aplicar la precedencia de parse/auth/fault/dispatch y conectar dispatch con post-processing sin duplicar dispatch.
- [ ] `mock/scenarios.ts` — mantener/ajustar la definición y clasificación de escenarios; distinguir explícitamente faults pre-dispatch de transformaciones post-response y centralizar sus opciones (chunking/delay) sin respuestas wire fijas.
- [ ] Archivos de tests existentes que cubren el mock/scenarios — añadir pruebas unitarias o de integración en los seams actuales; no eliminar ni debilitar la cobertura de 1A–1C.

## Module Boundaries / Contracts

- **Flujo obligatorio:** recibir request y validar framing/parse con las reglas actuales → validar auth con las reglas actuales → resolver el fault configurado → si es pre-dispatch, emitir su resultado y terminar → ejecutar dispatch una sola vez → generar la respuesta específica del comando → aplicar, si corresponde, post-processing de response → escribir al socket.
- **Faults pre-dispatch:** `no-response`, `partial-without-end`, `malformed`, `invalid-framing`, `server-error` y custom remote code. Deben terminar el flujo antes del dispatch; en particular nunca deben ejecutar booking.
- **Respuesta command-specific:** el dispatch debe producir una representación única de la respuesta de la operación solicitada (records/campos y frame final), reutilizable por el writer y por los post-processors. No se permite una respuesta fija compartida entre comandos.
- **`fragmented`:** recibe los bytes wire exactos de la respuesta ya generada y solo cambia la partición temporal en chunks. Debe conservar byte-for-byte orden, contenido, CRLF, records y `END`/`ERR`; no debe parsear/reconstruir ni sustituir payload.
- **`delayed-end`:** recibe la respuesta estructurada o una separación inequívoca entre records y frame final; escribe los records originales y retrasa únicamente `END` por la opción existente. No debe cambiar records/campos ni usar `MSG:hello`; no introducir sleeps fijos frágiles.
- **Errores y estados:** conservar la clasificación observable actual de parse/auth y de cada fault. Un response post-processor no puede convertir un fault en éxito ni ocultar `ERR`.
- **Nombres conceptuales recomendados:** `resolveScenarioFault`, `dispatchCommandOnce`, `buildCommandResponse`, `serializeResponse`, `fragmentResponseBytes`, `delayResponseEnd` y `writeResponse`. Son límites conceptuales, no un parche obligatorio ni una instrucción para duplicar lógica.
- **Privacidad/configuración:** no incluir `MAX_BUY`, secretos u otros valores sensibles en payloads, logs o nuevos fixtures.

## Extraction Plan

- Extraer la resolución/clasificación de escenarios de la lógica de dispatch.
- Mantener un único dispatcher responsable de producir la semántica de `echo`, `search`, `detail` y `book`; los faults solo deciden si cortan antes o transforman la entrega después.
- Extraer helpers puros para chunking byte-preserving y para separar/reemitir el frame `END`; aislar la temporización del socket de la construcción de records.
- Nombrar y centralizar las opciones de fragmentación y delay; no incrustar respuestas wire de ejemplo en el camino de ejecución.
- Mantener privada la representación intermedia si no existe necesidad de exportarla; exponer únicamente seams testeables para escenario, dispatch y post-processing.

## Modularity Risks

- [ ] No convertir `ltms-server.ts` en un handler que mezcle parse, auth, selección de fault, reglas de dominio, serialización, timers y escritura. El entrypoint debe orquestar funciones enfocadas.
- [ ] No crear un segundo dispatcher dentro de `fragmented`/`delayed-end` ni generar respuestas alternativas por escenario.
- [ ] El estado mutado por `book` debe quedar exclusivamente en el dispatch exitoso; los pre-dispatch faults y cualquier fallo de entrega no pueden mutarlo.

## Technical Approach

Reordenar el pipeline para que los faults que modelan ausencia o corrupción de respuesta sigan siendo terminales antes del dispatch, mientras que `fragmented` y `delayed-end` sean post-processors de una respuesta real. El dispatch command-specific se ejecuta una sola vez y su resultado se entrega normalmente o se procesa sin alterar sus bytes/records. La solución debe preservar el contrato wire, la clasificación de errores, el estado `AVAILABLE -> BOOKED` y la ausencia de retry.

## Implementation Steps

1. Inspeccionar las interfaces internas actuales de `mock/ltms-server.ts` y `mock/scenarios.ts`, identificar dónde se selecciona el escenario y fijar la separación pre-dispatch/post-response sin cambiar endpoints.
2. Introducir el contrato interno de respuesta command-specific y hacer que el dispatcher lo genere una sola vez para cada comando, incluyendo sus records y frame final.
3. Mover la aplicación de `fragmented` y `delayed-end` después de ese dispatch: chunking byte-preserving para el primero y delay exclusivo de `END` para el segundo.
4. Verificar explícitamente que los faults pre-dispatch retornan antes del dispatcher y que ningún camino de booking fallido muta estado ni reintenta.
5. Añadir/modificar las pruebas indicadas abajo, ejecutar la verificación completa y realizar smoke manual con un único mock escuchando en el puerto 9000.

## Edge Cases

- `echo` fragmentado debe conservar exactamente el input solicitado, no `hello`.
- `search`, `detail` y `book` fragmentados deben conservar shape, cantidad y nombres/valores de campos, además del framing.
- `delayed-end` debe retrasar solo `END`; nunca truncar records ni sustituir el resultado de la operación.
- `ERR`, custom remote code, respuesta parcial sin `END` y framing inválido deben conservar su clasificación actual.
- Un timeout de booking es comportamiento incierto del entorno: no añadir retry ni asumir que un timeout equivale a booking exitoso; comprobar que no se produce mutación accidental.
- La terminación/reinicio del mock en smoke debe evitar dos servidores simultáneos en `9000`.

## Test Plan

- [ ] `echo` con `fragmented`: input no fijo, bytes/payload y framing equivalentes al modo normal, entregados en múltiples chunks.
- [ ] `search`, `detail` y `book` con `fragmented`: misma shape y campos que en modo normal; comprobar también `END` y respuesta del cliente.
- [ ] Cada comando relevante con `delayed-end`: records command-specific idénticos y solo `END` retrasado; evitar aserciones basadas en sleeps frágiles, usando señales/eventos o ventanas temporales tolerantes.
- [ ] `no-response`, `partial-without-end`, `malformed`, `invalid-framing`, `server-error` y custom remote code: misma clasificación y efectos actuales; confirmar que no alcanzan dispatch.
- [ ] Booking bajo cualquier fault/fallo: estado permanece sin mutación accidental y no se reintenta; booking normal exitoso sigue `AVAILABLE -> BOOKED`.
- [ ] Modo normal y regresión completa de Phase 1A–1C; conservar el baseline de 14 archivos/136 tests o documentar cualquier cambio intencional.

## Verification Plan

- [ ] Ejecutar `npm test`.
- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run build`.
- [ ] Smoke bash: detener/reiniciar limpiamente el mock, confirmar que `9000` está libre antes de arrancar y que existe un solo listener; ejercitar echo, search, detail, book y los escenarios afectados. No levantar un segundo servidor para repetir la prueba.
- [ ] Revisar diff para confirmar que solo se modificaron los archivos de mock/tests necesarios, que no cambiaron endpoints/UI y que no aparecen secretos ni `MAX_BUY`.

## Rollback Plan

- [ ] Revertir el commit de esta corrección y restaurar el comportamiento baseline de 1C/1D, manteniendo intactos endpoints, parser/cliente y fixtures de faults existentes.
- [ ] Si solo falla la temporización, desactivar `delayed-end` mientras se conserva el camino command-specific; no reintroducir respuestas fijas ni mover faults pre-dispatch al dispatch.

## Acceptance Criteria

- [ ] `fragmented` y `delayed-end` se aplican únicamente después de generar una respuesta específica del comando, una sola vez.
- [ ] `fragmented` conserva byte-for-byte la respuesta y solo cambia el chunking; `delayed-end` conserva records/campos y retrasa únicamente `END`.
- [ ] Echo conserva el input; search/detail/book conservan shape, campos y contrato wire en modo normal y bajo ambos faults.
- [ ] Los faults pre-dispatch mantienen su clasificación y no ejecutan booking; los fallos de booking no mutan estado ni hacen retry.
- [ ] Los endpoints `/api/tms/echo`, `/api/tms/loads/search`, `/api/tms/loads/detail` y `/api/tms/loads/book` no cambian.
- [ ] Tests, typecheck, lint, build y smoke pasan; no se levantan dos mocks en `9000`.
- [ ] La implementación evita un mock monolítico, no duplica dispatch y deja lógica de post-processing independientemente testeable.
